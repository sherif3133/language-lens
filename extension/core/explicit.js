/* Language Lens content advisory: swear words by severity and mature themes mentioned in a transcript.
   Runs locally on the caption text (no API calls). It's a word-list check, so it reports what is SAID,
   not what is shown on screen. */
(function (g) {
	'use strict';

	// Severity: mild < moderate < strong. Patterns match whole words, case-insensitive.
	var WORDS = [
		['strong', /^(f+u+c+k+\w*|motherf\w*|cunt\w*|cocksucker\w*|n+i+g+g+(a|er)s?|f+a+g+(got)?s?|retard(ed|s)?|spic|chink|kike|tranny)$/i],
		['moderate', /^(shit\w*|bullshit|horseshit|ass(hole|holes|es)?|bitch\w*|bastard\w*|dick(s|head)?|prick\w*|piss(ed|ing)?|slut\w*|whore\w*|douche\w*|wanker\w*|bollocks|tits?|twat\w*|jackass)$/i],
		['mild', /^(damn\w*|dammit|goddamn\w*|crap\w*|bloody|hell|freaking|frickin\w*|screw(ed)?|sucks?|arse|bugger)$/i]
	];
	// Mature themes, by mention in the transcript.
	var THEMES = {
		violence: /^(kill(s|ed|ing)?|murder\w*|shoot(s|ing)?|shot|stab\w*|blood(y|shed)?|gore|weapon\w*|gun(s|fire)?|beat(en|ing)? up|torture\w*|massacre\w*|corpse\w*|dead body)$/i,
		sexual: /^(sex(ual|y)?|naked|nude\w*|porn\w*|horny|orgasm\w*|erotic\w*|strip(per|club)?)$/i,
		drugs: /^(cocaine|heroin|meth|weed|marijuana|stoned|high on|overdose\w*|drunk|wasted)$/i,
		selfharm: /^(suicide\w*|suicidal|self-harm|kill (myself|himself|herself|themselves))$/i
	};
	var RANK = { none: 0, mild: 1, moderate: 2, strong: 3 };

	function severityOf(word) {
		var w = String(word).toLowerCase().replace(/[’']/g, "'").replace(/^'+|'+$/g, '');
		// "hell" only counts as an exclamation, not in "hello"/"shell" (whole-word match already) — keep it mild.
		for (var i = 0; i < WORDS.length; i++) if (WORDS[i][1].test(w)) return WORDS[i][0];
		// Censored captions: f***, s**t, [ __ ]
		if (/^[a-z]\*+[a-z]*$/i.test(w) || w === '__') return /^f/i.test(w) ? 'strong' : 'moderate';
		return '';
	}

	/**
	 * Scan texts (e.g. transcript sentences). Returns
	 * { level, counts:{mild,moderate,strong}, hits:[{i, word, level}], themes:{violence:n,…}, themeHits:{violence:[i…]} }
	 */
	function scan(texts) {
		var counts = { mild: 0, moderate: 0, strong: 0 }, hits = [], themes = {}, themeHits = {}, level = 'none';
		texts.forEach(function (t, i) {
			var words = String(t).match(/\[\s*_+\s*\]|[A-Za-z*]+(?:['’-][A-Za-z*]+)*/g) || [];
			words.forEach(function (w, k) {
				var s = w.indexOf('[') === 0 ? 'moderate' : severityOf(w);
				if (s) {
					counts[s]++;
					hits.push({ i: i, word: w, level: s });
					if (RANK[s] > RANK[level]) level = s;
				}
				var two = (w + ' ' + (words[k + 1] || '')).toLowerCase();
				Object.keys(THEMES).forEach(function (th) {
					if (THEMES[th].test(w) || THEMES[th].test(two)) {
						themes[th] = (themes[th] || 0) + 1;
						(themeHits[th] = themeHits[th] || []).indexOf(i) < 0 && themeHits[th].push(i);
					}
				});
			});
		});
		return { level: level, counts: counts, hits: hits, themes: themes, themeHits: themeHits };
	}

	g.LensExplicit = { scan: scan, severityOf: severityOf, RANK: RANK };
})(typeof globalThis !== 'undefined' ? globalThis : self);
