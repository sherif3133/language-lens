const puppeteer = require('puppeteer');
const B = 'http://127.0.0.1:9410', OUT = process.argv[2];
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
(async () => {
  const br = await puppeteer.launch({ headless: true, args: ['--autoplay-policy=no-user-gesture-required', '--mute-audio'] });
  const p = await br.newPage();
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.setViewport({ width: 390, height: 844, isMobile: true });
  await p.setCookie({ name: 'as_user', value: '2', url: B });
  await p.goto(B + '/lens/#watch', { waitUntil: 'networkidle2' });
  await p.waitForSelector('.vid', { timeout: 60000 });
  console.log('list:', await p.$$eval('.vid', l => l.map(x => x.innerText.replace(/\s+/g, ' ')).join(' | ')));
  await p.screenshot({ path: OUT + '/watch-list.png' });
  await p.click('.vid');
  await p.waitForSelector('.qm', { timeout: 60000 });
  await sleep(6000);
  await p.click('.qm');  // seek to just before question 1 and play
  const t0 = Date.now();
  await p.waitForSelector('.qcard', { timeout: 60000 }).catch(() => {});
  console.log('question shown after', Math.round((Date.now() - t0) / 1000), 's:', await p.evaluate(() => { const q = document.querySelector('.qcard'); return q ? q.innerText.replace(/\s+/g, ' ').slice(0, 120) : 'none'; }));
  if (await p.$('.qcard .opt')) {
    await p.click('.qcard .opt[data-k="1"]');
    await p.waitForSelector('#qgo', { timeout: 30000 });
    console.log('feedback:', await p.$eval('#qfb', e => e.innerText.replace(/\s+/g, ' ').slice(0, 140)));
    await p.screenshot({ path: OUT + '/watch-q.png' });
    console.log('marks:', await p.$$eval('.qm', l => l.map(x => x.className).join(',')));
  }
  console.log('JS errors:', errs.length ? errs : 'none');
  await br.close();
})().catch(e => { console.error('FAILED', e.message); process.exit(1); });
