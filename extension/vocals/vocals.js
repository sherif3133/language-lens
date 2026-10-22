/* Vocals only — the engine page. Language Lens puts this page, hidden, inside the YouTube tab
   (content/vocals.js). Three ways it works:
   - live:     receives YouTube's audio bytes, decodes them (WebCodecs), separates the voice with the fast model
               (sep.js) and sends back the voice in windows of ~11 s, ahead of the playhead;
   - prepared: the song was prepared ahead (vocals/prepare.html, better model): its voice is read from this
               computer and sent back at once, nothing to separate;
   - capture:  a muted background tab opened by the Prepared songs page: collect the whole song's sound and
               keep it for that page to separate.
   Everything stays on this computer. Models are downloaded once (pinned, SHA-256 checked) and cached. */
(function () {
	'use strict';
	var SR = 44100, AHEAD = 40, PREP = 10; // seconds of voice ready ahead of the playhead; prepared windows are 10 s
	var MAX_RTF = 0.6; // slower than this (seconds of work per second of song) can't keep up: stop and say so
	var A = window.LensAudio;

	var port = null, parser = null, config = null, streamId = 0;
	var times = [], packets = {}; // sorted packet start times (µs); time → packet
	var sep = null, loading = null, backend = '', busy = false, done = {}, playhead = 0, playing = false, duration = 0;
	var stat = { state: 'idle' }, rtfs = [], working = -1, workStart = 0, lastWindowMs = 0;
	var videoId = '', prepared = null, lookup = Promise.resolve(), wantLive = false, capture = null;

	window.addEventListener('message', function (e) {
		if (!e.data || e.data.sawaVocals !== 'port' || !e.ports[0]) return;
		if (!/^https:\/\/www\.youtube\.com$/.test(e.origin)) return;
		port = e.ports[0];
		port.onmessage = onMsg;
		send({ t: 'hello' });
	});
	function send(m, transfer) { if (port) port.postMessage(m, transfer || []); }
	function status(s) {
		stat = s;
		s.t = 'status';
		send(s);
	}

	function onMsg(e) {
		var m = e.data;
		if (m.t === 'stream') newStream(m.id);
		else if (m.t === 'bytes' && m.id === streamId && parser) parser.push(m.bytes, m.off);
		else if (m.t === 'abort' && m.id === streamId && parser) parser.reset();
		else if (m.t === 'pos') { playhead = m.time; playing = m.playing; duration = m.dur || 0; }
		else if (m.t === 'forget') delete done[m.k];
		else if (m.t === 'video') setVideo(m.id);
		else if (m.t === 'start') { wantLive = true; lookup.then(start); }
		else if (m.t === 'capture') capture = { id: m.id, title: m.title || '' };
		else if (m.t === 'cover?') send({ t: 'cover', ranges: ranges(), complete: !!(duration && config && covered(0, duration)), duration: duration });
		else if (m.t === 'save') save();
		if (m.t === 'bytes' || m.t === 'pos' || m.t === 'start') pump();
	}
	function newStream(id) {
		streamId = id; config = null; times = []; packets = {};
		if (!prepared) done = {};
		parser = new LensWebm.WebmParser(function (c) { config = c; }, function (p) {
			var k = Math.round(p.time * 1e6);
			if (packets[k]) return;
			packets[k] = p;
			// almost always appended in order
			var i = times.length;
			while (i > 0 && times[i - 1] > k) i--;
			times.splice(i, 0, k);
		});
	}
	/** Which video is playing: if it was prepared ahead, its voice is already on this computer. */
	function setVideo(id) {
		if (id === videoId) return;
		videoId = id; done = {}; prepared = null;
		lookup = A.Store.get('voice', id).then(function (rec) {
			if (id !== videoId) return;
			if (rec && Date.now() - rec.createdAt < A.KEEP_DAYS * 864e5) {
				prepared = rec;
				status({ state: 'ready', backend: 'prepared', model: rec.model });
				pump();
			} else if (wantLive) start();
		}, function () { /* no storage: live */ });
	}

	/* ------------------------------------------------------------ model (live) */
	function start() {
		if (prepared || capture) return Promise.resolve();
		if (!loading) loading = A.loadSeparator('live', status).then(function (r) {
			sep = r.sep; backend = r.backend;
			status({ state: 'ready', backend: backend });
			pump();
		}).catch(function (err) {
			status({ state: 'error', msg: String(err && err.message || err) });
			loading = null;
		});
		return loading;
	}

	/* ------------------------------------------------------------ windows ahead of the playhead */
	function covered(a, b) {
		if (!times.length) return false;
		a = Math.max(0, a); if (duration) b = Math.min(b, duration - 0.05);
		var lo = 0, hi = times.length - 1, ka = a * 1e6;
		while (lo < hi) { var mid = (lo + hi + 1) >> 1; if (times[mid] <= ka) lo = mid; else hi = mid - 1; }
		if (times[lo] > ka + 30000) return false;
		var end = times[lo] / 1e6 + packets[times[lo]].dur;
		for (var i = lo + 1; i < times.length && end < b; i++) {
			var t = times[i] / 1e6;
			if (t > end + 0.1) return false;
			end = Math.max(end, t + packets[times[i]].dur);
		}
		return end >= b;
	}
	function stepSec() { return prepared ? PREP : sep.step / SR; }
	function nextWindow() {
		var st = stepSec(), k0 = Math.max(0, Math.floor(playhead / st)), k1 = Math.floor((playhead + AHEAD) / st);
		var dur = prepared ? prepared.duration : duration;
		if (dur) k1 = Math.min(k1, Math.floor(dur / st));
		for (var k = k0; k <= k1; k++) {
			if (done[k]) continue;
			if (prepared) return k;
			var nd = sep.need(k);
			return covered(nd.from / SR, nd.to / SR) ? k : -1 - k; // negative: waiting for YouTube to download it
		}
		return null;
	}
	function list() { return times.map(function (k) { return packets[k]; }); }
	async function pump() {
		if (busy || capture) return;
		if (prepared) return pumpPrepared();
		if (!sep || !config) return;
		var k = nextWindow();
		if (k === null) return;
		if (k < 0) { if (working < 0) status({ state: 'waiting', k: -1 - k }); return; }
		busy = true; working = k; workStart = performance.now();
		try {
			var nd = sep.need(k), pcm = await A.pcm(list(), config, nd.from / SR, nd.to / SR, SR);
			if (!sep) return;
			var w = await sep.window(k, pcm.L, pcm.R);
			var ms = performance.now() - workStart, rtf = ms / 1000 / (sep.step / SR);
			lastWindowMs = ms;
			rtfs.push(rtf); if (rtfs.length > 6) rtfs.shift();
			done[k] = true;
			send({ t: 'win', k: k, start: w.start / SR, sr: SR, L: w.L, R: w.R, ms: Math.round(ms), rtf: rtf, backend: backend }, [w.L.buffer, w.R.buffer]);
			// The first window includes warming up the GPU: judge speed on the next ones.
			var avg = rtfs.slice(1).reduce(function (s, x) { return s + x; }, 0) / Math.max(1, rtfs.length - 1);
			if (rtfs.length >= 3 && avg > MAX_RTF) {
				status({ state: 'slow', rtf: avg, backend: backend });
				sep = null;
				return;
			}
			status({ state: 'ready', backend: backend, rtf: avg || rtf });
		} catch (err) {
			status({ state: 'error', msg: String(err && err.message || err) });
		} finally {
			busy = false; working = -1;
		}
		setTimeout(pump, 0);
	}
	/** A prepared song: decode its stored voice, 10 s at a time. */
	async function pumpPrepared() {
		var rec = prepared, k = nextWindow();
		if (k === null || k < 0) return;
		busy = true; working = k; workStart = performance.now();
		try {
			var a = k * PREP, b = Math.min((k + 1) * PREP, rec.duration + 0.5);
			var p = await A.pcm(rec.chunks, rec.config, a, b);
			if (rec !== prepared) return;
			done[k] = true;
			var L = p.L.slice(), R = p.R.slice();
			send({ t: 'win', k: k, start: a, sr: p.rate, L: L, R: R, ms: Math.round(performance.now() - workStart), rtf: 0, backend: 'prepared' }, [L.buffer, R.buffer]);
		} catch (err) {
			status({ state: 'error', msg: String(err && err.message || err) });
		} finally {
			busy = false; working = -1;
		}
		setTimeout(pump, 0);
	}
	/** Seconds until window k is ready (for "Preparing vocals… 3s"). */
	setInterval(function () {
		if (!sep || working < 0) return;
		var est = lastWindowMs || 2500, left = Math.max(0.5, (est - (performance.now() - workStart)) / 1000);
		send({ t: 'eta', k: working, sec: left });
	}, 500);

	/* ------------------------------------------------------------ capture: keep a whole song's sound for the Prepared songs page */
	async function save() {
		if (!capture || !config) return send({ t: 'saved', ok: false });
		try {
			await A.Store.put('audio', { id: capture.id, title: capture.title, duration: duration, config: config, packets: list(), createdAt: Date.now() });
			send({ t: 'saved', ok: true });
		} catch (e) {
			send({ t: 'saved', ok: false, msg: String(e && e.message || e) });
		}
	}

	// For tests: the page can be driven without YouTube.
	function ranges() {
		var out = [], cur = null;
		times.forEach(function (k) { var t = k / 1e6, e = t + packets[k].dur; if (cur && t <= cur[1] + 0.1) cur[1] = Math.max(cur[1], e); else out.push(cur = [t, e]); });
		return out.map(function (r) { return [+r[0].toFixed(2), +r[1].toFixed(2)]; });
	}
	window.__vocalsEngine = {
		MODEL: A.MODELS.live, ranges: ranges,
		pcmFor: function (from, to) { return A.pcm(list(), config, from / SR, to / SR, SR); },
		get laced() { return parser && parser.laced; }, get sep() { return sep; }, get backend() { return backend; }, get stat() { return stat; }, get prepared() { return !!prepared; }, start: start
	};
})();
