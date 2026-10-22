const puppeteer = require('puppeteer');
const B = 'http://127.0.0.1:9410';
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
(async () => {
  const br = await puppeteer.launch({ headless: true, args: ['--mute-audio', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const p = await br.newPage(); p.on('console', m => console.log('console:', m.text().slice(0, 160)));
  await p.setViewport({ width: 390, height: 844 });
  await p.setCookie({ name: 'as_user', value: '3', url: B });
  await p.evaluateOnNewDocument(() => { try { localStorage.setItem('sawaWorldTour', '1'); } catch (e) {} });
  await p.goto(B + '/app/?g=' + Date.now() + '#community', { waitUntil: 'networkidle2', timeout: 120000 });
  const e = await p.waitForSelector('pierce/[data-act="w-open"]', { timeout: 60000 }); await e.evaluate(x => x.click());
  await p.waitForFunction(() => window.SawaGame && window.SawaGame.scene() && window.SawaGame.scene().pl, { timeout: 120000 });
  await sleep(1500);
  const lost = () => p.evaluate(() => window.SawaGame.scene().game.renderer.contextLost);
  console.log('start lost', await lost());
  await p.evaluate(() => { const w = window.SawaGame.scene(); w.game.canvas.addEventListener('webglcontextlost', () => console.log('CONTEXT LOST at ' + (window.__step || '?'))); });
  await p.evaluate(() => { const w = window.SawaGame.scene(); const m = w.monsters.find(x => x.active); w.cool = 0; w.encounter(m); });
  for (let k = 0; k < 6; k++) { await sleep(700); console.log('t' + k, await lost()); }
  const btn = await p.waitForSelector('pierce/.sg-ops button', { timeout: 60000 }); console.log('panel up', await lost());
  await btn.evaluate(x => x.click());
  for (let q = 1; q < 6; q++) { for (let k = 0; k < 6; k++) { await sleep(500); const l = await lost(); if (l) { console.log('LOST at q' + q + ' t' + k); q = 9; break; } } if (q > 5) break; const b2 = await p.$('pierce/.sg-ops button:not([disabled])'); if (b2) { await b2.evaluate(x => x.click()); console.log('answered q' + q); } else { const r = await p.$('pierce/.sg-res'); console.log('no buttons; result?', !!r); } }
  await br.close();
})().catch(e => { console.error('FAILED', e.message); process.exit(1); });
