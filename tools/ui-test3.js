// Prueba del modo moderno: WASD, poteo con espacio, x50.
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch();
  const pg = await b.newPage({ viewport: { width: 1280, height: 800 } });
  pg.on('pageerror', (e) => console.log('ERROR PAGINA:', e.message));
  await pg.goto('http://localhost:7666/'); await pg.waitForTimeout(1200);
  await pg.click('#b-goto-create'); await pg.waitForTimeout(800);
  await pg.fill('#c-name', 'Probador'); await pg.fill('#c-pass', '1234'); await pg.fill('#c-pass2', '1234');
  await pg.click('#c-ok'); await pg.waitForTimeout(2500);
  const pos = () => pg.evaluate(() => { const E = window.__AO.E; const m = E.chars.get(window.__AO.S.me); return [m.x, m.y]; });
  console.log('inicio', await pos(), 'boton:', await pg.textContent('#b-keys'));
  for (const k of ['KeyS', 'KeyS', 'KeyD', 'KeyD']) { await pg.keyboard.down(k.slice(3).toLowerCase()); await pg.waitForTimeout(240); await pg.keyboard.up(k.slice(3).toLowerCase()); }
  await pg.waitForTimeout(400);
  console.log('después de S S D D', await pos());
  const say = async (t) => { await pg.press('body', 'Enter'); await pg.fill('#chat', t); await pg.press('#chat', 'Enter'); await pg.waitForTimeout(500); };
  await say('/MOD Probador HP 100');
  await pg.evaluate(() => window.__AO.send({ t: 'talk', text: '/EST' }));
  await pg.waitForTimeout(500);
  const hpAntes = await pg.textContent('#t-hp');
  await pg.keyboard.press('Space'); await pg.waitForTimeout(400);
  const potas = await pg.evaluate(() => window.__AO.S.inv[1] && window.__AO.S.inv[1].a);
  console.log('vida', hpAntes, 'pociones rojas después de Espacio:', potas, 'oro inicial:', await pg.textContent('#s-gold'));
  await say('/TELEP YO 2 50 50'); await say('/GOD'); await say('/ACC 500');
  await pg.waitForTimeout(600);
  const info = await pg.evaluate(() => { const E = window.__AO.E; const me = E.chars.get(window.__AO.S.me); let bat = null; for (const c of E.chars.values()) if (c.n === 'Murcielago' && Math.abs(c.x - me.x) + Math.abs(c.y - me.y) <= 3) bat = [c.x, c.y]; return { me: [me.x, me.y], bat }; });
  console.log('yo', info.me, 'murcielago', info.bat);
  const dx = info.bat[0] - info.me[0], dy = info.bat[1] - info.me[1];
  const key = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'd' : 'a') : (dy > 0 ? 's' : 'w');
  for (let i = 0; i < 3; i++) { await pg.keyboard.press(key); await pg.waitForTimeout(260); await pg.keyboard.press('f'); await pg.waitForTimeout(1000); }
  const log = await pg.evaluate(() => [...document.querySelectorAll('#console div')].slice(-6).map((d) => d.textContent));
  console.log(log.join('\n'));
  await pg.screenshot({ path: process.argv[2] + '/9-moderno.png' });
  await b.close();
})();
