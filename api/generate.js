// Vercel serverless function: notes in, content pool out.
// The API key lives only in the Vercel project's environment (ANTHROPIC_API_KEY);
// it never reaches the browser.

import Anthropic from '@anthropic-ai/sdk';
import { jsonPrompt, userPrompt, toPool, parseAnswer } from '../src/engine/content.js';
import { occasionById } from '../src/library/occasions.js';

export const config = { maxDuration: 120 };

export const MODEL = 'claude-opus-5-5';
const MAX_NOTES = 15000;
const PER_HOUR = 6; // decks per visitor per hour (best effort: per server instance)

/** The key from the environment, without stray spaces or quotes that come along when pasting. */
export const apiKey = () => String(process.env.ANTHROPIC_API_KEY ?? '').trim().replace(/^["']|["']$/g, '');

/** The key's public format marker, for diagnosis: its first 12 characters, or what kind of text it is. */
const keyMarker = () => {
  const k = apiKey();
  return k.startsWith('sk-ant-') ? k.slice(0, 12) : /^[A-Za-z0-9_-]+$/.test(k) ? `${k.length} chars, no sk-ant- prefix` : 'contains spaces or symbols';
};

/** Ask Claude for the deck content. `client` is injectable for tests. */
export async function writeDeck(notes, occasionId, client = new Anthropic({ apiKey: apiKey() })) {
  const occasion = occasionById(occasionId);
  // Claude answers with JSON in the shape the prompt shows; toPool() checks and cleans it
  // (a strict output grammar for this many slide types is larger than the API allows)
  const response = await client.beta.messages.create({
    model: MODEL,
    max_tokens: 16000,
    betas: ['server-side-fallback-2026-07-01'],
    fallbacks: 'default', // on a policy decline the API retries on a fallback model in the same call
    system: jsonPrompt(),
    messages: [{ role: 'user', content: userPrompt(notes, occasion.name) }],
    output_config: { effort: 'low' },
  });
  if (response.stop_reason === 'refusal') {
    const err = new Error('Claude declined to write slides for these notes.');
    err.status = 422;
    throw err;
  }
  if (response.stop_reason === 'max_tokens') {
    const err = new Error('The notes produced too much content. Try shorter notes.');
    err.status = 502;
    throw err;
  }
  const text = response.content.filter((b) => b.type === 'text').map((b) => b.text).join('\n');
  let answer;
  try { answer = parseAnswer(text); } catch {
    const err = new Error('The answer could not be read. Please try again.');
    err.status = 502;
    throw err;
  }
  return toPool(answer);
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
  if (!apiKey()) { res.status(503).json({ error: 'The writing step is not set up on this server yet.' }); return; }
  if (!apiKey().startsWith('sk-ant-')) {
    // only the public format marker is logged (e.g. "sk-ant-api03"), never the secret part
    console.error('generate: ANTHROPIC_API_KEY has an unexpected format', { marker: keyMarker(), length: apiKey().length });
    res.status(503).json({ error: 'The key on the server does not look like an Anthropic API key (it should start with sk-ant-).' });
    return;
  }
  const { notes, occasion } = req.body ?? {};
  const text = typeof notes === 'string' ? notes.trim() : '';
  if (text.length < 40) { res.status(400).json({ error: 'Add a few more notes first (at least a couple of lines).' }); return; }
  if (text.length > MAX_NOTES) { res.status(413).json({ error: `Notes are limited to ${MAX_NOTES.toLocaleString('en')} characters.` }); return; }
  const ip = String(req.headers['x-forwarded-for'] ?? '').split(',')[0].trim() || 'unknown';
  if (limited(ip)) { res.status(429).json({ error: 'You have made several decks in the last hour. Please wait a little, or use the copy-and-paste option.' }); return; }
  try {
    const pool = await writeDeck(text, occasion);
    res.status(200).json({ pool });
  } catch (err) {
    const status = err instanceof Anthropic.RateLimitError ? 429
      : err instanceof Anthropic.APIError ? 502
      : err.status ?? 500;
    const message = err instanceof Anthropic.RateLimitError ? 'Claude is busy right now. Please try again in a minute.'
      : err instanceof Anthropic.AuthenticationError ? 'The writing step is not set up correctly on this server.'
      : err instanceof Anthropic.APIError ? 'Claude could not be reached. Please try again.'
      : err.message;
    console.error('generate failed', status, err?.message, err instanceof Anthropic.AuthenticationError ? { marker: keyMarker(), length: apiKey().length } : '');
    res.status(status).json({ error: message });
  }
}
