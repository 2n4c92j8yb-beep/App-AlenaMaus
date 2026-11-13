// Poster layouts: cover, section, statement, key figure and question slides
// built like film or travel posters — one strong photo, one giant word,
// small widely spaced labels at the edges. Content-heavy slides (timeline,
// comparison, process …) fall back to the regular forms in the same type and
// colours, so the audience can still read them.
//
// Three directions, each with its own trick:
//   summit    the giant word sits behind the subject (photo → word → cut-out)
//   cutout    the photo shows through the letters of a giant vertical word
//   monolith  an ultra-condensed word spans the width above a symmetrical photo

import { t as label_ } from './labels.js';
import { SLIDE_W as W, SLIDE_H as H } from '../engine/fit.js';
import { text, label, rect, background } from './forms.js';

/**
 * URL of a mood photo in the direction's colour grade (optionally the cut-out layer).
 * Bundled photos exist as three graded files; photos found online (`src`) are graded
 * with a filter instead (GRADE_FILTER), which the PowerPoint export bakes in.
 */
export function moodSrc(mood, grade, cut = false) {
  if (mood.src) return mood.src;
  return `${mood.base}-${grade}${cut ? '-cut.png' : '.jpg'}`;
}

export const GRADE_FILTER = {
  warm: 'sepia(0.35) saturate(1.25) contrast(1.05)',
  mono: 'grayscale(1) contrast(1.15)',
  night: 'brightness(0.62) contrast(1.15) saturate(0.75)',
};

function photo(ctx, mood, box = { x: 0, y: 0, w: W, h: H }, o = {}) {
  if (o.cut && !mood.cut) return;
  const filter = mood.src ? GRADE_FILTER[ctx.dir.grade] : undefined;
  ctx.els.push({
    type: 'image', ...box, src: moodSrc(mood, ctx.dir.grade, o.cut), alt: o.cut ? '' : mood.alt,
    fit: 'cover', pos: o.pos ?? mood.pos ?? 'center', natW: mood.w, natH: mood.h, seq: o.seq ?? 0, mood: true,
    ...(filter ? { filter } : {}),
  });
}

/** Tiny, widely spaced capitals, as on posters. */
function micro(ctx, str, box, o = {}) {
  if (!str) return { height: 0 };
  return text(ctx, 'label', str, box, {
    max: o.max ?? 10, min: Math.min(o.min ?? 8, o.max ?? 10), caps: true, tracking: o.tracking ?? 0.32,
    color: o.color ?? ctx.c.muted, align: o.align ?? 'left', valign: o.valign ?? 'top',
    maxLines: o.maxLines ?? 1, lineHeight: 1.3, seq: o.seq ?? 2, rotate: o.rotate, alpha: o.alpha,
  });
}

/** One giant word in the poster face, sized to fill its box. */
function bigWord(ctx, word, box, o = {}) {
  return text(ctx, 'display', word, box, {
    font: ctx.dir.fonts.poster, max: o.max ?? 600, min: o.min ?? 60, caps: true, maxLines: 1,
    lineHeight: o.lineHeight ?? 0.92, tracking: o.tracking ?? 0, align: o.align ?? 'center', valign: o.valign ?? 'top',
    color: o.color ?? ctx.c.ink, italic: false, bold: false, seq: o.seq ?? 1, bleed: true,
    rotate: o.rotate, alpha: o.alpha, fillImage: o.fillImage,
  });
}

const scrim = (ctx, alpha, box = { x: 0, y: 0, w: W, h: H }) => rect(ctx, box.x, box.y, box.w, box.h, ctx.c.bg, { alpha, seq: 0 });
const meta = (deck) => [deck.author, deck.date].filter(Boolean).join('  ·  ');
const word = (deck, i) => (deck.posterWords ?? [deck.shortTitle ?? deck.title])[i % (deck.posterWords?.length ?? 1)];
const pageNo = (ctx) => `${String(ctx.slideIndex + 1).padStart(2, '0')} / ${String(ctx.total).padStart(2, '0')}`;

// ---------------------------------------------------------------- Summit

const summit = {
  cover(ctx, _item, _k, slide) {
    const { c, deck } = ctx;
    const mood = slide.mood;
    if (!mood) return false;
    background(ctx);
    // the photo sits low (its top fades into the background), the word stands in the sky,
    // and the cut-out of the subject goes on top, so only its peaks reach into the letters
    const box = { x: 0, y: 1.9, w: W, h: W * (mood.h / mood.w) };
    photo(ctx, mood, box);
    bigWord(ctx, word(deck, 0), { x: 0.4, y: 0.42, w: W - 0.8, h: 4.0 }, { alpha: 0.95, color: c.ink, tracking: 0.04 });
    if (mood.cut) photo(ctx, mood, box, { cut: true });
    rect(ctx, 0, H - 1.55, W, 1.55, c.bg, { alpha: 0.72 });
    micro(ctx, deck.shortTitle, { x: 1, y: 0.32, w: W - 2, h: 0.25 }, { align: 'center', color: c.ink, tracking: 0.5, seq: 2 });
    micro(ctx, deck.posterLines?.[0], { x: 1, y: 0.58, w: W - 2, h: 0.22 }, { align: 'center', max: 9, seq: 2 });
    text(ctx, 'body', deck.title, { x: 3.4, y: H - 1.28, w: W - 6.8, h: 0.6 }, { max: 22, min: 14, italic: true, align: 'center', color: c.ink, maxLines: 1, seq: 3 });
    micro(ctx, meta(deck), { x: 3.4, y: H - 0.62, w: W - 6.8, h: 0.22 }, { align: 'center', seq: 3 });
    micro(ctx, deck.course, { x: 0.45, y: H - 1.12, w: 3, h: 0.5 }, { maxLines: 2, max: 8, seq: 3 });
    micro(ctx, deck.place, { x: W - 3.45, y: H - 1.12, w: 3, h: 0.5 }, { maxLines: 2, max: 8, align: 'right', seq: 3 });
    return true;
  },
  section(ctx, s, _k, slide) {
    const { c } = ctx;
    background(ctx);
    if (slide.mood) { photo(ctx, slide.mood); scrim(ctx, 0.5); }
    bigWord(ctx, String(s.number).padStart(2, '0'), { x: 0.5, y: 0.5, w: 6, h: H - 1.6 }, { align: 'left', color: c.ink, alpha: 0.9, max: 460 });
    text(ctx, 'display', s.label, { x: 0.6, y: H - 1.9, w: W - 1.2, h: 1.2 }, { max: 80, min: 40, color: c.accentText, maxLines: 1, caps: true, seq: 2 });
    micro(ctx, `${label_(ctx.deck.language, 'Part')} ${String(s.number).padStart(2, '0')}`, { x: 0.6, y: 0.38, w: 4, h: 0.22 }, { color: c.ink });
    micro(ctx, ctx.deck.shortTitle, { x: W - 5.6, y: 0.38, w: 5, h: 0.22 }, { align: 'right' });
    return true;
  },
  statement(ctx, item, kick, slide) {
    const { c } = ctx;
    background(ctx);
    if (slide.mood) { photo(ctx, slide.mood); scrim(ctx, 0.66); }
    micro(ctx, kick ?? label_(ctx.deck.language, 'Thesis'), { x: 0.8, y: 1.15, w: 6, h: 0.25 }, { color: c.accentText, seq: 1 });
    text(ctx, 'display', item.text, { x: 0.8, y: 1.6, w: W * 0.66, h: H - 3 }, { max: 66, min: 30, caps: true, lineHeight: 1.0, valign: 'middle', maxLines: 5, color: c.ink });
    micro(ctx, ctx.deck.shortTitle, { x: 0.8, y: H - 0.6, w: 5, h: 0.22 });
    micro(ctx, pageNo(ctx), { x: W - 3.2, y: H - 0.6, w: 2.4, h: 0.22 }, { align: 'right' });
    return true;
  },
  question(ctx, item, kick, slide) {
    const { c } = ctx;
    background(ctx);
    if (slide.mood) { photo(ctx, slide.mood); scrim(ctx, 0.58); }
    micro(ctx, kick ?? label_(ctx.deck.language, 'Question'), { x: 1, y: 1.3, w: W - 2, h: 0.25 }, { align: 'center', color: c.accentText, seq: 1 });
    text(ctx, 'display', item.text, { x: 1.4, y: 1.8, w: W - 2.8, h: 3.6 }, { max: 70, min: 32, caps: true, lineHeight: 1.0, align: 'center', valign: 'middle', maxLines: 4, color: c.ink });
    if (item.hint) text(ctx, 'body', item.hint, { x: 2, y: H - 1.7, w: W - 4, h: 0.5 }, { max: 18, min: 12, italic: true, align: 'center', color: c.muted, seq: 3 });
    micro(ctx, pageNo(ctx), { x: W - 3.2, y: H - 0.6, w: 2.4, h: 0.22 }, { align: 'right' });
    return true;
  },
  bigNumber(ctx, item, kick) {
    const { c } = ctx;
    background(ctx);
    bigWord(ctx, item.value, { x: 0.4, y: 0.35, w: 5.6, h: H - 0.7 }, { align: 'left', color: c.accent, max: 520 });
    micro(ctx, kick ?? label_(ctx.deck.language, 'Key figure'), { x: 6.4, y: 1.4, w: 6, h: 0.25 }, { color: c.accentText, seq: 1 });
    const t = text(ctx, 'display', item.label, { x: 6.4, y: 1.8, w: 6.2, h: 1.9 }, { max: 54, min: 26, caps: true, maxLines: 2, lineHeight: 1.0, seq: 2 });
    text(ctx, 'body', item.caption ?? '', { x: 6.4, y: 1.8 + t.height + 0.35, w: 5.8, h: 2.6 }, { max: 20, min: 13, color: c.muted, seq: 3 });
    micro(ctx, item.title, { x: 6.4, y: H - 0.9, w: 6.2, h: 0.4 }, { maxLines: 2, max: 8 });
    return true;
  },
};

// ---------------------------------------------------------------- Cut-out

const cutout = {
  cover(ctx, _item, _k, slide) {
    const { c, deck } = ctx;
    const mood = slide.mood;
    if (!mood) return false;
    background(ctx);
    micro(ctx, mood.caption ?? deck.place, { x: 0.18, y: 0.55, w: 0.35, h: H - 1.1 }, { rotate: -90, color: c.ink, max: 9, seq: 2 });
    photo(ctx, mood, { x: 0.75, y: 0.55, w: 6.5, h: H - 1.1 });
    // the photo shows through the letters of a giant vertical word
    const fill = slide.fillMood ? moodSrc(slide.fillMood, ctx.dir.grade) : moodSrc(mood, ctx.dir.grade);
    bigWord(ctx, word(deck, 1), { x: 7.45, y: 0.55, w: 2.55, h: H - 1.1 }, { rotate: 90, fillImage: fill, max: 360, lineHeight: 0.86 });
    const x = 10.35;
    const w = W - x - 0.55;
    micro(ctx, deck.occasionLabel, { x, y: 0.6, w, h: 0.4 }, { maxLines: 2, color: c.ink, seq: 2 });
    const t = text(ctx, 'display', deck.title, { x, y: 1.25, w, h: 3.2 }, { max: 34, min: 18, caps: true, lineHeight: 1.02, maxLines: 7 });
    text(ctx, 'body', deck.subtitle ?? '', { x, y: 1.25 + t.height + 0.3, w, h: 1 }, { max: 13, min: 10, color: c.muted, seq: 3 });
    micro(ctx, meta(deck), { x, y: H - 1.45, w, h: 0.45 }, { maxLines: 2, max: 8, seq: 3 });
    text(ctx, 'display', (deck.placeShort ?? 'England'), { x, y: H - 0.95, w, h: 0.45 }, { max: 20, min: 12, caps: true, tracking: 0.32, maxLines: 1, seq: 3 });
    return true;
  },
  section(ctx, s, _k, slide) {
    const { c } = ctx;
    background(ctx);
    const fill = slide.mood ? moodSrc(slide.mood, ctx.dir.grade) : undefined;
    bigWord(ctx, String(s.number).padStart(2, '0'), { x: 0.6, y: 0.3, w: 7.2, h: H - 0.6 }, { align: 'left', fillImage: fill, color: c.ink, max: 560, lineHeight: 0.85 });
    text(ctx, 'display', s.label, { x: 8.1, y: H / 2 - 0.9, w: W - 8.6, h: 1.8 }, { max: 72, min: 34, caps: true, maxLines: 2, lineHeight: 0.95, seq: 2 });
    micro(ctx, ctx.deck.shortTitle, { x: 0.18, y: 0.55, w: 0.35, h: H - 1.1 }, { rotate: -90, color: c.ink, max: 9 });
    return true;
  },
  statement(ctx, item, kick, slide) {
    const { c } = ctx;
    background(ctx);
    const imgW = 3.9;
    if (slide.mood) photo(ctx, slide.mood, { x: W - imgW, y: 0, w: imgW, h: H });
    micro(ctx, kick ?? label_(ctx.deck.language, 'Thesis'), { x: 0.18, y: 0.55, w: 0.35, h: H - 1.1 }, { rotate: -90, color: c.ink, max: 9, seq: 1 });
    text(ctx, 'display', item.text, { x: 0.9, y: 0.8, w: W - imgW - 1.6, h: H - 1.6 }, { max: 70, min: 30, caps: true, lineHeight: 1.0, valign: 'middle', maxLines: 6 });
    micro(ctx, pageNo(ctx), { x: 0.9, y: H - 0.55, w: 3, h: 0.22 });
    return true;
  },
  question(ctx, item, kick, slide) {
    const { c } = ctx;
    background(ctx);
    const imgW = W * 0.42;
    if (slide.mood) photo(ctx, slide.mood, { x: W - imgW, y: 0, w: imgW, h: H });
    micro(ctx, kick ?? label_(ctx.deck.language, 'Question'), { x: 0.9, y: 1.1, w: 6, h: 0.25 }, { color: c.ink, seq: 1 });
    text(ctx, 'display', item.text, { x: 0.9, y: 1.5, w: W - imgW - 1.6, h: 4.2 }, { max: 64, min: 28, caps: true, lineHeight: 1.0, valign: 'middle', maxLines: 6 });
    if (item.hint) text(ctx, 'body', item.hint, { x: 0.9, y: H - 1.3, w: W - imgW - 1.6, h: 0.6 }, { max: 15, min: 11, color: c.muted, seq: 3 });
    return true;
  },
  bigNumber(ctx, item, kick, slide) {
    const { c } = ctx;
    background(ctx);
    const fill = slide.mood ? moodSrc(slide.mood, ctx.dir.grade) : undefined;
    bigWord(ctx, item.value, { x: 0.5, y: 0.25, w: 5.8, h: H - 0.5 }, { align: 'left', fillImage: fill, color: c.ink, max: 600, lineHeight: 0.85 });
    micro(ctx, kick ?? label_(ctx.deck.language, 'Key figure'), { x: 6.6, y: 1.5, w: 6, h: 0.25 }, { color: c.ink, seq: 1 });
    const t = text(ctx, 'display', item.label, { x: 6.6, y: 1.9, w: 6, h: 1.8 }, { max: 50, min: 24, caps: true, maxLines: 2, lineHeight: 1.0, seq: 2 });
    text(ctx, 'body', item.caption ?? '', { x: 6.6, y: 1.9 + t.height + 0.35, w: 5.6, h: 2.6 }, { max: 18, min: 12, color: c.muted, seq: 3 });
    return true;
  },
};

// ---------------------------------------------------------------- Monolith

const monolith = {
  cover(ctx, _item, _k, slide) {
    const { c, deck } = ctx;
    const mood = slide.mood;
    if (!mood) return false;
    background(ctx);
    photo(ctx, mood, undefined, { pos: 'center 62%' });
    scrim(ctx, 0.32);
    micro(ctx, deck.posterLines?.[1] ?? deck.shortTitle, { x: 1, y: 0.34, w: W - 2, h: 0.22 }, { align: 'center', color: c.ink, tracking: 0.6, seq: 2 });
    bigWord(ctx, word(deck, 2), { x: 0.35, y: 0.66, w: W - 0.7, h: 3.6 }, { color: c.accent, alpha: 0.92, max: 420, lineHeight: 0.88, tracking: 0.02 });
    micro(ctx, deck.posterLines?.[0], { x: 3, y: 4.62, w: W - 6, h: 0.22 }, { align: 'center', max: 9, color: c.ink, seq: 3, tracking: 0.5 });
    text(ctx, 'body', deck.title, { x: 2.2, y: H - 1.95, w: W - 4.4, h: 0.6 }, { max: 24, min: 14, italic: true, align: 'center', color: c.ink, maxLines: 1, seq: 3 });
    const cols = [['Seminar', deck.course?.replace(/^Seminar:\s*/, '')], ['Presented by', deck.author], ['Term', deck.date]];
    cols.forEach(([k, v], i) => {
      const x = 0.7 + i * ((W - 1.4) / 3);
      const w = (W - 1.4) / 3;
      const align = ['left', 'center', 'right'][i];
      micro(ctx, k, { x, y: H - 0.95, w, h: 0.2 }, { align, max: 7, seq: 3 });
      micro(ctx, v, { x, y: H - 0.7, w, h: 0.22 }, { align, max: 8, color: c.ink, seq: 3, tracking: 0.18 });
    });
    return true;
  },
  section(ctx, s) {
    const { c } = ctx;
    background(ctx);
    bigWord(ctx, String(s.number).padStart(2, '0'), { x: 1, y: 0.8, w: W - 2, h: H - 2.3 }, { color: c.accent, max: 520, lineHeight: 0.86 });
    micro(ctx, s.label, { x: 1, y: H - 1.25, w: W - 2, h: 0.3 }, { align: 'center', color: c.ink, max: 14, tracking: 0.6, seq: 2 });
    micro(ctx, ctx.deck.shortTitle, { x: 1, y: 0.32, w: W - 2, h: 0.22 }, { align: 'center' });
    return true;
  },
  statement(ctx, item, kick, slide) {
    const { c } = ctx;
    background(ctx);
    if (slide.mood) { photo(ctx, slide.mood); scrim(ctx, 0.7); }
    micro(ctx, kick ?? label_(ctx.deck.language, 'Thesis'), { x: 1, y: 1.35, w: W - 2, h: 0.25 }, { align: 'center', color: c.accentText, seq: 1, tracking: 0.5 });
    text(ctx, 'display', item.text, { x: 1.6, y: 1.8, w: W - 3.2, h: 3.6 }, { max: 44, min: 22, italic: true, align: 'center', valign: 'middle', lineHeight: 1.25, maxLines: 5, color: c.ink });
    micro(ctx, pageNo(ctx), { x: 1, y: H - 0.6, w: W - 2, h: 0.22 }, { align: 'center' });
    return true;
  },
  question(ctx, item, kick, slide) {
    const { c } = ctx;
    background(ctx);
    if (slide.mood) { photo(ctx, slide.mood, undefined, { pos: 'center 70%' }); scrim(ctx, 0.5); }
    micro(ctx, kick ?? label_(ctx.deck.language, 'Question'), { x: 1, y: 1.35, w: W - 2, h: 0.25 }, { align: 'center', color: c.accentText, seq: 1, tracking: 0.5 });
    text(ctx, 'display', item.text, { x: 1.4, y: 1.8, w: W - 2.8, h: 3.4 }, { max: 48, min: 24, align: 'center', valign: 'middle', lineHeight: 1.2, maxLines: 4, color: c.ink });
    if (item.hint) micro(ctx, item.hint, { x: 1, y: H - 1.5, w: W - 2, h: 0.5 }, { align: 'center', maxLines: 2, max: 9, seq: 3 });
    return true;
  },
  bigNumber(ctx, item, kick) {
    const { c } = ctx;
    background(ctx);
    micro(ctx, kick ?? item.title, { x: 1, y: 0.4, w: W - 2, h: 0.4 }, { align: 'center', maxLines: 2, max: 9 });
    bigWord(ctx, item.value, { x: 1, y: 0.8, w: W - 2, h: 4.3 }, { color: c.accent, max: 460, lineHeight: 0.86 });
    micro(ctx, item.label, { x: 1, y: 5.3, w: W - 2, h: 0.3 }, { align: 'center', color: c.ink, max: 14, tracking: 0.5, seq: 2 });
    text(ctx, 'body', item.caption ?? '', { x: 2.6, y: 5.8, w: W - 5.2, h: 1.1 }, { max: 17, min: 12, italic: true, align: 'center', color: c.muted, seq: 3 });
    return true;
  },
};

const POSTERS = { summit, cutout, monolith };

/** The poster layout for this slide, if the direction has one. */
export function posterForm(dir, form) {
  return dir.family === 'poster' ? POSTERS[dir.id]?.[form] : undefined;
}

/**
 * Which mood photo each poster slide gets. Each direction has its own
 * preferences, and a deck uses each photo once before repeating.
 */
const WANTS = {
  summit:   { cover: ['depth'], section: ['interior', 'wide'], statement: ['texture'], question: ['city', 'wide'] },
  cutout:   { cover: ['architecture'], coverFill: ['texture'], section: ['texture'], statement: ['interior', 'texture'], question: ['city'], bigNumber: ['depth', 'architecture'] },
  monolith: { cover: ['interior'], statement: ['texture'], question: ['architecture', 'wide'] },
};

export function assignMood(plan, deck, dir) {
  if (dir.family !== 'poster' || !deck.mood?.length) return plan;
  const wants = WANTS[dir.id] ?? {};
  const used = new Set();
  const take = (tags) => {
    if (!tags) return undefined;
    const fresh = deck.mood.filter((m) => !used.has(m));
    const pool = fresh.length ? fresh : deck.mood;
    const hit = tags.map((t) => pool.find((m) => m.tags.includes(t))).find(Boolean) ?? pool[0];
    used.add(hit);
    return hit;
  };
  return plan.map((s) => {
    const mood = take(wants[s.form]);
    const fillMood = s.form === 'cover' ? take(wants.coverFill) : undefined;
    return mood ? { ...s, mood, ...(fillMood ? { fillMood } : {}) } : s;
  });
}
