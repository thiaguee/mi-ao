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
  const tipo = m.tipo === 'elite' ? '<span class="mi-tag elite">ÉLITE</span>' : m.tipo === 'faccion' ? '<span class="mi-tag faccion">FACCIÓN</span>' : m.tipo === 'clan' ? '<span class="mi-tag clan">CLAN</span>' : '';
  return `<div class="mi-card${m.bloqueada ? ' bloq' : ''}${m.hecha ? ' hecha' : ''}">
    <div class="mi-cab"><b>${H.esc(m.n)}</b>${tipo}${m.lvl ? `<span class="mi-lvl">Nivel ${m.lvl}</span>` : ''}</div>
    <div class="mi-desc">${H.esc(m.d)}</div>${objetivos(m)}${recompensa(m.r)}
    ${botones || ''}</div>`;
}

let ultima = null;
let pestana = 'solo'; // solo | clan | faccion
function render(m) {
  ultima = m;
  const activas = m.activas.length;
  let html = `<div class="mis-win"><div class="mi-top">
      <span>⭐ Puntos de misión: <b>${fmt(m.puntos)}</b></span><span>Misiones cumplidas: <b>${fmt(m.hechas)}</b></span>
      <span>Activas: <b>${activas}/${m.max}</b></span></div>
    <div class="tabs mi-tabs">${[['solo', '🗡 Individuales'], ['clan', '🛡 Clan'], ['faccion', m.faccion.bando === 'cri' ? '💀 Facción' : '⚜ Facción']]
      .map(([k, n]) => `<button class="tab${pestana === k ? ' active' : ''}" data-pest="${k}">${n}</button>`).join('')}</div><div class="mi-cuerpo">`;
  if (pestana === 'solo') {
    if (!m.maestro) html += '<p class="hint">Para tomar misiones nuevas hablá con un <b>Maestro de Misiones</b> (tiene un <b style="color:#ffd84a">!</b> arriba) en Ullathorpe, Nix, Banderbill, Arghal o Lindos.</p>';
    html += '<div class="mi-cols"><div class="mi-col">';
    html += `<div class="mc-tit">Tus misiones (${activas}/${m.max})</div>`;
    html += activas ? m.activas.map((x) => tarjeta(x, `<div class="row"><button class="btn sm" data-aband="${x.id}">Abandonar</button></div>`)).join('') : '<div class="hint mi-vacio">No tenés misiones activas.</div>';
    html += '</div><div class="mi-col">';
    html += `<div class="mc-tit">${m.maestro ? 'Misiones disponibles' : 'Misiones (pedilas en un Maestro)'}</div>`;
    html += m.disponibles.map((x) => tarjeta(x, x.bloqueada
      ? `<div class="mi-bloq">🔒 Necesitás nivel ${x.lvl}${x.tipo === 'elite' ? ' (se desbloquea al llegar al 50)' : ''}</div>`
      : m.maestro ? `<div class="row"><button class="btn sm main" data-acep="${x.id}" ${activas >= m.max ? 'disabled' : ''}>Aceptar</button></div>` : '')).join('');
    html += '</div></div>';
  } else if (pestana === 'clan') {
    if (!m.clan) html += '<p class="hint mi-vacio">No estás en un clan. Las misiones de clan son semanales y suman los bichos que matan todos los integrantes: cuando se cumple, cobran todos.</p>';
    else {
      html += `<div class="mc-tit">Clan ${H.esc(m.clan.n)} — semanales, suman todos los integrantes</div><div class="mi-grilla">`;
      html += m.clan.items.map((x) => tarjeta(x, x.hecha ? '<div class="mi-ok">✔ Cumplida esta semana</div>' : '')).join('') + '</div>';
    }
  } else {
    const f = m.faccion;
    html += `<div class="mc-tit">${f.bando === 'cri' ? 'Criminales: matá ciudadanos' : 'Ciudadanos: matá criminales'} — llevás <b>${fmt(f.cuenta)}</b></div>
      <p class="hint">Se cumplen solas al llegar a cada número y se cobran una sola vez. No cuentan los newbies, las zonas de pelea ni matar al mismo jugador más de una vez cada 30 minutos.${f.bando === 'ciu' ? ' Si te hacés criminal pasás a sumar para la lista de los criminales.' : ''}</p><div class="mi-grilla">`;
    html += f.items.map((x) => tarjeta(x, x.hecha ? '<div class="mi-ok">✔ Cobrada</div>' : '')).join('') + '</div>';
  }
  html += '</div></div>';
  H.openModal(m.maestro ? 'Maestro de Misiones' : 'Misiones', html, 'misiones');
  document.querySelectorAll('[data-pest]').forEach((b) => { b.onclick = () => { pestana = b.dataset.pest; render(ultima); }; });
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
  el.innerHTML = '<div class="ms-tit">MISIONES</div>' + m.items.map((x) => `<div class="ms-item"><div class="ms-n">${x.tipo === 'faccion' ? '⚔ ' : ''}${H.esc(x.n)}</div>${x.obj.map((o) => `<div class="ms-o${o.c >= o.t ? ' ok' : ''}">${H.esc(o.n)}: <b>${o.c}/${o.t}</b></div>`).join('')}</div>`).join('');
}

export function abrir() { H.send({ t: 'mis', a: 'ver' }); }

export function mensajes(on) {
  on('misiones', (m) => render(m));
  on('misSeg', (m) => { seguimiento(m); if (H.S.modal === 'misiones' && ultima) H.send({ t: 'mis', a: 'ver' }); });
}
