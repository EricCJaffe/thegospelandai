// Admin: ingest a resource into the library (POST only).
//   Body: { url?, title?, type?, tags?: string[]|string, description?, text? }
//
// Mirrors scripts/ingest.js: chunk -> embed -> upsert resource -> replace chunks.
// Two paths:
//   - `text` provided      -> chunkText(text), type defaults to 'article', title required.
//   - `url` is a YouTube URL -> fetchMeta + fetchTranscript -> chunkSegments.
//                               If the transcript can't be fetched, returns 422 so
//                               the UI can fall back to pasting the transcript text.
//   - non-YouTube url, no text -> 400 (ask for text + title).
//
// Auth: header `x-admin-password` must equal ADMIN_PASSWORD (503 if unset, 401 if wrong).
//
// NOTE: nested under api/admin/, so shared libs are two levels up (../../lib/...).
// NOTE: long transcripts mean many embeddings + inserts, which can approach the
//       function's maxDuration (30s). Very long videos may still need the local
//       scripts/ingest.js path.
import { supabase } from '../../lib/supabase.js';
import { embed } from '../../lib/openai.js';
import { chunkText, chunkSegments } from '../../lib/chunk.js';
import { parseVideoId, fetchMeta, fetchTranscript } from '../../lib/youtube.js';

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

// Normalize tags: accept an array or a comma-separated string -> string[].
function normalizeTags(tags) {
  if (Array.isArray(tags)) return tags.map((t) => String(t).trim()).filter(Boolean);
  if (typeof tags === 'string') {
    return tags
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean);
  }
  return [];
}

export default async function handler(req, res) {
  if (!checkAuth(req, res)) return;
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const body = req.body || {};
    const url = body.url ? String(body.url).trim() : '';
    const description = body.description || null;
    const tags = normalizeTags(body.tags);

    let title = body.title ? String(body.title).trim() : null;
    let author = null;
    let type = body.type || null;
    let chunks; // [{ content, start_time? }]

    if (body.text && String(body.text).trim()) {
      // Manual / pasted-text path.
      chunks = chunkText(String(body.text));
      type = type || 'article';
      if (!title) {
        return res.status(400).json({ error: 'A title is required when providing text.' });
      }
    } else if (url && parseVideoId(url)) {
      // YouTube path.
      const meta = await fetchMeta(url);
      title = title || meta.title;
      author = meta.author;
      type = type || 'video';

      let segs;
      try {
        segs = await fetchTranscript(url);
      } catch (err) {
        return res.status(422).json({
          error:
            'Could not fetch a transcript automatically (YouTube may block server requests). Paste the transcript text instead.',
        });
      }
      if (!segs || !segs.length) {
        return res.status(422).json({
          error:
            'Could not fetch a transcript automatically (YouTube may block server requests). Paste the transcript text instead.',
        });
      }
      chunks = chunkSegments(segs);
    } else if (url) {
      // Non-YouTube URL with no text.
      return res.status(400).json({
        error:
          'For non-YouTube links, paste the article/transcript text and provide a title.',
      });
    } else {
      return res.status(400).json({ error: 'Provide a URL or text, plus a title.' });
    }

    if (!chunks || !chunks.length) {
      return res.status(400).json({ error: 'Nothing to ingest — no content found.' });
    }
    if (!title) {
      return res.status(400).json({ error: 'A title is required.' });
    }

    // Embed all chunk contents.
    const vectors = await embed(chunks.map((c) => c.content));

    // Upsert the resource (url is unique). Replace its chunks if re-ingesting.
    const { data: resource, error: rErr } = await supabase
      .from('resources')
      .upsert(
        { title, type, url: url || null, description, author, tags },
        { onConflict: 'url' }
      )
      .select()
      .single();
    if (rErr) throw rErr;

    await supabase.from('chunks').delete().eq('resource_id', resource.id);

    const rows = chunks.map((c, i) => ({
      resource_id: resource.id,
      content: c.content,
      start_time: c.start_time ?? null,
      embedding: vectors[i],
    }));

    const BATCH = 100;
    for (let i = 0; i < rows.length; i += BATCH) {
      const { error: cErr } = await supabase.from('chunks').insert(rows.slice(i, i + BATCH));
      if (cErr) throw cErr;
    }

    return res
      .status(200)
      .json({ ok: true, resource: { id: resource.id, title: resource.title }, chunks: rows.length });
  } catch (err) {
    console.error('admin/ingest error:', err);
    return res.status(500).json({ error: 'Something went wrong while ingesting.' });
  }
}
