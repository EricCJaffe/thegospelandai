// POST /api/feedback -> { ok: true }
// Records thumbs-up/down feedback on chat answers into the feedback table.
import { supabase } from '../lib/supabase.js';

const MAX_LEN = 4000;
const VALID_RATINGS = new Set(['up', 'down']);

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { question, answer, rating, resourceUrls } = req.body || {};

  if (!VALID_RATINGS.has(rating)) {
    return res.status(400).json({ error: "rating must be 'up' or 'down'." });
  }

  try {
    const record = {
      question: String(question || '').slice(0, MAX_LEN),
      answer: String(answer || '').slice(0, MAX_LEN),
      rating,
      resource_urls: Array.isArray(resourceUrls) ? resourceUrls : [],
    };

    const { error } = await supabase.from('feedback').insert(record);

    if (error) throw error;
    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error('feedback error:', err);
    return res.status(500).json({ error: 'Something went wrong.' });
  }
}
