// Prueba de juego: combate, comercio, hechizos y comandos GM.
const { chromium } = require('playwright');
const OUT = process.argv[2];
(async () => {
  const b = await chromium.launch();
  const pg = await b.newPage({ viewport: { width: 1280, height: 800 } });
  pg.on('response', (r) => { if (r.status() >= 400) console.log('HTTP', r.status(), r.url()); });
  pg.on('pageerror', (e) => console.log('ERROR PAGINA:', e.message));
  await pg.goto('http://localhost:7666/');
  await pg.waitForTimeout(1200);
  await pg.fill('#l-name', 'Thiago'); await pg.fill('#l-pass', 'clave123');
  await pg.click('#b-login');
  await pg.waitForTimeout(2500);
  const say = async (t) => { await pg.press('body', 'Enter'); await pg.fill('#chat', t); await pg.press('#chat', 'Enter'); await pg.waitForTimeout(500); };
  // Abrir comercio con el mercader más cercano
  const merchant = await pg.evaluate(() => { const E = window.__AO.E; for (const c of E.chars.values()) if (c.npc && /Mercader|Sastre|Herrero/.test(c.n)) return { x: c.x, y: c.y, n: c.n }; return null; });
  console.log('comerciante', JSON.stringify(merchant));
  if (merchant) {
    await say(`/TELEP YO 1 ${merchant.x} ${merchant.y + 1}`);
    await pg.waitForTimeout(800);
    await pg.evaluate((m) => window.__AO.send({ t: 'dclick', x: m.x, y: m.y }), merchant);
    await pg.waitForTimeout(1200);
    await pg.screenshot({ path: OUT + '/5-comercio.png' });
    await pg.keyboard.press('Escape');
  }
  // Ir a cazar: crear un lobo al lado y pegarle
  await say('/ORO Thiago 5000');
  await say('/TELEP YO 2 50 50');
  await pg.waitForTimeout(1200);
  await say('/ATACABLE');
  await say('/ACC 501');
  await pg.waitForTimeout(400);
  for (let i = 0; i < 12; i++) { await pg.keyboard.press('ArrowDown'); await pg.waitForTimeout(80); await pg.keyboard.press('Control'); await pg.waitForTimeout(950); }
  await pg.screenshot({ path: OUT + '/6-combate.png' });
  // Hechizos
  await say('/CLASE Thiago 38');
  await say('/HECHIZO Thiago 23');
  await say('/HECHIZO Thiago 15');
  await pg.click('[data-tab=spells]');
  await pg.waitForTimeout(500);
  await say('/MEDITAR');
  await pg.waitForTimeout(1500);
  await pg.screenshot({ path: OUT + '/7-hechizos.png' });
  const log = await pg.evaluate(() => [...document.querySelectorAll('#console div')].slice(-25).map((d) => d.textContent));
  console.log(log.join('\n'));
  await b.close();
})();
