// Prueba: tirar/agarrar, banco y hechizos contra NPC.
const path = require('path');
const WebSocket = require(path.join(__dirname, '../server/node_modules/ws'));
const ws = new WebSocket('ws://localhost:7666');
const send = (m) => ws.send(JSON.stringify(m));
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
let chars = [], me = null, inv = {}, bank = null;
ws.on('message', (raw) => {
  const m = JSON.parse(raw);
  if (m.t === 'map') { chars = m.chars; me = m.me; }
  if (m.t === 'char') { chars = chars.filter((c) => c.id !== m.c.id).concat([m.c]); }
  if (m.t === 'inv') inv[m.i] = m;
  if (m.t === 'bank') bank = m;
  if (m.t === 'msg' && !/experiencia|skill/.test(m.text)) console.log('  msg:', m.text);
});
ws.on('open', async () => {
  send({ t: 'login', name: 'Thiago', pass: 'clave123' });
  await wait(1000);
  send({ t: 'talk', text: '/TELEP YO 1 58 45' }); await wait(700);
  send({ t: 'drop', i: 1, a: 5 }); await wait(400);
  console.log('pociones tras tirar:', inv[1] && inv[1].a);
  send({ t: 'pick' }); await wait(400);
  console.log('pociones tras agarrar:', inv[1] && inv[1].a);
  // banco
  const banker = chars.find((c) => /Banquero/.test(c.n));
  send({ t: 'talk', text: `/TELEP YO 1 ${banker.x} ${banker.y + 1}` }); await wait(700);
  send({ t: 'dclick', x: banker.x, y: banker.y }); await wait(500);
  console.log('banco abierto:', !!bank);
  send({ t: 'bankDep', i: 2, a: 10 }); await wait(300);
  send({ t: 'bankGold', a: 1000, dep: 1 }); await wait(300);
  console.log('banco items:', bank.items.filter((x) => x.id).map((x) => x.n + 'x' + x.a).join(','), 'oro banco', bank.gld);
  send({ t: 'endTrade' });
  // hechizo a un NPC
  send({ t: 'talk', text: '/TELEP YO 2 50 50' }); await wait(800);
  send({ t: 'talk', text: '/CURARU' }); await wait(400);
  send({ t: 'talk', text: '/MOD Thiago MAN 2000' }); await wait(400);
  send({ t: 'talk', text: '/SKILLS Thiago 100' }); await wait(400);
  send({ t: 'talk', text: '/ACC 501' }); await wait(500);
  const wolf = chars.filter((c) => c.n === 'Lobo').sort((a, b) => (Math.abs(a.x - 50) + Math.abs(a.y - 51)) - (Math.abs(b.x - 50) + Math.abs(b.y - 51)))[0];
  console.log('lobo en', wolf.x, wolf.y);
  for (let i = 0; i < 4; i++) { send({ t: 'cast', i: 0, x: wolf.x, y: wolf.y }); await wait(1100); }
  process.exit(0);
});
