import { test } from 'node:test';
import assert from 'node:assert/strict';
import { chunkText, chunkSegments } from '../lib/chunk.js';

// ---------------------------------------------------------------------------
// chunkText
// ---------------------------------------------------------------------------

test('chunkText: short text yields a single chunk containing all words', () => {
  const text = 'hello world foo bar';
  const result = chunkText(text);
  assert.equal(result.length, 1);
  assert.ok(typeof result[0].content === 'string');
  // all words present
  assert.ok(result[0].content.includes('hello'));
  assert.ok(result[0].content.includes('bar'));
});

test('chunkText: empty string yields an empty array', () => {
  assert.deepEqual(chunkText(''), []);
});

test('chunkText: whitespace-only string yields an empty array', () => {
  assert.deepEqual(chunkText('   \n\t  '), []);
});

test('chunkText: each chunk has a content string', () => {
  // Build 1200 words
  const words = Array.from({ length: 1200 }, (_, i) => `word${i}`);
  const text = words.join(' ');
  const result = chunkText(text);
  for (const chunk of result) {
    assert.ok(typeof chunk.content === 'string', 'content should be a string');
  }
});

test('chunkText: long text (1200 words) yields multiple chunks', () => {
  const words = Array.from({ length: 1200 }, (_, i) => `word${i}`);
  const text = words.join(' ');
  const result = chunkText(text);
  assert.ok(result.length > 1, `expected >1 chunks, got ${result.length}`);
});

test('chunkText: consecutive chunks share overlap (50-word tail of chunk N == head of chunk N+1)', () => {
  // Build 1200 words so we get at least 2 chunks
  const words = Array.from({ length: 1200 }, (_, i) => `word${i}`);
  const text = words.join(' ');
  const result = chunkText(text);
  assert.ok(result.length >= 2);

  // chunk 0: words[0..499], chunk 1: words[450..949]
  // The overlap is words[450..499] — tail of chunk 0, head of chunk 1
  const OVERLAP_WORDS = 50;
  const TARGET_WORDS = 500;

  for (let i = 0; i < result.length - 1; i++) {
    const chunkWords = result[i].content.split(' ');
    const nextWords = result[i + 1].content.split(' ');
    // The last OVERLAP_WORDS of chunk[i] should equal the first OVERLAP_WORDS of chunk[i+1]
    const tail = chunkWords.slice(-OVERLAP_WORDS);
    const head = nextWords.slice(0, OVERLAP_WORDS);
    assert.deepEqual(tail, head, `overlap mismatch between chunk ${i} and ${i + 1}`);
  }
});

test('chunkText: ~500-word chunk size (first chunk has at most TARGET_WORDS words)', () => {
  const words = Array.from({ length: 1200 }, (_, i) => `word${i}`);
  const text = words.join(' ');
  const result = chunkText(text);
  const firstChunkWords = result[0].content.split(' ');
  assert.ok(firstChunkWords.length <= 500, `first chunk has ${firstChunkWords.length} words`);
});

// ---------------------------------------------------------------------------
// chunkSegments
// ---------------------------------------------------------------------------

test('chunkSegments: empty array returns []', () => {
  assert.deepEqual(chunkSegments([]), []);
});

test('chunkSegments: whitespace-only segments are skipped', () => {
  const segs = [
    { text: '   ', start: 0 },
    { text: '\t', start: 1 },
    { text: '', start: 2 },
  ];
  assert.deepEqual(chunkSegments(segs), []);
});

test('chunkSegments: each chunk has content (string) and start_time (number)', () => {
  // ~10 words per segment, 60 segments → ~600 words → at least 1 flush
  const segs = Array.from({ length: 10 }, (_, i) => ({
    text: `alpha beta gamma delta epsilon zeta eta theta iota kappa`,
    start: i * 5,
  }));
  const result = chunkSegments(segs);
  assert.ok(result.length >= 1);
  for (const chunk of result) {
    assert.ok(typeof chunk.content === 'string');
    assert.ok(typeof chunk.start_time === 'number');
  }
});

test('chunkSegments: start_time of first chunk equals first segment start (floored, >=0)', () => {
  const segs = Array.from({ length: 10 }, (_, i) => ({
    text: `word${i} extra text here for size`,
    start: 3.7 + i * 5,
  }));
  const result = chunkSegments(segs);
  assert.ok(result.length >= 1);
  // Math.max(0, Math.floor(3.7)) === 3
  assert.equal(result[0].start_time, 3);
});

test('chunkSegments: start_time is never negative (start=0)', () => {
  const segs = Array.from({ length: 5 }, (_, i) => ({
    text: `some words here for segment ${i}`,
    start: 0,
  }));
  const result = chunkSegments(segs);
  if (result.length > 0) {
    assert.ok(result[0].start_time >= 0);
  }
});

test('chunkSegments: enough segments to force >=2 chunks', () => {
  // ~10 words per segment × 110 segments = ~1100 words → at least 2 chunks
  const segs = Array.from({ length: 110 }, (_, i) => ({
    text: `alpha beta gamma delta epsilon zeta eta theta iota kappa`,
    start: i * 2,
  }));
  const result = chunkSegments(segs);
  assert.ok(result.length >= 2, `expected >=2 chunks, got ${result.length}`);
});

test('chunkSegments: second chunk start_time reflects its first segment start', () => {
  // 10 words/seg, 55 segs per chunk → need 55 segs for first chunk, then more
  // Use 12 words per segment so 42 segs exceed 500 words
  const makeText = () =>
    'one two three four five six seven eight nine ten eleven twelve';
  const segs = Array.from({ length: 90 }, (_, i) => ({
    text: makeText(),
    start: i * 3,
  }));
  const result = chunkSegments(segs);
  assert.ok(result.length >= 2);
  // second chunk start_time should be > 0
  assert.ok(result[1].start_time > 0);
});
