/* 🎵 Music: lyrics for songs on YouTube.
   Songs (YouTube's "Music" category) often have only auto-generated captions, which get lyrics wrong.
   Lyrics come from, in order:
   1. the video's own English subtitles (made by the uploader, often the label: kept as they are);
   2. LRCLIB (lrclib.net), a free open database of lyrics timed line by line, matched by artist, title and length.
   Music videos often start with an intro the album track doesn't have, so the lyrics' timing is lined up with
   YouTube's auto-generated captions when there are any (shared words vote for the shift), and the student can nudge it.
   Genius is always offered as a link, to check the words. Google's lyrics can't be used: there is no way to get them. */
(function () {
	'use strict';
	if (window.LensMusic) return;
	var API = 'https://lrclib.net/api/';
	var cache = {};

	/** Is this video a song? YouTube's category, or an auto-made "Artist - Topic" channel. */
	function isSong(m) {
		return !!(m && (m.category === 'Music' || / - Topic$/.test(m.author || '')));
	}
	/** "Ed Sheeran - Perfect (Official Music Video)" → { artist: 'Ed Sheeran', track: 'Perfect' } */
	function names(m) {
		var t = String(m.title || '')
			.replace(/\s*[(\[][^)\]]*(official|video|audio|lyric|visuali[sz]er|remaster|\bhd\b|4k|\bmv\b|clip|version|explicit)[^)\]]*[)\]]/gi, '')
			.replace(/\s*\|.*$/, '').replace(/\s+/g, ' ').trim();
		var author = String(m.author || '').replace(/\s*-\s*Topic$/, '').replace(/VEVO$/i, '').replace(/\s*(official)?\s*$/i, '').trim();
		var parts = t.split(/\s+[-–—]\s+/), artist, track;
		if (parts.length >= 2) { artist = parts[0]; track = parts.slice(1).join(' - '); } else { artist = author; track = t; }
		track = track.replace(/\s*[(\[]?\s*(ft|feat|featuring)\.?\s.*$/i, '').replace(/["“”]/g, '').trim();
		artist = artist.replace(/\s*[,&x]\s.*$|\s+(ft|feat|featuring)\.?\s.*$/i, '').trim();
		return { artist: artist, track: track };
	}
	function genius(m) {
		var n = names(m);
		return 'https://genius.com/search?q=' + encodeURIComponent((n.artist + ' ' + n.track).trim());
	}
	function get(path) {
		return fetch(API + path, { headers: { 'Lrclib-Client': 'Language Lens (Sawa English)' } }).then(function (r) {
			if (r.status === 404) return null;
			if (!r.ok) throw new Error('LRCLIB ' + r.status);
			return r.json();
		});
	}
	/** The best timed lyrics for the song, or null. */
	function lookup(m) {
		var n = names(m), dur = Math.round(m.seconds || 0), key = n.artist + '|' + n.track + '|' + dur;
		if (cache[key]) return cache[key];
		var q = 'artist_name=' + encodeURIComponent(n.artist) + '&track_name=' + encodeURIComponent(n.track);
		cache[key] = get('get?' + q + (dur ? '&duration=' + dur : '')).catch(function () { return null; }).then(function (hit) {
			if (hit && hit.syncedLyrics) return hit;
			// Not an exact match (the video is often longer than the album track): search, and take the closest length.
			return get('search?' + q).then(function (list) {
				list = (list || []).filter(function (x) { return x.syncedLyrics && !x.instrumental; });
				if (!list.length) return get('search?q=' + encodeURIComponent(n.artist + ' ' + n.track)).then(function (l2) {
					return (l2 || []).filter(function (x) { return x.syncedLyrics && !x.instrumental; });
				});
				return list;
			}).then(function (list) {
				if (!list.length) return null;
				list.sort(function (a, b) { return Math.abs(a.duration - dur) - Math.abs(b.duration - dur); });
				return dur && Math.abs(list[0].duration - dur) > 90 ? null : list[0];
			});
		}).then(function (hit) {
			if (!hit) return null;
			return { id: hit.id, artist: hit.artistName, track: hit.trackName, duration: hit.duration, lines: parseLrc(hit.syncedLyrics) };
		}).catch(function () { return null; });
		return cache[key];
	}
	/** "[01:02.30] I found a love" → [{ t: 62300, text }] */
	function parseLrc(s) {
		var out = [];
		String(s || '').split(/\r?\n/).forEach(function (line) {
			var times = [], m, re = /\[(\d+):(\d+(?:\.\d+)?)\]/g, last = 0;
			while ((m = re.exec(line))) { times.push(Math.round((+m[1] * 60 + +m[2]) * 1000)); last = re.lastIndex; }
			var text = line.slice(last).replace(/\s+/g, ' ').trim();
			times.forEach(function (t) { out.push({ t: t, text: text }); });
		});
		return out.sort(function (a, b) { return a.t - b.t; });
	}
	/** Lyric lines → caption cues (ms), shifted by offset. Empty lines only end the line before. */
	function cues(lines, offset) {
		var out = [];
		lines.forEach(function (l, i) {
			if (!l.text || !/[A-Za-z]/.test(l.text)) return;
			var next = lines[i + 1], start = Math.max(0, l.t + offset), end = next ? next.t + offset : start + 5000;
			out.push({ start: start, end: Math.min(end, start + 8000), text: l.text });
		});
		return out;
	}
	var norm = function (w) { return w.toLowerCase().replace(/[^a-z']/g, '').replace(/'/g, ''); };
	/** How far (ms) to shift the lyrics so they match the video, using auto-generated captions (their words are timed). */
	function offsetFrom(lines, asr) {
		if (!asr || !asr.length) return 0;
		var heard = {};
		asr.forEach(function (c) {
			var ws = c.words || c.text.split(' ').map(function (w, i, a) { return { t: c.start + (c.end - c.start) * i / a.length, text: w }; });
			ws.forEach(function (w) { var k = norm(w.text); if (k.length >= 3) (heard[k] = heard[k] || []).push(w.t); });
		});
		var votes = {}, total = 0;
		lines.forEach(function (l, i) {
			var next = lines[i + 1], ws = l.text.split(' '), span = Math.min(6000, Math.max(800, ((next ? next.t : l.t + 3000) - l.t)));
			ws.forEach(function (w, j) {
				var k = norm(w);
				if (k.length < 3 || !heard[k]) return;
				var tl = l.t + span * j / ws.length;
				heard[k].forEach(function (ta) {
					var d = ta - tl;
					if (Math.abs(d) > 60000) return;
					var b = Math.round(d / 250);
					votes[b] = (votes[b] || 0) + 1; total++;
				});
			});
		});
		var best = 0, bestV = 0;
		Object.keys(votes).forEach(function (b) {
			var v = (votes[b] || 0) + 0.5 * ((votes[+b - 1] || 0) + (votes[+b + 1] || 0));
			if (v > bestV) { bestV = v; best = +b; }
		});
		var lyricWords = lines.reduce(function (s, l) { return s + l.text.split(' ').length; }, 0);
		return bestV >= Math.max(8, lyricWords * 0.08) ? best * 250 : 0;
	}

	window.LensMusic = {
		isSong: isSong,
		names: names,
		genius: genius,
		lookup: lookup,
		parseLrc: parseLrc,
		cues: cues,
		offsetFrom: offsetFrom
	};
})();
