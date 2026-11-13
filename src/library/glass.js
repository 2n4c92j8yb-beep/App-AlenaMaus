// Glass layouts: cover, section, statement, question and key-figure slides built
// from light, glass and chrome. Content-heavy slides (timeline, comparison,
// process …) use the regular forms and are then re-dressed by glassify():
// soft panels become frosted glass, pictures get rounded corners and, in Halo,
// a stage light.
//
// Three directions, each with its own composition:
//   prism  dark, aqua/lilac aurora, holo headline, chrome sphere + ring + capsule
//   pearl  light, centred frosted panel, iridescent chrome at the panel's corners
//   halo   black, one gold glow, a gold chrome capsule on a lit stage
//
// Rules the code enforces (from the Prism Glass design system):
//   one hero effect per slide; text never sits on chrome or on a holo fill;
//   a single glowing card per slide; light blobs are quieter on content slides.

import { SLIDE_W as W, SLIDE_H as H } from '../engine/fit.js';
import { text, label, rect, background } from './forms.js';

const fx = (ctx) => ctx.dir.fx;
const holo = (ctx, angle = 115) => ({ angle, stops: fx(ctx).holo });
const pageNo = (ctx) => String(ctx.slideIndex + 1).padStart(2, '0');

// ---------------------------------------------------------------- primitives

/** Soft coloured light behind the glass, so the blur has something to bend. */
function light(ctx, x, y, d, color, alpha) {
  ctx.els.push({ type: 'ellipse', x, y, w: d, h: d, fill: color, soft: true, blur: 0.25, alpha, seq: 0 });
}

/** Background plus aurora. `strength` 1 on key slides, about 0.5 on content slides. */
function ground(ctx, strength = 1) {
  background(ctx);
  const { aurora, auroraAlpha } = fx(ctx);
  const a = auroraAlpha * strength;
  const v = ctx.slideIndex % 3;
  const spots = [
    [[-2.4, -2.6, 8.2], [W - 6.2, H - 5.2, 8.6], [W - 3.4, -2.8, 5.4]],
    [[W - 7.4, -3.4, 8.8], [-3.0, H - 5.6, 8.2], [W * 0.45, H - 3.2, 5.0]],
    [[-1.8, H - 6.4, 8.4], [W - 6.8, -3.6, 9.0], [W * 0.3, -2.8, 4.6]],
  ][v];
  spots.forEach(([x, y, d], i) => light(ctx, x, y, d, aurora[i], i === 2 ? a * 0.6 : a));
}

/** A frosted glass panel. */
export function glassPanel(ctx, x, y, w, h, o = {}) {
  const f = fx(ctx);
  rect(ctx, x, y, w, h, o.fill ?? f.glassFill, {
    radius: o.radius ?? 0.3, glass: { edge: f.glassEdge, rim: f.glassRim }, seq: o.seq ?? 0,
    ...(o.float ? { float: f.float } : {}),
  });
}

/** The one glowing card on a slide. */
function glowCard(ctx, x, y, w, h, o = {}) {
  const f = fx(ctx);
  rect(ctx, x, y, w, h, ctx.c.soft, { radius: 0.3, glow: { color: f.glow, blur: 0.45, edge: f.glowEdge }, seq: o.seq ?? 1 });
}

function chrome(ctx, kind, x, y, w, h, o = {}) {
  const f = fx(ctx);
  ctx.els.push({
    type: 'chrome', kind, x, y, w, h, tint: f.chrome, seq: o.seq ?? 0,
    ...(o.holo && f.chromeHolo ? { holo: f.holo } : {}),
    ...(o.rotate ? { rotate: o.rotate } : {}),
  });
}

/** A thin holographic (or gold) rule. */
const holoRule = (ctx, x, y, w = 1.5, seq = 2) => rect(ctx, x, y, w, 0.055, undefined, { gradient: holo(ctx, 90), radius: 0.03, seq });

/** Halo's product stage: a spotlight from above and a glowing floor. */
function stage(ctx, x, y, w, h) {
  light(ctx, x + w * 0.1, y - h * 0.35, w * 0.8, '#FFFFFF', 0.13);
  ctx.els.push({ type: 'ellipse', x: x + w * 0.05, y: y + h * 0.86, w: w * 0.9, h: h * 0.24, fill: fx(ctx).glow, soft: true, blur: 0.12, alpha: 0.9, seq: 0 });
}

function titleOpts(ctx, o = {}) {
  // holo letters only on dark directions, where every stop reads on the ground
  return fx(ctx).titleGradient ? { ...o, gradient: holo(ctx) } : o;
}

function micro(ctx, str, box, o = {}) {
  if (!str) return { height: 0 };
  return label(ctx, str, box, { maxLines: 1, max: 11, min: 9, ...o });
}

function corner(ctx) {
  const { m } = ctx;
  micro(ctx, ctx.deck.shortTitle ?? ctx.deck.title, { x: m, y: H - m * 0.55 - 0.18, w: 6, h: 0.25 }, { seq: 0 });
  micro(ctx, pageNo(ctx), { x: W - m - 1, y: H - m * 0.55 - 0.18, w: 1, h: 0.25 }, { align: 'right', seq: 0 });
}

// ---------------------------------------------------------------- Prism

const prism = {
  cover(ctx) {
    const { c, m, deck } = ctx;
    ground(ctx);
    chrome(ctx, 'sphere', W - 4.6, 0.55, 2.7, 2.7, { holo: true });
    chrome(ctx, 'ring', W - 2.9, H - 3.1, 3.6, 3.6, { holo: true });
    chrome(ctx, 'capsule', W - 6.4, -0.7, 0.85, 2.7, { rotate: 26 });
    // two small glass cards float over the chrome, carrying the deck's key facts
    const lines = deck.posterLines ?? [];
    [[W - 6.1, 3.45, 3.6], [W - 4.9, 4.75, 3.9]].forEach(([x, y, w], i) => {
      if (!lines[i]) return;
      glassPanel(ctx, x, y, w, 0.95, { radius: 0.22, float: true, seq: 3 + i });
      text(ctx, 'body', lines[i], { x: x + 0.3, y: y + 0.24, w: w - 0.6, h: 0.48 }, { max: 19, min: 11, bold: true, maxLines: 1, seq: 3 + i });
    });
    micro(ctx, deck.occasionLabel, { x: m, y: m, w: 6.5, h: 0.3 }, { color: c.accentText, seq: 1 });
    text(ctx, 'display', deck.title, { x: m, y: 1.5, w: 6.9, h: 3.1 }, titleOpts(ctx, { max: 50, min: 26, valign: 'bottom', maxLines: 4, lineHeight: 1.04, seq: 1 }));
    holoRule(ctx, m, 1.5 + 3.1 + 0.3, 1.6);
    text(ctx, 'body', deck.subtitle ?? '', { x: m, y: 1.5 + 3.1 + 0.6, w: 6.4, h: 0.9 }, { max: 19, min: 13, color: c.muted, maxLines: 2, seq: 2 });
    micro(ctx, [deck.author, deck.course, deck.date].filter(Boolean).join('  ·  '), { x: m, y: H - m - 0.3, w: 7.6, h: 0.3 }, { seq: 3 });
    return true;
  },
  section(ctx, s) {
    const { c, m } = ctx;
    ground(ctx);
    chrome(ctx, 'ring', W - 3.3, -1.1, 4.2, 4.2, { holo: true });
    glassPanel(ctx, m, 1.35, 3.9, 3.9, { radius: 0.4, seq: 1 });
    text(ctx, 'display', String(s.number).padStart(2, '0'), { x: m + 0.2, y: 1.35, w: 3.5, h: 3.9 }, titleOpts(ctx, { max: 116, min: 80, align: 'center', valign: 'middle', maxLines: 1, caps: false, seq: 1 }));
    micro(ctx, `Part ${String(s.number).padStart(2, '0')}`, { x: m + 4.5, y: 2.4, w: 5, h: 0.3 }, { color: c.accentText, seq: 2 });
    text(ctx, 'display', s.label, { x: m + 4.5, y: 2.8, w: W - m - 4.5 - m - 1.2, h: 2.0 }, { max: 44, min: 24, maxLines: 3, seq: 2 });
    corner(ctx);
  },
  statement(ctx, item, kick) {
    const { c, m } = ctx;
    ground(ctx);
    chrome(ctx, 'sphere', W - 2.6, H - 2.7, 2.0, 2.0);
    const x = m + 0.3;
    const w = W - 2 * m - 1.6;
    glassPanel(ctx, m, 1.2, W - 2 * m - 1.0, H - 2.6, { radius: 0.4 });
    micro(ctx, kick ?? 'Thesis', { x, y: 1.6, w, h: 0.3 }, { color: c.accentText, seq: 1 });
    text(ctx, 'display', item.text, { x, y: 2.05, w, h: H - 4.3 }, { max: 36, min: 20, valign: 'middle', maxLines: 5, lineHeight: 1.15, seq: 1 });
    if (item.note) text(ctx, 'body', item.note, { x, y: H - 2.2, w, h: 0.55 }, { max: 16, min: 12, color: c.muted, maxLines: 2, seq: 3 });
    corner(ctx);
  },
  question(ctx, item, kick) {
    const { c, m } = ctx;
    ground(ctx);
    chrome(ctx, 'sphere', W - 4.5, 1.4, 3.6, 3.6, { holo: true });
    chrome(ctx, 'capsule', W - 1.9, H - 2.6, 2.4, 0.75, { rotate: -18 });
    const w = W * 0.56;
    micro(ctx, kick ?? 'Question', { x: m, y: 1.5, w, h: 0.3 }, { color: c.accentText, seq: 1 });
    text(ctx, 'display', item.text, { x: m, y: 1.95, w, h: 3.3 }, { max: 40, min: 22, valign: 'middle', maxLines: 5, lineHeight: 1.1, seq: 1 });
    holoRule(ctx, m, 5.45, 1.4, 2);
    if (item.hint) text(ctx, 'body', item.hint, { x: m, y: 5.7, w, h: 0.7 }, { max: 17, min: 12, color: c.muted, maxLines: 2, seq: 3 });
    corner(ctx);
  },
  bigNumber(ctx, item, kick) {
    const { c, m } = ctx;
    ground(ctx, 0.7);
    const cw = 5.6;
    micro(ctx, kick ?? item.title, { x: m, y: m, w: W - 2 * m, h: 0.3 }, { color: c.accentText, seq: 1 });
    glowCard(ctx, m, 1.45, cw, H - 2.75);
    text(ctx, 'display', item.value, { x: m + 0.4, y: 1.75, w: cw - 0.8, h: 2.6 }, titleOpts(ctx, { max: 110, min: 50, valign: 'middle', maxLines: 1, caps: false, seq: 1 }));
    text(ctx, 'body', item.label, { x: m + 0.4, y: 4.45, w: cw - 0.8, h: 1.1 }, { max: 18, min: 12, color: c.muted, maxLines: 3, seq: 2 });
    const rx = m + cw + 0.7;
    const rw = W - rx - m;
    const t = text(ctx, 'display', item.title ?? '', { x: rx, y: 1.6, w: rw, h: 1.6 }, { max: 28, min: 18, maxLines: 3, seq: 2 });
    const cap = text(ctx, 'body', item.caption ?? '', { x: rx, y: 1.6 + t.height + 0.3, w: rw, h: 2.6 }, { max: 19, min: 13, color: c.muted, seq: 3 });
    if (item.source) micro(ctx, item.source, { x: rx, y: 1.6 + t.height + 0.5 + cap.height, w: rw, h: 0.5 }, { maxLines: 2, seq: 3 });
    corner(ctx);
  },
};

// ---------------------------------------------------------------- Pearl

const pearl = {
  cover(ctx) {
    const { c, deck } = ctx;
    ground(ctx);
    const [px, py, pw, ph] = [1.7, 1.15, W - 3.4, H - 2.3];
    chrome(ctx, 'sphere', px + pw - 1.5, py - 0.9, 2.3, 2.3, { holo: true });
    chrome(ctx, 'ring', px - 1.3, py + ph - 1.7, 2.7, 2.7, { holo: true });
    glassPanel(ctx, px, py, pw, ph, { radius: 0.5, float: true });
    const x = px + 0.8;
    const w = pw - 1.6;
    micro(ctx, deck.occasionLabel, { x, y: py + 0.65, w, h: 0.3 }, { align: 'center', color: c.accentText, seq: 1 });
    text(ctx, 'display', deck.title, { x, y: py + 1.15, w, h: 2.5 }, { max: 44, min: 22, align: 'center', valign: 'middle', maxLines: 3, lineHeight: 1.06, seq: 1 });
    holoRule(ctx, W / 2 - 0.8, py + 3.85, 1.6);
    text(ctx, 'body', deck.subtitle ?? '', { x: x + 0.6, y: py + 4.1, w: w - 1.2, h: 0.75 }, { max: 18, min: 12, align: 'center', color: c.muted, maxLines: 2, seq: 2 });
    micro(ctx, [deck.author, deck.course, deck.date].filter(Boolean).join('  ·  '), { x, y: py + ph - 0.7, w, h: 0.3 }, { align: 'center', seq: 3 });
    return true;
  },
  section(ctx, s) {
    const { c } = ctx;
    ground(ctx);
    chrome(ctx, 'ring', W / 2 - 1.9, 0.75, 3.8, 3.8, { holo: true });
    text(ctx, 'display', String(s.number).padStart(2, '0'), { x: W / 2 - 1.9, y: 0.75, w: 3.8, h: 3.8 }, { max: 96, min: 60, align: 'center', valign: 'middle', maxLines: 1, caps: false, color: c.ink, seq: 1 });
    text(ctx, 'display', s.label, { x: 1.5, y: 4.85, w: W - 3, h: 1.3 }, { max: 36, min: 22, align: 'center', maxLines: 2, seq: 2 });
    corner(ctx);
  },
  statement(ctx, item, kick) {
    const { c } = ctx;
    ground(ctx);
    const [px, py, pw, ph] = [1.4, 1.1, W - 2.8, H - 2.5];
    glassPanel(ctx, px, py, pw, ph, { radius: 0.5 });
    chrome(ctx, 'sphere', px + pw - 0.9, py + ph - 1.0, 1.6, 1.6, { holo: true });
    micro(ctx, kick ?? 'Thesis', { x: px + 0.8, y: py + 0.55, w: pw - 1.6, h: 0.3 }, { align: 'center', color: c.accentText, seq: 1 });
    text(ctx, 'display', item.text, { x: px + 0.9, y: py + 1.0, w: pw - 1.8, h: ph - 2.0 }, { max: 32, min: 18, align: 'center', valign: 'middle', maxLines: 5, lineHeight: 1.18, seq: 1 });
    if (item.note) text(ctx, 'body', item.note, { x: px + 1.2, y: py + ph - 0.95, w: pw - 2.4, h: 0.55 }, { max: 15, min: 11, align: 'center', color: c.muted, maxLines: 2, seq: 3 });
    corner(ctx);
  },
  question(ctx, item, kick) {
    const { c } = ctx;
    ground(ctx);
    chrome(ctx, 'capsule', W / 2 - 1.6, 0.7, 3.2, 0.9, { holo: true });
    micro(ctx, kick ?? 'Question', { x: 1, y: 2.0, w: W - 2, h: 0.3 }, { align: 'center', color: c.accentText, seq: 1 });
    text(ctx, 'display', item.text, { x: 1.6, y: 2.45, w: W - 3.2, h: 2.9 }, { max: 38, min: 20, align: 'center', valign: 'middle', maxLines: 4, lineHeight: 1.12, seq: 1 });
    if (item.hint) text(ctx, 'body', item.hint, { x: 2.2, y: 5.6, w: W - 4.4, h: 0.7 }, { max: 17, min: 12, align: 'center', color: c.muted, maxLines: 2, seq: 3 });
    corner(ctx);
  },
  bigNumber(ctx, item, kick) {
    const { c, m } = ctx;
    ground(ctx, 0.7);
    micro(ctx, kick ?? item.title, { x: m, y: m, w: W - 2 * m, h: 0.3 }, { align: 'center', color: c.accentText, seq: 1 });
    const [gx, gy, gw, gh] = [W / 2 - 3.3, 1.45, 6.6, 3.0];
    glowCard(ctx, gx, gy, gw, gh);
    text(ctx, 'display', item.value, { x: gx + 0.4, y: gy + 0.2, w: gw - 0.8, h: 1.9 }, { max: 96, min: 46, align: 'center', valign: 'middle', maxLines: 1, caps: false, color: c.accentText, seq: 1 });
    text(ctx, 'body', item.label, { x: gx + 0.5, y: gy + 2.05, w: gw - 1.0, h: 0.8 }, { max: 17, min: 12, align: 'center', color: c.muted, maxLines: 2, seq: 2 });
    const cap = text(ctx, 'body', item.caption ?? '', { x: 1.8, y: 4.85, w: W - 3.6, h: 1.1 }, { max: 18, min: 12, align: 'center', color: c.ink, maxLines: 3, seq: 3 });
    if (item.source) micro(ctx, item.source, { x: 1.8, y: 4.95 + cap.height, w: W - 3.6, h: 0.3 }, { align: 'center', seq: 3 });
    corner(ctx);
  },
};

// ---------------------------------------------------------------- Halo

const halo = {
  cover(ctx) {
    const { c, m, deck } = ctx;
    background(ctx);
    // one warm glow behind a gold capsule standing on a lit stage
    light(ctx, W - 7.4, -1.6, 8.4, fx(ctx).aurora[0], 0.3);
    stage(ctx, W - 5.0, 1.0, 3.2, 5.2);
    chrome(ctx, 'capsule', W - 4.0, 1.1, 1.2, 4.6);
    chrome(ctx, 'sphere', W - 2.75, 4.3, 1.4, 1.4);
    micro(ctx, deck.occasionLabel, { x: m, y: m, w: 6.5, h: 0.3 }, { color: c.accentText, seq: 1 });
    text(ctx, 'display', deck.title, { x: m, y: 1.4, w: 6.8, h: 3.3 }, titleOpts(ctx, { max: 50, min: 26, valign: 'bottom', maxLines: 4, lineHeight: 1.05, seq: 1 }));
    holoRule(ctx, m, 4.95, 1.2);
    text(ctx, 'body', deck.subtitle ?? '', { x: m, y: 5.2, w: 6.4, h: 0.8 }, { max: 18, min: 12, color: c.muted, maxLines: 2, seq: 2 });
    micro(ctx, [deck.author, deck.course, deck.date].filter(Boolean).join('  ·  '), { x: m, y: H - m - 0.3, w: 7.6, h: 0.3 }, { seq: 3 });
    return true;
  },
  section(ctx, s) {
    const { c, m } = ctx;
    background(ctx);
    light(ctx, -2.2, H / 2 - 4.2, 8.4, fx(ctx).aurora[0], 0.26);
    text(ctx, 'display', String(s.number).padStart(2, '0'), { x: m, y: 0.9, w: 6.2, h: 4.6 }, { font: ctx.dir.fonts.poster, max: 230, min: 140, maxLines: 1, caps: false, bold: false, valign: 'middle', gradient: holo(ctx, 160), seq: 1 });
    micro(ctx, `Part ${String(s.number).padStart(2, '0')}`, { x: m + 6.6, y: 2.8, w: 5, h: 0.3 }, { color: c.accentText, seq: 2 });
    text(ctx, 'display', s.label, { x: m + 6.6, y: 3.2, w: W - m - 6.6 - m, h: 1.8 }, { max: 40, min: 22, maxLines: 3, seq: 2 });
    corner(ctx);
  },
  statement(ctx, item, kick) {
    const { c, m } = ctx;
    background(ctx);
    light(ctx, W / 2 - 4.5, H / 2 - 4.5, 9, fx(ctx).aurora[0], 0.2);
    const w = W - 2 * m - 2.4;
    const x = (W - w) / 2;
    micro(ctx, kick ?? 'Thesis', { x, y: 1.55, w, h: 0.3 }, { align: 'center', color: c.accentText, seq: 1 });
    text(ctx, 'display', item.text, { x, y: 2.0, w, h: 3.4 }, { max: 38, min: 20, align: 'center', valign: 'middle', maxLines: 5, lineHeight: 1.15, seq: 1 });
    holoRule(ctx, W / 2 - 0.6, 5.65, 1.2, 2);
    if (item.note) text(ctx, 'body', item.note, { x, y: 5.9, w, h: 0.6 }, { max: 15, min: 11, align: 'center', color: c.muted, maxLines: 2, seq: 3 });
    corner(ctx);
  },
  question(ctx, item, kick) {
    const { c, m } = ctx;
    background(ctx);
    light(ctx, W - 6.6, 0.2, 6.4, fx(ctx).aurora[0], 0.24);
    stage(ctx, W - 4.4, 1.6, 2.6, 4.0);
    chrome(ctx, 'sphere', W - 4.0, 2.6, 1.9, 1.9);
    const w = W * 0.56;
    micro(ctx, kick ?? 'Question', { x: m, y: 1.5, w, h: 0.3 }, { color: c.accentText, seq: 1 });
    text(ctx, 'display', item.text, { x: m, y: 1.95, w, h: 3.4 }, { max: 40, min: 22, valign: 'middle', maxLines: 5, lineHeight: 1.12, seq: 1 });
    if (item.hint) text(ctx, 'body', item.hint, { x: m, y: 5.65, w, h: 0.7 }, { max: 17, min: 12, color: c.muted, maxLines: 2, seq: 3 });
    corner(ctx);
  },
  bigNumber(ctx, item, kick) {
    const { c, m } = ctx;
    background(ctx);
    light(ctx, -1.6, -1.2, 7.6, fx(ctx).aurora[0], 0.22);
    micro(ctx, kick ?? item.title, { x: m, y: m, w: W - 2 * m, h: 0.3 }, { color: c.accentText, seq: 1 });
    const cw = 5.4;
    glowCard(ctx, m, 1.45, cw, H - 2.75);
    text(ctx, 'display', item.value, { x: m + 0.4, y: 1.75, w: cw - 0.8, h: 2.6 }, { font: ctx.dir.fonts.poster, bold: false, max: 110, min: 50, valign: 'middle', maxLines: 1, caps: false, gradient: holo(ctx, 160), seq: 1 });
    text(ctx, 'body', item.label, { x: m + 0.4, y: 4.45, w: cw - 0.8, h: 1.1 }, { max: 18, min: 12, color: c.muted, maxLines: 3, seq: 2 });
    const rx = m + cw + 0.7;
    const rw = W - rx - m;
    const t = text(ctx, 'display', item.title ?? '', { x: rx, y: 1.6, w: rw, h: 1.6 }, { max: 28, min: 18, maxLines: 3, seq: 2 });
    const cap = text(ctx, 'body', item.caption ?? '', { x: rx, y: 1.6 + t.height + 0.3, w: rw, h: 2.6 }, { max: 19, min: 13, color: c.muted, seq: 3 });
    if (item.source) micro(ctx, item.source, { x: rx, y: 1.6 + t.height + 0.5 + cap.height, w: rw, h: 0.5 }, { maxLines: 2, seq: 3 });
    corner(ctx);
  },
};

const GLASS = { prism, pearl, halo };

/** The glass layout for this slide, if the direction has one. */
export function glassForm(dir, form) {
  return dir.family === 'glass' ? GLASS[dir.id]?.[form] : undefined;
}

/**
 * Re-dress a regular content slide in glass: aurora behind, soft panels become
 * frosted glass, pictures get rounded corners (and a stage light in Halo).
 */
export function glassify(ctx) {
  const { c } = ctx;
  const f = fx(ctx);
  const els = ctx.els;
  const out = [];
  const bgIndex = els.findIndex((e) => e.type === 'rect' && e.w >= W - 0.01 && e.h >= H - 0.01);
  els.forEach((e, i) => {
    if (e.type === 'rect' && i !== bgIndex && e.fill === c.soft && e.w < W - 0.01) {
      out.push({ ...e, fill: f.glassFill, radius: 0.24, glass: { edge: f.glassEdge, rim: f.glassRim }, alpha: e.alpha === 0 ? 0 : 1 });
    } else if (e.type === 'rect' && e.fill === c.accent && e.alpha != null && e.alpha < 1 && e.w < W - 0.01) {
      // a tinted step or block becomes a glowing glass panel
      out.push({ ...e, fill: f.glassFill, radius: 0.24, glass: { edge: f.glowEdge, rim: f.glassRim }, glow: { color: f.glow, blur: 0.3 }, alpha: 1 });
    } else if (e.type === 'image' && !e.round) {
      if (f.stage) {
        out.push({ type: 'ellipse', x: e.x + e.w * 0.05, y: e.y + e.h * 0.9, w: e.w * 0.9, h: Math.min(1.2, e.h * 0.2), fill: f.glow, soft: true, blur: 0.12, alpha: 0.8, seq: e.seq });
      }
      out.push({ ...e, radius: e.w >= W - 0.01 ? 0 : 0.18 });
    } else {
      out.push(e);
    }
    if (i === bgIndex) {
      const sub = { ...ctx, els: [] };
      groundLights(sub, 0.5);
      out.push(...sub.els);
    }
  });
  ctx.els = out;
  return out;
}

function groundLights(ctx, strength) {
  // the aurora part of ground(), without the background rect
  const tmp = { ...ctx, els: [] };
  ground(tmp, strength);
  ctx.els.push(...tmp.els.slice(1));
}
