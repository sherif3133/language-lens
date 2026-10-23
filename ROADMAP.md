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
  Used for ⏬ Prepared songs (0.5.7). The UVR project is MIT but the weights carry no licence of their own: check before a public release.
- Phones: no solution yet (no extension WebGPU on m.youtube.com, battery). Maybe server-side later (legal check first).
- Only Opus/WebM audio (what Chrome gets); AAC/MP4 videos say "not supported yet".
- BUILT in 0.5.2: 🎵 Music: lyrics in the transcript (LRCLIB first, lined up with the video's captions; switch to the video's subtitles; ±0.5 s nudge), Genius link, 💡 explain a line (English default / عربي).
- BUILT in 0.5.6: 🎮 Lyrics game (content/game.js): one missing word per line (Learning words first), Choose (4 options) or Type it, the video waits at the end of each line, points + streak, missed words → + Learning. Idea: XP in the Sawa Tracker for finished songs.
- BUILT in 0.5.7: 🎧 Voice-only playlist (vocals/prepare.html; was "Prepared songs"): a song or a whole playlist is taken out of its music ahead of time with Voc_FT (WebGPU; Spleeter without a graphics chip), the voice is kept on the student's computer (IndexedDB, Opus, deleted after 30 days), the original sound is not kept. Each song's sound comes from a muted background tab playing it at double speed. Vocals only then starts at once. Ideas: a whole album in one click from the popup; a smaller/faster best model; share nothing (keep it that way).
- Legal: separation is local and personal, nothing stored or shared, but it is a grey area. Decide before a public release.

## Simplify Language Lens: choices for Sherif (review of 2026-10-23, after 0.6.3)

0.6.3 fixed the clear problems (tap words on websites on phones, popup wording for phones, More settings, Meaning here link, phone sign-in next step).
These need your choice. My pick is marked ✅.

1. **Today box in the popup shows 6 numbers** (words learned, sentences saved, words known, read, heard, curious) plus the daily Learning limit.
   - ✅ A: keep 3 (words learned today, words heard, 💡 curious) and the limit; the rest stays in the Sawa app.
   - B: keep all 6.
2. **Signed-out popup says "For Sawa English members"** and gives a non-member nothing to do.
   - ✅ A: add "Not a member yet? Join Sawa English" linking to the join page.
   - B: a free account with the dictionary only (no AI), AI after joining.
   - C: keep it members only, as now.
3. **Music tools in the popup** (Lyrics, 🎤 Vocals only, 🎧 Voice-only playlist) are for few students and make the popup long.
   - ✅ A: only in YouTube's player menu (Aa → 🎵 Music), not in the popup.
   - B: keep them under More settings (as in 0.6.3).
4. **Word card has three buttons: I know it · Learning · 💡 Curious.** "Curious" is hard to explain (XP, not a review card).
   - ✅ A: two buttons; Curious XP is given by itself when a student opens a card and stays on it (once per word, as now).
   - B: keep three buttons.
5. **One setting for "Meanings" and one for "Explanations"** (English or Arabic, each).
   - ✅ A: one switch, "Help in: English / العربية", for both.
   - B: keep two.
6. **Default meaning language is English → English.** Beginners may not understand English definitions.
   - ✅ A: Arabic by default for A1–A2 (from the level test), English from B1.
   - B: English for everyone (as now).
7. **YouTube panel on phones has many buttons** (◀ ↻ Repeat ▶ Auto-pause, Save sentence, Aa Display, and Auto-scroll · Colours · — at the top).
   - ✅ A: move Colours and Auto-scroll into Aa Display; Save sentence becomes the ☆ on each transcript line (it already exists there).
   - B: keep as is.

DONE in 0.6.5 (2026-10-23): everyday meaning first for the 3,000 most-used words (371 entries reordered by hand, e.g. "now: at the present moment", "even: level, equal"). The order is in tools/gloss/en-order.tsv; tools/gloss/en-senses.js lists the senses for the next words (3,000+).
