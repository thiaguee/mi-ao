'use strict';
// Eventos automáticos para darle vida al mundo (configurables en data/eventos.json):
//  - Invasión: una horda ataca las afueras de una ciudad; premio por bicho y al que más mata.
//  - Cacería: aparece la Bestia Dorada en un bosque al azar; el que la mata se lleva el premio.
//  - Trivia: una pregunta en el chat; gana el primero que contesta bien.
//  - Sorteo: entre los conectados.
//  - Hora feliz: experiencia doble por un rato.
// GMs: /EVENTO tipo · /EVENTO TERMINAR · /EVENTO (ver el actual).
const fs = require('fs');
const path = require('path');

const E = {};
const fmt = (n) => Number(n || 0).toLocaleString('es-AR');
const norm = (s) => String(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9/ ]/g, '').trim();
const rnd = (a, b) => a + Math.floor(Math.random() * (b - a + 1));

E.cargarEventos = function () {
  try { this.cfgEv = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data', 'eventos.json'), 'utf8')); }
  catch (e) { console.error('Error leyendo eventos.json:', e.message); this.cfgEv = { activo: false }; }
  this.evento = null;
  this.eventoExp = 1;
  this.proxEvento = Date.now() + this.minutosHastaEvento() * 60000;
  setInterval(() => this.eventoTick(), 2000);
  console.log('Eventos:', this.cfgEv.activo ? 'automáticos' : 'apagados');
};
E.minutosHastaEvento = function () { const [a, b] = this.cfgEv.cadaMinutos || [45, 75]; return rnd(a, b); };

E.nombreMapa = function (m) { return String((this.maps[m] && this.maps[m].d.name) || m).replace(/\.+$/, ''); };
E.anunciar = function (texto) { this.toAll({ t: 'announce', text: texto }); this.toAll({ t: 'msg', text: texto, color: 'server' }); };

E.darPremio = function (p, r, motivo) {
  const partes = [];
  if (r.oro) { p.stats.gld += r.oro; this.sendStat(p, ['gld']); partes.push(`${fmt(r.oro)} de oro`); }
  if (r.puntosTorneo) { p.puntosTorneo = (p.puntosTorneo || 0) + r.puntosTorneo; partes.push(`${r.puntosTorneo} puntos de torneo`); }
  if (r.item) { const got = this.giveItem(p, r.item[0], r.item[1]); if (got < r.item[1]) this.dropObj(p.map, p.x, p.y, r.item[0], r.item[1] - got); partes.push(r.nombre || 'un premio'); }
  this.msg(p, `🎁 ${motivo}: ganaste ${partes.join(', ')}.`, 'server');
  this.savePlayer(p);
  return partes.join(', ');
};

E.eventoTick = function () {
  const ahora = Date.now();
  const ev = this.evento;
  if (ev && ev.fin && ahora >= ev.fin) return this.terminarEvento('tiempo');
  if (!ev && this.cfgEv.activo && ahora >= this.proxEvento) {
    // no pisar la guerra ni arrancar con el servidor vacío
    const gente = [...this.players.values()].filter((p) => !p.gm).length;
    if ((this.guerra && this.guerra.estado === 'activa') || gente < 2) { this.proxEvento = ahora + 5 * 60000; return; }
    const tipos = Object.entries(this.cfgEv.tipos || {});
    let r = Math.random() * tipos.reduce((a, [, w]) => a + w, 0);
    const tipo = (tipos.find(([, w]) => (r -= w) < 0) || tipos[0])[0];
    this.iniciarEvento(tipo);
  }
};

E.iniciarEvento = function (tipo, quien) {
  if (this.evento) this.terminarEvento('nuevo');
  const c = this.cfgEv[tipo];
  if (!c) return false;
  const ahora = Date.now();
  const ev = { tipo, inicio: ahora, npcs: new Set(), kills: {}, quien };
  if (tipo === 'invasion') {
    const [ciudad, mapa] = c.lugares[rnd(0, c.lugares.length - 1)];
    ev.fin = ahora + c.duracionMinutos * 60000; ev.mapa = mapa; ev.ciudad = ciudad;
    for (const [num, cant] of c.bichos) {
      for (let i = 0; i < cant; i++) {
        const n = this.spawnNpc(num, mapa, rnd(30, 70), rnd(30, 70), false);
        if (n) { n.evento = true; ev.npcs.add(n.id); }
      }
    }
    this.evento = ev;
    this.anunciar(`⚔ ¡INVASIÓN! Una horda ataca las afueras de ${ciudad} (${this.nombreMapa(mapa)}). ${fmt(c.premioPorBicho.oro)} de oro por cada invasor; el que más mate gana un premio. Tienen ${c.duracionMinutos} minutos.`);
  } else if (tipo === 'caceria') {
    const mapa = c.mapas[rnd(0, c.mapas.length - 1)];
    const n = this.spawnNpc(c.npc, mapa, rnd(25, 75), rnd(25, 75), false);
    if (!n) return false;
    n.evento = true; ev.npcs.add(n.id); ev.mapa = mapa; ev.fin = ahora + c.duracionMinutos * 60000;
    this.evento = ev;
    this.anunciar(`🐉 ¡CACERÍA! La Bestia Dorada apareció en ${this.nombreMapa(mapa)}. El que la mate se lleva ${fmt(c.premio.oro)} de oro y ${c.premio.puntosTorneo} puntos de torneo. Tienen ${c.duracionMinutos} minutos.`);
  } else if (tipo === 'trivia') {
    const [preg, resp] = c.preguntas[rnd(0, c.preguntas.length - 1)];
    ev.pregunta = preg; ev.respuestas = resp.map(norm); ev.fin = ahora + c.segundos * 1000;
    this.evento = ev;
    this.anunciar(`❓ TRIVIA: ${preg} — Respondé en el chat (el primero que acierte gana ${fmt(c.premio.oro)} de oro).`);
  } else if (tipo === 'sorteo') {
    const candidatos = [...this.players.values()].filter((p) => !p.gm && p.stats.lvl >= (c.nivelMinimo || 1));
    if (!candidatos.length) { this.proxEvento = ahora + 10 * 60000; return false; }
    const ganador = candidatos[rnd(0, candidatos.length - 1)];
    let r = Math.random() * c.pesos.reduce((a, b) => a + b, 0);
    const premio = c.premios[c.pesos.findIndex((w) => (r -= w) < 0)] || c.premios[0];
    const txt = this.darPremio(ganador, premio, 'Sorteo');
    this.anunciar(`🎉 SORTEO entre ${candidatos.length} conectados: ¡ganó ${ganador.name}! Premio: ${txt}.`);
    this.proxEvento = ahora + this.minutosHastaEvento() * 60000;
    return true;
  } else if (tipo === 'dobleexp') {
    ev.fin = ahora + c.duracionMinutos * 60000; this.eventoExp = 2;
    this.evento = ev;
    this.anunciar(`✨ ¡HORA FELIZ! Experiencia DOBLE durante ${c.duracionMinutos} minutos.`);
  } else return false;
  return true;
};

E.terminarEvento = function (motivo) {
  const ev = this.evento;
  if (!ev) return;
  this.evento = null;
  this.proxEvento = Date.now() + this.minutosHastaEvento() * 60000;
  for (const id of ev.npcs) { const n = this.npcs.get(id); if (n) { this.remove(n); this.npcs.delete(id); } }
  if (ev.tipo === 'invasion') {
    const top = Object.entries(ev.kills).sort((a, b) => b[1] - a[1])[0];
    const quedan = ev.npcs.size;
    let txt = quedan ? `La invasión terminó: quedaron ${quedan} invasores y se retiraron.` : `¡${ev.ciudad} está a salvo! Derrotaron a todos los invasores.`;
    if (top) {
      const p = this.findPlayer(top[0]);
      if (p) txt += ` El que más mató fue ${p.name} (${top[1]}): ` + this.darPremio(p, this.cfgEv.invasion.premioMejor, 'Mejor defensor de la invasión') + '.';
    }
    this.anunciar('🛡 ' + txt);
  } else if (ev.tipo === 'caceria' && motivo === 'tiempo') this.anunciar('🐉 La Bestia Dorada escapó. Nadie la cazó esta vez.');
  else if (ev.tipo === 'trivia' && motivo === 'tiempo') this.anunciar(`❓ Nadie acertó. La respuesta era: ${this.cfgEv.trivia.preguntas.find((q) => q[0] === ev.pregunta)[1][0]}.`);
  else if (ev.tipo === 'dobleexp') { this.eventoExp = 1; this.anunciar('✨ Terminó la Hora Feliz.'); }
};

// lo llama killNpc cuando muere un bicho del evento
E.eventoKill = function (p, npc) {
  const ev = this.evento;
  if (!ev || !ev.npcs.has(npc.id)) return;
  ev.npcs.delete(npc.id);
  if (!p || p.kind !== 'pc') return;
  if (ev.tipo === 'invasion') {
    ev.kills[p.name.toLowerCase()] = (ev.kills[p.name.toLowerCase()] || 0) + 1;
    this.darPremio(p, this.cfgEv.invasion.premioPorBicho, 'Invasor derrotado');
    if (!ev.npcs.size) this.terminarEvento('ganada');
  } else if (ev.tipo === 'caceria') {
    const txt = this.darPremio(p, this.cfgEv.caceria.premio, 'Cazaste la Bestia Dorada');
    this.anunciar(`🐉 ¡${p.name} cazó la Bestia Dorada! Se lleva ${txt}.`);
    this.terminarEvento('ganada');
  }
};

// lo llama el chat: respuestas de la trivia
E.eventoChat = function (p, texto) {
  const ev = this.evento;
  if (!ev || ev.tipo !== 'trivia' || p.gm) return;
  if (!ev.respuestas.includes(norm(texto))) return;
  const txt = this.darPremio(p, this.cfgEv.trivia.premio, 'Trivia');
  this.anunciar(`❓ ¡${p.name} acertó la trivia! Respuesta: "${texto}". Gana ${txt}.`);
  ev.fin = 0; this.evento = null; this.proxEvento = Date.now() + this.minutosHastaEvento() * 60000;
};

E.comandoEvento = function (p, arg) {
  const a = norm(arg || '');
  if (!a) {
    const ev = this.evento;
    if (!ev) return this.msg(p, `No hay ningún evento ahora. El próximo en ~${Math.max(1, Math.round((this.proxEvento - Date.now()) / 60000))} minutos.`, 'info');
    const quedan = ev.fin ? Math.max(0, Math.round((ev.fin - Date.now()) / 60000)) : 0;
    const det = ev.tipo === 'invasion' ? `Invasión en ${this.nombreMapa(ev.mapa)} (quedan ${ev.npcs.size} invasores)` : ev.tipo === 'caceria' ? `Cacería de la Bestia Dorada en ${this.nombreMapa(ev.mapa)}` : ev.tipo === 'trivia' ? `Trivia: ${ev.pregunta}` : 'Hora Feliz: experiencia doble';
    return this.msg(p, `Evento: ${det}${quedan ? ` · ${quedan} minutos más` : ''}.${p.gm >= 2 ? ' GM: /EVENTO INVASION | CACERIA | TRIVIA | SORTEO | DOBLEEXP | TERMINAR' : ''}`, 'info');
  }
  if (p.gm < 2) return this.msg(p, 'Sólo los GMs pueden largar eventos. Escribí /EVENTO para ver el actual.', 'warn');
  if (a === 'terminar') { if (this.evento) this.terminarEvento('gm'); return this.msg(p, 'Evento terminado.', 'gm'); }
  const tipo = { invasion: 'invasion', caceria: 'caceria', trivia: 'trivia', sorteo: 'sorteo', dobleexp: 'dobleexp', 'hora feliz': 'dobleexp' }[a];
  if (!tipo) return this.msg(p, 'Tipos: INVASION, CACERIA, TRIVIA, SORTEO, DOBLEEXP, TERMINAR.', 'warn');
  this.gmLog(`${p.name}: /EVENTO ${tipo}`);
  if (!this.iniciarEvento(tipo, p.name)) this.msg(p, 'No se pudo iniciar el evento (¿hay gente conectada?).', 'warn');
};

module.exports = E;
