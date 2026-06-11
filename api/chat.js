// POST /api/chat  { question, history?: [{role, content}] }
// -> { answer, resources: [{ title, url, type, reason }] }
//
// Flow: embed the question -> semantic search over transcript chunks ->
// ask the model to answer in the "Anchored" voice and pick relevant resources.
import { supabase } from '../lib/supabase.js';
import { openai, embed, CHAT_MODEL } from '../lib/openai.js';
import { checkRateLimit, clientIp } from '../lib/ratelimit.js';

const SYSTEM_PROMPT = `You are "Anchored", the AI companion for the book "Anchored in the Storm: A Christian Guide to Thriving in the Age of AI" by Eric Jaffe.

Voice: warm, grounded, pastoral, and direct. Anchor answers in Scripture and the hope of the Gospel, not generic AI commentary. Be concise — a few short paragraphs at most.

You are given excerpts retrieved from a curated resource library (video transcripts and articles). Use them to inform your answer when relevant. Then recommend the most relevant resources to the reader.

Rules:
- Only recommend resources that appear in the provided CONTEXT. Never invent URLs or titles.
- If the context does not contain anything relevant, still answer the question helpfully from a Christian worldview, and return an empty "resources" array.
- Respond ONLY with a JSON object of this exact shape:
  { "answer": string, "resources": [ { "url": string, "reason": string } ] }
  where each "url" exactly matches a resource url from the context and "reason" is one short sentence on why it helps.`;

function setCors(res) {
  // Open CORS so the chat can be embedded on partner sites/documents (Phase 2).
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

export default async function handler(req, res) {
  setCors(res);
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { question, history = [] } = req.body || {};
    if (!question || typeof question !== 'string') {
      return res.status(400).json({ error: 'Missing "question".' });
    }
    if (question.length > 1000) {
      return res.status(400).json({ error: 'Question is too long.' });
    }

    // 0. Rate limit by IP (fail-open if Upstash isn't configured).
    const { success, retryAfter } = await checkRateLimit(clientIp(req));
    if (!success) {
      res.setHeader('Retry-After', String(retryAfter));
      return res.status(429).json({
        error: "You've asked a lot of questions in a short time. Please wait a moment and try again.",
      });
    }

    // 1. Semantic search.
    const [queryEmbedding] = await embed(question);
    const { data: matches, error } = await supabase.rpc('match_chunks', {
      query_embedding: queryEmbedding,
      match_count: 6,
    });
    if (error) throw error;

    // 2. Build context + a lookup of candidate resources (deduped by url).
    const byUrl = new Map();
    const contextBlocks = [];
    for (const m of matches || []) {
      contextBlocks.push(
        `[Resource: ${m.title}]\nURL: ${m.url}\nExcerpt: ${m.content}`
      );
      if (!byUrl.has(m.url)) {
        byUrl.set(m.url, {
          title: m.title,
          url: m.url,
          type: m.type,
          start_time: m.start_time,
        });
      }
    }
    const context = contextBlocks.join('\n\n---\n\n') || '(no resources found)';

    // 3. Ask the model.
    const messages = [
      { role: 'system', content: SYSTEM_PROMPT },
      ...history.slice(-6),
      { role: 'user', content: `Question: ${question}\n\nCONTEXT:\n${context}` },
    ];
    const completion = await openai.chat.completions.create({
      model: CHAT_MODEL,
      messages,
      temperature: 0.5,
      response_format: { type: 'json_object' },
    });

    let parsed;
    try {
      parsed = JSON.parse(completion.choices[0].message.content);
    } catch {
      parsed = { answer: completion.choices[0].message.content, resources: [] };
    }

    // 4. Map the model's picks back to full resource objects (deep-link videos).
    const resources = (parsed.resources || [])
      .map((pick) => {
        const r = byUrl.get(pick.url);
        if (!r) return null;
        let url = r.url;
        if (r.type === 'video' && r.start_time) {
          url += (url.includes('?') ? '&' : '?') + `t=${r.start_time}s`;
        }
        return { title: r.title, url, type: r.type, reason: pick.reason || '' };
      })
      .filter(Boolean);

    return res.status(200).json({ answer: parsed.answer || '', resources });
  } catch (err) {
    console.error('chat error:', err);
    return res.status(500).json({ error: 'Something went wrong.' });
  }
}
