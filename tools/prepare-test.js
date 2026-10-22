/* 🎧 Voice-only playlist — silent check with the extension loaded (computer).
   Usage: node prepare-test.js <outDir> [videoId] [ui]   (ui: stop after the page checks, before getting the song)
   Never plays sound: --mute-audio, and the capture tab is muted by the extension itself (checked).
   Opens 🎧 Voice-only playlist from the player menu, pastes the song's link, waits until the Prepared songs page says ✓ Ready
   (capture in a muted background tab, then the best voice model), checks the original sound wasn't kept,
   then plays the song with 🎤 Vocals only: the prepared voice must start at once. */
'use strict';
const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawn } = require('child_process');
const puppeteer = require('puppeteer');

const out = process.argv[2] || path.join(os.tmpdir(), 'lens-prepare');
const vid = process.argv[3] || 'DyDfgMOUjCI', uiOnly = process.argv[4] === 'ui';
const ext = path.join(__dirname, '../extension');
fs.mkdirSync(out, { recursive: true });
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const results = [];
const check = (name, ok, info) => { results.push({ name, ok: !!ok }); console.log(ok ? '✓' : '✗', name, info == null ? '' : info); };

async function launch() {
	const prof = path.join(os.tmpdir(), 'lens-pp-' + Date.now());
	spawn(puppeteer.executablePath(), ['--user-data-dir=' + prof, '--no-first-run', '--no-default-browser-check', '--remote-debugging-port=9337', '--headless=new', '--mute-audio',
		'--enable-unsafe-webgpu', '--disable-gpu-sandbox', '--disable-extensions-except=' + ext, '--load-extension=' + ext, '--window-size=1400,1000', '--lang=en-US', 'about:blank'], { detached: true, stdio: 'ignore' }).unref();
	for (let i = 0; i < 40; i++) {
		try { return await puppeteer.connect({ browserURL: 'http://127.0.0.1:9337', defaultViewport: null, protocolTimeout: 900000 }); } catch (e) { await wait(500); }
	}
	throw new Error('chrome did not start');
}
async function lens(page) {
	const cdp = await page.createCDPSession(), ctxs = [];
	cdp.on('Runtime.executionContextCreated', (e) => ctxs.push(e.context));
	cdp.on('Runtime.executionContextsCleared', () => { ctxs.length = 0; });
	await cdp.send('Runtime.enable');
	return async (expr) => {
		const c = ctxs.filter((x) => x.auxData && x.auxData.type === 'isolated' && /Language Lens/.test(x.name)).pop();
		if (!c) return undefined;
		const r = await cdp.send('Runtime.evaluate', { expression: expr, contextId: c.id, returnByValue: true, awaitPromise: true });
		if (r.exceptionDetails) throw new Error(r.exceptionDetails.text);
		return r.result.value;
	};
}
async function desktop(browser, page) {
	await page.setViewport({ width: 1400, height: 900 });
	const ua = (await browser.userAgent()).replace('HeadlessChrome', 'Chrome'), major = (ua.match(/Chrome\/(\d+)/) || [])[1] || '140';
	await page.setUserAgent({ userAgent: ua, userAgentMetadata: { brands: [{ brand: 'Google Chrome', version: major }, { brand: 'Chromium', version: major }], platform: 'Windows', platformVersion: '10.0.0', architecture: 'x86', model: '', mobile: false } });
	await page.evaluateOnNewDocument(() => { try { speechSynthesis.speak = () => {}; } catch (e) { /* */ } });
}
async function clickMenu(page, action) {
	await page.waitForSelector('.sawa-lens-ytbtn', { timeout: 30000 });
	const r = await page.evaluate(() => { const b = document.querySelector('.sawa-lens-ytbtn').getBoundingClientRect(); return { x: b.left + b.width / 2, y: b.top + b.height / 2 }; });
	await page.mouse.move(r.x, r.y); await wait(300); await page.mouse.click(r.x, r.y); await wait(500);
	const p = await page.evaluate((a) => { const b = document.querySelector('sawa-lens-yt').shadowRoot.querySelector('[data-a=' + a + ']'); if (!b || b.hidden) return null; const r = b.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2, text: b.textContent }; }, action);
	if (p) await page.mouse.click(p.x, p.y);
	return p;
}

(async () => {
	const browser = await launch();
	const t0 = Date.now();
	try {
		const page = await browser.newPage();
		await desktop(browser, page);
		await page.goto('https://www.youtube.com/watch?v=' + vid, { waitUntil: 'domcontentloaded' });
		await wait(5000);
		const prepTarget = browser.waitForTarget((t) => /vocals\/prepare\.html/.test(t.url()), { timeout: 30000 }).catch(() => null);
		const btn = await clickMenu(page, 'vplist');
		check('🎵 Music menu: "🎧 Voice-only playlist" (no single-song button any more)', btn && !(await page.evaluate(() => !!document.querySelector('sawa-lens-yt').shadowRoot.querySelector('[data-a=prep]'))), btn && btn.text);
		const tgt = await prepTarget;
		check('the Voice-only playlist page opens', tgt);
		if (!tgt) return;
		const pp = await tgt.page();
		pp.on('console', (m) => { if (m.type() === 'error') console.log('  [prepare page]', m.text().slice(0, 200)); });
		await page.evaluate(() => { const v = document.querySelector('#movie_player video'); if (v) v.pause(); });
		await pp.waitForFunction(() => window.__prepare && document.querySelector('#addBtn').onclick, { timeout: 20000 }).catch(() => {});
		// paste two links (the same song twice: added once) and add them
		await pp.evaluate((v) => { document.querySelector('#link').value = 'https://www.youtube.com/watch?v=' + v + ' https://youtu.be/' + v; document.querySelector('#addBtn').click(); }, vid);
		let ui = null;
		for (let i = 0; i < 20; i++) { await wait(500); ui = await pp.evaluate(() => ({ msg: document.querySelector('#addMsg').textContent, sum: document.querySelector('#sum').textContent, rows: document.querySelectorAll('#songs li').length, pinned: null })); if (/added/.test(ui.msg) && ui.rows) break; }
		const pin = await pp.evaluate(async () => { const t = await chrome.tabs.getCurrent(); return t && t.pinned; });
		check('paste links → songs added once, summary shown, page pinned', ui && /1 song added/.test(ui.msg) && ui.rows === 1 && /of 1 ready/.test(ui.sum) && pin, JSON.stringify(Object.assign(ui || {}, { pinned: pin })));
		await pp.screenshot({ path: path.join(out, 'voice-playlist-page.png') });
		if (uiOnly) return;
		// capture tab: muted by the extension
		let mutedSeen = null, st = '';
		for (let i = 0; i < 1200; i++) {
			await wait(1000);
			st = await pp.evaluate(() => document.querySelector('#songs').textContent).catch(() => st);
			if (mutedSeen === null) {
				const tabs = await pp.evaluate(async () => (await chrome.tabs.query({})).map((t) => ({ muted: t.mutedInfo && t.mutedInfo.muted, url: t.pendingUrl || t.url || '' }))).catch(() => []);
				const cap = tabs.find((t) => /sawa_prepare=1/.test(t.url) || (t.muted && !/prepare\.html/.test(t.url)));
				if (cap) mutedSeen = cap.muted;
			}
			if (i % 30 === 0) console.log('  ' + Math.round((Date.now() - t0) / 1000) + 's · ' + st.slice(0, 140));
			if (/✓ Ready|Could not prepare/.test(st)) break;
		}
		check('the background tab that gets the sound is muted', mutedSeen === true, String(mutedSeen));
		const info = await pp.evaluate(async () => {
			const { done } = await window.__prepare.lists();
			const audioLeft = await LensAudio.Store.keys('audio');
			return { done, audioLeft };
		});
		const d = info.done[vid];
		check('song prepared (✓ Ready)', d, st.slice(0, 200));
		if (d) {
			console.log('  ' + JSON.stringify(d));
			check('the original sound is not kept, only the voice', !info.audioLeft.includes(vid), JSON.stringify(info.audioLeft));
		}
		await pp.screenshot({ path: path.join(out, 'prepared-page.png') });
		// play it with Vocals only: the prepared voice starts at once
		const L = await lens(page);
		await page.bringToFront();
		await page.goto('https://www.youtube.com/watch?v=' + vid, { waitUntil: 'domcontentloaded' });
		await wait(5000);
		await page.evaluate(() => { const v = document.querySelector('#movie_player video'); if (v) { v.currentTime = 20; v.play().catch(() => {}); } });
		await clickMenu(page, 'vocals');
		let dbg = null;
		for (let i = 0; i < 60; i++) { await wait(500); dbg = await L('LensVocals.debug()'); if (dbg && dbg.firstSoundMs) break; }
		check('🎤 Vocals only uses the prepared voice and starts at once', dbg && dbg.backend === 'prepared' && dbg.firstSoundMs && dbg.firstSoundMs < 3000, dbg && JSON.stringify({ backend: dbg.backend, firstSoundMs: dbg.firstSoundMs, state: dbg.state, log: dbg.log.slice(-4) }));
		await wait(6000);
		const s2 = await page.evaluate(() => { const v = document.querySelector('#movie_player video'); return { t: v.currentTime, paused: v.paused }; });
		const d2 = await L('LensVocals.debug()');
		check('the video plays on with the voice', !s2.paused && d2.wins.some((w) => w.playing), JSON.stringify({ s2, wins: d2.wins.slice(0, 3) }));
		await L('LensVocals.set(false)');
		await L('chrome.storage.local.set({ vocalsOnly: false })');
	} finally {
		await browser.close();
	}
	const bad = results.filter((r) => !r.ok).length;
	console.log(bad ? bad + ' check(s) failed' : 'all ' + results.length + ' checks passed', '· ' + Math.round((Date.now() - t0) / 1000) + 's · screenshots in', out);
	process.exit(bad ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(2); });
