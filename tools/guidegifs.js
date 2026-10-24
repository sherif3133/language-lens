/* Animated step pictures (animated WebP, "GIFs") for the /lens/ setup guide on the Sawa English site.
   Real captures where a browser can show it (chrome://extensions on a computer and at phone size, the extension popup,
   the live /lens/ page), drawn Windows 11 / Android screens around them for what no browser can capture (File Explorer,
   the folder picker, the phone's menu, file picker and status bar). A mouse pointer or a finger walks through each click.
   Usage: node guidegifs.js <outDir>    → pc-download.webp, pc-extract.webp, pc-devmode.webp, pc-load.webp,
                                          an-download.webp, an-menu.webp, an-devmode.webp, an-zip.webp, an-signin.webp
   Silent: Chrome runs headless with --mute-audio; no video plays. Needs ffmpeg on PATH. */
'use strict';
const fs = require('fs'), path = require('path'), os = require('os'), { execFileSync, spawn } = require('child_process'), puppeteer = require('puppeteer');
const out = path.resolve(process.argv[2] || path.join(os.tmpdir(), 'lens-gifs'));
const ext = path.join(__dirname, '../extension');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'lens-gif-'));
const SITE = process.env.SITE || 'https://sawaenglish.com/lens/';
fs.mkdirSync(out, { recursive: true });
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const FPS = 12;

async function launch(port, extra) {
	const prof = path.join(tmp, 'prof-' + port);
	spawn(puppeteer.executablePath(), ['--user-data-dir=' + prof, '--no-first-run', '--no-default-browser-check', '--remote-debugging-port=' + port, '--headless=new', '--window-size=1280,800', '--mute-audio', '--lang=en-US', '--hide-scrollbars'].concat(extra || [], ['about:blank']), { detached: true, stdio: 'ignore' }).unref();
	for (let i = 0; i < 40; i++) { try { return await puppeteer.connect({ browserURL: 'http://127.0.0.1:' + port, defaultViewport: null }); } catch (e) { await wait(500); } }
	throw new Error('chrome did not start');
}
const PC = { width: 1280, height: 640, deviceScaleFactor: 1 };
const PHONE = { width: 392, height: 752, deviceScaleFactor: 2, isMobile: true, hasTouch: true };
const PHONE_UI = { width: 392, height: 752, deviceScaleFactor: 2 }; // chrome://extensions and the popup: no viewport tag, so no phone zoom-out
const MOBILE_UA = 'Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36';

/** A rect inside chrome://extensions: 'dev' = the Developer mode switch, else a selector in the toolbar's shadow root. */
const extRect = (p, sel) => p.evaluate((sel) => {
	const t = document.querySelector('extensions-manager').shadowRoot.querySelector('extensions-toolbar').shadowRoot;
	const el = sel === 'dev' ? t.querySelector('#devMode') : t.querySelector(sel);
	if (!el) return null;
	const r = el.getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width, h: r.height };
}, sel);
const devOn = (p) => p.evaluate(() => { document.querySelector('extensions-manager').shadowRoot.querySelector('extensions-toolbar').shadowRoot.querySelector('#devMode').click(); });
const light = (p) => p.emulateMediaFeatures([{ name: 'prefers-color-scheme', value: 'light' }]);
const png = async (p, name) => { const f = path.join(tmp, name + '.png'); await p.screenshot({ path: f }); return 'file:///' + f.replace(/\\/g, '/'); };

async function capture() {
	const C = {};
	// computer + phone, no extension yet: Developer mode off, then on
	let b = await launch(9441, []);
	let p = (await b.pages())[0]; await light(p);
	for (const [k, vp] of [['pc', PC], ['ph', PHONE_UI]]) {
		if (k === 'ph') await p.setUserAgent(MOBILE_UA);
		await p.setViewport(vp);
		await p.goto('chrome://extensions'); await wait(1200);
		C[k + 'Off'] = await png(p, k + '-off'); C[k + 'Dev'] = await extRect(p, 'dev');
		await devOn(p); await wait(900);
		C[k + 'On'] = await png(p, k + '-on');
		C[k + 'Load'] = await extRect(p, '#loadUnpacked'); C[k + 'Pack'] = await extRect(p, '#packExtensions');
		await devOn(p); await wait(400); // back off for the phone pass
	}
	// the live /lens/ page with its download button, computer and phone
	await p.setUserAgent(MOBILE_UA); await p.setViewport(PHONE);
	await p.goto(SITE + '#an-2', { waitUntil: 'networkidle2' }); await wait(1500);
	await p.evaluate(() => { const b = document.querySelector('#an-2 .btn-red'); b.scrollIntoView({ block: 'center' }); }); await wait(500);
	C.phSite = await png(p, 'ph-site'); C.phSiteBtn = await p.evaluate(() => { const r = document.querySelector('#an-2 .btn-red').getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width, h: r.height }; });
	await b.close();
	b = await launch(9442, []); p = (await b.pages())[0]; await light(p); await p.setViewport(PC);
	await p.goto(SITE + '#pc-1', { waitUntil: 'networkidle2' }); await wait(1500);
	await p.evaluate(() => { document.querySelector('#pc-1 .btn-red').scrollIntoView({ block: 'center' }); }); await wait(500);
	C.pcSite = await png(p, 'pc-site'); C.pcSiteBtn = await p.evaluate(() => { const r = document.querySelector('#pc-1 .btn-red').getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width, h: r.height }; });
	await b.close();
	// with the extension loaded: the card on chrome://extensions, and the popup (signed out)
	b = await launch(9443, ['--disable-extensions-except=' + ext, '--load-extension=' + ext]);
	p = (await b.pages())[0]; await light(p);
	for (const [k, vp] of [['pc', PC], ['ph', PHONE_UI]]) {
		if (k === 'ph') await p.setUserAgent(MOBILE_UA);
		await p.setViewport(vp);
		await p.goto('chrome://extensions'); await wait(1200);
		await devOn(p); await wait(900);
		await p.evaluate((v) => { const it = document.querySelector('extensions-manager').shadowRoot.querySelector('extensions-item-list').shadowRoot.querySelector('extensions-item'); const e = it.shadowRoot.querySelector('#version'); if (e && v) e.textContent = v; }, process.env.SHOW_VER || ''); // show the version students download
		C[k + 'Loaded'] = await png(p, k + '-loaded');
		C[k + 'Item'] = await p.evaluate(() => { const it = document.querySelector('extensions-manager').shadowRoot.querySelector('extensions-item-list').shadowRoot.querySelector('extensions-item'); const c = it.shadowRoot.querySelector('#card') || it; const r = c.getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width, h: r.height }; });
		await devOn(p); await wait(300);
	}
	const id = await p.evaluate(() => document.querySelector('extensions-manager').shadowRoot.querySelector('extensions-item-list').shadowRoot.querySelector('extensions-item').id);
	await p.goto('chrome-extension://' + id + '/popup/popup.html'); await wait(1500);
	C.phPopup = await png(p, 'ph-popup');
	C.phPopupBtn = await p.evaluate(() => { const el = [...document.querySelectorAll('button,a')].find((e) => /sign in/i.test(e.textContent) && e.getBoundingClientRect().width > 0); if (!el) return null; const r = el.getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width, h: r.height }; });
	await b.close();
	return C;
}

/* ---------- the stage: layers on a timeline, a pointer or finger, click ripples, red rings ---------- */
const STAGE_CSS = `
*{box-sizing:border-box}body{margin:0;background:#fff;font:14px/1.4 'Segoe UI',Roboto,Arial,sans-serif;color:#1f1f1f}
#st{position:relative;overflow:hidden}.ly{position:absolute;transition:none}
.cur{position:absolute;z-index:100;width:22px;height:30px;pointer-events:none}
.fin{position:absolute;z-index:100;width:46px;height:46px;margin:-23px 0 0 -23px;border-radius:50%;background:rgba(60,60,60,.32);border:2px solid rgba(255,255,255,.85);box-shadow:0 2px 8px rgba(0,0,0,.25)}
.rip{position:absolute;z-index:99;border-radius:50%;border:3px solid #E3262B;pointer-events:none}
.ring{position:absolute;z-index:98;border:4px solid #E3262B;border-radius:12px;box-shadow:0 0 0 4px rgba(227,38,43,.22)}
img.bg{display:block;width:100%;height:100%}
/* Windows 11 */
.wall{background:linear-gradient(135deg,#1d4f91,#5b8fd4 55%,#a9c7ee)}
.win{position:absolute;background:#f3f3f3;border-radius:8px;box-shadow:0 16px 48px rgba(0,0,0,.35);overflow:hidden;border:1px solid #c9c9c9}
.win .tb{height:40px;background:#e8e8e8;display:flex;align-items:center;padding:0 12px;gap:10px;font-size:13px}
.win .tb .tab{background:#f9f9f9;border-radius:8px 8px 0 0;padding:9px 14px;margin-top:6px;min-width:180px}
.win .tb .ctl{margin-left:auto;letter-spacing:22px;color:#333}
.win .cmd{height:46px;background:#f9f9f9;display:flex;align-items:center;gap:18px;padding:0 16px;border-bottom:1px solid #e5e5e5;color:#333}
.win .cmd b{font-weight:600}.win .cmd .ex{background:#e6eefb;border-radius:6px;padding:6px 10px;color:#003e92}
.win .addr{height:40px;display:flex;align-items:center;gap:10px;padding:0 12px;background:#f9f9f9;border-bottom:1px solid #e5e5e5}
.win .addr .pth{flex:1;background:#fff;border:1px solid #d5d5d5;border-radius:6px;padding:6px 10px}
.win .bd{display:flex;height:calc(100% - 126px);background:#fff}
.win .nav{width:190px;padding:10px 8px;border-right:1px solid #eee;background:#f9f9f9}.win .nav div{padding:7px 10px;border-radius:5px}.win .nav .on{background:#e5e5e5}
.win .list{flex:1;padding:8px 14px}.win .hd{display:flex;color:#666;font-size:12.5px;padding:6px 8px;border-bottom:1px solid #eee}
.row{display:flex;align-items:center;gap:10px;padding:7px 8px;border-radius:4px}.row .nm{flex:1}.row .ty{width:170px;color:#666}.row .sz{width:80px;color:#666;text-align:right}
.row.sel{background:#cce4f7}.zipi{width:20px;height:22px;background:linear-gradient(#f6c94c,#e5ad1f);border-radius:3px;position:relative}.zipi:after{content:'';position:absolute;left:8px;top:2px;width:4px;height:16px;background:repeating-linear-gradient(#7a5a00 0 2px,transparent 2px 4px)}
.fold{width:22px;height:18px;background:linear-gradient(#ffd96a,#f2b534);border-radius:2px 4px 3px 3px;position:relative}.fold:before{content:'';position:absolute;left:0;top:-4px;width:10px;height:5px;background:#f2b534;border-radius:2px 2px 0 0}
.ctx{position:absolute;z-index:20;width:300px;background:#f9f9f9;border:1px solid #d0d0d0;border-radius:8px;box-shadow:0 8px 24px rgba(0,0,0,.22);padding:6px}
.ctx .ic{display:flex;gap:20px;padding:6px 10px 10px;border-bottom:1px solid #e5e5e5;color:#444;font-size:16px}.ctx .it{padding:8px 12px;border-radius:5px}.ctx .it.hl{background:#e5e5e5}.ctx .sep{height:1px;background:#e5e5e5;margin:4px 0}
.dlg{position:absolute;z-index:30;background:#fff;border:1px solid #bbb;border-radius:8px;box-shadow:0 18px 50px rgba(0,0,0,.35);overflow:hidden}
.dlg .tt{background:#f3f3f3;padding:9px 14px;font-size:13px;display:flex}.dlg .tt span{margin-left:auto}
.dlg .in{padding:18px 24px}.dlg h4{margin:0 0 14px;font:400 19px 'Segoe UI';color:#1e3287}
.fld{border:1px solid #9a9a9a;border-radius:4px;padding:6px 8px;background:#fff}
.wbtn{display:inline-block;border:1px solid #bdbdbd;border-radius:4px;padding:6px 22px;background:#fdfdfd;margin-left:8px}.wbtn.pri{background:#005fb8;border-color:#005fb8;color:#fff}
.chk{display:inline-block;width:16px;height:16px;border-radius:3px;background:#005fb8;color:#fff;font-size:12px;line-height:16px;text-align:center;margin-right:8px}
.bar{height:6px;background:#e5e5e5;border-radius:3px;overflow:hidden}.bar i{display:block;height:100%;background:#06b025}
/* Chrome on a computer */
.chr{position:absolute;left:0;top:0;width:1280px;height:80px;background:#dfe3eb}
.chr .tabs{height:40px;display:flex;align-items:flex-end;padding-left:10px}.chr .tab{background:#fff;border-radius:10px 10px 0 0;padding:9px 16px;width:240px;font-size:13px}
.chr .omni{height:40px;background:#fff;display:flex;align-items:center;gap:14px;padding:0 14px;color:#5f6368}
.chr .url{flex:1;background:#eef1f6;border-radius:20px;padding:7px 16px;color:#1f1f1f}
.dlb{position:absolute;z-index:30;right:14px;top:74px;width:360px;background:#fff;border-radius:12px;box-shadow:0 8px 30px rgba(0,0,0,.25);padding:14px}
.dlb .r{display:flex;gap:12px;align-items:center;margin-top:10px}
/* Android phone */
.phw{position:absolute;left:8px;top:8px;width:404px;height:864px;border-radius:46px;background:#16171a;box-shadow:0 10px 30px rgba(0,0,0,.25)}
.scr{position:absolute;left:14px;top:14px;width:392px;height:852px;border-radius:40px;overflow:hidden;background:#fff}
.sb{position:absolute;left:0;top:0;width:392px;height:28px;display:flex;align-items:center;justify-content:space-between;padding:0 22px;font:600 13px Roboto,Arial;color:#1f1f1f;background:#fff;z-index:5}
.sb:after{content:'';position:absolute;left:186px;top:8px;width:12px;height:12px;border-radius:50%;background:#111}
.tbr{position:absolute;left:0;top:28px;width:392px;height:56px;display:flex;align-items:center;gap:10px;padding:0 10px;background:#fff;border-bottom:1px solid #e3e3e3;z-index:5;color:#444}
.tbr .u{flex:1;background:#f1f3f4;border-radius:22px;padding:9px 14px;font-size:14px;white-space:nowrap;overflow:hidden;color:#1f1f1f}
.tbr .tc{width:22px;height:22px;border:2px solid #444;border-radius:5px;font:700 11px/18px Roboto;text-align:center}
.tbr .dots{font-size:22px;padding:0 4px}
.gb{position:absolute;left:0;bottom:0;width:392px;height:16px;background:#fff;z-index:5}.gb:after{content:'';position:absolute;left:136px;top:6px;width:120px;height:4px;border-radius:2px;background:#1f1f1f}
.cnt{position:absolute;left:0;top:84px;width:392px;height:752px;overflow:hidden}
.amenu{position:absolute;z-index:20;right:8px;top:34px;width:250px;background:#fff;border-radius:16px;box-shadow:0 6px 24px rgba(0,0,0,.28);padding:6px 0;font:15px Roboto,Arial}
.amenu .ir{display:flex;justify-content:space-around;padding:8px 6px 12px;border-bottom:1px solid #eee;font-size:18px;color:#444}.amenu .mi{padding:12px 20px}.amenu .mi.hl{background:#e8f0fe}
.asheet{position:absolute;z-index:20;left:0;right:0;bottom:16px;background:#fff;border-radius:22px 22px 0 0;box-shadow:0 -4px 20px rgba(0,0,0,.2);padding:14px 18px 18px;font:15px Roboto}
.fp{position:absolute;inset:0;z-index:25;background:#fff;font:15px Roboto}.fp .h{height:56px;display:flex;align-items:center;gap:18px;padding:0 16px;font-size:19px;border-bottom:1px solid #eee}
.fp .chips{display:flex;gap:8px;padding:12px 16px}.fp .chips span{border:1px solid #c4c7c5;border-radius:8px;padding:6px 12px;font-size:13px}.fp .chips .on{background:#d3e3fd;border-color:#d3e3fd}
.fp .f{display:flex;align-items:center;gap:14px;padding:12px 18px}.fp .f small{display:block;color:#666;font-size:12.5px}.fp .f.sel{background:#e8f0fe}
.toast{position:absolute;z-index:22;left:12px;right:12px;bottom:28px;background:#2b2b2e;color:#fff;border-radius:10px;padding:14px 16px;display:flex;justify-content:space-between;font:14px Roboto}.toast b{color:#a8c7fa}
.cbtn{position:absolute;z-index:6;background:#fff;color:#0b57d0;border:1px solid #c4c7c5;border-radius:18px;font:500 13px Roboto;display:flex;align-items:center;justify-content:center;white-space:nowrap}
`;
const POINTER = '<svg viewBox="0 0 22 30" width="22" height="30"><path d="M2 2 L2 24 L8 18 L12 28 L16 26 L12 17 L20 17 Z" fill="#fff" stroke="#000" stroke-width="1.6" stroke-linejoin="round"/></svg>';

/* Runs inside the stage page: shows the frame at time t (ms). */
function renderAt(S, t) {
	const st = document.getElementById('st');
	S.layers.forEach((l, i) => { const el = document.getElementById('l' + i); const on = t >= (l.from || 0) && t < (l.to == null ? 1e9 : l.to); el.style.display = on ? 'block' : 'none'; if (on && l.fade) el.style.opacity = Math.min(1, (t - (l.from || 0)) / 200); });
	const k = S.path; let x = k[0][1], y = k[0][2];
	for (let i = 0; i < k.length - 1; i++) { if (t >= k[i][0] && t <= k[i + 1][0]) { const u = (t - k[i][0]) / Math.max(1, k[i + 1][0] - k[i][0]), e = u < .5 ? 2 * u * u : 1 - Math.pow(-2 * u + 2, 2) / 2; x = k[i][1] + (k[i + 1][1] - k[i][1]) * e; y = k[i][2] + (k[i + 1][2] - k[i][2]) * e; } }
	if (t > k[k.length - 1][0]) { x = k[k.length - 1][1]; y = k[k.length - 1][2]; }
	const c = document.getElementById('cur'); c.style.left = x + 'px'; c.style.top = y + 'px';
	st.querySelectorAll('.rip').forEach((r) => r.remove());
	(S.clicks || []).forEach((ck) => { const d = t - ck; if (d >= 0 && d < 450) { const r = document.createElement('div'); const s = 14 + d / 450 * 40; r.className = 'rip'; r.style.cssText = 'left:' + (x - s / 2) + 'px;top:' + (y - s / 2) + 'px;width:' + s + 'px;height:' + s + 'px;opacity:' + (1 - d / 450); st.appendChild(r); } });
	if (S.finger) c.style.transform = (S.clicks || []).some((ck) => t - ck >= 0 && t - ck < 180) ? 'scale(.82)' : 'none';
}

async function record(b, name, S) {
	const p = await b.newPage();
	await p.setViewport({ width: S.w, height: S.h, deviceScaleFactor: S.dsf || 1 });
	const layers = S.layers.map((l, i) => '<div class="ly" id="l' + i + '" style="' + (l.style || 'left:0;top:0;width:100%;height:100%') + '">' + l.html + '</div>').join('');
	const cur = S.finger ? '<div class="fin" id="cur"></div>' : '<div class="cur" id="cur">' + POINTER + '</div>';
	const html = '<!doctype html><meta charset="utf-8"><style>' + STAGE_CSS + '</style><div id="st" style="width:' + S.w + 'px;height:' + S.h + 'px">' + layers + cur + '</div><script>' + renderAt.toString() + '</script>';
	const f = path.join(tmp, name + '.html'); fs.writeFileSync(f, html);
	await p.goto('file:///' + f.replace(/\\/g, '/')); await wait(300);
	// measured targets: elements with data-id, rings with data-of, path points [t, 'id', dx, dy]
	const R = await p.evaluate((n) => { const m = {}; for (let i = 0; i < n; i++) { document.querySelectorAll('.ly').forEach((l, j) => { l.style.display = j === i ? 'block' : 'none'; }); document.getElementById('l' + i).querySelectorAll('[data-id]').forEach((e) => { const r = e.getBoundingClientRect(); m[e.dataset.id] = { x: r.left, y: r.top, w: r.width, h: r.height }; }); } return m; }, S.layers.length);
	await p.evaluate((R) => document.querySelectorAll('.ring[data-of]').forEach((e) => { const r = R[e.dataset.of], d = +(e.dataset.pad || 6); if (r) e.style.cssText = 'left:' + (r.x - d) + 'px;top:' + (r.y - d) + 'px;width:' + (r.w + 2 * d) + 'px;height:' + (r.h + 2 * d) + 'px'; }), R);
	S.path = S.path.map((k) => typeof k[1] === 'string' ? (R[k[1]] ? [k[0], R[k[1]].x + R[k[1]].w / 2 + (k[2] || 0), R[k[1]].y + R[k[1]].h / 2 + (k[3] || 0)] : (console.log('no target', name, k[1]), [k[0], S.w / 2, S.h / 2])) : k);
	const dir = path.join(tmp, name); fs.mkdirSync(dir, { recursive: true });
	const n = Math.ceil(S.dur / 1000 * FPS);
	for (let i = 0; i < n; i++) {
		await p.evaluate((S, t) => renderAt(S, t), { layers: S.layers.map((l) => ({ from: l.from, to: l.to, fade: l.fade })), path: S.path, clicks: S.clicks, finger: S.finger }, i * 1000 / FPS);
		await p.screenshot({ path: path.join(dir, String(i).padStart(4, '0') + '.png') });
	}
	await p.close();
	const dst = path.join(out, name + '.webp');
	execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-framerate', String(FPS), '-i', path.join(dir, '%04d.png'), '-vf', 'scale=' + S.outW + ':-1:flags=lanczos', '-c:v', 'libwebp', '-lossless', '0', '-q:v', '60', '-compression_level', '6', '-loop', '0', dst]);
	console.log(name, (fs.statSync(dst).size / 1024).toFixed(0) + ' KB', n + ' frames');
}

/* ---------- scene builders ---------- */
const img = (src) => '<img class="bg" src="' + src + '">';
const ring = (r, pad) => { pad = pad || 6; return '<div class="ring" style="left:' + (r.x - pad) + 'px;top:' + (r.y - pad) + 'px;width:' + (r.w + 2 * pad) + 'px;height:' + (r.h + 2 * pad) + 'px"></div>'; };
const RG = (id, pad) => '<div class="ring" data-of="' + id + '" data-pad="' + (pad || 6) + '"></div>';
const mid = (r, dx, dy) => [r.x + r.w / 2 + (dx || 0), r.y + r.h / 2 + (dy || 0)];
const chromeBar = (url, tab) => '<div class="chr"><div class="tabs"><div class="tab">' + tab + '</div></div><div class="omni"><span>←</span><span>→</span><span>⟳</span><div class="url">' + url + '</div><span>🧩</span><span>⬇</span><span>⋮</span></div></div>';
const shift = (r, dx, dy) => r && { x: r.x + dx, y: r.y + dy, w: r.w, h: r.h };

function explorer(rows, sel, cmdEx) {
	const rs = rows.map((r, i) => '<div class="row' + (i === sel ? ' sel' : '') + '" data-id="' + (r.zip ? 'zrow' : 'newf') + '"><span class="' + (r.zip ? 'zipi' : 'fold') + '"></span><span class="nm">' + r.n + '</span><span class="ty">' + (r.zip ? 'Compressed (zipped) Folder' : 'File folder') + '</span><span class="sz">' + (r.zip ? '7,812 KB' : '') + '</span></div>').join('');
	return '<div class="win" style="left:120px;top:60px;width:1040px;height:600px"><div class="tb"><span class="tab">📁 Downloads</span><span class="ctl">–▢✕</span></div>'
		+ '<div class="cmd"><b>⊕ New</b><span>✂</span><span>⧉</span><span>⎘</span><span>🗑</span><span>⇅ Sort</span><span>☰ View</span>' + (cmdEx ? '<span class="ex">🗜 Extract all</span>' : '') + '</div>'
		+ '<div class="addr"><span>←</span><span>→</span><span>↑</span><span class="pth">›  This PC  ›  Downloads</span><span class="fld" style="width:220px;color:#888">Search Downloads</span></div>'
		+ '<div class="bd"><div class="nav"><div>🏠 Home</div><div>🖼 Gallery</div><div>🖥 Desktop</div><div class="on">⬇ Downloads</div><div>📄 Documents</div><div>🖼 Pictures</div><div>💻 This PC</div></div>'
		+ '<div class="list"><div class="hd"><span style="flex:1">Name</span><span style="width:170px">Type</span><span style="width:80px;text-align:right">Size</span></div><div style="color:#666;font-size:12.5px;padding:8px">Today</div>' + rs + '</div></div></div>';
}
function phone(url, content, extra) {
	return '<div class="phw"></div><div class="scr"><div class="sb"><span>9:41</span><span>▾ ▴ 🔋</span></div><div class="tbr"><span>⌂</span><div class="u">🔒 ' + url + '</div><span class="tc">1</span><span class="dots">⋮</span></div><div class="cnt">' + content + '</div>' + (extra || '') + '<div class="gb"></div></div>';
}
const SCR = { x: 14, y: 14 }, CNT = { x: 14, y: 98 }; // phone screen and page-content origins on the stage
const inPh = (r) => shift(r, CNT.x, CNT.y);

function scenes(C) {
	const S = {};
	const D = { w: 1280, h: 720, outW: 960 };
	const P = { w: 420, h: 880, dsf: 1.5, outW: 450, finger: true };

	// 1. Download on a computer: click the button on /lens, the download bubble says Done
	const btn = shift(C.pcSiteBtn, 0, 80);
	S['pc-download'] = Object.assign({}, D, { dur: 6000, layers: [
		{ html: chromeBar('sawaenglish.com/lens', 'Language Lens · Sawa English') + '<div style="position:absolute;left:0;top:80px;width:1280px;height:640px">' + img(C.pcSite) + '</div>' },
		{ from: 1700, html: '<div class="dlb"><b>Recent download history</b><div class="r"><span class="zipi"></span><div>language-lens-chrome.zip<br><small style="color:#5f6368">7.6 MB • Done</small></div></div></div>', fade: true },
		{ from: 1700, html: ring({ x: 1180, y: 46, w: 26, h: 26 }) },
	], path: [[0, 900, 600], [1200, ...mid(btn)], [1900, ...mid(btn)], [3200, 1190, 70], [6000, 1190, 70]], clicks: [1300] });

	// 2. Extract the zip in File Explorer: right-click → Extract All… → Extract → the folder appears
	const zipRow = { x: 344, y: 284, w: 780, h: 34 };
	const rows0 = [{ n: 'language-lens-chrome.zip', zip: 1 }], rows1 = [{ n: 'language-lens-chrome', zip: 0 }, { n: 'language-lens-chrome.zip', zip: 1 }];
	S['pc-extract'] = Object.assign({}, D, { dur: 10500, layers: [
		{ html: '<div class="wall" style="position:absolute;inset:0"></div>' },
		{ to: 1100, html: explorer(rows0, -1) },
		{ from: 1100, to: 7600, html: explorer(rows0, 0, true) },
		{ from: 1500, to: 3300, html: '<div class="ctx" style="left:560px;top:300px"><div class="ic">✂ ⧉ ✎ ↗ 🗑</div><div class="it">Open</div><div class="it">Open with</div><div class="it hl" data-id="xa">🗜 Extract All…</div><div class="it">Add to Favorites</div><div class="it">Compress to…</div><div class="it">Copy as path</div><div class="sep"></div><div class="it">Properties</div><div class="it">Show more options</div></div>' },
		{ from: 2400, to: 3300, html: RG('xa', 3) },
		{ from: 3300, to: 6800, html: '<div class="dlg" style="left:330px;top:150px;width:620px;height:420px"><div class="tt">🗜 Extract Compressed (Zipped) Folders<span>✕</span></div><div class="in"><h4>Select a Destination and Extract Files</h4><div>Files will be extracted to this folder:</div><div style="display:flex;margin:8px 0 14px"><div class="fld" style="flex:1">C:\\Users\\You\\Downloads\\language-lens-chrome</div><span class="wbtn">Browse…</span></div><div><span class="chk">✓</span>Show extracted files when complete</div><div style="position:absolute;right:24px;bottom:22px"><span class="wbtn pri" data-id="xb">Extract</span><span class="wbtn">Cancel</span></div></div></div>', fade: true },
		{ from: 4400, to: 5300, html: RG('xb', 4) },
		{ from: 5400, to: 7600, html: '<div class="dlg" style="left:400px;top:250px;width:480px;height:150px"><div class="tt">Copying 42 items<span>✕</span></div><div class="in">Extracting to <b>language-lens-chrome</b><div class="bar" style="margin-top:16px"><i style="width:70%"></i></div></div></div>' },
		{ from: 7600, html: explorer(rows1, 0) },
		{ from: 8000, html: RG('newf', 3) },
	], path: [[0, 700, 560], [1000, 'zrow', -200], [1500, 'zrow', -200], [2300, 'xa', 20], [3000, 'xa', 20], [4400, 'xb'], [5200, 'xb'], [7800, 'newf', -250], [10500, 'newf', -250]], clicks: [1100, 1500, 3000, 5000] });
	S['pc-extract'].rightClick = 1500;

	// 3. Developer mode on (real chrome://extensions)
	const dev = shift(C.pcDev, 0, 80), load = shift(C.pcLoad, 0, 80);
	S['pc-devmode'] = Object.assign({}, D, { dur: 5500, layers: [
		{ html: chromeBar('chrome://extensions', 'Extensions') },
		{ to: 2000, style: 'left:0;top:80px;width:1280px;height:640px', html: img(C.pcOff) },
		{ from: 2000, style: 'left:0;top:80px;width:1280px;height:640px', html: img(C.pcOn) },
		{ to: 2000, html: ring(dev) },
		{ from: 2400, html: ring(load) },
	], path: [[0, 640, 420], [1400, ...mid(dev)], [2400, ...mid(dev)], [3600, ...mid(load)], [5500, ...mid(load)]], clicks: [1900] });

	// 4. Load unpacked → pick the extracted folder → the Language Lens card
	const picker = '<div class="dlg" style="left:250px;top:120px;width:780px;height:500px"><div class="tt">Select the extension directory<span>✕</span></div>'
		+ '<div class="addr" style="display:flex;gap:10px;padding:8px 12px;border-bottom:1px solid #eee"><span>← → ↑</span><span class="fld" style="flex:1">›  This PC  ›  Downloads</span></div>'
		+ '<div style="display:flex;height:350px"><div class="nav" style="width:170px;padding:10px;background:#f9f9f9;line-height:2.2">🏠 Home<br>🖥 Desktop<br><b>⬇ Downloads</b><br>📄 Documents<br>💻 This PC</div>'
		+ '<div style="flex:1;padding:10px 14px"><div class="row" data-id="pf"><span class="fold"></span><span class="nm">language-lens-chrome</span><span class="ty">File folder</span></div><div class="row" style="color:#aaa"><span class="zipi" style="opacity:.4"></span><span class="nm">language-lens-chrome.zip</span><span class="ty">Compressed (zipped) Folder</span></div></div></div>'
		+ '<div style="display:flex;align-items:center;gap:10px;padding:10px 16px;border-top:1px solid #eee"><span>Folder:</span><span class="fld" style="flex:1">%F%</span><span class="wbtn pri" data-id="sf">Select Folder</span><span class="wbtn">Cancel</span></div></div>';
	const folderRow = { x: 434, y: 216, w: 580, h: 34 }, selBtn = { x: 820, y: 584, w: 110, h: 30 };
	S['pc-load'] = Object.assign({}, D, { dur: 9500, layers: [
		{ html: chromeBar('chrome://extensions', 'Extensions') },
		{ to: 6400, style: 'left:0;top:80px;width:1280px;height:640px', html: img(C.pcOn) },
		{ to: 1600, html: ring(load) },
		{ from: 1800, to: 3600, html: picker.replace('%F%', ''), fade: true },
		{ from: 3600, to: 6200, html: picker.replace('%F%', 'language-lens-chrome').replace('data-id="pf"', 'data-id="pf" style="background:#cce4f7"') },
		{ from: 4600, to: 6200, html: RG('sf', 4) },
		{ from: 6400, style: 'left:0;top:80px;width:1280px;height:640px', html: img(C.pcLoaded) },
		{ from: 6900, html: ring(shift(C.pcItem, 0, 80), 4) },
	], path: [[0, 640, 420], [1000, ...mid(load)], [1600, ...mid(load)], [3200, 'pf', -150], [3700, 'pf', -150], [5200, 'sf'], [6400, 'sf'], [7400, 700, 520], [9500, 700, 520]], clicks: [1500, 3500, 6000] });

	// ---- Android (Lemur) ----
	const pb = inPh(C.phSiteBtn);
	S['an-download'] = Object.assign({}, P, { dur: 6000, layers: [
		{ html: phone('sawaenglish.com/lens', img(C.phSite)) },
		{ from: 1800, html: '<div class="scr" style="background:none;pointer-events:none"><div class="toast"><span>language-lens-chrome.zip<br><small style="color:#bbb">Download complete · 7.6 MB</small></span><b>Open</b></div></div>', fade: true },
		{ to: 1500, html: ring(pb) },
	], path: [[0, 300, 760], [1100, ...mid(pb)], [6000, ...mid(pb)]], clicks: [1400] });

	const menu = '<div class="amenu"><div class="ir">→ ☆ ⬇ ⓘ ⟳</div><div class="mi">New tab</div><div class="mi">New Incognito tab</div><div class="mi">History</div><div class="mi">Downloads</div><div class="mi">Bookmarks</div><div class="mi">Recent tabs</div><div class="mi hl" data-id="mext">🧩 Extensions</div><div class="mi">Share…</div><div class="mi">Find in page</div><div class="mi">Desktop site ☐</div><div class="mi">Settings</div></div>';
	const dots = { x: 14 + 354, y: 14 + 28 + 14, w: 26, h: 28 }, extItem = { x: 14 + 142, y: 14 + 34 + 6 + 46 + 6 * 46, w: 250, h: 44 };
	S['an-menu'] = Object.assign({}, P, { dur: 6500, layers: [
		{ to: 3300, html: phone('sawaenglish.com/lens', img(C.phSite)) },
		{ to: 1200, html: ring(dots, 4) },
		{ from: 1300, to: 3300, html: '<div class="scr" style="background:none">' + menu + '</div>', fade: true },
		{ from: 2000, to: 3300, html: RG('mext', 2) },
		{ from: 3300, html: phone('chrome://extensions', img(C.phOff)) },
	], path: [[0, 220, 600], [900, ...mid(dots)], [1300, ...mid(dots)], [2600, 'mext', -40], [6500, 'mext', -40]], clicks: [1200, 3000] });

	const pdev = inPh(C.phDev), pload = inPh(C.phLoad), ppack = inPh(C.phPack);
	const zipBtn = ppack && '<div class="cbtn" style="left:' + ppack.x + 'px;top:' + ppack.y + 'px;width:' + Math.max(ppack.w, 210) + 'px;height:' + ppack.h + 'px">+ (from .zip/.crx/.user.js)</div>';
	const zipR = ppack && { x: ppack.x, y: ppack.y, w: Math.max(ppack.w, 210), h: ppack.h };
	S['an-devmode'] = Object.assign({}, P, { dur: 5000, layers: [
		{ to: 1800, html: phone('chrome://extensions', img(C.phOff)) },
		{ from: 1800, html: phone('chrome://extensions', img(C.phOn)) + (zipBtn || '') },
		{ to: 1700, html: ring(pdev) },
		{ from: 2200, html: zipR ? ring(zipR) : '' },
	], path: [[0, 200, 560], [1100, ...mid(pdev)], [5000, ...mid(pdev)]], clicks: [1600] });

	const fpick = '<div class="scr" style="background:none"><div class="fp"><div class="h">☰ <span>Downloads</span><span style="margin-left:auto">🔍 ⋮</span></div><div class="chips"><span class="on">Downloads</span><span>Images</span><span>Documents</span></div><div style="padding:6px 18px;color:#666;font-size:13px">Today</div><div class="f %S%" data-id="fz"><span class="zipi"></span><div>language-lens-chrome.zip<small>7.6 MB · 9:40 AM</small></div></div><div class="f"><span>🖼</span><div>Screenshot_20261024.png<small>1.2 MB · Yesterday</small></div></div></div></div>';
	const fileRow = { x: 14, y: 14 + 56 + 50 + 30, w: 392, h: 58 };
	S['an-zip'] = Object.assign({}, P, { dur: 7500, layers: [
		{ to: 1800, html: phone('chrome://extensions', img(C.phOn)) + (zipBtn || '') },
		{ to: 1500, html: zipR ? ring(zipR) : '' },
		{ from: 1800, to: 3600, html: fpick.replace('%S%', ''), fade: true },
		{ from: 3600, to: 4400, html: fpick.replace('%S%', 'sel') },
		{ from: 4400, html: phone('chrome://extensions', img(C.phLoaded)) + (zipBtn || '') },
		{ from: 4800, html: ring(inPh(C.phItem), 4) },
	], path: [[0, 220, 640], [1000, ...(zipR ? mid(zipR) : [200, 300])], [1700, ...(zipR ? mid(zipR) : [200, 300])], [3000, 'fz', -60], [7500, 'fz', -60]], clicks: [1500, 3400] });

	const sbtn = C.phPopupBtn ? inPh(C.phPopupBtn) : { x: 60, y: 400, w: 280, h: 44 };
	S['an-signin'] = Object.assign({}, P, { dur: 6500, layers: [
		{ to: 2900, html: phone('chrome://extensions', img(C.phLoaded)) + (zipBtn || '') },
		{ to: 1300, html: ring(dots, 4) },
		{ from: 1300, to: 2900, html: '<div class="scr" style="background:none">' + menu.replace('<div class="mi">Settings</div>', '<div class="mi">Settings</div><div class="mi hl" data-id="mll" style="border-top:1px solid #eee">🔍 Language Lens</div>').replace('mi hl" data-id="mext">🧩 Extensions', 'mi">🧩 Extensions') + '</div>', fade: true },
		{ from: 2900, html: phone('Language Lens', img(C.phPopup)) },
		{ from: 3400, html: ring(sbtn) },
	], path: [[0, 220, 600], [900, ...mid(dots)], [1300, ...mid(dots)], [2400, 'mll', -40], [3600, ...mid(sbtn)], [6500, ...mid(sbtn)]], clicks: [1200, 2700, 4300] });
	return S;
}

(async () => {
	const only = process.env.ONLY ? process.env.ONLY.split(',') : null;
	const C = await capture();
	fs.writeFileSync(path.join(tmp, 'captures.json'), JSON.stringify(C, null, 1));
	const b = await launch(9449, ['--allow-file-access-from-files']);
	const S = scenes(C);
	for (const [name, sc] of Object.entries(S)) if (!only || only.includes(name)) await record(b, name, sc);
	await b.close();
	console.log('done →', out, '(frames in', tmp + ')');
})().catch((e) => { console.error(e); process.exit(1); });
