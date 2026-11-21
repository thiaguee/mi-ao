// Panel /TIENDAS (GMs): elegir qué vende cada NPC comerciante.
// Izquierda: los vendedores · Medio: lo que vende el elegido · Derecha: todos los objetos para agregar.
import { drawIcon } from './assets.js';
import { TIPOS } from './objetosui.js';

let H = null; // { openModal, send, esc, S }
const T = { vendedores: [], sel: 0, items: [], objetos: [], filtro: '', tipo: '', filtroV: '' };
const fmt = (n) => Number(n || 0).toLocaleString('es-AR');
const sinAcentos = (s) => String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

export function init(h) { H = h; }

export function mensajes(on) {
  on('tiendas', (m) => {
    T.vendedores = m.vendedores; T.sel = m.sel; T.items = m.items;
    if (m.objetos) T.objetos = m.objetos;
    abrir();
  });
  on('tiendaItems', (m) => {
    if (m.vendedores) T.vendedores = m.vendedores;
    if (m.num !== T.sel) return;
    T.items = m.items;
    if (H.S.modal !== 'tiendas') return;
    pintarVendedores(); pintarItems(); pintarObjetos();
  });
}

function icono(c) {
  const ctx = c.getContext('2d'); ctx.imageSmoothingEnabled = false;
  const g = +c.dataset.g;
  if (!drawIcon(ctx, g, c.width)) setTimeout(() => drawIcon(ctx, g, c.width), 500);
}
let obs = null;
function iconosAlVer(root) {
  if (obs) obs.disconnect();
  obs = new IntersectionObserver((es) => { for (const e of es) if (e.isIntersecting) { icono(e.target); obs.unobserve(e.target); } }, { root, rootMargin: '150px' });
  root.querySelectorAll('canvas[data-g]').forEach((c) => obs.observe(c));
}

function pintarVendedores() {
  const el = document.getElementById('ti-vend');
  if (!el) return;
  const f = sinAcentos(T.filtroV.trim());
  const lista = T.vendedores.filter((v) => !f || sinAcentos(v.n + ' ' + v.donde + ' ' + v.num).includes(f));
  el.innerHTML = lista.map((v) => `<div class="ti-v${v.num === T.sel ? ' sel' : ''}" data-v="${v.num}">
      <b>${H.esc(v.n)}${v.mod ? ' <span class="ti-mod" title="Modificado por un GM">✎</span>' : ''}</b>
      <span>NPC ${v.num} · ${H.esc(v.donde)} · ${v.cant} obj.</span></div>`).join('') || '<div class="ob-vacio">Nada.</div>';
  el.querySelectorAll('[data-v]').forEach((d) => { d.onclick = () => {
    T.sel = +d.dataset.v; T.items = [];
    H.send({ t: 'tienda', a: 'ver', num: T.sel });
    pintarVendedores(); pintarItems();
  }; });
}

function pintarItems() {
  const el = document.getElementById('ti-items');
  if (!el) return;
  const v = T.vendedores.find((x) => x.num === T.sel);
  document.getElementById('ti-tit').textContent = v ? `${v.n} (${v.donde}) vende ${T.items.length}:` : 'Elegí un vendedor';
  el.innerHTML = T.items.map((it, i) => `<div class="li ti-it">
      <canvas width="32" height="32" data-g="${it.g}"></canvas><span class="ob-num">${it.i}</span>
      <span class="ti-n">${H.esc(it.n)}</span><span class="price">${fmt(it.v)}</span>
      <button class="btn sm" data-sub="${it.i}" ${i === 0 ? 'disabled' : ''} title="Subir">▲</button>
      <button class="btn sm" data-baj="${it.i}" ${i === T.items.length - 1 ? 'disabled' : ''} title="Bajar">▼</button>
      <button class="btn sm ti-x" data-x="${it.i}" title="Sacar de la tienda">✕</button></div>`).join('')
    || '<div class="ob-vacio">No vende nada. Agregale objetos desde la derecha.</div>';
  el.querySelectorAll('canvas[data-g]').forEach(icono);
  const accion = (a, id) => H.send({ t: 'tienda', a, num: T.sel, id });
  el.querySelectorAll('[data-x]').forEach((b) => { b.onclick = () => accion('quitar', +b.dataset.x); });
  el.querySelectorAll('[data-sub]').forEach((b) => { b.onclick = () => accion('subir', +b.dataset.sub); });
  el.querySelectorAll('[data-baj]').forEach((b) => { b.onclick = () => accion('bajar', +b.dataset.baj); });
}

function pintarObjetos() {
  const el = document.getElementById('ti-obj');
  if (!el) return;
  const f = sinAcentos(T.filtro.trim());
  const num = /^\d+$/.test(f) ? f : null;
  const ya = new Set(T.items.map((x) => x.i));
  const lista = T.objetos.filter((o) => (!T.tipo || o.ty === +T.tipo) && (!f || (num ? String(o.i).startsWith(num) : sinAcentos(o.n).includes(f))));
  document.getElementById('ti-cuenta').textContent = `${lista.length} objetos · clic en + para agregar`;
  el.innerHTML = lista.map((o) => `<div class="li${ya.has(o.i) ? ' ti-ya' : ''}" data-o="${o.i}">
      <canvas width="32" height="32" data-g="${o.g}"></canvas><span class="ob-num">${o.i}</span>
      <span class="ti-n">${H.esc(o.n)}</span>${ya.has(o.i) ? '<span class="ti-tag">ya está</span>' : `<button class="btn sm main" data-add="${o.i}" title="Agregar a la tienda">+</button>`}</div>`).join('');
  iconosAlVer(el);
  el.querySelectorAll('[data-add]').forEach((b) => { b.onclick = (e) => { e.stopPropagation(); H.send({ t: 'tienda', a: 'agregar', num: T.sel, id: +b.dataset.add }); }; });
  el.querySelectorAll('[data-o]').forEach((d) => { d.ondblclick = () => { if (!ya.has(+d.dataset.o)) H.send({ t: 'tienda', a: 'agregar', num: T.sel, id: +d.dataset.o }); }; });
}

export function abrir() {
  const tipos = [...new Set(T.objetos.map((o) => o.ty))].sort((a, b) => (TIPOS[a] || '').localeCompare(TIPOS[b] || ''));
  H.openModal('Tiendas: qué vende cada NPC', `<div class="ti-win">
    <div class="ti-col ti-c1">
      <input id="ti-bv" placeholder="Buscar vendedor, ciudad o N°" value="${H.esc(T.filtroV)}" autocomplete="off">
      <div class="ti-lista" id="ti-vend"></div>
    </div>
    <div class="ti-col ti-c2">
      <div class="ti-tit" id="ti-tit"></div>
      <div class="ti-lista" id="ti-items"></div>
      <div class="hint">Los cambios valen para ese NPC en todas las ciudades y quedan guardados.</div>
    </div>
    <div class="ti-col ti-c3">
      <div class="ob-filtros"><input id="ti-bo" placeholder="Buscar objeto o número" value="${H.esc(T.filtro)}" autocomplete="off">
        <select id="ti-tipo"><option value="">Todos</option>${tipos.map((t) => `<option value="${t}"${String(t) === String(T.tipo) ? ' selected' : ''}>${H.esc(TIPOS[t] || 'Tipo ' + t)}</option>`).join('')}</select></div>
      <div class="hint ti-cuenta" id="ti-cuenta"></div>
      <div class="ti-lista" id="ti-obj"></div>
    </div>
  </div>`, 'tiendas');
  const parar = (e) => { e.stopPropagation(); if (e.key === 'Escape') H.closeModal(); };
  const bv = document.getElementById('ti-bv'); bv.onkeydown = parar; bv.oninput = () => { T.filtroV = bv.value; pintarVendedores(); };
  const bo = document.getElementById('ti-bo'); bo.onkeydown = parar; bo.oninput = () => { T.filtro = bo.value; pintarObjetos(); };
  const ts = document.getElementById('ti-tipo'); ts.onchange = () => { T.tipo = ts.value; pintarObjetos(); };
  pintarVendedores(); pintarItems(); pintarObjetos();
}
