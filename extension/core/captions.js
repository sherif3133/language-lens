/*
 * Captions → full sentences (Language Lens 0.8.2).
 * YouTube sends captions in short timed pieces ("moment when you're not thinking about"), often the middle of a
 * sentence. These functions join the pieces into sentences and keep a map back, so the translation and the
 * phrase underlines are worked out on the whole sentence and then shown on the piece that is on screen.
 * Plain functions, no DOM: used by content/yt.js and tested by tools/captions-test.js and tools/mobile-test.js.
 */
(function (root) {
	var ABBR = /^(mr|mrs|ms|dr|st|vs|etc|e\.g|i\.e|jr|sr|prof|no)\.$/i;
	var END = /[.!?]["')\]]*$/;

	/**
	 * Sentences with timings from caption lines [{start, end, text, words?}] (words = auto-caption word timings).
	 * Hand-made captions: split on . ! ? (not "Mr." etc.). Auto captions often lack punctuation: then split on
	 * pauses, keeping ideas together (about 6–28 words), and not right after "the", "about", "and"…
	 * R = the "sentences" rules from the server (sawa-lens /rules), so they can be tuned without a new zip.
	 * Each sentence: {start, end, text, parts: [{ci: caption index, co: offset in that caption, so: offset in the sentence, n: length}]}.
	 */
	function sentences(cues, asr, R) {
		R = R || {};
		var num = function (k, d) { return typeof R[k] === 'number' ? R[k] : d; };
		var noEnd = {};
		(R.noEndAfter || []).forEach(function (w) { noEnd[w] = 1; });
		var words = [];
		cues.forEach(function (c, ci) {
			if (c.words) {
				var at = 0;
				c.words.forEach(function (w) {
					var o = c.text.indexOf(w.text, at);
					if (o < 0) o = at;
					at = o + w.text.length;
					words.push({ t: w.t, text: w.text, cueEnd: c.end, gapAfter: 0, ci: ci, co: o });
				});
			} else {
				var parts = c.text.split(' '), len = c.text.length, pos = 0;
				parts.forEach(function (p) {
					words.push({ t: c.start + Math.round((pos / Math.max(1, len)) * (c.end - c.start)), text: p, cueEnd: c.end, ci: ci, co: pos });
					pos += p.length + 1;
				});
			}
		});
		words = words.filter(function (w) { return w.text && !/^[\[(][^\])]*[\])]$/.test(w.text); }); // drop (Laughter), [Music]
		for (var i = 0; i < words.length; i++) words[i].gapAfter = i + 1 < words.length ? words[i + 1].t - words[i].t : 0;
		var punct = words.filter(function (w) { return END.test(w.text); }).length;
		var usePunct = punct >= words.length / 40;
		var out = [], cur = [];
		function flush(endT) {
			if (!cur.length) return;
			var text = '', parts = [];
			cur.forEach(function (w) {
				if (text && !/^[,.!?;:]/.test(w.text)) text += ' ';
				parts.push({ ci: w.ci, co: w.co, so: text.length, n: w.text.length });
				text += w.text;
			});
			if (/[A-Za-z]/.test(text)) out.push({ start: cur[0].t, end: endT, text: text, parts: parts });
			cur = [];
		}
		for (var k = 0; k < words.length; k++) {
			var w = words[k], next = words[k + 1];
			cur.push(w);
			var endT = next ? next.t : w.cueEnd;
			var ends = false;
			if (usePunct) {
				ends = END.test(w.text) && !ABBR.test(w.text) && cur.length >= 3 && (!next || /^["'(\[]?[A-Z0-9]/.test(next.text));
				if (!ends && cur.length >= num('longPunctWords', 45) && /[,;:]$/.test(w.text)) ends = true; // very long: break at a comma
			} else {
				var low = w.text.toLowerCase().replace(/’/g, "'");
				ends = (cur.length >= num('minWords', 6) && w.gapAfter > num('pauseMs', 700)) || (cur.length >= num('midWords', 14) && w.gapAfter > num('shortPauseMs', 350)) || cur.length >= num('maxWords', 28);
				// "…you're not thinking about | the moment…": a sentence doesn't end on "about", "the", "and".
				if (ends && noEnd[low] && cur.length < num('hardMaxWords', 36)) ends = false;
			}
			if (ends || !next) flush(endT);
		}
		return out;
	}

	/** For each of n caption lines, its words' places in the sentences: [[{s, so, co, n}, …], …], in order. */
	function cueParts(n, sents) {
		var m = [];
		for (var i = 0; i < n; i++) m.push([]);
		sents.forEach(function (st, si) {
			(st.parts || []).forEach(function (p) { if (m[p.ci]) m[p.ci].push({ s: si, so: p.so, co: p.co, n: p.n }); });
		});
		return m;
	}

	/**
	 * Word tokens for one caption line (text), taken from its sentences' tokens (sentToks[s] = [{start, end, ex?…}]):
	 * an expression split over two caption lines ("give | up") is underlined on both pieces, as one phrase.
	 * Returns null when there is nothing to map (the caller keeps the line's own analysis).
	 */
	function cueToks(parts, sentToks, text) {
		if (!parts || !parts.length || !sentToks) return null;
		var out = [], last = null;
		parts.forEach(function (p) {
			var toks = sentToks[p.s] || [];
			for (var k = 0; k < toks.length; k++) {
				var t = toks[k];
				if (t.end <= p.so || t.start >= p.so + p.n) continue;
				var a = p.co + Math.max(t.start, p.so) - p.so, b = p.co + Math.min(t.end, p.so + p.n) - p.so;
				if (last && last.s === p.s && last.k === k) { last.tok.end = b; last.tok.text = text.slice(last.tok.start, b); continue; } // one expression over several words
				var nt = Object.assign({}, t, { start: a, end: b, text: text.slice(a, b) });
				out.push(nt);
				last = { s: p.s, k: k, tok: nt };
			}
		});
		return out;
	}

	/** The sentence heard at ms for a caption line (a line can hold the end of one sentence and the start of the next). */
	function sentenceAt(parts, sents, ms) {
		if (!parts || !parts.length) return -1;
		var first = parts[0].s, last = parts[parts.length - 1].s;
		for (var j = last; j > first; j--) if (sents[j].start <= ms) return j;
		return first;
	}

	root.LensCaptions = { sentences: sentences, cueParts: cueParts, cueToks: cueToks, sentenceAt: sentenceAt };
})(typeof window !== 'undefined' ? window : globalThis);
