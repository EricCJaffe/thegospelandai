// Verse checks: every chapter:verse reference in an answer is checked against
// real Bible versification before the reader sees it.
//
// - A reference that exists (John 3:16) is collected with a Bible Gateway link.
// - A reference that does not exist (John 3:99, Psalm 151:1) is flagged inline
//   so the reader is never handed a made-up verse as if it were Scripture.
//
// Only chapter:verse forms are checked. Chapter-only text ("is 40 years") is
// too easy to misread as a book name, so it is left alone.
import { bcv_parser } from 'bible-passage-reference-parser/esm/bcv_parser.js';
import * as en from 'bible-passage-reference-parser/esm/lang/en.js';

export const UNVERIFIED_NOTE = ' (reference not found; please check it)';

const parser = new bcv_parser(en);
parser.set_options({
  invalid_passage_strategy: 'include', // keep invalid refs so we can flag them
  invalid_sequence_strategy: 'include',
  case_sensitive: 'books', // "mark" the verb is not Mark the Gospel
});

function verseUrl(ref) {
  return `https://www.biblegateway.com/passage/?search=${encodeURIComponent(ref)}`;
}

/**
 * Check every chapter:verse reference in `text`.
 * Returns { text, verses, invalid }:
 *   text    — the input with each invalid reference flagged (idempotent)
 *   verses  — [{ ref, osis, url }] for references that exist, deduped
 *   invalid — [ref] for references that do not exist
 */
export function checkVerses(text) {
  const verses = [];
  const invalid = [];
  if (!text) return { text: text || '', verses, invalid };

  parser.parse(text);
  const flagAt = []; // end indices where the note is inserted
  for (const group of parser.parsed_entities()) {
    for (const e of group.entities) {
      const [start, end] = e.indices;
      const ref = text.slice(start, end).trim();
      if (!ref.includes(':')) continue;
      if (e.osis) {
        verses.push({ ref, osis: e.osis, url: verseUrl(ref) });
      } else {
        invalid.push(ref);
        if (!text.startsWith(UNVERIFIED_NOTE, end)) flagAt.push(end);
      }
    }
  }

  let out = text;
  for (const at of flagAt.sort((a, b) => b - a)) {
    out = out.slice(0, at) + UNVERIFIED_NOTE + out.slice(at);
  }
  const seen = new Set();
  const unique = verses.filter((v) => !seen.has(v.osis) && seen.add(v.osis));
  return { text: out, verses: unique, invalid };
}

// Longest stretch held back before a forced flush, and how much of the tail
// to keep back when forcing one (a reference is well under 40 characters).
const MAX_BUFFER = 800;
const TAIL = 40;

/**
 * Streaming gate. Tokens are held until a paragraph (newline) completes, the
 * paragraph is checked, and only then passed to `emit`. Paragraph-at-a-time
 * still streams, and a reference is never split across a check.
 */
export function createVerseGate(emit) {
  let buffer = '';
  let text = '';
  const verses = new Map();
  const invalid = [];

  function release(chunk) {
    if (!chunk) return;
    const checked = checkVerses(chunk);
    for (const v of checked.verses) if (!verses.has(v.osis)) verses.set(v.osis, v);
    invalid.push(...checked.invalid);
    text += checked.text;
    emit(checked.text);
  }

  function cutPoint() {
    const nl = buffer.lastIndexOf('\n');
    if (nl >= 0) return nl + 1;
    if (buffer.length <= MAX_BUFFER) return 0;
    // Long paragraph: cut after the last sentence end that is not an
    // abbreviation ("Cor." would be), clear of the tail.
    const head = buffer.slice(0, buffer.length - TAIL);
    let cut = 0;
    for (const m of head.matchAll(/[a-z]{5}[.!?]\s/g)) cut = m.index + m[0].length;
    return cut;
  }

  return {
    push(token) {
      buffer += token;
      const cut = cutPoint();
      if (cut > 0) {
        release(buffer.slice(0, cut));
        buffer = buffer.slice(cut);
      }
    },
    end() {
      release(buffer);
      buffer = '';
      return { text, verses: [...verses.values()], invalid };
    },
  };
}
