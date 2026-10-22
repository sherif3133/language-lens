/* 🎵 Music — silent check on real YouTube songs, with the extension loaded (computer, then phone).
   Usage: node music-test.js <outDir> [videoId,videoId,…]
   Never plays sound (--mute-audio, speechSynthesis stubbed). Not signed in: the 💡 explanation must fail politely.
   Checks: lyrics in the transcript (LRCLIB or the video's subtitles), Genius link, 🎵 Music in the player menu,
   💡 on lyric lines, nudging the timing, the 🎮 lyrics game, nothing for a talk (not a song), and lyrics on the phone site too. */
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
				// 🎮 the lyrics game
				const G = (fn, arg) => page.evaluate(fn, arg);
				const gstate = () => G(() => {
					const r = document.querySelector('sawa-lens-side').shadowRoot, g = r.querySelector('.game'), v = document.querySelector('#movie_player video');
					return g && !g.hidden ? { text: g.textContent.replace(/\s+/g, ' ').slice(0, 160), gap: (r.querySelector('.game .gap.cur') || {}).textContent || '', opts: [...r.querySelectorAll('.game [data-g=opt]')].map((b) => b.dataset.w), input: !!r.querySelector('.game input'), paused: v.paused, t: v.currentTime, score: +((g.querySelector('.sc b') || {}).textContent || 0), res: !!g.querySelector('.res'), gaming: document.querySelector('sawa-lens-yt').classList.contains('gaming') } : null;
				});
				const waitFor = async (pred, secs) => { let st = null; for (let k = 0; k < secs * 2; k++) { await wait(500); st = await gstate(); if (st && pred(st)) return st; } return st; };
				await G(() => document.querySelector('sawa-lens-side').shadowRoot.querySelector('[data-a=game]').click());
				await wait(800);
				let g = await gstate();
				check(vid + ': 🎮 Lyrics game opens (Choose / Type it)', g && /Choose/.test(g.text) && /Type it/.test(g.text) && g.gaming, JSON.stringify(g));
				await G(() => document.querySelector('sawa-lens-side').shadowRoot.querySelector('[data-g=go-choose]').click());
				g = await waitFor((s) => s.paused && s.opts.length === 4, 40);
				check(vid + ': video waits at the end of the line, 4 options, the answer among them', g && g.paused && g.opts.length === 4 && g.opts.some((o) => o.toLowerCase() === g.gap.toLowerCase().replace(/[^a-z']/g, '')), JSON.stringify(g));
				await page.screenshot({ path: path.join(out, 'game-choose.png') });
				if (g && g.opts.length) {
					await G((w) => [...document.querySelector('sawa-lens-side').shadowRoot.querySelectorAll('.game [data-g=opt]')].find((b) => b.dataset.w.toLowerCase() === w).click(), g.gap.toLowerCase().replace(/[^a-z']/g, ''));
					await wait(400);
					const g2 = await gstate();
					check(vid + ': right answer scores and the song goes on', g2 && g2.score >= 100 && /Right/.test(g2.text), JSON.stringify(g2));
					const g3 = await waitFor((s) => s.paused && s.opts.length === 4 && s.t > g.t + 1, 40);
					if (g3) {
						await G((w) => [...document.querySelector('sawa-lens-side').shadowRoot.querySelectorAll('.game [data-g=opt]')].find((b) => b.dataset.w.toLowerCase() !== w).click(), g3.gap.toLowerCase().replace(/[^a-z']/g, ''));
						await wait(400);
						const g4 = await gstate();
						check(vid + ': wrong answer shows the right word', g4 && /It’s “/.test(g4.text), JSON.stringify(g4));
					}
				}
				// Type mode: typing goes into the box, not to YouTube's hotkeys (f = full screen)
				await G(() => document.querySelector('sawa-lens-side').shadowRoot.querySelector('.game [data-g=exit]').click());
				await G(() => document.querySelector('sawa-lens-side').shadowRoot.querySelector('[data-a=game]').click());
				await wait(500);
				await G(() => document.querySelector('sawa-lens-side').shadowRoot.querySelector('[data-g=go-type]').click());
				const t1 = await waitFor((s) => s.input, 20);
				if (t1 && t1.input) {
					await G(() => document.querySelector('sawa-lens-side').shadowRoot.querySelector('.game input').focus());
					await page.keyboard.type('f' + t1.gap.slice(1).toLowerCase().replace(/[^a-z']/g, ''));
					const fs1 = await G(() => !!document.fullscreenElement);
					const typed = await G(() => document.querySelector('sawa-lens-side').shadowRoot.querySelector('.game input').value);
					check(vid + ': Type it: typing stays in the box (no YouTube hotkeys)', !fs1 && typed.length > 1, JSON.stringify({ fullscreen: fs1, typed, gap: t1.gap }));
					await page.keyboard.press('Enter');
					await wait(400);
					const t2 = await gstate();
					check(vid + ': Type it: a typed answer is checked', t2 && /Right|Almost|It’s “/.test(t2.text), t2 && t2.text.slice(0, 120));
				} else check(vid + ': Type it shows a box', false, JSON.stringify(t1));
				// the end: results with the words to practise
				await G(() => { const v = document.querySelector('#movie_player video'); v.currentTime = v.duration - 1; v.play(); });
				const end = await waitFor((s) => s.res, 20);
				check(vid + ': song end shows the score and words to practise', end && end.res && /Song finished/.test(end.text), end && end.text);
				await page.screenshot({ path: path.join(out, 'game-end.png') });
				await G(() => document.querySelector('sawa-lens-side').shadowRoot.querySelector('.game [data-g=exit]').click());
				await wait(300);
				const back = await G(() => ({ list: getComputedStyle(document.querySelector('sawa-lens-side').shadowRoot.querySelector('.list')).display !== 'none', gaming: document.querySelector('sawa-lens-yt').classList.contains('gaming') }));
				check(vid + ': closing the game brings the lyrics back', back.list && !back.gaming, JSON.stringify(back));
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
