/* Language Lens: short tips (English + Arabic) on every menu item and caption button.
   Menu rows get an "i" button (tap or click) and the tip opens under the row; caption buttons show it on hover (mouse),
   on press-and-hold (finger) and on keyboard focus. Never hover-only. Every tip has "Don't show this again": it hides that one
   tip for good; "Show tips" and "Bring back hidden tips" are in More options → Tips (popup too).
   Stored on this device: tipsOff (all tips off) and tipsHidden (list of tip ids). */
(function () {
	'use strict';
	var TIPS = {
		transcript: ['Show the full text of the video next to it.', 'اعرض النص الكامل للفيديو بجانبه.'],
		ctl: ['Show ◀ ⟲ ▶ ⏸ next to the caption. Off by default. The keys A S D Q always work.', 'أظهر أزرار ◀ ⟲ ▶ ⏸ بجانب الترجمة. مخفية افتراضيًا. تعمل مفاتيح A S D Q دائمًا.'],
		en: ['Show the English words on the screen.', 'اعرض الكلمات الإنجليزية على الشاشة.'],
		tr: ['Show the Arabic under each line.', 'اعرض الترجمة العربية تحت كل سطر.'],
		snd: ['Show how the words sound, in Arabic letters.', 'اعرض نطق الكلمات بالحروف العربية.'],
		ctlb: ['Show ◀ before the caption and ▶ after it. The keys A and D always work.', 'أظهر ◀ قبل الترجمة و▶ بعدها. مفتاحا A وD يعملان دائمًا.'],
		ctlr: ['Show a small line with Repeat, Loop and Auto-pause. Keys: S repeats, Q turns Auto-pause on or off.', 'أظهر سطرًا صغيرًا فيه إعادة وتكرار وإيقاف تلقائي. مفتاح S للإعادة وQ للإيقاف التلقائي.'],
		loop: ['Repeat this sentence again and again until you press it again.', 'كرّر هذه الجملة مرارًا حتى تضغط عليه مرة أخرى.'],
		pauseClick: ['Stop the video while you read the word card you opened with a click or tap.', 'أوقف الفيديو أثناء قراءة بطاقة الكلمة التي فتحتها بالنقر أو اللمس.'],
		pauseHover: ['Stop the video while you read the word card opened by hovering over a word.', 'أوقف الفيديو أثناء قراءة بطاقة الكلمة التي فتحتها بتمرير الماوس فوقها.'],
		openmode: ['Choose how a word card opens: with a click, or just by hovering.', 'اختر كيف تُفتح بطاقة الكلمة: بالنقر أو بتمرير الماوس فقط.'],
		more: ['Pause rules, word quiz and music tools.', 'قواعد الإيقاف واختبار الكلمات وأدوات الموسيقى.'],
		blurEn: ['Hide the English until you tap it. Good for testing yourself.', 'أخفِ النص الإنجليزي حتى تضغط عليه. مفيد لاختبار نفسك.'],
		blurTr: ['Hide the Arabic until you tap it.', 'أخفِ الترجمة العربية حتى تضغط عليها.'],
		colors: ['Colours show how well you know each word: yellow box = Learn (in your Review) · blue underline = new for you · dotted orange = hard or rare · pink double line = a phrase · no mark = Known or easy.', 'الألوان تبيّن مدى معرفتك بكل كلمة: مربع أصفر = تتعلّمها (في المراجعة) · خط أزرق = جديدة عليك · برتقالي منقّط = صعبة أو نادرة · وردي مزدوج = عبارة · بدون علامة = تعرفها أو سهلة.'],
		pauseOpen: ['Stop the video while you read a word card.', 'أوقف الفيديو أثناء قراءة بطاقة الكلمة.'],
		quiz: ['Now and then, a short question about a word you are learning.', 'من وقت لآخر، سؤال قصير عن كلمة تتعلّمها.'],
		vocals: ['Listen to songs without background music.', 'استمع إلى الأغاني بدون موسيقى الخلفية.'],
		game: ['Fill in the missing words while the song plays.', 'أكمل الكلمات الناقصة أثناء تشغيل الأغنية.'],
		vplist: ['Play a list of songs with the music turned down.', 'شغّل قائمة أغاني مع خفض صوت الموسيقى.'],
		prev: ['Go back one sentence (A)', 'ارجع جملة واحدة'],
		repeat: ['Play this sentence again (S)', 'أعد تشغيل هذه الجملة'],
		next: ['Go to the next sentence (D)', 'انتقل إلى الجملة التالية'],
		ap: ['Pause after every sentence (Q)', 'توقف بعد كل جملة'],
		save: ['Save this sentence to practise it later. It goes to your Review in the Sawa App.', 'احفظ هذه الجملة لتتمرّن عليها لاحقًا. تظهر في المراجعة داخل تطبيق سوا.']
	};
	var DN = ['Don’t show this again', 'لا تُظهر هذا مرة أخرى'];
	var st = { off: false, hidden: {}, seen: {} }, roots = [];

	function load() {
		chrome.storage.local.get(['tipsOff', 'tipsHidden', 'tipsSeen'], function (o) {
			st.off = !!o.tipsOff;
			st.hidden = {};
			(o.tipsHidden || []).forEach(function (k) { st.hidden[k] = 1; });
			st.seen = o.tipsSeen || {};
			roots.forEach(apply);
		});
	}
	try {
		chrome.storage.onChanged.addListener(function (ch, area) {
			if (area === 'local' && (ch.tipsOff || ch.tipsHidden)) load();
		});
	} catch (e) { /* not in an extension page */ }

	function hide(id) {
		st.hidden[id] = 1;
		chrome.storage.local.set({ tipsHidden: Object.keys(st.hidden) });
		roots.forEach(apply);
	}
	function apply(root) {
		root.querySelectorAll('[data-tip]').forEach(function (el) {
			var gone = st.off || st.hidden[el.dataset.tip];
			el.classList.toggle('tiphid', !!gone);
			if (gone) el.classList.remove('tipopen');
		});
		root.querySelectorAll('[data-a=tipreset]').forEach(function (b) { b.hidden = !!st.off || !Object.keys(st.hidden).length; }); // only when tips are on and one is hidden
		root.querySelectorAll('.tipbox').forEach(function (b) { b.classList.toggle('tiphid', !!(st.off || st.hidden[b.dataset.tipFor])); });
	}

	function box(id, floating) {
		var t = TIPS[id], d = document.createElement('div');
		d.className = floating ? 'tipbub' : 'tipbox';
		var a = document.createElement('span'); a.className = 'ta'; a.textContent = t[1]; a.dir = 'rtl';
		var n = document.createElement('button'); n.type = 'button'; n.className = 'tipdn';
		n.textContent = DN[0];
		var na = document.createElement('span'); na.className = 'ta'; na.textContent = DN[1]; na.dir = 'rtl';
		n.appendChild(na);
		n.addEventListener('click', function (e) { e.stopPropagation(); e.preventDefault(); hide(id); });
		d.appendChild(document.createTextNode(t[0])); d.appendChild(a); d.appendChild(n);
		return d;
	}

	/** root: a shadow root or element. Rows with data-tip="id" get a tip; data-tip-float rows (caption buttons) use a bubble. */
	function attach(root) {
		if (!root || roots.indexOf(root) < 0) roots.push(root);
		root.querySelectorAll('[data-tip]').forEach(function (el) {
			var id = el.dataset.tip;
			if (!TIPS[id] || el.dataset.tipDone) return;
			el.dataset.tipDone = '1';
			if (el.hasAttribute('data-tip-float')) {
				var b = box(id, true);
				el.appendChild(b);
				var tm;
				el.addEventListener('touchstart', function () { tm = setTimeout(function () { el.classList.add('tipopen'); }, 500); }, { passive: true });
				['touchend', 'touchmove', 'touchcancel'].forEach(function (ev) { el.addEventListener(ev, function () { clearTimeout(tm); }, { passive: true }); });
				el.addEventListener('contextmenu', function (e) { if (el.classList.contains('tipopen')) e.preventDefault(); });
				document.addEventListener('pointerdown', function (e) { if (!e.composedPath().includes(el)) el.classList.remove('tipopen'); }, true);
				return;
			}
			var i = document.createElement('button');
			i.type = 'button'; i.className = 'tipi'; i.textContent = 'i'; i.setAttribute('aria-label', 'What is this?');
			el.appendChild(i);
			var tb = box(id, false);
			el.insertAdjacentElement('afterend', tb);
			tb.dataset.tipFor = id;
			i.addEventListener('click', function (e) {
				e.stopPropagation(); e.preventDefault();
				tb.classList.toggle('on'); i.classList.toggle('on');
			});
		});
		apply(root);
	}

	/** First-time hint on one button: open its bubble for a few seconds, up to 3 times. */
	function hint(root, id) {
		var el = root.querySelector('[data-tip="' + id + '"]');
		if (!el || st.off || st.hidden[id] || (st.seen[id] || 0) >= 3) return;
		st.seen[id] = (st.seen[id] || 0) + 1;
		chrome.storage.local.set({ tipsSeen: st.seen });
		el.classList.add('tipopen');
		setTimeout(function () { el.classList.remove('tipopen'); }, 6000);
	}

	/** The tips' look, for a shadow root that uses it. */
	var CSS = '.tipi{all:unset;box-sizing:border-box;cursor:pointer;width:28px;height:28px;border-radius:50%;display:inline-flex;align-items:center;justify-content:center;flex:none;margin-left:6px;color:#9AA0A6;font:italic 700 14px Georgia,serif}.tipi:hover,.tipi.on{background:rgba(255,255,255,.16);color:#fff}' +
		'.tipbox{display:none;margin:0 0 4px 2px;padding:7px 10px;background:rgba(0,0,0,.35);border-left:3px solid #FDE68A;border-radius:6px;font-size:12px;line-height:1.4;color:#E6E3DF;text-align:left}.tipbox.on{display:block}' +
		'.tipbox .ta,.tipbub .ta{display:block;direction:rtl;color:#FDE68A;font-size:13px;margin-top:2px;text-align:right}' +
		'.tipdn{all:unset;cursor:pointer;display:block;min-height:34px;padding:4px 0;color:#7CC4FF;font-size:12px}.tipdn .ta{color:#7CC4FF;font-size:12px;margin:0}.tipdn:hover{text-decoration:underline}' +
		'.tipbub{position:absolute;bottom:calc(100% + 6px);left:50%;transform:translateX(-50%);display:none;width:max-content;max-width:230px;background:#0E1016;border:1px solid #FDE68A;border-radius:8px;padding:6px 10px;font:400 12px/1.4 "IBM Plex Sans","Segoe UI",system-ui,sans-serif;color:#fff;text-align:left;z-index:5;white-space:normal}' +
		'[data-tip-float]:hover>.tipbub,[data-tip-float]:focus-visible>.tipbub,[data-tip-float].tipopen>.tipbub{display:block}[data-tip-float].tiphid>.tipbub{display:none!important}' +
		'button[hidden]{display:none!important}.tipbox.tiphid,.tipi.tiphid,[data-tip].tiphid>.tipi{display:none!important}';

	load();
	window.LensTips = {
		attach: attach, hint: hint, css: CSS, tips: TIPS,
		reset: function () { st.hidden = {}; st.seen = {}; chrome.storage.local.set({ tipsHidden: [], tipsSeen: {} }); roots.forEach(apply); },
		hiddenCount: function () { return Object.keys(st.hidden).length; },
		setOff: function (v) { chrome.storage.local.set({ tipsOff: !!v }); }
	};
})();
