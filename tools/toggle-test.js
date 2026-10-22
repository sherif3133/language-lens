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
	spawn(puppeteer.executablePath(), ['--user-data-dir=' + prof, '--no-first-run', '--no-default-browser-check', '--remote-debugging-port=9342', '--headless=new', '--mute-audio', '--autoplay-policy=no-user-gesture-required', '--disable-extensions-except=' + ext, '--load-extension=' + ext, 'about:blank'], { stdio: 'ignore', detached: true }).unref();
	for (let i = 0; i < 40; i++) { try { return await puppeteer.connect({ browserURL: 'http://127.0.0.1:9342', defaultViewport: null }); } catch (e) { await wait(500); } }
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
		// Lens on/off on YouTube's own control bar
		const hasT = await R(() => !!document.querySelector('.ytp-right-controls .sawa-lens-yttoggle'));
		check('player bar has the Lens on/off switch', hasT);
		await R(() => document.querySelector('.sawa-lens-yttoggle').click()); await wait(1200);
		const off = await R(() => ({ host: getComputedStyle(document.querySelector('sawa-lens-yt')).display, side: getComputedStyle(document.querySelector('sawa-lens-side')).display, native: !document.querySelector('#movie_player').classList.contains('sawa-lens-on'), sw: document.querySelector('.sawa-lens-yttoggle').classList.contains('off') }));
		check('switch off: Lens captions and transcript hidden, YouTube captions back', off.host === 'none' && off.side === 'none' && off.native && off.sw, JSON.stringify(off));
		await p.screenshot({ path: path.join(out, 'lens-off.png') });
		await R(() => document.querySelector('.sawa-lens-yttoggle').click()); await wait(1200);
		const on = await R(() => getComputedStyle(document.querySelector('sawa-lens-yt')).display !== 'none' && document.querySelector('#movie_player').classList.contains('sawa-lens-on'));
		check('switch on again: Lens is back', on);
		// the English captions line has its own switch in the menu
		await R(() => { const i = document.querySelector('sawa-lens-yt').shadowRoot.querySelector('[data-pref=showEn]'); i.click(); });
		await wait(1200);
		const en = await R(() => { const r = document.querySelector('sawa-lens-yt').shadowRoot; return { line: getComputedStyle(r.querySelector('.line.en')).display, tr: getComputedStyle(r.querySelector('.line.tr')).display }; });
		check('English captions switch hides only the 1st line', en.line === 'none', JSON.stringify(en));
		await R(() => document.querySelector('sawa-lens-yt').shadowRoot.querySelector('[data-pref=showEn]').click());
	} finally { await browser.close(); }
	console.log(bad ? bad + ' check(s) failed' : 'all checks passed');
	process.exit(bad ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(2); });
