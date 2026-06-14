// Admin: list and delete resources.
//   GET    /api/admin/resources       -> { resources: [{...fields, chunk_count}] }
//   DELETE /api/admin/resources?id=NN  -> { ok: true }  (chunks cascade via FK)
//
// Auth: every request must send header `x-admin-password` matching the
// ADMIN_PASSWORD env var. If ADMIN_PASSWORD is unset the endpoint is "not
// configured" and returns 503 so the admin knows to set it.
//
// NOTE: nested under api/admin/, so shared libs are two levels up (../../lib/...).
import { supabase } from '../../lib/supabase.js';

// Returns true if the request is authorized. When it returns false it has
// already sent the appropriate 503/401 response.
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

  try {
    if (req.method === 'GET') {
      const { data: resources, error: rErr } = await supabase
        .from('resources')
        .select('id, title, type, url, tags, author, added_at')
        .order('added_at', { ascending: false });
      if (rErr) throw rErr;

      // Count chunks per resource. Fetch resource_ids and tally in JS — simple
      // and correct for the library sizes we expect.
      const { data: chunkRows, error: cErr } = await supabase
        .from('chunks')
        .select('resource_id');
      if (cErr) throw cErr;

      const counts = new Map();
      for (const row of chunkRows || []) {
        counts.set(row.resource_id, (counts.get(row.resource_id) || 0) + 1);
      }

      const withCounts = (resources || []).map((r) => ({
        ...r,
        chunk_count: counts.get(r.id) || 0,
      }));
      return res.status(200).json({ resources: withCounts });
    }

    if (req.method === 'DELETE') {
      const id = req.query?.id ?? req.body?.id;
      if (!id) return res.status(400).json({ error: 'Missing resource id.' });

      const { error } = await supabase.from('resources').delete().eq('id', id);
      if (error) throw error;
      return res.status(200).json({ ok: true });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    console.error('admin/resources error:', err);
    return res.status(500).json({ error: 'Something went wrong.' });
  }
}
