#!/usr/bin/env node
// Ingest a resource into the library: fetch transcript/text, chunk, embed, store.
// Run locally (not in serverless) so YouTube fetches come from a residential IP
// and there are no function timeouts.
//
// Usage:
//   node scripts/ingest.js <youtube-url> [--tags "ai,faith,work"]
//   node scripts/ingest.js <url> --text path/to/transcript.txt --title "..." [--type article]
//
// Requires env vars (put them in a local .env and load with: node --env-file=.env scripts/ingest.js ...)
//   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, OPENAI_API_KEY
import { readFileSync } from 'node:fs';
import { supabase } from '../lib/supabase.js';
import { embed } from '../lib/openai.js';
import { chunkText, chunkSegments } from '../lib/chunk.js';
import { parseVideoId, fetchMeta, fetchTranscript } from '../lib/youtube.js';

function parseArgs(argv) {
  const args = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) args[a.slice(2)] = argv[++i];
    else args._.push(a);
  }
  return args;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const url = args._[0];
  if (!url) {
    console.error('Usage: node scripts/ingest.js <url> [--tags "a,b"] [--text file] [--title "..."] [--type video|article]');
    process.exit(1);
  }

  const tags = (args.tags || '')
    .split(',')
    .map((t) => t.trim())
    .filter(Boolean);

  let title = args.title || null;
  let author = args.author || null;
  let type = args.type || 'video';
  let chunks; // [{ content, start_time? }]

  if (args.text) {
    // Manual / non-video path: read text from a file.
    const text = readFileSync(args.text, 'utf8');
    chunks = chunkText(text);
    type = args.type || 'article';
    if (!title) {
      console.error('--title is required when using --text');
      process.exit(1);
    }
  } else {
    // YouTube path.
    const videoId = parseVideoId(url);
    if (!videoId) {
      console.error('Could not parse a YouTube video id from the URL. For non-YouTube resources, pass --text and --title.');
      process.exit(1);
    }
    const meta = await fetchMeta(url);
    title = title || meta.title;
    author = author || meta.author;
    console.log(`→ ${title}${author ? ' — ' + author : ''}`);

    let segs;
    try {
      segs = await fetchTranscript(url);
    } catch (err) {
      console.error('\nFailed to fetch transcript automatically:', err.message);
      console.error('Fallback: save the transcript to a .txt file and re-run with --text <file> --title "..."');
      process.exit(1);
    }
    if (!segs.length) {
      console.error('Transcript was empty. Use the --text fallback.');
      process.exit(1);
    }
    chunks = chunkSegments(segs);
  }

  console.log(`→ ${chunks.length} chunks, embedding...`);
  const vectors = await embed(chunks.map((c) => c.content));

  // Upsert the resource (url is unique). Replace its chunks if re-ingesting.
  const { data: resource, error: rErr } = await supabase
    .from('resources')
    .upsert(
      { title, type, url, description: args.description || null, author, tags },
      { onConflict: 'url' }
    )
    .select()
    .single();
  if (rErr) throw rErr;

  await supabase.from('chunks').delete().eq('resource_id', resource.id);

  const rows = chunks.map((c, i) => ({
    resource_id: resource.id,
    content: c.content,
    start_time: c.start_time ?? null,
    embedding: vectors[i],
  }));

  // Insert in batches to keep request sizes sane.
  const BATCH = 100;
  for (let i = 0; i < rows.length; i += BATCH) {
    const { error: cErr } = await supabase.from('chunks').insert(rows.slice(i, i + BATCH));
    if (cErr) throw cErr;
  }

  console.log(`✓ Ingested "${title}" (resource #${resource.id}, ${rows.length} chunks)`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
