import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseVideoId } from '../lib/youtube.js';

const VIDEO_ID = 'dLrvJeSugkM';

test('parseVideoId: standard watch URL', () => {
  assert.equal(parseVideoId('https://www.youtube.com/watch?v=dLrvJeSugkM'), VIDEO_ID);
});

test('parseVideoId: youtu.be short URL', () => {
  assert.equal(parseVideoId('https://youtu.be/dLrvJeSugkM'), VIDEO_ID);
});

test('parseVideoId: embed URL', () => {
  assert.equal(parseVideoId('https://www.youtube.com/embed/dLrvJeSugkM'), VIDEO_ID);
});

test('parseVideoId: shorts URL', () => {
  assert.equal(parseVideoId('https://www.youtube.com/shorts/dLrvJeSugkM'), VIDEO_ID);
});

test('parseVideoId: watch URL with extra query params (&t=30s)', () => {
  assert.equal(
    parseVideoId('https://www.youtube.com/watch?v=dLrvJeSugkM&t=30s'),
    VIDEO_ID
  );
});

test('parseVideoId: non-YouTube URL with no recognized pattern returns null', () => {
  // The regex matches on pattern (v=, youtu.be/, /embed/, /shorts/) regardless of
  // hostname — a URL with none of those patterns returns null.
  assert.equal(parseVideoId('https://www.example.com/video/dLrvJeSugkM'), null);
});

test('parseVideoId: empty string returns null', () => {
  assert.equal(parseVideoId(''), null);
});
