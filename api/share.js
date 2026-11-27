// GET /api/share?s=<token> -> { question, answer, resources: [{ url, title }] }
// Opens one shared answer. The token is signed (lib/share.js), so a link
// reaches only the answer it was made for. 404 for a forged or unknown token.
import { supabase } from '../lib/supabase.js';
import { verifyShareToken } from '../lib/share.js';

function baseUrl(u) {
  try {
    const p = new URL(u);
    p.searchParams.delete('t');
    return p.href;
  } catch {
    return u;
  }
}

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  const id = verifyShareToken(req.query?.s);
  if (!id) return res.status(404).json({ error: 'This link is not valid.' });

  try {
    const { data, error } = await supabase
      .from('chat_logs')
      .select('question, answer, resource_urls')
      .eq('id', id)
      .maybeSingle();
    if (error) throw error;
    if (!data) return res.status(404).json({ error: 'This answer is no longer available.' });

    const urls = (data.resource_urls || []).filter(Boolean);
    let titles = new Map();
    if (urls.length) {
      const { data: rows } = await supabase
        .from('resources')
        .select('url, title')
        .in('url', [...new Set(urls.map(baseUrl))]);
      titles = new Map((rows || []).map((r) => [r.url, r.title]));
    }
    res.setHeader('Cache-Control', 'public, s-maxage=3600');
    return res.status(200).json({
      question: data.question || '',
      answer: data.answer || '',
      resources: urls.map((url) => ({ url, title: titles.get(baseUrl(url)) || url })),
    });
  } catch (err) {
    console.error('share error:', err);
    return res.status(500).json({ error: 'Something went wrong.' });
  }
}
