'use strict';
// Líderes faccionarios: un GM le da el rango a quien considere (uno por facción).
//   /LIDER nombre CRIMINAL|CIUDADANO|NEUTRAL   ·   /QUITARLIDER nombre   ·   /LIDERES (lista)
// El líder recibe su chupín, su nombre se ve del color de la facción con el título debajo
// y lo que dice sale del color de su facción.
const fs = require('fs');
const path = require('path');
const accounts = require('./accounts');

const L = {};
const RANGO = 3; // Dios o Admin
const FACCIONES = {
  cri: { nombre: 'Líder Criminal', chupin: 2043 },
  ciu: { nombre: 'Líder Ciudadano', chupin: 2045 },
  neu: { nombre: 'Líder Neutral', chupin: 2047 },
};
const CLAVE = { CRIMINAL: 'cri', CRIMI: 'cri', CRIMINALES: 'cri', CIUDADANO: 'ciu', CIUDA: 'ciu', CIUDADANOS: 'ciu', NEUTRAL: 'neu', NEUTRALES: 'neu' };

L.cargarLideres = function () {
  this.lideresPath = path.join(this.dataDir, 'lideres.json');
  this.lideres = { cri: '', ciu: '', neu: '' };
  try { if (fs.existsSync(this.lideresPath)) Object.assign(this.lideres, JSON.parse(fs.readFileSync(this.lideresPath, 'utf8'))); } catch (e) { console.error('lideres.json:', e.message); }
};
L.guardarLideres = function () { try { fs.writeFileSync(this.lideresPath, JSON.stringify(this.lideres, null, 1)); } catch (e) { console.error(e.message); } };

// facción de la que es líder ('' si no es)
L.liderDe = function (p) {
  const n = p.name.toLowerCase();
  for (const [k, v] of Object.entries(this.lideres || {})) if (v && v.toLowerCase() === n) return k;
  return '';
};
L.tituloLider = (lf) => (FACCIONES[lf] ? FACCIONES[lf].nombre : '');

L.comandoLider = function (p, nombre, faccion) {
  if (p.gm < RANGO) return this.msg(p, 'Comando inexistente. Escribí /AYUDA.', 'warn');
  const f = CLAVE[(faccion || '').toUpperCase()];
  const t = nombre && this.findPlayer(nombre);
  if (!t || !f) return this.msg(p, 'Uso: /LIDER nombre CRIMINAL|CIUDADANO|NEUTRAL (tiene que estar conectado).', 'warn');
  const antes = this.liderDe(t);
  if (antes) this.lideres[antes] = '';
  const viejo = this.lideres[f] && this.findPlayer(this.lideres[f]);
  if (this.lideres[f] && this.lideres[f].toLowerCase() !== t.name.toLowerCase()) {
    if (viejo) { this.msg(viejo, `Ya no sos ${FACCIONES[f].nombre}.`, 'warn'); this.sendCharToMap(viejo); }
  }
  this.lideres[f] = t.name;
  this.guardarLideres();
  // el chupín de su facción (no se cae al morir)
  const id = FACCIONES[f].chupin;
  if (!t.inv.some((it) => it && it.id === id)) {
    const slot = t.inv.findIndex((it) => !it);
    if (slot >= 0) { t.inv[slot] = { id, amount: 1, nc: 999 }; this.sendSlot(t, slot); }
    else this.msg(p, `${t.name} no tiene lugar en el inventario para el chupín.`, 'warn');
  }
  this.sendCharToMap(t); this.savePlayer(t);
  if (this.gmLog) this.gmLog(`${p.name}: /LIDER ${t.name} ${f}`);
  this.toAll({ t: 'msg', text: `👑 ${t.name} es el nuevo ${FACCIONES[f].nombre}.`, color: 'server' });
};

L.comandoQuitarLider = function (p, nombre) {
  if (p.gm < RANGO) return this.msg(p, 'Comando inexistente. Escribí /AYUDA.', 'warn');
  const k = Object.keys(this.lideres).find((f) => this.lideres[f] && this.lideres[f].toLowerCase() === (nombre || '').toLowerCase());
  if (!k) return this.msg(p, 'Ese personaje no es líder. Uso: /QUITARLIDER nombre', 'warn');
  const n = this.lideres[k]; this.lideres[k] = ''; this.guardarLideres();
  // se le saca el chupín de líder
  const quitar = (rec) => { for (let i = 0; i < rec.inv.length; i++) if (rec.inv[i] && rec.inv[i].id === FACCIONES[k].chupin) { rec.inv[i] = null; for (const e of Object.keys(rec.eq)) if (rec.eq[e] === i) rec.eq[e] = -1; } };
  const t = this.findPlayer(n);
  if (t) { quitar(t); this.recalcEquip(t); this.sendInventory(t); this.sendCharToMap(t); this.savePlayer(t); this.msg(t, `Ya no sos ${FACCIONES[k].nombre}.`, 'warn'); }
  else { const rec = accounts.load(n); if (rec) { quitar(rec); accounts.save(rec); } }
  if (this.gmLog) this.gmLog(`${p.name}: /QUITARLIDER ${n}`);
  this.msg(p, `${n} ya no es ${FACCIONES[k].nombre}.`, 'gm');
};

L.mostrarLideres = function (p) {
  for (const [k, f] of Object.entries(FACCIONES)) this.msg(p, `${f.nombre}: ${this.lideres[k] || '(nadie)'}`, 'info');
};

module.exports = L;
