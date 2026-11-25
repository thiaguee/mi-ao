// Motor gráfico: dibuja el mapa, objetos, personajes, efectos, nombres y diálogos.
import { dibujarClima } from './clima.js';
import { A, drawGrh, frameOf, animDuration, numFrames, frameIndex, setSnap, getSnap } from './assets.js';
import { dibujarCapa, dibujarAura } from './capas.js';
import { idx } from './mapdata.js';

export const TILE = 32;
export const WALK_MS = 180; // velocidad: un paso cada 180 ms (igual en cualquier pantalla)
// La velocidad de caminata es SIEMPRE la misma (200 ms por baldosa), en cualquier pantalla o monitor.
export const walkMs = () => WALK_MS;
export function ajustarCaminata(frameMs) { E.frameMs = frameMs; }
// Velocidad de la animación de las piernas: igual que el AO original (Movement_Speed = 0.5)
const WALK_ANIM = 0.5;
const ROOF_TRIGGERS = new Set([1, 2, 4]);
const NAME_COLORS = { ciu: '#4a8cff', cri: '#ff3b3b', gm: '#ff8c1a', npc: '#d8d8d8', npc_h: '#ffb0b0', noble: '#ffd633' };
const LIDER_COLOR = { cri: '#7d1f2a', ciu: '#3fe0ff', neu: '#545454' };
const LIDER_TITULO = { cri: 'Líder Criminal', ciu: 'Líder Ciudadano', neu: 'Líder Neutral' };
const SAY_COLORS = { talk: '#ffffff', gm: '#ff9f40', lider_cri: '#ff3b3b', lider_ciu: '#5ad2ff', lider_neu: '#b4b4b4', npc: '#ffffff', spell: '#ff9b3b', dead: '#9bd0ff' };

// Reloj del juego: avanza de a cuadros parejos (ver tick en main.js). Todo lo que se mueve usa
// este reloj, así las pequeñas variaciones del reloj de Windows no se ven como tirones.
export const clock = () => (E.time || performance.now());

export const E = {
  objAnim: new Map(),
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
  const wrap = E.canvas.parentElement;
  const r = wrap.getBoundingClientRect();
  // La pantalla de juego mide siempre 800x600 y se agranda entera para llenar la ventana.
  // logW x logH = tamaño del mapa en píxeles del AO; r = tamaño real en la pantalla.
  const logW = wrap.clientWidth, logH = wrap.clientHeight;
  if (!logW || !logH) return;
  const dpr = window.devicePixelRatio || 1;
  const esc = r.width / wrap.offsetWidth; // cuánto está agrandada la pantalla de juego
  const devW = Math.round(logW * esc * dpr), devH = Math.round(logH * esc * dpr);
  const zoom = devW / logW; // puede no ser entero (por ejemplo 1,8 en una pantalla Full HD)
  E.zoom = Math.round(zoom * 100) / 100;
  E.canvas.style.width = logW + 'px';
  E.canvas.style.height = logH + 'px';
  E.viewW = logW; E.viewH = logH;
  // Si la PC no tiene aceleración de video para el juego, usamos un modo más liviano:
  // se dibuja a 800x600 y la pantalla lo agranda.
  const gpu = new URLSearchParams(location.search).get('gpu') || '';
  E.lowRes = /software|disabled|unavailable/.test(gpu) || localStorage.getItem('ao_liviano') === '1';
  if (E.lowRes) {
    E.canvas.width = logW; E.canvas.height = logH;
    E.zoomDraw = 1;
    E.ctx.imageSmoothingEnabled = false;
    setSnap(1);
    if (E.frameMs) ajustarCaminata(E.frameMs);
    return;
  }
  // El canvas tiene la resolución REAL de la pantalla: así la cámara puede moverse de a 1 píxel
  // de pantalla y se ve fluido aunque esté agrandado.
  E.canvas.width = devW;
  E.canvas.height = devH;
  E.zoomDraw = zoom;
  if (E.frameMs) ajustarCaminata(E.frameMs);
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
  // el bloque se dibuja a tamaño real (1x): cada baldosa en un píxel entero, sin rayitas entre ellas
  const snapAntes = getSnap();
  setSnap(1);
  try { armarChunk(ch, map, cx, cy, now); } finally { setSnap(snapAntes); }
}

function armarChunk(ch, map, cx, cy, now) {
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
        ch = { cv, ctx: c, complete: false, sig: -1, listas: -1, anim: chunkAnimTiles(map, cx, cy) };
        chunks.set(key, ch);
      }
      // se redibuja si faltaban imágenes o si cambió el frame de alguna animación (agua)
      let sig = 0;
      for (let i = 0; i < ch.anim.length; i++) sig = (sig * 31 + frameIndex(ch.anim[i], now)) | 0;
      // si faltaban imágenes, sólo se redibuja cuando llegó alguna nueva (antes era en cada cuadro y trababa)
      const needs = (!ch.complete && ch.listas !== A.listas) || sig !== ch.sig;
      // los visibles tienen prioridad; los de alrededor se preparan de a uno por cuadro
      if (needs && (visible ? rebuilt < 3 : rebuilt < 1)) {
        ch.listas = A.listas;
        buildChunk(ch, map, cx, cy, now);
        ch.sig = sig;
        rebuilt++;
      }
      if (visible) {
        // borde de cada bloque en un píxel exacto de la pantalla (con zoom no entero no quedan rayitas)
        const Z = E.zoomDraw || 1;
        const lx = cx * CH * TILE - E.camX, ly = cy * CH * TILE - E.camY;
        const x0 = Math.round(lx * Z), y0 = Math.round(ly * Z);
        const x1 = Math.round((lx + CH * TILE) * Z), y1 = Math.round((ly + CH * TILE) * Z);
        ctx.drawImage(ch.cv, x0 / Z, y0 / Z, (x1 - x0) / Z, (y1 - y0) / Z);
      }
    }
  }
}

// ---------- puertas: transición suave al abrir o cerrar ----------
const PUERTA_MS = 260;
export function cambiarObjeto(k, nuevo) {
  const viejo = E.objs.get(k);
  if (viejo && nuevo && viejo !== nuevo) E.objAnim.set(k, { from: viejo, start: clock() });
  if (nuevo) E.objs.set(k, nuevo); else E.objs.delete(k);
}
function drawPuerta(ctx, an, nuevo, x, y, now) {
  const t = Math.min(1, (now - an.start) / PUERTA_MS);
  const e = t * t * (3 - 2 * t); // suavizado
  ctx.globalAlpha = 1 - e; drawGrh(ctx, an.from, x, y, true, now);
  ctx.globalAlpha = e; drawGrh(ctx, nuevo, x, y, true, now);
  ctx.globalAlpha = 1;
}

export function setMap(map, objs) {
  E.objAnim = new Map();
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
  const now = clock();
  const dx = x - c.x, dy = y - c.y;
  if (Math.abs(dx) + Math.abs(dy) === 1) {
    const t0 = start !== undefined ? Math.min(start, now) : now;
    // Lo que le faltaba recorrer al paso anterior en el momento en que empieza el nuevo
    // (si el paso nuevo arranca justo cuando terminó el anterior, no falta nada: sin frenos)
    let restX = 0, restY = 0;
    if (c.walking) {
      const k = 1 - Math.min(1, Math.max(0, (t0 - c.moveStart) / walkMs()));
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
  if (c.sit) c.sit = 0; // al caminar se para
}

export function isMoving(c) {
  return c.walking && clock() - c.moveStart < walkMs();
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
  c.fx = { grh: f[0], ox: f[1], oy: f[2], start: clock(),
    until: loops < 0 ? Infinity : clock() + dur * (Math.max(0, loops) + 1) };
}

export function say(id, text, color) {
  const c = E.chars.get(id);
  if (!c) return;
  if (!text) { c.say = null; return; } // carteleó: se borra el texto
  c.say = { lines: wrap(text, 22), color: SAY_COLORS[color] || '#fff', until: clock() + 3500 + text.length * 60 };
}

export function addDamage(id, v) {
  const c = E.chars.get(id);
  if (!c) return;
  E.dmg.push({ id, x: c.x, y: c.y, v, t: clock(), dx: (Math.random() - 0.5) * 14 });
}

// Emotes: ícono arriba de la cabeza (y bailar hace girar al personaje)
const EMOTE_ICONO = { saludar: '👋', bailar: '💃', reir: '😂', aplaudir: '👏', llorar: '😢', enojar: '😡', amor: '❤️', pensar: '💭' };
export function emote(id, e) {
  const c = E.chars.get(id);
  if (!c) return;
  c.emote = { e, t: clock(), h0: c.h || 3 };
}

export function addShot(fromId, toId) {
  const a = E.chars.get(fromId), b = E.chars.get(toId);
  if (a && b) E.shots.push({ ax: a.x, ay: a.y, bx: b.x, by: b.y, t: clock() });
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
  const zd = E.zoomDraw || E.zoom;
  const px = (sx - r.left) * (E.canvas.width / r.width) / zd + E.camX;
  const py = (sy - r.top) * (E.canvas.height / r.height) / zd + E.camY;
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
  const Z = E.zoomDraw || E.zoom;
  ctx.setTransform(Z, 0, 0, Z, 0, 0);
  ctx.imageSmoothingEnabled = false;
  const snap = (v) => Math.round(v * Z) / Z; // a la grilla de píxeles reales de la pantalla
  const map = E.map;
  const me = E.chars.get(E.me);
  if (!map || !me) return;

  // actualizar desplazamientos de caminata
  for (const c of E.chars.values()) {
    if (c.walking) {
      const t = (now - c.moveStart) / walkMs();
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
      if (og && x >= x0 && x <= x1) {
        const an = E.objAnim.get(k);
        if (an && now - an.start < PUERTA_MS) drawPuerta(ctx, an, og, sx(x), sy(y), now);
        else { if (an) E.objAnim.delete(k); drawGrh(ctx, og, sx(x), sy(y), true, now); }
      }
    }
    const row = byRow.get(y);
    if (row) {
      row.sort((a, b) => a.x - b.x);
      for (const c of row) {
        let px = sx(c.x) + c.offX, py = sy(c.y) + c.offY;
        const em = c.emote && now - c.emote.t < 5000 ? c.emote : null;
        if (em && em.e === 'bailar' && !c.walking) {
          // gira cada 300 ms y da saltitos
          const paso = Math.floor((now - em.t) / 300);
          c.h = [3, 2, 1, 4][paso % 4];
          py -= Math.abs(Math.sin((now - em.t) / 150)) * 4;
          if (now - em.t > 4800) c.h = em.h0;
        }
        if (c.sit && !c.walking) {
          // sentado: se corre hacia el asiento y no se le ven las piernas
          const sube = c.sit === 2 ? 20 : -6, corta = c.sit === 2 ? 14 : 10;
          ctx.save();
          ctx.beginPath(); ctx.rect(px - 80, py - 200, 200, 232 - corta - sube); ctx.clip();
          drawChar(ctx, c, px, py - sube, now, me);
          ctx.restore();
          py -= sube;
        } else drawChar(ctx, c, px, py, now, me);
        // El nombre se dibuja junto con el personaje: así las paredes, carteles y techos que
        // están más adelante lo tapan (antes quedaba encima de todo).
        if (c.n && E.showNames && !(c.inv && c.id !== E.me)) {
          const hover = E.mouseTile && E.mouseTile.x === c.x && E.mouseTile.y === c.y;
          if (!c.npc || hover) drawName(ctx, c, px, py);
        }
      }
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

  // noche, luces y clima (antes de los nombres y diálogos, así se leen siempre)
  dibujarClima(ctx, now, sx, sy, me, underRoof);

  // diálogos (lo que dicen) encima de todo
  for (const c of E.chars.values()) {
    if (c.y < y0 - 1 || c.y > by1 || c.x < x0 - 1 || c.x > x1 + 1) continue;
    const px = sx(c.x) + c.offX, py = sy(c.y) + c.offY;
    if (c.mis) signoMision(ctx, px + 16, py - 40 + Math.sin(now / 250) * 2);
    if (c.inv && c.id !== E.me) continue;
    if (c.say) {
      if (now > c.say.until) c.say = null; else drawSay(ctx, c, px, py);
    }
    if (c.emote) {
      const t = now - c.emote.t;
      if (t > 3500) { if (t > 5000) c.emote = null; } else {
        const sube = c.sit === 2 ? 20 : 0;
        const esc = t < 200 ? 0.4 + t / 333 : 1;
        ctx.save();
        ctx.globalAlpha = t > 3000 ? (3500 - t) / 500 : 1;
        const ey = py - 52 - sube - (c.say ? c.say.lines.length * 13 - 12 : 0) + Math.sin(t / 200) * 2;
        ctx.fillStyle = 'rgba(255,248,230,.92)'; ctx.strokeStyle = 'rgba(90,70,40,.9)'; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.arc(px + 16, ey - 8, 14 * esc, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
        ctx.font = `${Math.round(20 * esc)}px "Segoe UI Emoji", "Noto Color Emoji", sans-serif`;
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(EMOTE_ICONO[c.emote.e] || '❔', px + 16, ey - 7);
        ctx.textBaseline = 'alphabetic';
        ctx.restore();
      }
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
  ctx.textAlign = 'center';
  ctx.lineJoin = 'round';
  for (const d of E.dmg) {
    const t = (now - d.t) / 1000;
    // salta, crece un poco y se desvanece
    const pop = t < 0.12 ? 0.6 + t / 0.12 * 0.6 : t < 0.25 ? 1.2 - (t - 0.12) / 0.13 * 0.2 : 1;
    const px = sx(d.x) + 16 + d.dx * t, py = sy(d.y) - 26 - t * 30 - Math.sin(Math.min(1, t * 3) * Math.PI) * 6;
    const mio = d.id === E.me;
    const grande = d.v >= 100;
    ctx.globalAlpha = t > 0.7 ? (1 - t) / 0.3 : 1;
    ctx.font = `bold ${Math.round((grande ? 17 : 14) * pop)}px Georgia, serif`;
    ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(0,0,0,.85)';
    ctx.strokeText(String(d.v), px, py);
    ctx.fillStyle = mio ? '#ff4a3a' : grande ? '#ffd23f' : '#fff3c4';
    ctx.fillText(String(d.v), px, py);
    ctx.globalAlpha = 1;
  }

  // lluvia
  if (E.rain && !underRoof && !E.sinClima) drawRain(ctx, now);
  if (E.rain && !E.sinClima) { ctx.fillStyle = 'rgba(0,10,30,0.25)'; ctx.fillRect(0, 0, E.viewW, E.viewH); }

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
    // Monturas sin jinete (body.sj): sólo se ve el animal, sin cabeza, casco, armas ni capa
    const sinJinete = !!body.sj && !ghost;
    const cap = !ghost && !c.npc && !sinJinete ? c.cap : null; // capa del clan
    if (c.au && !ghost) { // aura del pase de temporada (arcoíris va cambiando de color)
      const col = c.au === 'arcoiris' ? hsvHex((now / 2000) % 1) : c.au;
      dibujarAura(ctx, { ld: 1, ce: col, b: c.au === 'arcoiris' ? hsvHex((now / 2000 + 0.5) % 1) : '#ffffff' }, px, py, now);
    }
    if (cap) { if (!c.au) dibujarAura(ctx, cap, px, py, now); dibujarCapa(ctx, cap, px, py, h, 'atras', now, c.walking); }
    if (c.ry && !ghost) dibujarRayos(ctx, c, px, py, now, false);
    // la animación de caminar sólo avanza mientras se mueve
    drawGrh(ctx, bg, px, py, true, c.walking ? walkT * WALK_ANIM : 0);
    if (c.ry && !ghost) dibujarRayos(ctx, c, px, py, now, true);
    if (cap) dibujarCapa(ctx, cap, px, py, h, 'adelante', now, c.walking);
    // ajuste de altura de la cabeza por dirección y cuadro de caminata (body.hf), para cuerpos como las alas
    const hfila = body.hf && body.hf[h - 1];
    const hdy = hfila ? hfila[frameIndex(bg, c.walking ? walkT * WALK_ANIM : 0) % hfila.length] || 0 : 0;
    const head = sinJinete || c.sinCabeza ? null : A.heads[c.hd];
    if (head && head[h - 1]) drawGrh(ctx, head[h - 1], px + body.ox, py + body.oy + hdy, true, 0);
    const helm = sinJinete ? null : A.helmets[c.c];
    if (helm && helm[h - 1]) drawGrh(ctx, helm[h - 1], px + body.ox + 1, py + body.oy - 34 + hdy, true, 0);
    const wpn = sinJinete ? null : A.weapons[c.w];
    if (wpn && wpn[h - 1]) drawGrh(ctx, wpn[h - 1], px, py, true, c.walking ? walkT * WALK_ANIM : 0);
    const sh = sinJinete ? null : A.shields[c.s];
    if (sh && sh[h - 1]) drawGrh(ctx, sh[h - 1], px, py, true, c.walking ? walkT * WALK_ANIM : 0);
  }
  ctx.globalAlpha = 1;
  if (c.fx) {
    if (now > c.fx.until) c.fx = null;
    else drawGrh(ctx, c.fx.grh, px + c.fx.ox, py + c.fx.oy, true, now - c.fx.start);
  }
}

// "!" amarillo arriba de los Maestros de Misiones
function signoMision(ctx, x, y) {
  ctx.save();
  ctx.font = 'bold 18px Georgia, serif'; ctx.textAlign = 'center';
  ctx.lineWidth = 3; ctx.strokeStyle = '#000'; ctx.strokeText('!', x, y);
  ctx.fillStyle = '#ffd84a'; ctx.fillText('!', x, y);
  ctx.restore();
}

function estrella(ctx, x, y, r, color) {
  ctx.save();
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + i * Math.PI / 5, rr = i % 2 ? r * 0.45 : r;
    ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
  }
  ctx.closePath();
  ctx.lineWidth = 1.5; ctx.strokeStyle = '#000'; ctx.stroke();
  ctx.fillStyle = color; ctx.fill();
  ctx.restore();
}

function drawName(ctx, c, px, py) {
  ctx.font = 'bold 11px Tahoma, sans-serif';
  ctx.textAlign = 'center';
  const parts = c.n.split(' <');
  const y = py + 44;
  // los nobles tienen el nombre amarillo (los GMs siguen en naranja)
  // líderes faccionarios: bordó (criminal), celeste brillante (ciudadano), gris apagado (neutral); los nobles en amarillo
  const col = c.dead ? '#9bd0ff' : c.lf && c.col !== 'gm' ? LIDER_COLOR[c.lf] : c.nb && c.col !== 'gm' ? NAME_COLORS.noble : NAME_COLORS[c.col] || '#fff';
  ctx.fillStyle = '#000';
  ctx.fillText(parts[0], px + 17, y + 1);
  ctx.fillStyle = col;
  ctx.fillText(parts[0], px + 16, y);
  // estrella del ranking de kills (oro, plata, bronce) a la izquierda del nombre
  if (c.rk >= 1 && c.rk <= 3) {
    const w = ctx.measureText(parts[0]).width;
    estrella(ctx, px + 16 - w / 2 - 7, y - 4, 5, ['#ffd700', '#d8d8e0', '#d08a3a'][c.rk - 1]);
  }
  let yy = y;
  if (parts[1]) {
    const g = '<' + parts[1];
    ctx.fillStyle = '#000'; ctx.fillText(g, px + 17, y + 13);
    ctx.fillStyle = col; ctx.fillText(g, px + 16, y + 12);
    yy += 12;
  }
  if (c.lf && c.col !== 'gm' && !c.dead) { // título de líder faccionario
    ctx.font = 'bold 10px Georgia, serif';
    ctx.fillStyle = '#000'; ctx.fillText(LIDER_TITULO[c.lf], px + 17, yy + 13);
    ctx.fillStyle = LIDER_COLOR[c.lf]; ctx.fillText(LIDER_TITULO[c.lf], px + 16, yy + 12);
    yy += 11;
  }
  if (c.tt && !c.dead) { // título del pase de temporada
    ctx.font = 'italic bold 10px Georgia, serif';
    ctx.fillStyle = '#000'; ctx.fillText('« ' + c.tt + ' »', px + 17, yy + 13);
    ctx.fillStyle = '#f2c96b'; ctx.fillText('« ' + c.tt + ' »', px + 16, yy + 12);
  }
}

function hsvHex(h) {
  const f = (n) => { const k = (n + h * 6) % 6; return Math.round(255 * (1 - Math.max(0, Math.min(k, 4 - k, 1)))); };
  return '#' + [f(5), f(3), f(1)].map((v) => v.toString(16).padStart(2, '0')).join('');
}

// ---------- letra MS Sans Serif de mapa de bits (la de Visual Basic 6), dibujada píxel por píxel ----------
const MSS = { img: null, def: null, tintes: new Map() };
(function cargarMSS() {
  const img = new Image();
  img.onload = () => { MSS.img = img; };
  img.src = 'assets/ui/fuente-mss.png';
  fetch('assets/ui/fuente-mss.json').then((r) => r.json()).then((d) => { MSS.def = d; }).catch(() => {});
})();
function atlasMSS(color) {
  let cv = MSS.tintes.get(color);
  if (!cv) {
    cv = document.createElement('canvas'); cv.width = MSS.img.width; cv.height = MSS.img.height;
    const x = cv.getContext('2d');
    x.drawImage(MSS.img, 0, 0); x.globalCompositeOperation = 'source-in'; x.fillStyle = color; x.fillRect(0, 0, cv.width, cv.height);
    MSS.tintes.set(color, cv);
  }
  return cv;
}
function anchoMSS(t, negrita) { let w = 0; for (const ch of t) { const g = MSS.def.g[ch.codePointAt(0)] || MSS.def.g[63]; w += g[6] + (negrita ? 1 : 0); } return w; }
// texto centrado en cx con la línea de base en y
// negrita como la hacía Windows con las letras de mapa de bits: cada letra 1 píxel más gruesa
function textoMSS(ctx, t, cx, y, color, negrita) {
  const at = atlasMSS(color);
  let x = Math.round(cx - anchoMSS(t, negrita) / 2);
  y = Math.round(y);
  for (const ch of t) {
    const g = MSS.def.g[ch.codePointAt(0)] || MSS.def.g[63];
    if (g[2] && g[3]) {
      ctx.drawImage(at, g[0], g[1], g[2], g[3], x + g[4], y - g[5], g[2], g[3]);
      if (negrita) ctx.drawImage(at, g[0], g[1], g[2], g[3], x + g[4] + 1, y - g[5], g[2], g[3]);
    }
    x += g[6] + (negrita ? 1 : 0);
  }
}

function drawSay(ctx, c, px, py) {
  // como en el AO de siempre: sólo las letras en negrita con sombra negra pegada, arriba de la cabeza
  const lines = c.say.lines;
  const sube = c.sit === 2 ? 20 : 0;
  const base = py - 27 - sube - (lines.length - 1) * 13; // ni muy arriba ni pegado a la cabeza
  const x = Math.round(px + 16);
  if (MSS.img && MSS.def) {
    const suave = ctx.imageSmoothingEnabled; ctx.imageSmoothingEnabled = false;
    lines.forEach((l, i) => { textoMSS(ctx, l, x + 1, base + i * 13 + 1, '#000', true); textoMSS(ctx, l, x, base + i * 13, c.say.color, true); });
    ctx.imageSmoothingEnabled = suave;
    return;
  }
  ctx.font = 'bold 11px "Microsoft Sans Serif", "MS Sans Serif", Tahoma, Arial, sans-serif'; // mientras carga la letra
  ctx.textAlign = 'center';
  lines.forEach((l, i) => {
    ctx.fillStyle = '#000'; ctx.fillText(l, x + 1, base + i * 13 + 1);
    ctx.fillStyle = c.say.color; ctx.fillText(l, x, base + i * 13);
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

// Rayos que rodean al personaje (ropas con Rayos=1, por ejemplo las Alas del Ángel Oscuro)
function rayo(ctx, x1, y1, x2, y2, quiebres) {
  ctx.beginPath(); ctx.moveTo(x1, y1);
  for (let i = 1; i < quiebres; i++) {
    const t = i / quiebres;
    ctx.lineTo(x1 + (x2 - x1) * t + (Math.random() - 0.5) * 9, y1 + (y2 - y1) * t + (Math.random() - 0.5) * 9);
  }
  ctx.lineTo(x2, y2); ctx.stroke();
}
function dibujarRayos(ctx, c, px, py, now, adelante) {
  const cx = px + 16, cy = py - 2;
  // cada ~80 ms se arman rayos nuevos (siempre hay alguno)
  if (!c._rayos || now - c._rayosT > 80) {
    c._rayosT = now; c._rayos = [];
    const n = 2 + Math.floor(Math.random() * 3);
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, b = a + (Math.random() - 0.5) * 2.2;
      const r1 = 14 + Math.random() * 10, r2 = 22 + Math.random() * 14;
      c._rayos.push({ x1: cx + Math.cos(a) * r1, y1: cy + Math.sin(a) * r1 * 1.4, x2: cx + Math.cos(b) * r2, y2: cy + Math.sin(b) * r2 * 1.4,
        q: 4 + Math.floor(Math.random() * 3), frente: Math.sin(a) > 0, semilla: Math.random() });
    }
  }
  ctx.save();
  if (!adelante) { // resplandor oscuro de fondo, latiendo
    const p = 0.55 + Math.sin(now / 140) * 0.2;
    const g = ctx.createRadialGradient(cx, cy + 6, 4, cx, cy + 6, 34);
    g.addColorStop(0, `rgba(150,90,255,${0.32 * p})`); g.addColorStop(1, 'rgba(60,20,120,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(cx, cy + 6, 34, 40, 0, 0, Math.PI * 2); ctx.fill();
  }
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  for (const r of c._rayos) {
    if (r.frente !== adelante) continue;
    ctx.globalAlpha = 0.75 + r.semilla * 0.25;
    ctx.strokeStyle = 'rgba(170,110,255,0.55)'; ctx.lineWidth = 3.5; rayo(ctx, r.x1, r.y1, r.x2, r.y2, r.q);
    ctx.strokeStyle = '#f2e8ff'; ctx.lineWidth = 1.2; rayo(ctx, r.x1, r.y1, r.x2, r.y2, r.q);
  }
  ctx.restore();
}

export { frameOf };
