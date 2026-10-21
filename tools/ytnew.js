// Silent check of the new YouTube parts: third caption line, the Aa button on YouTube's bar, the words-in-this-video panel.
const puppeteer = require('puppeteer'), path = require('path');
const EXT = path.resolve(__dirname, '../extension'), OUT = process.argv[2], wait = (ms) => new Promise(r => setTimeout(r, ms));
(async () => {
  const br = await puppeteer.launch({ headless: true, args: ['--mute-audio', '--disable-extensions-except=' + EXT, '--load-extension=' + EXT, '--autoplay-policy=no-user-gesture-required', '--lang=en-US'], defaultViewport: { width: 1400, height: 900 } });
  const p = await br.newPage(); const errs = []; p.on('pageerror', e => errs.push(String(e).slice(0, 150)));
  const cdp = await p.target().createCDPSession(); await cdp.send('Network.enable');
  await cdp.send('Network.setBlockedURLs', { urls: ['*doubleclick.net*', '*googleads*', '*/pagead/*', '*googlesyndication*', '*/api/stats/ads*', '*/get_midroll_*', '*youtube.com/ad_*'] });
  await p.goto('https://www.youtube.com/watch?v=iG9CE55wbtY', { waitUntil: 'domcontentloaded' });
  try { const b = await p.$('button[aria-label*="Reject"]'); if (b) await b.click(); } catch (e) {}
  await p.waitForSelector('#movie_player video', { timeout: 30000 });
  await p.evaluate(() => { const v = document.querySelector('#movie_player video'); v.muted = true; v.play(); });
  let st = {};
  for (let i = 0; i < 70; i++) {
    await wait(1000);
    await p.evaluate(() => { const b = document.querySelector('.ytp-skip-ad-button, .ytp-ad-skip-button-modern'); if (b) b.click(); });
    st = await p.evaluate(() => { const h = document.querySelector('sawa-lens-yt'), r = h && h.shadowRoot, s = document.querySelector('sawa-lens-side'); return { en: r && r.querySelector('.line.en') ? r.querySelector('.line.en').textContent : '', snd: r && r.querySelector('.line.snd') ? r.querySelector('.line.snd').textContent : '', btn: !!document.querySelector('.ytp-right-controls .sawa-lens-ytbtn'), oldTools: !!(r && r.querySelector('.tools')), prof: s && s.shadowRoot.querySelector('.vprof') ? s.shadowRoot.querySelector('.vprof').innerText.replace(/\s+/g, ' ').slice(0, 400) : '' }; });
    if (st.en && st.snd && st.prof) break;
  }
  console.log(JSON.stringify(st, null, 1));
  if (st.btn) { await p.evaluate(() => document.querySelector('.sawa-lens-ytbtn').click()); await wait(500); console.log('menu open:', await p.evaluate(() => document.querySelector('sawa-lens-yt').shadowRoot.querySelector('.lensmenu').classList.contains('on'))); }
  await p.evaluate(() => { const v = document.querySelector('#movie_player video'); v.pause(); });
  await p.screenshot({ path: OUT + '/yt-new.png' });
  console.log('JS errors:', errs.length ? JSON.stringify(errs.slice(0, 3)) : 'none');
  await br.close();
})().catch(e => { console.error('FAILED', e.message); process.exit(1); });
