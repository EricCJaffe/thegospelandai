// Split text into ~500-word chunks. Two entry points:
//   chunkText(text)      -> [{ content }]                 (articles, PDFs, pasted text)
//   chunkSegments(segs)  -> [{ content, start_time }]     (timed transcript segments)

const TARGET_WORDS = 500;
const OVERLAP_WORDS = 50; // small overlap keeps context across chunk boundaries

export function chunkText(text) {
  const words = text.replace(/\s+/g, ' ').trim().split(' ').filter(Boolean);
  const chunks = [];
  for (let i = 0; i < words.length; i += TARGET_WORDS - OVERLAP_WORDS) {
    const slice = words.slice(i, i + TARGET_WORDS);
    if (slice.length === 0) break;
    chunks.push({ content: slice.join(' ') });
    if (i + TARGET_WORDS >= words.length) break;
  }
  return chunks;
}

// segs: [{ text, start }] where start is seconds into the video.
// Groups consecutive segments until the chunk reaches ~TARGET_WORDS, recording
// the start time of the first segment so we can deep-link to the moment.
export function chunkSegments(segs) {
  const chunks = [];
  let buf = [];
  let bufWords = 0;
  let startTime = null;

  const flush = () => {
    if (buf.length === 0) return;
    chunks.push({
      content: buf.join(' ').replace(/\s+/g, ' ').trim(),
      start_time: startTime,
    });
    buf = [];
    bufWords = 0;
    startTime = null;
  };

  for (const seg of segs) {
    const text = (seg.text || '').replace(/\s+/g, ' ').trim();
    if (!text) continue;
    if (startTime === null) startTime = Math.max(0, Math.floor(seg.start));
    buf.push(text);
    bufWords += text.split(' ').length;
    if (bufWords >= TARGET_WORDS) flush();
  }
  flush();
  return chunks;
}
