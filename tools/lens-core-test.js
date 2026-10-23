/* Unit check for "You know about N% of the words" (lens-core grade, education/placement-test-spec.md Part 3).
   node tools/lens-core-test.js   (no browser, no server) */
const path = require('path');
const fs = require('fs');
const EXT = path.join(__dirname, '..', 'extension');
require(path.join(EXT, 'core', 'lens-core.js'));
const lex = require(path.join(EXT, 'data', 'lexicon.json'));
const F = require(path.join(EXT, 'data', 'freq.json'));
const rank = {};
F.ranked.forEach((w, i) => { rank[w] = i + 1; });
const L = new globalThis.Lens(lex);
L.setFreq(rank);

const TEXT = 'So today I want to talk about something that a lot of people struggle with when they start learning a new language. ' +
	'You watch a video and you think you understand everything, but then someone asks you a simple question and you just freeze. ' +
	'That happens because listening and speaking are different skills, and the only way to get better is to practise every single day. ' +
	'The first habit is shadowing: you listen to a sentence, pause, and repeat it with the same rhythm and intonation. ' +
	'It feels awkward at first, but within a few weeks your pronunciation becomes noticeably smoother.';

let fail = 0;
const ok = (cond, msg) => { console.log((cond ? 'ok   ' : 'FAIL ') + msg); if (!cond) fail++; };
const pct = (user) => L.grade(L.analyze(TEXT, Object.assign({ words: {} }, user))).percent;

// 1. The default profiles by level: higher level, higher %.
const byLevel = [1, 2, 3, 4].map((lv) => pct({ level: lv }));
console.log('     levels A1–B2:', byLevel.join(' / '));
ok(byLevel.every((p, i) => !i || p > byLevel[i - 1]), 'each level up raises the %');

// 2. A profile change changes the % for a fixed transcript (the 89% bug: a B1 result must move the number).
const a2 = pct({ level: 2 });
const tested = pct({ level: 2, profile: { bands: [0.99, 0.9, 0.7, 0.45, 0.25, 0.12], source: 'test' } });
ok(tested > a2, 'a stronger test profile raises the % (' + a2 + ' → ' + tested + ')');
const weak = pct({ level: 2, profile: { bands: [0.7, 0.3, 0.1, 0.05, 0.02, 0.01], source: 'test' } });
ok(weak < a2, 'a weaker test profile lowers the % (' + a2 + ' → ' + weak + ')');
ok(pct({ level: 3 }) === pct({ level: 2, profile: { bands: globalThis.Lens.LEVEL_PROFILES[3] } }), 'level B1 = the B1 profile');

// 3. Marks: known words count fully, "learning" counts 0 unless its review card is at 21+ days.
const words = { shadowing: 'known', intonation: 'known', awkward: 'known', smoother: 'known', noticeably: 'known', pronunciation: 'known' };
ok(pct({ level: 2, words }) > a2, 'marking words known raises the %');
const learn = pct({ level: 2, words: { language: 'learning', people: 'learning' } });
ok(learn < a2, '"learning" words count as unknown');
ok(pct({ level: 2, words: { language: 'learning', people: 'learning' }, mature: { language: true, people: true } }) > learn, 'mature review cards count as known');

// 4. The chance curve: never rises with rank, the top words are ~certain, and it never goes outside 0–1.
const u = { level: 2, words: {} };
const cs = ['the', 'people', 'language', 'struggle', 'rhythm', 'intonation'].map((w) => L.chance(w, u));
ok(cs[0] > 0.99, '"the" is known at A2 (' + cs[0].toFixed(3) + ')');
ok(cs.every((c) => c >= 0 && c <= 1), 'chance stays in 0–1');
let mono = true, prev = 1;
for (let r = 1; r <= 7000; r += 50) { const w = F.ranked[r - 1]; if (!w) break; const c = L.chance(w, u); if (c > prev + 1e-9) mono = false; prev = c; }
ok(mono, 'chance never rises with frequency rank');

// 5. Names don't count; old callers without a profile or freq still work.
const L2 = new globalThis.Lens(lex);
const g2 = L2.grade(L2.analyze(TEXT, { level: 2, words: {} }));
ok(g2.percent > 0 && g2.percent <= 100, 'works without freq ranks (CEFR-J level fallback): ' + g2.percent + '%');
ok(L.grade(L.analyze('Yesterday Maria and Ahmed met Khaled in Alexandria.', u)).words === 4, 'names are not counted');
ok(L.grade([]).percent === 100, 'empty text = 100%');

// 6. The same level profiles as the server.
const php = fs.readFileSync(path.join(__dirname, '..', '..', 'sawa-lens', 'includes', 'class-store.php'), 'utf8');
const m = php.match(/LEVEL_PROFILES = array\(([\s\S]*?)\n\t\);/);
const server = m ? m[1].split('\n').filter((l) => /=>/.test(l)).map((l) => l.replace(/.*array\(|\),?\s*$/g, '').split(',').map(Number)) : [];
ok(server.length === 6 && server.every((b, i) => JSON.stringify(b) === JSON.stringify(globalThis.Lens.LEVEL_PROFILES[i + 1])), 'level profiles match sawa-lens');

console.log(fail ? fail + ' FAILED' : 'all passed');
process.exit(fail ? 1 : 0);
