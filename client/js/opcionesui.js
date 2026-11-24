// Ventana de OPCIONES: sonido, video, interfaz, chat, controles (teclas configurables), rendimiento e información.
// Todo se guarda en el navegador (localStorage 'ao_opciones') y se aplica en el momento.
let H = null; // { openModal, closeModal, E, S, AU, setModo, getModo, send, $ }

export const TECLAS_DEF = {
  arriba: 'KeyW', abajo: 'KeyS', izquierda: 'KeyA', derecha: 'KeyD',
  atacar: 'Control', agarrar: 'KeyQ', usar: 'Space', usar2: 'KeyU', equipar: 'KeyE', tirar: 'KeyT',
  meditar: 'KeyF', mapa: 'KeyM', nombres: 'KeyN', macro: 'F7', ayuda: 'F1',
};
const NOMBRE_ACCION = {
  arriba: 'Moverse arriba', abajo: 'Moverse abajo', izquierda: 'Moverse a la izquierda', derecha: 'Moverse a la derecha',
  atacar: 'Atacar', agarrar: 'Tomar objeto', usar: 'Usar / potear', usar2: 'Usar (otra tecla)', equipar: 'Equipar objeto',
  tirar: 'Tirar objeto', meditar: 'Meditar', mapa: 'Mostrar mapa', nombres: 'Ocultar nombres', macro: 'Macro de entrenamiento', ayuda: 'Ayuda',
};
const DEF = {
  musica: true, musicaVol: 50, efectos: true, efectosVol: 60,
  nombres: true, minimapa: true, clima: true, noche: 100, fps: true,
  chatCombate: true, chatExp: true, chatGlobal: true, chatTamano: 13,
  teclas: { ...TECLAS_DEF },
};
export const O = (() => {
  try { const g = JSON.parse(localStorage.getItem('ao_opciones') || '{}'); return { ...DEF, ...g, teclas: { ...TECLAS_DEF, ...(g.teclas || {}) } }; } catch (e) { return { ...DEF, teclas: { ...TECLAS_DEF } }; }
})();
// compatibilidad con las opciones viejas
if (localStorage.getItem('ao_sonido') === '0' && !localStorage.getItem('ao_opciones')) { O.musica = false; O.efectos = false; }
if (localStorage.getItem('ao_minimapa') === '0' && !localStorage.getItem('ao_opciones')) O.minimapa = false;

function guardar() { localStorage.setItem('ao_opciones', JSON.stringify(O)); }

// normaliza teclas para que Control izquierdo y derecho sean lo mismo
export function teclaDe(e) {
  if (/^(Control|Shift|Alt|Meta)(Left|Right)$/.test(e.code)) return e.code.replace(/(Left|Right)$/, '');
  return e.code;
}
export function accionDe(codigo) {
  for (const [a, c] of Object.entries(O.teclas)) if (c === codigo) return a;
  return null;
}
const nombreTecla = (c) => !c ? '—' : c.replace(/^Key/, '').replace(/^Digit/, '').replace('Space', 'Espacio').replace('Control', 'Ctrl')
  .replace('ArrowUp', '↑').replace('ArrowDown', '↓').replace('ArrowLeft', '←').replace('ArrowRight', '→');

export function aplicar() {
  const { E, AU, $ } = H;
  AU.musicOn = O.musica; AU.fxOn = O.efectos; AU.musicVol = O.musicaVol / 100; AU.fxVol = O.efectosVol / 100;
  AU.on = O.musica || O.efectos;
  if (AU.music) { AU.music.volume = AU.musicVol * 0.5; if (!O.musica) { AU.music.pause(); AU.music = null; } }
  else if (O.musica && AU.musicNum) { const n = AU.musicNum; AU.musicNum = 0; H.Snd.music(n); }
  E.showNames = O.nombres;
  E.sinClima = !O.clima;
  E.nocheFactor = O.noche / 100;
  $('minimap').classList.toggle('hidden', !O.minimapa);
  $('fps').classList.toggle('hidden', !O.fps);
  document.documentElement.style.setProperty('--chat-tam', O.chatTamano + 'px');
}

// filtro de la consola: devuelve false si el mensaje no se tiene que mostrar
export function mostrarEnConsola(texto, color) {
  if (!O.chatExp && /puntos de experiencia/.test(texto)) return false;
  if (!O.chatCombate && color === 'fight' && !/experiencia/.test(texto)) return false;
  if (!O.chatGlobal && color === 'global') return false;
  return true;
}

export function init(h) { H = h; aplicar(); }

// ---------- la ventana ----------
const SECCIONES = [['sonido', '🔊', 'Sonido'], ['video', '🖥', 'Video'], ['interfaz', '🧭', 'Interfaz'], ['chat', '💬', 'Chat'],
  ['controles', '⌨', 'Controles'], ['rendimiento', '⚡', 'Rendimiento'], ['info', 'ℹ', 'Información']];
let seccion = 'sonido';
let esperando = null; // acción a la que se le está asignando una tecla

const sw = (id, on, txt, desc = '') => `<div class="op-fila" data-swf="${id}"><span class="op-txt">${txt}${desc ? `<small>${desc}</small>` : ''}</span>
  <span class="op-sw${on ? ' on' : ''}" data-sw="${id}"><i></i></span></div>`;
const sl = (id, val, txt, min = 0, max = 100, suf = '%') => `<div class="op-fila"><span class="op-txt">${txt}</span>
  <span class="op-sl"><input type="range" min="${min}" max="${max}" value="${val}" data-sl="${id}"><b>${val}${suf}</b></span></div>`;

function cuerpo() {
  switch (seccion) {
    case 'sonido': return `<h4>Sonido</h4>${sw('musica', O.musica, 'Música')}${sl('musicaVol', O.musicaVol, 'Volumen de la música')}
      ${sw('efectos', O.efectos, 'Efectos de sonido', 'Golpes, hechizos, pasos y demás')}${sl('efectosVol', O.efectosVol, 'Volumen de los efectos')}`;
    case 'video': return `<h4>Video</h4>${sw('nombres', O.nombres, 'Mostrar nombres', 'También con la tecla ' + nombreTecla(O.teclas.nombres))}
      ${sw('minimapa', O.minimapa, 'Minimapa')}${sw('clima', O.clima, 'Lluvia y nieve')}
      ${sl('noche', O.noche, 'Oscuridad de la noche', 20, 100)}${sw('fps', O.fps, 'Mostrar FPS y ping')}
      <div class="op-fila"><span class="op-txt">Pantalla completa</span><button class="btn sm" data-act="full">${document.fullscreenElement ? 'Salir' : 'Activar'}</button></div>`;
    case 'interfaz': {
      const m = H.getModo();
      return `<h4>Interfaz</h4><div class="op-fila"><span class="op-txt">Modo de teclas<small>Moderno: teclas configurables en Controles · Clásico: el del AO original</small></span>
        <span class="op-seg"><button data-modo="moderno" class="${m === 'moderno' ? 'on' : ''}">Moderno</button><button data-modo="clasico" class="${m !== 'moderno' ? 'on' : ''}">Clásico</button></span></div>
        <div class="op-fila"><span class="op-txt">Capa del clan<small>Mostrar u ocultar tu capa (la ven todos)</small></span><button class="btn sm" data-act="capa">Cambiar</button></div>`;
    }
    case 'chat': return `<h4>Chat y consola</h4>${sw('chatCombate', O.chatCombate, 'Mensajes de combate', '"¡Le has pegado a … por …!"')}
      ${sw('chatExp', O.chatExp, 'Mensajes de experiencia')}${sw('chatGlobal', O.chatGlobal, 'Chat global')}
      ${sl('chatTamano', O.chatTamano, 'Tamaño de letra de la consola', 11, 17, ' px')}`;
    case 'controles': {
      const filas = Object.keys(TECLAS_DEF).map((a) => `<div class="op-tecla"><span>${NOMBRE_ACCION[a]}</span>
        <button class="${esperando === a ? 'esp' : ''}" data-tecla="${a}">${esperando === a ? 'Apretá una tecla…' : nombreTecla(O.teclas[a])}</button></div>`).join('');
      return `<h4>Configurar teclas <small>(modo moderno)</small></h4><div class="op-teclas">${filas}</div>
        <div class="row"><button class="btn sm" data-act="teclasDef">Volver a las de fábrica</button></div>
        <p class="hint">Hacé clic en una acción y apretá la tecla nueva. Escape cancela. Las flechas siempre sirven para caminar.</p>`;
    }
    case 'rendimiento': return `<h4>Rendimiento</h4>
      ${sw('liviano', localStorage.getItem('ao_liviano') === '1', 'Modo liviano', 'Para PCs lentas: dibuja a 800x600. Se aplica al volver a entrar.')}
      ${sw('clima', O.clima, 'Efectos de clima', 'Apagarlo ayuda en PCs lentas')}
      <p class="hint">Apretá F3 en el juego para ver el diagnóstico de cuadros por segundo.</p>`;
    case 'info': return `<h4>Información</h4><div class="op-info">
      <p><b>Norway AO</b> — Argentum Online clásico, reescrito para jugar en el navegador o con la aplicación de Windows.</p>
      <p><b>Comandos útiles:</b> /AYUDA · /EST · /PASE · /MISIONES · /HOGAR · /ONLINE · /DUELO · /COLISEO</p>
      <p><b>Teclas:</b> F1 ayuda · F3 diagnóstico · F7 macro · Enter chat · M mapa (moderno)</p>
      <p>Las opciones se guardan en esta PC.</p></div>`;
    default: return '';
  }
}

export function abrir() {
  const html = `<div class="op-win"><div class="op-menu">${SECCIONES.map(([k, ic, n]) => `<button data-sec="${k}" class="${k === seccion ? 'on' : ''}"><span>${ic}</span>${n}</button>`).join('')}
    <div class="op-sep"></div><button data-act="reset" class="op-reset">Restablecer todo</button></div>
    <div class="op-body">${cuerpo()}</div></div>`;
  H.openModal('Opciones', html, 'opciones');
  const box = document.querySelector('.op-win');
  box.querySelectorAll('[data-sec]').forEach((b) => { b.onclick = () => { seccion = b.dataset.sec; esperando = null; abrir(); }; });
  box.querySelectorAll('[data-swf]').forEach((b) => {   // toda la fila prende/apaga
    b.onclick = (e) => {
      e.preventDefault();
      const k = b.dataset.swf;
      if (k === 'liviano') localStorage.setItem('ao_liviano', localStorage.getItem('ao_liviano') === '1' ? '0' : '1');
      else O[k] = !O[k];
      guardar(); aplicar(); abrir();
    };
  });
  box.querySelectorAll('[data-sl]').forEach((s) => {
    s.oninput = () => { O[s.dataset.sl] = +s.value; s.nextElementSibling.textContent = s.value + (s.dataset.sl === 'chatTamano' ? ' px' : '%'); guardar(); aplicar(); };
  });
  box.querySelectorAll('[data-modo]').forEach((b) => { b.onclick = () => { H.setModo(b.dataset.modo); abrir(); }; });
  box.querySelectorAll('[data-tecla]').forEach((b) => { b.onclick = () => { esperando = b.dataset.tecla; abrir(); }; });
  box.querySelectorAll('[data-act]').forEach((b) => {
    b.onclick = () => {
      const a = b.dataset.act;
      if (a === 'full') { if (document.fullscreenElement) document.exitFullscreen(); else document.documentElement.requestFullscreen().catch(() => {}); setTimeout(abrir, 300); }
      if (a === 'capa') H.send({ t: 'capa' });
      if (a === 'teclasDef') { O.teclas = { ...TECLAS_DEF }; guardar(); abrir(); }
      if (a === 'reset') { const t = O.teclas; Object.assign(O, DEF, { teclas: { ...TECLAS_DEF } }); void t; guardar(); aplicar(); abrir(); }
    };
  });
}

// mientras se espera una tecla nueva para una acción
window.addEventListener('keydown', (e) => {
  if (!esperando || !H || H.S.modal !== 'opciones') return;
  e.preventDefault(); e.stopImmediatePropagation();
  if (e.key !== 'Escape') {
    const c = teclaDe(e);
    for (const a of Object.keys(O.teclas)) if (O.teclas[a] === c) O.teclas[a] = ''; // una tecla, una acción
    O.teclas[esperando] = c;
    guardar();
  }
  esperando = null; abrir();
}, true);
