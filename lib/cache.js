// Answer caching for the chat endpoint, backed by the Supabase 'answer_cache' table.
//
// Table shape (columns):
//   question_key text unique, question text, answer text,
//   resources jsonb, created_at timestamptz default now()
//
// Cache is only consulted for first-turn questions (empty history). All errors
// are swallowed by the callers — caching must never break the response.

import { supabase } from './supabase.js';

const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

// Normalize a question into a stable cache key: lowercase, trim, collapse
// internal whitespace, and strip trailing punctuation.
export function normalizeKey(question) {
  return String(question || '')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/[\s\p{P}]+$/u, '')
    .trim();
}

// Look up a cached answer by key. Returns { answer, resources, created_at } on a
// fresh hit (within the TTL), or null on miss / stale / error.
export async function getCached(key) {
  if (!key) return null;
  try {
    const { data, error } = await supabase
      .from('answer_cache')
      .select('answer, resources, created_at')
      .eq('question_key', key)
      .maybeSingle();
    if (error) throw error;
    if (!data) return null;

    const createdAt = new Date(data.created_at).getTime();
    if (!Number.isFinite(createdAt) || Date.now() - createdAt > CACHE_TTL_MS) {
      return null; // stale — treat as a miss so we regenerate
    }
    return {
      answer: data.answer || '',
      resources: Array.isArray(data.resources) ? data.resources : [],
      created_at: data.created_at,
    };
  } catch (err) {
    console.error('cache get error:', err);
    return null;
  }
}

// Upsert a generated answer into the cache. Swallows all errors.
export async function setCached(key, question, answer, resources) {
  if (!key) return;
  try {
    const { error } = await supabase
      .from('answer_cache')
      .upsert(
        {
          question_key: key,
          question,
          answer,
          resources: resources || [],
          created_at: new Date().toISOString(),
        },
        { onConflict: 'question_key' }
      );
    if (error) throw error;
  } catch (err) {
    console.error('cache set error:', err);
  }
}
