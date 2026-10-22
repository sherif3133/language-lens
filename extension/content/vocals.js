/* Vocals only (test) — on a YouTube song, hear only the singer's voice: the instruments are removed by an
   AI model running on this computer. For students who avoid musical instruments.
   Computers only: hidden on phones and touch screens, and on computers too slow to keep up.
   How it works:
   - content/vocals-main.js (in YouTube's page) copies the audio bytes YouTube downloads ahead of playback;
   - vocals/vocals.html (Language Lens's own page, hidden in this tab) separates the voice, ahead of time;
   - here, the <video>'s own sound goes through Web Audio and is switched off, and the voice is played
     in step with the video. If the voice isn't ready yet, the video waits ("Preparing vocals… 3s").
   yt.js adds the "🎤 Vocals only" button to the Language Lens menu; the choice is kept in storage (vocalsOnly). */
(function () {
	'use strict';
	if (window.LensVocals) return;
	var DESKTOP = location.hostname === 'www.youtube.com' && !(window.matchMedia && matchMedia('(hover: none)').matches) &&
		!(navigator.userAgentData && navigator.userAgentData.mobile) && !/Android|iPhone|iPad|Mobile/i.test(navigator.userAgent);
	var CAN = DESKTOP && typeof AudioDecoder === 'function' && typeof OfflineAudioContext === 'function' && typeof AudioContext === 'function' && (navigator.hardwareConcurrency || 4) >= 4;
	var FONT = '"IBM Plex Sans","IBM Plex Sans Arabic","Segoe UI",system-ui,sans-serif';

	var V = {
		on: false, slow: false, state: 'off', text: '', eta: 0, backend: '', rtf: 0, firstSoundMs: 0,
		ctx: null, video: null, graph: null, frame: null, port: null, streamId: 0,
		wins: {}, anchor: null, waiting: false, pausedByUs: false, posAt: 0, menus: [], badge: null, onAt: 0, log: []
	};
	function log(s) { V.log.push(Math.round(performance.now()) + ' ' + s); if (V.log.length > 60) V.log.shift(); }

	/* ------------------------------------------------------------ the video's own sound, through Web Audio */
	function hook(v) {
		if (!v) return null;
		if (!V.ctx) V.ctx = new AudioContext({ latencyHint: 'playback' });
		if (!v.__sawaGraph) {
			var g = { dry: V.ctx.createGain(), voc: V.ctx.createGain(), src: null, muted: false };
			g.dry.connect(V.ctx.destination);
			g.voc.connect(V.ctx.destination);
			try {
				g.src = V.ctx.createMediaElementSource(v);
				g.src.connect(g.dry);
			} catch (e) {
				g.src = null; // already captured elsewhere: fall back to muting the element
			}
			v.__sawaGraph = g;
			v.addEventListener('volumechange', function () { level(v); });
			['pause', 'seeking', 'ratechange', 'emptied'].forEach(function (ev) { v.addEventListener(ev, function () { if (V.video === v) stopAll(); }); });
			['play', 'playing', 'seeked', 'timeupdate'].forEach(function (ev) { v.addEventListener(ev, function () { if (V.video === v) tick(); }); });
		}
		return v.__sawaGraph;
	}
	/** The voice follows YouTube's volume slider (the element's own sound already does). */
	function level(v) {
		var g = v && v.__sawaGraph;
		if (!g) return;
		g.voc.gain.value = v.muted ? 0 : v.volume;
		if (!g.src && V.on && !v.muted) { g.muted = true; v.muted = true; }
	}
	function useVideo() {
		var v = document.querySelector('#movie_player video');
		if (!v || v === V.video) return V.video;
		if (V.video) { stopAll(); setDry(V.video, 1); }
		V.video = v;
		V.graph = hook(v);
		if (V.on) setDry(v, 0);
		level(v);
		return v;
	}
	function setDry(v, x) {
		var g = v && v.__sawaGraph;
		if (!g) return;
		if (g.src) g.dry.gain.value = x;
		else if (x === 0 && !v.muted) { g.muted = true; v.muted = true; }
		else if (x === 1 && g.muted) { g.muted = false; v.muted = false; }
	}

	/* ------------------------------------------------------------ the engine page */
	function videoId() {
		var m = location.search.match(/[?&]v=([\w-]{11})/);
		return m ? m[1] : '';
	}
	function engine(onReady) {
		if (V.frame && V.frame.isConnected) return;
		var f = document.createElement('iframe');
		f.src = chrome.runtime.getURL('vocals/vocals.html');
		f.setAttribute('aria-hidden', 'true');
		f.tabIndex = -1;
		f.style.cssText = 'position:fixed;width:1px;height:1px;left:-10px;top:-10px;border:0;opacity:0;pointer-events:none';
		f.addEventListener('load', function () {
			var ch = new MessageChannel();
			V.port = ch.port1;
			V.port.onmessage = onEngine;
			f.contentWindow.postMessage({ sawaVocals: 'port' }, '*', [ch.port2]);
			V.vid = videoId();
			V.port.postMessage({ t: 'video', id: V.vid }); // a song prepared ahead plays from this computer at once
			if (onReady) onReady(); else V.port.postMessage({ t: 'start' });
			window.postMessage({ source: 'sawa-lens-vocals', type: 'arm' }, location.origin);
		});
		(document.body || document.documentElement).appendChild(f);
		V.frame = f;
	}
	function dropEngine() {
		window.postMessage({ source: 'sawa-lens-vocals', type: 'disarm' }, location.origin);
		if (V.port) V.port.close();
		if (V.frame) V.frame.remove();
		V.port = V.frame = null;
		V.streamId = 0;
		V.wins = {};
	}
	// YouTube's page → the engine: the audio bytes (only while armed).
	window.addEventListener('message', function (e) {
		if (e.source !== window || !e.data || e.data.source !== 'sawa-lens-vocals-main' || !V.port) return;
		var d = e.data;
		if (d.type === 'stream') {
			if (d.id !== V.streamId) { stopAll(); V.wins = {}; }
			V.streamId = d.id;
			V.port.postMessage({ t: 'stream', id: d.id, mime: d.mime });
			if (!/opus|webm/i.test(d.mime)) show('error', 'This video\'s sound format isn\'t supported yet.');
		} else if (d.type === 'bytes') V.port.postMessage({ t: 'bytes', id: d.id, bytes: d.bytes, off: d.off }, [d.bytes.buffer]);
		else if (d.type === 'abort') V.port.postMessage({ t: 'abort', id: d.id });
	});
	function onEngine(e) {
		var m = e.data;
		if (m.t === 'win') {
			var sr = m.sr || 44100, b = V.ctx.createBuffer(2, m.L.length, sr);
			b.copyToChannel(m.L, 0); b.copyToChannel(m.R, 1);
			V.wins[m.k] = { k: m.k, start: m.start, dur: m.L.length / sr, buf: b, node: null };
			V.backend = m.backend; V.rtf = m.rtf;
			log('win ' + m.k + ' @' + m.start.toFixed(2) + ' ' + m.ms + 'ms rtf ' + m.rtf.toFixed(3) + ' ' + m.backend);
			tick();
		} else if (m.t === 'cover' || m.t === 'saved') {
			if (V.capture) V.capture(m);
		} else if (m.t === 'eta') {
			V.eta = m.sec;
			if (V.waiting) show('preparing');
		} else if (m.t === 'status') {
			log('status ' + m.state + (m.msg ? ' ' + m.msg : ''));
			if (m.backend) V.backend = m.backend;
			if (m.state === 'download') show('loading', 'Downloading the voice model… ' + Math.round(m.progress * 100) + '% (' + m.mb + ' MB, once)');
			else if (m.state === 'starting') show('loading', 'Starting the voice model…');
			else if (m.state === 'slow') {
				V.slow = true;
				try { chrome.storage.local.set({ vocalsSlow: true }); } catch (err) { /* ignore */ }
				set(false);
				show('error', 'This computer is too slow for Vocals only. Sorry!');
			} else if (m.state === 'error') show('error', m.msg || 'Something went wrong.');
			else if (m.state === 'waiting' && V.waiting) show('preparing', 'Waiting for YouTube to load the song…');
		}
	}

	/* ------------------------------------------------------------ playing the voice in step with the video */
	function stopAll() {
		Object.keys(V.wins).forEach(function (k) {
			var w = V.wins[k];
			if (w.node) { try { w.node.stop(); } catch (e) { /* not started */ } w.node.disconnect(); w.node = null; }
		});
		V.anchor = null;
	}
	function at(t) {
		// the window that plays at t (neighbours overlap by a crossfade: take the later one)
		var best = null;
		for (var k in V.wins) { var w = V.wins[k]; if (w.start <= t + 0.01 && w.start + w.dur > t + 0.05 && (!best || w.start > best.start)) best = w; }
		return best;
	}
	function adShowing() { return !!document.querySelector('#movie_player.ad-showing'); }
	function tick() {
		if (!V.on || CAPTURE) return;
		var v = useVideo();
		if (!v || !V.ctx) return;
		var t = v.currentTime, now = performance.now();
		if (V.port && V.vid !== videoId()) {
			V.vid = videoId();
			stopAll(); V.wins = {};
			V.port.postMessage({ t: 'video', id: V.vid });
		}
		if (V.port && (now - V.posAt > 250)) {
			V.posAt = now;
			V.port.postMessage({ t: 'pos', time: t, playing: !v.paused, dur: isFinite(v.duration) ? v.duration : 0 });
		}
		// Forget windows far away (the engine makes them again if needed).
		Object.keys(V.wins).forEach(function (k) {
			var w = V.wins[k];
			if (w.start + w.dur < t - 15 || w.start > t + 90) { if (w.node) { try { w.node.stop(); } catch (e) { /* */ } } delete V.wins[k]; if (V.port) V.port.postMessage({ t: 'forget', k: +k }); }
		});
		if (adShowing()) { stopAll(); return show('ad'); }
		if (V.ctx.state !== 'running') {
			if (!v.paused) { V.pausedByUs = true; v.pause(); }
			return show('click');
		}
		var cur = at(t);
		if (V.waiting) {
			if (cur && (at(cur.start + cur.dur - 0.2) || cur.start + cur.dur >= v.duration - 0.5 || cur.start + cur.dur - t > 4)) {
				V.waiting = false;
				if (!V.firstSoundMs && V.onAt) V.firstSoundMs = Math.round(performance.now() - V.onAt);
				if (V.pausedByUs) { V.pausedByUs = false; v.play().catch(function () { /* the student can press play */ }); }
				show('playing');
			} else {
				if (!v.paused) { V.pausedByUs = true; v.pause(); } // pressing play early would only give silence
				return show('preparing');
			}
		}
		if (v.paused || v.seeking) { stopAll(); return show(V.state === 'preparing' ? 'preparing' : 'playing'); }
		if (!cur) {
			stopAll();
			V.waiting = true;
			V.pausedByUs = true;
			v.pause();
			return show('preparing');
		}
		show('playing');
		var rate = v.playbackRate || 1, lat = (V.ctx.outputLatency || 0) + (V.ctx.baseLatency || 0);
		// Has the voice drifted from the picture? Start again from here.
		if (V.anchor && (V.anchor.rate !== rate || Math.abs(V.anchor.media + (V.ctx.currentTime - V.anchor.ctx) * rate - t) > 0.08)) stopAll();
		if (!V.anchor) V.anchor = { ctx: V.ctx.currentTime + 0.04, media: t + 0.04 * rate, rate: rate };
		var A = V.anchor;
		Object.keys(V.wins).forEach(function (k) {
			var w = V.wins[k];
			if (w.node || w.start > t + 3 || w.start + w.dur < t) return;
			var when = A.ctx + (w.start - A.media) / rate - lat, off = 0, earliest = V.ctx.currentTime + 0.01;
			if (when < earliest) { off = (earliest - when) * rate; when = earliest; }
			if (off >= w.dur) return;
			var s = V.ctx.createBufferSource();
			s.buffer = w.buf;
			s.playbackRate.value = rate;
			s.connect(V.graph.voc);
			s.start(when, off);
			s.onended = function () { if (w.node === s) w.node = null; };
			w.node = s;
		});
	}
	setInterval(tick, 200);

	/* ------------------------------------------------------------ switching on and off */
	function set(on) {
		on = !!on && CAN && !V.slow;
		if (on === V.on) return paint();
		V.on = on;
		if (on) {
			var v = useVideo();
			if (V.ctx && V.ctx.state !== 'running') V.ctx.resume();
			if (v) setDry(v, 0); // from now on the original sound is never heard
			V.onAt = performance.now(); V.firstSoundMs = 0;
			V.waiting = true; V.eta = 0;
			if (v && !v.paused) { V.pausedByUs = true; v.pause(); }
			engine();
			show('loading', 'Preparing vocals…');
			tick();
		} else {
			stopAll();
			dropEngine();
			if (V.video) setDry(V.video, 1);
			var resume = V.pausedByUs && V.video && V.video.paused;
			V.waiting = false; V.pausedByUs = false;
			if (resume) V.video.play().catch(function () { /* */ });
			show('off');
		}
	}
	function toggle() {
		var on = !V.on;
		set(on);
		try { chrome.storage.local.set({ vocalsOnly: V.on }); } catch (e) { /* ignore */ }
	}
	// Any click or key on the page lets the sound start (browsers need one before playing audio).
	['pointerdown', 'keydown'].forEach(function (ev) {
		document.addEventListener(ev, function () { if (V.on && V.ctx && V.ctx.state !== 'running') V.ctx.resume().then(tick); }, true);
	});

	/* ------------------------------------------------------------ what the student sees */
	function show(state, text) {
		V.state = state;
		V.text = text || {
			off: '', ad: 'Ad: sound off (Vocals only)', click: 'Click anywhere on the page to start Vocals only',
			preparing: 'Preparing vocals… ' + (V.eta ? Math.ceil(V.eta) + 's' : ''), playing: '', loading: 'Preparing vocals…'
		}[state] || '';
		paint();
	}
	function paint() {
		V.menus = V.menus.filter(function (r) { return r.isConnected || (r.host && r.host.isConnected); });
		V.menus.forEach(function (root) {
			var b = root.querySelector('[data-a=vocals]');
			if (!b) return;
			b.classList.toggle('on', V.on);
			b.querySelector('.vst').textContent = V.on ? (V.state === 'playing' ? 'On' : '…') : '';
		});
		var player = document.querySelector('#movie_player');
		if (!player) return;
		if (!V.badge || !V.badge.isConnected) {
			if (!V.on && !V.text) return;
			V.badge = document.createElement('div');
			V.badge.className = 'sawa-lens-vocals';
			V.badge.setAttribute('role', 'status');
			V.badge.style.cssText = 'position:absolute;top:12px;left:12px;z-index:61;background:rgba(15,15,16,.86);color:#fff;border-radius:999px;padding:6px 12px;font:600 13px/1.2 ' + FONT + ';pointer-events:none;display:none';
			player.appendChild(V.badge);
		}
		var msg = V.on || CAPTURE || V.state === 'error' ? '🎤 Vocals only' + (V.text ? ' · ' + V.text : '') : '';
		V.badge.textContent = msg;
		V.badge.style.display = msg ? '' : 'none';
		if (V.state === 'error') { clearTimeout(V.errT); V.errT = setTimeout(function () { if (V.state === 'error') show('off'); }, 8000); }
	}

	try {
		chrome.storage.local.get(['vocalsOnly', 'vocalsSlow'], function (o) {
			V.slow = !!o.vocalsSlow;
			if (o.vocalsOnly && CAN && !V.slow && !CAPTURE) setTimeout(function () { set(true); }, 1500);
		});
		chrome.storage.onChanged.addListener(function (ch) {
			if (ch.vocalsOnly && !!ch.vocalsOnly.newValue !== V.on) set(ch.vocalsOnly.newValue);
		});
	} catch (e) { /* ignore */ }

	/* ------------------------------------------------------------ preparing songs ahead (vocals/prepare.html) */
	/** Add songs [{id, title}] to the list to prepare, and open the Voice-only playlist page. */
	function prepare(songs) {
		chrome.storage.local.get('vocalsQueue', function (o) {
			var q = o.vocalsQueue || [], have = {};
			q.forEach(function (x) { have[x.id] = 1; });
			songs.forEach(function (x) { if (x.id && !have[x.id]) { have[x.id] = 1; q.push({ id: x.id, title: x.title || '', addedAt: Date.now() }); } });
			chrome.storage.local.set({ vocalsQueue: q }, function () { window.open(chrome.runtime.getURL('vocals/prepare.html'), '_blank'); });
		});
	}
	/** The songs of the playlist open next to the video. */
	function playlist() {
		var out = [], seen = {};
		document.querySelectorAll('ytd-playlist-panel-renderer #items ytd-playlist-panel-video-renderer').forEach(function (r) {
			var a = r.querySelector('a[href*="v="]'), m = a && a.getAttribute('href').match(/[?&]v=([\w-]{11})/), t = r.querySelector('#video-title');
			if (m && !seen[m[1]]) { seen[m[1]] = 1; out.push({ id: m[1], title: t ? t.textContent.trim() : '' }); }
		});
		return out;
	}
	/** Capture mode: this muted background tab was opened by the Voice-only playlist page to collect one song's sound.
	    The video plays at double speed until YouTube has sent the whole song, then the sound is kept for that page.
	    Ads play as they are (the tab is muted). */
	var CAPTURE = CAN && (/[?&]sawa_prepare=1/.test(location.search) || sessionStorage.getItem('sawaPrepare') === '1');
	if (CAPTURE) {
		sessionStorage.setItem('sawaPrepare', '1');
		var cap = { saving: false, done: false, started: 0 };
		V.capture = function (m) {
			if (m.t === 'cover' && m.complete && !cap.saving) { cap.saving = true; V.port.postMessage({ t: 'save' }); show('playing', 'Saving the song…'); }
			if (m.t === 'saved') {
				cap.done = !!m.ok;
				var vv = document.querySelector('#movie_player video');
				if (vv && cap.muted) { vv.pause(); vv.muted = cap.wasMuted; } // YouTube remembers mute: leave it as the student had it
				show(m.ok ? 'playing' : 'error', m.ok ? '🎧 Song ready for the Voice-only playlist ✓' : 'Could not keep this song: ' + (m.msg || ''));
			}
		};
		var capTick = setInterval(function () {
			var v = document.querySelector('#movie_player video');
			if (!v || !(v.duration > 0)) return;
			if (!V.frame) {
				engine(function () { V.port.postMessage({ t: 'capture', id: videoId(), title: document.title.replace(/ - YouTube$/, '') }); });
				show('playing', '🎧 Getting this song for the Voice-only playlist. This window closes by itself.');
			}
			if (cap.done) { clearInterval(capTick); v.pause(); return; }
			if (adShowing()) return;
			if (!cap.started) { cap.started = Date.now(); if (v.currentTime > 1) v.currentTime = 0; }
			// browsers only start videos by themselves when muted (the window is muted too)
			if (!cap.muted) { cap.muted = true; cap.wasMuted = v.muted; }
			if (!cap.done) v.muted = true;
			if (v.paused) v.play().catch(function () { /* */ });
			if (v.playbackRate !== 2) v.playbackRate = 2;
			if (V.port) {
				V.port.postMessage({ t: 'pos', time: v.currentTime, playing: !v.paused, dur: v.duration });
				V.port.postMessage({ t: 'cover?' });
			}
			// played to the end but a piece is missing: go back to the start of the gap
			if (v.ended && !cap.saving) v.currentTime = 0;
		}, 1000);
	}

	window.LensVocals = {
		/** Prepare songs ahead (better voice, kept on this computer): this song, or the whole playlist. */
		prepare: prepare,
		playlist: playlist,
		capturing: function () { return CAPTURE; },
		/** Show the button? Computers only, and not on computers that were too slow before. */
		supported: function () { return CAN && !V.slow; },
		toggle: toggle,
		set: set,
		/** yt.js passes the shadow root of its menu, so the button shows On / … */
		bindMenu: function (root) { if (V.menus.indexOf(root) < 0) V.menus.push(root); paint(); },
		/** For tests: what's happening. */
		debug: function () {
			return { on: V.on, state: V.state, text: V.text, backend: V.backend, rtf: V.rtf, firstSoundMs: V.firstSoundMs, ctx: V.ctx && V.ctx.state, wins: Object.keys(V.wins).map(function (k) { var w = V.wins[k]; return { k: +k, start: w.start, dur: w.dur, playing: !!w.node }; }), waiting: V.waiting, log: V.log.slice(-20), dry: V.graph && V.graph.dry.gain.value, hasSrc: !!(V.graph && V.graph.src) };
		}
	};
})();
