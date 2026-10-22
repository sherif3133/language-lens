// Silent screenshots of the app's Home page (progress charts) as test user ?as=UID, desktop and phone.
const puppeteer = require('puppeteer'), sleep = (ms) => new Promise(r => setTimeout(r, ms));
(async () => {
  const [uid, out] = process.argv.slice(2);
  const br = await puppeteer.launch({ headless: true, args: ['--mute-audio'] });
  for (const [name, vp] of [['desk', { width: 1200, height: 900 }], ['phone', { width: 390, height: 844, isMobile: true, hasTouch: true, deviceScaleFactor: 2 }]]) {
    const p = await br.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
    await p.evaluateOnNewDocument(() => { try { window.speechSynthesis.speak = () => {}; } catch (e) {} });
    await p.setViewport(vp);
    await p.goto('http://127.0.0.1:9410/app/?as=' + uid + '#today', { waitUntil: 'networkidle2', timeout: 120000 });
    await sleep(5000);
    const y = await p.evaluate(() => { const e = document.querySelector('#prog'); return e ? e.getBoundingClientRect().top + scrollY : -1; });
    console.log(name, 'prog at', y, 'nav:', await p.evaluate(() => [...document.querySelectorAll('#nav [data-nav]')].map(b => b.textContent.trim()).join(',')), 'charts:', await p.evaluate(() => document.querySelectorAll('#prog svg.ch').length));
    if (y > 0) { await p.evaluate((y) => scrollTo(0, y - 10), y); await sleep(500); }
    // hover/tap a heatmap square for the tooltip
    const r = await p.evaluate(() => { const c = [...document.querySelectorAll('.ch.heat rect')].filter(x => x.getAttribute('fill') !== '#EEF0F2').pop(); if (!c) return null; const b = c.getBoundingClientRect(); return { x: b.left + 5, y: b.top + 5 }; });
    if (r) { if (vp.hasTouch) await p.touchscreen.tap(r.x, r.y); else await p.mouse.move(r.x, r.y); await sleep(400); }
    console.log(name, 'tooltip:', await p.evaluate(() => { const t = document.getElementById('ch-tip'); return t && !t.hidden ? t.innerText.replace(/\s+/g, ' ') : 'none'; }));
    await p.screenshot({ path: out + '/home-' + name + '.png', fullPage: true });
    const el = await p.$('#prog'); if (el) await el.screenshot({ path: out + '/prog-' + name + '.png' });
    console.log(name, 'errors:', errs.length ? JSON.stringify(errs.slice(0, 3)) : 'none');
    await p.close();
  }
  await br.close();
})().catch(e => { console.error('FAILED', e.message); process.exit(1); });
