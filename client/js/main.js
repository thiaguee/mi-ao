// Cliente de Norway AO: pantallas, controles y comunicación con el servidor.
import { A, loadIndexes, drawGrh, drawIcon, archivosDe, precargar } from './assets.js';
import { loadMap, idx } from './mapdata.js';
import * as Eng from './engine.js';
import { E, walkMs } from './engine.js';
import { connect, send, on, N, serverUrl } from './net.js';
import * as Snd from './audio.js';
import * as Mapas from './mapas.js';
import * as ClanesUI from './clanesui.js';
import * as MisionesUI from './misionesui.js';
import * as ObjetosUI from './objetosui.js';
import * as PuntosUI from './puntosui.js';
import * as TesteoUI from './testeoui.js';
import * as TiendasUI from './tiendasui.js';
import * as Clima from './clima.js';
import { preguntar, confirmar } from './dialogo.js';

const $ = (id) => document.getElementById(id);
const DIR = { ArrowUp: 1, ArrowRight: 2, ArrowDown: 3, ArrowLeft: 4 };
// Modo moderno: WASD para caminar (además de las flechas)
const DIR_MODERNO = { KeyW: 1, KeyD: 2, KeyS: 3, KeyA: 4 };
let MODO = localStorage.getItem('ao_teclas') || 'moderno';
const dirOf = (code) => DIR[code] || (MODO === 'moderno' ? DIR_MODERNO[code] : 0);
const DXY = { 1: [0, -1], 2: [1, 0], 3: [0, 1], 4: [-1, 0] };

const S = {
  me: null, name: '', gm: 0, stats: {}, inv: [], spells: [], skills: null,
  selSlot: -1, selSpell: -1, targetMode: null, paralyzed: false, inGame: false,
  lastStep: 0, keys: new Set(), loadingMap: false, pendingMoves: 0,
  dice: null, head: 0, modal: null, trade: null, bank: null,
};

// ================== PANTALLAS ==================
function show(id) {
  for (const s of ['scr-login', 'scr-create', 'scr-game']) $(s).classList.toggle('hidden', s !== id);
}

async function ensureConnected(errEl) {
  try {
    await connect();
    return true;
  } catch (e) {
    errEl.textContent = 'No se pudo conectar con el servidor (' + serverUrl() + ').';
    return false;
  }
}

function statusLine() {
  connect().then(() => send({ t: 'info' })).catch(() => {
    $('srv-status').textContent = servidorAmigo() ? 'No se pudo conectar con tu amigo. ¿Tiene el juego abierto y están en la misma red de Radmin?' : 'Servidor desconectado (' + serverUrl() + ')';
  });
}

on('info', (m) => { $('srv-status').textContent = `${m.name} — ${m.online} jugando`; });

// ---------- Jugar con amigos (Radmin VPN o red local) ----------
function servidorAmigo() {
  const s = localStorage.getItem('ao_servidor') || '';
  const m = /^wss?:\/\/([^:/]+)/.exec(s);
  return m ? m[1] : '';
}
function pintarMundo() {
  const amigo = servidorAmigo();
  const ips = (QS.get('ips') || '').split(',').filter(Boolean);
  const radmin = ips.find((x) => x.startsWith('26.'));
  const local = QS.get('local') === '1';
  let txt = '';
  if (amigo) {
    txt = `Estás conectado al mundo de un amigo (<b>${esc(amigo)}</b>).`;
  } else if (local) {
    txt = radmin
      ? `Estás en <b>tu propio mundo</b>. Para que tus amigos entren, pasales este número:<div class="mi-ip">${esc(radmin)}</div><span class="hint">Ellos tocan "Unirme al mundo de un amigo" y lo escriben. No cierres el juego mientras juegan.</span>`
      : `Estás en <b>tu propio mundo</b>. Para jugar con amigos, abrí Radmin VPN y conectate a la red de ellos.`;
  }
  $('mundo-txt').innerHTML = txt;
  $('mundo-box').classList.toggle('hidden', !local && !amigo);
  $('b-unirme').classList.toggle('hidden', !!amigo);
  $('b-volver').classList.toggle('hidden', !amigo);
}
$('b-unirme').onclick = async () => {
  const v = await preguntar('Escribí el número de tu amigo (el de Radmin VPN, empieza con 26.). Ejemplo: 26.123.45.67', '');
  if (v === null) return;
  const ip = v.trim().replace(/^wss?:\/\//, '').replace(/:\d+.*$/, '');
  if (!/^[0-9a-zA-Z.-]+$/.test(ip)) { $('l-err').textContent = 'Ese número no es válido.'; return; }
  localStorage.setItem('ao_servidor', `ws://${ip}:7666`);
  if (N.ws) N.ws.close();
  $('srv-status').textContent = 'Conectando al mundo de tu amigo...';
  pintarMundo();
  setTimeout(statusLine, 300);
};
$('b-volver').onclick = () => {
  localStorage.removeItem('ao_servidor');
  if (N.ws) N.ws.close();
  pintarMundo();
  setTimeout(statusLine, 300);
};
on('error', (m) => {
  const el = $('scr-create').classList.contains('hidden') ? $('l-err') : $('c-err');
  el.textContent = m.text;
  $('b-login').disabled = false; $('c-ok').disabled = false;
});

$('b-login').onclick = async () => {
  $('l-err').textContent = '';
  const name = $('l-name').value.trim(), pass = $('l-pass').value;
  if (!name || !pass) { $('l-err').textContent = 'Completá nombre y contraseña.'; return; }
  if (!(await ensureConnected($('l-err')))) return;
  $('b-login').disabled = true;
  localStorage.setItem('ao_ultimo', name);
  send({ t: 'login', name, pass });
};
$('l-pass').addEventListener('keydown', (e) => { if (e.key === 'Enter') $('b-login').click(); });
$('l-name').addEventListener('keydown', (e) => { if (e.key === 'Enter') $('l-pass').focus(); });
$('b-server').onclick = async (e) => {
  e.preventDefault();
  const v = await preguntar('Dirección del servidor (ej: ws://123.45.67.89:7666). Dejá vacío para usar el predeterminado.', localStorage.getItem('ao_servidor') || '');
  if (v === null) return;
  if (v.trim()) localStorage.setItem('ao_servidor', v.trim()); else localStorage.removeItem('ao_servidor');
  if (N.ws) N.ws.close();
  statusLine();
};

// ---------- creación ----------
const HEADS = { 1: { h: [1, 40], m: [70, 89] }, 2: { h: [301, 319], m: [370, 384] }, 3: { h: [101, 122], m: [170, 188] },
  4: { h: [201, 221], m: [270, 288] }, 5: { h: [401, 416], m: [470, 484] } };
const BODY = { 1: { h: 21, m: 39 }, 2: { h: 53, m: 60 }, 3: { h: 210, m: 259 }, 4: { h: 32, m: 40 }, 5: { h: 222, m: 260 } };
const MOD_RAZA = { 1: [1, 1, 0, 0, 2], 2: [3, 0, -6, -2, 3], 3: [-1, 3, 2, 2, 1], 4: [2, 2, 2, -3, 1], 5: [-5, 3, 3, 1, 0] };
const ATTR_NAMES = ['Fuerza', 'Agilidad', 'Inteligencia', 'Carisma', 'Constitución'];

function headRange() { return HEADS[$('c-raza').value][$('c-genero').value]; }
function drawPreview() {
  const c = $('c-preview'), ctx = c.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  ctx.fillStyle = '#3b4a2a'; ctx.fillRect(0, 0, c.width, c.height);
  const r = headRange();
  if (S.head < r[0] || S.head > r[1]) S.head = r[0];
  const body = A.bodies[BODY[$('c-raza').value][$('c-genero').value]];
  if (body) {
    drawGrh(ctx, body.w[2], 32, 48, true, 0);
    const head = A.heads[S.head];
    if (head) drawGrh(ctx, head[2], 32 + body.ox, 48 + body.oy, true, 0);
  }
  if (!S.previewOk) setTimeout(drawPreview, 300);
}
function drawAttrs() {
  const mod = MOD_RAZA[$('c-raza').value];
  $('c-attrs').innerHTML = S.dice
    ? ATTR_NAMES.map((n, i) => `<span>${n}</span><b>${Math.max(6, S.dice[i] + mod[i])}</b>`).join('')
    : '<span>Tirá los dados</span><b>-</b>';
}
on('dice', (m) => { S.dice = m.v; drawAttrs(); });
$('b-goto-create').onclick = async () => {
  if (!(await ensureConnected($('l-err')))) return;
  show('scr-create');
  S.head = headRange()[0];
  drawPreview(); drawAttrs();
  send({ t: 'dice' });
  setTimeout(() => { S.previewOk = true; }, 3000);
};
$('c-back').onclick = () => show('scr-login');
$('c-raza').onchange = $('c-genero').onchange = () => { S.head = headRange()[0]; drawPreview(); drawAttrs(); };
$('c-head-prev').onclick = () => { const r = headRange(); S.head = S.head <= r[0] ? r[1] : S.head - 1; drawPreview(); };
$('c-head-next').onclick = () => { const r = headRange(); S.head = S.head >= r[1] ? r[0] : S.head + 1; drawPreview(); };
$('c-dice').onclick = () => send({ t: 'dice' });
$('c-ok').onclick = async () => {
  $('c-err').textContent = '';
  const name = $('c-name').value.trim(), pass = $('c-pass').value;
  if (!/^[A-Za-zÁÉÍÓÚáéíóúÑñ ]{3,20}$/.test(name)) { $('c-err').textContent = 'El nombre debe tener entre 3 y 20 letras.'; return; }
  if (pass.length < 4) { $('c-err').textContent = 'La contraseña debe tener al menos 4 caracteres.'; return; }
  if (pass !== $('c-pass2').value) { $('c-err').textContent = 'Las contraseñas no coinciden.'; return; }
  if (!(await ensureConnected($('c-err')))) return;
  $('c-ok').disabled = true;
  send({ t: 'create', name, pass, raza: +$('c-raza').value, genero: $('c-genero').value, head: S.head });
};

// ================== MENSAJES DEL SERVIDOR ==================
on('welcome', (m) => {
  S.me = m.id; S.name = m.name; S.gm = m.gm; S.inGame = true;
  $('b-capa').textContent = 'Capa: ' + (m.capa === 0 ? 'no' : 'sí');
  E.me = m.id;
  $('b-login').disabled = false; $('c-ok').disabled = false;
  $('console').innerHTML = '';
  show('scr-game');
  Eng.resize();
  document.title = `${m.server} - ${m.name}`;
  buildInventory();
  $('chat').blur();
});

on('map', async (m) => {
  S.loadingMap = true;
  try {
    const map = await loadMap(m.map);
    Eng.setMap(map, m.objs);
    Clima.setMapaClima(m);
    // Baldosas que cambiaron los Admin al poner o eliminar estructuras
    for (const [x, y, b] of m.blk || []) if (E.blocked) E.blocked[idx(x, y)] = b;
    for (const c of m.chars) Eng.addChar(c);
    E.me = m.me;
    $('map-name').textContent = `${m.name}${m.pk ? '' : ' (segura)'}`;
    Snd.music(m.music);
    precargarZona(map, m.objs);
    setTimeout(() => precargarVecinas(m.map), 1500);
  } catch (e) {
    log('Error cargando el mapa: ' + e.message, 'warn');
  }
  S.loadingMap = false;
  S.pendingMoves = 0;
  updatePos();
});

on('char', (m) => {
  const c = m.c;
  const old = E.chars.get(c.id);
  if (old && (old.x !== c.x || old.y !== c.y)) {
    Eng.addChar(Object.assign({}, c, { x: old.x, y: old.y }));
    Eng.moveChar(c.id, c.x, c.y, c.h);
  } else Eng.addChar(c);
});
on('rm', (m) => { E.chars.delete(m.id); if (MACRO.on && m.id === MACRO.target) pararMacro(`${MACRO.nombre || 'el bicho'} murió`); });
on('mv', (m) => Eng.moveChar(m.id, m.x, m.y, m.h));
on('turn', (m) => { const c = E.chars.get(m.id); if (c) c.h = m.h; });
on('pos', (m) => {
  const c = E.chars.get(S.me);
  if (!c) return;
  c.x = m.x; c.y = m.y; c.offX = 0; c.offY = 0; c.walking = false;
  if (m.h) c.h = m.h;
  S.pendingMoves = 0;
  updatePos();
});
on('obj', (m) => Eng.cambiarObjeto(idx(m.x, m.y), m.g));

// Carga por adelantado todos los gráficos de la zona (y de las zonas vecinas), así al caminar
// no hay que esperar imágenes nuevas.
function archivosDeMapa(map, objs) {
  const set = new Set();
  for (const capa of [map.l1, map.l2, map.l3, map.l4]) {
    const vistos = new Set();
    for (let k = 0; k < capa.length; k++) { const g = capa[k]; if (g && !vistos.has(g)) { vistos.add(g); archivosDe(g, set); } }
  }
  for (const o of objs || []) archivosDe(o[2], set);
  return set;
}
function precargarZona(map, objs) {
  // primero lo que rodea al personaje, después el resto del mapa
  const me = E.chars.get(S.me);
  if (me) {
    const cerca = new Set();
    for (let y = Math.max(1, me.y - 14); y <= Math.min(100, me.y + 14); y++) {
      for (let x = Math.max(1, me.x - 20); x <= Math.min(100, me.x + 20); x++) {
        const k = idx(x, y);
        for (const capa of [map.l1, map.l2, map.l3, map.l4]) if (capa[k]) archivosDe(capa[k], cerca);
      }
    }
    precargar(cerca);
  }
  precargar(archivosDeMapa(map, objs));
}
async function precargarVecinas(n) {
  for (const v of Mapas.vecinas(n)) {
    if (E.mapNum !== n) return; // ya cambió de zona
    try { const mv = await loadMap(v); precargar(archivosDeMapa(mv)); } catch (e) { /* nada */ }
  }
}
on('blk', (m) => { for (const [x, y, b] of m.tiles) if (x >= 1 && E.blocked) E.blocked[idx(x, y)] = b; });
on('fx', (m) => Eng.setFx(m.id, m.fx, m.loops));
on('snd', (m) => Snd.play(m.w));
on('say', (m) => Eng.say(m.id, m.text, m.color));
on('dmg', (m) => Eng.addDamage(m.id, m.v));
on('emote', (m) => Eng.emote(m.id, m.e));
on('shot', (m) => Eng.addShot(m.from, m.to));
on('msg', (m) => log(m.text, m.color));
on('rain', (m) => { E.rain = !!m.on; });
on('hora', (m) => Clima.setHora(m.h, m.mpd));
// el relojito de la caja de ubicación se actualiza solo
setInterval(() => {
  const c = S.inGame && E.chars.get(S.me);
  if (c) $('s-pos').textContent = `(${E.mapNum}, ${c.x}, ${c.y}) · ${Clima.textoHora()}`;
}, 5000);
on('para', (m) => { S.paralyzed = !!m.on; if (m.on) log('¡Estás paralizado!', 'warn'); renderState(); });
on('meditate', (m) => { S.meditando = !!m.on; $('b-med').classList.toggle('main', !!m.on); renderState(); });
on('announce', (m) => {
  const a = $('announce');
  a.textContent = m.text; a.classList.remove('hidden');
  clearTimeout(S.annT); S.annT = setTimeout(() => a.classList.add('hidden'), 8000);
});
on('sign', (m) => openModal('Cartel', `<p style="max-width:380px">${esc(m.text)}</p>`));
on('bye', (m) => { S.byeText = m.text; });
on('pong', (m) => { S.ping = Date.now() - m.ts; });

on('stats', (m) => {
  Object.assign(S.stats, m);
  renderStats();
});

on('inv', (m) => {
  S.inv[m.i] = m.id ? m : null;
  renderSlot(m.i);
  renderBottomWeapon();
  if (m.i === S.selSlot) showSlotInfo();
  if (S.trade) renderTrade();
  if (S.bank) renderBank();
});

on('spells', (m) => { S.spells = m.list; renderSpells(); });
on('skills', (m) => { S.skills = m; if (S.modal === 'skills') openSkills(); });
on('classup', (m) => openClassUp(m));
on('trade', (m) => { S.trade = m; S.tradeSel = S.tradeSel || { npc: -1, inv: -1 }; renderTrade(); });
on('tradeEnd', () => { if (S.modal === 'trade') closeModal(); S.trade = null; });
on('bank', (m) => { S.bank = m; S.bankSel = S.bankSel || { bank: -1, inv: -1 }; renderBank(); });
on('bankEnd', () => { if (S.modal === 'bank') closeModal(); S.bank = null; });
on('nobleza', (m) => {
  const cartas = m.tunicas.map((t) => {
    const est = !t.obj ? '<span class="cj-falta">Próximamente</span>'
      : m.elegida === t.obj ? '<span class="cj-ok">✔ Tu elección</span>'
      : m.elegida ? '' : `<button class="btn sm main" data-nb="${t.obj}">Elegir</button>`;
    return `<div class="cj-fila${m.elegida === t.obj ? ' hecho' : ''}">${t.obj ? `<canvas width="32" height="32" data-g="${t.g}"></canvas>` : '<div style="width:32px;text-align:center;font-size:20px">?</div>'}
      <div class="cj-info"><b>${esc(t.n)}</b><span>${t.obj ? `Def ${t.md}-${t.xd}` : 'Todavía no está en el juego'}</span>${t.aviso ? `<span class="cj-aviso">${esc(t.aviso)}</span>` : ''}</div>${est}</div>`;
  }).join('');
  openModal('👑 Nobleza', `<div class="cj-win"><p class="hint">${m.elegida ? 'Ya elegiste tu túnica de noble.' : 'Como Noble podés elegir <b>una</b> de estas túnicas. Sólo la pueden usar los nobles y <b>no se cae al morir</b>.'}</p>${cartas}</div>`, 'nobleza');
  paintIcons(document.querySelector('.cj-win'));
  document.querySelectorAll('[data-nb]').forEach((b) => { b.onclick = async () => {
    const n = b.closest('.cj-fila').querySelector('b').textContent;
    if (await confirmar(`¿Elegís la ${n}? Sólo se puede elegir una vez.`, 'Elegir')) send({ t: 'noble', obj: +b.dataset.nb });
  }; });
});
on('canje', (m) => {
  const filas = m.premios.map((x) => {
    const est = x.hecho ? '<span class="cj-ok">✔ Reclamado</span>'
      : x.puede ? (m.lejos ? `<span class="cj-ok">¡Listo! Reclamalo en ${esc(m.lejos)}</span>` : `<button class="btn sm main" data-cj="${x.i}">Reclamar</button>`)
      : `<span class="cj-falta">Faltan ${x.kills - m.kills}</span>`;
    const def = x.xd ? ` · Def ${x.md}-${x.xd}` : '';
    return `<div class="cj-fila${x.hecho ? ' hecho' : ''}"><canvas width="32" height="32" data-g="${x.g}"></canvas>
      <div class="cj-info"><b>${esc(x.n)}</b><span>${x.kills} ${esc(m.otro.toLowerCase())} matados${def}</span>${x.aviso ? `<span class="cj-aviso">${esc(x.aviso)}</span>` : ''}</div>${est}</div>`;
  }).join('');
  openModal(m.lejos ? `Premios por kills (${m.nombre})` : m.bando === 'ciu' ? 'Comandante de la Armada' : 'Comandante del Caos',
    `<div class="cj-win"><p class="hint">${esc(m.otro)} matados: <b>${m.kills}</b>. Cada premio se reclama una sola vez y <b>no se cae al morir</b>. Sólo lo pueden usar los ${esc(m.nombre)}.</p>${filas}</div>`, 'canje');
  paintIcons(document.querySelector('.cj-win'));
  document.querySelectorAll('[data-cj]').forEach((b) => { b.onclick = () => send({ t: 'canje', i: +b.dataset.cj }); });
});

N.onClose = () => {
  if (S.inGame) {
    S.inGame = false;
    closeModal();
    show('scr-login');
    $('l-err').textContent = S.byeText || 'Se perdió la conexión con el servidor.';
    S.byeText = null;
    E.chars.clear(); E.map = null;
  }
  $('b-login').disabled = false; $('c-ok').disabled = false;
  setTimeout(statusLine, 2000);
};

// ================== CONSOLA ==================
function esc(s) { return String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]); }
// Al hacer clic en un personaje: nombre y qué es, bien grande
on('ver', (m) => {
  const el = $('console');
  const atBottom = el.scrollTop + el.clientHeight >= el.scrollHeight - 20;
  const d = document.createElement('div');
  d.className = 'c-ver ver-' + m.k + (m.noble && m.k !== 'gm' ? ' ver-nb' : '');
  d.innerHTML = `<span class="ver-n">${esc(m.n)}</span>${m.clan ? `<span class="ver-clan">del clan <b>${esc(m.clan)}</b></span>` : ''}<span class="ver-tag">${esc(m.tipo)}</span>${m.noble ? '<span class="ver-tag ver-noble">Noble</span>' : ''}${m.muerto ? '<span class="ver-muerto">✝ Muerto</span>' : ''}${m.desc ? `<span class="ver-desc">“${esc(m.desc)}”</span>` : ''}`;
  el.appendChild(d);
  if (atBottom) el.scrollTop = el.scrollHeight;
});

// ================== 800x600 ==================
// La pantalla de juego mide siempre 800x600 (como el AO original) y se agranda o achica
// entera para llenar la ventana, sin importar el tamaño de la pantalla.
function escalar() {
  const s = Math.min(window.innerWidth / 800, window.innerHeight / 600);
  document.documentElement.style.setProperty('--s', s);
  if (E.canvas) Eng.resize();
}
window.addEventListener('resize', escalar);
escalar();

function log(text, color = 'info') {
  const el = $('console');
  const atBottom = el.scrollTop + el.clientHeight >= el.scrollHeight - 20;
  const d = document.createElement('div');
  d.className = 'c-' + color;
  d.textContent = text;
  el.appendChild(d);
  while (el.childNodes.length > 300) el.removeChild(el.firstChild);
  if (atBottom) el.scrollTop = el.scrollHeight;
}

// ================== ESTADÍSTICAS ==================
function bar(id, v, max) {
  const pct = max > 0 ? Math.max(0, Math.min(100, (v / max) * 100)) : 0;
  $('b-' + id).style.width = pct + '%';
  $('t-' + id).textContent = max > 0 ? `${v}/${max}` : '-';
}
function renderStats() {
  const s = S.stats;
  $('s-name').textContent = S.name;
  $('s-name').style.color = S.gm ? '#ff8c1a' : s.crim ? '#ff5a4a' : '#e0b45a';
  $('s-class').textContent = `${s.clase || ''} ${s.raza || ''}` + (s.skillPts ? ` · ${s.skillPts} skillpoints libres` : '');
  $('s-level').innerHTML = `Nivel <b>${s.lvl || 1}</b>`;
  const pct = s.elu ? Math.floor((s.exp / s.elu) * 10000) / 100 : 100;
  $('s-exp-pct').textContent = `[${pct.toLocaleString('es-AR')}%]`;
  bar('hp', s.hp, s.maxHp); bar('man', s.man, s.maxMan); bar('sta', s.sta, s.maxSta);
  bar('ham', s.ham, 100); bar('sed', s.sed, 100);
  bar('exp', s.exp, s.elu);
  $('t-exp').textContent = s.elu ? `Exp: ${s.exp}/${s.elu}` : 'Nivel máximo';
  $('s-gold').textContent = (s.gld || 0).toLocaleString('es-AR');
  $('bb-ag').textContent = s.ag ?? '-';
  $('bb-fu').textContent = s.fu ?? '-';
  if (s.def) $('bb-def').textContent = `${s.def[0]}/${s.def[1]}`;
  $('bb-gm').classList.toggle('hidden', !S.gm);
  renderState();
}
function renderBottomWeapon() {
  const w = S.inv.find((x) => x && x.eq && x.ty === 2);
  $('bb-hit').textContent = w ? `${w.mh}/${w.xh}` : '-';
}
function renderState() {
  const s = S.stats, st = [];
  if (s.dead) st.push('☠ Estás muerto (/HOGAR o buscá un sacerdote)');
  if (S.paralyzed) st.push('Paralizado');
  if (S.meditando) st.push('Meditando...');
  if (MACRO.on) st.push(`⚡ MACRO F7: ${(S.spells[MACRO.slot] || {}).n || ''} sobre ${MACRO.nombre || ''}`);
  $('bb-state').textContent = st.join(' · ');
}
function updatePos() {
  const c = E.chars.get(S.me);
  if (c) $('s-pos').textContent = `(${E.mapNum}, ${c.x}, ${c.y}) · ${Clima.textoHora()}`;
}

// ================== INVENTARIO ==================
function buildInventory() {
  const g = $('inv-grid');
  g.innerHTML = '';
  for (let i = 0; i < 25; i++) {
    const d = document.createElement('div');
    d.className = 'slot'; d.dataset.i = i; d.draggable = true;
    d.innerHTML = '<canvas width="32" height="32"></canvas><span class="amt"></span><span class="eq"></span>';
    d.onclick = () => selectSlot(i);
    d.ondblclick = () => { selectSlot(i); if (EQUIPABLE.has((S.inv[i] || {}).ty)) equipSelected(); else useSelected(); };
    d.ondragstart = (e) => e.dataTransfer.setData('text/plain', String(i));
    d.ondragover = (e) => e.preventDefault();
    d.ondrop = (e) => { e.preventDefault(); const a = +e.dataTransfer.getData('text/plain'); if (a !== i) send({ t: 'swapInv', a, b: i }); };
    g.appendChild(d);
    renderSlot(i);
  }
}
function renderSlot(i) {
  const d = $('inv-grid').children[i];
  if (!d) return;
  const it = S.inv[i];
  const cv = d.querySelector('canvas');
  const ctx = cv.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  if (it) {
    if (!drawIcon(ctx, it.g)) setTimeout(() => renderSlot(i), 400);
  } else ctx.clearRect(0, 0, 32, 32);
  d.querySelector('.amt').textContent = it && it.a > 1 ? it.a : '';
  d.querySelector('.eq').textContent = it && it.eq ? '+' : '';
  d.classList.toggle('sel', i === S.selSlot);
}
function selectSlot(i) {
  const prev = S.selSlot;
  S.selSlot = i;
  if (prev >= 0) renderSlot(prev);
  renderSlot(i);
  showSlotInfo();
}
function itemDesc(it) {
  let t = it.n;
  if (it.xh) t += ` — Golpe ${it.mh}/${it.xh}`;
  if (it.xd) t += ` — Defensa ${it.md}/${it.xd}`;
  return t;
}
function showSlotInfo() {
  const it = S.inv[S.selSlot];
  $('inv-info').textContent = it ? `${itemDesc(it)}${it.a > 1 ? ` (${it.a})` : ''}${it.eq ? ' [equipado]' : ''}` : '';
}
// Tipos de objeto que se equipan (arma, armadura, escudo, casco, montura, flechas); el resto se consume
const EQUIPABLE = new Set([2, 3, 16, 17, 25, 32]);
function useSelected() { if (S.inv[S.selSlot]) send({ t: 'use', i: S.selSlot }); }
function equipSelected() { if (S.inv[S.selSlot]) send({ t: 'equip', i: S.selSlot }); }
async function dropSelected() {
  const it = S.inv[S.selSlot];
  if (!it) {
    const v = await askNumber('¿Cuánto oro querés tirar?', 1);
    if (v) send({ t: 'drop', gold: 1, a: v });
    return;
  }
  const v = it.a > 1 ? await askNumber(`¿Cuántos ${it.n} querés tirar?`, it.a) : 1;
  if (v) send({ t: 'drop', i: S.selSlot, a: v });
}
$('b-use').onclick = useSelected;
$('b-equip').onclick = equipSelected;
$('b-drop').onclick = dropSelected;

// ================== HECHIZOS ==================
function renderSpells() {
  const l = $('spell-list');
  l.innerHTML = '';
  S.spells.forEach((s, i) => {
    const d = document.createElement('div');
    d.className = 'spell' + (s.id ? '' : ' empty') + (i === S.selSpell ? ' sel' : '');
    d.textContent = s.id ? s.n : '(Nada)';
    if (s.id) d.title = `Maná: ${s.mana}`;
    d.onclick = () => { S.selSpell = i; renderSpells(); };
    d.ondblclick = () => { S.selSpell = i; startCast(); };
    l.appendChild(d);
  });
}
function startCast() {
  const sp = S.spells[S.selSpell];
  if (!sp || !sp.id) return log('Elegí un hechizo de la lista.', 'warn');
  setTarget('cast');
  log(`Elegí el objetivo para ${sp.n}.`, 'spell');
}
function setTarget(mode) {
  S.targetMode = mode;
  E.targeting = !!mode;
  $('view').classList.toggle('target', !!mode);
}
$('b-cast').onclick = startCast;
$('b-sp-up').onclick = () => { if (S.selSpell > 0) { send({ t: 'swapSpell', a: S.selSpell, b: S.selSpell - 1 }); S.selSpell--; } };
$('b-sp-down').onclick = () => { if (S.selSpell >= 0 && S.selSpell < 34) { send({ t: 'swapSpell', a: S.selSpell, b: S.selSpell + 1 }); S.selSpell++; } };

document.querySelectorAll('.tab').forEach((t) => {
  t.onclick = () => {
    document.querySelectorAll('.tab').forEach((x) => x.classList.toggle('active', x === t));
    $('tab-inv').classList.toggle('hidden', t.dataset.tab !== 'inv');
    $('tab-spells').classList.toggle('hidden', t.dataset.tab !== 'spells');
  };
});

// ================== BOTONES ==================
$('b-skills').onclick = () => openSkills();
$('b-stats').onclick = () => send({ t: 'talk', text: '/EST' });
$('b-med').onclick = () => send({ t: 'meditate' });
$('b-help').onclick = () => openHelp();
$('b-sound').textContent = Snd.AU.on ? '🔊 Sonido: sí' : '🔇 Sonido: no';
$('b-sound').onclick = () => { $('b-sound').textContent = Snd.toggle() ? '🔊 Sonido: sí' : '🔇 Sonido: no'; };
$('b-mapa').onclick = () => Mapas.abrirMundo(openModal, send, S.gm, esc);
ClanesUI.init({ openModal, closeModal, send, esc, log, S });
ClanesUI.mensajes(on);
$('b-clanes').onclick = () => ClanesUI.abrir();
MisionesUI.init({ openModal, send, esc, S });
MisionesUI.mensajes(on);
ObjetosUI.init({ openModal, closeModal, send, esc, S });
ObjetosUI.mensajes(on);
TiendasUI.init({ openModal, closeModal, send, esc, S });
TiendasUI.mensajes(on);
PuntosUI.init({ openModal, send, esc, abrirMisiones: () => MisionesUI.abrir() });
PuntosUI.mensajes(on);
TesteoUI.init({ openModal, closeModal, send, esc });
TesteoUI.mensajes(on);
$('b-puntos').onclick = () => PuntosUI.abrir();
$('b-misiones').onclick = () => MisionesUI.abrir();
$('b-capa').onclick = () => send({ t: 'capa' });
// Marcador de la guerra (arriba al centro del juego)
const GUERRA = { fin: 0, iv: 0, datos: null };
function pintarGuerra() {
  const el = $('guerra-hud'), g = GUERRA.datos;
  if (!g || !g.activa || !g.bando) { el.classList.add('hidden'); clearInterval(GUERRA.iv); GUERRA.iv = 0; return; }
  const resta = Math.max(0, GUERRA.fin - Date.now());
  const mm = String(Math.floor(resta / 60000)).padStart(2, '0'), ss = String(Math.floor((resta % 60000) / 1000)).padStart(2, '0');
  el.classList.remove('hidden');
  el.innerHTML = `<div class="gh-tit">⚔ GUERRA · ${mm}:${ss}</div>
    <div class="gh-marc"><span class="gh-ciu${g.bando === 'ciu' ? ' yo' : ''}">Ciudadanos <b>${g.ciu}</b></span><span class="gh-vs">vs</span><span class="gh-cri${g.bando === 'cri' ? ' yo' : ''}"><b>${g.cri}</b> Criminales</span></div>
    <div class="gh-yo">Tus kills en esta guerra: <b>${g.mias}</b> · Kills para canjear: <b>${g.total}</b></div>`;
}
on('guerraEstado', (m) => {
  GUERRA.datos = m; GUERRA.fin = Date.now() + (m.quedan || 0);
  if (m.activa && m.bando && !GUERRA.iv) GUERRA.iv = setInterval(pintarGuerra, 1000);
  pintarGuerra();
});
on('capaEstado', (m) => { $('b-capa').textContent = 'Capa: ' + (m.on ? 'sí' : 'no'); });
$('minimap').addEventListener('click', (e) => Mapas.minimapaClic(e, send, S.gm));
$('minimap').addEventListener('dblclick', () => Mapas.abrirMundo(openModal, send, S.gm, esc));
const miniOn = localStorage.getItem('ao_minimapa') !== '0';
$('minimap').classList.toggle('hidden', !miniOn);
$('b-mini').textContent = 'Minimapa: ' + (miniOn ? 'sí' : 'no');
$('b-mini').onclick = () => {
  const on = $('minimap').classList.toggle('hidden') === false;
  localStorage.setItem('ao_minimapa', on ? '1' : '0');
  $('b-mini').textContent = 'Minimapa: ' + (on ? 'sí' : 'no');
};
$('b-names').onclick = () => { E.showNames = !E.showNames; $('b-names').textContent = 'Nombres: ' + (E.showNames ? 'sí' : 'no'); };
// Menús desplegables de OPCIONES y MENÚ
function togglePop(id) {
  for (const p of ['pop-menu', 'pop-opts']) $(p).classList.toggle('hidden', p !== id || !$(p).classList.contains('hidden'));
}
$('b-menu').onclick = (e) => { e.stopPropagation(); togglePop('pop-menu'); };
$('b-opts').onclick = (e) => { e.stopPropagation(); togglePop('pop-opts'); };
document.addEventListener('click', (e) => {
  if (!e.target.closest('.pop')) { $('pop-menu').classList.add('hidden'); $('pop-opts').classList.add('hidden'); }
});
$('b-spinfo').onclick = () => {
  const sp = S.spells[S.selSpell];
  if (!sp || !sp.id) return log('Elegí un hechizo de la lista.', 'warn');
  openModal(sp.n, `<div style="max-width:420px;line-height:1.5">${esc(sp.d || '')}<br><br>
    <b>Maná:</b> ${sp.mana} · <b>Skill de magia necesario:</b> ${sp.sk || 0}${sp.w ? `<br><b>Palabras mágicas:</b> ${esc(sp.w)}` : ''}</div>`);
};
$('b-exit').onclick = () => { S.byeText = 'Saliste del juego.'; send({ t: 'logout' }); };

// ================== VENTANAS ==================
function openModal(title, html, kind = 'generic') {
  $('m-title').textContent = title;
  $('m-body').innerHTML = html;
  $('modal').classList.remove('hidden');
  S.modal = kind;
}
function closeModal() {
  const k = S.modal;
  $('modal').classList.add('hidden');
  S.modal = null;
  if (k === 'trade' || k === 'bank') send({ t: 'endTrade' });
  if (S.askResolve) { S.askResolve(0); S.askResolve = null; }
}
$('m-close').onclick = closeModal;

function askNumber(text, max) {
  return new Promise((resolve) => {
    const prevModal = S.modal;
    if (prevModal === 'trade' || prevModal === 'bank') {
      // dentro de comercio/banco usamos el campo de cantidad de la ventana
      const v = Math.max(1, Math.min(max, +($('m-amount') || {}).value || 1));
      resolve(v); return;
    }
    openModal('Cantidad', `<p>${esc(text)}</p><input id="ask-n" type="number" min="1" max="${max}" value="${max}" style="width:100%">
      <div class="row"><button class="btn main" id="ask-ok">Aceptar</button></div>`, 'ask');
    S.askResolve = resolve;
    const inp = $('ask-n');
    inp.focus(); inp.select();
    const ok = () => { const v = Math.floor(+inp.value || 0); S.askResolve = null; closeModal(); resolve(v > 0 ? v : 0); };
    $('ask-ok').onclick = ok;
    inp.onkeydown = (e) => { if (e.key === 'Enter') ok(); if (e.key === 'Escape') closeModal(); e.stopPropagation(); };
  });
}

function itemRow(it, price, sel, attr) {
  return `<div class="li${sel ? ' sel' : ''}" data-${attr}="${it.i}"><canvas width="32" height="32" data-g="${it.g}"></canvas>
    <span>${esc(itemDesc(it))}${it.a > 1 && it.a < 10000 ? ` (${it.a})` : ''}</span>${price !== null ? `<span class="price">${price}</span>` : ''}</div>`;
}
function paintIcons(root) {
  root.querySelectorAll('canvas[data-g]').forEach((c) => {
    const ctx = c.getContext('2d'); ctx.imageSmoothingEnabled = false;
    const g = +c.dataset.g;
    if (!drawIcon(ctx, g)) setTimeout(() => drawIcon(ctx, g), 500);
  });
}

function renderTrade() {
  const t = S.trade;
  if (!t) return;
  const sel = S.tradeSel;
  const amount = $('m-amount') ? $('m-amount').value : 1;
  // Casa de Hechizos: una solapa por clase, cada una con sólo sus hechizos
  let solapas = '';
  let lista = t.items;
  if (t.clases) {
    if (!S.solapa || !t.clases.includes(S.solapa)) S.solapa = t.miClase || t.clases[0];
    solapas = `<div class="tr-tabs">${t.clases.map((c) => `<button class="tab${c === S.solapa ? ' active' : ''}" data-sol="${esc(c)}">${esc(c)}${c === t.miClase ? ' ★' : ''}</button>`).join('')}</div>`;
    lista = t.items.filter((it) => it.cl && it.cl.includes(S.solapa));
  }
  const npcList = lista.map((it) => itemRow(it, it.price, sel.npc === it.i, 'n')).join('');
  const invList = S.inv.filter(Boolean).map((it) => itemRow(it, it.v, sel.inv === it.i, 'p')).join('');
  openModal(`Comerciar con ${t.npc}`, `${solapas}${t.clases && S.solapa !== t.miClase ? '<p class="hint">Estás viendo los hechizos de otra clase: sólo podés comprar los de la tuya (★).</p>' : ''}<div class="trade">
    <div><b>${esc(t.npc)}</b><div class="list" id="tl-n">${npcList}</div><button class="btn main" id="t-buy">Comprar</button></div>
    <div><b>Tu inventario</b><div class="list" id="tl-p">${invList}</div><button class="btn main" id="t-sell">Vender</button></div>
    </div><div class="row">Cantidad <input id="m-amount" type="number" min="1" value="${amount}" style="width:80px"> &nbsp; Tu oro: <b style="color:var(--gold)">${(S.stats.gld || 0).toLocaleString('es-AR')}</b></div>`, 'trade');
  paintIcons($('m-body'));
  $('m-body').querySelectorAll('[data-n]').forEach((el) => { el.onclick = () => { sel.npc = +el.dataset.n; renderTrade(); }; });
  $('m-body').querySelectorAll('[data-sol]').forEach((el) => { el.onclick = () => { S.solapa = el.dataset.sol; sel.npc = -1; renderTrade(); }; });
  $('m-body').querySelectorAll('[data-p]').forEach((el) => { el.onclick = () => { sel.inv = +el.dataset.p; renderTrade(); }; });
  $('t-buy').onclick = () => { if (sel.npc >= 0) send({ t: 'buy', i: sel.npc, a: +$('m-amount').value || 1 }); };
  $('t-sell').onclick = () => { if (sel.inv >= 0) send({ t: 'sell', i: sel.inv, a: +$('m-amount').value || 1 }); };
  $('m-amount').onkeydown = (e) => e.stopPropagation();
}

function renderBank() {
  const b = S.bank;
  if (!b) return;
  const sel = S.bankSel;
  const amount = $('m-amount') ? $('m-amount').value : 1;
  const bankList = b.items.filter((it) => it.id).map((it) => itemRow(it, null, sel.bank === it.i, 'b')).join('');
  const invList = S.inv.filter(Boolean).map((it) => itemRow(it, null, sel.inv === it.i, 'p')).join('');
  openModal('Banco', `<div class="trade">
    <div><b>Tu bóveda</b><div class="list">${bankList}</div><button class="btn main" id="bk-wit">Retirar</button></div>
    <div><b>Tu inventario</b><div class="list">${invList}</div><button class="btn main" id="bk-dep">Depositar</button></div>
    </div><div class="row">Cantidad <input id="m-amount" type="number" min="1" value="${amount}" style="width:80px"></div>
    <div class="row">Oro en el banco: <b style="color:var(--gold)">${(b.gld || 0).toLocaleString('es-AR')}</b> | Encima: <b style="color:var(--gold)">${(S.stats.gld || 0).toLocaleString('es-AR')}</b></div>
    <div class="row"><button class="btn" id="bk-gdep">Depositar oro</button><button class="btn" id="bk-gwit">Retirar oro</button></div>`, 'bank');
  paintIcons($('m-body'));
  $('m-body').querySelectorAll('[data-b]').forEach((el) => { el.onclick = () => { sel.bank = +el.dataset.b; renderBank(); }; });
  $('m-body').querySelectorAll('[data-p]').forEach((el) => { el.onclick = () => { sel.inv = +el.dataset.p; renderBank(); }; });
  const amt = () => +$('m-amount').value || 1;
  $('bk-wit').onclick = () => { if (sel.bank >= 0) send({ t: 'bankWit', i: sel.bank, a: amt() }); };
  $('bk-dep').onclick = () => { if (sel.inv >= 0) send({ t: 'bankDep', i: sel.inv, a: amt() }); };
  $('bk-gdep').onclick = () => send({ t: 'bankGold', a: amt(), dep: 1 });
  $('bk-gwit').onclick = () => send({ t: 'bankGold', a: amt(), dep: 0 });
  $('m-amount').onkeydown = (e) => e.stopPropagation();
}

function openSkills() {
  const sk = S.skills;
  if (!sk) return;
  S.skillAdd = S.skillAdd || new Array(sk.names.length).fill(0);
  const used = S.skillAdd.reduce((a, b) => a + b, 0);
  const free = sk.free - used;
  const rows = sk.names.map((n, i) => `<div class="skill-row"><span>${esc(n)}</span><b>${sk.values[i] + S.skillAdd[i]}</b>
    <button class="btn sm" data-m="${i}">-</button><button class="btn sm" data-p="${i}">+</button></div>`).join('');
  openModal('Skills', `<p>Puntos libres: <b style="color:var(--gold)">${free}</b></p>
    <div style="columns:2;column-gap:20px">${rows}</div>
    <div class="row"><button class="btn main" id="sk-ok">Confirmar</button></div>`, 'skills');
  $('m-body').querySelectorAll('[data-p]').forEach((b) => {
    b.onclick = () => { const i = +b.dataset.p; if (free > 0 && sk.values[i] + S.skillAdd[i] < 100) { S.skillAdd[i]++; openSkills(); } };
  });
  $('m-body').querySelectorAll('[data-m]').forEach((b) => {
    b.onclick = () => { const i = +b.dataset.m; if (S.skillAdd[i] > 0) { S.skillAdd[i]--; openSkills(); } };
  });
  $('sk-ok').onclick = () => { send({ t: 'skills', v: S.skillAdd }); S.skillAdd = null; closeModal(); };
}

function openClassUp(m) {
  openModal('¡Podés evolucionar!', `<p>Sos <b>${esc(m.actual)}</b>. Elegí tu nueva clase (no se puede deshacer):</p>
    <div class="class-opts">${m.opciones.map((o) => `<button class="btn main" data-c="${o.id}">${esc(o.n)}</button>`).join('')}</div>
    <p class="hint">Si cerrás esta ventana, podés elegir más tarde: aparece cada vez que entrás.</p>`, 'classup');
  $('m-body').querySelectorAll('[data-c]').forEach((b) => {
    b.onclick = () => { send({ t: 'classup', c: +b.dataset.c }); closeModal(); };
  });
}

function openHelp() {
  openModal('Ayuda', `<div style="max-width:520px;line-height:1.6">
    <b>Controles — modo ${MODO === 'moderno' ? 'MODERNO' : 'CLÁSICO'}</b> (cambialo con el botón ⌨)<br>
    ${MODO === 'moderno'
    ? 'WASD o flechas: caminar · <b>Espacio: consumir</b> (pociones, comida, bebida, pergaminos: seleccioná la poción y apretá Espacio para potear)<br><b>E: equipar / desequipar</b> (armas, armaduras, escudos, cascos, monturas) · doble clic: hace lo que corresponda<br>Ctrl: atacar · Q: agarrar · F: meditar · M: mapa del mundo · T tirar<br><b>F7: macro</b> (elegí un hechizo y apretá F7: le tira solo a un bicho hasta que muere, y se potea)<br>'
    : 'Flechas: caminar · Ctrl: atacar · A: agarrar objeto · M: meditar<br>U: usar objeto · E: equipar · T: tirar<br>'}
    Enter: hablar · Esc: cancelar · Clic: mirar · Doble clic: comerciar / banco / sacerdote / puertas<br>
    Hechizos: elegí uno en la pestaña Hechizos, tocá "Lanzar" y hacé clic en el objetivo.<br>
    Arcos: equipá el arco y las flechas, presioná Ctrl y hacé clic en el objetivo.<br><br>
    <b>Comandos útiles</b><br>
    /ONLINE /EST /MEDITAR /SEGURO /HOGAR /GM mensaje /GLOBAL mensaje<br>
    \\nombre mensaje = susurrar · /SALIR<br>
    ${S.gm ? '<br><b style="color:#ff8c1a">Sos GM:</b> <b>clic derecho</b> en el mapa = teletransportarte ahí. Escribí /GMAYUDA en el chat para ver todos tus comandos.' : ''}
  </div>`);
}

// ================== MACRO F7 ==================
// Con un hechizo elegido, F7 lo tira solo sobre UN bicho (el que clickeaste o, si no, el más
// cercano en pantalla) y toma pociones: azul cuando falta maná, roja si la vida baja.
// Cuando ese bicho muere (o desaparece), la macro se apaga sola: se vuelve a activar con F7.
const MACRO = { on: false, slot: -1, target: 0, iv: 0, lastCast: 0, lastPot: 0, avisoSinBicho: 0 };

function enPantalla(c) {
  const px = (c.x - 1) * 32, py = (c.y - 1) * 32;
  return px >= E.camX - 16 && px <= E.camX + E.viewW - 16 && py >= E.camY - 16 && py <= E.camY + E.viewH - 16;
}
function bichoMasCercano() {
  const me = E.chars.get(S.me);
  let mejor = null, d = 1e9;
  for (const c of E.chars.values()) {
    if (!c.npc || c.col !== 'npc_h' || !enPantalla(c)) continue;
    const dd = Math.abs(c.x - me.x) + Math.abs(c.y - me.y);
    if (dd < d) { d = dd; mejor = c; }
  }
  return mejor;
}
function iniciarMacro() {
  const sp = S.spells[S.selSpell];
  if (!sp || !sp.id) { log('Para usar la macro: elegí un hechizo en la pestaña HECHIZOS y apretá F7.', 'warn'); return; }
  const obj = E.chars.get(S.objetivo);
  const t = obj && obj.npc && enPantalla(obj) ? obj : bichoMasCercano();
  if (!t) { log('Macro F7: no hay ningún bicho en pantalla.', 'warn'); return; }
  MACRO.on = true; MACRO.slot = S.selSpell; MACRO.target = t.id; MACRO.nombre = t.n;
  MACRO.iv = setInterval(tickMacro, 100);
  log(`Macro F7 activada: ${sp.n} sobre ${t.n}. Se apaga sola cuando muere (F7 o caminar también la frenan).`, 'server');
  renderState();
}
function pararMacro(motivo) {
  if (!MACRO.on) return;
  MACRO.on = false; clearInterval(MACRO.iv);
  log(`Macro F7 desactivada${motivo ? ` (${motivo})` : ''}.`, 'server');
  renderState();
}
function tickMacro() {
  if (!S.inGame) return pararMacro();
  const s = S.stats;
  if (s.dead) return pararMacro('estás muerto');
  const now = Date.now();
  const sp = S.spells[MACRO.slot];
  if (!sp || !sp.id) return pararMacro('no hay hechizo');
  // autopoteo (una poción cada 0,4 s como máximo)
  if (now - MACRO.lastPot > 400) {
    const poc = (tipo) => S.inv.find((x) => x && x.ty === 11 && x.pt === tipo);
    if (s.maxHp && s.hp < s.maxHp * 0.5 && poc(3)) { send({ t: 'use', i: poc(3).i }); MACRO.lastPot = now; return; }
    if (s.maxMan && s.man < Math.max(sp.mana, s.maxMan * 0.35) && poc(4)) { send({ t: 'use', i: poc(4).i }); MACRO.lastPot = now; return; }
  }
  // tirar el hechizo
  if (s.man < sp.mana) {
    if (now - (MACRO.avisoMana || 0) > 8000) { MACRO.avisoMana = now; log('Macro F7: no te queda maná ni pociones azules.', 'warn'); }
    return;
  }
  if (now - MACRO.lastCast < 1050) return;
  const t = E.chars.get(MACRO.target);
  if (!t) return pararMacro(`${MACRO.nombre || 'el bicho'} murió`);
  if (!enPantalla(t)) return pararMacro(`${MACRO.nombre || 'el bicho'} se fue de la pantalla`);
  MACRO.lastCast = now;
  send({ t: 'cast', i: MACRO.slot, x: t.x, y: t.y });
}

// ================== CONTROLES ==================
const chat = $('chat');
chat.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    const t = chat.value.trim();
    if (t) send({ t: 'talk', text: t });
    chat.value = '';
    chat.blur();
    e.preventDefault();
  } else if (e.key === 'Escape') { chat.value = ''; chat.blur(); }
  e.stopPropagation();
});

function atacar() {
  const it = S.inv.find((x) => x && x.eq && x.ty === 2);
  if (it && it.pr) { setTarget('shoot'); log('Hacé clic sobre el objetivo.', 'info'); }
  else send({ t: 'attack' });
}

window.addEventListener('keydown', (e) => {
  if (!S.inGame) return;
  if (document.activeElement && ['INPUT', 'SELECT', 'TEXTAREA'].includes(document.activeElement.tagName)) return;
  if (S.modal && e.key === 'Escape') { closeModal(); return; }
  // Enter con una ventana abierta: la cierra y te deja escribir en el chat
  if (S.modal && e.key === 'Enter' && !['ask', 'clanEditor', 'trade', 'bank'].includes(S.modal)) { closeModal(); chat.focus(); e.preventDefault(); return; }
  if (S.modal === 'mundo' && e.code === 'KeyM' && MODO === 'moderno') { closeModal(); return; }
  if (S.modal && S.modal !== 'trade' && S.modal !== 'bank') return;
  const code = e.code;
  if (dirOf(code)) { S.keys.add(code); S.lastKey = code; e.preventDefault(); if (MACRO.on) pararMacro('te moviste'); return; }
  if (e.key === 'Enter') { chat.focus(); e.preventDefault(); return; }
  if (e.key === 'Escape') { setTarget(null); return; }
  if (e.key === 'F1') { openHelp(); e.preventDefault(); return; }
  if (e.key === 'F7') { e.preventDefault(); if (!e.repeat) (MACRO.on ? pararMacro('F7') : iniciarMacro()); return; }
  if (e.key === 'Control') { atacar(); return; }
  if (e.repeat && code !== 'Space') return;
  if (MODO === 'moderno') {
    switch (code) {
      // Espacio: usa el objeto seleccionado (seleccioná la poción y apretá Espacio para potear)
      case 'Space': useSelected(); e.preventDefault(); return;
      case 'KeyQ': send({ t: 'pick' }); return;
      case 'KeyM': Mapas.abrirMundo(openModal, send, S.gm, esc); return;
      case 'KeyF': send({ t: 'meditate' }); return;
      case 'KeyE': equipSelected(); return;
      case 'KeyU': useSelected(); return;
      case 'KeyT': e.preventDefault(); dropSelected(); return;
      case 'KeyN': E.showNames = !E.showNames; return;
      default:
    }
  } else {
    switch (code) {
      case 'KeyA': send({ t: 'pick' }); return;
      case 'KeyM': send({ t: 'meditate' }); return;
      case 'KeyU': useSelected(); return;
      case 'KeyE': equipSelected(); return;
      case 'KeyT': e.preventDefault(); dropSelected(); return;
      case 'KeyN': E.showNames = !E.showNames; return;
      default:
    }
  }
});
window.addEventListener('keyup', (e) => { S.keys.delete(e.code); });
window.addEventListener('blur', () => S.keys.clear());

function setModo(m) {
  MODO = m;
  localStorage.setItem('ao_teclas', m);
  $('b-keys').textContent = m === 'moderno' ? '⌨ Moderno' : '⌨ Clásico';
}
$('b-keys').onclick = () => {
  setModo(MODO === 'moderno' ? 'clasico' : 'moderno');
  log(MODO === 'moderno'
    ? 'Modo MODERNO: WASD caminar · Espacio consumir (potear) · E equipar · Ctrl atacar · Q agarrar · F meditar · M mapa'
    : 'Modo CLÁSICO: flechas caminar · Ctrl atacar · A agarrar · M meditar · U usar · E equipar · T tirar', 'server');
};
setModo(MODO);

function tryWalk(now) {
  if (!S.keys.size || S.loadingMap || S.modal === 'ask') return;
  const me = E.chars.get(S.me);
  if (!me || !E.map) return;
  const WALK_MS = walkMs();
  if (now - S.lastStep < WALK_MS) return;
  const key = S.keys.has(S.lastKey) ? S.lastKey : [...S.keys][0];
  const d = dirOf(key);
  if (!d) return;
  // Si venía caminando, el paso nuevo empieza justo cuando terminó el anterior (sin pausas)
  const encadenado = now - S.lastStep < WALK_MS + 60;
  S.lastStep = encadenado ? S.lastStep + WALK_MS : now;
  if (S.paralyzed && !S.gm) { if (me.h !== d) { me.h = d; send({ t: 'turn', d }); } return; }
  const [dx, dy] = DXY[d];
  const nx = me.x + dx, ny = me.y + dy;
  const blockedTile = nx < 1 || ny < 1 || nx > 100 || ny > 100 || E.blocked[idx(nx, ny)];
  const other = Eng.charAt(nx, ny, false);
  const occupied = other && other.id !== S.me && !(me.dead) && !other.dead;
  if (blockedTile || occupied) {
    if (me.h !== d) { me.h = d; send({ t: 'turn', d }); }
    // los GMs con /CAMINAR pueden pasar: le dejamos decidir al servidor
    if (S.gm >= 2 && blockedTile && !occupied) send({ t: 'move', d });
    return;
  }
  Eng.moveChar(S.me, nx, ny, d, S.lastStep);
  send({ t: 'move', d, x: nx, y: ny });
  updatePos();
}

const view = $('view');
view.addEventListener('mousemove', (e) => { E.mouseTile = Eng.screenToTile(e.clientX, e.clientY); });
view.addEventListener('mouseleave', () => { E.mouseTile = null; });
view.addEventListener('click', (e) => {
  chat.blur();
  const t = Eng.screenToTile(e.clientX, e.clientY);
  if (S.targetMode === 'cast') { send({ t: 'cast', i: S.selSpell, x: t.x, y: t.y }); setTarget(null); return; }
  if (S.targetMode === 'shoot') { send({ t: 'shoot', x: t.x, y: t.y }); setTarget(null); return; }
  send({ t: 'click', x: t.x, y: t.y });
  const c = Eng.charAt(t.x, t.y, false);
  if (c && c.npc) { S.objetivo = c.id; if (MACRO.on) MACRO.target = c.id; }
});
view.addEventListener('dblclick', (e) => {
  const t = Eng.screenToTile(e.clientX, e.clientY);
  send({ t: 'dclick', x: t.x, y: t.y });
});
view.addEventListener('contextmenu', (e) => {
  e.preventDefault();
  if (S.targetMode) { setTarget(null); return; }
  // GMs: clic derecho = teletransportarse a ese lugar
  if (S.gm > 0) {
    const t = Eng.screenToTile(e.clientX, e.clientY);
    send({ t: 'tp', x: t.x, y: t.y });
  }
});

// ================== BUCLE PRINCIPAL ==================
// ---- Reloj parejo ----
// En Windows el momento en que llega cada cuadro varía unos milisegundos (14, 19, 15, 18 ms...).
// Si el movimiento usara ese tiempo exacto, cada variación sería un saltito de la cámara.
// Por eso el juego avanza siempre lo mismo por cuadro (la duración típica de un cuadro de tu
// monitor) y sólo se corrige de a poco si se atrasa o adelanta de verdad.
const CLK = { last: 0, dts: [], frame: 1000 / 60, t: 0 };
const DIAG = { on: false, frames: [], start: 0 };
function tick(now) {
  if (!CLK.last) { CLK.last = now; CLK.t = now; return now; }
  const real = now - CLK.last;
  CLK.last = now;
  if (real > 0 && real < 100) {
    CLK.dts.push(real);
    if (CLK.dts.length > 60) CLK.dts.shift();
    if (CLK.dts.length >= 10 && CLK.dts.length % 10 === 0) {
      const sorted = [...CLK.dts].sort((a, b) => a - b);
      // se redondea a monitores comunes (60, 75, 120, 144, 165 Hz...) para que sea estable
      const hz = 1000 / sorted[Math.floor(sorted.length / 2)];
      const comunes = [50, 60, 75, 90, 100, 120, 144, 165, 240];
      const near = comunes.reduce((a, b) => (Math.abs(b - hz) < Math.abs(a - hz) ? b : a));
      CLK.frame = 1000 / (Math.abs(near - hz) < 4 ? near : hz);
      Eng.ajustarCaminata(CLK.frame);
    }
  }
  // si se perdió algún cuadro de verdad (la PC se trabó), avanzamos lo que corresponde
  const step = real > CLK.frame * 1.6 ? Math.min(real, 100) : CLK.frame;
  CLK.t += step;
  // corrección suave para no desfasarse del tiempo real
  // corrección suave para no desfasarse del tiempo real, SIN ir nunca para atrás
  // (si el reloj saltaba para atrás, el personaje se quedaba quieto un instante)
  const drift = now - CLK.t;
  if (drift > 250) CLK.t = now;
  else if (Math.abs(drift) > CLK.frame) CLK.t += Math.max(-step * 0.5, drift * 0.05);
  if (DIAG.on) DIAG.frames.push(real);
  return CLK.t;
}

let fpsShown = 0;
function loop(now) {
  const t = tick(now);
  E.time = t;
  if (S.inGame) {
    tryWalk(t);
    Eng.render(t);
    Mapas.dibujarMinimapa(now, { gm: S.gm });
    // el texto de fps se actualiza una vez por segundo (tocar la página en cada cuadro también traba)
    if (now - fpsShown > 1000) {
      fpsShown = now;
      $('fps').textContent = `${E.fps} fps${S.ping !== undefined ? ` · ${S.ping} ms` : ''}`;
      if (DIAG.on) renderDiag(now);
    }
  }
  requestAnimationFrame(loop);
}

// ---- Diagnóstico (tecla F3): para saber qué pasa en una PC que no puedo ver ----
const QS = new URLSearchParams(location.search);
function renderDiag(now) {
  const f = DIAG.frames.slice(-300);
  if (!f.length) return;
  const avg = f.reduce((a, b) => a + b, 0) / f.length;
  const sorted = [...f].sort((a, b) => a - b);
  const p95 = sorted[Math.floor(f.length * 0.95)], max = sorted[f.length - 1];
  const tirones = f.filter((x) => x > CLK.frame * 1.6).length;
  const varia = Math.sqrt(f.reduce((a, b) => a + (b - avg) ** 2, 0) / f.length);
  $('diag').innerHTML = `<b>DIAGNÓSTICO (F3)</b><br>Versión: ${esc(QS.get('v') || 'web')}<br>
    Cuadro promedio: ${avg.toFixed(1)} ms (${(1000 / avg).toFixed(0)} fps)<br>
    Monitor detectado: ${(1000 / CLK.frame).toFixed(0)} Hz<br>
    Variación entre cuadros: ${varia.toFixed(1)} ms<br>
    Cuadro más lento: ${max.toFixed(0)} ms · 95%: ${p95.toFixed(1)} ms<br>
    Cuadros perdidos (últimos 5 s): ${tirones}<br>
    Pantalla: ${E.canvas.width}x${E.canvas.height} · zoom ${E.zoom} · escala ${window.devicePixelRatio}<br>
    Placa de video: ${esc(QS.get('gpu') || 'desconocido')}<br>
    Modo de dibujo: ${E.lowRes ? 'liviano' : 'normal'}`;
}
window.addEventListener('keydown', (e) => {
  if (e.key !== 'F3') return;
  e.preventDefault();
  DIAG.on = !DIAG.on; DIAG.frames = [];
  $('diag').classList.toggle('hidden', !DIAG.on);
  if (DIAG.on) $('diag').textContent = 'Midiendo... caminá unos segundos.';
});
setInterval(() => { if (S.inGame) send({ t: 'ping', ts: Date.now() }); }, 5000);

// ================== INICIO ==================
(async function start() {
  Eng.init($('view'));
  escalar();
  $('srv-status').textContent = 'Cargando gráficos...';
  try {
    await loadIndexes();
  } catch (e) {
    $('srv-status').textContent = 'Error cargando los gráficos del juego.';
    return;
  }
  await Mapas.cargarMundo();
  $('l-name').value = localStorage.getItem('ao_ultimo') || '';
  pintarMundo();
  if (QS.get('v')) $('app-ver').textContent = 'Norway AO v' + QS.get('v');
  // El botón de descarga sólo tiene sentido cuando se juega desde el navegador
  if (location.protocol === 'file:') $('b-download').classList.add('hidden');
  statusLine();
  requestAnimationFrame(loop);
  window.__AO = { S, E, send }; // para pruebas
})();

// Que los botones no se queden con el foco: si no, Espacio los volvería a "apretar"
document.addEventListener('click', (e) => {
  const b = e.target.closest && e.target.closest('button');
  if (b) b.blur();
});
// Al elegir una opción del MENÚ, el menú se cierra
document.getElementById('pop-menu').addEventListener('click', (e) => {
  if (e.target.closest('button')) document.getElementById('pop-menu').classList.add('hidden');
});
