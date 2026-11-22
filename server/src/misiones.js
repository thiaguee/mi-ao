'use strict';
// Misiones: se piden en los Maestros de Misiones de las ciudades (máximo 3 activas), son de
// matar bichos y dan oro, experiencia y PUNTOS DE MISIÓN (no se pierden al morir).
// También hay 3 misiones diarias por personaje y misiones semanales de clan.
const fs = require('fs');
const path = require('path');
const G = require('./gamedata');

const M = {};
const MAX_ACTIVAS = 3;
const DIARIAS_POR_DIA = 3;

M.cargarMisiones = function () {
  const p = path.join(__dirname, '..', 'data', 'misiones.json');
  try {
    const d = JSON.parse(fs.readFileSync(p, 'utf8'));
    this.misiones = { normales: d.normales || [], elite: d.elite || [], diarias: d.diarias || [], clan: d.clan || [] };
  } catch (e) {
    console.error('Error leyendo misiones.json:', e.message);
    this.misiones = { normales: [], elite: [], diarias: [], clan: [] };
  }
  this.misionPorId = {};
  for (const lista of Object.values(this.misiones)) for (const m of lista) this.misionPorId[m.id] = m;
  console.log(`Misiones: ${this.misiones.normales.length} normales, ${this.misiones.elite.length} de élite, ${this.misiones.diarias.length} diarias, ${this.misiones.clan.length} de clan`);
};

const hoy = () => new Date().toISOString().slice(0, 10);
const semana = () => { const d = new Date(); const lunes = new Date(d); lunes.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7)); return lunes.toISOString().slice(0, 10); };
function hash(s) { let h = 2166136261; for (const c of s) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; }

// Estado guardado en el personaje
M.misDe = function (p) {
  if (!p.mis) p.mis = {};
  const m = p.mis;
  m.activas = m.activas || {}; // id -> [progreso por objetivo]
  m.hechas = m.hechas || [];
  m.puntos = m.puntos || 0;
  m.totalHechas = m.totalHechas || 0;
  if (!m.dia || m.dia.fecha !== hoy()) m.dia = { fecha: hoy(), ids: this.elegirDiarias(p), prog: {}, hechas: [] };
  return m;
};

M.elegirDiarias = function (p) {
  const lvl = p.stats.lvl;
  let pool = this.misiones.diarias.filter((d) => d.nivel <= lvl && d.nivel >= lvl - 10);
  if (pool.length < DIARIAS_POR_DIA) pool = this.misiones.diarias.filter((d) => d.nivel <= lvl).slice(-6);
  pool = pool.slice();
  let seed = hash(p.name.toLowerCase() + hoy());
  const out = [];
  while (pool.length && out.length < DIARIAS_POR_DIA) {
    seed = Math.imul(seed ^ (seed >>> 15), 2246822507) >>> 0;
    out.push(pool.splice(seed % pool.length, 1)[0].id);
  }
  return out;
};

const cuenta = (obj, num) => obj.bichos.includes('*') || obj.bichos.includes(num);

// ---------- al matar un bicho ----------
M.misionKill = function (p, num) {
  const m = this.misDe(p);
  let cambio = false;
  for (const [id, prog] of Object.entries(m.activas)) {
    const def = this.misionPorId[id];
    if (!def) { delete m.activas[id]; continue; }
    def.objetivos.forEach((o, i) => { if (prog[i] < o.cantidad && cuenta(o, num)) { prog[i]++; cambio = true; } });
    if (def.objetivos.every((o, i) => prog[i] >= o.cantidad)) this.completarMision(p, def, 'normal');
  }
  for (const id of m.dia.ids) {
    if (m.dia.hechas.includes(id)) continue;
    const def = this.misionPorId[id];
    if (!def) continue;
    const prog = m.dia.prog[id] || (m.dia.prog[id] = def.objetivos.map(() => 0));
    def.objetivos.forEach((o, i) => { if (prog[i] < o.cantidad && cuenta(o, num)) { prog[i]++; cambio = true; } });
    if (def.objetivos.every((o, i) => prog[i] >= o.cantidad)) { m.dia.hechas.push(id); this.completarMision(p, def, 'diaria'); }
  }
  this.misionClanKill(p, num);
  if (cambio) this.enviarSeguimiento(p);
};

M.darRecompensa = function (p, r, titulo) {
  const m = this.misDe(p);
  const exp = r.exp || (r.expPct ? Math.floor(G.ELU[Math.min(p.stats.lvl, G.MAX_NIVEL)] * r.expPct) : 0);
  if (r.oro) { p.stats.gld += r.oro; this.sendStat(p, ['gld']); }
  if (r.puntos) m.puntos += r.puntos;
  this.msg(p, `¡${titulo}! Recompensa: ${(r.oro || 0).toLocaleString('es-AR')} de oro, ${exp.toLocaleString('es-AR')} de experiencia y ${r.puntos || 0} puntos de misión (tenés ${m.puntos}).`, 'server');
  this.toMap(p.map, { t: 'snd', w: G.SND.NIVEL });
  this.toMap(p.map, { t: 'fx', id: p.id, fx: G.FX.WARP, loops: 0 });
  if (exp) this.giveExp(p, exp);
};

M.completarMision = function (p, def, tipo) {
  const m = this.misDe(p);
  if (tipo === 'normal') {
    delete m.activas[def.id];
    if (!m.hechas.includes(def.id)) m.hechas.push(def.id);
  }
  m.totalHechas++;
  if (this.sumarXpPase) { this.sumarXpPase(p, tipo === 'diaria' ? this.cfgPase.xp.diaria : this.cfgPase.xp.mision); this.retoPase(p, 'misiones'); }
  this.darRecompensa(p, def.recompensa, `Misión cumplida: ${def.nombre}`);
  this.savePlayer(p);
  this.enviarSeguimiento(p);
};

// ---------- acciones del cliente ----------
M.cercaDeMaestro = function (p) {
  for (const id of this.maps[p.map].chars) {
    const n = this.npcs.get(id);
    if (n && n.def.misiones && Math.abs(n.x - p.x) <= 5 && Math.abs(n.y - p.y) <= 5) return n;
  }
  return null;
};

M.accionMision = function (p, msg) {
  const m = this.misDe(p);
  if (msg.a === 'ver') return this.enviarMisiones(p, !!this.cercaDeMaestro(p));
  if (msg.a === 'abandonar') {
    if (m.activas[msg.id]) { delete m.activas[msg.id]; this.msg(p, 'Abandonaste la misión.', 'info'); this.savePlayer(p); }
    return this.enviarMisiones(p, !!this.cercaDeMaestro(p));
  }
  if (msg.a === 'aceptar') {
    const def = this.misionPorId[msg.id];
    if (!def || (def.tipo !== 'normal' && def.tipo !== 'elite')) return;
    if (!this.cercaDeMaestro(p)) return this.msg(p, 'Las misiones se piden en un Maestro de Misiones (en el centro de las ciudades).', 'warn');
    if (p.stats.lvl < def.nivel) return this.msg(p, `Necesitás nivel ${def.nivel} para esa misión.`, 'warn');
    if (m.hechas.includes(def.id)) return this.msg(p, 'Ya completaste esa misión.', 'warn');
    if (m.activas[def.id]) return;
    if (Object.keys(m.activas).length >= MAX_ACTIVAS) return this.msg(p, `Ya tenés ${MAX_ACTIVAS} misiones activas. Terminá o abandoná una para tomar otra.`, 'warn');
    m.activas[def.id] = def.objetivos.map(() => 0);
    this.msg(p, `Nueva misión: ${def.nombre}. ${def.desc}`, 'server');
    this.savePlayer(p);
    this.enviarMisiones(p, true);
    this.enviarSeguimiento(p);
  }
};

M.abrirMaestro = function (p) { this.enviarMisiones(p, true); };

const nombreObjetivo = function (def, o) {
  if (o.bichos.includes('*')) return 'Cualquier bicho';
  const nombres = [...new Set(o.bichos.map((b) => (this.data.npcs[b] || {}).name).filter(Boolean))];
  return nombres.length > 2 ? nombres.slice(0, 2).join(', ') + ' y otros' : nombres.join(' o ');
};

M.infoMision = function (def, prog) {
  const r = def.recompensa;
  return {
    id: def.id, n: def.nombre, d: def.desc, lvl: def.nivel || 0, tipo: def.tipo,
    obj: def.objetivos.map((o, i) => ({ n: nombreObjetivo.call(this, def, o), c: prog ? prog[i] : 0, t: o.cantidad })),
    r: { o: r.oro || 0, e: r.exp || 0, ep: r.expPct || 0, p: r.puntos || 0 },
  };
};

// Ventana de misiones. "maestro" = está hablando con un Maestro de Misiones (puede aceptar)
M.enviarMisiones = function (p, maestro) {
  const m = this.misDe(p);
  const lvl = p.stats.lvl;
  const disponibles = [...this.misiones.normales, ...this.misiones.elite]
    .filter((d) => !m.hechas.includes(d.id) && !m.activas[d.id])
    .map((d) => Object.assign(this.infoMision(d), { bloqueada: lvl < d.nivel ? 1 : 0 }))
    .sort((a, b) => a.lvl - b.lvl);
  // se muestran las que podés hacer y las próximas 3 bloqueadas
  let bloq = 0;
  const visibles = disponibles.filter((d) => !d.bloqueada || bloq++ < 3);
  this.send(p, {
    t: 'misiones', maestro: maestro ? 1 : 0, max: MAX_ACTIVAS, puntos: m.puntos, hechas: m.totalHechas,
    nivelMax: G.MAX_NIVEL, desbloqueado: lvl >= 50 ? 1 : 0,
    activas: Object.entries(m.activas).map(([id, prog]) => this.misionPorId[id] && this.infoMision(this.misionPorId[id], prog)).filter(Boolean),
    disponibles: visibles,
    diarias: m.dia.ids.map((id) => this.misionPorId[id] && Object.assign(this.infoMision(this.misionPorId[id], m.dia.prog[id]), { hecha: m.dia.hechas.includes(id) ? 1 : 0 })).filter(Boolean),
    clan: this.infoMisionesClan(p),
  });
};

// Contador en pantalla (sólo lo activo)
M.enviarSeguimiento = function (p) {
  const m = this.misDe(p);
  const items = [];
  for (const [id, prog] of Object.entries(m.activas)) {
    const def = this.misionPorId[id];
    if (def) items.push(this.infoMision(def, prog));
  }
  for (const id of m.dia.ids) {
    const def = this.misionPorId[id];
    if (def && !m.dia.hechas.includes(id)) items.push(this.infoMision(def, m.dia.prog[id]));
  }
  this.send(p, { t: 'misSeg', items, puntos: m.puntos });
};

// ---------- misiones de clan (semanales, suman las muertes de todos los integrantes) ----------
M.misClan = function (clan) {
  if (!clan.mis || clan.mis.semana !== semana()) clan.mis = { semana: semana(), prog: {}, hechas: [] };
  return clan.mis;
};

M.misionClanKill = function (p, num) {
  const clan = this.clanDe && this.clanDe(p);
  if (!clan) return;
  const cm = this.misClan(clan);
  let cambio = false;
  for (const def of this.misiones.clan) {
    if (cm.hechas.includes(def.id)) continue;
    const prog = cm.prog[def.id] || (cm.prog[def.id] = def.objetivos.map(() => 0));
    def.objetivos.forEach((o, i) => { if (prog[i] < o.cantidad && cuenta(o, num)) { prog[i]++; cambio = true; } });
    if (def.objetivos.every((o, i) => prog[i] >= o.cantidad)) {
      cm.hechas.push(def.id);
      this.avisarClan(clan, `¡El clan completó la misión "${def.nombre}"! Todos los integrantes reciben su recompensa.`);
      clan.pendientes = clan.pendientes || {};
      for (const nombre of clan.miembros) {
        const o = this.findPlayer(nombre);
        if (o) this.darRecompensa(o, def.recompensa, `Misión de clan cumplida: ${def.nombre}`);
        else (clan.pendientes[nombre.toLowerCase()] = clan.pendientes[nombre.toLowerCase()] || []).push(def.id);
      }
    }
  }
  if (cambio) {
    clan._sucio = true;
    if (!this._guardarClanTimer) this._guardarClanTimer = setTimeout(() => { this._guardarClanTimer = null; this.guardarClanes(); }, 5000);
  }
};

// Recompensas de clan que se ganaron mientras el jugador estaba desconectado
M.pagarPendientesClan = function (p) {
  const clan = this.clanDe && this.clanDe(p);
  if (!clan || !clan.pendientes) return;
  const lista = clan.pendientes[p.name.toLowerCase()];
  if (!lista || !lista.length) return;
  for (const id of lista) { const def = this.misionPorId[id]; if (def) this.darRecompensa(p, def.recompensa, `Misión de clan cumplida mientras no estabas: ${def.nombre}`); }
  delete clan.pendientes[p.name.toLowerCase()];
  this.guardarClanes();
};

M.infoMisionesClan = function (p) {
  const clan = this.clanDe && this.clanDe(p);
  if (!clan) return null;
  const cm = this.misClan(clan);
  return { n: clan.nombre, items: this.misiones.clan.map((d) => Object.assign(this.infoMision(d, cm.prog[d.id]), { hecha: cm.hechas.includes(d.id) ? 1 : 0 })) };
};

module.exports = Object.assign(M, { MAX_ACTIVAS });
