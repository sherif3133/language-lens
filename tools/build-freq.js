/* Builds extension/data/freq.json: the lexicon's base words ranked by how often they're used.
   Frequencies come from wordfreq (data CC BY-SA 4.0, https://github.com/rspeer/wordfreq): each base word
   gets the summed frequency of its forms (be = be + is + was + were + been + …).
   Output: { v: 1, ranked: ["the", "be", "of", …] } (top 6,000 single words).   Run: node build-freq.js */
'use strict';
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const { decode } = require('@msgpack/msgpack');

const buckets = decode(zlib.gunzipSync(fs.readFileSync(path.join(__dirname, 'data/small_en.msgpack.gz'))));
const wf = {};
buckets.forEach((words, i) => {
	if (!Array.isArray(words)) return;
	const f = Math.pow(10, -i / 100); // bucket i = -i centibels
	words.forEach((w) => { wf[w] = f; });
});

const lex = JSON.parse(fs.readFileSync(path.join(__dirname, '../extension/data/lexicon.json'), 'utf8'));
const lemmas = Object.keys(lex.lemmas).filter((l) => /^[a-z][a-z'-]*$/.test(l));
const score = {};
lemmas.forEach((l) => { score[l] = wf[l] || 0; });
// Each inflected form counts for its first (most common) base word.
Object.keys(lex.forms).forEach((form) => {
	if (/\s/.test(form) || !wf[form]) return;
	const to = lex.forms[form].filter((l) => score[l] !== undefined)[0];
	if (to && to !== form) score[to] += wf[form];
});
// Forms of be / do / have are listed as their own headwords ("is", "was", "did"): fold them into the verb.
const AUX = { 'be-verb': 'be', 'do-verb': 'do', 'have-verb': 'have' };
lemmas.forEach((l) => {
	const poses = lex.lemmas[l].map((i) => lex.entries[i][1]);
	const to = poses.map((p) => AUX[p]).filter(Boolean)[0];
	if (to && to !== l && poses.every((p) => AUX[p] || l === 'am')) {
		if (score[to] !== undefined) score[to] += score[l];
		score[l] = 0;
	}
});
const ranked = lemmas.filter((l) => score[l] > 0).sort((a, b) => score[b] - score[a]).slice(0, 6000);
fs.writeFileSync(path.join(__dirname, '../extension/data/freq.json'), JSON.stringify({ v: 1, ranked }));
console.log('ranked', ranked.length, '| top 25:', ranked.slice(0, 25).join(' '), '| #1000-1010:', ranked.slice(999, 1010).join(' '), '| #2990-3000:', ranked.slice(2989, 3000).join(' '));
