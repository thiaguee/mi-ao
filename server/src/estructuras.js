'use strict';
// Panel de objetos de los Admin (/OBJETOS) y estructuras fijas en el mapa.
//
// - Los objetos equipables o consumibles van al inventario (igual que /CI).
// - Las estructuras (árboles, puertas, carteles, muebles, teleports, etc.) se ponen en la
//   baldosa a la que mira el Admin y quedan guardadas para siempre en estructuras.json
//   (en la carpeta de datos del servidor). Las sólidas bloquean el paso.
// - /ELIMINARESTRUCTURA borra la última estructura que el Admin clickeó (hasta 15 segundos
//   después del clic). Puede borrar también las que vienen en los mapas originales, y el
//   borrado queda guardado.
const fs = require('fs');
const path = require('path');
const G = require('./gamedata');
const { idx, XY, OBJ } = G;

const E = {};
const RANGO = 4; // sólo Admin
const SEGUNDOS_ELIMINAR = 15;
const DIRS = { 1: [0, -1], 2: [1, 0], 3: [0, 1], 4: [-1, 0] };

// Tipos que se ponen en el mapa (estructuras sólidas, interactuables o decoración)
const TIPOS_MAPA = new Set([
  OBJ.ARBOL, OBJ.PUERTA, OBJ.CONTENEDOR, OBJ.CARTEL, OBJ.FORO, OBJ.FOGATA, OBJ.TELEPORT,
  20, // muebles
  21, // joyas y adornos (copas, candelabros)
  OBJ.YACIMIENTO, OBJ.YUNQUE, OBJ.FRAGUA,
  35, // rejas y manchas de sangre
  36, // árbol élfico
  38, // pez saltando
]);

E.esEstructura = function (od) { return !!od && TIPOS_MAPA.has(od.type); };

// ¿Bloquea el paso? Devuelve las baldosas que bloquea (las puertas ocupan 2 de ancho)
E.baldosasSolidas = function (od, x, y) {
  if (!od) return [];
  if (od.type === OBJ.PUERTA) return od.id === od.indexCerrada ? [[x, y], [x - 1, y]] : [];
  if ([OBJ.ARBOL, 36, OBJ.YACIMIENTO, OBJ.YUNQUE, OBJ.FRAGUA, OBJ.CONTENEDOR].includes(od.type)) return [[x, y]];
  if (od.type === 35 && /reja/i.test(od.name)) return [[x, y]];
  return [];
};

// ---------- teleports del panel ----------
const sinAcentos = (s) => String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().trim();

// Destino fijo de un teleport con nombre ("Teleport a Nix"); null si es genérico
E.destinoTeleport = function (od) {
  const m = /^Teleport a (.+)$/i.exec(od.name || '');
  if (!m) return null;
  const lugar = sinAcentos(m[1]);
  const c = this.data.cities[lugar];
  if (c) return [c.map, c.x, c.y];
  if (lugar === 'DUNGEON NEWBIE') {
    try {
      const fijos = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data', 'teleports.json'), 'utf8')).teleports || [];
      const t = fijos.find((f) => /newbie/i.test(f.nombre || ''));
      if (t) return t.destino;
    } catch (e) { /* sin destino */ }
  }
  return null;
};

// ---------- guardado ----------
E.cargarEstructuras = function () {
  this.estrPath = path.join(this.dataDir, 'estructuras.json');
  this.estr = {}; // "mapa,x,y" -> id (0 = borrada)
  try {
    if (fs.existsSync(this.estrPath)) this.estr = JSON.parse(fs.readFileSync(this.estrPath, 'utf8')).cambios || {};
  } catch (e) { console.error('Error leyendo estructuras.json:', e.message); }
  let n = 0;
  for (const k of Object.keys(this.estr)) this.estr[k] = G.nuevoId(this.estr[k]); // números viejos -> 2000+
  for (const [clave, id] of Object.entries(this.estr)) {
    const [m, x, y] = clave.split(',').map(Number);
    if (this.aplicarEstructura(m, x, y, id, false)) n++;
  }
  console.log(`Estructuras cambiadas por Admins: ${n}`);
};

E.guardarEstructuras = function () {
  fs.writeFileSync(this.estrPath, JSON.stringify({
    _ayuda: 'Estructuras puestas (número de objeto) o borradas (0) por los Admins con /OBJETOS y /ELIMINARESTRUCTURA. Clave: "mapa,x,y".',
    cambios: this.estr,
  }, null, 2));
};

// Marca una baldosa bloqueada o libre, y la recuerda para mandársela a quien entre al mapa
E.bloquear = function (mp, x, y, b, avisar) {
  if (!this.inMap(x, y)) return;
  mp.d.blocked[idx(x, y)] = b;
  if (!mp.blkCambios) mp.blkCambios = new Map();
  mp.blkCambios.set(idx(x, y), b);
  if (avisar) this.toMap(mp.n, { t: 'blk', tiles: [[x, y, b]] });
};

// Pone (id > 0) o borra (id = 0) la estructura de una baldosa
E.aplicarEstructura = function (m, x, y, id, avisar) {
  const mp = this.maps[m];
  if (!mp || !this.inMap(x, y)) return false;
  const k = idx(x, y);
  const actual = mp.objs.get(k);
  if (actual) {
    const od = this.data.objs[actual.id];
    for (const [bx, by] of this.baldosasSolidas(od, x, y)) this.bloquear(mp, bx, by, 0, avisar);
    if (od && od.type === OBJ.TELEPORT) mp.d.exits.delete(k);
    mp.objs.delete(k);
  }
  const od = this.data.objs[id];
  if (id && od) {
    mp.objs.set(k, { id, amount: 1, fija: true }); // sin "t": la limpieza de objetos no la borra
    for (const [bx, by] of this.baldosasSolidas(od, x, y)) this.bloquear(mp, bx, by, 1, avisar);
  }
  if (avisar) this.toMap(m, { t: 'obj', x, y, g: id && od ? od.grh : 0 });
  return true;
};

// ---------- panel /OBJETOS ----------
E.abrirPanelObjetos = function (p) {
  if (p.gm < RANGO) return this.msg(p, 'Comando inexistente. Escribí /AYUDA.', 'warn');
  if (!this.listaObjetos) {
    this.listaObjetos = [];
    for (const od of this.data.objs) {
      if (!od || !od.name || od.name === 'No ves nada interesante.') continue;
      const it = { i: od.id, n: od.name, g: od.grh, ty: od.type };
      if (this.esEstructura(od)) it.m = 1;
      if (od.type === OBJ.TELEPORT && !this.destinoTeleport(od)) it.tp = 1; // pide el mapa de destino
      this.listaObjetos.push(it);
    }
  }
  this.send(p, { t: 'objetos', lista: this.listaObjetos });
};

// Crear desde el panel: { id, a: cantidad, mapa: destino de un teleport genérico }
E.crearDesdePanel = function (p, msg) {
  if (p.gm < RANGO) return;
  const id = Math.floor(+msg.id);
  const od = this.data.objs[id];
  if (!od) return this.msg(p, 'Objeto inexistente.', 'warn');
  if (!this.esEstructura(od)) {
    const amount = Math.max(1, Math.min(10000, Math.floor(+msg.a) || 1));
    const got = this.giveItem(p, id, amount);
    if (got < amount) this.dropObj(p.map, p.x, p.y, id, amount - got);
    this.gmLog(`${p.name}: [panel] creó ${amount} ${od.name} (${id})`);
    return this.msg(p, `Creaste ${amount} ${od.name}.`, 'gm');
  }
  // Estructura: va en la baldosa a la que mira
  const d = DIRS[p.heading] || DIRS[3];
  const x = p.x + d[0], y = p.y + d[1];
  const mp = this.maps[p.map];
  const k = idx(x, y);
  const ocupada = !this.inMap(x, y) || mp.d.blocked[k] || mp.d.water[k] || mp.objs.has(k) || mp.occ[k] || mp.d.exits.has(k);
  if (ocupada) return this.msg(p, 'Esa baldosa está ocupada: mirá hacia una baldosa libre.', 'warn');
  if (od.type === OBJ.PUERTA && od.id === od.indexCerrada) {
    const kx = idx(x - 1, y);
    if (!this.inMap(x - 1, y) || mp.d.blocked[kx] || mp.occ[kx]) return this.msg(p, 'Una puerta cerrada ocupa 2 baldosas: falta lugar a la izquierda.', 'warn');
  }
  if (od.type === OBJ.TELEPORT) {
    let destino = this.destinoTeleport(od);
    if (!destino) {
      const dm = Math.floor(+msg.mapa);
      if (!this.maps[dm]) return this.msg(p, 'Elegí un número de mapa de destino válido.', 'warn');
      destino = [dm, Math.ceil(XY / 2), Math.ceil(XY / 2)];
    }
    const [dm, dx, dy] = destino;
    const t = { mapa: p.map, x, y, destino: [dm, dx, dy], creadoPor: p.name, nombre: this.maps[dm].d.name, obj: id };
    this.tpGm = this.tpGm.filter((o) => !(o.mapa === t.mapa && o.x === t.x && o.y === t.y));
    this.tpGm.push(t);
    this.guardarTeleportsGm();
    this.ponerTeleport(t, true);
    this.gmLog(`${p.name}: [panel] puso ${od.name} en (${p.map}, ${x}, ${y}) hacia (${dm}, ${dx}, ${dy})`);
    return this.msg(p, `Pusiste ${od.name} en (${p.map}, ${x}, ${y}). Lleva a ${this.maps[dm].d.name} (${dm}, ${dx}, ${dy}).`, 'gm');
  }
  this.aplicarEstructura(p.map, x, y, id, true);
  this.estr[`${p.map},${x},${y}`] = id;
  this.guardarEstructuras();
  this.gmLog(`${p.name}: [panel] puso ${od.name} (${id}) en (${p.map}, ${x}, ${y})`);
  return this.msg(p, `Pusiste ${od.name} en (${p.map}, ${x}, ${y}).`, 'gm');
};

// ---------- /ELIMINARESTRUCTURA ----------
E.eliminarEstructura = function (p) {
  if (p.gm < RANGO) return this.msg(p, 'Comando inexistente. Escribí /AYUDA.', 'warn');
  const c = p.lastClick;
  if (!c || !p.lastClickAt || c.map !== p.map) return this.msg(p, 'Primero hacé clic en la estructura que querés eliminar.', 'warn');
  if (Date.now() - p.lastClickAt > SEGUNDOS_ELIMINAR * 1000) {
    return this.msg(p, `Pasaron más de ${SEGUNDOS_ELIMINAR} segundos desde el clic. Volvé a hacer clic en la estructura.`, 'warn');
  }
  const mp = this.maps[p.map];
  const k = idx(c.x, c.y);
  const o = mp.objs.get(k);
  const od = o && this.data.objs[o.id];
  if (!od || !this.esEstructura(od)) return this.msg(p, 'Ahí no hay una estructura. (Para objetos tirados usá /DESTRUIR)', 'warn');
  // Teleports: se borran también de los portales guardados para que dejen de funcionar
  if (od.type === OBJ.TELEPORT) {
    const antes = this.tpGm.length;
    this.tpGm = this.tpGm.filter((t) => !(t.mapa === p.map && t.x === c.x && t.y === c.y));
    if (this.tpGm.length !== antes) this.guardarTeleportsGm();
  }
  this.aplicarEstructura(p.map, c.x, c.y, 0, true);
  // Si era de los mapas originales o de teleports.json, el borrado se guarda; si la puso un Admin, se olvida
  const clave = `${p.map},${c.x},${c.y}`;
  const originalDelMapa = mp.d.objs.has(k) || (od.type === OBJ.TELEPORT && this.esTeleportFijo(p.map, c.x, c.y));
  if (originalDelMapa) this.estr[clave] = 0; else delete this.estr[clave];
  this.guardarEstructuras();
  p.lastClickAt = 0;
  this.gmLog(`${p.name}: /ELIMINARESTRUCTURA ${od.name} (${o.id}) en (${clave})`);
  return this.msg(p, `Eliminaste ${od.name} de (${clave}).`, 'gm');
};

E.esTeleportFijo = function (m, x, y) {
  try {
    const fijos = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data', 'teleports.json'), 'utf8')).teleports || [];
    return fijos.some((t) => t.mapa === m && t.x === x && t.y === y);
  } catch (e) { return false; }
};

module.exports = E;
