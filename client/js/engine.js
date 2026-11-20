// Motor gráfico: dibuja el mapa, objetos, personajes, efectos, nombres y diálogos.
import { A, drawGrh, frameOf, animDuration, numFrames, frameIndex, setSnap } from './assets.js';
import { idx } from './mapdata.js';

export const TILE = 32;
export const WALK_MS = 200;
// Velocidad de la animación de las piernas: igual que el AO original (Movement_Speed = 0.5)
const WALK_ANIM = 0.5;
const ROOF_TRIGGERS = new Set([1, 2, 4]);
const NAME_COLORS = { ciu: '#4a8cff', cri: '#ff3b3b', gm: '#ff8c1a', npc: '#d8d8d8', npc_h: '#ffb0b0' };
const SAY_COLORS = { talk: '#ffffff', gm: '#ff9f40', npc: '#ffffff', spell: '#ff9b3b', dead: '#9bd0ff' };

export const E = {
  canvas: null, ctx: null,
  map: null, mapNum: 0, blocked: null,
  objs: new Map(), // idx -> grh
  chars: new Map(),
  me: 0,
  camX: 0, camY: 0, // en píxeles, esquina superior izquierda
  viewW: 0, viewH: 0,
  dmg: [], // números de daño flotantes
  shots: [],
  rain: false, rainDrops: [],
  mouseTile: null,
  showNames: true,
  lastFrame: 0, fps: 0, frames: 0, fpsTime: 0,
};

export function init(canvas) {
  E.canvas = canvas;
  E.ctx = canvas.getContext('2d');
  resize();
  window.addEventListener('resize', resize);
}

export function resize() {
  const r = E.canvas.parentElement.getBoundingClientRect();
  // Trabajamos en píxeles reales de la pantalla: con la escala de Windows en 125% o 150%
  // el navegador estiraba la imagen y el movimiento se veía a los saltos.
  const dpr = window.devicePixelRatio || 1;
  const devW = Math.round(r.width * dpr), devH = Math.round(r.height * dpr);
  // Zoom entero (1x, 2x, 3x) para que los píxeles queden nítidos y parejos
  const zoom = Math.max(1, Math.round(Math.min(devW / (32 * 22), devH / (32 * 15))));
  E.zoom = zoom;
  // El canvas tiene la resolución REAL de la pantalla: así la cámara puede moverse de a 1 píxel
  // de pantalla (con zoom 2, antes avanzaba de a 4 o 6 píxeles y se veía a tirones)
  E.canvas.width = devW;
  E.canvas.height = devH;
  E.canvas.style.width = (devW / dpr) + 'px';
  E.canvas.style.height = (devH / dpr) + 'px';
  E.viewW = devW / zoom; E.viewH = devH / zoom;
  E.ctx.imageSmoothingEnabled = false;
  setSnap(zoom);
}

// Si cambia la escala de la pantalla (por ejemplo al mover la ventana a otro monitor)
let lastDpr = window.devicePixelRatio;
setInterval(() => { if (window.devicePixelRatio !== lastDpr && E.canvas) { lastDpr = window.devicePixelRatio; resize(); } }, 1000);

// ---------- piso en bloques (para que vaya fluido en cualquier PC) ----------
const CH = 8; // baldosas por lado de cada bloque
const MARGEN = 4; // los gráficos grandes de la capa 2 pueden asomar desde baldosas vecinas
const chunks = new Map();

function chunkAnimTiles(map, cx, cy) {
  // baldosas animadas (agua, fuego...) que afectan a este bloque
  const list = [];
  const xa = cx * CH + 1, ya = cy * CH + 1;
  for (let y = Math.max(1, ya - MARGEN); y <= Math.min(100, ya + CH - 1 + MARGEN); y++) {
    for (let x = Math.max(1, xa - MARGEN); x <= Math.min(100, xa + CH - 1 + MARGEN); x++) {
      const k = idx(x, y);
      const inside = x >= xa && x < xa + CH && y >= ya && y < ya + CH;
      if (inside && numFrames(map.l1[k]) > 1) list.push(map.l1[k]);
      if (map.l2[k] && numFrames(map.l2[k]) > 1) list.push(map.l2[k]);
    }
  }
  return list;
}

function buildChunk(ch, map, cx, cy, now) {
  const c = ch.ctx;
  c.clearRect(0, 0, CH * TILE, CH * TILE);
  const xa = cx * CH + 1, ya = cy * CH + 1;
  let ok = true;
  for (let y = ya; y < ya + CH && y <= 100; y++) {
    for (let x = xa; x < xa + CH && x <= 100; x++) {
      ok = drawGrh(c, map.l1[idx(x, y)], (x - xa) * TILE, (y - ya) * TILE, false, now) && ok;
    }
  }
  for (let y = Math.max(1, ya - MARGEN); y <= Math.min(100, ya + CH - 1 + MARGEN); y++) {
    for (let x = Math.max(1, xa - MARGEN); x <= Math.min(100, xa + CH - 1 + MARGEN); x++) {
      const g = map.l2[idx(x, y)];
      if (g) ok = drawGrh(c, g, (x - xa) * TILE, (y - ya) * TILE, true, now) && ok;
    }
  }
  ch.complete = ok;
}

function drawGround(ctx, now, x0, y0, x1, y1) {
  const map = E.map;
  const cx0 = Math.floor((x0 - 1) / CH), cx1 = Math.floor((x1 - 1) / CH);
  const cy0 = Math.floor((y0 - 1) / CH), cy1 = Math.floor((y1 - 1) / CH);
  let rebuilt = 0;
  // Se preparan también los bloques de alrededor (antes de que entren en pantalla), así al
  // caminar nunca hay que dibujar un bloque entero de golpe.
  for (let cy = Math.max(0, cy0 - 1); cy <= Math.min(12, cy1 + 1); cy++) {
    for (let cx = Math.max(0, cx0 - 1); cx <= Math.min(12, cx1 + 1); cx++) {
      const visible = cx >= cx0 && cx <= cx1 && cy >= cy0 && cy <= cy1;
      const key = cy * 100 + cx;
      let ch = chunks.get(key);
      if (!ch) {
        const cv = document.createElement('canvas');
        cv.width = CH * TILE; cv.height = CH * TILE;
        const c = cv.getContext('2d');
        c.imageSmoothingEnabled = false;
        ch = { cv, ctx: c, complete: false, sig: -1, anim: chunkAnimTiles(map, cx, cy) };
        chunks.set(key, ch);
      }
      // se redibuja si faltaban imágenes o si cambió el frame de alguna animación (agua)
      let sig = 0;
      for (let i = 0; i < ch.anim.length; i++) sig = (sig * 31 + frameIndex(ch.anim[i], now)) | 0;
      const needs = !ch.complete || sig !== ch.sig;
      // los visibles tienen prioridad; los de alrededor se preparan de a uno por cuadro
      if (needs && (visible ? rebuilt < 3 : rebuilt < 1)) {
        buildChunk(ch, map, cx, cy, now);
        ch.sig = sig;
        rebuilt++;
      }
      if (visible) ctx.drawImage(ch.cv, cx * CH * TILE - E.camX, cy * CH * TILE - E.camY);
    }
  }
}

export function setMap(map, objs) {
  chunks.clear();
  E.map = map;
  E.mapNum = map.n;
  E.blocked = new Uint8Array(map.blocked);
  E.objs = new Map();
  for (const [x, y, g] of objs) E.objs.set(idx(x, y), g);
  E.chars.clear();
}

// ---------- personajes ----------
export function addChar(c) {
  const old = E.chars.get(c.id);
  const ch = Object.assign(old || { offX: 0, offY: 0, moveStart: 0, fx: null, say: null }, c);
  E.chars.set(c.id, ch);
  return ch;
}

// Mueve un personaje un tile. "start" permite encadenar pasos sin pausas.
export function moveChar(id, x, y, h, start) {
  const c = E.chars.get(id);
  if (!c) return;
  const now = performance.now();
  const dx = x - c.x, dy = y - c.y;
  if (Math.abs(dx) + Math.abs(dy) === 1) {
    const t0 = start !== undefined ? Math.min(start, now) : now;
    // Lo que le faltaba recorrer al paso anterior en el momento en que empieza el nuevo
    // (si el paso nuevo arranca justo cuando terminó el anterior, no falta nada: sin frenos)
    let restX = 0, restY = 0;
    if (c.walking) {
      const k = 1 - Math.min(1, Math.max(0, (t0 - c.moveStart) / WALK_MS));
      restX = c.fromX * k; restY = c.fromY * k;
    }
    // la animación de caminar sigue corriendo si venía caminando
    if (!c.walking && now - (c.walkEnd || 0) > 80) c.animStart = now;
    c.fromX = restX - dx * TILE; c.fromY = restY - dy * TILE;
    c.offX = c.fromX; c.offY = c.fromY;
    c.moveStart = t0;
    c.walking = true;
  } else {
    c.offX = 0; c.offY = 0; c.walking = false;
  }
  c.x = x; c.y = y;
  if (h) c.h = h;
}

export function isMoving(c) {
  return c.walking && performance.now() - c.moveStart < WALK_MS;
}

export function charAt(x, y, includeDead = true) {
  for (const c of E.chars.values()) {
    if (c.x === x && c.y === y && (includeDead || !c.dead)) return c;
  }
  return null;
}

export function setFx(id, fx, loops) {
  const c = E.chars.get(id);
  if (!c) return;
  if (!fx) { c.fx = null; return; }
  const f = A.fxs[fx];
  if (!f || !f[0]) return;
  const dur = animDuration(f[0]) || 500;
  c.fx = { grh: f[0], ox: f[1], oy: f[2], start: performance.now(),
    until: loops < 0 ? Infinity : performance.now() + dur * (Math.max(0, loops) + 1) };
}

export function say(id, text, color) {
  const c = E.chars.get(id);
  if (!c) return;
  c.say = { lines: wrap(text, 22), color: SAY_COLORS[color] || '#fff', until: performance.now() + 3500 + text.length * 60 };
}

export function addDamage(id, v) {
  const c = E.chars.get(id);
  if (!c) return;
  E.dmg.push({ x: c.x, y: c.y, v, t: performance.now() });
}

export function addShot(fromId, toId) {
  const a = E.chars.get(fromId), b = E.chars.get(toId);
  if (a && b) E.shots.push({ ax: a.x, ay: a.y, bx: b.x, by: b.y, t: performance.now() });
}

function wrap(text, n) {
  const words = text.split(' ');
  const lines = [];
  let cur = '';
  for (const w of words) {
    if ((cur + ' ' + w).trim().length > n && cur) { lines.push(cur); cur = w; } else cur = (cur + ' ' + w).trim();
  }
  if (cur) lines.push(cur);
  return lines.slice(0, 5);
}

// ---------- coordenadas ----------
export function screenToTile(sx, sy) {
  const r = E.canvas.getBoundingClientRect();
  const px = (sx - r.left) * (E.canvas.width / r.width) / E.zoom + E.camX;
  const py = (sy - r.top) * (E.canvas.height / r.height) / E.zoom + E.camY;
  return { x: Math.floor(px / TILE) + 1, y: Math.floor(py / TILE) + 1 };
}

// ---------- dibujo ----------
export function render(now) {
  const ctx = E.ctx;
  E.frames++;
  if (now - E.fpsTime > 1000) { E.fps = E.frames; E.frames = 0; E.fpsTime = now; }
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, E.canvas.width, E.canvas.height);
  const Z = E.zoom;
  ctx.setTransform(Z, 0, 0, Z, 0, 0);
  ctx.imageSmoothingEnabled = false;
  const snap = (v) => Math.round(v * Z) / Z; // a la grilla de píxeles reales de la pantalla
  const map = E.map;
  const me = E.chars.get(E.me);
  if (!map || !me) return;

  // actualizar desplazamientos de caminata
  for (const c of E.chars.values()) {
    if (c.walking) {
      const t = (now - c.moveStart) / WALK_MS;
      if (t >= 1) { c.offX = 0; c.offY = 0; c.walking = false; c.walkEnd = now; } else {
        const k = 1 - Math.max(0, t);
        c.offX = snap(c.fromX * k); c.offY = snap(c.fromY * k);
      }
    }
  }

  // cámara centrada en mi personaje
  const mx = (me.x - 1) * TILE + me.offX + TILE / 2;
  const my = (me.y - 1) * TILE + me.offY + TILE / 2;
  E.camX = snap(mx - E.viewW / 2);
  E.camY = snap(my - E.viewH / 2);
  if (E.trace) E.trace.push([now, E.camY, me.y, Math.round(me.offY * 10) / 10, me.walking ? 1 : 0, Math.round(me.moveStart)]); // para medir la fluidez en las pruebas
  const x0 = Math.max(1, Math.floor(E.camX / TILE) + 1 - 1);
  const y0 = Math.max(1, Math.floor(E.camY / TILE) + 1 - 1);
  const x1 = Math.min(100, Math.ceil((E.camX + E.viewW) / TILE) + 1);
  const y1 = Math.min(100, Math.ceil((E.camY + E.viewH) / TILE) + 1);
  const bx0 = Math.max(1, x0 - 6), bx1 = Math.min(100, x1 + 6); // margen para gráficos grandes
  const by1 = Math.min(100, y1 + 8);
  const sx = (x) => (x - 1) * TILE - E.camX;
  const sy = (y) => (y - 1) * TILE - E.camY;

  // capa 1 (piso) y capa 2: se dibujan una sola vez en "bloques" y después sólo se copian
  drawGround(ctx, now, x0, y0, x1, y1);

  // agrupar personajes por fila
  const byRow = new Map();
  for (const c of E.chars.values()) {
    if (c.y < y0 - 1 || c.y > by1) continue;
    if (!byRow.has(c.y)) byRow.set(c.y, []);
    byRow.get(c.y).push(c);
  }

  // objetos, personajes y capa 3, fila por fila
  for (let y = Math.max(1, y0 - 1); y <= by1; y++) {
    for (let x = bx0; x <= bx1; x++) {
      const k = idx(x, y);
      const og = E.objs.get(k);
      if (og && x >= x0 && x <= x1) drawGrh(ctx, og, sx(x), sy(y), true, now);
    }
    const row = byRow.get(y);
    if (row) {
      row.sort((a, b) => a.x - b.x);
      for (const c of row) drawChar(ctx, c, sx(c.x) + c.offX, sy(c.y) + c.offY, now, me);
    }
    for (let x = bx0; x <= bx1; x++) {
      const g = map.l3[idx(x, y)];
      if (g) drawGrh(ctx, g, sx(x), sy(y), true, now);
    }
  }

  // capa 4 (techos): se ocultan cuando estoy adentro
  const underRoof = ROOF_TRIGGERS.has(map.trigger[idx(me.x, me.y)]);
  if (!underRoof) {
    for (let y = y0; y <= by1; y++) {
      for (let x = bx0; x <= bx1; x++) {
        const g = map.l4[idx(x, y)];
        if (g) drawGrh(ctx, g, sx(x), sy(y), true, now);
      }
    }
  }

  // nombres y diálogos encima de todo
  for (const c of E.chars.values()) {
    if (c.y < y0 - 1 || c.y > by1 || c.x < x0 - 1 || c.x > x1 + 1) continue;
    const px = sx(c.x) + c.offX, py = sy(c.y) + c.offY;
    if (c.inv && c.id !== E.me) continue;
    const hover = E.mouseTile && E.mouseTile.x === c.x && E.mouseTile.y === c.y;
    if (c.n && (!c.npc || hover) && E.showNames) drawName(ctx, c, px, py);
    if (c.say) {
      if (now > c.say.until) c.say = null; else drawSay(ctx, c, px, py);
    }
  }

  // flechas
  E.shots = E.shots.filter((s) => now - s.t < 250);
  ctx.strokeStyle = '#d8c090'; ctx.lineWidth = 2;
  for (const s of E.shots) {
    const t = (now - s.t) / 250;
    const ax = sx(s.ax) + 16, ay = sy(s.ay) + 0, bx = sx(s.bx) + 16, by = sy(s.by) + 0;
    const cx = ax + (bx - ax) * t, cy = ay + (by - ay) * t;
    ctx.beginPath(); ctx.moveTo(cx - (bx - ax) * 0.08, cy - (by - ay) * 0.08); ctx.lineTo(cx, cy); ctx.stroke();
  }

  // números de daño
  E.dmg = E.dmg.filter((d) => now - d.t < 1000);
  ctx.font = 'bold 13px Tahoma, sans-serif';
  ctx.textAlign = 'center';
  for (const d of E.dmg) {
    const t = (now - d.t) / 1000;
    const px = sx(d.x) + 16, py = sy(d.y) - 30 - t * 24;
    ctx.globalAlpha = 1 - t;
    ctx.fillStyle = '#000'; ctx.fillText('-' + d.v, px + 1, py + 1);
    ctx.fillStyle = '#ff3b2b'; ctx.fillText('-' + d.v, px, py);
    ctx.globalAlpha = 1;
  }

  // lluvia
  if (E.rain && !underRoof) drawRain(ctx, now);
  if (E.rain) { ctx.fillStyle = 'rgba(0,10,30,0.25)'; ctx.fillRect(0, 0, E.viewW, E.viewH); }

  // casilla bajo el mouse
  if (E.mouseTile && E.targeting) {
    ctx.strokeStyle = '#ff6'; ctx.lineWidth = 1;
    ctx.strokeRect(sx(E.mouseTile.x) + 0.5, sy(E.mouseTile.y) + 0.5, TILE - 1, TILE - 1);
  }
}

function drawChar(ctx, c, px, py, now, me) {
  if (c.inv && c.id !== me.id) return;
  const ghost = c.dead || c.inv;
  if (ghost) ctx.globalAlpha = c.inv ? 0.45 : 0.6;
  const body = A.bodies[c.b];
  const h = c.h || 3;
  const walkT = c.walking ? now - (c.animStart || c.moveStart) : 0;
  if (body) {
    const bg = body.w[h - 1];
    // la animación de caminar sólo avanza mientras se mueve
    drawGrh(ctx, bg, px, py, true, c.walking ? walkT * WALK_ANIM : 0);
    const head = A.heads[c.hd];
    if (head && head[h - 1]) drawGrh(ctx, head[h - 1], px + body.ox, py + body.oy, true, 0);
    const helm = A.helmets[c.c];
    if (helm && helm[h - 1]) drawGrh(ctx, helm[h - 1], px + body.ox + 1, py + body.oy - 34, true, 0);
    const wpn = A.weapons[c.w];
    if (wpn && wpn[h - 1]) drawGrh(ctx, wpn[h - 1], px, py, true, c.walking ? walkT * WALK_ANIM : 0);
    const sh = A.shields[c.s];
    if (sh && sh[h - 1]) drawGrh(ctx, sh[h - 1], px, py, true, c.walking ? walkT * WALK_ANIM : 0);
  }
  ctx.globalAlpha = 1;
  if (c.fx) {
    if (now > c.fx.until) c.fx = null;
    else drawGrh(ctx, c.fx.grh, px + c.fx.ox, py + c.fx.oy, true, now - c.fx.start);
  }
}

function drawName(ctx, c, px, py) {
  ctx.font = 'bold 11px Tahoma, sans-serif';
  ctx.textAlign = 'center';
  const parts = c.n.split(' <');
  const y = py + 44;
  const col = c.dead ? '#9bd0ff' : NAME_COLORS[c.col] || '#fff';
  ctx.fillStyle = '#000';
  ctx.fillText(parts[0], px + 17, y + 1);
  ctx.fillStyle = col;
  ctx.fillText(parts[0], px + 16, y);
  if (parts[1]) {
    const g = '<' + parts[1];
    ctx.fillStyle = '#000'; ctx.fillText(g, px + 17, y + 13);
    ctx.fillStyle = col; ctx.fillText(g, px + 16, y + 12);
  }
}

function drawSay(ctx, c, px, py) {
  ctx.font = '11px Tahoma, sans-serif';
  ctx.textAlign = 'center';
  const lines = c.say.lines;
  const base = py - 52 - (lines.length - 1) * 12;
  lines.forEach((l, i) => {
    ctx.fillStyle = '#000'; ctx.fillText(l, px + 17, base + i * 12 + 1);
    ctx.fillStyle = c.say.color; ctx.fillText(l, px + 16, base + i * 12);
  });
}

function drawRain(ctx, now) {
  if (E.rainDrops.length < 160) {
    for (let i = 0; i < 160; i++) E.rainDrops.push({ x: Math.random() * E.viewW, y: Math.random() * E.viewH, s: 6 + Math.random() * 6 });
  }
  ctx.strokeStyle = 'rgba(170,190,255,0.5)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  const dt = Math.min(50, now - (E.lastRain || now));
  E.lastRain = now;
  for (const d of E.rainDrops) {
    d.y += d.s * dt / 16; d.x -= d.s * dt / 64;
    if (d.y > E.viewH) { d.y = -10; d.x = Math.random() * (E.viewW + 50); }
    ctx.moveTo(d.x, d.y); ctx.lineTo(d.x - 2, d.y + 9);
  }
  ctx.stroke();
}

export { frameOf };
