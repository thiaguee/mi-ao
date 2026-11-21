// Botón MENÚ > Puntos: ventana para elegir entre Quest (las misiones) y Torneo (tienda de puntos de torneo).
import { drawIcon } from './assets.js';
import { confirmar } from './dialogo.js';

let H = null; // { openModal, send, esc, abrirMisiones }
const fmt = (n) => Number(n || 0).toLocaleString('es-AR');

export function init(h) { H = h; }

export function mensajes(on) {
  on('tiendaTorneo', (m) => tienda(m));
}

export function abrir() {
  H.openModal('Puntos', `<div class="pt-elegir">
      <button class="btn pt-op" id="pt-quest">📜<b>Quest</b><span>Misiones y puntos de misión</span></button>
      <button class="btn pt-op" id="pt-torneo">🏆<b>Torneo</b><span>Canjeá tus puntos de torneo</span></button>
    </div>`, 'puntos');
  document.getElementById('pt-quest').onclick = () => H.abrirMisiones();
  document.getElementById('pt-torneo').onclick = () => H.send({ t: 'torneo', a: 'ver' });
}

function tienda(m) {
  const filas = m.items.map((it) => `<div class="pt-item">
      <canvas width="40" height="40" data-g="${it.g}"></canvas>
      <div class="pt-info"><b>${H.esc(it.n)}</b>${it.puede ? '' : '<span class="pt-nopuede">Tu clase no puede usarlo</span>'}</div>
      <span class="pt-precio">🏆 ${fmt(it.precio)}</span>
      <button class="btn sm main" data-pt="${it.i}" ${m.puntos < it.precio ? 'disabled' : ''}>Canjear</button>
    </div>`).join('');
  H.openModal('Torneo', `<div class="pt-tienda">
      <div class="pt-top">Tus puntos de torneo: <b>${fmt(m.puntos)}</b></div>
      <p class="hint">Se ganan en torneos y eventos. Lo que canjeás acá no se cae al morir, no se puede tirar ni vender, y sí se puede guardar en la bóveda.</p>
      <div class="pt-lista">${filas || '<div class="hint">Todavía no hay objetos en la tienda.</div>'}</div>
      <div class="row"><button class="btn sm" id="pt-volver">Volver</button></div>
    </div>`, 'torneo');
  document.querySelectorAll('.pt-item canvas[data-g]').forEach((c) => {
    const ctx = c.getContext('2d'); ctx.imageSmoothingEnabled = false;
    const g = +c.dataset.g;
    if (!drawIcon(ctx, g, 40)) setTimeout(() => drawIcon(ctx, g, 40), 500);
  });
  document.getElementById('pt-volver').onclick = () => abrir();
  document.querySelectorAll('[data-pt]').forEach((b) => {
    b.onclick = async () => {
      const it = m.items.find((x) => x.i === +b.dataset.pt);
      if (!it) return;
      if (!it.puede && !(await confirmar(`${it.n} no puede ser utilizada por tu clase, ¿desea comprarla igual?`, 'Comprar igual'))) return;
      H.send({ t: 'torneo', a: 'comprar', id: it.i });
    };
  });
}
