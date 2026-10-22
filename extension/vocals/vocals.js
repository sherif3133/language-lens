/* Vocals only — the engine page. Language Lens puts this page, hidden, inside the YouTube tab
   (content/vocals.js). It receives YouTube's audio bytes, decodes them (WebCodecs), separates the voice
   with the model (sep.js), and sends back the voice in windows of ~11 s, ahead of the playhead.
   Everything stays on this computer: the model is downloaded once (pinned file, checked by SHA-256)
   and kept in this extension's Cache Storage. */
(function () {
	'use strict';
	var SR = 44100, AHEAD = 40; // seconds of voice to prepare ahead of the playhead
	var MODEL = {
		name: 'Spleeter 2-stems (Deezer, MIT licence), fp16 ONNX export by sherpa-onnx',
		cfg: { kind: 'spleeter', nfft: 4096, hop: 1024, frames: 512, files: ['vocals', 'accompaniment'] },
		files: [
			{ url: 'https://huggingface.co/csukuangfj/sherpa-onnx-spleeter-2stems-fp16/resolve/93ba771920ade509f8cbd6825b1a90856c797e08/vocals.fp16.onnx', size: 19681017, sha: '24cef84aedcd1fe87c0b743ef3370ad34dc1fabf6c9014d6128a75a538c7b668' },
			{ url: 'https://huggingface.co/csukuangfj/sherpa-onnx-spleeter-2stems-fp16/resolve/93ba771920ade509f8cbd6825b1a90856c797e08/accompaniment.fp16.onnx', size: 19681024, sha: 'd14cea55793cc531a5875f5f4da08207d1c5ab9292e8e0099a104eecb014fcc0' }
		]
	};
	var MAX_RTF = 0.6; // slower than this (seconds of work per second of song) can't keep up: stop and say so

	var port = null, parser = null, config = null, streamId = 0;
	var times = [], packets = {}; // sorted packet start times; time → packet
	var sep = null, loading = null, backend = '', busy = false, done = {}, playhead = 0, playing = false, duration = 0;
	var stat = { state: 'idle' }, rtfs = [], working = -1, workStart = 0, lastWindowMs = 0;

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
		else if (m.t === 'start') start();
		if (m.t === 'bytes' || m.t === 'pos' || m.t === 'start') pump();
	}
	function newStream(id) {
		streamId = id; config = null; times = []; packets = {}; done = {};
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

	/* ------------------------------------------------------------ model */
	function start() {
		if (!loading) loading = load().then(pump).catch(function (err) {
			status({ state: 'error', msg: String(err && err.message || err) });
			loading = null;
		});
		return loading;
	}
	async function load() {
		var bufs = [], total = MODEL.files.reduce(function (s, f) { return s + f.size; }, 0), got = 0;
		var cache = await caches.open('sawa-vocals-v1');
		for (var i = 0; i < MODEL.files.length; i++) {
			var f = MODEL.files[i], res = await cache.match(f.url), buf;
			if (res) buf = await res.arrayBuffer();
			else {
				status({ state: 'download', progress: got / total, mb: Math.round(total / 1e6) });
				buf = await download(f.url, function (n) { status({ state: 'download', progress: (got + n) / total, mb: Math.round(total / 1e6) }); });
				var hash = hex(await crypto.subtle.digest('SHA-256', buf));
				if (hash !== f.sha) throw new Error('The voice model did not download correctly. Try again.');
				await cache.put(f.url, new Response(buf));
			}
			got += f.size;
			bufs.push(buf);
		}
		status({ state: 'starting' });
		var gpu = false;
		try { gpu = !!(navigator.gpu && await navigator.gpu.requestAdapter()); } catch (e) { gpu = false; }
		ort.env.wasm.wasmPaths = chrome.runtime.getURL('lib/ort/');
		ort.env.wasm.numThreads = 1; // this page isn't cross-origin isolated: no threads
		backend = gpu ? 'webgpu' : 'wasm';
		try {
			sep = await LensSep.createSeparator(ort, MODEL.cfg, bufs, backend);
		} catch (e) {
			if (backend !== 'webgpu') throw e;
			backend = 'wasm';
			sep = await LensSep.createSeparator(ort, MODEL.cfg, bufs, backend);
		}
		status({ state: 'ready', backend: backend });
	}
	async function download(url, progress) {
		var res = await fetch(url, { cache: 'no-store' });
		if (!res.ok || !res.body) throw new Error('Could not download the voice model (' + res.status + ').');
		var reader = res.body.getReader(), parts = [], n = 0, last = 0;
		for (;;) {
			var r = await reader.read();
			if (r.done) break;
			parts.push(r.value); n += r.value.length;
			if (performance.now() - last > 300) { last = performance.now(); progress(n); }
		}
		var out = new Uint8Array(n), p = 0;
		parts.forEach(function (x) { out.set(x, p); p += x.length; });
		return out.buffer;
	}
	function hex(buf) { return Array.from(new Uint8Array(buf)).map(function (b) { return b.toString(16).padStart(2, '0'); }).join(''); }

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
	function nextWindow() {
		var k0 = Math.max(0, Math.floor(playhead * SR / sep.step)), k1 = Math.floor((playhead + AHEAD) * SR / sep.step);
		if (duration) k1 = Math.min(k1, Math.floor(duration * SR / sep.step));
		for (var k = k0; k <= k1; k++) {
			if (done[k]) continue;
			var nd = sep.need(k);
			return covered(nd.from / SR, nd.to / SR) ? k : -1 - k; // negative: waiting for YouTube to download it
		}
		return null;
	}
	async function pump() {
		if (!sep || busy || !config) return;
		var k = nextWindow();
		if (k === null) return;
		if (k < 0) { if (working < 0) status({ state: 'waiting', k: -1 - k }); return; }
		busy = true; working = k; workStart = performance.now();
		try {
			var nd = sep.need(k), pcm = await pcmFor(nd.from, nd.to);
			if (!sep) return;
			var w = await sep.window(k, pcm.L, pcm.R);
			var ms = performance.now() - workStart, rtf = ms / 1000 / (sep.step / SR);
			lastWindowMs = ms;
			rtfs.push(rtf); if (rtfs.length > 6) rtfs.shift();
			done[k] = true;
			send({ t: 'win', k: k, start: w.start / SR, L: w.L, R: w.R, ms: Math.round(ms), rtf: rtf, backend: backend }, [w.L.buffer, w.R.buffer]);
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
	/** Seconds until window k is ready (for "Preparing vocals… 3s"). */
	setInterval(function () {
		if (!sep || working < 0) return;
		var est = lastWindowMs || 2500, left = Math.max(0.5, (est - (performance.now() - workStart)) / 1000);
		send({ t: 'eta', k: working, sec: left });
	}, 500);

	/** Stereo 44.1 kHz samples for timeline samples [from, to): decode the Opus packets (48 kHz) and resample. */
	async function pcmFor(from, to) {
		var n = to - from, a = from / SR, b = to / SR, sr = config.sampleRate || 48000;
		var m = Math.ceil((b - a) * sr) + 1, L48 = new Float32Array(m), R48 = new Float32Array(m);
		var list = [];
		for (var i = 0; i < times.length; i++) {
			var t = times[i] / 1e6;
			if (t >= a - 0.12 && t < b + 0.04) list.push(packets[times[i]]); // a little before: Opus needs to warm up
		}
		if (list.length) await new Promise(function (resolve, reject) {
			var dec = new AudioDecoder({
				output: function (ad) {
					var off = Math.round((ad.timestamp / 1e6 - a) * sr), len = ad.numberOfFrames, ch = ad.numberOfChannels;
					var l = new Float32Array(len), r = new Float32Array(len);
					ad.copyTo(l, { planeIndex: 0, format: 'f32-planar' });
					if (ch > 1) ad.copyTo(r, { planeIndex: 1, format: 'f32-planar' }); else r.set(l);
					ad.close();
					for (var j = 0; j < len; j++) { var q = off + j; if (q >= 0 && q < m) { L48[q] = l[j]; R48[q] = r[j]; } }
				},
				error: reject
			});
			var c = { codec: config.codec, sampleRate: sr, numberOfChannels: config.channels };
			if (config.description) c.description = config.description;
			dec.configure(c);
			list.forEach(function (p) { dec.decode(new EncodedAudioChunk({ type: 'key', timestamp: Math.round(p.time * 1e6), duration: Math.round(p.dur * 1e6), data: p.data })); });
			dec.flush().then(function () { dec.close(); resolve(); }, reject);
		});
		// Before the song starts (window 0): silence.
		var ctx = new OfflineAudioContext(2, n, SR), buf = ctx.createBuffer(2, m, sr);
		buf.copyToChannel(L48, 0); buf.copyToChannel(R48, 1);
		var src = ctx.createBufferSource();
		src.buffer = buf; src.connect(ctx.destination); src.start(0);
		var out = await ctx.startRendering();
		return { L: out.getChannelData(0), R: out.getChannelData(1) };
	}

	// For tests: the page can be driven without YouTube.
	function ranges() {
		var out = [], cur = null;
		times.forEach(function (k) { var t = k / 1e6, e = t + packets[k].dur; if (cur && t <= cur[1] + 0.1) cur[1] = Math.max(cur[1], e); else out.push(cur = [t, e]); });
		return out.map(function (r) { return [+r[0].toFixed(2), +r[1].toFixed(2)]; });
	}
	window.__vocalsEngine = { MODEL: MODEL, pcmFor: pcmFor, ranges: ranges, get laced() { return parser && parser.laced; }, get sep() { return sep; }, get backend() { return backend; }, get stat() { return stat; }, start: start };
})();
