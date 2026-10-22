// Silent headless test of the walkable Silk Road (no audio: the game has none, and Chrome is muted).
const puppeteer = require('puppeteer');
const B = 'http://127.0.0.1:9410', OUT = process.argv[2], UID = process.argv[3] || '3', W = +(process.argv[4] || 390), HH = +(process.argv[5] || 844);
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
(async () => {
  const br = await puppeteer.launch({ headless: true, args: ['--mute-audio', '--use-gl=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist'] });
  const p = await br.newPage();
  const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  p.on('response', r => { if (r.status() >= 400 && r.url().includes('wp-json')) console.log('HTTP', r.status(), r.url().replace(B, '')); });
  await p.setViewport({ width: W, height: HH, isMobile: W < 700, hasTouch: W < 700 });
  await p.setCookie({ name: 'as_user', value: UID, url: B });
  await p.evaluateOnNewDocument(() => { try { localStorage.setItem('sawaWorldTour', '1'); } catch (e) {} });
  await p.goto(B + '/app/?g=' + Date.now() + '#community', { waitUntil: 'networkidle2', timeout: 120000 });
  const clk = async (sel) => { const e = await p.waitForSelector(sel, { timeout: 60000 }); await e.evaluate(x => x.click()); };
  await clk('pierce/[data-act="w-open"]');
  await p.waitForSelector('pierce/.sg-root canvas', { timeout: 120000 });
  await p.waitForFunction(() => { const h = [...document.querySelectorAll('*')].find(e => e.shadowRoot && e.shadowRoot.querySelector('.sg-root')); return h && !h.shadowRoot.querySelector('.sg-load'); }, { timeout: 120000 });
  await sleep(1500);
  const R = () => p.evaluateHandle(() => [...document.querySelectorAll('*')].find(e => e.shadowRoot && e.shadowRoot.querySelector('.sg-root')).shadowRoot);
  const txt = async (sel) => (await R()).evaluate((r, s) => { const e = r.querySelector(s); return e ? e.innerText.replace(/\s+/g, ' ') : ''; }, sel);
  // character creator on first visit
  if (await txt('.sg-look')) {
    console.log('creator:', (await txt('.sg-look')).slice(0, 120));
    await p.screenshot({ path: OUT + '/g0-creator.png' });
    for (let i = 0; i < 2; i++) await clk('pierce/[data-l="hair"][data-v="1"]');
    await clk('pierce/[data-l="outfit"][data-v="1"]');
    await clk('pierce/[data-o="save"]');
    await sleep(2500);
  }
  await sleep(1500); console.log('welcome:', (await txt('.sg-dlg')).slice(0, 160)); await p.screenshot({ path: OUT + '/g11-welcome.png' });
  for (let i = 0; i < 4; i++) { await clk('pierce/.sg-dlg .pri'); await sleep(400); }
  console.log('after welcome dialog open:', !!(await txt('.sg-dlg')));
  console.log('JS errors:', JSON.stringify(errs));
  await br.close();
})().catch(e => { console.error('FAILED', e.message); process.exit(1); });
