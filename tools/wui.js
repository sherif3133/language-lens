// Silent UI test of the Silk Road world inside the one app (headless, audio muted).
const puppeteer = require('puppeteer');
const B = 'http://127.0.0.1:9410', OUT = process.argv[2], UID = process.argv[3] || '3';
let p; const clk = async (sel) => { const e = await p.waitForSelector(sel, { timeout: 30000 }); await e.evaluate(x => x.click()); };
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
(async () => {
  const br = await puppeteer.launch({ headless: true, args: ['--mute-audio'] });
  p = await br.newPage();
  const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  p.on('response', async r => { if (r.status() >= 400) { let t = ''; try { t = (await r.text()).slice(0, 160); } catch (e) {} console.log('HTTP', r.status(), r.url().replace(B, ''), t); } });
  p.on('dialog', d => d.accept());
  await p.setViewport({ width: 390, height: 844, isMobile: true });
  await p.setCookie({ name: 'as_user', value: UID, url: B });
  await p.goto(B + '/app/#community', { waitUntil: 'networkidle2', timeout: 90000 });
  const wc = await p.waitForSelector('pierce/.wd-card', { timeout: 90000 });
  console.log('card:', await wc.evaluate(e => e.innerText.replace(/\s+/g, ' ')));
  await wc.screenshot({ path: OUT + '/1-card.png' });
  await clk('pierce/[data-act="w-open"]');
  await p.waitForSelector('pierce/.wd-route', { timeout: 60000 });
  console.log('stage', await p.evaluate(() => window.SawaAppStage));
  await p.waitForSelector('pierce/.wd-tour', { timeout: 30000 }); await sleep(300);
  console.log('tour:', await p.$eval('pierce/.wd-tour', e => e.innerText.replace(/s+/g, ' ')));
  await p.screenshot({ path: OUT + '/0-tour.png' });
  for (let i = 0; i < 4; i++) { await clk('pierce/.wd-tour [data-act="w-tour"]'); await sleep(200); }
  await clk('pierce/[data-act="w-help"]'); await sleep(400); await p.screenshot({ path: OUT + '/0-help.png' }); await clk('pierce/#modal [data-act="close"]'); await sleep(200);
  await sleep(500);
  console.log('page width', await p.evaluate(() => document.documentElement.scrollWidth));
  await p.screenshot({ path: OUT + '/2-map.png', fullPage: true });
  // Fight a monster through the UI, answering the first option each time
  await clk('pierce/[data-act="w-fight"]');
  await p.waitForSelector('pierce/[data-bt]', { timeout: 60000 });
  await sleep(300);
  await p.screenshot({ path: OUT + '/3-question.png' });
  for (let i = 0; i < 5; i++) {
    const b = await p.waitForSelector('pierce/[data-bt="0"]', { timeout: 30000 });
    await b.evaluate(e => e.click()); await sleep(250);
  }
  await p.waitForSelector('pierce/.bt-review', { timeout: 60000 });
  await sleep(300);
  console.log('result:', await p.$eval('pierce/#modal', e => e.innerText.replace(/\s+/g, ' ').slice(0, 300)));
  await p.screenshot({ path: OUT + '/4-result.png' });
  await clk('pierce/#modal [data-act="close"]');
  await sleep(300);
  // Quests tab
  await clk('pierce/[data-act="w-tab"][data-tab="quests"]'); await sleep(400);
  await p.screenshot({ path: OUT + '/5-quests.png', fullPage: true });
  // Party tab: create a party
  await clk('pierce/[data-act="w-tab"][data-tab="party"]'); await sleep(400);
  console.log('party tab:', await p.$eval('pierce/#wd-body', e => e.innerText.replace(/s+/g, ' ').slice(0, 90)));
  await p.evaluate(() => { window.SawaAppStage = 5; }); await clk('pierce/[data-act="w-tab"][data-tab="party"]'); await sleep(400);
  await p.screenshot({ path: OUT + '/6-party-none.png', fullPage: true });
  await (await p.$('pierce/#w-pname')).type('Silk Riders');
  await clk('pierce/[data-act="w-create"]');
  await p.waitForSelector('pierce/.wd-members', { timeout: 60000 }); await sleep(400);
  await p.screenshot({ path: OUT + '/7-party.png', fullPage: true });
  // Live battle lobby
  await clk('pierce/[data-act="w-live-start"]');
  await p.waitForSelector('pierce/.live-b', { timeout: 60000 }); await sleep(1800);
  console.log('live:', await p.$eval('pierce/.live-b', e => e.innerText.replace(/\s+/g, ' ').slice(0, 200)));
  await p.screenshot({ path: OUT + '/8-live-lobby.png' });
  await clk('pierce/.live-b [data-act="close"]'); await sleep(300);
  // Back to community; leave the party to clean up
  await clk('pierce/[data-act="w-leave"]'); await sleep(1500);
  await clk('pierce/[data-act="w-back"]');
  await p.waitForSelector('pierce/.wd-card', { timeout: 60000 });
  console.log('back in community: ok');
  console.log('JS errors:', errs.length ? errs : 'none');
  await br.close();
})().catch(e => { console.error('FAILED', e.message); process.exit(1); });
