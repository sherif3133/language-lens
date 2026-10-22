/* Language Lens on any website the learner switched it on for.
   Hover a word: the card. Select words: save a sentence, an expression or a grammar point.
   Words are colour-coded with the CSS Highlight API and a chip shows how much of the page you know.
   The page's own text is never rewritten, so sites like Reddit and Facebook keep working. */
(function () {
	'use strict';
	if (window.__sawaLensPage) return;
	window.__sawaLensPage = true;
	// On by default on every site; the learner can pause it for a site in the popup.
	var PAUSED = false;
	chrome.storage.local.get('pausedSites', function (o) { PAUSED = (o.pausedSites || []).indexOf(location.origin) >= 0; });
	var U = window.LensUI, Card = window.LensCard;
	var WORDCH = /[A-Za-z'’-]/, ARCH = /[\u0621-\u064A\u064B-\u0652\u0670\u0671-\u06D3\u0640]/;

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

	/**
	 * The parts of a page that aren't reading text: links, titles and headlines, buttons, menus, and short labels
	 * like "Like", "Reply", "7 comments" or a person's name above a comment. Skipped when "Skip links, titles and buttons" is on.
	 */
	var UI = 'a,h1,h2,h3,h4,h5,h6,button,label,nav,header,footer,aside,figcaption,summary,option,time,[role=button],[role=link],[role=menu],[role=menuitem],[role=tab],[role=navigation],[role=heading],[role=banner],[role=toolbar],[role=tooltip]';
	var skipUi = true, shortMemo = new WeakMap(), arOn = true;
	chrome.storage.local.get('arHover', function (o) { arOn = o.arHover !== false; });
	chrome.storage.local.get('skipUi', function (o) { skipUi = o.skipUi !== false; });
	function uiText(node) {
		if (!skipUi) return false;
		var el = node.nodeType === 1 ? node : node.parentElement;
		if (!el) return false;
		if (el.closest(UI)) return true;
		// The nearest block: real paragraphs are reading text; a tiny block without a sentence end is a label.
		var b = el.closest('p,li,blockquote,td,dd,dt,div,section,article,span');
		while (b && b.tagName === 'SPAN' && b.parentElement) b = b.parentElement.closest('p,li,blockquote,td,dd,dt,div,section,article,span');
		if (!b || /^(P|LI|BLOCKQUOTE)$/.test(b.tagName)) return false;
		var key = el === b ? b : el;
		if (shortMemo.has(key)) return shortMemo.get(key);
		var words = function (x) { return (x.textContent || '').trim().split(/\s+/).length; };
		var t = (b.textContent || '').trim(), label = t.length < 40 && words(b) <= 3 && !/[.!?…]$/.test(t);
		// A row of small bits ("Like · 16 · Reply · 7 comments"): each piece is a label.
		if (!label && el !== b) label = words(el) <= 3 && words(b) <= 8 && !/[.!?…,]/.test(t);
		shortMemo.set(key, label);
		return label;
	}

	function wordAt(x, y) {
		var c = caretAt(x, y);
		if (!c || !c.node || c.node.nodeType !== 3 || skip(c.node)) return null;
		var t = c.node.data, i = c.offset;
		// An Arabic word works too: it gets its English (see Card.showAr).
		var CH = (i < t.length && ARCH.test(t[i])) || (i > 0 && !WORDCH.test(t[i] || '') && ARCH.test(t[i - 1])) ? ARCH : WORDCH;
		if (i >= t.length || !CH.test(t[i])) {
			if (i > 0 && CH.test(t[i - 1])) i--;
			else return null;
		}
		var a = i, b = i;
		while (a > 0 && CH.test(t[a - 1])) a--;
		while (b < t.length && CH.test(t[b])) b++;
		var word = t.slice(a, b).replace(/^['’-]+|['’-]+$/g, '');
		var ar = CH === ARCH;
		if (ar ? word.replace(/[\u064B-\u0652\u0640]/g, '').length < 2 : !/[A-Za-z]{2,}/.test(word)) return null;
		var range = document.createRange();
		range.setStart(c.node, a);
		range.setEnd(c.node, b);
		var rect = range.getBoundingClientRect();
		// caretFromPoint snaps to the nearest text even in empty space: make sure we're really over it.
		if (x < rect.left - 2 || x > rect.right + 2 || y < rect.top - 2 || y > rect.bottom + 2) return null;
		return { word: word, rect: rect, node: c.node, start: a, ar: ar };
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

	/** A capitalised word in the middle of a sentence is a name (people, places, brands): no card for it. */
	function looksLikeName(node, start, word) {
		if (!/^[A-Z][a-z'’]/.test(word) || word === 'I' || /^I['’]/.test(word)) return false;
		var before = (node.data || '').slice(0, start).replace(/\s+$/, '');
		if (!before || /[.!?:"“(\[\-–—]$/.test(before)) return false; // start of a sentence or a line
		var ws = (node.data || '').match(/[A-Za-z'’]+/g) || [], caps = ws.filter(function (w) { return /^[A-Z]/.test(w); }).length;
		return !(ws.length >= 3 && caps / ws.length > 0.6); // headlines In Title Case are not names
	}

	var timer = null, lastKey = '', mode = 'hover';
	chrome.storage.local.get('hoverMode', function (o) { mode = o.hoverMode || 'hover'; });

	document.addEventListener('mousemove', function (e) {
		if (PAUSED || e.buttons) return;
		if (mode === 'select' || (mode === 'alt' && !e.altKey)) return; // select mode: meanings only when you select text
		if (Card.selectOpen()) return;
		clearTimeout(timer);
		var x = e.clientX, y = e.clientY;
		timer = setTimeout(function () {
			var hit = wordAt(x, y);
			if (hit && uiText(hit.node)) hit = null; // links, titles, buttons and labels: no pop-up
			if (!hit) {
				if (Card.isOpen()) Card.hideSoon(500);
				lastKey = '';
				return;
			}
			if (hit.ar) {
				if (!arOn) { if (Card.isOpen()) Card.hideSoon(300); lastKey = ''; return; }
				var akey = hit.word + '@' + Math.round(hit.rect.left) + ',' + Math.round(hit.rect.top);
				if (akey === lastKey && Card.isOpen()) return;
				lastKey = akey;
				Card.showAr({ word: hit.word, rect: hit.rect, sentence: sentenceAround(hit.node, hit.start), source: { url: location.href, title: document.title } });
				return;
			}
			if (looksLikeName(hit.node, hit.start, hit.word)) { if (Card.isOpen()) Card.hideSoon(300); lastKey = ''; return; } // names are not translated
			var key = hit.word + '@' + Math.round(hit.rect.left) + ',' + Math.round(hit.rect.top);
			if (key === lastKey && Card.isOpen()) return;
			lastKey = key;
			Card.show({ word: hit.word, grammar: focusLabel(hit.node, hit.start), rect: hit.rect, sentence: sentenceAround(hit.node, hit.start), source: { url: location.href, title: document.title } });
		}, mode === 'alt' ? 60 : 380);
	}, { passive: true });

	/* ------------------------------------------------------------ select → save */
	document.addEventListener('mouseup', function (e) {
		if (PAUSED) return;
		if (e.composedPath().some(function (n) { return n.tagName && /^SAWA-LENS/.test(n.tagName); })) return;
		setTimeout(function () {
			var sel = window.getSelection();
			var t = sel && !sel.isCollapsed ? sel.toString().replace(/\s+/g, ' ').trim() : '';
			if (arOn && t.length >= 2 && t.length <= 800 && (t.match(/[\u0621-\u064A]/g) || []).length > t.replace(/\s/g, '').length * 0.4 && !(sel.anchorNode && skip(sel.anchorNode))) {
				// Arabic selected: show it in English.
				clearTimeout(timer);
				var ra = sel.getRangeAt(0);
				Card.showAr({ word: t, selected: true, rect: ra.getBoundingClientRect(), sentence: t, source: { url: location.href, title: document.title } });
				return;
			}
			if (t.length < (mode === 'select' ? 2 : 3) || t.length > 600 || !/[A-Za-z]{2,}/.test(t) || (sel.anchorNode && skip(sel.anchorNode))) return;
			var r = sel.getRangeAt(0);
			clearTimeout(timer);
			// One word selected (or double-clicked): its word card. More words: the phrase / sentence card.
			if (/^[A-Za-z'’-]+$/.test(t)) { Card.show({ word: t, grammar: '', rect: r.getBoundingClientRect(), sentence: sentenceAround(r.startContainer, r.startOffset) || t, source: { url: location.href, title: document.title } }); return; }
			Card.select({ text: t, sentence: sentenceAround(r.startContainer, r.startOffset) || t, rect: r.getBoundingClientRect(), source: { url: location.href, title: document.title } });
		}, 10);
	});

	/* ------------------------------------------------------------ chip, panel, toast */
	var host = document.createElement('sawa-lens-page');
	var root = host.attachShadow({ mode: 'open' });
	root.innerHTML = '<style>' +
		':host{all:initial}*{box-sizing:border-box}' +
		'.chip{position:fixed;z-index:2147483645;left:16px;bottom:16px;display:none;font:600 13px/1 "IBM Plex Sans Arabic","Segoe UI",Tahoma,sans-serif;background:#0F0F10;color:#fff;border:1px solid rgba(255,255,255,.2);border-radius:999px;padding:9px 13px;cursor:pointer}.chip.on{display:block}' +
		'.chip b{font:800 14px/1 Changa,sans-serif;margin-inline-start:4px}.chip .x{opacity:.6;margin-inline-start:8px}' +
		'.chip .dot{display:inline-block;width:8px;height:8px;border-radius:50%;background:#fff;margin-inline-end:6px}.chip.hard .dot,.chip.too-hard .dot{background:#E3262B}' +
		'.panel{position:fixed;left:16px;bottom:60px;z-index:2147483645;width:300px;max-height:60vh;overflow:auto;background:#fff;color:#0F0F10;border:1px solid #0F0F10;border-radius:12px;' +
		'font:14px/1.55 "IBM Plex Sans Arabic","Segoe UI",Tahoma,sans-serif;text-align:left;padding:14px;display:none}.panel.on{display:block}' +
		'.panel h3{font:800 17px/1.3 Changa,sans-serif;margin:0 0 4px}.panel .sub{color:#8A8584;font-size:12.5px;margin-bottom:10px}' +
		'.legend{display:flex;flex-wrap:wrap;gap:8px;font-size:12px;color:#4A4847;margin-bottom:10px}.legend span{display:inline-flex;align-items:center;gap:4px}' +
		'.sw{display:inline-block;width:16px;height:9px}.sw.next{border-bottom:3px solid #15803D}.sw.hard{border-bottom:3px solid #E3262B}.sw.learning{background:#FDE68A}' +
		'.panel ul{list-style:none;margin:0;padding:0}.panel li{display:flex;justify-content:space-between;gap:8px;align-items:center;padding:7px 0;border-top:1px solid #E6E3DF}' +
		'.panel .en{font-weight:600}.panel .ar{color:#4A4847;font-size:13px;direction:rtl;text-align:left}' +
		'.panel .lv{font-size:11px;border:1px solid #E6E3DF;border-radius:5px;padding:1px 5px;margin-inline-start:6px}' +
		'.panel .k{font:600 12px/1 "IBM Plex Sans Arabic",sans-serif;border:1px solid #E6E3DF;background:#fff;border-radius:999px;padding:6px 9px;cursor:pointer}' +
		'.focus{display:flex;align-items:center;gap:8px;margin:0 0 8px;font-size:12.5px}.focus label{font-weight:600;color:#4A4847;white-space:nowrap}.fsel{flex:1;font:600 13px/1.2 "IBM Plex Sans Arabic",sans-serif;border:1px solid #E6E3DF;border-radius:8px;padding:6px 8px;background:#fff}' +
		'.fbar{background:#F5F3FF;border:1px solid #DDD6FE;border-radius:8px;padding:8px 10px;font-size:12.5px;color:#4A4847;margin-bottom:10px}.fbar b{color:#0F0F10}' +
		'.toast{position:fixed;left:50%;bottom:24px;transform:translateX(-50%);z-index:2147483645;font:600 14px/1.4 "IBM Plex Sans Arabic",sans-serif;background:#0F0F10;color:#fff;border-radius:10px;padding:9px 14px;display:none}.toast.on{display:block}' +
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
	var BAND = { easy: 'Easy', good: 'Good level', hard: 'Hard', 'too-hard': 'Too hard' };
	var grade = null, gradeT = null, hidden = false, colors = true, lastGrade = 0;
	var canHighlight = !!(window.CSS && CSS.highlights && window.Highlight);
	var focus = '', focusInfo = null, focusMap = new WeakMap();
	chrome.storage.local.get(['colorPages', 'focus'], function (o) { colors = o.colorPages !== false; focus = o.focus || ''; });

	if (canHighlight && !document.getElementById('sawa-lens-hl')) {
		var st = document.createElement('style');
		st.id = 'sawa-lens-hl';
		st.textContent =
			'::highlight(lens-next){background-color:rgba(34,197,94,.22)}' +
			'::highlight(lens-hard){background-color:rgba(249,115,22,.26)}' +
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
				if (!p || p.closest(SKIP) || p.closest('[aria-hidden="true"],nav,header,footer') || uiText(n)) return NodeFilter.FILTER_REJECT;
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
		if (PAUSED) { chip.classList.remove('on'); clearHighlights(); return; }
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
				chip.innerHTML = '<span class="dot"></span>You know <b>' + grade.percent + '%</b> · ' + BAND[grade.band] + '<span class="x" data-x="1">✕</span>';
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
		panel.innerHTML = '<h3>New words on this page</h3><div class="sub">You know ' + g.percent + '% of the words (your level: ' + U.LEVEL_NAMES[(g.level || 2) - 1] + ').</div>' +
			(focusList ? '<div class="focus"><label>Focus on</label><select class="fsel"><option value="">— none —</option>' + focusList.map(function (f) { return '<option value="' + f.key + '"' + (f.key === focus ? ' selected' : '') + '>' + u(f.name) + '</option>'; }).join('') + '</select></div>' +
				(focus && focusInfo ? '<div class="fbar"><b>' + u(focusInfo.name) + '</b> · ' + (focusInfo.count ? focusInfo.count + ' examples' : 'none on this page') + '<div>' + u(focusInfo.rule) + '</div></div>' : '') : '') +
			'<div class="legend"><span><i class="sw next"></i>Worth checking</span><span><i class="sw hard"></i>Above your level / rare</span><span><i class="sw learning"></i>Learning</span></div><ul>' +
			g.top.slice(0, 20).map(function (w) {
				return '<li><div><span class="en">' + u(w.lemma) + '</span>' + (w.level ? '<span class="lv">' + U.LEVEL_NAMES[w.level - 1] + '</span>' : '') + (w.ar ? '<div class="ar">' + u(w.ar) + '</div>' : '') + '</div><button class="k" data-l="' + u(w.lemma) + '">I know it</button></li>';
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
		if (ch.skipUi) { skipUi = ch.skipUi.newValue !== false; shortMemo = new WeakMap(); clearTimeout(gradeT); lastGrade = 0; gradeT = setTimeout(regrade, 600); }
		if (ch.arHover) arOn = ch.arHover.newValue !== false;
		if (ch.arEnglish) { arEnglish = ch.arEnglish.newValue === true; if (arEnglish) arScan(); else arClear(); }
		if (ch.hoverMode) mode = ch.hoverMode.newValue || 'hover';
		if (ch.focus) {
			focus = ch.focus.newValue || '';
			paintFocus(textNodes(mainEl()));
			if (focus && !hidden && !chip.classList.contains('on')) regrade();
		}
	});
	/* ------------------------------------------------------------ English under Arabic text (opt-in) */
	// Posts and comments written in Arabic get a small English line under them, so the page stays in English.
	var arEnglish = false, arDone = new WeakSet(), arQueue = [], arBusy = false, arCount = 0, arT = null, AR_MAX = 80;
	chrome.storage.local.get('arEnglish', function (o) { arEnglish = o.arEnglish === true; if (arEnglish) setTimeout(arScan, 1200); });
	var arSeen = new IntersectionObserver(function (es) {
		es.forEach(function (e) { if (e.isIntersecting) { arSeen.unobserve(e.target); arQueue.push(e.target); } });
		clearTimeout(arT); arT = setTimeout(arPump, 300);
	}, { rootMargin: '300px' });
	function arScan() {
		if (!arEnglish || PAUSED || !document.body) return;
		var tw = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
			acceptNode: function (n) {
				var p = n.parentElement;
				if (!p || (n.data.match(/[\u0621-\u064A]/g) || []).length < 6 || p.closest(SKIP) || p.closest('sawa-lens-en,[aria-hidden="true"]')) return NodeFilter.FILTER_REJECT;
				return NodeFilter.FILTER_ACCEPT;
			}
		});
		var n;
		while ((n = tw.nextNode()) && arCount < AR_MAX) {
			var b = blockOf(n);
			if (!b || b === document.body || arDone.has(b)) continue;
			var txt = (b.textContent || '').replace(/\s+/g, ' ').trim();
			var arN = (txt.match(/[\u0621-\u064A]/g) || []).length;
			if (txt.length > 700 || arN < txt.replace(/\s/g, '').length * 0.5) continue; // long mixed blocks: select them instead
			arDone.add(b); arCount++;
			arSeen.observe(b);
		}
	}
	function arPump() {
		if (arBusy || !arQueue.length || !arEnglish) return;
		arBusy = true;
		var batch = arQueue.splice(0, 10);
		U.send('toEnglishMany', { texts: batch.map(function (b) { return (b.textContent || '').replace(/\s+/g, ' ').trim(); }) }).then(function (r) {
			batch.forEach(function (b, i) {
				var en = r.english[i];
				if (!en || !b.isConnected) return;
				var x = document.createElement('sawa-lens-en');
				x.setAttribute('dir', 'ltr');
				x.style.cssText = 'display:block;margin:4px 0 2px;padding:4px 8px;border-left:3px solid #FDE68A;font-size:.92em;line-height:1.45;opacity:.9;text-align:left;unicode-bidi:isolate';
				x.textContent = en;
				b.appendChild(x);
			});
		}, function (err) { flash(U.errText(err)); arEnglish = false; }).then(function () { arBusy = false; if (arQueue.length) arPump(); });
	}
	function arClear() {
		document.querySelectorAll('sawa-lens-en').forEach(function (x) { x.remove(); });
		arDone = new WeakSet(); arQueue = []; arCount = 0;
	}

	/* ------------------------------------------------------------ words read today */
	var readSeen = new WeakSet(), readTimers = new WeakMap(), readSum = 0, readT = null;
	var readObs = new IntersectionObserver(function (es) {
		es.forEach(function (e) {
			var el = e.target;
			if (e.isIntersecting && e.intersectionRatio > 0.6) {
				readTimers.set(el, setTimeout(function () {
					if (document.hidden || readSeen.has(el)) return;
					readSeen.add(el); readObs.unobserve(el);
					readSum += ((el.textContent || '').match(/[A-Za-z]+(?:['’][a-z]+)?/g) || []).length;
					clearTimeout(readT); readT = setTimeout(readSend, 4000);
				}, 3000));
			} else clearTimeout(readTimers.get(el));
		});
	}, { threshold: [0, 0.6] });
	function readSend() { if (readSum && !PAUSED) U.send('addDaily', { read: readSum }).catch(function () {}); readSum = 0; }
	function readWatch() {
		if (PAUSED) return;
		var root = mainEl();
		root.querySelectorAll('p,li,blockquote,h1,h2,h3,dd,td').forEach(function (el) {
			if (readSeen.has(el) || el.closest(SKIP) || el.closest('nav,header,footer,aside')) return;
			var w = ((el.textContent || '').match(/[A-Za-z]+/g) || []).length;
			if (w >= 4 && w < 1500) readObs.observe(el);
		});
	}
	setTimeout(readWatch, 2000);
	window.addEventListener('pagehide', readSend);

	// Feeds and single-page sites change their text: re-grade after things settle.
	new MutationObserver(function (muts) {
		if (muts.every(function (m) { return m.target.closest && m.target.closest('sawa-lens-card,sawa-lens-page,sawa-lens-select,sawa-lens-en') || [].every.call(m.addedNodes, function (x) { return x.tagName === 'SAWA-LENS-EN'; }) && m.addedNodes.length; })) return;
		if (arEnglish) { clearTimeout(arScan.t); arScan.t = setTimeout(arScan, 1500); }
		clearTimeout(readWatch.t); readWatch.t = setTimeout(readWatch, 2000);
		clearTimeout(gradeT);
		gradeT = setTimeout(regrade, 2500);
	}).observe(document.body, { childList: true, subtree: true, characterData: true });
	setTimeout(regrade, 800);
})();
