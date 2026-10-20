/* Language Lens: service worker.
   Owns the word list, the learner's marks, saved sentences, sign-in and sync with sawaenglish.com. */
'use strict';
importScripts('core/lens-core.js');

const DEFAULT_SERVER = 'https://sawaenglish.com';
let lens = null;
let lensLoading = null;
let syncTimer = null;

/* ------------------------------------------------------------ storage */

const DEFAULTS = {
	server: DEFAULT_SERVER,
	token: '',
	me: null,
	level: 2,
	words: {}, // lemma -> 'known' | 'learning'
	wordTs: {}, // lemma -> ms of last change
	sentences: {}, // uuid -> sentence
	pending: { words: {}, sentences: {} },
	cursor: 0,
	sites: [], // origins where the learner switched Lens on
	pauseOnHover: true,
	progress: null,
	local: { day: '', words: 0, sentences: 0 }
};

async function get(keys) {
	const v = await chrome.storage.local.get(keys);
	const out = {};
	for (const k of [].concat(keys)) out[k] = v[k] === undefined ? structuredClone(DEFAULTS[k]) : v[k];
	return out;
}
const set = (o) => chrome.storage.local.set(o);

function today() {
	const d = new Date();
	return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}

async function bumpLocal(kind, n) {
	const { local } = await get('local');
	const t = today();
	const l = local.day === t ? local : { day: t, words: 0, sentences: 0 };
	l[kind] = Math.max(0, l[kind] + n);
	await set({ local: l });
}

/* ------------------------------------------------------------ word list */

function loadLens() {
	if (lens) return Promise.resolve(lens);
	if (!lensLoading) {
		lensLoading = fetch(chrome.runtime.getURL('data/lexicon.json'))
			.then((r) => r.json())
			.then((lex) => (lens = new self.Lens(lex)));
	}
	return lensLoading;
}

async function userState() {
	const { level, words } = await get(['level', 'words']);
	return { level, words };
}

/* ------------------------------------------------------------ server */

async function api(path, body, method) {
	const { server, token } = await get(['server', 'token']);
	if (!token) throw new Error('signed_out');
	const res = await fetch(server + '/wp-json/sawa-lens/v1' + path, {
		method: method || (body ? 'POST' : 'GET'),
		headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token, 'X-Sawa-Token': token },
		body: body ? JSON.stringify(body) : undefined
	});
	const j = await res.json().catch(() => ({}));
	if (res.status === 401) {
		await set({ token: '', me: null });
		throw new Error('signed_out');
	}
	if (!res.ok) throw new Error(j.message || 'حدثت مشكلة في الاتصال.');
	return j;
}

async function login() {
	const { server } = await get('server');
	const state = crypto.randomUUID();
	const redirect = chrome.identity.getRedirectURL('lens');
	const url = server + '/?sawa_lens=connect&redirect_uri=' + encodeURIComponent(redirect) + '&state=' + state;
	const back = await chrome.identity.launchWebAuthFlow({ url, interactive: true });
	const hash = new URLSearchParams(new URL(back).hash.slice(1));
	if (hash.get('state') !== state || !/^[a-f0-9]{64}$/.test(hash.get('token') || '')) throw new Error('لم يكتمل الدخول. حاول مرة أخرى.');
	await set({ token: hash.get('token'), cursor: 0 });
	const me = await api('/me');
	const patch = { me, progress: me.progress };
	if (me.progress && me.progress.level) patch.level = me.progress.level;
	await set(patch);
	await sync();
	return me;
}

async function logout() {
	try {
		await api('/logout', {});
	} catch (e) {
		/* already gone */
	}
	await set({ token: '', me: null, progress: null });
}

/* ------------------------------------------------------------ sync */

function scheduleSync(ms) {
	clearTimeout(syncTimer);
	syncTimer = setTimeout(() => sync().catch(() => {}), ms || 4000);
}

async function sync() {
	const s = await get(['token', 'pending', 'cursor', 'level', 'words', 'wordTs', 'sentences']);
	if (!s.token) return null;
	const pushWords = Object.keys(s.pending.words).map((lemma) => Object.assign({ lemma }, s.pending.words[lemma]));
	const pushSent = Object.values(s.pending.sentences);
	const res = await api('/sync', { since: s.cursor, level: s.level, words: pushWords, sentences: pushSent });
	// Apply the server's changes unless this device has an even newer local change.
	const fresh = await get(['pending', 'words', 'wordTs', 'sentences']);
	for (const w of res.words) {
		const mine = fresh.pending.words[w.lemma];
		if (mine && mine.t > w.t) continue;
		if (w.status) fresh.words[w.lemma] = w.status;
		else delete fresh.words[w.lemma];
		fresh.wordTs[w.lemma] = w.t;
	}
	for (const x of res.sentences) {
		const mine = fresh.pending.sentences[x.uuid];
		if (mine && mine.t > x.t) continue;
		if (x.deleted) delete fresh.sentences[x.uuid];
		else fresh.sentences[x.uuid] = x;
	}
	// Drop what was just pushed (unless it changed again meanwhile).
	for (const w of pushWords) if (fresh.pending.words[w.lemma] && fresh.pending.words[w.lemma].t === w.t) delete fresh.pending.words[w.lemma];
	for (const x of pushSent) if (fresh.pending.sentences[x.uuid] && fresh.pending.sentences[x.uuid].t === x.t) delete fresh.pending.sentences[x.uuid];
	await set({ words: fresh.words, wordTs: fresh.wordTs, sentences: fresh.sentences, pending: fresh.pending, cursor: res.cursor, progress: res.progress, level: res.level || s.level });
	if (res.more) scheduleSync(500);
	return res;
}

chrome.alarms.create('lens-sync', { periodInMinutes: 10 });
chrome.alarms.onAlarm.addListener((a) => {
	if (a.name === 'lens-sync') sync().catch(() => {});
});

/* ------------------------------------------------------------ actions */

async function mark(lemma, status) {
	lemma = String(lemma || '').toLowerCase();
	if (!lemma) return null;
	const L = await loadLens();
	const s = await get(['words', 'wordTs', 'pending', 'level']);
	const before = L.status(lemma, { level: s.level, words: s.words });
	if (status) s.words[lemma] = status;
	else delete s.words[lemma];
	const t = Date.now();
	s.wordTs[lemma] = t;
	s.pending.words[lemma] = { status: status || '', t, level: L.level(lemma) };
	await set({ words: s.words, wordTs: s.wordTs, pending: s.pending });
	const after = L.status(lemma, { level: s.level, words: s.words });
	if (before !== 'known' && after === 'known') await bumpLocal('words', 1);
	if (before === 'known' && after !== 'known' && status !== '') await bumpLocal('words', -1);
	scheduleSync();
	return after;
}

async function saveSentence(d) {
	const uuid = crypto.randomUUID();
	const x = {
		uuid,
		text: String(d.text || '').trim().slice(0, 1000),
		ar: d.ar || '',
		focus: d.focus || '',
		url: d.url || '',
		title: d.title || '',
		videoId: d.videoId || '',
		startMs: Math.round(d.startMs || 0),
		endMs: Math.round(d.endMs || 0),
		createdOn: today(),
		t: Date.now()
	};
	if (!x.text) throw new Error('لا توجد جملة.');
	const s = await get(['sentences', 'pending']);
	s.sentences[uuid] = x;
	s.pending.sentences[uuid] = x;
	await set({ sentences: s.sentences, pending: s.pending });
	await bumpLocal('sentences', 1);
	// Words the learner is focusing on become "learning".
	if (d.focusLemma) {
		const L = await loadLens();
		const st = await userState();
		if (L.status(d.focusLemma, st) !== 'known') await mark(d.focusLemma, 'learning');
	}
	scheduleSync(1500);
	// Arabic translation in the background, then save it onto the sentence.
	if (!x.ar) {
		api('/translate', { sentence: x.text })
			.then(async (r) => {
				const s2 = await get(['sentences', 'pending']);
				if (!s2.sentences[uuid] || !r.sentence) return;
				const nx = Object.assign({}, s2.sentences[uuid], { ar: r.sentence, t: Date.now() });
				s2.sentences[uuid] = nx;
				s2.pending.sentences[uuid] = nx;
				await set({ sentences: s2.sentences, pending: s2.pending });
				scheduleSync(1500);
			})
			.catch(() => {});
	}
	return x;
}

async function lookup(word) {
	const L = await loadLens();
	const st = await userState();
	const lemmas = L.lemmas(word);
	const lemma = lemmas[0] || String(word).toLowerCase();
	return {
		word,
		lemma,
		alts: lemmas.slice(1, 3).map((l) => ({ lemma: l, ar: (L.entries(l).find((e) => e.ar) || {}).ar || '' })),
		level: L.level(lemma),
		levelName: L.level(lemma) ? self.Lens.LEVELS[L.level(lemma) - 1] : '',
		entries: L.entries(lemma),
		status: L.status(lemma, st),
		mark: st.words[lemma] || ''
	};
}

async function analyze(texts) {
	const L = await loadLens();
	const st = await userState();
	const lines = texts.map((t) => L.analyze(t, st));
	return { lines, grade: L.grade([].concat(...lines)), level: st.level };
}

async function enableSite(origin, tabId) {
	const { sites } = await get('sites');
	if (!sites.includes(origin)) sites.push(origin);
	await set({ sites });
	await registerSites();
	if (tabId) await injectInto(tabId);
}

async function disableSite(origin) {
	const { sites } = await get('sites');
	await set({ sites: sites.filter((o) => o !== origin) });
	await registerSites();
}

async function registerSites() {
	const { sites } = await get('sites');
	const have = await chrome.scripting.getRegisteredContentScripts();
	const ids = have.map((s) => s.id).filter((id) => id.startsWith('lens-site'));
	if (ids.length) await chrome.scripting.unregisterContentScripts({ ids });
	const granted = [];
	for (const o of sites) {
		if (await chrome.permissions.contains({ origins: [o + '/*'] })) granted.push(o + '/*');
	}
	if (granted.length) {
		await chrome.scripting.registerContentScripts([
			{ id: 'lens-sites', matches: granted, js: ['content/common.js', 'content/card.js', 'content/page.js'], runAt: 'document_idle', allFrames: false }
		]);
	}
}

async function injectInto(tabId) {
	await chrome.scripting.executeScript({ target: { tabId }, files: ['content/common.js', 'content/card.js', 'content/page.js'] });
}

chrome.runtime.onInstalled.addListener(() => registerSites().catch(() => {}));
chrome.runtime.onStartup.addListener(() => {
	registerSites().catch(() => {});
	sync().catch(() => {});
});

/* ------------------------------------------------------------ messages */

const handlers = {
	state: async () => {
		const s = await get(['token', 'me', 'level', 'progress', 'local', 'sites', 'pauseOnHover']);
		if (s.token && !s.me) {
			try {
				s.me = await api('/me');
				s.progress = s.me.progress;
				await set({ me: s.me, progress: s.progress });
			} catch (e) {
				/* offline: show what we have */
			}
		}
		const local = s.local.day === today() ? s.local : { words: 0, sentences: 0 };
		return { signedIn: !!s.token, me: s.me, level: s.level, progress: s.progress, local, sites: s.sites, pauseOnHover: s.pauseOnHover };
	},
	login: () => login(),
	logout: () => logout(),
	sync: () => sync(),
	setLevel: async ({ level }) => {
		level = Math.max(1, Math.min(6, level | 0));
		await set({ level });
		scheduleSync(500);
		return level;
	},
	setPause: async ({ on }) => set({ pauseOnHover: !!on }),
	lookup: ({ word }) => lookup(word),
	analyze: ({ texts }) => analyze(texts),
	mark: ({ lemma, status }) => mark(lemma, status),
	explain: ({ word, sentence }) => api('/explain', { word, sentence }),
	saveSentence: (d) => saveSentence(d),
	enableSite: ({ origin, tabId }) => enableSite(origin, tabId),
	disableSite: ({ origin }) => disableSite(origin)
};

chrome.runtime.onMessage.addListener((msg, sender, reply) => {
	const h = handlers[msg && msg.type];
	if (!h) return false;
	Promise.resolve()
		.then(() => h(msg, sender))
		.then((data) => reply({ ok: true, data }), (e) => reply({ ok: false, error: e && e.message === 'signed_out' ? 'signed_out' : (e && e.message) || 'error' }));
	return true;
});
