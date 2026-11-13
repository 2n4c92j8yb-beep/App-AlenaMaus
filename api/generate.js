// Vercel serverless function: notes in, content pool out.
// The API key lives only in the Vercel project's environment (ANTHROPIC_API_KEY);
// it never reaches the browser.

import Anthropic from '@anthropic-ai/sdk';
import { betaZodOutputFormat } from '@anthropic-ai/sdk/helpers/beta/zod';
import * as z from 'zod/v4';
import { SYSTEM_PROMPT, userPrompt, toPool } from '../src/engine/content.js';
import { occasionById } from '../src/library/occasions.js';

export const config = { maxDuration: 120 };

export const MODEL = 'claude-opus-5-5';
const MAX_NOTES = 15000;
const PER_HOUR = 6; // decks per visitor per hour (best effort: per server instance)

const S = z.string();
const Y = z.number().int();
export const AnswerSchema = z.object({
  deck: z.object({
    title: S, shortTitle: S, subtitle: S, author: S, course: S, date: S,
    posterWords: z.array(S), posterLines: z.array(S), placeShort: S,
  }),
  claims: z.array(z.object({ text: S, role: z.enum(['thesis', 'context', 'counter', 'takeaway', 'claim']), note: S })),
  definitions: z.array(z.object({ term: S, gloss: S, text: S })),
  figures: z.array(z.object({ title: S, value: S, label: S, caption: S, source: S, year: Y })),
  pairs: z.array(z.object({ title: S, word: S, before: z.object({ text: S, label: S }), after: z.object({ text: S, label: S }), caption: S, year: Y })),
  timelines: z.array(z.object({ title: S, events: z.array(z.object({ date: S, label: S })), year: Y })),
  processes: z.array(z.object({ title: S, steps: z.array(z.object({ title: S, text: S })) })),
  comparisons: z.array(z.object({ title: S, left: z.object({ heading: S, points: z.array(S) }), right: z.object({ heading: S, points: z.array(S) }), verdict: S })),
  quotes: z.array(z.object({ text: S, author: S, work: S, note: S, year: Y })),
  questions: z.array(z.object({ text: S, hint: S, role: z.enum(['hook', 'discussion', 'task']) })),
  pointLists: z.array(z.object({ title: S, points: z.array(z.object({ head: S, text: S })) })),
  sources: z.array(S),
  pictureCaptions: z.array(z.object({ title: S, caption: S })),
});

/** The key from the environment, without stray spaces or quotes that come along when pasting. */
export const apiKey = () => String(process.env.ANTHROPIC_API_KEY ?? '').trim().replace(/^["']|["']$/g, '');

/** Ask Claude for the deck content. `client` is injectable for tests. */
export async function writeDeck(notes, occasionId, client = new Anthropic({ apiKey: apiKey() })) {
  const occasion = occasionById(occasionId);
  const response = await client.beta.messages.parse({
    model: MODEL,
    max_tokens: 16000,
    betas: ['server-side-fallback-2026-07-01'],
    fallbacks: 'default', // on a policy decline the API retries on a fallback model in the same call
    system: SYSTEM_PROMPT,
    messages: [{ role: 'user', content: userPrompt(notes, occasion.name) }],
    output_config: { effort: 'low', format: betaZodOutputFormat(AnswerSchema) },
  });
  if (response.stop_reason === 'refusal') {
    const err = new Error('Claude declined to write slides for these notes.');
    err.status = 422;
    throw err;
  }
  if (!response.parsed_output) {
    const err = new Error(response.stop_reason === 'max_tokens' ? 'The notes produced too much content. Try shorter notes.' : 'The answer could not be read.');
    err.status = 502;
    throw err;
  }
  return toPool(response.parsed_output);
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
  if (!apiKey().startsWith('sk-ant-api')) {
    // only the public prefix is checked; the key itself is never logged or returned
    console.error('generate: ANTHROPIC_API_KEY does not start with sk-ant-api');
    res.status(503).json({ error: 'The key on the server does not look like an Anthropic API key (it should start with sk-ant-api).' });
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
    console.error('generate failed', status, err?.message);
    res.status(status).json({ error: message });
  }
}
