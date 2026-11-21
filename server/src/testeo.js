'use strict';
// Panel /TESTEO (sólo Admin): todo lo que creamos o arreglamos en Norway AO, para probarlo rápido.
// Regla: lo nuestro usa números desde el 2000 (objetos y NPCs).
//  - Objetos: Equipables, Consumibles y Decoraciones (se crean igual que en /OBJETOS).
//  - Hechizos: los pergaminos nuestros (se crea el pergamino; al usarlo se aprende).
//  - NPCs: Hostiles e Interactuables (se invocan al lado, sin reaparecer).
const G = require('./gamedata');
const { OBJ } = G;

const T = {};
const RANGO = 4;
const DESDE = 2000;
const CONSUMIBLES = new Set([OBJ.COMIDA, OBJ.POCION, OBJ.BEBIDA, OBJ.BOTELLA_VACIA, OBJ.BOTELLA_LLENA]);

T.abrirTesteo = function (p) {
  if (p.gm < RANGO) return this.msg(p, 'Comando inexistente. Escribí /AYUDA.', 'warn');
  const objetos = [], hechizos = [], npcs = [];
  for (const o of this.data.objs) {
    if (!o || o.id < DESDE) continue;
    const it = { i: o.id, n: o.name, g: o.grh, ty: o.type, def: o.maxDef ? `${o.minDef}-${o.maxDef}` : '' };
    if (o.type === OBJ.PERGAMINO) {
      const sp = this.data.spells[o.spell] || {};
      hechizos.push(Object.assign(it, { sp: sp.name || '?', mana: sp.mana || 0, dmg: sp.maxHp ? `${sp.minHp}-${sp.maxHp}` : '',
        crit: sp.critico || 0, div: sp.divino || 0, soloNpc: sp.target === 2 ? 1 : 0, precio: o.value }));
      continue;
    }
    if (this.esEstructura(o)) { it.m = 1; it.cat = 'deco'; } else it.cat = CONSUMIBLES.has(o.type) ? 'cons' : 'equip';
    objetos.push(it);
  }
  for (const n of this.data.npcs) {
    if (!n || n.id < DESDE) continue;
    npcs.push({ i: n.id, n: n.name, b: n.body, h: n.head, hostil: n.hostile ? 1 : 0, hp: n.maxHp || 0 });
  }
  this.send(p, { t: 'testeo', objetos, hechizos, npcs });
};

// Invocar un NPC nuestro al lado (como /ACC: no reaparece)
T.testeoNpc = function (p, msg) {
  if (p.gm < RANGO) return;
  const id = Math.floor(+msg.id);
  if (!(id >= DESDE) || !this.data.npcs[id]) return this.msg(p, 'NPC inexistente.', 'warn');
  const n = this.spawnNpc(id, p.map, p.x, p.y + 1);
  if (!n) return this.msg(p, 'No hay lugar para invocarlo.', 'warn');
  n.spawnOrig = false;
  this.gmLog(`${p.name}: [testeo] invocó ${n.name} (${id})`);
  return this.msg(p, `Invocaste a ${n.name}.`, 'gm');
};

module.exports = T;
