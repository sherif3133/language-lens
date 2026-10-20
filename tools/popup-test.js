/* Opens the popup with a signed-in test token and prints its text and any errors. node popup-test.js <server> <token> <png> */
'use strict';
const fs = require('fs'), path = require('path'), os = require('os'), puppeteer = require('puppeteer');
const [server, token, png] = process.argv.slice(2);
const src = path.join(__dirname, '../extension'), test = path.join(os.tmpdir(), 'lens-ext-popup');
fs.rmSync(test, { recursive: true, force: true });
fs.cpSync(src, test, { recursive: true });
const man = JSON.parse(fs.readFileSync(path.join(test, 'manifest.json')));
man.host_permissions.push(server.replace(/:\d+$/, '') + '/*');
fs.writeFileSync(path.join(test, 'manifest.json'), JSON.stringify(man));
(async () => {
	const b = await puppeteer.launch({ headless: true, args: ['--disable-extensions-except=' + test, '--load-extension=' + test] });
	const t = await b.waitForTarget((x) => x.type() === 'service_worker');
	const sw = await t.worker();
	await sw.evaluate((s, k) => chrome.storage.local.set({ server: s, token: k, level: 3 }), server, token);
	const p = await b.newPage();
	p.on('pageerror', (e) => console.log('pageerror', String(e)));
	p.on('console', (m) => console.log('console', m.type(), m.text()));
	await p.setViewport({ width: 340, height: 900 });
	await p.goto('chrome-extension://' + new URL(t.url()).host + '/popup/popup.html');
	await new Promise((r) => setTimeout(r, 6000));
	console.log((await p.evaluate(() => document.body.innerText)).replace(/\s+/g, ' '));
	await p.setViewport({ width: 340, height: 1100 }); await new Promise((r) => setTimeout(r, 500)); await p.screenshot({ path: png });
	await b.close();
})();
