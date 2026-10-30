// Generated from the shared TS adapter (claude.ts). Keep in sync.
/**
 * Claude (Anthropic) adapter for code that was written against OpenAI's
 * chat-completions shape. It takes the same request body (model, messages,
 * max_tokens, response_format) and returns the same response shape
 * (choices[0].message.content, finish_reason, usage), so call sites move
 * across with minimal change. OpenAI model ids are mapped to Claude:
 * "*-mini"/"*-nano" -> fast model, anything else -> smart model.
 *
 * Embeddings, audio (Whisper), moderation and images are NOT handled here:
 * Anthropic has no equivalent, so those calls still go to OpenAI.
 */
import Anthropic from '@anthropic-ai/sdk';
export const CLAUDE_SMART_MODEL = process.env.ANTHROPIC_MODEL || 'claude-sonnet-5-5';
export const CLAUDE_FAST_MODEL = process.env.ANTHROPIC_FAST_MODEL || 'claude-haiku-5-5';
let _client = null;
export function getAnthropic() {
    if (!process.env.ANTHROPIC_API_KEY)
        throw new Error('ANTHROPIC_API_KEY not configured');
    if (!_client)
        _client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    return _client;
}
export function claudeModel(model) {
    if (!model)
        return CLAUDE_SMART_MODEL;
    if (model.startsWith('claude'))
        return model;
    return /mini|nano|3\.5/i.test(model) ? CLAUDE_FAST_MODEL : CLAUDE_SMART_MODEL;
}
function toText(content) {
    if (typeof content === 'string')
        return content;
    if (Array.isArray(content))
        return content.map((p) => (typeof p === 'string' ? p : p?.text ?? '')).join('\n');
    return String(content ?? '');
}
function toBlocks(content) {
    if (typeof content === 'string')
        return content;
    if (!Array.isArray(content))
        return String(content ?? '');
    return content.map((p) => {
        if (p?.type === 'image_url' || p?.type === 'input_image') {
            const url = typeof p.image_url === 'string' ? p.image_url : p.image_url?.url;
            const m = /^data:([^;]+);base64,([\s\S]*)$/.exec(url || '');
            if (m) {
                if (m[1] === 'application/pdf') {
                    return { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: m[2] } };
                }
                return { type: 'image', source: { type: 'base64', media_type: m[1], data: m[2] } };
            }
            return { type: 'image', source: { type: 'url', url } };
        }
        if (p?.type === 'file' || p?.type === 'input_file') {
            const data = p.file?.file_data ?? p.file_data ?? '';
            const m = /^data:([^;]+);base64,([\s\S]*)$/.exec(data);
            return { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: m ? m[2] : data } };
        }
        return { type: 'text', text: typeof p === 'string' ? p : p?.text ?? '' };
    });
}
function extractJson(text) {
    const t = text.trim().replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '').trim();
    if (/^[[{]/.test(t))
        return t;
    const s = t.search(/[[{]/);
    const e = Math.max(t.lastIndexOf('}'), t.lastIndexOf(']'));
    return s >= 0 && e > s ? t.slice(s, e + 1) : t;
}
export async function chatCompletion(req) {
    const wantsJson = !!req.response_format && req.response_format.type !== 'text';
    const systemParts = req.messages.filter((m) => m.role === 'system' || m.role === 'developer').map((m) => toText(m.content));
    if (wantsJson) {
        const schema = req.response_format?.json_schema?.schema;
        systemParts.push('Respond with a single valid JSON value only: no prose, no markdown, no code fences.' +
            (schema ? `\nIt must match this JSON schema: ${JSON.stringify(schema)}` : ''));
    }
    const messages = req.messages
        .filter((m) => m.role === 'user' || m.role === 'assistant')
        .map((m) => ({ role: m.role, content: toBlocks(m.content) }));
    if (messages.length === 0)
        messages.push({ role: 'user', content: 'Begin.' });
    const res = await getAnthropic().messages.create({
        model: claudeModel(req.model),
        max_tokens: req.max_tokens ?? req.max_completion_tokens ?? 8192,
        ...(systemParts.length ? { system: systemParts.join('\n\n') } : {}),
        messages,
    });
    let text = res.content.filter((b) => b.type === 'text').map((b) => b.text).join('');
    if (wantsJson)
        text = extractJson(text);
    const u = res.usage;
    return {
        id: res.id,
        model: res.model,
        choices: [
            {
                index: 0,
                message: { role: 'assistant', content: text },
                finish_reason: res.stop_reason === 'max_tokens' ? 'length' : 'stop',
            },
        ],
        usage: {
            prompt_tokens: u?.input_tokens ?? 0,
            completion_tokens: u?.output_tokens ?? 0,
            total_tokens: (u?.input_tokens ?? 0) + (u?.output_tokens ?? 0),
        },
    };
}
/** Object with the OpenAI client's `chat.completions.create` shape. */
export const claude = { chat: { completions: { create: chatCompletion } } };
/**
 * Drop-in for `fetch('https://api.openai.com/v1/chat/completions', init)`:
 * reads the JSON body from `init`, calls Claude, and returns a Response whose
 * JSON is OpenAI-shaped. Errors come back as a non-ok Response with
 * `{ error: { message } }`, as OpenAI's did.
 */
export async function claudeChatFetch(_url, init) {
    try {
        const body = typeof init.body === 'string' ? JSON.parse(init.body) : init.body;
        const out = await chatCompletion(body);
        return new Response(JSON.stringify(out), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }
    catch (err) {
        const status = typeof err?.status === 'number' ? err.status : 500;
        return new Response(JSON.stringify({ error: { message: err?.message ?? String(err) } }), {
            status,
            headers: { 'Content-Type': 'application/json' },
        });
    }
}
