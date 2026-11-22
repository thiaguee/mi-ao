'use strict';
// Mercado entre jugadores: se publica un objeto con su precio en el Mercader del Pueblo (Ullathorpe)
// y cualquiera lo compra aunque el vendedor no esté conectado. El vendedor cobra al instante o al entrar.
const fs = require('fs');
const path = require('path');

const K = {};
const COMISION = 0.05;      // el mercado se queda con el 5%
const MAX_PUBLICACIONES = 10;
const PRECIO_MAX = 2000000000;

K.cargarMercado = function () {
  this.mercadoPath = path.join(this.dataDir, 'mercado.json');
  this.mercado = { sig: 1, publicaciones: [], cobros: {} };
  try { if (fs.existsSync(this.mercadoPath)) Object.assign(this.mercado, JSON.parse(fs.readFileSync(this.mercadoPath, 'utf8'))); } catch (e) { console.error('Error leyendo mercado.json:', e.message); }
  console.log(`Mercado: ${this.mercado.publicaciones.length} publicaciones`);
};
K.guardarMercado = function () {
  try { fs.writeFileSync(this.mercadoPath, JSON.stringify(this.mercado)); } catch (e) { console.error('No se pudo guardar mercado.json:', e.message); }
};

K.cercaDelMercado = function (p) {
  for (const id of this.maps[p.map].chars) {
    const n = this.npcs.get(id);
    if (n && n.def.mercado && Math.abs(n.x - p.x) <= 5 && Math.abs(n.y - p.y) <= 5) return true;
  }
  return false;
};

K.abrirMercado = function (p) { this.enviarMercado(p); };

K.enviarMercado = function (p) {
  const yo = p.name.toLowerCase();
  const pub = this.mercado.publicaciones.map((x) => {
    const o = this.data.objs[x.obj] || {};
    return { id: x.id, obj: x.obj, n: o.name || '?', g: o.grh || 0, ty: o.type, a: x.a, precio: x.precio, v: x.vendedor, mia: x.vendedor.toLowerCase() === yo ? 1 : 0,
      mh: o.minHit, xh: o.maxHit, md: o.minDef, xd: o.maxDef };
  });
  this.send(p, { t: 'mercado', pub, oro: p.stats.gld, comision: COMISION, max: MAX_PUBLICACIONES });
};

// msg: { a: 'publicar', slot, cant, precio } | { a: 'comprar', id } | { a: 'retirar', id }
K.accionMercado = function (p, m) {
  if (p.dead) return this.msg(p, 'Estás muerto.', 'warn');
  if (!this.cercaDelMercado(p)) return this.msg(p, 'Tenés que estar al lado del Mercader del Pueblo (Ullathorpe).', 'warn');
  const yo = p.name.toLowerCase();
  if (m.a === 'publicar') {
    const slot = Math.floor(+m.slot), it = p.inv[slot];
    if (!it) return;
    const o = this.data.objs[it.id];
    if (!o) return;
    if (o.newbie) return this.msg(p, 'Los objetos newbie no se pueden vender.', 'warn');
    if (it.nc) return this.msg(p, 'Ese objeto es un premio y no se puede vender.', 'warn');
    if (Object.values(p.eq).includes(slot)) return this.msg(p, 'Primero desequipalo.', 'warn');
    const cant = Math.max(1, Math.min(it.amount, Math.floor(+m.cant) || 1));
    const precio = Math.floor(+m.precio);
    if (!(precio >= 1 && precio <= PRECIO_MAX)) return this.msg(p, 'Poné un precio válido.', 'warn');
    if (this.mercado.publicaciones.filter((x) => x.vendedor.toLowerCase() === yo).length >= MAX_PUBLICACIONES) return this.msg(p, `Podés tener hasta ${MAX_PUBLICACIONES} publicaciones.`, 'warn');
    this.removeFromSlot(p, slot, cant);
    this.mercado.publicaciones.push({ id: this.mercado.sig++, vendedor: p.name, obj: it.id, a: cant, precio, fecha: Date.now() });
    this.guardarMercado(); this.savePlayer(p);
    this.msg(p, `Publicaste ${cant} ${o.name} a ${precio.toLocaleString('es-AR')} de oro.`, 'server');
    if (this.log) this.log(`Mercado: ${p.name} publicó ${cant} ${o.name} (${it.id}) a ${precio}`);
    return this.enviarMercado(p);
  }
  const i = this.mercado.publicaciones.findIndex((x) => x.id === +m.id);
  if (i < 0) { this.msg(p, 'Esa publicación ya no está.', 'warn'); return this.enviarMercado(p); }
  const x = this.mercado.publicaciones[i];
  const o = this.data.objs[x.obj] || { name: '?' };
  if (m.a === 'retirar') {
    if (x.vendedor.toLowerCase() !== yo && p.gm < 3) return;
    const got = this.giveItem(p, x.obj, x.a);
    if (got < x.a) { x.a -= got; this.guardarMercado(); this.msg(p, 'No te entra todo en el inventario: quedó el resto publicado.', 'warn'); return this.enviarMercado(p); }
    this.mercado.publicaciones.splice(i, 1);
    this.guardarMercado(); this.savePlayer(p);
    this.msg(p, `Retiraste ${x.a} ${o.name} del mercado.`, 'info');
    return this.enviarMercado(p);
  }
  if (m.a === 'comprar') {
    if (x.vendedor.toLowerCase() === yo) return this.msg(p, 'Es tu propia publicación (podés retirarla).', 'warn');
    if (p.stats.gld < x.precio) return this.msg(p, 'No tenés suficiente oro.', 'warn');
    if (p.inv.every((s) => s && s.id !== x.obj)) return this.msg(p, 'No tenés lugar en el inventario.', 'warn');
    const got = this.giveItem(p, x.obj, x.a);
    if (got < x.a) { // no entró todo: se devuelve lo que entró y no se compra
      if (got > 0) this.quitarItem(p, x.obj, got);
      return this.msg(p, 'No tenés lugar suficiente en el inventario.', 'warn');
    }
    p.stats.gld -= x.precio; this.sendStat(p, ['gld']);
    this.mercado.publicaciones.splice(i, 1);
    const cobra = Math.floor(x.precio * (1 - COMISION));
    const v = this.findPlayer(x.vendedor);
    if (v) { this.sumarXpPase(v, this.cfgPase.xp.venta); this.retoPase(v, 'ventas'); v.stats.gld += cobra; this.sendStat(v, ['gld']); this.msg(v, `💰 ${p.name} te compró ${x.a} ${o.name}: cobraste ${cobra.toLocaleString('es-AR')} de oro.`, 'server'); this.savePlayer(v); }
    else { const k = x.vendedor.toLowerCase(); this.mercado.cobros[k] = (this.mercado.cobros[k] || 0) + cobra; }
    this.guardarMercado(); this.savePlayer(p);
    this.msg(p, `Compraste ${x.a} ${o.name} por ${x.precio.toLocaleString('es-AR')} de oro.`, 'server');
    if (this.log) this.log(`Mercado: ${p.name} compró ${x.a} ${o.name} a ${x.vendedor} por ${x.precio}`);
    return this.enviarMercado(p);
  }
};

// al entrar: cobra lo que vendió mientras no estaba
K.cobrarMercado = function (p) {
  const k = p.name.toLowerCase(), oro = this.mercado && this.mercado.cobros[k];
  if (!oro) return;
  delete this.mercado.cobros[k];
  p.stats.gld += oro; this.sendStat(p, ['gld']);
  this.guardarMercado(); this.savePlayer(p);
  this.msg(p, `💰 Mientras no estabas vendiste cosas en el mercado: cobraste ${oro.toLocaleString('es-AR')} de oro.`, 'server');
};

module.exports = K;
