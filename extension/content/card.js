/* Language Lens: the word card and the selection popup.
   Card: meaning (Arabic or English), level, listen, known/learning, meaning in this sentence, save sentence.
   Selection popup: save a sentence, an expression (phrasal verb, idiom, collocation) or a grammar point.
   Both live in shadow roots so page styles can't touch them. */
(function () {
	'use strict';
	if (window.LensCard) return;
	var U = window.LensUI;

	var BASE = ':host{all:initial}*{box-sizing:border-box}' +
		'button{font:600 13.5px/1 "IBM Plex Sans Arabic","Segoe UI",Tahoma,sans-serif;border:1px solid #E6E3DF;background:#fff;color:#0F0F10;border-radius:999px;padding:8px 12px;cursor:pointer}' +
		'button:hover{border-color:#0F0F10}button.on{background:#0F0F10;border-color:#0F0F10;color:#fff}button:disabled{opacity:.5;cursor:default}' +
		'.spin{display:inline-block;width:12px;height:12px;border:2px solid #E6E3DF;border-top-color:#0F0F10;border-radius:50%;animation:s .8s linear infinite;vertical-align:-2px}@keyframes s{to{transform:rotate(360deg)}}' +
		'.msg{font-size:13px;color:#8A8584;margin-top:8px}.msg.bad{color:#E3262B}';

	var CSS = BASE +
		'.card{position:fixed;z-index:2147483646;width:330px;max-width:calc(100vw - 16px);max-height:calc(100vh - 16px);overflow:auto;background:#fff;color:#0F0F10;border:1px solid #0F0F10;border-radius:12px;' +
		'font:15px/1.55 "IBM Plex Sans Arabic","Segoe UI",Tahoma,sans-serif;direction:rtl;text-align:right;padding:14px 14px 12px;display:none}' +
		'.card.on{display:block}' +
		'.top{display:flex;align-items:center;justify-content:space-between;gap:8px;direction:ltr}' +
		'.wrow{display:flex;align-items:center;gap:6px;min-width:0}' +
		'.w{font:800 22px/1.2 Changa,"IBM Plex Sans Arabic",sans-serif;text-align:left;word-break:break-word}' +
		'.say{border:0;background:transparent;padding:4px;border-radius:6px;line-height:0;color:#0F0F10;flex:none}.say:hover{background:#F6F5F3}.say svg{width:18px;height:18px;fill:none;stroke:currentColor;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round}' +
		'.meta{display:flex;align-items:center;gap:6px}' +
		'.lv{font:600 12px/1 "IBM Plex Sans Arabic",sans-serif;border:1px solid #0F0F10;border-radius:6px;padding:3px 6px;white-space:nowrap}.lv.off{border-color:#E6E3DF;color:#8A8584}' +
		'.lang{display:inline-flex;border:1px solid #E6E3DF;border-radius:999px;overflow:hidden}.lang button{border:0;border-radius:0;padding:4px 8px;font-size:12px}' +
		'.base{direction:ltr;text-align:left;color:#8A8584;font-size:13px;margin-top:2px}' +
		'.ar{font-size:17px;margin-top:8px}.en{font-size:15px;margin-top:8px;direction:ltr;text-align:left}' +
		'.pos{color:#8A8584;font-size:12px;margin-inline-start:6px}.row{display:block;margin-top:2px}' +
		'.ex{direction:ltr;text-align:left;margin-top:8px;font-size:14px;color:#4A4847;display:flex;gap:6px;align-items:flex-start}.ex i{font-style:italic}' +
		'.alt{color:#8A8584;font-size:12.5px;margin-top:4px}' +
		'.ctx{margin-top:10px;padding-top:10px;border-top:1px solid #E6E3DF;font-size:14.5px}.ctx b{font-weight:600}.ctx .muted{color:#8A8584}' +
		'.ctx.en-ctx{direction:ltr;text-align:left}' +
		'.sent{display:flex;gap:6px;align-items:flex-start;margin-top:10px;padding-top:10px;border-top:1px solid #E6E3DF;direction:ltr;text-align:left;font-size:13.5px;color:#4A4847}' +
		'.note{color:#4A4847;font-size:13.5px;margin-top:4px}' +
		'.btns{display:flex;gap:6px;flex-wrap:wrap;margin-top:12px}' +
		'.wide{width:100%;margin-top:8px;border-radius:10px;padding:10px}' +
		'.brand{margin-top:10px;font-size:11px;color:#8A8584;direction:ltr;text-align:left}';

	var SPEAK = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9v6h4l5 4V5L8 9zM16 8.5a5 5 0 0 1 0 7M18.5 6a8.5 8.5 0 0 1 0 12"/></svg>';

	/* ------------------------------------------------------------ speech */
	var voice = null;
	function pickVoice() {
		if (!window.speechSynthesis) return null;
		var vs = speechSynthesis.getVoices().filter(function (v) { return /^en(-|_)/i.test(v.lang); });
		return vs.filter(function (v) { return /en-US/i.test(v.lang) && /Google|Natural|Online/i.test(v.name); })[0] ||
			vs.filter(function (v) { return /en-US/i.test(v.lang); })[0] || vs[0] || null;
	}
	if (window.speechSynthesis) speechSynthesis.addEventListener('voiceschanged', function () { voice = pickVoice(); });
	function speak(text, slow) {
		if (!window.speechSynthesis || !text) return;
		speechSynthesis.cancel();
		var u = new SpeechSynthesisUtterance(text);
		voice = voice || pickVoice();
		if (voice) u.voice = voice;
		u.lang = voice ? voice.lang : 'en-US';
		u.rate = slow ? 0.8 : 0.95;
		speechSynthesis.speak(u);
	}

	/* ------------------------------------------------------------ card */
	var host, root, el, cur = null, hideT = null, onState = null, lang = 'ar';
	chrome.storage.local.get('glossLang', function (o) { lang = o.glossLang === 'en' ? 'en' : 'ar'; });
	chrome.storage.onChanged.addListener(function (ch) { if (ch.glossLang) lang = ch.glossLang.newValue === 'en' ? 'en' : 'ar'; });

	function ensure() {
		if (host && host.isConnected) return;
		U.fonts();
		host = document.createElement('sawa-lens-card');
		root = host.attachShadow({ mode: 'open' });
		root.innerHTML = '<style>' + CSS + '</style><div class="card" role="dialog" aria-label="Language Lens"></div>';
		el = root.querySelector('.card');
		(document.fullscreenElement || document.documentElement).appendChild(host);
		el.addEventListener('mouseenter', function () { clearTimeout(hideT); });
		el.addEventListener('mouseleave', function () { hideSoon(); });
		el.addEventListener('click', onClick);
	}

	function place(rect) {
		var w = el.offsetWidth || 330, h = el.offsetHeight || 200;
		var x = Math.min(Math.max(8, rect.left + rect.width / 2 - w / 2), window.innerWidth - w - 8);
		var y = rect.top - h - 10;
		if (y < 8) y = rect.bottom + 10;
		el.style.left = x + 'px';
		el.style.top = Math.max(8, Math.min(y, window.innerHeight - h - 8)) + 'px';
	}

	function posAr(p) {
		return { noun: 'اسم', verb: 'فعل', adjective: 'صفة', adverb: 'ظرف', preposition: 'حرف جر', pronoun: 'ضمير', determiner: 'أداة', conjunction: 'أداة ربط', interjection: 'تعجب', number: 'عدد' }[p] || '';
	}

	function render() {
		var d = cur.data, u = U.esc;
		if (!d) {
			el.innerHTML = '<div class="w" style="direction:ltr;text-align:left">' + u(cur.word) + '</div><div class="msg"><span class="spin"></span></div>';
			return;
		}
		var meaning;
		if (lang === 'en') {
			var en = d.entries.filter(function (e) { return e.en; });
			meaning = '<div class="en">' + (en.length
				? en.map(function (e) { return '<span class="row"><span class="pos">' + u(e.pos) + '</span> ' + u(e.en) + '</span>'; }).join('')
				: '<span class="row" style="color:#8A8584">No dictionary entry. Try "In this sentence".</span>') + '</div>';
			var ex = (en.filter(function (e) { return e.ex; })[0] || {}).ex;
			if (ex) meaning += '<div class="ex"><button class="say" data-a="say-ex" title="Listen">' + SPEAK + '</button><i>' + u(ex) + '</i></div>';
		} else {
			var ar = d.entries.filter(function (e) { return e.ar; });
			meaning = '<div class="ar">' + (ar.length
				? ar.map(function (e) { return '<span class="row">' + u(e.ar) + '<span class="pos">' + u(posAr(e.pos)) + '</span></span>'; }).join('')
				: '<span class="row" style="color:#8A8584">ليست في القاموس. اضغط "معناها في الجملة".</span>') + '</div>' +
				(d.alts && d.alts.length ? '<div class="alt">وقد تعني: ' + d.alts.map(function (a) { return '<span dir="ltr">' + u(a.lemma) + '</span>' + (a.ar ? ' (' + u(a.ar.split('،')[0]) + ')' : ''); }).join('، ') + '</div>' : '');
		}
		var ctx = '';
		if (cur.ctx === 'loading') ctx = '<div class="ctx"><span class="spin"></span></div>';
		else if (cur.ctx && cur.ctx.error) ctx = '<div class="ctx"><div class="msg bad">' + u(cur.ctx.error) + '</div></div>';
		else if (cur.ctx) {
			ctx = lang === 'en'
				? '<div class="ctx en-ctx"><div><b>Here:</b> ' + u(cur.ctx.meaning) + '</div>' + (cur.ctx.sentence ? '<div class="muted" style="margin-top:4px">' + u(cur.ctx.sentence) + '</div>' : '') + (cur.ctx.note ? '<div class="note">' + u(cur.ctx.note) + '</div>' : '') + '</div>'
				: '<div class="ctx"><div><b>في هذه الجملة:</b> ' + u(cur.ctx.meaning) + '</div>' + (cur.ctx.sentence ? '<div class="muted" style="margin-top:4px">' + u(cur.ctx.sentence) + '</div>' : '') + (cur.ctx.note ? '<div class="note">' + u(cur.ctx.note) + '</div>' : '') + '</div>';
		}
		var known = d.status === 'known', learning = d.status === 'learning';
		var canReplay = !!(cur.onReplay && cur.source && cur.source.videoId);
		el.innerHTML =
			'<div class="top"><div class="wrow"><button class="say" data-a="say-word" title="Listen / استمع">' + SPEAK + '</button><div class="w">' + u(cur.word) + '</div></div>' +
			'<div class="meta"><span class="lv' + (d.levelName ? '' : ' off') + '">' + (d.levelName || (lang === 'en' ? 'rare' : 'خارج القائمة')) + '</span>' +
			'<span class="lang"><button data-a="lang-ar" class="' + (lang === 'ar' ? 'on' : '') + '">ع</button><button data-a="lang-en" class="' + (lang === 'en' ? 'on' : '') + '">EN</button></span></div></div>' +
			(d.lemma && d.lemma !== String(cur.word).toLowerCase() ? '<div class="base">' + u(d.lemma) + '</div>' : '') +
			meaning + ctx +
			(cur.sentence ? '<div class="sent"><button class="say" data-a="say-sent" title="' + (canReplay ? 'Replay from the video' : 'Listen') + '">' + SPEAK + '</button><span>' + u(cur.sentence) + '</span></div>' : '') +
			'<div class="btns">' +
			'<button data-a="known" class="' + (known ? 'on' : '') + '">' + (known ? '✓ ' : '') + 'أعرفها</button>' +
			'<button data-a="learning" class="' + (learning ? 'on' : '') + '">' + (learning ? '✓ ' : '') + 'أتعلّمها</button>' +
			(cur.sentence && !cur.ctx ? '<button data-a="explain">' + (lang === 'en' ? 'In this sentence' : 'معناها في الجملة') + '</button>' : '') +
			'</div>' +
			(cur.sentence ? '<button class="wide" data-a="save"' + (cur.saved ? ' disabled' : '') + '>' + (cur.saved ? 'تم حفظ الجملة ✓' : 'احفظ الجملة كبطاقة مراجعة') + '</button>' : '') +
			(cur.msg ? '<div class="msg' + (cur.bad ? ' bad' : '') + '">' + u(cur.msg) + '</div>' : '') +
			'<div class="brand">Language Lens · Sawa English</div>';
		place(cur.rect);
	}

	function onClick(e) {
		var b = e.target.closest('button');
		if (!b || !cur || !cur.data) return;
		var a = b.dataset.a, c = cur;
		if (a === 'say-word') speak(c.data.lemma && c.data.lemma.indexOf(' ') > 0 ? c.data.lemma : c.word, true);
		else if (a === 'say-ex') {
			var ex = (c.data.entries.filter(function (x) { return x.ex; })[0] || {}).ex;
			speak(ex);
		} else if (a === 'say-sent') {
			if (c.onReplay && c.source && c.source.videoId) c.onReplay(c.source.startMs, c.source.endMs);
			else speak(c.sentence);
		} else if (a === 'lang-ar' || a === 'lang-en') {
			lang = a === 'lang-en' ? 'en' : 'ar';
			c.ctx = null; // the explanation is per language
			U.send('setPref', { key: 'glossLang', value: lang }).catch(function () {});
			render();
		} else if (a === 'known' || a === 'learning') {
			var next = c.data.mark === a ? '' : a;
			U.send('mark', { lemma: c.data.lemma, status: next }).then(function (st) {
				c.data.status = st;
				c.data.mark = next;
				if (cur === c) render();
				if (onState) onState(c.data.lemma, st);
			}, fail(c));
		} else if (a === 'explain') {
			c.ctx = 'loading';
			render();
			U.send('explain', { word: c.word, sentence: c.sentence, lang: lang }).then(function (r) {
				c.ctx = r;
				if (cur === c) render();
			}, function (err) {
				c.ctx = { error: U.errText(err) };
				if (cur === c) render();
			});
		} else if (a === 'save') {
			var d = Object.assign({ text: c.sentence, focus: c.word, focusLemma: c.data.lemma, ar: c.ctx && c.ctx.sentence && lang === 'ar' ? c.ctx.sentence : '' }, c.source || {});
			b.disabled = true;
			U.send('saveSentence', d).then(function () {
				c.saved = true;
				c.msg = 'ستجدها في بطاقات المراجعة.';
				if (cur === c) render();
			}, fail(c));
		}
	}

	function fail(c) {
		return function (err) {
			c.msg = U.errText(err);
			c.bad = true;
			if (cur === c) render();
		};
	}

	function hideSoon(ms) {
		clearTimeout(hideT);
		hideT = setTimeout(hide, ms == null ? 350 : ms);
	}
	function hide() {
		clearTimeout(hideT);
		if (el) el.classList.remove('on');
		var was = cur;
		cur = null;
		if (was && was.onHide) was.onHide();
	}

	/**
	 * Show the card for a word.
	 * o = { word, rect, sentence, source: {url,title,videoId,startMs,endMs}, onHide, onReplay(startMs, endMs) }
	 */
	function show(o) {
		ensure();
		clearTimeout(hideT);
		if (cur && cur.word === o.word && cur.sentence === o.sentence) return;
		if (cur && cur.onHide && cur.onHide !== o.onHide) cur.onHide();
		cur = Object.assign({ data: null, ctx: null, saved: false, msg: '' }, o);
		var c = cur;
		el.classList.add('on');
		render();
		place(o.rect);
		U.send('lookup', { word: o.word }).then(function (d) {
			c.data = d;
			if (cur === c) render();
		}, function (err) {
			c.data = { entries: [], status: 'hard', lemma: o.word };
			c.msg = U.errText(err);
			c.bad = true;
			if (cur === c) render();
		});
	}

	/* ------------------------------------------------------------ selection popup */
	var GRAMMAR = [
		['conditional', 'جملة شرطية (if)'], ['passive', 'المبني للمجهول'], ['present-perfect', 'المضارع التام'], ['past-perfect', 'الماضي التام'],
		['continuous', 'الأزمنة المستمرة'], ['future', 'المستقبل'], ['modal', 'الأفعال الناقصة (can, should…)'], ['relative', 'جملة وصل (who, which…)'],
		['reported', 'الكلام المنقول'], ['comparison', 'المقارنة والتفضيل'], ['question', 'صيغة السؤال'], ['other', 'قاعدة أخرى']
	];
	var KINDS = [['phrasal', 'فعل مركّب'], ['idiom', 'تعبير اصطلاحي'], ['collocation', 'تلازم لفظي'], ['phrase', 'عبارة']];
	var SCSS = BASE +
		'.pop{position:fixed;z-index:2147483646;width:300px;max-width:calc(100vw - 16px);background:#fff;color:#0F0F10;border:1px solid #0F0F10;border-radius:12px;font:14px/1.55 "IBM Plex Sans Arabic","Segoe UI",Tahoma,sans-serif;direction:rtl;text-align:right;padding:12px;display:none}' +
		'.pop.on{display:block}.sel{direction:ltr;text-align:left;font-weight:600;margin:0 22px 8px 0;max-height:72px;overflow:auto}' +
		'.grid{display:flex;flex-wrap:wrap;gap:6px}.h{font-size:12px;color:#8A8584;margin:10px 0 6px}' +
		'.close{position:absolute;top:6px;left:6px;border:0;padding:4px 8px;font-size:16px;line-height:1;background:transparent}';
	var sHost, sRoot, sEl, sCur = null;

	function sEnsure() {
		if (sHost && sHost.isConnected) return;
		sHost = document.createElement('sawa-lens-select');
		sRoot = sHost.attachShadow({ mode: 'open' });
		sRoot.innerHTML = '<style>' + SCSS + '</style><div class="pop" role="dialog" aria-label="Language Lens"></div>';
		sEl = sRoot.querySelector('.pop');
		(document.fullscreenElement || document.documentElement).appendChild(sHost);
		sEl.addEventListener('click', sClick);
	}

	function sRender() {
		var c = sCur, u = U.esc, words = c.text.split(/\s+/).length;
		var body;
		if (c.mode === 'expr') {
			body = '<div class="h">نوع التعبير</div><div class="grid">' + KINDS.map(function (k) { return '<button data-k="' + k[0] + '">' + k[1] + '</button>'; }).join('') + '</div>';
		} else if (c.mode === 'grammar') {
			body = '<div class="h">ما القاعدة في هذه الجملة؟</div><div class="grid">' + GRAMMAR.map(function (g) { return '<button data-g="' + g[0] + '">' + g[1] + '</button>'; }).join('') + '</div>';
		} else {
			body = '<div class="grid">' +
				'<button data-a="sentence">احفظ الجملة</button>' +
				(words >= 2 && words <= 8 ? '<button data-a="expr">احفظ كتعبير</button>' : '') +
				'<button data-a="grammar">علّم قاعدة</button>' +
				'<button data-a="say">استمع</button></div>';
		}
		sEl.innerHTML = '<button class="close" data-a="close" aria-label="إغلاق">×</button><div class="sel">' + u(c.text.length > 160 ? c.text.slice(0, 160) + '…' : c.text) + '</div>' + body +
			(c.msg ? '<div class="msg' + (c.bad ? ' bad' : '') + '">' + u(c.msg) + '</div>' : '');
		var r = c.rect, w = 300, h = sEl.offsetHeight || 140;
		sEl.style.left = Math.min(Math.max(8, r.left + r.width / 2 - w / 2), window.innerWidth - w - 8) + 'px';
		var y = r.top - h - 10;
		sEl.style.top = (y < 8 ? r.bottom + 10 : y) + 'px';
	}

	function sClick(e) {
		var b = e.target.closest('button');
		if (!b || !sCur) return;
		var c = sCur;
		var done = function (msg) {
			c.msg = msg;
			c.bad = false;
			c.mode = 'done';
			sRender();
			setTimeout(function () { if (sCur === c) selHide(); }, 1800);
		};
		var failS = function (err) {
			c.msg = U.errText(err);
			c.bad = true;
			sRender();
		};
		var src = c.source || {};
		if (b.dataset.a === 'close') return selHide();
		if (b.dataset.a === 'say') {
			if (c.onReplay && src.videoId) c.onReplay(src.startMs, src.endMs);
			else speak(c.text);
			return;
		}
		if (b.dataset.a === 'expr' || b.dataset.a === 'grammar') {
			c.mode = b.dataset.a;
			return sRender();
		}
		if (b.dataset.a === 'sentence') {
			U.send('saveSentence', Object.assign({ text: c.sentence || c.text }, src)).then(function () { done('تم حفظ الجملة ✓'); }, failS);
		} else if (b.dataset.k) {
			U.send('saveExpression', Object.assign({ phrase: c.text, sentence: c.sentence, kind: 'phrase', tag: b.dataset.k }, src)).then(function () { done('تم حفظ التعبير ✓ سيظهر ملوّنًا أينما قابلته.'); }, failS);
		} else if (b.dataset.g) {
			U.send('saveSentence', Object.assign({ text: c.sentence || c.text, focus: c.text, kind: 'grammar', tag: b.dataset.g }, src)).then(function () { done('تم حفظ الجملة مع القاعدة ✓'); }, failS);
		}
	}

	/** o = { text, sentence, rect, source, onReplay } */
	function selShow(o) {
		sEnsure();
		hide();
		sCur = Object.assign({ mode: '', msg: '' }, o);
		sEl.classList.add('on');
		sRender();
	}
	function selHide() {
		if (sEl) sEl.classList.remove('on');
		sCur = null;
	}
	document.addEventListener('mousedown', function (e) {
		if (sCur && e.composedPath().indexOf(sHost) < 0) selHide();
	}, true);

	document.addEventListener('keydown', function (e) {
		if (e.key === 'Escape') {
			if (cur) hide();
			if (sCur) selHide();
		}
	});
	document.addEventListener('fullscreenchange', function () {
		var to = document.fullscreenElement || document.documentElement;
		if (host) to.appendChild(host);
		if (sHost) to.appendChild(sHost);
	});

	window.LensCard = {
		show: show,
		hide: hide,
		hideSoon: hideSoon,
		isOpen: function () { return !!cur; },
		onStateChange: function (fn) { onState = fn; },
		keepOpen: function () { clearTimeout(hideT); },
		speak: speak,
		select: selShow,
		selectOpen: function () { return !!sCur; }
	};
})();
