// Admin insights: what people ask Anchored and how the answers land.
// Pure functions over rows already fetched, so they are easy to test.
import { normalizeKey } from './normalize.js';

const PAGE = 1000;

// Fetch EVERY row in the window, page by page (no silent first-N cap).
// Any error throws: an error is never "no questions".
export async function fetchAll(query, page = PAGE) {
  const rows = [];
  for (let from = 0; ; from += page) {
    const { data, error } = await query().range(from, from + page - 1);
    if (error) throw error;
    rows.push(...(data || []));
    if (!data || data.length < page) return rows;
  }
}

function dayKey(ts) {
  return new Date(ts).toISOString().slice(0, 10); // UTC day, stated in the UI
}

function topN(map, n) {
  return [...map.values()].sort((a, b) => b.count - a.count || a.label.localeCompare(b.label)).slice(0, n);
}

function tally(map, key, label) {
  const e = map.get(key) || { label, count: 0 };
  e.count += 1;
  map.set(key, e);
  return e;
}

/**
 * logs:     [{ question, resource_urls, created_at }]
 * feedback: [{ question, rating, created_at }]
 */
export function summarize({ logs, feedback, days, now = new Date(), top = 15 }) {
  const questions = new Map();
  const resources = new Map();
  const perDay = new Map();
  for (let i = days - 1; i >= 0; i--) perDay.set(dayKey(now.getTime() - i * 864e5), 0);

  for (const l of logs) {
    const key = normalizeKey(l.question);
    if (key) tally(questions, key, String(l.question).trim());
    for (const u of l.resource_urls || []) {
      let base = u;
      try { const p = new URL(u); p.searchParams.delete('t'); base = p.href; } catch { /* keep */ }
      tally(resources, base, base);
    }
    const d = dayKey(l.created_at);
    if (perDay.has(d)) perDay.set(d, perDay.get(d) + 1);
  }

  const down = new Map();
  let up = 0;
  let downTotal = 0;
  for (const f of feedback) {
    if (f.rating === 'up') up += 1;
    else if (f.rating === 'down') {
      downTotal += 1;
      const key = normalizeKey(f.question);
      if (key) tally(down, key, String(f.question).trim());
    }
  }

  return {
    days,
    totals: {
      questions: logs.length,
      unique: questions.size,
      feedback: up + downTotal,
      up,
      down: downTotal,
      helpfulRate: up + downTotal ? Math.round((100 * up) / (up + downTotal)) : null,
    },
    perDay: [...perDay].map(([day, count]) => ({ day, count })),
    topQuestions: topN(questions, top).map((e) => ({ question: e.label, count: e.count })),
    notHelpful: topN(down, 10).map((e) => ({ question: e.label, count: e.count })),
    topResources: topN(resources, 10).map((e) => ({ url: e.label, count: e.count })),
  };
}
