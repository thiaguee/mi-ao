'use strict';
// Premios por matar al otro bando (Ciudadanos / Criminales).
// Los reclama cada uno con el Comandante de su ciudad natal (Banderbill o Arghal).
const fs = require('fs');
const path = require('path');
const G = require('./gamedata');

const F = {};
const BANDO = { ciu: 'ciudadanos', cri: 'criminales' };
const NOMBRE = { ciu: 'Ciudadanos', cri: 'Criminales' };
const bandoDe = (p) => (p.faccion === 'neu' ? 'neu' : p.crim ? 'cri' : 'ciu');
// los ciudadanos cuentan criminales matados; los criminales, ciudadanos matados
const killsPara = (p) => (p.faccion === 'neu' ? 0 : p.crim ? (p.kills.ciu || 0) : (p.kills.cri || 0));

// Grupo de armaduras de facción según la clase (como en armadurasfaccionarias.dat)
const MAGOS = new Set([36, 37, 38, 39]); // Con uso de maná, Hechicero, Mago, Nigromante
const SACERDOTES = new Set([40, 42, 43, 44, 45]); // Orden sagrada, Clérigo, Naturalista, Bardo, Druida
const grupoDe = (p) => (MAGOS.has(p.clase) ? 1 : SACERDOTES.has(p.clase) ? 2 : 3); // 3 = guerreros y demás

// ---------- elegir facción a nivel 13 ----------
// Nadie se vuelve criminal por matar: al llegar a nivel NIVEL_FACCION cada uno elige (una sola vez)
// si representa a los Ciudadanos, a los Criminales o a los Neutrales. Antes de eso es "novato":
// no puede pelear contra usuarios ni lo pueden atacar (salvo en zonas de pelea, duelos o arena).
const NIVEL_FACCION = 13;
const NOMBRE_FAC = { ciu: 'Ciudadano', cri: 'Criminal', neu: 'Neutral' };
F.NIVEL_FACCION = NIVEL_FACCION;
F.nombreFaccion = function (p) { return p.faccion ? NOMBRE_FAC[p.faccion] : (p.stats.lvl < NIVEL_FACCION ? 'Novato' : 'Sin facción'); };
F.esNovato = function (p) { return p.kind === 'pc' && !p.faccion && p.stats.lvl < NIVEL_FACCION && !p.gm; };
F.ofrecerFaccion = function (p) {
  if (p.faccion || p.gm > 0 || p.stats.lvl < NIVEL_FACCION) return;
  this.send(p, { t: 'elegirFaccion', nivel: NIVEL_FACCION });
};
F.ponerFaccion = function (p, f) {
  p.faccion = f || '';
  p.crim = f === 'cri';
  this.sendCharToMap(p);
  this.send(p, { t: 'stats', crim: p.crim, faccion: p.faccion });
  if (this.revisarTunicaDeBando) this.revisarTunicaDeBando(p);
};
F.elegirFaccion = function (p, f) {
  if (!NOMBRE_FAC[f]) return;
  if (p.faccion) return this.msg(p, `Ya elegiste: sos ${NOMBRE_FAC[p.faccion]}. La facción no se puede cambiar.`, 'warn');
  if (p.stats.lvl < NIVEL_FACCION && p.gm === 0) return this.msg(p, `Podés elegir facción a partir del nivel ${NIVEL_FACCION}.`, 'warn');
  this.ponerFaccion(p, f);
  this.savePlayer(p);
  const txt = { ciu: 'Ahora representás a los CIUDADANOS. Tu enemigo son los criminales; tu comandante está en Arghal.',
    cri: 'Ahora representás a los CRIMINALES. Tu enemigo son los ciudadanos; tu comandante está en Banderbill.',
    neu: 'Ahora sos NEUTRAL: no tenés bando ni guerra. Podés pelear con cualquiera (sacá el seguro con /SEGURO) y cualquiera te puede atacar.' }[f];
  this.msg(p, '⚑ ' + txt, 'server');
  this.toAll({ t: 'msg', text: `⚑ ${p.name} eligió ser ${NOMBRE_FAC[f]}.`, color: 'server' });
};

// ¿Pueden pelear estos dos usuarios por la facción? (fuera de zona segura/pelea/guerra/duelo). true o el motivo
F.reglaFaccion = function (p, t) {
  if (p.gm >= 3) return true;
  if (this.esNovato(p)) return `Los novatos no pelean contra usuarios. A nivel ${NIVEL_FACCION} vas a elegir tu facción.`;
  if (this.esNovato(t)) return `${t.name} es novato (menos de nivel ${NIVEL_FACCION}): no se lo puede atacar.`;
  if (!p.faccion && p.gm === 0) { this.ofrecerFaccion(p); return 'Primero elegí tu facción.'; }
  const a = bandoDe(p), b = bandoDe(t);
  if (a !== 'neu' && a === b) return `${t.name} es de tu facción (${NOMBRE_FAC[a] === 'Criminal' ? 'Criminales' : 'Ciudadanos'}).`;
  // el seguro: puesto, sólo deja atacar a la facción enemiga (los neutrales no tienen enemiga)
  const enemigo = (a === 'ciu' && b === 'cri') || (a === 'cri' && b === 'ciu');
  if (!enemigo && !p.seguroOff) return 'Con el seguro puesto sólo podés atacar a la facción enemiga. Sacalo con /SEGURO.';
  return true;
};

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
