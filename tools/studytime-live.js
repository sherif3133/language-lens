/* Active study time check (muted, headless). Usage: node studytime-live.js */
'use strict';
const path = require('path');
const puppeteer = require('puppeteer');
const ext = process.env.LENS_EXT || path.join(__dirname, '../extension');
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
async function launch() {
	const { spawn } = require('child_process');
	const prof = path.join(require('os').tmpdir(), 'lens-mprof-' + Date.now());
	spawn(puppeteer.executablePath(), ['--user-data-dir=' + prof, '--no-first-run', '--no-default-browser-check', '--remote-debugging-port=9334', '--headless=new', '--disable-extensions-except=' + ext, '--load-extension=' + ext, '--window-size=1400,1000', '--autoplay-policy=no-user-gesture-required', '--mute-audio', '--lang=en-US', 'about:blank'], { detached: true, stdio: 'ignore' }).unref();
	for (let i = 0; i < 40; i++) {
		try {
			return await puppeteer.connect({ browserURL: 'http://127.0.0.1:9334', defaultViewport: null });
		} catch (e) {
			await wait(500);
		}
	}
	throw new Error('chrome did not start');
}
(async () => {
	const browser = await launch();
	const desk = await browser.newPage();
	try {
		await desk.setViewport({ width: 1400, height: 900 });
		const ua = (await browser.userAgent()).replace('HeadlessChrome', 'Chrome'), major = (ua.match(/Chrome\/(\d+)/) || [])[1] || '140';
		await desk.setUserAgent({ userAgent: ua, userAgentMetadata: { brands: [{ brand: 'Google Chrome', version: major }, { brand: 'Chromium', version: major }, { brand: 'Not.A/Brand', version: '99' }], platform: 'Windows', platformVersion: '10.0.0', architecture: 'x86', model: '', mobile: false } });
		const sw = await browser.waitForTarget((t) => t.type() === 'service_worker' && /chrome-extension/.test(t.url()), { timeout: 20000 });
		const worker = await sw.worker();
		const store = () => worker.evaluate(() => new Promise((r) => chrome.storage.local.get('studyDay', (o) => r(o.studyDay || null))));
		await desk.goto('https://www.youtube.com/watch?v=' + (process.argv[2] || 'arj7oStGLkU'), { waitUntil: 'domcontentloaded' });
		for (let i = 0; i < 60; i++) { await wait(1000); const ok = await desk.evaluate(() => { const v = document.querySelector('#movie_player video'); if (v) { v.muted = true; v.volume = 0; if (v.paused) v.play().catch(() => {}); } return !!(v && !v.paused && !document.querySelector('#movie_player.ad-showing') && v.currentTime > 2); }); if (ok) break; }
		const t0 = Date.now(); const a = await store(); console.log('start', JSON.stringify(a && a.youtube));
		await wait(50000);
		const b = await store(); console.log('after ~50 s of playing:', JSON.stringify(b && b.youtube), 'elapsed', Math.round((Date.now() - t0) / 1000));
		await desk.evaluate(() => document.querySelector('#movie_player video').pause());
		await wait(5000); const c = await store();
		await wait(75000); const d = await store();
		console.log('paused: +5 s', c && c.youtube.sec, ' +80 s', d && d.youtube.sec, '(idle stops after 60 s: increase should be <= ~60)');
	} finally {
		await browser.close();
	}
	process.exit(0);
})().catch((e) => { console.error(e); process.exit(2); });
