import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checkVerses, createVerseGate, UNVERIFIED_NOTE } from '../lib/verses.js';

test('real references are collected with links', () => {
  const r = checkVerses('As John 3:16 says, and Rom 8:28, and 1 Cor. 13:4-7.');
  assert.deepEqual(r.verses.map((v) => v.osis), ['John.3.16', 'Rom.8.28', '1Cor.13.4-1Cor.13.7']);
  assert.match(r.verses[0].url, /^https:\/\/www\.biblegateway\.com\/passage\/\?search=John%203%3A16$/);
  assert.deepEqual(r.invalid, []);
  assert.equal(r.text, 'As John 3:16 says, and Rom 8:28, and 1 Cor. 13:4-7.');
});

test('references that do not exist are flagged inline', () => {
  const r = checkVerses('See John 3:99 and Psalm 151:1, but Genesis 50:26 is real.');
  assert.deepEqual(r.invalid, ['John 3:99', 'Psalm 151:1']);
  assert.deepEqual(r.verses.map((v) => v.osis), ['Gen.50.26']);
  assert.equal(r.text, `See John 3:99${UNVERIFIED_NOTE} and Psalm 151:1${UNVERIFIED_NOTE}, but Genesis 50:26 is real.`);
});

test('flagging is idempotent (cached answers are re-checked)', () => {
  const once = checkVerses('Read Jude 2:1 today.').text;
  assert.equal(checkVerses(once).text, once);
});

test('ordinary numbers and lowercase words are left alone', () => {
  const r = checkVerses('It is 70 years old; mark 2 points; meet at 5:30 pm.');
  assert.deepEqual(r.verses, []);
  assert.deepEqual(r.invalid, []);
  assert.equal(r.text, 'It is 70 years old; mark 2 points; meet at 5:30 pm.');
});

test('gate releases whole paragraphs only after they are checked', () => {
  const out = [];
  const gate = createVerseGate((t) => out.push(t));
  for (const tok of ['Read Joh', 'n 3:', '99 today.', '\n\nThen ', 'Rom 8:', '28.']) gate.push(tok);
  assert.deepEqual(out, [`Read John 3:99${UNVERIFIED_NOTE} today.\n\n`]);
  const done = gate.end();
  assert.equal(out.join(''), done.text);
  assert.deepEqual(done.invalid, ['John 3:99']);
  assert.deepEqual(done.verses.map((v) => v.osis), ['Rom.8.28']);
});

test('gate forces a flush on a long paragraph without splitting a reference', () => {
  const out = [];
  const gate = createVerseGate((t) => out.push(t));
  const long = 'Grace abounds. '.repeat(60) + 'Remember 1 Cor. 13:4 always';
  for (const ch of long) gate.push(ch);
  assert.ok(out.length >= 1, 'flushed before the end');
  const done = gate.end();
  assert.equal(done.text, long);
  assert.deepEqual(done.verses.map((v) => v.osis), ['1Cor.13.4']);
});
