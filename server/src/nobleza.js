'use strict';
// Nobleza: juntando todas las gemas y escribiendo /NOBLEZA el personaje se vuelve Noble.
// Sigue siendo ciudadano o criminal, pero su nombre se ve verde y al hacerle clic dice [NOBLE].
// Beneficio: elige una de las 3 túnicas de noble (sólo las pueden usar los nobles).
const fs = require('fs');
const path = require('path');

const N = {};

N.cargarNobleza = function () {
  try {
    this.cfgNobleza = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data', 'nobleza.json'), 'utf8'));
  } catch (e) { console.error('Error leyendo nobleza.json:', e.message); this.cfgNobleza = { gemas: [], tunicas: [] }; }
  this.tunicasNobles = new Set(this.cfgNobleza.tunicas.map((t) => t.obj).filter(Boolean));
};

N.esTunicaNoble = function (id) { return !!(this.tunicasNobles && this.tunicasNobles.has(id)); };

// /NOBLEZA
N.comandoNobleza = function (p) {
  const c = this.cfgNobleza;
  if (p.noble) return this.enviarNobleza(p);
  if (!c.gemas.length) return this.msg(p, 'Todavía no hay gemas de nobleza en el juego. ¡Pronto!', 'warn');
  const faltan = c.gemas.filter((id) => !p.inv.some((it) => it && it.id === id));
  if (faltan.length) {
    const nombres = faltan.map((id) => (this.data.objs[id] || {}).name || `objeto ${id}`);
    return this.msg(p, `Para ser Noble necesitás todas las gemas en tu inventario. Te faltan: ${nombres.join(', ')}.`, 'warn');
  }
  if (c.consumirGemas) for (const id of c.gemas) this.quitarItem(p, id, 1);
  p.noble = true;
  this.savePlayer(p);
  this.sendCharToMap(p);
  this.toAll({ t: 'msg', text: `👑 ¡${p.name} reunió todas las gemas y ahora es NOBLE!`, color: 'server' });
  this.toAll({ t: 'snd', w: 6 });
  this.enviarNobleza(p);
};

// Ventana para elegir la túnica
N.enviarNobleza = function (p) {
  this.send(p, {
    t: 'nobleza', elegida: p.tunicaNoble || 0,
    tunicas: this.cfgNobleza.tunicas.map((t) => {
      const o = t.obj && this.data.objs[t.obj];
      const puede = o ? this.canUseObj(p, o) : true;
      return { obj: o ? t.obj : 0, n: t.nombre, g: o ? o.grh : 0, md: o ? o.minDef : 0, xd: o ? o.maxDef : 0, aviso: puede === true ? '' : puede };
    }),
  });
};

N.elegirTunicaNoble = function (p, obj) {
  if (!p.noble) return this.msg(p, 'Sólo los nobles pueden elegir una túnica de noble.', 'warn');
  if (p.tunicaNoble) return this.msg(p, 'Ya elegiste tu túnica de noble.', 'warn');
  obj = +obj;
  if (!this.esTunicaNoble(obj)) return;
  const slot = p.inv.findIndex((x) => !x);
  if (slot < 0) return this.msg(p, 'No tenés lugar en el inventario.', 'warn');
  p.inv[slot] = { id: obj, amount: 1, nc: 999 }; // no se cae al morir
  p.tunicaNoble = obj;
  this.sendSlot(p, slot);
  this.savePlayer(p);
  this.msg(p, `¡Recibiste ${this.data.objs[obj].name}! No se te cae al morir.`, 'server');
  this.enviarNobleza(p);
};

// saca 'cant' unidades de un objeto del inventario
N.quitarItem = function (p, id, cant) {
  for (let i = 0; i < p.inv.length && cant > 0; i++) {
    const it = p.inv[i];
    if (!it || it.id !== id) continue;
    const n = Math.min(cant, it.amount);
    this.removeFromSlot(p, i, n);
    cant -= n;
  }
};

// /NOBLE nombre (GM): dar o sacar la nobleza
N.gmNoble = function (p, nombre) {
  const t = nombre && this.findPlayer(nombre);
  if (!t) return this.msg(p, 'Usuario no conectado. Uso: /NOBLE nombre', 'warn');
  t.noble = !t.noble;
  if (!t.noble) t.tunicaNoble = 0;
  this.savePlayer(t);
  this.sendCharToMap(t);
  this.msg(p, `${t.name} ${t.noble ? 'ahora es Noble' : 'ya no es Noble'}.`, 'gm');
  this.msg(t, t.noble ? '👑 Un GM te dio la nobleza. Escribí /NOBLEZA para elegir tu túnica.' : 'Un GM te quitó la nobleza.', 'server');
};

module.exports = N;
