// Prueba: cambio de mapa por los bordes, sacerdote y guardado.
const path = require('path');
const WebSocket = require(path.join(__dirname, '../server/node_modules/ws'));
const G = require(path.join(__dirname, '../server/src/gamedata'));
const data = G.loadAll();
const ws = new WebSocket('ws://localhost:7666');
const send = (m) => ws.send(JSON.stringify(m));
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
let me = {}, map = 0, chars = [];
ws.on('message', (raw) => {
  const m = JSON.parse(raw);
  if (m.t === 'map') { map = m.map; chars = m.chars; const c = m.chars.find((c) => c.id === m.me); me = { x: c.x, y: c.y }; console.log('MAPA', m.map, m.name, 'en', me.x, me.y); }
  if (m.t === 'pos') { me.x = m.x; me.y = m.y; }
  if (m.t === 'msg' && !/experiencia|skill/.test(m.text)) console.log('  msg:', m.text);
  if (m.t === 'stats' && m.dead !== undefined) console.log('  muerto:', m.dead, 'hp', m.hp);
});
ws.on('open', async () => {
  send({ t: 'login', name: 'Thiago', pass: 'clave123' });
  await wait(1000);
  // Buscar una salida en el mapa 1 y caminar hacia ella
  const m1 = data.maps[1];
  let exit = null;
  for (const [k, e] of m1.exits) { const x = k % 100 + 1, y = Math.floor(k / 100) + 1; if (y === 10 || x === 91 || y === 91 || x === 10) { exit = { x, y, e }; break; } }
  console.log('salida', JSON.stringify(exit));
  // pararse al lado de la salida y caminar hacia ella
  const dir = exit.y <= 10 ? 1 : exit.x >= 91 ? 2 : exit.y >= 91 ? 3 : 4;
  const off = { 1: [0, 1], 2: [-1, 0], 3: [0, -1], 4: [1, 0] }[dir];
  send({ t: 'talk', text: `/TELEP YO 1 ${exit.x + off[0]} ${exit.y + off[1]}` });
  await wait(800);
  console.log('estoy en', me.x, me.y, 'camino dir', dir);
  send({ t: 'move', d: dir });
  await wait(800);
  console.log('mapa actual', map, me.x, me.y, '(esperado', exit.e.map + ')');
  // Revivir con sacerdote: ir a Ulla, buscar sacerdote
  send({ t: 'talk', text: '/TELEP YO 1 58 45' });
  await wait(800);
  const priest = chars.find((c) => /Sacerdote/.test(c.n));
  console.log('sacerdote', priest && priest.x, priest && priest.y);
  send({ t: 'talk', text: `/TELEP YO 1 ${priest.x} ${priest.y + 2}` });
  await wait(600);
  send({ t: 'dclick', x: priest.x, y: priest.y });
  await wait(600);
  send({ t: 'talk', text: '/EST' });
  await wait(600);
  process.exit(0);
});
