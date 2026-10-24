/* Language Lens: ACTIVE study time (0.12.0). Counts seconds only while the tab is visible AND the student is really using it:
   YouTube: the video is playing, or they touched the page in the last 60 s (hover, tap, transcript, controls, quiz).
   Other websites (opt-in: popup → "Count my reading time"): visible tab and a scroll / tap / key in the last 30 s.
   Minutes and counts only: never a URL or a page title. Sent to background.js in small batches (every ~20 s, not per second);
   background.js sends the day's totals to the server about every 10 minutes. */
(function () {
	'use strict';
	var YT = /(^|\.)youtube\.com$/.test(location.hostname);
	var SRC = YT ? 'youtube' : 'reading';
	var on = YT, last = Date.now(), lastTick = Date.now(), acc = 0, sent = Date.now();
	var add = { words: 0, quiz: 0 };

	function load() {
		if (YT) return;
		chrome.storage.local.get('readTime', function (o) { on = o.readTime === true; });
	}
	try { chrome.storage.onChanged.addListener(function (ch) { if (ch.readTime) load(); }); } catch (e) { return; }
	load();

	['pointermove', 'pointerdown', 'keydown', 'wheel', 'scroll', 'touchstart', 'touchmove', 'click'].forEach(function (t) {
		document.addEventListener(t, function () { last = Date.now(); }, { capture: true, passive: true });
	});

	function playing() {
		if (!YT || !/^\/watch/.test(location.pathname)) return false;
		var v = document.querySelector('#movie_player video') || document.querySelector('video');
		return !!(v && !v.paused && !v.ended && v.readyState > 2);
	}

	function flush(final) {
		var sec = Math.round(acc / 1000);
		if (!sec && !add.words && !add.quiz) return;
		try {
			chrome.runtime.sendMessage({ type: 'studyAdd', src: SRC, sec: sec, words: add.words, quiz: add.quiz, flush: !!final });
		} catch (e) { /* the extension was reloaded: this page stops counting */ }
		acc = 0; add.words = 0; add.quiz = 0; sent = Date.now();
	}

	setInterval(function () {
		var now = Date.now(), dt = Math.min(2500, now - lastTick);
		lastTick = now;
		if (!on || document.hidden) return; // a hidden tab counts nothing
		var idle = YT ? 60000 : 30000;
		if ((YT && playing()) || now - last < idle) acc += dt;
		if (now - sent > 20000) flush(false);
	}, 1000);
	document.addEventListener('visibilitychange', function () { if (document.hidden) flush(true); });
	window.addEventListener('pagehide', function () { flush(true); });

	window.LensStudy = {
		word: function () { add.words++; last = Date.now(); },
		quiz: function () { add.quiz++; last = Date.now(); }
	};
})();
