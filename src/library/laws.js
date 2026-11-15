// The laws of design every direction follows. Each direction carries a `laws` block in
// its brief (directions.js); the layout engine reads it (forms.js) and the rule tests
// (tests/laws.test.js) check it, so a new direction cannot quietly break them.
//
//   type     a modular scale: every headline size is a step on one ratio from the
//            body size (no hand-picked numbers), and a pairing with a stated logic:
//            contrast in exactly one dimension, harmony in the rest
//   colour   a named harmony (the hues must actually form it) and a 60-30-10 budget:
//            on content slides the accent covers at most about a tenth of the slide
//   grid     a baseline unit that margins and content start lines snap to, and a
//            column count that column layouts are built from
//   motion   how the direction moves in Present mode (tempo and easing follow the style)
//   movement the design movement or school the direction comes from, so a critique
//            can name what it is doing
//
// Text contrast is checked too: ink 7:1, secondary text 4.5:1 on the background and on
// tinted panels, accent text 3:1 (WCAG 2.2).

import { FONTS } from './fonts.js';

/** The classic modular-scale ratios (musical intervals and the golden section). */
export const RATIOS = {
  minorSecond: 1.067,
  majorSecond: 1.125,
  minorThird: 1.2,
  majorThird: 1.25,
  perfectFourth: 1.333,
  augmentedFourth: 1.414,
  perfectFifth: 1.5,
  golden: 1.618,
};

/** Body size in points on a 16:9 slide: step 0 of every scale. */
export const BASE_PT = 21;

/** Size of step `n` on the direction's scale (steps: 1 subhead, 2 headline, 3 statement, 4 cover title, 5 display term). */
export const stepSize = (ratio, n) => Math.round(BASE_PT * ratio ** n);

// ---------------------------------------------------------------- type pairing

/**
 * The dimension in which display and body faces contrast. Exactly one should differ:
 *   classification  serif against sans (or slab against sans), same rhythm otherwise
 *   width           a condensed or extended display face over a normal-width text face
 *   weight          one family, a heavy cut for headlines (e.g. Arial Black over Arial)
 *   case            one group, but headlines set in tracked capitals
 *   style           one family, italic display over roman text
 *   single          one family throughout; hierarchy from scale and weight alone
 */
export const PAIRINGS = ['classification', 'width', 'weight', 'case', 'style', 'single'];

/** The faces a direction uses, by family (a monospace label face is allowed as a third voice). */
export function typefaces(dir) {
  const keys = [...new Set(Object.values(dir.fonts))];
  const families = [...new Set(keys.map((k) => FONTS[k].family))];
  const mono = families.filter((f) => Object.values(FONTS).find((x) => x.family === f).group === 'mono');
  return { families, mono, other: families.filter((f) => !mono.includes(f)) };
}

/** Does the stated pairing really hold for the direction's fonts? Returns a reason when it does not. */
export function pairingProblem(dir) {
  const p = dir.laws.type.pairing;
  const d = FONTS[dir.fonts.display];
  const b = FONTS[dir.fonts.body];
  if (!PAIRINGS.includes(p)) return `unknown pairing "${p}"`;
  const sameFamily = d.family === b.family;
  switch (p) {
    case 'single': return sameFamily && d === b ? null : 'display and body must be the same face';
    case 'weight': return sameFamily && (d.weight ?? 400) > (b.weight ?? 400) ? null : 'needs one family with a heavier display cut';
    case 'style': return sameFamily && dir.layout.italicDisplay ? null : 'needs one family with italic headlines';
    case 'classification': return d.group !== b.group ? null : `${d.cls} and ${b.cls} are both ${d.group}: no classification contrast`;
    case 'width': return ['condensed', 'extended'].includes(d.width) && d.width !== b.width ? null : 'needs a condensed or extended display face over a normal-width text face';
    case 'case': return d.group === b.group && (dir.layout.upperDisplay || d.capsOnly) ? null : 'needs capital headlines in the same group';
    default: return null;
  }
}

// ---------------------------------------------------------------- colour

export const HARMONIES = {
  // a neutral palette carrying a single hue: the most common editorial scheme
  'neutral + accent': { hues: 1 },
  monochromatic: { hues: 1 },
  analogous: { hues: 3, spread: [15, 75] },       // neighbours within a 75° arc
  complementary: { hues: 2, gap: [150, 210] },    // opposite on the wheel
  'split-complementary': { hues: 3, gap: [125, 175] },
  triadic: { hues: 3, gap: [95, 145] },           // three hues about 120° apart
};

const rgb = (h) => { const n = parseInt(h.slice(1, 7), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => v / 255); };

/** Hue in degrees and saturation 0..1 (HSL). */
export function hueSat(hex) {
  const [r, g, b] = rgb(hex);
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  const d = max - min;
  if (d === 0) return { h: 0, s: 0 };
  const s = d / (1 - Math.abs(2 * l - 1));
  let h;
  if (max === r) h = ((g - b) / d) % 6;
  else if (max === g) h = (b - r) / d + 2;
  else h = (r - g) / d + 4;
  return { h: (h * 60 + 360) % 360, s };
}

/**
 * Hue on the painters' red-yellow-blue wheel (Itten's wheel, taught at the Bauhaus), where
 * red, yellow and blue are a triad. Piecewise map from the RGB hue circle.
 */
export function rybHue(h) {
  const from = [0, 60, 120, 180, 240, 300, 360];
  const to = [0, 120, 180, 210, 240, 300, 360];
  for (let i = 0; i < from.length - 1; i++) if (h <= from[i + 1]) return to[i] + ((h - from[i]) / (from[i + 1] - from[i])) * (to[i + 1] - to[i]);
  return h;
}

export const hueGap = (a, b) => { const d = Math.abs(a - b) % 360; return d > 180 ? 360 - d : d; };

/** Does the stated harmony hold for the direction's hues? Returns a reason when it does not. */
export function harmonyProblem(dir) {
  const { harmony, hues = [], wheel } = dir.laws.colour;
  const rule = HARMONIES[harmony];
  if (!rule) return `unknown harmony "${harmony}"`;
  if (rule.hues === 1) return null;
  if (hues.length !== rule.hues) return `${harmony} needs ${rule.hues} hues, has ${hues.length}`;
  const hs = hues.map((x) => (wheel === 'ryb' ? rybHue(hueSat(x).h) : hueSat(x).h));
  if (rule.spread) {
    const span = Math.max(...hs.map((a) => Math.max(...hs.map((b) => hueGap(a, b)))));
    return span >= rule.spread[0] && span <= rule.spread[1] ? null : `analogous hues span ${span.toFixed(0)}°`;
  }
  if (harmony === 'split-complementary') {
    // the two outer hues sit either side of the base's complement
    const [base, a, b] = hs;
    return [a, b].every((x) => hueGap(base, x) >= rule.gap[0] && hueGap(base, x) <= rule.gap[1]) ? null : 'outer hues are not near the complement';
  }
  for (let i = 0; i < hs.length; i++) for (let j = i + 1; j < hs.length; j++) {
    const g = hueGap(hs[i], hs[j]);
    if (g < rule.gap[0] || g > rule.gap[1]) return `${harmony}: hues ${hs[i].toFixed(0)}° and ${hs[j].toFixed(0)}° are ${g.toFixed(0)}° apart`;
  }
  return null;
}

/** The 60-30-10 rule: the most accent a content slide may carry (share of the slide's area). */
export const ACCENT_BUDGET = 0.1;

// ---------------------------------------------------------------- grid

export const BASELINE = 0.125; // inches (9 pt): margins and content start lines snap to it
export const snap = (v, unit = BASELINE) => Math.round(v / unit) * unit;
export const snapUp = (v, unit = BASELINE) => Math.ceil(v / unit - 1e-6) * unit;

/** Left edges and width of a column grid across the slide's live area. */
export function columns(margin, count, gutter, width) {
  const live = width - 2 * margin;
  const col = (live - gutter * (count - 1)) / count;
  return { col, gutter, x: (i) => margin + i * (col + gutter), span: (n) => n * col + (n - 1) * gutter };
}

// ---------------------------------------------------------------- motion

/** Present-mode tempo by style: hard and fast for brutal looks, slow fades for luxury. */
export const MOTION = {
  snap: { tempo: 1.6, ease: 'power4.out' },     // Riot, Specimen: almost a cut
  brisk: { tempo: 1.25, ease: 'power3.out' },   // Swiss, Bauhaus, Bento: quick and precise
  calm: { tempo: 1, ease: 'power3.out' },       // the default editorial pace
  slow: { tempo: 0.75, ease: 'power2.out' },    // Couture, Gallery, Terra: long, soft settles
};

// ---------------------------------------------------------------- shorthand for directions.js

/**
 * Build a laws block.
 *   ratio    a key of RATIOS
 *   pairing  one of PAIRINGS
 *   harmony  a key of HARMONIES, with `hues` when it names more than one
 *            (`wheel: 'ryb'` measures them on the painters' wheel instead of the screen's)
 *   grid     { columns, gutter } (baseline is shared)
 */
export const laws = ({ ratio, pairing, why, harmony, hues, wheel, columns: cols = 12, gutter = 0.25, motion = 'calm', movement }) => ({
  type: { ratio: RATIOS[ratio], ratioName: ratio, pairing, why },
  colour: { harmony, ...(hues ? { hues } : {}), ...(wheel ? { wheel } : {}) },
  grid: { baseline: BASELINE, columns: cols, gutter },
  motion: { name: motion, ...MOTION[motion] },
  movement,
});
