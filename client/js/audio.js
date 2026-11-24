// Sonidos (WAV) y música (MP3). Si un archivo no existe, simplemente no suena.
const cache = new Map();
export const AU = { on: localStorage.getItem('ao_sonido') !== '0', music: null, musicNum: 0, volume: 0.5,
  fxOn: true, musicOn: true, fxVol: 0.6, musicVol: 0.5 }; // los ajusta la ventana de Opciones

export function play(n) {
  if (!AU.fxOn || !n) return;
  let base = cache.get(n);
  if (base === false) return;
  if (!base) {
    base = new Audio(`assets/sonidos/${n}.wav`);
    base.addEventListener('error', () => cache.set(n, false));
    cache.set(n, base);
  }
  try {
    const a = base.cloneNode();
    a.volume = AU.fxVol;
    a.play().catch(() => {});
  } catch (e) { /* nada */ }
}

export function music(n) {
  if (AU.musicNum === n && AU.music) return;
  AU.musicNum = n;
  if (AU.music) { AU.music.pause(); AU.music = null; }
  if (!AU.musicOn || !n) return;
  const m = new Audio(`assets/musica/${n}.mp3`);
  m.loop = true; m.volume = AU.musicVol * 0.5;
  m.addEventListener('error', () => {});
  m.play().catch(() => {});
  AU.music = m;
}

export function toggle() {
  AU.on = !AU.on;
  localStorage.setItem('ao_sonido', AU.on ? '1' : '0');
  if (!AU.on && AU.music) { AU.music.pause(); AU.music = null; }
  else if (AU.on) { const n = AU.musicNum; AU.musicNum = 0; music(n); }
  return AU.on;
}
