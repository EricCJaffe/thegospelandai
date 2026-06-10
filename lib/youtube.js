// YouTube helpers: fetch title/author (oEmbed, no API key) and the transcript.
import { YoutubeTranscript } from 'youtube-transcript';

export function parseVideoId(url) {
  const m = url.match(/(?:v=|youtu\.be\/|\/embed\/|\/shorts\/)([\w-]{11})/);
  return m ? m[1] : null;
}

// Title + author via the public oEmbed endpoint (reliable, no key required).
export async function fetchMeta(url) {
  const res = await fetch(
    `https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`
  );
  if (!res.ok) return { title: null, author: null };
  const data = await res.json();
  return { title: data.title || null, author: data.author_name || null };
}

// Returns [{ text, start }] with start in SECONDS.
// youtube-transcript reports `offset` in milliseconds — we convert to seconds.
export async function fetchTranscript(url) {
  const items = await YoutubeTranscript.fetchTranscript(url);
  return items.map((it) => ({
    text: it.text,
    start: (it.offset ?? 0) / 1000,
  }));
}
