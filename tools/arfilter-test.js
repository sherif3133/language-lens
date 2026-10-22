// Silent test of "Hide Arabic videos on YouTube": fake YouTube pages (served for youtube.com URLs, so the real
// content script runs), home + Up next + Shorts shelf + the Shorts player, on a computer and a phone.
const puppeteer = require('puppeteer'), path = require('path');
const EXT = path.resolve(__dirname, '../extension'), OUT = process.argv[2] || '.', sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let fails = 0; const ok = (c, l, x) => { console.log((c ? 'PASS ' : 'FAIL ') + l + (x !== undefined ? ' → ' + JSON.stringify(x) : '')); if (!c) fails++; };
const tile = (tag, t) => `<${tag}><a id="video-title" title="${t}">${t}</a></${tag}>`;
const AR = ['الحلقة الكاملة | برنامج المواهب 2026', 'اهداف مباراة الاهلي والزمالك اليوم', 'ازاي تذاكر صح؟ نصايح مهمة'], EN = ['How to learn English fast', 'J. Cole - Love Yourz', 'Morning routine vlog 2026 🔥', 'شرح ‎Present Perfect in English grammar explained simply'];
const home = (tag) => `<html><body><div id="feed">${AR.map((t) => tile(tag, t)).join('')}${EN.map((t) => tile(tag, t)).join('')}</div><ytd-rich-section-renderer id="shelf">${tile('ytd-reel-item-renderer', 'مقلب في صاحبي 😂')}${tile('ytd-reel-item-renderer', 'نكت مصرية')}</ytd-rich-section-renderer></body></html>`;
const watch = `<html><body><div id="up">${tile('ytd-compact-video-renderer', 'اغنية جديدة 2026')}${tile('ytd-compact-video-renderer', 'TED: The power of habits')}</div></body></html>`;
const shorts = `<html><body><ytd-reel-video-renderer is-active><h2>ضحك السنين مع اصحابي</h2></ytd-reel-video-renderer><div id="navigation-button-down"><button onclick="history.pushState({},'','/shorts/BBBBBBBBBBB');document.querySelector('h2').textContent='Funny cat compilation';window.__next=(window.__next||0)+1">down</button></div></body></html>`;
(async () => {
  const br = await puppeteer.launch({ headless: true, args: ['--mute-audio', '--disable-extensions-except=' + EXT, '--load-extension=' + EXT] });
  const sw = await (await br.waitForTarget((t) => t.type() === 'service_worker', { timeout: 15000 })).worker();
  await sw.evaluate(() => chrome.storage.local.set({ hideArabicYT: true }));
  for (const [dev, host, tag] of [['computer', 'www', 'ytd-rich-item-renderer'], ['phone', 'm', 'ytm-rich-item-renderer']]) {
    const p = await br.newPage(); const errs = []; p.on('pageerror', (e) => errs.push(e.message));
    await p.setRequestInterception(true);
    p.on('request', (r) => { const u = new URL(r.url()); if (!/youtube\.com$/.test(u.hostname)) return r.abort(); const body = u.pathname === '/' ? home(tag) : u.pathname === '/watch' ? watch : u.pathname.startsWith('/shorts/') ? shorts : '<html></html>'; r.respond({ status: 200, contentType: 'text/html; charset=utf-8', body }); });
    if (dev === 'phone') await p.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true }); else await p.setViewport({ width: 1280, height: 800 });
    await p.goto(`https://${host}.youtube.com/`, { waitUntil: 'load' }); await sleep(1500);
    const vis = () => p.evaluate((tag) => [...document.querySelectorAll(tag + ', ytd-reel-item-renderer')].filter((e) => getComputedStyle(e).display !== 'none').map((e) => e.textContent.trim()), tag);
    const shown = await vis();
    ok(shown.length === 4 && shown.every((t) => !/الحلقة|اهداف|ازاي|مقلب|نكت/.test(t)), dev + ': home shows only English', shown);
    ok(await p.evaluate(() => getComputedStyle(document.getElementById('shelf')).display === 'none'), dev + ': all-Arabic Shorts shelf hidden');
    ok(/5 Arabic videos hidden/.test(await p.evaluate(() => (document.querySelector('.sawa-lens-ar-pill') || {}).textContent || '')), dev + ': pill shows the count', await p.evaluate(() => (document.querySelector('.sawa-lens-ar-pill') || {}).textContent));
    await p.screenshot({ path: OUT + '/arfilter-' + dev + '.png' });
    await p.evaluate(() => document.querySelector('.sawa-lens-ar-pill [data-a=peek]').click()); await sleep(600);
    ok((await vis()).length === 9, dev + ': Show brings them back (dimmed)');
    await p.goto(`https://${host}.youtube.com/watch?v=AAAAAAAAAAA`, { waitUntil: 'load' }); await sleep(1500);
    ok(JSON.stringify(await p.evaluate(() => [...document.querySelectorAll('ytd-compact-video-renderer')].filter((e) => getComputedStyle(e).display !== 'none').map((e) => e.textContent.trim()))) === '["TED: The power of habits"]', dev + ': Up next shows only English');
    await p.goto(`https://${host}.youtube.com/shorts/AAAAAAAAAAA`, { waitUntil: 'load' }); await sleep(2500);
    ok(await p.evaluate(() => window.__next === 1 && location.pathname === '/shorts/BBBBBBBBBBB'), dev + ': Arabic Short skipped once, English one stays', await p.evaluate(() => [window.__next, location.pathname]));
    console.log(dev + ' errors:', errs.length ? JSON.stringify(errs.slice(0, 3)) : 'none');
    await p.close();
  }
  await sw.evaluate(() => chrome.storage.local.set({ hideArabicYT: false }));
  const p = await br.newPage(); await p.setRequestInterception(true); p.on('request', (r) => r.respond({ status: 200, contentType: 'text/html; charset=utf-8', body: home('ytd-rich-item-renderer') }));
  await p.goto('https://www.youtube.com/', { waitUntil: 'load' }); await sleep(1200);
  ok(await p.evaluate(() => [...document.querySelectorAll('ytd-rich-item-renderer')].every((e) => getComputedStyle(e).display !== 'none')), 'switch off: nothing hidden');
  await br.close();
  console.log(fails ? fails + ' FAILED' : 'ALL PASS');
})().catch((e) => { console.error('FAILED', e.message); process.exit(1); });
