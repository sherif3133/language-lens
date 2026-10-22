# Language Lens – Sawa English (beta)

Browser extension for Chrome and Edge. Learners hover any word in YouTube captions or on any website and see its Arabic meaning (Modern Standard Arabic), mark words as known or being learned, see how much of a video or page they understand, and save sentences as review cards. Everything syncs to sawaenglish.com through the **Sawa Lens** WordPress plugin and shows in the Sawa Tracker.

## Folders

- `extension/`: the extension itself (Manifest V3, plain JavaScript, no build step).
  - `background.js`: sign-in, the word list, marks, saved sentences, sync.
  - `core/lens-core.js`: word matching, levels and the "you know 96%" grade.
  - `content/yt-main.js` + `content/yt.js`: the caption bar on YouTube.
  - `content/page.js`: hover and save on other websites.
  - `content/card.js`: the word card.
  - `content/vocals-main.js` + `content/vocals.js` + `vocals/`: 🎤 Vocals only (test, computers only): the singer's voice without the music, separated in the browser (`lib/ort/` = onnxruntime-web).
  - `content/music.js`: 🎵 Music: lyrics for songs (LRCLIB, lined up with the video's captions), a Genius link, and 💡 line explanations (server: `/lyric` in sawa-lens).
  - `popup/`: the toolbar popup.
  - `data/lexicon.json`: built word list (do not edit by hand).
- `tools/`: scripts that build the word list and icons, and the end-to-end tests (`mobile-test.js`, `vocals-test.js`, `music-test.js`).

## Try the beta (load unpacked)

1. Open `chrome://extensions` (or `edge://extensions`) and switch on **Developer mode**.
2. Click **Load unpacked** and choose the `extension` folder.
3. Click the Language Lens icon in the toolbar, then **ادخل بحساب سوا انجليش**.
4. Open a YouTube video with English captions. For other sites, open the popup there and switch it on.

## Rebuilding the word list

```
cd tools
npm install
node build-lexicon.js
```

`build-lexicon.js` combines the CEFR-J and Octanove word lists (`tools/data`) with the Arabic glossary (`tools/gloss/out-*.tsv`) and writes `extension/data/lexicon.json`. To fix a meaning, edit its line in `tools/gloss/out-*.tsv` and rebuild.

## Credits

- CEFR-J Wordlist Version 1.5. Compiled by Yukio Tono, Tokyo University of Foreign Studies. http://www.cefr-j.org/ (free for research and commercial use with citation).
- Octanove Vocabulary Profile C1/C2 1.0, Octanove Labs, CC BY-SA 4.0 (`tools/data/octanove-vocabulary-profile-c1c2-1.0.csv`).
- Arabic glossary: written for Sawa English, drafted with AI.
- English definitions and examples: WordNet 3.0, Copyright 2006 by Princeton University. All rights reserved. Used under the WordNet License (https://wordnet.princeton.edu/license-and-commercial-use).
- Pronunciations: The CMU Pronouncing Dictionary (Carnegie Mellon University), via cmu-pronouncing-dictionary (ISC).
- Word frequencies: wordfreq data by Robyn Speer et al., CC BY-SA 4.0 (https://github.com/rspeer/wordfreq). The derived ranking extension/data/freq.json is shared under the same licence.
- Grammar tagging: compromise (MIT), bundled in extension/lib.
- Word forms built with compromise (MIT).
- Vocals only: onnxruntime-web 1.30.0 (Microsoft, MIT, in extension/lib/ort). Voice model: Spleeter 2-stems by Deezer (MIT), fp16 ONNX export by sherpa-onnx (k2-fsa), downloaded once from Hugging Face at a pinned commit and checked by SHA-256.
- Song lyrics: LRCLIB (lrclib.net), a free open database of timed lyrics; the lyrics belong to their writers. Genius is only linked.
