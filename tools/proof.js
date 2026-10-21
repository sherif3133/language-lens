// Silent test of the proofreader (spelling) and name handling, with the extension loaded.
const puppeteer = require('puppeteer');
const path = require('path');
const EXT = path.resolve(__dirname, '../extension'), OUT = process.argv[2];
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
(async () => {
  const br = await puppeteer.launch({ headless: true, args: ['--mute-audio', '--disable-extensions-except=' + EXT, '--load-extension=' + EXT] });
  const p = await br.newPage();
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.setViewport({ width: 1100, height: 700 });
  await p.goto('http://127.0.0.1:9410/?p=1', { waitUntil: 'networkidle2', timeout: 120000 });
  await p.evaluate(() => {
    document.body.insertAdjacentHTML('afterbegin', '<div style="padding:30px;background:#fff;position:relative;z-index:99999"><p id="names" style="font-size:20px">Yesterday I met Rose and Mark in Turkey, and we will visit them again.</p>'
      + '<textarea id="ta" style="width:600px;height:90px;font:18px/1.5 Arial;padding:8px">I recieve your mesage yesterday and I was very hapy to see Omar.</textarea>'
      + '<div id="ce" contenteditable="true" style="width:600px;min-height:60px;font:18px/1.5 Arial;border:1px solid #ccc;padding:8px;margin-top:10px">We had a beautifull day at the beech with Sara.</div></div>');
  });
  await sleep(2500);
  // names: hover "Rose" (mid-sentence name) and "visit" (a normal word)
  const pos = (w) => p.evaluate((w) => { const t = document.getElementById('names').firstChild, r = document.createRange(), i = t.data.indexOf(w); r.setStart(t, i + 1); r.setEnd(t, i + 2); const b = r.getBoundingClientRect(); return { x: b.left, y: b.top + b.height / 2 }; }, w);
  const card = () => p.evaluate(() => { const c = document.querySelector('sawa-lens-card'); if (!c) return 'hidden'; const r = c.shadowRoot || c; const v = [...r.children].filter(e => e.tagName !== 'STYLE' && getComputedStyle(e).display !== 'none' && +getComputedStyle(e).opacity > 0.1 && e.getBoundingClientRect().width > 0); return v.length ? 'SHOWN: ' + v.map(e => e.innerText.replace(/\s+/g, ' ').slice(0, 30)).join(' ') : 'hidden'; });
  let q = await pos('Rose'); await p.mouse.move(q.x, q.y); await sleep(1400); console.log('hover "Rose" (a name):', await card());
  await p.mouse.move(5, 650); await sleep(900);
  q = await pos('visit'); await p.mouse.move(q.x, q.y); await sleep(1400); console.log('hover "visit":', await card());
  console.log('name highlighted as a word?', await p.evaluate(() => { const out = []; for (const k of ['lens-next', 'lens-hard']) { const h = CSS.highlights.get(k); if (h) for (const r of h) out.push(r.toString()); } return out.filter(w => /Rose|Mark|Turkey/.test(w)).join(',') || 'no'; }));
  // proofreading a textarea
  await p.mouse.move(5, 650);
  await p.focus('#ta'); await p.keyboard.press('End'); await p.keyboard.type(' '); await sleep(1800);
  const marks = async () => p.evaluate(() => { const h = document.querySelector('sawa-lens-proof'); const r = h.shadowRoot; return { pill: r.querySelector('.pill').classList.contains('on') ? r.querySelector('.pill').textContent : 'none', under: [...r.querySelectorAll('.lay span')].map(s => s.className + ':' + s.textContent).join(', ') }; });
  console.log('textarea marks:', JSON.stringify(await marks()));
  await p.screenshot({ path: OUT + '/p1-textarea.png' });
  // click inside the misspelled word → tip → Fix
  await p.evaluate(() => { const ta = document.getElementById('ta'); const i = ta.value.indexOf('recieve') + 3; ta.setSelectionRange(i, i); ta.dispatchEvent(new MouseEvent('mouseup', { bubbles: true })); });
  await sleep(600);
  console.log('tip:', await p.evaluate(() => document.querySelector('sawa-lens-proof').shadowRoot.querySelector('.tip').innerText.replace(/\s+/g, ' ')));
  await p.screenshot({ path: OUT + '/p2-tip.png' });
  await p.evaluate(() => document.querySelector('sawa-lens-proof').shadowRoot.querySelector('[data-a="fix"]').click()); await sleep(1500);
  console.log('after Fix:', await p.$eval('#ta', e => e.value));
  // rich editor
  await p.focus('#ce'); await p.keyboard.press('End'); await p.keyboard.type(' '); await sleep(1800);
  console.log('rich editor marks:', await p.evaluate(() => { const h = CSS.highlights.get('lens-spell'); return h ? [...h].map(r => r.toString()).join(', ') : 'none'; }));
  await p.screenshot({ path: OUT + '/p3-rich.png' });
  console.log('JS errors:', errs.length ? JSON.stringify(errs.slice(0, 4)) : 'none');
  await br.close();
})().catch(e => { console.error('FAILED', e.message); process.exit(1); });
