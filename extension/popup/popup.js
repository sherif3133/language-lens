/* Language Lens popup: sign in, your level, today's progress, switch Lens on for this site. */
'use strict';
const $ = (s) => document.querySelector(s);
const LEVELS = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];
const LEVEL_HINT = ['مبتدئ', 'أساسي', 'متوسط', 'فوق المتوسط', 'متقدم', 'متمكن'];

function send(type, data) {
	return new Promise((resolve, reject) => {
		chrome.runtime.sendMessage(Object.assign({ type }, data || {}), (res) => {
			if (chrome.runtime.lastError || !res) return reject(new Error('error'));
			return res.ok ? resolve(res.data) : reject(new Error(res.error));
		});
	});
}
const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

async function currentTab() {
	const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
	return tab;
}

function signedOut(err) {
	$('#app').innerHTML = `
		<div class="pad">
			<h1>تعلّم الإنجليزية من كل ما تشاهده وتقرؤه.</h1>
			<p class="muted">معنى الكلمة بالعربية عند المرور عليها في يوتيوب وأي موقع، والكلمات التي تعرفها، وبطاقات مراجعة من جملك. متاح لأعضاء سوا انجليش.</p>
		</div>
		<div class="sec">
			<button class="btn" id="login">ادخل بحساب سوا انجليش</button>
			${err ? `<p class="err">${esc(err)}</p>` : ''}
		</div>`;
	$('#login').onclick = async () => {
		$('#login').disabled = true;
		$('#login').textContent = 'جارٍ الدخول…';
		try {
			await send('login');
			render();
		} catch (e) {
			signedOut(e.message && e.message !== 'error' ? e.message : 'لم يكتمل الدخول. حاول مرة أخرى.');
		}
	};
}

async function render() {
	let st;
	try {
		st = await send('state');
	} catch (e) {
		$('#app').innerHTML = '<div class="pad err">حدثت مشكلة. أغلق النافذة وافتحها مرة أخرى.</div>';
		return;
	}
	if (!st.signedIn) return signedOut();
	const tab = await currentTab();
	let origin = '';
	try {
		const u = new URL(tab.url);
		if (/^https?:$/.test(u.protocol)) origin = u.origin;
	} catch (e) {
		/* chrome:// pages etc. */
	}
	const isYT = origin === 'https://www.youtube.com';
	const p = st.progress || {};
	const todayWords = Math.max(st.local.words || 0, p.todayWords || 0);
	const todaySent = Math.max(st.local.sentences || 0, p.todaySentences || 0);
	const me = st.me || {};
	const enabled = st.sites.includes(origin);

	$('#app').innerHTML = `
		<div class="sec who" style="border-top:0">
			${me.avatar ? `<img src="${esc(me.avatar)}" alt="">` : ''}
			<div><b>أهلًا ${esc(me.firstName || me.name || '')}</b><div class="muted" style="font-size:12.5px">تقدّمك يظهر في متابعة سوا انجليش</div></div>
		</div>
		<div class="sec">
			<div class="label">اليوم</div>
			<div class="stats">
				<div><b>${todayWords}</b><span>كلمة تعلّمتها</span></div>
				<div><b>${todaySent}</b><span>جملة حفظتها</span></div>
				<div><b>${p.wordsKnown || 0}</b><span>كلمة تعرفها</span></div>
			</div>
		</div>
		<div class="sec">
			<div class="label">مستواك</div>
			<div class="levels">${LEVELS.map((l, i) => `<button data-l="${i + 1}" aria-pressed="${st.level === i + 1}">${l}</button>`).join('')}</div>
			<p class="hint">${esc(LEVEL_HINT[st.level - 1])}: الكلمات حتى هذا المستوى تُحسب معروفة، إلا إذا حددت غير ذلك.</p>
		</div>
		<div class="sec">
			${isYT ? `<div class="row"><div><b>يوتيوب</b><div class="muted" style="font-size:12.5px">مرّر على الكلمات في الترجمة. يتوقف الفيديو أثناء القراءة.</div></div>
				<label class="switch"><input type="checkbox" id="pause" ${st.pauseOnHover ? 'checked' : ''}><span></span></label></div>`
		: origin ? `<div class="row"><div style="min-width:0"><b>على هذا الموقع</b><div class="site">${esc(origin.replace(/^https?:\/\//, ''))}</div></div>
				<label class="switch"><input type="checkbox" id="site" ${enabled ? 'checked' : ''}><span></span></label></div>
				<p class="hint">${enabled ? 'مرّر على أي كلمة لترى معناها، وحدد جملة لحفظها.' : 'شغّله ليعمل Language Lens على هذا الموقع.'}</p>`
		: '<p class="muted">افتح يوتيوب أو أي موقع فيه نص إنجليزي.</p>'}
			<p class="err" id="err" hidden></p>
		</div>
		<div class="sec">
			<div class="label">المعنى</div>
			<div class="seg2"><button data-g="ar" aria-pressed="${st.glossLang !== 'en'}">بالعربية</button><button data-g="en" aria-pressed="${st.glossLang === 'en'}">English → English</button></div>
			<div class="row" style="margin-top:12px"><div><b>النص الكامل بجانب يوتيوب</b><div class="muted" style="font-size:12.5px">جمل كاملة بتوقيتها. اضغط على جملة لتشغيلها.</div></div>
				<label class="switch"><input type="checkbox" id="sidebar" ${st.sidebar !== false ? 'checked' : ''}><span></span></label></div>
			<div class="row" style="margin-top:12px"><div><b>تلوين الكلمات في المواقع</b><div class="muted" style="font-size:12.5px">على المواقع التي شغّلت عليها Language Lens.</div></div>
				<label class="switch"><input type="checkbox" id="colors" ${st.colorPages !== false ? 'checked' : ''}><span></span></label></div>
			<div class="legend"><span><i class="sw next"></i>تستحق المراجعة (المستوى التالي)</span><span><i class="sw hard"></i>فوق مستواك أو نادرة</span><span><i class="sw learning"></i>أتعلّمها</span></div>
		</div>
		<div class="sec links">
			<a href="${esc(me.tracker || 'https://sawaenglish.com/tracker/')}" target="_blank" rel="noopener">المتابعة والبطاقات</a>
			<button class="out" id="logout">خروج</button>
		</div>`;

	document.querySelectorAll('.levels button').forEach((b) => {
		b.onclick = async () => {
			await send('setLevel', { level: +b.dataset.l });
			render();
		};
	});
	document.querySelectorAll('.seg2 button').forEach((b) => {
		b.onclick = async () => {
			await send('setPref', { key: 'glossLang', value: b.dataset.g });
			render();
		};
	});
	$('#sidebar').onchange = (e) => send('setPref', { key: 'sidebar', value: e.target.checked });
	$('#colors').onchange = (e) => send('setPref', { key: 'colorPages', value: e.target.checked });
	const pause = $('#pause');
	if (pause) pause.onchange = () => send('setPause', { on: pause.checked });
	const site = $('#site');
	if (site) {
		site.onchange = async () => {
			try {
				if (site.checked) {
					const ok = await chrome.permissions.request({ origins: [origin + '/*'] });
					if (!ok) {
						site.checked = false;
						return;
					}
					await send('enableSite', { origin, tabId: tab.id });
				} else {
					await send('disableSite', { origin });
					chrome.tabs.reload(tab.id);
				}
				render();
			} catch (e) {
				const er = $('#err');
				er.hidden = false;
				er.textContent = 'تعذّر التشغيل على هذه الصفحة. حدّث الصفحة وحاول مرة أخرى.';
			}
		};
	}
	$('#logout').onclick = async () => {
		await send('logout');
		render();
	};
	send('sync').catch(() => {});
}

render();
