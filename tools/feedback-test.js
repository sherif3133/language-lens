/* Checks the "Send feedback" box in the popup: signed out and signed in, in English and Arabic, on a computer and a phone-sized screen.
   A tiny local server stands in for sawaenglish.com. Usage: node feedback-test.js */
'use strict';
const fs = require('fs'), path = require('path'), os = require('os'), http = require('http'), puppeteer = require('puppeteer');
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
let fails = 0;
const check = (name, ok, info) => { if (!ok) fails++; console.log(ok ? '✓' : '✗', name, info == null ? '' : info); };

(async () => {
	const got = [];
	const srv = http.createServer((req, res) => {
		let body = '';
		req.on('data', (d) => (body += d));
		req.on('end', () => {
			res.setHeader('Content-Type', 'application/json');
			res.setHeader('Access-Control-Allow-Origin', '*');
			if (req.url.includes('/feedback')) { got.push({ auth: req.headers.authorization || '', body: JSON.parse(body || '{}') }); return res.end('{"ok":true}'); }
			if (req.url.includes('/me')) return res.end(JSON.stringify({ firstName: 'Test', progress: {}, plan: { tier: 'member', features: [] } }));
			res.statusCode = 404; res.end('{}');
		});
	}).listen(0);
	const server = 'http://localhost:' + srv.address().port;
	const test = path.join(os.tmpdir(), 'lens-ext-feedback');
	fs.rmSync(test, { recursive: true, force: true });
	fs.cpSync(path.join(__dirname, '../extension'), test, { recursive: true });
	const man = JSON.parse(fs.readFileSync(path.join(test, 'manifest.json')));
	man.host_permissions.push('http://localhost/*');
	fs.writeFileSync(path.join(test, 'manifest.json'), JSON.stringify(man));
	const b = await puppeteer.launch({ headless: true, args: ['--disable-extensions-except=' + test, '--load-extension=' + test] });
	const t = await b.waitForTarget((x) => x.type() === 'service_worker');
	const sw = await t.worker();
	const url = 'chrome-extension://' + new URL(t.url()).host + '/popup/popup.html';
	const errors = [];

	async function run(label, store, o) {
		await sw.evaluate((s) => chrome.storage.local.clear().then(() => chrome.storage.local.set(s)), Object.assign({ server }, store));
		const p = await b.newPage();
		p.on('pageerror', (e) => errors.push(String(e)));
		await p.setViewport(o.phone ? { width: 360, height: 700, hasTouch: true, isMobile: true } : { width: 350, height: 900 });
		await p.goto(url);
		await p.waitForSelector('#fb', { timeout: 8000 }).catch(async (e) => { console.log((await p.evaluate(() => document.body.innerText)).slice(0, 300), errors); throw e; });
		await p.click('#fb');
		await p.waitForSelector('.fb textarea');
		const ui = await p.evaluate(() => ({ title: document.querySelector('.fb h3').textContent, types: [...document.querySelectorAll('.ty button')].map((x) => x.textContent), email: !!document.querySelector('.em'), page: !!document.querySelector('.pg'), h: Math.min(...[...document.querySelectorAll('.ty button,.send')].map((x) => x.getBoundingClientRect().height)) }));
		check(label + ': four types', ui.types.length === 4, ui.types.join(' '));
		check(label + ': title', o.ar ? /ابعت/.test(ui.title) : /Send feedback/.test(ui.title), ui.title);
		check(label + ': email box only when signed out', ui.email === !store.token);
		check(label + ': tap targets 44px+', ui.h >= 44, ui.h);
		// too short is refused
		await p.click('.send');
		check(label + ': short note refused', (await p.$eval('.st', (x) => x.textContent)).length > 0);
		await p.click('.ty button[data-t="bug"]');
		check(label + ': no page-address box on an extension page', !ui.page);
		await p.type('textarea', 'The word card hides the caption');
		if (!store.token) await p.type('.em', 'sara@example.com');
		const n = got.length;
		await p.click('.send');
		await p.waitForSelector('.done', { timeout: 5000 }).catch(async () => { console.log('status:', await p.$eval('.st', (x) => x.textContent)); });
		const g = got[n];
		check(label + ': saved', !!g);
		if (g) {
			check(label + ': type, text, version, device', g.body.type === 'bug' && /hides the caption/.test(g.body.text) && g.body.version === man.version && (o.phone || g.body.device === 'computer'), JSON.stringify(g.body));
			check(label + ': email only when signed out', store.token ? !g.body.email : g.body.email === 'sara@example.com');
			check(label + ': token sent when signed in', store.token ? /Bearer/.test(g.auth) : !g.auth);
		}
		await p.click('.done');
		await p.waitForSelector('#login, .links', { timeout: 8000 });
		check(label + ': back to the popup', true);
		await p.close();
	}
	await run('signed out', {}, {});
	await run('signed in', { token: 'a'.repeat(64) }, {});
	await run('Arabic', { glossLang: 'ar' }, { ar: true });
	await run('phone', { token: 'a'.repeat(64) }, { phone: true });
	check('no page errors', !errors.length, errors.join(' | '));
	await b.close(); srv.close();
	console.log(fails ? fails + ' check(s) failed' : 'all good');
	process.exit(fails ? 1 : 0);
})();
