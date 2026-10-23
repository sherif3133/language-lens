/* Language Lens: finishes sign-in on phones.
   sawaenglish.com sends the new device token back to its own "connected" page in the #fragment
   (never to the server); this hands it to the extension and clears it from the address bar. */
(function () {
	'use strict';
	if (new URLSearchParams(location.search).get('sawa_lens') !== 'connected') return;
	var h = new URLSearchParams(location.hash.slice(1)), token = h.get('token') || '', state = h.get('state') || '';
	if (!token) return;
	history.replaceState(null, '', location.pathname + location.search);
	function say(ok, text) {
		var el = document.getElementById('sawa-lens-status');
		if (!el) return;
		el.className = ok ? 'ok' : 'bad';
		el.textContent = text;
	}
	chrome.runtime.sendMessage({ type: 'loginTab', token: token, state: state }, function (res) {
		if (chrome.runtime.lastError || !res || !res.ok) return say(false, (res && res.error) || 'Sign-in did not finish. Open Language Lens and press "Sign in" again.');
		if (res.data && res.data.testOpened) return say(true, '✓ Language Lens is connected. Next: the short level test (it opened in a new tab), so words you already know are not marked new. Then go back to YouTube and tap any word. · تم الربط! الخطوة التالية: اختبار المستوى القصير (فُتح في تبويب جديد)، ثم ارجع إلى يوتيوب واضغط على أي كلمة.');
		say(true, '✓ Language Lens is connected. Go back to YouTube and tap any word. · تم الربط! ارجع إلى يوتيوب واضغط على أي كلمة.');
	});
})();
