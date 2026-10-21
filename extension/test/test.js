/* Vocabulary size test (yes/no format): about 70 words from the 5,000 most common, plus a few made-up
   words that catch guessing. The result sets the learner's level and starting progress. */
'use strict';
const $ = (s) => document.querySelector(s);
const LEVELS = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];
const n = (x) => Math.round(x).toLocaleString('en-US');
const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

function send(type, data) {
	return new Promise((resolve, reject) => {
		chrome.runtime.sendMessage(Object.assign({ type }, data || {}), (res) => {
			if (chrome.runtime.lastError || !res) return reject(new Error('error'));
			return res.ok ? resolve(res.data) : reject(new Error(res.error));
		});
	});
}

let items = [], answers = [], i = 0, result = null;

function intro() {
	$('#app').innerHTML = `<div class="card">
		<h1>How many English words do you know?</h1>
		<p class="serif">three minutes.</p>
		<p>You'll see about 70 words, one at a time. For each one, answer honestly:</p>
		<ul class="how">
			<li><b>I know it</b> if you know what it means.</li>
			<li><b>Don't know</b> if you're not sure. That's fine, it's how we find your level.</li>
			<li>Some words are <b>made up</b>. Saying yes to those lowers your score, so don't guess.</li>
		</ul>
		<p class="muted">Afterwards you get your level, a starting count for your top 1,000 / 2,000 / 3,000 word goals, and Language Lens colours words for your level.</p>
		<button class="btn red" id="go">Start the test</button>
	</div>`;
	$('#go').onclick = async () => {
		$('#go').disabled = true;
		try {
			items = await send('testItems');
			answers = [];
			i = 0;
			ask();
		} catch (e) {
			$('#go').disabled = false;
			$('#go').textContent = e.message === 'signed_out' ? 'Sign in from the Language Lens icon first' : 'Try again';
		}
	};
}

function ask() {
	if (i >= items.length) return finish();
	const it = items[i];
	$('#app').innerHTML = `<div class="card">
		<div class="count">${i + 1} of ${items.length}</div>
		<div class="prog"><i style="width:${(i / items.length) * 100}%"></i></div>
		<div class="word">${esc(it.w)}</div>
		<div class="answer"><button class="btn ghost" data-y="0">Don't know</button><button class="btn" data-y="1">I know it</button></div>
		<div class="keys">Keys: <kbd>←</kbd> don't know · <kbd>→</kbd> I know it${i ? ' · <kbd>Backspace</kbd> back' : ''}</div>
	</div>`;
	document.querySelectorAll('[data-y]').forEach((b) => { b.onclick = () => answer(b.dataset.y === '1'); });
}

function answer(yes) {
	answers[i] = Object.assign({}, items[i], { yes });
	i++;
	ask();
}

document.addEventListener('keydown', (e) => {
	if (!items.length || result || i >= items.length) return;
	if (e.key === 'ArrowRight' || e.key.toLowerCase() === 'k') answer(true);
	else if (e.key === 'ArrowLeft' || e.key.toLowerCase() === 'j') answer(false);
	else if (e.key === 'Backspace' && i > 0) {
		i--;
		ask();
	}
});

async function finish() {
	$('#app').innerHTML = '<div class="card"><p>Working out your vocabulary…</p></div>';
	result = await send('saveTest', { answers: answers.filter(Boolean) });
	const lv = result.suggestedLevel;
	$('#app').innerHTML = `<div class="card">
		<p class="muted">Your estimate</p>
		<div class="big">≈ ${n(result.estimate)}</div>
		<p>of the 5,000 most common English words.</p>
		${result.falseAlarms > 0.3 ? `<div class="warn">You said yes to several made-up words, so this estimate is rough. Take the test again when you're ready and only say yes when you're sure.</div>` : ''}
		<div class="bands">${result.bands.map((p, b) => `<div class="band"><span>${b ? n(b * 1000 + 1) + '–' : 'Top '}${n((b + 1) * 1000)}</span><span class="bar"><i style="width:${Math.round(p * 100)}%"></i></span><b>${Math.round(p * 100)}%</b></div>`).join('')}</div>
		<p>Suggested level: <b>${LEVELS[lv - 1]}</b>. Words up to this level will count as known; new words above it get coloured.</p>
		<div class="row" style="margin:16px 0 8px"><button class="btn" id="use">Use ${LEVELS[lv - 1]} as my level</button><button class="btn ghost" id="again">Take it again</button></div>
		${result.unknown.length ? `<p style="margin-top:20px"><b>Common words to learn first</b> (from the top 3,000):</p><div class="chips">${result.unknown.map((w) => `<span>${esc(w)}</span>`).join('')}</div>
		<button class="btn ghost" id="learn">Add them to my Learning list</button>` : ''}
		<p class="muted" id="done" style="margin-top:16px"></p>
	</div>`;
	$('#use').onclick = async () => {
		await send('setLevel', { level: lv });
		$('#use').textContent = 'Level set ✓';
		$('#use').disabled = true;
	};
	$('#again').onclick = () => { result = null; intro(); };
	const learn = $('#learn');
	if (learn) {
		learn.onclick = async () => {
			learn.disabled = true;
			for (const w of result.unknown) await send('mark', { lemma: w, status: 'learning' });
			learn.textContent = 'Added ✓ They\'ll be highlighted yellow everywhere.';
		};
	}
}

intro();
