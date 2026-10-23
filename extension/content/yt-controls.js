/* Language Lens — the sentence control strip on YouTube captions (computer and phone).
   A slim strip above the caption, shown on hover (computer) or after a tap (phone), and kept in view while a mode is on:
     ‹ previous · ⟲ repeat · › next  |  🔁 loop this sentence · 0.75× slower  |  🗣 Shadow mode · 🎤 record and compare
   Shadow mode: each sentence plays, then the video waits a "your turn" ring (about the sentence's length) for the student to
   say it, then goes on by itself. With 🎤, the student's voice is recorded during the ring and played right after: speaker,
   then you. The recording stays in this tab (never uploaded) and is dropped at the next sentence.
   Phones: swipe the caption left/right = next/previous sentence, double-tap = repeat.
   Keys (computer): A previous · S repeat · D next (in yt.js) · R loop · X slower · W shadow.
   Everything works on whole sentences (core/captions.js), not on YouTube's caption pieces.
   yt.js gives the api: { video(), sents(), current(), go(a), loop(j), looping(), say(t), hideCard() }. */
(function () {
	'use strict';
	var A = null, root = null, el = null, host = null;
	var st = { slow: false, shadow: false, mic: false, turnT: 0, stream: null, rec: null, chunks: [], audio: null, showT: 0, lastVideo: null, ownPlay: 0 };

	var CSS = '' +
		'.ctrl{position:absolute;left:50%;bottom:100%;transform:translateX(-50%);margin-bottom:6px;display:flex;align-items:center;gap:2px;padding:3px;' +
		'background:rgba(15,15,16,.92);border:1px solid rgba(255,255,255,.18);border-radius:999px;font:600 13px/1 "IBM Plex Sans","Segoe UI",system-ui,sans-serif;' +
		'white-space:nowrap;opacity:0;visibility:hidden;transition:opacity .15s,visibility .15s;pointer-events:auto;z-index:1}' +
		'.ctrl::after{content:"";position:absolute;left:0;right:0;top:100%;height:8px}' + // no gap between the caption and the strip: the hover stays
		'.bar:hover .ctrl,.ctrl.show,.ctrl.busy{opacity:1;visibility:visible}.ctrl.busy:not(.show){opacity:.75}.bar:hover .ctrl.busy{opacity:1}' +
		'.ctrl button{display:inline-flex;align-items:center;justify-content:center;gap:4px;min-width:32px;height:30px;padding:0 9px;border:0;border-radius:999px;' +
		'background:transparent;color:#fff;font:inherit;font-size:15px;cursor:pointer}.ctrl button small{font-size:12.5px}' +
		'.ctrl button:hover{background:rgba(255,255,255,.16)}.ctrl button.on{background:#fff;color:#0F0F10}' +
		'.ctrl button:focus-visible{outline:2px solid #56B4E9;outline-offset:1px}' +
		'.ctrl .sep{width:1px;height:18px;background:rgba(255,255,255,.25);margin:0 3px}' +
		'.ctrl [data-c=mic]{display:none}.ctrl.sh [data-c=mic]{display:inline-flex}' +
		'.ctrl .turn{display:none;align-items:center;gap:6px;padding:0 8px 0 4px;color:#FDE68A;cursor:pointer}.ctrl .turn.on{display:inline-flex}' +
		'.ctrl .turn svg{width:26px;height:26px;transform:rotate(-90deg)}.ctrl .turn circle{fill:none;stroke-width:3}' +
		'.ctrl .turn .bg{stroke:rgba(255,255,255,.2)}.ctrl .turn .fg{stroke:#FDE68A;stroke-dasharray:69.1;stroke-dashoffset:0}' +
		'.ctrl .turn.rec .fg{stroke:#F87171}.ctrl .turn.rec{color:#FCA5A5}' +
		// The sentence's progress: a hairline on top of the caption, so a sentence over several caption pieces reads as one.
		'.line.en{position:relative}.line.en::before{content:"";position:absolute;left:12px;top:2px;height:2px;border-radius:2px;' +
		'width:calc((100% - 24px) * var(--sp,0));background:rgba(255,255,255,.55);transition:width .12s linear;pointer-events:none}' +
		':host(.nosp) .line.en::before{display:none}' +
		':host(.mob) .ctrl{font-size:12px}:host(.mob) .ctrl button{min-width:38px;height:36px;padding:0 8px}:host(.mob) .ctrl button small{display:none}' +
		':host(.mob) .bar{touch-action:pan-y}';

	var RING = '<svg viewBox="0 0 26 26" aria-hidden="true"><circle class="bg" cx="13" cy="13" r="11"/><circle class="fg" cx="13" cy="13" r="11"/></svg>';

	function attach(r, h, api, mobile) {
		root = r; host = h; A = api;
		if (root.querySelector('.ctrl')) return;
		var box = root.querySelector('.box');
		if (!box) return;
		root.appendChild(Object.assign(document.createElement('style'), { textContent: CSS }));
		el = document.createElement('div');
		el.className = 'ctrl';
		el.setAttribute('role', 'toolbar');
		el.setAttribute('aria-label', 'Sentence controls');
		el.innerHTML =
			'<button data-c="prev" title="Previous sentence (A)" aria-label="Previous sentence">‹</button>' +
			'<button data-c="repeat" title="Repeat this sentence (S)" aria-label="Repeat this sentence">⟲</button>' +
			'<button data-c="next" title="Next sentence (D)" aria-label="Next sentence">›</button><i class="sep"></i>' +
			'<button data-c="loop" title="Loop this sentence, with a pause to say it (R)" aria-pressed="false">🔁<small>Loop</small></button>' +
			'<button data-c="slow" title="Slower: 0.75× (X)" aria-pressed="false">0.75×</button><i class="sep"></i>' +
			'<button data-c="shadow" title="Shadow mode: after each sentence the video waits for you to say it, then goes on (W)" aria-pressed="false">🗣<small>Shadow</small></button>' +
			'<button data-c="mic" title="Record yourself and hear it after the speaker. Your voice stays on this device." aria-pressed="false">🎤</button>' +
			'<span class="turn" role="button" title="Your turn: say the sentence. Tap to go on.">' + RING + '<b>Your turn</b></span>';
		box.insertBefore(el, box.firstChild);
		el.addEventListener('click', function (e) {
			e.stopPropagation();
			var b = e.target.closest('[data-c], .turn');
			if (!b) return;
			if (b.classList.contains('turn')) return endTurn(true);
			act(b.dataset.c);
			if (mobile) showFor(4000);
		});
		if (mobile) {
			var bar = root.querySelector('.bar');
			gestures(bar);
			// Taps on the caption are ours: YouTube's player would show its controls over the caption (so a double-tap
			// would hit them) or seek ±10 s. Our own listeners inside the shadow root have already run by now.
			['touchstart', 'touchend', 'pointerdown', 'pointerup', 'click', 'dblclick'].forEach(function (t) {
				host.addEventListener(t, function (e) { if (e.composedPath().indexOf(bar) >= 0) e.stopPropagation(); });
			});
		}
	}

	function act(c) {
		var j = A.current();
		if (c === 'prev' || c === 'next' || c === 'repeat') { cancelTurn(); A.go(c); }
		else if (c === 'loop') { cancelTurn(); A.loop(j); }
		else if (c === 'slow') setSlow(!st.slow);
		else if (c === 'shadow') setShadow(!st.shadow);
		else if (c === 'mic') setMic(!st.mic);
		paint();
	}

	/* ------------------------------------------------------------ modes */
	function setSlow(on) {
		st.slow = on;
		var v = A.video();
		if (v) v.playbackRate = on ? 0.75 : 1;
		A.say(on ? 'Slower: 0.75×' : 'Normal speed');
	}
	function setShadow(on) {
		st.shadow = on;
		if (!on) { cancelTurn(); setMic(false, true); }
		A.say(on ? 'Shadow mode: after each sentence, say it yourself' : 'Shadow mode off');
		if (on) A.shadowStart();
	}
	function setMic(on, quiet) {
		if (!on) {
			st.mic = false;
			if (st.stream) st.stream.getTracks().forEach(function (t) { t.stop(); });
			st.stream = null;
			return paint();
		}
		if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia || !window.MediaRecorder) return A.say('This browser can’t record here');
		navigator.mediaDevices.getUserMedia({ audio: true }).then(function (s) {
			st.stream = s; st.mic = true; paint();
			if (!quiet) A.say('🎤 On: you’ll hear yourself after the speaker. Your voice stays on this device.');
		}, function () { st.mic = false; paint(); A.say('No microphone: allow it for youtube.com to record'); });
	}

	/* ------------------------------------------------------------ shadow: your turn */
	/** Called by yt.js when a sentence ended in Shadow mode (the video is paused). */
	function yourTurn(j) {
		var s = A.sents()[j];
		if (!st.shadow || !s || !el) return false;
		cancelTurn();
		var ms = Math.max(1800, Math.min(9000, (s.end - s.start) * 1.2 + 800));
		var turn = el.querySelector('.turn'), fg = turn.querySelector('.fg');
		turn.classList.add('on');
		turn.classList.toggle('rec', !!(st.mic && st.stream));
		turn.querySelector('b').textContent = st.mic && st.stream ? 'Say it 🎤' : 'Your turn';
		fg.style.transition = 'none';
		fg.style.strokeDashoffset = '0';
		void fg.getBoundingClientRect();
		fg.style.transition = 'stroke-dashoffset ' + ms + 'ms linear';
		fg.style.strokeDashoffset = '69.1';
		st.turnJ = j;
		st.chunks = [];
		if (st.mic && st.stream) {
			try {
				st.rec = new MediaRecorder(st.stream);
				st.rec.ondataavailable = function (e) { if (e.data && e.data.size) st.chunks.push(e.data); };
				st.rec.start();
			} catch (e) { st.rec = null; }
		}
		st.turnT = setTimeout(function () { endTurn(false); }, ms);
		paint();
		return true;
	}
	/** The ring ran out (or was tapped): play the recording if any, then the next sentence. */
	function endTurn() {
		if (st.turnJ == null) return;
		var j = st.turnJ;
		clearTimeout(st.turnT);
		hideRing();
		st.turnJ = null;
		var next = function () { if (st.shadow) A.playSentence(j + 1); };
		if (st.rec && st.rec.state === 'recording') {
			var rec = st.rec;
			rec.onstop = function () {
				st.rec = null;
				if (!st.chunks.length) return next();
				var url = URL.createObjectURL(new Blob(st.chunks, { type: rec.mimeType || 'audio/webm' }));
				if (st.audio) st.audio.pause();
				st.audio = new Audio(url);
				A.say('▶ You');
				var done = function () { URL.revokeObjectURL(url); st.audio = null; next(); };
				st.audio.onended = done;
				st.audio.onerror = done;
				var p = st.audio.play();
				if (p && p.catch) p.catch(done);
			};
			rec.stop();
		} else next();
	}
	function hideRing() {
		var t = el && el.querySelector('.turn');
		if (t) t.classList.remove('on', 'rec');
	}
	function cancelTurn() {
		clearTimeout(st.turnT);
		st.turnJ = null;
		if (st.rec && st.rec.state === 'recording') { st.rec.onstop = null; try { st.rec.stop(); } catch (e) { /* gone */ } }
		st.rec = null;
		if (st.audio) { st.audio.pause(); st.audio = null; }
		hideRing();
	}

	/* ------------------------------------------------------------ phone gestures on the caption */
	function gestures(bar) {
		if (!bar) return;
		var x0 = 0, y0 = 0, t0 = 0, lastTap = 0, swiped = false;
		bar.addEventListener('touchstart', function (e) {
			var t = e.touches[0];
			x0 = t.clientX; y0 = t.clientY; t0 = Date.now(); swiped = false;
			showFor(4000);
		}, { passive: true });
		bar.addEventListener('touchend', function (e) {
			if (e.target.closest && e.target.closest('.ctrl')) return;
			var t = e.changedTouches[0], dx = t.clientX - x0, dy = t.clientY - y0, dt = Date.now() - t0;
			if (Math.abs(dx) >= 50 && Math.abs(dy) < 40 && dt < 700) {
				// Swipe left = the next sentence (like turning a page), right = the previous one.
				swiped = true;
				cancelTurn();
				A.hideCard();
				A.go(dx < 0 ? 'next' : 'prev');
				A.say(dx < 0 ? 'Next sentence ›' : '‹ Previous sentence');
				e.preventDefault();
				lastTap = 0;
				return;
			}
			if (Math.abs(dx) < 12 && Math.abs(dy) < 12 && dt < 300) {
				var now = Date.now();
				if (now - lastTap < 400) {
					cancelTurn();
					A.hideCard();
					A.go('repeat');
					A.say('⟲ Again');
					e.preventDefault();
					lastTap = 0;
					return;
				}
				lastTap = now;
			}
		}, { passive: false });
		// A swipe shouldn't also open the word under the finger.
		bar.addEventListener('click', function (e) { if (swiped) { e.stopPropagation(); e.preventDefault(); swiped = false; } }, true);
	}
	function showFor(ms) {
		if (!el) return;
		el.classList.add('show');
		clearTimeout(st.showT);
		st.showT = setTimeout(function () { el.classList.remove('show'); }, ms);
	}

	/* ------------------------------------------------------------ every tick (yt.js) */
	function tick(ms, j) {
		var v = A.video();
		if (v && v !== st.lastVideo) {
			st.lastVideo = v;
			if (st.slow) v.playbackRate = 0.75; // the phone site swaps in a new <video>
		}
		if (st.turnJ != null && v && !v.paused) cancelTurn(); // the student pressed play: their call
		if (st.slow && v && v.playbackRate !== 0.75 && v.playbackRate !== 1) st.slow = false; // changed in YouTube's own menu
		var s = A.sents()[j];
		if (host) {
			var p = s && s.end > s.start ? Math.max(0, Math.min(1, (ms - s.start) / (s.end - s.start))) : 0;
			host.style.setProperty('--sp', p.toFixed(3));
			host.classList.toggle('nosp', !s || !s.parts || s.parts.length < 2); // only when a sentence spans several caption pieces
		}
		paint();
	}
	function paint() {
		if (!el) return;
		var on = { loop: A.looping() >= 0, slow: st.slow, shadow: st.shadow, mic: st.mic };
		Object.keys(on).forEach(function (k) {
			var b = el.querySelector('[data-c=' + k + ']');
			if (b && b.classList.contains('on') !== on[k]) { b.classList.toggle('on', on[k]); b.setAttribute('aria-pressed', String(on[k])); }
		});
		el.classList.toggle('sh', st.shadow);
		el.classList.toggle('busy', on.loop || st.slow || st.shadow);
	}

	/** R loop · X slower · W shadow. Returns true when the key was ours. */
	function key(k) {
		if (k === 'r') act('loop');
		else if (k === 'x') act('slow');
		else if (k === 'w') act('shadow');
		else return false;
		return true;
	}

	/** A new video: modes stay (the student chose them), the turn and recording don't. */
	function reset() { cancelTurn(); }

	window.LensControls = {
		attach: attach, tick: tick, key: key, reset: reset, yourTurn: yourTurn,
		shadowOn: function () { return st.shadow; },
		inTurn: function () { return st.turnJ != null; }
	};
})();
