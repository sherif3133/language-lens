/* Screenshots for the /lens/ install-and-use guide on the Sawa English site (real extension, real YouTube).
   Usage: node guideshots.js <outDir> [videoId]   (YouTube sends empty captions to automated browsers, so Chrome is started by hand and attached) */
'use strict';
const fs = require('fs'), path = require('path'), puppeteer = require('puppeteer');
const out = process.argv[2] || path.join(require('os').tmpdir(), 'lens-guide'), vid = process.argv[3] || 'arj7oStGLkU';
const ext = path.join(__dirname, '../extension');
fs.mkdirSync(out, { recursive: true });
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
async function launch(port, extra) {
	const { spawn } = require('child_process');
	const prof = path.join(require('os').tmpdir(), 'lens-gprof-' + Date.now());
	spawn(puppeteer.executablePath(), ['--user-data-dir=' + prof, '--no-first-run', '--no-default-browser-check', '--remote-debugging-port=' + port, '--headless=new', '--window-size=1280,800', '--autoplay-policy=no-user-gesture-required', '--mute-audio', '--lang=en-US'].concat(extra || [], ['about:blank']), { detached: true, stdio: 'ignore' }).unref();
	for (let i = 0; i < 40; i++) { try { return await puppeteer.connect({ browserURL: 'http://127.0.0.1:' + port, defaultViewport: null }); } catch (e) { await wait(500); } }
	throw new Error('chrome did not start');
}
const shadow = (page, host, fn, ...a) => page.evaluate((host, fn, a) => { const h = document.querySelector(host); return h && h.shadowRoot ? new Function('root', 'a', fn)(h.shadowRoot, a) : null; }, host, fn, a);
async function ytReady(page) {
	if (process.env.MOB) await page.emulate(puppeteer.KnownDevices['Pixel 5']);
	await page.goto('https://' + (process.env.MOB ? 'm' : 'www') + '.youtube.com/watch?v=' + vid, { waitUntil: 'domcontentloaded' });
	await wait(4000);
	for (let i = 0; i < 40; i++) {
		await wait(1000);
		const ok = await page.evaluate(() => {
			const v = document.querySelector('#movie_player video'), ad = document.querySelector('#movie_player.ad-showing');
			if (ad) { const s = document.querySelector('.ytp-ad-skip-button, .ytp-skip-ad-button, .ytp-ad-skip-button-modern'); if (s) s.click(); return false; }
						
			const h = document.querySelector('sawa-lens-yt'), l = h && h.shadowRoot.querySelector('.line.en');
			return !!(l && l.querySelector('.wd'));
		});
		if (i % 10 === 9) console.log(i, JSON.stringify(await page.evaluate(() => ({ err: !!document.querySelector('.ytp-error'), t: (document.querySelector('video') || {}).currentTime, ad: !!document.querySelector('.ad-showing'), log: (window.__sawaLensLog || []).slice(-3), html: (document.querySelector('sawa-lens-yt') || {shadowRoot:{innerHTML:''}}).shadowRoot.innerHTML.slice(-400), cc: !!document.querySelector('.ytp-subtitles-button[aria-pressed=true]') }))));
		if (ok) return true;
	}
	return false;
}

/** A red ring (and optional note) drawn on the page, like the guide's callouts. */
const ring = (page, x, y, w, h) => page.evaluate((x, y, w, h) => { const d = document.createElement('div'); d.style.cssText = 'position:fixed;z-index:2147483647;pointer-events:none;border:4px solid #E3262B;border-radius:14px;box-shadow:0 0 0 4px rgba(227,38,43,.25);left:' + (x - 6) + 'px;top:' + (y - 6) + 'px;width:' + (w + 12) + 'px;height:' + (h + 12) + 'px'; document.body.appendChild(d); }, x, y, w, h);
const shot = (page, name, opts) => page.screenshot(Object.assign({ path: path.join(out, name + '.webp'), type: 'webp', quality: 80 }, opts || {}));
const PIXEL = { viewport: { width: 393, height: 740, deviceScaleFactor: 2, isMobile: true, hasTouch: true }, userAgent: puppeteer.KnownDevices['Pixel 5'].userAgent };

async function phone() {
	const browser = await launch(9335, ['--disable-extensions-except=' + ext, '--load-extension=' + ext]);
	const page = await browser.newPage();
	await page.bringToFront();
	await page.emulate(PIXEL);
	console.log('captions:', await ytReady(page));
	await page.addStyleTag({ content: '#movie_player video{filter:blur(18px) brightness(.5)!important}' });
	await page.evaluate(() => document.querySelector('video').pause());
	await shadow(page, 'sawa-lens-side', "const st=document.createElement('style');st.textContent='.adv,.gl{display:none!important}';root.appendChild(st)");
	await wait(600);
	await shot(page, 'yt-captions');
	const w = await shadow(page, 'sawa-lens-yt', "const el=root.querySelectorAll('.line.en .wd')[2];const r=el.getBoundingClientRect();return {x:r.left+r.width/2,y:r.top+r.height/2}");
	await page.touchscreen.tap(w.x, w.y);
	await wait(1800);
	await shot(page, 'yt-card');
	await page.keyboard.press('Escape');
	await wait(600);
	await shadow(page, 'sawa-lens-side', "root.querySelector('.s').scrollIntoView({block:'start'})");
	await page.evaluate(() => { const s = document.querySelector('sawa-lens-side'); window.scrollBy(0, s.getBoundingClientRect().top + window.scrollY - 0); });
	await wait(500);
	await shadow(page, 'sawa-lens-side', "root.querySelectorAll('.s')[3].scrollIntoView({block:'center'})");
	await wait(800);
	await shot(page, 'yt-transcript');
	await browser.close();
}

async function extPages() {
	// chrome://extensions without and with the extension, and the popup
	let b = await launch(9337, []);
	let p = await b.newPage();
	await p.setViewport({ width: 640, height: 340, deviceScaleFactor: 1.5 });
	await p.emulateMediaFeatures([{ name: 'prefers-color-scheme', value: 'light' }]);
	await p.goto('chrome://extensions');
	await wait(1500);
	const pos = (sel) => p.evaluate((sel) => { const m = document.querySelector('extensions-manager'); const t = m.shadowRoot.querySelector('extensions-toolbar'); const el = sel === 'dev' ? t.shadowRoot.querySelector('#devMode') : t.shadowRoot.querySelector(sel); const r = el.getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width, h: r.height }; }, sel);
	let d = await pos('dev'); await ring(p, d.x, d.y, d.w, d.h);
	await shot(p, 'ext-1-devmode-off', { type: 'webp' });
	await p.evaluate(() => { const m = document.querySelector('extensions-manager'); m.shadowRoot.querySelector('extensions-toolbar').shadowRoot.querySelector('#devMode').click(); });
	await wait(1200);
	const clean = () => p.evaluate(() => { const m = document.querySelector('extensions-manager'); const v = m.shadowRoot.querySelector('extensions-item-list'); if (v) v.shadowRoot.querySelectorAll('extensions-item').forEach((e) => e.remove()); });
	await clean();
	await p.evaluate(() => document.querySelectorAll('div').forEach((x) => { if (x.style.borderColor || /E3262B|227, 38, 43/.test(x.style.cssText)) x.remove(); }));
	const lu = await pos('#loadUnpacked'); await ring(p, lu.x, lu.y, lu.w, lu.h);
	await shot(p, 'ext-2-load-unpacked');
	await b.close();
	b = await launch(9338, ['--disable-extensions-except=' + ext, '--load-extension=' + ext]);
	p = await b.newPage();
	await p.setViewport({ width: 640, height: 340, deviceScaleFactor: 1.5 });
	await p.emulateMediaFeatures([{ name: 'prefers-color-scheme', value: 'light' }]);
	await p.goto('chrome://extensions');
	await wait(1800);
	await p.evaluate(() => { document.querySelector('extensions-manager').shadowRoot.querySelector('extensions-toolbar').shadowRoot.querySelector('#devMode').click(); });
	await wait(1200);
	await shot(p, 'ext-3-loaded');
	const id = await p.evaluate(() => document.querySelector('extensions-manager').shadowRoot.querySelector('extensions-item-list').shadowRoot.querySelector('extensions-item').id);
	const q = await b.newPage();
	await q.emulateMediaFeatures([{ name: 'prefers-color-scheme', value: 'light' }]);
	await q.setViewport({ width: 360, height: 330, deviceScaleFactor: 2 });
	await q.goto('chrome-extension://' + id + '/popup/popup.html');
	await wait(1500);
	await shot(q, 'popup-signin');
	await b.close();
}

(async () => {
	const which = process.argv[4] || 'all';
	if (which === 'all' || which === 'phone') await phone();
	if (which === 'all' || which === 'ext') await extPages();
	process.exit(0);
})().catch((e) => { console.error('FAILED', e.message); process.exit(1); });
