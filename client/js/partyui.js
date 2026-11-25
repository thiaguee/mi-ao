// Grupos: panel con los integrantes (vida, maná, líder, quién habla), invitaciones y chat de voz.
// La voz va directo entre los jugadores (WebRTC); el servidor sólo pasa los mensajes para conectarse.
let H = null; // { send, S, $, confirmar, log, esc }
const G = { miembros: [], lider: 0, voz: false, stream: null, peers: new Map(), ptt: false, hablando: new Set(), mute: false };
const ICE = [{ urls: 'stun:stun.l.google.com:19302' }, { urls: 'stun:stun1.l.google.com:19302' }];

export function init(h) { H = h; crearPanel(); }

function crearPanel() {
  const vista = H.$('view').parentElement;
  const d = document.createElement('div');
  d.id = 'party-panel'; d.className = 'hidden';
  vista.appendChild(d);
}

function render() {
  const d = H.$('party-panel');
  if (!G.miembros.length) { d.classList.add('hidden'); return; }
  d.classList.remove('hidden');
  const yo = H.S.me;
  d.innerHTML = `<div class="pp-tit">GRUPO <span>${G.miembros.length}/6</span></div>` + G.miembros.map((m) => {
    const hp = Math.round((m.hp / Math.max(1, m.mhp)) * 100), mn = m.mman ? Math.round((m.man / m.mman) * 100) : 0;
    const voz = m.voz ? `<i class="pp-voz${G.hablando.has(m.id) ? ' on' : ''}" title="En el chat de voz">🎤</i>` : '';
    return `<div class="pp-m${m.muerto ? ' muerto' : ''}${m.id === yo ? ' yo' : ''}"><div class="pp-n">${m.lider ? '<b title="Líder">👑</b>' : ''}${H.esc(m.n)} <small>${m.lvl}</small>${voz}
      ${G.lider === yo && m.id !== yo ? `<a data-echar="${H.esc(m.n)}" title="Echar del grupo">✕</a>` : ''}</div>
      <div class="pp-b hp"><div style="width:${hp}%"></div></div>${m.mman ? `<div class="pp-b mn"><div style="width:${mn}%"></div></div>` : ''}</div>`;
  }).join('') + `<div class="pp-acc"><button data-a="voz" class="${G.voz ? 'on' : ''}">${G.voz ? '🎤 Voz: sí' : '🎤 Voz: no'}</button>
    <button data-a="ptt" class="${G.ptt ? 'on' : ''}" title="Pulsar para hablar: mantené V">${G.ptt ? 'V para hablar' : 'Micrófono abierto'}</button>
    <button data-a="mute" class="${G.mute ? 'on' : ''}" title="Silenciar a los demás">${G.mute ? '🔇' : '🔊'}</button>
    <button data-a="salir" title="Salir del grupo">Salir</button></div>`;
  d.querySelectorAll('[data-a]').forEach((b) => { b.onclick = (e) => { e.stopPropagation(); accion(b.dataset.a); }; });
  d.querySelectorAll('[data-echar]').forEach((a) => { a.onclick = (e) => { e.stopPropagation(); H.send({ t: 'party', a: 'echar', n: a.dataset.echar }); }; });
}

async function accion(a) {
  if (a === 'salir') { if (await H.confirmar('¿Salir del grupo?', 'Salir')) H.send({ t: 'party', a: 'salir' }); return; }
  if (a === 'voz') return G.voz ? vozApagar() : vozPrender();
  if (a === 'ptt') { G.ptt = !G.ptt; aplicarMic(); render(); return; }
  if (a === 'mute') { G.mute = !G.mute; for (const pr of G.peers.values()) if (pr.audio) pr.audio.muted = G.mute; render(); }
}

export function invitar(id) { H.send({ t: 'party', a: 'invitar', id }); }

// ---------- ventana del botón GRUPO ----------
export function abrir() {
  const yo = H.S.me, soyLider = !G.miembros.length || G.lider === yo;
  const filas = G.miembros.map((m) => {
    const hp = Math.round((m.hp / Math.max(1, m.mhp)) * 100);
    return `<div class="gw-m"><b>${m.lider ? '👑 ' : ''}${H.esc(m.n)}</b><span>Nivel ${m.lvl}</span>
      <div class="pp-b hp"><div style="width:${hp}%"></div></div><span>${m.muerto ? '💀 muerto' : `${m.hp}/${m.mhp}`}</span>${m.voz ? '🎤' : ''}
      ${G.lider === yo && m.id !== yo ? `<button class="btn sm" data-gecha="${H.esc(m.n)}">Echar</button>` : ''}</div>`;
  }).join('');
  H.openModal('Grupo', `<div class="gw">
    ${G.miembros.length ? `<div class="gw-lista">${filas}</div>` : '<p class="hint">No estás en un grupo. En grupo la experiencia de los bichos se reparte entre los que están cerca (con +10% por cada integrante) y el oro va directo a cada uno. Hasta 6 jugadores.</p>'}
    ${soyLider ? `<div class="gw-inv"><input id="gw-nombre" placeholder="Nombre del jugador" maxlength="20"><button class="btn sm main" id="gw-invitar">Invitar</button></div>
      <p class="hint">También podés invitar con clic derecho sobre un jugador.</p>` : '<p class="hint">Sólo el líder puede invitar.</p>'}
    ${G.miembros.length ? `<div class="gw-acc"><button class="btn sm${G.voz ? ' main' : ''}" data-ga="voz">${G.voz ? '🎤 Voz: sí' : '🎤 Voz: no'}</button>
      <button class="btn sm" data-ga="ptt">${G.ptt ? 'Modo: V para hablar' : 'Modo: micrófono abierto'}</button>
      <button class="btn sm" data-ga="mute">${G.mute ? '🔇 Demás silenciados' : '🔊 Escuchar a todos'}</button>
      <button class="btn sm" data-ga="salir">Salir del grupo</button></div>` : ''}
    <p class="hint">/P mensaje habla con el grupo.</p></div>`, 'grupo');
  const inp = document.getElementById('gw-nombre');
  if (inp) {
    const inv = () => { const n = inp.value.trim(); if (n) H.send({ t: 'talk', text: '/GRUPO ' + n }); inp.value = ''; };
    document.getElementById('gw-invitar').onclick = inv;
    inp.onkeydown = (e) => { e.stopPropagation(); if (e.key === 'Enter') inv(); };
  }
  document.querySelectorAll('[data-ga]').forEach((b) => { b.onclick = async () => { await accion(b.dataset.ga); if (H.S.modal === 'grupo') abrir(); }; });
  document.querySelectorAll('[data-gecha]').forEach((b) => { b.onclick = () => H.send({ t: 'party', a: 'echar', n: b.dataset.gecha }); });
}

// ---------- voz ----------
async function vozPrender() {
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    H.log('El chat de voz necesita la aplicación de Norway AO (o entrar por https / localhost).', 'warn'); return;
  }
  try {
    G.stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } });
  } catch (e) { H.log('No se pudo usar el micrófono: ' + (e.message || e.name), 'warn'); return; }
  G.voz = true; aplicarMic(); medir(G.stream, H.S.me);
  H.send({ t: 'voz', on: 1 });
  H.log('Chat de voz activado. ' + (G.ptt ? 'Mantené V para hablar.' : 'Tu micrófono está abierto.'), 'party');
  render();
}
function vozApagar() {
  G.voz = false;
  for (const id of [...G.peers.keys()]) cerrarPeer(id);
  if (G.stream) { for (const t of G.stream.getTracks()) t.stop(); G.stream = null; }
  H.send({ t: 'voz', on: 0 });
  render();
}
function aplicarMic() {
  if (!G.stream) return;
  const on = !G.ptt || G.teclaV;
  for (const t of G.stream.getAudioTracks()) t.enabled = on;
}
window.addEventListener('keydown', (e) => {
  if (e.code !== 'KeyV' || !G.voz || !G.ptt || e.repeat) return;
  if (document.activeElement && ['INPUT', 'TEXTAREA'].includes(document.activeElement.tagName)) return;
  G.teclaV = true; aplicarMic();
});
window.addEventListener('keyup', (e) => { if (e.code === 'KeyV' && G.teclaV) { G.teclaV = false; aplicarMic(); } });

// conexiones: una con cada integrante que tiene la voz prendida; empieza el de id más bajo
function sincronizarPeers() {
  const conVoz = new Set(G.miembros.filter((m) => m.voz && m.id !== H.S.me).map((m) => m.id));
  for (const id of [...G.peers.keys()]) if (!G.voz || !conVoz.has(id)) cerrarPeer(id);
  if (!G.voz) return;
  for (const id of conVoz) if (!G.peers.has(id) && H.S.me < id) crearPeer(id, true);
}
function crearPeer(id, iniciador) {
  const pc = new RTCPeerConnection({ iceServers: ICE });
  const pr = { pc, audio: null };
  G.peers.set(id, pr);
  if (G.stream) for (const t of G.stream.getTracks()) pc.addTrack(t, G.stream);
  pc.onicecandidate = (e) => { if (e.candidate) H.send({ t: 'vozSig', to: id, data: { ice: e.candidate } }); };
  pc.ontrack = (e) => {
    if (!pr.audio) { pr.audio = new Audio(); pr.audio.autoplay = true; pr.audio.muted = G.mute; }
    pr.audio.srcObject = e.streams[0]; pr.audio.play().catch(() => {});
    medir(e.streams[0], id);
  };
  pc.onconnectionstatechange = () => { if (['failed', 'closed'].includes(pc.connectionState)) cerrarPeer(id); };
  if (iniciador) {
    pc.createOffer().then((o) => pc.setLocalDescription(o)).then(() => H.send({ t: 'vozSig', to: id, data: { sdp: pc.localDescription } })).catch(() => {});
  }
  return pr;
}
function cerrarPeer(id) {
  const pr = G.peers.get(id); if (!pr) return;
  try { pr.pc.close(); } catch (e) { /* nada */ }
  if (pr.audio) { pr.audio.srcObject = null; }
  G.peers.delete(id); G.hablando.delete(id);
}
async function senal(m) {
  if (!G.voz) return;
  let pr = G.peers.get(m.de);
  if (m.data.sdp) {
    if (!pr) pr = crearPeer(m.de, false);
    await pr.pc.setRemoteDescription(m.data.sdp);
    if (m.data.sdp.type === 'offer') {
      const a = await pr.pc.createAnswer(); await pr.pc.setLocalDescription(a);
      H.send({ t: 'vozSig', to: m.de, data: { sdp: pr.pc.localDescription } });
    }
  } else if (m.data.ice && pr) { try { await pr.pc.addIceCandidate(m.data.ice); } catch (e) { /* nada */ } }
}
// indicador de quién está hablando
let actx = null;
function medir(stream, id) {
  try {
    actx = actx || new (window.AudioContext || window.webkitAudioContext)();
    const an = actx.createAnalyser(); an.fftSize = 512;
    actx.createMediaStreamSource(stream).connect(an);
    const buf = new Uint8Array(an.fftSize);
    const iv = setInterval(() => {
      if (!stream.active) { clearInterval(iv); G.hablando.delete(id); return; }
      an.getByteTimeDomainData(buf);
      let s = 0; for (const v of buf) s += (v - 128) * (v - 128);
      const habla = Math.sqrt(s / buf.length) > 6 && (id !== H.S.me || !G.ptt || G.teclaV);
      if (habla !== G.hablando.has(id)) { if (habla) G.hablando.add(id); else G.hablando.delete(id); render(); }
    }, 150);
  } catch (e) { /* sin indicador */ }
}

export function mensajes(on) {
  on('party', (m) => {
    G.miembros = m.miembros || []; G.lider = m.lider || 0;
    if (!G.miembros.length && G.voz) vozApagar();
    sincronizarPeers(); render();
    if (H.S.modal === 'grupo' && !document.activeElement.matches('#gw-nombre')) abrir();
  });
  on('partyInv', async (m) => {
    const si = await H.confirmar(`${m.de} te invita a su grupo. La experiencia y el oro de los bichos se reparten entre los que estén cerca.`, 'Unirme', 'No');
    H.send({ t: 'party', a: si ? 'aceptar' : 'rechazar' });
  });
  on('vozSig', (m) => { senal(m).catch(() => {}); });
}
