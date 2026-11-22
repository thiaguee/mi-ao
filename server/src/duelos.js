'use strict';
// Duelos en el Coliseo de Norway (mapa 318): 6 arenas, 1v1 y 2v2, con pozo de oro y apuestas de los espectadores.
//   /DUELO nombre [oro]              reta a alguien (1 contra 1)
//   /DUELO2 compañero rival1 rival2 [oro]  2 contra 2
//   /ACEPTO nombre · /RECHAZO nombre  aceptar o rechazar un reto
//   /APOSTAR nombre oro              apostar por un duelista (en los 30 segundos antes de que empiece)
//   /COLISEO                          ir a mirar al Coliseo (y volver)
//   /RANKINGDUELOS                    ranking de la temporada (un mes); el #1 del mes es Campeón y gana premio
//   /RENDIRSE                         abandonar el duelo
const fs = require('fs');
const path = require('path');
const accounts = require('./accounts');

const D = {};
const MAPA = 318;
const LOBBY = [45, 35];
const ARENAS = [ // interior de cada arena: [x0, x1, y0, y1]
  [14, 33, 10, 26], [64, 83, 11, 27], [14, 31, 44, 57], [40, 58, 46, 59], [15, 34, 72, 88], [65, 84, 71, 87],
];
const PREPARACION = 30000;   // 30 s para apostar antes de pelear
const MAX_PELEA = 5 * 60000; // 5 minutos y es empate
const CASA = 0.05;           // el coliseo se queda con el 5% de las apuestas
const PREMIO_CAMPEON = { puntosTorneo: 20, oro: 1000000 };
const temporadaActual = () => new Date().toISOString().slice(0, 7); // "2026-11"
const fmt = (n) => Number(n || 0).toLocaleString('es-AR');

D.cargarDuelos = function () {
  this.duelosPath = path.join(this.dataDir, 'duelos.json');
  this.rankDuelos = { temporada: temporadaActual(), jugadores: {}, campeones: [] };
  try { if (fs.existsSync(this.duelosPath)) Object.assign(this.rankDuelos, JSON.parse(fs.readFileSync(this.duelosPath, 'utf8'))); } catch (e) { console.error('Error leyendo duelos.json:', e.message); }
  this.retos = new Map();     // retador (minúscula) -> reto
  this.duelos = new Array(ARENAS.length).fill(null);
  this.revisarTemporada();
  setInterval(() => this.revisarTemporada(), 10 * 60000);
  setInterval(() => this.tickDuelos(), 1000);
};
D.guardarDuelos = function () { try { fs.writeFileSync(this.duelosPath, JSON.stringify(this.rankDuelos, null, 1)); } catch (e) { console.error(e.message); } };

// fin de mes: el #1 es Campeón del Coliseo y gana el premio
D.revisarTemporada = function () {
  const r = this.rankDuelos, ahora = temporadaActual();
  if (r.temporada === ahora) return;
  const top = Object.values(r.jugadores).filter((j) => j.g > 0).sort((a, b) => b.pts - a.pts)[0];
  if (top) {
    r.campeones.push({ temporada: r.temporada, nombre: top.n, pts: top.pts });
    const t = this.findPlayer(top.n);
    if (t) { t.puntosTorneo = (t.puntosTorneo || 0) + PREMIO_CAMPEON.puntosTorneo; t.stats.gld += PREMIO_CAMPEON.oro; this.sendStat(t, ['gld']); this.savePlayer(t); }
    else { const rec = accounts.load(top.n); if (rec) { rec.puntosTorneo = (rec.puntosTorneo || 0) + PREMIO_CAMPEON.puntosTorneo; rec.stats.gld += PREMIO_CAMPEON.oro; accounts.save(rec); } }
    this.toAll({ t: 'msg', text: `🏆 ${top.n} es el CAMPEÓN DEL COLISEO de ${r.temporada} con ${top.pts} puntos. Premio: ${PREMIO_CAMPEON.puntosTorneo} puntos de torneo y ${fmt(PREMIO_CAMPEON.oro)} de oro.`, color: 'server' });
  }
  r.temporada = ahora; r.jugadores = {};
  this.guardarDuelos();
};

const lado = (d, p) => (d.A.includes(p.id) ? 'A' : d.B.includes(p.id) ? 'B' : null);
const nombres = (w, ids) => ids.map((id) => (w.players.get(id) || {}).name || '?').join(' y ');

D.puedeDuelar = function (p, quien) {
  const yo = quien === p;
  if (!p) return 'no está conectado';
  if (p.dead) return yo ? 'Estás muerto.' : `${p.name} está muerto.`;
  if (p.duelo) return yo ? 'Ya estás en un duelo.' : `${p.name} ya está en un duelo.`;
  if (p.enGuerra) return yo ? 'Estás en la guerra.' : `${p.name} está en la guerra.`;
  if (p.jailUntil) return yo ? 'Estás en la cárcel.' : `${p.name} está en la cárcel.`;
  return null;
};

// /DUELO nombre [oro] · /DUELO2 compañero rival1 rival2 [oro]
D.comandoDuelo = function (p, args, dos) {
  const n = dos ? 3 : 1;
  const ns = args.slice(0, n), oro = Math.max(0, Math.floor(+args[n] || 0));
  if (ns.length < n || ns.some((x) => !x)) return this.msg(p, dos ? 'Uso: /DUELO2 compañero rival1 rival2 [oro]' : 'Uso: /DUELO nombre [oro] (el oro es lo que pone cada uno: el que gana se lleva todo)', 'warn');
  const err = this.puedeDuelar(p, p); if (err) return this.msg(p, err, 'warn');
  const ps = ns.map((x) => this.findPlayer(x));
  for (let i = 0; i < ps.length; i++) {
    if (!ps[i]) return this.msg(p, `${ns[i]} no está conectado.`, 'warn');
    if (ps[i] === p) return this.msg(p, 'No podés retarte a vos mismo.', 'warn');
    const e = this.puedeDuelar(ps[i]); if (e) return this.msg(p, e, 'warn');
  }
  if (new Set(ps.map((x) => x.id)).size !== ps.length) return this.msg(p, 'Repetiste un nombre.', 'warn');
  if (p.stats.gld < oro) return this.msg(p, 'No tenés ese oro para apostar.', 'warn');
  const A = dos ? [p.name, ps[0].name] : [p.name], B = dos ? [ps[1].name, ps[2].name] : [ps[0].name];
  const reto = { A, B, oro, faltan: new Set(ps.map((x) => x.name.toLowerCase())), t: Date.now() };
  this.retos.set(p.name.toLowerCase(), reto);
  const desc = `${A.join(' y ')} contra ${B.join(' y ')}${oro ? ` · pozo: ${fmt(oro)} de oro cada uno` : ''}`;
  for (const x of ps) this.msg(x, `⚔ ${p.name} te desafía a un duelo (${desc}). Escribí /ACEPTO ${p.name} o /RECHAZO ${p.name} (60 segundos).`, 'server');
  this.msg(p, `Reto enviado: ${desc}. Esperando que acepten...`, 'info');
};

D.comandoAcepto = function (p, nombre, acepta) {
  const k = (nombre || '').toLowerCase(), reto = this.retos.get(k);
  if (!reto || !reto.faltan.has(p.name.toLowerCase())) return this.msg(p, `No tenés un reto pendiente de ${nombre || '...'}. Uso: /ACEPTO nombre`, 'warn');
  const todos = [...reto.A, ...reto.B].map((x) => this.findPlayer(x));
  if (!acepta) { this.retos.delete(k); for (const x of todos) if (x) this.msg(x, `${p.name} rechazó el duelo.`, 'warn'); return; }
  const err = this.puedeDuelar(p, p); if (err) return this.msg(p, err, 'warn');
  if (p.stats.gld < reto.oro) return this.msg(p, `Necesitás ${fmt(reto.oro)} de oro para este duelo.`, 'warn');
  reto.faltan.delete(p.name.toLowerCase());
  for (const x of todos) if (x && x !== p) this.msg(x, `${p.name} aceptó el duelo.`, 'info');
  if (reto.faltan.size) return;
  this.retos.delete(k);
  this.empezarDuelo(reto);
};

D.empezarDuelo = function (reto) {
  const ps = [...reto.A, ...reto.B].map((x) => this.findPlayer(x));
  for (const x of ps) {
    const e = this.puedeDuelar(x);
    if (e || x.stats.gld < reto.oro) { for (const y of ps) if (y) this.msg(y, `El duelo se canceló: ${x ? (e || `${x.name} no tiene el oro`) : 'alguien se desconectó'}.`, 'warn'); return; }
  }
  const i = this.duelos.findIndex((d) => !d);
  if (i < 0) { for (const y of ps) this.msg(y, 'Las 6 arenas están ocupadas. Probá en un ratito.', 'warn'); return; }
  const [x0, x1, y0, y1] = ARENAS[i], ym = Math.floor((y0 + y1) / 2);
  const d = { arena: i, A: [], B: [], oro: reto.oro, pozo: 0, inicio: Date.now() + PREPARACION, fase: 'preparando', apuestas: [], vuelta: {}, muertos: new Set() };
  this.duelos[i] = d;
  const lugares = { A: [[x0 + 2, ym - 1], [x0 + 2, ym + 2]], B: [[x1 - 2, ym - 1], [x1 - 2, ym + 2]] };
  for (const [ladoN, noms] of [['A', reto.A], ['B', reto.B]]) {
    noms.forEach((n, j) => {
      const x = this.findPlayer(n);
      x.stats.gld -= d.oro; d.pozo += d.oro; this.sendStat(x, ['gld']);
      d[ladoN].push(x.id);
      x.duelo = { arena: i, lado: ladoN };
      d.vuelta[x.id] = [x.map, x.x, x.y];
      const s = x.stats; s.hp = s.maxHp; s.man = s.maxMan; s.sta = s.maxSta; this.sendAllStats(x);
      const [lx, ly] = lugares[ladoN][j];
      const pos = this.closestLegalPos(MAPA, lx, ly) || { x: lx, y: ly };
      this.warp(x, MAPA, pos.x, pos.y);
    });
  }
  this.toAll({ t: 'msg', text: `⚔ DUELO en la Arena ${i + 1} del Coliseo: ${nombres(this, d.A)} vs ${nombres(this, d.B)}${d.pozo ? ` · pozo ${fmt(d.pozo)}` : ''}. ¡30 segundos para apostar! /APOSTAR nombre oro · /COLISEO para ir a mirar`, color: 'server' });
};

D.tickDuelos = function () {
  const now = Date.now();
  for (const [k, r] of this.retos) if (now - r.t > 60000) this.retos.delete(k);
  for (const d of this.duelos) {
    if (!d) continue;
    const todos = [...d.A, ...d.B].map((id) => this.players.get(id)).filter(Boolean);
    if (d.fase === 'preparando') {
      const falta = Math.ceil((d.inicio - now) / 1000);
      if (falta <= 0) { d.fase = 'pelea'; for (const x of todos) { this.msg(x, '⚔ ¡A PELEAR!', 'fight'); this.send(x, { t: 'announce', text: '¡A PELEAR!' }); } }
      else if ([20, 10, 5, 3, 2, 1].includes(falta) && d.ultimoAviso !== falta) { d.ultimoAviso = falta; for (const x of todos) this.msg(x, `El duelo empieza en ${falta}...`, 'info'); }
    } else if (d.fase === 'pelea' && now - d.inicio > MAX_PELEA) this.terminarDuelo(d, null);
  }
};

// lo llama killPlayer y logout
D.muerteEnDuelo = function (p) {
  const d = p.duelo && this.duelos[p.duelo.arena];
  if (!d || d.fase === 'fin') return;
  d.muertos.add(p.id);
  const vivos = (ids) => ids.filter((id) => !d.muertos.has(id) && this.players.has(id)).length;
  if (vivos(d.A) === 0) this.terminarDuelo(d, 'B');
  else if (vivos(d.B) === 0) this.terminarDuelo(d, 'A');
};

D.terminarDuelo = function (d, gana) {
  d.fase = 'fin';
  const ids = [...d.A, ...d.B];
  const ganadores = gana ? d[gana] : [], perdedores = gana ? d[gana === 'A' ? 'B' : 'A'] : [];
  // pozo de los duelistas
  if (gana) {
    const cada = Math.floor(d.pozo / ganadores.length);
    for (const id of ganadores) { const x = this.players.get(id); if (x) { x.stats.gld += cada; this.sendStat(x, ['gld']); } else this.cobroOffline(id, cada); }
  } else for (const id of ids) { const x = this.players.get(id); if (x) { x.stats.gld += d.oro; this.sendStat(x, ['gld']); } }
  // apuestas
  const total = d.apuestas.reduce((s, a) => s + a.oro, 0);
  const aGanadores = d.apuestas.filter((a) => a.lado === gana), w = aGanadores.reduce((s, a) => s + a.oro, 0);
  for (const a of d.apuestas) {
    let paga = 0;
    if (!gana || w === 0) paga = a.oro; // empate o nadie acertó: se devuelve
    else if (a.lado === gana) paga = Math.floor(a.oro * total * (1 - CASA) / w);
    const x = this.findPlayer(a.nombre);
    if (paga && x) { x.stats.gld += paga; this.sendStat(x, ['gld']); this.msg(x, `🎲 ${a.lado === gana ? '¡Ganaste la apuesta!' : 'Te devolvimos la apuesta.'} Cobraste ${fmt(paga)} de oro.`, 'server'); }
    else if (!paga && x) this.msg(x, `🎲 Perdiste la apuesta de ${fmt(a.oro)} de oro.`, 'warn');
  }
  // ranking de la temporada (puntos tipo ELO)
  if (gana) {
    const J = this.rankDuelos.jugadores;
    const reg = (id) => { const x = this.players.get(id); const n = x ? x.name : String(id); const k = n.toLowerCase(); return J[k] || (J[k] = { n, pts: 1000, g: 0, p: 0 }); };
    const rg = ganadores.map(reg), rp = perdedores.map(reg);
    const prom = (l) => l.reduce((s, j) => s + j.pts, 0) / l.length;
    const esp = 1 / (1 + Math.pow(10, (prom(rp) - prom(rg)) / 400));
    const delta = Math.max(4, Math.round(32 * (1 - esp)));
    for (const j of rg) { j.pts += delta; j.g++; }
    for (const j of rp) { j.pts = Math.max(0, j.pts - delta); j.p++; }
    this.guardarDuelos();
    this.toAll({ t: 'msg', text: `🏆 Arena ${d.arena + 1}: ganaron ${nombres(this, ganadores)} a ${nombres(this, perdedores)}${d.pozo ? ` y se llevan ${fmt(d.pozo)} de oro` : ''} (+${delta} puntos de ranking).`, color: 'server' });
  } else this.toAll({ t: 'msg', text: `⚔ Arena ${d.arena + 1}: el duelo terminó empatado.`, color: 'server' });
  // a los 4 segundos vuelven todos a donde estaban, curados
  setTimeout(() => {
    for (const id of ids) {
      const x = this.players.get(id);
      if (!x) continue;
      x.duelo = null;
      if (x.dead) this.revive(x, true);
      const s = x.stats; s.hp = s.maxHp; s.man = s.maxMan; this.sendAllStats(x);
      const [m, vx, vy] = d.vuelta[id] || [1, 58, 45];
      this.warp(x, m, vx, vy);
    }
    this.duelos[d.arena] = null;
  }, 4000);
};
D.cobroOffline = function (id, oro) { /* el que se desconecta pierde el duelo: no cobra */ };

// /APOSTAR nombre oro
D.comandoApostar = function (p, nombre, oro) {
  oro = Math.floor(+oro);
  const t = nombre && this.findPlayer(nombre);
  const d = t && t.duelo && this.duelos[t.duelo.arena];
  if (!d) return this.msg(p, 'Uso: /APOSTAR nombre oro (por alguien que esté por pelear un duelo).', 'warn');
  if (d.fase !== 'preparando') return this.msg(p, 'Las apuestas de ese duelo ya cerraron.', 'warn');
  if (lado(d, p)) return this.msg(p, 'Los duelistas no pueden apostar.', 'warn');
  if (!(oro >= 100)) return this.msg(p, 'La apuesta mínima es de 100 de oro.', 'warn');
  if (p.stats.gld < oro) return this.msg(p, 'No tenés ese oro.', 'warn');
  if (d.apuestas.some((a) => a.nombre.toLowerCase() === p.name.toLowerCase())) return this.msg(p, 'Ya apostaste en este duelo.', 'warn');
  p.stats.gld -= oro; this.sendStat(p, ['gld']);
  d.apuestas.push({ nombre: p.name, lado: lado(d, t), oro });
  this.msg(p, `🎲 Apostaste ${fmt(oro)} de oro por ${t.name}.`, 'server');
  const tot = (l) => d.apuestas.filter((a) => a.lado === l).reduce((s, a) => s + a.oro, 0);
  this.toMap(MAPA, { t: 'msg', text: `🎲 ${p.name} apostó ${fmt(oro)} por ${t.name}. Apuestas: ${nombres(this, d.A)} ${fmt(tot('A'))} · ${nombres(this, d.B)} ${fmt(tot('B'))}`, color: 'info' });
};

// /COLISEO: ir a mirar (o volver)
D.comandoColiseo = function (p) {
  if (p.duelo) return this.msg(p, 'Estás en un duelo.', 'warn');
  if (p.map === MAPA) {
    const [m, x, y] = p.vueltaColiseo || [1, 58, 45];
    p.vueltaColiseo = null;
    return this.warp(p, m, x, y);
  }
  if (p.dead || p.enGuerra || p.jailUntil) return this.msg(p, 'Ahora no podés ir al Coliseo.', 'warn');
  if (!this.isSafe(p) && p.gm === 0) return this.msg(p, 'Para ir al Coliseo tenés que estar en una zona segura (una ciudad).', 'warn');
  p.vueltaColiseo = [p.map, p.x, p.y];
  const pos = this.closestLegalPos(MAPA, LOBBY[0], LOBBY[1]) || { x: LOBBY[0], y: LOBBY[1] };
  this.warp(p, MAPA, pos.x, pos.y);
  this.msg(p, 'Bienvenido al Coliseo de Norway. Mirá los duelos desde afuera de las arenas. /COLISEO para volver.', 'server');
};

D.mostrarRankingDuelos = function (p) {
  const r = this.rankDuelos;
  const lista = Object.values(r.jugadores).filter((j) => j.g + j.p > 0).sort((a, b) => b.pts - a.pts);
  this.msg(p, `=== Ranking del Coliseo · temporada ${r.temporada} ===`, 'server');
  if (!lista.length) this.msg(p, 'Todavía no hubo duelos esta temporada. /DUELO nombre para retar a alguien.', 'info');
  const med = ['🥇', '🥈', '🥉'];
  lista.slice(0, 10).forEach((j, i) => this.msg(p, `${med[i] || (i + 1) + '.'} ${j.n} — ${j.pts} pts (${j.g} ganados, ${j.p} perdidos)`, i < 3 ? 'server' : 'info'));
  const yo = lista.findIndex((j) => j.n.toLowerCase() === p.name.toLowerCase());
  if (yo >= 0) this.msg(p, `Vos estás #${yo + 1} con ${lista[yo].pts} puntos.`, 'info');
  const c = r.campeones[r.campeones.length - 1];
  if (c) this.msg(p, `🏆 Último campeón: ${c.nombre} (${c.temporada}).`, 'info');
  this.msg(p, `Al terminar el mes, el #1 es Campeón del Coliseo y gana ${PREMIO_CAMPEON.puntosTorneo} puntos de torneo y ${fmt(PREMIO_CAMPEON.oro)} de oro.`, 'info');
};

D.comandoRendirse = function (p) {
  if (!p.duelo) return this.msg(p, 'No estás en un duelo.', 'warn');
  this.msg(p, 'Te rendiste.', 'warn');
  this.muerteEnDuelo(p);
};

// ¿p le puede pegar a target? (true/false si es un duelo; null si no tiene que ver con duelos)
D.reglaDuelo = function (p, target) {
  if (!p.duelo && !target.duelo) return null;
  const d = p.duelo && this.duelos[p.duelo.arena];
  if (!d || !target.duelo || target.duelo.arena !== p.duelo.arena) { this.msg(p, 'Sólo podés pegarle a tu rival del duelo.', 'warn'); return false; }
  if (p.duelo.lado === target.duelo.lado) { this.msg(p, 'Es de tu equipo.', 'warn'); return false; }
  if (d.fase !== 'pelea') { this.msg(p, 'Todavía no empezó: esperá la cuenta regresiva.', 'warn'); return false; }
  return true;
};

module.exports = D;
