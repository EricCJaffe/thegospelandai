import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SESSIONS, SESSION_PLAN } from '../content/small-group-guide.js';
import { checkVerses } from '../lib/verses.js';

test('ten sessions, numbered 1..10, each complete', () => {
  assert.deepEqual(SESSIONS.map((s) => s.n), [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  for (const s of SESSIONS) {
    for (const k of ['chapter', 'theme', 'open', 'practice', 'leader']) assert.ok(s[k], `session ${s.n} ${k}`);
    assert.ok(s.discuss.length >= 3, `session ${s.n} discuss`);
    assert.ok(s.scripture.length >= 1, `session ${s.n} scripture`);
  }
});

test('every scripture reference exists', () => {
  for (const s of SESSIONS) {
    for (const ref of s.scripture) {
      const r = checkVerses(ref);
      assert.deepEqual(r.invalid, [], `session ${s.n} ${ref}`);
      assert.equal(r.verses.length, 1, `session ${s.n} ${ref} not recognized`);
    }
  }
});

test('session plan fits an hour', () => {
  assert.equal(SESSION_PLAN.reduce((t, p) => t + p.minutes, 0), 60);
});
