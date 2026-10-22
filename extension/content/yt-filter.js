/* Language Lens: "Hide Arabic videos on YouTube" (off by default; popup switch).
   Hides videos whose titles are mostly in Arabic script from YouTube's home feed, the "Up next" list and Shorts
   shelves, so the feed fills with English. Search results are left alone (a search in Arabic is on purpose).
   Works on www.youtube.com and the phone site m.youtube.com. A small pill says how many were hidden and can show them. */
(function () {
	'use strict';
	if (window.__sawaYtFilter) return;
	window.__sawaYtFilter = true;

	var ON = false, peek = false, hidden = 0, pill = null, timer = null;
	var MOBILE = location.hostname === 'm.youtube.com';
	// Video tiles on the home feed, "Up next" and Shorts shelves (computer and phone layouts, old and new).
	var TILES = 'ytd-rich-item-renderer, ytd-compact-video-renderer, ytd-reel-item-renderer, ytd-grid-video-renderer, yt-lockup-view-model, ytm-shorts-lockup-view-model, ytm-rich-item-renderer, ytm-video-with-context-renderer, ytm-compact-video-renderer, ytm-reel-item-renderer';
	var TITLE = '#video-title, #video-title-link, .yt-lockup-metadata-view-model__title, .yt-core-attributed-string, h3, .media-item-headline, .compact-media-item-headline, [aria-label]';
	var AR = /[؀-ۿݐ-ݿࢠ-ࣿﭐ-﷿ﹰ-﻿]/g, LATIN = /[A-Za-z]/g;

	/** Home, the watch page's "Up next" and the Shorts page; not search, channels or playlists. */
	function filterHere() {
		var p = location.pathname;
		return p === '/' || p === '/feed/subscriptions' || p === '/watch' || /^\/shorts\//.test(p);
	}

	/** A title is Arabic when most of its letters are Arabic (emoji, numbers and #tags don't count). */
	function isArabic(t) {
		t = String(t || '').replace(/#\S+/g, '');
		var ar = (t.match(AR) || []).length, la = (t.match(LATIN) || []).length;
		return ar >= 4 && ar > la * 1.5;
	}

	function titleOf(el) {
		var n = el.querySelector(TITLE);
		var t = n ? (n.getAttribute('title') || n.textContent || n.getAttribute('aria-label') || '') : '';
		return t.trim() || el.getAttribute('aria-label') || '';
	}

	function scan() {
		timer = null;
		var here = ON && filterHere();
		hidden = 0;
		document.querySelectorAll(TILES).forEach(function (el) {
			if (el.parentElement && el.parentElement.closest(TILES)) return; // the outer tile decides
			var ar = here && isArabic(titleOf(el));
			if (ar) hidden++;
			el.classList.toggle('sawa-lens-ar-hide', ar && !peek);
			el.classList.toggle('sawa-lens-ar-peek', ar && peek);
		});
		// A shelf (e.g. Shorts) whose tiles are all hidden is hidden too.
		document.querySelectorAll('ytd-rich-section-renderer, ytd-reel-shelf-renderer, ytm-reel-shelf-renderer, ytm-rich-section-renderer').forEach(function (sh) {
			var tiles = sh.querySelectorAll(TILES), gone = sh.querySelectorAll('.sawa-lens-ar-hide');
			sh.classList.toggle('sawa-lens-ar-hide', here && !peek && tiles.length > 0 && gone.length === tiles.length);
		});
		if (/^\/shorts\//.test(location.pathname)) hidden = Math.max(hidden, skipped);
		paintPill(here);
	}
	function soon() { if (!timer) timer = setTimeout(scan, 400); }

	/* The Shorts player shows one Short at a time, so an Arabic one can't just be hidden: skip to the next. */
	var skipped = 0, lastShort = '', skipT = null;
	function activeShortTitle() {
		var r = document.querySelector('ytd-reel-video-renderer[is-active]') || document.querySelector('ytm-reel-player-renderer, ytm-shorts-player-renderer');
		if (!r) return '';
		var t = r.querySelector('h2, .title, yt-shorts-video-title-view-model, .reel-player-header-renderer-title, [class*="title"]');
		return t ? t.textContent.trim() : '';
	}
	function nextShort() {
		var b = document.querySelector('#navigation-button-down button, button[aria-label="Next video"]');
		if (b) return b.click();
		// No button (phone): scroll the feed by one screen, like a swipe up.
		var feed = document.querySelector('#shorts-container, ytm-reel-shelf-renderer, .reel-player-overlay-main-content') ;
		(feed && feed.scrollHeight > feed.clientHeight ? feed : document.scrollingElement).scrollBy({ top: innerHeight, behavior: 'smooth' });
		document.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', code: 'ArrowDown', keyCode: 40, bubbles: true }));
	}
	function checkShort() {
		if (!ON || peek || !/^\/shorts\//.test(location.pathname)) return;
		var id = location.pathname, t = activeShortTitle();
		if (!t || id === lastShort) return;
		lastShort = id;
		if (isArabic(t)) { skipped++; hidden = skipped; nextShort(); paintPill(true); }
	}
	setInterval(function () { clearTimeout(skipT); skipT = setTimeout(checkShort, 250); }, 800);

	function paintPill(here) {
		if (!here || !hidden) { if (pill) pill.hidden = true; return; }
		if (!pill) {
			pill = document.createElement('div');
			pill.className = 'sawa-lens-ar-pill';
			pill.addEventListener('click', function (e) {
				var a = e.target.closest('[data-a]'); if (!a) return;
				if (a.dataset.a === 'peek') { peek = !peek; scan(); }
				if (a.dataset.a === 'off') chrome.storage.local.set({ hideArabicYT: false });
			});
			document.documentElement.appendChild(pill);
		}
		pill.hidden = false;
		var sh = /^\/shorts\//.test(location.pathname);
		pill.innerHTML = '<span>🙈 ' + hidden + ' Arabic ' + (sh ? 'Short' : 'video') + (hidden === 1 ? '' : 's') + (peek ? ' shown' : sh ? ' skipped' : ' hidden') + '</span>'
			+ '<button data-a="peek">' + (peek ? 'Hide them' : 'Show') + '</button><button data-a="off" title="Turn off (Language Lens settings)">✕</button>';
	}

	var css = document.createElement('style');
	css.textContent = '.sawa-lens-ar-hide{display:none!important}'
		+ '.sawa-lens-ar-peek{opacity:.45;outline:2px dashed #F59E0B;outline-offset:-2px;border-radius:12px}'
		+ '.sawa-lens-ar-pill{position:fixed;z-index:2147483000;' + (MOBILE ? 'bottom:64px;left:50%;transform:translateX(-50%)' : 'bottom:18px;left:18px') + ';display:flex;align-items:center;gap:8px;background:#0F0F10;color:#fff;font:600 13px/1.2 Roboto,Arial,sans-serif;padding:6px 6px 6px 12px;border-radius:99px;box-shadow:0 6px 18px rgba(0,0,0,.25)}'
		+ '.sawa-lens-ar-pill[hidden]{display:none}.sawa-lens-ar-pill button{border:0;border-radius:99px;padding:6px 10px;min-height:32px;font:600 12px/1 Roboto,Arial,sans-serif;cursor:pointer;background:#FDE68A;color:#0F0F10}.sawa-lens-ar-pill button[data-a=off]{background:#2a2a2a;color:#fff}';
	(document.head || document.documentElement).appendChild(css);

	chrome.storage.local.get('hideArabicYT', function (o) { ON = o.hideArabicYT === true; scan(); });
	chrome.storage.onChanged.addListener(function (ch) { if (ch.hideArabicYT) { ON = ch.hideArabicYT.newValue === true; peek = false; scan(); } });
	// YouTube loads more tiles as you scroll and swaps pages without reloading.
	new MutationObserver(soon).observe(document.documentElement, { childList: true, subtree: true });
	window.addEventListener('yt-navigate-finish', function () { peek = false; soon(); });
	window.addEventListener('popstate', soon);
})();
