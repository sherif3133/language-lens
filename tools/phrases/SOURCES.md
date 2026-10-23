# Expressions list: where it comes from

Phrasal verbs, idioms, compound nouns and fixed phrases that Language Lens highlights as one unit
("give up", "on the fence", "customer service", "by the way"). `build-lexicon.js` adds them to
`extension/data/lexicon.json` with the part of speech `phrasal verb`, `idiom`, `compound noun` or `phrase`.

## Files

- `in-v*.tsv`, `in-a1.tsv`, `in-n*.tsv`: candidates taken from **WordNet 3.0** (Princeton University), the
  multi-word verbs, adjectives, adverbs and nouns whose words are all in the top 6,000 (`freq.json`);
  nouns only if they appear in WordNet's sense-tagged corpus. WordNet licence: `extension/data/WORDNET-LICENSE.txt`
  (free to use, copy, modify and distribute, including commercially, with the copyright notice).
- `out-*.tsv`: the list itself. `out-v*`, `out-a1`, `out-n*` = the useful candidates from the matching `in-` file;
  `out-x1` idioms, `out-x2` phrasal verbs (incl. three-word ones), `out-x3` everyday compounds, `out-x4` spoken
  phrases and linking expressions, added from general knowledge.
  Meanings, Arabic and examples were written for Sawa English (by Claude, 2026-10-23); they are Sawa's own text,
  not copied from a dictionary. Idioms and phrases themselves are common language, not anyone's work.

Format: `expression \t type \t level \t simple English meaning \t Arabic \t example`, type = phrasal | idiom | compound | phrase.
`one's` / `oneself` stand for my/your/his… and myself/yourself…; `someone` / `something` in the middle stand for 1–3 words.
The first file (alphabetical) wins when an expression appears twice; a word-list (CEFR-J) entry with the same spelling wins over both.

To fix a meaning: edit the line in `out-*.tsv`, run `node build-lexicon.js` in `tools/`, then copy
`extension/data/lexicon.json` to `../sawa-lens/assets/lexicon.json` so /app and the Silk Road game show it too.
