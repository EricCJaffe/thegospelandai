// Normalize a question into a stable key: lowercase, trim, collapse internal
// whitespace, and strip trailing punctuation. Pure (no Supabase import), so
// insights and tests can use it without credentials.
export function normalizeKey(question) {
  return String(question || '')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/[\s\p{P}]+$/u, '')
    .trim();
}
