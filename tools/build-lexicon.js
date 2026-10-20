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

const rows = [...csv('data/cefrj-vocabulary-profile-1.5.csv'), ...csv('data/octanove-vocabulary-profile-c1c2-1.0.csv')];
const entries = [];
const lemmas = {};
const seen = new Set();
for (const r of rows) {
	const key = r.head + '|' + r.pos;
	if (seen.has(key)) continue;
	seen.add(key);
	const idx = entries.length;
	entries.push([r.head, r.pos, r.level, gloss[key] || '']);
	// "a.m./A.M./am/AM" -> each spelling is a lemma key
	for (const v of r.head.split('/')) {
		const k = v.trim().toLowerCase();
		if (!k) continue;
		(lemmas[k] = lemmas[k] || []).push(idx);
	}
}

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

const out = { v: 1, levels: LEVELS, entries, lemmas, forms };
const dest = here('../extension/data/lexicon.json');
fs.mkdirSync(path.dirname(dest), { recursive: true });
fs.writeFileSync(dest, JSON.stringify(out));
const glossed = entries.filter((e) => e[3]).length;
console.log(`entries ${entries.length}, lemmas ${Object.keys(lemmas).length}, forms ${Object.keys(forms).length}, glossed ${glossed}, ${(fs.statSync(dest).size / 1024).toFixed(0)} KB`);
