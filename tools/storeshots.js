// Chrome Web Store screenshots (1280×800) from the real extension, silently.
const puppeteer = require('puppeteer'), path = require('path');
const EXT = path.resolve(__dirname, '../extension'), OUT = path.resolve(__dirname, '../store'), sleep = (ms) => new Promise(r => setTimeout(r, ms));
const FRAME = (title, sub, body) => `<div style="position:fixed;inset:0;background:#F6F5F3;font-family:Arial,sans-serif;z-index:1"><div style="position:absolute;left:56px;top:40px;right:56px"><div style="font:800 34px/1.2 Arial;color:#0F0F10">${title}</div><div style="font:400 19px/1.4 Arial;color:#57534E;margin-top:8px">${sub}</div></div><div style="position:absolute;left:56px;right:56px;top:150px;bottom:40px;background:#fff;border-radius:16px;box-shadow:0 10px 30px rgba(0,0,0,.08);padding:36px 44px;overflow:hidden">${body}</div></div>`;
(async () => {
  const br = await puppeteer.launch({ headless: true, args: ['--mute-audio', '--disable-extensions-except=' + EXT, '--load-extension=' + EXT] });
  const sw = await (await br.waitForTarget((t) => t.type() === 'service_worker', { timeout: 15000 })).worker();
  await sw.evaluate(() => chrome.storage.local.set({ level: 2, words: { regularly: 'learning' } }));
  const p = await br.newPage();
  await p.setViewport({ width: 1280, height: 800 });
  await p.evaluateOnNewDocument(() => { try { window.speechSynthesis.speak = () => {}; } catch (e) {} });
  const page = async (html) => { await p.goto('http://127.0.0.1:9410/?p=1', { waitUntil: 'networkidle2', timeout: 120000 }); await p.evaluate((h) => { [...document.body.children].forEach((c) => { if (!/^SAWA-LENS/.test(c.tagName)) c.style.display = 'none'; }); document.body.insertAdjacentHTML('afterbegin', h); document.body.style.margin = 0; }, html); await sleep(15000); };
  const at = (id, w, n = 0) => p.evaluate((id, w, n) => { const el = document.getElementById(id), tw = document.createTreeWalker(el, NodeFilter.SHOW_TEXT); let t; while ((t = tw.nextNode())) { const i = t.data.indexOf(w); if (i >= 0) { const r = document.createRange(); r.setStart(t, i + n + 1); r.setEnd(t, i + n + 2); const b = r.getBoundingClientRect(); return { x: b.left + b.width / 2, y: b.top + b.height / 2 }; } } }, id, w, n);
  const art = '<p style="font:19px/1.75 Georgia,serif;color:#1C1917;max-width:720px">';
  if (process.env.ONLY) { /* fall through */ }
  // 1. meanings on hover
  await page(FRAME('Hover any word for its meaning', 'Arabic meaning, pronunciation and level — on any website you read.', `<article id="a"><h1 style="font:700 30px/1.3 Georgia,serif;margin:0 0 14px">Why walking every day changes your brain</h1>${art}Scientists have found that a short walk every morning can improve your memory and mood. People who walk regularly also sleep better, and they feel less anxious during the day.</p>${art}The researchers say the effect is surprisingly strong, even for people who start slowly. Experts recommend about twenty minutes, ideally outdoors, because daylight also helps the body keep a healthy rhythm.</p></article>`));
  let q = await at('a', 'anxious'); await p.mouse.move(q.x, q.y); await sleep(1800);
  await p.screenshot({ path: OUT + '/1-hover.png' });
  // 2. writing checker
  await p.mouse.move(5, 790);
  await page(FRAME('Write better English everywhere', 'Spelling and grammar mistakes are underlined while you type. Click one to fix it.', `<div style="font:600 15px Arial;color:#57534E;margin-bottom:8px">Reply</div><textarea id="ta" style="width:760px;height:150px;font:20px/1.6 Arial;padding:14px;border:1px solid #D6D3D1;border-radius:10px">I recieve your mesage yesterday and I was very hapy to hear from you.</textarea>`));
  await p.focus('#ta'); await p.keyboard.press('End'); await p.keyboard.type(' '); await sleep(2000);
  await sleep(3000); await p.mouse.click(158, 243); await sleep(1500); console.log('tip:', await p.evaluate(() => { const h = document.querySelector('sawa-lens-proof'); const t = h && h.shadowRoot.querySelector('.tip'); return t ? t.className + ' ' + t.innerText.replace(/s+/g, ' ') + ' @' + t.style.top : 'no host ' + !!h; }));
  await p.screenshot({ path: OUT + '/2-writing.png' });
  // 3. Arabic → English
  await page(FRAME('Arabic → English, too', 'Hover an Arabic word to see it in English — keep your brain in English all day.', `<div style="height:330px"></div><div id="a" dir="rtl" style="font:24px/1.8 Arial;max-width:900px;margin-left:auto">ذهبت إلى المدرسة مع أصدقائي وكان الطريق جميلا جدا.</div>`));
  q = await at('a', 'الطريق'); await p.mouse.move(q.x, q.y); await sleep(1800);
  await p.screenshot({ path: OUT + '/3-arabic.png' });
  // 4. select to save
  await p.mouse.move(5, 790);
  await page(FRAME('Save phrases you want to learn', 'Select words to translate them, hear them, and add them to your review cards.', `<article id="a"><div style="height:260px"></div>${art}When the meeting ran out of time, she decided to <b style="font-weight:400">put off</b> the decision until next week.</p></article>`));
  await p.evaluate(() => { const el = document.querySelector('#a p'), tw = document.createTreeWalker(el, NodeFilter.SHOW_TEXT); let t, s, e; while ((t = tw.nextNode())) { if (t.data.includes('put off')) { const r = document.createRange(); r.setStart(t, 0); r.setEnd(t, 7); const sel = getSelection(); sel.removeAllRanges(); sel.addRange(r); el.dispatchEvent(new MouseEvent('mouseup', { bubbles: true })); } } });
  await sleep(1500);
  await p.screenshot({ path: OUT + '/4-save.png' });
  // promo tile 440×280
  await p.setViewport({ width: 440, height: 280 });
  await p.setContent(`<body style="margin:0;width:440px;height:280px;background:#0F0F10;display:flex;flex-direction:column;justify-content:center;padding:0 34px;box-sizing:border-box;font-family:Arial"><div style="display:flex;align-items:center;gap:14px"><img src="data:image/png;base64,${require('fs').readFileSync(EXT + '/icons/128.png').toString('base64')}" style="width:64px;height:64px;border-radius:14px"><div style="color:#fff;font:800 30px/1.1 Arial">Language Lens</div></div><div style="color:#FDE68A;font:700 18px/1.4 Arial;margin-top:16px">Learn English from what you already read and watch</div><div style="color:#A8A29E;font:400 14px/1.4 Arial;margin-top:6px">by Sawa English</div></body>`);
  await p.screenshot({ path: OUT + '/promo-440x280.png' });
  await br.close();
  console.log('done');
})().catch(e => { console.error('FAILED', e.message); process.exit(1); });
