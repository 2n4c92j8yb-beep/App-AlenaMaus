// Vercel serverless function: written content in, the art director's decisions out.
// A second, separate call after api/generate.js, so each stays well inside its time limit
// and the app can show progress between the two. The model decides; src/engine/director.js
// checks and repairs the answer before anything is drawn.

import Anthropic from '@anthropic-ai/sdk';
import { MODEL, apiKey } from './generate.js';
import { jsonPrompt, userPrompt, toSpec, briefOf } from '../src/engine/director.js';
import { parseAnswer } from '../src/engine/content.js';

export const config = { maxDuration: 120 };

// Judgement matters in this step, so it starts at medium; compare before lowering it.
export const EFFORT = 'medium';
// A deck is counted once, by the writing step. Takes ("Another take") have their own, wider
// limit per visitor per hour (best effort: per server instance, like api/generate.js).
const TAKES_PER_HOUR = 30;

/** Ask Claude for the design decisions. Returns the checked spec. `client` is injectable for tests. */
export async function directDeck({ pool, occasionId, formality = 'neutral', avoid = [], seed } = {}, client = new Anthropic({ apiKey: apiKey() })) {
  const brief = briefOf(pool);
  const options = { occasionId, formality, avoid: (Array.isArray(avoid) ? avoid : []).filter((id) => typeof id === 'string').slice(0, 40), seed };
  const response = await client.beta.messages.create({
    model: MODEL,
    max_tokens: 8000,
    betas: ['server-side-fallback-2026-07-01'],
    fallbacks: 'default', // on a policy decline the API retries on a fallback model in the same call
    system: jsonPrompt(),
    messages: [{ role: 'user', content: userPrompt(brief, options) }],
    output_config: { effort: EFFORT },
  });
  const fail = (message, status) => { const err = new Error(message); err.status = status; return err; };
  if (response.stop_reason === 'refusal') throw fail('Claude declined to make design decisions for this content.', 422);
  if (response.stop_reason === 'max_tokens') throw fail('The design decisions came back incomplete.', 502);
  const text = response.content.filter((b) => b.type === 'text').map((b) => b.text).join('\n');
  let answer;
  try { answer = parseAnswer(text); } catch { throw fail('The design decisions could not be read.', 502); }
  try { return toSpec(answer, brief, options); } catch (err) { throw fail(err.message, 502); }
}

const hits = new Map();
function limited(ip) {
  const now = Date.now();
  const recent = (hits.get(ip) ?? []).filter((t) => now - t < 3600_000);
  if (recent.length >= TAKES_PER_HOUR) return true;
  recent.push(now);
  hits.set(ip, recent);
  return false;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') { res.status(405).json({ error: 'Use POST.' }); return; }
  if (!apiKey().startsWith('sk-ant-')) { res.status(503).json({ error: 'The design step is not set up on this server yet.' }); return; }
  const { pool, occasionId, formality, avoid } = req.body ?? {};
  const pieces = briefOf(pool).items.filter((it) => it.kind !== 'sources');
  if (pieces.length < 3) { res.status(400).json({ error: 'There is too little content to design a deck from.' }); return; }
  const ip = String(req.headers['x-forwarded-for'] ?? '').split(',')[0].trim() || 'unknown';
  if (limited(ip)) { res.status(429).json({ error: 'You have asked for many takes in the last hour. Please wait a little.' }); return; }
  try {
    const started = Date.now();
    const spec = await directDeck({ pool, occasionId, formality, avoid });
    // how long the step takes and how much code had to repair, for the comparison in phase 2
    console.log('direct', { ms: Date.now() - started, effort: EFFORT, direction: spec.direction, slides: spec.plan.length, repairs: spec.warnings.length });
    res.status(200).json({ spec });
  } catch (err) {
    const status = err instanceof Anthropic.RateLimitError ? 429
      : err instanceof Anthropic.APIError ? 502
      : err.status ?? 500;
    const message = err instanceof Anthropic.RateLimitError ? 'Claude is busy right now. Please try again in a minute.'
      : err instanceof Anthropic.APIError ? 'Claude could not be reached. Please try again.'
      : err.message;
    console.error('direct failed', status, err?.message);
    res.status(status).json({ error: message });
  }
}
