/* Sign-in checks for background.js with a stubbed chrome API (no browser): node tools/login-test.js
   A stuck sign-in window ("Only one web auth flow is allowed at a time") falls back to a sign-in tab; closing the window
   is not an error loop; two clicks start one sign-in; one odd 401 doesn't sign the learner out. */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

function load(opts) {
	const store = { server: 'https://sawaenglish.com', token: opts.token || '' };
	const tabs = [];
	let flows = 0;
	const noop = () => {};
	const deep = () => new Proxy(noop, { get: (t, k) => (k === 'then' ? undefined : deep()), apply: () => deep() });
	const chrome = new Proxy({
		storage: {
			local: {
				get: (keys, cb) => { const ks = keys == null ? Object.keys(store) : [].concat(typeof keys === 'object' && !Array.isArray(keys) ? Object.keys(keys) : keys); const o = {}; ks.forEach((k) => { if (k in store) o[k] = store[k]; }); if (cb) cb(o); return Promise.resolve(o); },
				set: (o, cb) => { Object.assign(store, o); if (cb) cb(); return Promise.resolve(); },
				remove: (k, cb) => { [].concat(k).forEach((x) => delete store[x]); if (cb) cb(); return Promise.resolve(); }
			},
			onChanged: { addListener: noop }
		},
		identity: {
			getRedirectURL: () => 'https://abc.chromiumapp.org/lens',
			launchWebAuthFlow: () => { flows++; return opts.flow(); }
		},
		tabs: { create: (o) => { tabs.push(o.url); return Promise.resolve({ id: 1 }); } }
	}, { get: (t, k) => (k in t ? t[k] : deep()) });
	const ctx = {
		chrome, console, URL, URLSearchParams, setTimeout, clearTimeout, crypto: { randomUUID: () => 'state-1' },
		navigator: { userAgent: 'Mozilla/5.0 (Windows NT 10.0) Chrome/130' },
		fetch: opts.fetch || (() => Promise.resolve({ status: 200, ok: true, json: () => Promise.resolve({}) })),
		self: {}, importScripts: undefined
	};
	ctx.self = ctx;
	ctx.structuredClone = (v) => (v === undefined ? v : JSON.parse(JSON.stringify(v)));
	vm.createContext(ctx);
	vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'extension', 'background.js'), 'utf8'), ctx);
	return { ctx, store, tabs, flows: () => flows };
}

let fail = 0;
const ok = (c, m) => { console.log((c ? 'ok   ' : 'FAIL ') + m); if (!c) fail++; };

(async () => {
	// 1. Stuck window → a sign-in tab instead of an error.
	let t = load({ flow: () => Promise.reject(new Error('Only one web auth flow is allowed at a time.')) });
	let r = await t.ctx.login();
	ok(r && r.pending && t.tabs.length === 1 && /sawa_lens=connect/.test(t.tabs[0]) && /sawa_lens%3Dconnected/.test(t.tabs[0]), '"Only one web auth flow" → sign-in tab');
	ok(t.store.pendingLogin && t.store.pendingLogin.state === 'state-1', 'the tab sign-in is expected (pendingLogin)');

	// 2. The learner closed the window: a friendly message, no tab.
	t = load({ flow: () => Promise.reject(new Error('The user did not approve access.')) });
	r = await t.ctx.login().catch((e) => e);
	ok(r && /closed/.test(r.message) && !t.tabs.length, 'closing the window: "Sign-in was closed", no tab');

	// 3. Double click: one sign-in.
	let release;
	t = load({ flow: () => new Promise((res) => { release = res; }) });
	const a = t.ctx.login(), b = t.ctx.login();
	await new Promise((res) => setTimeout(res, 20));
	ok(a === b && t.flows() === 1, 'two clicks start one sign-in window');
	release(undefined);
	r = await a;
	ok(r && r.pending, 'an empty answer from the window → sign-in tab');

	// 4. One odd 401: the token stays; a real 401 (also on /me) signs out.
	let calls = 0;
	t = load({ token: 'a'.repeat(64), flow: () => Promise.reject(new Error('x')), fetch: (url) => { calls++; return Promise.resolve(/\/me$/.test(url) ? { status: 200, ok: true, json: () => Promise.resolve({}) } : { status: 401, ok: false, json: () => Promise.resolve({}) }); } });
	r = await t.ctx.api('/sync', {}).catch((e) => e);
	ok(t.store.token === 'a'.repeat(64) && /Connection/.test(r.message), 'a 401 that /me doesn\'t confirm keeps the sign-in');
	t = load({ token: 'b'.repeat(64), flow: () => Promise.reject(new Error('x')), fetch: () => Promise.resolve({ status: 401, ok: false, json: () => Promise.resolve({}) }) });
	r = await t.ctx.api('/sync', {}).catch((e) => e);
	ok(t.store.token === '' && r.message === 'signed_out', 'a real 401 signs out');

	console.log(fail ? fail + ' FAILED' : 'all passed');
	process.exit(fail ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
