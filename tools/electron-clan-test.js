// Prueba en la app de escritorio: entrar a un clan, salir (con confirmación) y después escribir en el chat.
const { _electron: electron } = require('playwright');
const path = require('path');
const WebSocket = require(path.join(__dirname, '../server/node_modules/ws'));
(async () => {
  const app = await electron.launch({ executablePath: path.join(__dirname, '../launcher/node_modules/electron/dist/electron'), args: [path.join(__dirname, '../launcher'), '--no-sandbox'] });
  const win = await app.firstWindow();
  win.on('pageerror', (e) => console.log('ERROR PAGINA:', e.message));
  await win.waitForTimeout(3000);
  // el líder (bot) funda el clan
  const lider = new WebSocket('ws://localhost:7666'); const ls = (m) => lider.send(JSON.stringify(m));
  await new Promise((r) => lider.on('open', r));
  lider.on('message', (raw) => { const m = JSON.parse(raw); if (m.t === 'error') ls({ t: 'login', name: 'Thiago', pass: '1234' }); });
  ls({ t: 'create', name: 'Thiago', pass: '1234', raza: 1, genero: 'h' }); await win.waitForTimeout(1000);
  ls({ t: 'clan', a: 'crear', nombre: 'Prueba', capa: {} }); await win.waitForTimeout(500);
  // el jugador entra desde la app
  await win.click('#b-goto-create'); await win.waitForTimeout(400);
  await win.fill('#c-name', 'Socio'); await win.fill('#c-pass', '1234'); await win.fill('#c-pass2', '1234'); await win.click('#c-ok'); await win.waitForTimeout(800);
  if (await win.isVisible('#scr-create')) { await win.click('#c-back'); await win.fill('#l-name', 'Socio'); await win.fill('#l-pass', '1234'); await win.click('#b-login'); }
  await win.waitForTimeout(2000);
  await win.click('#b-clanes'); await win.waitForTimeout(600);
  await win.click('[data-sol]'); await win.waitForTimeout(400);
  ls({ t: 'clan', a: 'aceptar', nombre: 'Socio' }); await win.waitForTimeout(800);
  await win.keyboard.press('Escape'); await win.click('#b-clanes'); await win.waitForTimeout(600);
  await win.click('#cl-salir'); await win.waitForTimeout(400);
  console.log('ventanita de confirmación:', await win.isVisible('.dlg'));
  await win.click('.dlg [data-r="1"]'); await win.waitForTimeout(600);
  // escribir en el chat
  await win.keyboard.press('Enter'); await win.waitForTimeout(200);
  console.log('foco en el chat:', await win.evaluate(() => document.activeElement.id));
  await win.keyboard.type('hola, ya puedo escribir'); await win.keyboard.press('Enter'); await win.waitForTimeout(600);
  const ult = await win.evaluate(() => [...document.querySelectorAll('#console div')].slice(-4).map((d) => d.textContent));
  console.log(ult.join(' | '));
  await app.close(); process.exit(0);
})();
