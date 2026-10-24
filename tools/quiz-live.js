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
	try {
		await desk.setViewport({ width: 1400, height: 900 });
		const ua = (await browser.userAgent()).replace('HeadlessChrome', 'Chrome'), major = (ua.match(/Chrome\/(\d+)/) || [])[1] || '140';
		await desk.setUserAgent({ userAgent: ua, userAgentMetadata: { brands: [{ brand: 'Google Chrome', version: major }, { brand: 'Chromium', version: major }, { brand: 'Not.A/Brand', version: '99' }], platform: 'Windows', platformVersion: '10.0.0', architecture: 'x86', model: '', mobile: false } });
		const sq = (fn, arg) => desk.evaluate((fn, arg) => { const r = document.querySelector('sawa-lens-yt').shadowRoot; return new Function('r', 'a', fn)(r, arg); }, fn, arg).catch(() => null);
		const waitFor = async (fn, label, secs) => { for (let i = 0; i < (secs || 90); i++) { await wait(1000); await desk.evaluate(() => { const m = document.querySelector('#movie_player video'); if (m) { m.muted = true; m.volume = 0; } }).catch(() => {}); const v = await sq(fn); if (v) return v; } console.log('TIMEOUT', label); return null; };
		await desk.goto('https://www.youtube.com/watch?v=' + (process.argv[2] || 'arj7oStGLkU'), { waitUntil: 'domcontentloaded' });
		const b = await waitFor('const b = r.querySelector(".sqb"); return b && !b.hidden ? b.textContent : null', 'banner');
		console.log('banner:', b);
		await sq('r.querySelector(".sqb [data-q=start]").click(); return 1');
		const p = await waitFor('const o = r.querySelectorAll(".sq [data-q=n]"); return o.length ? [...o].map(x => x.textContent).join(" | ") : null', 'picker', 15);
		console.log('picker:', p);
		await sq('r.querySelectorAll(".sq [data-q=n]")[0].click(); return 1');
		const rows = await waitFor('const x = r.querySelectorAll(".sqrow"); return x.length ? [...x].map(y => y.querySelector(".w b").textContent).join(",") : null', 'list', 15);
		console.log('list:', rows); console.log('overlay:', await sq('return r.querySelector(".sq").innerHTML.slice(0,300)'));
		await sq('r.querySelector(".sqrow input").click(); return 1');
		await wait(1500);
		const after = await sq('const x = r.querySelectorAll(".sqrow"); return [x.length, [...x].filter(y => y.classList.contains("done")).length, [...x].map(y => y.querySelector(".w b").textContent).join(",")]');
		console.log('after tick (rows, crossed, words):', JSON.stringify(after));
		await sq('r.querySelector(".sq [data-q=watch]").click(); return 1');
		await wait(4000);
		const pl = await desk.evaluate(() => { const v = document.querySelector('#movie_player video'); return { t: Math.round(v.currentTime), paused: v.paused, overlay: !document.querySelector('sawa-lens-yt').shadowRoot.querySelector('.sq').hidden }; });
		console.log('watching:', JSON.stringify(pl));
		await desk.evaluate(() => { const v = document.querySelector('#movie_player video'); v.currentTime = Math.max(0, v.duration - 3); });
		const q1 = await waitFor('const x = r.querySelector(".sqq,.sqc h3"); return x ? x.textContent.slice(0, 80) : null', 'review', 40);
		console.log('review question:', q1); console.log('video:', JSON.stringify(await desk.evaluate(() => { const v = document.querySelector('#movie_player video'); return { t: v.currentTime, d: v.duration, ended: v.ended, paused: v.paused, ad: !!document.querySelector('#movie_player.ad-showing'), url: location.search }; })));
		await sq('const o = r.querySelectorAll(".sq [data-q=ans]"); if (o[0]) o[0].click(); return 1');
		await wait(800);
		const fb = await sq('const x = r.querySelector(".sqfb"); return x ? x.textContent.slice(0, 60) : null');
		console.log('feedback:', fb);
		await sq('const n = r.querySelector(".sq [data-q=later]"); if (n) n.click(); return 1');
		await wait(500);
		console.log('closed:', await sq('return r.querySelector(".sq").hidden'));
	} finally {
		await browser.close();
	}
	process.exit(0);
})().catch((e) => { console.error(e); process.exit(2); });
