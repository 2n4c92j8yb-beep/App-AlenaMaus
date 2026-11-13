// Design kits. Each direction keeps one identity (colours and type) but owns a
// small kit of effects that suit it. A planner decides, per deck, which slides
// get an effect and which stay plain, so a deck has rhythm instead of the same
// look on every slide (the typical generated-deck pattern).
//
// Placement rules:
//   1. an effect only goes where it means something (its `on` list):
//      contour lines open a section, a grid sits behind a process or timeline,
//      ripples behind a question, a landscape near the end …
//   2. about a third of the slides carry an effect; dense slides
//      (lists, comparisons, works cited, picture slides) always stay plain
//   3. never the same effect twice in a row, never two strong effects side by side
//   4. a second background tone (`invert`) gives the deck light and dark beats
//   5. the choice is seeded by the deck, so new directions give a new mix
//
// Accent kinds:
//   texture   a generated surface behind the content (textures.js)
//   invert    the slide swaps to the direction's second tone (planned before layout)
//   glow      a glowing glass panel behind the key figure

import { SLIDE_W as W, SLIDE_H as H } from '../engine/fit.js';
import { textureSvg } from './textures.js';
import { createRng } from '../engine/rng.js';

const PLAIN = new Set(['points', 'comparison', 'references', 'photo', 'photoSplit']);
// slides that already carry their own composition in a look
const OWN = {
  glass: new Set(['cover', 'section', 'statement', 'question', 'bigNumber']),
  poster: new Set(['cover', 'section', 'statement', 'question', 'bigNumber']),
};
export const SHARE = 1 / 3;

// ---------------------------------------------------------------- the kits

const T = (texture, on, o = {}) => ({ kind: 'texture', texture, on, id: o.id ?? texture, alpha: o.alpha ?? 0.5, strong: o.strong ?? false, max: o.max ?? 3, color: o.color, colors: o.colors, priority: o.priority ?? 1 });
const INVERT = (on, o = {}) => ({ kind: 'invert', id: 'invert', on, max: o.max ?? 2, strong: true, priority: o.priority ?? 1, texture: o.texture, color: o.color, alpha: o.alpha });
const GLOW = { kind: 'glow', id: 'glow', on: ['bigNumber'], max: 1, priority: 2 };
// landscapes only where the text leaves the bottom free, preferably on the closing slide
const LAND = (o = {}) => ({ ...T('landscape', ['section', 'statement'], { max: 1, alpha: o.alpha ?? 0.9, priority: 2, strong: true, colors: 'tints', color: o.color }), preferLast: true, clearBottom: true });

const KITS = {
  // ---- Texture look
  survey: [T('contour', ['cover', 'section'], { color: 'accent', alpha: 0.42, priority: 3, strong: true }), LAND({ color: 'accent', alpha: 0.75 }), T('film', ['statement', 'quote', 'definition'], { alpha: 0.6 })],
  drafting: [T('grid', ['cover', 'process', 'timeline'], { color: '#FFFFFF', alpha: 1, priority: 3, strong: true }), INVERT(['quote', 'definition', 'statement'], { texture: 'grid', color: 'ink', alpha: 0.5 }), T('contour', ['section'], { color: '#FFFFFF', alpha: 0.3, priority: 2 })],
  grain: [T('grain', ['cover', 'statement', 'section'], { colors: ['#F6A27E', '#B9A4FF', '#FFD58A', '#F29BB8'], alpha: 0.7, priority: 3, strong: true }), T('ripple', ['question', 'quote'], { color: 'accent', alpha: 0.5, priority: 2 }), GLOW],
  // ---- Glass look (key slides keep their chrome compositions; the kit dresses the content slides)
  prism: [T('contour', ['process', 'timeline'], { color: '#B9A4FF', alpha: 0.28 }), T('film', ['quote', 'definition', 'pair'], { alpha: 0.8 })],
  pearl: [T('fluted', ['quote', 'definition'], { colors: ['#B9A4FF', '#6CF0E0', '#FF9CCF'], alpha: 0.75, strong: true }), T('ripple', ['timeline', 'pair', 'process'], { color: '#5B47C8', alpha: 0.35 })],
  halo: [T('graphite', ['quote', 'definition', 'pair'], { color: '#E2B66B', alpha: 0.8 }), T('contour', ['process', 'timeline'], { color: '#E2B66B', alpha: 0.25 })],
  // ---- Poster look (key slides carry mood photos; the kit adds film and texture between them)
  summit: [T('film', ['quote', 'definition', 'pair', 'timeline', 'process'], { alpha: 0.9 }), LAND({ color: 'accent' })],
  cutout: [T('graphite', ['quote', 'definition'], { color: '#111111', alpha: 0.6 }), T('grid', ['process', 'timeline'], { color: '#111111', alpha: 0.35 })],
  monolith: [T('film', ['quote', 'pair', 'timeline'], { alpha: 0.9 }), INVERT(['definition', 'quote'], { max: 1 }), LAND({ color: 'accent' })],
  // ---- Editorial look
  archive: [T('film', ['quote', 'definition', 'cover'], { alpha: 0.7 }), LAND({ color: 'accent', alpha: 0.6 }), INVERT(['statement'], { max: 1 })],
  broadsheet: [T('film', ['quote', 'definition'], { alpha: 0.6 }), INVERT(['statement', 'question'], { max: 1 })],
  swiss: [T('grid', ['process', 'timeline'], { color: 'ink', alpha: 0.18 }), INVERT(['statement', 'quote'], { max: 1 })],
  chalk: [T('graphite', ['quote', 'definition', 'statement', 'cover', 'section'], { color: '#ECEAE2', alpha: 0.9, priority: 2 }), T('ripple', ['question'], { color: 'accent', alpha: 0.4 })],
  fieldnotes: [T('contour', ['section', 'cover'], { color: 'accent', alpha: 0.3, priority: 2 }), T('film', ['quote', 'definition'], { alpha: 0.7 })],
  gallery: [LAND({ color: 'accent', alpha: 0.5 }), T('film', ['quote', 'statement'], { alpha: 0.5 })],
  blueprint: [T('grid', ['process', 'timeline', 'cover'], { color: '#FFFFFF', alpha: 0.6, priority: 2 }), T('contour', ['section'], { color: '#8FD3F5', alpha: 0.3 })],
  signal: [T('ripple', ['question', 'quote'], { color: 'accent', alpha: 0.4 }), INVERT(['statement'], { max: 1 })],
  monograph: [T('film', ['quote', 'definition'], { alpha: 0.6 }), LAND({ color: 'ink', alpha: 0.55 }), INVERT(['statement'], { max: 1 })],
  studio: [T('grain', ['statement', 'question', 'cover'], { colors: ['#E8A07A', '#D7B98E', '#C9C3BA'], alpha: 0.7, strong: true }), T('fluted', ['quote'], { colors: ['#B85A2B', '#D7B98E'], alpha: 0.5 })],
  nightlecture: [T('heat', ['bigNumber', 'statement'], { alpha: 0.35, strong: true, max: 1 }), T('ripple', ['question'], { color: 'accent', alpha: 0.35 }), T('graphite', ['quote', 'definition'], { color: '#EDEBE6', alpha: 0.6 })],
  ledger: [T('grid', ['process', 'timeline'], { color: 'accent', alpha: 0.22 }), INVERT(['statement'], { max: 1 })],
  poster: [T('film', ['quote', 'definition'], { alpha: 0.7 }), T('heat', ['bigNumber'], { alpha: 0.3, max: 1 })],
  margin: [T('contour', ['section'], { color: 'accent', alpha: 0.25 }), INVERT(['statement', 'quote'], { max: 1 })],
  botanical: [LAND({ color: 'accent', alpha: 0.5 }), T('ripple', ['question', 'quote'], { color: 'accent', alpha: 0.35 })],
};

export const kitFor = (dir) => KITS[dir.id] ?? [];

// ---------------------------------------------------------------- planning

/** Decide which slides get which effect. Returns the plan with `accent` set on the chosen slides. */
export function assignAccents(plan, deck, dir, structure) {
  const kit = kitFor(dir);
  if (!kit.length) return plan;
  const rng = createRng(`accents:${deck.title}|${dir.id}|${structure?.id ?? ''}`);
  const own = OWN[dir.family] ?? new Set();
  const last = plan.map((s) => s.form).lastIndexOf('references') - 1;
  const lastIdx = last >= 1 ? last : plan.length - 1;
  const eligible = (s, i) => !PLAIN.has(s.form) && !own.has(s.form) && !s.mood && !(dir.family === 'poster' && s.mood);
  const target = Math.max(1, Math.round(plan.length * SHARE));
  const cands = [];
  plan.forEach((s, i) => {
    if (!eligible(s, i)) return;
    for (const a of kit) {
      if (!a.on.includes(s.form)) continue;
      if (a.clearBottom && (s.item?.note || s.item?.hint)) continue; // a landscape needs the bottom of the slide free
      const bonus = (s.form === 'cover' ? 4 : 0) + (i === lastIdx && a.preferLast ? 3 : 0);
      cands.push({ i, a, score: a.priority + bonus + rng.next() * 1.5 });
    }
  });
  cands.sort((p, q) => q.score - p.score);
  const chosen = new Map();
  const uses = new Map();
  for (const { i, a } of cands) {
    if (chosen.size >= target) break;
    if (chosen.has(i) || (uses.get(a.id) ?? 0) >= a.max) continue;
    const near = [chosen.get(i - 1), chosen.get(i + 1)].filter(Boolean);
    if (near.some((n) => n.id === a.id)) continue;           // never the same effect twice in a row
    if (a.strong && near.some((n) => n.strong)) continue;    // never two strong effects side by side
    chosen.set(i, a);
    uses.set(a.id, (uses.get(a.id) ?? 0) + 1);
  }
  // no slide matched the kit's places: the quietest texture goes on one eligible slide instead
  if (!chosen.size) {
    const quiet = kit.find((a) => a.kind === 'texture' && !a.strong) ?? kit.find((a) => a.kind === 'texture');
    const i = plan.findIndex((s, k) => k > 0 && eligible(s, k));
    if (quiet && i > 0) chosen.set(i, quiet);
  }
  return plan.map((s, i) => (chosen.has(i) ? { ...s, accent: chosen.get(i) } : s));
}

// ---------------------------------------------------------------- colour helpers

const hex = (h) => { const n = parseInt(h.slice(1, 7), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
const toHex = (rgb) => `#${rgb.map((v) => Math.round(v).toString(16).padStart(2, '0')).join('')}`.toUpperCase();
export const mix = (a, b, t) => toHex(hex(a).map((v, k) => v + (hex(b)[k] - v) * t));

/** The direction's second tone: background and ink swap; muted and accent are re-derived so they stay readable. */
export function invertPalette(c, contrast) {
  const bg = c.ink;
  const ink = c.bg;
  let muted = mix(ink, bg, 0.22);
  for (let t = 0.22; contrast(muted, bg) < 4.8 && t > 0; t -= 0.04) muted = mix(ink, bg, t);
  const accent = contrast(c.accent, bg) >= 3 ? c.accent : (contrast(c.accentText ?? c.accent, bg) >= 3 ? c.accentText : ink);
  return { ...c, bg, ink, muted, accent, accentText: accent, soft: mix(bg, ink, 0.1), onAccent: bg };
}

const resolve = (spec, c) => (spec === 'accent' ? c.accent : spec === 'ink' ? c.ink : spec === 'muted' ? c.muted : spec);

// ---------------------------------------------------------------- applying

/** Add the slide's planned effect to its element list (called after the layout). */
export function applyAccent(ctx) {
  const a = ctx.slide?.accent;
  if (!a) return ctx.els;
  const { c, dir, deck, slideIndex } = ctx;
  const bg = ctx.els.findIndex((e) => e.type === 'rect' && e.w >= W - 0.01 && e.h >= H - 0.01);
  const texture = a.kind === 'texture' ? a.texture : a.texture; // invert may carry a light texture too
  if (texture) {
    const color = resolve(a.color, c) ?? c.accent;
    const colors = a.colors === 'tints' ? [0.18, 0.34, 0.55, 0.8].map((t) => mix(c.bg, color, t)) : a.colors;
    const el = {
      type: 'svg', x: 0, y: 0, w: W, h: H, seq: 0, alpha: a.alpha ?? 0.5, accent: a.id,
      svg: textureSvg(texture, { seed: `${deck.title}|${dir.id}`, variant: slideIndex % 4, color, colors }),
    };
    // in glass decks the effect replaces the aurora on this slide
    if (dir.family === 'glass') ctx.els = ctx.els.filter((e, k) => !(k > bg && e.type === 'ellipse' && e.soft && e.w > 4));
    const at = ctx.els.findIndex((e) => e.type === 'rect' && e.w >= W - 0.01 && e.h >= H - 0.01);
    ctx.els.splice(at + 1, 0, el);
  }
  if (a.kind === 'glow') glowBehindFigure(ctx);
  return ctx.els;
}

/** A frosted, glowing panel behind the largest number on a key-figure slide. */
function glowBehindFigure(ctx) {
  const { c } = ctx;
  const texts = ctx.els.filter((e) => e.type === 'text' && e.role === 'display');
  if (!texts.length) return;
  const fig = texts.reduce((p, q) => (q.size > p.size ? q : p));
  const h = (fig.size / 72) * fig.lineHeight + 0.5;
  const w = Math.min(fig.w, String(fig.text).length * (fig.size / 72) * 0.62 + 0.9);
  const x = fig.align === 'center' ? fig.x + (fig.w - w) / 2 : fig.x - 0.35;
  const y = fig.valign === 'middle' ? fig.y + (fig.h - h) / 2 : fig.y - 0.15;
  const panel = {
    type: 'rect', x: Math.max(0.2, x), y: Math.max(0.2, y), w, h, fill: '#FFFFFF8C', radius: 0.3, seq: fig.seq, accent: 'glow',
    glass: { edge: '#FFFFFFF2', rim: '#FFFFFF' }, glow: { color: `${c.accent}59`, blur: 0.45, edge: `${c.accent}66` },
  };
  ctx.els.splice(ctx.els.indexOf(fig), 0, panel);
}
