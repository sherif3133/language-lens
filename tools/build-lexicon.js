/* Builds extension/data/lexicon.json from the CEFR-J + Octanove word lists and the Arabic glossary.
   Output: { v, levels, entries: [[headword, pos, level, arabic], ...], lemmas: {lemma: [entryIdx...]}, forms: {form: [lemma...]} }
   Run: node build-lexicon.js */
'use strict';
const fs = require('fs');
const path = require('path');
const nlp = require('compromise');

const LEVELS = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];
const here = (p) => path.join(__dirname, p);

function csv(file) {
	return fs.readFileSync(here(file), 'utf8').trim().split(/\r?\n/).slice(1).map((l) => {
		const c = l.split(',');
		return { head: c[0].trim(), pos: c[1].trim(), level: LEVELS.indexOf(c[2].trim()) + 1 };
	}).filter((r) => r.head && r.level > 0);
}

// Arabic glosses: gloss/out-*.tsv (headword \t pos \t arabic)
const gloss = {};
for (const f of fs.readdirSync(here('gloss')).filter((f) => /^out-.*\.tsv$/.test(f)).sort()) {
	for (const line of fs.readFileSync(here('gloss/' + f), 'utf8').split(/\r?\n/)) {
		const c = line.split('\t');
		if (c.length >= 3 && c[2].trim()) gloss[c[0].trim() + '|' + c[1].trim()] = c[2].trim();
	}
}

// English definitions and one example from WordNet: senses 1 and 2 (WordNet's order), or the everyday
// senses first where gloss/en-order.tsv says so (WordNet puts "now: in the historical present" first).
const ORDER = {};
for (const line of fs.readFileSync(here('gloss/en-order.tsv'), 'utf8').split(/\r?\n/)) {
	const c = line.split('\t');
	if (line[0] !== '#' && c.length >= 3) ORDER[c[0] + '|' + c[1]] = c[2].split(',').map(Number);
}
const WN = path.join(__dirname, 'node_modules/wordnet-db/dict');
const WNPOS = { noun: 'noun', verb: 'verb', adjective: 'adj', adverb: 'adv' };
const wnIndex = {}, wnData = {};
for (const p of Object.values(WNPOS)) {
	wnIndex[p] = {};
	for (const line of fs.readFileSync(path.join(WN, 'index.' + p), 'utf8').split(/\r?\n/)) {
		if (!line || line[0] === ' ') continue;
		const c = line.split(' ');
		const nOff = +c[2], pCnt = +c[3];
		wnIndex[p][c[0]] = c.slice(4 + pCnt + 2, 4 + pCnt + 2 + nOff);
	}
	wnData[p] = fs.readFileSync(path.join(WN, 'data.' + p));
}
function wordnet(head, pos, order) {
	const p = WNPOS[pos];
	if (!p) return ['', ''];
	const offs = wnIndex[p][head.toLowerCase().replace(/ /g, '_')];
	if (!offs) return ['', ''];
	const defs = [];
	let ex = '';
	const picked = order ? order.map((n) => offs[n - 1]).filter(Boolean) : offs.slice(0, 2);
	for (const o of picked) {
		const start = +o;
		const end = wnData[p].indexOf(10, start);
		const line = wnData[p].slice(start, end).toString('utf8');
		const g = line.slice(line.indexOf('|') + 1).trim();
		const parts = g.split(/;\s*(?=")/);
		defs.push(parts[0].replace(/;\s*$/, '').trim());
		if (!ex) {
			const m = g.match(/"([^"]+)"/);
			if (m && m[1].toLowerCase().indexOf(head.toLowerCase().split(' ')[0].slice(0, 4)) >= 0) ex = m[1];
		}
	}
	return [defs.join(' · '), ex];
}

const rows = [...csv('data/cefrj-vocabulary-profile-1.5.csv'), ...csv('data/octanove-vocabulary-profile-c1c2-1.0.csv')];
const entries = [];
const lemmas = {};
const seen = new Set();
for (const r of rows) {
	const key = r.head + '|' + r.pos;
	if (seen.has(key)) continue;
	seen.add(key);
	const idx = entries.length;
	const wn = wordnet(r.head.split('/')[0], r.pos, ORDER[key]);
	if (ORDER[key]) ORDER[key].used = true;
	entries.push([r.head, r.pos, r.level, gloss[key] || '', wn[0], wn[1]]);
	// "a.m./A.M./am/AM" -> each spelling is a lemma key
	for (const v of r.head.split('/')) {
		const k = v.trim().toLowerCase();
		if (!k) continue;
		(lemmas[k] = lemmas[k] || []).push(idx);
	}
}

// Expressions (phrasal verbs, idioms, compounds, fixed phrases): phrases/out-*.tsv, see phrases/SOURCES.md.
// expression \t type \t level \t english \t arabic \t example. A word-list entry with the same spelling wins.
const EXPR_POS = { phrasal: 'phrasal verb', idiom: 'idiom', compound: 'compound noun', phrase: 'phrase' };
let exprN = 0;
for (const f of fs.readdirSync(here('phrases')).filter((f) => /^out-.*\.tsv$/.test(f)).sort()) {
	for (const line of fs.readFileSync(here('phrases/' + f), 'utf8').split(/\r?\n/)) {
		const c = line.split('\t').map((x) => x.trim());
		if (c.length < 5) continue;
		const head = c[0].toLowerCase().replace(/’/g, "'").replace(/\s+/g, ' ');
		const pos = EXPR_POS[c[1].toLowerCase()], level = LEVELS.indexOf(c[2].toUpperCase()) + 1;
		if (!pos || !level || !/^[a-z']+( [a-z']+)+$/.test(head) || lemmas[head] || !c[3] || !c[4]) continue;
		lemmas[head] = [entries.length];
		entries.push([head, pos, level, c[4], c[3].replace(/\.$/, ''), c[5] || '']);
		exprN++;
	}
}
console.log('expressions', exprN);

const forms = {};
function addForm(form, lemma) {
	form = String(form || '').toLowerCase().trim();
	if (!form || form === lemma || /\s/.test(form) !== /\s/.test(lemma) || form.includes('-') !== lemma.includes('-')) return;
	if (lemmas[form] && !lemmas[form].some((i) => entries[i][0].toLowerCase() === lemma)) {
		// the form is itself a headword (e.g. "saw"): keep both readings
	}
	const list = (forms[form] = forms[form] || []);
	if (!list.includes(lemma)) list.push(lemma);
}

for (const lemma of Object.keys(lemmas)) {
	if (/[^a-z' -]/.test(lemma)) continue;
	const poses = new Set(lemmas[lemma].map((i) => entries[i][1]));
	const single = !/\s/.test(lemma);
	try {
		if (poses.has('verb')) {
			// conjugate the first word of phrasal verbs too ("give up" -> "gave up", "giving up")
			const [v, ...rest] = lemma.split(' ');
			const c = nlp(v).verbs().conjugate()[0] || {};
			for (const k of ['PastTense', 'PresentTense', 'Gerund', 'Participle', 'PerfectTense']) {
				if (c[k] && !/\s/.test(c[k])) addForm([c[k], ...rest].join(' '), lemma);
			}
		}
		if (poses.has('noun') && single) {
			addForm(nlp(lemma).nouns().toPlural().text(), lemma);
		}
		if (poses.has('adjective') && single) {
			const a = nlp(lemma).adjectives().conjugate()[0] || {};
			if (a.Comparative) addForm(a.Comparative, lemma);
			if (a.Superlative) addForm(a.Superlative, lemma);
		}
	} catch (e) {
		/* compromise can't inflect a few odd entries; the runtime suffix rules cover them */
	}
}

// Past participles the conjugator doesn't give.
const PARTICIPLES = { born: 'bear', borne: 'bear', been: 'be', done: 'do', gone: 'go', seen: 'see', taken: 'take', given: 'give', written: 'write', eaten: 'eat', fallen: 'fall', forgotten: 'forget', gotten: 'get', hidden: 'hide', known: 'know', ridden: 'ride', risen: 'rise', shaken: 'shake', spoken: 'speak', stolen: 'steal', sworn: 'swear', torn: 'tear', thrown: 'throw', woken: 'wake', worn: 'wear', chosen: 'choose', frozen: 'freeze', broken: 'break', driven: 'drive', beaten: 'beat', bitten: 'bite', flown: 'fly', grown: 'grow', drawn: 'draw', shown: 'show', sung: 'sing', swum: 'swim', begun: 'begin', drunk: 'drink', rung: 'ring', sunk: 'sink', mistaken: 'mistake', forgiven: 'forgive', undertaken: 'undertake', overtaken: 'overtake', withdrawn: 'withdraw', arisen: 'arise', proven: 'prove', sewn: 'sew', shrunk: 'shrink', stunk: 'stink', blown: 'blow', thrived: 'thrive', laid: 'lay', lain: 'lie', slain: 'slay', spun: 'spin', struck: 'strike', stricken: 'strike', strewn: 'strew', woven: 'weave', wound: 'wind' };
for (const f of Object.keys(PARTICIPLES)) if (lemmas[PARTICIPLES[f]]) addForm(f, PARTICIPLES[f]);

const unused = Object.keys(ORDER).filter((k) => !ORDER[k].used);
if (unused.length) console.log('en-order.tsv lines that match no entry:', unused.join(', '));

const out = { v: 1, levels: LEVELS, entries, lemmas, forms };
const dest = here('../extension/data/lexicon.json');
fs.mkdirSync(path.dirname(dest), { recursive: true });
fs.writeFileSync(dest, JSON.stringify(out));
const glossed = entries.filter((e) => e[3]).length;
console.log('english definitions', entries.filter((e) => e[4]).length, 'examples', entries.filter((e) => e[5]).length);
console.log(`entries ${entries.length}, lemmas ${Object.keys(lemmas).length}, forms ${Object.keys(forms).length}, glossed ${glossed}, ${(fs.statSync(dest).size / 1024).toFixed(0)} KB`);
