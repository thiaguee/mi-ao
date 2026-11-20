// Ventanitas propias del juego para confirmar o pedir un texto.
// (Las de Windows —confirm/prompt— dejaban el teclado trabado en la aplicación de escritorio.)

function crear(html) {
  const fondo = document.createElement('div');
  fondo.className = 'dlg-fondo';
  fondo.innerHTML = `<div class="panel dlg">${html}</div>`;
  document.body.appendChild(fondo);
  return fondo;
}

function cerrar(fondo) {
  fondo.remove();
  // devolverle el foco al juego, así el teclado sigue andando
  if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
  window.focus();
}

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

export function confirmar(texto, si = 'Sí', no = 'Cancelar') {
  return new Promise((resolve) => {
    const f = crear(`<p>${esc(texto)}</p><div class="row"><button class="btn main" data-r="1">${esc(si)}</button><button class="btn" data-r="0">${esc(no)}</button></div>`);
    const fin = (v) => { cerrar(f); resolve(v); };
    f.querySelectorAll('[data-r]').forEach((b) => { b.onclick = (e) => { e.stopPropagation(); fin(b.dataset.r === '1'); }; });
    f.addEventListener('keydown', (e) => { e.stopPropagation(); if (e.key === 'Escape') fin(false); if (e.key === 'Enter') fin(true); });
    f.tabIndex = -1; f.focus();
  });
}

export function preguntar(texto, valor = '', max = 200) {
  return new Promise((resolve) => {
    const f = crear(`<p>${esc(texto)}</p><input class="dlg-in" maxlength="${max}" value="${esc(valor)}">
      <div class="row"><button class="btn main" data-r="1">Aceptar</button><button class="btn" data-r="0">Cancelar</button></div>`);
    const inp = f.querySelector('input');
    const fin = (ok) => { const v = inp.value; cerrar(f); resolve(ok ? v : null); };
    f.querySelectorAll('[data-r]').forEach((b) => { b.onclick = (e) => { e.stopPropagation(); fin(b.dataset.r === '1'); }; });
    inp.addEventListener('keydown', (e) => { e.stopPropagation(); if (e.key === 'Enter') fin(true); if (e.key === 'Escape') fin(false); });
    inp.focus(); inp.select();
  });
}
