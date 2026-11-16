// Vercel serverless function: an uploaded AI-made deck in, its content and a style
// profile out. The browser sends pictures of the slides (PDF pages, screenshots) and/or
// the text and theme read from the file; Claude looks at them (src/engine/style.js).
// The key stays on the server, as in api/generate.js.

import Anthropic from '@anthropic-ai/sdk';
import { MODEL, apiKey } from './generate.js';
import { toPool, parseAnswer } from '../src/engine/content.js';
import { analysePrompt, cleanStyle } from '../src/engine/style.js';
import { occasionById } from '../src/library/occasions.js';

export const config = { maxDuration: 120 };

export const MAX_IMAGES = 10;
const MAX_IMAGE_BYTES = 4_000_000; // all pictures together, as base64 (Vercel accepts 4.5 MB per request)
const MAX_TEXT = 15000;
const PER_HOUR = 6;
const IMAGE = /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/;

/** Check the request body; returns { images, text, theme, source } or throws with a status. */
export function readBody(body) {
  const fail = (status, message) => Object.assign(new Error(message), { status });
  const b = body ?? {};
  const raw = Array.isArray(b.images) ? b.images : [];
  if (raw.length > MAX_IMAGES) throw fail(413, `Send at most ${MAX_IMAGES} slide pictures.`);
  const images = raw.map((src) => {
    const m = IMAGE.exec(String(src));
    if (!m) throw fail(400, 'A slide picture could not be read.');
    return { media_type: m[1], data: m[2] };
  });
  if (images.reduce((n, i) => n + i.data.length, 0) > MAX_IMAGE_BYTES) throw fail(413, 'The slide pictures are too large together.');
  const text = typeof b.text === 'string' ? b.text.trim() : '';
  if (text.length > MAX_TEXT) throw fail(413, `The slide text is limited to ${MAX_TEXT.toLocaleString('en')} characters.`);
  if (!images.length && text.length < 40) throw fail(400, 'The upload has no slides or text that could be read.');
  const theme = b.theme && typeof b.theme === 'object' ? {
    colors: (Array.isArray(b.theme.colors) ? b.theme.colors : []).filter((c) => /^#[0-9a-f]{6}$/i.test(c)).slice(0, 12),
    fonts: (Array.isArray(b.theme.fonts) ? b.theme.fonts : []).map((f) => String(f).slice(0, 40)).slice(0, 4),
    backgrounds: (Array.isArray(b.theme.backgrounds) ? b.theme.backgrounds : []).map((f) => String(f).slice(0, 20)).slice(0, 4),
  } : null;
  const source = ['pdf', 'pptx', 'images', 'text'].includes(b.source) ? b.source : 'images';
  // which uploaded slide each picture shows (long PDFs send a spread of pages); none for PowerPoint photos
  const pages = Array.isArray(b.pages) && b.pages.length === images.length && b.pages.every((n) => Number.isInteger(n) && n > 0 && n < 1000) ? b.pages : [];
  return { images, text, theme, source, pages };
}

/** The user message: one picture per slide, then the text and theme read from the file. */
export function userContent({ images, text, theme, source, pages = [] }, occasionName) {
  const content = [];
  images.forEach((img, i) => {
    content.push({ type: 'text', text: source === 'pptx' ? `Picture ${i + 1} used in the deck:` : `Picture of slide ${pages[i] ?? i + 1}:` });
    content.push({ type: 'image', source: { type: 'base64', ...img } });
  });
  const lines = [`Occasion: ${occasionName}`, `Uploaded as: ${source}`];
  if (theme?.colors?.length) lines.push(`Theme colours in the file: ${theme.colors.join(', ')}`);
  if (theme?.fonts?.length) lines.push(`Fonts in the file: ${theme.fonts.join(', ')}`);
  if (theme?.backgrounds?.length) lines.push(`Slide backgrounds in the file: ${theme.backgrounds.join(', ')}`);
  if (text) lines.push('', 'Text of the slides:', '"""', text, '"""');
  content.push({ type: 'text', text: lines.join('\n') });
  return content;
}

/** Ask Claude for content and style. `client` is injectable for tests. */
export async function analyseDeck(input, occasionId, client = new Anthropic({ apiKey: apiKey() })) {
  const response = await client.beta.messages.create({
    model: MODEL,
    max_tokens: 16000,
    betas: ['server-side-fallback-2026-07-01'],
    fallbacks: 'default', // on a policy decline the API retries on a fallback model in the same call
    system: analysePrompt(),
    messages: [{ role: 'user', content: userContent(input, occasionById(occasionId).name) }],
    output_config: { effort: 'medium' }, // judging a look needs a little more care than writing from notes
  });
  if (response.stop_reason === 'refusal') throw Object.assign(new Error('Claude declined to read this deck.'), { status: 422 });
  if (response.stop_reason === 'max_tokens') throw Object.assign(new Error('The deck produced too much content. Try fewer slides.'), { status: 502 });
  const text = response.content.filter((b) => b.type === 'text').map((b) => b.text).join('\n');
  let answer;
  try { answer = parseAnswer(text); } catch {
    throw Object.assign(new Error('The answer could not be read. Please try again.'), { status: 502 });
  }
  return { pool: toPool(answer.content ?? answer), style: cleanStyle(answer.style) };
}

const hits = new Map();
function limited(ip) {
  const now = Date.now();
  const recent = (hits.get(ip) ?? []).filter((t) => now - t < 3600_000);
  if (recent.length >= PER_HOUR) return true;
  recent.push(now);
  hits.set(ip, recent);
  return false;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') { res.status(405).json({ error: 'Use POST.' }); return; }
  if (!apiKey().startsWith('sk-ant-')) { res.status(503).json({ error: 'The redesign step is not set up on this server yet.' }); return; }
  let input;
  try { input = readBody(req.body); } catch (err) { res.status(err.status ?? 400).json({ error: err.message }); return; }
  const ip = String(req.headers['x-forwarded-for'] ?? '').split(',')[0].trim() || 'unknown';
  if (limited(ip)) { res.status(429).json({ error: 'You have redesigned several decks in the last hour. Please wait a little.' }); return; }
  try {
    res.status(200).json(await analyseDeck(input, req.body?.occasion));
  } catch (err) {
    const status = err instanceof Anthropic.RateLimitError ? 429 : err instanceof Anthropic.APIError ? 502 : err.status ?? 500;
    const message = err instanceof Anthropic.RateLimitError ? 'Claude is busy right now. Please try again in a minute.'
      : err instanceof Anthropic.AuthenticationError ? 'The redesign step is not set up correctly on this server.'
      : err instanceof Anthropic.APIError ? 'Claude could not be reached. Please try again.'
      : err.message;
    console.error('analyse failed', status, err?.message);
    res.status(status).json({ error: message });
  }
}
