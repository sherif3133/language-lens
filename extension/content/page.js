/* Language Lens on any website the learner switched it on for.
   Hover a word: the card. Select words: save a sentence, an expression or a grammar point.
   Words are colour-coded with the CSS Highlight API and a chip shows how much of the page you know.
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

	var SKIP = 'input,textarea,select,code,pre,[contenteditable=""],[contenteditable="true"],sawa-lens-card,sawa-lens-page,sawa-lens-select,script,style,noscript';
	function skip(node) {
		var el = node.nodeType === 1 ? node : node.parentElement;
		return !el || !!el.closest(SKIP);
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

	function blockOf(node) {
		var block = node.nodeType === 1 ? node : node.parentElement;
		while (block && block !== document.body && getComputedStyle(block).display.indexOf('inline') === 0) block = block.parentElement;
		return block;
	}

	/** The sentence around a position, taken from its block (paragraph, list item, post body…). */
	function sentenceAround(node, offset) {
		var block = blockOf(node);
		if (!block) return '';
		var pre = document.createRange();
		try {
			pre.setStart(block, 0);
			pre.setEnd(node, offset);
		} catch (e) {
			return '';
		}
		return U.sentenceAt(block.textContent || '', pre.toString().length).replace(/\s+/g, ' ').slice(0, 600);
	}

	var timer = null, lastKey = '', mode = 'hover';
	chrome.storage.local.get('hoverMode', function (o) { mode = o.hoverMode || 'hover'; });

	document.addEventListener('mousemove', function (e) {
		if (e.buttons) return;
		if (mode === 'alt' && !e.altKey) return;
		if (Card.selectOpen()) return;
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
			Card.show({ word: hit.word, grammar: focusLabel(hit.node, hit.start), rect: hit.rect, sentence: sentenceAround(hit.node, hit.start), source: { url: location.href, title: document.title } });
		}, mode === 'alt' ? 60 : 380);
	}, { passive: true });

	/* ------------------------------------------------------------ select → save */
	document.addEventListener('mouseup', function (e) {
		if (e.composedPath().some(function (n) { return n.tagName && /^SAWA-LENS/.test(n.tagName); })) return;
		setTimeout(function () {
			var sel = window.getSelection();
			var t = sel && !sel.isCollapsed ? sel.toString().replace(/\s+/g, ' ').trim() : '';
			if (t.length < 3 || t.length > 600 || !/[A-Za-z]{2,}/.test(t) || (sel.anchorNode && skip(sel.anchorNode))) return;
			var r = sel.getRangeAt(0);
			clearTimeout(timer);
			Card.select({ text: t, sentence: sentenceAround(r.startContainer, r.startOffset) || t, rect: r.getBoundingClientRect(), source: { url: location.href, title: document.title } });
		}, 10);
	});

	/* ------------------------------------------------------------ chip, panel, toast */
	var host = document.createElement('sawa-lens-page');
	var root = host.attachShadow({ mode: 'open' });
	root.innerHTML = '<style>' +
		':host{all:initial}*{box-sizing:border-box}' +
		'.chip{position:fixed;z-index:2147483645;left:16px;bottom:16px;display:none;font:600 13px/1 "IBM Plex Sans Arabic","Segoe UI",Tahoma,sans-serif;background:#0F0F10;color:#fff;border:1px solid rgba(255,255,255,.2);border-radius:999px;padding:9px 13px;cursor:pointer;direction:rtl}.chip.on{display:block}' +
		'.chip b{font:800 14px/1 Changa,sans-serif;margin-inline-start:4px}.chip .x{opacity:.6;margin-inline-start:8px}' +
		'.chip .dot{display:inline-block;width:8px;height:8px;border-radius:50%;background:#fff;margin-inline-end:6px}.chip.hard .dot,.chip.too-hard .dot{background:#E3262B}' +
		'.panel{position:fixed;left:16px;bottom:60px;z-index:2147483645;width:300px;max-height:60vh;overflow:auto;background:#fff;color:#0F0F10;border:1px solid #0F0F10;border-radius:12px;' +
		'font:14px/1.55 "IBM Plex Sans Arabic","Segoe UI",Tahoma,sans-serif;direction:rtl;text-align:right;padding:14px;display:none}.panel.on{display:block}' +
		'.panel h3{font:800 17px/1.3 Changa,sans-serif;margin:0 0 4px}.panel .sub{color:#8A8584;font-size:12.5px;margin-bottom:10px}' +
		'.legend{display:flex;flex-wrap:wrap;gap:8px;font-size:12px;color:#4A4847;margin-bottom:10px}.legend span{display:inline-flex;align-items:center;gap:4px}' +
		'.sw{display:inline-block;width:16px;height:9px}.sw.next{border-bottom:3px solid #15803D}.sw.hard{border-bottom:3px solid #E3262B}.sw.learning{background:#FDE68A}' +
		'.panel ul{list-style:none;margin:0;padding:0}.panel li{display:flex;justify-content:space-between;gap:8px;align-items:center;padding:7px 0;border-top:1px solid #E6E3DF}' +
		'.panel .en{direction:ltr;font-weight:600}.panel .ar{color:#4A4847;font-size:13px}' +
		'.panel .lv{font-size:11px;border:1px solid #E6E3DF;border-radius:5px;padding:1px 5px;margin-inline-start:6px}' +
		'.panel .k{font:600 12px/1 "IBM Plex Sans Arabic",sans-serif;border:1px solid #E6E3DF;background:#fff;border-radius:999px;padding:6px 9px;cursor:pointer}' +
		'.focus{display:flex;align-items:center;gap:8px;margin:0 0 8px;font-size:12.5px}.focus label{font-weight:600;color:#4A4847;white-space:nowrap}.fsel{flex:1;font:600 13px/1.2 "IBM Plex Sans Arabic",sans-serif;border:1px solid #E6E3DF;border-radius:8px;padding:6px 8px;background:#fff;direction:rtl}' +
		'.fbar{background:#F5F3FF;border:1px solid #DDD6FE;border-radius:8px;padding:8px 10px;font-size:12.5px;color:#4A4847;margin-bottom:10px}.fbar b{color:#0F0F10}' +
		'.toast{position:fixed;left:50%;bottom:24px;transform:translateX(-50%);z-index:2147483645;font:600 14px/1.4 "IBM Plex Sans Arabic",sans-serif;background:#0F0F10;color:#fff;border-radius:10px;padding:9px 14px;direction:rtl;display:none}.toast.on{display:block}' +
		'</style><button class="chip"></button><div class="panel"></div><div class="toast"></div>';
	document.documentElement.appendChild(host);
	var chip = root.querySelector('.chip'), panel = root.querySelector('.panel'), toast = root.querySelector('.toast');

	function flash(t) {
		toast.textContent = t;
		toast.classList.add('on');
		clearTimeout(flash.t);
		flash.t = setTimeout(function () { toast.classList.remove('on'); }, 2600);
	}

	/* ------------------------------------------------------------ colour coding + grade */
	var BAND = { easy: 'سهل', good: 'مناسب', hard: 'صعب', 'too-hard': 'صعب جدًا' };
	var grade = null, gradeT = null, hidden = false, colors = true, lastGrade = 0;
	var canHighlight = !!(window.CSS && CSS.highlights && window.Highlight);
	var focus = '', focusInfo = null, focusMap = new WeakMap();
	chrome.storage.local.get(['colorPages', 'focus'], function (o) { colors = o.colorPages !== false; focus = o.focus || ''; });

	if (canHighlight && !document.getElementById('sawa-lens-hl')) {
		var st = document.createElement('style');
		st.id = 'sawa-lens-hl';
		st.textContent =
			'::highlight(lens-next){text-decoration:underline 2px #15803D;text-underline-offset:3px}' +
			'::highlight(lens-hard){text-decoration:underline 2px #E3262B;text-underline-offset:3px}' +
			'::highlight(lens-learning){background-color:#FDE68A;color:#0F0F10}' +
			'::highlight(lens-focus){background-color:#EDE9FE;color:#0F0F10}';
		(document.head || document.documentElement).appendChild(st);
	}

	function mainEl() {
		return document.querySelector('article') || document.querySelector('main') || document.querySelector('[role=main]') || document.body;
	}

	/** Visible text nodes of the main content (capped so huge feeds stay fast). */
	function textNodes(el) {
		var out = [], total = 0;
		var tw = document.createTreeWalker(el, NodeFilter.SHOW_TEXT, {
			acceptNode: function (n) {
				if (!/[A-Za-z]{2,}/.test(n.data)) return NodeFilter.FILTER_REJECT;
				var p = n.parentElement;
				if (!p || p.closest(SKIP) || p.closest('[aria-hidden="true"],nav,header,footer')) return NodeFilter.FILTER_REJECT;
				return NodeFilter.FILTER_ACCEPT;
			}
		});
		var n;
		while ((n = tw.nextNode()) && out.length < 4000 && total < 120000) {
			out.push(n);
			total += n.data.length;
		}
		return out;
	}

	function regrade() {
		if (hidden && !colors) return;
		var wait = 12000 - (Date.now() - lastGrade);
		if (lastGrade && wait > 0) {
			clearTimeout(gradeT);
			gradeT = setTimeout(regrade, wait);
			return;
		}
		lastGrade = Date.now();
		var nodes = textNodes(mainEl());
		var text = nodes.map(function (n) { return n.data; }).join(' ');
		var letters = (text.match(/[A-Za-z]/g) || []).length;
		if (text.length < 300 || letters / text.length < 0.5) {
			chip.classList.remove('on');
			clearHighlights();
			return;
		}
		U.send('analyze', { texts: nodes.map(function (n) { return n.data; }) }).then(function (r) {
			grade = r.grade;
			grade.level = r.level;
			if (!hidden && text.length >= 500) {
				chip.className = 'chip on ' + grade.band;
				chip.innerHTML = '<span class="dot"></span>تعرف <b dir="ltr">' + grade.percent + '%</b> · ' + BAND[grade.band] + '<span class="x" data-x="1">✕</span>';
			}
			if (panel.classList.contains('on')) paint();
			paintHighlights(nodes, r.lines);
			paintFocus(nodes);
		}, function () {
			chip.classList.remove('on');
		});
	}

	function clearHighlights() {
		if (!canHighlight) return;
		['lens-next', 'lens-hard', 'lens-learning', 'lens-focus'].forEach(function (k) { CSS.highlights.delete(k); });
	}

	function paintHighlights(nodes, lines) {
		if (!canHighlight) return;
		clearHighlights();
		if (!colors) return;
		var sets = { next: [], hard: [], learning: [] };
		nodes.forEach(function (n, i) {
			(lines[i] || []).forEach(function (t) {
				if (!sets[t.status] || !n.isConnected) return;
				var r = document.createRange();
				try {
					r.setStart(n, t.start);
					r.setEnd(n, t.end);
					sets[t.status].push(r);
				} catch (e) {
					/* the text changed meanwhile */
				}
			});
		});
		Object.keys(sets).forEach(function (k) {
			if (sets[k].length) CSS.highlights.set('lens-' + k, new Highlight(...sets[k]));
		});
	}

	/** Grammar focus: highlight the chosen structure and remember spans for the hover card. */
	function paintFocus(nodes) {
		focusMap = new WeakMap();
		focusInfo = null;
		if (!canHighlight) return;
		CSS.highlights.delete('lens-focus');
		if (!focus) return;
		var f = focus;
		U.send('grammar', { texts: nodes.map(function (n) { return n.data; }), focus: f }).then(function (r) {
			if (f !== focus) return;
			var ranges = [];
			nodes.forEach(function (n, i) {
				var sp = r.spans[i] || [];
				if (!sp.length || !n.isConnected) return;
				focusMap.set(n, sp);
				sp.forEach(function (s) {
					var rg = document.createRange();
					try {
						rg.setStart(n, s.start);
						rg.setEnd(n, s.end);
						ranges.push(rg);
					} catch (e) {
						/* text changed */
					}
				});
			});
			focusInfo = { name: r.name, rule: r.rule, count: r.count };
			if (ranges.length) CSS.highlights.set('lens-focus', new Highlight(...ranges));
			if (panel.classList.contains('on') && grade) paint();
		}, function () {});
	}

	function focusLabel(node, offset) {
		var sp = focusMap.get(node);
		if (!sp) return '';
		for (var i = 0; i < sp.length; i++) if (offset >= sp[i].start && offset < sp[i].end) return sp[i].label;
		return '';
	}

	var focusList = null;
	U.send('focusList').then(function (fl) { focusList = fl; }, function () {});

	function paint() {
		var u = U.esc, g = grade;
		panel.innerHTML = '<h3>كلمات جديدة في هذه الصفحة</h3><div class="sub">تعرف <bdi>' + g.percent + '%</bdi> من الكلمات (مستواك ' + U.LEVEL_NAMES[(g.level || 2) - 1] + ').</div>' +
			(focusList ? '<div class="focus"><label>ركّز على</label><select class="fsel"><option value="">— بدون —</option>' + focusList.map(function (f) { return '<option value="' + f.key + '"' + (f.key === focus ? ' selected' : '') + '>' + u(f.name) + '</option>'; }).join('') + '</select></div>' +
				(focus && focusInfo ? '<div class="fbar"><b>' + u(focusInfo.name) + '</b> · ' + (focusInfo.count ? focusInfo.count + ' مثال' : 'لا توجد أمثلة') + '<div>' + u(focusInfo.rule) + '</div></div>' : '') : '') +
			'<div class="legend"><span><i class="sw next"></i>تستحق المراجعة</span><span><i class="sw hard"></i>فوق مستواك أو نادرة</span><span><i class="sw learning"></i>أتعلّمها</span></div><ul>' +
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
	panel.addEventListener('change', function (e) {
		if (e.target.classList.contains('fsel')) U.send('setPref', { key: 'focus', value: e.target.value }).catch(function () {});
	});
	panel.addEventListener('click', function (e) {
		var b = e.target.closest('.k');
		if (!b) return;
		b.disabled = true;
		U.send('mark', { lemma: b.dataset.l, status: 'known' }).catch(function (err) { flash(U.errText(err)); });
	});

	chrome.storage.onChanged.addListener(function (ch) {
		if (ch.colorPages) {
			colors = ch.colorPages.newValue !== false;
			lastGrade = 0;
		}
		if (ch.words || ch.level || ch.colorPages) {
			clearTimeout(gradeT);
			lastGrade = 0;
			gradeT = setTimeout(regrade, 600);
		}
		if (ch.hoverMode) mode = ch.hoverMode.newValue || 'hover';
		if (ch.focus) {
			focus = ch.focus.newValue || '';
			paintFocus(textNodes(mainEl()));
			if (focus && !hidden && !chip.classList.contains('on')) regrade();
		}
	});
	// Feeds and single-page sites change their text: re-grade after things settle.
	new MutationObserver(function (muts) {
		if (muts.every(function (m) { return m.target.closest && m.target.closest('sawa-lens-card,sawa-lens-page,sawa-lens-select'); })) return;
		clearTimeout(gradeT);
		gradeT = setTimeout(regrade, 2500);
	}).observe(document.body, { childList: true, subtree: true, characterData: true });
	setTimeout(regrade, 800);
})();
