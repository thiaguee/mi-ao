// Minimapa (esquina del juego) y mapa del mundo (tecla M / botón MAPA).
import { E } from './engine.js';

const MUNDO = { data: null, imgs: new Map() };
const SIZE = 300; // resolución interna del minimapa (se ve a 150 px)

function mapImg(n, onload) {
  let img = MUNDO.imgs.get(n);
  if (!img) {
    img = new Image();
    img.src = `assets/mundo/${n}.png`;
    MUNDO.imgs.set(n, img);
  }
  if (!img.complete && onload) img.addEventListener('load', onload, { once: true });
  return img.complete && img.naturalWidth ? img : null;
}

export async function cargarMundo() {
  try { MUNDO.data = await fetch('assets/mundo/mundo.json').then((r) => r.json()); } catch (e) { MUNDO.data = null; }
  try { MUNDO.dungeons = await fetch('assets/mundo/dungeons.json').then((r) => r.json()); } catch (e) { MUNDO.dungeons = []; }
}

// ---------- minimapa ----------
let ultimo = 0;
export function dibujarMinimapa(now, opts) {
  const cv = document.getElementById('minimap');
  if (!cv || cv.classList.contains('hidden') || !E.map) return;
  if (now - ultimo < 150) return; // 6-7 veces por segundo alcanza
  ultimo = now;
  const ctx = cv.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, SIZE, SIZE);
  const img = mapImg(E.mapNum);
  const k = SIZE / 100; // píxeles por baldosa
  if (img) ctx.drawImage(img, 0, 0, SIZE, SIZE);
  // lo que se ve en pantalla
  ctx.strokeStyle = 'rgba(255,255,255,.55)';
  ctx.lineWidth = 2;
  ctx.strokeRect(E.camX / 32 * k, E.camY / 32 * k, E.viewW / 32 * k, E.viewH / 32 * k);
  // personajes
  for (const c of E.chars.values()) {
    if (c.id === E.me || (c.inv && !opts.gm)) continue;
    let col = null, r = 2.5;
    if (c.npc) { if (c.col === 'npc_h') col = '#ff4a3a'; else if (opts.gm) { col = '#e8d070'; r = 2; } }
    else col = c.col === 'cri' ? '#ff6060' : c.col === 'gm' ? '#ff8c1a' : c.col === 'neu' ? '#cfcfcf' : '#59a8ff';
    if (!col) continue;
    ctx.fillStyle = col;
    ctx.beginPath(); ctx.arc((c.x - 0.5) * k, (c.y - 0.5) * k, r * (c.npc ? 1 : 1.4), 0, Math.PI * 2); ctx.fill();
  }
  const me = E.chars.get(E.me);
  if (me) {
    const x = (me.x - 0.5) * k, y = (me.y - 0.5) * k;
    ctx.fillStyle = '#000'; ctx.beginPath(); ctx.arc(x, y, 6, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(x, y, 4.5, 0, Math.PI * 2); ctx.fill();
  }
}

// clic en el minimapa: los GMs se teletransportan ahí
export function minimapaClic(e, send, gm) {
  if (!gm) return;
  const cv = e.currentTarget;
  const r = cv.getBoundingClientRect();
  const x = Math.floor((e.clientX - r.left) / r.width * 100) + 1;
  const y = Math.floor((e.clientY - r.top) / r.height * 100) + 1;
  send({ t: 'tp', x, y });
}

// ---------- mapa del mundo ----------
export function abrirMundo(openModal, send, gm, esc) {
  const d = MUNDO.data;
  if (!d) return;
  const actual = d.mapas[E.mapNum] || { n: 'Mapa ' + E.mapNum };
  const me = E.chars.get(E.me);
  if (actual.g === undefined) {
    const dg = (MUNDO.dungeons || []).find((x) => x.pisos.includes(E.mapNum));
    if (dg) {
      const piso = dg.pisos.indexOf(E.mapNum) + 1, ent = d.mapas[dg.entrada[0]];
      openModal('Mapa', `<p>Estás en <b>${esc(dg.n)}</b> · Piso ${piso} de 3 (mapa ${E.mapNum}).</p>
        <p>${piso < 3 ? 'Buscá la escalera que baja al próximo piso: cuanto más abajo, más difíciles los bichos.' : 'Este es el último piso: acá vive el jefe de la dungeon.'}</p>
        <p>La entrada está en <b>${esc(ent ? ent.n : 'mapa ' + dg.entrada[0])}</b> (mapa ${dg.entrada[0]}).</p>`);
      return;
    }
    openModal('Mapa', `<p>Estás en <b>${esc(actual.n)}</b> (mapa ${E.mapNum}).</p>
      <p>Este lugar no está conectado con el mundo por caminos (una casa, una cueva o un dungeon).</p>`);
    return;
  }
  const g = d.grupos[actual.g];
  const S = Math.max(16, Math.min(56, Math.floor(Math.min(640 / g.w, 620 / g.h))));
  const lista = Object.entries(d.mapas).filter(([, m]) => m.g === actual.g);
  // ciudades (una vez cada una, aunque ocupe varias zonas)
  const base = (nombre) => nombre.replace(/^Ciudad de /i, '').replace(/\(.*?\)/g, '').replace(/[.,]/g, '').trim();
  const vistas = new Set();
  const ciudades = lista.filter(([, m]) => {
    if (m.z !== 'CIUDAD' || !/^Ciudad /i.test(m.n)) return false;
    const b = base(m.n);
    if (vistas.has(b)) return false;
    vistas.add(b); return true;
  });
  const dungeonsAca = (MUNDO.dungeons || []).filter((x) => d.mapas[x.entrada[0]] && d.mapas[x.entrada[0]].g === actual.g);
  openModal(actual.g === 0 ? 'Mapa del mundo' : 'Mapa de la zona', `<div class="mundo-wrap">
    <canvas id="mundo-cv" width="${g.w * S}" height="${g.h * S}"></canvas>
    <div class="mundo-info">
      Estás en:<br><b>${esc(actual.n)}</b><br>Mapa ${E.mapNum}${me ? ` (${me.x}, ${me.y})` : ''}<br><br>
      <div id="mundo-hover">Pasá el mouse por el mapa para ver el nombre de cada zona.</div><br>
      ${ciudades.length ? `<b>Ciudades:</b><br>${ciudades.map(([n, m]) => `${esc(base(m.n))} (mapa ${n})`).join('<br>')}<br><br>` : ''}
      ${dungeonsAca.length ? `<b>Dungeons</b> (☠ = dificultad):<br>${dungeonsAca.map((x) => `<span style="color:#ff9b6b">${'☠'.repeat(x.dificultad)}</span> ${esc(x.n)} · ${esc((d.mapas[x.entrada[0]] || {}).n || '')}`).join('<br>')}<br><br>` : ''}
      ${gm ? '<span style="color:#ff8c1a">GM: hacé clic en una zona para viajar ahí.</span>' : ''}
    </div></div>`, 'mundo');
  const cv = document.getElementById('mundo-cv');
  const ctx = cv.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  const dibujar = () => {
    ctx.fillStyle = '#05070c'; ctx.fillRect(0, 0, cv.width, cv.height);
    for (const [n, m] of lista) {
      const img = mapImg(+n, dibujar);
      if (img) ctx.drawImage(img, m.x * S, m.y * S, S, S);
      else { ctx.fillStyle = '#1a1a22'; ctx.fillRect(m.x * S, m.y * S, S, S); }
    }
    // líneas entre zonas
    ctx.strokeStyle = 'rgba(0,0,0,.35)'; ctx.lineWidth = 1;
    for (const [, m] of lista) ctx.strokeRect(m.x * S + 0.5, m.y * S + 0.5, S - 1, S - 1);
    // nombres de las ciudades
    ctx.font = `bold ${Math.max(9, Math.floor(S / 3.2))}px Tahoma, sans-serif`;
    ctx.textAlign = 'center';
    for (const [, m] of ciudades) {
      const nombre = base(m.n);
      const x = m.x * S + S / 2, y = m.y * S + S / 2;
      ctx.fillStyle = '#000'; ctx.fillText(nombre, x + 1, y + 1);
      ctx.fillStyle = '#ffe9a0'; ctx.fillText(nombre, x, y);
    }
    // entradas de las dungeons: calavera en la boca de la cueva y el nombre
    for (const dg of dungeonsAca) {
      const m = d.mapas[dg.entrada[0]];
      const px = m.x * S + (dg.entrada[1] - 0.5) / 100 * S, py = m.y * S + (dg.entrada[2] - 0.5) / 100 * S;
      ctx.font = `${Math.max(12, Math.floor(S / 2.4))}px "Segoe UI Emoji", "Noto Color Emoji", sans-serif`;
      ctx.fillText('💀', px, py + 5);
      ctx.font = `bold ${Math.max(8, Math.floor(S / 4))}px Tahoma, sans-serif`;
      ctx.fillStyle = '#000'; ctx.fillText(dg.n, px + 1, py + 17);
      ctx.fillStyle = '#ff9b6b'; ctx.fillText(dg.n, px, py + 16);
    }
    // dónde estoy
    const x0 = actual.x * S, y0 = actual.y * S;
    ctx.strokeStyle = '#ff8c1a'; ctx.lineWidth = 3;
    ctx.strokeRect(x0 + 1.5, y0 + 1.5, S - 3, S - 3);
    if (me) {
      const px = x0 + (me.x - 0.5) / 100 * S, py = y0 + (me.y - 0.5) / 100 * S;
      const t = (performance.now() / 400) % 2 < 1;
      ctx.fillStyle = '#000'; ctx.beginPath(); ctx.arc(px, py, 6, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = t ? '#fff' : '#ff8c1a'; ctx.beginPath(); ctx.arc(px, py, 4, 0, Math.PI * 2); ctx.fill();
    }
  };
  dibujar();
  const iv = setInterval(() => { if (!document.getElementById('mundo-cv')) clearInterval(iv); else dibujar(); }, 400);
  const zonaEn = (ev) => {
    const r = cv.getBoundingClientRect();
    const gx = Math.floor((ev.clientX - r.left) / r.width * g.w), gy = Math.floor((ev.clientY - r.top) / r.height * g.h);
    return lista.find(([, m]) => m.x === gx && m.y === gy);
  };
  cv.addEventListener('mousemove', (ev) => {
    const z = zonaEn(ev);
    document.getElementById('mundo-hover').textContent = z ? `${z[1].n} (mapa ${z[0]})` : '';
  });
  cv.addEventListener('click', (ev) => {
    if (!gm) return;
    const z = zonaEn(ev);
    if (z) send({ t: 'talk', text: `/TELEP YO ${z[0]} 50 50` });
  });
}

// Zonas vecinas (arriba, abajo, izquierda, derecha) de un mapa, según el mapa del mundo
export function vecinas(n) {
  const d = MUNDO.data;
  const m = d && d.mapas[n];
  if (!m || m.g === undefined) return [];
  const out = [];
  for (const [k, v] of Object.entries(d.mapas)) {
    if (v.g === m.g && Math.abs(v.x - m.x) + Math.abs(v.y - m.y) === 1) out.push(+k);
  }
  return out;
}
