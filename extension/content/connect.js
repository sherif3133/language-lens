/* Language Lens: finishes sign-in on phones and computers.
   sawaenglish.com sends the new device token back to its own "connected" page in the #fragment
   (never to the server); this hands it to the extension and clears it from the address bar.
   The page shows English first with an Arabic switch: say() fills its message (data-en / data-ar). */
(function () {
	'use strict';
	if (new URLSearchParams(location.search).get('sawa_lens') !== 'connected') return;
	var h = new URLSearchParams(location.hash.slice(1)), token = h.get('token') || '', state = h.get('state') || '';
	if (!token) return;
	history.replaceState(null, '', location.pathname + location.search);
	function say(ok, en, ar) {
		var el = document.getElementById('sawa-lens-status');
		if (!el) return;
		el.className = ok ? 'ok' : 'bad';
		el.textContent = '';
		var s = document.createElement('span');
		s.setAttribute('data-en', en);
		s.setAttribute('data-ar', ar || en);
		s.textContent = en;
		el.appendChild(s);
		document.dispatchEvent(new CustomEvent('sawa-lens-render'));
	}
	chrome.runtime.sendMessage({ type: 'loginTab', token: token, state: state }, function (res) {
		if (chrome.runtime.lastError || !res || !res.ok) {
			var err = (res && res.error) || 'Sign-in did not finish. Open Language Lens and press "Sign in" again.';
			return say(false, err, /^Sign-in/.test(err) ? 'لم يكتمل تسجيل الدخول. افتح Language Lens واضغط "Sign in" مرة أخرى.' : err);
		}
		say(true, '✓ Language Lens is connected. Go back to YouTube and tap any word.', '✓ تم ربط Language Lens. ارجع إلى يوتيوب واضغط على أي كلمة.');
	});
})();
