/* 🎮 Lyrics game (🎵 Music): fill the missing words of a song while it plays, like LingoClip.
   Each lyric line plays with a word missing (Learning words first, then words above the student's level);
   the video waits at the end of the line until the student answers. Two modes: Choose (4 options) or Type.
   Points and a streak; the missed words can go to Learning (review cards) at the end.
   Runs in the transcript panel (right column on a computer, under the video on a phone): yt.js starts it. */
(function () {
	'use strict';
	if (window.LensGame) return;
	var STOP = {};
	('the a an and or but so to of in on at for with from by is am are was were be been it its i me my you your he him his she her we us our they them their this that these those ' +
		'do does did not no yes oh ooh ah yeah hey na la da uh mm hmm gonna wanna gotta got get just like all can will would could should').split(' ').forEach(function (w) { STOP[w] = 1; });
	var CSS = '.game{padding:12px;border-bottom:1px solid #E6E3DF;background:#FFFDF5}.game .gh{display:flex;justify-content:space-between;align-items:center;gap:8px;margin-bottom:8px}' +
		'.game .gt{font:800 15px/1.2 Changa,"IBM Plex Sans",sans-serif}.game .sc{font:700 13px/1 "IBM Plex Sans",sans-serif;color:#57534E}.game .sc b{color:#0F0F10;font-size:15px}' +
		'.game .ln{font:600 19px/1.5 "IBM Plex Sans",sans-serif;min-height:58px;padding:8px 0}.game .nx{font-size:13px;color:#8A8584;min-height:20px}' +
		'.game .gap{display:inline-block;min-width:70px;border-bottom:3px solid #F59E0B;color:transparent;margin:0 2px}.game .gap.ok{color:#047857;border-color:#10B981}.game .gap.bad{color:#B91C1C;border-color:#EF4444}' +
		'.game .gap.cur{background:#FEF3C7;border-radius:4px 4px 0 0}.game .opts2{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:8px}' +
		'.game .gb{font:600 15px/1.2 "IBM Plex Sans",sans-serif;border:1px solid #E6E3DF;background:#fff;border-radius:10px;padding:12px 8px;cursor:pointer;color:#0F0F10;min-height:44px}' +
		'.game .gb:hover{border-color:#0F0F10}.game .gb.ok{background:#D1FAE5;border-color:#10B981}.game .gb.bad{background:#FEE2E2;border-color:#EF4444}.game .gb.pri{background:#0F0F10;color:#fff;border-color:#0F0F10}' +
		'.game .row2{display:flex;flex-wrap:wrap;gap:8px;margin-top:10px}.game .row2 .gb{flex:1;padding:9px 8px;font-size:13px}.game input{font:600 16px/1.2 "IBM Plex Sans",sans-serif;width:100%;padding:11px 12px;border:2px solid #E6E3DF;border-radius:10px;margin-top:8px;box-sizing:border-box}' +
		'.game input:focus{outline:none;border-color:#F59E0B}.game .fb{min-height:20px;font:600 13px/1.4 "IBM Plex Sans",sans-serif;margin-top:6px}.game .fb.ok{color:#047857}.game .fb.bad{color:#B91C1C}' +
		'.game .res{text-align:center}.game .big{font:800 34px/1.1 Changa,"IBM Plex Sans",sans-serif;margin:6px 0}.game .ms{text-align:left;margin-top:10px;font-size:14px}.game .ms li{display:flex;justify-content:space-between;align-items:center;gap:8px;padding:4px 0}' +
		'.game .mode{display:flex;gap:8px;margin:8px 0}.game .mode .gb{flex:1}.game .hint{font-size:12.5px;color:#8A8584;margin-top:6px}.side.gaming .list,.side.gaming .legend,.side.gaming .focus,.side.gaming .fbar,.side.gaming .vprof,.side.gaming .goal,.side.gaming .lq,.side.gaming .adv{display:none}' +
		'.game .trl{font:600 16px/1.6 "IBM Plex Sans Arabic","Segoe UI",Tahoma,sans-serif;color:#57534E;direction:rtl;text-align:right;min-height:0;margin:-4px 0 6px}.game .trl:empty{display:none}' +
		'.game .tgs{display:flex;flex-wrap:wrap;gap:6px 14px;font-size:12.5px;color:#57534E;margin:6px 0}.game .tgs label{display:flex;gap:6px;align-items:center;cursor:pointer}.game .tgs input{width:16px;height:16px;margin:0}';

	var G = null; // the running game

	function norm(w) { return String(w || '').toLowerCase().replace(/[’`]/g, "'").replace(/[^a-z']/g, ''); }
	function lev(a, b) {
		var d = [], i, j;
		for (i = 0; i <= a.length; i++) d[i] = [i];
		for (j = 0; j <= b.length; j++) d[0][j] = j;
		for (i = 1; i <= a.length; i++) for (j = 1; j <= b.length; j++) d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
		return d[a.length][b.length];
	}
	function seeded(n) { var x = Math.sin(n * 9301 + 49297) * 233280; return x - Math.floor(x); }

	/** Which word to hide in each line: Learning words first, then words beyond the student's level, then other real words. */
	function pick(lines, toks) {
		var used = {};
		return lines.map(function (l, i) {
			var ts = (toks && toks[i]) || [], best = null, bestS = 0;
			ts.forEach(function (t, k) {
				var w = norm(t.text);
				if (w.length < 3 || STOP[w] || t.status === 'name' || /'/.test(w)) return;
				var s = { learning: 6, hard: 5, next: 4, known: 2 }[t.status] || 1;
				s += Math.min(2, (t.level || 0) / 3) - (used[w] || 0) * 1.5 + seeded(i * 31 + k) * 0.5;
				if (s > bestS) { bestS = s; best = t; }
			});
			if (best) used[norm(best.text)] = (used[norm(best.text)] || 0) + 1;
			return best ? { text: best.text, start: best.start, end: best.end, lemma: best.lemma, status: best.status } : null;
		});
	}
	/** Three wrong options of a similar length from the same song (and a few common words as a fallback). */
	function options(answer, pool, i) {
		var a = norm(answer), seen = {}, out = [];
		seen[a] = 1;
		var cands = pool.filter(function (w) { var n = norm(w); return !seen[n] && Math.abs(n.length - a.length) <= 3; });
		cands.sort(function (x, y) { return seeded(i * 7 + x.length) - seeded(i * 7 + y.length) + (Math.abs(norm(x).length - a.length) - Math.abs(norm(y).length - a.length)) * 0.3; });
		for (var k = 0; k < cands.length && out.length < 3; k++) { var n = norm(cands[k]); if (!seen[n]) { seen[n] = 1; out.push(cands[k].replace(/[^A-Za-z'’]/g, '')); } }
		['heart', 'night', 'dream', 'light', 'world', 'never', 'always', 'together', 'little', 'tonight', 'feeling', 'remember'].forEach(function (w) { if (out.length < 3 && !seen[w]) { seen[w] = 1; out.push(w); } });
		// same capitals as the answer, so the odd one out doesn't give it away
		var cap = /^[A-Z]/.test(answer);
		out = out.map(function (w) { return w === 'I' ? w : cap ? w.charAt(0).toUpperCase() + w.slice(1).toLowerCase() : w.toLowerCase(); });
		out.push(answer.replace(/[^A-Za-z'’]/g, ''));
		for (var j = out.length - 1; j > 0; j--) { var r = Math.floor(seeded(i * 13 + j) * (j + 1)), tmp = out[j]; out[j] = out[r]; out[r] = tmp; }
		return out;
	}

	function start(o) {
		stop();
		var lines = o.lines.map(function (l) { return { start: l.start, end: l.end, text: l.text }; });
		var blanks = pick(lines, o.toks);
		var pool = [];
		blanks.forEach(function (b) { if (b) pool.push(b.text); });
		(o.toks || []).forEach(function (ts) { (ts || []).forEach(function (t) { var w = norm(t.text); if (w.length >= 3 && !STOP[w] && t.status !== 'name') pool.push(t.text); }); });
		G = { showTr: true, autoPause: false, released: {}, o: o, lines: lines, blanks: blanks, pool: pool, mode: o.mode || 'choose', phase: 'intro', i: -1, done: {}, score: 0, streak: 0, best: 0, right: 0, total: 0, missed: [], pausedByGame: false, timer: 0 };
		var el = o.root.querySelector('.game');
		if (!el) {
			var st = document.createElement('style');
			st.textContent = CSS;
			o.root.appendChild(st);
			el = document.createElement('div');
			el.className = 'game';
			var side = o.root.querySelector('.side'), list = o.root.querySelector('.list');
			(side || o.root).insertBefore(el, list || null);
		}
		G.el = el;
		el.hidden = false;
		var sd = o.root.querySelector('.side');
		if (sd) sd.classList.add('gaming');
		// typing must not reach YouTube's own hotkeys (f = full screen, k = pause …)
		['keydown', 'keypress', 'keyup'].forEach(function (ev) { el.addEventListener(ev, function (e) { e.stopPropagation(); if (ev === 'keydown') onKey(e); }); });
		el.addEventListener('click', onClick);
		el.addEventListener('change', onToggle);
		var playable = blanks.filter(Boolean).length;
		el.innerHTML = '<div class="gh"><div class="gt">🎮 Lyrics game</div><button class="gb" data-g="exit" style="padding:6px 10px;font-size:12px;min-height:0">✕ Close</button></div>' +
			'<div>Listen and fill in the missing word in each line (' + playable + ' lines). The video waits for you at the end of each line.</div>' +
			toggles() +
			'<div class="mode"><button class="gb pri" data-g="go-choose">Choose<br><small>4 options</small></button><button class="gb" data-g="go-type">Type it<br><small>harder</small></button></div>' +
			'<div class="hint">Tip: turn on 🎤 Vocals only to hear the words more clearly.</div>';
		if (o.onStart) o.onStart();
		// the student's own choices, kept for next time
		try {
			chrome.storage.local.get(['gameTr', 'gamePause'], function (p) {
				if (!G) return;
				G.showTr = p.gameTr !== false;
				G.autoPause = !!p.gamePause;
				G.el.querySelectorAll('[data-gt]').forEach(function (c) { c.checked = c.dataset.gt === 'tr' ? G.showTr : G.autoPause; });
			});
		} catch (e) { /* defaults */ }
		return true;
	}
	/** 🌐 the line's translation in the game · ⏸ the video stops after every line until "Next line". */
	function toggles() {
		return '<div class="tgs"><label><input type="checkbox" data-gt="tr"' + (G.showTr ? ' checked' : '') + '> 🌐 Show the translation</label>' +
			'<label title="The video stops after every line: take your time to listen and read, then press ▶ Next line"><input type="checkbox" data-gt="pause"' + (G.autoPause ? ' checked' : '') + '> ⏸ Pause after every line</label></div>';
	}
	function onToggle(e) {
		var c = e.target.closest('[data-gt]');
		if (!c || !G) return;
		if (c.dataset.gt === 'tr') G.showTr = c.checked; else G.autoPause = c.checked;
		try { chrome.storage.local.set({ gameTr: G.showTr, gamePause: G.autoPause }); } catch (err) { /* */ }
		// switching auto-pause off while the video waits: go on
		if (!G.autoPause && G.pausedByGame && G.phase === 'play' && (!G.blanks[G.i] || G.done[G.i])) next();
		else paint();
	}
	function next() {
		if (!G) return;
		G.released[G.i] = true;
		G.pausedByGame = false;
		G.o.video.play().catch(function () {});
		paint();
	}
	function stop(silent) {
		if (!G) return;
		clearInterval(G.timer);
		var o = G.o;
		if (G.el) { G.el.hidden = true; G.el.innerHTML = ''; }
		var sd = o.root.querySelector('.side');
		if (sd) sd.classList.remove('gaming');
		G = null;
		if (!silent && o.onExit) o.onExit();
	}
	function begin(mode) {
		G.mode = mode;
		G.phase = 'play';
		var v = G.o.video, first = G.lines[0];
		v.currentTime = Math.max(0, first.start / 1000 - 1.5);
		v.play().catch(function () {});
		G.timer = setInterval(tick, 100);
		paint();
	}
	function lineAt(t) {
		var L = G.lines;
		for (var i = 0; i < L.length; i++) if (t < L[i].end) return i;
		return L.length;
	}
	function tick() {
		if (!G || G.phase === 'intro' || G.phase === 'done') return;
		var v = G.o.video, t = v.currentTime * 1000, i = lineAt(t);
		if (i >= G.lines.length || v.ended) return finish();
		// the student jumped ahead: lines passed without answering don't count
		for (var k = G.i + 1; k < i; k++) if (!G.done[k]) G.done[k] = 'skipped';
		if (i !== G.i) { G.i = i; G.typed = ''; paint(); }
		var b = G.blanks[i];
		if (!v.paused && t >= G.lines[i].end - 120 && ((b && !G.done[i]) || (G.autoPause && !G.released[i]))) {
			v.pause();
			G.pausedByGame = true;
			G.waitAt = performance.now();
			paint();
		}
	}
	function answer(given) {
		var i = G.i, b = G.blanks[i];
		if (!b || G.done[i]) return;
		var a = norm(b.text), g = norm(given), ok = g === a || (a.length >= 5 && G.mode === 'type' && lev(g, a) === 1);
		G.total++;
		if (ok) { G.right++; G.streak++; G.best = Math.max(G.best, G.streak); G.score += 100 + Math.min(10, G.streak - 1) * 20; }
		else { G.streak = 0; G.missed.push({ word: b.text, lemma: b.lemma, line: G.lines[i].text, startMs: G.lines[i].start }); }
		G.done[i] = ok ? (g === a ? 'ok' : 'almost') : 'bad';
		G.given = given;
		paint();
		// carry on after a moment (longer when wrong, to read the right word)
		setTimeout(function () {
			if (!G || G.i !== i) return;
			if (G.pausedByGame && !G.autoPause) { G.pausedByGame = false; G.o.video.play().catch(function () {}); }
		}, ok ? 700 : 1800);
	}
	function finish() {
		if (!G || G.phase === 'done') return;
		G.phase = 'done';
		clearInterval(G.timer);
		G.o.video.pause();
		var pct = G.total ? Math.round(G.right / G.total * 100) : 0, u = G.o.esc;
		var seen = {}, ms = G.missed.filter(function (m) { var k = m.lemma; if (seen[k]) return false; seen[k] = 1; return true; });
		G.el.innerHTML = '<div class="res"><div class="gt">🎮 Song finished!</div><div class="big">' + G.score + '</div><div class="sc">' + pct + '% right · ' + G.right + ' of ' + G.total + ' · best streak ' + G.best + '</div>' +
			(ms.length ? '<div class="ms"><b>Words to practise</b><ul style="list-style:none;padding:0;margin:6px 0">' + ms.map(function (m, k) {
				return '<li><span><b>' + u(m.word) + '</b> <small style="color:#8A8584">' + u(m.line) + '</small></span><button class="gb" data-g="learn" data-k="' + k + '" style="padding:6px 10px;font-size:12px;min-height:0;flex:none">+ Learning</button></li>';
			}).join('') + '</ul></div>' : '<p>No mistakes. Excellent!</p>') +
			'<div class="row2"><button class="gb pri" data-g="again">Play again</button><button class="gb" data-g="exit">Back to the lyrics</button></div></div>';
		G.ms = ms;
		if (G.o.onFinish) G.o.onFinish({ score: G.score, right: G.right, total: G.total, best: G.best });
	}

	function paint() {
		if (!G || G.phase !== 'play') return;
		var u = G.o.esc, i = G.i, L = G.lines[i], b = G.blanks[i], st = G.done[i], waiting = G.pausedByGame && !st;
		var line = '';
		if (L) {
			if (b) {
				var shown = st ? '<span class="gap ' + (st === 'bad' ? 'bad' : 'ok') + '" style="color:inherit">' + u(b.text) + '</span>' : '<span class="gap cur">' + u(b.text) + '</span>';
				line = u(L.text.slice(0, b.start)) + shown + u(L.text.slice(b.end));
			} else line = u(L.text);
		}
		var next = G.lines[i + 1] ? u(G.lines[i + 1].text).replace(/./g, function (c) { return c; }) : '';
		var html = '<div class="gh"><div class="gt">🎮 Lyrics game</div><div class="sc">Score <b>' + G.score + '</b> · streak ' + G.streak + (G.streak >= 3 ? ' 🔥' : '') + '</div></div>' +
			toggles() +
			'<div class="ln">' + (line || '…') + '</div>' + (G.showTr && G.o.trOf ? '<div class="trl">' + u(G.o.trOf(i) || '') + '</div>' : '') + '<div class="nx">' + (next ? 'Next: ' + maskNext(i + 1) : '') + '</div>';
		if (b && !st) {
			if (G.mode === 'choose') html += '<div class="opts2">' + options(b.text, G.pool, i).map(function (w, k) { return '<button class="gb" data-g="opt" data-w="' + u(w) + '">' + (G.o.touch ? '' : '<small style="color:#8A8584">' + (k + 1) + '</small> ') + u(w) + '</button>'; }).join('') + '</div>';
			else html += '<input type="text" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="Type the missing word, then Enter" value="' + u(G.typed || '') + '">';
		}
		var fb = '';
		if (st === 'ok') fb = '<div class="fb ok">✓ Right! +' + (100 + Math.min(10, G.streak - 1) * 20) + '</div>';
		else if (st === 'almost') fb = '<div class="fb ok">✓ Almost: it’s spelled “' + u(b.text) + '”</div>';
		else if (st === 'bad') fb = '<div class="fb bad">✗ It’s “' + u(b.text) + '”' + (G.given ? ' (you chose “' + u(G.given) + '”)' : '') + '</div>';
		else if (waiting && b) fb = '<div class="fb">⏸ The video is waiting for your answer.</div>';
		var free = G.pausedByGame && G.autoPause && (!b || st);
		if (free) fb += '<div class="fb">⏸ Take your time. Press ▶ Next line (or Enter) when you’re ready.</div>';
		html += fb + '<div class="row2">' + (free ? '<button class="gb pri" data-g="next">▶ Next line</button>' : '') + '<button class="gb" data-g="replay">↻ Hear the line again</button>' + (b && !st ? '<button class="gb" data-g="skip">Skip</button>' : '') + '<button class="gb" data-g="exit">✕ Stop</button></div>';
		G.el.innerHTML = html;
		var inp = G.el.querySelector('input');
		if (inp && !G.o.touch) inp.focus();
		if (inp) inp.addEventListener('input', function () { G.typed = inp.value; });
	}
	function maskNext(j) {
		var L = G.lines[j], b = G.blanks[j], u = G.o.esc;
		if (!L) return '';
		return b ? u(L.text.slice(0, b.start)) + '____' + u(L.text.slice(b.end)) : u(L.text);
	}
	function onKey(e) {
		if (!G || G.phase !== 'play') return;
		if (G.mode === 'type' && e.key === 'Enter') { var inp = G.el.querySelector('input'); if (inp && inp.value.trim()) answer(inp.value.trim()); e.preventDefault(); }
		else if (G.mode === 'choose' && /^[1-4]$/.test(e.key)) { var bs = G.el.querySelectorAll('[data-g=opt]'); if (bs[+e.key - 1]) answer(bs[+e.key - 1].dataset.w); }
		else if (e.key === 'Enter' && G.pausedByGame && (!G.blanks[G.i] || G.done[G.i])) { e.preventDefault(); next(); }
	}
	// number keys (and Enter for the next line) work without clicking into the panel first
	document.addEventListener('keydown', function (e) {
		if (G && G.phase === 'play' && e.key === 'Enter' && G.pausedByGame && (!G.blanks[G.i] || G.done[G.i])) { e.stopPropagation(); e.preventDefault(); return next(); }
		if (!G || G.phase !== 'play' || G.mode !== 'choose' || !/^[1-4]$/.test(e.key) || /input|textarea/i.test((e.target && e.target.tagName) || '')) return;
		var bs = G.el.querySelectorAll('[data-g=opt]');
		if (!bs.length) return;
		e.stopPropagation(); e.preventDefault();
		if (bs[+e.key - 1]) answer(bs[+e.key - 1].dataset.w);
	}, true);
	function onClick(e) {
		var b = e.target.closest('[data-g]');
		if (!b || !G) return;
		e.stopPropagation();
		var a = b.dataset.g, v = G.o.video;
		if (a === 'go-choose') begin('choose');
		else if (a === 'go-type') begin('type');
		else if (a === 'opt') answer(b.dataset.w);
		else if (a === 'next') next();
		else if (a === 'skip') { G.done[G.i] = 'bad'; G.total++; G.streak = 0; var bl = G.blanks[G.i]; G.missed.push({ word: bl.text, lemma: bl.lemma, line: G.lines[G.i].text, startMs: G.lines[G.i].start }); G.given = ''; paint(); setTimeout(function () { if (G && G.pausedByGame && !G.autoPause) { G.pausedByGame = false; v.play().catch(function () {}); } }, 1500); }
		else if (a === 'replay') {
			var L = G.lines[G.i] || G.lines[0];
			v.currentTime = Math.max(0, L.start / 1000 - 0.3);
			G.pausedByGame = false;
			v.play().catch(function () {});
		} else if (a === 'again') { var o = G.o, m = G.mode; start(o); begin(m); }
		else if (a === 'learn') {
			var m2 = G.ms[+b.dataset.k];
			b.disabled = true; b.textContent = '…';
			G.o.send('mark', { lemma: m2.lemma, status: 'learning', ctx: { sentence: m2.line, url: location.href, title: document.title.replace(/ - YouTube$/, ''), videoId: G.o.videoId || '', startMs: m2.startMs } })
				.then(function () { b.textContent = '★ Learn'; }, function (err) { b.textContent = G && G.o.errText ? G.o.errText(err) : 'Error'; });
		} else if (a === 'exit') stop();
	}

	window.LensGame = { start: start, stop: stop, running: function () { return !!G; }, _pick: pick, _options: options, state: function () { return G && { phase: G.phase, i: G.i, score: G.score, right: G.right, total: G.total, streak: G.streak, mode: G.mode, waiting: G.pausedByGame, autoPause: G.autoPause, showTr: G.showTr, blank: G.blanks[G.i] && G.blanks[G.i].text, lines: G.lines.length }; } };
})();
