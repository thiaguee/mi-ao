// Ventana del Mercado entre jugadores: Comprar · Vender · Mis publicaciones
import { drawIcon } from './assets.js';
import { confirmar } from './dialogo.js';

let H = null; // { openModal, closeModal, send, esc, S }
const M = { datos: null, tab: 'comprar', filtro: '', slot: -1, cant: 1, precio: '' };
const fmt = (n) => Number(n || 0).toLocaleString('es-AR');
const sinAcentos = (s) => String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

export function init(h) { H = h; }
export function mensajes(on) {
  on('mercado', (m) => { M.datos = m; abrir(); });
}

function icono(root) {
  root.querySelectorAll('canvas[data-g]').forEach((c) => {
    const ctx = c.getContext('2d'); ctx.imageSmoothingEnabled = false;
    const g = +c.dataset.g; if (!drawIcon(ctx, g)) setTimeout(() => drawIcon(ctx, g), 500);
  });
}
const extra = (x) => (x.xh ? ` · Golpe ${x.mh}-${x.xh}` : '') + (x.xd ? ` · Def ${x.md}-${x.xd}` : '');

function comprar() {
  const f = sinAcentos(M.filtro.trim());
  const lista = M.datos.pub.filter((x) => !x.mia && (!f || sinAcentos(x.n + ' ' + x.v).includes(f))).sort((a, b) => a.n.localeCompare(b.n) || a.precio - b.precio);
  return `<input id="mk-buscar" placeholder="Buscar objeto o vendedor" value="${H.esc(M.filtro)}" autocomplete="off">
    <div class="mk-lista">${lista.map((x) => `<div class="mk-fila"><canvas width="32" height="32" data-g="${x.g}"></canvas>
      <div class="mk-info"><b>${H.esc(x.n)}${x.a > 1 ? ` x${fmt(x.a)}` : ''}</b><span>Vende ${H.esc(x.v)}${extra(x)}</span></div>
      <span class="mk-precio">${fmt(x.precio)}</span><button class="btn sm main" data-comprar="${x.id}" ${M.datos.oro < x.precio ? 'disabled' : ''}>Comprar</button></div>`).join('')
      || '<div class="ob-vacio">No hay nada a la venta todavía. ¡Sé el primero en publicar!</div>'}</div>`;
}
function vender() {
  const inv = H.S.inv.filter(Boolean);
  const sel = H.S.inv[M.slot];
  const mias = M.datos.pub.filter((x) => x.mia).length;
  return `<div class="mk-vender"><div class="mk-lista mk-inv">${inv.map((it) => `<div class="mk-fila${it.i === M.slot ? ' sel' : ''}" data-slot="${it.i}">
      <canvas width="32" height="32" data-g="${it.g}"></canvas><div class="mk-info"><b>${H.esc(it.n)}${it.a > 1 ? ` x${fmt(it.a)}` : ''}</b>${it.eq ? '<span>Equipado</span>' : ''}</div></div>`).join('')}</div>
    <div class="mk-form">${sel ? `<canvas class="ob-grande" width="96" height="96" data-g="${sel.g}"></canvas><b>${H.esc(sel.n)}</b>
      <label>Cantidad<input id="mk-cant" type="number" min="1" max="${sel.a}" value="${Math.min(M.cant, sel.a)}"></label>
      <label>Precio total (oro)<input id="mk-precio" type="number" min="1" value="${H.esc(M.precio)}" placeholder="Ej: 50000"></label>
      <div class="hint" id="mk-cobras"></div>
      <button class="btn main" id="mk-publicar">PUBLICAR</button>` : '<div class="ob-vacio">Elegí un objeto de tu inventario.</div>'}
      <div class="hint">Publicaciones: ${mias}/${M.datos.max}. Quedan a la venta aunque te desconectes; el oro te llega solo.</div></div></div>`;
}
function mias() {
  const lista = M.datos.pub.filter((x) => x.mia);
  return `<div class="mk-lista">${lista.map((x) => `<div class="mk-fila"><canvas width="32" height="32" data-g="${x.g}"></canvas>
      <div class="mk-info"><b>${H.esc(x.n)}${x.a > 1 ? ` x${fmt(x.a)}` : ''}</b><span>Cobrás ${fmt(Math.floor(x.precio * (1 - M.datos.comision)))} si se vende</span></div>
      <span class="mk-precio">${fmt(x.precio)}</span><button class="btn sm" data-retirar="${x.id}">Retirar</button></div>`).join('')
      || '<div class="ob-vacio">No tenés nada publicado.</div>'}</div>`;
}

export function abrir() {
  if (!M.datos) return;
  const tabs = [['comprar', 'Comprar'], ['vender', 'Vender'], ['mias', 'Mis publicaciones']];
  H.openModal('Mercado del Pueblo', `<div class="mk-win"><div class="tr-tabs">${tabs.map(([k, n]) => `<button class="tab${M.tab === k ? ' active' : ''}" data-tab-mk="${k}">${n}</button>`).join('')}</div>
    ${M.tab === 'comprar' ? comprar() : M.tab === 'vender' ? vender() : mias()}
    <div class="row hint">Tu oro: <b style="color:var(--gold)">${fmt(M.datos.oro)}</b> · El mercado cobra ${Math.round(M.datos.comision * 100)}% de comisión al vendedor.</div></div>`, 'mercado');
  const body = document.querySelector('.mk-win');
  icono(body);
  body.querySelectorAll('[data-tab-mk]').forEach((b) => { b.onclick = () => { M.tab = b.dataset.tabMk; abrir(); }; });
  const parar = (e) => { e.stopPropagation(); if (e.key === 'Escape') H.closeModal(); };
  const bus = document.getElementById('mk-buscar');
  if (bus) { bus.onkeydown = parar; bus.oninput = () => { M.filtro = bus.value; const pos = bus.selectionStart; abrir(); const nb = document.getElementById('mk-buscar'); nb.focus(); nb.setSelectionRange(pos, pos); }; }
  body.querySelectorAll('[data-comprar]').forEach((b) => { b.onclick = async () => {
    const x = M.datos.pub.find((p) => p.id === +b.dataset.comprar);
    if (x && await confirmar(`¿Comprar ${x.a > 1 ? x.a + ' ' : ''}${x.n} por ${fmt(x.precio)} de oro?`, 'Comprar')) H.send({ t: 'merc', a: 'comprar', id: x.id });
  }; });
  body.querySelectorAll('[data-retirar]').forEach((b) => { b.onclick = () => H.send({ t: 'merc', a: 'retirar', id: +b.dataset.retirar }); });
  body.querySelectorAll('[data-slot]').forEach((d) => { d.onclick = () => { M.slot = +d.dataset.slot; M.cant = 1; abrir(); }; });
  const cant = document.getElementById('mk-cant'), precio = document.getElementById('mk-precio'), cobras = document.getElementById('mk-cobras');
  const calc = () => { const v = Math.floor(+precio.value) || 0; cobras.textContent = v > 0 ? `Si se vende cobrás ${fmt(Math.floor(v * (1 - M.datos.comision)))} de oro.` : ''; };
  if (cant) { cant.onkeydown = parar; cant.oninput = () => { M.cant = +cant.value || 1; }; }
  if (precio) { precio.onkeydown = parar; precio.oninput = () => { M.precio = precio.value; calc(); }; calc(); }
  const pub = document.getElementById('mk-publicar');
  if (pub) pub.onclick = () => H.send({ t: 'merc', a: 'publicar', slot: M.slot, cant: +cant.value || 1, precio: +precio.value || 0 });
}
