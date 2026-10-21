// Silent test: the word card closes on click-away and on its × button.
const puppeteer = require('puppeteer'), path = require('path');
const EXT = path.resolve(__dirname, '../extension'), sleep = (ms) => new Promise(r => setTimeout(r, ms));
(async () => {
  const br = await puppeteer.launch({ headless: true, args: ['--mute-audio', '--disable-extensions-except=' + EXT, '--load-extension=' + EXT] });
  const p = await br.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.setViewport({ width: 1100, height: 700 });
  await p.goto('http://127.0.0.1:9410/?p=1', { waitUntil: 'networkidle2', timeout: 120000 });
  await p.evaluate(() => document.body.insertAdjacentHTML('afterbegin', '<div style="padding:30px;background:#fff;position:relative;z-index:99999"><p id="t" style="font-size:22px">We will visit the museum tomorrow.</p></div>'));
  await sleep(2500);
  const pos = (w) => p.evaluate((w) => { const t = document.getElementById('t').firstChild, r = document.createRange(), i = t.data.indexOf(w); r.setStart(t, i + 1); r.setEnd(t, i + 2); const b = r.getBoundingClientRect(); return { x: b.left, y: b.top + b.height / 2 }; }, w);
  const open = () => p.evaluate(() => { const c = document.querySelector('sawa-lens-card'); return !!(c && c.shadowRoot.querySelector('.card.on')); });
  let q = await pos('museum'); await p.mouse.move(q.x, q.y); await sleep(1500);
  console.log('open after hover:', await open());
  await p.mouse.move(900, 600); await p.mouse.down(); await p.mouse.up(); await sleep(300);
  console.log('open after click away:', await open());
  q = await pos('visit'); await p.mouse.move(q.x, q.y); await sleep(1500);
  console.log('open again:', await open(), 'has ×:', await p.evaluate(() => !!document.querySelector('sawa-lens-card').shadowRoot.querySelector('.card.on .x')));
  const xb = await p.evaluate(() => { const b = document.querySelector('sawa-lens-card').shadowRoot.querySelector('.card.on .x').getBoundingClientRect(); return { x: b.left + b.width / 2, y: b.top + b.height / 2 }; });
  await p.mouse.move(xb.x, xb.y); await sleep(200); await p.screenshot({ path: process.argv[2] + '/cardx.png' });
  await p.mouse.down(); await p.mouse.up(); await sleep(300);
  console.log('open after ×:', await open());
  console.log('JS errors:', errs.length ? JSON.stringify(errs.slice(0, 3)) : 'none');
  await br.close();
})().catch(e => { console.error('FAILED', e.message); process.exit(1); });
