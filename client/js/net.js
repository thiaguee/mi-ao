// Conexión con el servidor por WebSocket.
export const N = { ws: null, handlers: {}, onClose: null, onOpen: null, url: '' };

export function serverUrl() {
  const saved = localStorage.getItem('ao_servidor');
  const cfg = (window.AO_CONFIG && window.AO_CONFIG.servidor) || '';
  if (saved) return saved;
  if (cfg) return cfg;
  if (location.protocol === 'file:') return 'ws://localhost:7666';
  return (location.protocol === 'https:' ? 'wss://' : 'ws://') + location.host;
}

export function connect() {
  return new Promise((resolve, reject) => {
    if (N.ws && N.ws.readyState === 1) return resolve();
    N.url = serverUrl();
    let ws;
    try { ws = new WebSocket(N.url); } catch (e) { return reject(e); }
    N.ws = ws;
    ws.onopen = () => { if (N.onOpen) N.onOpen(); resolve(); };
    ws.onerror = () => reject(new Error('No se pudo conectar'));
    ws.onclose = () => { if (N.ws === ws) { N.ws = null; if (N.onClose) N.onClose(); } };
    ws.onmessage = (ev) => {
      let m;
      try { m = JSON.parse(ev.data); } catch (e) { return; }
      const h = N.handlers[m.t];
      if (h) {
        try { h(m); } catch (e) { console.error('Error en mensaje', m.t, e); }
      }
    };
  });
}

export function send(m) {
  if (N.ws && N.ws.readyState === 1) N.ws.send(JSON.stringify(m));
}

export function on(type, fn) { N.handlers[type] = fn; }
