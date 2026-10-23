/* Captions → full sentences, phrases on the whole sentence, and the phrase rules (Language Lens 0.8.2). No browser.
   Usage: node captions-test.js   (also run by mobile-test.js) */
'use strict';
require('../extension/core/lens-core.js');
require('../extension/core/captions.js');
const C = globalThis.LensCaptions;
const RULES = require('../extension/data/rules.json');

function run(log) {
	let bad = 0;
	const check = (name, ok, info) => { if (!ok) bad++; log(ok ? '✓' : '✗', name, info == null ? '' : info); };
	const L = new globalThis.Lens(require('../extension/data/lexicon.json'));
	L.setRules(RULES);
	const user = { level: 2, words: {} };
	const exprs = (s) => L.analyze(s, user).filter((t) => t.ex).map((t) => t.text + '=' + t.lemma);

	// Auto captions, no punctuation, in timed pieces (Sherif's example: the middle piece is half a sentence).
	const asr = (pieces) => {
		let t = 0;
		return pieces.map(([text, gap]) => {
			const ws = text.split(' ').map((w) => { const o = { t, text: w }; t += 300; return o; });
			const c = { start: ws[0].t, end: t, text, words: ws };
			t += gap || 0;
			return c;
		});
	};
	const cues = asr([['the best ideas come in the', 0], ["moment when you're not thinking about", 900], ['it at all so you have to', 0], ['give', 0], ['up control for a while', 1200], ['and that is fine', 0]]);
	const sents = C.sentences(cues, true, RULES.sentences);
	check('auto captions: a sentence does not end on "about" at a pause', sents.some((s) => /thinking about it at all/.test(s.text)), sents.map((s) => s.text).join(' | '));
	const parts = C.cueParts(cues.length, sents);
	const mid = parts[1];
	check('the middle piece maps to its whole sentence', mid.length && sents[mid[0].s].text.indexOf("moment when you're not thinking about") >= 0, mid.length && sents[mid[0].s].text);
	check('every word of every piece is in a sentence', cues.every((c, i) => parts[i].reduce((n, p) => n + p.n, 0) === c.text.replace(/ /g, '').length));
	const toks = sents.map((s) => L.analyze(s.text, user));
	const give = C.cueToks(parts[3], toks, cues[3].text), up = C.cueToks(parts[4], toks, cues[4].text);
	check('"give | up" split over two pieces: both underlined as "give up"', give[0] && give[0].ex && give[0].lemma === 'give up' && up[0] && up[0].ex && up[0].lemma === 'give up' && up[0].text === 'up', JSON.stringify([give[0], up[0]].map((t) => t && t.text + '=' + t.lemma)));
	const midToks = C.cueToks(parts[1], toks, cues[1].text);
	check('mapped tokens point at the right letters', midToks.every((t) => cues[1].text.slice(t.start, t.end) === t.text), midToks.map((t) => t.text).join(','));
	check('"thinking about" is not underlined as a phrase (plain verb + preposition)', !midToks.some((t) => t.ex), midToks.filter((t) => t.ex).map((t) => t.lemma).join(','));
	check('which sentence is heard: a piece that holds two sentences', (() => {
		const j = parts[4][parts[4].length - 1].s, i = parts[4][0].s;
		return C.sentenceAt(parts[4], sents, 0) === i && C.sentenceAt(parts[4], sents, sents[j].start + 1) === j;
	})());

	// Hand-made captions with punctuation: sentence ends at . ! ?, pieces map back.
	const man = [{ start: 0, end: 2000, text: 'Dr. Smith said we should' }, { start: 2000, end: 4000, text: 'look after our health. Then he' }, { start: 4000, end: 6000, text: 'left.' }];
	const ms = C.sentences(man, false, RULES.sentences);
	check('punctuated captions: "Dr." does not end a sentence', ms.length === 2 && ms[0].text === 'Dr. Smith said we should look after our health.', ms.map((s) => s.text).join(' | '));
	const mp = C.cueParts(man.length, ms);
	check('a piece with the end of one sentence and the start of the next maps to both', mp[1].length && mp[1][0].s === 0 && mp[1][mp[1].length - 1].s === 1);

	// Phrase rules from the server.
	check('rules: "look at" not underlined', !exprs('Look at this picture.').length, exprs('Look at this picture.').join());
	check('rules: "put it on the table" is not the idiom', !exprs('Put it on the table, please.').some((e) => /on the table/.test(e)), exprs('Put it on the table, please.').join());
	check('rules: "the offer is on the table" is the idiom', exprs('The offer is still on the table.').some((e) => /on the table/.test(e)));
	check('rules: "a kind of fruit" is not "kind of"', !exprs('It is a kind of fruit.').some((e) => /=kind of$/.test(e)));
	check('rules: "I kind of like it" is "kind of"', exprs('I kind of like it.').some((e) => /kind of/.test(e)));
	check('rules: real phrasal verbs stay ("look after", "give up")', exprs('She gave up and I look after the kids.').length === 2, exprs('She gave up and I look after the kids.').join());
	return bad;
}

module.exports = run;
if (require.main === module) {
	const bad = run(console.log);
	console.log(bad ? bad + ' failed' : 'all passed');
	process.exit(bad ? 1 : 0);
}
