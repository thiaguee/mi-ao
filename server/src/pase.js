'use strict';
// Pase de temporada: 100 niveles por mes, con premios sólo estéticos (títulos, auras, capas, montura).
// La experiencia de pase se gana jugando y con los retos del mes. Los cosméticos quedan para siempre.
const fs = require('fs');
const path = require('path');

const P = {};
const temporada = () => new Date().toISOString().slice(0, 7);
const MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
const nombreTemp = (t) => `${MESES[+t.slice(5, 7) - 1]} ${t.slice(0, 4)}`;

P.cargarPase = function () {
  try { this.cfgPase = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data', 'pase.json'), 'utf8')); } catch (e) { console.error('pase.json:', e.message); this.cfgPase = { xpPorNivel: 1000, xp: {}, retos: [], premios: {} }; }
};

// estado del pase del jugador (se reinicia si cambió el mes)
P.paseDe = function (p) {
  const t = temporada();
  if (!p.pase) p.pase = { cosm: { titulos: [], auras: [], capas: [] }, equip: {} };
  const s = p.pase;
  if (s.temp !== t) { s.temp = t; s.xp = 0; s.nivel = 0; s.retos = {}; s.hechos = []; s.dung = []; s.nivelInicio = p.stats.lvl; }
  s.cosm = s.cosm || { titulos: [], auras: [], capas: [] }; s.equip = s.equip || {};
  return s;
};

P.sumarXpPase = function (p, xp, motivo) {
  if (!p || p.kind !== 'pc' || !(xp > 0)) return;
  const s = this.paseDe(p), porNivel = this.cfgPase.xpPorNivel;
  if (s.nivel >= 100) return;
  s.xp += Math.round(xp);
  let subio = false;
  while (s.nivel < 100 && s.xp >= porNivel) { s.xp -= porNivel; s.nivel++; subio = true; this.darPremioPase(p, s.nivel); }
  if (s.nivel >= 100) s.xp = 0;
  if (subio) {
    this.msg(p, `🎖️ ¡Subiste al nivel ${s.nivel} del Pase de Temporada!`, 'server');
    this.toMap(p.map, { t: 'fx', id: p.id, fx: 1, loops: 0 });
  }
  if (p.paseAbierto) this.enviarPase(p);
};

P.darPremioPase = function (p, nivel) {
  const pr = this.cfgPase.premios[nivel];
  if (!pr) return;
  for (const x of [pr, ...(pr.extra || [])]) {
    const s = p.pase;
    if (x.tipo === 'titulo' && !s.cosm.titulos.includes(x.v)) s.cosm.titulos.push(x.v);
    if (x.tipo === 'aura' && !s.cosm.auras.some((a) => a.v === x.v)) s.cosm.auras.push({ v: x.v, n: x.n });
    if (x.tipo === 'capa' && !s.cosm.capas.some((c) => c.n === x.n)) s.cosm.capas.push({ n: x.n, c: x.c, b: x.b, e: x.e, ce: x.ce });
    if (x.tipo === 'objeto') {
      const slot = p.inv.findIndex((it) => !it);
      if (slot >= 0) { p.inv[slot] = { id: x.v, amount: 1, nc: 999 }; this.sendSlot(p, slot); }
      else { s.pendiente = (s.pendiente || []).concat(x.v); this.msg(p, 'No tenés lugar en el inventario: tu premio te espera (/PASE).', 'warn'); }
    }
    this.msg(p, `🎁 Premio del pase (nivel ${nivel}): ${x.n || x.v}${x.tipo === 'titulo' ? ' (título)' : ''}. Equipalo desde el Pase.`, 'server');
  }
  this.savePlayer(p);
};

// avance de un reto del mes (tipo: bichos, noche, misiones, duelosG, duelos, guerras, dungeons, ventas, niveles)
P.retoPase = function (p, tipo, cuanto = 1, valor) {
  if (!p || p.kind !== 'pc') return;
  const s = this.paseDe(p);
  for (const r of this.cfgPase.retos) {
    if (r.tipo !== tipo || s.hechos.includes(r.id)) continue;
    if (tipo === 'dungeons') { if (!s.dung.includes(valor)) s.dung.push(valor); s.retos[r.id] = s.dung.length; }
    else if (tipo === 'niveles') s.retos[r.id] = Math.max(0, p.stats.lvl - (s.nivelInicio || p.stats.lvl));
    else s.retos[r.id] = (s.retos[r.id] || 0) + cuanto;
    if (s.retos[r.id] >= r.meta) {
      s.hechos.push(r.id);
      this.msg(p, `✅ Reto del mes cumplido: ${r.n} (+${r.xp} de experiencia de pase).`, 'server');
      this.sumarXpPase(p, r.xp);
    }
  }
};

// ---------- ganchos (los llaman otros sistemas) ----------
P.paseMatarBicho = function (p, npc) {
  const x = this.cfgPase.xp;
  this.sumarXpPase(p, Math.max(x.bichoMin, Math.min(x.bichoMax, Math.round((npc.def.maxHp || 0) / 100))));
  this.retoPase(p, 'bichos');
  if (this.esDeNoche && this.esDeNoche()) this.retoPase(p, 'noche');
};

P.enviarPase = function (p) {
  const s = this.paseDe(p), c = this.cfgPase;
  p.paseAbierto = true;
  this.send(p, {
    t: 'pase', temp: nombreTemp(s.temp), nivel: s.nivel, xp: s.xp, porNivel: c.xpPorNivel,
    premios: c.premios, retos: c.retos.map((r) => ({ id: r.id, n: r.n, meta: r.meta, xp: r.xp, v: Math.min(r.meta, s.retos[r.id] || 0), ok: s.hechos.includes(r.id) ? 1 : 0 })),
    cosm: s.cosm, equip: s.equip, pendiente: (s.pendiente || []).length,
  });
};

// msg: { a: 'equipar', tipo: 'titulo'|'aura'|'capa', v } | { a: 'cerrar' } | { a: 'pendiente' }
P.accionPase = function (p, m) {
  const s = this.paseDe(p);
  if (m.a === 'cerrar') { p.paseAbierto = false; return; }
  if (m.a === 'pendiente' && s.pendiente && s.pendiente.length) {
    const slot = p.inv.findIndex((it) => !it);
    if (slot < 0) return this.msg(p, 'No tenés lugar en el inventario.', 'warn');
    p.inv[slot] = { id: s.pendiente.shift(), amount: 1, nc: 999 }; this.sendSlot(p, slot); this.savePlayer(p);
    return this.enviarPase(p);
  }
  if (m.a === 'equipar') {
    const v = m.v === null || m.v === '' ? null : m.v;
    if (m.tipo === 'titulo' && (v === null || s.cosm.titulos.includes(v))) s.equip.titulo = v;
    if (m.tipo === 'aura' && (v === null || s.cosm.auras.some((a) => a.v === v))) s.equip.aura = v;
    if (m.tipo === 'capa' && (v === null || s.cosm.capas.some((c) => c.n === v))) s.equip.capa = v;
    this.sendCharToMap(p); this.savePlayer(p);
    return this.enviarPase(p);
  }
};

// lo que se ve en el personaje
P.cosmeticosDe = function (p) {
  const s = p.pase;
  if (!s || !s.equip) return {};
  const capa = s.equip.capa && s.cosm.capas.find((c) => c.n === s.equip.capa);
  return { titulo: s.equip.titulo || '', aura: s.equip.aura || '', capa: capa ? { c: capa.c, b: capa.b, e: capa.e, ce: capa.ce, ld: 0 } : null };
};

// /PASEXP nombre cantidad (Admin): da experiencia de pase
P.comandoPaseXp = function (p, nombre, cant) {
  const t = nombre && this.findPlayer(nombre);
  cant = Math.floor(+cant);
  if (!t || !(cant > 0)) return this.msg(p, 'Uso: /PASEXP nombre cantidad (el jugador tiene que estar conectado).', 'warn');
  this.sumarXpPase(t, cant);
  if (this.gmLog) this.gmLog(`${p.name}: /PASEXP ${t.name} ${cant}`);
  this.msg(p, `${t.name} ahora está en el nivel ${t.pase.nivel} del pase.`, 'gm');
};

module.exports = P;
