'use strict';
// Grupos (party): hasta 6 jugadores. La experiencia de los bichos se reparte entre los que están
// cerca (mismo mapa, a menos de 25 baldosas) con un bonus por cada integrante, y el oro va directo
// a la billetera de cada uno. Chat de grupo con /P y señalización del chat de voz (WebRTC).
const G = require('./gamedata');

const P = {};
const MAX = 6;
const DIST = 25;
const BONUS = 0.10; // +10% de experiencia total por cada integrante extra que esté cerca
const INVITACION_MS = 30000;

P.initParty = function () {
  this.parties = new Map();
  this._partySeq = 1;
  setInterval(() => this.partyTick(), 1000);
};

P.partyDe = function (p) { return p && p.party ? this.parties.get(p.party) : null; };
const vivos = function (party) { return party.miembros.map((id) => this.players.get(id)).filter(Boolean); };

// ---------- invitar / aceptar / salir ----------
P.partyInvitar = function (p, t) {
  if (!t || t.id === p.id) return;
  if (t.gmInvis && p.gm < t.gm) return this.msg(p, 'El usuario no está online.', 'warn');
  let g = this.partyDe(p);
  if (g && g.lider !== p.id) return this.msg(p, 'Sólo el líder del grupo puede invitar.', 'warn');
  if (g && g.miembros.length >= MAX) return this.msg(p, `El grupo está lleno (máximo ${MAX}).`, 'warn');
  if (t.party) return this.msg(p, `${t.name} ya está en un grupo.`, 'warn');
  t.invGrupo = { de: p.id, hasta: Date.now() + INVITACION_MS };
  this.send(t, { t: 'partyInv', de: p.name, id: p.id });
  this.msg(p, `Invitaste a ${t.name} a tu grupo.`, 'party');
};

P.partyResponder = function (p, acepta) {
  const inv = p.invGrupo; p.invGrupo = null;
  if (!inv || Date.now() > inv.hasta) return this.msg(p, 'La invitación ya venció.', 'warn');
  const l = this.players.get(inv.de);
  if (!l) return this.msg(p, 'El que te invitó ya no está conectado.', 'warn');
  if (!acepta) return this.msg(l, `${p.name} rechazó la invitación al grupo.`, 'party');
  if (p.party) return;
  let g = this.partyDe(l);
  if (!g) {
    g = { id: this._partySeq++, lider: l.id, miembros: [l.id], voz: new Set() };
    this.parties.set(g.id, g); l.party = g.id;
  }
  if (g.miembros.length >= MAX) return this.msg(p, 'El grupo está lleno.', 'warn');
  g.miembros.push(p.id); p.party = g.id;
  this.partyAviso(g, `${p.name} se unió al grupo.`);
  this.partyEnviar(g);
};

P.partySalir = function (p, motivo = 'salió del grupo') {
  const g = this.partyDe(p);
  if (!g) return;
  g.miembros = g.miembros.filter((id) => id !== p.id);
  g.voz.delete(p.id);
  p.party = null;
  this.send(p, { t: 'party', miembros: [] });
  if (g.miembros.length <= 1) {
    for (const id of g.miembros) { const o = this.players.get(id); if (o) { o.party = null; this.send(o, { t: 'party', miembros: [] }); this.msg(o, `${p.name} ${motivo}. El grupo se disolvió.`, 'party'); } }
    this.parties.delete(g.id);
    return;
  }
  if (g.lider === p.id) g.lider = g.miembros[0];
  this.partyAviso(g, `${p.name} ${motivo}.` + (g.lider !== p.id ? '' : ''));
  this.partyEnviar(g);
};

P.partyEchar = function (p, nombre) {
  const g = this.partyDe(p);
  if (!g || g.lider !== p.id) return this.msg(p, 'Sólo el líder puede echar del grupo.', 'warn');
  const t = vivos.call(this, g).find((o) => o.name.toLowerCase() === String(nombre).toLowerCase());
  if (!t || t.id === p.id) return this.msg(p, 'Ese jugador no está en tu grupo.', 'warn');
  this.msg(t, `${p.name} te echó del grupo.`, 'party');
  this.partySalir(t, 'fue echado del grupo');
};

P.partyAviso = function (g, texto) { for (const o of vivos.call(this, g)) this.msg(o, texto, 'party'); };

P.partyChat = function (p, texto) {
  const g = this.partyDe(p);
  if (!g) return this.msg(p, 'No estás en un grupo. Invitá a alguien con clic derecho o /GRUPO nombre.', 'warn');
  texto = String(texto || '').slice(0, 200).trim();
  if (!texto) return;
  for (const o of vivos.call(this, g)) this.msg(o, `[Grupo] ${p.name}: ${texto}`, 'party');
};

// ---------- estado para el panel del cliente ----------
P.partyEstado = function (g) {
  return vivos.call(this, g).map((o) => ({ id: o.id, n: o.name, lvl: o.stats.lvl, hp: o.stats.hp, mhp: o.stats.maxHp,
    man: o.stats.man, mman: o.stats.maxMan, lider: o.id === g.lider ? 1 : 0, voz: g.voz.has(o.id) ? 1 : 0, muerto: o.dead ? 1 : 0, mapa: o.map }));
};
P.partyEnviar = function (g) {
  const est = this.partyEstado(g);
  g._ultimo = JSON.stringify(est);
  for (const o of vivos.call(this, g)) this.send(o, { t: 'party', miembros: est, lider: g.lider });
};
P.partyTick = function () {
  for (const g of this.parties.values()) {
    const est = this.partyEstado(g);
    if (JSON.stringify(est) !== g._ultimo) this.partyEnviar(g);
  }
};

// ---------- reparto de experiencia y oro ----------
// devuelve la lista de integrantes que cobran (cerca y vivos); si no hay grupo, sólo el que mató
P.partyCercanos = function (p) {
  const g = this.partyDe(p);
  if (!g) return [p];
  return vivos.call(this, g).filter((o) => o.id === p.id || (!o.dead && o.map === p.map && Math.abs(o.x - p.x) <= DIST && Math.abs(o.y - p.y) <= DIST));
};
// base: experiencia sin multiplicar; extra: multiplicador común (noche)
P.repartirExp = function (p, base, extra = 1) {
  const quienes = this.partyCercanos(p);
  if (quienes.length === 1) { const e = Math.floor(base * this.multExp(p) * extra); if (e > 0) this.giveExp(p, e); return; }
  const parte = base * (1 + BONUS * (quienes.length - 1)) / quienes.length;
  for (const o of quienes) { const e = Math.floor(parte * this.multExp(o) * extra); if (e > 0) this.giveExp(o, e); }
};
// oro: con grupo va directo a la billetera de cada uno; sin grupo, cae al piso como siempre
P.repartirOro = function (p, oro, mapa, x, y) {
  if (oro <= 0) return;
  const quienes = this.partyCercanos(p);
  if (quienes.length === 1) return void this.dropObj(mapa, x, y, 12, oro);
  const parte = Math.floor(oro / quienes.length);
  for (const o of quienes) {
    o.stats.gld += parte; this.sendStat(o, ['gld']);
    this.msg(o, `Tu parte del oro del grupo: ${parte.toLocaleString('es-AR')}.`, 'party');
  }
};

// ---------- chat de voz: el servidor sólo pasa los mensajes de conexión entre integrantes ----------
P.partyVoz = function (p, on) {
  const g = this.partyDe(p);
  if (!g) return;
  if (on) g.voz.add(p.id); else g.voz.delete(p.id);
  this.partyEnviar(g);
};
P.partyVozSenal = function (p, msg) {
  const g = this.partyDe(p);
  const t = this.players.get(+msg.to);
  if (!g || !t || t.party !== g.id) return;
  this.send(t, { t: 'vozSig', de: p.id, data: msg.data });
};

module.exports = P;
