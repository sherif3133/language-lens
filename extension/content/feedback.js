/* Language Lens: the "Send feedback" box. Used by the popup and by the word card (same form, same server note).
   LensFeedback.mount(el, { from, page, signedIn, lang, send, onClose }) fills el with the form. */
(function () {
	'use strict';
	if (window.LensFeedback) return;
	var T = {
		en: { title: '💬 Send feedback', bug: '🐞 Bug', idea: '💡 Idea', confusing: '😕 Confusing', like: '❤️ Like', ph: 'What happened, or what would you like?', page: 'Include this page\'s address', email: 'Your email (optional, so we can reply)', send: 'Send', sending: 'Sending…', cancel: 'Cancel', thanks: 'Thank you! Your feedback reached the Sawa English team.', few: 'Please write a few words.', fail: 'Could not send. Try again.' },
		ar: { title: '💬 ابعت رأيك', bug: '🐞 مشكلة', idea: '💡 فكرة', confusing: '😕 مش واضح', like: '❤️ عجبني', ph: 'إيه اللي حصل، أو إيه اللي نفسك فيه؟', page: 'ضيف عنوان الصفحة دي', email: 'إيميلك (اختياري، عشان نرد عليك)', send: 'ابعت', sending: 'بيتبعت…', cancel: 'إلغاء', thanks: 'شكراً! رأيك وصل لفريق سوا إنجليش.', few: 'اكتب كام كلمة من فضلك.', fail: 'ماقدرناش نبعت. جرّب تاني.' }
	};
	var TYPES = ['bug', 'idea', 'confusing', 'like'];
	var CSS = '.fb{font:14px/1.4 "IBM Plex Sans","IBM Plex Sans Arabic","Segoe UI",system-ui,sans-serif;color:#0F0F10;text-align:left}.fb.rtl{direction:rtl;text-align:right}.fb *{box-sizing:border-box}' +
		'.fb h3{margin:0 0 8px;font:700 15px/1.3 inherit}.fb .ty{display:grid;grid-template-columns:1fr 1fr;gap:6px}' +
		'.fb .ty button{border:1px solid #E6E3DF;background:#fff;color:#0F0F10;border-radius:10px;padding:10px 6px;min-height:44px;font:600 13.5px/1.2 inherit;cursor:pointer}.fb .ty button[aria-pressed=true]{background:#0F0F10;border-color:#0F0F10;color:#fff}' +
		'.fb textarea,.fb input[type=email]{display:block;width:100%;margin-top:8px;border:1px solid #E6E3DF;border-radius:10px;padding:10px;font:16px/1.4 inherit;color:#0F0F10;background:#fff}.fb textarea{min-height:84px;resize:vertical}' +
		'.fb label.ck{display:flex;gap:10px;align-items:center;margin-top:8px;font-size:13px;min-height:36px;cursor:pointer}.fb label.ck input{width:20px;height:20px;margin:0;flex:none}' +
		'.fb .go{display:flex;gap:8px;margin-top:10px}.fb .go button{flex:1;min-height:44px;border-radius:10px;border:1px solid #0F0F10;background:#0F0F10;color:#fff;font:600 14px/1 inherit;cursor:pointer}.fb .go button.ghost{background:#fff;color:#0F0F10;border-color:#E6E3DF;flex:0 0 auto;padding:0 14px}.fb .go button:disabled{opacity:.5}' +
		'.fb .st{margin-top:8px;font-size:13px;color:#4A4847}.fb .st.bad{color:#E3262B}';
	function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }

	function mount(el, o) {
		o = o || {};
		var t = T[o.lang === 'ar' ? 'ar' : 'en'], type = 'idea', page = /^https?:\/\//.test(o.page || '') ? String(o.page).split('#')[0] : '';
		el.innerHTML = '<style>' + CSS + '</style><div class="fb' + (o.lang === 'ar' ? ' rtl' : '') + '"><h3>' + t.title + '</h3>' +
			'<div class="ty" role="group">' + TYPES.map(function (k) { return '<button type="button" data-t="' + k + '" aria-pressed="' + (k === type) + '">' + t[k] + '</button>'; }).join('') + '</div>' +
			'<textarea maxlength="2000" placeholder="' + esc(t.ph) + '" dir="auto"></textarea>' +
			(page ? '<label class="ck"><input type="checkbox" class="pg"><span>' + t.page + '</span></label>' : '') +
			(o.signedIn ? '' : '<input type="email" class="em" placeholder="' + esc(t.email) + '" autocomplete="email">') +
			'<div class="go"><button type="button" class="send">' + t.send + '</button><button type="button" class="ghost cancel">' + t.cancel + '</button></div><div class="st" role="status"></div></div>';
		var q = function (s) { return el.querySelector(s); }, st = q('.st'), sendBtn = q('.send'), pg = q('.pg');
		function setType(k) { type = k; el.querySelectorAll('.ty button').forEach(function (b) { b.setAttribute('aria-pressed', String(b.dataset.t === k)); }); if (pg) pg.checked = k === 'bug'; }
		setType(type);
		el.querySelectorAll('.ty button').forEach(function (b) { b.addEventListener('click', function () { setType(b.dataset.t); }); });
		q('.cancel').addEventListener('click', function () { if (o.onClose) o.onClose(); });
		['keydown', 'keyup', 'keypress'].forEach(function (ev) { el.addEventListener(ev, function (e) { e.stopPropagation(); }); }); // page hotkeys must not eat typing
		sendBtn.addEventListener('click', function () {
			var text = q('textarea').value.trim();
			st.className = 'st';
			if (text.length < 3) { st.className = 'st bad'; st.textContent = t.few; return; }
			sendBtn.disabled = true; sendBtn.textContent = t.sending;
			o.send('feedback', { kind: type, text: text, page: pg && pg.checked ? page : '', email: q('.em') ? q('.em').value.trim() : '', from: o.from || '', lang: o.lang === 'ar' ? 'ar' : 'en' }).then(function () {
				el.querySelector('.fb').innerHTML = '<h3>' + t.thanks + '</h3><div class="go"><button type="button" class="done">OK</button></div>';
				q('.done').addEventListener('click', function () { if (o.onClose) o.onClose(); });
			}, function (err) {
				sendBtn.disabled = false; sendBtn.textContent = t.send;
				st.className = 'st bad'; st.textContent = err && err.message && err.message !== 'error' ? err.message : t.fail;
			});
		});
	}
	window.LensFeedback = { mount: mount };
})();
