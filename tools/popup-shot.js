/* Renders the popup offline with a fake signed-in account (no server needed), on a computer and as a phone.
   node popup-shot.js <out-dir> [open-more] */
'use strict';
const fs = require('fs'), path = require('path'), os = require('os'), puppeteer = require('puppeteer');
const out = process.argv[2] || os.tmpdir(), openMore = process.argv[3] === 'open-more';
const src = path.join(__dirname, '../extension'), test = path.join(os.tmpdir(), 'lens-ext-popshot');
fs.rmSync(test, { recursive: true, force: true });
fs.cpSync(src, test, { recursive: true });
(async () => {
	const b = await puppeteer.launch({ headless: true, args: ['--disable-extensions-except=' + test, '--load-extension=' + test] });
	const t = await b.waitForTarget((x) => x.type() === 'service_worker');
	const sw = await t.worker();
	await sw.evaluate((m) => chrome.storage.local.set({ server: 'http://127.0.0.1:9', token: 'x'.repeat(64), me: { firstName: 'Test' }, level: 3, popupMore: m }), openMore);
	for (const phone of [false, true]) {
		const p = await b.newPage();
		p.on('pageerror', (e) => console.log('pageerror', String(e)));
		if (phone) await p.emulate({ viewport: { width: 380, height: 800, isMobile: true, hasTouch: true }, userAgent: 'Mozilla/5.0 (Android 14; Mobile; rv:130.0) Gecko/130.0 Firefox/130.0' });
		else await p.setViewport({ width: 360, height: 800 });
		await p.goto('chrome-extension://' + new URL(t.url()).host + '/popup/popup.html');
		await new Promise((r) => setTimeout(r, 2500));
		console.log((phone ? 'PHONE: ' : 'COMPUTER: ') + (await p.evaluate(() => document.body.innerText)).replace(/\s+/g, ' '));
		await p.screenshot({ path: path.join(out, 'popup-' + (phone ? 'phone' : 'computer') + '.png'), fullPage: true });
		await p.close();
	}
	await b.close();
})();
