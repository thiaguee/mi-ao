'use strict';
// Puntos de torneo y tienda de Torneo.
//
// - Los puntos (p.puntosTorneo) se ganan en la guerra automática y en los torneos/eventos:
//   los Admin los dan o quitan con /PUNTOSTORNEO nombre cantidad.
// - La tienda (botón MENÚ > Puntos > Torneo) vende objetos a cambio de puntos.
//   Lista inicial: server/data/tienda-torneo.json. Los Admin la cambian en el juego con
//   /TIENDATORNEO agregar numero precio, /TIENDATORNEO quitar numero, /TIENDATORNEO (ver).
//   Los cambios hechos en el juego se guardan en la carpeta de datos del servidor.
// - Los objetos de la tienda no se caen al morir, no se pueden tirar ni vender (sí guardar en la bóveda),
//   vengan de donde vengan.
const fs = require('fs');
const path = require('path');
const accounts = require('./accounts');

const T = {};
const RANGO = 4; // sólo Admin
const TIENDA_FIJA = path.join(__dirname, '..', 'data', 'tienda-torneo.json');

T.cargarTiendaTorneo = function () {
  this.tiendaTorneoPath = path.join(this.dataDir, 'tienda-torneo.json');
  const leer = (p) => { try { return fs.existsSync(p) ? JSON.parse(fs.readFileSync(p, 'utf8')).items : null; } catch (e) { console.error('Error leyendo', p, e.message); return null; } };
  this.tiendaTorneo = (leer(this.tiendaTorneoPath) || leer(TIENDA_FIJA) || [])
    .map((it) => Object.assign(it, { obj: require('./gamedata').nuevoId(it.obj) })) // números viejos -> 2000+
    .filter((it) => this.data.objs[it.obj] && it.precio > 0);
  console.log(`Tienda de torneo: ${this.tiendaTorneo.length} objetos`);
};

T.guardarTiendaTorneo = function () {
  fs.writeFileSync(this.tiendaTorneoPath, JSON.stringify({
    _ayuda: 'Tienda de Torneo: obj = número de objeto, precio = puntos de torneo. Se cambia con /TIENDATORNEO en el juego.',
    items: this.tiendaTorneo.map((it) => ({ obj: it.obj, precio: it.precio, _nombre: this.data.objs[it.obj].name })),
  }, null, 2));
};

// ¿Es un objeto de la tienda de torneo? (no se cae, no se tira, no se vende)
T.esDeTorneo = function (id) {
  return !!this.tiendaTorneo && this.tiendaTorneo.some((it) => it.obj === id);
};

// ---------- ventana de la tienda ----------
T.enviarTiendaTorneo = function (p) {
  const items = this.tiendaTorneo.map((it) => {
    const o = this.data.objs[it.obj];
    return { i: it.obj, n: o.name, g: o.grh, precio: it.precio, puede: this.canUseObj(Object.assign({}, p, { gm: 0 }), o) === true ? 1 : 0 };
  });
  this.send(p, { t: 'tiendaTorneo', puntos: p.puntosTorneo || 0, items });
};

T.accionTorneo = function (p, msg) {
  if (msg.a === 'ver') return this.enviarTiendaTorneo(p);
  if (msg.a !== 'comprar' || p.dead) return;
  const it = this.tiendaTorneo.find((x) => x.obj === Math.floor(+msg.id));
  if (!it) return this.msg(p, 'Ese objeto ya no está en la tienda.', 'warn');
  const o = this.data.objs[it.obj];
  const puntos = p.puntosTorneo || 0;
  if (puntos < it.precio) return this.msg(p, `Te faltan puntos de torneo: cuesta ${it.precio} y tenés ${puntos}.`, 'warn');
  if (this.giveItem(p, it.obj, 1) < 1) return this.msg(p, 'No tenés lugar en el inventario.', 'warn');
  p.puntosTorneo = puntos - it.precio;
  this.savePlayer(p);
  this.log(`${p.name} compró ${o.name} (${it.obj}) por ${it.precio} puntos de torneo`);
  this.msg(p, `Compraste ${o.name} por ${it.precio} puntos de torneo. Te quedan ${p.puntosTorneo}.`, 'server');
  this.enviarTiendaTorneo(p);
};

// ---------- comandos de Admin ----------
// /PUNTOSTORNEO nombre cantidad (negativo para quitar). Funciona aunque el personaje no esté conectado.
T.comandoPuntosTorneo = function (p, args) {
  if (p.gm < RANGO) return this.msg(p, 'Comando inexistente. Escribí /AYUDA.', 'warn');
  const nombre = args[0], cant = Math.trunc(+args[1]);
  if (!nombre || !cant) return this.msg(p, 'Uso: /PUNTOSTORNEO nombre cantidad (con número negativo los quita).', 'warn');
  const t = this.findPlayer(nombre);
  let total, quien;
  if (t) {
    t.puntosTorneo = Math.max(0, (t.puntosTorneo || 0) + cant);
    total = t.puntosTorneo; quien = t.name;
    this.savePlayer(t);
    this.msg(t, cant > 0 ? `¡Ganaste ${cant} puntos de torneo! Tenés ${total}.` : `Se te quitaron ${-cant} puntos de torneo. Tenés ${total}.`, 'server');
  } else {
    const rec = accounts.load(nombre);
    if (!rec) return this.msg(p, 'Ese personaje no existe.', 'warn');
    rec.puntosTorneo = Math.max(0, (rec.puntosTorneo || 0) + cant);
    total = rec.puntosTorneo; quien = rec.name;
    accounts.save(rec);
  }
  this.gmLog(`${p.name}: /PUNTOSTORNEO ${quien} ${cant} (queda en ${total})`);
  return this.msg(p, `${quien} ahora tiene ${total} puntos de torneo.`, 'gm');
};

// /TIENDATORNEO · /TIENDATORNEO agregar numero precio · /TIENDATORNEO quitar numero
T.comandoTiendaTorneo = function (p, args) {
  if (p.gm < RANGO) return this.msg(p, 'Comando inexistente. Escribí /AYUDA.', 'warn');
  const accion = String(args[0] || '').toLowerCase();
  const id = Math.floor(+args[1]);
  if (accion === 'agregar') {
    const precio = Math.floor(+args[2]);
    const o = this.data.objs[id];
    if (!o || !(precio > 0)) return this.msg(p, 'Uso: /TIENDATORNEO agregar numeroObjeto precio', 'warn');
    const ya = this.tiendaTorneo.find((x) => x.obj === id);
    if (ya) ya.precio = precio; else this.tiendaTorneo.push({ obj: id, precio });
    this.guardarTiendaTorneo();
    this.gmLog(`${p.name}: /TIENDATORNEO agregar ${id} ${precio}`);
    return this.msg(p, `${o.name} ${ya ? 'ahora cuesta' : 'se agregó a la tienda de torneo por'} ${precio} puntos.`, 'gm');
  }
  if (accion === 'quitar') {
    const antes = this.tiendaTorneo.length;
    this.tiendaTorneo = this.tiendaTorneo.filter((x) => x.obj !== id);
    if (this.tiendaTorneo.length === antes) return this.msg(p, 'Ese objeto no está en la tienda. Uso: /TIENDATORNEO quitar numeroObjeto', 'warn');
    this.guardarTiendaTorneo();
    this.gmLog(`${p.name}: /TIENDATORNEO quitar ${id}`);
    return this.msg(p, `Se quitó el objeto ${id} de la tienda de torneo.`, 'gm');
  }
  if (!this.tiendaTorneo.length) return this.msg(p, 'La tienda de torneo está vacía. Agregá con /TIENDATORNEO agregar numero precio', 'gm');
  this.msg(p, 'Tienda de torneo (agregar: /TIENDATORNEO agregar numero precio · quitar: /TIENDATORNEO quitar numero):', 'gm');
  for (const it of this.tiendaTorneo) this.msg(p, `${it.obj} - ${this.data.objs[it.obj].name}: ${it.precio} puntos`, 'gm');
};

module.exports = T;
