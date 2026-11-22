// Ventana del Pase de Temporada: Recompensas (1-100) · Retos del mes · Mis cosméticos
let H = null; // { openModal, send, esc, S }
const P = { d: null, tab: 'premios' };
const ICONO = { titulo: '🏷️', aura: '✨', capa: '🧣', objeto: '🐎' };
const fmt = (n) => Number(n || 0).toLocaleString('es-AR');

export function init(h) { H = h; }
export function mensajes(on) { on('pase', (m) => { P.d = m; if (H.S.modal === 'pase' || P.pedido) { P.pedido = false; abrir(); } }); }
export function pedir() { P.pedido = true; H.send({ t: 'talk', text: '/PASE' }); }

function premioTxt(pr) {
  if (!pr) return '';
  const l = [pr, ...(pr.extra || [])].map((x) => `${ICONO[x.tipo] || '🎁'} ${x.n || x.v}`);
  return l.join(' + ');
}
function premios() {
  const d = P.d;
  let html = '<div class="ps-grid">';
  for (let n = 1; n <= 100; n++) {
    const pr = d.premios[n];
    const ok = d.nivel >= n;
    html += `<div class="ps-celda${ok ? ' ok' : ''}${pr ? ' premio' : ''}${n === d.nivel + 1 ? ' prox' : ''}" title="${pr ? H.esc(`Nivel ${n}: ${premioTxt(pr)}`) : 'Nivel ' + n}">
      <span class="ps-n">${n}</span>${pr ? `<span class="ps-ic">${ICONO[pr.tipo] || '🎁'}</span>` : ''}</div>`;
  }
  html += '</div><div class="ps-lista">' + Object.entries(d.premios).map(([n, pr]) => `<div class="${d.nivel >= +n ? 'ok' : ''}"><b>Nivel ${n}</b> ${H.esc(premioTxt(pr))}${d.nivel >= +n ? ' ✔' : ''}</div>`).join('') + '</div>';
  return html;
}
function retos() {
  return '<div class="ps-retos">' + P.d.retos.map((r) => `<div class="ps-reto${r.ok ? ' ok' : ''}"><div><b>${H.esc(r.n)}</b><span>+${fmt(r.xp)} de experiencia de pase</span></div>
    <div class="ps-barra"><div style="width:${Math.round(r.v / r.meta * 100)}%"></div><em>${r.ok ? '✔ Cumplido' : `${fmt(r.v)} / ${fmt(r.meta)}`}</em></div></div>`).join('') + '</div>';
}
function cosmeticos() {
  const d = P.d, c = d.cosm, eq = d.equip;
  const fila = (tipo, lista, val, nombre) => `<div class="ps-cosm"><b>${nombre}</b><div class="ps-ops">
    <button class="btn sm${!eq[tipo] ? ' main' : ''}" data-eq="${tipo}" data-v="">Ninguno</button>
    ${lista.map((x) => `<button class="btn sm${eq[tipo] === val(x) ? ' main' : ''}" data-eq="${tipo}" data-v="${H.esc(val(x))}">${H.esc(x.n || x)}</button>`).join('') || '<span class="hint">Todavía no ganaste ninguno.</span>'}</div></div>`;
  return fila('titulo', c.titulos, (x) => x, '🏷️ Título (debajo del nombre)') + fila('aura', c.auras, (x) => x.v, '✨ Aura') + fila('capa', c.capas, (x) => x.n, '🧣 Capa')
    + (d.pendiente ? `<div class="row"><button class="btn main" id="ps-pend">Recibir premio pendiente (${d.pendiente})</button></div>` : '')
    + '<p class="hint">Los cosméticos son sólo estéticos y quedan para siempre, aunque termine la temporada.</p>';
}

export function abrir() {
  const d = P.d; if (!d) return;
  const tabs = [['premios', 'Recompensas'], ['retos', 'Retos del mes'], ['cosm', 'Mis cosméticos']];
  H.openModal(`🎖️ Pase de Temporada · ${H.esc(d.temp)}`, `<div class="ps-win">
    <div class="ps-cab"><div class="ps-niv">Nivel <b>${d.nivel}</b><span>/100</span></div>
      <div class="ps-barra grande"><div style="width:${d.nivel >= 100 ? 100 : Math.round(d.xp / d.porNivel * 100)}%"></div><em>${d.nivel >= 100 ? '¡Completaste el pase!' : `${fmt(d.xp)} / ${fmt(d.porNivel)} para el nivel ${d.nivel + 1}`}</em></div></div>
    <div class="tr-tabs">${tabs.map(([k, n]) => `<button class="tab${P.tab === k ? ' active' : ''}" data-pt="${k}">${n}</button>`).join('')}</div>
    <div class="ps-cuerpo">${P.tab === 'premios' ? premios() : P.tab === 'retos' ? retos() : cosmeticos()}</div>
    <p class="hint">Ganás experiencia de pase matando bichos, con misiones, duelos, guerras y ventas en el Mercado. La temporada se reinicia cada mes.</p></div>`, 'pase');
  const b = document.querySelector('.ps-win');
  b.querySelectorAll('[data-pt]').forEach((x) => { x.onclick = () => { P.tab = x.dataset.pt; abrir(); }; });
  b.querySelectorAll('[data-eq]').forEach((x) => { x.onclick = () => H.send({ t: 'pase', a: 'equipar', tipo: x.dataset.eq, v: x.dataset.v }); });
  const pend = document.getElementById('ps-pend'); if (pend) pend.onclick = () => H.send({ t: 'pase', a: 'pendiente' });
}
