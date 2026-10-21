// Load the extension, then check hover vs select mode on an ordinary web page (silent).
const puppeteer = require('puppeteer');
const path = require('path');
const EXT = path.resolve(__dirname, '../extension');
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
(async () => {
  const br = await puppeteer.launch({ headless: true, args: ['--mute-audio', '--disable-extensions-except=' + EXT, '--load-extension=' + EXT] });
  const p = await br.newPage();
  await p.setViewport({ width: 1100, height: 700 });
  await p.goto('http://127.0.0.1:9410/?p=1', { waitUntil: 'networkidle2', timeout: 120000 });
  await p.evaluate(() => { document.body.insertAdjacentHTML('afterbegin', '<p id="t" style="font-size:22px;padding:40px">The ambassador explained the difficult situation to the curious journalists yesterday.</p>'); });
  await sleep(3000);
  const card = () => p.evaluate(() => { const c = document.querySelector('sawa-lens-card'); if (!c) return 'none'; const r = c.shadowRoot || c; const vis = [...r.children].filter(e => e.tagName !== 'STYLE').map(e => { const cs = getComputedStyle(e); const b = e.getBoundingClientRect(); return (cs.display !== 'none' && cs.visibility !== 'hidden' && +cs.opacity > 0.1 && b.width > 0) ? e.innerText.replace(/\s+/g, ' ').trim().slice(0, 60) : ''; }).filter(Boolean); return vis.length ? 'SHOWN: ' + vis.join(' | ') : 'hidden'; });
  const word = await p.evaluate(() => { const t = document.getElementById('t').firstChild, r = document.createRange(); const i = t.data.indexOf('ambassador'); r.setStart(t, i + 3); r.setEnd(t, i + 4); const b = r.getBoundingClientRect(); return { x: b.left, y: b.top + b.height / 2 }; });
  console.log('page script loaded:', await p.evaluate(() => !!document.querySelector('sawa-lens-page')));
  // hover mode (default)
  await p.mouse.move(word.x, word.y); await sleep(1500);
  console.log('hover mode, hover:', await card());
  // switch to select mode through the extension's storage
  const sw = await br.waitForTarget(t => t.type() === 'service_worker');
  const worker = await sw.worker();
  await worker.evaluate(() => chrome.storage.local.set({ hoverMode: 'select' })); await p.keyboard.press('Escape'); await p.mouse.click(10, 650);
  await p.mouse.move(10, 600); await sleep(1200);
  await p.mouse.move(word.x + 2, word.y); await sleep(1500);
  const hov = await card();
  console.log('select mode, hover only:', hov);
  // double-click the word → its word card
  await p.mouse.click(word.x, word.y, { clickCount: 2 }); await sleep(1500);
  console.log('select mode, double-click:', await card());
  await worker.evaluate(() => chrome.storage.local.set({ hoverMode: 'hover' }));
  await br.close();
})().catch(e => { console.error('FAILED', e.message); process.exit(1); });
