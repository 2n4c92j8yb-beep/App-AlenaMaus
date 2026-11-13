// The Texture look: each direction is built around one generated surface.
// Slides use the regular forms; texturize() lays the surface in behind the
// content, strong on key slides and quieter where there is a lot to read.
//
//   survey     contour lines on paper (topographic map)
//   drafting   a blueprint grid on cobalt
//   grain      soft colour fields with film grain
//
// The texture is seeded per deck (the deck title and the direction), with a
// different view on every slide, so two decks never share the same map.

import { SLIDE_W as W, SLIDE_H as H } from '../engine/fit.js';
import { textureSvg } from './textures.js';

/** How strongly the surface shows on each kind of slide. */
const STRENGTH = {
  cover: 1, section: 1, statement: 0.9, question: 0.9, quote: 0.85, definition: 0.8,
  bigNumber: 0.6, references: 0.25,
};

export function texturize(ctx) {
  const { dir, slide, slideIndex, deck } = ctx;
  const t = dir.texture;
  const strength = (STRENGTH[slide.form] ?? t.content ?? 0.45);
  const el = {
    type: 'svg', x: 0, y: 0, w: W, h: H, seq: 0, alpha: Math.min(1, t.alpha * strength),
    svg: textureSvg(t.kind, { seed: `${deck.title}|${dir.id}`, variant: slideIndex % 4, color: t.color, colors: t.colors }),
  };
  const bg = ctx.els.findIndex((e) => e.type === 'rect' && e.w >= W - 0.01 && e.h >= H - 0.01);
  ctx.els.splice(bg + 1, 0, el);
  return ctx.els;
}
