/* Language Lens core: tokenising, lemma lookup, word status and difficulty grading.
   Plain script so it runs in the service worker (importScripts) and, later, in the web app. */
(function (g) {
	'use strict';

	var LEVELS = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];
	var WORD = /[A-Za-z]+(?:['’][A-Za-z]+)*/g;
	var CONTRACTIONS = { "n't": 'not', "'re": 'be', "'m": 'be', "'ll": 'will', "'ve": 'have', "'d": 'would' };
	var IRREGULAR_CONTRACTIONS = { "won't": ['will', 'not'], "can't": ['can', 'not'], "shan't": ['shall', 'not'], "ain't": ['be', 'not'] };

	function Lens(lexicon) {
		this.lex = lexicon;
	}

	/** Words in a string with their character offsets. */
	Lens.prototype.tokenize = function (text) {
		var out = [], m;
		WORD.lastIndex = 0;
		while ((m = WORD.exec(text))) {
			out.push({ text: m[0], start: m.index, end: m.index + m[0].length });
		}
		return out;
	};

	Lens.prototype.has = function (lemma) {
		return Object.prototype.hasOwnProperty.call(this.lex.lemmas, lemma);
	};

	/** Candidate lemmas for one surface word, best first. */
	Lens.prototype.lemmas = function (word) {
		var w = String(word).toLowerCase().replace(/’/g, "'");
		var out = [], self = this;
		function add(l) {
			if (l && self.has(l) && out.indexOf(l) < 0) out.push(l);
		}
		if (IRREGULAR_CONTRACTIONS[w]) return IRREGULAR_CONTRACTIONS[w].slice();
		var ap = w.indexOf("'");
		if (ap > 0) {
			var tail = w.slice(ap);
			if (tail === "'s") w = w.slice(0, ap); // possessive or "is": the stem is what matters
			else if (CONTRACTIONS[tail]) w = w.slice(0, ap);
			else if (w.slice(-3) === "n't") w = w.slice(0, -3);
		}
		add(w);
		(this.lex.forms[w] || []).forEach(add);
		if (out.length > 1) {
			// 'found' is both a word and the past of 'find': the more common reading comes first.
			var L = this;
			// The reading at the word's own lowest level is a noun ("saw" the tool, A1).
			var nounOnly = function (l) {
				var lv = L.level(l);
				return (L.lex.lemmas[l] || []).filter(function (i) { return L.lex.entries[i][2] === lv; }).every(function (i) { return L.lex.entries[i][1] === 'noun'; });
			};
			out.sort(function (a, b) {
				var d = (L.level(a) || 9) - (L.level(b) || 9);
				if (d) return d;
				// Same level: "saw" is far more often the past of "see" than the tool.
				if (a === w && nounOnly(a) && !nounOnly(b)) return 1;
				if (b === w && nounOnly(b) && !nounOnly(a)) return -1;
				return 0;
			});
		}
		if (out.length) return out;
		// Suffix rules for forms the build step didn't list.
		var rules = [
			[/ies$/, 'y'], [/ied$/, 'y'], [/ier$/, 'y'], [/iest$/, 'y'], [/ily$/, 'y'],
			[/([^aeiou])\1(ed|ing|er|est)$/, '$1'], [/(ed|ing)$/, 'e'], [/(ed|ing|er|est)$/, ''],
			[/ves$/, 'f'], [/ves$/, 'fe'], [/es$/, ''], [/s$/, ''], [/ly$/, ''], [/ly$/, 'le'], [/ness$/, ''], [/ment$/, '']
		];
		for (var i = 0; i < rules.length; i++) {
			if (rules[i][0].test(w)) add(w.replace(rules[i][0], rules[i][1]));
		}
		return out;
	};

	/** Dictionary entries for a lemma: [{head, pos, level, levelName, ar}]. */
	Lens.prototype.entries = function (lemma) {
		var lex = this.lex;
		return (lex.lemmas[lemma] || []).map(function (i) {
			var e = lex.entries[i];
			return { head: e[0], pos: e[1], level: e[2], levelName: LEVELS[e[2] - 1], ar: e[3], en: e[4] || '', ex: e[5] || '' };
		});
	};

	Lens.prototype.level = function (lemma) {
		var es = this.lex.lemmas[lemma];
		if (!es) return 0;
		var lv = 9;
		for (var i = 0; i < es.length; i++) lv = Math.min(lv, this.lex.entries[es[i]][2]);
		return lv;
	};

	/**
	 * Status of a lemma for a learner.
	 * user = { level: 1..6, words: { lemma: 'known' | 'learning' } }
	 * known    marked known, or at/below the learner's level and not marked
	 * learning marked as being learned (saved, or "I don't know this")
	 * next     one level above the learner: worth checking
	 * hard     two or more levels above, or not in the list at all (rare words)
	 */
	Lens.prototype.status = function (lemma, user) {
		var mark = user.words && user.words[lemma];
		if (mark === 'known' || mark === 'learning') return mark;
		var lv = this.level(lemma), me = user.level || 2;
		if (lv && lv <= me) return 'known';
		if (lv && lv === me + 1) return 'next';
		return 'hard';
	};

	/** The learner's own saved expressions ("give up on", "break the ice"), longest first. */
	Lens.prototype._userPhrases = function (user) {
		var w = user.words || {}, key = Object.keys(w).filter(function (k) { return k.indexOf(' ') > 0; }).sort().join('|');
		if (this._phraseKey === key) return this._phrases;
		var map = {}, max = 0;
		key.split('|').forEach(function (p) {
			if (!p) return;
			map[p] = true;
			max = Math.max(max, p.split(' ').length);
		});
		this._phraseKey = key;
		this._phrases = { map: map, max: Math.min(max, 8) };
		return this._phrases;
	};

	/**
	 * Analyse a text: every word with its lemma, level and status.
	 * Phrases are joined: the learner's saved expressions first, then list phrases ("according to").
	 * Names (capitalised, not at sentence start, not in the list) and very short unknowns are skipped.
	 */
	Lens.prototype.analyze = function (text, user) {
		var toks = this.tokenize(text), out = [], i = 0;
		var up = this._userPhrases(user), self = this;
		var lem1 = function (s) { return self.lemmas(s)[0] || s.toLowerCase(); };
		while (i < toks.length) {
			var t = toks[i], hit = null;
			// Longest phrase first, only if the words are separated by plain spaces.
			for (var n = Math.max(3, up.max); n >= 2 && !hit; n--) {
				if (i + n > toks.length) continue;
				var ok = true, parts = [], lparts = [];
				for (var k = 0; k < n; k++) {
					if (k && !/^[\s,]+$/.test(text.slice(toks[i + k - 1].end, toks[i + k].start))) ok = false;
					parts.push(toks[i + k].text.toLowerCase().replace(/’/g, "'"));
				}
				if (!ok) continue;
				var phrase = parts.join(' ');
				if (n <= up.max) {
					// Match the saved expression as written, or with the first word in any form ("gave up" = "give up").
					if (up.map[phrase]) hit = { n: n, lemma: phrase };
					else {
						lparts = [lem1(parts[0])].concat(parts.slice(1));
						if (up.map[lparts.join(' ')]) hit = { n: n, lemma: lparts.join(' ') };
					}
				}
				if (!hit && n <= 3) {
					var cands = [phrase].concat(this.lex.forms[phrase] || []).filter(this.has, this);
					if (cands.length) hit = { n: n, lemma: cands[0] };
				}
			}
			if (hit) {
				out.push(this._tok(text, toks[i].start, toks[i + hit.n - 1].end, hit.lemma, user, false));
				i += hit.n;
				continue;
			}
			var lem = this.lemmas(t.text)[0] || '';
			var prev = text.slice(Math.max(0, t.start - 3), t.start);
			var sentenceStart = i === 0 || /[.!?:"“]\s*$/.test(prev);
			var isName = !lem && /^[A-Z]/.test(t.text) && !sentenceStart;
			out.push(this._tok(text, t.start, t.end, lem, user, isName));
			i++;
		}
		return out;
	};

	Lens.prototype._tok = function (text, start, end, lemma, user, isName) {
		var surface = text.slice(start, end);
		var lv = lemma ? this.level(lemma) : 0;
		var st;
		if (isName) st = 'name';
		else if (lemma) st = this.status(lemma, user);
		else {
			var m = user.words && user.words[surface.toLowerCase()];
			st = m === 'known' || m === 'learning' ? m : surface.length <= 2 ? 'known' : 'hard';
		}
		return { text: surface, start: start, end: end, lemma: lemma || surface.toLowerCase(), level: lv, status: st, listed: !!lemma };
	};

	/**
	 * Difficulty for a learner: share of running words they know (names excluded).
	 * 98%+ comfortable, 95%+ good stretch, 90%+ hard, below that too hard (Hu & Nation 2000; Nation 2006).
	 */
	Lens.prototype.grade = function (tokens) {
		var counted = 0, known = 0, unknown = {};
		for (var i = 0; i < tokens.length; i++) {
			var t = tokens[i];
			if (t.status === 'name') continue;
			counted++;
			if (t.status === 'known') known++;
			else unknown[t.lemma] = (unknown[t.lemma] || 0) + 1;
		}
		var cov = counted ? known / counted : 1;
		var band = cov >= 0.98 ? 'easy' : cov >= 0.95 ? 'good' : cov >= 0.9 ? 'hard' : 'too-hard';
		var self = this;
		var top = Object.keys(unknown).sort(function (a, b) {
			return unknown[b] - unknown[a] || (self.level(a) || 9) - (self.level(b) || 9);
		}).slice(0, 30).map(function (l) {
			var e = self.entries(l);
			return { lemma: l, count: unknown[l], level: self.level(l), ar: e.length ? e.map(function (x) { return x.ar; }).filter(Boolean)[0] || '' : '' };
		});
		return { coverage: cov, percent: Math.floor(cov * 100), words: counted, unknownLemmas: Object.keys(unknown).length, band: band, top: top };
	};

	Lens.LEVELS = LEVELS;
	g.Lens = Lens;
})(typeof globalThis !== 'undefined' ? globalThis : self);
