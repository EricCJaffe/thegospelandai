// Server-side Supabase client. Uses the service-role key, which bypasses RLS.
// NEVER import this into browser code — the service-role key is a full-access
// secret and must stay on the server (Vercel Functions + local scripts only).
import { createClient } from '@supabase/supabase-js';

const url = process.env.SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceKey) {
  throw new Error(
    'Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variables.'
  );
}

export const supabase = createClient(url, serviceKey, {
  auth: { persistSession: false },
});
