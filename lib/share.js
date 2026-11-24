// Shareable answer links. A share token is "<chat_logs id>.<signature>", so a
// link opens exactly one answer and ids cannot be walked to read other
// people's questions. The signing key is SHARE_SECRET when set, otherwise one
// derived from the service-role key (never exposed: only an HMAC of it is).
import { createHmac, timingSafeEqual } from 'node:crypto';

function key() {
  const secret = process.env.SHARE_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY;
  return secret ? createHmac('sha256', secret).update('gospelandai share link v1').digest() : null;
}

function sign(id, k) {
  return createHmac('sha256', k).update(String(id)).digest('base64url').slice(0, 22);
}

// Returns a token for a chat_logs id, or null if there is no key or id.
export function shareToken(id) {
  const k = key();
  if (!k || !Number.isSafeInteger(Number(id)) || Number(id) <= 0) return null;
  return `${Number(id)}.${sign(Number(id), k)}`;
}

// Returns the chat_logs id a token names, or null if it is forged or malformed.
export function verifyShareToken(token) {
  const k = key();
  const m = /^([1-9]\d{0,15})\.([A-Za-z0-9_-]{22})$/.exec(String(token || ''));
  if (!k || !m) return null;
  const want = Buffer.from(sign(m[1], k));
  const got = Buffer.from(m[2]);
  return want.length === got.length && timingSafeEqual(want, got) ? Number(m[1]) : null;
}
