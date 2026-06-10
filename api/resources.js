// GET /api/resources -> { resources: [{ id, title, type, url, description, author, tags }] }
// Powers the public library page. Server-side read with the service-role key,
// so no Supabase credentials are ever exposed to the browser.
import { supabase } from '../lib/supabase.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { data, error } = await supabase
      .from('resources')
      .select('id, title, type, url, description, author, tags, added_at')
      .order('added_at', { ascending: false });
    if (error) throw error;
    return res.status(200).json({ resources: data || [] });
  } catch (err) {
    console.error('resources error:', err);
    return res.status(500).json({ error: 'Something went wrong.' });
  }
}
