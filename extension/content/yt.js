/* Language Lens on YouTube: our own caption line with hoverable words, the video's grade,
   the unknown words list, and one-click sentence saving. */
(function () {
	'use strict';
	if (window.__sawaLensYT) return;
	window.__sawaLensYT = true;
	var U = window.LensUI, Card = window.LensCard;

	var CSS = '' +
		':host{all:initial}*{box-sizing:border-box}' +
		'.bar{position:absolute;left:50%;transform:translateX(-50%);bottom:64px;z-index:60;max-width:min(92%,980px);width:max-content;pointer-events:auto;' +
		'font:600 clamp(16px,2.2vw,26px)/1.45 "IBM Plex Sans Arabic","Segoe UI",Tahoma,sans-serif;color:#fff;text-align:center;direction:ltr;transition:bottom .2s}' +
		':host(.ctrl) .bar{bottom:84px}' +
		'.line{background:rgba(15,15,16,.86);border-radius:10px;padding:6px 14px;display:inline-block}' +
		'.line:empty{display:none}' +
		'.wd{cursor:pointer;border-radius:4px;padding:0 1px}' +
		'.wd:hover{background:#fff;color:#0F0F10}' +
		'.wd.new{text-decoration:underline;text-decoration-color:#E3262B;text-decoration-thickness:2px;text-underline-offset:5px}' +
		'.wd.learning{background:rgba(255,255,255,.18);box-shadow:inset 0 -2px 0 #fff}' +
		'.wd.name{opacity:.9}' +
		'.tools{display:flex;justify-content:center;gap:6px;margin-top:6px;opacity:0;transition:opacity .15s;direction:rtl}' +
		'.bar:hover .tools{opacity:1}' +
		'.t{font:600 13px/1 "IBM Plex Sans Arabic","Segoe UI",Tahoma,sans-serif;background:rgba(15,15,16,.86);color:#fff;border:1px solid rgba(255,255,255,.25);border-radius:999px;padding:7px 12px;cursor:pointer}' +
		'.t:hover{border-color:#fff}.t[disabled]{opacity:.6;cursor:default}' +
		'.chip{position:absolute;top:12px;right:12px;z-index:61;font:600 13px/1 "IBM Plex Sans Arabic","Segoe UI",Tahoma,sans-serif;background:#0F0F10;color:#fff;border:1px solid rgba(255,255,255,.3);border-radius:999px;padding:8px 12px;cursor:pointer;direction:rtl;pointer-events:auto}' +
		'.chip b{font:800 14px/1 Changa,sans-serif;margin-inline-start:4px}' +
		'.chip .dot{display:inline-block;width:8px;height:8px;border-radius:50%;background:#fff;margin-inline-end:6px;vertical-align:1px}' +
		'.chip.hard .dot,.chip.too-hard .dot{background:#E3262B}' +
		'.panel{position:absolute;top:52px;right:12px;z-index:62;width:300px;max-height:calc(100% - 140px);overflow:auto;background:#fff;color:#0F0F10;border-radius:12px;' +
		'font:14px/1.55 "IBM Plex Sans Arabic","Segoe UI",Tahoma,sans-serif;direction:rtl;text-align:right;padding:14px;display:none;pointer-events:auto}' +
		'.panel.on{display:block}' +
		'.panel h3{font:800 17px/1.3 Changa,sans-serif;margin:0 0 4px}' +
		'.panel .sub{color:#8A8584;font-size:12.5px;margin-bottom:10px}' +
		'.panel ul{list-style:none;margin:0;padding:0}' +
		'.panel li{display:flex;justify-content:space-between;gap:8px;align-items:center;padding:7px 0;border-top:1px solid #E6E3DF}' +
		'.panel .en{direction:ltr;font-weight:600}.panel .ar{color:#4A4847;font-size:13px}' +
		'.panel .lv{font-size:11px;border:1px solid #E6E3DF;border-radius:5px;padding:1px 5px;margin-inline-start:6px;direction:ltr}' +
		'.panel .k{font:600 12px/1 "IBM Plex Sans Arabic",sans-serif;border:1px solid #E6E3DF;background:#fff;border-radius:999px;padding:6px 9px;cursor:pointer;white-space:nowrap}' +
		'.panel .k:hover{border-color:#0F0F10}' +
		'.msg{position:absolute;left:50%;transform:translateX(-50%);bottom:64px;z-index:60;font:600 14px/1.4 "IBM Plex Sans Arabic",sans-serif;background:rgba(15,15,16,.86);color:#fff;border-radius:10px;padding:8px 14px;direction:rtl;pointer-events:auto}';

	var S = { videoId: '', cues: [], analysed: null, grade: null, idx: -1, host: null, root: null, video: null, pausedByUs: false, raf: 0, on: true, primed: '' };

	/* ------------------------------------------------------------ captions from the page script */
	window.addEventListener('message', function (e) {
		if (e.source !== window || !e.data || e.data.source !== 'sawa-lens-main' || e.data.type !== 'captions') return;
		var d = e.data;
		if (d.videoId !== currentVideoId()) return;
		if (d.none) {
			S.videoId = d.videoId;
			S.cues = [];
			mount();
			say('هذا الفيديو لا يحتوي على نص إنجليزي.');
			return;
		}
		// Keep hand-made captions over auto-generated ones if both arrive.
		if (S.videoId === d.videoId && S.kind && S.kind !== 'asr' && d.kind === 'asr' && S.cues.length) return;
		var cues = parse(d.body, d.kind === 'asr');
		if (!cues.length) return;
		S.videoId = d.videoId;
		S.cues = cues;
		S.kind = d.kind;
		mount();
		analyse();
	});

	function parse(body, asr) {
		var j;
		try {
			j = JSON.parse(body);
		} catch (e) {
			return [];
		}
		var out = [];
		(j.events || []).forEach(function (ev) {
			if (!ev.segs) return;
			var text = ev.segs.map(function (s) { return s.utf8 || ''; }).join('').replace(/\s+/g, ' ').trim();
			if (!text || /^\[[^\]]*\]$/.test(text)) return; // skip "[Music]"-only lines
			var start = ev.tStartMs || 0, end = start + (ev.dDurationMs || 2000);
			if (asr && out.length && ev.aAppend) return;
			out.push({ start: start, end: end, text: text });
		});
		// Auto captions overlap: end each line where the next one starts.
		for (var i = 0; i < out.length - 1; i++) {
			if (out[i].end > out[i + 1].start) out[i].end = out[i + 1].start;
		}
		return out;
	}

	function currentVideoId() {
		var m = location.search.match(/[?&]v=([\w-]{11})/);
		return m ? m[1] : '';
	}

	/* ------------------------------------------------------------ analysis */
	function analyse() {
		var vid = S.videoId;
		U.send('analyze', { texts: S.cues.map(function (c) { return c.text; }) }).then(function (r) {
			if (vid !== S.videoId) return;
			S.analysed = r.lines;
			S.grade = r.grade;
			S.level = r.level;
			paintChip();
			S.idx = -1;
			tick(true);
		}, function (err) {
			say(U.errText(err));
		});
	}

	chrome.storage.onChanged.addListener(function (ch) {
		if ((ch.words || ch.level) && S.cues.length) analyse();
	});
	Card.onStateChange(function () {
		/* storage change listener re-analyses */
	});

	/* ------------------------------------------------------------ UI */
	function mount() {
		var player = document.querySelector('#movie_player');
		if (!player) return;
		if (S.host && S.host.isConnected && S.host.parentNode === player) return;
		if (S.host) S.host.remove();
		U.fonts();
		S.host = document.createElement('sawa-lens-yt');
		S.host.style.cssText = 'position:absolute;inset:0;pointer-events:none;z-index:60';
		S.root = S.host.attachShadow({ mode: 'open' });
		S.root.innerHTML = '<style>' + CSS + '</style>' +
			'<button class="chip" hidden></button><div class="panel"></div>' +
			'<div class="bar"><div class="line"></div><div class="tools">' +
			'<button class="t" data-a="prev">السابق</button><button class="t" data-a="save">احفظ الجملة</button><button class="t" data-a="next">التالي</button></div></div>';
		player.appendChild(S.host);
		player.classList.add('sawa-lens-on');
		hideNativeCaptions();
		S.root.addEventListener('mouseover', onOver);
		S.root.addEventListener('mouseout', onOut);
		S.root.addEventListener('click', onClick);
		new MutationObserver(function () {
			S.host.classList.toggle('ctrl', !player.classList.contains('ytp-autohide'));
		}).observe(player, { attributes: true, attributeFilter: ['class'] });
		S.video = player.querySelector('video');
		loop();
	}

	function hideNativeCaptions() {
		if (document.getElementById('sawa-lens-hide-cc')) return;
		var st = document.createElement('style');
		st.id = 'sawa-lens-hide-cc';
		st.textContent = '#movie_player.sawa-lens-on .ytp-caption-window-container{display:none!important}';
		document.documentElement.appendChild(st);
	}

	function say(text) {
		if (!S.root) return;
		var line = S.root.querySelector('.line');
		line.textContent = '';
		var m = S.root.querySelector('.msg') || S.root.appendChild(document.createElement('div'));
		m.className = 'msg';
		m.textContent = text;
		clearTimeout(S.sayT);
		S.sayT = setTimeout(function () { m.remove(); }, 6000);
	}

	var BAND = { easy: 'سهل', good: 'مناسب', hard: 'صعب', 'too-hard': 'صعب جدًا' };
	function paintChip() {
		var c = S.root && S.root.querySelector('.chip');
		if (!c || !S.grade) return;
		c.hidden = false;
		c.className = 'chip ' + S.grade.band;
		c.innerHTML = '<span class="dot"></span>تعرف <b dir="ltr">' + S.grade.percent + '%</b> · ' + BAND[S.grade.band];
		c.title = 'Language Lens: نسبة الكلمات التي تعرفها في هذا الفيديو';
		if (S.root.querySelector('.panel').classList.contains('on')) paintPanel();
	}

	function paintPanel() {
		var p = S.root.querySelector('.panel'), g = S.grade, u = U.esc;
		if (!g) return;
		var lv = U.LEVEL_NAMES[(S.level || 2) - 1];
		p.innerHTML = '<h3>كلمات جديدة في هذا الفيديو</h3>' +
			'<div class="sub">تعرف <bdi>' + g.percent + '%</bdi> من الكلمات (مستواك ' + lv + '). ' + (g.unknownLemmas ? 'تعلّم هذه أولًا:' : 'لا توجد كلمات جديدة.') + '</div><ul>' +
			g.top.map(function (w) {
				return '<li><div><span class="en">' + u(w.lemma) + '</span>' + (w.level ? '<span class="lv">' + U.LEVEL_NAMES[w.level - 1] + '</span>' : '') +
					(w.ar ? '<div class="ar">' + u(w.ar) + '</div>' : '') + '</div><button class="k" data-a="know" data-l="' + u(w.lemma) + '">أعرفها</button></li>';
			}).join('') + '</ul>';
	}

	function paintLine(i) {
		var line = S.root.querySelector('.line');
		if (i < 0 || !S.cues[i]) {
			line.innerHTML = '';
			return;
		}
		var text = S.cues[i].text, toks = S.analysed ? S.analysed[i] : null, html = '', pos = 0;
		if (!toks) {
			line.textContent = text;
			return;
		}
		toks.forEach(function (t, k) {
			html += U.esc(text.slice(pos, t.start));
			html += '<span class="wd ' + t.status + '" data-k="' + k + '">' + U.esc(t.text) + '</span>';
			pos = t.end;
		});
		html += U.esc(text.slice(pos));
		line.innerHTML = html;
	}

	/* ------------------------------------------------------------ playback sync */
	function find(ms) {
		var lo = 0, hi = S.cues.length - 1, ans = -1;
		while (lo <= hi) {
			var mid = (lo + hi) >> 1;
			if (S.cues[mid].start <= ms) {
				ans = mid;
				lo = mid + 1;
			} else hi = mid - 1;
		}
		if (ans >= 0 && ms > S.cues[ans].end + 400) return -1;
		return ans;
	}

	function tick(force) {
		if (!S.video || !S.root) return;
		if (document.querySelector('#movie_player.ad-showing')) {
			if (S.idx !== -2) {
				S.idx = -2;
				paintLine(-1);
			}
			return;
		}
		if (Card.isOpen() && S.pausedByUs) return;
		var i = find(S.video.currentTime * 1000);
		if (i !== S.idx || force) {
			S.idx = i;
			paintLine(i);
		}
	}

	function loop() {
		cancelAnimationFrame(S.raf);
		var last = 0;
		(function f(ts) {
			if (ts - last > 120) {
				last = ts;
				tick(false);
			}
			S.raf = requestAnimationFrame(f);
		})(0);
	}

	/* ------------------------------------------------------------ hover + clicks */
	var overT = null;
	function onOver(e) {
		var w = e.target.closest && e.target.closest('.wd');
		if (!w) {
			if (e.target.closest && e.target.closest('.bar') && Card.isOpen()) Card.keepOpen();
			return;
		}
		clearTimeout(overT);
		overT = setTimeout(function () {
			var cue = S.cues[S.idx];
			if (!cue) return;
			chrome.storage.local.get('pauseOnHover', function (o) {
				if (o.pauseOnHover !== false && S.video && !S.video.paused) {
					S.video.pause();
					S.pausedByUs = true;
				}
			});
			Card.show({
				word: w.textContent,
				rect: w.getBoundingClientRect(),
				sentence: cue.text,
				source: { url: 'https://www.youtube.com/watch?v=' + S.videoId + '&t=' + Math.floor(cue.start / 1000), title: document.title.replace(/ - YouTube$/, ''), videoId: S.videoId, startMs: cue.start, endMs: cue.end },
				onHide: resume
			});
		}, 120);
	}

	function onOut(e) {
		var w = e.target.closest && e.target.closest('.wd');
		if (w) {
			clearTimeout(overT);
			Card.hideSoon(400);
		}
	}

	function resume() {
		if (S.pausedByUs && S.video) {
			S.video.play();
		}
		S.pausedByUs = false;
	}

	function onClick(e) {
		var b = e.target.closest('[data-a], .chip');
		if (!b) return;
		e.stopPropagation();
		if (b.classList.contains('chip')) {
			var p = S.root.querySelector('.panel');
			p.classList.toggle('on');
			if (p.classList.contains('on')) paintPanel();
			return;
		}
		var a = b.dataset.a;
		if (a === 'prev' || a === 'next') {
			var i = Math.max(0, Math.min(S.cues.length - 1, (S.idx < 0 ? find(S.video.currentTime * 1000) : S.idx) + (a === 'prev' ? -1 : 1)));
			if (S.cues[i]) {
				S.video.currentTime = S.cues[i].start / 1000 + 0.01;
				tick(true);
			}
		} else if (a === 'save') {
			var cue = S.cues[S.idx];
			if (!cue) return;
			b.disabled = true;
			U.send('saveSentence', {
				text: cue.text,
				url: 'https://www.youtube.com/watch?v=' + S.videoId + '&t=' + Math.floor(cue.start / 1000),
				title: document.title.replace(/ - YouTube$/, ''),
				videoId: S.videoId,
				startMs: cue.start,
				endMs: cue.end
			}).then(function () {
				b.textContent = 'تم الحفظ ✓';
				setTimeout(function () {
					b.textContent = 'احفظ الجملة';
					b.disabled = false;
				}, 1800);
			}, function (err) {
				b.disabled = false;
				say(U.errText(err));
			});
		} else if (a === 'know') {
			b.disabled = true;
			U.send('mark', { lemma: b.dataset.l, status: 'known' }).catch(function (err) { say(U.errText(err)); });
		}
	}

	/* ------------------------------------------------------------ navigation */
	function start() {
		var vid = currentVideoId();
		if (!vid || !/^\/watch/.test(location.pathname)) {
			if (S.host) S.host.remove();
			S.videoId = '';
			S.cues = [];
			return;
		}
		if (S.primed === vid && S.videoId === vid) return;
		S.primed = vid;
		S.cues = [];
		S.analysed = null;
		S.grade = null;
		S.idx = -1;
		var tries = 0;
		(function wait() {
			if (document.querySelector('#movie_player video')) {
				mount();
				paintLine(-1);
				var chip = S.root && S.root.querySelector('.chip');
				if (chip) chip.hidden = true;
				primeUntilReady(vid, 0);
			} else if (tries++ < 40) setTimeout(wait, 250);
		})();
	}

	/** Ask the player for captions until they arrive (the player ignores us while it's still loading or showing an ad). */
	function primeUntilReady(vid, n) {
		if (vid !== currentVideoId() || S.videoId === vid || n > 15) return;
		// Ads are videos too: wait for them to finish without counting the wait.
		if (document.querySelector('#movie_player.ad-showing')) return setTimeout(function () { primeUntilReady(vid, n); }, 2000);
		window.postMessage({ source: 'sawa-lens-ui', type: 'prime' }, location.origin);
		setTimeout(function () { primeUntilReady(vid, n + 1); }, n < 3 ? 1500 : 3000);
	}

	document.addEventListener('yt-navigate-finish', function () { setTimeout(start, 300); });
	start();
})();
