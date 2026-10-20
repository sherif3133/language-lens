/* End-to-end check of the extension against the local WordPress copy.
   Usage: node e2e.js <server> <token> <outDir>
   Builds a test copy of the extension allowed to talk to the local server, opens a YouTube video,
   hovers a caption word, marks it, saves the sentence, then checks the server got everything. */
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
	await page.goto('https://www.youtube.com/watch?v=iG9CE55wbtY', { waitUntil: 'domcontentloaded' });
	try {
		const consent = await page.$('button[aria-label*="Accept"], form[action*="consent"] button');
		if (consent) await consent.click();
	} catch (e) {}
	await page.waitForSelector('#movie_player video', { timeout: 30000 });
	await page.evaluate(() => { const v = document.querySelector('#movie_player video'); v.muted = true; v.play(); });
	// wait for our caption bar to get words
	let ok = false;
	for (let i = 0; i < 90 && !ok; i++) {
		await wait(1000);
		ok = await page.evaluate(() => {
			const h = document.querySelector('sawa-lens-yt');
			return !!(h && h.shadowRoot && h.shadowRoot.querySelector('.wd'));
		});
	}
	log('caption words shown:', ok);
	const chip = await page.evaluate(() => { const h = document.querySelector('sawa-lens-yt'); const c = h && h.shadowRoot.querySelector('.chip'); return c && !c.hidden ? c.textContent : ''; });
	log('grade chip:', chip);
	await page.screenshot({ path: path.join(out, 'yt-captions.png') });
	if (!ok) {
		log('debug:', JSON.stringify(await page.evaluate(() => ({ main: !!window.__sawaLensMain, log: window.__sawaLensLog, dbg: window.__lensDbg, cc: (document.querySelector('.ytp-subtitles-button')||{}).outerHTML ? document.querySelector('.ytp-subtitles-button').getAttribute('aria-pressed') : 'no-btn', tracks: (document.querySelector('#movie_player').getPlayerResponse().captions||{playerCaptionsTracklistRenderer:{captionTracks:[]}}).playerCaptionsTracklistRenderer.captionTracks.length, opt: JSON.stringify(document.querySelector('#movie_player').getOption ? document.querySelector('#movie_player').getOption('captions','track') : null), host: !!document.querySelector('sawa-lens-yt'), hostKids: document.querySelector('sawa-lens-yt') ? document.querySelector('sawa-lens-yt').shadowRoot.innerHTML.length : 0, line: document.querySelector('sawa-lens-yt') ? document.querySelector('sawa-lens-yt').shadowRoot.querySelector('.line').outerHTML.slice(0,200) : '', msg: document.querySelector('sawa-lens-yt') && document.querySelector('sawa-lens-yt').shadowRoot.querySelector('.msg') ? document.querySelector('sawa-lens-yt').shadowRoot.querySelector('.msg').textContent : '', tt: performance.getEntriesByType('resource').filter(e => /timedtext/.test(e.name)).map(e => e.name.slice(0, 60) + ' pot=' + /pot=/.test(e.name)), t: document.querySelector('#movie_player video').currentTime }))));
		await browser.close();
		process.exit(1);
	}

	// Transcript sidebar
	await wait(1500);
	const side = await page.evaluate(() => {
		const h = document.querySelector('sawa-lens-side');
		if (!h) return null;
		const r = h.shadowRoot, rows = [...r.querySelectorAll('.s')];
		const cls = {};
		r.querySelectorAll('.wd').forEach((w) => { const c = w.className.replace('wd ', ''); cls[c] = (cls[c] || 0) + 1; });
		return { rows: rows.length, first: rows.slice(0, 4).map((x) => x.querySelector('.tm').textContent + ' ' + x.querySelector('.tx').textContent), classes: cls, inRight: !!h.closest('#secondary') };
	});
	log('sidebar:', JSON.stringify(side));
	await page.evaluate(() => document.querySelector('sawa-lens-side').scrollIntoView({ block: 'start' }));
	await page.screenshot({ path: path.join(out, 'yt-sidebar.png') });
	// Click the 6th sentence: the video should jump there
	const jump = await page.evaluate(async () => {
		const r = document.querySelector('sawa-lens-side').shadowRoot;
		const row = r.querySelectorAll('.s')[5];
		row.querySelector('.tm').click();
		await new Promise((x) => setTimeout(x, 800));
		return { label: row.querySelector('.tm').textContent, t: document.querySelector('#movie_player video').currentTime.toFixed(1) };
	});
	log('clicked sentence at', jump.label, '→ video at', jump.t + 's');
	// "Play only this sentence" stops at its end
	const once = await page.evaluate(async () => {
		const r = document.querySelector('sawa-lens-side').shadowRoot;
		const row = r.querySelectorAll('.s')[2];
		row.querySelector('.rep').click();
		await new Promise((x) => setTimeout(x, 9000));
		const v = document.querySelector('#movie_player video');
		return { paused: v.paused, t: v.currentTime.toFixed(1), label: row.querySelector('.tm').textContent };
	});
	log('play-once from', once.label, '→ paused:', once.paused, 'at', once.t + 's');

	// Hover the first "new" word (or any word)
	const pt = await page.evaluate(() => {
		const r = document.querySelector('sawa-lens-yt').shadowRoot;
		const w = r.querySelector('.wd.hard') || r.querySelector('.wd.next') || r.querySelector('.wd');
		const b = w.getBoundingClientRect();
		return { x: b.left + b.width / 2, y: b.top + b.height / 2, word: w.textContent };
	});
	await page.mouse.move(pt.x, pt.y);
	await wait(1500);
	const card = await page.evaluate(() => { const h = document.querySelector('sawa-lens-card'); const c = h && h.shadowRoot.querySelector('.card.on'); return c ? c.innerText : ''; });
	const paused = await page.evaluate(() => document.querySelector('#movie_player video').paused);
	log('hovered:', pt.word, '| video paused:', paused);
	log('card:', card.replace(/\s+/g, ' ').slice(0, 200));
	await page.screenshot({ path: path.join(out, 'yt-card.png') });

	// English → English
	await page.evaluate(() => document.querySelector('sawa-lens-card').shadowRoot.querySelector('button[data-a="lang-en"]').click());
	await wait(600);
	log('card (EN):', (await page.evaluate(() => document.querySelector('sawa-lens-card').shadowRoot.querySelector('.card').innerText)).replace(/\s+/g, ' ').slice(0, 220));
	await page.screenshot({ path: path.join(out, 'yt-card-en.png') });
	await page.evaluate(() => document.querySelector('sawa-lens-card').shadowRoot.querySelector('button[data-a="lang-ar"]').click());
	await wait(300);

	// Mark it known + save the sentence from the card
	await page.evaluate(() => { const r = document.querySelector('sawa-lens-card').shadowRoot; r.querySelector('button[data-a="learning"]').click(); });
	await wait(800);
	await page.evaluate(() => { const r = document.querySelector('sawa-lens-card').shadowRoot; r.querySelector('button[data-a="save"]').click(); });
	await wait(1500);
	log('card after save:', (await page.evaluate(() => document.querySelector('sawa-lens-card').shadowRoot.querySelector('.card').innerText)).replace(/\s+/g, ' ').slice(-80));
	await page.screenshot({ path: path.join(out, 'yt-card-saved.png') });

	// Grade panel
	await page.mouse.move(10, 10);
	await wait(800);
	await page.evaluate(() => document.querySelector('sawa-lens-yt').shadowRoot.querySelector('.chip').click());
	await wait(500);
	await page.screenshot({ path: path.join(out, 'yt-panel.png') });

	// Select two words in the sidebar → save as an expression
	const selRes = await page.evaluate(async () => {
		const h = document.querySelector('sawa-lens-side'), r = h.shadowRoot;
		const tx = [...r.querySelectorAll('.tx')].find((x) => x.querySelectorAll('.wd').length > 6);
		const ws = tx.querySelectorAll('.wd');
		const range = document.createRange();
		range.setStartBefore(ws[2]);
		range.setEndAfter(ws[3]);
		const sel = window.getSelection();
		sel.removeAllRanges();
		sel.addRange(range);
		tx.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, composed: true }));
		await new Promise((x) => setTimeout(x, 400));
		const pop = document.querySelector('sawa-lens-select');
		const p = pop && pop.shadowRoot.querySelector('.pop.on');
		if (!p) return { opened: false, text: range.toString() };
		p.querySelector('button[data-a="expr"]').click();
		await new Promise((x) => setTimeout(x, 200));
		p.querySelector('button[data-k="collocation"]').click();
		await new Promise((x) => setTimeout(x, 800));
		return { opened: true, text: range.toString(), msg: p.innerText.replace(/\s+/g, ' ').slice(-60) };
	});
	log('expression:', JSON.stringify(selRes));
	await wait(1500);
	const learningNow = await page.evaluate(() => [...document.querySelector('sawa-lens-side').shadowRoot.querySelectorAll('.wd.learning')].map((w) => w.textContent).slice(0, 8));
	log('learning words now highlighted:', JSON.stringify(learningNow));

	// Force a sync and check the server
	const res = await sw.evaluate(() => new Promise((r) => chrome.runtime.sendMessage({ type: 'sync' }, r)));
	log('sync ok:', res && res.ok, 'today:', res && res.ok && JSON.stringify({ w: res.data.progress.todayWords, s: res.data.progress.todaySentences, learning: res.data.progress.wordsLearning }));

	// A normal web page: inject like "switch on for this site"
	const wiki = await browser.newPage();
	await wiki.goto('https://en.wikipedia.org/wiki/Creativity', { waitUntil: 'domcontentloaded' });
	const tabs = await sw.evaluate(() => chrome.tabs.query({ url: 'https://en.wikipedia.org/*' }).then((t) => t.map((x) => x.id)));
	await sw.evaluate((id) => chrome.scripting.executeScript({ target: { tabId: id }, files: ['content/common.js', 'content/card.js', 'content/page.js'] }), tabs[0]);
	await wait(2500);
	const wpt = await wiki.evaluate(() => {
		const p = [...document.querySelectorAll('#mw-content-text p')].find((x) => x.textContent.length > 200);
		const tw = document.createTreeWalker(p, NodeFilter.SHOW_TEXT);
		let n;
		while ((n = tw.nextNode())) {
			const m = /\b[a-z]{6,}\b/.exec(n.data);
			if (m) {
				const r = document.createRange();
				r.setStart(n, m.index);
				r.setEnd(n, m.index + m[0].length);
				p.scrollIntoView({ block: 'center' });
				const b = r.getBoundingClientRect();
				return { x: b.left + b.width / 2, y: b.top + b.height / 2, word: m[0] };
			}
		}
	});
	await wiki.mouse.move(wpt.x, wpt.y);
	await wait(1200);
	const wcard = await wiki.evaluate(() => { const h = document.querySelector('sawa-lens-card'); const c = h && h.shadowRoot.querySelector('.card.on'); return c ? c.innerText : ''; });
	log('wiki hovered:', wpt.word, '| card:', wcard.replace(/\s+/g, ' ').slice(0, 160));
	const wchip = await wiki.evaluate(() => { const h = document.querySelector('sawa-lens-page'); const c = h && h.shadowRoot.querySelector('.chip.on'); return c ? c.textContent : ''; });
	log('wiki grade chip:', wchip);
	await wiki.screenshot({ path: path.join(out, 'wiki-card.png') });

	await browser.close();
})().catch((e) => {
	console.error('E2E FAILED', e);
	process.exit(1);
});
