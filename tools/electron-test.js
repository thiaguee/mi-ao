// Prueba la app de escritorio (Electron) tal como la usaría un jugador.
const { _electron: electron } = require('playwright');
const path = require('path');
(async () => {
  const app = await electron.launch({
    executablePath: path.join(__dirname, '../launcher/node_modules/electron/dist/electron'),
    args: [path.join(__dirname, '../launcher'), '--no-sandbox'],
  });
  const win = await app.firstWindow();
  win.on('pageerror', (e) => console.log('ERROR PAGINA:', e.message));
  win.on('console', (m) => { if (m.type() === 'error') console.log('CONSOLA:', m.text()); });
  await win.waitForTimeout(2500);
  console.log('estado:', await win.textContent('#srv-status'));
  await win.fill('#l-name', 'Thiago'); await win.fill('#l-pass', 'clave123');
  await win.click('#b-login');
  await win.waitForTimeout(3000);
  await win.screenshot({ path: process.argv[2] + '/8-electron.png' });
  console.log('en juego:', await win.evaluate(() => window.__AO.S.inGame));
  await app.close();
})();
