'use strict';
// Ranking de kills de todo el servidor (usuarios matados afuera + kills de guerra).
// Los 3 primeros llevan una estrella al lado del nombre: oro, plata y bronce.
const accounts = require('./accounts');

const R = {};
const totalDe = (rec) => (rec.kills ? (rec.kills.ciu || 0) + (rec.kills.cri || 0) : 0);

R.cargarRanking = function () {
  this.rankAll = new Map(); // nombre en minúscula -> { nombre, kills }
  for (const n of accounts.list()) {
    const rec = accounts.load(n);
    if (rec && rec.name) this.rankAll.set(rec.name.toLowerCase(), { nombre: rec.name, kills: totalDe(rec) });
  }
  this.top3 = [];
  this.calcularTop(false);
  console.log(`Ranking de kills: ${this.rankAll.size} personajes`);
};

R.calcularTop = function (avisar = true) {
  const top = [...this.rankAll.values()].filter((x) => x.kills > 0).sort((a, b) => b.kills - a.kills || a.nombre.localeCompare(b.nombre)).slice(0, 3);
  const antes = this.top3.map((x) => x.nombre.toLowerCase());
  const ahora = top.map((x) => x.nombre.toLowerCase());
  this.top3 = top;
  this.puestoRanking = new Map(ahora.map((n, i) => [n, i + 1]));
  if (!avisar) return;
  // refrescar a los que entraron o salieron del podio (para que se vea la estrella)
  const cambiaron = new Set([...antes, ...ahora].filter((n, i, arr) => antes.indexOf(n) !== ahora.indexOf(n)));
  for (const n of cambiaron) { const p = this.findPlayer(n); if (p) this.sendCharToMap(p); }
  if (ahora[0] && ahora[0] !== antes[0]) this.toAll({ t: 'msg', text: `★ ${top[0].nombre} es el nuevo #1 del ranking de kills con ${top[0].kills} kills.`, color: 'server' });
};

R.sumarKillRanking = function (p) {
  const k = p.name.toLowerCase();
  const e = this.rankAll.get(k) || { nombre: p.name, kills: 0 };
  e.kills = totalDe(p);
  this.rankAll.set(k, e);
  this.calcularTop(true);
};

R.puestoDe = function (p) { return (this.puestoRanking && this.puestoRanking.get(p.name.toLowerCase())) || 0; };

// /RANKING
R.mostrarRanking = function (p) {
  const lista = [...this.rankAll.values()].filter((x) => x.kills > 0).sort((a, b) => b.kills - a.kills).slice(0, 10);
  if (!lista.length) return this.msg(p, 'Todavía nadie tiene kills.', 'info');
  const medalla = ['★ ORO', '★ PLATA', '★ BRONCE'];
  this.msg(p, '=== Ranking de kills ===', 'server');
  lista.forEach((x, i) => this.msg(p, `${i + 1}. ${x.nombre} — ${x.kills} kills${medalla[i] ? ' ' + medalla[i] : ''}`, i < 3 ? 'server' : 'info'));
  const yo = this.rankAll.get(p.name.toLowerCase());
  this.msg(p, `Tus kills: ${yo ? yo.kills : 0} · Kills de guerra para canjear: ${p.killsGuerra || 0} · Puntos de torneo: ${p.puntosTorneo || 0}`, 'info');
};

module.exports = R;
