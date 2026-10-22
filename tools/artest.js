// Silent test of Arabic → English: hover Arabic words (dictionary), select Arabic text (AI, needs sign-in).
const puppeteer = require('puppeteer'), path = require('path');
const EXT = path.resolve(__dirname, '../extension'), sleep = (ms) => new Promise(r => setTimeout(r, ms));
(async () => {
  const br = await puppeteer.launch({ headless: true, args: ['--mute-audio', '--disable-extensions-except=' + EXT, '--load-extension=' + EXT] });
  const p = await br.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.setViewport({ width: 1100, height: 800 });
  await p.goto('http://127.0.0.1:9410/?p=1', { waitUntil: 'networkidle2', timeout: 120000 });
  await p.evaluate(() => document.body.insertAdjacentHTML('afterbegin', '<div style="padding:40px;background:#fff;position:relative;z-index:99999"><p id="a" dir="rtl" style="font-size:24px">ذهبت إلى المدرسة مع أصدقائي وكان الطريق جميلا جدا.</p><p id="b" dir="rtl" style="font-size:24px;margin-top:260px">دا خطير اوي بجد</p></div>'));
  await sleep(2500);
  const card = () => p.evaluate(() => { const c = document.querySelector('sawa-lens-card'); const e = c && c.shadowRoot.querySelector('.card.on'); return e ? e.innerText.replace(/\s+/g, ' ').slice(0, 220) : 'hidden'; });
  const at = (id, w) => p.evaluate((id, w) => { const t = document.getElementById(id).firstChild, r = document.createRange(), i = t.data.indexOf(w); r.setStart(t, i + 1); r.setEnd(t, i + 2); const b = r.getBoundingClientRect(); return { x: b.left + b.width / 2, y: b.top + b.height / 2 }; }, id, w);
  for (const w of ['المدرسة', 'الطريق', 'جميلا', 'أصدقائي']) {
    await p.mouse.move(5, 790); await sleep(700);
    const q = await at('a', w); await p.mouse.move(q.x, q.y); await sleep(1500);
    console.log('hover', w, '→', await card());
    if (w === 'الطريق') await p.screenshot({ path: process.argv[2] + '/ar-hover.png' });
  }
  await p.mouse.move(5, 790); await p.mouse.down(); await p.mouse.up(); await sleep(300);
  await p.evaluate(() => { const t = document.getElementById('b').firstChild, r = document.createRange(); r.setStart(t, 0); r.setEnd(t, t.data.length); const s = getSelection(); s.removeAllRanges(); s.addRange(r); document.getElementById('b').dispatchEvent(new MouseEvent('mouseup', { bubbles: true })); });
  await sleep(2500);
  console.log('select Arabic →', await card());
  console.log('JS errors:', errs.length ? JSON.stringify(errs.slice(0, 3)) : 'none');
  await br.close();
})().catch(e => { console.error('FAILED', e.message); process.exit(1); });
