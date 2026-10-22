# Language Lens – roadmap (planned, not built)

## Language Lens on phones (the Trancy way)

Trancy reaches phones by running its extension inside mobile browsers that allow extensions,
on YouTube's mobile site (m.youtube.com). It also has a separate YouTube-client app.
Researched 2026-10-22.

### Stage 1 – Android via Firefox (cheapest, no fees) — BUILT in 0.5.0 (2026-10-22), not yet tried on a real phone
Done: m.youtube.com, tap for meaning (bottom sheet), controls + transcript under the player, press-and-hold to select,
sign-in in a tab (`content/connect.js` + `?sawa_lens=connected` in sawa-lens), `tools/build-zips.js` (Chrome + Firefox zips),
`tools/mobile-test.js` (14 checks, phone + computer). Left: try it on a real Android phone (Lemur zip, then Firefox), publish on AMO.
- Run the YouTube scripts on `m.youtube.com` too. Its page is built differently from `www`
  (`ytm-*` elements, different player controls), so the subtitle bar and button need a mobile placement.
- Tap instead of hover: tapping a word opens the card, and long-press selects a phrase.
  The card becomes a bottom sheet on small screens.
- Sign-in without `chrome.identity` (Firefox Android and Safari don't have it): open the
  sawaenglish.com connect page in a tab, and a small content script there hands the token back to the extension.
- Publish on addons.mozilla.org (free, the same zip with a `browser_specific_settings` id).
- Later: check whether Edge for Android lets outside extensions in.

### Stage 2 – iPhone via a Safari extension
- Convert the same code with Xcode's Safari Web Extension converter (needs a Mac or a cloud Mac,
  and the $99/year Apple developer account).
- It ships as a small App Store app whose only job is to turn the extension on.
  It could also open `/app`, so the store listing is more than a website.

### Stage 3 – Trancy-style study features (desktop and mobile)
- Practice on a video: dictation (type what you hear), fill the missing word, shadowing with a score.
- Read mode: the whole transcript as an article, with tap-for-meaning.
- AI subtitles for videos with no captions (speech-to-text on the server, cached per video for everyone).
- AI summary of a video before watching, in Arabic.

## 🎤 Vocals only + lyrics game (songs) — TEST BUILT in 0.5.1 (2026-10-22), waiting for Sherif to listen

For students who avoid musical instruments: on a YouTube song, hear only the singer's voice.
Built (test): "🎤 Vocals only" in the player's Language Lens menu and in the popup, computers only.
YouTube's audio bytes are copied ahead of playback (`content/vocals-main.js`), separated in a hidden
extension page (`vocals/`: Spleeter 2-stems fp16, onnxruntime-web, WebGPU or WASM), and played in step
with the video; the video's own sound goes through Web Audio and is switched off. `tools/vocals-test.js` checks it silently.
Left / ideas:
- Better quality on strong computers: UVR MDX-Net Voc_FT (SDR 8.9 vs 5.1 for Spleeter on MUSDB clips, 67 MB)
  is ~1.0× real time on a Ryzen 5 5500U iGPU, too slow there. Offer it when the measured speed allows.
  Check the UVR models' licence first (Spleeter is MIT).
- Phones: no solution yet (no extension WebGPU on m.youtube.com, battery). Maybe server-side later (legal check first).
- Only Opus/WebM audio (what Chrome gets); AAC/MP4 videos say "not supported yet".
- BUILT in 0.5.2: 🎵 Music: lyrics in the transcript (LRCLIB first, lined up with the video's captions; switch to the video's subtitles; ±0.5 s nudge), Genius link, 💡 explain a line (English default / عربي).
- BUILT in 0.5.6: 🎮 Lyrics game (content/game.js): one missing word per line (Learning words first), Choose (4 options) or Type it, the video waits at the end of each line, points + streak, missed words → + Learning. Idea: XP in the Sawa Tracker for finished songs.
- Prepare songs in advance (album/playlist) with the better Voc_FT model, kept only on the student's computer: asked, not decided yet.
- Legal: separation is local and personal, nothing stored or shared, but it is a grey area. Decide before a public release.
