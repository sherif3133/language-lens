/* Phone check: the extension on YouTube's phone site (m.youtube.com) in a phone-sized touch browser,
   then a quick check that the computer site still works.
   Usage: node mobile-test.js <outDir> [videoId]
   Taps a caption word, a transcript word and the Repeat button; saves screenshots to outDir. */
'use strict';
const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer');

const out = process.argv[2] || path.join(require('os').tmpdir(), 'lens-mobile');
const vid = process.argv[3] || 'arj7oStGLkU';
const ext = path.join(__dirname, '../extension');
fs.mkdirSync(out, { recursive: true });
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const results = [];
const check = (name, ok, info) => { results.push({ name, ok: !!ok }); console.log(ok ? '✓' : '✗', name, info == null ? '' : info); };

/** Middle of the first element matching sel inside the shadow root of host. */
function centre(page, host, sel, nth) {
	return page.evaluate((host, sel, nth) => {
		const h = document.querySelector(host);
		const el = h && h.shadowRoot && h.shadowRoot.querySelectorAll(sel)[nth || 0];
		if (!el) return null;
		el.scrollIntoView({ block: 'center' });
		const r = el.getBoundingClientRect();
		return { x: r.left + r.width / 2, y: r.top + r.height / 2, text: el.textContent };
	}, host, sel, nth);
}
/** A finger tap: real touch events (touchstart/touchend, then the click a phone browser sends). */
async function tap(page, pt) {
	if (!pt) return;
	await page.bringToFront();
	await Promise.race([page.touchscreen.tap(pt.x, pt.y), wait(8000).then(async () => { const alive = await Promise.race([page.evaluate(() => 'page responds'), wait(3000).then(() => 'PAGE FROZEN')]); throw new Error('tap timed out at ' + Math.round(pt.x) + ',' + Math.round(pt.y) + ' · ' + alive); })]);
}
const cardOpen = (page) => page.evaluate(() => {
	const h = document.querySelector('sawa-lens-card'), c = h && h.shadowRoot.querySelector('.card.on');
	if (!c) return null;
	const r = c.getBoundingClientRect();
	return { word: (c.querySelector('.w') || {}).textContent, exk: (c.querySelector('.exk span') || {}).textContent || '', top: Math.round(r.top), bottom: Math.round(r.bottom), width: Math.round(r.width) };
});

/** YouTube sends empty captions to automated browsers: start Chrome ourselves (no automation flags), then attach.
    Headless, so a window hidden behind others can't slow the video down. */
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
	try {
		/* ---------------- phone */
		const page = await browser.newPage();
		await page.emulate(puppeteer.KnownDevices['Pixel 5']);
		await page.bringToFront();
		await page.goto('https://m.youtube.com/watch?v=' + vid, { waitUntil: 'domcontentloaded' });
		await wait(4000);
		// A consent page in some regions: accept nothing, just go on.
		const hover = await page.evaluate(() => matchMedia('(hover: none)').matches);
		check('phone browser reports no hover (touch)', hover);
		await page.evaluate(() => { const p = document.querySelector('#movie_player'); if (p) { p.mute && p.mute(); p.playVideo && p.playVideo(); } });
		let line = null;
		let ads = 0;
		for (let i = 0; i < 60 && !line; i++) {
			await wait(1000);
			// Skip ads (Lens hides its captions during them), then go past the talk's silent opening, playing.
			ads += await page.evaluate(() => {
				const v = document.querySelector('#movie_player video'), ad = document.querySelector('#movie_player.ad-showing');
				if (ad) { const s = document.querySelector('.ytp-ad-skip-button, .ytp-skip-ad-button, .ytp-ad-skip-button-modern'); if (s) s.click(); else if (v && v.duration) v.currentTime = v.duration; return 1; }
				if (v && v.currentTime < 18) v.currentTime = 20;
				if (v && v.paused) v.play().catch(() => {});
				return 0;
			});
			line = await page.evaluate(() => { const h = document.querySelector('sawa-lens-yt'); const l = h && h.shadowRoot.querySelector('.line.en'); return l && l.querySelector('.wd') ? l.textContent : null; });
		}
		const why = line ? '' : JSON.stringify(await page.evaluate(() => {
			const v = document.querySelector('#movie_player video'), h = document.querySelector('sawa-lens-yt'), l = h && h.shadowRoot.querySelector('.line.en');
			return { t: v && v.currentTime, paused: v && v.paused, ad: !!document.querySelector('#movie_player.ad-showing'), line: l && l.innerHTML.slice(0, 120), log: (window.__sawaLensLog || []).slice(-3) };
		}));
		check('captions shown on the phone player', line, line + (ads ? ' (after ' + ads + 's of ads)' : '') + why);
		const mob = await page.evaluate(() => { const h = document.querySelector('sawa-lens-yt'); return h && h.classList.contains('mob'); });
		check('phone layout on the player', mob);
		const side = await page.evaluate(() => {
			const s = document.querySelector('sawa-lens-side');
			if (!s) return null;
			const r = s.getBoundingClientRect();
			return { rows: s.shadowRoot.querySelectorAll('.s').length, ctl: !!s.shadowRoot.querySelector('.ctl'), parent: s.parentElement.tagName.toLowerCase(), top: Math.round(r.top), width: Math.round(r.width) };
		});
		check('transcript under the video with controls', side && side.rows > 5 && side.ctl, JSON.stringify(side));
		await page.screenshot({ path: path.join(out, '1-phone-captions.png') });

		// Tap a word in the caption box.
		await page.evaluate(() => window.scrollTo(0, 0));
		let w = null;
		for (let i = 0; i < 20 && !w; i++) { w = await centre(page, 'sawa-lens-yt', '.line.en .wd', 0); if (!w) await wait(300); } // between two captions: wait for the next
		await tap(page, w);
		await wait(1500);
		const c1 = await cardOpen(page);
		const paused = await page.evaluate(() => document.querySelector('#movie_player video').paused);
		check('tap a caption word opens its card', c1 && c1.word, w ? JSON.stringify(c1) : 'no caption word: ' + JSON.stringify(await page.evaluate(() => { const v = document.querySelector('#movie_player video'), h = document.querySelector('sawa-lens-yt'); return { t: v && v.currentTime, paused: v && v.paused, host: !!h, inPlayer: h && h.parentElement && h.parentElement.id, line: h && h.shadowRoot.querySelector('.line.en').innerHTML.slice(0, 80), card: !!document.querySelector('sawa-lens-card .card.on') }; })));
		check('the video pauses while the card is open', paused);
		check('card is a bottom sheet (full width, at the bottom)', c1 && c1.width >= 380 && c1.bottom >= 840, c1 && c1.width + 'px wide, bottom ' + c1.bottom);
		await page.screenshot({ path: path.join(out, '2-phone-card.png') });

		// The 💬 Feedback link in the card opens the feedback box (four types, big tap targets), and Cancel brings the card back.
		const fbl = await page.evaluate(() => { const a = document.querySelector('sawa-lens-card').shadowRoot.querySelector('.card.on a[data-a=fb]'); if (!a) return null; a.scrollIntoView({ block: 'center' }); const r = a.getClientRects()[0]; return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; }); // the link can wrap onto two lines: aim at its first line
		check('card has a 💬 Feedback link', !!fbl);
		if (fbl) {
			await tap(page, fbl);
			await wait(1200);
			const fb = await page.evaluate(() => { const r = document.querySelector('sawa-lens-card').shadowRoot; const f = r.querySelector('.card.on .fb'); return f ? { types: f.querySelectorAll('.ty button').length, ta: !!f.querySelector('textarea'), minH: Math.min(...[...f.querySelectorAll('.ty button,.send,.cancel')].map((b) => b.getBoundingClientRect().height)), bottom: Math.round(r.querySelector('.card.on').getBoundingClientRect().bottom) } : null; });
			check('feedback box opens in the card (4 types, text box, 44px+ buttons)', fb && fb.types === 4 && fb.ta && fb.minH >= 44, JSON.stringify(fb));
			await tap(page, await centre(page, 'sawa-lens-card', '.card.on .cancel'));
			await wait(800);
			const back = await cardOpen(page);
			check('Cancel returns to the word card', back && back.word, JSON.stringify(back));
		}

		// Close it with ×.
		const x = await page.evaluate(() => { const b = document.querySelector('sawa-lens-card').shadowRoot.querySelector('.card.on .x'); const r = b.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; });
		await tap(page, x);
		await wait(800);
		check('× closes the card', !(await cardOpen(page)));

		// Tap a word in the transcript.
		const tw = await centre(page, 'sawa-lens-side', '.s .wd', 12);
		await tap(page, tw);
		await wait(1500);
		const c2 = await cardOpen(page);
		check('tap a transcript word opens its card', c2 && c2.word, tw && tw.text + ' → ' + JSON.stringify(c2));
		await page.screenshot({ path: path.join(out, '3-phone-transcript-card.png') });

		// Expressions ("you know", "a lot of"…) are one blue-underlined unit; a tap opens one card for the whole phrase.
		const xs = await page.evaluate(() => { const h = document.querySelector('sawa-lens-side'); return h ? [...h.shadowRoot.querySelectorAll('.s .wd.ex')].slice(0, 5).map((e) => e.textContent + '=' + e.dataset.e) : []; });
		check('transcript marks expressions', xs.length, xs.join(', '));
		await page.evaluate(() => { const b = document.querySelector('sawa-lens-card'); const x = b && b.shadowRoot.querySelector('.card.on .x'); if (x) x.click(); });
		const tx = await centre(page, 'sawa-lens-side', '.s .wd.ex', 0);
		if (tx) { await tap(page, tx); await wait(1500); }
		const c3 = await cardOpen(page);
		check('tap an expression opens one card for the whole phrase', c3 && c3.exk && / /.test(c3.word), tx && tx.text + ' → ' + JSON.stringify(c3));
		await page.screenshot({ path: path.join(out, '3b-phone-expression-card.png') });
		await page.keyboard.press('Escape');
		await wait(500);

		// Repeat: plays the current sentence and stops at its end.
		const rb = await centre(page, 'sawa-lens-side', '.ctl [data-a=repeat]');
		await page.evaluate(() => { const v = document.querySelector('#movie_player video'); v.currentTime = 30; });
		await wait(500);
		await tap(page, rb);
		let st = null;
		for (let i = 0; i < 25 && !(st && st.paused); i++) { await wait(1000); st = await page.evaluate(() => { const v = document.querySelector('#movie_player video'); return { t: v.currentTime, paused: v.paused }; }); }
		check('↻ Repeat plays one sentence then stops', st.paused && st.t > 25 && st.t < 45, JSON.stringify(st));

		// Display options open under the controls.
		const ob = await centre(page, 'sawa-lens-side', '.ctl [data-a=opts]');
		await tap(page, ob);
		await wait(500);
		const opts = await page.evaluate(() => !!document.querySelector('sawa-lens-side').shadowRoot.querySelector('.opts.on'));
		check('Display options open', opts);
		await page.screenshot({ path: path.join(out, '4-phone-options.png') });
		await page.close();

		/* ---------------- phone, a normal website: tap a word in a paragraph */
		const web = await browser.newPage();
		await web.emulate(puppeteer.KnownDevices['Pixel 5']);
		await web.goto('https://example.com/', { waitUntil: 'domcontentloaded' });
		await wait(2500);
		const ww = await web.evaluate(() => {
			const p = document.querySelector('p'), t = p && p.firstChild, i = t ? t.data.indexOf('domain') : -1;
			if (i < 0) return null;
			const r = document.createRange();
			r.setStart(t, i); r.setEnd(t, i + 6);
			const b = r.getBoundingClientRect();
			return { x: b.left + b.width / 2, y: b.top + b.height / 2 };
		});
		await tap(web, ww);
		await wait(1500);
		const wc = await cardOpen(web);
		check('phone website: tapping a word opens its card', wc && wc.word === 'domain', JSON.stringify(wc));
		await web.screenshot({ path: path.join(out, '4b-phone-website.png') });

		// A website paragraph with idioms and a split phrasal verb: tap "fence" → the card for "on the fence".
		await web.setRequestInterception(true);
		web.on('request', (r) => r.url() === 'https://example.com/lens-expr' ? r.respond({ status: 200, contentType: 'text/html', body: '<!doctype html><meta name=viewport content="width=device-width"><article><p id=p>' + 'My friend is still on the fence about the new job. She gave it up last year, but she is looking forward to a fresh start, and customer service called her twice. '.repeat(3) + '</p></article>' }) : r.continue());
		await web.goto('https://example.com/lens-expr', { waitUntil: 'domcontentloaded' });
		await wait(3500);
		const hl = await web.evaluate(() => { const h = CSS.highlights && CSS.highlights.get('lens-expr'), u = CSS.highlights && CSS.highlights.get('lens-exul'); return [...(h || []), ...(u || [])].map((r) => r.toString()); });
		check('website: expressions highlighted', hl.some((t) => t === 'on the fence') && hl.some((t) => t === 'gave it up'), JSON.stringify([...new Set(hl)]));
		const fw = await web.evaluate(() => { const t = document.getElementById('p').firstChild, i = t.data.indexOf('fence'), r = document.createRange(); r.setStart(t, i); r.setEnd(t, i + 5); const b = r.getBoundingClientRect(); return { x: b.left + b.width / 2, y: b.top + b.height / 2 }; });
		await tap(web, fw);
		await wait(1500);
		const fc = await cardOpen(web);
		check('website: tapping "fence" opens the card for "on the fence"', fc && fc.word === 'on the fence' && fc.exk === 'Idiom', JSON.stringify(fc));
		await web.screenshot({ path: path.join(out, '4c-phone-website-expression.png') });
		await web.close();

		/* ---------------- computer (no regressions) */
		const desk = await browser.newPage();
		await desk.setViewport({ width: 1400, height: 900 });
		const ua = (await browser.userAgent()).replace('HeadlessChrome', 'Chrome'), major = (ua.match(/Chrome\/(\d+)/) || [])[1] || '140';
		await desk.setUserAgent({ userAgent: ua, userAgentMetadata: { brands: [{ brand: 'Google Chrome', version: major }, { brand: 'Chromium', version: major }, { brand: 'Not.A/Brand', version: '99' }], platform: 'Windows', platformVersion: '10.0.0', architecture: 'x86', model: '', mobile: false } });
		await desk.goto('https://www.youtube.com/watch?v=' + vid, { waitUntil: 'domcontentloaded' });
		let dl = null;
		for (let i = 0; i < 90 && !dl; i++) { // ads can run first
			await wait(1000);
			dl = await desk.evaluate(() => { const h = document.querySelector('sawa-lens-yt'); const l = h && h.shadowRoot.querySelector('.line.en'); return l && l.querySelector('.wd') ? l.textContent : null; });
		}
		check('computer: captions shown', dl, dl || JSON.stringify(await desk.evaluate(() => (window.__sawaLensLog || []).slice(-4))));
		const dk = await desk.evaluate(() => ({ btn: !!document.querySelector('.sawa-lens-ytbtn'), side: !!document.querySelector('#secondary sawa-lens-side'), mob: !!document.querySelector('sawa-lens-yt.mob'), hover: matchMedia('(hover: none)').matches }));
		check('computer: player button + right-column transcript, no phone layout', dk.btn && dk.side && !dk.mob && !dk.hover, JSON.stringify(dk));
		const dw = await centre(desk, 'sawa-lens-yt', '.line.en .wd', 0);
		if (dw) await desk.mouse.move(dw.x, dw.y);
		await wait(1500);
		const dc = await cardOpen(desk);
		check('computer: hovering a word opens its card', dc && dc.word, JSON.stringify(dc));
		await desk.mouse.move(5, 5);
		await desk.evaluate(() => { const v = document.querySelector('#movie_player video'); if (v) v.pause(); }); // the transcript stops scrolling
		await wait(1200);
		const dx = await desk.evaluate(() => { const e = document.querySelector('sawa-lens-side').shadowRoot.querySelector('.s .wd.ex'); return e ? { x: 0, y: 0, text: e.textContent } : null; });
		let under = '';
		if (dx) {
			await wait(600);
			// An expression already on screen (the transcript scrolls itself back to the current sentence).
			const p2 = await desk.evaluate(() => { const h = document.querySelector('sawa-lens-side'); for (const e of h.shadowRoot.querySelectorAll('.s .wd.ex')) { const r = e.getBoundingClientRect(), x = r.left + r.width / 2, y = r.top + r.height / 2; let t = document.elementFromPoint(x, y); while (t && t.shadowRoot && t.shadowRoot.elementFromPoint(x, y) && t.shadowRoot.elementFromPoint(x, y) !== t) t = t.shadowRoot.elementFromPoint(x, y); if (t && t.closest && t.closest('.wd.ex') === e) return { x, y, text: e.textContent }; } return null; }) || dx;
			under = await desk.evaluate((x, y) => { let e = document.elementFromPoint(x, y); while (e && e.shadowRoot && e.shadowRoot.elementFromPoint(x, y) && e.shadowRoot.elementFromPoint(x, y) !== e) e = e.shadowRoot.elementFromPoint(x, y); return e ? e.tagName + '.' + e.className + ' ' + (e.textContent || '').slice(0, 20) : 'nothing'; }, p2.x, p2.y);
			await desk.mouse.move(p2.x - 3, p2.y);
			await desk.mouse.move(p2.x, p2.y, { steps: 3 });
		}
		await wait(1500);
		const dxc = await cardOpen(desk);
		check('computer: hovering an expression opens one card for the whole phrase', dxc && dxc.exk && / /.test(dxc.word), dx && dx.text + ' → ' + JSON.stringify(dxc) + ' · under the mouse: ' + under);
		await desk.screenshot({ path: path.join(out, '5-computer.png') });
	} finally {
		await browser.close();
	}
	const bad = results.filter((r) => !r.ok).length;
	console.log(bad ? bad + ' check(s) failed' : 'all ' + results.length + ' checks passed', '· screenshots in', out);
	process.exit(bad ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(2); });
