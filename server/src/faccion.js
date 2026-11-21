'use strict';
// Premios por matar al otro bando (Ciudadanos / Criminales).
// Los reclama cada uno con el Comandante de su ciudad natal (Banderbill o Arghal).
const fs = require('fs');
const path = require('path');

const F = {};
const BANDO = { ciu: 'ciudadanos', cri: 'criminales' };
const NOMBRE = { ciu: 'Ciudadanos', cri: 'Criminales' };
const bandoDe = (p) => (p.crim ? 'cri' : 'ciu');
// los ciudadanos cuentan criminales matados; los criminales, ciudadanos matados
const killsPara = (p) => (p.crim ? (p.kills.ciu || 0) : (p.kills.cri || 0));

F.cargarFaccion = function () {
  try {
    this.premiosFaccion = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data', 'recompensas-faccion.json'), 'utf8'));
  } catch (e) { console.error('Error leyendo recompensas-faccion.json:', e.message); this.premiosFaccion = { ciudadanos: { premios: [] }, criminales: { premios: [] } }; }
  // de qué bando es cada objeto de premio (si está en las dos listas, lo usan los dos)
  this.objFaccion = new Map();
  for (const [b, clave] of Object.entries(BANDO)) {
    for (const pr of this.premiosFaccion[clave].premios) {
      if (!this.objFaccion.has(pr.obj)) this.objFaccion.set(pr.obj, new Set());
      this.objFaccion.get(pr.obj).add(b);
    }
  }
};

// ¿Puede usar este objeto según su bando?  (devuelve true o el motivo)
F.puedeUsarPorBando = function (p, o) {
  const s = this.objFaccion && this.objFaccion.get(o.id);
  if (!s || p.gm >= 2) return true;
  if (s.has(bandoDe(p))) return true;
  return `Esta túnica es de los ${[...s].map((b) => NOMBRE[b]).join(' y ')}.`;
};

// Si cambió de bando (por ejemplo, un ciudadano que se volvió criminal), se le saca la túnica del otro bando
F.revisarTunicaDeBando = function (p) {
  const slot = p.eq.armor;
  if (slot < 0 || !p.inv[slot]) return;
  const o = this.data.objs[p.inv[slot].id];
  if (o && this.puedeUsarPorBando(p, o) !== true) {
    p.eq.armor = -1;
    this.recalcEquip(p); this.sendSlot(p, slot); this.sendCharToMap(p);
    this.msg(p, `Te sacaste ${o.name}: es de otro bando.`, 'warn');
  }
};

F.esComandante = (npc) => !!(npc && npc.def.comandante);

F.abrirCanje = function (p, npc) {
  const b = npc.def.comandante; // 'ciu' o 'cri'
  if (bandoDe(p) !== b && p.gm < 2) {
    return this.msg(p, `El comandante sólo atiende a los ${NOMBRE[b]}. Tu comandante está en ${b === 'ciu' ? 'Arghal' : 'Banderbill'}.`, 'warn');
  }
  this.enviarCanje(p, b);
};

F.enviarCanje = function (p, b) {
  const lista = this.premiosFaccion[BANDO[b]].premios;
  const k = killsPara(p);
  const hechos = p.canjesFaccion || [];
  this.send(p, {
    t: 'canje', bando: b, nombre: NOMBRE[b], kills: k, otro: NOMBRE[b === 'ciu' ? 'cri' : 'ciu'],
    premios: lista.map((pr, i) => {
      const o = this.data.objs[pr.obj] || {};
      const usable = o.id ? this.canUseObj(p, o) : 'No existe';
      return { i, kills: pr.kills, id: pr.obj, n: o.name || '?', g: o.grh || 0, md: o.minDef, xd: o.maxDef,
        hecho: hechos.includes(`${b}:${i}`) ? 1 : 0, puede: k >= pr.kills ? 1 : 0, aviso: usable === true ? '' : usable };
    }),
  });
};

F.reclamarPremio = function (p, i) {
  const b = bandoDe(p);
  const npc = [...this.maps[p.map].chars].map((id) => this.npcs.get(id)).find((n) => n && n.def.comandante === b && Math.abs(n.x - p.x) <= 5 && Math.abs(n.y - p.y) <= 5);
  if (!npc) return this.msg(p, 'Tenés que estar al lado de tu comandante.', 'warn');
  const pr = this.premiosFaccion[BANDO[b]].premios[+i];
  if (!pr) return;
  p.canjesFaccion = p.canjesFaccion || [];
  const clave = `${b}:${+i}`;
  if (p.canjesFaccion.includes(clave)) return this.msg(p, 'Ya reclamaste ese premio.', 'warn');
  if (killsPara(p) < pr.kills) return this.msg(p, `Te faltan kills: necesitás ${pr.kills}.`, 'warn');
  const slot = p.inv.findIndex((x) => !x);
  if (slot < 0) return this.msg(p, 'No tenés lugar en el inventario.', 'warn');
  p.inv[slot] = { id: pr.obj, amount: 1, nc: 999 }; // no se cae al morir
  p.canjesFaccion.push(clave);
  this.sendSlot(p, slot);
  this.savePlayer(p);
  const o = this.data.objs[pr.obj];
  this.msg(p, `¡Recibiste ${o.name} por tus ${pr.kills} kills! No se te cae al morir.`, 'server');
  this.toMap(p.map, { t: 'snd', w: 6 });
  this.enviarCanje(p, b);
};

module.exports = F;
