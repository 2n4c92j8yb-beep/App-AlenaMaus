// Picks three directions and three story structures for an occasion.
// Variety comes from this code, not from the AI model: directions are drawn
// by weight (occasion fit and formality) under a rule that every pair must
// differ visibly (light/dark, serif/sans, layout logic, cover, typeface).

import { DIRECTIONS } from '../library/directions.js';
import { STRUCTURES } from '../library/structures.js';
import { occasionById } from '../library/occasions.js';
import { createRng } from './rng.js';

const TONE_WEIGHT = {
  formal: { formal: 2, neutral: 1, relaxed: 0.25 },
  neutral: { formal: 1, neutral: 1.2, relaxed: 1 },
  relaxed: { formal: 0.25, neutral: 1, relaxed: 2 },
};

/** How visibly two directions differ (0 = twins). */
export function distance(a, b) {
  let d = 0;
  if (a.tags.mode !== b.tags.mode) d += 1;
  if (a.tags.type !== b.tags.type) d += 1;
  if (a.layout.titlePos !== b.layout.titlePos) d += 1;
  if (a.layout.align !== b.layout.align) d += 1;
  if (a.layout.cover !== b.layout.cover) d += 0.5;
  if (a.fonts.display !== b.fonts.display) d += 0.5;
  if (a.layout.signature !== b.layout.signature) d += 0.5;
  if (a.layout.photo !== b.layout.photo) d += 0.25;
  return d;
}

export function sampleDirections({ occasionId, formality = 'neutral', seed, count = 3, minDistance = 2.5, family = 'editorial' }) {
  const rng = createRng(`dir:${seed}`);
  const toneW = TONE_WEIGHT[formality] ?? TONE_WEIGHT.neutral;
  const weight = (d) => (d.suits[occasionId] ?? 0) * toneW[d.tags.tone];
  const picked = [];
  let threshold = minDistance;
  while (picked.length < count) {
    const pool = DIRECTIONS.filter((d) => (d.family ?? 'editorial') === family && !picked.includes(d) && weight(d) > 0 && picked.every((p) => distance(p, d) >= threshold));
    if (!pool.length) {
      if (threshold <= 0) break;
      threshold -= 0.5; // relax rather than fail
      continue;
    }
    picked.push(rng.weighted(pool, weight));
  }
  return picked;
}

export function sampleStructures({ occasionId, seed, count = 3 }) {
  const rng = createRng(`str:${seed}`);
  const weights = occasionById(occasionId).structures;
  const pool = STRUCTURES.filter((s) => weights[s.id]);
  const picked = [];
  while (picked.length < count && picked.length < pool.length) {
    const rest = pool.filter((s) => !picked.includes(s));
    picked.push(rng.weighted(rest, (s) => weights[s.id]));
  }
  // fewer structures than directions: reuse in order
  while (picked.length < count) picked.push(picked[picked.length % pool.length]);
  return picked;
}
