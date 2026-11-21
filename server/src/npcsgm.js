'use strict';
// NPCs puestos por los GMs y que quedan fijos (se guardan en npcs-gm.json, en la carpeta de datos):
//   /PONERNPC número  -> pone ese NPC en la última baldosa donde hiciste clic (o adelante tuyo) y queda ahí para siempre
//   /SACARNPC         -> saca para siempre el NPC que señalaste con clic (uno puesto por un GM o uno que venía en el mapa)
//   /NPCSPUESTOS      -> lista de los NPCs puestos por GMs
const fs = require('fs');
const path = require('path');

const N = {};
const RANGO = 3; // Dios o Admin
const ADELANTE = { 1: [0, -1], 2: [1, 0], 3: [0, 1], 4: [-1, 0] };

N.cargarNpcsGm = function () {
  this.npcsGmPath = path.join(this.dataDir, 'npcs-gm.json');
  this.npcsGm = { puestos: [], sacados: [] };
  try { if (fs.existsSync(this.npcsGmPath)) Object.assign(this.npcsGm, JSON.parse(fs.readFileSync(this.npcsGmPath, 'utf8'))); } catch (e) { console.error('Error leyendo npcs-gm.json:', e.message); }
  // los que se sacaron
  for (const s of this.npcsGm.sacados) {
    for (const npc of [...this.npcs.values()]) {
      if (npc.num === s.num && npc.orig.map === s.map && npc.orig.x === s.x && npc.orig.y === s.y) { this.remove(npc); this.npcs.delete(npc.id); }
    }
  }
  // los que se pusieron
  for (const q of this.npcsGm.puestos) {
    const npc = this.spawnNpc(q.num, q.map, q.x, q.y, true);
    if (npc) { npc.puestoGm = true; if (q.h) npc.heading = q.h; }
  }
  if (this.npcsGm.puestos.length || this.npcsGm.sacados.length) console.log(`NPCs de GMs: ${this.npcsGm.puestos.length} puestos, ${this.npcsGm.sacados.length} sacados`);
};

N.guardarNpcsGm = function () {
  try { fs.writeFileSync(this.npcsGmPath, JSON.stringify(this.npcsGm, null, 1)); } catch (e) { console.error('No se pudo guardar npcs-gm.json:', e.message); }
};

N.ponerNpc = function (p, num) {
  if (p.gm < RANGO) return this.msg(p, 'Comando inexistente. Escribí /AYUDA.', 'warn');
  num = Math.floor(+num);
  const def = this.data.npcs[num];
  if (!def) return this.msg(p, 'Uso: /PONERNPC número (por ejemplo /PONERNPC 1031). Los números están en /BUSCARNPC.', 'warn');
  // en la última baldosa donde hiciste clic (si fue hace poco y en este mapa); si no, adelante tuyo
  let x, y;
  const c = p.lastClick;
  if (c && c.map === p.map && p.lastClickAt && Date.now() - p.lastClickAt < 60000) { x = c.x; y = c.y; } else {
    const [dx, dy] = ADELANTE[p.heading] || [0, 1];
    x = p.x + dx; y = p.y + dy;
  }
  const npc = this.spawnNpc(num, p.map, x, y, true);
  if (!npc) return this.msg(p, 'No se pudo poner ahí (lugar bloqueado).', 'warn');
  npc.puestoGm = true;
  npc.heading = 3; // mirando hacia abajo, de frente
  this.sendCharToMap(npc);
  this.npcsGm.puestos.push({ num, map: p.map, x: npc.x, y: npc.y, h: 3 });
  this.guardarNpcsGm();
  if (this.gmLog) this.gmLog(`${p.name} /PONERNPC ${num} (${def.name}) en ${p.map} ${npc.x} ${npc.y}`);
  this.msg(p, `Pusiste a ${def.name} en el mapa ${p.map} (${npc.x}, ${npc.y}). Queda ahí aunque se reinicie el servidor. Para sacarlo: clic en él y /SACARNPC.`, 'gm');
};

N.sacarNpc = function (p) {
  if (p.gm < RANGO) return this.msg(p, 'Comando inexistente. Escribí /AYUDA.', 'warn');
  const npc = p.target && this.npcs.get(p.target);
  if (!npc || npc.map !== p.map) return this.msg(p, 'Primero hacé clic en el NPC que querés sacar.', 'warn');
  if (npc.puestoGm) {
    const i = this.npcsGm.puestos.findIndex((q) => q.num === npc.num && q.map === npc.orig.map && q.x === npc.orig.x && q.y === npc.orig.y);
    if (i >= 0) this.npcsGm.puestos.splice(i, 1);
  } else if (npc.spawnOrig) {
    this.npcsGm.sacados.push({ num: npc.num, map: npc.orig.map, x: npc.orig.x, y: npc.orig.y });
  }
  this.remove(npc);
  this.npcs.delete(npc.id);
  p.target = null;
  this.guardarNpcsGm();
  if (this.gmLog) this.gmLog(`${p.name} /SACARNPC ${npc.num} (${npc.name}) de ${npc.map} ${npc.x} ${npc.y}`);
  this.msg(p, `Sacaste a ${npc.name}. No vuelve a aparecer ahí.`, 'gm');
};

N.listarNpcsGm = function (p) {
  if (p.gm < RANGO) return this.msg(p, 'Comando inexistente. Escribí /AYUDA.', 'warn');
  if (!this.npcsGm.puestos.length) return this.msg(p, 'No hay NPCs puestos por GMs. Usá /PONERNPC número.', 'gm');
  this.msg(p, 'NPCs puestos por GMs:', 'gm');
  for (const q of this.npcsGm.puestos) this.msg(p, `${q.num} - ${(this.data.npcs[q.num] || {}).name || '?'}: mapa ${q.map} (${q.x}, ${q.y})`, 'gm');
};

module.exports = N;
