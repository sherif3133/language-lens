/* Lists every WordNet sense of the most-used dictionary entries, so the everyday meaning can be put first.
   Writes gloss/en-senses-<n>.txt (one block per entry: "head|pos" then numbered senses).
   The chosen order goes in gloss/en-order.tsv (head \t pos \t sense numbers, e.g. "3,1"); build-lexicon.js reads it.
   Run: node gloss/en-senses.js [topN=3000] [perFile=500] */
'use strict';
const fs = require('fs');
const path = require('path');
const top = +(process.argv[2] || 3000), per = +(process.argv[3] || 500);
const here = (p) => path.join(__dirname, '..', p);
const lex = JSON.parse(fs.readFileSync(here('../extension/data/lexicon.json'), 'utf8'));
const freq = JSON.parse(fs.readFileSync(here('../extension/data/freq.json'), 'utf8')).ranked;
const WN = here('node_modules/wordnet-db/dict');
const WNPOS = { noun: 'noun', verb: 'verb', adjective: 'adj', adverb: 'adv' };
const idx = {}, dat = {};
for (const p of Object.values(WNPOS)) {
	idx[p] = {};
	for (const line of fs.readFileSync(path.join(WN, 'index.' + p), 'utf8').split(/\r?\n/)) {
		if (!line || line[0] === ' ') continue;
		const c = line.split(' '), nOff = +c[2], pCnt = +c[3];
		idx[p][c[0]] = c.slice(4 + pCnt + 2, 4 + pCnt + 2 + nOff);
	}
	dat[p] = fs.readFileSync(path.join(WN, 'data.' + p));
}
const done = new Set();
try { for (const l of fs.readFileSync(here('gloss/en-order.tsv'), 'utf8').split(/\r?\n/)) if (l) done.add(l.split('\t').slice(0, 2).join('|')); } catch (e) { /* none yet */ }
const blocks = [];
for (const w of freq.slice(0, top)) {
	for (const i of lex.lemmas[w] || []) {
		const [head, pos] = lex.entries[i], p = WNPOS[pos];
		const offs = p && idx[p][head.split('/')[0].toLowerCase().replace(/ /g, '_')];
		if (!offs || offs.length < 2 || done.has(head + '|' + pos)) continue;
		done.add(head + '|' + pos);
		const senses = offs.slice(0, 15).map((o, k) => {
			const line = dat[p].slice(+o, dat[p].indexOf(10, +o)).toString('utf8');
			const syn = line.split(' ').slice(4, 4 + 2 * parseInt(line.split(' ')[3], 16)).filter((x, j) => j % 2 === 0).slice(0, 4).join(', ');
			return (k + 1) + '. ' + line.slice(line.indexOf('|') + 1).trim() + '  [' + syn + ']';
		});
		blocks.push(head + '|' + pos + (offs.length > 15 ? ' (' + offs.length + ' senses, first 15)' : '') + '\n' + senses.join('\n'));
	}
}
for (let f = 0; f * per < blocks.length; f++) fs.writeFileSync(here('gloss/en-senses-' + (f + 1) + '.txt'), blocks.slice(f * per, (f + 1) * per).join('\n\n') + '\n');
console.log(blocks.length + ' entries with 2+ senses in the top ' + top + ' words → ' + Math.ceil(blocks.length / per) + ' files');
