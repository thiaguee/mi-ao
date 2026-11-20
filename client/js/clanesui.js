// Interfaz de clanes: lista de clanes, mi clan (integrantes, solicitudes, opciones del líder)
// y el editor de capa para fundar o modificar el diseño.
import { A, drawGrh } from './assets.js';
import { E } from './engine.js';
import { dibujarCapa, dibujarAura, dibujarEmblema } from './capas.js';

let H = null; // { openModal, closeModal, send, esc, log, S }
const C = { datos: null, emblemas: [], costo: 15000000, editor: null, anim: 0 };
const fmt = (n) => Number(n || 0).toLocaleString('es-AR');

export function init(h) { H = h; }

// ---------- vista previa de un personaje con capa ----------
function dibujarPreview(cv, h, cap, conAura) {
  const ctx = cv.getContext('2d');
  const now = performance.now();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, cv.width, cv.height);
  ctx.fillStyle = '#2e3a22'; ctx.fillRect(0, 0, cv.width, cv.height);
  const z = cv.width / 64;
  ctx.setTransform(z, 0, 0, z, 0, 0);
  ctx.imageSmoothingEnabled = false;
  const me = E.chars.get(H.S.me) || {};
  const body = A.bodies[me.b] || A.bodies[21];
  const px = 16, py = 22;
  if (cap && conAura) dibujarAura(ctx, Object.assign({}, cap, { ld: 1 }), px, py, now);
  if (cap) dibujarCapa(ctx, cap, px, py, h, 'atras', now, false);
  if (body) drawGrh(ctx, body.w[h - 1], px, py, true, 0);
  if (cap) dibujarCapa(ctx, cap, px, py, h, 'adelante', now, false);
  const head = A.heads[me.hd];
  if (head && body) drawGrh(ctx, head[h - 1], px + body.ox, py + body.oy, true, 0);
}

function animarPreviews() {
  cancelAnimationFrame(C.anim);
  const paso = () => {
    const cvs = document.querySelectorAll('canvas[data-prev]');
    if (!cvs.length) return;
    cvs.forEach((cv) => {
      const cap = JSON.parse(cv.dataset.prev);
      dibujarPreview(cv, +cv.dataset.h, cap, cv.dataset.aura === '1');
    });
    C.anim = requestAnimationFrame(paso);
  };
  C.anim = requestAnimationFrame(paso);
}

const capaCorta = (c) => ({ c: c.color, b: c.borde, e: c.emblema, ce: c.colorEmblema });

// ---------- editor de capa (fundar o modificar) ----------
function abrirEditor(modo, capaInicial) {
  const cap = Object.assign({ color: '#7a1010', borde: '#e0b45a', emblema: 'estrella', colorEmblema: '#ffd84a' }, capaInicial || {});
  C.editor = { modo, cap };
  const fundar = modo === 'fundar';
  H.openModal(fundar ? 'Fundar un clan' : 'Diseño de la capa del clan', `<div class="clan-editor">
    <div class="ce-izq">
      ${fundar ? `<label>Nombre del clan<input id="ce-nombre" maxlength="20" placeholder="Ej: Los Inmortales"></label>
        <p class="hint">Fundar cuesta <b style="color:var(--gold)">${fmt(C.costo)}</b> monedas de oro. Tenés <b>${fmt(H.S.stats.gld)}</b>.</p>` : ''}
      <div class="ce-colores">
        <label>Color de la capa<input type="color" id="ce-color" value="${cap.color}"></label>
        <label>Borde<input type="color" id="ce-borde" value="${cap.borde}"></label>
        <label>Emblema<input type="color" id="ce-cemb" value="${cap.colorEmblema}"></label>
      </div>
      <div class="ce-titulo">Emblema</div>
      <div class="ce-emblemas">${C.emblemas.map((e) => `<button class="ce-emb${e === cap.emblema ? ' sel' : ''}" data-e="${e}" title="${e}"><canvas width="32" height="32" data-emb="${e}"></canvas></button>`).join('')}</div>
      <p class="err" id="ce-err"></p>
      <div class="row"><button class="btn main" id="ce-ok">${fundar ? 'Fundar clan' : 'Guardar diseño'}</button></div>
    </div>
    <div class="ce-der">
      <div class="ce-prev"><canvas width="192" height="192" id="ce-p1" data-h="1"></canvas><span>Espalda</span></div>
      <div class="ce-prev"><canvas width="192" height="192" id="ce-p3" data-h="3"></canvas><span>Frente</span></div>
      <div class="ce-prev"><canvas width="192" height="192" id="ce-pl" data-h="1" data-aura="1"></canvas><span>Líder (con aura)</span></div>
    </div></div>`, 'clanEditor');
  const actualizar = () => {
    cap.color = document.getElementById('ce-color').value;
    cap.borde = document.getElementById('ce-borde').value;
    cap.colorEmblema = document.getElementById('ce-cemb').value;
    for (const id of ['ce-p1', 'ce-p3', 'ce-pl']) document.getElementById(id).dataset.prev = JSON.stringify(capaCorta(cap));
    document.querySelectorAll('canvas[data-emb]').forEach((cv) => {
      const ctx = cv.getContext('2d'); ctx.clearRect(0, 0, 32, 32);
      ctx.fillStyle = cap.color; ctx.fillRect(0, 0, 32, 32);
      dibujarEmblema(ctx, cv.dataset.emb, 16, 16, 22, cap.colorEmblema);
    });
  };
  for (const id of ['ce-color', 'ce-borde', 'ce-cemb']) document.getElementById(id).addEventListener('input', actualizar);
  document.querySelectorAll('.ce-emb').forEach((b) => {
    b.onclick = () => {
      cap.emblema = b.dataset.e;
      document.querySelectorAll('.ce-emb').forEach((x) => x.classList.toggle('sel', x === b));
      actualizar();
    };
  });
  const nombre = document.getElementById('ce-nombre');
  if (nombre) { nombre.focus(); nombre.onkeydown = (e) => e.stopPropagation(); }
  document.getElementById('ce-ok').onclick = () => {
    if (fundar) {
      const n = nombre.value.trim();
      if (!/^[A-Za-zÁÉÍÓÚáéíóúÑñ0-9 ]{3,20}$/.test(n)) { document.getElementById('ce-err').textContent = 'El nombre debe tener entre 3 y 20 letras o números.'; return; }
      H.send({ t: 'clan', a: 'crear', nombre: n, capa: cap });
    } else {
      H.send({ t: 'clan', a: 'capa', capa: cap });
    }
  };
  actualizar();
  animarPreviews();
}

// ---------- ventana de clanes ----------
function render() {
  const d = C.datos;
  if (!d) return;
  const mio = d.mio;
  let html = '<div class="clanes-win">';
  if (mio) {
    const lider = mio.soyLider;
    html += `<div class="mi-clan">
      <div class="mc-cab">
        <canvas width="128" height="128" data-prev='${JSON.stringify(capaCorta(mio.capa))}' data-h="1" data-aura="${lider ? 1 : 0}"></canvas>
        <div>
          <div class="mc-nombre">${H.esc(mio.n)}</div>
          <div>Líder: <b>${H.esc(mio.lider)}</b> · Integrantes: <b>${mio.miembros.length}/${mio.max}</b></div>
          <div class="mc-desc">${mio.desc ? H.esc(mio.desc) : (lider ? '<i>Sin descripción</i>' : '')}</div>
          <div class="hint">Chat del clan: escribí <b>/CL mensaje</b></div>
        </div>
      </div>
      <div class="mc-tit">Integrantes</div>
      <div class="mc-lista">${mio.miembros.map((m) => `<div class="mc-fila">
        <span class="dot ${m.online ? 'on' : ''}"></span><b>${H.esc(m.n)}</b>${m.n === mio.lider ? ' <span class="tag-lider">LÍDER</span>' : ''}
        <span class="mc-info">${H.esc(m.clase || '')} · Nivel ${m.lvl}</span>
        ${lider && m.n !== mio.lider ? `<button class="btn sm" data-lider="${H.esc(m.n)}">Hacer líder</button><button class="btn sm" data-exp="${H.esc(m.n)}">Expulsar</button>` : ''}
      </div>`).join('')}</div>`;
    if (lider) {
      html += `<div class="mc-tit">Solicitudes de ingreso (${mio.solicitudes.length})</div>
        <div class="mc-lista">${mio.solicitudes.length ? mio.solicitudes.map((s) => `<div class="mc-fila">
          <span class="dot ${s.online ? 'on' : ''}"></span><b>${H.esc(s.n)}</b><span class="mc-info">${H.esc(s.clase || '')} · Nivel ${s.lvl}</span>
          <button class="btn sm main" data-acep="${H.esc(s.n)}">Aceptar</button><button class="btn sm" data-rech="${H.esc(s.n)}">Rechazar</button>
        </div>`).join('') : '<div class="hint" style="padding:6px">No hay solicitudes.</div>'}</div>
        <div class="row">
          <button class="btn main" id="cl-capa">Editar capa</button>
          <button class="btn" id="cl-desc">Descripción</button>
          <button class="btn" id="cl-disolver">Disolver clan</button>
        </div>`;
    } else {
      html += '<div class="row"><button class="btn" id="cl-salir">Salir del clan</button></div>';
    }
    html += '</div>';
  } else {
    html += `<div class="row"><button class="btn main" id="cl-fundar">Fundar un clan (${fmt(d.costo)} de oro)</button></div>`;
  }
  html += `<div class="mc-tit">Todos los clanes (${d.lista.length})</div><div class="todos-clanes">`;
  html += d.lista.length ? d.lista.map((c) => `<div class="tc-fila">
      <canvas width="64" height="64" data-prev='${JSON.stringify(capaCorta(c.capa))}' data-h="1"></canvas>
      <div class="tc-datos"><b>${H.esc(c.n)}</b><span>Líder: ${H.esc(c.lider)} · ${c.cant}/${c.max} integrantes · ${c.online} conectados</span>
        ${c.desc ? `<span class="mc-desc">${H.esc(c.desc)}</span>` : ''}</div>
      ${mio ? '' : c.pedido ? `<button class="btn sm" data-cancel="${H.esc(c.n)}">Cancelar solicitud</button>`
        : c.cant >= c.max ? '<span class="hint">Completo</span>' : `<button class="btn sm main" data-sol="${H.esc(c.n)}">Solicitar ingreso</button>`}
    </div>`).join('') : '<div class="hint" style="padding:8px">Todavía no hay clanes. ¡Fundá el primero!</div>';
  html += '</div></div>';
  H.openModal('Clanes', html, 'clanes');
  const on = (sel, fn) => document.querySelectorAll(sel).forEach((b) => { b.onclick = () => fn(b); });
  on('[data-sol]', (b) => H.send({ t: 'clan', a: 'solicitar', clan: b.dataset.sol }));
  on('[data-cancel]', (b) => H.send({ t: 'clan', a: 'cancelarSolicitud', clan: b.dataset.cancel }));
  on('[data-acep]', (b) => H.send({ t: 'clan', a: 'aceptar', nombre: b.dataset.acep }));
  on('[data-rech]', (b) => H.send({ t: 'clan', a: 'rechazar', nombre: b.dataset.rech }));
  on('[data-exp]', (b) => { if (confirm(`¿Expulsar a ${b.dataset.exp} del clan?`)) H.send({ t: 'clan', a: 'expulsar', nombre: b.dataset.exp }); });
  on('[data-lider]', (b) => { if (confirm(`¿Pasarle el liderazgo a ${b.dataset.lider}? Vas a dejar de ser el líder.`)) H.send({ t: 'clan', a: 'lider', nombre: b.dataset.lider }); });
  on('#cl-fundar', () => H.send({ t: 'clan', a: 'abrirFundar' }));
  on('#cl-salir', () => { if (confirm('¿Seguro que querés salir del clan?')) H.send({ t: 'clan', a: 'salir' }); });
  on('#cl-capa', () => abrirEditor('editar', mio.capa));
  on('#cl-disolver', () => { if (confirm(`¿Disolver el clan ${mio.n}? Todos los integrantes van a quedar sin clan.`)) H.send({ t: 'clan', a: 'disolver' }); });
  on('#cl-desc', () => { const t = prompt('Descripción del clan (máximo 120 letras):', mio.desc || ''); if (t !== null) H.send({ t: 'clan', a: 'desc', desc: t }); });
  animarPreviews();
}

export function abrir() { C.quiereVer = true; H.send({ t: 'clan', a: 'lista' }); }

export function mensajes(on) {
  on('clanes', (m) => {
    C.datos = m; C.emblemas = m.emblemas || C.emblemas; C.costo = m.costo || C.costo;
    if (C.quiereVer || H.S.modal === 'clanes') { C.quiereVer = false; render(); }
  });
  on('clanFundar', (m) => { C.emblemas = m.emblemas; C.costo = m.costo; abrirEditor('fundar'); });
  on('clanError', (m) => { const e = document.getElementById('ce-err'); if (e) e.textContent = m.text; else H.log(m.text, 'warn'); });
  on('clanCreado', () => { C.quiereVer = true; });
  on('abrirClanes', () => abrir());
}
