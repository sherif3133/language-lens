/* Builds sawa-lens/assets/placement-vocab.json for the placement test's vocabulary section:
   the lexicon's single words ranked by frequency (wordfreq, CC BY-SA 4.0), in 1,000-word bands,
   up to 120 test words per band, each with its short Arabic meaning for the meaning check.
   Run: node build-placement-vocab.js */
'use strict';
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const { decode } = require('@msgpack/msgpack');

const buckets = decode(zlib.gunzipSync(fs.readFileSync(path.join(__dirname, 'data/small_en.msgpack.gz'))));
const wf = {};
buckets.forEach((words, i) => { if (Array.isArray(words)) words.forEach((w) => { wf[w] = Math.pow(10, -i / 100); }); });
const lex = JSON.parse(fs.readFileSync(path.join(__dirname, '../extension/data/lexicon.json'), 'utf8'));
const lemmas = Object.keys(lex.lemmas).filter((l) => /^[a-z]+$/.test(l));
const score = {};
lemmas.forEach((l) => { score[l] = wf[l] || 0; });
Object.keys(lex.forms).forEach((form) => {
	if (/\s/.test(form) || !wf[form]) return;
	const to = lex.forms[form].filter((l) => score[l] !== undefined)[0];
	if (to && to !== form) score[to] += wf[form];
});
const ranked = lemmas.filter((l) => score[l] > 0).sort((a, b) => score[b] - score[a]);
const SKIP = /^(determiner|pronoun|preposition|conjunction|be-verb|do-verb|have-verb|modal|number|interjection)/;
const bands = [];
for (let b = 0; b * 1000 < ranked.length && b < 10; b++) {
	const pool = ranked.slice(b * 1000, (b + 1) * 1000).map((w) => {
		const e = lex.lemmas[w].map((i) => lex.entries[i]).filter((x) => x[3] && !SKIP.test(x[1]))[0];
		return e && w.length >= 3 ? { w, ar: String(e[3]).split(/[،,(]/)[0].trim().slice(0, 40), pos: e[1] } : null;
	}).filter(Boolean);
	// even spread through the band
	const step = Math.max(1, Math.floor(pool.length / 120));
	bands.push({ from: b * 1000 + 1, to: Math.min((b + 1) * 1000, ranked.length), items: pool.filter((_, i) => i % step === 0).slice(0, 120) });
}
const out = path.join(__dirname, '../../sawa-lens/assets/placement-vocab.json');
fs.writeFileSync(out, JSON.stringify({ v: 1, total: Math.min(ranked.length, 10000), bands }));
console.log('ranked', ranked.length, '| bands', bands.map((b) => b.from + '-' + b.to + ':' + b.items.length).join(' '), '| sample band 5:', bands[4].items.slice(0, 5).map((x) => x.w + '=' + x.ar).join(', '));
