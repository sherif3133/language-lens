/* Language Lens on YouTube.
   - Caption line on the video: hoverable, colour-coded words.
   - Transcript sidebar on the right: full sentences with timestamps; click one to play from there,
     or the repeat button to play only that sentence.
   - The video's grade, the new-words list, saving sentences, expressions and grammar points.
   Colours: known = plain · next level = green underline · beyond your level or rare = red underline · learning = yellow. */
(function () {
	'use strict';
	if (window.__sawaLensYT) return;
	window.__sawaLensYT = true;
	var U = window.LensUI, Card = window.LensCard;

	var FONT = '"IBM Plex Sans Arabic","Segoe UI",Tahoma,sans-serif';
	var CSS = '' +
		':host{all:initial}*{box-sizing:border-box}' +
		'.bar{position:absolute;left:50%;transform:translateX(-50%);bottom:64px;z-index:60;max-width:min(92%,980px);width:max-content;pointer-events:auto;' +
		'font:600 clamp(16px,2.2vw,26px)/1.45 ' + FONT + ';color:#fff;text-align:center;direction:ltr;transition:bottom .2s}' +
		':host(.ctrl) .bar{bottom:84px}' +
		'.line{background:rgba(15,15,16,.86);border-radius:10px;padding:6px 14px;display:inline-block;user-select:text}' +
		'.line:empty{display:none}' +
		'.wd{cursor:pointer;border-radius:4px;padding:0 1px}' +
		'.wd:hover{background:#fff;color:#0F0F10;text-decoration:none}' +
		':host(.colors) .wd.next{text-decoration:underline;text-decoration-color:#34D399;text-decoration-thickness:3px;text-underline-offset:6px}' +
		':host(.colors) .wd.hard{text-decoration:underline;text-decoration-color:#FF6B6B;text-decoration-thickness:3px;text-underline-offset:6px}' +
		':host(.colors) .wd.learning{background:#FDE68A;color:#0F0F10;box-shadow:0 0 0 2px #FDE68A}' +
		'.tools{display:flex;justify-content:center;gap:6px;margin-top:6px;opacity:0;transition:opacity .15s;direction:rtl}' +
		'.bar:hover .tools{opacity:1}' +
		'.t{font:600 13px/1 ' + FONT + ';background:rgba(15,15,16,.86);color:#fff;border:1px solid rgba(255,255,255,.25);border-radius:999px;padding:7px 12px;cursor:pointer}' +
		'.t:hover{border-color:#fff}.t[disabled]{opacity:.6;cursor:default}' +
		'.chip{position:absolute;top:12px;right:12px;z-index:61;font:600 13px/1 ' + FONT + ';background:#0F0F10;color:#fff;border:1px solid rgba(255,255,255,.3);border-radius:999px;padding:8px 12px;cursor:pointer;direction:rtl;pointer-events:auto}' +
		'.chip b{font:800 14px/1 Changa,sans-serif;margin-inline-start:4px}' +
		'.chip .dot{display:inline-block;width:8px;height:8px;border-radius:50%;background:#fff;margin-inline-end:6px;vertical-align:1px}' +
		'.chip.hard .dot,.chip.too-hard .dot{background:#E3262B}' +
		'.panel{position:absolute;top:52px;right:12px;z-index:62;width:300px;max-height:calc(100% - 140px);overflow:auto;background:#fff;color:#0F0F10;border-radius:12px;' +
		'font:14px/1.55 ' + FONT + ';direction:rtl;text-align:right;padding:14px;display:none;pointer-events:auto}' +
		'.panel.on{display:block}' +
		'.panel h3{font:800 17px/1.3 Changa,sans-serif;margin:0 0 4px}' +
		'.panel .sub{color:#8A8584;font-size:12.5px;margin-bottom:10px}' +
		'.panel ul{list-style:none;margin:0;padding:0}' +
		'.panel li{display:flex;justify-content:space-between;gap:8px;align-items:center;padding:7px 0;border-top:1px solid #E6E3DF}' +
		'.panel .en{direction:ltr;font-weight:600}.panel .ar{color:#4A4847;font-size:13px}' +
		'.panel .lv{font-size:11px;border:1px solid #E6E3DF;border-radius:5px;padding:1px 5px;margin-inline-start:6px;direction:ltr}' +
		'.panel .k{font:600 12px/1 ' + FONT + ';border:1px solid #E6E3DF;background:#fff;border-radius:999px;padding:6px 9px;cursor:pointer;white-space:nowrap}' +
		'.panel .k:hover{border-color:#0F0F10}' +
		'.msg{position:absolute;left:50%;transform:translateX(-50%);bottom:64px;z-index:60;font:600 14px/1.4 ' + FONT + ';background:rgba(15,15,16,.86);color:#fff;border-radius:10px;padding:8px 14px;direction:rtl;pointer-events:auto}';

	var SIDE_CSS = '' +
		':host{all:initial;display:block;margin-bottom:16px}*{box-sizing:border-box}' +
		'.side{font:14px/1.6 ' + FONT + ';color:#0F0F10;background:#fff;border:1px solid #E6E3DF;border-radius:12px;overflow:hidden}' +
		'.head{display:flex;align-items:center;justify-content:space-between;gap:8px;padding:10px 12px;background:#0F0F10;color:#fff;direction:rtl}' +
		'.ttl{font:800 15px/1 Changa,' + FONT + ';display:flex;align-items:center;gap:8px}' +
		'.ttl small{font:600 12px/1 ' + FONT + ';color:#8A8584}' +
		'.hb{display:flex;gap:4px}' +
		'.ib{font:600 12px/1 ' + FONT + ';background:transparent;color:#fff;border:1px solid rgba(255,255,255,.25);border-radius:999px;padding:6px 10px;cursor:pointer}' +
		'.ib:hover{border-color:#fff}.ib.on{background:#fff;color:#0F0F10;border-color:#fff}' +
		'.legend{display:flex;flex-wrap:wrap;gap:10px;padding:8px 12px;border-bottom:1px solid #E6E3DF;font-size:12px;color:#4A4847;direction:rtl}' +
		'.legend span{display:inline-flex;align-items:center;gap:5px}' +
		'.sw{display:inline-block;width:18px;height:10px;border-radius:2px}' +
		'.sw.next{border-bottom:3px solid #15803D}.sw.hard{border-bottom:3px solid #E3262B}.sw.learning{background:#FDE68A;outline:1px solid #B45309}.sw.known{border-bottom:1px solid #E6E3DF}' +
		'.list{max-height:min(62vh,640px);overflow:auto;padding:4px 0;direction:ltr}' +
		'.s{display:flex;gap:8px;align-items:flex-start;padding:7px 10px 7px 8px;border-inline-start:3px solid transparent;cursor:pointer}' +
		'.s:hover{background:#F6F5F3}' +
		'.s.now{background:#F6F5F3;border-inline-start-color:#0F0F10}' +
		'.tm{font:600 12px/1 ' + FONT + ';color:#4A4847;background:#fff;border:1px solid #E6E3DF;border-radius:6px;padding:4px 6px;cursor:pointer;flex:none;margin-top:2px;font-variant-numeric:tabular-nums}' +
		'.tm:hover{border-color:#0F0F10}' +
		'.tx{flex:1;min-width:0;font-size:15px;line-height:1.65;user-select:text;text-align:left}' +
		'.rep{flex:none;border:0;background:transparent;color:#8A8584;cursor:pointer;padding:2px 4px;border-radius:6px;line-height:0;margin-top:2px}' +
		'.rep:hover{color:#0F0F10;background:#fff}.rep svg{width:16px;height:16px;fill:none;stroke:currentColor;stroke-width:2;stroke-linecap:round;stroke-linejoin:round}' +
		'.wd{border-radius:3px;padding:0 1px}' +
		'.wd:hover{background:#0F0F10;color:#fff;text-decoration:none}' +
		':host(.colors) .wd.next{text-decoration:underline;text-decoration-color:#15803D;text-decoration-thickness:2px;text-underline-offset:4px}' +
		':host(.colors) .wd.hard{text-decoration:underline;text-decoration-color:#E3262B;text-decoration-thickness:2px;text-underline-offset:4px}' +
		':host(.colors) .wd.learning{background:#FDE68A;box-shadow:0 0 0 1px #B45309}' +
		'.empty{padding:16px;color:#8A8584;direction:rtl;text-align:right}' +
		'.foot{padding:8px 12px;border-top:1px solid #E6E3DF;font-size:12px;color:#8A8584;direction:rtl}' +
		':host(.min) .legend,:host(.min) .list,:host(.min) .foot{display:none}';

	var REPEAT = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M17 2l3 3-3 3M4 11V9a4 4 0 0 1 4-4h12M7 22l-3-3 3-3M20 13v2a4 4 0 0 1-4 4H4"/></svg>';

	var S = { videoId: '', cues: [], lines: null, sents: [], sentToks: null, grade: null, idx: -1, sIdx: -1, host: null, root: null, side: null, sRoot: null, video: null, pausedByUs: false, raf: 0, primed: '', stopAt: 0, follow: true, scrolledAt: 0 };
	var prefs = { sidebar: true, colors: true, pauseOnHover: true, sideMin: false };
	chrome.storage.local.get(['sidebar', 'lensColors', 'pauseOnHover', 'sideMin'], function (o) {
		prefs.sidebar = o.sidebar !== false;
		prefs.colors = o.lensColors !== false;
		prefs.pauseOnHover = o.pauseOnHover !== false;
		prefs.sideMin = !!o.sideMin;
		applyPrefs();
	});

	/* ------------------------------------------------------------ captions from the page script */
	window.addEventListener('message', function (e) {
		if (e.source !== window || !e.data || e.data.source !== 'sawa-lens-main' || e.data.type !== 'captions') return;
		var d = e.data;
		if (d.videoId !== currentVideoId()) return;
		if (d.none) {
			S.videoId = d.videoId;
			S.cues = [];
			S.sents = [];
			mount();
			paintSide();
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
		S.sents = sentences(cues, d.kind === 'asr');
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
			if (!text || /^\[[^\]]*\]$/.test(text)) return; // "[Music]"-only lines
			var start = ev.tStartMs || 0, end = start + (ev.dDurationMs || 2000);
			if (asr && out.length && ev.aAppend) return;
			var words = null;
			if (asr && ev.segs.length > 1) {
				words = ev.segs.map(function (s) { return { t: start + (s.tOffsetMs || 0), text: (s.utf8 || '').trim() }; }).filter(function (w) { return w.text; });
			}
			out.push({ start: start, end: end, text: text, words: words });
		});
		for (var i = 0; i < out.length - 1; i++) {
			if (out[i].end > out[i + 1].start) out[i].end = out[i + 1].start;
		}
		return out;
	}

	/**
	 * Full sentences with timings, built from caption lines.
	 * Hand-made captions: split on . ! ? (not "Mr." etc.). Auto captions often lack punctuation:
	 * then split on pauses, keeping ideas together (about 6–28 words).
	 */
	var ABBR = /^(mr|mrs|ms|dr|st|vs|etc|e\.g|i\.e|jr|sr|prof|no)\.$/i;
	function sentences(cues, asr) {
		var words = [];
		cues.forEach(function (c) {
			if (c.words) {
				c.words.forEach(function (w, k) { words.push({ t: w.t, text: w.text, cueEnd: c.end, gapAfter: 0 }); });
			} else {
				var parts = c.text.split(' '), len = c.text.length, pos = 0;
				parts.forEach(function (p) {
					words.push({ t: c.start + Math.round((pos / Math.max(1, len)) * (c.end - c.start)), text: p, cueEnd: c.end });
					pos += p.length + 1;
				});
			}
		});
		words = words.filter(function (w) { return w.text && !/^[\[(][^\])]*[\])]$/.test(w.text); }); // drop (Laughter), [Music]
		for (var i = 0; i < words.length; i++) words[i].gapAfter = i + 1 < words.length ? words[i + 1].t - words[i].t : 0;
		var punct = words.filter(function (w) { return /[.!?]["')\]]*$/.test(w.text); }).length;
		var usePunct = punct >= words.length / 40;
		var out = [], cur = [];
		function flush(endT) {
			if (!cur.length) return;
			var text = cur.map(function (w) { return w.text; }).join(' ').replace(/\s+([,.!?;:])/g, '$1').trim();
			if (/[A-Za-z]/.test(text)) out.push({ start: cur[0].t, end: endT, text: text });
			cur = [];
		}
		for (var k = 0; k < words.length; k++) {
			var w = words[k], next = words[k + 1];
			cur.push(w);
			var endT = next ? next.t : w.cueEnd;
			var ends = false;
			if (usePunct) {
				ends = /[.!?]["')\]]*$/.test(w.text) && !ABBR.test(w.text) && cur.length >= 3 && (!next || /^["'(\[]?[A-Z0-9]/.test(next.text));
				if (!ends && cur.length >= 45 && /[,;:]$/.test(w.text)) ends = true; // very long: break at a comma
			} else {
				ends = (cur.length >= 6 && w.gapAfter > 700) || (cur.length >= 14 && w.gapAfter > 350) || cur.length >= 28;
			}
			if (ends || !next) flush(endT);
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
		Promise.all([
			U.send('analyze', { texts: S.cues.map(function (c) { return c.text; }) }),
			U.send('analyze', { texts: S.sents.map(function (s) { return s.text; }) })
		]).then(function (r) {
			if (vid !== S.videoId) return;
			S.lines = r[0].lines;
			S.sentToks = r[1].lines;
			S.grade = r[1].grade;
			S.level = r[1].level;
			paintChip();
			paintSide();
			S.idx = -1;
			S.sIdx = -1;
			tick(true);
		}, function (err) {
			say(U.errText(err));
		});
	}

	var reT = null;
	chrome.storage.onChanged.addListener(function (ch) {
		if ((ch.words || ch.level) && S.cues.length) {
			clearTimeout(reT);
			reT = setTimeout(analyse, 300);
		}
		if (ch.sidebar) prefs.sidebar = ch.sidebar.newValue !== false;
		if (ch.lensColors) prefs.colors = ch.lensColors.newValue !== false;
		if (ch.pauseOnHover) prefs.pauseOnHover = ch.pauseOnHover.newValue !== false;
		if (ch.sideMin) prefs.sideMin = !!ch.sideMin.newValue;
		if (ch.sidebar || ch.lensColors || ch.sideMin) applyPrefs();
	});

	function applyPrefs() {
		if (S.host) S.host.classList.toggle('colors', prefs.colors);
		if (S.side) {
			S.side.classList.toggle('colors', prefs.colors);
			S.side.classList.toggle('min', prefs.sideMin);
			S.side.style.display = prefs.sidebar ? '' : 'none';
			var cb = S.sRoot.querySelector('[data-a=colors]');
			if (cb) cb.classList.toggle('on', prefs.colors);
		}
		if (prefs.sidebar && S.videoId && !S.side) mountSide();
	}

	/* ------------------------------------------------------------ word markup */
	function markup(text, toks) {
		if (!toks) return U.esc(text);
		var html = '', pos = 0;
		toks.forEach(function (t, k) {
			html += U.esc(text.slice(pos, t.start));
			html += '<span class="wd ' + t.status + '" data-k="' + k + '">' + U.esc(t.text) + '</span>';
			pos = t.end;
		});
		return html + U.esc(text.slice(pos));
	}

	/* ------------------------------------------------------------ caption overlay */
	function mount() {
		var player = document.querySelector('#movie_player');
		if (!player) return;
		if (!(S.host && S.host.isConnected && S.host.parentNode === player)) {
			if (S.host) S.host.remove();
			U.fonts();
			S.host = document.createElement('sawa-lens-yt');
			S.host.style.cssText = 'position:absolute;inset:0;pointer-events:none;z-index:60';
			S.root = S.host.attachShadow({ mode: 'open' });
			S.root.innerHTML = '<style>' + CSS + '</style>' +
				'<button class="chip" hidden></button><div class="panel"></div>' +
				'<div class="bar"><div class="line"></div><div class="tools">' +
				'<button class="t" data-a="prev">السابق</button><button class="t" data-a="save">احفظ الجملة</button><button class="t" data-a="next">التالي</button><button class="t" data-a="side">النص الكامل</button></div></div>';
			player.appendChild(S.host);
			player.classList.add('sawa-lens-on');
			hideNativeCaptions();
			S.root.addEventListener('mouseover', function (e) { onOver(e, 'bar'); });
			S.root.addEventListener('mouseout', onOut);
			S.root.addEventListener('click', onClick);
			S.root.addEventListener('mouseup', function (e) { onSelect(e, S.root, 'bar'); });
			new MutationObserver(function () {
				S.host.classList.toggle('ctrl', !player.classList.contains('ytp-autohide'));
			}).observe(player, { attributes: true, attributeFilter: ['class'] });
			S.video = player.querySelector('video');
			loop();
		}
		applyPrefs();
		if (prefs.sidebar) mountSide();
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
		line.innerHTML = markup(S.cues[i].text, S.lines ? S.lines[i] : null);
	}

	/* ------------------------------------------------------------ transcript sidebar */
	function mountSide() {
		if (!prefs.sidebar || !S.videoId) return;
		var col = document.querySelector('#secondary-inner') || document.querySelector('#secondary');
		if (!col) return;
		if (S.side && S.side.isConnected && S.side.parentNode === col) return;
		if (S.side) S.side.remove();
		S.side = document.createElement('sawa-lens-side');
		S.sRoot = S.side.attachShadow({ mode: 'open' });
		S.sRoot.innerHTML = '<style>' + SIDE_CSS + '</style><div class="side">' +
			'<div class="head"><div class="ttl">Language Lens <small class="g"></small></div><div class="hb">' +
			'<button class="ib" data-a="follow" title="تتبّع الجملة الحالية">تتبّع</button>' +
			'<button class="ib" data-a="colors" title="تلوين الكلمات">الألوان</button>' +
			'<button class="ib" data-a="min" title="تصغير">—</button></div></div>' +
			'<div class="legend"><span><i class="sw known"></i>أعرفها</span><span><i class="sw next"></i>تستحق المراجعة</span><span><i class="sw hard"></i>فوق مستواك أو نادرة</span><span><i class="sw learning"></i>أتعلّمها</span></div>' +
			'<div class="list"></div><div class="foot">اضغط على جملة لتشغيلها، أو ' + '↻' + ' لتشغيل الجملة وحدها. حدّد كلمات لحفظها كتعبير أو قاعدة.</div></div>';
		col.insertBefore(S.side, col.firstChild);
		S.sRoot.addEventListener('mouseover', function (e) { onOver(e, 'side'); });
		S.sRoot.addEventListener('mouseout', onOut);
		S.sRoot.addEventListener('click', onSideClick);
		S.sRoot.addEventListener('mouseup', function (e) { onSelect(e, S.sRoot, 'side'); });
		var list = S.sRoot.querySelector('.list');
		list.addEventListener('wheel', function () { S.scrolledAt = Date.now(); }, { passive: true });
		list.addEventListener('touchmove', function () { S.scrolledAt = Date.now(); }, { passive: true });
		applyPrefs();
		paintSide();
	}

	function fmt(ms) {
		var s = Math.floor(ms / 1000), h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), x = s % 60;
		return (h ? h + ':' + String(m).padStart(2, '0') : m) + ':' + String(x).padStart(2, '0');
	}

	function paintSide() {
		if (!S.sRoot) return;
		var list = S.sRoot.querySelector('.list'), g = S.sRoot.querySelector('.g');
		g.textContent = S.grade ? 'تعرف ' + S.grade.percent + '%' : '';
		S.sRoot.querySelector('[data-a=follow]').classList.toggle('on', S.follow);
		if (!S.sents.length) {
			list.innerHTML = '<div class="empty">' + (S.cues.length || !S.videoId ? 'جارٍ تجهيز النص…' : 'هذا الفيديو لا يحتوي على نص إنجليزي.') + '</div>';
			return;
		}
		list.innerHTML = S.sents.map(function (s, i) {
			return '<div class="s" data-i="' + i + '"><button class="tm" data-a="seek">' + fmt(s.start) + '</button><div class="tx">' + markup(s.text, S.sentToks ? S.sentToks[i] : null) +
				'</div><button class="rep" data-a="once" title="شغّل هذه الجملة فقط">' + REPEAT + '</button></div>';
		}).join('');
		S.sIdx = -1;
	}

	function onSideClick(e) {
		var b = e.target.closest('[data-a]');
		if (b && b.closest('.head')) {
			var a = b.dataset.a;
			if (a === 'follow') {
				S.follow = !S.follow;
				S.scrolledAt = 0;
				b.classList.toggle('on', S.follow);
			} else if (a === 'colors') chrome.storage.local.set({ lensColors: !prefs.colors });
			else if (a === 'min') chrome.storage.local.set({ sideMin: !prefs.sideMin });
			return;
		}
		var row = e.target.closest('.s');
		if (!row || !S.video) return;
		// Selecting text to save an expression shouldn't jump the video.
		var sel = S.sRoot.getSelection ? S.sRoot.getSelection() : window.getSelection();
		if (sel && !sel.isCollapsed && String(sel).trim().length > 1) return;
		var s = S.sents[+row.dataset.i];
		if (b && b.dataset.a === 'once') play(s.start, s.end);
		else play(s.start, 0);
	}

	/** Play from startMs; stop at endMs if given (0 = keep playing). */
	function play(startMs, endMs) {
		if (!S.video) return;
		S.stopAt = endMs || 0;
		S.video.currentTime = Math.max(0, startMs / 1000 - 0.05);
		var p = S.video.play();
		if (p && p.catch) p.catch(function () {});
		S.scrolledAt = 0;
	}

	/* ------------------------------------------------------------ playback sync */
	function find(arr, ms, slack) {
		var lo = 0, hi = arr.length - 1, ans = -1;
		while (lo <= hi) {
			var mid = (lo + hi) >> 1;
			if (arr[mid].start <= ms) {
				ans = mid;
				lo = mid + 1;
			} else hi = mid - 1;
		}
		if (ans >= 0 && slack != null && ms > arr[ans].end + slack) return -1;
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
		var ms = S.video.currentTime * 1000;
		if (S.stopAt && ms >= S.stopAt) {
			S.stopAt = 0;
			S.video.pause();
		}
		if (Card.isOpen() && S.pausedByUs) return;
		var i = find(S.cues, ms, 400);
		if (i !== S.idx || force) {
			S.idx = i;
			paintLine(i);
		}
		if (S.sRoot && S.sents.length) {
			var j = find(S.sents, ms, null);
			if (j !== S.sIdx) {
				var prev = S.sRoot.querySelector('.s.now');
				if (prev) prev.classList.remove('now');
				var row = S.sRoot.querySelector('.s[data-i="' + j + '"]');
				if (row) {
					row.classList.add('now');
					if (S.follow && Date.now() - S.scrolledAt > 5000 && !Card.isOpen()) {
						var list = S.sRoot.querySelector('.list');
						list.scrollTo({ top: row.offsetTop - list.clientHeight / 3, behavior: 'smooth' });
					}
				}
				S.sIdx = j;
			}
		}
	}

	function loop() {
		cancelAnimationFrame(S.raf);
		var last = 0;
		(function f(ts) {
			if (ts - last > 100) {
				last = ts;
				tick(false);
			}
			S.raf = requestAnimationFrame(f);
		})(0);
	}

	/* ------------------------------------------------------------ hover, select, clicks */
	var overT = null;
	function onOver(e, where) {
		var w = e.target.closest && e.target.closest('.wd');
		if (!w) {
			if (Card.isOpen()) Card.keepOpen();
			return;
		}
		if (Card.selectOpen && Card.selectOpen()) return;
		clearTimeout(overT);
		overT = setTimeout(function () {
			var src;
			if (where === 'side') {
				var row = w.closest('.s'), s = row && S.sents[+row.dataset.i];
				if (!s) return;
				src = { text: s.text, start: s.start, end: s.end };
			} else {
				var cue = S.cues[S.idx];
				if (!cue) return;
				// The full sentence around this caption line is the better context.
				var si = find(S.sents, cue.start + 1, null), sent = S.sents[si];
				src = sent && sent.text.indexOf(w.textContent) >= 0 ? { text: sent.text, start: sent.start, end: sent.end } : { text: cue.text, start: cue.start, end: cue.end };
				if (prefs.pauseOnHover && S.video && !S.video.paused) {
					S.video.pause();
					S.pausedByUs = true;
				}
			}
			Card.show({
				word: w.textContent,
				rect: w.getBoundingClientRect(),
				sentence: src.text,
				source: { url: 'https://www.youtube.com/watch?v=' + S.videoId + '&t=' + Math.floor(src.start / 1000), title: document.title.replace(/ - YouTube$/, ''), videoId: S.videoId, startMs: src.start, endMs: src.end },
				onHide: resume,
				onReplay: function (a, b) {
					S.pausedByUs = false;
					play(a, b);
				}
			});
		}, where === 'side' ? 250 : 120);
	}

	function onOut(e) {
		var w = e.target.closest && e.target.closest('.wd');
		if (w) {
			clearTimeout(overT);
			Card.hideSoon(450);
		}
	}

	function resume() {
		if (S.pausedByUs && S.video) S.video.play();
		S.pausedByUs = false;
	}

	/** Words selected in the caption line or the transcript: save as a sentence, an expression or a grammar point. */
	function onSelect(e, root, where) {
		setTimeout(function () {
			var sel = root.getSelection ? root.getSelection() : window.getSelection();
			var text = sel && !sel.isCollapsed ? String(sel).replace(/\s+/g, ' ').trim() : '';
			if (!/[A-Za-z]{2,}/.test(text) || text.length > 400) return;
			var s;
			if (where === 'side') {
				var node = sel.anchorNode && (sel.anchorNode.nodeType === 1 ? sel.anchorNode : sel.anchorNode.parentElement);
				var row = node && node.closest('.s');
				s = row && S.sents[+row.dataset.i];
			} else {
				var cue = S.cues[S.idx];
				var si = cue ? find(S.sents, cue.start + 1, null) : -1;
				s = S.sents[si] || (cue ? { text: cue.text, start: cue.start, end: cue.end } : null);
				if (S.video && !S.video.paused) {
					S.video.pause();
					S.pausedByUs = true;
				}
			}
			if (!s) return;
			clearTimeout(overT);
			Card.hide();
			Card.select({
				text: text,
				sentence: s.text,
				rect: sel.getRangeAt(0).getBoundingClientRect(),
				source: { url: 'https://www.youtube.com/watch?v=' + S.videoId + '&t=' + Math.floor(s.start / 1000), title: document.title.replace(/ - YouTube$/, ''), videoId: S.videoId, startMs: s.start, endMs: s.end },
				onReplay: function (a, b) { play(a, b); }
			});
		}, 10);
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
			var i = Math.max(0, Math.min(S.cues.length - 1, (S.idx < 0 ? find(S.cues, S.video.currentTime * 1000, null) : S.idx) + (a === 'prev' ? -1 : 1)));
			if (S.cues[i]) {
				S.video.currentTime = S.cues[i].start / 1000 + 0.01;
				tick(true);
			}
		} else if (a === 'side') {
			chrome.storage.local.set({ sidebar: !prefs.sidebar, sideMin: false });
		} else if (a === 'save') {
			var cue = S.cues[S.idx];
			if (!cue) return;
			var si = find(S.sents, cue.start + 1, null), s = S.sents[si] || cue;
			b.disabled = true;
			U.send('saveSentence', {
				text: s.text,
				url: 'https://www.youtube.com/watch?v=' + S.videoId + '&t=' + Math.floor(s.start / 1000),
				title: document.title.replace(/ - YouTube$/, ''),
				videoId: S.videoId,
				startMs: s.start,
				endMs: s.end
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
	/** Ask the player for captions until they arrive (it ignores us while loading or showing an ad). */
	function primeUntilReady(vid, n) {
		if (vid !== currentVideoId() || S.videoId === vid || n > 15) return;
		if (document.querySelector('#movie_player.ad-showing')) return setTimeout(function () { primeUntilReady(vid, n); }, 2000);
		window.postMessage({ source: 'sawa-lens-ui', type: 'prime' }, location.origin);
		setTimeout(function () { primeUntilReady(vid, n + 1); }, n < 3 ? 1500 : 3000);
	}

	function start() {
		var vid = currentVideoId();
		if (!vid || !/^\/watch/.test(location.pathname)) {
			if (S.host) S.host.remove();
			if (S.side) S.side.remove();
			S.side = null;
			S.videoId = '';
			S.cues = [];
			S.sents = [];
			return;
		}
		if (S.primed === vid && S.videoId === vid) return;
		S.primed = vid;
		S.cues = [];
		S.sents = [];
		S.lines = null;
		S.sentToks = null;
		S.grade = null;
		S.idx = -1;
		S.sIdx = -1;
		S.stopAt = 0;
		var tries = 0;
		(function wait() {
			if (document.querySelector('#movie_player video')) {
				mount();
				paintLine(-1);
				paintSide();
				var chip = S.root && S.root.querySelector('.chip');
				if (chip) chip.hidden = true;
				primeUntilReady(vid, 0);
			} else if (tries++ < 40) setTimeout(wait, 250);
		})();
	}

	// YouTube rebuilds the right column on navigation: keep the sidebar in place.
	setInterval(function () { if (S.videoId && prefs.sidebar) mountSide(); }, 2000);
	document.addEventListener('yt-navigate-finish', function () { setTimeout(start, 300); });
	start();
})();
