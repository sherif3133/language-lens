/* Vocals only — reads Opus audio packets (with their times) out of the WebM bytes YouTube downloads.
   The bytes arrive in pieces of any size, so this is a streaming parser: it keeps the unfinished tail
   and continues when more arrives. After a seek (abort) it looks for the next Cluster. */
(function (G) {
	'use strict';
	var EBML = 0x1a45dfa3, SEGMENT = 0x18538067, CLUSTER = 0x1f43b675, INFO = 0x1549a966, TRACKS = 0x1654ae6b,
		TIMECODE = 0xe7, SIMPLEBLOCK = 0xa3, BLOCKGROUP = 0xa0, BLOCK = 0xa1;
	var CONTAINERS = {};
	CONTAINERS[SEGMENT] = CONTAINERS[CLUSTER] = CONTAINERS[BLOCKGROUP] = 1;

	/** onConfig({codec, sampleRate, channels, description}), onPacket({time (s), dur (s), data}) */
	function WebmParser(onConfig, onPacket) {
		this.onConfig = onConfig; this.onPacket = onPacket;
		this.buf = new Uint8Array(0); this.skip = 0; this.sync = true;
		this.scale = 1e6; this.track = 0; this.cluster = 0; this.off = 0; this.laced = 0;
	}
	function vint(b, p, keepMarker) {
		var first = b[p];
		if (first === undefined) return null;
		var len = 1, mask = 0x80;
		while (len <= 8 && !(first & mask)) { len++; mask >>= 1; }
		if (len > 8) return { bad: true };
		if (p + len > b.length) return null;
		var v = keepMarker ? first : first & (mask - 1), allOnes = (first & (mask - 1)) === mask - 1;
		for (var i = 1; i < len; i++) { v = v * 256 + b[p + i]; if (b[p + i] !== 0xff) allOnes = false; }
		return { v: v, len: len, unknown: !keepMarker && allOnes };
	}
	function uint(b, p, n) { var v = 0; for (var i = 0; i < n; i++) v = v * 256 + b[p + i]; return v; }
	/** Children of a fully loaded element: [{id, start, size}] */
	function children(b, p, end) {
		var out = [];
		while (p < end) {
			var id = vint(b, p, true); if (!id || id.bad) break;
			var sz = vint(b, p + id.len); if (!sz || sz.bad) break;
			var s = p + id.len + sz.len;
			out.push({ id: id.v, start: s, size: sz.v });
			p = s + sz.v;
		}
		return out;
	}

	WebmParser.prototype.reset = function () { this.buf = new Uint8Array(0); this.skip = 0; this.sync = true; };
	WebmParser.prototype.push = function (bytes, off) {
		if (off != null) this.off = off;
		var b;
		if (this.skip) {
			var n = Math.min(this.skip, bytes.length);
			this.skip -= n; bytes = bytes.subarray(n);
			if (!bytes.length) return;
		}
		if (this.buf.length) { b = new Uint8Array(this.buf.length + bytes.length); b.set(this.buf); b.set(bytes, this.buf.length); } else b = bytes;
		var p = 0;
		for (;;) {
			if (this.sync) {
				var f = find(b, p);
				if (f < 0) { p = Math.max(p, b.length - 3); break; }
				p = f; this.sync = false;
			}
			var id = vint(b, p, true);
			if (!id) break;
			if (id.bad) { this.sync = true; p++; continue; }
			var sz = vint(b, p + id.len);
			if (!sz) break;
			if (sz.bad) { this.sync = true; p++; continue; }
			var start = p + id.len + sz.len;
			if (CONTAINERS[id.v]) { p = start; continue; }
			if (sz.unknown) { this.sync = true; p++; continue; }
			if (id.v !== SIMPLEBLOCK && id.v !== BLOCK && id.v !== TIMECODE && id.v !== INFO && id.v !== TRACKS && id.v !== EBML) {
				// not needed: skip it, even if its bytes haven't all arrived yet
				if (start + sz.v > b.length) { this.skip = start + sz.v - b.length; p = b.length; break; }
				p = start + sz.v; continue;
			}
			if (sz.v > 4e6) { this.sync = true; p++; continue; }
			if (start + sz.v > b.length) break; // wait for the rest
			this.element(id.v, b, start, sz.v);
			p = start + sz.v;
		}
		this.buf = b.slice(p);
	};
	function find(b, p) {
		for (var i = p; i + 3 < b.length; i++) {
			if ((b[i] === 0x1f && b[i + 1] === 0x43 && b[i + 2] === 0xb6 && b[i + 3] === 0x75) || (b[i] === 0x1a && b[i + 1] === 0x45 && b[i + 2] === 0xdf && b[i + 3] === 0xa3)) return i;
		}
		return -1;
	}
	WebmParser.prototype.element = function (id, b, s, n) {
		if (id === EBML) this.cluster = 0;
		else if (id === TIMECODE) this.cluster = uint(b, s, n);
		else if (id === INFO) {
			children(b, s, s + n).forEach(function (c) { if (c.id === 0x2ad7b1) this.scale = uint(b, c.start, c.size); }, this);
		} else if (id === TRACKS) {
			children(b, s, s + n).forEach(function (t) {
				if (t.id !== 0xae) return;
				var cfg = { codec: '', sampleRate: 48000, channels: 2, description: null, num: 0 };
				children(b, t.start, t.start + t.size).forEach(function (c) {
					if (c.id === 0xd7) cfg.num = uint(b, c.start, c.size);
					else if (c.id === 0x86) cfg.codec = String.fromCharCode.apply(null, b.subarray(c.start, c.start + c.size));
					else if (c.id === 0x63a2) cfg.description = b.slice(c.start, c.start + c.size);
					else if (c.id === 0xe1) children(b, c.start, c.start + c.size).forEach(function (a) {
						if (a.id === 0x9f) cfg.channels = uint(b, a.start, a.size);
						else if (a.id === 0xb5) cfg.sampleRate = new DataView(b.buffer, b.byteOffset + a.start, a.size)[a.size === 4 ? 'getFloat32' : 'getFloat64'](0);
					});
				});
				if (!/^A_/.test(cfg.codec)) return;
				this.track = cfg.num;
				this.onConfig({ codec: cfg.codec === 'A_OPUS' ? 'opus' : cfg.codec, sampleRate: cfg.sampleRate, channels: cfg.channels, description: cfg.description });
			}, this);
		} else if (id === SIMPLEBLOCK || id === BLOCK) {
			var tn = vint(b, s);
			if (!tn || tn.bad || (this.track && tn.v !== this.track)) return;
			var q = s + tn.len, rel = (b[q] << 8 | b[q + 1]) << 16 >> 16, flags = b[q + 2];
			if (flags & 0x06) { this.laced++; return; } // YouTube's Opus is never laced
			var data = b.slice(q + 3, s + n), time = (this.cluster + rel) * this.scale / 1e9 + this.off;
			this.onPacket({ time: time, dur: opusDur(data), data: data });
		}
	};
	/** Length of an Opus packet from its TOC byte (RFC 6716 §3.1). */
	function opusDur(d) {
		if (!d.length) return 0.02;
		var c = d[0] >> 3, f;
		if (c < 12) f = [0.01, 0.02, 0.04, 0.06][c & 3];
		else if (c < 16) f = [0.01, 0.02][c & 1];
		else f = [0.0025, 0.005, 0.01, 0.02][c & 3];
		var k = d[0] & 3, frames = k === 0 ? 1 : k < 3 ? 2 : (d[1] & 0x3f);
		return f * frames;
	}

	G.LensWebm = { WebmParser: WebmParser, opusDur: opusDur };
})(typeof globalThis !== 'undefined' ? globalThis : self);
