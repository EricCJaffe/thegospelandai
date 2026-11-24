import { test } from 'node:test';
import assert from 'node:assert/strict';
import { shareToken, verifyShareToken } from '../lib/share.js';

process.env.SHARE_SECRET = 'test-secret';

test('a token round-trips to its id', () => {
  const t = shareToken(42);
  assert.match(t, /^42\.[A-Za-z0-9_-]{22}$/);
  assert.equal(verifyShareToken(t), 42);
});

test('changing the id or signature is rejected', () => {
  const sig = shareToken(42).split('.')[1];
  assert.equal(verifyShareToken(`43.${sig}`), null);
  assert.equal(verifyShareToken(`42.${'A'.repeat(22)}`), null);
  assert.equal(verifyShareToken('42'), null);
  assert.equal(verifyShareToken(''), null);
  assert.equal(verifyShareToken(undefined), null);
});

test('no id means no token', () => {
  assert.equal(shareToken(null), null);
  assert.equal(shareToken(0), null);
});

test('a different key invalidates old tokens', () => {
  const t = shareToken(7);
  process.env.SHARE_SECRET = 'rotated';
  assert.equal(verifyShareToken(t), null);
  process.env.SHARE_SECRET = 'test-secret';
});
