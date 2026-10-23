/* Expressions (phrasal verbs, idioms, compounds): matching and speed, without a browser.
   Usage: node expr-test.js */
'use strict';
require('../extension/core/lens-core.js');
const L = new globalThis.Lens(require('../extension/data/lexicon.json'));
const user = { level: 2, words: {} };
let bad = 0;
const check = (name, ok, info) => { if (!ok) bad++; console.log(ok ? '✓' : '✗', name, info == null ? '' : info); };
const exprs = (s, u) => L.analyze(s, u || user).filter((t) => t.ex).map((t) => t.text + '=' + t.lemma);

const CASES = [
	['I am still on the fence about it.', ['on the fence=on the fence']],
	['She gave up smoking.', ['gave up=give up']],
	['Just give it up!', ['give it up=give up']],
	['He turned the lights off.', ['turned the lights off=turn off']],
	['We are looking forward to the trip.', ['looking forward to=look forward to']],
	['I called customer services twice.', ['customer services=customer service']],
	['He finally made up his mind.', ['made up his mind=make up one\'s mind']],
	['Are you pulling my leg?', ['pulling my leg=pull someone\'s leg']],
	['By the way, she came up with a plan.', ['By the way=by the way', 'came up with=come up with']],
	['It cost an arm and a leg.', ['cost an arm and a leg=cost an arm and a leg']],
	// Not across a full stop, and on/in don't split ("put it on the table" is not "put on").
	['I gave. Up there it is.', []],
	['Put it on, please.', []]
];
for (const [s, want] of CASES) {
	const got = exprs(s);
	check(s, want.every((w) => got.includes(w)) && (want.length || !got.some((g) => /^(gave|put)/i.test(g))), got.join(' | '));
}

const e = L.entries('on the fence')[0] || {};
check('"on the fence" has one meaning for the whole phrase', e.pos === 'idiom' && e.en && e.ar, JSON.stringify(e));
check('learning an expression colours it as learning', L.analyze('Never give up.', { level: 2, words: { 'give up': 'learning' } }).some((t) => t.ex && t.status === 'learning'));
check('switched off: words one by one', !exprs('She gave up.', { level: 2, words: {}, noExpr: true }).length);
check('a saved expression still wins with the switch off', L.analyze('She gave up.', { level: 2, words: { 'give up': 'learning' }, noExpr: true }).some((t) => t.lemma === 'give up'));

const n = L.lex.entries.filter((x) => ['phrasal verb', 'idiom', 'compound noun', 'phrase'].includes(x[1])).length;
check('dictionary has a few thousand expressions', n > 2000, n);

// Long captions / pages must stay fast (phones are ~4x slower than this computer).
const page = 'So I gave up on that idea, you know, and we looked forward to the weekend because the customer service team was on the fence. '.repeat(1500);
const t = Date.now();
L.analyze(page, user);
const ms = Date.now() - t;
check('180,000 characters analysed in under 400 ms', ms < 400, ms + ' ms');

console.log(bad ? bad + ' check(s) failed' : 'all checks passed');
process.exit(bad ? 1 : 0);
