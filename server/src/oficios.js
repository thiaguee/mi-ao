'use strict';
// Oficios del AO: talar, minar, pescar (con la herramienta equipada y clic en el árbol, yacimiento o agua),
// fundir minerales en una fragua, y fabricar con el martillo al lado de un yunque (herrería) o con el serrucho (carpintería).
const path = require('path');
const G = require('./gamedata');
const { readIni, num } = require('./ini');
const { idx, SK, OBJ } = G;

const O = {};
const HERR = {
  127: 'talar', 561: 'talar',           // Hacha de Talador (y la newbie)
  187: 'minar', 562: 'minar',           // Piquete de Minero
  138: 'pescar', 563: 'pescar', 543: 'red', // Equipo de Pescar / Red de Pesca
  389: 'herreria', 565: 'herreria',     // Martillo de Herrero
  198: 'carpinteria', 564: 'carpinteria', // Serrucho
};
const MADERA = 58, PESCADO = 139;
const PESCA_RED = [139, 544, 546, 545]; // con red: pescado, trucha, merluza y a veces pez espada
const CADA_MS = 1500;     // un intento de trabajo cada 1,5 segundos
const ENERGIA = 2;        // energía que gasta cada intento
const MINERALES_POR_LINGOTE = 5;
// clases que trabajan mejor (el doble): Trabajador, Minero, Herrero, Leñador, Carpintero, Pescador y sus expertos
const OFICIO_CLASE = { talar: [2, 13, 14], minar: [2, 3, 4], pescar: [2, 23], red: [2, 23], herreria: [2, 3, 8], carpinteria: [2, 13, 18] };

O.cargarOficios = function () {
  const lista = (archivo) => {
    try {
      const ini = readIni(path.join(__dirname, '..', 'data', 'dat', archivo));
      return Object.values(ini).map((v) => num(v.INDEX)).filter((id) => id && this.data.objs[id]);
    } catch (e) { return []; }
  };
  this.recetas = {
    herreria: [...new Set([...lista('armasherrero.dat'), ...lista('armadurasherrero.dat')])],
    carpinteria: [...new Set(lista('objcarpintero.dat'))],
  };
  console.log(`Oficios: ${this.recetas.herreria.length} recetas de herrería, ${this.recetas.carpinteria.length} de carpintería`);
  setInterval(() => this.trabajoTick(), 250);
};

O.herramientaDe = function (p) {
  const i = p.eq.weapon;
  if (i < 0 || !p.inv[i]) return null;
  return HERR[p.inv[i].id] || null;
};
O.esHerramienta = (id) => !!HERR[id];

const cerca = (p, x, y, d) => Math.abs(p.x - x) <= d && Math.abs(p.y - y) <= d;
O.objCerca = function (p, tipo, d) {
  const mp = this.maps[p.map];
  for (let y = p.y - d; y <= p.y + d; y++) {
    for (let x = p.x - d; x <= p.x + d; x++) {
      if (!this.inMap(x, y)) continue;
      const o = mp.objs.get(idx(x, y));
      if (o && this.data.objs[o.id] && this.data.objs[o.id].type === tipo) return { x, y, o };
    }
  }
  return null;
};

// usar la herramienta equipada: las de juntar piden un clic; martillo y serrucho abren la ventana de fabricar
O.usarHerramienta = function (p) {
  const h = this.herramientaDe(p);
  if (!h) return false;
  if (h === 'herreria') {
    if (!this.objCerca(p, OBJ.YUNQUE, 2)) { this.msg(p, 'Tenés que estar al lado de un yunque para trabajar de herrero.', 'warn'); return true; }
    this.enviarRecetas(p, 'herreria'); return true;
  }
  if (h === 'carpinteria') { this.enviarRecetas(p, 'carpinteria'); return true; }
  const que = { talar: 'el árbol', minar: 'el yacimiento', pescar: 'el agua', red: 'el agua' }[h];
  this.send(p, { t: 'trabajoApuntar', texto: `Hacé clic en ${que} para empezar a trabajar.` });
  return true;
};

// clic con la herramienta: empieza a trabajar (sigue solo hasta que te muevas)
O.empezarTrabajo = function (p, x, y) {
  const h = this.herramientaDe(p);
  if (!h || !this.inMap(x, y) || p.dead) return;
  const mp = this.maps[p.map];
  const o = mp.objs.get(idx(x, y));
  const od = o && this.data.objs[o.id];
  if (h === 'talar' && !(od && od.type === OBJ.ARBOL)) return this.msg(p, 'Ahí no hay un árbol.', 'warn');
  if (h === 'minar' && !(od && od.type === OBJ.YACIMIENTO)) return this.msg(p, 'Ahí no hay un yacimiento.', 'warn');
  if ((h === 'pescar' || h === 'red') && !mp.d.water[idx(x, y)]) return this.msg(p, 'Tenés que pescar en el agua.', 'warn');
  const dist = h === 'pescar' || h === 'red' ? 4 : 2;
  if (!cerca(p, x, y, dist)) return this.msg(p, 'Estás muy lejos.', 'warn');
  p.trabajo = { h, x, y, map: p.map, px: p.x, py: p.y, prox: Date.now() + 500, obj: o && o.id };
  this.msg(p, { talar: 'Empezás a talar...', minar: 'Empezás a picar la roca...', pescar: 'Tirás la línea al agua...', red: 'Tirás la red...' }[h] + ' (movete para dejar de trabajar)', 'info');
};

O.pararTrabajo = function (p, motivo) {
  if (!p.trabajo) return;
  p.trabajo = null;
  if (motivo) this.msg(p, motivo, 'info');
};

O.trabajoTick = function () {
  const ahora = Date.now();
  for (const p of this.players.values()) {
    const t = p.trabajo;
    if (!t || ahora < t.prox) continue;
    t.prox = ahora + CADA_MS;
    if (p.dead || p.map !== t.map || p.x !== t.px || p.y !== t.py || this.herramientaDe(p) !== t.h) { this.pararTrabajo(p, 'Dejaste de trabajar.'); continue; }
    if (p.stats.sta < ENERGIA) { this.pararTrabajo(p, 'Estás muy cansado para seguir trabajando.'); continue; }
    p.stats.sta -= ENERGIA; this.sendStat(p, ['sta']);
    const skNom = { talar: 'Talar', minar: 'Minería', pescar: 'Pesca', red: 'Pesca' }[t.h];
    const sk = p.skills[SK[skNom]] || 0;
    let item = 0;
    if (t.h === 'talar') item = MADERA;
    if (t.h === 'pescar') item = PESCADO;
    if (t.h === 'red') item = sk >= 70 && Math.random() < 0.08 ? PESCA_RED[3] : PESCA_RED[Math.floor(Math.random() * 3)];
    if (t.h === 'minar') {
      const yac = this.data.objs[t.obj]; item = yac && yac.mineral;
      const min = this.data.objs[item];
      if (min && sk < min.minSkill * 0.5) { this.pararTrabajo(p, `Necesitás más skill de Minería para este yacimiento (${Math.ceil(min.minSkill * 0.5)}).`); continue; }
    }
    if (!item) { this.pararTrabajo(p); continue; }
    this.toMap(p.map, { t: 'snd', w: t.h === 'talar' ? 13 : t.h === 'minar' ? 15 : 14 });
    this.trainSkill(p, SK[skNom]);
    if (Math.random() * 100 > 20 + sk * 0.7) continue; // falló esta vez
    let cant = 1 + (sk >= 50 ? 1 : 0) + (sk >= 90 ? 1 : 0);
    if ((OFICIO_CLASE[t.h] || []).includes(p.clase)) cant *= 2;
    const got = this.giveItem(p, item, cant);
    if (got <= 0) { this.pararTrabajo(p, 'No tenés lugar en el inventario.'); continue; }
    this.msg(p, `¡Conseguiste ${got} ${this.data.objs[item].name}!`, 'info');
    if (this.sumarXpPase) this.sumarXpPase(p, 2);
  }
};

// ---------- fundir: usar los minerales al lado de una fragua ----------
O.fundir = function (p, i) {
  const it = p.inv[i]; const min = it && this.data.objs[it.id];
  if (!min || min.type !== OBJ.MINERAL || !min.lingote) return false;
  if (!this.objCerca(p, OBJ.FRAGUA, 2)) { this.msg(p, 'Tenés que estar al lado de una fragua para fundir.', 'warn'); return true; }
  const sk = p.skills[SK['Minería']] || 0;
  if (sk < min.minSkill * 0.5) { this.msg(p, `Necesitás ${Math.ceil(min.minSkill * 0.5)} de Minería para fundir ${min.name}.`, 'warn'); return true; }
  const lingotes = Math.floor(this.countItem(p, it.id) / MINERALES_POR_LINGOTE);
  if (lingotes < 1) { this.msg(p, `Necesitás ${MINERALES_POR_LINGOTE} ${min.name} para hacer un lingote.`, 'warn'); return true; }
  const hacer = Math.min(lingotes, 50);
  this.takeItem(p, it.id, hacer * MINERALES_POR_LINGOTE);
  const got = this.giveItem(p, min.lingote, hacer);
  if (got < hacer) this.dropObj(p.map, p.x, p.y, min.lingote, hacer - got);
  this.trainSkill(p, SK['Minería']);
  this.toMap(p.map, { t: 'snd', w: 41 });
  this.msg(p, `Fundiste ${hacer * MINERALES_POR_LINGOTE} ${min.name} y obtuviste ${hacer} ${this.data.objs[min.lingote].name}.`, 'info');
  return true;
};

// ---------- fabricar ----------
const LING = { h: 386, p: 387, o: 388 };
O.costoReceta = function (oficio, o) {
  return oficio === 'herreria'
    ? { h: o.lingH, p: o.lingP, o: o.lingO, sk: o.skHerreria }
    : { m: o.madera, sk: o.skCarpinteria };
};
O.enviarRecetas = function (p, oficio) {
  const sk = p.skills[SK[oficio === 'herreria' ? 'Herrería' : 'Carpintería']] || 0;
  const items = (this.recetas[oficio] || []).map((id) => {
    const o = this.data.objs[id];
    return { id, n: o.name, g: o.grh, c: this.costoReceta(oficio, o) };
  }).sort((a, b) => a.c.sk - b.c.sk);
  this.send(p, { t: 'recetas', oficio, sk, items,
    tengo: { h: this.countItem(p, LING.h), p: this.countItem(p, LING.p), o: this.countItem(p, LING.o), m: this.countItem(p, MADERA) } });
};
O.fabricar = function (p, oficio, id, cant) {
  if (!(this.recetas[oficio] || []).includes(id)) return;
  if (this.herramientaDe(p) !== oficio) return this.msg(p, oficio === 'herreria' ? 'Equipate el martillo de herrero.' : 'Equipate el serrucho.', 'warn');
  if (oficio === 'herreria' && !this.objCerca(p, OBJ.YUNQUE, 2)) return this.msg(p, 'Tenés que estar al lado de un yunque.', 'warn');
  const o = this.data.objs[id]; const c = this.costoReceta(oficio, o);
  const skNom = oficio === 'herreria' ? 'Herrería' : 'Carpintería';
  const sk = p.skills[SK[skNom]] || 0;
  if (sk < c.sk) return this.msg(p, `Necesitás ${c.sk} de ${skNom} para fabricar ${o.name} (tenés ${sk}).`, 'warn');
  cant = Math.max(1, Math.min(100, Math.floor(+cant) || 1));
  const alcanza = (k, item) => (c[k] ? Math.floor(this.countItem(p, item) / c[k]) : Infinity);
  const max = oficio === 'herreria' ? Math.min(alcanza('h', LING.h), alcanza('p', LING.p), alcanza('o', LING.o)) : alcanza('m', MADERA);
  if (max < 1) return this.msg(p, `No te alcanzan los materiales para ${o.name}.`, 'warn');
  cant = Math.min(cant, max);
  if (oficio === 'herreria') { for (const k of ['h', 'p', 'o']) if (c[k]) this.takeItem(p, LING[k], c[k] * cant); } else this.takeItem(p, MADERA, c.m * cant);
  const got = this.giveItem(p, id, cant);
  if (got < cant) this.dropObj(p.map, p.x, p.y, id, cant - got);
  for (let i = 0; i < Math.min(cant, 5); i++) this.trainSkill(p, SK[skNom]);
  this.toMap(p.map, { t: 'snd', w: oficio === 'herreria' ? 41 : 42 });
  this.msg(p, `¡Fabricaste ${cant} ${o.name}!`, 'info');
  if (this.sumarXpPase) this.sumarXpPase(p, 5 * cant);
  this.enviarRecetas(p, oficio);
};

module.exports = O;
