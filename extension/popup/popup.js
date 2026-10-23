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

/** The "Send feedback" box replaces the popup page; Cancel or OK goes back. */
async function openFeedback(signedIn) {
	const tab = await currentTab().catch(() => null);
	const lang = await send('uiLang').catch(() => 'en');
	$('#app').innerHTML = '<div class="pad" id="fbbox"></div>';
	LensFeedback.mount($('#fbbox'), { from: 'popup', page: tab && tab.url, signedIn, lang, send, onClose: render });
}

function signedOut(err) {
	$('#app').innerHTML = `
		<div class="pad">
			<h1>Learn English from everything you watch and read.</h1>
			<p class="muted">Meanings on hover on YouTube and any website, IPA and "sounds like", your known words, grammar and pronunciation focus, and review cards from your own sentences. For Sawa English members.</p>
		</div>
		<div class="sec">
			<button class="btn" id="login">Sign in with Sawa English</button>
				<p class="fbl"><a href="#" id="fb">💬 Send feedback</a></p>
			${err ? `<p class="err">${esc(err)}</p>` : ''}
		</div>`;
	$('#fb').onclick = (e) => { e.preventDefault(); openFeedback(false); };
	$('#login').onclick = async () => {
		$('#login').disabled = true;
		$('#login').textContent = 'Signing in…';
		try {
			const r = await send('login');
			// Phones: sign-in continues in a new tab, and this popup closes.
			if (r && r.pending) $('#login').textContent = 'A sign-in tab opened: finish there';
			else render();
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
	const isYT = origin === 'https://www.youtube.com' || origin === 'https://m.youtube.com';
	const p = st.progress || {};
	const todayWords = Math.max(st.local.words || 0, p.todayWords || 0);
	const todaySent = Math.max(st.local.sentences || 0, p.todaySentences || 0);
	const me = st.me || {};
	const paused = (await send('pausedSites').catch(() => [])).includes(origin);
	const enabled = !paused; // on by default everywhere; the switch pauses a site
	const hmode = (await chrome.storage.local.get('hoverMode')).hoverMode || 'hover';
	const ytOn = (await chrome.storage.local.get('ytShowOn')).ytShowOn === 'hover' ? 'hover' : 'click';
	const SHOW_TIP = 'Click: the card opens only when you click a word, so a passing mouse never stops the video. Hover: it opens when the mouse rests on a word for a moment. · ' +
		'Click: الكارت يفتح بس لما تدوس على الكلمة، فالماوس وهو معدّي ما يوقفش الفيديو. Hover: يفتح لما الماوس يقف على الكلمة لحظة.';
	const proofOn = (await chrome.storage.local.get('proofOn')).proofOn !== false;
	const skipUi = (await chrome.storage.local.get('skipUi')).skipUi !== false;
	const arS = await chrome.storage.local.get(['arHover', 'arEnglish', 'hideArabicYT']);
	// Vocals only: computers only (phones and touch screens don't get it), and not where it was too slow.
	const vo = await chrome.storage.local.get(['vocalsSlow', 'songLyrics']);
	if (!document.getElementById('mkcss')) document.head.insertAdjacentHTML('beforeend', '<style id="mkcss">' + self.LensMarks.legendCss('light') + '</style>');
	const cs = await chrome.storage.local.get(['lensColors', 'colorPages', 'colorLearnOnly']);
	const cmode = cs.lensColors === false && cs.colorPages === false ? 'off' : cs.colorLearnOnly ? 'learning' : 'all';
	const computer = !matchMedia('(hover: none)').matches && !/Android|iPhone|iPad|Mobile/i.test(navigator.userAgent);
	const more = (await chrome.storage.local.get('popupMore')).popupMore === true;
	const point = computer ? 'Hover' : 'Tap';
	const dy = await send('daily').catch(() => ({ read: 0, heard: 0, curious: 0, learning: 0, used: 0, cap: 30 }));
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
			${goal.tested ? `<p class="hint">Level test: about <b>${n(goal.estimate)}</b> words known. <a href="#" id="test">Take it again</a></p>` : `<button class="btn" id="test">Take the English level test</button>`}
		</div>`;
	}

	$('#app').innerHTML = `
		<div class="sec who" style="border-top:0">
			${me.avatar ? `<img src="${esc(me.avatar)}" alt="">` : ''}
			<div><b>Hi ${esc(me.firstName || me.name || '')}</b><div class="muted" style="font-size:12.5px">${me.plan && me.plan.tier === 'free' ? `Free account: Language Lens and Review. <a href="${esc(me.plan.join || 'https://sawaenglish.com/join/')}" target="_blank" rel="noopener">🔒 Join Sawa English</a> for the whole Sawa App.` : 'Your progress shows in the Sawa English app'}</div></div>
		</div>
		${goalHtml}
		<div class="sec">
			<div class="label">Today</div>
			<div class="stats">
				<div><b>${todayWords}</b><span>words learned</span></div>
				<div><b>${todaySent}</b><span>sentences saved</span></div>
				<div><b>${n(p.wordsKnown || 0)}</b><span>words known</span></div>
				<div><b>${n(dy.read)}</b><span>📖 words read</span></div>
				<div><b>${n(dy.heard)}</b><span>🎧 words heard in videos</span></div>
				<div><b>${n(dy.curious)}</b><span>💡 curious about</span></div>
			</div>
			<div class="lcap"><span>★ New Learning words today: <b>${dy.used} / ${dy.cap}</b></span>${dy.level ? `<span class="pill">Card level ${dy.level}</span>` : `<select id="lcap" title="New Learning words a day">${[20, 30, 40].map((x) => `<option ${x === dy.cap ? 'selected' : ''}>${x}</option>`).join('')}</select>`}</div>
			${dy.catchup ? '<p class="hint"><b>Catch-up time:</b> finish your due review cards, then new words open again.</p>' : dy.full ? `<p class="hint"><b>${dy.waiting} words</b> are waiting to become cards. Review every day to raise your card level.</p>` : ''}
			<a class="btn rvnow" href="${esc(dy.reviewUrl || 'https://sawaenglish.com/app/#review')}" target="_blank" rel="noopener">🃏 ${dy.ready ? `${n(dy.ready)} card${dy.ready === 1 ? '' : 's'} ready → ` : ''}Review now</a>
			<p class="hint">${point} any word you're curious about, then press <b>💡 Curious</b> for XP. It isn't added to your reviews, so you never get overwhelmed.</p>
		</div>
		<div class="sec">
			<div class="label">Your level</div>
			<div class="levels">${LEVELS.map((l, i) => `<button data-l="${i + 1}" aria-pressed="${st.level === i + 1}">${l}</button>`).join('')}</div>
			<p class="hint">${esc(LEVEL_HINT[st.level - 1])}: words up to this level count as known unless you mark them.</p>
		</div>
		<div class="sec">
			${isYT ? toggle('pause', computer ? 'Pause when I open a word' : 'Pause when I tap a word', 'On YouTube captions.', st.pauseOnHover)
		: origin ? `<div class="row"><div style="min-width:0"><div class="t">On this site</div><div class="site">${esc(origin.replace(/^https?:\/\//, ''))}</div></div>
				<label class="switch"><input type="checkbox" id="site" ${enabled ? 'checked' : ''}><span></span></label></div>
				<p class="hint">${enabled ? (computer ? 'Hover any word for its meaning. Select words to translate, hear or save them.' : 'Tap any word for its meaning. Press and hold to select words to translate, hear or save them.') : 'Paused on this site. Switch on to use Language Lens here again.'}</p>`
		: '<p class="muted">Open YouTube or any page with English text.</p>'}
			<p class="err" id="err" hidden></p>
		</div>
		<div class="sec">
			<div class="label">Meanings</div>
			<div class="seg2"><button data-g="en" aria-pressed="${st.glossLang !== 'ar'}">English → English</button><button data-g="ar" lang="ar" aria-pressed="${st.glossLang === 'ar'}">العربية</button></div>
			<div class="label" style="margin-top:12px">Explanations</div>
			<div class="seg2"><button data-x="en" aria-pressed="${st.explainLang !== 'ar'}">English</button><button data-x="ar" lang="ar" aria-pressed="${st.explainLang === 'ar'}">العربية</button></div>
			<p class="hint">Notes on words, pronunciation tips, grammar and lyrics. Saved with your account, so the Sawa app uses it too.</p>
			<div style="margin-top:12px">${toggle('expr', 'Highlight phrases & idioms', 'Double pink underline = an expression like “give up” or “on the fence”. ' + point + ' it for the meaning of the whole phrase.', st.exprOn !== false)}</div>
		</div>
		<div class="sec">
			<div class="label">Word colours</div>
			<div class="legend mks" style="margin-top:0">${self.LensMarks.legendHtml()}</div>
			<p class="hint">Words you know have no colour.</p>
			<div class="seg3"><button data-cm="all" aria-pressed="${cmode === 'all'}">All 4</button><button data-cm="learning" aria-pressed="${cmode === 'learning'}">Learning only</button><button data-cm="off" aria-pressed="${cmode === 'off'}">Off</button></div>
		</div>
		<div class="sec">
			<div class="label">YouTube</div>
			${toggle('sidebar', 'Transcript next to the video', computer ? 'Full sentences with timestamps. Click one to play it.' : 'Under the video: full sentences. Tap one to play it.', st.sidebar !== false)}
			${computer ? `<div style="margin-bottom:12px"><div class="label">Show meanings on YouTube <span class="info" title="${esc(SHOW_TIP)}" aria-label="${esc(SHOW_TIP)}" tabindex="0">ⓘ</span></div><select id="ytshow" class="fsel"><option value="click" ${ytOn === 'click' ? 'selected' : ''}>When I click a word</option><option value="hover" ${ytOn === 'hover' ? 'selected' : ''}>When I hover over a word</option></select></div>` : ''}
			${toggle('lensYT', 'Language Lens on YouTube', 'Also on the player bar: the switch next to Aa.', st.lensYT !== false)}
			${toggle('showEn', 'English captions (1st line)', point + ' any word for its meaning.', st.showEn !== false)}
			${toggle('showTrans', 'Arabic translation (2nd line)', 'YouTube\'s auto-translation, under the captions.', st.showTrans !== false)}
			${toggle('showSound', 'How it sounds (3rd line)', 'How fast speech sounds, e.g. “wanna”.', st.showSound !== false)}
			${computer ? '<p class="hint">Hotkeys: <kbd>A</kbd> previous · <kbd>S</kbd> repeat · <kbd>D</kbd> next · <kbd>R</kbd> loop · <kbd>X</kbd> slower · <kbd>W</kbd> shadow · <kbd>Q</kbd> auto-pause. Drag the ⋮⋮ grip to move the captions.</p>' : ''}
		</div>
		<details class="more" id="more" ${more ? 'open' : ''}><summary>More settings</summary>
		<div class="sec">
			<div class="label">Practice</div>
			${toggle('blurCaptions', computer ? 'Blur captions until hover' : 'Blur captions until tap', 'Listen first, then check.', !!st.blurCaptions)}
			${toggle('blurTrans', 'Blur the translation', computer ? 'Hover over it to read it.' : 'Tap it to read it.', !!st.blurTrans)}
			${toggle('showIPA', 'IPA and "sounds like"', 'Under each word, with sounds Arabic speakers find hard.', st.showIPA !== false)}
		</div>
		<div class="sec">
			<div class="label">🎵 Music</div>
			${toggle('songlyrics', 'Lyrics for songs', 'On YouTube songs, the transcript shows the lyrics (from the video, or LRCLIB) with a link to Genius. Click 💡 on a line to have it explained.', vo.songLyrics !== false)}
			${computer ? (vo.vocalsSlow ? '<p class="hint">🎤 Vocals only is off: this computer was too slow for it.</p>' : '<p class="hint">🎤 Vocals only (test): on a song, open Aa in the player → 🎤 Vocals only. It works on that video only, at normal speed (1×).</p>') : ''}
			${computer && !vo.vocalsSlow ? '<div class="row"><div><div class="t">🎧 Voice-only playlist</div><div class="d">Add songs or YouTube playlists: the music is taken out in the background with the best voice model, and they play with the voice only, at once.</div></div><button class="btn sm ghost" id="prepared">Open</button></div>' : ''}
		</div>
		<div class="sec">
			<div class="label">Focus</div>
			<select id="focus" class="fsel"><option value="">— none —</option>${Object.keys(groups).map((g) => `<optgroup label="${g}">${groups[g].map((f) => `<option value="${f.key}" ${st.focus === f.key ? 'selected' : ''}>${esc(f.name)}</option>`).join('')}</optgroup>`).join('')}</select>
			<p class="hint">Highlights a grammar point or a sound everywhere, so you notice it.</p>
			${computer ? `<div style="margin-top:12px"><div class="label">Show meanings on websites <span class="info" title="${esc(SHOW_TIP)}" aria-label="${esc(SHOW_TIP)}" tabindex="0">ⓘ</span></div><select id="hmode" class="fsel"><option value="hover" ${hmode === 'hover' ? 'selected' : ''}>When I hover over a word</option><option value="click" ${hmode === 'click' ? 'selected' : ''}>When I click a word</option><option value="alt" ${hmode === 'alt' ? 'selected' : ''}>When I hover and hold Alt</option><option value="select" ${hmode === 'select' ? 'selected' : ''}>Only when I select text</option></select><p class="hint">Select or double-click a word for its meaning; select more words to translate or save them.</p></div>` : ''}
			<div class="label" style="margin-top:16px">Websites</div><div>${toggle('proof', 'Check my writing on websites', 'Red wavy line = spelling, blue = grammar. ' + (computer ? 'Click' : 'Tap') + ' it to see the fix.', proofOn)}</div>
			<div style="margin-top:12px">${toggle('hidearyt', 'Hide Arabic videos on YouTube', 'Your Home, Up next and Shorts fill with English; Arabic Shorts are skipped. Search still shows everything.', arS.hideArabicYT === true)}</div>
			<div style="margin-top:12px">${toggle('arhover', 'Arabic → English', point + ' an Arabic word for its English. Select Arabic text to read it in English.', arS.arHover !== false)}</div>
			<div style="margin-top:12px">${toggle('arenglish', 'English under Arabic posts', 'Adds an English line under Arabic posts and comments, so you keep reading English. Uses AI.', arS.arEnglish === true)}</div>
			<div style="margin-top:12px">${toggle('skipui', 'Skip links, titles and buttons', 'No colours or pop-ups on links, headlines, menus, names and labels like Like · Reply · Share. Select them if you need a meaning.', skipUi)}</div>
			<div style="margin-top:12px">${toggle('colors', 'Colour words on websites', 'On sites where Language Lens is on. Which colours: Word colours, above.', st.colorPages !== false)}</div>
		</div>
		</details>
		<div class="sec links">
			<a href="${esc(me.app || 'https://sawaenglish.com/app/')}" target="_blank" rel="noopener">Open the Sawa English app</a>
				<a href="https://sawaenglish.com/lens/" target="_blank" rel="noopener">How to use it</a>
			<a href="#" id="fb">💬 Send feedback</a>
			<button class="out" id="logout">Sign out</button>
		</div>`;

	document.querySelectorAll('.levels button').forEach((b) => {
		b.onclick = async () => {
			await send('setLevel', { level: +b.dataset.l });
			render();
		};
	});
	document.querySelectorAll('.seg2 button[data-g]').forEach((b) => {
		b.onclick = async () => {
			await send('setPref', { key: 'glossLang', value: b.dataset.g });
			render();
		};
	});
	// Word colours: one choice for YouTube and websites. "Learning only" hides the new/hard underlines.
	document.querySelectorAll('.seg3 button[data-cm]').forEach((b) => {
		b.onclick = () => {
			const m = b.dataset.cm;
			chrome.storage.local.set({ lensColors: m !== 'off', colorPages: m !== 'off', colorLearnOnly: m === 'learning' });
			document.querySelectorAll('.seg3 button').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
			const c = $('#colors'); if (c) c.checked = m !== 'off';
		};
	});
	document.querySelectorAll('.seg2 button[data-x]').forEach((b) => {
		b.onclick = async () => {
			await send('setPref', { key: 'explainLang', value: b.dataset.x });
			render();
		};
	});
	const pref = (id, key) => { const el = $('#' + id); if (el) el.onchange = () => send('setPref', { key, value: el.checked }); };
	pref('showIPA', 'showIPA');
	pref('sidebar', 'sidebar');
	pref('showTrans', 'showTrans');
	pref('lensYT', 'lensYT');
	pref('showEn', 'showEn');
	pref('showSound', 'showSound');
	pref('blurCaptions', 'blurCaptions');
	pref('blurTrans', 'blurTrans');
	pref('colors', 'colorPages');
	pref('expr', 'exprOn');
	pref('pause', 'pauseOnHover');
	$('#focus').onchange = (e) => send('setPref', { key: 'focus', value: e.target.value });
	const pf = $('#proof'); if (pf) pf.onchange = () => chrome.storage.local.set({ proofOn: pf.checked });
	const lc = $('#lcap'); if (lc) lc.onchange = () => send('setLearnCap', { n: +lc.value });
	const hy = $('#hidearyt'); if (hy) hy.onchange = () => chrome.storage.local.set({ hideArabicYT: hy.checked });
	const ah = $('#arhover'); if (ah) ah.onchange = () => chrome.storage.local.set({ arHover: ah.checked });
	const ae = $('#arenglish'); if (ae) ae.onchange = () => chrome.storage.local.set({ arEnglish: ae.checked });
	const sl = $('#songlyrics'); if (sl) sl.onchange = () => chrome.storage.local.set({ songLyrics: sl.checked });
	const pr = $('#prepared'); if (pr) pr.onclick = () => chrome.tabs.create({ url: chrome.runtime.getURL('vocals/prepare.html') });
	const su = $('#skipui'); if (su) su.onchange = () => chrome.storage.local.set({ skipUi: su.checked });
	const hm = $('#hmode'); if (hm) hm.onchange = (e) => chrome.storage.local.set({ hoverMode: e.target.value });
	const ys = $('#ytshow'); if (ys) ys.onchange = (e) => chrome.storage.local.set({ ytShowOn: e.target.value });
	$('#more').ontoggle = () => chrome.storage.local.set({ popupMore: $('#more').open });
	const test = $('#test');
	if (test) test.onclick = (e) => { e.preventDefault(); send('openTest').then(() => window.close()); };
	const site = $('#site');
	if (site) {
		site.onchange = async () => {
			try {
				await send('pauseSite', { origin, paused: !site.checked });
				chrome.tabs.reload(tab.id);
				render();
			} catch (e) {
				const er = $('#err');
				er.hidden = false;
				er.textContent = 'Could not switch on for this page. Refresh it and try again.';
			}
		};
	}
	$('#fb').onclick = (e) => { e.preventDefault(); openFeedback(true); };
	$('#logout').onclick = async () => {
		await send('logout');
		render();
	};
	send('sync').catch(() => {});
}

render();
