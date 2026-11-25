// Admin: question insights. READ ONLY.
//   GET /api/admin/insights?days=30 -> summary (see lib/insights.js)
// days is 1..365, default 30. Days are UTC.
// Auth: header `x-admin-password` must match ADMIN_PASSWORD (as resources.js).
import { supabase } from '../../lib/supabase.js';
import { fetchAll, summarize } from '../../lib/insights.js';

function checkAuth(req, res) {
  const expected = process.env.ADMIN_PASSWORD;
  if (!expected) {
    res.status(503).json({ error: 'Admin is not configured. Set ADMIN_PASSWORD.' });
    return false;
  }
  const given = req.headers['x-admin-password'];
  if (!given || given !== expected) {
    res.status(401).json({ error: 'Unauthorized' });
    return false;
  }
  return true;
}

export default async function handler(req, res) {
  if (!checkAuth(req, res)) return;
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const days = Math.min(365, Math.max(1, parseInt(req.query?.days, 10) || 30));
  const since = new Date(Date.now() - days * 864e5).toISOString();
  try {
    const [logs, feedback] = await Promise.all([
      fetchAll(() =>
        supabase.from('chat_logs').select('question, resource_urls, created_at')
          .gte('created_at', since).order('id', { ascending: true })),
      fetchAll(() =>
        supabase.from('feedback').select('question, rating, created_at')
          .gte('created_at', since).order('id', { ascending: true })),
    ]);
    return res.status(200).json(summarize({ logs, feedback, days }));
  } catch (err) {
    console.error('insights error:', err);
    return res.status(500).json({ error: 'Could not load insights.' });
  }
}
