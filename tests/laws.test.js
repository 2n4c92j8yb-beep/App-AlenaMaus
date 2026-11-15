// The design laws (src/library/laws.js), checked for every direction and every deck.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DIRECTIONS } from '../src/library/directions.js';
import { FONTS } from '../src/library/fonts.js';
import { contrast } from '../src/library/forms.js';
import { buildDirections } from '../src/engine/build.js';
import { OCCASIONS } from '../src/library/occasions.js';
import { SAMPLE_POOL } from '../src/sample/great-vowel-shift.js';
import { SLIDE_W as W, SLIDE_H as H } from '../src/engine/fit.js';
import {
  RATIOS, PAIRINGS, HARMONIES, MOTION, ACCENT_BUDGET, BASELINE, stepSize, snap, columns,
  typefaces, pairingProblem, harmonyProblem, hueSat, hueGap, rybHue,
} from '../src/library/laws.js';

const FAMILIES = ['editorial', 'texture', 'poster', 'glass'];
const decks = () => {
  const out = [];
  for (const family of FAMILIES) for (const o of OCCASIONS) for (const density of ['light', 'medium', 'dense']) for (let s = 0; s < 4; s++) {
    out.push(...buildDirections({ pool: SAMPLE_POOL, occasionId: o.id, density, seed: s, family }));
  }
  return out;
};
const ALL = decks();

test('every direction states its laws', () => {
  for (const d of DIRECTIONS) {
    assert.ok(d.laws, `${d.id} has no laws block`);
    assert.ok(Object.values(RATIOS).includes(d.laws.type.ratio), `${d.id}: ratio ${d.laws.type.ratio} is not a modular-scale ratio`);
    assert.ok(PAIRINGS.includes(d.laws.type.pairing), `${d.id}: pairing`);
    assert.ok(d.laws.type.why?.length > 20, `${d.id}: say why the pairing works`);
    assert.ok(HARMONIES[d.laws.colour.harmony], `${d.id}: harmony`);
    assert.ok(d.laws.movement, `${d.id}: name the movement`);
    assert.ok(MOTION[d.laws.motion.name], `${d.id}: motion`);
    assert.equal(d.laws.grid.baseline, BASELINE, `${d.id}: baseline`);
  }
});

test('type pairing: contrast in one stated dimension', () => {
  for (const d of DIRECTIONS) assert.equal(pairingProblem(d), null, `${d.id}: ${pairingProblem(d)}`);
});

test('type pairing: at most two typefaces, plus one monospace', () => {
  for (const d of DIRECTIONS) {
    const t = typefaces(d);
    assert.ok(t.other.length <= 2, `${d.id}: ${t.other.join(', ')}`);
    assert.ok(t.mono.length <= 1, `${d.id}: ${t.mono.join(', ')}`);
  }
});

test('type pairing: the checker catches a bad pair', () => {
  // two similar sans faces (the "almost matching" mistake) and a mislabelled weight pair
  const bad = { fonts: { display: 'calibri', body: 'trebuchet', label: 'trebuchet' }, layout: {}, laws: { type: { pairing: 'classification' } } };
  assert.ok(pairingProblem(bad));
  assert.ok(pairingProblem({ ...bad, laws: { type: { pairing: 'weight' } } }));
  assert.ok(FONTS.bodoni.cls === 'didone' && FONTS.arial.cls === 'neo-grotesque');
});

test('colour harmony: the stated hues really form it', () => {
  for (const d of DIRECTIONS) assert.equal(harmonyProblem(d), null, `${d.id}: ${harmonyProblem(d)}`);
  // and the checker refuses a fake triad
  assert.ok(harmonyProblem({ laws: { colour: { harmony: 'triadic', hues: ['#FF0000', '#FF8800', '#FFFF00'] } } }));
  assert.ok(hueGap(350, 10) === 20 && Math.round(hueSat('#0000FF').h) === 240);
  assert.equal(Math.round(rybHue(60)), 120); // yellow sits a third of the way round the painters' wheel
});

test('contrast: secondary text is readable on the background and on tinted panels', () => {
  for (const d of DIRECTIONS) {
    const { bg, muted, soft } = d.colors;
    assert.ok(contrast(muted, bg) >= 4.5, `${d.id}: muted on bg ${contrast(muted, bg).toFixed(2)}`);
    if (/^#[0-9A-F]{6}$/i.test(soft)) assert.ok(contrast(muted, soft) >= 4.5, `${d.id}: muted on panels ${contrast(muted, soft).toFixed(2)}`);
  }
});

test('modular scale: steps grow by the ratio', () => {
  for (const r of Object.values(RATIOS)) for (let n = 1; n <= 5; n++) {
    assert.ok(Math.abs(stepSize(r, n) / stepSize(r, n - 1) - r) < 0.06, `ratio ${r} step ${n}`);
  }
});

test('hierarchy: on every content slide the headline outranks body text by at least one step', () => {
  for (const deck of ALL) for (const sl of deck.slides) {
    if (!['points', 'comparison', 'process', 'timeline'].includes(sl.form)) continue;
    const head = sl.els.filter((e) => e.type === 'text' && e.role === 'display' && e.seq === 1 && !e.bleed);
    const body = sl.els.filter((e) => e.type === 'text' && e.role === 'body');
    if (!head.length || !body.length) continue;
    const r = Math.max(...head.map((e) => e.size)) / Math.max(...body.map((e) => e.size));
    assert.ok(r >= deck.direction.laws.type.ratio - 0.02, `${deck.direction.id} ${sl.form}: headline/body ${r.toFixed(2)}`);
  }
});

test('60-30-10: the accent covers at most a tenth of any content slide', () => {
  const content = new Set(['points', 'comparison', 'process', 'timeline', 'pair', 'references', 'definition', 'bigNumber', 'quote']);
  for (const deck of ALL) {
    const accent = deck.direction.colors.accent.toUpperCase();
    for (const sl of deck.slides) {
      if (!content.has(sl.form) || sl.accent?.kind === 'invert') continue;
      let area = 0;
      for (const e of sl.els) {
        if (!['rect', 'ellipse'].includes(e.type) || !e.fill?.toUpperCase().startsWith(accent) || (e.w >= W - 0.01 && e.h >= H - 0.01)) continue;
        const w = Math.max(0, Math.min(e.x + e.w, W) - Math.max(e.x, 0));
        const h = Math.max(0, Math.min(e.y + e.h, H) - Math.max(e.y, 0));
        area += w * h * (e.alpha ?? 1) * (e.type === 'ellipse' ? Math.PI / 4 : 1);
      }
      assert.ok(area / (W * H) <= ACCENT_BUDGET, `${deck.direction.id} ${sl.form}: accent covers ${(100 * area / (W * H)).toFixed(1)}%`);
    }
  }
});

test('grid: margins sit on the baseline unit and columns fill the live area', () => {
  for (const d of DIRECTIONS) {
    assert.ok(Math.abs(snap(d.layout.margin) - d.layout.margin) <= BASELINE / 2 + 1e-9, `${d.id}: margin ${d.layout.margin}`);
    const g = columns(snap(d.layout.margin), d.laws.grid.columns, d.laws.grid.gutter, W);
    assert.ok(Math.abs(g.x(d.laws.grid.columns - 1) + g.col - (W - snap(d.layout.margin))) < 1e-6, `${d.id}: columns`);
  }
});

test('motion: every slide carries its direction\'s tempo; brutal looks are fastest, luxury slowest', () => {
  for (const deck of ALL) for (const sl of deck.slides) assert.equal(sl.motion?.tempo, deck.direction.laws.motion.tempo);
  assert.ok(MOTION.snap.tempo > MOTION.brisk.tempo && MOTION.brisk.tempo > MOTION.calm.tempo && MOTION.calm.tempo > MOTION.slow.tempo);
});

test('surfaces: Riot outlines every panel with a hard shadow, Bento rounds every tile', () => {
  for (const deck of ALL) {
    const s = deck.direction.layout.surface;
    if (!s) continue;
    for (const sl of deck.slides) for (const e of sl.els) {
      if (e.type !== 'rect' || (e.w >= W - 0.01 && e.h >= H - 0.01)) continue;
      if (s === 'tiles' && e.w > 0.4 && e.h > 0.4 && !e.rotate) assert.ok(e.radius > 0, `bento ${sl.form}: square panel`);
    }
    if (s === 'brutal') assert.ok(deck.slides.some((sl) => sl.els.some((e) => e.stroke === deck.direction.colors.ink)), 'riot: no outlined panel');
  }
});
