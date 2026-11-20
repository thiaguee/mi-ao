// Prueba visual: abre el cliente, crea un personaje, camina y saca capturas.
const { chromium } = require('playwright');
const OUT = process.argv[2];
const NAME = process.argv[3] || 'Thiago';
(async () => {
  const b = await chromium.launch();
  const pg = await b.newPage({ viewport: { width: 1280, height: 800 } });
  pg.on('console', (m) => { if (m.type() === 'error') console.log('CONSOLA:', m.text()); });
  pg.on('pageerror', (e) => console.log('ERROR PAGINA:', e.message));
  await pg.goto('http://localhost:7666/');
  await pg.waitForTimeout(1500);
  await pg.screenshot({ path: OUT + '/1-login.png' });
  await pg.click('#b-goto-create');
  await pg.waitForTimeout(1500);
  await pg.fill('#c-name', NAME);
  await pg.fill('#c-pass', 'clave123');
  await pg.fill('#c-pass2', 'clave123');
  await pg.waitForTimeout(1500);
  await pg.screenshot({ path: OUT + '/2-crear.png' });
  await pg.click('#c-ok');
  await pg.waitForTimeout(3500);
  await pg.screenshot({ path: OUT + '/3-juego.png' });
  for (const k of ['ArrowDown', 'ArrowDown', 'ArrowRight', 'ArrowRight', 'ArrowRight']) {
    await pg.keyboard.down(k); await pg.waitForTimeout(230); await pg.keyboard.up(k);
  }
  await pg.waitForTimeout(1500);
  await pg.screenshot({ path: OUT + '/4-caminar.png' });
  const st = await pg.evaluate(() => { const S = window.__AO.S, E = window.__AO.E; const me = E.chars.get(S.me); return { x: me.x, y: me.y, chars: E.chars.size, imgs: 0 }; });
  console.log('estado', JSON.stringify(st));
  await b.close();
})();
