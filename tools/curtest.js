// Silent test: 💡 Curious button, the daily Learning cap, and the "words read" counter.
const puppeteer = require('puppeteer'), path = require('path');
const EXT = path.resolve(__dirname, '../extension'), sleep = (ms) => new Promise(r => setTimeout(r, ms));
(async () => {
  const br = await puppeteer.launch({ headless: true, args: ['--mute-audio', '--disable-extensions-except=' + EXT, '--load-extension=' + EXT] });
  const sw = await (await br.waitForTarget((t) => t.type() === 'service_worker', { timeout: 15000 })).worker();
  const p = await br.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.setViewport({ width: 1100, height: 800 });
  await p.goto('http://127.0.0.1:9410/?p=1', { waitUntil: 'networkidle2', timeout: 120000 });
  await p.evaluate(() => document.body.insertAdjacentHTML('afterbegin', '<article style="padding:40px;background:#fff;position:relative;z-index:99999;font-size:20px"><p id="a">Scientists say that walking every morning can improve your memory and make you feel less anxious during the day.</p><p>People who walk regularly also sleep better and have more energy in the afternoon, the researchers explained.</p></article>'));
  await sleep(9000);
  console.log('read so far:', JSON.stringify((await sw.evaluate(() => chrome.storage.local.get('daily'))).daily));
  const at = (w) => p.evaluate((w) => { const t = document.getElementById('a').firstChild, r = document.createRange(), i = t.data.indexOf(w); r.setStart(t, i + 1); r.setEnd(t, i + 2); const b = r.getBoundingClientRect(); return { x: b.left + b.width / 2, y: b.top + b.height / 2 }; }, w);
  const btns = () => p.evaluate(() => { const c = document.querySelector('sawa-lens-card').shadowRoot.querySelector('.card.on'); return c ? [...c.querySelectorAll('.btns button')].map(b => b.textContent).join(' | ') + ' || ' + ((c.querySelector('.msg') || {}).textContent || '') : 'hidden'; });
  let q = await at('anxious'); await p.mouse.move(q.x, q.y); await sleep(1500);
  console.log('card buttons:', await btns());
  await p.evaluate(() => document.querySelector('sawa-lens-card').shadowRoot.querySelector('[data-a=curious]').click()); await sleep(1500);
  console.log('after 💡 (signed out):', await btns());
  // the daily cap: pretend 30 new Learning words were added today
  await sw.evaluate(async () => { const d = new Date(), t = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); await chrome.storage.local.set({ daily: { day: t, read: 0, heard: 0, curious: 0, learning: 30 } }); });
  await p.mouse.move(5, 790); await sleep(800);
  q = await at('memory'); await p.mouse.move(q.x, q.y); await sleep(1500);
  await p.evaluate(() => document.querySelector('sawa-lens-card').shadowRoot.querySelector('[data-a=learning]').click()); await sleep(1200);
  console.log('Learning over the cap:', await btns());
  await p.screenshot({ path: process.argv[2] + '/curious.png' });
  console.log('JS errors:', errs.length ? JSON.stringify(errs.slice(0, 3)) : 'none');
  await br.close();
})().catch(e => { console.error('FAILED', e.message); process.exit(1); });
