// Lectura de los archivos de mapa (.map) del AO.
const XY = 100;
const cache = new Map();

export const idx = (x, y) => (y - 1) * XY + (x - 1);

export async function loadMap(n) {
  if (cache.has(n)) return cache.get(n);
  const buf = await fetch(`assets/mapas/mapa${n}.map`).then((r) => {
    if (!r.ok) throw new Error('No se encontró el mapa ' + n);
    return r.arrayBuffer();
  });
  const dv = new DataView(buf);
  const map = {
    n,
    l1: new Int32Array(XY * XY), l2: new Int32Array(XY * XY), l3: new Int32Array(XY * XY), l4: new Int32Array(XY * XY),
    blocked: new Uint8Array(XY * XY), trigger: new Uint8Array(XY * XY),
  };
  let i = 2 + 263 + 8;
  for (let y = 1; y <= XY; y++) {
    for (let x = 1; x <= XY; x++) {
      const k = idx(x, y);
      const f = dv.getUint8(i++);
      map.blocked[k] = f & 1;
      map.l1[k] = dv.getInt32(i, true); i += 4;
      if (f & 2) { map.l2[k] = dv.getInt32(i, true); i += 4; }
      if (f & 4) { map.l3[k] = dv.getInt32(i, true); i += 4; }
      if (f & 8) { map.l4[k] = dv.getInt32(i, true); i += 4; }
      if (f & 16) { map.trigger[k] = dv.getInt16(i, true); i += 2; }
    }
  }
  cache.set(n, map);
  if (cache.size > 12) cache.delete(cache.keys().next().value);
  return map;
}
