// IP-based rate limiting for the public chat endpoint, backed by Upstash Redis.
//
// Fail-open by design: if the Upstash env vars aren't set, requests are allowed
// (with a one-time warning) so the site keeps working until you provision it.
// Provision via Vercel Marketplace → Upstash (auto-injects the two env vars):
//   UPSTASH_REDIS_REST_URL, UPSTASH_REDIS_REST_TOKEN
import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';

let burst = null; // short-window anti-spam
let daily = null; // per-IP daily spend cap
let warned = false;

const configured = () =>
  !!(process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN);

function init() {
  if (burst || !configured()) return;
  const redis = Redis.fromEnv();
  burst = new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(12, '60 s'),
    prefix: 'rl:chat:burst',
    analytics: true,
  });
  daily = new Ratelimit({
    redis,
    limiter: Ratelimit.fixedWindow(250, '1 d'),
    prefix: 'rl:chat:daily',
  });
}

export function clientIp(req) {
  const xff = req.headers['x-forwarded-for'];
  if (xff) return String(xff).split(',')[0].trim();
  return req.headers['x-real-ip'] || req.socket?.remoteAddress || 'unknown';
}

// Returns { success, retryAfter } — retryAfter is seconds until the limit resets.
export async function checkRateLimit(identifier) {
  if (!configured()) {
    if (!warned) {
      console.warn('[ratelimit] Upstash not configured — requests are NOT rate limited.');
      warned = true;
    }
    return { success: true };
  }
  init();
  for (const limiter of [burst, daily]) {
    const { success, reset } = await limiter.limit(identifier);
    if (!success) {
      return { success: false, retryAfter: Math.max(1, Math.ceil((reset - Date.now()) / 1000)) };
    }
  }
  return { success: true };
}
