// Interfaz de misiones: ventana (desde el Maestro de Misiones o el botón MISIONES) y contador en pantalla.
let H = null; // { openModal, send, esc, S, $ }
const fmt = (n) => Number(n || 0).toLocaleString('es-AR');

export function init(h) { H = h; }

function recompensa(r) {
  const exp = r.e ? `${fmt(r.e)} exp` : r.ep ? `${Math.round(r.ep * 100)}% de un nivel de exp` : '';
  return `<span class="mi-rec">🪙 ${fmt(r.o)} · ✨ ${exp} · ⭐ ${r.p} pts</span>`;
}
function objetivos(m) {
  return m.obj.map((o) => {
    const pct = Math.min(100, Math.round((o.c / o.t) * 100));
    return `<div class="mi-obj"><span>Matar: ${H.esc(o.n)}</span><b>${o.c}/${o.t}</b><div class="mi-barra"><div style="width:${pct}%"></div></div></div>`;
  }).join('');
}
function tarjeta(m, botones) {
  const tipo = m.tipo === 'elite' ? '<span class="mi-tag elite">ÉLITE</span>' : m.tipo === 'diaria' ? '<span class="mi-tag diaria">DIARIA</span>' : m.tipo === 'clan' ? '<span class="mi-tag clan">CLAN</span>' : '';
  return `<div class="mi-card${m.bloqueada ? ' bloq' : ''}${m.hecha ? ' hecha' : ''}">
    <div class="mi-cab"><b>${H.esc(m.n)}</b>${tipo}${m.lvl ? `<span class="mi-lvl">Nivel ${m.lvl}</span>` : ''}</div>
    <div class="mi-desc">${H.esc(m.d)}</div>${objetivos(m)}${recompensa(m.r)}
    ${botones || ''}</div>`;
}

let ultima = null;
function render(m) {
  ultima = m;
  const activas = m.activas.length;
  let html = `<div class="mis-win"><div class="mi-top">
      <span>⭐ Puntos de misión: <b>${fmt(m.puntos)}</b></span><span>Misiones cumplidas: <b>${fmt(m.hechas)}</b></span>
      <span>Activas: <b>${activas}/${m.max}</b></span></div>`;
  if (!m.maestro) html += '<p class="hint">Para tomar misiones nuevas hablá con un <b>Maestro de Misiones</b> (tiene un <b style="color:#ffd84a">!</b> arriba) en Ullathorpe, Nix, Banderbill, Arghal o Lindos.</p>';
  html += '<div class="mi-cols"><div class="mi-col">';
  html += `<div class="mc-tit">Tus misiones (${activas}/${m.max})</div>`;
  html += activas ? m.activas.map((x) => tarjeta(x, `<div class="row"><button class="btn sm" data-aband="${x.id}">Abandonar</button></div>`)).join('') : '<div class="hint mi-vacio">No tenés misiones activas.</div>';
  html += '<div class="mc-tit">Diarias de hoy (no ocupan lugar)</div>';
  html += m.diarias.length ? m.diarias.map((x) => tarjeta(x, x.hecha ? '<div class="mi-ok">✔ Cumplida hoy</div>' : '')).join('') : '<div class="hint mi-vacio">Sin diarias para tu nivel.</div>';
  if (m.clan) {
    html += `<div class="mc-tit">Clan ${H.esc(m.clan.n)} (semanales, suman todos)</div>`;
    html += m.clan.items.map((x) => tarjeta(x, x.hecha ? '<div class="mi-ok">✔ Cumplida esta semana</div>' : '')).join('');
  }
  html += '</div><div class="mi-col">';
  html += `<div class="mc-tit">${m.maestro ? 'Misiones disponibles' : 'Misiones (pedilas en un Maestro)'}</div>`;
  html += m.disponibles.map((x) => tarjeta(x, x.bloqueada
    ? `<div class="mi-bloq">🔒 Necesitás nivel ${x.lvl}${x.tipo === 'elite' ? ' (se desbloquea al llegar al 50)' : ''}</div>`
    : m.maestro ? `<div class="row"><button class="btn sm main" data-acep="${x.id}" ${activas >= m.max ? 'disabled' : ''}>Aceptar</button></div>` : '')).join('');
  html += '</div></div></div>';
  H.openModal(m.maestro ? 'Maestro de Misiones' : 'Misiones', html, 'misiones');
  document.querySelectorAll('[data-acep]').forEach((b) => { b.onclick = () => H.send({ t: 'mis', a: 'aceptar', id: b.dataset.acep }); });
  document.querySelectorAll('[data-aband]').forEach((b) => { b.onclick = () => H.send({ t: 'mis', a: 'abandonar', id: b.dataset.aband }); });
}

// contador en pantalla
function seguimiento(m) {
  H.S.puntosMision = m.puntos;
  const el = document.getElementById('mis-seg');
  const pts = document.getElementById('s-puntos');
  if (pts) pts.textContent = fmt(m.puntos);
  if (!el) return;
  if (!m.items.length) { el.classList.add('hidden'); return; }
  el.classList.remove('hidden');
  el.innerHTML = '<div class="ms-tit">MISIONES</div>' + m.items.map((x) => `<div class="ms-item"><div class="ms-n">${x.tipo === 'diaria' ? '☀ ' : ''}${H.esc(x.n)}</div>${x.obj.map((o) => `<div class="ms-o${o.c >= o.t ? ' ok' : ''}">${H.esc(o.n)}: <b>${o.c}/${o.t}</b></div>`).join('')}</div>`).join('');
}

export function abrir() { H.send({ t: 'mis', a: 'ver' }); }

export function mensajes(on) {
  on('misiones', (m) => render(m));
  on('misSeg', (m) => { seguimiento(m); if (H.S.modal === 'misiones' && ultima) H.send({ t: 'mis', a: 'ver' }); });
}
