// Prueba automática del servidor: crea un personaje y ejecuta acciones básicas.
const WebSocket = require(require('path').join(__dirname, '../server/node_modules/ws'));
const url = process.argv[2] || 'ws://localhost:7666';
const name = process.argv[3] || 'Probador';
const ws = new WebSocket(url);
const seen = {};
const send = (m) => ws.send(JSON.stringify(m));
ws.on('open', () => send({ t: 'create', name, pass: 'clave123', raza: 1, genero: 'h', head: 1 }));
ws.on('message', (raw) => {
  const m = JSON.parse(raw);
  seen[m.t] = (seen[m.t] || 0) + 1;
  if (m.t === 'error') { console.log('ERROR:', m.text); if (/existe/.test(m.text)) send({ t: 'login', name, pass: 'clave123' }); }
  if (m.t === 'msg') console.log('[msg]', m.text);
  if (m.t === 'welcome') {
    console.log('welcome gm=', m.gm);
    let i = 0;
    const steps = [
      () => send({ t: 'move', d: 3 }), () => send({ t: 'move', d: 2 }),
      () => send({ t: 'talk', text: 'Hola mundo' }),
      () => send({ t: 'talk', text: '/EST' }),
      () => send({ t: 'talk', text: '/CI 38 5' }),
      () => send({ t: 'talk', text: '/NIVEL ' + name + ' 15' }),
      () => send({ t: 'talk', text: '/BUSCARNPC lobo' }),
      () => send({ t: 'talk', text: '/TELEP YO 34 44 88' }),
      () => send({ t: 'attack' }),
      () => send({ t: 'talk', text: '/ONLINE' }),
      () => { console.log('tipos recibidos:', seen); process.exit(0); },
    ];
    const iv = setInterval(() => { steps[i++](); if (i >= steps.length) clearInterval(iv); }, 400);
  }
  if (m.t === 'map') console.log('map', m.map, m.name, 'chars', m.chars.length, 'objs', m.objs.length);
  if (m.t === 'classup') console.log('classup opciones', m.opciones.map(o => o.n).join(','));
});
