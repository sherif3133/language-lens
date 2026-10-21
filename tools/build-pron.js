/* Builds extension/data/pron.json: American pronunciations (CMU Pronouncing Dictionary, ARPAbet)
   for every word and word form in the lexicon, plus the most common other words.
   Format: { word: "P R OW0 N AH2 N S IY0 EY1 SH AH0 N" }   Run: node build-pron.js */
'use strict';
const fs = require('fs');
const path = require('path');

(async () => {
	const { dictionary } = await import('cmu-pronouncing-dictionary');
	const lex = JSON.parse(fs.readFileSync(path.join(__dirname, '../extension/data/lexicon.json'), 'utf8'));
	const want = new Set();
	for (const k of Object.keys(lex.lemmas)) k.split(' ').forEach((w) => want.add(w));
	for (const k of Object.keys(lex.forms)) k.split(' ').forEach((w) => want.add(w));
	// Inflections the lexicon doesn't list (plurals, -ing, -ed, -er…) when CMU has them.
	for (const w of [...want]) {
		for (const s of ['s', 'es', 'ed', 'd', 'ing', 'er', 'ers', 'est', 'ly', "'s", "n't"]) want.add(w + s);
	}
	// Contractions and very common function forms.
	["i'm", "you're", "we're", "they're", "he's", "she's", "it's", "that's", "there's", "what's", "i've", "you've", "we've", "they've", "i'll", "you'll", "we'll", "they'll", "he'll", "she'll", "i'd", "you'd", "he'd", "she'd", "we'd", "they'd", "don't", "doesn't", "didn't", "can't", "couldn't", "won't", "wouldn't", "isn't", "aren't", "wasn't", "weren't", "shouldn't", "haven't", "hasn't", "hadn't", "let's", 'gonna', 'wanna', 'gotta'].forEach((w) => want.add(w));
	const out = {};
	for (const w of want) {
		const p = dictionary[w];
		if (p) out[w] = p;
	}
	const dest = path.join(__dirname, '../extension/data/pron.json');
	fs.writeFileSync(dest, JSON.stringify(out));
	console.log('pronunciations', Object.keys(out).length, (fs.statSync(dest).size / 1024).toFixed(0) + ' KB');
})();
