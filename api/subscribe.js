// POST /api/subscribe -> { ok: true }
// Powers the homepage email capture form. Upserts into subscribers table,
// idempotent on duplicate email (conflict do nothing).
import { supabase } from '../lib/supabase.js';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { email, source } = req.body || {};

  if (!email || !EMAIL_RE.test(email)) {
    return res.status(400).json({ error: 'Please enter a valid email address.' });
  }

  try {
    const record = { email: email.trim().toLowerCase() };
    if (source) record.source = source;

    const { error } = await supabase
      .from('subscribers')
      .upsert(record, { onConflict: 'email', ignoreDuplicates: true });

    if (error) throw error;
    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error('subscribe error:', err);
    return res.status(500).json({ error: 'Something went wrong.' });
  }
}
