/* 🎧 Voice-only playlist (🎵 Music, computers only): take the music out of songs ahead of time, with the best voice
   model, and keep only the singer's voice on this computer. Played later with 🎤 Vocals only, a prepared song
   starts at once (vocals/vocals.js reads it) and has less music in it than live separation.
   For each song: a muted background tab plays it at double speed so YouTube sends its sound
   (content/vocals.js, capture mode), that sound is separated here window by window, the voice is encoded
   (Opus) and stored (IndexedDB "voice"), and the original sound is deleted. Prepared songs are deleted after 30 days.
   Lists: chrome.storage.local vocalsQueue [{id, title, addedAt}] (to do) and vocalsPrepared {id: {title, duration, bytes, createdAt, model}}. */
'use strict';
const A = window.LensAudio, SR = 44100, $ = (s) => document.querySelector(s);
const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const now = {}; // id → {text, cls, progress}
const failed = {};
let model = null, modelName = '', wake = null, working = '', isWorker = false;

async function lists() {
	const o = await chrome.storage.local.get(['vocalsQueue', 'vocalsPrepared']);
	return { queue: o.vocalsQueue || [], done: o.vocalsPrepared || {} };
}
function say(id, text, cls, progress) { now[id] = { text, cls: cls || '', progress }; render(); }

/* ------------------------------------------------------------ the list */
let renderT = 0;
function render() {
	clearTimeout(renderT);
	renderT = setTimeout(async () => {
		const { queue, done } = await lists();
		const ids = [...queue.map((s) => s.id), ...Object.keys(done).filter((id) => !queue.some((s) => s.id === id))];
		const title = (id) => (done[id] && done[id].title) || (queue.find((s) => s.id === id) || {}).title || id;
		$('#songs').innerHTML = ids.length ? ids.map((id) => {
			const d = done[id], n = now[id];
			let st, cls = '', bar = '';
			if (d) { st = '✓ Ready · ' + Math.round(d.duration / 60) + ' min · ' + (d.bytes / 1e6).toFixed(1) + ' MB · kept until ' + new Date(d.createdAt + A.KEEP_DAYS * 864e5).toLocaleDateString(); cls = 'ok'; }
			else if (failed[id]) { st = 'Could not prepare it: ' + failed[id]; cls = 'bad'; }
			else if (n) { st = n.text; cls = n.cls; if (n.progress != null) bar = '<div class="bar2"><i style="width:' + Math.round(n.progress * 100) + '%"></i></div>'; }
			else st = isWorker ? 'Waiting' : 'Waiting (another Voice-only playlist tab is working)';
			return '<li><div class="tt"><b>' + esc(title(id)) + '</b><div class="st ' + cls + '">' + esc(st) + '</div>' + bar + '</div>' +
				(d ? '<a class="btn sm ghost" target="_blank" href="https://www.youtube.com/watch?v=' + esc(id) + '">▶ Play</a>' : '') +
				(failed[id] ? '<button class="btn sm ghost" data-retry="' + esc(id) + '">Try again</button>' : '') +
				(id !== working ? '<button class="btn sm ghost" data-del="' + esc(id) + '">' + (d ? 'Delete' : 'Remove') + '</button>' : '') + '</li>';
		}).join('') : '<div class="empty">No songs yet. Paste YouTube links above, or on a YouTube playlist choose Aa → 🎵 Music → ➕ Add these songs.</div>';
		const ready = ids.filter((id) => done[id]), left = ids.length - ready.length;
		$('#sum').innerHTML = ids.length ? '<div><b>' + ready.length + ' of ' + ids.length + ' ready</b><div class="muted">' + (working ? 'Working on: ' + esc(title(working)) : left ? (isWorker ? 'Starting…' : 'Another Voice-only playlist tab is working on them') : 'All songs are ready.') + '</div></div>' +
			(ready.length ? '<button class="btn sm" id="playAll">▶ Play on YouTube with 🎤 Vocals only</button>' : '') : '';
		const pa = $('#playAll');
		// YouTube makes a playlist from up to 50 song ids; Vocals only is switched on for it
		if (pa) pa.onclick = () => chrome.storage.local.set({ vocalsOnly: true }, () => window.open('https://www.youtube.com/watch_videos?video_ids=' + ready.slice(0, 50).join(','), '_blank'));
		const bytes = Object.values(done).reduce((s, d) => s + d.bytes, 0);
		$('#foot').textContent = Object.keys(done).length + ' prepared · ' + (bytes / 1e6).toFixed(1) + ' MB on this computer' +
			(modelName ? ' · voice model: ' + modelName : '') + ' · nothing is uploaded or shared.';
	}, 50);
}
document.addEventListener('click', async (e) => {
	const del = e.target.closest('[data-del]'), retry = e.target.closest('[data-retry]');
	if (del) {
		const id = del.dataset.del, { queue, done } = await lists();
		delete done[id];
		await chrome.storage.local.set({ vocalsQueue: queue.filter((s) => s.id !== id), vocalsPrepared: done });
		await A.Store.del('voice', id).catch(() => {});
		await A.Store.del('audio', id).catch(() => {});
	} else if (retry) {
		delete failed[retry.dataset.retry];
		if (wake) wake();
		render();
	}
});
chrome.storage.onChanged.addListener((ch) => { if (ch.vocalsQueue || ch.vocalsPrepared) { render(); if (wake) wake(); } });

/* ------------------------------------------------------------ adding a link */
/** The songs behind one link: a song, or every song of a playlist (YouTube's own playlist page). */
async function songsOf(v) {
	const vid = (v.match(/(?:[?&]v=|youtu\.be\/|\/shorts\/)([\w-]{11})/) || [])[1], list = (v.match(/[?&]list=([\w-]+)/) || [])[1];
	let songs = [];
	if (list) {
		const html = await (await fetch('https://www.youtube.com/playlist?list=' + list, { credentials: 'omit' })).text();
		const seen = {}, re = /"playlistVideoRenderer":\{"videoId":"([\w-]{11})"[\s\S]*?"title":\{"runs":\[\{"text":"((?:[^"\\]|\\.)*)"/g;
		let m;
		while ((m = re.exec(html)) && songs.length < 100) if (!seen[m[1]]) { seen[m[1]] = 1; songs.push({ id: m[1], title: JSON.parse('"' + m[2] + '"') }); }
	}
	if (!songs.length && vid) {
		const o = await fetch('https://www.youtube.com/oembed?format=json&url=' + encodeURIComponent('https://www.youtube.com/watch?v=' + vid)).then((r) => r.json()).catch(() => ({}));
		songs = [{ id: vid, title: o.title || vid }];
	}
	return songs;
}
/** Add every link pasted (one per line, or separated by spaces): songs and whole playlists. */
async function addLink() {
	const links = $('#link').value.split(/[\s,]+/).filter((x) => /youtu/.test(x)), btn = $('#addBtn'), msg = $('#addMsg');
	if (!links.length) { msg.textContent = 'Paste YouTube links (songs or playlists) first.'; return; }
	btn.disabled = true;
	let added = 0, bad = 0;
	try {
		for (let k = 0; k < links.length; k++) {
			msg.textContent = 'Reading link ' + (k + 1) + ' of ' + links.length + '…';
			const songs = await songsOf(links[k]).catch(() => []);
			if (!songs.length) { bad++; continue; }
			const { queue, done } = await lists(), have = new Set(queue.map((x) => x.id).concat(Object.keys(done)));
			songs.forEach((x) => { if (!have.has(x.id)) { queue.push({ id: x.id, title: x.title, addedAt: Date.now() }); added++; } });
			await chrome.storage.local.set({ vocalsQueue: queue });
		}
		$('#link').value = '';
		msg.textContent = added + ' song' + (added === 1 ? '' : 's') + ' added' + (bad ? ' · ' + bad + ' link' + (bad === 1 ? '' : 's') + ' not understood' : '') + '.';
	} finally {
		btn.disabled = false;
	}
}
$('#addBtn').onclick = addLink;
$('#link').addEventListener('keydown', (e) => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) addLink(); });

/* ------------------------------------------------------------ the work */
/** Open the song in a muted background tab and wait for its sound (content/vocals.js keeps it in IndexedDB "audio"). */
async function capture(song) {
	say(song.id, 'Getting the song’s sound… (a small muted window opens for a moment)', '', null);
	// A small window of its own: Chrome doesn't load videos in background tabs that were never shown,
	// and this way the student's own tab isn't taken over. It is muted before YouTube even loads.
	const win = await chrome.windows.create({ url: 'about:blank', type: 'popup', focused: false, width: 420, height: 300, left: Math.max(0, screen.availWidth - 440), top: Math.max(0, screen.availHeight - 330) });
	const tab = win.tabs[0];
	try {
		await chrome.tabs.update(tab.id, { muted: true });
		await chrome.tabs.update(tab.id, { url: 'https://www.youtube.com/watch?v=' + song.id + '&sawa_prepare=1' });
		const t0 = Date.now();
		while (Date.now() - t0 < 15 * 60e3) {
			await sleep(2500);
			const a = await A.Store.get('audio', song.id);
			if (a) return a;
			try { await chrome.tabs.get(tab.id); } catch (e) { throw new Error('its tab was closed'); }
			const s = Math.round((Date.now() - t0) / 1000);
			say(song.id, 'Getting the song’s sound… ' + s + 's', '', null);
		}
		throw new Error('YouTube took too long');
	} finally {
		chrome.windows.remove(win.id).catch(() => {});
	}
}
/** Separate the voice, window by window, and encode it (Opus). */
async function separate(song, audio) {
	if (!model) {
		modelName = (await A.hasGpu()) ? 'best' : 'live'; // without a graphics chip the best model is too slow: use the fast one
		model = await A.loadSeparator(modelName, (s) => say(song.id, s.state === 'download' ? 'Downloading the voice model… ' + Math.round(s.progress * 100) + '% (' + s.mb + ' MB, once)' : 'Starting the voice model…', '', s.progress));
		modelName = A.MODELS[modelName].name + (model.backend === 'webgpu' ? ' (graphics chip)' : ' (processor)');
	}
	const sep = model.sep, K = Math.ceil(audio.duration * SR / sep.step), total = Math.round(audio.duration * SR);
	let rate = 44100;
	if (!(await AudioEncoder.isConfigSupported({ codec: 'opus', sampleRate: 44100, numberOfChannels: 2, bitrate: 128000 })).supported) rate = 48000;
	const chunks = [];
	let dcfg = null, encErr = null;
	const enc = new AudioEncoder({
		output: (c, meta) => {
			const data = new Uint8Array(c.byteLength);
			c.copyTo(data);
			chunks.push({ time: c.timestamp / 1e6, dur: (c.duration || 20000) / 1e6, data });
			if (meta && meta.decoderConfig) dcfg = meta.decoderConfig;
		},
		error: (e) => { encErr = e; }
	});
	enc.configure({ codec: 'opus', sampleRate: rate, numberOfChannels: 2, bitrate: 128000 });
	async function emit(L, R, start) {
		const n = Math.min(L.length, total - start);
		if (n <= 0) return;
		let l = L.subarray(0, n), r = R.subarray(0, n);
		if (rate !== SR) {
			const ctx = new OfflineAudioContext(2, Math.round(n * rate / SR), rate), b = ctx.createBuffer(2, n, SR);
			b.copyToChannel(l, 0); b.copyToChannel(r, 1);
			const src = ctx.createBufferSource(); src.buffer = b; src.connect(ctx.destination); src.start(0);
			const o = await ctx.startRendering();
			l = o.getChannelData(0); r = o.getChannelData(1);
		}
		const data = new Float32Array(l.length * 2);
		data.set(l, 0); data.set(r, l.length);
		const ad = new AudioData({ format: 'f32-planar', sampleRate: rate, numberOfFrames: l.length, numberOfChannels: 2, timestamp: Math.round(start / SR * 1e6), data });
		enc.encode(ad);
		ad.close();
	}
	let pending = null;
	const t0 = performance.now();
	for (let k = 0; k < K; k++) {
		const nd = sep.need(k), pcm = await A.pcm(audio.packets, audio.config, nd.from / SR, nd.to / SR, SR);
		const w = await sep.window(k, pcm.L.slice(), pcm.R.slice());
		if (pending) {
			// neighbouring windows overlap by a crossfade: add the tail of the one before, then send that one on
			for (let i = 0; i < sep.xf; i++) { w.L[i] += pending.L[sep.step + i]; w.R[i] += pending.R[sep.step + i]; }
			await emit(pending.L.subarray(0, sep.step), pending.R.subarray(0, sep.step), pending.start);
		}
		pending = w;
		if (encErr) throw encErr;
		const left = (performance.now() - t0) / (k + 1) * (K - k - 1) / 1000;
		say(song.id, 'Taking out the music… ' + Math.round((k + 1) / K * 100) + '% (about ' + (left > 90 ? Math.round(left / 60) + ' min' : Math.round(left) + ' s') + ' left)', '', (k + 1) / K);
	}
	if (pending) await emit(pending.L, pending.R, pending.start);
	await enc.flush();
	enc.close();
	if (encErr) throw encErr;
	const desc = dcfg && dcfg.description ? new Uint8Array(dcfg.description instanceof ArrayBuffer ? dcfg.description : dcfg.description.buffer.slice(dcfg.description.byteOffset, dcfg.description.byteOffset + dcfg.description.byteLength)) : null;
	const config = { codec: 'opus', sampleRate: (dcfg && dcfg.sampleRate) || 48000, channels: (dcfg && dcfg.numberOfChannels) || 2, description: desc };
	return { chunks, config, seconds: (performance.now() - t0) / 1000 };
}
async function work(song) {
	working = song.id;
	try {
		let audio = await A.Store.get('audio', song.id);
		if (!audio) audio = await capture(song);
		const r = await separate(song, audio);
		const bytes = r.chunks.reduce((s, c) => s + c.data.length, 0);
		await A.Store.put('voice', { id: song.id, title: audio.title || song.title, duration: audio.duration, config: r.config, chunks: r.chunks, model: modelName, createdAt: Date.now(), bytes, workSeconds: r.seconds });
		await A.Store.del('audio', song.id); // the original sound isn't kept
		const { queue, done } = await lists();
		done[song.id] = { title: (audio.title || song.title || '').replace(/^\(\d+\)\s*/, ''), duration: audio.duration, bytes, createdAt: Date.now(), model: modelName, workSeconds: Math.round(r.seconds) };
		await chrome.storage.local.set({ vocalsQueue: queue.filter((s) => s.id !== song.id), vocalsPrepared: done });
		delete now[song.id];
	} catch (err) {
		failed[song.id] = err && err.message || String(err);
	} finally {
		working = '';
		render();
	}
}
/** Old prepared songs are deleted after 30 days. */
async function tidy() {
	const { done } = await lists(), old = Object.keys(done).filter((id) => Date.now() - done[id].createdAt > A.KEEP_DAYS * 864e5);
	for (const id of old) { delete done[id]; await A.Store.del('voice', id).catch(() => {}); }
	if (old.length) await chrome.storage.local.set({ vocalsPrepared: done });
}

(async () => {
	try {
		const me = await chrome.tabs.getCurrent();
		if (me) await chrome.tabs.update(me.id, { pinned: true, autoDiscardable: false });
	} catch (e) { /* not in a tab */ }
	await tidy();
	render();
	// one Voice-only playlist tab works at a time (the others just show the list)
	navigator.locks.request('sawa-prepare', { ifAvailable: true }, async (lock) => {
		if (!lock) { render(); return; }
		isWorker = true;
		for (;;) {
			const { queue, done } = await lists();
			const next = queue.find((s) => !done[s.id] && !failed[s.id]);
			if (!next) {
				$('#note').textContent = 'All songs are ready. Add more any time; this page waits for them.';
				await new Promise((r) => { wake = r; });
				wake = null;
				$('#note').textContent = 'This page works in the background (it stays pinned on the left of your tabs). Each song opens for a moment in a small muted window, then closes by itself.';
				continue;
			}
			await work(next);
		}
	});
})();
window.__prepare = { lists, failed, now: () => now };
