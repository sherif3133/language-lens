/* Language Lens proofreader: checks what the learner types in text boxes on any website.
   Spelling is checked at once with the built-in dictionary (red wavy line); grammar, word choice and tone are checked
   by Sawa English after a short pause (blue wavy line). Click or move the cursor into an underlined part to see the
   fix and a short reason, then Fix or Ignore. Works in textareas, text inputs and rich editors (contenteditable).
   Names (capitalised words) are never flagged. Switch it off in the popup. */
(function () {
	'use strict';
	if (window.__sawaLensProof) return;
	window.__sawaLensProof = true;

	var ON = true, field = null, state = null, tSpell = null, tGram = null;
	chrome.storage.local.get(['proofOn', 'pausedSites'], function (o) { ON = o.proofOn !== false && (o.pausedSites || []).indexOf(location.origin) < 0; });
	chrome.storage.onChanged.addListener(function (ch) { if (ch.proofOn) ON = ch.proofOn.newValue !== false; if (!ON) clearAll(); });

	function send(type, data) { return new Promise(function (ok, bad) { try { chrome.runtime.sendMessage(Object.assign({ type: type }, data || {}), function (r) { if (chrome.runtime.lastError || !r) return bad(new Error('offline')); r.ok ? ok(r.data) : bad(new Error(r.error)); }); } catch (e) { bad(e); } }); }

	function editable(el) {
		if (!el || el.nodeType !== 1) return null;
		if (el.tagName === 'TEXTAREA') return el;
		if (el.tagName === 'INPUT' && /^(text|search|email|url)?$/i.test(el.type || '') && !/email|url|search|user|name|code|pass/i.test(el.type + el.name + el.id + el.autocomplete)) return el;
		var ce = el.closest && el.closest('[contenteditable=""],[contenteditable="true"],[contenteditable="plaintext-only"]');
		return ce || null;
	}
	function isCE(el) { return el && el.tagName !== 'TEXTAREA' && el.tagName !== 'INPUT'; }
	function textOf(el) { return isCE(el) ? el.innerText : el.value; }
	function looksEnglish(t) { var ar = (t.match(/[؀-ۿ]/g) || []).length, all = (t.match(/[A-Za-z؀-ۿ]/g) || []).length; return all > 0 && ar / all < 0.3; }

	/* ------------------------------------------------------------ styles: highlights for rich editors, the overlay and the tip */
	var st = document.createElement('style');
	st.textContent = '::highlight(lens-spell){text-decoration:underline wavy #E3262B;text-decoration-thickness:1.5px;text-underline-offset:3px}::highlight(lens-gram){text-decoration:underline wavy #2563EB;text-decoration-thickness:1.5px;text-underline-offset:3px}';
	(document.head || document.documentElement).appendChild(st);
	var canHL = !!(window.CSS && CSS.highlights && window.Highlight);

	var host = document.createElement('sawa-lens-proof'), root = host.attachShadow({ mode: 'open' });
	root.innerHTML = '<style>:host{all:initial}.tip{position:fixed;z-index:2147483646;max-width:300px;background:#fff;color:#0F0F10;border:1px solid #E6E3DF;border-radius:12px;box-shadow:0 8px 24px rgba(0,0,0,.18);padding:10px 12px;font:14px/1.45 system-ui,-apple-system,"Segoe UI",sans-serif;display:none}.tip.on{display:block}.k{font:700 11px/1 system-ui;letter-spacing:.04em;text-transform:uppercase;margin-bottom:6px}.k.s{color:#E3262B}.k.g{color:#2563EB}.w{text-decoration:line-through;color:#8A8584}.r{font-weight:700}.why{color:#57534E;margin-top:4px}.ar{direction:rtl;color:#57534E;margin-top:2px}.b{display:flex;gap:6px;margin-top:8px}button{font:600 13px system-ui;border-radius:8px;padding:6px 10px;cursor:pointer;border:1px solid #E6E3DF;background:#fff}button.p{background:#0F0F10;color:#fff;border-color:#0F0F10}.pill{position:fixed;z-index:2147483645;font:600 12px system-ui;background:#0F0F10;color:#fff;border-radius:99px;padding:3px 9px;display:none;cursor:pointer}.pill.on{display:block}.lay{position:fixed;z-index:2147483640;pointer-events:none;overflow:hidden;color:transparent;white-space:pre-wrap;word-wrap:break-word}.lay .s{text-decoration:underline wavy #E3262B;text-decoration-thickness:1.5px;text-underline-offset:3px}.lay .g{text-decoration:underline wavy #2563EB;text-decoration-thickness:1.5px;text-underline-offset:3px}</style><div class="lay"></div><div class="tip"></div><div class="pill"></div>';
	(document.body || document.documentElement).appendChild(host);
	var lay = root.querySelector('.lay'), tip = root.querySelector('.tip'), pill = root.querySelector('.pill');

	/* ------------------------------------------------------------ checking */
	function schedule() {
		clearTimeout(tSpell); clearTimeout(tGram);
		if (!ON || !field) return;
		tSpell = setTimeout(function () { check(false); }, 700);
		tGram = setTimeout(function () { check(true); }, 2500);
	}
	function check(withGrammar) {
		var el = field; if (!el) return;
		var text = textOf(el);
		if (text.trim().length < 3 || !looksEnglish(text)) { clearMarks(); return; }
		send('proof', { text: text, grammar: withGrammar }).then(function (r) {
			if (el !== field || textOf(el) !== text) return; // the text changed meanwhile
			var marks = [];
			(r.spell || []).forEach(function (m) { marks.push({ start: m.start, end: m.end, kind: 's', wrong: m.wrong, right: m.right, why: m.right ? 'Spelling' : 'This word may be misspelled.' }); });
			var from = 0;
			(r.gram || []).forEach(function (e) {
				var i = text.indexOf(e.wrong, from); if (i < 0) i = text.indexOf(e.wrong); if (i < 0) return;
				if (marks.some(function (m) { return i < m.end && i + e.wrong.length > m.start; })) return;
				marks.push({ start: i, end: i + e.wrong.length, kind: 'g', wrong: e.wrong, right: e.right, why: e.why, ar: e.why_ar }); from = i + e.wrong.length;
			});
			if (!withGrammar && state && state.text === text) marks = marks.concat(state.marks.filter(function (m) { return m.kind === 'g'; }));
			marks.sort(function (a, b) { return a.start - b.start; });
			state = { el: el, text: text, marks: marks.filter(function (m) { return !ignored[m.wrong]; }) };
			paint();
		}, function () { /* signed out or offline: nothing */ });
	}
	var ignored = {};

	/* ------------------------------------------------------------ drawing */
	function clearMarks() { state = null; paint(); }
	function clearAll() { clearMarks(); hideTip(); }
	function paint() {
		if (canHL) { CSS.highlights.delete('lens-spell'); CSS.highlights.delete('lens-gram'); }
		lay.innerHTML = ''; lay.style.display = 'none';
		var n = state ? state.marks.length : 0;
		pill.classList.toggle('on', !!n);
		if (!n) return;
		pill.textContent = '🔎 ' + n + ' suggestion' + (n > 1 ? 's' : '');
		var el = state.el, b = el.getBoundingClientRect();
		pill.style.left = Math.max(4, b.right - 130) + 'px'; pill.style.top = Math.max(4, b.bottom - 26) + 'px';
		if (isCE(el)) { if (canHL) paintCE(el); }
		else paintOverlay(el);
	}
	/** Rich editors: CSS highlights on the real text. */
	function paintCE(el) {
		var walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT), nodes = [], node, pos = 0, full = el.innerText;
		while ((node = walker.nextNode())) nodes.push(node);
		var sets = { s: [], g: [] };
		state.marks.forEach(function (m) {
			var word = state.text.slice(m.start, m.end), seen = 0, occ = 0;
			for (var k = 0; k < m.start; k++) if (state.text.slice(k, k + word.length) === word) occ++;
			for (var i = 0; i < nodes.length; i++) {
				var d = nodes[i].data, j = -1;
				while ((j = d.indexOf(word, j + 1)) >= 0) {
					if (seen === occ) { var r = new Range(); r.setStart(nodes[i], j); r.setEnd(nodes[i], j + word.length); sets[m.kind].push(r); m.range = r; return; }
					seen++;
				}
			}
		});
		if (sets.s.length) CSS.highlights.set('lens-spell', new Highlight(...sets.s));
		if (sets.g.length) CSS.highlights.set('lens-gram', new Highlight(...sets.g));
	}
	/** Textareas and inputs: a see-through copy laid over the box, with the underlines. */
	function paintOverlay(el) {
		var cs = getComputedStyle(el), b = el.getBoundingClientRect();
		['font', 'letterSpacing', 'wordSpacing', 'lineHeight', 'paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft', 'borderTopWidth', 'borderRightWidth', 'borderBottomWidth', 'borderLeftWidth', 'textIndent', 'textAlign', 'direction', 'tabSize'].forEach(function (k) { lay.style[k] = cs[k]; });
		lay.style.borderStyle = 'solid'; lay.style.borderColor = 'transparent'; lay.style.boxSizing = 'border-box';
		lay.style.left = b.left + 'px'; lay.style.top = b.top + 'px'; lay.style.width = b.width + 'px'; lay.style.height = b.height + 'px';
		lay.style.whiteSpace = el.tagName === 'INPUT' ? 'pre' : 'pre-wrap';
		var t = state.text, html = '', at = 0, esc = function (s) { return s.replace(/[&<>]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]; }); };
		state.marks.forEach(function (m, i) { html += esc(t.slice(at, m.start)) + '<span class="' + m.kind + '" data-i="' + i + '">' + esc(t.slice(m.start, m.end)) + '</span>'; at = m.end; });
		lay.innerHTML = '<div>' + html + esc(t.slice(at)) + '​</div>';
		lay.firstChild.style.transform = 'translate(' + -el.scrollLeft + 'px,' + -el.scrollTop + 'px)';
		lay.style.display = 'block';
	}

	/* ------------------------------------------------------------ the tip: what is wrong, Fix, Ignore */
	function caretOffset(el) {
		if (!isCE(el)) return el.selectionStart;
		var s = window.getSelection(); if (!s.rangeCount || !el.contains(s.anchorNode)) return -1;
		var r = document.createRange(); r.selectNodeContents(el); r.setEnd(s.anchorNode, s.anchorOffset); return r.toString().length;
	}
	function markAtCaret() {
		if (!state || state.el !== field) return null;
		var o = caretOffset(field); if (o < 0) return null;
		for (var i = 0; i < state.marks.length; i++) if (o >= state.marks[i].start && o <= state.marks[i].end) return i;
		return null;
	}
	function rectOf(i) {
		var m = state.marks[i];
		if (m.range) return m.range.getBoundingClientRect();
		var sp = lay.querySelector('[data-i="' + i + '"]'); return sp ? sp.getBoundingClientRect() : field.getBoundingClientRect();
	}
	function showTip(i) {
		var m = state.marks[i], r = rectOf(i), e = function (s) { return String(s || '').replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); };
		tip.innerHTML = '<div class="k ' + m.kind + '">' + (m.kind === 's' ? 'Spelling' : 'Grammar') + '</div>'
			+ (m.right ? '<div><span class="w">' + e(m.wrong) + '</span> → <span class="r">' + e(m.right) + '</span></div>' : '<div>' + e(m.why) + '</div>')
			+ (m.kind === 'g' && m.why ? '<div class="why">' + e(m.why) + '</div>' + (m.ar ? '<div class="ar">' + e(m.ar) + '</div>' : '') : '')
			+ '<div class="b">' + (m.right ? '<button class="p" data-a="fix">Fix</button>' : '') + '<button data-a="ignore">Ignore</button></div>';
		tip.classList.add('on');
		var top = r.bottom + 6; if (top + 140 > innerHeight) top = r.top - 140;
		tip.style.left = Math.max(6, Math.min(innerWidth - 310, r.left)) + 'px'; tip.style.top = Math.max(6, top) + 'px';
		tip.querySelectorAll('[data-a]').forEach(function (b) {
			b.onmousedown = function (ev) { ev.preventDefault(); };
			b.onclick = function () { if (b.dataset.a === 'fix') fix(i); else { ignored[m.wrong] = 1; state.marks.splice(i, 1); paint(); } hideTip(); };
		});
	}
	function hideTip() { tip.classList.remove('on'); }
	function fix(i) {
		var m = state.marks[i], el = state.el;
		el.focus();
		if (isCE(el)) {
			if (!m.range) return;
			var s = window.getSelection(); s.removeAllRanges(); s.addRange(m.range);
		} else {
			el.setSelectionRange(m.start, m.end);
		}
		// insertText keeps undo working and tells the website's own editor about the change.
		if (!document.execCommand('insertText', false, m.right)) {
			if (!isCE(el)) { el.setRangeText(m.right, m.start, m.end, 'end'); el.dispatchEvent(new Event('input', { bubbles: true })); }
		}
		if (state && state.marks[i] === m) { state.marks.splice(i, 1); paint(); } // typing the fix may already have cleared the marks
		schedule();
	}

	/* ------------------------------------------------------------ events */
	document.addEventListener('focusin', function (e) { var el = editable(e.target); if (el !== field) { hideTip(); clearMarks(); } field = el; if (field && ON) schedule(); }, true);
	document.addEventListener('input', function (e) { var el = editable(e.target); if (!el) return; field = el; hideTip(); if (state && state.el === el && state.text !== textOf(el)) clearMarks(); schedule(); }, true);
	document.addEventListener('focusout', function (e) { if (editable(e.target) === field) setTimeout(function () { if (!root.activeElement && document.activeElement !== field) { hideTip(); clearMarks(); field = null; } }, 200); }, true);
	var showAtCaret = function () { setTimeout(function () { var i = markAtCaret(); if (i == null) hideTip(); else showTip(i); }, 0); };
	document.addEventListener('mouseup', function (e) { if (editable(e.target) && editable(e.target) === field) showAtCaret(); }, true);
	document.addEventListener('keyup', function (e) { if (/Arrow|Home|End/.test(e.key) && editable(e.target) === field) showAtCaret(); }, true);
	pill.onclick = function () { if (state && state.marks.length) { showTip(0); } };
	addEventListener('scroll', function () { if (state) paint(); hideTip(); }, true);
	addEventListener('resize', function () { if (state) paint(); });
})();
