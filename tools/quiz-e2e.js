/* Video quiz check: Sherif's lesson questions and Learning-word quizzes on YouTube. */
'use strict';
const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer');

const [server, token, out] = process.argv.slice(2);
const src = path.join(__dirname, '../extension');
const test = path.join(require('os').tmpdir(), 'lens-ext-test');
fs.rmSync(test, { recursive: true, force: true });
fs.cpSync(src, test, { recursive: true });
const man = JSON.parse(fs.readFileSync(path.join(test, 'manifest.json')));
man.host_permissions.push(server.replace(/:\d+$/, '') + '/*', 'https://en.wikipedia.org/*');
fs.writeFileSync(path.join(test, 'manifest.json'), JSON.stringify(man));
fs.mkdirSync(out, { recursive: true });
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const log = (...a) => console.log('•', ...a);

async function connectManual() {
	// Start Chrome ourselves (no automation flags, so sites treat it as a normal browser), then attach.
	const { spawn } = require('child_process');
	const exe = puppeteer.executablePath();
	const prof = path.join(require('os').tmpdir(), 'lens-prof-' + Date.now());
	spawn(exe, ['--user-data-dir=' + prof, '--no-first-run', '--no-default-browser-check', '--remote-debugging-port=9333', '--disable-extensions-except=' + test, '--load-extension=' + test, '--window-size=1400,900', '--autoplay-policy=no-user-gesture-required', 'about:blank'], { detached: true, stdio: 'ignore' }).unref();
	for (let i = 0; i < 40; i++) {
		try {
			return await puppeteer.connect({ browserURL: 'http://127.0.0.1:9333', defaultViewport: { width: 1400, height: 900 } });
		} catch (e) {
			await wait(500);
		}
	}
	throw new Error('chrome did not start');
}

(async () => {
	const browser = process.env.CONNECT ? await connectManual() : await puppeteer.launch({
		headless: process.env.HEADFUL ? false : true,
		args: ['--disable-extensions-except=' + test, '--load-extension=' + test, '--window-size=1400,900', '--autoplay-policy=no-user-gesture-required', '--lang=en-US'],
		defaultViewport: { width: 1400, height: 900 }
	});
	const swTarget = await browser.waitForTarget((t) => t.type() === 'service_worker' && t.url().endsWith('background.js'), { timeout: 15000 });
	const sw = await swTarget.worker();
	const extId = new URL(swTarget.url()).host;
	log('extension loaded', extId);
	await sw.evaluate((s, t) => chrome.storage.local.set({ server: s, token: t, level: 3 }), server, token);

	// Popup renders signed in
	const pop = await browser.newPage();
	await pop.goto('chrome-extension://' + extId + '/popup/popup.html');
	await wait(1500);
	log('popup:', (await pop.evaluate(() => document.body.innerText)).replace(/\s+/g, ' ').slice(0, 160));
	await pop.screenshot({ path: path.join(out, 'popup.png') });
	await pop.close();

	// YouTube
	const page = await browser.newPage();
	page.on('console', (m) => { if (/lens|Lens|error/i.test(m.text())) log('console:', m.text().slice(0, 200)); });
	page.on('pageerror', (e) => log('pageerror:', String(e).slice(0, 200)));
	// Test browsers get endless ads: block the ad servers.
	const cdp = await page.target().createCDPSession();
	await cdp.send('Network.enable');
	await cdp.send('Network.setBlockedURLs', { urls: ['*doubleclick.net*', '*googleads*', '*/pagead/*', '*googlesyndication*', '*/api/stats/ads*', '*/get_midroll_*', '*youtube.com/ad_*'] });
	await page.goto('https://www.youtube.com/watch?v=iG9CE55wbtY', { waitUntil: 'domcontentloaded' });
	try {
		const consent = await page.$('button[aria-label*="Accept"], form[action*="consent"] button');
		if (consent) await consent.click();
	} catch (e) {}
	await sw.evaluate(() => handlers.mark({ lemma: 'evidence', status: 'learning' }));
	const R = (fn, ...a) => page.evaluate(fn, ...a);
	const q = () => R(() => { const h = document.querySelector('sawa-lens-yt'); const el = h && h.shadowRoot.querySelector('.quiz'); return el && !el.hidden ? el.innerText.replace(/\s+/g, ' ') : ''; });
	for (let i = 0; i < 60; i++) { const ok = await R(() => { const s = document.querySelector('sawa-lens-side'); const e = s && s.shadowRoot && s.shadowRoot.querySelector('.lq'); return e ? e.innerText : ''; }); if (ok) { log('sidebar:', ok); break; } await wait(1000); }
	// wait for ads to finish, then play from 8 s
	for (let i = 0; i < 60 && await R(() => !!document.querySelector('#movie_player.ad-showing')); i++) await wait(1000);
	await R(() => { const v = document.querySelector('#movie_player video'); v.currentTime = 8; v.play(); });
	let text = '';
	for (let i = 0; i < 30 && !(text = await q()); i++) await wait(1000);
	log('lesson question:', text.slice(0, 160), '| paused:', await R(() => document.querySelector('#movie_player video').paused));
	await page.screenshot({ path: path.join(out, 'quiz-lesson.png') });
	await R(() => document.querySelector('sawa-lens-yt').shadowRoot.querySelector('.quiz .qo button[data-k="1"]').click());
	for (let i = 0; i < 20 && !/Continue/.test(await q()); i++) await wait(1000);
	log('after answer:', (await q()).slice(0, 200));
	await R(() => document.querySelector('sawa-lens-yt').shadowRoot.querySelector('.quiz [data-q=cont]').click());
	await wait(500);
	log('closed, playing:', await R(() => !document.querySelector('#movie_player video').paused));
	// Learning word quiz: "evidence" comes a bit later
	text = '';
	for (let i = 0; i < 70 && !(text = await q()); i++) await wait(1000);
	log('word quiz:', text.slice(0, 200), '| at', await R(() => Math.round(document.querySelector('#movie_player video').currentTime)));
	await page.screenshot({ path: path.join(out, 'quiz-word.png') });
	const sidebar = await R(() => document.querySelector('sawa-lens-side').shadowRoot.querySelector('.lq').innerText);
	log('sidebar after:', sidebar);
	await browser.close();
})().catch((e) => { console.error('FAILED', e); process.exit(1); });
