// Silent test of graded reading in the app: upload a PDF, adapt it to the learner's level, check the result.
const puppeteer = require('puppeteer'), sleep = (ms) => new Promise(r => setTimeout(r, ms));
(async () => {
  const out = process.argv[2];
  const br = await puppeteer.launch({ headless: true, args: ['--mute-audio'] });
  // 1. a real two-page PDF
  const mk = await br.newPage();
  await mk.setContent('<body style="font:14px Georgia;padding:40px"><h1>The Ocean Report</h1><p>Scientists recorded unprecedented temperatures in the Atlantic this summer. Consequently, coral reefs suffered substantial damage across the region.</p><p>Fishermen in small villages noticed that fish moved to deeper, colder water, and their daily catch fell sharply.</p><div style="page-break-before:always"></div><p>Researchers believe the trend will continue unless global emissions drop considerably over the next decade.</p></body>');
  await mk.pdf({ path: out + '/ocean.pdf', format: 'A5' }); await mk.close();
  const p = await br.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.evaluateOnNewDocument(() => { try { window.speechSynthesis.speak = () => {}; } catch (e) {} });
  await p.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
  await p.goto('http://127.0.0.1:9410/app/?as=1#read', { waitUntil: 'networkidle2', timeout: 120000 });
  await sleep(3000);
  const inp = await p.$('#rpdf'); await inp.uploadFile(out + '/ocean.pdf');
  await p.waitForFunction(() => document.querySelector('#rtext').value.length > 50, { timeout: 30000 }).catch(() => {});
  console.log('PDF text:', JSON.stringify(await p.$eval('#rtext', e => e.value.slice(0, 260))), '| info:', await p.$eval('#rinfo', e => e.textContent), '| title:', await p.$eval('#rtitle', e => e.value));
  await p.click('#radapt');
  await p.waitForSelector('.adapted', { timeout: 60000 }).catch(() => {});
  console.log('banner:', await p.evaluate(() => (document.querySelector('.adapted') || {}).innerText || 'none').then(t => t.replace(/\s+/g, ' ')));
  console.log('underlined new words:', await p.evaluate(() => [...document.querySelectorAll('.sw.tg')].map(x => x.textContent).join(',')));
  console.log('first paragraph:', await p.evaluate(() => (document.querySelector('.scan-text p') || {}).textContent));
  await p.evaluate(() => { const a = document.querySelector('.adapted'); if (a) a.scrollIntoView(); });
  await p.screenshot({ path: out + '/adapt.png' });
  console.log('errors:', errs.length ? JSON.stringify(errs.slice(0, 3)) : 'none');
  await br.close();
})().catch(e => { console.error('FAILED', e.message); process.exit(1); });
