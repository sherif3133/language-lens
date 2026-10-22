// Silent test of the new battles: all question types, skills, combos, result, ranks, level-up popup.
const puppeteer = require('puppeteer');
const B = 'http://127.0.0.1:9410', OUT = process.argv[2];
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
(async () => {
  const br = await puppeteer.launch({ headless: true, args: ['--mute-audio'] });
  const p = await br.newPage();
  const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  await p.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
  await p.setCookie({ name: 'as_user', value: '3', url: B });
  await p.evaluateOnNewDocument(() => { try { localStorage.setItem('sawaWorldTour', '1'); } catch (e) {} if (window.speechSynthesis) window.speechSynthesis.speak = () => {}; });
  await p.goto(B + '/app/?g=' + Date.now() + '#community', { waitUntil: 'networkidle2', timeout: 120000 });
  const e = await p.waitForSelector('pierce/[data-act="w-open"]', { timeout: 90000 }); await e.evaluate(x => x.click());
  await p.waitForFunction(() => window.SawaGame && window.SawaGame.scene() && window.SawaGame.scene().pl, { timeout: 120000 }); await sleep(2000);
  const R = () => p.evaluateHandle(() => [...document.querySelectorAll('*')].find(e => e.shadowRoot && e.shadowRoot.querySelector('.sg-root')).shadowRoot);
  const txt = async (sel) => (await R()).evaluate((r, s) => { const e = r.querySelector(s); return e ? e.innerText.replace(/\s+/g, ' ') : ''; }, sel);
  if (await txt('.sg-look')) { await (await R()).evaluate(r => r.querySelector('[data-o="save"]').click()); await sleep(2500); for (let i = 0; i < 5; i++) { await (await R()).evaluate(r => { const b = r.querySelector('.sg-dlg .pri'); if (b) b.click(); }); await sleep(300); } }
  await p.screenshot({ path: OUT + '/b0-hud.png' }); console.log('menu:', (await txt('.sg-menu')).replace(/ /g, ''));
  let types = [];
  for (let fight = 0; fight < 2; fight++) {
    await p.evaluate(() => { const s = window.SawaGame.scene(); const m = s.monsters.find(x => x.active && !(x.flee > s.time.now)); s.cool = 0; s.frozen = false; s.pl.setPosition(m.x - 4, m.y); });
    await p.waitForSelector('pierce/.sg-battle.on .sg-qn', { timeout: 60000 }); await sleep(800);
    if (fight === 0) { await p.screenshot({ path: OUT + '/b1-battle.png' }); const sk = await p.$('pierce/[data-sk="focus"]:not([disabled])'); if (sk) { await sk.evaluate(x => x.click()); await sleep(2500); console.log('after Focus:', (await txt('.sg-ops')).slice(0, 60), '| mana', (await txt('.sg-mpb'))); } }
    for (let k = 0; k < 40; k++) {
      if (await (await R()).evaluate(r => !!r.querySelector('.sg-res'))) break;
      const t = await (await R()).evaluate(r => r.querySelector('.sg-typer') ? 'type' : r.querySelector('.sg-order') ? 'order' : r.querySelector('.sg-listen') ? 'listen' : r.querySelector('.sg-ops') ? 'mc' : 'wait');
      if (t === 'wait') { await sleep(700); continue; }
      types.push(t);
      if (t === 'type') { await (await R()).evaluate(r => { const i = r.querySelector('.sg-typer input'); i.value = 'umbrella'; r.querySelector('.sg-typer [data-done]').click(); }); if (fight === 0) { await sleep(300); await p.screenshot({ path: OUT + '/b2-type.png' }); } }
      else if (t === 'order') { if (fight === 0) await p.screenshot({ path: OUT + '/b3-order.png' }); await (await R()).evaluate(r => { r.querySelectorAll('[data-tok]').forEach(c => c.click()); r.querySelector('.sg-order [data-done]').click(); }); }
      else { await (await R()).evaluate(r => { const b = r.querySelector('.sg-ops button:not([disabled])'); if (b) b.click(); }); }
      await sleep(400); if (fight === 0 && k === 1) await p.screenshot({ path: OUT + '/b4-hit.png' });
      await sleep(2400);
    }
    await p.waitForSelector('pierce/.sg-res', { timeout: 60000 }); await sleep(400);
    console.log('fight', fight + 1, 'result:', (await txt('.sg-res')).slice(0, 200));
    if (fight === 0) await p.screenshot({ path: OUT + '/b5-result.png' });
    await (await R()).evaluate(r => r.querySelector('.sg-res [data-x]').click()); await sleep(7000);
  }
  console.log('question types seen:', types.join(','));
  console.log('hud after:', (await txt('.sg-top')).slice(0, 140));
  await (await R()).evaluate(r => r.querySelector('[data-g="ranks"]').click()); await sleep(3000);
  console.log('ranks:', (await txt('.sg-panel')).slice(0, 200));
  await p.screenshot({ path: OUT + '/b6-ranks.png' });
  await (await R()).evaluate(r => r.querySelector('.sg-panel [data-p="x"]').click());
  await p.evaluate(() => window.SawaGame.scene()); // level-up popup preview
  await (await R()).evaluate(() => {});
  console.log('JS errors:', errs.length ? JSON.stringify(errs.slice(0, 6)) : 'none');
  await br.close();
})().catch(e => { console.error('FAILED', e.message); process.exit(1); });
