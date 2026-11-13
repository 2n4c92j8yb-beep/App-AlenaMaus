// Slide forms. Each form turns one content item into positioned elements
// (inches on a 13.333 x 7.5 canvas), following the direction's layout brief.
// The element list is renderer-neutral: the HTML preview and the PowerPoint
// export both draw from it, so what you see is what you download.
//
// Element types:
//   text    { x, y, w, h, text, font, size, color, bold, italic, align, valign, lineHeight, caps, tracking, hanging, fits }
//   rect    { x, y, w, h, fill, alpha, rotate }
//   ellipse { x, y, w, h, fill, alpha }
//   image   { x, y, w, h, src, alt, fit: 'cover' | 'contain', round, radius, natW, natH }
//   svg     { x, y, w, h, svg, alpha }   a generated texture (textures.js), exported as a picture
//   chrome  { x, y, w, h, kind: 'sphere' | 'capsule' | 'ring', tint: 'silver' | 'gold', holo: [colours], rotate }
// Glass look extras (see glass.js): rect/ellipse `radius`, `gradient` { angle, stops },
// `glass` { edge, rim } (frosted, blurs what is behind), `glow` { color, blur, edge }, `float` (shadow colour),
// ellipse `soft` + `blur` (a light blob); text `gradient` (holo letters) and `glow`.
//   line    { x1, y1, x2, y2, color, width }   only the Ledger direction uses lines
//   arrow   { x1, y1, x2, y2, color, width }   for before/after pairs
// Every element has `seq`: the order in which it appears when presenting
// (0 = with the slide, 1 = headline, 2+ = content, one step per item).

import { FONTS } from './fonts.js';
import { SLIDE_W as W, SLIDE_H as H, fitText, textHeight } from '../engine/fit.js';
import { posterForm } from './posters.js';
import { glassForm, glassify } from './glass.js';
import { applyAccent, invertPalette } from './accents.js';

// ---------- colour helpers ----------

export function contrast(c1, c2) {
  const L = (hex) => {
    const n = parseInt(hex.slice(1), 16);
    const ch = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => {
      v /= 255;
      return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * ch[0] + 0.7152 * ch[1] + 0.0722 * ch[2];
  };
  const [hi, lo] = [L(c1), L(c2)].sort((p, q) => q - p);
  return (hi + 0.05) / (lo + 0.05);
}
const onColor = (hex, a, b) => (contrast(hex, a) >= contrast(hex, b) ? a : b);

// ---------- context and primitives ----------

function makeCtx(dir, deck, slide, index, total, density) {
  // Accent colours too light for text (e.g. mustard) keep their role in
  // blocks and shapes; text uses a darker version of the same hue.
  // a slide planned with the `invert` accent uses the direction's second tone
  const c = slide?.accent?.kind === 'invert' ? invertPalette({ ...dir.colors }, contrast) : { ...dir.colors };
  c.accentText = c.accentText ?? (contrast(c.accent, c.bg) >= 3 ? c.accent : c.ink);
  return {
    dir, L: dir.layout, c, deck, slide, slideIndex: index, total, density,
    m: dir.layout.margin,
    scale: dir.layout.scale ?? 1,
    dz: density === 'dense' ? 0.88 : density === 'light' ? 1.1 : 1,
    onAccent: c.onAccent ?? onColor(c.accent, c.bg, c.ink),
    els: [],
  };
}

export const sig = (ctx) => ctx.L.signature;
const isLedger = (ctx) => sig(ctx) === 'ledger';

/** Add a fitted text element. Returns { el, height, size }. */
export function text(ctx, role, str, box, o = {}) {
  const key = o.font ?? ctx.dir.fonts[role];
  const f = FONTS[key];
  const isDisplay = role === 'display';
  const caps = o.caps ?? (isDisplay && !!ctx.L.upperDisplay);
  const content = caps ? String(str).toUpperCase() : String(str);
  const lineHeight = o.lineHeight ?? (isDisplay ? 1.1 : 1.3);
  const bold = o.bold ?? (isDisplay && !!ctx.L.boldDisplay);
  const tracking = o.tracking ?? 0;
  const rotated = o.rotate === 90 || o.rotate === -90;
  // letter spacing widens every character; rotated text runs along the box's height
  const r = fitText(content, rotated ? box.h : box.w, rotated ? box.w : box.h, {
    max: o.max, min: o.min ?? Math.round(o.max * 0.6),
    factor: ((caps ? f.capsFactor ?? f.factor * 1.08 : f.factor) + tracking) * (bold ? 1.06 : 1),
    lineHeight, maxLines: o.maxLines ?? Infinity,
  });
  const el = {
    type: 'text', ...box, text: String(str), font: key,
    size: r.size, color: o.color ?? ctx.c.ink, bold,
    italic: o.italic ?? (isDisplay && !!ctx.L.italicDisplay),
    align: o.align ?? 'left', valign: o.valign ?? 'top',
    lineHeight, caps, tracking,
    hanging: !!o.hanging, fits: r.fits, role,
    seq: o.seq ?? (isDisplay ? 1 : 2), bleed: !!o.bleed,
    ...(o.rotate ? { rotate: o.rotate } : {}),
    ...(o.alpha != null ? { alpha: o.alpha } : {}),
    ...(o.fillImage ? { fillImage: o.fillImage } : {}),
    ...(o.gradient ? { gradient: o.gradient } : {}),
    ...(o.glow ? { glow: o.glow } : {}),
  };
  ctx.els.push(el);
  return { el, height: Math.min(rotated ? box.w : box.h, textHeight(r.lines, r.size, lineHeight)), size: r.size };
}

/** Small label (caption, credit) in the direction's label style. */
export function label(ctx, str, box, o = {}) {
  const st = ctx.L.labels;
  return text(ctx, 'label', str, box, {
    max: o.max ?? 13, min: o.min ?? 10, color: o.color ?? ctx.c.muted,
    caps: st === 'upper', italic: st === 'italic', align: o.align, valign: o.valign,
    tracking: st === 'upper' ? ctx.L.labelTracking ?? 0.12 : 0, maxLines: o.maxLines ?? 2, lineHeight: 1.25, seq: o.seq ?? 2,
  });
}

/** Kicker above a headline: plain label, or a filled tag. Returns its height. */
function kicker(ctx, str, x, y, maxW, o = {}) {
  if (!str) return 0;
  if (ctx.L.kicker === 'tag' && !o.plain) {
    const f = FONTS[ctx.dir.fonts.label];
    const size = 11;
    const w = Math.min(maxW, str.length * (size / 72) * f.factor * 1.25 + 0.36);
    const tx = o.align === 'center' ? x + (maxW - w) / 2 : x;
    rect(ctx, tx, y, w, 0.32, o.fill ?? ctx.c.accent, { seq: 1 });
    text(ctx, 'label', str, { x: tx + 0.04, y: y + 0.05, w: w - 0.08, h: 0.24 }, {
      max: size, min: 9, color: o.fill ? ctx.c.bg : ctx.onAccent, caps: true, tracking: 0.12, align: 'center', maxLines: 1, seq: 1, bold: true,
    });
    return 0.5;
  }
  label(ctx, str, { x, y, w: maxW, h: 0.3 }, { align: o.align, color: o.color ?? ctx.c.accentText, seq: 1, maxLines: 1 });
  return 0.42;
}

export const rect = (ctx, x, y, w, h, fill, extra = {}) => ctx.els.push({ type: 'rect', x, y, w, h, fill, seq: 0, ...extra });
const ellipse = (ctx, x, y, w, h, fill, extra = {}) => ctx.els.push({ type: 'ellipse', x, y, w, h, fill, seq: 0, ...extra });
const line = (ctx, x1, y1, x2, y2, color, width = 0.75) => ctx.els.push({ type: 'line', x1, y1, x2, y2, color, width, seq: 0 });

/** Place a picture according to the direction's photo treatment. */
function image(ctx, img, box, o = {}) {
  const style = o.style ?? ctx.L.photo;
  const seq = o.seq ?? 1;
  if (style === 'round') {
    const d = Math.min(box.w, box.h);
    const x = box.x + (box.w - d) / 2;
    const y = box.y + (box.h - d) / 2;
    ellipse(ctx, x + 0.22, y + 0.22, d, d, ctx.c.accent, { alpha: 0.35, seq });
    ctx.els.push({ type: 'image', x, y, w: d, h: d, src: img.src, alt: img.alt ?? '', ...(ctx.L.photoFilter ? { filter: ctx.L.photoFilter } : {}), fit: 'cover', round: true, natW: img.w, natH: img.h, seq });
    return { x, y, w: d, h: d };
  }
  if (style === 'framed') {
    // contain inside a paper mat
    const pad = 0.22;
    const ar = (img.w ?? 4) / (img.h ?? 3);
    let w = box.w - 2 * pad;
    let h = w / ar;
    if (h > box.h - 2 * pad) { h = box.h - 2 * pad; w = h * ar; }
    const x = box.x + (box.w - w - 2 * pad) / 2;
    const y = box.y + (box.h - h - 2 * pad) / 2;
    rect(ctx, x, y, w + 2 * pad, h + 2 * pad, o.mat ?? ctx.c.soft, { seq });
    ctx.els.push({ type: 'image', x: x + pad, y: y + pad, w, h, src: img.src, alt: img.alt ?? '', ...(ctx.L.photoFilter ? { filter: ctx.L.photoFilter } : {}), fit: 'cover', natW: img.w, natH: img.h, seq });
    return { x, y, w: w + 2 * pad, h: h + 2 * pad };
  }
  if (style === 'offset') {
    rect(ctx, box.x + 0.3, box.y + 0.3, box.w, box.h, ctx.c.accent, { seq, alpha: 0.9 });
    ctx.els.push({ type: 'image', x: box.x, y: box.y, w: box.w - 0.0, h: box.h, src: img.src, alt: img.alt ?? '', ...(ctx.L.photoFilter ? { filter: ctx.L.photoFilter } : {}), fit: 'cover', natW: img.w, natH: img.h, seq });
    return box;
  }
  ctx.els.push({ type: 'image', ...box, src: img.src, alt: img.alt ?? '', ...(ctx.L.photoFilter ? { filter: ctx.L.photoFilter } : {}), fit: 'cover', natW: img.w, natH: img.h, seq });
  return box;
}

// ---------- background and signature graphics ----------

export function background(ctx, fill) {
  rect(ctx, 0, 0, W, H, fill ?? ctx.c.bg);
}

/**
 * The direction's signature device. `kind` says what sort of slide this is:
 * 'cover' | 'section' | 'statement' | 'content' | 'quiet' (photos, references).
 */
function signature(ctx, kind) {
  const { c, slideIndex: i, slide } = ctx;
  const v = i % 3;
  switch (sig(ctx)) {
    case 'spots': {
      const big = kind === 'content' || kind === 'quiet' ? 0.6 : 1;
      if (kind === 'quiet') return;
      const spots = [
        [W - 3.4 * big, -2.2 * big, 5.6 * big],
        [-1.6 * big, H - 2.4 * big, 4.2 * big],
        [W - 2.6 * big, H - 2.2 * big, 4 * big],
      ];
      ellipse(ctx, ...spots[v].slice(0, 2), spots[v][2], spots[v][2], c.accent, { alpha: kind === 'content' ? 0.08 : 0.14 });
      if (kind !== 'content') ellipse(ctx, ...spots[(v + 1) % 3].slice(0, 2), spots[(v + 1) % 3][2] * 0.7, spots[(v + 1) % 3][2] * 0.7, c.ink, { alpha: 0.05 });
      return;
    }
    case 'circles': {
      if (kind === 'quiet') return;
      if (kind === 'content') { ellipse(ctx, W - 2.1, -1.4, 3.6, 3.6, c.soft); return; }
      ellipse(ctx, -2.2 + v * 0.6, H - 4.2, 6.2, 6.2, c.soft);
      ellipse(ctx, W - 3.2, -1.5 + v * 0.4, 4, 4, c.accent, { alpha: 0.16 });
      return;
    }
    case 'blocks': {
      if (kind === 'quiet') return;
      const s = kind === 'content' ? 0.7 : 1;
      rect(ctx, W - 4.2 * s, -0.5, 4.8 * s, 3.6 * s, c.accent, { alpha: 0.1 });
      rect(ctx, W - 2.8 * s, 1.8 * s, 3.4 * s, 4.2 * s, c.accent, { alpha: 0.07 });
      return;
    }
    case 'glow': {
      if (kind === 'quiet') return;
      if (kind === 'content') { ellipse(ctx, W - 3.5, H - 3.2, 5.5, 5.5, c.accent, { alpha: 0.07 }); return; }
      ellipse(ctx, W * 0.5, -2.2, 8.5, 8.5, c.accent, { alpha: 0.13 });
      return;
    }
    case 'tabs': {
      // an index tab on the right edge, lower for each section
      const n = slide?.sectionNo ?? 0;
      if (kind !== 'quiet') rect(ctx, W - 0.32, 0.7 + (n % 4) * 1.35, 0.32, 1.15, c.accent);
      return;
    }
    case 'plate': {
      if (kind === 'section') rect(ctx, 0, 0, W * 0.4, H, c.soft);
      if (kind === 'statement') rect(ctx, W * 0.74, 0, W * 0.26, H, c.soft);
      return;
    }
    case 'offset': {
      if (kind === 'statement') rect(ctx, W - 1.6, 0, 1.6, 1.6, c.accent);
      if (kind === 'content') rect(ctx, W - 0.7, 0, 0.7, 0.7, c.accent);
      return;
    }
    case 'masthead': {
      if (kind === 'statement') rect(ctx, 0, 0, W, 0.5, c.ink);
      return;
    }
    case 'bleed':
    case 'band':
    case 'panel':
    case 'margin':
    case 'wall':
    case 'ledger':
    default:
  }
}

/** Swiss/Poster: a giant number running off the slide edge. */
function bleedNumber(ctx, n, { color, side = 'right', size = 300 } = {}) {
  const s = String(n).padStart(2, '0');
  const w = 6.5;
  const x = side === 'right' ? W - w * 0.78 : -0.35;
  text(ctx, 'display', s, { x, y: H - 3.9, w, h: 4.4 }, {
    max: size, min: size, color: color ?? ctx.c.soft, italic: false, caps: false, maxLines: 1, seq: 0, bleed: true,
    align: side === 'right' ? 'left' : 'left', lineHeight: 1,
  });
}

export function footer(ctx, color) {
  if (!ctx.L.footer) return;
  const { m } = ctx;
  const y = H - m * 0.55 - 0.18;
  label(ctx, ctx.deck.shortTitle ?? ctx.deck.title, { x: m, y, w: 6, h: 0.25 }, { max: 10, min: 9, color, maxLines: 1, seq: 0 });
  label(ctx, String(ctx.slideIndex + 1).padStart(2, '0'), { x: W - m - 1, y, w: 1, h: 0.25 }, { max: 10, min: 9, align: 'right', color, maxLines: 1, seq: 0 });
}
const footerSpace = (ctx) => (ctx.L.footer ? 0.45 : 0);

/**
 * Headline + body area. Returns the body box the form fills.
 * 'top' puts the headline above the content, 'side' in a left column.
 */
function frame(ctx, title, kick) {
  const { L, c, m, scale } = ctx;
  const center = L.align === 'center';
  if (L.titlePos === 'side') {
    const colW = 3.55;
    if (sig(ctx) === 'panel' || sig(ctx) === 'margin') rect(ctx, 0, 0, m + colW + 0.35, H, c.soft);
    if (sig(ctx) === 'bleed') bleedNumber(ctx, ctx.slideIndex + 1, { side: 'left', size: 230 });
    let y = m;
    y += kicker(ctx, kick, m, y, colW);
    text(ctx, 'display', title, { x: m, y, w: colW, h: H - y - m - 0.6 }, { max: Math.round(30 * scale), min: 18, maxLines: 7 });
    const bx = m + colW + 0.85;
    return { x: bx, y: m + 0.05, w: W - bx - m - (sig(ctx) === 'tabs' ? 0.3 : 0), h: H - 2 * m - footerSpace(ctx) - 0.05 };
  }
  let y = m;
  y += kicker(ctx, kick, m, y, W - 2 * m, { align: center ? 'center' : 'left' });
  const right = sig(ctx) === 'tabs' ? 0.35 : 0;
  const t = text(ctx, 'display', title, { x: m, y, w: W - 2 * m - right, h: 1.35 * scale }, {
    max: Math.round(32 * scale), min: 20, maxLines: 2, align: center ? 'center' : 'left',
  });
  let by = y + t.height + 0.55;
  if (isLedger(ctx)) { line(ctx, m, by - 0.2, W - m, by - 0.2, c.muted, 0.5); by += 0.2; }
  return { x: m, y: by, w: W - 2 * m - right, h: H - by - m - footerSpace(ctx) };
}

// ---------- forms ----------

function cover(ctx) {
  const { L, c, m, scale, deck } = ctx;
  const meta = [deck.author, deck.course, deck.date].filter(Boolean).join('  ·  ');
  const titleMax = Math.round(54 * scale);
  const img = deck.coverImage;
  switch (L.cover) {
    case 'block': {
      background(ctx, c.accent);
      const ink = ctx.onAccent;
      const tw = img ? W * 0.5 : W * 0.8;
      if (img) image(ctx, img, { x: W * 0.56, y: 0, w: W * 0.44, h: H }, { style: 'bleed', seq: 0 });
      label(ctx, deck.occasionLabel, { x: m, y: m, w: tw, h: 0.3 }, { color: ink, seq: 1 });
      text(ctx, 'display', deck.title, { x: m, y: H * 0.26, w: tw, h: H * 0.46 }, { max: titleMax + 6, min: 28, color: ink, valign: 'bottom', maxLines: 5 });
      text(ctx, 'body', deck.subtitle ?? '', { x: m, y: H * 0.74, w: tw, h: 0.8 }, { max: 20, min: 14, color: ink });
      label(ctx, meta, { x: m, y: H - m - 0.55, w: tw, h: 0.55 }, { color: ink, maxLines: 2, seq: 3 });
      return;
    }
    case 'split': {
      background(ctx);
      const panelW = W * 0.46;
      if (img) {
        image(ctx, img, { x: 0, y: 0, w: panelW, h: H }, { style: 'bleed', seq: 0 });
        const x = panelW + 0.8;
        const w = W - x - m;
        label(ctx, deck.occasionLabel, { x, y: m, w, h: 0.3 }, { seq: 1 });
        const t = text(ctx, 'display', deck.title, { x, y: m + 0.8, w, h: H * 0.5 }, { max: titleMax, min: 26, maxLines: 5 });
        text(ctx, 'body', deck.subtitle ?? '', { x, y: m + 0.8 + t.height + 0.35, w, h: 1.2 }, { max: 20, min: 14, color: c.muted });
        label(ctx, meta, { x, y: H - m - 0.6, w, h: 0.6 }, { maxLines: 2, seq: 3 });
        return;
      }
      rect(ctx, 0, 0, panelW, H, sig(ctx) === 'bleed' ? c.accent : c.soft);
      const pInk = sig(ctx) === 'bleed' ? ctx.onAccent : c.ink;
      label(ctx, deck.occasionLabel, { x: m, y: m, w: panelW - 2 * m, h: 0.3 }, { color: pInk, seq: 1 });
      text(ctx, 'display', deck.title, { x: m, y: H * 0.22, w: panelW - m - 0.5, h: H * 0.62 }, { max: titleMax, min: 26, valign: 'bottom', maxLines: 6, color: pInk });
      text(ctx, 'body', deck.subtitle ?? '', { x: panelW + 0.8, y: H * 0.45, w: W - panelW - 0.8 - m, h: 1.5 }, { max: 22, min: 14 });
      label(ctx, meta, { x: panelW + 0.8, y: H - m - 0.6, w: W - panelW - 0.8 - m, h: 0.6 }, { maxLines: 2, seq: 3 });
      return;
    }
    case 'center': {
      background(ctx);
      signature(ctx, 'cover');
      let y = H * 0.16;
      if (img) {
        image(ctx, img, { x: W / 2 - 1.15, y: H * 0.08, w: 2.3, h: 2.3 }, { style: L.photo === 'round' ? 'round' : 'framed', seq: 0 });
        y = H * 0.08 + 2.55;
      }
      label(ctx, deck.occasionLabel, { x: m, y, w: W - 2 * m, h: 0.3 }, { align: 'center', seq: 1 });
      const th = img ? H * 0.26 : H * 0.36;
      text(ctx, 'display', deck.title, { x: m + 0.6, y: y + 0.45, w: W - 2 * m - 1.2, h: th }, { max: titleMax, min: 26, align: 'center', valign: 'middle', maxLines: 3 });
      const sub = text(ctx, 'body', deck.subtitle ?? '', { x: m + 1, y: y + 0.6 + th, w: W - 2 * m - 2, h: 0.8 }, { max: 20, min: 14, align: 'center', color: c.muted });
      // the author line sits below the subtitle even when wide margins push it down
      const my = Math.min(H - 0.5, Math.max(H - m - 0.35, y + 0.6 + th + sub.height + 0.2));
      label(ctx, meta, { x: m, y: my, w: W - 2 * m, h: 0.3 }, { align: 'center', maxLines: 1, seq: 3 });
      return;
    }
    case 'top': {
      background(ctx);
      const mast = sig(ctx) === 'masthead';
      if (mast) {
        rect(ctx, 0, 0, W, 0.95, c.ink);
        label(ctx, deck.occasionLabel, { x: m, y: 0.33, w: W - 2 * m, h: 0.3 }, { color: c.bg, seq: 0 });
      } else {
        label(ctx, deck.occasionLabel, { x: m, y: m, w: W - 2 * m, h: 0.3 }, { seq: 1 });
        if (isLedger(ctx)) line(ctx, m, m + 0.45, W - m, m + 0.45, c.ink, 1);
      }
      const top = mast ? 1.5 : m + 0.8;
      const tw = img ? W * 0.5 : W * 0.82;
      if (img) image(ctx, img, { x: W * 0.58, y: top, w: W * 0.42 - m, h: H - top - m - 0.4 }, { seq: 0 });
      const t = text(ctx, 'display', deck.title, { x: m, y: top, w: tw, h: H * 0.42 }, { max: titleMax + 4, min: 28, maxLines: 4 });
      text(ctx, 'body', deck.subtitle ?? '', { x: m, y: top + t.height + 0.35, w: tw, h: 1.0 }, { max: 22, min: 14, color: c.muted });
      label(ctx, meta, { x: m, y: H - m - 0.55, w: tw, h: 0.55 }, { maxLines: 2, seq: 3 });
      return;
    }
    default: { // 'bottom'
      background(ctx);
      signature(ctx, 'cover');
      const tw = img ? W * 0.5 : W * 0.74;
      if (img) image(ctx, img, { x: W * 0.6, y: L.photo === 'framed' ? m : 0, w: W * 0.4 - (L.photo === 'framed' ? m : 0), h: L.photo === 'framed' ? H - 2 * m : H }, { seq: 0 });
      label(ctx, deck.occasionLabel, { x: m, y: m, w: tw, h: 0.3 }, { seq: 1 });
      text(ctx, 'display', deck.title, { x: m, y: H * 0.26, w: tw, h: H * 0.42 }, { max: titleMax, min: 26, valign: 'bottom', maxLines: 5 });
      text(ctx, 'body', deck.subtitle ?? '', { x: m, y: H * 0.7, w: tw, h: 0.8 }, { max: 20, min: 14, color: c.muted });
      label(ctx, meta, { x: m, y: H - m - 0.55, w: tw, h: 0.55 }, { maxLines: 2, seq: 3 });
    }
  }
}

function section(ctx, s) {
  const { L, c, m, scale } = ctx;
  const center = L.align === 'center';
  const full = L.cover === 'block' || L.accentStatements || sig(ctx) === 'masthead';
  const fill = sig(ctx) === 'masthead' ? c.ink : c.accent;
  background(ctx, full ? fill : undefined);
  const ink = full ? (sig(ctx) === 'masthead' ? c.bg : ctx.onAccent) : c.ink;
  if (!full) signature(ctx, 'section');
  if (sig(ctx) === 'band') {
    rect(ctx, 0, H * 0.3, W, H * 0.42, c.accent);
  }
  const bandInk = sig(ctx) === 'band' ? ctx.onAccent : ink;
  if (sig(ctx) === 'bleed') {
    bleedNumber(ctx, s.number, { color: full ? c.ink : c.accent, size: 340 });
  } else {
    text(ctx, 'display', String(s.number).padStart(2, '0'), { x: m, y: H * 0.14, w: W - 2 * m, h: 2.2 }, {
      max: 130, min: 90, color: full ? ink : c.accentText, align: center ? 'center' : 'left', italic: false, caps: false, seq: 1,
    });
  }
  text(ctx, 'display', s.label, { x: m, y: H * 0.42, w: W * 0.6, h: 1.6 }, { max: Math.round(48 * scale), min: 28, color: bandInk, align: center ? 'center' : 'left', maxLines: 2, seq: 2 });
  footer(ctx, full ? ink : undefined);
}

function statement(ctx, item, kick) {
  const { L, c, m, scale, dz } = ctx;
  const center = L.align === 'center';
  const full = !!L.accentStatements;
  background(ctx, full ? c.accent : undefined);
  if (!full) signature(ctx, 'statement');
  const band = sig(ctx) === 'band';
  if (band) rect(ctx, 0, H * 0.2, W, H * 0.62, c.accent);
  const ink = full || band ? ctx.onAccent : c.ink;
  const w = center ? W - 2 * m - 1 : W * 0.74;
  const x = center ? (W - w) / 2 : m + (L.titlePos === 'side' ? 0.1 : 0);
  if (kick) kicker(ctx, kick, x, H * 0.24, w, { align: center ? 'center' : 'left', color: full || band ? ink : undefined, fill: band ? c.ink : undefined });
  text(ctx, 'display', item.text, { x, y: H * 0.3, w, h: H * 0.46 }, {
    max: Math.round(46 * scale * dz), min: 24, color: ink, align: center ? 'center' : 'left', valign: 'middle', maxLines: 5,
  });
  if (item.note) text(ctx, 'body', item.note, { x, y: H * 0.79, w, h: 0.6 }, { max: 18, min: 13, color: full || band ? ink : c.muted, align: center ? 'center' : 'left', seq: 3 });
  footer(ctx, full ? ink : undefined);
}

function bigNumber(ctx, item, kick) {
  const { L, c, dz } = ctx;
  background(ctx);
  signature(ctx, 'content');
  const b = frame(ctx, item.title, kick);
  if (L.align === 'center') {
    text(ctx, 'display', item.value, { x: b.x, y: b.y, w: b.w, h: b.h * 0.46 }, { max: 140, min: 60, color: c.accentText, align: 'center', valign: 'middle', italic: false, caps: false });
    let y = b.y + b.h * 0.46 + 0.1;
    const lb = text(ctx, 'display', item.label, { x: b.x + 1, y, w: b.w - 2, h: 0.7 }, { max: 30, min: 18, align: 'center', italic: false, seq: 2 });
    y += lb.height + 0.15;
    text(ctx, 'body', item.caption ?? '', { x: b.x + 0.4, y, w: b.w - 0.8, h: b.y + b.h - y - 0.3 }, { max: Math.round(20 * dz), min: 14, align: 'center', color: c.muted, seq: 3 });
    if (item.source) label(ctx, item.source, { x: b.x, y: b.y + b.h - 0.28, w: b.w, h: 0.28 }, { align: 'center', maxLines: 1, seq: 3 });
    footer(ctx);
    return;
  }
  const numW = Math.min(b.w * 0.45, 5.2);
  if (sig(ctx) === 'offset') rect(ctx, b.x + 0.25, b.y + b.h * 0.12, numW * 0.7, b.h * 0.76, c.accent, { alpha: 0.18 });
  text(ctx, 'display', item.value, { x: b.x, y: b.y, w: numW, h: b.h }, { max: 170, min: 64, color: c.accentText, valign: 'middle', italic: false, caps: false, maxLines: 1, seq: 1 });
  const rx = b.x + numW + 0.5;
  const rw = b.x + b.w - rx;
  let y = b.y + b.h * 0.18;
  const lb = text(ctx, 'display', item.label, { x: rx, y, w: rw, h: 1.3 }, { max: 32, min: 18, italic: false, maxLines: 3, seq: 2 });
  y += lb.height + 0.25;
  const cap = text(ctx, 'body', item.caption ?? '', { x: rx, y, w: rw, h: b.y + b.h - y - 0.5 }, { max: Math.round(21 * dz), min: 14, color: c.muted, seq: 3 });
  if (item.source) label(ctx, item.source, { x: rx, y: y + cap.height + 0.25, w: rw, h: 0.3 }, { maxLines: 2, seq: 3 });
  footer(ctx);
}

function comparison(ctx, item, kick) {
  const { c, dz } = ctx;
  background(ctx);
  signature(ctx, 'content');
  const b = frame(ctx, item.title, kick);
  const gap = 0.7;
  const colW = (b.w - gap) / 2;
  const verdictH = item.verdict ? 0.8 : 0;
  const colH = b.h - verdictH - 0.1;
  if (isLedger(ctx)) line(ctx, b.x + colW + gap / 2, b.y, b.x + colW + gap / 2, b.y + colH, c.muted, 0.5);
  else rect(ctx, b.x + colW + gap / 2 - 0.05, b.y - 0.2, colW + gap / 2 + 0.05 + (b.x + b.w + 0.2 <= W ? 0.2 : 0), colH + 0.3, c.soft, { seq: 3 });
  [item.left, item.right].forEach((side, i) => {
    const pad = !isLedger(ctx) && i === 1 ? 0.35 : 0;
    const x = b.x + i * (colW + gap) + pad;
    const w = colW - pad;
    const seq = 2 + i * 2;
    const hd = text(ctx, 'display', side.heading, { x, y: b.y, w, h: 0.9 }, { max: 30, min: 18, color: c.accentText, maxLines: 2, italic: false, seq });
    const y = b.y + hd.height + 0.25;
    text(ctx, 'body', side.points.join('\n'), { x, y, w, h: b.y + colH - y - 0.1 }, { max: Math.round(22 * dz), min: 14, lineHeight: 1.45, seq });
  });
  if (item.verdict) text(ctx, 'body', item.verdict, { x: b.x, y: b.y + b.h - verdictH + 0.2, w: b.w, h: verdictH - 0.2 }, { max: 18, min: 13, italic: true, color: c.muted, seq: 6 });
  footer(ctx);
}

function numberEl(ctx, n, box, o = {}) {
  const { L, c } = ctx;
  const s = String(n).padStart(2, '0');
  if (L.numbers === 'large') return text(ctx, 'display', s, box, { max: o.large ?? 40, min: 22, color: c.accentText, italic: false, caps: false, maxLines: 1, seq: o.seq });
  if (L.numbers === 'small') return label(ctx, s, box, { max: 13, min: 10, color: c.accentText, maxLines: 1, seq: o.seq });
  return { height: 0 };
}

function processForm(ctx, item, kick) {
  const { L, c, dz } = ctx;
  background(ctx);
  signature(ctx, 'content');
  const b = frame(ctx, item.title, kick);
  const steps = item.steps;
  const n = steps.length;
  if (L.titlePos === 'side' || n > 4) {
    // rows that step inwards, so the order reads without connecting lines
    const rowH = b.h / n;
    steps.forEach((s, i) => {
      const seq = 2 + i;
      const y = b.y + i * rowH;
      const indent = i * 0.35;
      rect(ctx, b.x + indent, y + 0.04, b.w - indent, rowH - 0.14, c.soft, { seq, alpha: isLedger(ctx) ? 0 : 1 });
      const nw = L.numbers === 'none' ? 0.25 : 1.0;
      numberEl(ctx, i + 1, { x: b.x + indent + 0.25, y: y + 0.16, w: nw - 0.2, h: Math.min(rowH - 0.25, 0.8) }, { large: 30, seq });
      const tx = b.x + indent + nw + 0.1;
      const tw = b.w - indent - nw - 0.35;
      const hd = text(ctx, 'display', s.title, { x: tx, y: y + 0.16, w: tw, h: rowH * 0.42 }, { max: 24, min: 15, italic: false, maxLines: 2, seq });
      text(ctx, 'body', s.text, { x: tx, y: y + 0.2 + hd.height, w: tw, h: rowH - hd.height - 0.42 }, { max: Math.round(18 * dz), min: 13, color: c.muted, seq });
    });
  } else {
    // a staircase: each step starts a little higher than the one before
    const gap = 0.35;
    const colW = (b.w - gap * (n - 1)) / n;
    const rise = 0.4;
    steps.forEach((s, i) => {
      const seq = 2 + i;
      const x = b.x + i * (colW + gap);
      const top = b.y + (n - 1 - i) * rise;
      rect(ctx, x, top, colW, b.y + b.h - top, i === n - 1 ? c.accent : c.soft, { seq, alpha: i === n - 1 ? 0.22 : 1 });
      const nb = numberEl(ctx, i + 1, { x: x + 0.25, y: top + 0.2, w: colW - 0.5, h: L.numbers === 'large' ? 0.8 : 0.35 }, { large: 40, seq });
      const ty = top + 0.3 + (nb.height || 0);
      const hd = text(ctx, 'display', s.title, { x: x + 0.25, y: ty, w: colW - 0.5, h: 1.1 }, { max: 26, min: 16, italic: false, maxLines: 3, seq });
      text(ctx, 'body', s.text, { x: x + 0.25, y: ty + hd.height + 0.15, w: colW - 0.5, h: b.y + b.h - (ty + hd.height + 0.15) - 0.2 }, { max: Math.round(19 * dz), min: 13, color: c.muted, seq });
    });
  }
  footer(ctx);
}

function timeline(ctx, item, kick) {
  const { L, c, dz } = ctx;
  background(ctx);
  signature(ctx, 'content');
  const b = frame(ctx, item.title, kick);
  const ev = item.events;
  const n = ev.length;
  // a bar of segments that gets stronger over time, instead of a thin line
  const alpha = (i) => 0.25 + (0.75 * i) / Math.max(1, n - 1);
  if (L.titlePos === 'side') {
    const rowH = b.h / n;
    ev.forEach((e, i) => {
      const seq = 2 + i;
      const y = b.y + i * rowH;
      rect(ctx, b.x, y + 0.06, 0.22, rowH - 0.12, c.accent, { alpha: alpha(i), seq });
      text(ctx, 'display', e.date, { x: b.x + 0.5, y: y + 0.08, w: 1.9, h: Math.min(rowH - 0.1, 0.6) }, { max: 28, min: 15, color: c.accentText, italic: false, maxLines: 1, seq });
      text(ctx, 'body', e.label, { x: b.x + 2.5, y: y + 0.1, w: b.w - 2.6, h: rowH - 0.15 }, { max: Math.round(19 * dz), min: 13, seq });
    });
  } else {
    const ly = b.y + b.h * 0.36;
    const colW = b.w / n;
    ev.forEach((e, i) => {
      const seq = 2 + i;
      const x = b.x + i * colW;
      rect(ctx, x, ly - 0.13, colW - 0.08, 0.26, c.accent, { alpha: alpha(i), seq });
      text(ctx, 'display', e.date, { x, y: ly - 1.05, w: colW - 0.25, h: 0.8 }, { max: 32, min: 16, color: c.accentText, italic: false, valign: 'bottom', maxLines: 1, seq });
      text(ctx, 'body', e.label, { x, y: ly + 0.38, w: colW - 0.3, h: b.y + b.h - ly - 0.42 }, { max: Math.round(19 * dz), min: 13, seq });
    });
  }
  footer(ctx);
}

/** Field Notes: a note pinned slightly askew behind quotes and questions. */
function note(ctx, x, y, w, h) {
  if (sig(ctx) !== 'tabs') return false;
  rect(ctx, x - 0.4, y - 0.35, w + 0.8, h + 0.7, ctx.c.note ?? ctx.c.soft, { rotate: -1.8 });
  return true;
}

function quote(ctx, item, kick) {
  const { L, c, m, scale } = ctx;
  background(ctx);
  signature(ctx, 'statement');
  const center = L.align === 'center';
  const x = center ? m + 1 : m + 0.9;
  const w = center ? W - 2 * m - 2 : W * 0.7;
  const pinned = note(ctx, x, H * 0.2, w, H * 0.6);
  if (kick) kicker(ctx, kick, x, m, w, { align: center ? 'center' : 'left' });
  if (!center && !pinned) text(ctx, 'display', '“', { x: m - 0.1, y: H * 0.12, w: 1.2, h: 1.6 }, { max: 120, min: 90, color: c.accentText, italic: false, bold: false, caps: false, maxLines: 1, seq: 0 });
  text(ctx, 'display', item.text, { x, y: H * 0.22, w, h: H * 0.42 }, {
    max: Math.round(36 * scale), min: 20, italic: true, caps: false, align: center ? 'center' : 'left', valign: 'middle', lineHeight: 1.25, maxLines: 6,
  });
  const y = H * 0.22 + H * 0.42 + 0.3;
  label(ctx, `— ${item.author}${item.work ? `, ${item.work}` : ''}`, { x, y, w, h: 0.5 }, { align: center ? 'center' : 'left', max: 14, maxLines: 2, seq: 2 });
  if (item.note) text(ctx, 'body', item.note, { x, y: y + 0.6, w, h: Math.max(0.4, H * 0.8 - y - 0.4) }, { max: 19, min: 13, color: c.muted, align: center ? 'center' : 'left', seq: 3 });
  footer(ctx);
}

function definition(ctx, item, kick) {
  const { L, c, m, scale, dz } = ctx;
  background(ctx);
  signature(ctx, 'statement');
  const center = L.align === 'center';
  const x = center ? m + 0.5 : m + (L.titlePos === 'side' ? 0.1 : 0);
  const w = center ? W - 2 * m - 1 : W * 0.66;
  let y = H * 0.16;
  if (kick) kicker(ctx, kick, x, y - 0.5, w, { align: center ? 'center' : 'left' });
  text(ctx, 'display', item.term, { x, y, w, h: 1.9 }, { max: Math.round(64 * scale), min: 32, align: center ? 'center' : 'left', valign: 'bottom', maxLines: 2 });
  y += 1.9 + 0.2;
  if (item.gloss) y += kicker(ctx, item.gloss, x, y, w, { align: center ? 'center' : 'left', plain: ctx.L.kicker !== 'tag' }) + 0.1;
  text(ctx, 'body', item.text, { x, y: y + 0.1, w, h: H - y - m - footerSpace(ctx) }, { max: Math.round(28 * dz), min: 16, align: center ? 'center' : 'left', lineHeight: 1.35, seq: 3 });
  footer(ctx);
}

function points(ctx, item, kick) {
  const { L, c, dz } = ctx;
  background(ctx);
  signature(ctx, 'content');
  const b = frame(ctx, item.title, kick);
  const list = item.points;
  const n = list.length;
  const rowH = b.h / n;
  const nw = L.numbers === 'none' ? 0 : L.numbers === 'large' ? 1.0 : 0.7;
  const centered = L.align === 'center' && nw === 0;
  list.forEach((p, i) => {
    const seq = 2 + i;
    const y = b.y + i * rowH;
    if (isLedger(ctx)) line(ctx, b.x, y, b.x + b.w, y, c.muted, 0.6);
    numberEl(ctx, i + 1, { x: b.x, y: y + 0.12, w: nw, h: Math.min(rowH - 0.2, 0.75) }, { large: 34, seq });
    const hd = text(ctx, 'body', p.head, { x: b.x + nw, y: y + 0.14, w: b.w - nw, h: rowH * 0.45 }, { max: Math.round(25 * dz), min: 15, bold: true, maxLines: 2, align: centered ? 'center' : 'left', seq });
    if (p.text) text(ctx, 'body', p.text, { x: b.x + nw, y: y + 0.2 + hd.height, w: b.w - nw, h: rowH - hd.height - 0.3 }, { max: Math.round(19 * dz), min: 13, color: c.muted, align: centered ? 'center' : 'left', seq });
  });
  footer(ctx);
}

function pair(ctx, item, kick) {
  const { c, dz } = ctx;
  background(ctx);
  signature(ctx, 'content');
  const b = frame(ctx, item.title, kick);
  const colW = b.w * 0.38;
  const tokenH = b.h * 0.45;
  const ty = b.y + (item.word ? 0.6 : 0.1);
  if (item.word) label(ctx, item.word, { x: b.x, y: b.y, w: b.w, h: 0.35 }, { align: 'center', color: c.accentText, max: 15, seq: 2 });
  [item.left, item.right].forEach((s, i) => {
    const x = i === 0 ? b.x : b.x + b.w - colW;
    const seq = i === 0 ? 2 : 4;
    if (i === 1 && !isLedger(ctx)) rect(ctx, x, ty, colW, tokenH, c.soft, { seq });
    // forms like /huːs/ must keep their case and symbols: a capitals-only face hands them to the text face
    const tokenFont = FONTS[ctx.dir.fonts.display].capsOnly ? ctx.dir.fonts.body : undefined;
    text(ctx, 'display', s.text, { x: x + 0.2, y: ty, w: colW - 0.4, h: tokenH }, { max: 66, min: 30, align: 'center', valign: 'middle', italic: false, caps: false, maxLines: 2, color: i === 1 ? c.accentText : c.ink, seq, ...(tokenFont ? { font: tokenFont } : {}) });
    label(ctx, s.label, { x, y: ty + tokenH + 0.08, w: colW, h: 0.35 }, { align: 'center', maxLines: 1, max: 13, seq });
  });
  const ay = ty + tokenH / 2;
  ctx.els.push({ type: 'arrow', x1: b.x + colW + 0.4, y1: ay, x2: b.x + b.w - colW - 0.4, y2: ay, color: c.accent, width: 3, seq: 3 });
  if (item.caption) {
    const cy = ty + tokenH + 0.65;
    text(ctx, 'body', item.caption, { x: b.x + 0.5, y: cy, w: b.w - 1, h: b.y + b.h - cy }, { max: Math.round(21 * dz), min: 14, align: 'center', color: c.muted, seq: 5 });
  }
  footer(ctx);
}

function question(ctx, item, kick) {
  const { L, c, m, scale } = ctx;
  const full = L.accentStatements || L.cover === 'block';
  background(ctx, full ? c.accent : undefined);
  if (!full) signature(ctx, 'statement');
  const ink = full ? ctx.onAccent : c.ink;
  const center = L.align === 'center' || L.cover === 'center';
  const w = center ? W - 2 * m - 1.5 : W * 0.72;
  const x = center ? (W - w) / 2 : m;
  note(ctx, x, H * 0.2, w, H * 0.62);
  kicker(ctx, kick ?? 'Question', x, H * 0.22, w, { align: center ? 'center' : 'left', color: full ? ink : undefined, fill: full ? c.ink : undefined });
  text(ctx, 'display', item.text, { x, y: H * 0.3, w, h: H * 0.42 }, { max: Math.round(44 * scale), min: 24, color: ink, align: center ? 'center' : 'left', valign: 'middle', maxLines: 5 });
  if (item.hint) text(ctx, 'body', item.hint, { x, y: H * 0.74, w, h: 0.8 }, { max: 20, min: 13, color: full ? ink : c.muted, align: center ? 'center' : 'left', seq: 3 });
  footer(ctx, full ? ink : undefined);
}

function photo(ctx, item, kick) {
  const { L, c, m, dz } = ctx;
  background(ctx);
  const portrait = (item.w ?? 4) / (item.h ?? 3) < 1.2;
  if (L.photo === 'bleed' && portrait) {
    // an upright picture fills the full height of one side instead of being cropped to 16:9
    const iw = Math.min(W * 0.48, H * ((item.w ?? 3) / (item.h ?? 4)) * 1.15);
    image(ctx, item, { x: W - iw, y: 0, w: iw, h: H }, { style: 'bleed', seq: 0 });
    const x = m;
    const w = W - iw - m - 0.7;
    let y = H * 0.22;
    if (kick) y += kicker(ctx, kick, x, y, w);
    const t = text(ctx, 'display', item.title, { x, y, w, h: 2.4 }, { max: Math.round(36 * ctx.scale), min: 20, maxLines: 4, seq: 1 });
    const cap = text(ctx, 'body', item.caption ?? '', { x, y: y + t.height + 0.35, w, h: H * 0.84 - (y + t.height + 0.35) }, { max: Math.round(20 * dz), min: 13, color: c.muted, seq: 2 });
    label(ctx, item.credit ?? '', { x, y: Math.min(H - m - 0.45, y + t.height + 0.5 + cap.height), w, h: 0.45 }, { max: 10, min: 8, maxLines: 2, seq: 2 });
    return;
  }
  if (L.photo === 'bleed') {
    image(ctx, item, { x: 0, y: 0, w: W, h: H }, { style: 'bleed', seq: 0 });
    // caption on a solid block, so text stays readable on any picture
    const bw = Math.min(6.4, W * 0.5);
    const bh = 2.5;
    rect(ctx, 0, H - bh, bw, bh, c.bg, { seq: 1 });
    let y = H - bh + 0.35;
    if (kick) y += kicker(ctx, kick, m * 0.7, y, bw - m);
    const t = text(ctx, 'display', item.title, { x: m * 0.7, y, w: bw - m * 1.2, h: 1.0 }, { max: 24, min: 15, maxLines: 3, seq: 1 });
    text(ctx, 'body', item.caption ?? '', { x: m * 0.7, y: y + t.height + 0.15, w: bw - m * 1.2, h: H - (y + t.height + 0.15) - 0.6 }, { max: Math.round(15 * dz), min: 11, color: c.muted, seq: 2 });
    label(ctx, item.credit ?? '', { x: m * 0.7, y: H - 0.5, w: bw - m, h: 0.42 }, { max: 9, min: 8, maxLines: 2, seq: 2 });
    return;
  }
  // framed, offset or round: picture as the hero, text beside it
  signature(ctx, 'quiet');
  const imgBox = { x: m * 0.8, y: m * 0.7, w: W * 0.56, h: H - m * 1.4 };
  const placed = image(ctx, item, imgBox, { seq: 0 });
  const x = Math.max(placed.x + placed.w + 0.7, W * 0.6);
  const w = W - x - m;
  let y = H * 0.24;
  if (kick) y += kicker(ctx, kick, x, y, w);
  const t = text(ctx, 'display', item.title, { x, y, w, h: 2.2 }, { max: 30, min: 18, maxLines: 5, seq: 1 });
  const cap = text(ctx, 'body', item.caption ?? '', { x, y: y + t.height + 0.3, w, h: H * 0.82 - (y + t.height + 0.3) }, { max: Math.round(17 * dz), min: 12, color: c.muted, seq: 2 });
  label(ctx, item.credit ?? '', { x, y: y + t.height + 0.4 + cap.height, w, h: 0.5 }, { max: 10, min: 8, maxLines: 3, seq: 2 });
}

function photoSplit(ctx, item, kick) {
  const { L, c, m, dz, slideIndex } = ctx;
  background(ctx);
  const left = slideIndex % 2 === 0;
  const half = W * 0.5;
  const style = L.photo === 'bleed' ? 'bleed' : L.photo;
  const box = style === 'bleed'
    ? { x: left ? 0 : half, y: 0, w: half, h: H }
    : { x: left ? m * 0.7 : half + 0.2, y: m * 0.7, w: half - m * 0.7 - 0.2, h: H - m * 1.4 };
  if (style === 'framed' && sig(ctx) !== 'wall') rect(ctx, left ? 0 : half, 0, half, H, c.soft);
  image(ctx, item, box, { seq: 0, style, mat: style === 'framed' && sig(ctx) !== 'wall' ? c.bg : undefined });
  const x = left ? half + 0.7 : m;
  const w = half - 0.7 - m;
  let y = H * 0.2;
  if (kick) y += kicker(ctx, kick, x, y, w);
  const t = text(ctx, 'display', item.title, { x, y, w, h: 2.4 }, { max: Math.round(34 * (ctx.scale)), min: 20, maxLines: 5, seq: 1 });
  const cap = text(ctx, 'body', item.caption ?? '', { x, y: y + t.height + 0.35, w, h: H * 0.84 - (y + t.height + 0.35) }, { max: Math.round(19 * dz), min: 13, color: c.muted, seq: 2 });
  label(ctx, item.credit ?? '', { x, y: Math.min(H - m - 0.4, y + t.height + 0.5 + cap.height), w, h: 0.45 }, { max: 10, min: 8, maxLines: 2, seq: 2 });
}

function references(ctx, item) {
  const { c, dz } = ctx;
  background(ctx);
  signature(ctx, 'quiet');
  const b = frame(ctx, item.title ?? 'Works Cited');
  text(ctx, 'body', item.entries.join('\n'), { x: b.x, y: b.y, w: Math.min(b.w, 10.8), h: b.h }, {
    max: Math.round(18 * dz), min: 11, lineHeight: 1.4, hanging: true, color: c.ink,
  });
  footer(ctx);
}

const FORMS = {
  cover, section, statement, bigNumber, comparison, process: processForm, timeline, quote, definition, points, pair, question, photo, photoSplit, references,
};

export const FORM_NAMES = Object.keys(FORMS);

/** Lay out one planned slide. Returns its element list. */
export function layoutSlide(dir, deck, slide, index, total, density = 'medium') {
  const ctx = makeCtx(dir, deck, slide, index, total, density);
  const poster = posterForm(dir, slide.form);
  if (poster && poster(ctx, slide.item ?? slide, slide.kicker, slide) !== false) return applyAccent(ctx);
  const glass = glassForm(dir, slide.form);
  if (glass && glass(ctx, slide.item ?? slide, slide.kicker, slide) !== false) return applyAccent(ctx);
  const fn = FORMS[slide.form];
  if (!fn) throw new Error(`Unknown slide form: ${slide.form}`);
  fn(ctx, slide.item ?? slide, slide.kicker);
  // Glass directions reuse the regular content forms, re-dressed in glass
  if (dir.family === 'glass') glassify(ctx);
  // then the slide's planned effect from the direction's kit (accents.js), if it has one
  return applyAccent(ctx);
}
