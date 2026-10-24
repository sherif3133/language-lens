/* Language Lens: Quiz Mode (0.11.0), replaces the old "pause the video" quiz.
   Before the video: a small banner "Study this video's words? Start · Skip". Start → pick 10 / 15 / 20 words → the video's most
   frequent words you do not know yet (anything Known or within your level is left out and the list is refilled from the next
   most frequent words) → tick the ones you already know (they become Known, one tap to undo) → the rest become Learn, then the
   video plays from the start with NO pauses. At the end: a short listen-and-pick review of those words.
   A Skip is visible on every step. Off: Menu → Further Controls → Quiz Mode (nothing is shown, normal saving works).
   yt.js gives the api (see QUIZ_API there). */
(function () {
	'use strict';
	var A = null, root = null, el = null, st = null;
	var U = window.LensUI;

	var CSS = '.sq{position:absolute;inset:0;z-index:70;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,.72);pointer-events:auto;font:500 14px/1.4 "IBM Plex Sans","Segoe UI",system-ui,sans-serif;color:#fff}' +
		'.sq[hidden]{display:none}.sqc{width:min(94%,460px);max-height:94%;overflow:auto;background:#17191F;border:1px solid #333;border-radius:14px;padding:16px;box-sizing:border-box}' +
		'.sqc h3{margin:0 0 4px;font:800 18px/1.3 Changa,"IBM Plex Sans",sans-serif}.sqc p{margin:0 0 10px;color:#C9CDD3}.sqc .ar{direction:rtl;color:#FDE68A;font-size:13px}' +
		'.sqb{position:absolute;left:50%;top:12px;transform:translateX(-50%);z-index:70;display:flex;align-items:center;gap:10px;flex-wrap:wrap;justify-content:center;background:rgba(15,15,16,.94);border:1px solid #444;border-radius:12px;padding:8px 12px;font:600 14px/1.3 "IBM Plex Sans","Segoe UI",system-ui,sans-serif;color:#fff;pointer-events:auto;max-width:94%}' +
		'.sqb[hidden]{display:none}' +
		'.sqbtn{all:unset;box-sizing:border-box;cursor:pointer;min-height:44px;padding:0 16px;border-radius:10px;display:inline-flex;align-items:center;justify-content:center;background:#2A2F3A;color:#fff;font-weight:600}' +
		'.sqbtn:hover{background:#363C4A}.sqbtn.go{background:#22C55E;color:#04210F;font-weight:700}.sqbtn.link{background:none;color:#9AB;text-decoration:underline;min-width:60px}' +
		'.sqopt{display:flex;align-items:center;justify-content:space-between;width:100%;margin:6px 0;min-height:48px;padding:0 14px}' +
		'.sqrow{display:flex;align-items:center;gap:10px;min-height:46px;padding:2px 6px;border-bottom:1px solid #262A33}.sqrow .w{flex:1}.sqrow small{color:#8A8584}' +
		'.sqrow input{width:22px;height:22px;flex:none}.sqrow.done .w{text-decoration:line-through;color:#8A8584}.sqrow .undo{color:#7CC4FF;cursor:pointer;min-height:44px;display:inline-flex;align-items:center}' +
		'.sqbar{height:6px;background:#2A2D36;border-radius:3px;margin:4px 0 12px}.sqbar i{display:block;height:100%;background:#22C55E;border-radius:3px}' +
		'.sqq{font-size:17px;font-weight:600;margin:6px 0 12px}.sqq u{text-decoration:none;border-bottom:2px solid #fff;padding:0 22px}' +
		'.sqfb{margin:8px 0;padding:8px 10px;border-radius:8px}.sqfb.ok{background:#14301F}.sqfb.no{background:#3A1A1A}' +
		'.sqf{display:flex;gap:8px;justify-content:space-between;align-items:center;margin-top:10px;flex-wrap:wrap}';

	function t(s) { return U.esc(s); }
	function ensure() {
		if (el && el.getRootNode() !== A.root()) el = null; // the player was rebuilt
		if (el) return el;
		var st0 = document.createElement('style');
		st0.textContent = CSS;
		root.appendChild(st0);
		el = document.createElement('div');
		el.className = 'sq';
		el.hidden = true;
		root.appendChild(el);
		el.addEventListener('click', function (e) { e.stopPropagation(); var b = e.target.closest('[data-q]'); if (b) act(b.dataset.q, b); });
		el.addEventListener('change', function (e) { var c = e.target.closest('input[data-w]'); if (c) tick(c); });
		return el;
	}
	function card(html) { ensure().hidden = false; el.innerHTML = '<div class="sqc">' + html + '</div>'; }
	function close(play) {
		if (el) { el.hidden = true; el.innerHTML = ''; }
		if (play && A.video()) A.video().play();
	}
	function banner(show) {
		root = A && A.root();
		if (!root) return;
		var b = root.querySelector('.sqb');
		if (!show) { if (b) b.hidden = true; return; }
		if (!b) {
			b = document.createElement('div');
			b.className = 'sqb';
			root.appendChild(b);
			b.addEventListener('click', function (e) { e.stopPropagation(); var x = e.target.closest('[data-q]'); if (x) act(x.dataset.q, x); });
		}
		b.hidden = false;
		b.innerHTML = '<span>📚 Study this video’s words? <span class="ar" dir="rtl" style="color:#FDE68A">ادرس كلمات هذا الفيديو؟</span></span><button class="sqbtn go" data-q="start">Start</button><button class="sqbtn link" data-q="skipoffer">Skip · تخطَّ</button>';
	}

	/* ------------------------------------------------------------ steps */
	function offer() {
		if (!A || !A.on() || !A.cues() || A.ad()) return;
		var vid = A.videoId();
		if (!vid || (st && st.vid === vid && st.state !== 'idle')) return;
		if (st && st.vid === vid && st.skipped) return;
		root = A.root();
		ensure();
		st = { vid: vid, state: 'offered', words: [], pool: [], n: 0, learned: 0, waiting: 0 };
		banner(true);
	}

	function pick() {
		banner(false);
		if (A.video()) A.video().pause();
		card('<h3>How many words from this video?</h3><p class="ar">كم كلمة تريد من هذا الفيديو؟</p><p>Learning time is about 25 seconds a word.</p><p class="muted" id="sqwait" style="color:#8A8584">…</p>');
		A.daily().then(function (d) {
			var catchup = !!(d && d.catchup);
			var opts = (catchup ? [10] : [10, 15, 20]).map(function (n) { return '<button class="sqbtn sqopt" data-q="n" data-n="' + n + '"><b>' + n + ' words</b><span>~' + Math.round(n * 25 / 60) + ' min</span></button>'; }).join('');
			card('<h3>How many words from this video?</h3><p class="ar">كم كلمة تريد من هذا الفيديو؟</p>' + opts +
				(catchup ? '<p style="color:#FDE68A">You have many review cards waiting, so only 10 words today. Review them first. · عندك بطاقات مراجعة كثيرة، فقط ١٠ كلمات اليوم.</p>' : '') +
				'<div class="sqf"><span></span><button class="sqbtn link" data-q="skipall">Skip · تخطَّ</button></div>');
		}, function () { close(true); });
	}

	function loadWords(n) {
		st.n = n;
		card('<h3>Finding the words…</h3>');
		A.words().then(function (list) {
			st.pool = (list || []).slice();
			st.words = st.pool.splice(0, n);
			if (!st.words.length) {
				card('<h3>Nothing new to study here</h3><p>You already know the common words of this video.</p><p class="ar">تعرف الكلمات الشائعة في هذا الفيديو.</p><div class="sqf"><span></span><button class="sqbtn go" data-q="watch0">Watch</button></div>');
				return;
			}
			st.state = 'list';
			paintList();
		}, function () { close(true); });
	}

	function paintList() {
		var rows = st.words.map(function (w, i) {
			return '<div class="sqrow' + (w.known ? ' done' : '') + '"><input type="checkbox" data-w="' + i + '" aria-label="I know ' + t(w.lemma) + '"' + (w.known ? ' checked' : '') + '><span class="w"><b>' + t(w.lemma) + '</b> <small>×' + w.count + (w.ar ? ' · ' + t(w.ar) : '') + '</small></span>' + (w.known ? '<span class="undo" data-q="undo" data-i="' + i + '">Undo</span>' : '') + '</div>';
		}).join('');
		card('<h3>Tick the words you already know</h3><p class="ar">ضع علامة على الكلمات التي تعرفها</p>' +
			'<p>The rest become your Learn words and you are asked about them after the video.</p>' + rows +
			'<div class="sqf"><button class="sqbtn link" data-q="skipall">Skip · تخطَّ</button><button class="sqbtn go" data-q="watch">Start watching · ابدأ المشاهدة</button></div>');
	}

	function tick(c) {
		var w = st.words[+c.dataset.w];
		if (!w || w.known) { c.checked = false; return; }
		w.known = true;
		A.mark(w.lemma, 'known').catch(function () {});
		var next = st.pool.shift(); // refill: the next most frequent word you do not know
		if (next) st.words.push(next);
		paintList();
	}

	function undo(i) {
		var w = st.words[+i];
		if (!w) return;
		w.known = false;
		A.mark(w.lemma, '').catch(function () {});
		paintList();
	}

	function watch() {
		var chosen = st.words.filter(function (w) { return !w.known; });
		st.words = chosen;
		st.state = 'watching';
		var done = 0, room = Promise.resolve();
		chosen.forEach(function (w) {
			var s = A.sentenceOf(w.lemma);
			w.sentence = s;
			room = room.then(function () {
				return A.mark(w.lemma, 'learning', s).then(function () { st.learned++; }, function () { st.waiting++; }); // no room today: still asked, saved another day
			});
		});
		room.then(function () {
			var v = A.video();
			close(false);
			A.say(st.learned + ' words saved to Learn' + (st.waiting ? ', ' + st.waiting + ' waiting for room' : '') + '. Watch the video: a short review comes at the end.');
			if (v) { v.currentTime = 0; v.play(); }
		});
	}

	/* ------------------------------------------------------------ end of the video: the review */
	function tickEnd(v) {
		if (!st || st.state !== 'watching' || !v) return;
		if (v.ended || (v.duration > 10 && v.currentTime >= v.duration - 0.6)) startReview();
	}

	function startReview() {
		if (!st.words.length) { st.state = 'done'; return; }
		st.state = 'review';
		st.i = 0; st.right = 0; st.asked = 0;
		root = A.root();
		question();
	}

	function question() {
		var w = st.words[st.i];
		if (!w) return finish();
		var s = w.sentence;
		if (!s) { st.i++; return question(); }
		var re = new RegExp('\\b' + w.surface.replace(/[^a-z\']/gi, '') + '[a-z]*\\b', 'i');
		var m = s.text.match(re);
		var shown = m ? s.text.replace(m[0], '_____') : s.text + ' (_____)';
		var answer = (m ? m[0] : w.surface).toLowerCase();
		w.answer = answer;
		card('<div class="sqbar"><i style="width:' + Math.round(100 * st.i / st.words.length) + '%"></i></div><p style="color:#8A8584">' + (st.i + 1) + ' of ' + st.words.length + '</p>' +
			'<div class="sqq">Which word did you hear?<br><span style="font-weight:500">' + t(shown).replace('_____', '<u></u>') + '</span></div>' +
			'<button class="sqbtn sqopt" data-q="clip">🔊 Play the clip again <span class="ar">أعد المقطع</span></button><div id="sqopts"></div><div id="sqout"></div>' +
			'<div class="sqf"><button class="sqbtn link" data-q="skipitem">Skip · تخطَّ</button><button class="sqbtn link" data-q="later">Review later · لاحقًا</button></div>');
		A.play(s.start, s.end);
		A.distractors(w.lemma).then(function (ds) {
			var opts = (ds || []).slice(0, 2).concat([answer]).sort(function () { return Math.random() - 0.5; });
			var box = el.querySelector('#sqopts');
			if (box) box.innerHTML = opts.map(function (o) { return '<button class="sqbtn sqopt" data-q="ans" data-o="' + t(o) + '">' + t(o) + '</button>'; }).join('');
		}, function () { var box = el.querySelector('#sqopts'); if (box) box.innerHTML = '<button class="sqbtn sqopt" data-q="ans" data-o="' + t(answer) + '">' + t(answer) + '</button>'; });
	}

	function answer(o, b) {
		var w = st.words[st.i], ok = String(o).toLowerCase() === w.answer;
		if (!w.retry) { st.asked++; if (ok) st.right++; }
		if (!ok && !w.retry && !w.requeued) { w.requeued = true; st.words.push({ lemma: w.lemma, surface: w.surface, count: w.count, ar: w.ar, sentence: w.sentence, retry: true }); } // a wrong word is asked once more at the end
		if (!w.retry) w.ok = ok; // sent to the server: a right answer is the card's first learning step, a wrong one brings the word back today
		if (window.LensStudy) LensStudy.quiz();
		el.querySelectorAll('[data-q=ans]').forEach(function (x) { x.disabled = true; if (x.dataset.o.toLowerCase() === w.answer) x.style.background = '#14301F'; });
		if (!ok && b) b.style.background = '#3A1A1A';
		el.querySelector('#sqout').innerHTML = '<div class="sqfb ' + (ok ? 'ok' : 'no') + '"><b>' + (ok ? 'Correct ✓' : 'It was “' + t(w.answer) + '”') + '</b><div>' + t(w.sentence.text) + '</div></div><div class="sqf"><span></span><button class="sqbtn go" data-q="next">Next</button></div>';
	}

	/** Tell the server how the answers went (skipped items are not sent). Resolves with what it did, or null (old server). */
	function sendResults() {
		var answered = st.words.filter(function (w) { return !w.retry && (w.ok === true || w.ok === false); });
		if (st.sent || !answered.length) return Promise.resolve(null);
		st.sent = true;
		return A.record({ asked: st.asked, right: st.right, words: st.words.length, results: answered.map(function (w) { return { lemma: w.lemma, ok: w.ok }; }) });
	}

	function finish() {
		st.state = 'done';
		card('<h3>Done ✓</h3><p>' + st.right + ' of ' + st.asked + ' right. Your words are in your Review cards.</p><p class="ar">انتهى. كلماتك في بطاقات المراجعة.</p><p id="sqres" style="color:#FDE68A"></p><div class="sqf"><span></span><button class="sqbtn go" data-q="close">Close</button></div>');
		sendResults().then(function (r) {
			var o = el && el.querySelector('#sqres');
			if (o && r && r.again) o.textContent = r.again + (r.again === 1 ? ' word comes' : ' words come') + ' back in your Review today · ' + r.again + ' كلمات ستعود إليك اليوم';
		});
	}

	function act(q, b) {
		if (q === 'start') pick();
		else if (q === 'skipoffer') { banner(false); st.skipped = true; st.state = 'skipped'; }
		else if (q === 'n') loadWords(+b.dataset.n);
		else if (q === 'skipall') { banner(false); st.state = 'skipped'; st.skipped = true; close(true); }
		else if (q === 'undo') undo(b.dataset.i);
		else if (q === 'watch') watch();
		else if (q === 'watch0') { st.state = 'skipped'; st.skipped = true; close(true); }
		else if (q === 'clip') { var w = st.words[st.i]; if (w && w.sentence) A.play(w.sentence.start, w.sentence.end); }
		else if (q === 'ans') answer(b.dataset.o, b);
		else if (q === 'next' || q === 'skipitem') { st.i++; question(); }
		else if (q === 'later') { st.state = 'done'; sendResults(); close(false); }
		else if (q === 'close') close(false);
	}

	function reset() {
		root = A && A.root();
		if (el) { el.hidden = true; el.innerHTML = ''; }
		banner(false);
		st = null;
	}

	window.LensQuiz = {
		init: function (api) { A = api; root = api.root(); },
		offer: offer, tick: tickEnd, reset: reset,
		state: function () { return st && st.state; },
		active: function () { return !!(st && (st.state === 'list' || st.state === 'review')); }
	};
})();
