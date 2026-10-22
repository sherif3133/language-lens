/* Silent check of the YouTube transcript: Follow keeps the line being said in view, ☆ saves a sentence, 🔁 Loop
   repeats one sentence with a pause for the student to say it. Real YouTube (computer site), muted, headless.
   Usage: node loop-test.js <outDir> [videoId] */
'use strict';
const path = require('path'), fs = require('fs'), puppeteer = require('puppeteer');
const out = process.argv[2] || '.', vid = process.argv[3] || 'arj7oStGLkU', ext = path.join(__dirname, '../extension');
fs.mkdirSync(out, { recursive: true });
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
let bad = 0; const check = (n, ok, info) => { if (!ok) bad++; console.log(ok ? '✓' : '✗', n, info == null ? '' : info); };
async function launch() {
	const { spawn } = require('child_process');
	const prof = path.join(require('os').tmpdir(), 'lens-lprof-' + Date.now());
	spawn(puppeteer.executablePath(), ['--user-data-dir=' + prof, '--no-first-run', '--no-default-browser-check', '--remote-debugging-port=9337', '--headless=new', '--mute-audio', '--autoplay-policy=no-user-gesture-required', '--disable-extensions-except=' + ext, '--load-extension=' + ext, 'about:blank'], { stdio: 'ignore', detached: true }).unref();
	for (let i = 0; i < 40; i++) { try { return await puppeteer.connect({ browserURL: 'http://127.0.0.1:9337', defaultViewport: null }); } catch (e) { await wait(500); } }
	throw new Error('chrome did not start');
}
(async () => {
	const browser = await launch();
	try {
		const p = await browser.newPage();
		await p.setViewport({ width: 1400, height: 900 });
		const ua = (await browser.userAgent()).replace('HeadlessChrome', 'Chrome');
		await p.setUserAgent(ua);
		await p.goto('https://www.youtube.com/watch?v=' + vid, { waitUntil: 'domcontentloaded' });
		const R = (fn, ...a) => p.evaluate(fn, ...a);
		let rows = 0;
		for (let i = 0; i < 40 && rows < 5; i++) { await wait(1000); rows = await R(() => { const h = document.querySelector('sawa-lens-side'); return h ? h.shadowRoot.querySelectorAll('.s').length : 0; }); }
		check('transcript rows', rows > 5, rows);
		await R(() => { const v = document.querySelector('#movie_player video'); v.muted = true; v.currentTime = 240; v.play(); });
		await wait(7000);
		const fol = await R(() => { const r = document.querySelector('sawa-lens-side').shadowRoot, l = r.querySelector('.list'), n = r.querySelector('.s.now'); if (!n) return null; const a = l.getBoundingClientRect(), b = n.getBoundingClientRect(); return { inView: b.top >= a.top - 2 && b.bottom <= a.bottom + 2, rowTop: Math.round(b.top - a.top), listH: Math.round(a.height) }; });
		check('Follow: the line being said is in view', fol && fol.inView, JSON.stringify(fol));
		await p.screenshot({ path: path.join(out, 'follow.png') });
		// ☆ Save on the current line
		const st = await R(() => { const r = document.querySelector('sawa-lens-side').shadowRoot, b = r.querySelector('.s.now [data-a=star]'); b.click(); return b.closest('.s').dataset.i; });
		await wait(1500);
		const st2 = await R((i) => { const b = document.querySelector('sawa-lens-side').shadowRoot.querySelector('.s[data-i="' + i + '"] [data-a=star]'); return b && b.textContent + '|' + b.title; }, st);
		check('☆ Save turns into ★ Saved', /★/.test(st2 || ''), st2);
		// 🔁 Loop on a line: it plays, pauses for the student's turn, and plays again
		const li = await R(() => { const r = document.querySelector('sawa-lens-side').shadowRoot; const s = r.querySelectorAll('.s')[12]; s.querySelector('[data-a=once]').click(); return { i: +s.dataset.i, title: s.querySelector('[data-a=once]').title }; });
		check('Loop button says "Loop"', li.title === 'Loop', li.title);
		const seen = [];
		for (let k = 0; k < 90; k++) { await wait(500); seen.push(await R(() => { const v = document.querySelector('#movie_player video'); return [Math.round(v.currentTime * 10) / 10, v.paused]; })); }
		const starts = seen.filter((x, k) => k && !x[1] && seen[k - 1][1]).length, pauses = seen.filter((x, k) => k && x[1] && !seen[k - 1][1]).length;
		check('Loop: the sentence plays again after a pause (twice or more)', starts >= 2 && pauses >= 2, JSON.stringify({ starts, pauses, restartsAt: seen.filter((x, k) => k && !x[1] && seen[k - 1][1]).map((x) => x[0]) }));
		check('Loop: looping line is marked', await R((i) => !!document.querySelector('sawa-lens-side').shadowRoot.querySelector('.s.looping[data-i="' + i + '"] .loopnote'), li.i));
		await p.screenshot({ path: path.join(out, 'loop.png') });
		await R(() => document.querySelector('sawa-lens-side').shadowRoot.querySelector('.s.looping [data-a=once]').click());
		await wait(15000); // the sentence playing now finishes, then the video stays paused (no replay)
		const after = await R(() => document.querySelector('#movie_player video').paused);
		check('Tap 🔁 again: the loop stops', after && !(await R(() => !!document.querySelector('sawa-lens-side').shadowRoot.querySelector('.s.looping'))));
	} finally { await browser.close(); }
	console.log(bad ? bad + ' check(s) failed' : 'all checks passed');
	process.exit(bad ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(2); });
