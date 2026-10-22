/* Vocals only — runs in YouTube's own page (MAIN world, document_start, computers only).
   YouTube feeds the <video> through Media Source Extensions and downloads the sound ahead of playback.
   We keep a copy of the audio bytes it appends (Opus in WebM, ~1 MB a minute) so the separation model can
   work on sound that hasn't played yet: the voice is then ready on time and the video doesn't need delaying.
   Nothing is sent anywhere: the bytes stay in this tab and go only to Language Lens's own page in the tab
   (content/vocals.js → vocals/vocals.html), and only while "Vocals only" is on. */
(function () {
	'use strict';
	if (window.__sawaVocalsMain || !window.MediaSource || !window.SourceBuffer) return;
	window.__sawaVocalsMain = true;
	var MAX = 24 * 1024 * 1024; // bytes kept per page (~20 minutes of audio)
	var streams = []; // {id, ms, mime, chunks: [{bytes|ev}], size}
	var nextId = 1, armed = false, sent = null; // sent: the stream being forwarded and how far
	var urls = new WeakMap(); // MediaSource → its blob: URL

	var createURL = URL.createObjectURL;
	URL.createObjectURL = function (o) {
		var u = createURL.apply(this, arguments);
		try { if (o instanceof MediaSource) urls.set(o, u); } catch (e) { /* not ours */ }
		return u;
	};
	var addSB = MediaSource.prototype.addSourceBuffer;
	MediaSource.prototype.addSourceBuffer = function (mime) {
		var sb = addSB.apply(this, arguments);
		try {
			if (/^audio\//i.test(mime)) {
				var st = { id: nextId++, ms: this, mime: String(mime), chunks: [], size: 0 };
				sb.__sawaStream = st;
				streams.push(st);
				while (streams.length > 6) streams.shift();
			}
		} catch (e) { /* keep YouTube working whatever happens */ }
		return sb;
	};
	function push(st, c) {
		st.chunks.push(c);
		st.size += c.bytes ? c.bytes.byteLength : 0;
		var total = streams.reduce(function (s, x) { return s + x.size; }, 0);
		while (total > MAX) {
			var old = streams.find(function (x) { return x.size > 0; });
			var gone = old.chunks.shift();
			var n = gone.bytes ? gone.bytes.byteLength : 0;
			old.size -= n; total -= n;
			if (sent && sent.st === old) sent.i = Math.max(0, sent.i - 1);
			if (!gone.bytes && !old.chunks.length) break;
		}
		if (armed) flush();
	}
	var append = SourceBuffer.prototype.appendBuffer;
	SourceBuffer.prototype.appendBuffer = function (data) {
		try {
			var st = this.__sawaStream;
			if (st) {
				var u = data instanceof ArrayBuffer ? new Uint8Array(data) : new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
				var c = { bytes: u.slice(), off: this.timestampOffset || 0 };
				if (u[0] === 0x1a && u[1] === 0x45 && u[2] === 0xdf && u[3] === 0xa3) st.init = c; // the WebM header: codec settings
				push(st, c);
			}
		} catch (e) { /* ignore */ }
		return append.apply(this, arguments);
	};
	// A seek makes YouTube abort the half-parsed download: the next bytes start a fresh cluster.
	var abort = SourceBuffer.prototype.abort;
	SourceBuffer.prototype.abort = function () {
		try { if (this.__sawaStream) push(this.__sawaStream, { ev: 'abort' }); } catch (e) { /* ignore */ }
		return abort.apply(this, arguments);
	};

	/** The stream that feeds the main player's <video> now (ads use their own). */
	function current() {
		var v = document.querySelector('#movie_player video');
		if (!v) return null;
		for (var i = streams.length - 1; i >= 0; i--) {
			var ms = streams[i].ms;
			if (v.srcObject === ms || (urls.get(ms) && urls.get(ms) === v.src)) return streams[i];
		}
		return null;
	}
	function post(m) {
		m.source = 'sawa-lens-vocals-main';
		window.postMessage(m, location.origin);
	}
	function flush() {
		var st = current();
		if (!st) return;
		if (!sent || sent.st !== st) {
			sent = { st: st, i: 0 };
			post({ type: 'stream', id: st.id, mime: st.mime });
			if (st.init && st.chunks[0] !== st.init) post({ type: 'bytes', id: st.id, bytes: st.init.bytes, off: st.init.off });
		}
		while (sent.i < st.chunks.length) {
			var c = st.chunks[sent.i++];
			post(c.bytes ? { type: 'bytes', id: st.id, bytes: c.bytes, off: c.off } : { type: 'abort', id: st.id });
		}
	}
	window.addEventListener('message', function (e) {
		if (e.source !== window || !e.data || e.data.source !== 'sawa-lens-vocals') return;
		if (e.data.type === 'arm') { armed = true; sent = null; flush(); }
		else if (e.data.type === 'disarm') { armed = false; sent = null; }
	});
	// The player switches streams (ad → video, next video): notice it while armed.
	setInterval(function () { if (armed) flush(); }, 1000);
})();
