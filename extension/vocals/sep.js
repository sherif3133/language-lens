/* Vocals only — the separation engine.
   Splits stereo 44.1 kHz music into the singer's voice with a source-separation model running in
   onnxruntime-web (WebGPU, or WASM when that is fast enough). The models work on spectrograms:
   STFT here → model → inverse STFT. Used by vocals.js (the hidden page inside YouTube) and by tools/vocals-test.js.
   Two model families:
   - "mdx":      UVR MDX-Net vocal models. In: [1, 4, dim_f, dim_t] (L re, L im, R re, R im). Out: the vocals' spectrogram.
   - "spleeter": Deezer Spleeter 2-stems. In: magnitudes [2, 1, 512, 1024]. Two models (vocals, accompaniment) → soft mask. */
(function (G) {
	'use strict';

	/* ------------------------------------------------------------ FFT (complex, mixed radix 2/3/4/5) */
	function makeFFT(n) {
		var factors = [], m = n;
		[4, 2, 3, 5].forEach(function (p) { while (m % p === 0) { factors.push(p); m /= p; } });
		if (m !== 1) throw new Error('FFT size not supported: ' + n);
		var twr = new Float64Array(n), twi = new Float64Array(n);
		for (var i = 0; i < n; i++) { var a = -2 * Math.PI * i / n; twr[i] = Math.cos(a); twi[i] = Math.sin(a); }
		var tr = new Float64Array(5), ti = new Float64Array(5);

		function rec(inR, inI, inOff, stride, outR, outI, outOff, len, fi) {
			var p = factors[fi], sub = len / p, q, k, s;
			if (sub === 1) for (q = 0; q < p; q++) { outR[outOff + q] = inR[inOff + q * stride]; outI[outOff + q] = inI[inOff + q * stride]; }
			else for (q = 0; q < p; q++) rec(inR, inI, inOff + q * stride, stride * p, outR, outI, outOff + q * sub, sub, fi + 1);
			var step = n / len, pstep = n / p, o = outOff;
			if (p === 4) {
				for (k = 0; k < sub; k++) {
					var i0 = o + k, i1 = i0 + sub, i2 = i1 + sub, i3 = i2 + sub, w1 = k * step, w2 = 2 * w1, w3 = 3 * w1;
					var t1r = outR[i1] * twr[w1] - outI[i1] * twi[w1], t1i = outR[i1] * twi[w1] + outI[i1] * twr[w1];
					var t2r = outR[i2] * twr[w2] - outI[i2] * twi[w2], t2i = outR[i2] * twi[w2] + outI[i2] * twr[w2];
					var t3r = outR[i3] * twr[w3] - outI[i3] * twi[w3], t3i = outR[i3] * twi[w3] + outI[i3] * twr[w3];
					var ar = outR[i0] + t2r, ai = outI[i0] + t2i, br = outR[i0] - t2r, bi = outI[i0] - t2i;
					var cr = t1r + t3r, ci = t1i + t3i, dr = t1r - t3r, di = t1i - t3i;
					outR[i0] = ar + cr; outI[i0] = ai + ci;
					outR[i1] = br + di; outI[i1] = bi - dr;
					outR[i2] = ar - cr; outI[i2] = ai - ci;
					outR[i3] = br - di; outI[i3] = bi + dr;
				}
				return;
			}
			if (p === 2) {
				for (k = 0; k < sub; k++) {
					var j0 = o + k, j1 = j0 + sub, u = k * step;
					var ur = outR[j1] * twr[u] - outI[j1] * twi[u], ui = outR[j1] * twi[u] + outI[j1] * twr[u];
					outR[j1] = outR[j0] - ur; outI[j1] = outI[j0] - ui;
					outR[j0] += ur; outI[j0] += ui;
				}
				return;
			}
			for (k = 0; k < sub; k++) {
				for (q = 0; q < p; q++) {
					var idx = outOff + q * sub + k, w = (q * k * step) % n, xr = outR[idx], xi = outI[idx];
					tr[q] = xr * twr[w] - xi * twi[w];
					ti[q] = xr * twi[w] + xi * twr[w];
				}
				for (s = 0; s < p; s++) {
					var sr = 0, si = 0;
					for (q = 0; q < p; q++) {
						var v = ((q * s) % p) * pstep;
						sr += tr[q] * twr[v] - ti[q] * twi[v];
						si += tr[q] * twi[v] + ti[q] * twr[v];
					}
					outR[outOff + k + s * sub] = sr;
					outI[outOff + k + s * sub] = si;
				}
			}
		}
		return {
			n: n,
			/** out = FFT(in); in and out must be different arrays. */
			forward: function (inR, inI, outR, outI) { rec(inR, inI, 0, 1, outR, outI, 0, n, 0); }
		};
	}

	/* ------------------------------------------------------------ STFT of a stereo pair, packed in one complex FFT */
	function Stft(nfft, hop) {
		this.n = nfft; this.hop = hop; this.bins = nfft / 2 + 1;
		this.fft = makeFFT(nfft);
		var w = this.win = new Float64Array(nfft);
		for (var i = 0; i < nfft; i++) w[i] = 0.5 - 0.5 * Math.cos(2 * Math.PI * i / nfft); // periodic Hann
		this.ar = new Float64Array(nfft); this.ai = new Float64Array(nfft);
		this.br = new Float64Array(nfft); this.bi = new Float64Array(nfft);
	}
	/** Frames centred on j*hop of y (y already holds n/2 samples of context on each side).
	    Returns {lr, li, rr, ri}: Float32Array[frames * bins], frame-major. */
	Stft.prototype.forward = function (L, R, frames) {
		var n = this.n, bins = this.bins, w = this.win, ar = this.ar, ai = this.ai, br = this.br, bi = this.bi;
		var out = { lr: new Float32Array(frames * bins), li: new Float32Array(frames * bins), rr: new Float32Array(frames * bins), ri: new Float32Array(frames * bins) };
		for (var j = 0; j < frames; j++) {
			var o = j * this.hop, i;
			for (i = 0; i < n; i++) { ar[i] = L[o + i] * w[i]; ai[i] = R[o + i] * w[i]; }
			this.fft.forward(ar, ai, br, bi);
			var b = j * bins;
			for (var k = 0; k < bins; k++) {
				var nk = k === 0 ? 0 : n - k, zr = br[k], zi = bi[k], cr = br[nk], ci = -bi[nk];
				out.lr[b + k] = (zr + cr) / 2; out.li[b + k] = (zi + ci) / 2;
				// (Z - conj(Z[n-k])) / 2i
				out.rr[b + k] = (zi - ci) / 2; out.ri[b + k] = -(zr - cr) / 2;
			}
		}
		return out;
	};
	/** Overlap-add back to stereo samples. Length (frames-1)*hop + n; sample 0 = the first frame's start. */
	Stft.prototype.inverse = function (S, frames) {
		var n = this.n, bins = this.bins, w = this.win, ar = this.ar, ai = this.ai, br = this.br, bi = this.bi;
		var len = (frames - 1) * this.hop + n, L = new Float32Array(len), R = new Float32Array(len), ws = new Float32Array(len);
		for (var j = 0; j < frames; j++) {
			var b = j * bins, k;
			for (k = 0; k < bins; k++) {
				// Y = Lk + i*Rk, conjugate-symmetric halves give back two real signals
				ar[k] = S.lr[b + k] - S.ri[b + k]; ai[k] = S.li[b + k] + S.rr[b + k];
				if (k > 0 && k < n / 2) { ar[n - k] = S.lr[b + k] + S.ri[b + k]; ai[n - k] = -S.li[b + k] + S.rr[b + k]; }
			}
			// inverse FFT = conj(FFT(conj(x))) / n
			for (k = 0; k < n; k++) ai[k] = -ai[k];
			this.fft.forward(ar, ai, br, bi);
			var o = j * this.hop;
			for (k = 0; k < n; k++) {
				L[o + k] += br[k] / n * w[k];
				R[o + k] += -bi[k] / n * w[k];
				ws[o + k] += w[k] * w[k];
			}
		}
		for (var i = 0; i < len; i++) if (ws[i] > 1e-8) { L[i] /= ws[i]; R[i] /= ws[i]; }
		return { L: L, R: R };
	};

	/* ------------------------------------------------------------ the models */
	var MODELS = {
		// Spleeter 2-stems (Deezer, MIT licence, weights included), fp16 export by sherpa-onnx.
		spleeter: { kind: 'spleeter', nfft: 4096, hop: 1024, frames: 512, files: ['vocals', 'accompaniment'] },
		// UVR MDX-Net vocal models (sherpa-onnx exports). 9482 and KARA: n_fft 4096, dim_f 2048.
		mdx: { kind: 'mdx', nfft: 4096, hop: 1024, frames: 256, dimF: 2048, files: ['model'] }
	};

	/** cfg: MODELS entry (+ overrides). sessions: {vocals, accompaniment} or {model}: ort.InferenceSession. */
	function Separator(ort, cfg, sessions, opts) {
		opts = opts || {};
		this.ort = ort; this.cfg = cfg; this.s = sessions;
		this.stft = new Stft(cfg.nfft, cfg.hop);
		this.seg = cfg.hop * (cfg.frames - 1); // samples the model sees (frame centres)
		this.margin = opts.margin != null ? opts.margin : 11025; // dropped at each edge: the model hears less context there
		this.xf = opts.xf != null ? opts.xf : 4410; // crossfade between neighbouring windows
		this.body = this.seg - cfg.nfft - 2 * this.margin; // samples a window gives back
		this.step = this.body - this.xf; // windows start every `step` samples
		this.half = this.f16 = false;
	}
	/** Input range a window needs (timeline samples, 44.1 kHz): [from, to). */
	Separator.prototype.need = function (k) {
		var from = k * this.step - this.margin - this.cfg.nfft;
		return { from: from, to: from + this.seg + this.cfg.nfft };
	};
	/** Window k: y = stereo input for need(k). Returns {L, R, start} with `start` in timeline samples,
	    faded in/out over the crossfade so neighbouring windows add up. */
	Separator.prototype.window = async function (k, L, R) {
		var c = this.cfg, F = c.frames, bins = this.stft.bins;
		var S = this.stft.forward(L, R, F);
		var t0 = performance.now();
		if (c.kind === 'mdx') await this.runMdx(S, F, bins);
		else await this.runSpleeter(S, F, bins);
		this.lastModelMs = performance.now() - t0;
		var y = this.stft.inverse(S, F);
		// y sample 0 = input sample 0; the body starts after n/2 (centre padding) + n/2 (model edge) + margin
		var off = c.nfft + this.margin, n = this.body;
		var oL = y.L.slice(off, off + n), oR = y.R.slice(off, off + n), xf = this.xf;
		for (var i = 0; i < xf; i++) {
			var g = (i + 0.5) / xf;
			if (k > 0) { oL[i] *= g; oR[i] *= g; }
			oL[n - 1 - i] *= g; oR[n - 1 - i] *= g;
		}
		return { L: oL, R: oR, start: k * this.step };
	};
	Separator.prototype.tensor = function (data, dims) {
		var t = this.ort;
		if (!this.f16) return new t.Tensor('float32', data, dims);
		var h = new Uint16Array(data.length);
		for (var i = 0; i < data.length; i++) h[i] = toHalf(data[i]);
		return new t.Tensor('float16', h, dims);
	};
	Separator.prototype.read = function (t) {
		if (t.type !== 'float16') return t.data;
		var d = t.data, f = new Float32Array(d.length);
		for (var i = 0; i < d.length; i++) f[i] = fromHalf(d[i]);
		return f;
	};
	Separator.prototype.runMdx = async function (S, F, bins) {
		var D = this.cfg.dimF, x = new Float32Array(4 * D * F), parts = [S.lr, S.li, S.rr, S.ri], c, f, t;
		for (c = 0; c < 4; c++) for (f = 0; f < D; f++) for (t = 0; t < F; t++) x[(c * D + f) * F + t] = parts[c][t * bins + f];
		var sess = this.s.model, feeds = {};
		feeds[sess.inputNames[0]] = this.tensor(x, [1, 4, D, F]);
		var out = await sess.run(feeds), y = this.read(out[sess.outputNames[0]]);
		for (c = 0; c < 4; c++) {
			var p = parts[c];
			for (t = 0; t < F; t++) {
				for (f = 0; f < D; f++) p[t * bins + f] = y[(c * D + f) * F + t];
				for (f = D; f < bins; f++) p[t * bins + f] = 0;
			}
		}
	};
	Separator.prototype.runSpleeter = async function (S, F, bins) {
		var B = 1024, x = new Float32Array(2 * F * B), t, f, i;
		for (t = 0; t < F; t++) for (f = 0; f < B; f++) {
			var a = t * bins + f;
			x[t * B + f] = Math.hypot(S.lr[a], S.li[a]);
			x[F * B + t * B + f] = Math.hypot(S.rr[a], S.ri[a]);
		}
		var P = this.cfg.power || 2, dims = [2, 1, F, B], v = this.s.vocals, a2 = this.s.accompaniment, fv = {}, fa = {};
		fv[v.inputNames[0]] = this.tensor(x, dims);
		fa[a2.inputNames[0]] = this.tensor(x, dims);
		var ov = await v.run(fv), oa = await a2.run(fa);
		var V = this.read(ov[v.outputNames[0]]), A = this.read(oa[a2.outputNames[0]]);
		for (i = 0; i < 2; i++) {
			var re = i ? S.rr : S.lr, im = i ? S.ri : S.li;
			for (t = 0; t < F; t++) {
				for (f = 0; f < B; f++) {
					var j = i * F * B + t * B + f, vv = Math.pow(V[j], P), m = (vv + 5e-11) / (vv + Math.pow(A[j], P) + 1e-10), q = t * bins + f;
					re[q] *= m; im[q] *= m;
				}
				for (f = B; f < bins; f++) { re[t * bins + f] = 0; im[t * bins + f] = 0; }
			}
		}
	};

	/* half floats, for models whose inputs are float16 */
	var f32 = new Float32Array(1), u32 = new Uint32Array(f32.buffer);
	function toHalf(v) {
		f32[0] = v;
		var x = u32[0], s = (x >>> 16) & 0x8000, e = ((x >>> 23) & 0xff) - 112, m = x & 0x7fffff;
		if (e <= 0) return s;
		if (e >= 31) return s | 0x7c00;
		return s | (e << 10) | ((m + 0x1000) >>> 13);
	}
	function fromHalf(h) {
		var s = h & 0x8000 ? -1 : 1, e = (h >>> 10) & 0x1f, m = h & 0x3ff;
		if (e === 0) return s * m * 5.960464477539063e-8;
		if (e === 31) return m ? NaN : s * Infinity;
		return s * (1 + m / 1024) * Math.pow(2, e - 15);
	}

	/** Create sessions from model bytes (ArrayBuffers) on the given execution provider. */
	async function createSeparator(ort, cfg, buffers, ep, opts) {
		var sessions = {}, names = cfg.files;
		for (var i = 0; i < names.length; i++) {
			sessions[names[i]] = await ort.InferenceSession.create(new Uint8Array(buffers[i]), { executionProviders: [ep], graphOptimizationLevel: 'all' });
		}
		var sep = new Separator(ort, cfg, sessions, opts), first = sessions[names[0]];
		var meta = first.inputMetadata && first.inputMetadata[0];
		sep.f16 = !!(meta && meta.type === 'float16');
		return sep;
	}

	G.LensSep = { makeFFT: makeFFT, Stft: Stft, Separator: Separator, createSeparator: createSeparator, MODELS: MODELS };
})(typeof globalThis !== 'undefined' ? globalThis : self);
