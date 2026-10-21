/* Language Lens pronunciation: IPA, a "sounds like" respelling (like Google's), and the sounds
   Arabic speakers often find hard. Input is CMU Pronouncing Dictionary ARPAbet (American English). */
(function (g) {
	'use strict';

	var VOWELS = { AA: 'ɑ', AE: 'æ', AH: 'ʌ', AO: 'ɔ', AW: 'aʊ', AY: 'aɪ', EH: 'ɛ', ER: 'ɝ', EY: 'eɪ', IH: 'ɪ', IY: 'i', OW: 'oʊ', OY: 'ɔɪ', UH: 'ʊ', UW: 'u' };
	var CONS = { B: 'b', CH: 'tʃ', D: 'd', DH: 'ð', F: 'f', G: 'ɡ', HH: 'h', JH: 'dʒ', K: 'k', L: 'l', M: 'm', N: 'n', NG: 'ŋ', P: 'p', R: 'r', S: 's', SH: 'ʃ', T: 't', TH: 'θ', V: 'v', W: 'w', Y: 'j', Z: 'z', ZH: 'ʒ' };
	// "Sounds like" spellings, close to Google's pronunciation respelling.
	var RV = { AA: 'aa', AE: 'a', AH: 'uh', AO: 'aw', AW: 'ow', AY: 'ai', EH: 'eh', ER: 'ur', EY: 'ay', IH: 'i', IY: 'ee', OW: 'oh', OY: 'oy', UH: 'uu', UW: 'oo' };
	var RC = { B: 'b', CH: 'ch', D: 'd', DH: 'dh', F: 'f', G: 'g', HH: 'h', JH: 'j', K: 'k', L: 'l', M: 'm', N: 'n', NG: 'ng', P: 'p', R: 'r', S: 's', SH: 'sh', T: 't', TH: 'th', V: 'v', W: 'w', Y: 'y', Z: 'z', ZH: 'zh' };
	var ONSETS = {};
	('P R|P L|B R|B L|T R|D R|K R|K L|G R|G L|F R|F L|TH R|SH R|S P|S T|S K|S M|S N|S L|S W|T W|D W|K W|G W|TH W|P Y|B Y|F Y|V Y|K Y|M Y|HH Y|S F|' +
		'S P R|S P L|S T R|S K R|S K W|S K L|S P Y|S K Y').split('|').forEach(function (o) { ONSETS[o] = 1; });

	function parse(arpa) {
		return arpa.split(' ').map(function (p) {
			var m = p.match(/^([A-Z]+)([012])?$/);
			return { ph: m[1], stress: m[2] == null ? -1 : +m[2], vowel: m[2] != null };
		});
	}

	/** Split phones into syllables (maximal legal onset). */
	function syllables(ps) {
		var vi = [];
		ps.forEach(function (p, i) { if (p.vowel) vi.push(i); });
		if (!vi.length) return [ps];
		var cuts = [0];
		for (var k = 0; k < vi.length - 1; k++) {
			var a = vi[k] + 1, b = vi[k + 1]; // consonants between two vowels: [a, b)
			var cut = b;
			for (var s = a; s < b; s++) {
				var on = ps.slice(s, b).map(function (p) { return p.ph; }).join(' ');
				if (s === b - 1 || ONSETS[on]) {
					if (ps[s].ph !== 'NG') { cut = s; break; }
				}
			}
			cuts.push(cut);
		}
		var out = [];
		for (var c = 0; c < cuts.length; c++) out.push(ps.slice(cuts[c], c + 1 < cuts.length ? cuts[c + 1] : ps.length));
		return out;
	}

	/** American flap: t/d between vowels, the second vowel unstressed ("water", "city", "better"). */
	function flaps(ps) {
		var out = [];
		for (var i = 1; i < ps.length - 1; i++) {
			var p = ps[i];
			if ((p.ph === 'T' || p.ph === 'D') && ps[i + 1].vowel && ps[i + 1].stress === 0 && (ps[i - 1].vowel || ps[i - 1].ph === 'R')) out.push(i);
		}
		return out;
	}

	function ipa(arpa) {
		var ps = parse(arpa), syl = syllables(ps), fl = flaps(ps), idx = 0, multi = syl.length > 1;
		return syl.map(function (s) {
			var str = '', mark = '';
			s.forEach(function (p) {
				if (p.vowel) {
					if (multi && p.stress === 1) mark = 'ˈ';
					else if (multi && p.stress === 2) mark = 'ˌ';
					if (p.ph === 'AH' && p.stress === 0) str += 'ə';
					else if (p.ph === 'ER' && p.stress === 0) str += 'ɚ';
					else if (p.ph === 'IH' && p.stress === 0 && idx === ps.length - 1) str += 'ɪ';
					else str += VOWELS[p.ph];
				} else str += fl.indexOf(idx) >= 0 ? 'ɾ' : CONS[p.ph];
				idx++;
			});
			return mark + str;
		}).join('');
	}

	/** "pruh·nuhn·see·AY·shn": stressed syllable in capitals, flap t written as d. */
	function respell(arpa) {
		var ps = parse(arpa), syl = syllables(ps), fl = flaps(ps), idx = 0;
		return syl.map(function (s, si) {
			var str = '', stressed = false;
			s.forEach(function (p, k) {
				if (p.vowel) {
					if (p.stress === 1 && syl.length > 1) stressed = true;
					if (p.ph === 'ER') str += p.stress === 0 ? 'r' : 'ur';
					else if (p.ph === 'AH' && p.stress === 0) {
						// a weak "uh" before a final n/l/m usually disappears: "shn", "tl"
						var rest = s.slice(k + 1).map(function (q) { return q.ph; }).join(' ');
						str += si === syl.length - 1 && /^(N|L|M)$/.test(rest) ? '' : 'uh';
					} else str += RV[p.ph];
				} else str += fl.indexOf(idx) >= 0 ? 'd' : RC[p.ph];
				idx++;
			});
			return stressed ? str.toUpperCase() : str;
		}).join('·');
	}

	/**
	 * Sounds Arabic speakers often find hard, for one word.
	 * Returns [{key, label, tip}] — key matches the pronunciation focus keys.
	 */
	function features(word, arpa) {
		var ps = parse(arpa), out = [], phs = ps.map(function (p) { return p.ph; });
		var w = String(word).toLowerCase();
		if (phs.indexOf('TH') >= 0) out.push({ key: 'th', label: 'th /θ/', tip: 'Tongue between your teeth, no voice: think, three.' });
		if (phs.indexOf('DH') >= 0) out.push({ key: 'th', label: 'th /ð/', tip: 'Tongue between your teeth, with voice: this, mother.' });
		if (phs.indexOf('P') >= 0) out.push({ key: 'p', label: '/p/ not /b/', tip: 'Close your lips and release a small puff of air, no voice.' });
		if (phs.indexOf('V') >= 0) out.push({ key: 'v', label: '/v/ not /f/', tip: 'Top teeth on your bottom lip, with voice (your throat buzzes).' });
		// -ed endings
		if (/[^e]ed$|[^aeiou]ed$/.test(w) || /ed$/.test(w) && w.length > 4) {
			var last = phs.slice(-2).join(' ');
			if (/(IH|AH) D$/.test(last) && /[td]ed$/.test(w)) out.push({ key: 'ed', label: '-ed = /ɪd/', tip: '-ed is an extra syllable /ɪd/ only after t or d: wanted, needed.' });
			else if (/T$/.test(last)) out.push({ key: 'ed', label: '-ed = /t/', tip: '-ed sounds /t/ after voiceless sounds (p, k, s, sh, ch, f): walked, stopped.' });
			else if (/D$/.test(last)) out.push({ key: 'ed', label: '-ed = /d/', tip: '-ed sounds /d/ after voiced sounds: played, lived. No extra syllable.' });
		}
		// consonant clusters: 2+ consonants at the start, or 3+ together anywhere
		var run = 0, maxRun = 0, start = 0;
		for (var i = 0; i < ps.length; i++) {
			if (ps[i].vowel) { run = 0; continue; }
			run++;
			maxRun = Math.max(maxRun, run);
			if (i === start && i + 1 < ps.length && !ps[i + 1].vowel) start = -1;
		}
		var startCluster = ps.length > 1 && !ps[0].vowel && !ps[1].vowel;
		if (startCluster || maxRun >= 3) out.push({ key: 'cluster', label: 'consonant cluster', tip: 'Say the consonants together, without adding a vowel: street (not "istreet"), next week.' });
		if (flaps(ps).length) out.push({ key: 'flap', label: 'flap t', tip: 'In American English, t between vowels sounds like a quick soft d: water → WAA·dr.' });
		return out;
	}

	var FOCUS = {
		th: ['th sounds /θ/ /ð/', 'Put your tongue between your teeth. /θ/ has no voice (think), /ð/ has voice (this).'],
		p: ['/p/ vs /b/', '/p/ has a puff of air and no voice: put, happy. Don\'t say "but" for "put".'],
		v: ['/v/ vs /f/', '/v/ has voice: very, over. Feel your throat buzz. /f/ has none: fine.'],
		ed: ['-ed endings', '/ɪd/ after t or d (wanted) · /t/ after voiceless sounds (walked) · /d/ after the rest (played).'],
		cluster: ['Consonant clusters', 'Two or more consonants together: street, next, texts. Don\'t add a vowel between them.'],
		flap: ['Flap t (American)', 't between vowels sounds like a quick d: water, better, a lot of → "a lodda".']
	};

	function Pron(dict) {
		this.dict = dict;
	}
	Pron.prototype.get = function (word, lemma) {
		var w = String(word).toLowerCase().replace(/’/g, "'");
		var a = this.dict[w] || (lemma && this.dict[String(lemma).toLowerCase()]);
		if (!a && /'s$/.test(w)) a = this.dict[w.slice(0, -2)];
		return a || '';
	};
	/** Everything the card needs for one word. */
	Pron.prototype.info = function (word, lemma) {
		var a = this.get(word, lemma);
		if (!a) return null;
		return { ipa: '/' + ipa(a) + '/', soundsLike: respell(a), features: features(word, a) };
	};
	/** Spans for a pronunciation focus, over the Lens tokens of each text. */
	Pron.prototype.spans = function (texts, tokenLists, focus) {
		var self = this, count = 0;
		var spans = texts.map(function (text, i) {
			var out = [];
			(tokenLists[i] || []).forEach(function (t) {
				var a = self.get(t.text, t.lemma);
				if (!a) return;
				var f = features(t.text, a).filter(function (x) { return x.key === focus; })[0];
				if (f) out.push({ start: t.start, end: t.end, label: f.label });
			});
			count += out.length;
			return out;
		});
		return { spans: spans, count: count, name: FOCUS[focus][0], rule: FOCUS[focus][1] };
	};

	Pron.FOCUS = FOCUS;
	Pron.ipa = ipa;
	Pron.respell = respell;
	Pron.features = features;
	g.LensPron = Pron;
})(typeof globalThis !== 'undefined' ? globalThis : self);
