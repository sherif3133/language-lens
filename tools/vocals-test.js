/* Vocals only (test) — silent check on real YouTube songs, with the extension loaded.
   Usage: node vocals-test.js <outDir> [videoId,videoId,…] [secondsPerSong]
   Never plays sound: headless Chrome with --mute-audio, speechSynthesis stubbed, no hovering.
   For each song: open the Language Lens menu, click "🎤 Vocals only", and measure
   - time to first sound, backend (WebGPU / WASM), real-time factor, original sound off, voice in step with the video;
   - quality without listening: separate the first windows again in the engine page and save
     <song>-mix.wav / <song>-vocals.wav (to listen to later), with the music left in the quiet parts and in the bass;
   - CPU and GPU load on this computer (Windows counters), with Vocals only on vs off.
   Then: the phone site and a touch screen must not show the button. */
'use strict';
const fs = require('fs');
const path = require('path');
const os = require('os');
const { execFile, spawn } = require('child_process');
const puppeteer = require('puppeteer');

const out = process.argv[2] || path.join(os.tmpdir(), 'lens-vocals');
const songs = (process.argv[3] || '2Vv-BfVoq4g').split(',');
const secs = +(process.argv[4] || 25);
const ext = path.join(__dirname, '../extension');
fs.mkdirSync(out, { recursive: true });
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const results = [];
const check = (name, ok, info) => { results.push({ name, ok: !!ok }); console.log(ok ? '✓' : '✗', name, info == null ? '' : info); };
const report = { songs: [] };

async function launch() {
	const prof = path.join(os.tmpdir(), 'lens-vprof-' + Date.now());
	spawn(puppeteer.executablePath(), ['--user-data-dir=' + prof, '--no-first-run', '--no-default-browser-check', '--remote-debugging-port=9335', '--headless=new', '--mute-audio',
		'--enable-unsafe-webgpu', '--disable-gpu-sandbox', '--disable-extensions-except=' + ext, '--load-extension=' + ext, '--window-size=1400,1000',
		'--autoplay-policy=no-user-gesture-required', '--lang=en-US', 'about:blank'], { detached: true, stdio: 'ignore' }).unref();
	for (let i = 0; i < 40; i++) {
		try { return await puppeteer.connect({ browserURL: 'http://127.0.0.1:9335', defaultViewport: null, protocolTimeout: 600000 }); } catch (e) { await wait(500); }
	}
	throw new Error('chrome did not start');
}
/** Evaluate in Language Lens's content-script world (where window.LensVocals lives). */
async function lens(page) {
	const cdp = await page.createCDPSession();
	const ctxs = [];
	cdp.on('Runtime.executionContextCreated', (e) => ctxs.push(e.context));
	cdp.on('Runtime.executionContextsCleared', () => { ctxs.length = 0; });
	await cdp.send('Runtime.enable');
	return async (expr) => {
		const c = ctxs.filter((x) => x.auxData && x.auxData.type === 'isolated' && /Language Lens/.test(x.name) && x.auxData.isDefault === false).pop();
		if (!c) return undefined;
		const r = await cdp.send('Runtime.evaluate', { expression: expr, contextId: c.id, returnByValue: true, awaitPromise: true });
		if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception ? r.exceptionDetails.exception.description : r.exceptionDetails.text);
		return r.result.value;
	};
}
/** Windows performance counters: average CPU % and GPU 3D engine % over n seconds. */
function load(n) {
	const ps = `$c = Get-Counter -Counter '\\Processor(_Total)\\% Processor Time','\\GPU Engine(*engtype_3D)\\Utilization Percentage' -SampleInterval 1 -MaxSamples ${n};` +
		`$cpu = ($c.CounterSamples | ? { $_.Path -like '*processor*' } | Measure-Object CookedValue -Average).Average;` +
		`$gpu = ($c | % { ($_.CounterSamples | ? { $_.Path -like '*gpu engine*' } | Measure-Object CookedValue -Sum).Sum } | Measure-Object -Average).Average;` +
		`Write-Output ('{0:N1} {1:N1}' -f $cpu, $gpu)`;
	return new Promise((res) => execFile('powershell.exe', ['-NoProfile', '-Command', ps], { timeout: (n + 30) * 1000 }, (err, so) => {
		const m = String(so || '').trim().split(/\s+/).map(parseFloat);
		res(err ? null : { cpu: m[0], gpu: m[1] });
	}));
}
async function skipAds(page) {
	for (let i = 0; i < 60; i++) {
		const ad = await page.evaluate(() => {
			const v = document.querySelector('#movie_player video'), ad = document.querySelector('#movie_player.ad-showing');
			if (ad) { const s = document.querySelector('.ytp-ad-skip-button, .ytp-skip-ad-button, .ytp-ad-skip-button-modern'); if (s) s.click(); else if (v && v.duration) v.currentTime = v.duration; return true; }
			return !v || !(v.duration > 0);
		});
		if (!ad) return i;
		await wait(1000);
	}
	return -1;
}
function wav(file, L, R, sr) {
	const n = L.length, b = Buffer.alloc(44 + n * 4);
	b.write('RIFF', 0); b.writeUInt32LE(36 + n * 4, 4); b.write('WAVEfmt ', 8); b.writeUInt32LE(16, 16); b.writeUInt16LE(1, 20); b.writeUInt16LE(2, 22);
	b.writeUInt32LE(sr, 24); b.writeUInt32LE(sr * 4, 28); b.writeUInt16LE(4, 32); b.writeUInt16LE(16, 34); b.write('data', 36); b.writeUInt32LE(n * 4, 40);
	for (let i = 0; i < n; i++) { b.writeInt16LE(Math.round(Math.max(-1, Math.min(1, L[i])) * 32767), 44 + i * 4); b.writeInt16LE(Math.round(Math.max(-1, Math.min(1, R[i])) * 32767), 46 + i * 4); }
	fs.writeFileSync(file, b);
}

(async () => {
	const browser = await launch();
	try {
		const page = await browser.newPage();
		await page.setViewport({ width: 1400, height: 900 });
		const ua = (await browser.userAgent()).replace('HeadlessChrome', 'Chrome'), major = (ua.match(/Chrome\/(\d+)/) || [])[1] || '140';
		await page.setUserAgent({ userAgent: ua, userAgentMetadata: { brands: [{ brand: 'Google Chrome', version: major }, { brand: 'Chromium', version: major }], platform: 'Windows', platformVersion: '10.0.0', architecture: 'x86', model: '', mobile: false } });
		await page.evaluateOnNewDocument(() => { try { speechSynthesis.speak = () => {}; } catch (e) { /* */ } });
		const L = await lens(page);
		let first = true;
		for (const vid of songs) {
			const song = { vid };
			report.songs.push(song);
			console.log('— ' + vid);
			await page.goto('https://www.youtube.com/watch?v=' + vid, { waitUntil: 'domcontentloaded' });
			await wait(3000);
			await skipAds(page);
			song.title = await page.evaluate(() => document.title.replace(/ - YouTube$/, ''));
			await page.evaluate(() => { const v = document.querySelector('#movie_player video'); if (v) { v.currentTime = 5; v.play().catch(() => {}); } });
			let btn = null;
			for (let i = 0; i < 20 && !btn; i++) { await wait(500); btn = await page.$('.sawa-lens-ytbtn'); }
			if (first) {
				check('computer: Language Lens button on the player', btn);
				if (!btn) break;
			}
			// open the menu with a real click (a user gesture: the browser then allows Web Audio)
			const menu = await page.evaluate(() => {
				const h = document.querySelector('sawa-lens-yt'), b = h && h.shadowRoot.querySelector('[data-a=vocals]');
				return { has: !!b, on: !!(b && b.classList.contains('on')), text: b && b.textContent };
			});
			if (first) check('computer: "🎤 Vocals only" in the Language Lens menu', menu.has, JSON.stringify(menu));
			if (!menu.has) break;
			await page.evaluate(() => { document.querySelector('.sawa-lens-ytbtn').scrollIntoView({ block: 'center' }); });
			for (let i = 0; i < 4 && !(await L('LensVocals.debug().on')); i++) {
				const open = await page.evaluate(() => document.querySelector('sawa-lens-yt').shadowRoot.querySelector('.lensmenu').classList.contains('on'));
				if (!open) {
					const r = await page.evaluate(() => { const b = document.querySelector('.sawa-lens-ytbtn').getBoundingClientRect(); return { x: b.left + b.width / 2, y: b.top + b.height / 2 }; });
					await page.mouse.move(r.x, r.y); // the player shows its controls
					await wait(300);
					await page.mouse.click(r.x, r.y);
					await wait(400);
				}
				const pt = await page.evaluate(() => { const b = document.querySelector('sawa-lens-yt').shadowRoot.querySelector('[data-a=vocals]'); const r = b.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2, w: r.width }; });
				if (pt.w) await page.mouse.click(pt.x, pt.y);
				await wait(500);
			}
			const t0 = Date.now();
			let d = null, states = new Set();
			for (let i = 0; i < 240; i++) {
				await wait(500);
				d = await L('LensVocals.debug()');
				if (d) states.add(d.state + (d.text ? ': ' + d.text.replace(/\d+/g, 'N') : ''));
				if (d && d.state === 'error') break;
				if (d && d.firstSoundMs) break;
			}
			song.firstSoundMs = d && d.firstSoundMs;
			song.backend = d && d.backend;
			song.states = [...states];
			check(vid + ': voice starts', d && d.firstSoundMs, d && JSON.stringify({ firstSoundMs: d.firstSoundMs, backend: d.backend, state: d.state, text: d.text, states: song.states, wins: d.wins, log: d.log.filter((l) => !/status (waiting|download)/.test(l)).slice(-12) }) + ' ' + JSON.stringify(await page.evaluate(() => { const v = document.querySelector('#movie_player video'); const b = []; for (let i = 0; i < v.buffered.length; i++) b.push([+v.buffered.start(i).toFixed(1), +v.buffered.end(i).toFixed(1)]); return { t: v.currentTime, paused: v.paused, buf: b }; })));
			check(vid + ': original sound is off (dry gain 0, through Web Audio)', d && d.dry === 0 && d.hasSrc, d && JSON.stringify({ dry: d.dry, hasSrc: d.hasSrc }));
			if (!(d && d.firstSoundMs)) continue;
			// keep playing; check the voice follows the video
			const loadOn = first ? load(Math.min(20, secs)) : null;
			const samples = [];
			for (let i = 0; i < secs; i += 2) {
				await wait(2000);
				const s = await page.evaluate(() => { const v = document.querySelector('#movie_player video'); return { t: v.currentTime, paused: v.paused }; });
				const dd = await L('LensVocals.debug()');
				samples.push({ t: s.t, paused: s.paused, playing: dd.wins.filter((w) => w.playing).length, state: dd.state });
			}
			const moving = samples.filter((s) => !s.paused).length, voiced = samples.filter((s) => !s.paused && s.playing > 0).length;
			const efr = page.frames().find((f) => /vocals\/vocals\.html$/.test(f.url()));
			const eng = efr && await efr.evaluate(() => ({ ranges: window.__vocalsEngine.ranges(), laced: window.__vocalsEngine.laced, stat: window.__vocalsEngine.stat }));
			check(vid + ': video plays with the voice scheduled', moving >= samples.length * 0.7 && voiced >= moving * 0.9, JSON.stringify(samples.slice(0, 6)) + ' … engine ' + JSON.stringify(eng) + ' log ' + JSON.stringify((await L('LensVocals.debug()')).log.filter((l) => !/status (waiting|download)/.test(l)).slice(-8)));
			d = await L('LensVocals.debug()');
			song.rtf = d.rtf;
			song.log = d.log;
			// quality without listening: separate the first two windows again, in the engine page
			const fr = page.frames().find((f) => /vocals\/vocals\.html$/.test(f.url()));
			if (fr) {
				const q = await fr.evaluate(async (n) => {
					const E = window.__vocalsEngine, sep = E.sep, SR = 44100;
					if (!sep) return null;
					// overlap-add the windows as the player does (their crossfades sum to one)
					const len = n * sep.step, ML = new Float32Array(len), MR = new Float32Array(len), VL = new Float32Array(len), VR = new Float32Array(len);
					for (let k = 0; k < n; k++) {
						const nd = sep.need(k), pcm = await E.pcmFor(nd.from, nd.to);
						const off = sep.cfg.nfft + sep.margin, w = await sep.window(k, pcm.L.slice(), pcm.R.slice());
						for (let i = 0; i < w.L.length; i++) {
							const j = w.start + i;
							if (j >= len) break;
							VL[j] += w.L[i]; VR[j] += w.R[i];
							ML[j] = pcm.L[off + i]; MR[j] = pcm.R[off + i];
						}
					}
					// energy below 120 Hz (bass, kick drum) with a simple low-pass
					const low = (x) => { let y = 0, e = 0; const a = 1 - Math.exp(-2 * Math.PI * 120 / SR); for (let i = 0; i < x.length; i++) { y += a * (x[i] - y); e += y * y; } return e; };
					const en = (x) => x.reduce((s, v) => s + v * v, 0);
					// 100 ms frames: where the voice output is quietest (no singing), how much of the music is left
					const fr = 4410, rows = [];
					for (let i = 0; i + fr <= ML.length; i += fr) {
						let m = 0, v = 0;
						for (let j = i; j < i + fr; j++) { m += ML[j] * ML[j] + MR[j] * MR[j]; v += VL[j] * VL[j] + VR[j] * VR[j]; }
						rows.push({ m, v });
					}
					const loud = rows.filter((r) => r.m > 1e-4 * fr);
					loud.sort((a, b) => a.v / a.m - b.v / b.m);
					const quiet = loud.slice(0, Math.max(1, Math.floor(loud.length * 0.2)));
					const db = (x) => 10 * Math.log10(Math.max(1e-12, x));
					const enc = (x) => { const u = new Int16Array(x.length); for (let i = 0; i < x.length; i++) u[i] = Math.max(-1, Math.min(1, x[i])) * 32767; let s = ''; const b = new Uint8Array(u.buffer); for (let i = 0; i < b.length; i += 0x8000) s += String.fromCharCode.apply(null, b.subarray(i, i + 0x8000)); return btoa(s); };
					return {
						seconds: ML.length / SR,
						overallDb: db((en(VL) + en(VR)) / (en(ML) + en(MR))),
						bassDb: db((low(VL) + low(VR)) / (low(ML) + low(MR))),
						gapsDb: db(quiet.reduce((s, r) => s + r.v, 0) / quiet.reduce((s, r) => s + r.m, 0)),
						ML: enc(ML), MR: enc(MR), VL: enc(VL), VR: enc(VR)
					};
				}, 2);
				if (q) {
					const dec = (s) => { const b = Buffer.from(s, 'base64'); const i = new Int16Array(b.buffer, b.byteOffset, b.length / 2); return Float32Array.from(i, (x) => x / 32767); };
					wav(path.join(out, vid + '-mix.wav'), dec(q.ML), dec(q.MR), 44100);
					wav(path.join(out, vid + '-vocals.wav'), dec(q.VL), dec(q.VR), 44100);
					song.quality = { seconds: +q.seconds.toFixed(1), voiceVsMixDb: +q.overallDb.toFixed(1), bassLeftDb: +q.bassDb.toFixed(1), musicLeftInGapsDb: +q.gapsDb.toFixed(1) };
					// a note, not a pass/fail: deep voices and piano also live low, and a song may start without singing
					console.log('ℹ', vid + ': quality (dB vs the original; lower = less music)', JSON.stringify(song.quality));
				}
			} else check(vid + ': engine page found', false);
			if (loadOn) {
				song.loadOn = await loadOn;
				// same song, Vocals only off
				await page.mouse.click(10, 10);
				await L('LensVocals.set(false)');
				await page.evaluate(() => { const v = document.querySelector('#movie_player video'); v.play().catch(() => {}); });
				song.loadOff = await load(Math.min(20, secs));
				const off = await L('LensVocals.debug()');
				const playingOff = await page.evaluate(() => !document.querySelector('#movie_player video').paused);
				check(vid + ': turning it off brings back normal sound', !off.on && off.dry === 1 && playingOff, JSON.stringify({ on: off.on, dry: off.dry, playing: playingOff }));
			}
			await L('LensVocals.set(false)');
			first = false;
		}
		await L('chrome.storage.local.set({ vocalsOnly: false })');

		/* ---------------- phones and touch screens: no button */
		const ph = await browser.newPage();
		await ph.emulate(puppeteer.KnownDevices['Pixel 5']);
		await ph.evaluateOnNewDocument(() => { try { speechSynthesis.speak = () => {}; } catch (e) { /* */ } });
		const PL = await lens(ph);
		await ph.goto('https://m.youtube.com/watch?v=' + songs[0], { waitUntil: 'domcontentloaded' });
		await wait(6000);
		const pm = await ph.evaluate(() => ({ tap: !!window.__sawaVocalsMain }));
		const ps = await PL('({ supported: !!(window.LensVocals && LensVocals.supported()), btn: !!document.querySelector("sawa-lens-yt") && !!document.querySelector("sawa-lens-yt").shadowRoot.querySelector("[data-a=vocals]") })');
		check('phone (m.youtube.com): no Vocals only, no audio tap', ps && !ps.supported && !ps.btn && !pm.tap, JSON.stringify(Object.assign({}, ps, pm)));
		await ph.close();
		const tp = await browser.newPage();
		await tp.emulate(puppeteer.KnownDevices['iPad Pro 11']);
		const TL = await lens(tp);
		await tp.setUserAgent((await browser.userAgent()).replace('HeadlessChrome', 'Chrome'));
		await tp.goto('https://www.youtube.com/watch?v=' + songs[0], { waitUntil: 'domcontentloaded' });
		await wait(6000);
		const ts = await TL('({ hoverNone: matchMedia("(hover: none)").matches, supported: !!(window.LensVocals && LensVocals.supported()) })');
		check('touch screen on www.youtube.com: Vocals only hidden', ts && ts.hoverNone && !ts.supported, JSON.stringify(ts));
		await tp.close();
	} finally {
		await browser.close();
	}
	fs.writeFileSync(path.join(out, 'report.json'), JSON.stringify(report, null, 1));
	const bad = results.filter((r) => !r.ok).length;
	console.log(bad ? bad + ' check(s) failed' : 'all ' + results.length + ' checks passed', '· report and wav files in', out);
	process.exit(bad ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(2); });
