// Carga de gráficos e índices (Grh, cuerpos, cabezas, armas, escudos, cascos, efectos).
export const A = {
  grh: null, // número -> [archivo, x, y, ancho, alto] o {f:[frames], s:velocidad}
  bodies: [], heads: [], helmets: [], weapons: [], shields: [], fxs: [],
  images: new Map(), // archivo -> HTMLImageElement
  failed: new Set(), // archivos que no existen
  listas: 0, // cuántas imágenes terminaron de cargar (para saber cuándo redibujar)
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

let SNAP = 1;
export function setSnap(z) { SNAP = z || 1; }
export function getSnap() { return SNAP; }

export function image(file) {
  let img = A.images.get(file);
  if (img) return img._ok ? img : null;
  img = new Image();
  img.decoding = 'async';
  img.onerror = () => A.failed.add(file);
  // Se decodifica en segundo plano antes de usarla: así dibujar una imagen nueva no frena el juego
  img.onload = () => { (img.decode ? img.decode() : Promise.resolve()).catch(() => {}).then(() => { img._ok = true; A.listas++; }); };
  img.addEventListener('error', () => { A.listas++; });
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
  // en la pantalla del juego se ajusta a los píxeles reales; en dibujos aparte (piso, vistas previas) a píxeles enteros
  const k = ctx.canvas && ctx.canvas.id === 'view' ? SNAP : 1;
  ctx.drawImage(img, sx, sy, w, h, Math.round(x * k) / k, Math.round(y * k) / k, w, h);
  return true;
}

// Archivos de imagen que usa un Grh (todos los frames si es animado)
export function archivosDe(grhIndex, out) {
  const g = A.grh[grhIndex];
  if (!g) return;
  if (Array.isArray(g)) { out.add(g[0]); return; }
  for (const f of g.f) { const fg = A.grh[f]; if (Array.isArray(fg)) out.add(fg[0]); }
}

// Empieza a cargar (de a poco, sin trabar) una lista de imágenes
const colaPrecarga = [];
export function precargar(archivos) {
  for (const f of archivos) if (!A.images.has(f)) colaPrecarga.push(f);
}
setInterval(() => {
  // unas pocas por vez: se decodifican en segundo plano
  for (let i = 0; i < 12 && colaPrecarga.length; i++) image(colaPrecarga.shift());
}, 30);

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
