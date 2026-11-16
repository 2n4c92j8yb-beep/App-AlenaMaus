// Redesigning an uploaded AI deck: which of our directions fits it best, and how
// to keep the deck's own colours while dropping what makes it look generated.
//
// Claude only describes the uploaded deck (a style profile, see src/engine/style.js).
// The choice itself is ordinary code over the curated library, like the rest of the
// app: every direction is scored against the profile, the best one is shown first,
// and the best directions of two other looks are the alternatives.

import { DIRECTIONS } from '../library/directions.js';
import { contrast } from '../library/forms.js';

// ---------------------------------------------------------------- colour helpers

const hex = (h) => {
  const s = String(h ?? '').replace('#', '');
  return s.length >= 6 ? [0, 2, 4].map((i) => parseInt(s.slice(i, i + 2), 16)) : null;
};
const toHex = (rgb) => `#${rgb.map((v) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, '0')).join('').toUpperCase()}`;

export function toHsl(h) {
  const rgb = hex(h);
  if (!rgb) return null;
  const [r, g, b] = rgb.map((v) => v / 255);
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return { h: 0, s: 0, l };
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  const hue = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return { h: hue * 60, s, l };
}

export function fromHsl({ h, s, l }) {
  const k = (n) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n) => l - a * Math.max(-1, Math.min(k(n) - 3, 9 - k(n), 1));
  return toHex([f(0), f(8), f(4)].map((v) => v * 255));
}

/** Distance between two hues in degrees (0–180). */
const hueGap = (a, b) => { const d = Math.abs(a - b) % 360; return d > 180 ? 360 - d : d; };

// ---------------------------------------------------------------- scoring

// Which look suits which kind of deck. A deck's surface (how its backgrounds are
// made) and its pictures say the most about the family it belongs to.
const FAMILY_FIT = {
  glass: (p) => (p.surface === 'glass' ? 3 : 0) + (p.surface === 'gradient' ? 2 : 0) + (p.tells.includes('glow-blobs') ? 1 : 0) + (p.mode === 'dark' ? 0.5 : 0),
  poster: (p) => (p.imagery === 'photos' ? 2.5 : 0) + (p.surface === 'photo' ? 1.5 : 0) + (p.typeScale === 'huge' ? 2 : p.typeScale === 'bold' ? 1 : 0),
  texture: (p) => (p.surface === 'texture' ? 3 : 0) + (p.surface === 'gradient' ? 1 : 0) + (p.imagery === 'illustrations' ? 1.5 : 0) + (p.mode === 'tint' ? 1 : 0),
  editorial: (p) => (p.surface === 'flat' ? 2 : 0) + (['none', 'icons'].includes(p.imagery) ? 1 : 0) + (p.typeScale === 'quiet' ? 1.5 : 0) + (p.density === 'dense' ? 1 : 0),
};

const FAMILY_NAMES = { glass: 'Glass', poster: 'Poster', texture: 'Texture', editorial: 'Editorial' };
export const familyName = (f) => FAMILY_NAMES[f] ?? 'Editorial';

/** How well one direction fits a deck's style profile, with the reasons that count. */
export function scoreDirection(dir, p, occasionId) {
  const family = dir.family ?? 'editorial';
  if ((dir.suits?.[occasionId] ?? 1) <= 0) return { dir, score: -Infinity, parts: [] };
  const parts = [];
  const add = (points, why) => { if (points) parts.push({ points, why }); };

  add(FAMILY_FIT[family](p), 'look');
  add(dir.tags.mode === p.mode ? 2 : (dir.tags.mode === 'tint' && p.mode === 'light') || (dir.tags.mode === 'light' && p.mode === 'tint') ? 1 : 0, 'mode');
  add(dir.tags.type === p.type ? 1.5 : dir.tags.type === 'mixed' || p.type === 'mixed' ? 0.5 : 0, 'type');
  add(dir.tags.tone === p.tone ? 1 : dir.tags.tone === 'neutral' || p.tone === 'neutral' ? 0.4 : 0, 'tone');
  add((dir.layout.align === 'center') === (p.align === 'center') ? 0.5 : 0, 'align');

  // a direction whose accent already sits near the deck's accent keeps the deck recognisable
  const a = toHsl(p.colors.accent);
  const b = toHsl(dir.colors.accent);
  if (a && b && a.s > 0.15) add(2 * (1 - hueGap(a.h, b.h) / 180) * Math.min(1, b.s * 1.5), 'accent');
  // and one whose background is about as light as the deck's
  const bgA = toHsl(p.colors.background);
  const bgB = toHsl(dir.colors.bg);
  if (bgA && bgB) add(1 - Math.abs(bgA.l - bgB.l), 'background');

  return { dir, score: parts.reduce((s, x) => s + x.points, 0), parts };
}

/**
 * The best direction for an uploaded deck plus the best direction of each of two
 * other looks. Returns [{ direction, score, role: 'best' | 'alternative', reason, changes }].
 */
export function matchDirections(profile, { occasionId = 'seminar', tone } = {}) {
  const p = tone ? { ...profile, tone } : profile;
  const scored = DIRECTIONS.map((d) => scoreDirection(d, p, occasionId)).filter((s) => Number.isFinite(s.score)).sort((x, y) => y.score - x.score || x.dir.id.localeCompare(y.dir.id));
  const best = scored[0];
  const families = new Set([best.dir.family ?? 'editorial']);
  const alts = [];
  for (const s of scored.slice(1)) {
    const f = s.dir.family ?? 'editorial';
    if (families.has(f)) continue;
    families.add(f);
    alts.push(s);
    if (alts.length === 2) break;
  }
  return [best, ...alts].map((s, i) => {
    const direction = adaptDirection(s.dir, p);
    return { direction, score: s.score, role: i === 0 ? 'best' : 'alternative', reason: i === 0 ? reasonFor(s, p) : alternativeFor(s, p), changes: changesFor(direction, p) };
  });
}

// ---------------------------------------------------------------- keeping the deck's colours

/**
 * The direction with its accent moved towards the deck's own accent colour, so the
 * redesign still feels like the same presentation. Type, layout, background and ink
 * stay the direction's own; the accent keeps at least 3:1 contrast with the background.
 */
export function adaptDirection(dir, p) {
  const want = toHsl(p.colors?.accent);
  const own = toHsl(dir.colors.accent);
  if (!want || !own || want.s < 0.15) return dir; // a grey accent says nothing about colour: keep ours
  const hueTo = own.h + (((want.h - own.h + 540) % 360) - 180); // shortest way round the colour wheel
  const base = { h: (hueTo + 360) % 360, s: Math.max(0.35, (own.s + want.s) / 2), l: own.l };
  const bg = dir.colors.bg;
  const darker = (toHsl(bg)?.l ?? 1) > 0.5;
  let accent = fromHsl(base);
  // step the lightness away from the background until the accent is readable on it
  for (let i = 0; i < 40 && contrast(accent, bg) < 3; i++) {
    base.l = Math.max(0, Math.min(1, base.l + (darker ? -0.02 : 0.02)));
    accent = fromHsl(base);
  }
  if (contrast(accent, bg) < 3) return dir;
  return { ...dir, colors: { ...dir.colors, accent }, adaptedFrom: dir.colors.accent };
}

// ---------------------------------------------------------------- explaining the choice

const MODE_WORDS = { dark: 'dark', light: 'light', tint: 'softly tinted' };
const SURFACE_WORDS = { glass: 'glossy glass panels', gradient: 'colour gradients', texture: 'textured backgrounds', photo: 'full-bleed photos', flat: 'plain backgrounds' };
const TYPE_WORDS = { serif: 'serif type', sans: 'sans-serif type', mixed: 'serif headlines' };

/** One line on why this direction fits, built from the parts that scored. */
function reasonFor({ dir, parts }, p) {
  const got = new Set(parts.filter((x) => x.points >= 0.9).map((x) => x.why));
  const bits = [];
  if (got.has('mode')) bits.push(`${MODE_WORDS[p.mode]} slides`);
  if (got.has('look') && SURFACE_WORDS[p.surface]) bits.push(SURFACE_WORDS[p.surface]);
  if (got.has('look') && p.imagery === 'photos' && p.surface !== 'photo') bits.push('lots of photos');
  if (got.has('type')) bits.push(TYPE_WORDS[p.type]);
  if (got.has('accent')) bits.push('a similar accent colour');
  const what = bits.length ? bits.slice(0, 3).join(', ') : 'the overall feel';
  return `Like your deck: ${what}.`;
}

// What an alternative look does differently, in a few words
const LOOK_WORDS = {
  glass: 'frosted glass, soft light and chrome objects',
  poster: 'film-poster photos and giant words',
  texture: 'generated surfaces such as contour lines, grids and grain',
  editorial: 'calm, print-like layouts and strong type',
};

/** One line for an alternative: what it keeps from the deck, and what it adds. */
function alternativeFor({ dir, parts }, p) {
  const got = new Set(parts.filter((x) => x.points >= 0.9).map((x) => x.why));
  const keeps = [got.has('mode') && `${MODE_WORDS[p.mode]} slides`, got.has('type') && TYPE_WORDS[p.type], got.has('accent') && 'a similar accent'].filter(Boolean);
  const adds = LOOK_WORDS[dir.family ?? 'editorial'];
  return keeps.length ? `Keeps your ${keeps.slice(0, 2).join(' and ')}, with ${adds}.` : `A different take: ${adds}.`;
}

// What each AI tell becomes in our directions.
const FIXES = {
  'purple-gradient': (d) => `Purple–blue gradient backgrounds become ${d.family === 'glass' ? 'soft light in your own colour' : d.family === 'texture' ? 'a generated surface in your colours' : 'calm, solid colour'}.`,
  'card-grid': () => 'Rows of identical cards become open columns, staircases and timelines.',
  'emoji-bullets': () => 'Emoji bullets are gone; numbers and type carry the order.',
  'stock-icons': () => 'Decorative stock icons are gone.',
  'everything-centred': (d) => (d.layout.align === 'center' ? 'Centring stays, but only where this look is built around it.' : 'Everything centred becomes a left-aligned grid.'),
  'generic-stock-photo': () => 'Generic stock photos become photos of your actual subject.',
  'gradient-text': (d) => (d.family === 'glass' ? 'Gradient text is kept to one deliberate headline per slide.' : 'Gradient-filled headlines become solid type.'),
  'glow-blobs': () => 'Floating glow blobs become one light source per slide.',
  'bullet-walls': () => 'Walls of bullet points become one idea per slide.',
  'drop-shadows': () => 'Heavy drop shadows become flat or glass surfaces.',
};
export const TELLS = Object.keys(FIXES);

/** The changes the redesign makes, from the AI tells found in the deck. */
export function changesFor(dir, p) {
  const out = p.tells.map((t) => FIXES[t]?.(dir)).filter(Boolean);
  if (dir.adaptedFrom) out.push('Your accent colour is kept, adjusted so it stays readable.');
  return [...new Set(out)];
}
