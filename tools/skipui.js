// Silent test: links, headlines, buttons and short labels get no colours or pop-ups; paragraphs still do.
const puppeteer = require('puppeteer'), path = require('path');
const EXT = path.resolve(__dirname, '../extension'), sleep = (ms) => new Promise(r => setTimeout(r, ms));
(async () => {
  const br = await puppeteer.launch({ headless: true, args: ['--mute-audio', '--disable-extensions-except=' + EXT, '--load-extension=' + EXT] });
  const p = await br.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.setViewport({ width: 1100, height: 800 });
  await p.goto('http://127.0.0.1:9410/?p=1', { waitUntil: 'networkidle2', timeout: 120000 });
  await p.evaluate(() => { document.body.innerHTML = '<article style="padding:30px;font-size:18px"><h2 id="h">Reddit Replacement Alternative</h2><p id="para">I highly recommend everyone to start using it with hovertranslate and to listen to podcasts or read articles there.</p><p><a id="lnk" href="#">https://substack.com/@existentialreflections</a></p><div class="c"><div id="nm">Fares Moutawea</div><div id="cm">Thanks for your effort, it was remarkable</div><div><button id="like">Like</button> <span id="rep">Reply</span> <span id="cnt">7 comments</span></div></div></article>'; });
  await sleep(14000);
  const marked = () => p.evaluate(() => { const out = new Set(); for (const k of ['lens-next', 'lens-hard', 'lens-learning']) { const h = CSS.highlights.get(k); if (h) for (const r of h) { const e = r.startContainer.parentElement; out.add((e.id || e.tagName) + ':' + r.toString()); } } return [...out].join(', '); });
  console.log('coloured:', await marked());
  const hover = async (id) => { const b = await p.$eval('#' + id, e => { const r = document.createRange(); r.setStart(e.firstChild, 2); r.setEnd(e.firstChild, 3); const q = r.getBoundingClientRect(); return { x: q.left, y: q.top + q.height / 2 }; }); await p.mouse.move(5, 790); await sleep(600); await p.mouse.move(b.x, b.y); await sleep(1300); return p.evaluate(() => { const c = document.querySelector('sawa-lens-card'); return !!(c && c.shadowRoot.querySelector('.card.on')); }); };
  for (const id of ['cm', 'para', 'cm', 'h']) console.log('pop-up on #' + id + ':', await hover(id));
  await p.evaluate(() => chrome.storage && 0);
  console.log('JS errors:', errs.length ? JSON.stringify(errs.slice(0, 3)) : 'none');
  await br.close();
})().catch(e => { console.error('FAILED', e.message); process.exit(1); });
