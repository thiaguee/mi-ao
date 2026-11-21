// Panel /OBJETOS de los Admin: lista de todos los objetos del juego con búsqueda por nombre
// o número y filtro por tipo. Los objetos equipables o consumibles van al inventario; las
// estructuras (árboles, puertas, carteles, muebles, teleports...) se ponen en la baldosa a la
// que mira el personaje y quedan fijas.
import { drawIcon } from './assets.js';

let H = null; // { openModal, closeModal, send, esc, S }
const P = { lista: null, filtro: '', tipo: '', sel: 0, cant: 1, mapa: '' };

const TIPOS = {
  1: 'Comida', 2: 'Armas', 3: 'Armaduras y ropa', 4: 'Árboles', 5: 'Oro', 6: 'Puertas', 7: 'Cofres y baúles',
  8: 'Carteles y lápidas', 9: 'Llaves', 10: 'Foros', 11: 'Pociones', 12: 'Libros', 13: 'Bebidas', 14: 'Leña',
  15: 'Fogata', 16: 'Escudos', 17: 'Cascos y sombreros', 18: 'Anillos y amuletos', 19: 'Teleports',
  20: 'Muebles', 21: 'Adornos (copas, candelabros)', 22: 'Yacimientos', 23: 'Minerales', 24: 'Pergaminos',
  25: 'Monturas', 26: 'Instrumentos', 27: 'Yunque', 28: 'Fragua', 29: 'Lingotes y gemas', 30: 'Pieles y flores',
  31: 'Barcos', 32: 'Flechas', 33: 'Odre vacía', 34: 'Odre', 35: 'Rejas y sangre', 36: 'Árbol élfico',
  37: 'Mochilas', 38: 'Decoración (agua)',
};
const nombreTipo = (t) => TIPOS[t] || `Tipo ${t}`;

export function init(h) { H = h; }

export function mensajes(on) {
  on('objetos', (m) => { P.lista = m.lista; abrir(); });
}

const sinAcentos = (s) => String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

function filtrados() {
  const f = sinAcentos(P.filtro.trim());
  const num = /^\d+$/.test(f) ? +f : null;
  return P.lista.filter((it) => {
    if (P.tipo && it.ty !== +P.tipo) return false;
    if (!f) return true;
    if (num !== null) return String(it.i).startsWith(f); // por número: 12 encuentra 12, 120, 1203...
    return sinAcentos(it.n).includes(f);
  });
}

function pintarIcono(c) {
  const ctx = c.getContext('2d'); ctx.imageSmoothingEnabled = false;
  const g = +c.dataset.g, tam = c.width;
  if (!drawIcon(ctx, g, tam)) setTimeout(() => drawIcon(ctx, g, tam), 500);
}
function pintarIconos(root) { root.querySelectorAll('canvas[data-g]').forEach(pintarIcono); }

// En la lista se dibujan sólo las imágenes que se ven: así se pueden mostrar todos los objetos sin trabar
let observador = null;
function pintarIconosAlVer(root) {
  if (observador) observador.disconnect();
  if (!('IntersectionObserver' in window)) return pintarIconos(root);
  observador = new IntersectionObserver((entradas) => {
    for (const e of entradas) if (e.isIntersecting) { pintarIcono(e.target); observador.unobserve(e.target); }
  }, { root, rootMargin: '200px' });
  root.querySelectorAll('canvas[data-g]').forEach((c) => observador.observe(c));
}

function ficha() {
  const it = P.lista.find((x) => x.i === P.sel);
  if (!it) return '<div class="ob-vacio">Elegí un objeto de la lista.</div>';
  const donde = it.m
    ? '<div class="ob-donde mapa">Se pone en el mapa, en la baldosa a la que mirás, y queda fija.</div>'
    : '<div class="ob-donde">Va a tu inventario (si no entra, cae al piso).</div>';
  const campos = it.tp
    ? `<label>Mapa de destino<input id="ob-mapa" type="number" min="1" value="${H.esc(P.mapa)}" placeholder="Ej: 34"></label>
       <div class="hint">Lleva al centro de ese mapa.</div>`
    : it.m ? '' : `<label>Cantidad<input id="ob-cant" type="number" min="1" max="10000" value="${P.cant}"></label>`;
  return `<canvas class="ob-grande" width="96" height="96" data-g="${it.g}"></canvas>
    <div class="ob-nombre">${H.esc(it.n)}</div>
    <div class="ob-dato">Número <b>${it.i}</b> · ${H.esc(nombreTipo(it.ty))}</div>
    ${donde}${campos}
    <button class="btn main" id="ob-crear">${it.m ? 'PONER' : 'CREAR'}</button>
    <div class="hint">Doble clic en la lista: ${it.m ? 'lo pone' : 'crea 1'} al instante.</div>`;
}

function crear(id, cantidad) {
  const it = P.lista.find((x) => x.i === id);
  if (!it) return;
  if (it.tp && !(+P.mapa > 0)) {
    const inp = document.getElementById('ob-mapa');
    if (inp) inp.focus();
    return;
  }
  H.send({ t: 'objCrear', id, a: cantidad, mapa: +P.mapa || 0 });
}

function pintarLista() {
  const lista = filtrados();
  const filas = lista.map((it) => `<div class="li${it.i === P.sel ? ' sel' : ''}" data-ob="${it.i}">
      <canvas width="32" height="32" data-g="${it.g}"></canvas><span class="ob-num">${it.i}</span>
      <span>${H.esc(it.n)}</span>${it.m ? '<span class="ob-tag">mapa</span>' : ''}</div>`).join('');
  const el = document.getElementById('ob-lista');
  el.innerHTML = filas || '<div class="ob-vacio">No hay objetos con ese filtro.</div>';
  document.getElementById('ob-cuenta').textContent = `${lista.length} objeto${lista.length === 1 ? '' : 's'}`;
  pintarIconosAlVer(el);
  el.querySelectorAll('[data-ob]').forEach((d) => {
    const id = +d.dataset.ob;
    d.onclick = () => { P.sel = id; el.querySelectorAll('.li.sel').forEach((x) => x.classList.remove('sel')); d.classList.add('sel'); pintarFicha(); };
    d.ondblclick = () => { P.sel = id; pintarFicha(); crear(id, 1); };
  });
}

function pintarFicha() {
  const el = document.getElementById('ob-ficha');
  el.innerHTML = ficha();
  pintarIconos(el);
  const cant = document.getElementById('ob-cant');
  if (cant) cant.oninput = () => { P.cant = Math.max(1, Math.min(10000, Math.floor(+cant.value) || 1)); };
  const mapa = document.getElementById('ob-mapa');
  if (mapa) mapa.oninput = () => { P.mapa = mapa.value; };
  [cant, mapa].forEach((i) => { if (i) i.onkeydown = teclas; });
  const b = document.getElementById('ob-crear');
  if (b) b.onclick = () => crear(P.sel, P.cant);
}

// Escape cierra el panel aunque estés escribiendo; Enter en cantidad/mapa crea
function teclas(e) {
  e.stopPropagation();
  if (e.key === 'Escape') H.closeModal();
  if (e.key === 'Enter' && e.target.id !== 'ob-buscar') crear(P.sel, P.cant);
}

export function abrir() {
  if (!P.lista) return H.send({ t: 'talk', text: '/OBJETOS' });
  const tipos = [...new Set(P.lista.map((it) => it.ty))].sort((a, b) => nombreTipo(a).localeCompare(nombreTipo(b)));
  H.openModal('Objetos del juego', `<div class="ob-win">
    <div class="ob-izq">
      <div class="ob-filtros">
        <input id="ob-buscar" placeholder="Buscar por nombre o número" value="${H.esc(P.filtro)}" autocomplete="off">
        <select id="ob-tipo"><option value="">Todos los tipos</option>
          ${tipos.map((t) => `<option value="${t}"${String(t) === String(P.tipo) ? ' selected' : ''}>${H.esc(nombreTipo(t))}</option>`).join('')}
        </select>
      </div>
      <div class="ob-cuenta hint" id="ob-cuenta"></div>
      <div class="ob-lista" id="ob-lista"></div>
    </div>
    <div class="ob-ficha" id="ob-ficha"></div>
  </div>`, 'objetos');
  const buscar = document.getElementById('ob-buscar');
  buscar.oninput = () => { P.filtro = buscar.value; pintarLista(); };
  buscar.onkeydown = teclas;
  const tipo = document.getElementById('ob-tipo');
  tipo.onchange = () => { P.tipo = tipo.value; pintarLista(); };
  tipo.onkeydown = teclas;
  pintarLista();
  pintarFicha();
  buscar.focus();
  buscar.select();
}
