# The Gospel and AI

Landing page + AI resource library for *Anchored in the Storm* — a Christian guide to thriving in the age of AI, by Eric Jaffe.

🌐 **thegospelandai.com**

## What's here

- **Static landing page** (`index.html`) with a **live AI companion** — ask a question and get a Scripture-grounded answer plus the most relevant resources.
- **Resource library** (`resources.html`) — a browsable, searchable catalog of videos, articles, and talks.
- **Embeddable widget** (`widget.js` + `embed.html`) — a one-line `<script>` that drops the chat onto any third-party site, isolated in a shadow DOM.
- **Semantic search backend** — questions are matched against video transcripts and article text by meaning (RAG), powered by OpenAI embeddings + Supabase pgvector, with answers from OpenAI chat.
- **Rate limiting** — `/api/chat` is IP-rate-limited via Upstash Redis (fail-open if not configured).

## Architecture

```
Resources (YouTube, articles)
   │  scripts/ingest.js  — fetch transcript, chunk, embed
   ▼
Supabase Postgres + pgvector  (resources + chunks tables)
   ▲
   │  user asks a question
   ▼
/api/chat  — embed question → match_chunks() → OpenAI answers + picks resources
/api/resources — lists the library
   ▲
   │
index.html (companion) + resources.html (library)
```

All database access is **server-side only** (Vercel Functions using the Supabase service-role key). No secrets reach the browser.

## Setup

### 1. Environment variables

Copy `.env.example` to `.env` and fill in:

- `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` — Supabase → Project Settings → API
- `OPENAI_API_KEY` — platform.openai.com/api-keys
- `CHAT_MODEL` (optional, default `gpt-4o`)

Add the same three variables in the Vercel dashboard (Project → Settings → Environment Variables) for production.

**Rate limiting (recommended):** provision Upstash Redis via the Vercel Marketplace (Project → Integrations → Upstash). It auto-injects `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` into all environments. Until then, `/api/chat` runs without rate limiting (fail-open). Current limits: 12 requests/min and 250/day per IP (see `lib/ratelimit.js`).

## Embeddable widget

Any site can embed the chat with one line:

```html
<script src="https://thegospelandai.vercel.app/widget.js" async></script>
```

Optional `data-` attributes: `data-title`, `data-accent`, `data-position` (`right`/`left`), `data-greeting`. See `/embed.html` for the full guide and a live preview. The widget calls `/api/chat` cross-origin (CORS is open) and renders in a shadow DOM so it can't collide with host-page CSS.

### 2. Database

Run `db/schema.sql` once against your Supabase project (SQL Editor, or `psql`). It creates the `resources` and `chunks` tables, the pgvector index, and the `match_chunks()` search function.

### 3. Install + ingest resources

```bash
npm install

# Add a YouTube video (transcript fetched automatically):
node --env-file=.env scripts/ingest.js "https://www.youtube.com/watch?v=dLrvJeSugkM" --tags "ai,faith,work"

# Add an article or anything without auto-captions:
node --env-file=.env scripts/ingest.js "https://example.com/post" --text transcript.txt --title "Post title" --type article
```

## Development

```bash
npm run dev          # vercel dev — serves the static site + /api functions locally
```

Or for static-only preview (no API): `python3 -m http.server 8000`.

## Deployment

Deployed on [Vercel](https://vercel.com). Pushes to `main` deploy automatically. Make sure the environment variables are set in the Vercel dashboard.
