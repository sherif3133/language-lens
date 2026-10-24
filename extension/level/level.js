/* The quick vocabulary level (about 30 seconds, optional): tap the first row that has words you don't know.
   Everything above it counts as known. Sets the word colours and "You know about N% of the words". */
'use strict';
const $ = (s) => document.querySelector(s);
const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const T = {
	en: { h: 'How many English words do you know?', s: 'About 30 seconds. Tap the first row where some words are NEW to you.', start: "I'm just starting out", res: 'Your level', words: 'words', pick: 'Tap a row to see your level', kn: 'Show known words in green', set: 'Save my level', skip: 'Skip for now', later: 'Optional. You can change it any time from the Language Lens icon.', saved: 'Saved ✓ Your words are coloured for your level now. Go back to YouTube.', ex: 'How your words will look', err: 'Sign in from the Language Lens icon first.' },
	ar: { h: 'كم كلمة إنجليزية تعرف؟', s: 'حوالي ٣٠ ثانية. اضغط على أول صف فيه كلمات جديدة عليك.', start: 'أنا في البداية', res: 'مستواك', words: 'كلمة', pick: 'اضغط على صف لتعرف مستواك', kn: 'أظهر الكلمات المعروفة بالأخضر', set: 'احفظ مستواي', skip: 'تخطَّ الآن', later: 'اختياري. يمكنك تغييره في أي وقت من أيقونة Language Lens.', saved: 'تم الحفظ ✓ ستُلوَّن كلماتك حسب مستواك. ارجع إلى يوتيوب.', ex: 'كيف ستظهر كلماتك', err: 'سجّل الدخول من أيقونة Language Lens أولًا.' }
};
let L = 'en', data = null, sel = -1, showK = true, done = false;
try { L = localStorage.getItem('lensLevelLang') === 'ar' ? 'ar' : 'en'; } catch (e) { /* private window */ }

function send(type, d) {
	return new Promise((resolve, reject) => {
		chrome.runtime.sendMessage(Object.assign({ type }, d || {}), (res) => {
			if (chrome.runtime.lastError || !res) return reject(new Error('error'));
			return res.ok ? resolve(res.data) : reject(new Error(res.error));
		});
	});
}
const known = () => (sel <= 0 ? 0 : data.rows[sel - 1].from);
const levelOf = (n) => (n < 300 ? 'A1' : n < 1000 ? 'A2' : n < 3000 ? 'B1' : n < 5000 ? 'B2' : 'C1');

function render() {
	const t = T[L], n = data ? known() : 0;
	document.documentElement.lang = L;
	document.documentElement.dir = L === 'ar' ? 'rtl' : 'ltr';
	document.querySelectorAll('.lg button').forEach((b) => b.classList.toggle('on', b.dataset.l === L));
	if (!data) return;
	// row 0 = "just starting out", then the sample rows; a row is known when it is above the tapped one
	const rows = ['<button class="r start' + (sel === 0 ? ' edge' : '') + '" data-i="0"><span class="k">0</span><span class="ws">' + t.start + '</span></button>']
		.concat(data.rows.map((r, i) => '<button class="r' + (sel > i + 1 ? ' known' : '') + (sel === i + 1 ? ' edge' : '') + '" data-i="' + (i + 1) + '"><span class="k">' + r.from + '</span><span class="ws">' + r.words.map((w) => '<span>' + esc(w) + '</span>').join('') + '</span></button>')).join('');
	const est = sel < 0 ? t.pick : '<b>~' + n + '</b> ' + t.words + ' · ' + levelOf(n);
	const ex = data.example.map((e) => '<span class="' + (sel >= 0 && e.r <= n ? (showK ? 'kn' : '') : 'nw') + '">' + esc(e.w) + '</span>').join(' ');
	const foot = done
		? '<p class="muted" style="color:#15803D">' + t.saved + '</p>'
		: '<button class="btn wide" id="set"' + (sel < 0 ? ' disabled' : '') + '>' + t.set + '</button><button class="skip" id="skip">' + t.skip + '</button><p class="muted">' + t.later + '</p>';
	$('#app').innerHTML = '<div class="card q"><h1>' + t.h + '</h1><p class="sub">' + t.s + '</p><div class="rows">' + rows + '</div>' +
		'<div class="res">' + t.res + ': ' + est + '</div><p class="muted">' + t.ex + '</p><div class="ex" dir="ltr">' + ex + '</div>' +
		'<div class="tg' + (showK ? ' on' : '') + '" id="tk" role="switch" aria-checked="' + showK + '" tabindex="0"><i></i>' + t.kn + '</div>' + foot + '</div>';
	document.querySelectorAll('.r').forEach((b) => { b.onclick = () => { sel = +b.dataset.i; done = false; render(); }; });
	$('#tk').onclick = () => { showK = !showK; render(); };
	const set = $('#set');
	if (set) {
		set.onclick = async () => {
			set.disabled = true;
			try { await send('saveQuick', { known: n }); done = true; } catch (e) { set.disabled = false; alert(t.err); return; }
			render();
		};
	}
	const sk = $('#skip');
	if (sk) sk.onclick = () => { window.close(); setTimeout(() => { if (history.length > 1) history.back(); }, 200); };
}
document.querySelectorAll('.lg button').forEach((b) => { b.onclick = () => { L = b.dataset.l; try { localStorage.setItem('lensLevelLang', L); } catch (e) { /* ok */ } render(); }; });
send('quickRows').then((d) => { data = d; render(); }, () => { $('#app').innerHTML = '<div class="card">' + esc(T[L].err) + '</div>'; });
render();
