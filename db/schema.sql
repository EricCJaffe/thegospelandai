-- The Gospel and AI — resource library schema
-- Run this once against your Supabase project (SQL Editor, or psql with the
-- connection string). Safe to re-run: uses IF NOT EXISTS / CREATE OR REPLACE.

-- 1. pgvector extension (semantic search)
create extension if not exists vector with schema extensions;

-- Ensure the vector type and its operators (<=>) resolve while this script runs.
set search_path = public, extensions;

-- 2. Resources: one row per video / article / PDF / sermon
create table if not exists public.resources (
  id          bigint generated always as identity primary key,
  title       text not null,
  type        text not null default 'video',      -- video | article | pdf | sermon
  url         text not null unique,
  description text,
  author      text,
  tags        text[] default '{}',
  added_at    timestamptz not null default now()
);

-- 3. Chunks: transcript / text split into ~500-word pieces, each embedded.
--    text-embedding-3-small produces 1536-dimension vectors.
create table if not exists public.chunks (
  id          bigint generated always as identity primary key,
  resource_id bigint not null references public.resources(id) on delete cascade,
  content     text not null,
  start_time  int,                                -- seconds into video (null for non-video)
  embedding   extensions.vector(1536)
);

-- Approximate-nearest-neighbour index (cosine distance).
create index if not exists chunks_embedding_idx
  on public.chunks using hnsw (embedding extensions.vector_cosine_ops);

create index if not exists chunks_resource_id_idx
  on public.chunks (resource_id);

-- 4. Similarity search function. Joins resource metadata so the chat endpoint
--    gets everything it needs in a single round trip. SECURITY INVOKER (default)
--    — it is only ever called server-side with the service-role key.
create or replace function public.match_chunks(
  query_embedding extensions.vector(1536),
  match_count int default 6
)
returns table (
  chunk_id    bigint,
  resource_id bigint,
  title       text,
  url         text,
  type        text,
  content     text,
  start_time  int,
  similarity  float
)
language sql
stable
set search_path = public, extensions
as $$
  select
    c.id,
    r.id,
    r.title,
    r.url,
    r.type,
    c.content,
    c.start_time,
    1 - (c.embedding <=> query_embedding) as similarity
  from public.chunks c
  join public.resources r on r.id = c.resource_id
  order by c.embedding <=> query_embedding
  limit match_count;
$$;

-- 5. Row Level Security. The browser never talks to Postgres directly — all
--    access is through Vercel Functions using the service-role key (which
--    bypasses RLS). We still enable RLS as defense-in-depth so that even a
--    leaked anon key grants no access. No anon/authenticated policies = no
--    public row access.
alter table public.resources enable row level security;
alter table public.chunks    enable row level security;

-- 6. Subscribers: email capture for newsletter / launch list.
create table if not exists public.subscribers (
  id         bigint generated always as identity primary key,
  email      text unique not null,
  source     text,                                    -- e.g. 'landing_page', 'chat_widget'
  created_at timestamptz not null default now()
);

-- 7. Chat logs: every question/answer pair for analytics and fine-tuning.
create table if not exists public.chat_logs (
  id             bigint generated always as identity primary key,
  question       text,
  answer         text,
  resource_urls  text[],                              -- urls of sources surfaced in the answer
  created_at     timestamptz not null default now()
);

create index if not exists chat_logs_created_at_idx
  on public.chat_logs (created_at desc);

-- 8. Feedback: thumbs-up / thumbs-down on individual answers.
create table if not exists public.feedback (
  id             bigint generated always as identity primary key,
  question       text,
  answer         text,
  rating         text not null check (rating in ('up', 'down')),
  resource_urls  text[],
  created_at     timestamptz not null default now()
);

create index if not exists feedback_created_at_idx
  on public.feedback (created_at desc);

-- 9. Answer cache: keyed by a normalised question hash so repeated questions
--    skip the embedding + LLM round trip.
create table if not exists public.answer_cache (
  id            bigint generated always as identity primary key,
  question_key  text unique not null,                 -- normalised / hashed lookup key
  question      text,
  answer        text,
  resources     jsonb,                                -- serialised resource metadata
  created_at    timestamptz not null default now()
);

-- Row Level Security for sections 6-9. Same rationale as sections 2-3 above:
-- all access is server-side via the service-role key (bypasses RLS). No
-- policies means a leaked anon key still grants zero row access.
alter table public.subscribers  enable row level security;
alter table public.chat_logs    enable row level security;
alter table public.feedback     enable row level security;
alter table public.answer_cache enable row level security;
