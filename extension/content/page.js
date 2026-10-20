/* Language Lens on any website the learner switched it on for.
   Hover a word: the card. Select a sentence: save it. A small chip shows how much of the page you know.
   The page's own text is never rewritten, so sites like Reddit and Facebook keep working. */
(function () {
	'use strict';
	if (window.__sawaLensPage) return;
	window.__sawaLensPage = true;
	var U = window.LensUI, Card = window.LensCard;
	var WORDCH = /[A-Za-z'’-]/;

	/* ------------------------------------------------------------ word under the mouse */
	function caretAt(x, y) {
		if (document.caretPositionFromPoint) {
			var p = document.caretPositionFromPoint(x, y);
			return p ? { node: p.offsetNode, offset: p.offset } : null;
		}
		var r = document.caretRangeFromPoint && document.caretRangeFromPoint(x, y);
		return r ? { node: r.startContainer, offset: r.startOffset } : null;
	}

	function skip(node) {
		var el = node.nodeType === 1 ? node : node.parentElement;
		if (!el) return true;
		if (el.closest('input,textarea,select,code,pre,[contenteditable=""],[contenteditable="true"],sawa-lens-card,sawa-lens-page,script,style')) return true;
		return false;
	}

	function wordAt(x, y) {
		var c = caretAt(x, y);
		if (!c || !c.node || c.node.nodeType !== 3 || skip(c.node)) return null;
		var t = c.node.data, i = c.offset;
		if (i >= t.length || !WORDCH.test(t[i])) {
			if (i > 0 && WORDCH.test(t[i - 1])) i--;
			else return null;
		}
		var a = i, b = i;
		while (a > 0 && WORDCH.test(t[a - 1])) a--;
		while (b < t.length && WORDCH.test(t[b])) b++;
		var word = t.slice(a, b).replace(/^['’-]+|['’-]+$/g, '');
		if (!/[A-Za-z]{2,}/.test(word)) return null;
		var range = document.createRange();
		range.setStart(c.node, a);
		range.setEnd(c.node, b);
		var rect = range.getBoundingClientRect();
		// caretFromPoint snaps to the nearest text even in empty space: make sure we're really over it.
		if (x < rect.left - 2 || x > rect.right + 2 || y < rect.top - 2 || y > rect.bottom + 2) return null;
		return { word: word, rect: rect, node: c.node, start: a };
	}

	/** The sentence around the word, taken from its block (paragraph, list item, post body…). */
	function sentenceFor(hit) {
		var block = hit.node.parentElement;
		while (block && block !== document.body && getComputedStyle(block).display.indexOf('inline') === 0) block = block.parentElement;
		if (!block) return '';
		var pre = document.createRange();
		try {
			pre.setStart(block, 0);
			pre.setEnd(hit.node, hit.start);
		} catch (e) {
			return '';
		}
		var before = pre.toString().length;
		var text = block.textContent || '';
		return U.sentenceAt(text, before).replace(/\s+/g, ' ').slice(0, 600);
	}

	var timer = null, lastKey = '', mode = 'hover';
	chrome.storage.local.get('hoverMode', function (o) { mode = o.hoverMode || 'hover'; });

	document.addEventListener('mousemove', function (e) {
		if (e.buttons) return;
		if (mode === 'alt' && !e.altKey) return;
		clearTimeout(timer);
		var x = e.clientX, y = e.clientY;
		timer = setTimeout(function () {
			var hit = wordAt(x, y);
			if (!hit) {
				if (Card.isOpen()) Card.hideSoon(500);
				lastKey = '';
				return;
			}
			var key = hit.word + '@' + Math.round(hit.rect.left) + ',' + Math.round(hit.rect.top);
			if (key === lastKey && Card.isOpen()) return;
			lastKey = key;
			Card.show({ word: hit.word, rect: hit.rect, sentence: sentenceFor(hit), source: { url: location.href, title: document.title } });
		}, mode === 'alt' ? 60 : 380);
	}, { passive: true });

	/* ------------------------------------------------------------ select text → save */
	var host = document.createElement('sawa-lens-page');
	var root = host.attachShadow({ mode: 'open' });
	root.innerHTML = '<style>' +
		':host{all:initial}*{box-sizing:border-box}' +
		'.save,.chip{position:fixed;z-index:2147483645;font:600 13px/1 "IBM Plex Sans Arabic","Segoe UI",Tahoma,sans-serif;background:#0F0F10;color:#fff;border:0;border-radius:999px;padding:9px 13px;cursor:pointer;direction:rtl}' +
		'.save{display:none}.save.on{display:block}' +
		'.chip{left:16px;bottom:16px;display:none;border:1px solid rgba(255,255,255,.2)}.chip.on{display:block}' +
		'.chip b{font:800 14px/1 Changa,sans-serif;margin-inline-start:4px}.chip .x{opacity:.6;margin-inline-start:8px}' +
		'.chip .dot{display:inline-block;width:8px;height:8px;border-radius:50%;background:#fff;margin-inline-end:6px}.chip.hard .dot,.chip.too-hard .dot{background:#E3262B}' +
		'.panel{position:fixed;left:16px;bottom:60px;z-index:2147483645;width:300px;max-height:60vh;overflow:auto;background:#fff;color:#0F0F10;border:1px solid #0F0F10;border-radius:12px;' +
		'font:14px/1.55 "IBM Plex Sans Arabic","Segoe UI",Tahoma,sans-serif;direction:rtl;text-align:right;padding:14px;display:none}.panel.on{display:block}' +
		'.panel h3{font:800 17px/1.3 Changa,sans-serif;margin:0 0 4px}.panel .sub{color:#8A8584;font-size:12.5px;margin-bottom:10px}' +
		'.panel ul{list-style:none;margin:0;padding:0}.panel li{display:flex;justify-content:space-between;gap:8px;align-items:center;padding:7px 0;border-top:1px solid #E6E3DF}' +
		'.panel .en{direction:ltr;font-weight:600}.panel .ar{color:#4A4847;font-size:13px}' +
		'.panel .lv{font-size:11px;border:1px solid #E6E3DF;border-radius:5px;padding:1px 5px;margin-inline-start:6px}' +
		'.panel .k{font:600 12px/1 "IBM Plex Sans Arabic",sans-serif;border:1px solid #E6E3DF;background:#fff;border-radius:999px;padding:6px 9px;cursor:pointer}' +
		'.toast{position:fixed;left:50%;bottom:24px;transform:translateX(-50%);z-index:2147483645;font:600 14px/1.4 "IBM Plex Sans Arabic",sans-serif;background:#0F0F10;color:#fff;border-radius:10px;padding:9px 14px;direction:rtl;display:none}.toast.on{display:block}' +
		'</style><button class="save">احفظ الجملة</button><button class="chip"></button><div class="panel"></div><div class="toast"></div>';
	document.documentElement.appendChild(host);
	var saveBtn = root.querySelector('.save'), chip = root.querySelector('.chip'), panel = root.querySelector('.panel'), toast = root.querySelector('.toast');
	var selText = '';

	function flash(t) {
		toast.textContent = t;
		toast.classList.add('on');
		clearTimeout(flash.t);
		flash.t = setTimeout(function () { toast.classList.remove('on'); }, 2600);
	}

	document.addEventListener('mouseup', function (e) {
		if (e.composedPath().indexOf(host) >= 0) return;
		setTimeout(function () {
			var sel = window.getSelection();
			var t = sel && !sel.isCollapsed ? sel.toString().replace(/\s+/g, ' ').trim() : '';
			if (t.length < 8 || t.length > 600 || !/[A-Za-z]{2,}/.test(t) || (sel.anchorNode && skip(sel.anchorNode))) {
				saveBtn.classList.remove('on');
				return;
			}
			selText = t;
			var r = sel.getRangeAt(0).getBoundingClientRect();
			saveBtn.style.left = Math.min(window.innerWidth - 140, Math.max(8, r.left + r.width / 2 - 55)) + 'px';
			saveBtn.style.top = Math.max(8, r.top - 44) + 'px';
			saveBtn.classList.add('on');
		}, 10);
	});
	document.addEventListener('scroll', function () { saveBtn.classList.remove('on'); }, { passive: true });

	saveBtn.addEventListener('click', function () {
		saveBtn.classList.remove('on');
		U.send('saveSentence', { text: selText, url: location.href, title: document.title }).then(function () {
			flash('تم حفظ الجملة في بطاقات المراجعة ✓');
		}, function (err) { flash(U.errText(err)); });
	});

	/* ------------------------------------------------------------ page grade */
	var BAND = { easy: 'سهل', good: 'مناسب', hard: 'صعب', 'too-hard': 'صعب جدًا' };
	var grade = null, gradeT = null, hidden = false;

	function mainText() {
		var el = document.querySelector('article') || document.querySelector('main') || document.querySelector('[role=main]') || document.body;
		return (el.innerText || '').slice(0, 60000);
	}

	var lastGrade = 0;
	function regrade() {
		if (hidden) return;
		// Busy feeds change all the time: grade at most every 15 seconds.
		var wait = 15000 - (Date.now() - lastGrade);
		if (lastGrade && wait > 0) {
			clearTimeout(gradeT);
			gradeT = setTimeout(regrade, wait);
			return;
		}
		lastGrade = Date.now();
		var text = mainText();
		var letters = (text.match(/[A-Za-z]/g) || []).length;
		if (text.length < 500 || letters / text.length < 0.5) {
			chip.classList.remove('on');
			return;
		}
		U.send('analyze', { texts: [text] }).then(function (r) {
			grade = r.grade;
			grade.level = r.level;
			chip.className = 'chip on ' + grade.band;
			chip.innerHTML = '<span class="dot"></span>تعرف <b dir="ltr">' + grade.percent + '%</b> · ' + BAND[grade.band] + '<span class="x" data-x="1">✕</span>';
			if (panel.classList.contains('on')) paint();
		}, function () {
			chip.classList.remove('on');
		});
	}

	function paint() {
		var u = U.esc, g = grade;
		panel.innerHTML = '<h3>كلمات جديدة في هذه الصفحة</h3><div class="sub">تعرف <bdi>' + g.percent + '%</bdi> من الكلمات (مستواك ' + U.LEVEL_NAMES[(g.level || 2) - 1] + ').</div><ul>' +
			g.top.slice(0, 20).map(function (w) {
				return '<li><div><span class="en">' + u(w.lemma) + '</span>' + (w.level ? '<span class="lv">' + U.LEVEL_NAMES[w.level - 1] + '</span>' : '') + (w.ar ? '<div class="ar">' + u(w.ar) + '</div>' : '') + '</div><button class="k" data-l="' + u(w.lemma) + '">أعرفها</button></li>';
			}).join('') + '</ul>';
	}

	chip.addEventListener('click', function (e) {
		if (e.target.dataset.x) {
			hidden = true;
			chip.classList.remove('on');
			panel.classList.remove('on');
			return;
		}
		panel.classList.toggle('on');
		if (panel.classList.contains('on') && grade) paint();
	});
	panel.addEventListener('click', function (e) {
		var b = e.target.closest('.k');
		if (!b) return;
		b.disabled = true;
		U.send('mark', { lemma: b.dataset.l, status: 'known' }).catch(function (err) { flash(U.errText(err)); });
	});

	chrome.storage.onChanged.addListener(function (ch) {
		if (ch.words || ch.level) {
			clearTimeout(gradeT);
			gradeT = setTimeout(regrade, 800);
		}
		if (ch.hoverMode) mode = ch.hoverMode.newValue || 'hover';
	});
	// Feeds and single-page sites change their text: re-grade after things settle.
	new MutationObserver(function () {
		clearTimeout(gradeT);
		gradeT = setTimeout(regrade, 2500);
	}).observe(document.body, { childList: true, subtree: true });
	setTimeout(regrade, 800);
})();
