// Silent headless test of the walkable Silk Road (no audio: the game has none, and Chrome is muted).
const puppeteer = require('puppeteer');
const B = 'http://127.0.0.1:9410', OUT = process.argv[2], UID = process.argv[3] || '3', W = +(process.argv[4] || 390), HH = +(process.argv[5] || 844);
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
(async () => {
  const br = await puppeteer.launch({ headless: true, args: ['--mute-audio', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
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
  console.log('hud:', await txt('.sg-top'));
  await p.screenshot({ path: OUT + '/g1-town.png' });
  const info = await p.evaluate(() => { const s = window.SawaGame.scene(); return { renderer: s.game.renderer.type, x: Math.round(s.pl.x), y: Math.round(s.pl.y), zoom: s.cameras.main.zoom, monsters: s.monsters.length, npcs: s.npcs.length, others: Object.keys(s.others).length, lights: s.lights.length }; });
  console.log('scene:', JSON.stringify(info));
  // walk with the keyboard
  await p.keyboard.down('ArrowUp'); await sleep(900); await p.keyboard.up('ArrowUp');
  const moved = await p.evaluate(() => { const s = window.SawaGame.scene(); return Math.round(s.pl.y); });
  console.log('walked up: y', info.y, '→', moved);
  // talk to the elder
  await p.evaluate(() => { const s = window.SawaGame.scene(); const e = s.npcs.find(n => n.npc === 'elder'); s.pl.setPosition(e.x, e.y + 14); });
  await sleep(400); await p.keyboard.press('KeyE'); await sleep(1600);
  console.log('elder:', (await txt('.sg-dlg')).slice(0, 200));
  await p.screenshot({ path: OUT + '/g2-elder.png' });
  await clk('pierce/.sg-dlg [data-o="x"]');
  // night
  await p.evaluate(() => { window.SawaGameHour = 21.5; const s = window.SawaGame.scene(); s.pl.setPosition(19 * 16, 21 * 16); });
  await sleep(900);
  await p.screenshot({ path: OUT + '/g3-night.png' });
  await p.evaluate(() => { window.SawaGameHour = null; });
  // meet the other student (user 2 is an echo nearby)
  const met = await p.evaluate(() => { const s = window.SawaGame.scene(); const ids = Object.keys(s.others); if (!ids.length) return 'nobody'; const o = s.others[ids[0]]; s.pl.setPosition(o.spr.x + 14, o.spr.y); s.near = { kind: 'player', obj: o }; s.interact(); return o.p.name + ' live=' + o.live; });
  console.log('other:', met); await sleep(2500);
  console.log('meet dialog:', (await txt('.sg-dlg')).slice(0, 220));
  await p.screenshot({ path: OUT + '/g4-meet.png' });
  const duel = await (await R()).evaluate(r => { const b = [...r.querySelectorAll('.sg-dlg button')].find(x => /Duel/.test(x.textContent)); if (b) { b.click(); return true; } return false; });
  console.log('duel clicked:', duel);
  if (duel) {
    await p.waitForSelector('pierce/.sg-battle.on .sg-ops', { timeout: 60000 }); await sleep(800);
    await p.screenshot({ path: OUT + '/g5-duel.png' });
    for (let i = 0; i < 5; i++) { await p.waitForSelector('pierce/.sg-ops button:not([disabled])', { timeout: 60000 }); await p.keyboard.press(String(1 + (i % 3))); await sleep(2600); }
    await p.waitForSelector('pierce/.sg-res', { timeout: 60000 }); await sleep(400);
    console.log('duel result:', await txt('.sg-res'));
    await p.screenshot({ path: OUT + '/g6-duel-result.png' });
    await clk('pierce/.sg-res [data-x]'); await sleep(800);
  }
  // fight a monster: put the player next to one
  await p.evaluate(() => { const s = window.SawaGame.scene(); const m = s.monsters.find(x => x.active); s.cool = 0; s.pl.setPosition(m.x - 4, m.y); });
  await p.waitForSelector('pierce/.sg-battle.on .sg-ops', { timeout: 60000 }); await sleep(900);
  console.log('battle:', (await txt('.sg-bp')).slice(0, 200));
  await p.screenshot({ path: OUT + '/g7-battle.png' });
  console.log('arena sprites:', await (await R()).evaluate(r => { const h = r.querySelector('.sg-hero'), f = r.querySelector('.sg-foe'); return h && f ? [Math.round(h.getBoundingClientRect().height), Math.round(f.getBoundingClientRect().height)].join('/') : 'missing'; }));
  await p.keyboard.press('1'); await sleep(500);
  await p.screenshot({ path: OUT + '/g8-hit.png' });
  for (let i = 1; i < 5; i++) { await p.waitForSelector('pierce/.sg-ops button:not([disabled])', { timeout: 60000 }); await p.keyboard.press(String(1 + (i % 3))); await sleep(2600); }
  await p.waitForSelector('pierce/.sg-res', { timeout: 60000 }); await sleep(400);
  console.log('battle result:', await txt('.sg-res'));
  await clk('pierce/.sg-res [data-x]'); await sleep(1000);
  // leave a note
  await clk('pierce/[data-g="note"]'); await sleep(300);
  await (await R()).evaluate(r => { r.querySelector('.sg-dlg input').value = 'Tip: practise past tense before the boss!'; });
  await clk('pierce/.sg-dlg [data-o="ok"]'); await sleep(2500);
  console.log('notes on map:', await p.evaluate(() => window.SawaGame.scene().notes.length));
  // quests panel over the game
  await clk('pierce/[data-g="quests"]'); await p.waitForSelector('pierce/#modal .wd-panel', { timeout: 60000 }); await sleep(400);
  await p.screenshot({ path: OUT + '/g9-quests.png' });
  await clk('pierce/#modal [data-act="close"]');
  console.log('page width', await p.evaluate(() => document.documentElement.scrollWidth));
  await clk('pierce/[data-g="exit"]'); await sleep(800);
  console.log('after exit, world card shown:', await p.evaluate(() => !![...document.querySelectorAll('*')].find(e => e.shadowRoot && e.shadowRoot.querySelector('.wd-card')) && ![...document.querySelectorAll('*')].find(e => e.shadowRoot && e.shadowRoot.querySelector('.sg-root'))));
  console.log('JS errors:', errs.length ? errs.slice(0, 8) : 'none');
  await br.close();
})().catch(e => { console.error('FAILED', e.message); process.exit(1); });
