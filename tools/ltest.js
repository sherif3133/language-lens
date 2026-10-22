// Silent test of Read a text, Scan page inputs, phrase saving, read-all and the review-card video moment.
const puppeteer = require('puppeteer');
const B = 'http://127.0.0.1:9410', OUT = process.argv[2];
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
(async () => {
  const br = await puppeteer.launch({ headless: true, args: ['--mute-audio', '--autoplay-policy=no-user-gesture-required'] });
  const p = await br.newPage();
  const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { if (m.type() === 'error' && !/youtube|ytimg|doubleclick|googlevideo|Failed to load resource/i.test(m.text())) errs.push(m.text()); });
  await p.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
  await p.setCookie({ name: 'as_user', value: '3', url: B });
  await p.evaluateOnNewDocument(() => { window.__said = []; if (window.speechSynthesis) window.speechSynthesis.speak = (u) => { window.__said.push(u.text); setTimeout(() => u.onend && u.onend(), 50); }; });
  // Learn hub: no Watch, Read a text present
  await p.goto(B + '/app/?t=' + Date.now() + '#learn', { waitUntil: 'networkidle2', timeout: 120000 }); await sleep(2500);
  console.log('learn tiles:', await p.$$eval('.hub-t b', l => l.map(x => x.textContent).join(' | ')));
  // Read a text
  await p.goto(B + '/app/?t=' + Date.now() + '#read', { waitUntil: 'networkidle2', timeout: 120000 }); await p.waitForSelector('#rtext', { timeout: 60000 });
  await p.type('#rtext', 'Most students cannot afford a new laptop every year. They borrow one from a friend.\n\nReading every day helps you learn faster.');
  await p.click('#rgo'); await p.waitForSelector('.scan-text .sw', { timeout: 60000 }); await sleep(800);
  console.log('paragraphs:', await p.$$eval('.scan-text p', l => l.length), '| hint:', await p.$eval('.scan-text', e => e.previousElementSibling.textContent));
  // listen to the whole text (speech stubbed: nothing plays)
  await p.click('#readall'); await sleep(800);
  console.log('read aloud queue (stubbed):', (await p.evaluate(() => window.__said)).length, 'paragraphs');
  // select a phrase with the mouse → editor
  await p.evaluate(() => { const para = document.querySelector('.scan-text p'); const r = document.createRange(); const tn = [...para.querySelectorAll('.sw')]; r.setStartBefore(tn[2]); r.setEndAfter(tn[4]); const s = getSelection(); s.removeAllRanges(); s.addRange(r); document.querySelector('.scan-text').dispatchEvent(new MouseEvent('mouseup', { bubbles: true })); });
  await p.waitForSelector('#sv-t', { timeout: 10000 });
  console.log('editor prefilled:', await p.$eval('#sv-t', e => e.value), '|', await p.$eval('#sv-ctx', e => e.textContent.slice(0, 80)));
  await p.$eval('#sv-t', e => { e.value = 'cannot afford'; }); await p.click('.savebox [data-k="phrase"]'); await sleep(2500);
  console.log('saved:', await p.$eval('.savebox', e => e.innerText.replace(/\s+/g, ' ')));
  await p.screenshot({ path: OUT + '/l1-read.png' });
  // tap a word → word card → Save sentence opens the editor
  await p.evaluate(() => [...document.querySelectorAll('.sw')].find(x => x.textContent === 'borrow').click()); await p.waitForSelector('#savesent', { timeout: 20000 });
  await p.click('#savesent'); await p.waitForSelector('#sv-t', { timeout: 5000 });
  console.log('sentence editor:', await p.$eval('#sv-t', e => e.value));
  // library has the phrase with its sentence
  const lib = await p.evaluate(async () => (await window.SawaLens.api('library')).sentences.filter(s => s.focus === 'cannot afford').map(s => s.kind + ': ' + s.focus + ' ← ' + s.text));
  console.log('library:', lib.join(' / '));
  // Scan page: three ways in
  await p.goto(B + '/app/?t=' + Date.now() + '#scan', { waitUntil: 'networkidle2', timeout: 120000 }); await p.waitForSelector('#drop', { timeout: 60000 });
  console.log('scan inputs:', await p.$eval('#drop', e => e.innerText.replace(/\s+/g, ' ')), '| camera input has capture:', await p.$eval('#cam', e => e.hasAttribute('capture')), '| upload input has capture:', await p.$eval('#pick', e => e.hasAttribute('capture')));
  await p.screenshot({ path: OUT + '/l2-scan.png' });
  // Review: the video moment plays by itself on the card front
  await p.goto(B + '/app/?t=' + Date.now() + '#review', { waitUntil: 'networkidle2', timeout: 120000 }); await sleep(4000);
  const card = await p.evaluate(() => { const m = document.querySelector('.rv-card .moment'); return m ? { st: m.dataset.st, en: m.dataset.en, player: !!m.querySelector('iframe'), auto: m.querySelector('[data-clip="auto"]').checked, word: (document.querySelector('.rv-word') || {}).textContent } : null; });
  console.log('review clip:', JSON.stringify(card));
  await p.screenshot({ path: OUT + '/l3-review.png' });
  console.log('JS errors:', errs.length ? JSON.stringify(errs.slice(0, 6)) : 'none');
  await br.close();
})().catch(e => { console.error('FAILED', e.message); process.exit(1); });
