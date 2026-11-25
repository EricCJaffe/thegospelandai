import { test } from 'node:test';
import assert from 'node:assert/strict';
import { summarize, fetchAll } from '../lib/insights.js';

const now = new Date('2026-11-24T12:00:00Z');

test('groups questions by normalized text and ranks them', () => {
  const logs = [
    { question: 'Is AI evil?', resource_urls: ['https://youtu.be/a?t=30', 'https://x.org/b'], created_at: '2026-11-24T01:00:00Z' },
    { question: 'is ai  evil', resource_urls: ['https://youtu.be/a?t=90'], created_at: '2026-11-23T01:00:00Z' },
    { question: 'Will AI take my job?', resource_urls: [], created_at: '2026-11-20T01:00:00Z' },
  ];
  const s = summarize({ logs, feedback: [], days: 7, now });
  assert.deepEqual(s.totals, { questions: 3, unique: 2, feedback: 0, up: 0, down: 0, helpfulRate: null });
  assert.deepEqual(s.topQuestions[0], { question: 'Is AI evil?', count: 2 });
  assert.deepEqual(s.topResources[0], { url: 'https://youtu.be/a', count: 2 });
  assert.equal(s.perDay.length, 7);
  assert.deepEqual(s.perDay.at(-1), { day: '2026-11-24', count: 1 });
  assert.equal(s.perDay.reduce((t, d) => t + d.count, 0), 3);
});

test('feedback totals, helpful rate and the not-helpful list', () => {
  const feedback = [
    { question: 'Q1', rating: 'up' }, { question: 'Q1', rating: 'up' },
    { question: 'Q2', rating: 'down' }, { question: 'q2!', rating: 'down' }, { question: 'Q3', rating: 'up' },
  ];
  const s = summarize({ logs: [], feedback, days: 30, now });
  assert.equal(s.totals.up, 3);
  assert.equal(s.totals.down, 2);
  assert.equal(s.totals.helpfulRate, 60);
  assert.deepEqual(s.notHelpful, [{ question: 'Q2', count: 2 }]);
});

test('fetchAll reads every page and stops on a short one', async () => {
  const data = Array.from({ length: 5 }, (_, i) => ({ i }));
  const calls = [];
  const query = () => ({ range: async (a, b) => { calls.push([a, b]); return { data: data.slice(a, b + 1), error: null }; } });
  const rows = await fetchAll(query, 2);
  assert.equal(rows.length, 5);
  assert.deepEqual(calls, [[0, 1], [2, 3], [4, 5]]);
});

test('fetchAll fails closed on an error', async () => {
  const query = () => ({ range: async () => ({ data: null, error: new Error('boom') }) });
  await assert.rejects(fetchAll(query), /boom/);
});
