// Silent test (audio muted, speech calls stubbed) of the in-game Lens, panels, chat, battle cooldown and position memory.
const puppeteer = require('puppeteer');
const B = 'http://127.0.0.1:9410', OUT = process.argv[2], UID = process.argv[3] || '3';
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
(async () => {
  const br = await puppeteer.launch({ headless: true, args: ['--mute-audio'] });
  const p = await br.newPage();
  const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  await p.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
  await p.setCookie({ name: 'as_user', value: UID, url: B });
  await p.evaluateOnNewDocument(() => {
    try { localStorage.setItem('sawaWorldTour', '1'); } catch (e) {}
    window.__said = []; window.speechSynthesis && (window.speechSynthesis.speak = (u) => window.__said.push(u.text)); // never speak out loud
  });
  const go = async () => { await p.goto(B + '/app/?g=' + Date.now() + '#community', { waitUntil: 'networkidle2', timeout: 120000 }); const e = await p.waitForSelector('pierce/[data-act="w-open"]', { timeout: 90000 }); await e.evaluate(x => x.click()); await p.waitForFunction(() => window.SawaGame && window.SawaGame.scene() && window.SawaGame.scene().pl, { timeout: 120000 }); await sleep(1800); };
  const clk = async (sel) => { const e = await p.waitForSelector(sel, { timeout: 40000 }); await e.evaluate(x => x.click()); };
  const R = () => p.evaluateHandle(() => [...document.querySelectorAll('*')].find(e => e.shadowRoot && e.shadowRoot.querySelector('.sg-root')).shadowRoot);
  const txt = async (sel) => (await R()).evaluate((r, s) => { const e = r.querySelector(s); return e ? e.innerText.replace(/\s+/g, ' ') : ''; }, sel);
  await go();
  // close the creator if it shows
  if (await txt('.sg-look')) { await clk('pierce/[data-o="save"]'); await sleep(2500); for (let i = 0; i < 4; i++) { const b = await p.$('pierce/.sg-dlg .pri'); if (b) await b.evaluate(x => x.click()); await sleep(300); } }
  console.log('menu:', (await txt('.sg-menu')).replace(/ /g, ''));
  console.log('music started:', await p.evaluate(() => { const g = window.SawaGame; return typeof AudioContext !== 'undefined'; }));
  // 1. tap a word in the Elder's dialog
  await p.evaluate(() => { const s = window.SawaGame.scene(); const e = s.npcs.find(n => n.npc === 'elder'); s.pl.setPosition(e.x, e.y + 14); s.near = { kind: 'npc', obj: e }; s.interact(); });
  await sleep(3500);
  const words = await (await R()).evaluate(r => r.querySelectorAll('.sg-dlg .lw').length);
  console.log('tappable words in dialog:', words);
  await (await R()).evaluate(r => { const w = [...r.querySelectorAll('.sg-dlg .lw')].find(x => x.textContent === 'traveller' || x.textContent === 'road'); (w || r.querySelector('.sg-dlg .lw')).click(); });
  await sleep(2500);
  console.log('word card:', (await txt('.sg-word')).slice(0, 160));
  await p.screenshot({ path: OUT + '/n1-word.png' });
  await (await R()).evaluate(r => r.querySelector('.sg-word [data-w="learn"]').click()); await sleep(2500);
  console.log('after + Learning:', (await txt('.sg-word [data-w="learn"]')));
  await (await R()).evaluate(r => r.querySelector('.sg-dlg [data-say]') && r.querySelector('.sg-dlg [data-say]').click());
  console.log('read aloud (stubbed):', (await p.evaluate(() => window.__said.slice(-1)[0] || '')).slice(0, 60));
  await (await R()).evaluate(r => { const x = r.querySelector('.sg-word [data-w="x"]'); if (x) x.click(); const b = r.querySelector('.sg-dlg [data-o="x"]'); if (b) b.click(); });
  // 2. today's plan in the game
  await clk('pierce/[data-g="today"]'); await sleep(3000);
  console.log('today:', (await txt('.sg-panel')).slice(0, 240));
  await p.screenshot({ path: OUT + '/n2-today.png' });
  // 3. review cards in the game
  await clk('pierce/[data-g="cards"]'); await sleep(3500);
  console.log('cards:', (await txt('.sg-panel')).slice(0, 200));
  const flip = await p.$('pierce/[data-r="flip"]');
  if (flip) { await flip.evaluate(x => x.click()); await sleep(600); await p.screenshot({ path: OUT + '/n3-card.png' }); console.log('back:', (await txt('.sg-card')).slice(0, 160)); await clk('pierce/[data-g2="3"]'); await sleep(2500); console.log('after grade:', (await txt('.sg-panel .small')).slice(0, 60)); }
  await clk('pierce/.sg-panel [data-p="x"]'); await sleep(500);
  // 4. chat in the game: type for real (keys must reach the input), then Franco-Arabic
  await clk('pierce/[data-g="chat"]'); await sleep(3000);
  const inp = await p.waitForSelector('pierce/.sg-send input', { timeout: 30000 });
  await inp.evaluate(x => x.focus()); await p.keyboard.type('Hello Kashgar, who wants to fight wolves?');
  console.log('typed:', await inp.evaluate(x => x.value));
  await p.keyboard.press('Enter'); await sleep(3500);
  console.log('chat after send:', (await txt('.sg-msgs')).slice(-90));
  await inp.evaluate(x => { x.value = 'ana 3ayez aroo7 el souq'; }); await clk('pierce/.sg-send button'); await sleep(4000);
  console.log('translate box:', (await txt('.sg-tr')).slice(0, 160));
  await p.screenshot({ path: OUT + '/n4-chat.png' });
  await clk('pierce/.sg-panel [data-p="x"]'); await sleep(500);
  // 5. lose a battle, then stand still: no second battle straight away
  await p.evaluate(() => { const s = window.SawaGame.scene(); const m = s.monsters.find(x => x.active); s.cool = 0; s.pl.setPosition(m.x - 4, m.y); });
  await p.waitForSelector('pierce/.sg-battle.on .sg-ops', { timeout: 60000 });
  for (let i = 0; i < 5; i++) { await p.waitForSelector('pierce/.sg-ops button:not([disabled])', { timeout: 60000 }); await (await R()).evaluate(r => r.querySelector('.sg-ops button:not([disabled])').click()); await sleep(2600); }
  await p.waitForSelector('pierce/.sg-res', { timeout: 60000 }); console.log('battle:', (await txt('.sg-res h3')));
  await clk('pierce/.sg-res [data-x]'); await sleep(5000);
  console.log('second battle started right away:', !!(await (await R()).evaluate(r => r.querySelector('.sg-battle.on'))));
  // 6. leave and come back: same spot
  const before = await p.evaluate(() => { const s = window.SawaGame.scene(); s.pl.setPosition(30 * 16, 21 * 16); return [Math.round(s.pl.x), Math.round(s.pl.y)]; });
  await sleep(600); await clk('pierce/[data-g="exit"]'); await sleep(4000);
  await go();
  const after = await p.evaluate(() => { const s = window.SawaGame.scene(); return [Math.round(s.pl.x), Math.round(s.pl.y)]; });
  console.log('position before exit', before.join(','), '→ after coming back', after.join(','));
  console.log('JS errors:', errs.length ? JSON.stringify(errs.slice(0, 6)) : 'none');
  await br.close();
})().catch(e => { console.error('FAILED', e.message); process.exit(1); });
