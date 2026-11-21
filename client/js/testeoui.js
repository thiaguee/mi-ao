// Panel /TESTEO (Admin): todo lo que creamos o arreglamos (números desde el 2000), para probarlo rápido.
// Pestañas: Objetos (Equipables / Consumibles / Decoraciones), Hechizos y NPCs (Hostiles / Interactuables).
import { A, drawIcon } from './assets.js';

let H = null; // { openModal, closeModal, send, esc }
const T = { datos: null, tab: 'obj', sub: 'todos', npcSub: 'hostil' };

export function init(h) { H = h; }
export function mensajes(on) { on('testeo', (m) => { T.datos = m; render(); }); }

const CAT = { equip: 'Equipable', cons: 'Consumible', deco: 'Decoración' };

function icono(cv) {
  const ctx = cv.getContext('2d'); ctx.imageSmoothingEnabled = false;
  let g = +cv.dataset.g;
  if (cv.dataset.b) { const b = A.bodies[+cv.dataset.b]; g = b ? b.w[2] : 0; }
  if (g && !drawIcon(ctx, g, cv.width)) setTimeout(() => drawIcon(ctx, g, cv.width), 500);
}

function fila(it, extra, boton, data) {
  return `<div class="ts-fila">
    <canvas width="40" height="40" ${it.b !== undefined ? `data-b="${it.b}"` : `data-g="${it.g}"`}></canvas>
    <div class="ts-info"><b>${H.esc(it.n)}</b><span>Nº ${it.i}${extra ? ' · ' + extra : ''}</span></div>
    <button class="btn sm main" ${data}>${boton}</button></div>`;
}

function contenido() {
  const d = T.datos;
  if (T.tab === 'obj') {
    const lista = d.objetos.filter((o) => T.sub === 'todos' || o.cat === T.sub);
    const PLURAL = { todos: 'Todos', equip: 'Equipables', cons: 'Consumibles', deco: 'Decoraciones' };
    const chips = ['todos', 'equip', 'cons', 'deco'].map((k) => `<button class="btn sm${T.sub === k ? ' main' : ''}" data-sub="${k}">${PLURAL[k]}</button>`).join('');
    const filas = lista.map((o) => fila(o, `${CAT[o.cat]}${o.def ? ' · defensa ' + o.def : ''}`, o.m ? 'PONER' : 'CREAR', `data-obj="${o.i}"`)).join('');
    return `<div class="ts-chips">${chips}</div><div class="ts-lista">${filas || '<div class="hint">No hay objetos en esta categoría.</div>'}</div>
      <p class="hint">Las decoraciones se ponen en la baldosa a la que mirás. Lo demás va al inventario.</p>`;
  }
  if (T.tab === 'hech') {
    const filas = d.hechizos.map((h) => fila(h, `${h.mana} de maná${h.dmg ? ' · daño ' + h.dmg : ''}${h.crit ? ` · crítico ${h.crit}%` : ''}${h.div ? ` · divino ${h.div}%` : ''}${h.soloNpc ? ' · sólo criaturas' : ''}`, 'CREAR PERGAMINO', `data-obj="${h.i}"`)).join('');
    return `<div class="ts-lista">${filas || '<div class="hint">Todavía no hay hechizos nuestros.</div>'}</div>
      <p class="hint">Se crea el pergamino en tu inventario: usalo para aprender el hechizo.</p>`;
  }
  const lista = d.npcs.filter((n) => (T.npcSub === 'hostil' ? n.hostil : !n.hostil));
  const chips = `<button class="btn sm${T.npcSub === 'hostil' ? ' main' : ''}" data-nsub="hostil">Hostiles</button><button class="btn sm${T.npcSub === 'inter' ? ' main' : ''}" data-nsub="inter">Interactuables</button>`;
  const filas = lista.map((n) => fila(n, n.hp ? `vida ${n.hp}` : '', 'INVOCAR', `data-npc="${n.i}"`)).join('');
  return `<div class="ts-chips">${chips}</div><div class="ts-lista">${filas || '<div class="hint">Todavía no creamos NPCs de este tipo (los nuestros van desde el número 2000).</div>'}</div>`;
}

function render() {
  if (!T.datos) return;
  const tabs = [['obj', 'Objetos'], ['hech', 'Hechizos'], ['npc', 'NPCs']].map(([k, n]) => `<button class="btn${T.tab === k ? ' main' : ''}" data-tab="${k}">${n}</button>`).join('');
  H.openModal('Testeo', `<div class="ts-win"><div class="ts-tabs">${tabs}</div>${contenido()}</div>`, 'testeo');
  const root = document.querySelector('.ts-win');
  root.querySelectorAll('canvas').forEach(icono);
  root.querySelectorAll('[data-tab]').forEach((b) => { b.onclick = () => { T.tab = b.dataset.tab; render(); }; });
  root.querySelectorAll('[data-sub]').forEach((b) => { b.onclick = () => { T.sub = b.dataset.sub; render(); }; });
  root.querySelectorAll('[data-nsub]').forEach((b) => { b.onclick = () => { T.npcSub = b.dataset.nsub; render(); }; });
  root.querySelectorAll('[data-obj]').forEach((b) => { b.onclick = () => H.send({ t: 'objCrear', id: +b.dataset.obj, a: 1 }); });
  root.querySelectorAll('[data-npc]').forEach((b) => { b.onclick = () => H.send({ t: 'testeoNpc', id: +b.dataset.npc }); });
}
