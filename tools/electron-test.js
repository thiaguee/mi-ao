// Prueba la aplicación de escritorio: arranca sola con el servidor adentro.
const { _electron: electron } = require('playwright');
const path = require('path');
(async () => {
  const app = await electron.launch({
    executablePath: path.join(__dirname, '../launcher/node_modules/electron/dist/electron'),
    args: [path.join(__dirname, '../launcher'), '--no-sandbox'],
  });
  const win = await app.firstWindow();
  win.on('pageerror', (e) => console.log('ERROR PAGINA:', e.message));
  await win.waitForTimeout(3000);
  console.log('estado:', await win.textContent('#srv-status'));
  await win.click('#b-goto-create'); await win.waitForTimeout(800);
  await win.fill('#c-name', 'Lautaro'); await win.fill('#c-pass', '1234'); await win.fill('#c-pass2', '1234');
  await win.click('#c-ok'); await win.waitForTimeout(2500);
  const pos = () => win.evaluate(() => { const m = window.__AO.E.chars.get(window.__AO.S.me); return [m.x, m.y]; });
  console.log('en juego como', await win.textContent('#s-name'), 'en', await pos());
  const box = await win.locator('#view').boundingBox();
  await win.mouse.click(box.x + box.width / 2 + 32 * 6, box.y + box.height / 2 - 32 * 3, { button: 'right' });
  await win.waitForTimeout(800);
  console.log('después de clic derecho:', await pos());
  await win.screenshot({ path: process.argv[2] + '/10-app.png' });
  await app.close();
})();
