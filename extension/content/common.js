/* Language Lens: helpers shared by the YouTube and web-page scripts. */
(function () {
	'use strict';
	if (window.LensUI) return;

	function send(type, data) {
		return new Promise(function (resolve, reject) {
			try {
				chrome.runtime.sendMessage(Object.assign({ type: type }, data || {}), function (res) {
					if (chrome.runtime.lastError) return reject(new Error('reload'));
					if (!res) return reject(new Error('error'));
					return res.ok ? resolve(res.data) : reject(new Error(res.error));
				});
			} catch (e) {
				reject(new Error('reload')); // the extension was updated: the page needs a refresh
			}
		});
	}

	function esc(s) {
		return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
			return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
		});
	}

	var fontsDone = false;
	function fonts() {
		if (fontsDone) return;
		fontsDone = true;
		try {
			var l = document.createElement('link');
			l.rel = 'stylesheet';
			l.href = 'https://fonts.googleapis.com/css2?family=Changa:wght@600;800&family=IBM+Plex+Sans+Arabic:wght@400;600&display=swap';
			(document.head || document.documentElement).appendChild(l);
		} catch (e) {
			/* a strict page policy can block fonts; system fonts take over */
		}
	}

	/** The sentence around character `offset` in `text`. */
	function sentenceAt(text, offset) {
		if (window.Intl && Intl.Segmenter) {
			var seg = new Intl.Segmenter('en', { granularity: 'sentence' });
			var it = seg.segment(text)[Symbol.iterator](), r;
			while (!(r = it.next()).done) {
				var s = r.value;
				if (offset >= s.index && offset < s.index + s.segment.length) return s.segment.trim();
			}
		}
		var a = text.lastIndexOf('.', offset - 1), b = text.indexOf('.', offset);
		return text.slice(a + 1, b < 0 ? text.length : b + 1).trim();
	}

	var ERR = {
		signed_out: 'سجّل الدخول بحساب سوا انجليش من أيقونة Language Lens.',
		reload: 'تم تحديث Language Lens. حدّث الصفحة (F5).'
	};
	function errText(e) {
		var m = e && e.message;
		return ERR[m] || m || 'حدثت مشكلة. حاول مرة أخرى.';
	}

	var LEVEL_NAMES = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];

	window.LensUI = { send: send, esc: esc, fonts: fonts, sentenceAt: sentenceAt, errText: errText, LEVEL_NAMES: LEVEL_NAMES };
})();
