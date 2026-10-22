// Silent test: voice lines are recorded (never spoken), sounds are muted. Journal, report, share card, battle barks.
const puppeteer = require('puppeteer');
const B = 'http://127.0.0.1:9410', OUT = process.argv[2];
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
(async () => {
  const br = await puppeteer.launch({ headless: true, args: ['--mute-audio'] });
  const p = await br.newPage();
  const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  await p.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
  await p.setCookie({ name: 'as_user', value: '3', url: B });
  await p.evaluateOnNewDocument(() => {
    try { localStorage.setItem('sawaWorldTour', '1'); } catch (e) {}
    window.__lines = []; window.__tones = 0;
    if (window.speechSynthesis) window.speechSynthesis.speak = (u) => { window.__lines.push((u.pitch || 1).toFixed(2) + '|' + u.text); setTimeout(() => u.onend && u.onend(), 30); };
    const AC = window.AudioContext; if (AC) { const o = AC.prototype.createOscillator; AC.prototype.createOscillator = function () { window.__tones++; return o.call(this); }; }
  });
  await p.goto(B + '/app/?g=' + Date.now() + '#community', { waitUntil: 'networkidle2', timeout: 120000 });
  const e = await p.waitForSelector('pierce/[data-act="w-open"]', { timeout: 90000 }); await e.evaluate(x => x.click());
  await p.waitForFunction(() => window.SawaGame && window.SawaGame.scene() && window.SawaGame.scene().pl, { timeout: 120000 }); await sleep(2000);
  const R = () => p.evaluateHandle(() => [...document.querySelectorAll('*')].find(e => e.shadowRoot && e.shadowRoot.querySelector('.sg-root')).shadowRoot);
  const txt = async (sel) => (await R()).evaluate((r, s) => { const e = r.querySelector(s); return e ? e.innerText.replace(/\s+/g, ' ') : ''; }, sel);
  const clickG = async (g) => (await R()).evaluate((r, g) => { const more = r.querySelector('[data-g="more"]'); if (!r.querySelector('[data-g="' + g + '"]') && more) more.click(); const b = r.querySelector('[data-g="' + g + '"]'); if (b) b.click(); return !!b; }, g);
  if (await txt('.sg-look')) { await (await R()).evaluate(r => r.querySelector('[data-o="save"]').click()); await sleep(2500); for (let i = 0; i < 5; i++) { await (await R()).evaluate(r => { const b = r.querySelector('.sg-dlg .pri'); if (b) b.click(); }); await sleep(300); } }
  console.log('menu (collapsed):', (await txt('.sg-menu')).replace(/ /g, ''));
  // NPC voice: the smith's deep voice
  await p.evaluate(() => { const s = window.SawaGame.scene(); const n = s.npcs.find(x => x.npc === 'smith'); s.pl.setPosition(n.x, n.y + 14); s.near = { kind: 'npc', obj: n }; s.interact(); }); await sleep(800);
  await sleep(1500); console.log('NPC line (pitch|text):', await p.evaluate(() => window.__lines.slice(-2).join(' // ')), '| dialog:', (await txt('.sg-dlg')).slice(0, 60));
  await (await R()).evaluate(r => { const b = r.querySelector('.sg-dlg [data-o="x"]'); if (b) b.click(); });
  // tap the health bar
  await (await R()).evaluate(r => r.querySelector('[data-bar="hp"]').click()); await sleep(600);
  console.log('bar help:', (await txt('.sg-dlg')).slice(0, 90)); await (await R()).evaluate(r => { const b = r.querySelector('.sg-dlg [data-o="x"]'); if (b) b.click(); });
  // journal, weekly report, share card
  await clickG('journal'); await sleep(3000); console.log('journal:', (await txt('.sg-panel')).slice(0, 220)); await p.screenshot({ path: OUT + '/v1-journal.png' });
  await clickG('report'); await sleep(3000); console.log('report:', (await txt('.sg-panel')).slice(0, 160));
  await clickG('share'); await sleep(1500); console.log('share card image:', await (await R()).evaluate(r => { const i = r.querySelector('.sg-card-img'); return i ? i.naturalWidth + 'x' + i.naturalHeight : 'none'; }), '| text:', (await (await R()).evaluate(r => r.querySelector('.sg-sharep textarea').value)).slice(0, 90));
  await p.screenshot({ path: OUT + '/v2-share.png' });
  await (await R()).evaluate(r => r.querySelector('.sg-panel [data-p="x"]').click()); await sleep(400);
  // a battle: growl, barks, sounds
  const tones0 = await p.evaluate(() => window.__tones), lines0 = await p.evaluate(() => window.__lines.length);
  await p.evaluate(() => { const s = window.SawaGame.scene(); const m = s.monsters.find(x => x.active && !(x.flee > s.time.now)); s.cool = 0; s.frozen = false; s.pl.setPosition(m.x - 4, m.y); });
  await p.waitForSelector('pierce/.sg-battle.on .sg-qn', { timeout: 60000 }); await sleep(800);
  console.log('skills at level 1:', (await txt('.sg-skills-soon')) || (await txt('.sg-skills')).slice(0, 40));
  for (let k = 0; k < 40; k++) {
    if (await (await R()).evaluate(r => !!r.querySelector('.sg-res'))) break;
    await (await R()).evaluate(r => { const t = r.querySelector('.sg-typer input'); if (t) { t.value = 'x'; r.querySelector('.sg-typer [data-done]').click(); return; } const o = r.querySelector('.sg-order'); if (o) { o.querySelectorAll('[data-tok]').forEach(c => c.click()); o.querySelector('[data-done]').click(); return; } const b = r.querySelector('.sg-ops button:not([disabled])'); if (b) b.click(); });
    await sleep(2800);
  }
  await p.waitForSelector('pierce/.sg-res', { timeout: 60000 }); await sleep(500);
  console.log('result:', (await txt('.sg-res h3')));
  console.log('battle sounds made:', (await p.evaluate(() => window.__tones)) - tones0, '| voice lines in battle:', (await p.evaluate(l => window.__lines.slice(l), lines0)).join(' / '));
  console.log('JS errors:', errs.length ? JSON.stringify(errs.slice(0, 6)) : 'none');
  await br.close();
})().catch(e => { console.error('FAILED', e.message); process.exit(1); });
