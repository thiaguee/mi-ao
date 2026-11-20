// Carga de gráficos e índices (Grh, cuerpos, cabezas, armas, escudos, cascos, efectos).
export const A = {
  grh: null, // número -> [archivo, x, y, ancho, alto] o {f:[frames], s:velocidad}
  bodies: [], heads: [], helmets: [], weapons: [], shields: [], fxs: [],
  images: new Map(), // archivo -> HTMLImageElement
  failed: new Set(), // archivos que no existen
  pending: 0,
};

export async function loadIndexes() {
  const [grh, chars] = await Promise.all([
    fetch('assets/data/grh.json').then((r) => r.json()),
    fetch('assets/data/chars.json').then((r) => r.json()),
  ]);
  A.grh = grh;
  Object.assign(A, chars);
}

export function image(file) {
  let img = A.images.get(file);
  if (img) return img.complete && img.naturalWidth ? img : null;
  img = new Image();
  img.decoding = 'async';
  img.onerror = () => A.failed.add(file);
  img.src = `assets/g/${file}.png`;
  A.images.set(file, img);
  return null;
}

// Devuelve el Grh estático para un frame de una animación
export function frameOf(grhIndex, time) {
  const g = A.grh[grhIndex];
  if (!g) return null;
  if (Array.isArray(g)) return g;
  const n = g.f.length;
  if (!n) return null;
  const frameDur = (g.s || 100) / n;
  const f = Math.floor(time / frameDur) % n;
  const fg = A.grh[g.f[f]];
  return Array.isArray(fg) ? fg : null;
}

export function numFrames(grhIndex) {
  const g = A.grh[grhIndex];
  if (!g) return 0;
  return Array.isArray(g) ? 1 : g.f.length;
}

export function animDuration(grhIndex) {
  const g = A.grh[grhIndex];
  if (!g || Array.isArray(g)) return 0;
  return g.s || 100;
}

// Dibuja un Grh. center = centrado al estilo AO (horizontalmente y apoyado abajo).
// Devuelve false sólo si la imagen todavía se está descargando.
export function drawGrh(ctx, grhIndex, x, y, center, time = 0) {
  if (!grhIndex) return true;
  const fr = frameOf(grhIndex, time);
  if (!fr) return true;
  const [file, sx, sy, w, h] = fr;
  const img = image(file);
  if (!img) return A.failed.has(file);
  if (center) {
    if (w !== 32) x -= Math.floor((w - 32) / 2);
    if (h !== 32) y -= h - 32;
  }
  ctx.drawImage(img, sx, sy, w, h, Math.round(x), Math.round(y), w, h);
  return true;
}

// Número de frame actual de una animación (para saber cuándo cambia)
export function frameIndex(grhIndex, time) {
  const g = A.grh[grhIndex];
  if (!g || Array.isArray(g) || !g.f.length) return 0;
  return Math.floor(time / ((g.s || 100) / g.f.length)) % g.f.length;
}

// Dibuja el primer frame de un Grh ajustado a un recuadro (para íconos)
export function drawIcon(ctx, grhIndex, size = 32) {
  ctx.clearRect(0, 0, size, size);
  const fr = frameOf(grhIndex, 0);
  if (!fr) return false;
  const [file, sx, sy, w, h] = fr;
  const img = image(file);
  if (!img) return false;
  const s = Math.min(1, size / Math.max(w, h));
  const dw = w * s, dh = h * s;
  ctx.drawImage(img, sx, sy, w, h, (size - dw) / 2, (size - dh) / 2, dw, dh);
  return true;
}
