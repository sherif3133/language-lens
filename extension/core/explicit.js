/* Language Lens content check: what is SAID in a video, from its transcript (a word list, no AI, no API calls).
   What matters most to students is whether a video has sexual language or sexual topics: that is flagged on its own.
   Swearing is reported as profanity: occasional f-words, "shit", "damn" … are "moderate profanity", a lot of it is
   "frequent profanity"; mild words alone (damn, hell, crap) are only mentioned in the panel. Slurs are always flagged.
   It can't see what is shown on screen. */
(function (g) {
	'use strict';

	var SLUR = /^(n+i+g+g+(a|er)s?|f+a+g+(got)?s?|retard(ed|s)?|spics?|chinks?|kikes?|trann(y|ies)|dykes?)$/i;
	// Sexual words: explicit (sexual language) …
	var SEX_EXPLICIT = /^(porn\w*|pussy|pussies|cocks?|cocksucker\w*|tits|titties|boobs?|cum|cumming|blowjobs?|handjobs?|orgasm\w*|horny|erotic\w*|dildos?|thots?|hoes?|sluts?|whores?|nudes|strippers?|striptease|threesomes?|booty ?call)$/i;
	// … and topics (sexual topics), also as two-word phrases
	var SEX_TOPIC = /^(sex|sexual\w*|sexy|naked|nude|condoms?|lingerie|seduc\w*|make love|making love|made love|one-night|one night|hook up|hooking up|lap dance|get naked|take it off)$/i;
	var PROFANE = /^(f+u+c+k+\w*|motherf\w*|shit\w*|bullshit|horseshit|ass|asses|asshole\w*|bitch\w*|bastard\w*|dick(s|head)?|prick\w*|piss(ed|ing)?|douche\w*|wanker\w*|bollocks|twat\w*|jackass|cunt\w*|goddamn\w*|damn\w*|dammit)$/i;
	var MILD = /^(hell|crap\w*|bloody|freaking|frickin\w*|screw(ed)?|sucks?|arse|bugger)$/i;
	// Other themes, by mention.
	var THEMES = {
		violence: /^(kill(s|ed|ing)?|murder\w*|shoot(s|ing)?|shot|stab\w*|blood(y|shed)?|gore|weapon\w*|gun(s|fire)?|beat(en|ing)? up|torture\w*|massacre\w*|corpse\w*|dead body)$/i,
		drugs: /^(cocaine|heroin|meth|weed|marijuana|stoned|high on|overdose\w*|drunk|wasted)$/i,
		selfharm: /^(suicide\w*|suicidal|self-harm|kill (myself|himself|herself|themselves))$/i
	};
	var FREQUENT = 20; // this many swear words or more: "frequent profanity"

	/** What kind of word it is: 'slur' | 'sexual' | 'profanity' | 'mild' | ''. Two-word phrases work for sexual topics. */
	function kindOf(word) {
		var w = String(word).toLowerCase().replace(/[’']/g, "'").replace(/^'+|'+$/g, '');
		if (SLUR.test(w)) return 'slur';
		if (SEX_EXPLICIT.test(w)) return 'sexual';
		if (SEX_TOPIC.test(w)) return 'topic';
		if (PROFANE.test(w)) return 'profanity';
		if (MILD.test(w)) return 'mild';
		// censored captions: f***, s**t
		if (/^[a-z]\*+[a-z]*$/i.test(w)) return 'profanity';
		return '';
	}
	/** Old name, kept for callers: a truthy level for any word worth masking or listing. */
	function severityOf(word) {
		var k = kindOf(word);
		return k === 'slur' ? 'strong' : k === 'sexual' || k === 'profanity' ? 'moderate' : k === 'mild' ? 'mild' : '';
	}

	/**
	 * Scan texts (transcript sentences). Returns
	 * { sexual: 'none'|'topics'|'explicit', profanity: 'none'|'mild'|'moderate'|'frequent', slurs: n,
	 *   counts: {sexual, topic, profanity, mild, slur}, hits: [{i, word, kind}], themes: {violence:n,…}, themeHits: {violence:[i…]},
	 *   flagged: true when anything should show on the video, level: old summary ('none'|'mild'|'moderate'|'strong') }
	 */
	function scan(texts) {
		var counts = { sexual: 0, topic: 0, profanity: 0, mild: 0, slur: 0 }, hits = [], themes = {}, themeHits = {};
		texts.forEach(function (t, i) {
			var words = String(t).match(/\[\s*_+\s*\]|[A-Za-z*]+(?:['’-][A-Za-z*]+)*/g) || [];
			words.forEach(function (w, k) {
				var two = (w + ' ' + (words[k + 1] || '')).toLowerCase();
				var kind = w.indexOf('[') === 0 ? 'profanity' : kindOf(w) || (SEX_TOPIC.test(two) ? 'topic' : '');
				if (kind) {
					counts[kind]++;
					hits.push({ i: i, word: kind === 'topic' && !SEX_TOPIC.test(w) ? two : w, kind: kind });
				}
				Object.keys(THEMES).forEach(function (th) {
					if (THEMES[th].test(w) || THEMES[th].test(two)) {
						themes[th] = (themes[th] || 0) + 1;
						(themeHits[th] = themeHits[th] || []).indexOf(i) < 0 && themeHits[th].push(i);
					}
				});
			});
		});
		var sexual = counts.sexual ? 'explicit' : counts.topic ? 'topics' : 'none';
		var profanity = counts.profanity >= FREQUENT ? 'frequent' : counts.profanity ? 'moderate' : counts.mild ? 'mild' : 'none';
		var level = counts.slur || profanity === 'frequent' || sexual === 'explicit' ? 'strong' : profanity === 'moderate' || sexual === 'topics' ? 'moderate' : profanity === 'mild' ? 'mild' : 'none';
		return { sexual: sexual, profanity: profanity, slurs: counts.slur, counts: counts, hits: hits, themes: themes, themeHits: themeHits, flagged: sexual !== 'none' || profanity === 'moderate' || profanity === 'frequent' || counts.slur > 0, level: level };
	}

	g.LensExplicit = { scan: scan, kindOf: kindOf, severityOf: severityOf };
})(typeof globalThis !== 'undefined' ? globalThis : self);
