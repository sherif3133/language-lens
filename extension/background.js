/* Language Lens: service worker.
   Owns the word list, the learner's marks, saved sentences, sign-in and sync with sawaenglish.com. */
'use strict';
// Chrome runs this as a service worker; Firefox loads the same files as a background page (see tools/build-zips.js).
if (typeof importScripts === 'function') importScripts('core/lens-core.js', 'lib/compromise.js', 'core/grammar.js', 'core/pron.js');

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
	glossLang: 'en', // 'en' English definitions (default), 'ar' Arabic meanings
	explainLang: 'en', // "Explanations: English / العربية": notes, pronunciation tips, grammar and lyrics (saved with the account)
	colorPages: true, // colour words on websites
	exprOn: true, // join and highlight phrasal verbs, idioms and compounds ("give up", "on the fence")
	sidebar: true, // full transcript next to YouTube videos
	focus: '', // grammar or pronunciation focus key, '' for none
	showIPA: true, // IPA + sounds-like under words
	showTrans: true, // translation line under YouTube captions
	blurCaptions: false, // blur captions until hovered
	blurTrans: false, // blur the translation until hovered
	progress: null,
	local: { day: '', words: 0, sentences: 0 },
	learnCap: 30, // new Learning words a day (20, 30 or 40): enough to grow, not so many that reviews pile up
	daily: { day: '', read: 0, heard: 0, curious: 0, learning: 0 }, // today's numbers on this device
	dailyOut: { read: 0, heard: 0 } // read/heard words not sent to the server yet
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

/* ------------------------------------------------------------ daily numbers: curious, read, heard */

async function daily() {
	const { daily: d } = await get('daily');
	return d.day === today() ? d : { day: today(), read: 0, heard: 0, curious: 0, learning: 0 };
}

/** Words read on websites / heard in YouTube captions: counted here, sent to the server about once a minute. */
let dailyFlushAt = 0;
async function addDaily({ read, heard }) {
	read = Math.max(0, Math.min(5000, read | 0)); heard = Math.max(0, Math.min(5000, heard | 0));
	const d = await daily(), { dailyOut: o } = await get('dailyOut');
	d.read += read; d.heard += heard; o.read += read; o.heard += heard;
	await set({ daily: d, dailyOut: o });
	if (Date.now() - dailyFlushAt > 60000) flushDaily();
	return d;
}
async function flushDaily() {
	const { dailyOut: o, token } = await get(['dailyOut', 'token']);
	if (!token || (!o.read && !o.heard)) return;
	dailyFlushAt = Date.now();
	await set({ dailyOut: { read: 0, heard: 0 } });
	await api('/daily', o).catch(async () => { const { dailyOut: n } = await get('dailyOut'); await set({ dailyOut: { read: n.read + o.read, heard: n.heard + o.heard } }); });
}

/** "I'm curious about this word": XP for exploring; the word is tracked but not added to Learning or reviews. */
async function curious(lemma) {
	const r = await api('/curious', { lemma });
	const d = await daily();
	if (r.new) { d.curious++; await set({ daily: d }); }
	return Object.assign(r, { todayLocal: d.curious });
}

/** The Review screen of the Sawa English app (phone and computer): saved words become cards there. */
async function reviewUrl() {
	const { me, server } = await get(['me', 'server']);
	return ((me && me.app) || (server || DEFAULT_SERVER) + '/app/').replace(/#.*$/, '') + '#review';
}
async function reviewLink() {
	const { cards } = await get('cards');
	return { url: await reviewUrl(), ready: cards ? cards.ready || cards.dueReviews || 0 : 0 };
}

/** Is there room for another new Learning word today? */
async function learnRoom() {
	const [d, { learnCap, cards }] = await Promise.all([daily(), get(['learnCap', 'cards'])]);
	// Signed in: the card level decides (its new cards a day + a little room; none while the waiting line is long).
	const cap = cards ? cards.learnPerDay : learnCap;
	return { used: d.learning, cap, left: Math.max(0, cap - d.learning), level: cards ? cards.level : 0, full: !!(cards && cards.full), catchup: !!(cards && cards.catchup), waiting: cards ? cards.waiting : 0, ready: cards ? cards.ready || cards.dueReviews || 0 : 0, reviewUrl: await reviewUrl() };
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
		lensLoading = Promise.all([fetch(chrome.runtime.getURL('data/lexicon.json')).then((r) => r.json()), loadRules()])
			.then(([lex, rules]) => {
				lens = new self.Lens(lex);
				lens.setRules(rules);
				return loadFreq().then((F) => { lens.setFreq(F.rank); return lens; }, () => lens);
			});
	}
	return lensLoading;
}

/* ------------------------------------------------------------ rules as data (sawa-lens /rules) */
// Phrases not to underline, context rules and how captions become sentences. The copy in data/rules.json works
// offline; the server's copy (refreshed every 12 hours) wins when newer, so testers get fixes without a new zip.
let rulesNow = null;
async function loadRules() {
	if (rulesNow) return rulesNow;
	const local = await fetch(chrome.runtime.getURL('data/rules.json')).then((r) => r.json()).catch(() => ({ v: 0 }));
	const { lensRules, lensRulesAt } = await get(['lensRules', 'lensRulesAt']);
	rulesNow = lensRules && lensRules.v >= local.v ? lensRules : local;
	if (!lensRulesAt || Date.now() - lensRulesAt > 12 * 3600e3) refreshRules().catch(() => {});
	return rulesNow;
}
async function refreshRules() {
	const { server } = await get('server');
	await set({ lensRulesAt: Date.now() });
	const res = await fetch((server || DEFAULT_SERVER) + '/wp-json/sawa-lens/v1/rules');
	const j = await res.json();
	if (!res.ok || !j || !j.v || (rulesNow && j.v < rulesNow.v)) return;
	await set({ lensRules: j });
	rulesNow = j;
	if (lens) lens.setRules(j);
}

/* Caption sentences → Arabic (one AI call per 12 sentences, cached on the server per sentence for everyone). */
const sentTrCache = new Map();
async function sentTr(texts) {
	texts = (texts || []).slice(0, 12).map(String);
	const out = texts.map((t) => sentTrCache.get(t) || '');
	const miss = texts.filter((t, i) => !out[i]);
	if (miss.length) {
		const r = await api('/lines-tr', { lines: miss });
		(r.lines || []).forEach((ar, k) => { if (ar) sentTrCache.set(miss[k], ar); });
		if (sentTrCache.size > 3000) sentTrCache.clear();
	}
	return texts.map((t) => sentTrCache.get(t) || '');
}

/* ------------------------------------------------------------ Arabic → English */

/** Arabic spelled one way: no diacritics or tatweel, one alef, ى → ي, ة → ه. */
const arNorm = (s) => String(s).replace(/[\u064B-\u0652\u0670\u0640]/g, '').replace(/[أإآٱ]/g, 'ا').replace(/ى/g, 'ي').replace(/ة/g, 'ه').replace(/ؤ/g, 'و').replace(/ئ/g, 'ي').trim();
let arIndex = null;
/** Every Arabic meaning in the dictionary → the English words that have it. */
async function loadArIndex() {
	if (arIndex) return arIndex;
	const L = await loadLens(), idx = {};
	L.lex.entries.forEach((e, i) => {
		String(e[3] || '').split(/[،,؛;]/).forEach((g, gi) => {
			g = arNorm(g.replace(/\(.*?\)/g, ''));
			if (g) (idx[g] = idx[g] || []).push([i, gi]);
		});
	});
	return (arIndex = idx);
}
const AR_PRE = ['وال', 'بال', 'فال', 'كال', 'لل', 'ال', 'و', 'ف', 'ب', 'ل', 'ك', 'س'];
const AR_SUF = ['هما', 'كما', 'ها', 'هم', 'هن', 'كم', 'نا', 'ات', 'ون', 'ين', 'ان', 'ه', 'ك', 'ي', 'ا'];
/** The forms to try for an Arabic word on a page: as it is, without و/ب/ال…, without ها/ات/ي…. */
function arForms(w) {
	w = arNorm(w);
	const out = [w];
	for (const p of AR_PRE) if (w.startsWith(p) && w.length - p.length >= 2) out.push(w.slice(p.length));
	for (const c of out.slice()) for (const s of AR_SUF) if (c.endsWith(s) && c.length - s.length >= 2) out.push(c.slice(0, -s.length));
	for (const c of out.slice()) if (/ت$/.test(c)) out.push(c.slice(0, -1) + 'ه'); // مدرستي → مدرسه
	return [...new Set(out)];
}
/** English words for an Arabic word, from the built-in dictionary (instant, no AI): easiest first. */
async function arLookup(word) {
	const idx = await loadArIndex(), L = await loadLens(), st = await userState();
	for (const f of arForms(word)) {
		const h = idx[f] || idx['ال' + f];
		if (!h) continue;
		const seen = new Set();
		return h.map(([i, gi]) => ({ e: L.lex.entries[i], gi })).sort((a, b) => a.e[2] - b.e[2] || a.gi - b.gi)
			.filter((x) => !seen.has(x.e[0]) && seen.add(x.e[0])).slice(0, 4)
			.map((x) => ({ lemma: x.e[0], pos: x.e[1], level: L.lex.levels[x.e[2] - 1] || '', ar: x.e[3], status: L.status(x.e[0], st) }));
	}
	return [];
}

async function userState() {
	const s = await get(['level', 'levelT', 'words', 'exprOn', 'vocabProfile', 'vocabTest', 'mature']);
	const mature = {};
	(s.mature || []).forEach((l) => { mature[l] = true; });
	return { level: s.level, words: s.words, noExpr: s.exprOn === false, profile: vocabProfile(s), mature };
}

/**
 * Which vocabulary profile "You know about N% of the words" uses (education/placement-test-spec.md, Part 3):
 * the account's test result (a full placement test always wins over the quick ones), else this device's level check,
 * unless a level was picked by hand after it. null = the usual profile of the learner's level (lens-core).
 */
function vocabProfile(s) {
	const vp = s.vocabProfile, vt = s.vocabTest, lt = s.levelT || 0;
	const full = !!(vp && vp.source === 'test' && vp.test === 'placement');
	if (vp && vp.source === 'test' && (vp.t || 0) >= lt && (full || !vt || (vt.t || 0) <= (vp.t || 0))) return vp;
	if (!full && vt && vt.bands && vt.bands.some((b) => b > 0) && (vt.t || 0) >= lt) return { bands: smoothBands(vt.bands), source: 'test', test: 'lens', t: vt.t, date: vt.date };
	return null;
}

/** Six band shares, never rising with rank; missing bands fall off from the last one (same as Sawa_Lens_Store::smooth_bands). */
function smoothBands(bands) {
	const out = [];
	let prev = 1;
	for (const b of bands.slice(0, 6)) out.push(Math.round((prev = Math.min(prev, Math.max(0, Math.min(1, +b || 0)))) * 1000) / 1000);
	while (out.length && out.length < 6) out.push(Math.round(out[out.length - 1] * 0.6 * 1000) / 1000);
	return out;
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
		// Forget the sign-in only when the server really doesn't know this token: one odd 401 (a cache, a proxy, a lost header)
		// used to sign members out, so the next browser start asked them to sign in again.
		if (path !== '/me' && await tokenStillGood(server, token)) throw new Error('Connection problem. Try again.');
		const now = await get('token');
		if (now.token === token) await set({ token: '', me: null });
		throw new Error('signed_out');
	}
	if (res.status === 403 && j.code === 'locked') throw new Error('locked'); // not in a free account's plan (Sawa Lens 0.25.0+)
	if (!res.ok) throw new Error(j.message || 'Connection problem. Try again.');
	return j;
}

/** A second opinion before signing out: does /me still accept this token? (true also when the check can't run.) */
async function tokenStillGood(server, token) {
	try {
		const r = await fetch(server + '/wp-json/sawa-lens/v1/me', { headers: { Authorization: 'Bearer ' + token, 'X-Sawa-Token': token }, cache: 'no-store' });
		return r.status !== 401;
	} catch (e) {
		return true;
	}
}

/** Free or member: what this account may use. Old servers send no plan, so everything stays open. */
async function canUse(feature) {
	const { me } = await get('me');
	return !(me && me.plan && Array.isArray(me.plan.features)) || me.plan.features.includes(feature);
}

/** The Sawa English level test (CEFR level + vocabulary size); the result comes back with the next sync. */
async function openLevelTest() {
	const { server } = await get('server');
	await set({ syncAfterTest: Date.now() });
	return chrome.tabs.create({ url: server + '/placement/' });
}

/** Phones (Firefox for Android, Safari on iPhone, Lemur) have no sign-in window: sign in in a normal tab instead. */
function tabLogin() {
	return !(chrome.identity && chrome.identity.launchWebAuthFlow) || /Android|iPhone|iPad|Mobile/i.test(navigator.userAgent);
}

/** One sign-in at a time: a second click joins the one already running. */
let loginRunning = null;
function login() {
	if (!loginRunning) loginRunning = startLogin().finally(() => { loginRunning = null; });
	return loginRunning;
}

/** Sign in in a normal tab: the site sends the token back to its own "connected" page; content/connect.js hands it to us (loginTab). */
async function loginInTab(server, state) {
	await set({ pendingLogin: { state, t: Date.now() } });
	const redirect = server + '/?sawa_lens=connected';
	await chrome.tabs.create({ url: server + '/?sawa_lens=connect&redirect_uri=' + encodeURIComponent(redirect) + '&state=' + state });
	return { pending: true };
}

async function startLogin() {
	const { server } = await get('server');
	const state = crypto.randomUUID();
	if (tabLogin()) return loginInTab(server, state);
	const redirect = chrome.identity.getRedirectURL('lens');
	const url = server + '/?sawa_lens=connect&redirect_uri=' + encodeURIComponent(redirect) + '&state=' + state;
	let back;
	try {
		back = await chrome.identity.launchWebAuthFlow({ url, interactive: true });
	} catch (e) {
		// The learner closed the window: nothing to do. Anything else ("Only one web auth flow is allowed at a time" when an
		// earlier sign-in window is stuck, a blocked pop-up, a network error): sign in in a normal tab instead, like on phones.
		if (/did not approve|cancel/i.test(String((e && e.message) || e))) throw new Error('Sign-in was closed. Press "Sign in" to try again.');
		return loginInTab(server, state);
	}
	if (!back) return loginInTab(server, state);
	const hash = new URLSearchParams(new URL(back).hash.slice(1));
	if (hash.get('state') !== state || !/^[a-f0-9]{64}$/.test(hash.get('token') || '')) throw new Error('Sign-in did not finish. Try again.');
	return finishLogin(hash.get('token'));
}

/** The token from the sign-in tab: only for the sign-in this device started in the last 15 minutes. */
async function loginTab({ token, state }) {
	const { pendingLogin: p } = await chrome.storage.local.get('pendingLogin');
	if (!p || p.state !== state || Date.now() - p.t > 15 * 60000 || !/^[a-f0-9]{64}$/.test(token || '')) throw new Error('Sign-in did not finish. Open Language Lens and press "Sign in" again.');
	await chrome.storage.local.remove('pendingLogin');
	return finishLogin(token);
}

async function finishLogin(token) {
	await set({ token, cursor: 0 });
	const me = await api('/me');
	const patch = { me, progress: me.progress };
	if (me.progress && me.progress.level) patch.level = me.progress.level;
	if (me.explainLang) patch.explainLang = me.explainLang; // the account's setting (old servers: keep this device's)
	await set(patch);
	await sync();
	// First time: start with the vocabulary test.
	const { vocabTest } = await get('vocabTest');
	if (!vocabTest) await openLevelTest();
	return Object.assign({}, me, { testOpened: !vocabTest }); // phones: the connected page says what comes next
}

async function logout() {
	try {
		await api('/logout', {});
	} catch (e) {
		/* already gone */
	}
	await set({ token: '', me: null, progress: null, vocabProfile: null, mature: [] }); // the account's vocabulary profile stays with the account
}

/* ------------------------------------------------------------ sync */

function scheduleSync(ms) {
	clearTimeout(syncTimer);
	syncTimer = setTimeout(() => sync().catch(() => {}), ms || 4000);
}

async function sync() {
	const s = await get(['token', 'pending', 'cursor', 'level', 'levelT', 'words', 'wordTs', 'sentences']);
	if (!s.token) return null;
	const pushWords = Object.keys(s.pending.words).map((lemma) => Object.assign({ lemma }, s.pending.words[lemma]));
	const pushSent = Object.values(s.pending.sentences);
	const { vocabTest, levelDirty, explainLang, explainDirty } = await get(['vocabTest', 'levelDirty', 'explainLang', 'explainDirty']);
	// Send the level only when the learner changed it here, so the level test's result isn't overwritten.
	const res = await api('/sync', { since: s.cursor, level: levelDirty ? s.level : 0, levelT: levelDirty ? s.levelT || Date.now() : 0, words: pushWords, sentences: pushSent, vocab: vocabTest || null, explainLang: explainDirty ? explainLang : '' });
	if (levelDirty) await set({ levelDirty: false });
	if (res.explainLang) {
		// The account's value wins, unless the learner changed it here meanwhile (then it's sent next time).
		const now = await get(['explainLang', 'explainDirty']);
		if (!now.explainDirty) await set({ explainLang: res.explainLang });
		else if (explainDirty && now.explainLang === explainLang) await set({ explainDirty: false });
	}
	if (res.vocab && (!vocabTest || res.vocab.t > vocabTest.t)) await set({ vocabTest: res.vocab });
	// Lens 0.9: the % of words you know comes from the account's vocabulary profile (servers before Sawa Lens 0.28 don't send it).
	if (res.vocabProfile) {
		const upd = { vocabProfile: res.vocabProfile, mature: res.mature || [] };
		const { levelT } = await get('levelT');
		// The account's level was set elsewhere (the app, a placement test): it is newer than this device's level pick.
		if (res.vocabProfile.source === 'level' && (res.vocabProfile.t || 0) > (levelT || 0) && !levelDirty) upd.levelT = res.vocabProfile.t;
		await set(upd);
	}
	if (res.plan) { const { me } = await get('me'); if (me) await set({ me: Object.assign({}, me, { plan: res.plan }) }); } // Sherif ticked "Member (paid)": opens here at the next sync
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
	await set({ words: fresh.words, wordTs: fresh.wordTs, sentences: fresh.sentences, pending: fresh.pending, cursor: res.cursor, progress: res.progress, level: res.level || s.level, cards: res.cards || null });
	if (res.more) scheduleSync(500);
	return res;
}

chrome.alarms.create('lens-sync', { periodInMinutes: 10 });
chrome.alarms.onAlarm.addListener((a) => {
	if (a.name === 'lens-sync') {
		sync().catch(() => {});
		get('lensRulesAt').then(({ lensRulesAt }) => { if (!lensRulesAt || Date.now() - lensRulesAt > 12 * 3600e3) refreshRules().catch(() => {}); });
	}
});

/* ------------------------------------------------------------ actions */

/** Mark a word. baseline = from the placement test: known already, so it isn't counted as learned today. */
async function mark(lemma, status, baseline, ctx) {
	lemma = String(lemma || '').toLowerCase();
	if (!lemma) return null;
	const L = await loadLens();
	const s = await get(['words', 'wordTs', 'pending', 'level']);
	const before = L.status(lemma, { level: s.level, words: s.words });
	// New Learning words are capped each day, so reviews never pile up. Curious is unlimited.
	const newLearning = !baseline && status === 'learning' && s.words[lemma] !== 'learning';
	if (newLearning) {
		const room = await learnRoom();
		if (!room.left) {
			const e = new Error(room.catchup ? 'Catch-up time: finish your due review cards first, then you can add new Learning words again. Tap 💡 Curious to earn XP for this one.'
				: room.full ? room.waiting + ' words are already waiting to become cards. Review every day to raise your card level and add more. Tap 💡 Curious to earn XP for this one.'
				: 'You added ' + room.cap + ' new Learning words today — your card level\'s limit. Tap 💡 Curious to earn XP for this one instead.');
			e.code = 'learn_cap';
			throw e;
		}
	}
	if (status) s.words[lemma] = status;
	else delete s.words[lemma];
	const t = Date.now();
	s.wordTs[lemma] = t;
	s.pending.words[lemma] = { status: status || '', t, level: L.level(lemma), base: baseline ? 1 : 0 };
	// Where the learner met the word: the sentence (and video moment) becomes the context of its review card.
	if (ctx && ctx.sentence && status === 'learning') s.pending.words[lemma].ctx = { sentence: String(ctx.sentence).slice(0, 600), url: ctx.url || '', title: ctx.title || '', videoId: ctx.videoId || '', startMs: ctx.startMs || 0 };
	await set({ words: s.words, wordTs: s.wordTs, pending: s.pending });
	const after = L.status(lemma, { level: s.level, words: s.words });
	if (!baseline && before !== 'known' && after === 'known') await bumpLocal('words', 1);
	if (!baseline && before === 'known' && after !== 'known' && status !== '') await bumpLocal('words', -1);
	if (newLearning) { const d = await daily(); d.learning++; await set({ daily: d }); }
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
		kind: ['sentence', 'phrase', 'grammar'].includes(d.kind) ? d.kind : 'sentence',
		tag: String(d.tag || '').slice(0, 60),
		startMs: Math.round(d.startMs || 0),
		endMs: Math.round(d.endMs || 0),
		createdOn: today(),
		t: Date.now()
	};
	if (!x.text) throw new Error('No sentence.');
	const s = await get(['sentences', 'pending']);
	s.sentences[uuid] = x;
	s.pending.sentences[uuid] = x;
	await set({ sentences: s.sentences, pending: s.pending });
	await bumpLocal('sentences', 1);
	// Words the learner is focusing on become "learning".
	if (d.focusLemma) {
		const L = await loadLens();
		const st = await userState();
		if (L.status(d.focusLemma, st) !== 'known') await mark(d.focusLemma, 'learning').catch(() => {}); // over today's cap: the sentence is still saved
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

/** A phrasal verb, idiom or collocation the learner picked out: it becomes a 'learning' item and a review card. */
async function saveExpression(d) {
	const phrase = String(d.phrase || '').toLowerCase().replace(/[’]/g, "'").replace(/[^a-z' -]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 64);
	if (phrase.split(' ').length < 2) throw new Error('Select at least two words.');
	// Over today's Learning limit, the expression is still saved (it becomes one review card); it just isn't
	// highlighted as Learning until a later day.
	let limited = false;
	try { await mark(phrase, 'learning'); } catch (e) { if (e.code !== 'learn_cap') throw e; limited = true; }
	const x = await saveSentence(Object.assign({}, d, { text: d.sentence || d.phrase, focus: phrase, kind: d.kind || 'phrase' }));
	return Object.assign({}, x, { limited });
}

let pron = null;
let pronLoading = null;
function loadPron() {
	if (pron) return Promise.resolve(pron);
	if (!pronLoading) {
		pronLoading = fetch(chrome.runtime.getURL('data/pron.json'))
			.then((r) => r.json())
			.then((d) => (pron = new self.LensPron(d)));
	}
	return pronLoading;
}

/* ------------------------------------------------------------ frequency, vocabulary test, goals */

let freq = null;
let freqLoading = null;
function loadFreq() {
	if (freq) return Promise.resolve(freq);
	if (!freqLoading) {
		freqLoading = fetch(chrome.runtime.getURL('data/freq.json'))
			.then((r) => r.json())
			.then((d) => {
				const rank = {};
				d.ranked.forEach((w, i) => { rank[w] = i + 1; });
				return (freq = { ranked: d.ranked, rank });
			});
	}
	return freqLoading;
}

const GOALS = [1000, 2000, 3000, 4000, 5000];
// Made-up but English-looking words: a "yes" to these means guessing (yes/no vocabulary test method).
const PSEUDO = ['brastic', 'plinder', 'morvish', 'tralent', 'glimber', 'spaunt', 'crendle', 'fruskle', 'dorpish', 'quillate', 'sneavy', 'mallish', 'pronter', 'gaspen', 'flurdish', 'cobblet', 'harpel', 'vorine', 'starnish', 'plosent', 'trindle', 'bleckish', 'grommage', 'snurtle'];

/** 12 words from each 1,000-word band (top 5,000) and 10 made-up words, shuffled. */
async function testItems() {
	const F = await loadFreq();
	const L = await loadLens();
	const P = await loadPron();
	const items = [];
	for (let b = 0; b < 5; b++) {
		const pool = F.ranked.slice(b === 0 ? 120 : b * 1000, (b + 1) * 1000).filter((w) => w.length >= 3 && /^[a-z]+$/.test(w));
		for (let k = 0; k < 12 && pool.length; k++) items.push({ w: pool.splice(Math.floor(Math.random() * pool.length), 1)[0], b });
	}
	const fakes = PSEUDO.filter((w) => !L.has(w) && !P.get(w)).sort(() => Math.random() - 0.5).slice(0, 10);
	fakes.forEach((w) => items.push({ w, b: -1 }));
	return items.sort(() => Math.random() - 0.5);
}

/**
 * Score a test. answers: [{w, b, yes}]. Band estimate = hit rate corrected for guessing:
 * (hits − false alarms) / (1 − false alarms).
 */
async function saveTest({ answers }) {
	const fakes = answers.filter((a) => a.b < 0), fa = fakes.length ? fakes.filter((a) => a.yes).length / fakes.length : 0;
	const bands = [0, 1, 2, 3, 4].map((b) => {
		const real = answers.filter((a) => a.b === b);
		if (!real.length) return 0;
		const h = real.filter((a) => a.yes).length / real.length;
		return fa >= 1 ? 0 : Math.max(0, Math.min(1, (h - fa) / (1 - fa)));
	});
	const estimate = Math.round(bands.reduce((s, p) => s + p * 1000, 0));
	const level = estimate < 1000 ? 1 : estimate < 2000 ? 2 : estimate < 3000 ? 3 : estimate < 4000 ? 4 : estimate < 4700 ? 5 : 6;
	const vocabTest = { date: today(), estimate, bands, falseAlarms: fa, t: Date.now() };
	await set({ vocabTest });
	// Real words they said they know become known (if they weren't guessing a lot).
	if (fa <= 0.3) {
		for (const a of answers) if (a.b >= 0 && a.yes) await mark(a.w, 'known', true);
	}
	scheduleSync(800);
	return { estimate, bands, falseAlarms: fa, suggestedLevel: level, unknown: answers.filter((a) => a.b >= 0 && a.b <= 2 && !a.yes).map((a) => a.w) };
}

/** Progress towards the next goal (top 1k, 2k … words): marked known + the test's estimate for the rest. */
async function goal() {
	const F = await loadFreq();
	const { words, vocabTest } = await get(['words', 'vocabTest']);
	const bands = vocabTest ? vocabTest.bands : [0, 0, 0, 0, 0];
	const steps = GOALS.map((g) => {
		let have = 0, learning = 0;
		for (let i = 0; i < g && i < F.ranked.length; i++) {
			const m = words[F.ranked[i]];
			if (m === 'known') have++;
			else if (m === 'learning') learning++;
			else have += bands[Math.floor(i / 1000)] || 0;
		}
		return { goal: g, have: Math.round(have), learning, done: have >= g * 0.95 };
	});
	const cur = steps.find((s) => !s.done) || steps[steps.length - 1];
	const known = Object.keys(words).filter((k) => words[k] === 'known').length;
	return { goal: cur.goal, have: cur.have, learning: cur.learning, steps, tested: !!vocabTest, estimate: vocabTest ? vocabTest.estimate : 0, known };
}

/** All focus options: grammar, then pronunciation. */
function focusList() {
	const G = self.LensGrammar.FOCUS, P = self.LensPron.FOCUS;
	return Object.keys(G).map((k) => ({ key: k, name: G[k][0], rule: G[k][1], group: 'Grammar' }))
		.concat(Object.keys(P).map((k) => ({ key: k, name: P[k][0], rule: P[k][1], group: 'Pronunciation' })));
}

/** The grammar and pronunciation focus rules in Arabic, for "Explanations: العربية" (English examples stay English). */
const RULE_AR = {
	verbs: 'اضغط على أي فعل أو مرّر المؤشر عليه لترى صيغه الثلاث: base · past · past participle.',
	past: 'الفعل + ed، أو الصيغة الثانية للأفعال الشاذة: walked · went.',
	present: 'الفعل في صيغته الأصلية، ونضيف s مع he / she / it: I work · she works.',
	future: 'will + الفعل، أو am / is / are going to + الفعل.',
	continuous: 'am / is / are / was / were + الفعل مع ing: is running · was running.',
	perfect: 'have / has / had + التصريف الثالث للفعل: has lived · had known.',
	passive: 'be + التصريف الثالث للفعل: was built · is made.',
	modal: 'can · could · should · must · might · may · would + الفعل في صيغته الأصلية.',
	conditional: 'الصفري: مضارع + مضارع · الأول: مضارع + will · الثاني: ماضٍ + would · الثالث: had + would have.',
	relative: 'who للأشخاص · which للأشياء · that للاثنين · whose للملكية · where للأماكن.',
	pronouns: 'الضمائر: I · you · he · she · it · we · they · me · him · her · us · them · my · your · his …',
	adjectives: 'الصفة تصف الاسم، وتأتي غالبًا قبله: a big house · the house is big.',
	comparatives: 'الصفة + er أو more للمقارنة، والصفة + est أو most للتفضيل: bigger · the biggest · more useful.',
	phrasal: 'فعل + كلمة صغيرة (particle) بمعنى جديد: give up · look after · find out.',
	th: 'ضع لسانك بين أسنانك. /θ/ مثل «ث» (think)، و/ð/ مثل «ذ» (this).',
	p: '/p/ فيها نفخة هواء وبلا اهتزاز في الحنجرة: put, happy. لا تقل "but" بدل "put".',
	v: '/v/ فيها اهتزاز في الحنجرة: very, over. أما /f/ فبلا اهتزاز: fine.',
	ed: '/ɪd/ بعد t أو d (wanted) · /t/ بعد الأصوات المهموسة (walked) · /d/ بعد باقي الأصوات (played).',
	cluster: 'حرفان ساكنان أو أكثر معًا: street, next, texts. لا تُضف حركة بينهما.',
	flap: 'حرف t بين حركتين يُنطق مثل d سريعة: water, better, a lot of → "a lodda".'
};

async function focusSpans(texts, focus) {
	let r;
	if (self.LensPron.FOCUS[focus]) {
		const L = await loadLens();
		const P = await loadPron();
		const st = await userState();
		r = P.spans(texts, texts.map((t) => L.analyze(t, st)), focus);
	} else r = self.LensGrammar.grammar(texts, focus);
	const { explainLang } = await get('explainLang');
	return explainLang === 'ar' && RULE_AR[focus] && r && r.rule ? Object.assign({}, r, { rule: RULE_AR[focus], ruleLang: 'ar' }) : r;
}

async function lookup(word) {
	const L = await loadLens();
	const P = await loadPron();
	const st = await userState();
	const lemmas = L.lemmas(word);
	const lemma = lemmas[0] || String(word).toLowerCase();
	return {
		pron: P.info(word, lemma),
		rank: (await loadFreq()).rank[lemma] || 0,
		word,
		lemma,
		alts: lemmas.slice(1, 3).map((l) => ({ lemma: l, ar: (L.entries(l).find((e) => e.ar) || {}).ar || '' })),
		level: L.level(lemma),
		levelName: L.level(lemma) ? self.Lens.LEVELS[L.level(lemma) - 1] : '',
		entries: L.entries(lemma),
		verb: L.entries(lemma).some((e) => e.pos === 'verb') ? self.LensGrammar.verbForms(lemma) : null,
		status: L.status(lemma, st),
		mark: st.words[lemma] || '',
		locked: !(await canUse('lens_meanings')), // free account: the card says "Members only"; saving to Review still works
		join: ((await get('me')).me?.plan?.join) || 'https://sawaenglish.com/join/'
	};
}

/** A word our dictionary doesn't have: the site looks it up (shared cache → Wiktionary → AI; Sawa Lens 0.29+). Kept for this session. */
const defined = new Map();
async function define(word) {
	const w = String(word || '').toLowerCase().trim().slice(0, 40);
	if (!w) throw new Error('No word.');
	if (defined.has(w)) return defined.get(w);
	const r = await api('/define', { word: w });
	if (defined.size > 300) defined.clear();
	defined.set(w, r);
	return r;
}

/** Words of the same level and part of speech, for "which word did you hear?" quizzes. */
async function distractors(lemma, n) {
	const L = await loadLens();
	const lex = L.lex;
	const mine = (lex.lemmas[lemma] || []).map((i) => lex.entries[i]);
	const lv = mine.length ? mine[0][2] : 2;
	const pos = mine.length ? mine[0][1] : 'noun';
	const pool = [];
	for (let i = 0; i < lex.entries.length; i++) {
		const e = lex.entries[i];
		if (e[2] === lv && e[1] === pos && e[0] !== lemma && /^[a-z]+$/.test(e[0])) pool.push(e[0]);
	}
	const out = [];
	while (out.length < n && pool.length) out.push(pool.splice(Math.floor(Math.random() * pool.length), 1)[0]);
	return out;
}

async function analyze(texts) {
	const L = await loadLens();
	const st = await userState();
	const lines = texts.map((t) => L.analyze(t, st));
	const pr = st.profile;
	return { lines, grade: L.grade([].concat(...lines)), level: st.level, profile: pr ? { source: 'test', test: pr.test || '', date: pr.date || '' } : { source: 'level' } };
}

async function enableSite(origin, tabId) {
	const { sites } = await get('sites');
	if (!sites.includes(origin)) sites.push(origin);
	await set({ sites });
	await registerSites();
	if (tabId) await injectInto(tabId);
}

/* Websites: Language Lens runs everywhere by default (manifest content script); a site can be paused. */
async function pauseSite(origin, paused) {
	const o = await chrome.storage.local.get('pausedSites');
	const list = (o.pausedSites || []).filter((x) => x !== origin);
	if (paused) list.push(origin);
	await chrome.storage.local.set({ pausedSites: list });
	return { paused: list.includes(origin) };
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
			{ id: 'lens-sites', matches: granted, js: ['content/common.js', 'content/marks.js', 'content/card.js', 'content/page.js'], runAt: 'document_idle', allFrames: false }
		]);
	}
}

async function injectInto(tabId) {
	await chrome.scripting.executeScript({ target: { tabId }, files: ['content/common.js', 'content/marks.js', 'content/card.js', 'content/page.js'] });
}

chrome.runtime.onInstalled.addListener(() => registerSites().catch(() => {}));
chrome.runtime.onStartup.addListener(() => {
	registerSites().catch(() => {});
	sync().catch(() => {});
});

/* ------------------------------------------------------------ messages */

/* ------------------------------------------------------------ proofreading what the learner types */
/** The most likely right word one typing slip away (a letter missing, extra, swapped or wrong). */
function spellSuggest(L, w) {
	const a = 'abcdefghijklmnopqrstuvwxyz', c = new Set();
	for (let i = 0; i <= w.length; i++) {
		if (i < w.length) c.add(w.slice(0, i) + w.slice(i + 1));
		if (i < w.length - 1) c.add(w.slice(0, i) + w[i + 1] + w[i] + w.slice(i + 2));
		for (const ch of a) { if (i < w.length) c.add(w.slice(0, i) + ch + w.slice(i + 1)); c.add(w.slice(0, i) + ch + w.slice(i)); }
	}
	let best = '', bestLv = 99;
	for (const x of c) { if (x.length < 2 || !L.lemmas(x).length) continue; const lv = L.level(L.lemmas(x)[0]) || 7; if (lv < bestLv) { best = x; bestLv = lv; } }
	return best;
}
const proofCache = new Map();
async function proofText(text, grammar) {
	const L = await loadLens(), spell = [], re = /[A-Za-z]+(?:['’][A-Za-z]+)?/g;
	let m;
	while ((m = re.exec(text))) {
		const w = m[0], before = text.slice(0, m.index).replace(/\s+$/, ''), start = !before || /[.!?:\n]$/.test(before);
		if (w.length < 3 || /['’]/.test(w) || /[A-Z]/.test(w.slice(1)) || (/^[A-Z]/.test(w) && !start)) continue; // names, contractions, ACRONYMS
		const lw = w.toLowerCase();
		if (L.lemmas(lw).length || L.has(lw)) continue;
		const sug = spellSuggest(L, lw);
		if (sug) spell.push({ start: m.index, end: m.index + w.length, wrong: w, right: /^[A-Z]/.test(w) ? sug[0].toUpperCase() + sug.slice(1) : sug });
	}
	let gram = [];
	if (grammar && text.trim().split(/\s+/).length >= 4) {
		if (!proofCache.has(text)) {
			const r = await api('/proof', { text }).catch(() => ({ errors: null })); // offline or signed out: spelling still works
			if (!r.errors) return { spell, gram: [] };
			proofCache.set(text, r.errors || []);
			if (proofCache.size > 40) proofCache.delete(proofCache.keys().next().value);
		}
		const { explainLang } = await get('explainLang');
		gram = proofCache.get(text).filter((e) => !spell.some((s) => s.wrong === e.wrong)).map((e) => (explainLang === 'ar' ? e : Object.assign({}, e, { why_ar: '' })));
	}
	return { spell, gram };
}

/** Explanations in English: the Arabic "why" is shown only when the learner chose العربية. */
async function noArabicWhy(r) {
	const { explainLang } = await get('explainLang');
	return r && explainLang !== 'ar' ? Object.assign({}, r, { why_ar: '' }) : r;
}

/** "Sounds like" respellings for whole caption lines (the third caption line), from the built-in dictionary. */
async function soundLines(texts) {
	const P = await loadPron();
	return texts.map((t) => String(t || '').replace(/[A-Za-z]+(?:['’][A-Za-z]+)?/g, (w) => {
		const i = P.info(w.toLowerCase());
		return i && i.soundsLike ? i.soundsLike : w;
	}));
}

/**
 * A video's vocabulary profile: how many running words come from the most frequent 1,000 / 2,000 / 3,000 / 6,000
 * words of English and how many are rarer, plus the 20 words the video uses most (without small function words and names).
 * Learners usually need about 95–98% of the words to follow comfortably (Nation).
 */
async function videoProfile(texts, level) {
	const L = await loadLens(), F = await loadFreq(), BANDS = [1000, 2000, 3000, 6000];
	const counts = [0, 0, 0, 0, 0], uniq = [new Set(), new Set(), new Set(), new Set(), new Set()], use = {};
	let total = 0;
	for (const t of texts) {
		for (const tok of L.analyze(String(t || ''), {})) {
			if (tok.status === 'name' || !/[a-z]/i.test(tok.text)) continue;
			const lemma = tok.lemma, r = F.rank[lemma] || F.rank[tok.text.toLowerCase()] || 99999;
			let b = BANDS.findIndex((x) => r <= x); if (b < 0) b = 4;
			counts[b]++; uniq[b].add(lemma); total++;
			if (r > 150 && lemma.length > 2) use[lemma] = (use[lemma] || 0) + 1;
		}
	}
	const top = Object.keys(use).sort((a, b) => use[b] - use[a]).slice(0, 20).map((l) => { const e = L.entries(l); return { lemma: l, count: use[l], level: L.level(l), ar: (e.find((x) => x.ar) || {}).ar || '' }; });
	// Words a learner at this level usually knows: A1 ≈ 1k, A2 ≈ 2k, B1 ≈ 3k, B2 ≈ 6k most frequent words.
	const reach = { 1: 0, 2: 1, 3: 2, 4: 3 }[level || 2] ?? 3, within = counts.slice(0, reach + 1).reduce((a, b) => a + b, 0);
	return { total, bands: counts.map((n, i) => ({ n, uniq: uniq[i].size })), top, cover: total ? Math.round(1000 * within / total) / 10 : 0 };
}

/** "Send feedback": works signed in or out. The server adds the user when the token is good; the rest is added here. */
async function sendFeedback(f) {
	const { server, token } = await get(['server', 'token']);
	const ua = navigator.userAgent;
	const browser = /Firefox\//.test(ua) ? 'Firefox' : /Edg\//.test(ua) ? 'Edge' : /OPR\//.test(ua) ? 'Opera' : /Chrome\//.test(ua) ? 'Chrome' : /Safari\//.test(ua) ? 'Safari' : 'other';
	const headers = { 'Content-Type': 'application/json' };
	if (token) { headers.Authorization = 'Bearer ' + token; headers['X-Sawa-Token'] = token; }
	const res = await fetch(server + '/wp-json/sawa-lens/v1/feedback', {
		method: 'POST',
		headers,
		body: JSON.stringify({
			type: String(f.kind || ''), text: String(f.text || '').slice(0, 2000), page: String(f.page || '').slice(0, 300), email: String(f.email || '').slice(0, 120),
			from: String(f.from || '').slice(0, 20), lang: f.lang === 'ar' ? 'ar' : 'en',
			version: chrome.runtime.getManifest().version, browser: browser + ' ' + ((ua.match(/(?:Firefox|Edg|OPR|Chrome|Version)\/(\d+)/) || [])[1] || ''),
			device: /Android|iPhone|iPad|Mobile/i.test(ua) ? 'phone' : 'computer'
		})
	});
	const j = await res.json().catch(() => ({}));
	if (!res.ok) throw new Error(j.message || 'Could not send. Try again.');
	return { ok: true };
}

/** Is the learner's language Arabic? The popup and the word card show the feedback box in it. */
async function uiLang() {
	const s = await get(['glossLang', 'explainLang']);
	return s.glossLang === 'ar' || s.explainLang === 'ar' ? 'ar' : 'en';
}

const handlers = {
	feedback: (f) => sendFeedback(f || {}),
	uiLang: () => uiLang(),
	curious:({ lemma }) => curious(String(lemma || '').slice(0, 60)),
	addDaily: (x) => addDaily(x || {}),
	daily: async () => Object.assign(await daily(), await learnRoom()),
	setLearnCap: ({ n }) => set({ learnCap: [20, 30, 40].includes(+n) ? +n : 30 }),
	arLookup: async ({ word }) => ({ word, hits: await arLookup(String(word || '').slice(0, 40)) }),
	toEnglish: ({ text, word }) => api('/to-english', { text, word: word || '' }),
	toEnglishMany: ({ texts }) => api('/to-english', { texts: (texts || []).slice(0, 12) }),
	videoProfile: async ({ texts }) => videoProfile((texts || []).slice(0, 3000), (await get('level')).level),
	soundLines: ({ texts }) => soundLines((texts || []).slice(0, 2000)),
	proof: ({ text, grammar }) => proofText(String(text || '').slice(0, 2000), !!grammar),
	state: async () => {
		const s = await get(['token', 'me', 'level', 'progress', 'local', 'sites', 'pauseOnHover', 'glossLang', 'explainLang', 'colorPages', 'sidebar', 'focus', 'showIPA', 'showTrans', 'showEn', 'showSound', 'lensYT', 'blurCaptions', 'blurTrans', 'maskSwears', 'wordQuiz', 'exprOn']);
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
		return { signedIn: !!s.token, me: s.me, level: s.level, progress: s.progress, local, sites: s.sites, pauseOnHover: s.pauseOnHover, glossLang: s.glossLang, explainLang: s.explainLang, colorPages: s.colorPages, sidebar: s.sidebar, focus: s.focus, focusList: focusList(), showIPA: s.showIPA, showTrans: s.showTrans, showEn: s.showEn, showSound: s.showSound, lensYT: s.lensYT, blurCaptions: s.blurCaptions, blurTrans: s.blurTrans, maskSwears: s.maskSwears, wordQuiz: s.wordQuiz !== false, exprOn: s.exprOn !== false };
	},
	login: () => login(),
	loginTab: (d) => loginTab(d),
	logout: () => logout(),
	sync: () => sync(),
	setLevel: async ({ level, fromTest }) => {
		level = Math.max(1, Math.min(6, level | 0));
		// A level picked by hand replaces the vocabulary profile; one taken from the level check keeps the check's profile.
		const { vocabTest } = await get('vocabTest');
		await set({ level, levelDirty: true, levelT: fromTest && vocabTest ? vocabTest.t : Date.now() });
		scheduleSync(500);
		return level;
	},
	setPause: async ({ on }) => set({ pauseOnHover: !!on }),
	setPref: async ({ key, value }) => {
		if (key === 'glossLang') return set({ glossLang: value === 'ar' ? 'ar' : 'en' });
		if (key === 'explainLang') {
			await set({ explainLang: value === 'ar' ? 'ar' : 'en', explainDirty: true });
			scheduleSync(500); // saved with the account, so /app shows the same
			return null;
		}
		if (['colorPages', 'sidebar', 'showIPA', 'showTrans', 'showEn', 'showSound', 'lensYT', 'blurCaptions', 'blurTrans', 'pauseOnHover', 'maskSwears', 'wordQuiz', 'exprOn'].includes(key)) return set({ [key]: !!value });
		if (key === 'focus') return set({ focus: self.LensGrammar.FOCUS[value] || self.LensPron.FOCUS[value] ? value : '' });
		return null;
	},
	saveExpression: (d) => saveExpression(d),
	lookup: ({ word }) => lookup(word),
	define: ({ word }) => define(word),
	analyze: ({ texts }) => analyze(texts),
	rules: () => loadRules(),
	sentTr: ({ texts }) => sentTr(texts),
	grammar: ({ texts, focus }) => focusSpans(texts || [], focus),
	focusList: () => focusList(),
	goal: () => goal(),
	reviewLink: () => reviewLink(),
	testItems: () => testItems(),
	saveTest: (d) => saveTest(d),
	openTest: () => openLevelTest(),
	mark: ({ lemma, status, ctx }) => mark(lemma, status, false, ctx),
	images: ({ word, pos }) => api('/image?word=' + encodeURIComponent(word) + (pos ? '&pos=' + encodeURIComponent(pos) : ''), null, 'GET'),
	aiImage: ({ word, sentence }) => api('/image/ai', { word, sentence }),
	explain: async ({ word, sentence, lang }) => {
		const { glossLang, explainLang } = await get(['glossLang', 'explainLang']);
		return api('/explain', { word, sentence, lang: lang || glossLang, expl: explainLang });
	},
	/** 🎵 Music: one lyric line explained (meaning, slang and idioms, plain English), in English (default) or Arabic. */
	/** 🎵 Music: a whole song translated by what it means, with its slang (literal → real meaning). */
	songLines: async ({ song, lines, lang }) => api('/song-lines', { song, lines: (lines || []).slice(0, 120), lang: lang === 'ar' ? 'ar' : 'en' }),
	lyric: async ({ line, song, context, lang }) => api('/lyric', { line, song, context, lang: lang === 'ar' ? 'ar' : 'en' }),
	/** How a sentence or phrase sounds in natural fast speech, and why (connected speech). */
	sound: async ({ text }) => api('/sound', { text, lang: (await get('explainLang')).explainLang }),
	saveSentence: (d) => saveSentence(d),
	lesson: async ({ videoId }) => {
		const { me } = await get('me');
		const r = await api('/video/' + encodeURIComponent(videoId), null, 'GET');
		return { lesson: r.lesson, admin: !!(me && me.admin) };
	},
	lessonAnswer: async ({ id, qid, a }) => noArabicWhy(await api('/lesson/' + id + '/answer', { qid, a })),
	lessonDraft: async ({ videoId, title, lines }) => {
		const r = await api('/lessons/draft', { videoId, title, lines });
		chrome.tabs.create({ url: r.edit });
		return r;
	},
	distractors: ({ lemma, n }) => distractors(lemma, n || 2),
	enableSite: ({ origin, tabId }) => enableSite(origin, tabId),
	pauseSite: ({ origin, paused }) => pauseSite(origin, paused),
	pausedSites: async () => (await chrome.storage.local.get('pausedSites')).pausedSites || [],
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
