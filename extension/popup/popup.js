/* Language Lens popup: sign in, vocabulary goal, today's progress, level, settings, this site. */
'use strict';
const $ = (s) => document.querySelector(s);
const LEVELS = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];
const LEVEL_HINT = ['Beginner', 'Elementary', 'Intermediate', 'Upper intermediate', 'Advanced', 'Proficient'];

function send(type, data) {
	return new Promise((resolve, reject) => {
		chrome.runtime.sendMessage(Object.assign({ type }, data || {}), (res) => {
			if (chrome.runtime.lastError || !res) return reject(new Error('error'));
			return res.ok ? resolve(res.data) : reject(new Error(res.error));
		});
	});
}
const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const n = (x) => Math.round(x).toLocaleString('en-US');

async function currentTab() {
	const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
	return tab;
}

function signedOut(err) {
	$('#app').innerHTML = `
		<div class="pad">
			<h1>Learn English from everything you watch and read.</h1>
			<p class="muted">Meanings on hover on YouTube and any website, IPA and "sounds like", your known words, grammar and pronunciation focus, and review cards from your own sentences. For Sawa English members.</p>
		</div>
		<div class="sec">
			<button class="btn" id="login">Sign in with Sawa English</button>
			${err ? `<p class="err">${esc(err)}</p>` : ''}
		</div>`;
	$('#login').onclick = async () => {
		$('#login').disabled = true;
		$('#login').textContent = 'Signing in…';
		try {
			await send('login');
			render();
		} catch (e) {
			signedOut(e.message && e.message !== 'error' ? e.message : 'Sign-in did not finish. Try again.');
		}
	};
}

function toggle(id, label, desc, on) {
	return `<div class="row"><div><div class="t">${label}</div>${desc ? `<div class="d">${desc}</div>` : ''}</div><label class="switch"><input type="checkbox" id="${id}" ${on ? 'checked' : ''}><span></span></label></div>`;
}

async function render() {
	let st, goal;
	try {
		st = await send('state');
	} catch (e) {
		$('#app').innerHTML = '<div class="pad err">Something went wrong. Close this and open it again.</div>';
		return;
	}
	if (!st.signedIn) return signedOut();
	try {
		goal = await send('goal');
	} catch (e) {
		goal = null;
	}
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
	const groups = {};
	(st.focusList || []).forEach((f) => { (groups[f.group] = groups[f.group] || []).push(f); });

	let goalHtml = '';
	if (goal) {
		const pk = Math.min(100, (goal.have / goal.goal) * 100), pl = Math.min(100 - pk, (goal.learning / goal.goal) * 100);
		goalHtml = `<div class="sec goal">
			<div class="label">Vocabulary goal</div>
			<div class="steps">${goal.steps.map((s) => `<span class="${s.done ? 'done' : s.goal === goal.goal ? 'cur' : ''}">top ${s.goal / 1000}k</span>`).join('')}</div>
			<div class="gl"><span>Top <b>${n(goal.goal)}</b> words</span><span><b>${n(goal.have)}</b> known${goal.learning ? ` · ${goal.learning} learning` : ''}</span></div>
			<div class="gbar"><i style="width:${pk}%"></i><i class="lr" style="left:${pk}%;width:${pl}%"></i></div>
			${goal.tested ? `<p class="hint">Test estimate: about <b>${n(goal.estimate)}</b> words. <a href="#" id="test">Retake the test</a></p>` : `<button class="btn" id="test">Take the 3-minute vocabulary test</button>`}
		</div>`;
	}

	$('#app').innerHTML = `
		<div class="sec who" style="border-top:0">
			${me.avatar ? `<img src="${esc(me.avatar)}" alt="">` : ''}
			<div><b>Hi ${esc(me.firstName || me.name || '')}</b><div class="muted" style="font-size:12.5px">Your progress shows in the Sawa English app</div></div>
		</div>
		${goalHtml}
		<div class="sec">
			<div class="label">Today</div>
			<div class="stats">
				<div><b>${todayWords}</b><span>words learned</span></div>
				<div><b>${todaySent}</b><span>sentences saved</span></div>
				<div><b>${n(p.wordsKnown || 0)}</b><span>words known</span></div>
			</div>
		</div>
		<div class="sec">
			<div class="label">Your level</div>
			<div class="levels">${LEVELS.map((l, i) => `<button data-l="${i + 1}" aria-pressed="${st.level === i + 1}">${l}</button>`).join('')}</div>
			<p class="hint">${esc(LEVEL_HINT[st.level - 1])}: words up to this level count as known unless you mark them.</p>
		</div>
		<div class="sec">
			${isYT ? toggle('pause', 'Pause when I hover a word', 'On YouTube captions.', st.pauseOnHover)
		: origin ? `<div class="row"><div style="min-width:0"><div class="t">On this site</div><div class="site">${esc(origin.replace(/^https?:\/\//, ''))}</div></div>
				<label class="switch"><input type="checkbox" id="site" ${enabled ? 'checked' : ''}><span></span></label></div>
				<p class="hint">${enabled ? 'Hover any word for its meaning. Select words to translate, hear or save them.' : 'Switch on to use Language Lens on this site.'}</p>`
		: '<p class="muted">Open YouTube or any page with English text.</p>'}
			<p class="err" id="err" hidden></p>
		</div>
		<div class="sec">
			<div class="label">Meanings</div>
			<div class="seg2"><button data-g="ar" aria-pressed="${st.glossLang !== 'en'}">Arabic</button><button data-g="en" aria-pressed="${st.glossLang === 'en'}">English → English</button></div>
			<div style="margin-top:12px">${toggle('showIPA', 'IPA and "sounds like"', 'Under each word, with sounds Arabic speakers find hard.', st.showIPA !== false)}</div>
		</div>
		<div class="sec">
			<div class="label">YouTube</div>
			${toggle('sidebar', 'Transcript next to the video', 'Full sentences with timestamps. Click one to play it.', st.sidebar !== false)}
			${toggle('showTrans', 'Arabic translation line', 'YouTube\'s auto-translation, under the captions.', st.showTrans !== false)}
			${toggle('blurCaptions', 'Blur captions until hover', 'Listen first, then check.', !!st.blurCaptions)}
			${toggle('blurTrans', 'Blur translation until hover', '', !!st.blurTrans)}
			${toggle('maskSwears', 'Mask swear words', 'Shows f*** in captions and the transcript. Each video still gets a content check.', !!st.maskSwears)}
			<p class="hint">Hotkeys: <kbd>A</kbd> previous · <kbd>S</kbd> repeat · <kbd>D</kbd> next · <kbd>Q</kbd> auto-pause. Drag the ⋮⋮ grip to move the captions.</p>
		</div>
		<div class="sec">
			<div class="label">Focus</div>
			<select id="focus" class="fsel"><option value="">— none —</option>${Object.keys(groups).map((g) => `<optgroup label="${g}">${groups[g].map((f) => `<option value="${f.key}" ${st.focus === f.key ? 'selected' : ''}>${esc(f.name)}</option>`).join('')}</optgroup>`).join('')}</select>
			<p class="hint">Highlights a grammar point or a sound everywhere, so you notice it.</p>
			<div style="margin-top:12px">${toggle('colors', 'Colour words on websites', 'On sites where Language Lens is on.', st.colorPages !== false)}</div>
			<div class="legend"><span><i class="sw next"></i>Worth checking (your next level)</span><span><i class="sw hard"></i>Above your level, or rare</span><span><i class="sw learning"></i>Learning</span></div>
		</div>
		<div class="sec links">
			<a href="${esc(me.app || 'https://sawaenglish.com/app/')}" target="_blank" rel="noopener">Open the Sawa English app</a>
				<a href="https://sawaenglish.com/guide/" target="_blank" rel="noopener">Guide</a>
			<button class="out" id="logout">Sign out</button>
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
	const pref = (id, key) => { const el = $('#' + id); if (el) el.onchange = () => send('setPref', { key, value: el.checked }); };
	pref('showIPA', 'showIPA');
	pref('sidebar', 'sidebar');
	pref('showTrans', 'showTrans');
	pref('blurCaptions', 'blurCaptions');
	pref('blurTrans', 'blurTrans');
	pref('maskSwears', 'maskSwears');
	pref('colors', 'colorPages');
	pref('pause', 'pauseOnHover');
	$('#focus').onchange = (e) => send('setPref', { key: 'focus', value: e.target.value });
	const test = $('#test');
	if (test) test.onclick = (e) => { e.preventDefault(); send('openTest').then(() => window.close()); };
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
				er.textContent = 'Could not switch on for this page. Refresh it and try again.';
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
