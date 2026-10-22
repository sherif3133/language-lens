// Silent check of the word highlights (soft colours instead of underlines).
const puppeteer = require('puppeteer'), path = require('path');
const EXT = path.resolve(__dirname, '../extension'), sleep = (ms) => new Promise(r => setTimeout(r, ms));
(async () => {
  const br = await puppeteer.launch({ headless: true, args: ['--mute-audio', '--disable-extensions-except=' + EXT, '--load-extension=' + EXT] });
  const sw = await (await br.waitForTarget((t) => t.type() === 'service_worker', { timeout: 15000 })).worker();
  await sw.evaluate(() => chrome.storage.local.set({ level: 2, words: { recommend: 'learning' } }));
  const p = await br.newPage(); await p.setViewport({ width: 1000, height: 420 });
  await p.goto('http://127.0.0.1:9410/?p=1', { waitUntil: 'networkidle2', timeout: 120000 });
  await p.evaluate(() => { [...document.body.children].forEach((c) => { if (!/^SAWA-LENS/.test(c.tagName)) c.style.display = 'none'; }); document.body.insertAdjacentHTML('afterbegin', '<article style="padding:30px 40px;font:19px/1.8 Georgia,serif"><p>I have always been hearing about Substack and I have recently started to use it. I highly recommend everyone to start using it and to listen to podcasts or read articles there. Here is a writer you can start with if you are into psychology and existential reflections.</p><p style="padding:14px 20px;font:19px/1.8 Arial;background:#1f1f1f;color:#eee">Scientists say that walking every morning can improve your memory and make you feel less anxious, according to a remarkable new study.</p></article>'); });
  await sleep(16000);
  console.log(await p.evaluate(() => ['lens-next', 'lens-hard', 'lens-learning'].map((k) => k + ':' + (CSS.highlights.get(k) ? [...CSS.highlights.get(k)].map(String).join(',') : '-')).join(' | ')));
  await p.screenshot({ path: process.argv[2] + '/hl.png' });
  await br.close();
})().catch(e => { console.error('FAILED', e.message); process.exit(1); });
