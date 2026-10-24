/* Live check: do captions show on 3 different videos, also when going from one to the next without a reload?
   Muted, headless. Usage: node captions-live.js */
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
	desk.on('pageerror', (e) => console.log('PAGEERROR', String(e.message).slice(0, 200)));
	desk.on('console', (m) => { if (m.type() === 'error' && /extension|lens/i.test(m.text() + (m.location().url || ''))) console.log('CONSOLE', m.text().slice(0, 200), (m.location().url || '').slice(-30), m.location().lineNumber); });
	try {
		await desk.setViewport({ width: 1400, height: 900 });
		const ua = (await browser.userAgent()).replace('HeadlessChrome', 'Chrome'), major = (ua.match(/Chrome\/(\d+)/) || [])[1] || '140';
		await desk.setUserAgent({ userAgent: ua, userAgentMetadata: { brands: [{ brand: 'Google Chrome', version: major }, { brand: 'Chromium', version: major }, { brand: 'Not.A/Brand', version: '99' }], platform: 'Windows', platformVersion: '10.0.0', architecture: 'x86', model: '', mobile: false } });
		const vids = (process.argv.slice(2).length ? process.argv.slice(2) : ['arj7oStGLkU', 'SfqmdA2xelM', '8jPQjjsBbIc']);
		for (let k = 0; k < vids.length; k++) {
			const v = vids[k];
			if (k === 0) vids.__cur = v, await desk.goto('https://www.youtube.com/watch?v=' + v, { waitUntil: 'domcontentloaded' });
			else { const clicked = await desk.evaluate(() => { const cur = new URLSearchParams(location.search).get('v'); const l = [...document.querySelectorAll('a[href*="/watch?v="]')].find((x) => { const m = x.href.match(/[?&]v=([^&]+)/); return m && m[1] !== cur && x.offsetParent !== null; }); if (l) { l.click(); return l.href.slice(-24); } return null; }); console.log('clicked', clicked); }
			if (k > 0) { const prev = vids.__cur; for (let w = 0; w < 25; w++) { await wait(1000); const nowV = await desk.evaluate(() => new URLSearchParams(location.search).get('v')); if (nowV && nowV !== prev) break; } await wait(3000); }
			let line = null, t0 = Date.now();
			for (let i = 0; i < 60 && !line; i++) {
				await wait(1000);
				await desk.evaluate(() => { const m = document.querySelector('#movie_player video'); if (m) { m.muted = true; m.volume = 0; if (m.paused) m.play().catch(() => {}); } }).catch(() => {});
				line = await desk.evaluate(() => { const h = document.querySelector('sawa-lens-yt'); const l = h && h.shadowRoot.querySelector('.line.en'); return l && l.querySelector('.wd') ? l.textContent : null; }).catch(() => null);
			}
			const info = await desk.evaluate(() => { const h = document.querySelector('sawa-lens-yt'), sd = document.querySelector('sawa-lens-side'); const v = document.querySelector('#movie_player video'); return { host: !!h, hostParentOk: !!(h && h.parentNode && h.parentNode.id === 'movie_player'), side: sd ? sd.shadowRoot.querySelectorAll('.s').length : 'no side', en: h ? h.shadowRoot.querySelector('.line.en').innerHTML.slice(0, 60) : null, t: v && v.currentTime, paused: v && v.paused, ad: !!document.querySelector('#movie_player.ad-showing'), hostCls: h && h.className, log: (window.__sawaLensLog || []).slice(-4) }; });
			const cur = await desk.evaluate(() => new URLSearchParams(location.search).get('v')); vids.__cur = cur; console.log(line ? 'OK ' : 'NO CAPTIONS', v + ' -> now ' + cur, line ? Math.round((Date.now() - t0) / 1000) + 's: ' + line.slice(0, 50) : JSON.stringify(info));
		}
	} finally {
		await browser.close();
	}
	process.exit(0);
})().catch((e) => { console.error(e); process.exit(2); });
