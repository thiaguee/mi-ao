// Día y noche, luces (faroles, antorchas, fogatas) y clima (nieve, niebla). Se dibuja encima del mapa.
import { E } from './engine.js';
import { idx } from './mapdata.js';

const T = { base: 12, at: 0, mpd: 60 };
export function setHora(h, mpd) { T.base = h; T.at = performance.now(); T.mpd = mpd || 60; }
export function hora() { return (T.base + (performance.now() - T.at) / 60000 / T.mpd * 24) % 24; }
export function textoHora() {
  const h = hora(); const hh = Math.floor(h), mm = Math.floor((h - hh) * 60);
  const ic = h >= 20.5 || h < 5 ? '🌙' : h < 7 ? '🌅' : h < 18.5 ? '☀️' : '🌇';
  return `${ic} ${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
}

// oscuridad (0 = pleno día) según la hora
function oscuridad(h) {
  const NOCHE = 0.62;
  if (h >= 20.5 || h < 5) return NOCHE;
  if (h < 7) return NOCHE * (1 - (h - 5) / 2);
  if (h < 18.5) return 0;
  return NOCHE * (h - 18.5) / 2;
}

// luces: gráfico -> [radio, alto de la llama sobre el piso, color del brillo]
const LUCES = {
  2639: [95, 78, '255,200,110'], 507: [70, 36, '255,190,100'], 25: [70, 30, '255,150,60'], 20405: [90, 50, '255,150,60'],
  1521: [110, 8, '255,130,40'], 1496: [120, 10, '255,130,40'], 314: [55, 20, '255,210,140'], 2172: [65, 40, '255,210,140'],
  5753: [80, 90, '255,150,60'],
};
let lucesDe = null, lucesMapa = null;
export function setMapaClima(info) { E.terreno = info.ter || ''; E.zona = info.zona || ''; lucesMapa = null; }
function lucesDelMapa() {
  if (lucesMapa === E.map) return lucesDe;
  lucesMapa = E.map; lucesDe = [];
  for (let y = 1; y <= 100; y++) {
    for (let x = 1; x <= 100; x++) {
      const k = idx(x, y);
      const g = E.map.l3[k] || 0, o = E.objs.get(k) || 0;
      const l = LUCES[g] || LUCES[o];
      if (l) lucesDe.push([x, y, l]);
    }
  }
  return lucesDe;
}

const capa = document.createElement('canvas');
const cctx = capa.getContext('2d');
const copos = [], nieblas = [];

// Se llama desde el render, con la cámara ya puesta (coordenadas lógicas: 1 baldosa = 32)
export function dibujarClima(ctx, now, sx, sy, me, bajoTecho) {
  const W = Math.ceil(E.viewW), H = Math.ceil(E.viewH);
  const h = hora();
  const dungeon = E.zona === 'DUNGEON';
  let a = dungeon ? 0.45 : oscuridad(h);
  if (bajoTecho && !dungeon) a *= 0.45;
  const luces = lucesDelMapa();
  if (a > 0.01) {
    if (capa.width !== W || capa.height !== H) { capa.width = W; capa.height = H; }
    cctx.globalCompositeOperation = 'source-over';
    cctx.clearRect(0, 0, W, H);
    cctx.fillStyle = `rgba(6,10,32,${a})`;
    cctx.fillRect(0, 0, W, H);
    cctx.globalCompositeOperation = 'destination-out';
    const agujero = (x, y, r, k) => {
      const g = cctx.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, `rgba(0,0,0,${k})`); g.addColorStop(0.55, `rgba(0,0,0,${k * 0.6})`); g.addColorStop(1, 'rgba(0,0,0,0)');
      cctx.fillStyle = g; cctx.fillRect(x - r, y - r, r * 2, r * 2);
    };
    // luz alrededor de mi personaje
    if (me) agujero(sx(me.x) + me.offX + 16, sy(me.y) + me.offY + 8, dungeon ? 120 : 105, 0.85);
    const vis = [];
    for (const [x, y, l] of luces) {
      const px = sx(x) + 16, py = sy(y) + 32 - l[1];
      if (px < -150 || py < -150 || px > W + 150 || py > H + 150) continue;
      const parpadeo = 1 + Math.sin(now / 130 + x * 7 + y * 3) * 0.04;
      agujero(px, py, l[0] * parpadeo, 1);
      vis.push([px, py, l, parpadeo]);
    }
    ctx.drawImage(capa, 0, 0, W, H);
    // brillo cálido de las luces (más fuerte cuanto más oscuro)
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (const [px, py, l, p] of vis) {
      const r = l[0] * 0.55 * p;
      const g = ctx.createRadialGradient(px, py, 0, px, py, r);
      g.addColorStop(0, `rgba(${l[2]},${0.38 * a / 0.62})`); g.addColorStop(1, `rgba(${l[2]},0)`);
      ctx.fillStyle = g; ctx.fillRect(px - r, py - r, r * 2, r * 2);
    }
    ctx.restore();
  }
  if (bajoTecho || dungeon) return;
  // nieve en los mapas nevados
  if (E.terreno === 'NIEVE') {
    if (copos.length < 140) for (let i = 0; i < 140; i++) copos.push({ x: Math.random() * W, y: Math.random() * H, v: 0.4 + Math.random() * 0.9, r: 1 + Math.random() * 1.6, f: Math.random() * 6 });
    ctx.fillStyle = 'rgba(255,255,255,.85)';
    for (const c of copos) {
      c.y += c.v; c.x += Math.sin(now / 900 + c.f) * 0.4;
      if (c.y > H) { c.y = -4; c.x = Math.random() * W; }
      ctx.beginPath(); ctx.arc(c.x, c.y, c.r, 0, Math.PI * 2); ctx.fill();
    }
  }
  // niebla al amanecer
  if (h >= 4.5 && h < 8) {
    const k = h < 6 ? Math.min(1, (h - 4.5) / 0.7) : Math.max(0, (8 - h) / 2);
    if (nieblas.length < 6) for (let i = 0; i < 6; i++) nieblas.push({ x: Math.random() * W, y: Math.random() * H, r: 120 + Math.random() * 120, v: 0.08 + Math.random() * 0.15 });
    for (const n of nieblas) {
      n.x += n.v; if (n.x - n.r > W) n.x = -n.r;
      const g = ctx.createRadialGradient(n.x, n.y, 0, n.x, n.y, n.r);
      g.addColorStop(0, `rgba(220,226,235,${0.22 * k})`); g.addColorStop(1, 'rgba(220,226,235,0)');
      ctx.fillStyle = g; ctx.fillRect(n.x - n.r, n.y - n.r, n.r * 2, n.r * 2);
    }
  }
}
