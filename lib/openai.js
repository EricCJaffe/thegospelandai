// OpenAI helpers — embeddings (search) and chat (answers). Single provider.
import OpenAI from 'openai';

const apiKey = process.env.OPENAI_API_KEY;
if (!apiKey) throw new Error('Missing OPENAI_API_KEY environment variable.');

export const openai = new OpenAI({ apiKey });

export const EMBEDDING_MODEL = 'text-embedding-3-small'; // 1536 dims
export const CHAT_MODEL = process.env.CHAT_MODEL || 'gpt-4o';

// Embed an array of strings. Returns an array of vectors in the same order.
// Batched to stay well under request limits.
export async function embed(texts) {
  const inputs = Array.isArray(texts) ? texts : [texts];
  const vectors = [];
  const BATCH = 100;
  for (let i = 0; i < inputs.length; i += BATCH) {
    const batch = inputs.slice(i, i + BATCH);
    const res = await openai.embeddings.create({
      model: EMBEDDING_MODEL,
      input: batch,
    });
    for (const item of res.data) vectors.push(item.embedding);
  }
  return vectors;
}
