'use strict';
// Premios por matar al otro bando (Ciudadanos / Criminales).
// Los reclama cada uno con el Comandante de su ciudad natal (Banderbill o Arghal).
const fs = require('fs');
const path = require('path');
const G = require('./gamedata');

const F = {};
const BANDO = { ciu: 'ciudadanos', cri: 'criminales' };
const NOMBRE = { ciu: 'Ciudadanos', cri: 'Criminales' };
const bandoDe = (p) => (p.crim ? 'cri' : 'ciu');
// los ciudadanos cuentan criminales matados; los criminales, ciudadanos matados
const killsPara = (p) => (p.crim ? (p.kills.ciu || 0) : (p.kills.cri || 0));

// Grupo de armaduras de facción según la clase (como en armadurasfaccionarias.dat)
const MAGOS = new Set([36, 37, 38, 39]); // Con uso de maná, Hechicero, Mago, Nigromante
const SACERDOTES = new Set([40, 42, 43, 44, 45]); // Orden sagrada, Clérigo, Naturalista, Bardo, Druida
const grupoDe = (p) => (MAGOS.has(p.clase) ? 1 : SACERDOTES.has(p.clase) ? 2 : 3); // 3 = guerreros y demás

F.cargarFaccion = function () {
  const dir = path.join(__dirname, '..', 'data');
  try {
    this.premiosFaccion = JSON.parse(fs.readFileSync(path.join(dir, 'recompensas-faccion.json'), 'utf8'));
  } catch (e) { console.error('Error leyendo recompensas-faccion.json:', e.message); this.premiosFaccion = { ciudadanos: { magos: [], otrasClases: [] }, criminales: { magos: [], otrasClases: [] } }; }
  // armaduras de facción originales: [CLASEn] DefMinArmyAlto=675 ...
  this.armFaccion = {};
  try {
    let sec = null;
    for (const linea of fs.readFileSync(path.join(dir, 'dat', 'armadurasfaccionarias.dat'), 'latin1').split(/\r?\n/)) {
      const m = /^\[CLASE(\d+)\]/i.exec(linea);
      if (m) { sec = this.armFaccion[+m[1]] = {}; continue; }
      const kv = /^(\w+)=\s*(\d+)/.exec(linea);
      if (sec && kv) sec[kv[1].toLowerCase()] = +kv[2];
    }
  } catch (e) { console.error('Error leyendo armadurasfaccionarias.dat:', e.message); }
  // de qué bando es cada objeto de premio (si está en las dos listas, lo usan los dos)
  this.objFaccion = new Map();
  const marcar = (id, b) => { if (!id) return; if (!this.objFaccion.has(id)) this.objFaccion.set(id, new Set()); this.objFaccion.get(id).add(b); };
  const eg = this.premiosFaccion.versionEnanoGnomo || {};
  for (const [b, clave] of Object.entries(BANDO)) {
    const cfg = this.premiosFaccion[clave];
    for (const pr of [...(cfg.magos || []), ...(cfg.otrasClases || [])]) { marcar(pr.obj, b); marcar(eg[pr.obj], b); }
    const lado = b === 'ciu' ? 'army' : 'caos';
    for (const sec of Object.values(this.armFaccion)) for (const [k, v] of Object.entries(sec)) if (k.includes(lado)) marcar(v, b);
  }
};

// Lista de premios para este personaje (según su bando, su clase y su raza)
F.premiosPara = function (p, b) {
  const cfg = this.premiosFaccion[BANDO[b]];
  const bajo = G.ES_RAZA_BAJA(p.raza);
  const eg = this.premiosFaccion.versionEnanoGnomo || {};
  const grupo = grupoDe(p);
  if (grupo === 1) return (cfg.magos || []).map((pr) => ({ kills: pr.kills, obj: (bajo && eg[pr.obj]) || pr.obj }));
  const sec = this.armFaccion[grupo] || {};
  return (cfg.otrasClases || []).map((pr) => ({
    kills: pr.kills,
    obj: pr.obj || sec[`def${pr.rango.toLowerCase()}${b === 'ciu' ? 'army' : 'caos'}${bajo ? 'bajo' : 'alto'}`] || 0,
  })).filter((x) => x.obj);
};

// ¿Puede usar este objeto según su bando?  (devuelve true o el motivo)
F.puedeUsarPorBando = function (p, o) {
  if (p.gm >= 2) return true;
  let s = this.objFaccion && this.objFaccion.get(o.id);
  if (!s && (o.real || o.caos)) s = new Set(o.real ? ['ciu'] : ['cri']);
  if (!s || s.has(bandoDe(p))) return true;
  return `Esto es de los ${[...s].map((b) => NOMBRE[b]).join(' y ')}.`;
};

// Si cambió de bando (por ejemplo, un ciudadano que se volvió criminal), se le saca la armadura del otro bando
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

F.enviarCanje = function (p, b, lejos = false) {
  const lista = this.premiosPara(p, b);
  const k = killsPara(p);
  const hechos = p.canjesFaccion || [];
  this.send(p, {
    t: 'canje', lejos: lejos ? (b === 'ciu' ? 'Banderbill' : 'Arghal') : '', bando: b, nombre: NOMBRE[b], kills: k, otro: NOMBRE[b === 'ciu' ? 'cri' : 'ciu'],
    premios: lista.map((pr) => {
      const o = this.data.objs[pr.obj] || {};
      const usable = o.id ? this.canUseObj(p, o) : 'No existe';
      return { i: pr.kills, kills: pr.kills, id: pr.obj, n: o.name || '?', g: o.grh || 0, md: o.minDef, xd: o.maxDef,
        hecho: hechos.includes(`${b}:${pr.kills}`) ? 1 : 0, puede: k >= pr.kills ? 1 : 0, aviso: usable === true ? '' : usable };
    }),
  });
};

// i = cantidad de kills del premio
F.reclamarPremio = function (p, i) {
  const b = bandoDe(p);
  const npc = [...this.maps[p.map].chars].map((id) => this.npcs.get(id)).find((n) => n && n.def.comandante === b && Math.abs(n.x - p.x) <= 5 && Math.abs(n.y - p.y) <= 5);
  if (!npc) return this.msg(p, 'Tenés que estar al lado de tu comandante.', 'warn');
  const pr = this.premiosPara(p, b).find((x) => x.kills === +i);
  if (!pr) return;
  p.canjesFaccion = p.canjesFaccion || [];
  const clave = `${b}:${pr.kills}`;
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
