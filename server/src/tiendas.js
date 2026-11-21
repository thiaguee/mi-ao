'use strict';
// /TIENDAS (Admin): panel con todos los NPCs que venden cosas. Se puede agregar o sacar
// cualquier objeto de lo que vende cada uno. Los cambios se guardan en tiendas.json
// (carpeta de datos del servidor) y valen para todos los NPCs de ese tipo, en todas las ciudades.
const fs = require('fs');
const path = require('path');

const T = {};
const RANGO = 3; // Dios o Admin
const STOCK = 10000; // stock "infinito"

T.cargarTiendas = function () {
  this.tiendasPath = path.join(this.dataDir, 'tiendas.json');
  this.tiendasGm = {};
  try { if (fs.existsSync(this.tiendasPath)) this.tiendasGm = JSON.parse(fs.readFileSync(this.tiendasPath, 'utf8')); } catch (e) { console.error('Error leyendo tiendas.json:', e.message); }
  let n = 0;
  for (const [num, lista] of Object.entries(this.tiendasGm)) {
    const def = this.data.npcs[+num];
    if (!def || !def.comercia || !Array.isArray(lista)) continue;
    def.items = lista.filter((id) => this.data.objs[id]).map((id) => [id, STOCK]);
    n++;
  }
  if (n) console.log(`Tiendas modificadas por GMs: ${n}`);
};

T.guardarTiendas = function () {
  try { fs.writeFileSync(this.tiendasPath, JSON.stringify(this.tiendasGm, null, 1)); } catch (e) { console.error('No se pudo guardar tiendas.json:', e.message); }
};

// lista de vendedores (un tipo de NPC por fila) con las ciudades donde están
T.listaVendedores = function () {
  const donde = new Map(); // num -> Set de nombres de mapa
  for (const npc of this.npcs.values()) {
    if (!npc.def.comercia || npc.summoned) continue;
    if (!donde.has(npc.num)) donde.set(npc.num, new Set());
    const d = this.maps[npc.map] && this.maps[npc.map].d;
    donde.get(npc.num).add((d ? d.name : 'Mapa ' + npc.map).replace(/^Ciudad de /i, '').replace(/\.$/, ''));
  }
  return [...donde.entries()].map(([num, mapas]) => {
    const def = this.data.npcs[num];
    return { num, n: def.name, donde: [...mapas].slice(0, 4).join(', ') + (mapas.size > 4 ? '…' : ''), cant: def.items.length, mod: this.tiendasGm[num] ? 1 : 0 };
  }).sort((a, b) => a.n.localeCompare(b.n) || a.donde.localeCompare(b.donde));
};

T.itemsDeTienda = function (num) {
  const def = this.data.npcs[num];
  return def.items.map(([id]) => {
    const o = this.data.objs[id];
    return o ? { i: id, n: o.name, g: o.grh, v: o.value } : null;
  }).filter(Boolean);
};

T.abrirTiendas = function (p, num) {
  if (p.gm < RANGO) return this.msg(p, 'Comando inexistente. Escribí /AYUDA.', 'warn');
  if (!this.listaObjetosTienda) {
    this.listaObjetosTienda = this.data.objs.filter((o) => o && o.name && o.name !== 'No ves nada interesante.' && o.agarrable && !(this.esEstructura && this.esEstructura(o)))
      .map((o) => ({ i: o.id, n: o.name, g: o.grh, ty: o.type, v: o.value }));
  }
  const vendedores = this.listaVendedores();
  const sel = num && this.data.npcs[num] ? +num : (vendedores[0] && vendedores[0].num);
  this.send(p, { t: 'tiendas', vendedores, sel, items: sel ? this.itemsDeTienda(sel) : [], objetos: p.tiendasVistas ? null : this.listaObjetosTienda });
  p.tiendasVistas = true;
};

// msg: { a: 'ver' | 'agregar' | 'quitar' | 'original', num, id }
T.accionTienda = function (p, m) {
  if (p.gm < RANGO) return;
  const num = +m.num;
  const def = this.data.npcs[num];
  if (!def || !def.comercia) return;
  if (m.a === 'ver') return this.send(p, { t: 'tiendaItems', num, items: this.itemsDeTienda(num) });
  let ids = def.items.map(([id]) => id);
  const id = +m.id;
  if (m.a === 'agregar') {
    if (!this.data.objs[id]) return;
    if (ids.includes(id)) return this.msg(p, 'Ese NPC ya vende ese objeto.', 'warn');
    ids.push(id);
  } else if (m.a === 'quitar') {
    ids = ids.filter((x) => x !== id);
  } else if (m.a === 'subir' || m.a === 'bajar') {
    const i = ids.indexOf(id), j = i + (m.a === 'subir' ? -1 : 1);
    if (i < 0 || j < 0 || j >= ids.length) return;
    [ids[i], ids[j]] = [ids[j], ids[i]];
  } else return;
  def.items = ids.map((x) => [x, STOCK]);
  this.tiendasGm[num] = ids;
  this.guardarTiendas();
  // actualizar los NPCs que ya están en el mundo (se mantiene lo que les vendieron los usuarios)
  for (const npc of this.npcs.values()) {
    if (npc.num !== num || !npc.stock) continue;
    const vendidos = npc.stock.filter((s) => s.amount < STOCK && !ids.includes(s.id));
    npc.stock = ids.map((x) => ({ id: x, amount: STOCK })).concat(vendidos);
  }
  if (this.gmLog) this.gmLog(`${p.name} /TIENDAS ${m.a} objeto ${id} en NPC ${num} (${def.name})`);
  this.send(p, { t: 'tiendaItems', num, items: this.itemsDeTienda(num), vendedores: this.listaVendedores() });
};

module.exports = T;
