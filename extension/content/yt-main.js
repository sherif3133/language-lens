/* Language Lens: runs in YouTube's own page context.
   YouTube only serves captions to requests carrying a short-lived token its player creates, so we
   listen to the player's own caption request, then ask for the best English track with that token. */
(function () {
	'use strict';
	if (window.__sawaLensMain) return;
	window.__sawaLensMain = true;

	var lastPot = '', lastVideo = '', sentFor = '';
	// Beta diagnostics: window.__sawaLensLog in the console shows what happened on this page.
	var logs = (window.__sawaLensLog = []);
	function dbg(s) {
		logs.push(Math.round(performance.now()) + ' ' + s);
		if (logs.length > 60) logs.shift();
	}

	function post(msg) {
		dbg('post ' + msg.type + ' ' + msg.videoId + (msg.none ? ' none' : '') + (msg.body ? ' len=' + msg.body.length + ' kind=' + msg.kind : ''));
		window.postMessage(Object.assign({ source: 'sawa-lens-main' }, msg), location.origin);
	}

	function tracks() {
		var p = document.querySelector('#movie_player');
		var pr = (p && p.getPlayerResponse && p.getPlayerResponse()) || window.ytInitialPlayerResponse;
		var t = pr && pr.captions && pr.captions.playerCaptionsTracklistRenderer && pr.captions.playerCaptionsTracklistRenderer.captionTracks;
		return { list: t || [], videoId: pr && pr.videoDetails && pr.videoDetails.videoId };
	}

	/** Manual English first, then any English variant, then auto-generated English. */
	function bestEnglish(list) {
		var en = list.filter(function (t) { return /^en(-|$)/.test(t.languageCode); });
		return en.filter(function (t) { return t.kind !== 'asr' && t.languageCode === 'en'; })[0] ||
			en.filter(function (t) { return t.kind !== 'asr'; })[0] ||
			en.filter(function (t) { return t.kind === 'asr'; })[0] || null;
	}

	function fetchBest(pot) {
		var t = tracks();
		if (!t.videoId || sentFor === t.videoId + pot) return;
		var best = bestEnglish(t.list);
		if (!best) {
			sentFor = t.videoId + pot;
			post({ type: 'captions', videoId: t.videoId, none: true });
			return;
		}
		var url = best.baseUrl.replace(/([?&])fmt=[^&]*/, '$1') + '&fmt=json3&c=WEB' + (pot ? '&pot=' + encodeURIComponent(pot) : '');
		sentFor = t.videoId + pot;
		origFetch.call(window, url, { credentials: 'include' })
			.then(function (r) { return r.text(); })
			.then(function (body) {
				dbg('refetch ' + t.videoId + ' len=' + (body || '').length);
				if (!body) {
					// The token expired or doesn't fit: let the player make a fresh request.
					sentFor = '';
					if (pot && pot === lastPot) {
						lastPot = '';
						prime();
					}
					return;
				}
				post({ type: 'captions', videoId: t.videoId, lang: best.languageCode, kind: best.kind || 'manual', body: body });
			})
			.catch(function () { sentFor = ''; });
	}

	function seen(url) {
		try {
			var u = new URL(url, location.href);
			if (/timedtext/.test(u.pathname)) dbg('seen v=' + u.searchParams.get('v') + ' pot=' + !!u.searchParams.get('pot') + ' lang=' + u.searchParams.get('lang') + ' kind=' + u.searchParams.get('kind'));
			if (!/\/api\/timedtext/.test(u.pathname)) return;
			var pot = u.searchParams.get('pot') || '';
			var v = u.searchParams.get('v') || '';
			// Previews of other videos on the page make their own requests: only the open video counts.
			if (!v || v !== tracks().videoId) return;
			if (pot) lastPot = pot;
			lastVideo = v;
			fetchBest(lastPot);
		} catch (e) {
			/* not a URL we care about */
		}
	}

	var origFetch = window.fetch;
	window.fetch = function (input) {
		try {
			seen(typeof input === 'string' ? input : input && input.url);
		} catch (e) {
			/* ignore */
		}
		return origFetch.apply(this, arguments);
	};
	var origOpen = XMLHttpRequest.prototype.open;
	XMLHttpRequest.prototype.open = function (m, url) {
		try {
			var s = String(url);
			if (s.indexOf('/api/timedtext') >= 0) {
				// Use the player's own answer when it is an English track (no second request needed).
				this.addEventListener('load', function () {
					try {
						var u = new URL(s, location.href), lang = u.searchParams.get('lang') || '', body = this.responseText;
						if (body && /^en(-|$)/.test(lang) && /json3/.test(u.searchParams.get('fmt') || '')) {
							var t = tracks(), v = u.searchParams.get('v') || '';
							if (v && v === t.videoId) post({ type: 'captions', videoId: v, lang: lang, kind: u.searchParams.get('kind') || 'manual', body: body });
						}
					} catch (e) {
						/* ignore */
					}
				});
			}
			seen(s);
		} catch (e) {
			/* ignore */
		}
		return origOpen.apply(this, arguments);
	};

	/** Turn the player's captions on once so it makes the request we listen for. */
	function prime() {
		dbg('prime ' + tracks().videoId + ' pot=' + !!lastPot);
		if (lastVideo && lastVideo !== tracks().videoId) {
			lastPot = '';
			lastVideo = '';
		}
		var p = document.querySelector('#movie_player');
		var t = tracks();
		if (!p || !t.videoId) return;
		if (!t.list.length) {
			post({ type: 'captions', videoId: t.videoId, none: true });
			return;
		}
		if (lastPot && lastVideo) {
			fetchBest(lastPot);
			return;
		}
		try {
			if (p.loadModule) p.loadModule('captions');
			var best = bestEnglish(t.list) || t.list[0];
			if (p.setOption) p.setOption('captions', 'track', { languageCode: best.languageCode, kind: best.kind });
			// Fallback: the CC button (its captions stay hidden while Lens shows its own).
			var cc = document.querySelector('.ytp-subtitles-button');
			if (cc && cc.getAttribute('aria-pressed') === 'false') cc.click();
		} catch (e) {
			/* older player: the learner can press CC */
		}
	}

	window.addEventListener('message', function (e) {
		if (e.source !== window || !e.data || e.data.source !== 'sawa-lens-ui') return;
		if (e.data.type === 'prime') {
			sentFor = '';
			prime();
		} else if (e.data.type === 'seek') {
			var p = document.querySelector('#movie_player');
			if (p && p.seekTo) p.seekTo(e.data.t, true);
		}
	});
})();
