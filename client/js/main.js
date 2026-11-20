// Cliente de Norway AO: pantallas, controles y comunicación con el servidor.
import { A, loadIndexes, drawGrh, drawIcon } from './assets.js';
import { loadMap, idx } from './mapdata.js';
import * as Eng from './engine.js';
import { E, WALK_MS } from './engine.js';
import { connect, send, on, N, serverUrl } from './net.js';
import * as Snd from './audio.js';

const $ = (id) => document.getElementById(id);
const DIR = { ArrowUp: 1, ArrowRight: 2, ArrowDown: 3, ArrowLeft: 4 };
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
    $('srv-status').textContent = 'Servidor desconectado (' + serverUrl() + ')';
  });
}

on('info', (m) => { $('srv-status').textContent = `${m.name} — ${m.online} jugando`; });
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
$('b-server').onclick = (e) => {
  e.preventDefault();
  const v = prompt('Dirección del servidor (ej: ws://123.45.67.89:7666). Dejá vacío para usar el predeterminado.', localStorage.getItem('ao_servidor') || '');
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
    for (const c of m.chars) Eng.addChar(c);
    E.me = m.me;
    $('map-name').textContent = `${m.name}${m.pk ? '' : ' (zona segura)'}`;
    Snd.music(m.music);
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
on('rm', (m) => E.chars.delete(m.id));
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
on('obj', (m) => { if (m.g) E.objs.set(idx(m.x, m.y), m.g); else E.objs.delete(idx(m.x, m.y)); });
on('blk', (m) => { for (const [x, y, b] of m.tiles) if (x >= 1 && E.blocked) E.blocked[idx(x, y)] = b; });
on('fx', (m) => Eng.setFx(m.id, m.fx, m.loops));
on('snd', (m) => Snd.play(m.w));
on('say', (m) => Eng.say(m.id, m.text, m.color));
on('dmg', (m) => Eng.addDamage(m.id, m.v));
on('shot', (m) => Eng.addShot(m.from, m.to));
on('msg', (m) => log(m.text, m.color));
on('rain', (m) => { E.rain = !!m.on; });
on('para', (m) => { S.paralyzed = !!m.on; if (m.on) log('¡Estás paralizado!', 'warn'); });
on('meditate', (m) => { $('b-med').classList.toggle('main', !!m.on); });
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
  $('s-name').textContent = S.name + (S.gm ? ' [GM]' : '');
  $('s-name').style.color = S.gm ? '#5fe05f' : s.crim ? '#ff5a4a' : '#6fa8ff';
  $('s-class').textContent = `${s.clase || ''} ${s.raza || ''}`;
  $('s-level').textContent = `Nivel ${s.lvl || 1}` + (s.skillPts ? ` — ${s.skillPts} skillpoints libres` : '');
  bar('hp', s.hp, s.maxHp); bar('man', s.man, s.maxMan); bar('sta', s.sta, s.maxSta);
  bar('ham', s.ham, 100); bar('sed', s.sed, 100);
  $('t-ham').textContent = `Hambre ${s.ham}`; $('t-sed').textContent = `Sed ${s.sed}`;
  bar('exp', s.exp, s.elu);
  $('t-exp').textContent = s.elu ? `${s.exp}/${s.elu}` : 'Nivel máximo';
  $('s-gold').textContent = (s.gld || 0).toLocaleString('es-AR');
}
function updatePos() {
  const c = E.chars.get(S.me);
  if (c) $('s-pos').textContent = `Mapa ${E.mapNum} (${c.x}, ${c.y})`;
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
    d.ondblclick = () => { selectSlot(i); useSelected(); };
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
    d.textContent = s.id ? `${s.n} (${s.mana})` : '(Nada)';
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
$('b-sound').onclick = () => { $('b-sound').textContent = Snd.toggle() ? '🔊' : '🔇'; };
$('b-sound').textContent = Snd.AU.on ? '🔊' : '🔇';
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
    <span>${esc(itemDesc(it))}${it.a > 1 ? ` (${it.a})` : ''}</span>${price !== null ? `<span class="price">${price}</span>` : ''}</div>`;
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
  const npcList = t.items.map((it) => itemRow(it, it.price, sel.npc === it.i, 'n')).join('');
  const invList = S.inv.filter(Boolean).map((it) => itemRow(it, it.v, sel.inv === it.i, 'p')).join('');
  openModal(`Comerciar con ${t.npc}`, `<div class="trade">
    <div><b>${esc(t.npc)}</b><div class="list" id="tl-n">${npcList}</div><button class="btn main" id="t-buy">Comprar</button></div>
    <div><b>Tu inventario</b><div class="list" id="tl-p">${invList}</div><button class="btn main" id="t-sell">Vender</button></div>
    </div><div class="row">Cantidad <input id="m-amount" type="number" min="1" value="${amount}" style="width:80px"> &nbsp; Tu oro: <b style="color:var(--gold)">${(S.stats.gld || 0).toLocaleString('es-AR')}</b></div>`, 'trade');
  paintIcons($('m-body'));
  $('m-body').querySelectorAll('[data-n]').forEach((el) => { el.onclick = () => { sel.npc = +el.dataset.n; renderTrade(); }; });
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
    <b>Controles</b><br>
    Flechas: caminar · Ctrl: atacar · A: agarrar objeto · M: meditar<br>
    U: usar objeto · E: equipar · T: tirar · Enter: hablar · Esc: cancelar<br>
    Clic: mirar · Doble clic: comerciar / banco / sacerdote / abrir puertas<br>
    Hechizos: elegí uno en la pestaña Hechizos, tocá "Lanzar" y hacé clic en el objetivo.<br>
    Arcos: equipá el arco y las flechas, presioná Ctrl y hacé clic en el objetivo.<br><br>
    <b>Comandos útiles</b><br>
    /ONLINE /EST /MEDITAR /SEGURO /HOGAR /GM mensaje /GLOBAL mensaje<br>
    \\nombre mensaje = susurrar · /SALIR<br>
    ${S.gm ? '<br><b style="color:#5fe05f">Sos GM:</b> escribí /GMAYUDA en el chat para ver todos tus comandos.' : ''}
  </div>`);
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

window.addEventListener('keydown', (e) => {
  if (!S.inGame) return;
  if (document.activeElement && ['INPUT', 'SELECT', 'TEXTAREA'].includes(document.activeElement.tagName)) return;
  if (S.modal && e.key === 'Escape') { closeModal(); return; }
  if (S.modal && S.modal !== 'trade' && S.modal !== 'bank') return;
  if (DIR[e.key]) { S.keys.add(e.key); S.lastKey = e.key; e.preventDefault(); return; }
  switch (e.key) {
    case 'Enter': chat.focus(); e.preventDefault(); break;
    case 'Control': {
      const it = S.inv.find((x) => x && x.eq && x.ty === 2);
      if (it && it.pr) { setTarget('shoot'); log('Hacé clic sobre el objetivo.', 'info'); }
      else send({ t: 'attack' });
      break;
    }
    case 'Escape': setTarget(null); break;
    default: {
      const k = e.key.toLowerCase();
      if (k === 'a') send({ t: 'pick' });
      else if (k === 'm') send({ t: 'meditate' });
      else if (k === 'u') useSelected();
      else if (k === 'e') equipSelected();
      else if (k === 't') dropSelected();
      else if (k === 'n') E.showNames = !E.showNames;
      else if (k === 'f1') { openHelp(); e.preventDefault(); }
    }
  }
});
window.addEventListener('keyup', (e) => { S.keys.delete(e.key); });
window.addEventListener('blur', () => S.keys.clear());

function tryWalk(now) {
  if (!S.keys.size || S.loadingMap || S.modal === 'ask') return;
  const me = E.chars.get(S.me);
  if (!me || !E.map) return;
  if (now - S.lastStep < WALK_MS) return;
  const key = S.keys.has(S.lastKey) ? S.lastKey : [...S.keys][0];
  const d = DIR[key];
  if (!d) return;
  S.lastStep = now;
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
  Eng.moveChar(S.me, nx, ny, d);
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
});
view.addEventListener('dblclick', (e) => {
  const t = Eng.screenToTile(e.clientX, e.clientY);
  send({ t: 'dclick', x: t.x, y: t.y });
});
view.addEventListener('contextmenu', (e) => { e.preventDefault(); setTarget(null); });

// ================== BUCLE PRINCIPAL ==================
function loop(now) {
  if (S.inGame) {
    tryWalk(now);
    Eng.render(now);
    $('fps').textContent = `${E.fps} fps${S.ping !== undefined ? ` · ${S.ping} ms` : ''}`;
  }
  requestAnimationFrame(loop);
}
setInterval(() => { if (S.inGame) send({ t: 'ping', ts: Date.now() }); }, 5000);

// ================== INICIO ==================
(async function start() {
  Eng.init($('view'));
  $('srv-status').textContent = 'Cargando gráficos...';
  try {
    await loadIndexes();
  } catch (e) {
    $('srv-status').textContent = 'Error cargando los gráficos del juego.';
    return;
  }
  $('l-name').value = localStorage.getItem('ao_ultimo') || '';
  // El botón de descarga sólo tiene sentido cuando se juega desde el navegador
  if (location.protocol === 'file:') $('b-download').classList.add('hidden');
  statusLine();
  requestAnimationFrame(loop);
  window.__AO = { S, E, send }; // para pruebas
})();
