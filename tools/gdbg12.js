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
  console.log(await p.evaluate(async () => { const urls = [...document.scripts].map(s => s.src).filter(Boolean); const hits = []; for (const u of urls) { try { const t = await (await fetch(u)).text(); if (t.includes('loseContext')) hits.push(u.split('/').slice(-3).join('/')); } catch (e) {} } return 'scripts with loseContext: ' + hits.join(', ') + ' (of ' + urls.length + ')'; }));
  await br.close();
})().catch(e => { console.error('FAILED', e.message); process.exit(1); });
