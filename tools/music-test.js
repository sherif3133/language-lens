/* 🎵 Music — silent check on real YouTube songs, with the extension loaded (computer, then phone).
   Usage: node music-test.js <outDir> [videoId,videoId,…]
   Never plays sound (--mute-audio, speechSynthesis stubbed). Not signed in: the 💡 explanation must fail politely.
   Checks: lyrics in the transcript (LRCLIB or the video's subtitles), Genius link, 🎵 Music in the player menu,
   💡 on lyric lines, nudging the timing, nothing for a talk (not a song), and lyrics on the phone site too. */
'use strict';
const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawn } = require('child_process');
const puppeteer = require('puppeteer');

const out = process.argv[2] || path.join(os.tmpdir(), 'lens-music');
const songs = (process.argv[3] || '2Vv-BfVoq4g,DyDfgMOUjCI,qU9mHegkTc4').split(',');
const TALK = 'arj7oStGLkU';
const ext = path.join(__dirname, '../extension');
fs.mkdirSync(out, { recursive: true });
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const results = [];
const check = (name, ok, info) => { results.push({ name, ok: !!ok }); console.log(ok ? '✓' : '✗', name, info == null ? '' : info); };

async function launch() {
	const prof = path.join(os.tmpdir(), 'lens-mu-' + Date.now());
	spawn(puppeteer.executablePath(), ['--user-data-dir=' + prof, '--no-first-run', '--no-default-browser-check', '--remote-debugging-port=9336', '--headless=new', '--mute-audio',
		'--disable-extensions-except=' + ext, '--load-extension=' + ext, '--window-size=1400,1000', '--autoplay-policy=no-user-gesture-required', '--lang=en-US', 'about:blank'], { detached: true, stdio: 'ignore' }).unref();
	for (let i = 0; i < 40; i++) {
		try { return await puppeteer.connect({ browserURL: 'http://127.0.0.1:9336', defaultViewport: null }); } catch (e) { await wait(500); }
	}
	throw new Error('chrome did not start');
}
const side = (page) => page.evaluate(() => {
	const h = document.querySelector('sawa-lens-side'), r = h && h.shadowRoot;
	if (!r) return null;
	const m = r.querySelector('.music'), gen = m && m.querySelector('a.gen');
	const rows = [...r.querySelectorAll('.s')];
	return { music: m && !m.hidden ? m.textContent.replace(/\s+/g, ' ').trim() : '', genius: gen && gen.href, rows: rows.length, first: rows.slice(0, 3).map((x) => x.querySelector('.tx').textContent), bulb: !!r.querySelector('.s [data-a=lyr]') };
});
const menu = (page) => page.evaluate(() => {
	const h = document.querySelector('sawa-lens-yt'), r = h && h.shadowRoot, sec = r && r.querySelector('.lmmusic');
	return sec ? { shown: !sec.hidden, vocals: !!sec.querySelector('[data-a=vocals]'), genius: !sec.querySelector('.gen').hidden && sec.querySelector('.gen').href } : null;
});
async function open(page, vid) {
	await page.goto('https://www.youtube.com/watch?v=' + vid, { waitUntil: 'domcontentloaded' });
	for (let i = 0; i < 30; i++) {
		await wait(1000);
		await page.evaluate(() => {
			const v = document.querySelector('#movie_player video'), ad = document.querySelector('#movie_player.ad-showing');
			if (ad) { const s = document.querySelector('.ytp-ad-skip-button, .ytp-skip-ad-button, .ytp-ad-skip-button-modern'); if (s) s.click(); else if (v && v.duration) v.currentTime = v.duration; }
		}).catch(() => {}); // YouTube may still be navigating
		const s = await side(page).catch(() => null);
		if (s && s.rows > 3 && !/Looking for/.test(s.music)) return s;
	}
	return side(page);
}

(async () => {
	const browser = await launch();
	try {
		const page = await browser.newPage();
		await page.setViewport({ width: 1400, height: 900 });
		const ua = (await browser.userAgent()).replace('HeadlessChrome', 'Chrome'), major = (ua.match(/Chrome\/(\d+)/) || [])[1] || '140';
		await page.setUserAgent({ userAgent: ua, userAgentMetadata: { brands: [{ brand: 'Google Chrome', version: major }, { brand: 'Chromium', version: major }], platform: 'Windows', platformVersion: '10.0.0', architecture: 'x86', model: '', mobile: false } });
		await page.evaluateOnNewDocument(() => { try { speechSynthesis.speak = () => {}; } catch (e) { /* */ } });
		for (const vid of songs) {
			const s = await open(page, vid);
			const title = await page.evaluate(() => document.title.replace(/ - YouTube$/, ''));
			check(vid + ' (' + title + '): lyrics in the transcript', s && /LRCLIB/.test(s.music) && s.rows > 10, JSON.stringify(s));
			check(vid + ': Genius link', s && /^https:\/\/genius\.com\/search\?q=/.test(s.genius || ''), s && s.genius);
			const m = await menu(page);
			check(vid + ': 🎵 Music in the player menu (Vocals only + Genius)', m && m.shown && m.vocals && /genius\.com/.test(m.genius || ''), JSON.stringify(m));
			if (vid === songs[0]) {
				await page.screenshot({ path: path.join(out, 'music-' + vid + '.png') });
				check(vid + ': 💡 Explain on lyric lines', s && s.bulb);
				// 💡 when signed out: a clear message, not a stuck "Explaining…"
				await page.evaluate(() => { const r = document.querySelector('sawa-lens-side').shadowRoot; r.querySelector('.s [data-a=lyr]').click(); });
				let box = null;
				for (let i = 0; i < 20; i++) { await wait(500); box = await page.evaluate(() => { const b = document.querySelector('sawa-lens-side').shadowRoot.querySelector('.snd.lyr'); return b && b.textContent; }); if (box && !/Explaining/.test(box)) break; }
				check(vid + ': 💡 answers (signed out here: says so)', box && !/Explaining/.test(box), box);
				// Arabic switch
				await page.evaluate(() => document.querySelector('sawa-lens-side').shadowRoot.querySelector('[data-a=ll-ar]').click());
				await wait(500);
				const ar = await page.evaluate(() => document.querySelector('sawa-lens-side').shadowRoot.querySelector('[data-a=ll-ar]').classList.contains('on'));
				check(vid + ': explain in عربي can be chosen', ar);
				await page.evaluate(() => document.querySelector('sawa-lens-side').shadowRoot.querySelector('[data-a=ll-en]').click());
				// nudge the timing
				if (/LRCLIB/.test(s.music)) {
					const moved = async () => { const t = (await side(page)).music.match(/moved ([+-]?[0-9.]+)s/); return t ? +t[1] : 0; };
					const m0 = await moved();
					for (let k = 0; k < 2; k++) { await page.evaluate(() => document.querySelector('sawa-lens-side').shadowRoot.querySelector('[data-a="ly+"]').click()); await wait(800); }
					const m1 = await moved();
					check(vid + ': +0.5s twice moves the lyrics 1 s later', Math.abs(m1 - m0 - 1) < 0.01, m0 + 's → ' + m1 + 's');
				}
			}
		}
		// a talk, not a song: no Music bar, no Genius
		const t = await open(page, TALK);
		const tm = await menu(page);
		check('a talk: no 🎵 Music bar or Genius link', t && !t.music && tm && !tm.genius, JSON.stringify({ music: t && t.music, menu: tm }));
		await page.close();

		/* ---------------- phone: lyrics too (Vocals only stays hidden) */
		const ph = await browser.newPage();
		await ph.emulate(puppeteer.KnownDevices['Pixel 5']);
		await ph.goto('https://m.youtube.com/watch?v=' + songs[0], { waitUntil: 'domcontentloaded' });
		let p = null;
		for (let i = 0; i < 30; i++) {
			await wait(1000);
			await ph.evaluate(() => { const pl = document.querySelector('#movie_player'); if (pl && pl.mute) pl.mute(); });
			p = await side(ph);
			if (p && p.rows > 3 && /LRCLIB|subtitles/.test(p.music)) break;
		}
		check('phone: lyrics and Genius link in the transcript under the video', p && /LRCLIB|subtitles/.test(p.music) && p.genius, JSON.stringify(p));
		await ph.screenshot({ path: path.join(out, 'music-phone.png') });
		await ph.close();
	} finally {
		await browser.close();
	}
	const bad = results.filter((r) => !r.ok).length;
	console.log(bad ? bad + ' check(s) failed' : 'all ' + results.length + ' checks passed', '· screenshots in', out);
	process.exit(bad ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(2); });
