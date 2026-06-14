// POST /api/chat  { question, history?: [{role, content}] }
//
// STREAMING endpoint. On success responds with Content-Type
// 'application/x-ndjson' and streams newline-delimited JSON objects:
//   {"type":"delta","content": "<chunk of answer text>"}   (zero or more, in order)
//   {"type":"meta","resources": [{title,url,type,reason}]}  (exactly once)
//   {"type":"done"}                                         (final line)
// If something fails AFTER headers are sent:
//   {"type":"error","error": "<msg>"} then end.
//
// Pre-stream failures (rate limit / validation) respond with a normal JSON body:
//   429 {error} | 400 {error} | 500 {error}.
//
// Flow: embed the question -> semantic search over transcript chunks ->
// stream a plain-text answer in the "Anchored" voice -> a small second call
// picks the most relevant resources. First-turn answers are cached.
import { supabase } from '../lib/supabase.js';
import { openai, embed, CHAT_MODEL } from '../lib/openai.js';
import { checkRateLimit, clientIp } from '../lib/ratelimit.js';
import { normalizeKey, getCached, setCached } from '../lib/cache.js';
import { logChat } from '../lib/chatlog.js';

// Plain-text answer voice (the answer is streamed as text, not JSON).
const ANSWER_SYSTEM_PROMPT = `You are "Anchored", the AI companion for the book "Anchored in the Storm: A Christian Guide to Thriving in the Age of AI" by Eric Jaffe.

Voice: warm, grounded, pastoral, and direct. Anchor answers in Scripture and the hope of the Gospel, not generic AI commentary. Be concise — a few short paragraphs at most.

You are given excerpts retrieved from a curated resource library (video transcripts and articles) in a CONTEXT section. Use them to inform your answer when relevant. If the context does not contain anything relevant, still answer the question helpfully from a Christian worldview.

Respond with a plain-text answer only — no JSON, no markdown headers, no resource list. Just the answer prose. Relevant resources are selected separately, so do not list links or recommendations yourself.`;

// Resource-selection voice (non-streamed, returns a strict JSON object).
const RESOURCE_SYSTEM_PROMPT = `You select the most relevant resources for a reader's question from a provided candidate list.

Rules:
- Only choose resources from the provided CANDIDATES. Never invent URLs or titles.
- Pick the 2-4 most relevant. If none are relevant, return an empty array.
- Each "url" must exactly match a candidate url.
- "reason" is one short sentence on why the resource helps.
- Respond ONLY with a JSON object of this exact shape:
  { "resources": [ { "url": string, "reason": string } ] }`;

function setCors(res) {
  // Open CORS so the chat can be embedded on partner sites/documents (Phase 2).
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

// Write one NDJSON line (object + '\n') and flush if the runtime supports it.
function writeLine(res, obj) {
  res.write(JSON.stringify(obj) + '\n');
  if (typeof res.flush === 'function') res.flush();
}

export default async function handler(req, res) {
  setCors(res);
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  // Track whether we've committed to the streaming response (headers sent).
  let streaming = false;

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

    const firstTurn = !Array.isArray(history) || history.length === 0;
    const cacheKey = firstTurn ? normalizeKey(question) : null;

    // 1. Cache lookup (first-turn only). On a fresh hit, serve without OpenAI.
    if (cacheKey) {
      const cached = await getCached(cacheKey);
      if (cached) {
        res.status(200);
        res.setHeader('Content-Type', 'application/x-ndjson');
        streaming = true;
        if (cached.answer) writeLine(res, { type: 'delta', content: cached.answer });
        writeLine(res, { type: 'meta', resources: cached.resources });
        writeLine(res, { type: 'done' });
        res.end();
        logChat({
          question,
          answer: cached.answer,
          resourceUrls: cached.resources.map((r) => r.url).filter(Boolean),
        });
        return;
      }
    }

    // 2. Semantic search.
    const [queryEmbedding] = await embed(question);
    const { data: matches, error } = await supabase.rpc('match_chunks', {
      query_embedding: queryEmbedding,
      match_count: 6,
    });
    if (error) throw error;

    // 3. Build context + a lookup of candidate resources (deduped by url).
    const byUrl = new Map();
    const contextBlocks = [];
    for (const m of matches || []) {
      contextBlocks.push(`[Resource: ${m.title}]\nURL: ${m.url}\nExcerpt: ${m.content}`);
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

    // 4. ANSWER call (streamed plain text). Commit to the NDJSON response.
    res.status(200);
    res.setHeader('Content-Type', 'application/x-ndjson');
    streaming = true;

    const answerMessages = [
      { role: 'system', content: ANSWER_SYSTEM_PROMPT },
      ...history.slice(-6),
      { role: 'user', content: `Question: ${question}\n\nCONTEXT:\n${context}` },
    ];
    const stream = await openai.chat.completions.create({
      model: CHAT_MODEL,
      messages: answerMessages,
      temperature: 0.5,
      stream: true,
    });

    let answer = '';
    for await (const part of stream) {
      const token = part.choices?.[0]?.delta?.content;
      if (token) {
        answer += token;
        writeLine(res, { type: 'delta', content: token });
      }
    }

    // 5. RESOURCE-SELECTION call (non-streamed JSON over the candidate list).
    let resources = [];
    const candidates = [...byUrl.values()].map((r) => ({ title: r.title, url: r.url }));
    if (candidates.length > 0) {
      try {
        const pickCompletion = await openai.chat.completions.create({
          model: CHAT_MODEL,
          temperature: 0.3,
          response_format: { type: 'json_object' },
          messages: [
            { role: 'system', content: RESOURCE_SYSTEM_PROMPT },
            {
              role: 'user',
              content:
                `Question: ${question}\n\n` +
                `CANDIDATES:\n${JSON.stringify(candidates, null, 2)}`,
            },
          ],
        });
        let picks = [];
        try {
          picks = JSON.parse(pickCompletion.choices[0].message.content).resources || [];
        } catch {
          picks = [];
        }
        resources = picks
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
      } catch (pickErr) {
        // Resource selection is best-effort — never fail the whole answer for it.
        console.error('resource selection error:', pickErr);
        resources = [];
      }
    }

    // 6. Emit meta + done.
    writeLine(res, { type: 'meta', resources });
    writeLine(res, { type: 'done' });
    res.end();

    // 7. Cache (first-turn only) + fire-and-forget logging. Do not block end().
    if (cacheKey) setCached(cacheKey, question, answer, resources);
    logChat({
      question,
      answer,
      resourceUrls: resources.map((r) => r.url).filter(Boolean),
    });
    return;
  } catch (err) {
    console.error('chat error:', err);
    if (streaming) {
      // Headers already sent — emit an in-band error line and end the stream.
      try {
        writeLine(res, { type: 'error', error: 'Something went wrong.' });
      } catch {
        /* socket may be gone */
      }
      return res.end();
    }
    return res.status(500).json({ error: 'Something went wrong.' });
  }
}
