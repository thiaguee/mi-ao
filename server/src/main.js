'use strict';
// Punto de entrada del servidor de Norway AO.
const fs = require('fs');
const path = require('path');
const http = require('http');
const { WebSocketServer } = require('ws');
const G = require('./gamedata');
const World = require('./world');
const accounts = require('./accounts');

const ROOT = path.join(__dirname, '..');
const DATA_DIR = process.env.AO_DATA_DIR || ROOT; // datos que se guardan (personajes, config, logs)
fs.mkdirSync(DATA_DIR, { recursive: true });
const CONFIG_PATH = path.join(DATA_DIR, 'config.json');
const CLIENT_DIR = process.env.AO_CLIENT_DIR || path.join(ROOT, '..', 'client');
const LOGS = path.join(DATA_DIR, 'logs');
fs.mkdirSync(LOGS, { recursive: true });

// Administradores fijos: siempre tienen todos los poderes
const ADMINS_FIJOS = ['Thiago', 'Lautaro'];
const VERSION_CONFIG = 4;

const DEFAULT_CONFIG = {
  versionConfig: VERSION_CONFIG,
  nombreServidor: 'Norway AO',
  puerto: 7666,
  maxJugadores: 300,
  primerPersonajeEsAdmin: false,
  gms: { admins: ['Thiago', 'Lautaro'], dioses: [], semidioses: [], consejeros: [] },
  motd: ['¡Bienvenidos! Escribí /AYUDA para ver los comandos.'],
  multiplicadorExp: 100, // experiencia x100: se sube rápido de nivel
  multiplicadorOro: 50, // oro x50 de los monstruos
  oroInicial: 1000, // oro con el que arranca cada personaje nuevo
  respawnSegundos: 30,
  intervaloGolpe: 900,
  intervaloHechizo: 1000,
  intervaloCaminar: 150,
  chatGlobal: true,
  guardadoMinutos: 5,
  carcel: { map: 66, x: 75, y: 47 },
  nombresProhibidos: ['admin', 'gm ', 'game master', 'dios'],
};

function loadConfig() {
  let cfg = {};
  if (fs.existsSync(CONFIG_PATH)) cfg = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
  // Si el archivo es de una versión vieja, se actualizan los valores de experiencia y oro
  if ((cfg.versionConfig || 0) < VERSION_CONFIG) {
    for (const k of ['multiplicadorExp', 'multiplicadorOro', 'oroInicial', 'respawnSegundos', 'primerPersonajeEsAdmin', 'intervaloCaminar']) delete cfg[k];
    cfg.versionConfig = VERSION_CONFIG;
  }
  cfg = Object.assign({}, DEFAULT_CONFIG, cfg);
  cfg.gms = Object.assign({ admins: [], dioses: [], semidioses: [], consejeros: [] }, cfg.gms);
  for (const n of ADMINS_FIJOS) {
    for (const k of Object.keys(cfg.gms)) cfg.gms[k] = cfg.gms[k].filter((x) => x.toLowerCase() !== n.toLowerCase());
    cfg.gms.admins.push(n);
  }
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(cfg, null, 2));
  return cfg;
}

const config = loadConfig();
const data = G.loadAll();
const world = new World(data, config);
Object.assign(world, require('./player'), require('./combat'), require('./spells'),
  require('./interact'), require('./commands'), require('./teleports'));
world.dataDir = DATA_DIR;

// ---------- logs, bans y guardado ----------
const day = () => new Date().toISOString().slice(0, 10);
const stamp = () => new Date().toISOString().replace('T', ' ').slice(0, 19);
const appendLog = (file, line) => fs.appendFile(path.join(LOGS, `${file}-${day()}.log`), `${stamp()} ${line}\n`, () => {});
world.log = (line) => { console.log(stamp(), line); appendLog('servidor', line); };
world.gmLog = (line) => appendLog('gms', line);
world.chatLog = (line) => appendLog('chat', line);
world.sos = [];
world.raining = false;

const BANS_PATH = path.join(DATA_DIR, 'baneados.json');
world.bans = new Set(fs.existsSync(BANS_PATH) ? JSON.parse(fs.readFileSync(BANS_PATH, 'utf8')) : []);
world.saveBans = () => fs.writeFileSync(BANS_PATH, JSON.stringify([...world.bans], null, 2));
world.saveConfig = () => fs.writeFileSync(CONFIG_PATH, JSON.stringify(world.config, null, 2));
world.saveAll = () => { for (const p of world.players.values()) world.savePlayer(p); };
world.shutdown = (reason) => {
  world.log('Apagando: ' + reason);
  world.toAll({ t: 'bye', text: reason || 'El servidor se está apagando.' });
  for (const p of [...world.players.values()]) world.logout(p);
  setTimeout(() => process.exit(0), 300);
};

// El primer personaje creado en un servidor nuevo se vuelve Administrador (dueño)
const origCreate = world.createCharacter;
world.createCharacter = function (sock, req) {
  const noAdmins = config.primerPersonajeEsAdmin && config.gms.admins.length === 0 && accounts.list().length === 0;
  if (noAdmins && accounts.validName(String(req.name || '').trim())) {
    config.gms.admins.push(String(req.name).trim());
    world.saveConfig();
    world.log(`${req.name} es el primer personaje: queda como Administrador.`);
  }
  const res = origCreate.call(this, sock, req);
  if (res.error && noAdmins) { config.gms.admins = []; world.saveConfig(); }
  return res;
};

world.cargarTeleports();
world.spawnAllNpcs();

// ---------- mensajes del cliente ----------
function handle(sock, msg) {
  const p = sock._player;
  if (!p) {
    let res;
    if (msg.t === 'login') res = world.login(sock, msg);
    else if (msg.t === 'create') res = world.createCharacter(sock, msg);
    else if (msg.t === 'dice') { sock._dice = world.rollDice(); res = { dice: sock._dice }; }
    else if (msg.t === 'info') res = { info: { name: config.nombreServidor, online: world.players.size } };
    else return;
    if (res.error) sock.send(JSON.stringify({ t: 'error', text: res.error }));
    else if (res.dice) sock.send(JSON.stringify({ t: 'dice', v: res.dice }));
    else if (res.info) sock.send(JSON.stringify(Object.assign({ t: 'info' }, res.info)));
    return;
  }
  const now = Date.now();
  switch (msg.t) {
    case 'move': {
      if (p.paralyzed && p.gm < 2) { world.send(p, { t: 'pos', x: p.x, y: p.y }); return; }
      // control de velocidad tolerante al lag: máximo N pasos cada 2 segundos
      if (now - (p.moveWin || 0) > 2000) { p.moveWin = now; p.moveCount = 0; }
      p.moveCount = (p.moveCount || 0) + 1;
      if (p.gm < 2 && (p.moveCount > Math.ceil(2000 / config.intervaloCaminar) || now - p.lastMove < 35)) {
        world.send(p, { t: 'pos', x: p.x, y: p.y }); return;
      }
      p.lastMove = now;
      if (p.trade || p.banking) world.endTrade(p);
      const prevMap = p.map;
      if (!world.moveChar(p, +msg.d)) world.send(p, { t: 'pos', x: p.x, y: p.y, h: p.heading });
      else if (p.map === prevMap && (msg.x !== undefined) && (msg.x !== p.x || msg.y !== p.y)) world.send(p, { t: 'pos', x: p.x, y: p.y });
      return;
    }
    case 'turn': return world.turn(p, +msg.d);
    case 'talk': return world.handleTalk(p, msg.text);
    case 'attack': return world.attack(p);
    case 'pick': return world.pickUp(p);
    case 'use': return world.useItem(p, +msg.i);
    case 'equip': return world.equip(p, +msg.i);
    case 'drop': return msg.gold ? world.dropGold(p, msg.a) : world.dropItem(p, +msg.i, msg.a);
    case 'click':
      p.lastClick = { x: +msg.x, y: +msg.y };
      return world.look(p, +msg.x, +msg.y);
    case 'dclick': return world.interact(p, +msg.x, +msg.y);
    case 'tp': // teletransporte de GM con clic derecho
      if (p.gm < 1) return;
      if (!world.inMap(+msg.x, +msg.y)) return;
      return world.warp(p, p.map, +msg.x, +msg.y);
    case 'cast': return world.castSpell(p, +msg.i, +msg.x, +msg.y);
    case 'shoot': return world.shoot(p, +msg.x, +msg.y);
    case 'meditate': return world.toggleMeditate(p);
    case 'buy': return world.buy(p, +msg.i, msg.a);
    case 'sell': return world.sell(p, +msg.i, msg.a);
    case 'endTrade': return world.endTrade(p);
    case 'bankDep': return world.bankDeposit(p, +msg.i, msg.a);
    case 'bankWit': return world.bankWithdraw(p, +msg.i, msg.a);
    case 'bankGold': return world.bankGold(p, msg.a, !!msg.dep);
    case 'classup': return world.chooseClass(p, msg.c);
    case 'skills': return world.assignSkills(p, msg.v);
    case 'swapSpell': {
      const a = +msg.a, b = +msg.b;
      if (a >= 0 && b >= 0 && a < 35 && b < 35) { [p.spells[a], p.spells[b]] = [p.spells[b], p.spells[a]]; world.sendSpells(p); }
      return;
    }
    case 'swapInv': {
      const a = +msg.a, b = +msg.b;
      if (!(a >= 0 && b >= 0 && a < p.inv.length && b < p.inv.length) || a === b) return;
      [p.inv[a], p.inv[b]] = [p.inv[b], p.inv[a]];
      for (const k of Object.keys(p.eq)) {
        if (p.eq[k] === a) p.eq[k] = b; else if (p.eq[k] === b) p.eq[k] = a;
      }
      world.sendSlot(p, a); world.sendSlot(p, b);
      return;
    }
    case 'ping': return world.send(p, { t: 'pong', ts: msg.ts });
    case 'logout': return world.logout(p);
    default:
  }
}

// ---------- servidor HTTP (sirve el cliente web) + WebSocket ----------
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css',
  '.png': 'image/png', '.json': 'application/json', '.map': 'application/octet-stream', '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav', '.ico': 'image/x-icon', '.ttf': 'font/ttf', '.woff2': 'font/woff2' };

const server = http.createServer((req, res) => {
  let url = decodeURIComponent((req.url || '/').split('?')[0]);
  if (url === '/') url = '/index.html';
  if (url === '/descargar' || url === '/NorwayAO-Instalador.exe') {
    const exe = path.join(ROOT, '..', 'launcher', 'dist', 'NorwayAO-Instalador.exe');
    return fs.stat(exe, (err, st) => {
      if (err) { res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }); return res.end('El instalador todavía no fue creado.'); }
      res.writeHead(200, { 'Content-Type': 'application/octet-stream', 'Content-Length': st.size,
        'Content-Disposition': 'attachment; filename="NorwayAO-Instalador.exe"' });
      fs.createReadStream(exe).pipe(res);
    });
  }
  if (url === '/estado') {
    res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
    return res.end(JSON.stringify({ nombre: config.nombreServidor, online: world.players.size, uptime: world.uptime() }));
  }
  const file = path.normalize(path.join(CLIENT_DIR, url));
  if (!file.startsWith(path.normalize(CLIENT_DIR))) { res.writeHead(403); return res.end(); }
  fs.stat(file, (err, st) => {
    if (err || !st.isFile()) { res.writeHead(404); return res.end('No encontrado'); }
    res.writeHead(200, {
      'Content-Type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream',
      'Cache-Control': url.startsWith('/assets/') ? 'public, max-age=86400' : 'no-cache',
      'Access-Control-Allow-Origin': '*',
    });
    fs.createReadStream(file).pipe(res);
  });
});

const wss = new WebSocketServer({ server, maxPayload: 16 * 1024 });
const perIp = new Map();
wss.on('connection', (sock, req) => {
  const ip = (req.headers['x-forwarded-for'] || req.socket.remoteAddress || '').toString().split(',')[0].trim();
  sock._ip = ip;
  const n = (perIp.get(ip) || 0) + 1;
  perIp.set(ip, n);
  if (n > 8) { sock.close(); }
  let count = 0, windowStart = Date.now();
  sock.on('message', (raw) => {
    // límite anti-flood: 60 mensajes por segundo
    const now = Date.now();
    if (now - windowStart > 1000) { windowStart = now; count = 0; }
    if (++count > 60) return;
    let msg;
    try { msg = JSON.parse(raw.toString()); } catch (e) { return; }
    if (!msg || typeof msg.t !== 'string') return;
    try { handle(sock, msg); } catch (e) { console.error('Error procesando', msg.t, e); }
  });
  sock.on('close', () => {
    perIp.set(ip, (perIp.get(ip) || 1) - 1);
    if (sock._player) world.logout(sock._player);
  });
  sock.on('error', () => {});
});

// ---------- bucles del juego ----------
setInterval(() => { try { world.npcTick(Date.now()); } catch (e) { console.error('npcTick', e); } }, 100);
setInterval(() => {
  const now = Date.now();
  for (const p of world.players.values()) {
    try { world.playerTick(p, now); } catch (e) { console.error('playerTick', e); }
  }
}, 1000);
setInterval(() => world.saveAll(), config.guardadoMinutos * 60000);
// Limpieza de objetos tirados hace más de 15 minutos
setInterval(() => {
  const limit = Date.now() - 15 * 60000;
  for (const mp of world.maps) {
    if (!mp) continue;
    for (const [k, o] of [...mp.objs]) {
      if (o.t && o.t < limit) {
        mp.objs.delete(k);
        world.toMap(mp.n, { t: 'obj', x: k % 100 + 1, y: Math.floor(k / 100) + 1, g: 0 });
      }
    }
  }
}, 60000);

process.on('SIGINT', () => world.shutdown('El servidor se está apagando.'));
// Cuando corre adentro de la aplicación de Windows, la aplicación le avisa cuándo guardar o apagarse
if (process.parentPort) {
  process.parentPort.on('message', (e) => {
    const m = e && e.data;
    if (!m) return;
    if (m.cmd === 'guardar') world.saveAll();
    if (m.cmd === 'apagar') world.shutdown('El juego se cerró.');
  });
}
process.on('SIGTERM', () => world.shutdown('El servidor se está apagando.'));

server.on('error', (e) => {
  if (e.code === 'EADDRINUSE') world.log(`El puerto ${config.puerto} ya está en uso (¿el servidor ya está abierto?).`);
  else world.log('Error del servidor: ' + e.message);
});
server.listen(config.puerto, () => {
  world.log(`${config.nombreServidor} escuchando en el puerto ${config.puerto}`);
  if (config.gms.admins.length === 0) world.log('Todavía no hay administrador: el primer personaje que se cree será el ADMIN.');
  if (process.parentPort) process.parentPort.postMessage('listo');
});

module.exports = world;
