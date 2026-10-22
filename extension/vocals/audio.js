/* Vocals only — shared by the engine page (vocals.js) and the Prepared songs page (prepare.js):
   decoding Opus packets to samples, and the songs kept on this computer (IndexedDB "sawa-vocals").
   Stores: "audio" = a song's sound while it waits to be separated (deleted afterwards);
           "voice" = a prepared song: the singer's voice only, Opus-encoded, with its title and date. */
(function (G) {
	'use strict';

	/** Stereo samples at `rate` for media time [a, b) seconds, from packets [{time, dur, data}] sorted by time. */
	async function pcm(packets, config, a, b, rate) {
		var sr = config.sampleRate || 48000, m = Math.ceil((b - a) * sr) + 1, L = new Float32Array(m), R = new Float32Array(m);
		var list = packets.filter(function (p) { return p.time >= a - 0.12 && p.time < b + 0.04; }); // a little before: Opus needs to warm up
		if (list.length) await new Promise(function (resolve, reject) {
			var dec = new AudioDecoder({
				output: function (ad) {
					var off = Math.round((ad.timestamp / 1e6 - a) * sr), len = ad.numberOfFrames, ch = ad.numberOfChannels;
					var l = new Float32Array(len), r = new Float32Array(len);
					ad.copyTo(l, { planeIndex: 0, format: 'f32-planar' });
					if (ch > 1) ad.copyTo(r, { planeIndex: 1, format: 'f32-planar' }); else r.set(l);
					ad.close();
					for (var j = 0; j < len; j++) { var q = off + j; if (q >= 0 && q < m) { L[q] = l[j]; R[q] = r[j]; } }
				},
				error: reject
			});
			var c = { codec: config.codec || 'opus', sampleRate: sr, numberOfChannels: config.channels || 2 };
			if (config.description) c.description = config.description;
			dec.configure(c);
			list.forEach(function (p) { dec.decode(new EncodedAudioChunk({ type: 'key', timestamp: Math.round(p.time * 1e6), duration: Math.round((p.dur || 0.02) * 1e6), data: p.data })); });
			dec.flush().then(function () { dec.close(); resolve(); }, reject);
		});
		if (!rate || rate === sr) return { L: L.subarray(0, Math.round((b - a) * sr)), R: R.subarray(0, Math.round((b - a) * sr)), rate: sr };
		var n = Math.round((b - a) * rate), ctx = new OfflineAudioContext(2, n, rate), buf = ctx.createBuffer(2, m, sr);
		buf.copyToChannel(L, 0); buf.copyToChannel(R, 1);
		var src = ctx.createBufferSource();
		src.buffer = buf; src.connect(ctx.destination); src.start(0);
		var out = await ctx.startRendering();
		return { L: out.getChannelData(0), R: out.getChannelData(1), rate: rate };
	}

	/* ------------------------------------------------------------ songs kept on this computer */
	var dbp = null;
	function db() {
		if (!dbp) dbp = new Promise(function (resolve, reject) {
			var rq = indexedDB.open('sawa-vocals', 1);
			rq.onupgradeneeded = function () {
				rq.result.createObjectStore('audio', { keyPath: 'id' });
				rq.result.createObjectStore('voice', { keyPath: 'id' });
			};
			rq.onsuccess = function () { resolve(rq.result); };
			rq.onerror = function () { reject(rq.error); };
		});
		return dbp;
	}
	function op(store, mode, fn) {
		return db().then(function (d) {
			return new Promise(function (resolve, reject) {
				var tx = d.transaction(store, mode), rq = fn(tx.objectStore(store));
				tx.oncomplete = function () { resolve(rq && rq.result); };
				tx.onerror = tx.onabort = function () { reject(tx.error); };
			});
		});
	}
	var Store = {
		get: function (store, id) { return op(store, 'readonly', function (s) { return s.get(id); }); },
		put: function (store, rec) { return op(store, 'readwrite', function (s) { return s.put(rec); }); },
		del: function (store, id) { return op(store, 'readwrite', function (s) { return s.delete(id); }); },
		keys: function (store) { return op(store, 'readonly', function (s) { return s.getAllKeys(); }); },
		all: function (store) { return op(store, 'readonly', function (s) { return s.getAll(); }); }
	};

	/* ------------------------------------------------------------ voice models (downloaded once, pinned, SHA-256 checked) */
	var HF = 'https://huggingface.co/';
	var MODELS = {
		// live: fast enough to separate while the song plays (Deezer Spleeter 2-stems, MIT licence)
		live: {
			name: 'Spleeter 2-stems (Deezer, MIT), fp16 ONNX by sherpa-onnx',
			cfg: { kind: 'spleeter', nfft: 4096, hop: 1024, frames: 512, files: ['vocals', 'accompaniment'] },
			files: [
				{ url: HF + 'csukuangfj/sherpa-onnx-spleeter-2stems-fp16/resolve/93ba771920ade509f8cbd6825b1a90856c797e08/vocals.fp16.onnx', size: 19681017, sha: '24cef84aedcd1fe87c0b743ef3370ad34dc1fabf6c9014d6128a75a538c7b668' },
				{ url: HF + 'csukuangfj/sherpa-onnx-spleeter-2stems-fp16/resolve/93ba771920ade509f8cbd6825b1a90856c797e08/accompaniment.fp16.onnx', size: 19681024, sha: 'd14cea55793cc531a5875f5f4da08207d1c5ab9292e8e0099a104eecb014fcc0' }
			]
		},
		// best: less music left, about as slow as the song itself on an ordinary laptop: for preparing songs ahead
		// (UVR MDX-Net Voc_FT, ONNX by sherpa-onnx; the UVR project is MIT, the weights carry no licence of their own)
		best: {
			name: 'UVR MDX-Net Voc_FT, ONNX by sherpa-onnx',
			cfg: { kind: 'mdx', nfft: 7680, hop: 1024, frames: 256, dimF: 3072, files: ['model'] },
			files: [
				{ url: HF + 'k2-fsa/sherpa-onnx-models/resolve/bee11a0c31f3054fa7e73752e59f50d1e05340af/source-separation-models/UVR-MDX-NET-Voc_FT.onnx', size: 66762795, sha: 'e411182ce2c53541fefdcc99a8f46f2fe03978eb22038b9497c1d9d95a00fad4' }
			]
		}
	};
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
	async function hasGpu() {
		try { return !!(navigator.gpu && await navigator.gpu.requestAdapter()); } catch (e) { return false; }
	}
	/** A ready separator for MODELS[name]: {sep, backend}. onStatus({state:'download', progress, mb} | {state:'starting'}). */
	async function loadSeparator(name, onStatus, backend) {
		var M = MODELS[name], bufs = [], total = M.files.reduce(function (s, f) { return s + f.size; }, 0), got = 0;
		var cache = await caches.open('sawa-vocals-v1');
		for (var i = 0; i < M.files.length; i++) {
			var f = M.files[i], res = await cache.match(f.url), buf;
			if (res) buf = await res.arrayBuffer();
			else {
				onStatus({ state: 'download', progress: got / total, mb: Math.round(total / 1e6) });
				buf = await download(f.url, function (n) { onStatus({ state: 'download', progress: (got + n) / total, mb: Math.round(total / 1e6) }); });
				if (hex(await crypto.subtle.digest('SHA-256', buf)) !== f.sha) throw new Error('The voice model did not download correctly. Try again.');
				await cache.put(f.url, new Response(buf));
			}
			got += f.size;
			bufs.push(buf);
		}
		onStatus({ state: 'starting' });
		ort.env.wasm.wasmPaths = chrome.runtime.getURL('lib/ort/');
		ort.env.wasm.numThreads = 1; // extension pages here aren't cross-origin isolated: no threads
		backend = backend || ((await hasGpu()) ? 'webgpu' : 'wasm');
		try {
			return { sep: await LensSep.createSeparator(ort, M.cfg, bufs, backend), backend: backend };
		} catch (e) {
			if (backend !== 'webgpu') throw e;
			return { sep: await LensSep.createSeparator(ort, M.cfg, bufs, 'wasm'), backend: 'wasm' };
		}
	}

	G.LensAudio = { pcm: pcm, Store: Store, KEEP_DAYS: 30, MODELS: MODELS, loadSeparator: loadSeparator, hasGpu: hasGpu };
})(typeof globalThis !== 'undefined' ? globalThis : self);
