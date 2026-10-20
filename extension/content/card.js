/* Language Lens: the word card (Arabic meaning, level, known/learning, meaning in this sentence, save sentence).
   Lives in its own shadow root so page styles can't touch it. */
(function () {
	'use strict';
	if (window.LensCard) return;
	var U = window.LensUI;

	var CSS = '' +
		':host{all:initial}' +
		'*{box-sizing:border-box}' +
		'.card{position:fixed;z-index:2147483646;width:320px;max-width:calc(100vw - 16px);background:#fff;color:#0F0F10;border:1px solid #0F0F10;border-radius:12px;' +
		'font:15px/1.55 "IBM Plex Sans Arabic","Segoe UI",Tahoma,sans-serif;direction:rtl;text-align:right;padding:14px 14px 12px;display:none}' +
		'.card.on{display:block}' +
		'.top{display:flex;align-items:baseline;justify-content:space-between;gap:8px;direction:ltr}' +
		'.w{font:800 22px/1.2 Changa,"IBM Plex Sans Arabic",sans-serif;direction:ltr;text-align:left;word-break:break-word}' +
		'.lv{font:600 12px/1 "IBM Plex Sans Arabic",sans-serif;border:1px solid #0F0F10;border-radius:6px;padding:3px 6px;white-space:nowrap}' +
		'.lv.off{border-color:#E6E3DF;color:#8A8584}' +
		'.base{direction:ltr;text-align:left;color:#8A8584;font-size:13px;margin-top:2px}' +
		'.ar{font-size:17px;margin-top:8px}' +
		'.pos{color:#8A8584;font-size:12px;margin-inline-start:6px}' +
		'.row{display:block;margin-top:2px}' +
		'.alt{color:#8A8584;font-size:12.5px;margin-top:4px}' +
		'.ctx{margin-top:10px;padding-top:10px;border-top:1px solid #E6E3DF;font-size:14.5px}' +
		'.ctx b{font-weight:600}.ctx .muted{color:#8A8584}' +
		'.note{color:#4A4847;font-size:13.5px;margin-top:4px}' +
		'.btns{display:flex;gap:6px;flex-wrap:wrap;margin-top:12px}' +
		'button{font:600 13.5px/1 "IBM Plex Sans Arabic","Segoe UI",Tahoma,sans-serif;border:1px solid #E6E3DF;background:#fff;color:#0F0F10;border-radius:999px;padding:8px 12px;cursor:pointer}' +
		'button:hover{border-color:#0F0F10}' +
		'button.on{background:#0F0F10;border-color:#0F0F10;color:#fff}' +
		'button:disabled{opacity:.5;cursor:default}' +
		'.wide{width:100%;margin-top:8px;border-radius:10px;padding:10px}' +
		'.msg{font-size:13px;color:#8A8584;margin-top:8px}.msg.bad{color:#E3262B}' +
		'.spin{display:inline-block;width:12px;height:12px;border:2px solid #E6E3DF;border-top-color:#0F0F10;border-radius:50%;animation:s .8s linear infinite;vertical-align:-2px}' +
		'@keyframes s{to{transform:rotate(360deg)}}' +
		'.brand{margin-top:10px;font-size:11px;color:#8A8584;direction:ltr;text-align:left}';

	var host, root, el, cur = null, hideT = null, onState = null;

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
		var w = el.offsetWidth || 320, h = el.offsetHeight || 180;
		var x = Math.min(Math.max(8, rect.left + rect.width / 2 - w / 2), window.innerWidth - w - 8);
		var y = rect.top - h - 10;
		if (y < 8) y = rect.bottom + 10;
		el.style.left = x + 'px';
		el.style.top = Math.min(y, window.innerHeight - h - 8) + 'px';
	}

	function render() {
		var d = cur.data, u = U.esc;
		if (!d) {
			el.innerHTML = '<div class="w">' + u(cur.word) + '</div><div class="msg"><span class="spin"></span></div>';
			return;
		}
		var ar = d.entries.filter(function (e) { return e.ar; });
		var meaning = ar.length
			? ar.map(function (e) { return '<span class="row">' + u(e.ar) + '<span class="pos">' + u(posAr(e.pos)) + '</span></span>'; }).join('')
			: '<span class="row muted" style="color:#8A8584">ليست في القاموس. اضغط "معناها في الجملة".</span>';
		var known = d.status === 'known', learning = d.status === 'learning';
		var ctx = '';
		if (cur.ctx === 'loading') ctx = '<div class="ctx"><span class="spin"></span></div>';
		else if (cur.ctx && cur.ctx.error) ctx = '<div class="ctx"><div class="msg bad">' + u(cur.ctx.error) + '</div></div>';
		else if (cur.ctx) {
			ctx = '<div class="ctx"><div><b>في هذه الجملة:</b> ' + u(cur.ctx.meaning) + '</div>' +
				(cur.ctx.sentence ? '<div class="muted" style="margin-top:4px">' + u(cur.ctx.sentence) + '</div>' : '') +
				(cur.ctx.note ? '<div class="note">' + u(cur.ctx.note) + '</div>' : '') + '</div>';
		}
		el.innerHTML =
			'<div class="top"><div class="w">' + u(cur.word) + '</div><span class="lv' + (d.levelName ? '' : ' off') + '">' + (d.levelName || 'خارج القائمة') + '</span></div>' +
			(d.lemma && d.lemma !== String(cur.word).toLowerCase() ? '<div class="base">' + u(d.lemma) + '</div>' : '') +
			'<div class="ar">' + meaning + '</div>' +
			(d.alts && d.alts.length ? '<div class="alt">وقد تعني: ' + d.alts.map(function (a) { return '<span dir="ltr">' + u(a.lemma) + '</span>' + (a.ar ? ' (' + u(a.ar.split('،')[0]) + ')' : ''); }).join('، ') + '</div>' : '') + ctx +
			'<div class="btns">' +
			'<button data-a="known" class="' + (known ? 'on' : '') + '">' + (known ? '✓ ' : '') + 'أعرفها</button>' +
			'<button data-a="learning" class="' + (learning ? 'on' : '') + '">' + (learning ? '✓ ' : '') + 'أتعلّمها</button>' +
			(cur.sentence && !cur.ctx ? '<button data-a="explain">معناها في الجملة</button>' : '') +
			'</div>' +
			(cur.sentence ? '<button class="wide" data-a="save"' + (cur.saved ? ' disabled' : '') + '>' + (cur.saved ? 'تم حفظ الجملة ✓' : 'احفظ الجملة كبطاقة مراجعة') + '</button>' : '') +
			(cur.msg ? '<div class="msg' + (cur.bad ? ' bad' : '') + '">' + u(cur.msg) + '</div>' : '') +
			'<div class="brand">Language Lens · Sawa English</div>';
		place(cur.rect);
	}

	function posAr(p) {
		return { noun: 'اسم', verb: 'فعل', adjective: 'صفة', adverb: 'ظرف', preposition: 'حرف جر', pronoun: 'ضمير', determiner: 'أداة', conjunction: 'أداة ربط', interjection: 'تعجب', number: 'عدد' }[p] || '';
	}

	function onClick(e) {
		var b = e.target.closest('button');
		if (!b || !cur || !cur.data) return;
		var a = b.dataset.a, c = cur;
		if (a === 'known' || a === 'learning') {
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
			U.send('explain', { word: c.word, sentence: c.sentence }).then(function (r) {
				c.ctx = r;
				if (cur === c) render();
			}, function (err) {
				c.ctx = { error: U.errText(err) };
				if (cur === c) render();
			});
		} else if (a === 'save') {
			var d = Object.assign({ text: c.sentence, focus: c.word, focusLemma: c.data.lemma, ar: c.ctx && c.ctx.sentence ? c.ctx.sentence : '' }, c.source || {});
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
	 * o = { word, rect, sentence, source: {url,title,videoId,startMs,endMs}, onHide }
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
			c.data = { entries: [], status: 'new', lemma: o.word };
			c.msg = U.errText(err);
			c.bad = true;
			if (cur === c) render();
		});
	}

	function isOpen() {
		return !!cur;
	}

	document.addEventListener('keydown', function (e) {
		if (e.key === 'Escape' && cur) hide();
	});
	document.addEventListener('fullscreenchange', function () {
		if (host) (document.fullscreenElement || document.documentElement).appendChild(host);
	});

	window.LensCard = {
		show: show,
		hide: hide,
		hideSoon: hideSoon,
		isOpen: isOpen,
		onStateChange: function (fn) { onState = fn; },
		keepOpen: function () { clearTimeout(hideT); }
	};
})();
