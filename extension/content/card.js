/* Language Lens: the word card and the selection popup.
   Card: meaning (Arabic or English), IPA + "sounds like", hard sounds, verb forms, level, listen,
   known/learning, meaning in this sentence, how the sentence sounds, save sentence.
   Selection popup: AI translation, how it sounds, save a sentence / expression / grammar point.
   Both live in shadow roots so page styles can't touch them. The interface is English;
   meanings can be Arabic or English. */
(function () {
	'use strict';
	if (window.LensCard) return;
	var U = window.LensUI;
	var TOUCH = !!(window.matchMedia && matchMedia('(hover: none)').matches);

	var FONT = '"IBM Plex Sans","IBM Plex Sans Arabic","Segoe UI",system-ui,sans-serif';
	var BASE = ':host{all:initial}*{box-sizing:border-box}' +
		'button{font:600 13px/1 ' + FONT + ';border:1px solid #E6E3DF;background:#fff;color:#0F0F10;border-radius:999px;padding:8px 12px;cursor:pointer}' +
		'button:hover{border-color:#0F0F10}button.on{background:#0F0F10;border-color:#0F0F10;color:#fff}button:disabled{opacity:.5;cursor:default}' +
		'.spin{display:inline-block;width:12px;height:12px;border:2px solid #E6E3DF;border-top-color:#0F0F10;border-radius:50%;animation:s .8s linear infinite;vertical-align:-2px}@keyframes s{to{transform:rotate(360deg)}}' +
		'.msg{font-size:13px;color:#8A8584;margin-top:8px}.msg.bad{color:#E3262B}' +
		'.ar-text{direction:rtl;text-align:right;font-family:"IBM Plex Sans Arabic",' + FONT + '}' +
		'.res{margin-top:10px;padding-top:10px;border-top:1px solid #E6E3DF;font-size:14px}.res b{font-weight:600}.res .muted{color:#4A4847}' +
		'.sl{font:600 15px/1.4 ' + FONT + ';letter-spacing:.2px}.notes{margin:6px 0 0;padding:0;list-style:none}.notes li{margin-top:6px;font-size:13px;color:#4A4847}.notes li b{color:#0F0F10}';
	// Phones: a sheet along the bottom of the screen, with bigger buttons for fingers (added last, so it wins).
	var SHEET = '@media (max-width:600px){.card,.pop{left:0!important;right:0;top:auto!important;bottom:0;width:100%;max-width:100%;max-height:65vh;border-radius:16px 16px 0 0;border-width:1px 0 0;box-shadow:0 -8px 30px rgba(0,0,0,.25);padding-bottom:calc(14px + env(safe-area-inset-bottom))}}' +
		'@media (pointer:coarse){button{padding:10px 14px;font-size:14px}}';

	var CSS = BASE +
		'.card{position:fixed;z-index:2147483646;width:340px;max-width:calc(100vw - 16px);max-height:calc(100vh - 16px);overflow:auto;background:#fff;color:#0F0F10;border:1px solid #0F0F10;border-radius:12px;' +
		'font:14.5px/1.5 ' + FONT + ';text-align:left;padding:14px 14px 12px;display:none}' +
		'.arw{font:700 20px/1.3 ' + FONT + ';direction:rtl}.arh{display:flex;align-items:center;justify-content:space-between;gap:8px}.arsub{font-size:12px;color:#8A8584;margin:2px 0 8px}.enrow{display:flex;align-items:center;gap:8px;padding:6px 0;border-top:1px solid #EFEDEA}.enrow:first-of-type{border-top:0}.enrow .ew{font:700 17px/1.2 ' + FONT + ';cursor:pointer;text-decoration:underline dotted #C9C5C2;text-underline-offset:3px}.enrow .ep{font-size:12px;color:#8A8584}.enrow .sp{flex:1}.enrow .lb{border:1px solid #0F0F10;background:#fff;border-radius:99px;padding:3px 10px;font:600 12px/1.2 ' + FONT + ';cursor:pointer}.enrow .lb.on{background:#FDE68A;border-color:#FDE68A}.ensent{margin-top:10px;padding:10px;border-radius:10px;background:#F6F5F3;font-size:15px;line-height:1.5}.ensent .lbl{font:700 11px/1 ' + FONT + ';letter-spacing:.06em;text-transform:uppercase;color:#8A8584;margin-bottom:6px}.arbtns{display:flex;gap:6px;flex-wrap:wrap;margin-top:10px}.arbtns button{border:1px solid #0F0F10;background:#fff;border-radius:99px;padding:5px 12px;font:600 13px/1.2 ' + FONT + ';cursor:pointer}.arbtns button.pri{background:#0F0F10;color:#fff}' +
		'.btns .cur{border-style:dashed}.btns .cur.on{background:#FEF3C7;border-color:#F59E0B;border-style:solid}' +
		'.card.on{display:block}.x{border:0;background:transparent;color:#8A8584;font:400 22px/1 Arial,sans-serif;padding:0 2px 2px 6px;cursor:pointer;flex:none}.x:hover{color:#0F0F10}' +
		'.top{display:flex;align-items:center;justify-content:space-between;gap:8px}' +
		'.wrow{display:flex;align-items:center;gap:6px;min-width:0}' +
		'.w{font:800 22px/1.2 Changa,' + FONT + ';word-break:break-word}' +
		'.say{border:0;background:transparent;padding:4px;border-radius:6px;line-height:0;color:#0F0F10;flex:none}.say:hover{background:#F6F5F3}.say svg{width:18px;height:18px;fill:none;stroke:currentColor;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round}' +
		'.meta{display:flex;align-items:center;gap:6px}' +
		'.lv{font:600 12px/1 ' + FONT + ';border:1px solid #0F0F10;border-radius:6px;padding:3px 6px;white-space:nowrap}.lv.off{border-color:#E6E3DF;color:#8A8584}' +
		'.lang{display:inline-flex;border:1px solid #E6E3DF;border-radius:999px;overflow:hidden}.lang button{border:0;border-radius:0;padding:4px 8px;font-size:12px}' +
		'.pr{margin-top:4px;display:flex;flex-wrap:wrap;gap:4px 12px;align-items:baseline;font-size:13.5px;color:#4A4847}.pr .ipa{font-family:"Charis SIL","Doulos SIL","Segoe UI",' + FONT + ';color:#0F0F10}.pr .slk b{color:#0F0F10;font-weight:600;letter-spacing:.3px}' +
		'.chips{display:flex;flex-wrap:wrap;gap:4px;margin-top:6px}.chip{font-size:11.5px;font-weight:600;border:1px solid #E6E3DF;border-radius:999px;padding:2px 8px;cursor:help;background:#FFFBEB;border-color:#FCD34D}' +
		'.tip{font-size:12.5px;color:#4A4847;margin-top:4px}' +
		'.base{color:#8A8584;font-size:13px;margin-top:2px}' +
		'.ar{font-size:17px;margin-top:8px}.en{font-size:14.5px;margin-top:8px}' +
		'.pos{color:#8A8584;font-size:12px;margin-inline:0 6px}.ar .pos{margin-inline:6px 0}.row{display:block;margin-top:2px}' +
		'.ex{margin-top:8px;font-size:13.5px;color:#4A4847;display:flex;gap:6px;align-items:flex-start}.ex i{font-style:italic}' +
		'.alt{color:#8A8584;font-size:12.5px;margin-top:4px}' +
		'.sent{display:flex;gap:6px;align-items:flex-start;margin-top:10px;padding-top:10px;border-top:1px solid #E6E3DF;font-size:13.5px;color:#4A4847}' +
		'.note{color:#4A4847;font-size:13px;margin-top:4px}' +
		'.btns{display:flex;gap:6px;flex-wrap:wrap;margin-top:12px}' +
		'.pics{margin-top:10px;border-radius:10px;overflow:hidden;background:#F3F1EE;min-height:60px;display:flex;align-items:center;justify-content:center}.pics a{display:block;width:100%}.pics img{width:100%;height:230px;object-fit:contain;display:block;background:#F3F1EE}.pics .muted{padding:14px;text-align:center;font-size:13px}' +
		'.pics-f{font-size:11px;color:#8A8584;margin-top:4px}.pics-f .lk{border:0;background:none;padding:0;font:inherit;font-size:12px;font-weight:600;text-decoration:underline;cursor:pointer;color:#0F0F10}.brand a{color:inherit}' +
		'.wide{width:100%;margin-top:8px;border-radius:10px;padding:10px}' +
		'.brand{margin-top:10px;font-size:11px;color:#8A8584}' +
		'.gram{display:inline-block;margin-top:8px;font-size:12.5px;font-weight:600;background:#EDE9FE;border:1px solid #A78BFA;border-radius:6px;padding:2px 8px}' +
		'.vf{margin-top:8px;padding:8px 10px;background:#F6F5F3;border-radius:8px}' +
		'.forms{display:flex;gap:6px;align-items:center;font:600 15px/1.3 ' + FONT + ';flex-wrap:wrap}.forms i{color:#8A8584;font-style:normal}' +
		'.vmeta{font-size:12px;color:#4A4847;margin-top:4px}.vmeta em{font-style:normal;font-weight:600}.vmeta em.irr{color:#B45309}' + SHEET;

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

	/** "How it sounds": AI respelling of fast natural speech + the connected-speech features behind it. */
	function soundHtml(r) {
		var u = U.esc;
		return '<div><b>Sounds like:</b> <span class="sl">' + u(r.soundsLike) + '</span></div>' +
			(r.ipa ? '<div class="muted" style="margin-top:2px">' + u(r.ipa) + '</div>' : '') +
			(r.features && r.features.length ? '<ul class="notes">' + r.features.map(function (f) { return '<li><b>' + u(f.where) + '</b> · ' + u(f.feature) + ': ' + u(f.why) + '</li>'; }).join('') + '</ul>' : '');
	}
	/** AI translation / explanation of a selected phrase. */
	function transHtml(r, lang) {
		var u = U.esc, cls = lang === 'ar' ? ' class="ar-text"' : '';
		return '<div' + cls + '><b>' + (lang === 'ar' ? 'المعنى:' : 'Meaning:') + '</b> ' + u(r.meaning) + '</div>' +
			(r.sentence ? '<div' + cls + ' style="margin-top:4px;color:#4A4847">' + u(r.sentence) + '</div>' : '') +
			(r.note ? '<div' + cls + ' style="margin-top:4px;font-size:13px;color:#4A4847">' + u(r.note) + '</div>' : '');
	}

	/* ------------------------------------------------------------ card */
	var host, root, el, cur = null, hideT = null, onState = null, lang = 'ar', showIPA = true;
	chrome.storage.local.get(['glossLang', 'showIPA'], function (o) {
		lang = o.glossLang === 'en' ? 'en' : 'ar';
		showIPA = o.showIPA !== false;
	});
	chrome.storage.onChanged.addListener(function (ch) {
		if (ch.glossLang) lang = ch.glossLang.newValue === 'en' ? 'en' : 'ar';
		if (ch.showIPA) showIPA = ch.showIPA.newValue !== false;
	});

	function ensure() {
		if (host && host.isConnected) return;
		U.fonts();
		host = document.createElement('sawa-lens-card');
		root = host.attachShadow({ mode: 'open' });
		root.innerHTML = '<style>' + CSS + '</style><div class="card" role="dialog" aria-label="Language Lens"></div>';
		el = root.querySelector('.card');
		(document.fullscreenElement || document.documentElement).appendChild(host);
		el.addEventListener('mouseenter', function () { clearTimeout(hideT); });
		if (!TOUCH) el.addEventListener('mouseleave', function () { hideSoon(); }); // phones close it with × or a tap elsewhere
		el.addEventListener('click', onClick);
	}

	function place(rect) {
		var w = el.offsetWidth || 340, h = el.offsetHeight || 200;
		var x = Math.min(Math.max(8, rect.left + rect.width / 2 - w / 2), window.innerWidth - w - 8);
		var y = rect.top - h - 10;
		if (y < 8) y = rect.bottom + 10;
		el.style.left = x + 'px';
		el.style.top = Math.max(8, Math.min(y, window.innerHeight - h - 8)) + 'px';
	}

	function posAr(p) {
		return { noun: 'اسم', verb: 'فعل', adjective: 'صفة', adverb: 'ظرف', preposition: 'حرف جر', pronoun: 'ضمير', determiner: 'أداة', conjunction: 'أداة ربط', interjection: 'تعجب', number: 'عدد' }[p] || '';
	}

	/** Pictures for the word: real photos first, an AI picture on request for abstract words. */
	function picsHtml(c) {
		var u = U.esc;
		if (!c.pics) return '';
		if (c.pics === 'loading') return '<div class="pics"><span class="spin"></span></div>';
		if (c.pics.error) return '<div class="msg bad">' + u(c.pics.error) + '</div>';
		// One big picture: the AI picture made for this word if there is one, else the photo (nouns only).
		var p = c.pics.images[0], big = c.pics.ai
			? '<a href="' + u(c.pics.ai) + '" target="_blank" rel="noopener" title="Picture made for this word"><img src="' + u(c.pics.ai) + '" alt=""></a>'
			: p ? '<a href="' + u(p.link) + '" target="_blank" rel="noopener" title="' + u(p.credit) + '"><img src="' + u(p.url || p.thumb) + '" alt=""></a>' : '';
		var inner = big || (c.pics.aiLoading ? '<span class="muted"><span class="spin"></span> Drawing a picture for this word… (about 15 seconds)</span>' : '<span class="muted">No picture for this word yet.</span>');
		return '<div class="pics">' + inner + '</div>'
			+ '<div class="pics-f">' + (c.pics.ai ? 'Picture made for this word' : p ? 'Photo: Wikipedia' : '') + (!c.pics.ai && p && c.pics.canAi && !c.pics.aiLoading ? ' · <button class="lk" data-a="aipic">Not right? Draw one</button>' : '') + '</div>';
	}

	function render() {
		var d = cur.data, u = U.esc;
		if (!d) {
			el.innerHTML = '<div class="top"><div class="w">' + u(cur.word) + '</div><button class="x" data-a="close" title="Close (Esc)" aria-label="Close">×</button></div><div class="msg"><span class="spin"></span></div>';
			return;
		}
		var meaning;
		if (lang === 'en') {
			var en = d.entries.filter(function (e) { return e.en; });
			meaning = '<div class="en">' + (en.length
				? en.map(function (e) { return '<span class="row"><span class="pos">' + u(e.pos) + '</span>' + u(e.en) + '</span>'; }).join('')
				: '<span class="row" style="color:#8A8584">No dictionary entry. Try "In this sentence".</span>') + '</div>';
			var ex = (en.filter(function (e) { return e.ex; })[0] || {}).ex;
			if (ex) meaning += '<div class="ex"><button class="say" data-a="say-ex" title="Listen">' + SPEAK + '</button><i>' + u(ex) + '</i></div>';
		} else {
			var ar = d.entries.filter(function (e) { return e.ar; });
			meaning = '<div class="ar ar-text">' + (ar.length
				? ar.map(function (e) { return '<span class="row">' + u(e.ar) + '<span class="pos">' + u(posAr(e.pos)) + '</span></span>'; }).join('')
				: '<span class="row" style="color:#8A8584">Not in the dictionary. Try "In this sentence".</span>') + '</div>' +
				(d.alts && d.alts.length ? '<div class="alt">Can also be: ' + d.alts.map(function (a) { return u(a.lemma) + (a.ar ? ' <span class="ar-text">(' + u(a.ar.split('،')[0]) + ')</span>' : ''); }).join(', ') + '</div>' : '');
		}
		var pr = '';
		if (d.pron && showIPA) {
			pr = '<div class="pr"><span class="ipa">' + u(d.pron.ipa) + '</span><span class="slk">sounds like <b>' + u(d.pron.soundsLike) + '</b></span></div>';
			if (d.pron.features.length) {
				pr += '<div class="chips">' + d.pron.features.map(function (f, i) { return '<span class="chip" data-a="tip" data-i="' + i + '" title="' + u(f.tip) + '">' + u(f.label) + '</span>'; }).join('') + '</div>' +
					(cur.tip != null && d.pron.features[cur.tip] ? '<div class="tip">' + u(d.pron.features[cur.tip].tip) + '</div>' : '');
			}
		}
		var ctx = '';
		if (cur.ctx === 'loading') ctx = '<div class="res"><span class="spin"></span></div>';
		else if (cur.ctx && cur.ctx.error) ctx = '<div class="res"><div class="msg bad">' + u(cur.ctx.error) + '</div></div>';
		else if (cur.ctx) {
			ctx = '<div class="res">' + (lang === 'ar'
				? '<div class="ar-text"><b>في هذه الجملة:</b> ' + u(cur.ctx.meaning) + '</div>' + (cur.ctx.sentence ? '<div class="ar-text muted" style="margin-top:4px">' + u(cur.ctx.sentence) + '</div>' : '') + (cur.ctx.note ? '<div class="ar-text note">' + u(cur.ctx.note) + '</div>' : '')
				: '<div><b>Here:</b> ' + u(cur.ctx.meaning) + '</div>' + (cur.ctx.sentence ? '<div class="muted" style="margin-top:4px">' + u(cur.ctx.sentence) + '</div>' : '') + (cur.ctx.note ? '<div class="note">' + u(cur.ctx.note) + '</div>' : '')) + '</div>';
		}
		var snd = '';
		if (cur.snd === 'loading') snd = '<div class="res"><span class="spin"></span></div>';
		else if (cur.snd && cur.snd.error) snd = '<div class="res"><div class="msg bad">' + u(cur.snd.error) + '</div></div>';
		else if (cur.snd) snd = '<div class="res">' + soundHtml(cur.snd) + '</div>';
		var known = d.status === 'known', learning = d.status === 'learning';
		var canReplay = !!(cur.onReplay && cur.source && cur.source.videoId);
		el.innerHTML =
			'<div class="top"><div class="wrow"><button class="say" data-a="say-word" title="Listen">' + SPEAK + '</button><div class="w">' + u(cur.word) + '</div></div>' +
			'<div class="meta"><span class="lv' + (d.levelName ? '' : ' off') + '">' + (d.levelName || 'rare') + '</span>' +
			'<span class="lang" title="Meaning in"><button data-a="lang-ar" class="' + (lang === 'ar' ? 'on' : '') + '">AR</button><button data-a="lang-en" class="' + (lang === 'en' ? 'on' : '') + '">EN</button></span><button class="x" data-a="close" title="Close (Esc)" aria-label="Close">×</button></div></div>' +
			pr +
			(d.lemma && d.lemma !== String(cur.word).toLowerCase() ? '<div class="base">from ' + u(d.lemma) + '</div>' : '') +
			(cur.grammar ? '<div class="gram">' + u(cur.grammar) + '</div>' : '') +
			(d.verb ? '<div class="vf"><div class="forms"><span>' + u(d.verb.base) + '</span><i>›</i><span>' + u(d.verb.past) + '</span><i>›</i><span>' + u(d.verb.pp) + '</span></div>' +
				'<div class="vmeta"><em class="' + (d.verb.irregular ? 'irr' : '') + '">' + (d.verb.irregular ? 'irregular' : 'regular') + '</em> · ' + u(d.verb.ing) + ' · he/she ' + u(d.verb.s) + '</div></div>' : '') +
			meaning + picsHtml(cur) + ctx +
			(cur.sentence ? '<div class="sent"><button class="say" data-a="say-sent" title="' + (canReplay ? 'Replay from the video' : 'Listen') + '">' + SPEAK + '</button><span>' + u(cur.sentence) + '</span></div>' : '') +
			snd +
			'<div class="btns">' +
			'<button data-a="known" class="' + (known ? 'on' : '') + '">' + (known ? '✓ ' : '') + 'I know it</button>' +
			'<button data-a="learning" class="' + (learning ? 'on' : '') + '">' + (learning ? '✓ ' : '') + 'Learning</button>' +
			(learning || d.mark === 'known' ? '' : '<button data-a="curious" class="cur' + (cur.curious ? ' on' : '') + '" title="You understood it: earn XP for being curious. It isn\'t added to your reviews.">' + (cur.curious ? '💡 ' + (cur.curious.xp ? '+' + cur.curious.xp + ' XP' : 'Curious ✓') : '💡 Curious') + '</button>') +
			'</div>' +
			(cur.msg ? '<div class="msg' + (cur.bad ? ' bad' : '') + '">' + u(cur.msg) + '</div>' : '') +
			'<div class="brand">' + (!cur.pics ? '<a href="#" data-a="pics">🖼 Picture</a> · ' : '') + '<a href="https://youglish.com/pronounce/' + encodeURIComponent((d.lemma || cur.word).toLowerCase()) + '/english" target="_blank" rel="noopener">Hear it in other videos ↗</a> · Language Lens · Sawa English</div>';
		place(cur.rect);
	}

	function onClick(e) {
		var b = e.target.closest('button,[data-a]');
		if (b && b.dataset.a === 'close') return hide();
		if (b && cur && cur.ar) return arClick(b);
		if (!b || !cur || !cur.data) return;
		if (b.tagName === 'A' && b.dataset.a) e.preventDefault();
		var a = b.dataset.a, c = cur;
		if (a === 'tip') {
			c.tip = c.tip === +b.dataset.i ? null : +b.dataset.i;
			render();
		} else if (a === 'say-word') speak(c.data.lemma && c.data.lemma.indexOf(' ') > 0 ? c.data.lemma : c.word, true);
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
		} else if (a === 'curious') {
			if (c.curious) return;
			c.curious = { xp: 0 };
			render();
			U.send('curious', { lemma: c.data.lemma || c.word }).then(function (r) {
				c.curious = r;
				c.msg = r.new ? '💡 Curious about ' + r.todayLocal + ' word' + (r.todayLocal === 1 ? '' : 's') + ' today' + (r.xp ? ' · +' + r.xp + ' XP' : '') : '💡 You were already curious about this word.';
				c.bad = false;
				if (cur === c) render();
			}, function (err) { c.curious = null; fail(c)(err); });
		} else if (a === 'known' || a === 'learning') {
			var next = c.data.mark === a ? '' : a;
			var src0 = c.source || {};
			U.send('mark', { lemma: c.data.lemma, status: next, ctx: c.sentence ? { sentence: c.sentence, url: src0.url || location.href, title: src0.title || document.title, videoId: src0.videoId || '', startMs: src0.startMs || 0 } : null }).then(function (st) {
				c.data.status = st;
				c.data.mark = next;
				c.msg = '';
				if (cur === c) render();
				if (onState) onState(c.data.lemma, st);
				// A top-5,000 word: show how close the learner is to the next vocabulary goal.
				if (next && c.data.rank && c.data.rank <= 5000) {
					U.send('goal').then(function (g) {
						c.msg = '#' + c.data.rank.toLocaleString('en-US') + ' most common word ' + (next === 'known' ? '✓' : '· learning') +
							' — goal: ' + g.have.toLocaleString('en-US') + ' / ' + g.goal.toLocaleString('en-US') + ' top words known';
						c.bad = false;
						if (cur === c) render();
					}, function () {});
				}
			}, fail(c));
		} else if (a === 'pics') {
			c.pics = 'loading';
			render();
			var pos = ((c.data.entries || [])[0] || {}).pos || '';
			U.send('images', { word: (c.data.lemma || c.word), pos: pos }).then(function (r) {
				c.pics = r;
				if (cur === c) render();
				// No photo fits (verbs, adjectives, ideas): draw one straight away.
				if (!r.ai && !r.images.length && r.canAi && cur === c) aiPic(c);
			}, function (err) { c.pics = { error: U.errText(err) }; if (cur === c) render(); });
		} else if (a === 'aipic') aiPic(c); else if (a === 'explain') {
			c.ctx = 'loading';
			render();
			U.send('explain', { word: c.word, sentence: c.sentence, lang: lang }).then(function (r) {
				c.ctx = r;
				if (cur === c) render();
			}, function (err) {
				c.ctx = { error: U.errText(err) };
				if (cur === c) render();
			});
		} else if (a === 'sound') {
			c.snd = 'loading';
			render();
			U.send('sound', { text: c.sentence }).then(function (r) {
				c.snd = r;
				if (cur === c) render();
			}, function (err) {
				c.snd = { error: U.errText(err) };
				if (cur === c) render();
			});
		} else if (a === 'save') {
			var d = Object.assign({ text: c.sentence, focus: c.word, focusLemma: c.data.lemma, ar: c.ctx && c.ctx.sentence && lang === 'ar' ? c.ctx.sentence : '' }, c.source || {});
			b.disabled = true;
			U.send('saveSentence', d).then(function () {
				c.saved = true;
				c.msg = 'You\'ll find it in your review cards.';
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

	/** Draw a picture for the word (made once, then shared by everyone). */
	function aiPic(c) {
		c.pics.aiLoading = true;
		render();
		U.send('aiImage', { word: (c.data.lemma || c.word), sentence: c.sentence || '' }).then(function (r) { c.pics.ai = r.url; c.pics.aiLoading = false; if (cur === c) render(); }, function (err) { c.pics.aiLoading = false; c.msg = U.errText(err); c.bad = true; if (cur === c) render(); });
	}

	/* ------------------------------------------------------------ Arabic → English card */
	/**
	 * An Arabic word on the page: its English words from the dictionary (instant), and the whole sentence
	 * in English on request (AI). o = { word, rect, sentence, source, selected }
	 * With o.selected (Arabic text the learner selected), the English translation comes straight away.
	 */
	function showAr(o) {
		ensure();
		clearTimeout(hideT);
		if (cur && cur.ar && cur.word === o.word && cur.sentence === o.sentence) return;
		if (cur && cur.onHide) cur.onHide();
		cur = Object.assign({ ar: true, hits: null, en: null, saved: false, msg: '' }, o);
		var c = cur;
		el.classList.add('on');
		renderAr();
		place(o.rect);
		if (o.selected) return toEn(c);
		U.send('arLookup', { word: o.word }).then(function (r) {
			c.hits = r.hits;
			if (cur !== c) return;
			renderAr();
			if (!r.hits.length) toEn(c); // not in the dictionary: ask the AI about it in its sentence
		}, function () { c.hits = []; if (cur === c) toEn(c); });
	}
	function toEn(c) {
		c.en = 'loading';
		renderAr();
		U.send('toEnglish', { text: c.selected ? c.word : (c.sentence || c.word), word: c.selected ? '' : c.word }).then(function (r) {
			c.en = r;
			if (cur === c) renderAr();
		}, function (err) { c.en = { error: U.errText(err) }; if (cur === c) renderAr(); });
	}
	function renderAr() {
		var c = cur, u = U.esc, X = '<button class="x" data-a="close" title="Close (Esc)" aria-label="Close">×</button>';
		var head = '<div class="arh"><div class="arw" dir="rtl">' + u(c.selected ? (c.word.length > 90 ? c.word.slice(0, 90) + '…' : c.word) : c.word) + '</div>' + X + '</div>'
			+ '<div class="arsub">' + (c.selected ? 'In English' : 'In English · click a word for its full card') + '</div>';
		var rows = '';
		if (!c.selected) {
			if (c.hits === null) rows = '<div class="msg"><span class="spin"></span></div>';
			else rows = c.hits.map(function (h, i) {
				return '<div class="enrow"><button class="say" data-a="ar-say" data-i="' + i + '" title="Listen">' + SPEAK + '</button><span class="ew" data-a="ar-open" data-i="' + i + '">' + u(h.lemma) + '</span><span class="ep">' + u(h.pos) + (h.level ? ' · ' + u(h.level) : '') + '</span><span class="sp"></span>'
					+ (h.status === 'known' ? '<span class="ep">✓ known</span>' : (h.status === 'learning' ? '' : '<button class="lb' + (h.cur ? ' on' : '') + '" data-a="ar-cur" data-i="' + i + '" title="Earn XP for being curious (not added to reviews)">' + (h.cur ? '💡 ✓' : '💡') + '</button> ') + '<button class="lb' + (h.status === 'learning' ? ' on' : '') + '" data-a="ar-learn" data-i="' + i + '">' + (h.status === 'learning' ? '★ Learning' : '+ Learning') + '</button>') + '</div>';
			}).join('');
			if (c.en && c.en.word && !c.hits.some(function (h) { return h.lemma === c.en.word.toLowerCase(); })) rows += '<div class="enrow"><button class="say" data-a="ar-say-ai" title="Listen">' + SPEAK + '</button><span class="ew" data-a="ar-open-ai">' + u(c.en.word) + '</span><span class="ep">' + u(c.en.pos || '') + ' · here</span></div>';
		}
		var sent = '';
		if (c.en === 'loading') sent = '<div class="ensent"><span class="spin"></span> Translating…</div>';
		else if (c.en && c.en.error) sent = '<div class="msg bad">' + u(c.en.error) + '</div>';
		else if (c.en && c.en.english) sent = '<div class="ensent"><div class="lbl">' + (c.selected ? 'English' : 'The sentence in English') + '</div><div dir="ltr">' + u(c.en.english) + '</div></div>';
		var btns = '<div class="arbtns">'
			+ (!c.en && c.sentence ? '<button class="pri" data-a="ar-sent">Sentence in English</button>' : '')
			+ (c.en && c.en.english ? '<button data-a="ar-listen">🔊 Listen</button>' + (c.saved ? '<button disabled>✓ Saved</button>' : '<button data-a="ar-save">Save to review</button>') : '')
			+ '</div>';
		el.innerHTML = head + rows + sent + btns + (c.msg ? '<div class="msg' + (c.bad ? ' bad' : '') + '">' + u(c.msg) + '</div>' : '')
			+ '<div class="brand">Arabic → English · Language Lens · Sawa English</div>';
	}
	function arClick(b) {
		var c = cur, a = b.dataset.a, h = c.hits && c.hits[+b.dataset.i];
		if (a === 'ar-say' && h) speak(h.lemma, true);
		else if (a === 'ar-say-ai' && c.en) speak(c.en.word, true);
		else if (a === 'ar-open' && h) { var r = el.getBoundingClientRect(); hide(); show({ word: h.lemma, rect: r, sentence: '', source: c.source }); }
		else if (a === 'ar-open-ai' && c.en) { var r2 = el.getBoundingClientRect(); hide(); show({ word: c.en.word.split(' ')[0], rect: r2, sentence: c.en.english || '', source: c.source }); }
		else if (a === 'ar-learn' && h && h.status !== 'learning') {
			h.status = 'learning';
			renderAr();
			U.send('mark', { lemma: h.lemma, status: 'learning' }).catch(function (err) { h.status = ''; c.msg = U.errText(err); c.bad = true; if (cur === c) renderAr(); });
		} else if (a === 'ar-cur' && h && !h.cur) {
			h.cur = true;
			renderAr();
			U.send('curious', { lemma: h.lemma }).then(function (r) { c.msg = r.xp ? '💡 +' + r.xp + ' XP for being curious' : '💡 Curious ✓'; c.bad = false; if (cur === c) renderAr(); }, function (err) { h.cur = false; c.msg = U.errText(err); c.bad = true; if (cur === c) renderAr(); });
		} else if (a === 'ar-sent') toEn(c);
		else if (a === 'ar-listen' && c.en) speak(c.en.english);
		else if (a === 'ar-save' && c.en) {
			b.disabled = true;
			// The English becomes a review card; the Arabic is its translation.
			U.send('saveSentence', Object.assign({ text: c.en.english, ar: c.selected ? c.word : c.sentence }, c.source || {})).then(function () {
				c.saved = true; c.msg = 'You\'ll find it in your review cards.'; c.bad = false;
				if (cur === c) renderAr();
			}, function (err) { c.msg = U.errText(err); c.bad = true; if (cur === c) renderAr(); });
		}
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
	 * o = { word, rect, sentence, grammar, source: {url,title,videoId,startMs,endMs}, onHide, onReplay(startMs, endMs) }
	 */
	function show(o) {
		ensure();
		clearTimeout(hideT);
		if (cur && cur.word === o.word && cur.sentence === o.sentence) return;
		if (cur && cur.onHide && cur.onHide !== o.onHide) cur.onHide();
		cur = Object.assign({ data: null, ctx: null, snd: null, tip: null, saved: false, msg: '' }, o);
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
		['conditional', 'Conditional (if)'], ['passive', 'Passive'], ['present-perfect', 'Present perfect'], ['past-perfect', 'Past perfect'],
		['continuous', 'Continuous'], ['future', 'Future'], ['modal', 'Modal verb'], ['relative', 'Relative clause'],
		['reported', 'Reported speech'], ['comparison', 'Comparison'], ['question', 'Question form'], ['other', 'Other']
	];
	var KINDS = [['phrasal', 'Phrasal verb'], ['idiom', 'Idiom'], ['collocation', 'Collocation'], ['phrase', 'Phrase']];
	var SCSS = BASE +
		'.pop{position:fixed;z-index:2147483646;width:330px;max-width:calc(100vw - 16px);max-height:calc(100vh - 16px);overflow:auto;background:#fff;color:#0F0F10;border:1px solid #0F0F10;border-radius:12px;font:14px/1.5 ' + FONT + ';text-align:left;padding:12px;display:none}' +
		'.pop.on{display:block}.sel{font-weight:600;margin:0 0 8px 0;padding-inline-end:24px;max-height:72px;overflow:auto}' +
		'.grid{display:flex;flex-wrap:wrap;gap:6px}.h{font-size:12px;color:#8A8584;margin:10px 0 6px}' +
		'.close{position:absolute;top:6px;right:6px;border:0;padding:4px 8px;font-size:16px;line-height:1;background:transparent}' + SHEET;
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
			body = '<div class="h">What kind of expression?</div><div class="grid">' + KINDS.map(function (k) { return '<button data-k="' + k[0] + '">' + k[1] + '</button>'; }).join('') + '</div>';
		} else if (c.mode === 'grammar') {
			body = '<div class="h">Which grammar point is in this sentence?</div><div class="grid">' + GRAMMAR.map(function (g) { return '<button data-g="' + g[0] + '">' + g[1] + '</button>'; }).join('') + '</div>';
		} else {
			body = '<div class="grid">' +
				'<button data-a="translate">' + (lang === 'ar' ? 'Translate (AR)' : 'Explain (EN)') + '</button>' +
				'<button data-a="sound">How it sounds</button>' +
				'<button data-a="say">Listen</button>' +
				'<button data-a="sentence">Save sentence</button>' +
				(words >= 2 && words <= 8 ? '<button data-a="expr">Save expression</button>' : '') +
				'<button data-a="grammar">Mark grammar</button></div>';
		}
		var res = '';
		if (c.res === 'loading') res = '<div class="res"><span class="spin"></span></div>';
		else if (c.res && c.res.error) res = '<div class="res"><div class="msg bad">' + u(c.res.error) + '</div></div>';
		else if (c.res && c.res.kind === 'sound') res = '<div class="res">' + soundHtml(c.res.data) + '</div>';
		else if (c.res && c.res.kind === 'trans') res = '<div class="res">' + transHtml(c.res.data, c.res.lang) + '</div>';
		sEl.innerHTML = '<button class="close" data-a="close" aria-label="Close">×</button><div class="sel">' + u(c.text.length > 160 ? c.text.slice(0, 160) + '…' : c.text) + '</div>' + body + res +
			(c.msg ? '<div class="msg' + (c.bad ? ' bad' : '') + '">' + u(c.msg) + '</div>' : '');
		var r = c.rect, w = 330, h = sEl.offsetHeight || 140;
		sEl.style.left = Math.min(Math.max(8, r.left + r.width / 2 - w / 2), window.innerWidth - w - 8) + 'px';
		var y = r.top - h - 10;
		sEl.style.top = Math.max(8, y < 8 ? Math.min(r.bottom + 10, window.innerHeight - h - 8) : y) + 'px';
	}

	function sClick(e) {
		var b = e.target.closest('button');
		if (!b || !sCur) return;
		var c = sCur;
		var done = function (msg) {
			c.msg = msg;
			c.bad = false;
			c.mode = '';
			sRender();
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
		if (b.dataset.a === 'translate') {
			var l = lang;
			c.res = 'loading';
			sRender();
			U.send('explain', { word: c.text, sentence: c.sentence || c.text, lang: l }).then(function (r) {
				c.res = { kind: 'trans', data: r, lang: l };
				if (sCur === c) sRender();
			}, function (err) {
				c.res = { error: U.errText(err) };
				if (sCur === c) sRender();
			});
			return;
		}
		if (b.dataset.a === 'sound') {
			c.res = 'loading';
			sRender();
			U.send('sound', { text: c.text }).then(function (r) {
				c.res = { kind: 'sound', data: r };
				if (sCur === c) sRender();
			}, function (err) {
				c.res = { error: U.errText(err) };
				if (sCur === c) sRender();
			});
			return;
		}
		if (b.dataset.a === 'sentence') {
			U.send('saveSentence', Object.assign({ text: c.sentence || c.text }, src)).then(function () { done('Sentence saved ✓'); }, failS);
		} else if (b.dataset.k) {
			U.send('saveExpression', Object.assign({ phrase: c.text, sentence: c.sentence, kind: 'phrase', tag: b.dataset.k }, src)).then(function () { done('Expression saved ✓ It will be highlighted wherever you meet it.'); }, failS);
		} else if (b.dataset.g) {
			U.send('saveSentence', Object.assign({ text: c.sentence || c.text, focus: c.text, kind: 'grammar', tag: b.dataset.g }, src)).then(function () { done('Sentence saved with its grammar point ✓'); }, failS);
		}
	}

	/** o = { text, sentence, rect, source, onReplay } */
	function selShow(o) {
		sEnsure();
		hide();
		sCur = Object.assign({ mode: '', msg: '', res: null }, o);
		sEl.classList.add('on');
		sRender();
	}
	function selHide() {
		if (sEl) sEl.classList.remove('on');
		sCur = null;
	}
	document.addEventListener('mousedown', function (e) {
		var path = e.composedPath();
		if (sCur && path.indexOf(sHost) < 0) selHide();
		if (cur && path.indexOf(host) < 0) hide(); // click away closes the word card
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
		showAr: showAr,
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
