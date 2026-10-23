/* Language Lens: helpers shared by the YouTube and web-page scripts. */
(function () {
	'use strict';
	if (window.LensUI) return;

	function send(type, data) {
		return new Promise(function (resolve, reject) {
			try {
				chrome.runtime.sendMessage(Object.assign({ type: type }, data || {}), function (res) {
					if (chrome.runtime.lastError) return reject(new Error('reload'));
					if (!res) return reject(new Error('error'));
					return res.ok ? resolve(res.data) : reject(new Error(res.error));
				});
			} catch (e) {
				reject(new Error('reload')); // the extension was updated: the page needs a refresh
			}
		});
	}

	function esc(s) {
		return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
			return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
		});
	}

	var fontsDone = false;
	function fonts() {
		if (fontsDone) return;
		fontsDone = true;
		try {
			var l = document.createElement('link');
			l.rel = 'stylesheet';
			l.href = 'https://fonts.googleapis.com/css2?family=Changa:wght@600;800&family=IBM+Plex+Sans+Arabic:wght@400;600&display=swap';
			(document.head || document.documentElement).appendChild(l);
		} catch (e) {
			/* a strict page policy can block fonts; system fonts take over */
		}
	}

	/** The sentence around character `offset` in `text`. */
	function sentenceAt(text, offset) {
		if (window.Intl && Intl.Segmenter) {
			var seg = new Intl.Segmenter('en', { granularity: 'sentence' });
			var it = seg.segment(text)[Symbol.iterator](), r;
			while (!(r = it.next()).done) {
				var s = r.value;
				if (offset >= s.index && offset < s.index + s.segment.length) return s.segment.trim();
			}
		}
		var a = text.lastIndexOf('.', offset - 1), b = text.indexOf('.', offset);
		return text.slice(a + 1, b < 0 ? text.length : b + 1).trim();
	}

	var ERR = {
		signed_out: 'Sign in with your Sawa English account from the Language Lens icon.',
		reload: 'Language Lens was updated. Refresh this page (F5).',
		locked: '🔒 Members only — join Sawa English to use this (sawaenglish.com/join).'
	};
	function errText(e) {
		var m = e && e.message;
		return ERR[m] || m || 'Something went wrong. Try again.';
	}

	var LEVEL_NAMES = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];

	/**
	 * Text as HTML: every word a <span class="wd status" data-k>, and grammar-focus ranges wrapped in
	 * <span class="fx" data-l="label">. toks: [{start,end,status}], spans: [{start,end,label}] (both optional).
	 */
	function markup(text, toks, spans) {
		toks = toks || [];
		spans = (spans || []).slice().sort(function (a, b) { return a.start - b.start; });
		var cuts = { 0: 1 };
		cuts[text.length] = 1;
		toks.forEach(function (t) { cuts[t.start] = 1; cuts[t.end] = 1; });
		spans.forEach(function (s) { cuts[s.start] = 1; cuts[s.end] = 1; });
		var pts = Object.keys(cuts).map(Number).filter(function (p) { return p >= 0 && p <= text.length; }).sort(function (a, b) { return a - b; });
		var html = '', ti = 0, si = 0, curT = -1, curS = -1;
		for (var i = 0; i < pts.length - 1; i++) {
			var a = pts[i], b = pts[i + 1];
			while (ti < toks.length && toks[ti].end <= a) ti++;
			while (si < spans.length && spans[si].end <= a) si++;
			var tIn = ti < toks.length && toks[ti].start <= a && b <= toks[ti].end ? ti : -1;
			var sIn = si < spans.length && spans[si].start <= a && b <= spans[si].end ? si : -1;
			if (curT !== -1 && (tIn !== curT || sIn !== curS)) { html += '</span>'; curT = -1; }
			if (sIn !== curS) {
				if (curS !== -1) html += '</span>';
				if (sIn !== -1) html += '<span class="fx" data-l="' + esc(spans[sIn].label) + '">';
				curS = sIn;
			}
			if (tIn !== -1 && curT === -1) {
				html += '<span class="wd ' + toks[tIn].status + (toks[tIn].ex ? ' ex' : '') + '" data-k="' + tIn + '"' + (toks[tIn].ex ? ' data-e="' + esc(toks[tIn].lemma) + '"' : '') + '>';
				curT = tIn;
			}
			html += esc(text.slice(a, b));
		}
		if (curT !== -1) html += '</span>';
		if (curS !== -1) html += '</span>';
		return html;
	}

	/* "You know about N% of the words": the band words and what the numbers mean (education/placement-test-spec.md, Part 3). Never "understand". */
	var BAND = { easy: 'Easy', good: 'Good practice', hard: 'Hard (use subtitles)', 'too-hard': 'Very hard (use subtitles)' };
	var GRADE_TIP = '98% = easy to follow · 95% = good practice · under 90% = hard';
	/** Where the number comes from, for the panel (r = the analyze reply: level, profile). */
	function gradeSource(r) {
		var p = (r && r.profile) || {}, lv = LEVEL_NAMES[((r && r.level) || 2) - 1];
		if (p.source === 'test') return p.test === 'placement' ? 'From your placement test.' : p.test === 'quick' ? 'From your quick level check.' : 'From your level check in Language Lens.';
		return 'A guess from your level (' + lv + '). Take the level check for your real number: sawaenglish.com/placement';
	}

	window.LensUI = { send: send, esc: esc, fonts: fonts, sentenceAt: sentenceAt, errText: errText, markup: markup, LEVEL_NAMES: LEVEL_NAMES, BAND: BAND, GRADE_TIP: GRADE_TIP, gradeSource: gradeSource };
})();
