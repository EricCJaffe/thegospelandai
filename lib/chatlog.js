// Fire-and-forget chat logging, backed by the Supabase 'chat_logs' table.
//
// Table shape (columns):
//   question text, answer text, resource_urls text[], created_at timestamptz
//
// Logging must never delay or break the response: callers should NOT await this
// in a way that blocks res.end(), and all errors are swallowed here.

import { supabase } from './supabase.js';

// Insert one chat interaction. Returns a promise that always resolves; never
// throws. resourceUrls is an array of strings (urls of recommended resources).
export async function logChat({ question, answer, resourceUrls = [] }) {
  try {
    const { error } = await supabase.from('chat_logs').insert({
      question: question || '',
      answer: answer || '',
      resource_urls: Array.isArray(resourceUrls) ? resourceUrls : [],
    });
    if (error) throw error;
  } catch (err) {
    console.error('chatlog error:', err);
  }
}
