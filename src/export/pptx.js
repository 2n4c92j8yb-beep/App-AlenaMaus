// PowerPoint export with PptxGenJS (vendor/pptxgen.bundle.js, MIT), loaded only when
// someone clicks the button. Slides already live in inches on PowerPoint's own
// 13.333 x 7.5 canvas, so every element maps one to one:
//
//   text            real, editable PowerPoint text (font, size, colour, spacing)
//   rect / ellipse  native shapes: fills, transparency, rounded corners, outline,
//                   glow as a soft outer shadow; frosted glass becomes a translucent panel
//   line / arrow    native lines
//   image           pictures (photo colour grades are baked in), cropped like the preview
//   chrome          a picture rendered from its vector drawing
//   light, textures painted into one background picture per slide, behind everything
//
// What PowerPoint cannot do: blur what lies behind glass, gradient-filled letters
// (they take the first gradient colour), and photo-filled letters (they take the ink).

import { FONTS } from '../library/fonts.js';
import { chromeSvg } from '../render/html.js';
import { SLIDE_W, SLIDE_H } from '../engine/fit.js';

const PX = 160; // pixels per inch for pictures made by the export (sharp on a projector)

let loading;
function loadPptx() {
  if (window.PptxGenJS) return Promise.resolve(window.PptxGenJS);
  loading ??= new Promise((resolve, reject) => {
    const s = Object.assign(document.createElement('script'), { src: 'vendor/pptxgen.bundle.js', async: true });
    s.onload = () => resolve(window.PptxGenJS);
    s.onerror = () => reject(new Error('The PowerPoint library could not be loaded.'));
    document.head.append(s);
  });
  return loading;
}

// ---------------------------------------------------------------- colours

/** '#RRGGBB' or '#RRGGBBAA' → { color: 'RRGGBB', transparency: 0..100 } */
function col(c, alpha = 1) {
  if (!c || c === 'transparent') return null;
  const m = /^#?([0-9a-f]{6})([0-9a-f]{2})?$/i.exec(c);
  if (!m) return null;
  const a = (m[2] ? parseInt(m[2], 16) / 255 : 1) * alpha;
  return { color: m[1].toUpperCase(), transparency: Math.round((1 - a) * 100) };
}

// ---------------------------------------------------------------- pictures made in the browser

const loadImage = (src) => new Promise((resolve, reject) => {
  const img = new Image();
  if (/^https?:/.test(src)) img.crossOrigin = 'anonymous'; // online photos (Wikimedia Commons) must stay readable for the canvas
  img.onload = () => resolve(img);
  img.onerror = () => reject(new Error(`Picture could not be loaded: ${src.slice(0, 60)}`));
  img.src = src;
});
const svgUrl = (svg) => `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;

/** One background picture per slide: the slide colour, the soft light and any texture. */
async function backgroundPicture(els) {
  const canvas = Object.assign(document.createElement('canvas'), { width: Math.round(SLIDE_W * PX), height: Math.round(SLIDE_H * PX) });
  const g = canvas.getContext('2d');
  const bg = els.find((e) => e.type === 'rect' && e.w >= SLIDE_W - 0.01 && e.h >= SLIDE_H - 0.01);
  g.fillStyle = bg?.fill ?? '#FFFFFF';
  g.fillRect(0, 0, canvas.width, canvas.height);
  for (const e of els) {
    if (e.type === 'ellipse' && e.soft) {
      const cx = (e.x + e.w / 2) * PX; const cy = (e.y + e.h / 2) * PX; const r = (Math.max(e.w, e.h) / 2) * PX;
      const grad = g.createRadialGradient(cx, cy, 0, cx, cy, r);
      grad.addColorStop(0, e.fill.slice(0, 7));
      grad.addColorStop(1, `${e.fill.slice(0, 7)}00`);
      g.save();
      g.globalAlpha = (e.alpha ?? 1) * (e.fill.length === 9 ? parseInt(e.fill.slice(7), 16) / 255 : 1);
      if (e.blur) g.filter = `blur(${e.blur * PX}px)`;
      g.fillStyle = grad;
      g.fillRect(cx - r * 1.2, cy - r * 1.2, r * 2.4, r * 2.4);
      g.restore();
    } else if (e.type === 'svg') {
      try {
        const img = await loadImage(svgUrl(e.svg));
        g.save();
        g.globalAlpha = e.alpha ?? 1;
        g.drawImage(img, e.x * PX, e.y * PX, e.w * PX, e.h * PX);
        g.restore();
      } catch { /* a texture that will not draw is left out */ }
    }
  }
  return canvas.toDataURL('image/jpeg', 0.9);
}

async function chromePicture(e) {
  const img = await loadImage(svgUrl(chromeSvg(e, PX / 96)));
  const c = Object.assign(document.createElement('canvas'), { width: img.width, height: img.height });
  c.getContext('2d').drawImage(img, 0, 0);
  return c.toDataURL('image/png');
}

/** A photo with its colour grade baked in (PowerPoint has no CSS filters). */
async function photoPicture(e) {
  if (!e.filter && /^data:/.test(e.src)) return e.src;
  // online photos are drawn onto a canvas too, so the file holds the picture itself, not a link
  const img = await loadImage(e.src);
  const c = Object.assign(document.createElement('canvas'), { width: img.naturalWidth, height: img.naturalHeight });
  const g = c.getContext('2d');
  if (e.filter) g.filter = e.filter;
  g.drawImage(img, 0, 0);
  return c.toDataURL('image/jpeg', 0.88);
}

// ---------------------------------------------------------------- elements

function addText(slide, e) {
  const f = FONTS[e.font];
  const fill = col(e.color, e.alpha ?? 1) ?? { color: '000000', transparency: 0 };
  const gradientColor = e.gradient ? col(e.gradient.stops[0]) : null;
  const opts = {
    x: e.x, y: e.y, w: e.w, h: e.h,
    fontFace: f.office, fontSize: e.size,
    color: (gradientColor ?? fill).color, transparency: fill.transparency,
    bold: !!e.bold || (f.weight ?? 400) >= 600, italic: !!e.italic,
    align: e.align ?? 'left', valign: e.valign ?? 'top',
    margin: 0, fit: 'none', isTextBox: true,
    lineSpacingMultiple: e.lineHeight ?? 1.2,
    ...(e.tracking ? { charSpacing: Math.round(e.tracking * e.size * 10) / 10 } : {}),
    ...(e.rotate ? { rotate: e.rotate } : {}),
    ...(e.hanging ? { indent: 36, paraSpaceAfter: 2 } : {}),
    // giant poster words must stay one word even where a substitute font is wider
    ...(e.bleed ? { wrap: false } : {}),
  };
  const text = e.caps ? e.text.toUpperCase() : e.text;
  slide.addText(text, opts);
}

function addShape(pptx, slide, e, round) {
  const fill = col(e.fill, e.alpha ?? 1);
  const gradientFirst = e.gradient ? col(e.gradient.stops[0], e.alpha ?? 1) : null;
  const opts = {
    x: e.x, y: e.y, w: e.w, h: e.h,
    fill: gradientFirst ?? fill ?? { color: 'FFFFFF', transparency: 100 },
    line: e.glass ? { color: 'FFFFFF', transparency: 70, width: 1 } : e.stroke ? { ...col(e.stroke), width: (e.strokeWidth ?? 0.75) } : { type: 'none' },
    ...(e.rotate ? { rotate: e.rotate } : {}),
    ...(e.radius && !round ? { rectRadius: Math.min(0.5, e.radius / Math.min(e.w, e.h)) } : {}),
  };
  if (e.glow) {
    const g = col(e.glow.color) ?? { color: 'FFFFFF', transparency: 50 };
    opts.shadow = { type: 'outer', color: g.color, opacity: Math.max(0.2, 1 - g.transparency / 100), blur: Math.round(e.glow.blur * 72), offset: 0, angle: 0 };
  } else if (e.float) {
    opts.shadow = { type: 'outer', color: '000000', opacity: 0.35, blur: 24, offset: 10, angle: 90 };
  }
  const kind = round ? pptx.ShapeType.ellipse : e.radius ? pptx.ShapeType.roundRect : pptx.ShapeType.rect;
  slide.addShape(kind, opts);
}

function addLine(pptx, slide, e) {
  const c = col(e.color) ?? { color: '000000', transparency: 0 };
  slide.addShape(pptx.ShapeType.line, {
    x: Math.min(e.x1, e.x2), y: Math.min(e.y1, e.y2), w: Math.abs(e.x2 - e.x1) || 0.001, h: Math.abs(e.y2 - e.y1) || 0.001,
    flipV: e.y2 < e.y1,
    line: { color: c.color, width: e.width, ...(e.type === 'arrow' ? { endArrowType: 'triangle' } : {}) },
  });
}

async function addImage(slide, e) {
  const data = await photoPicture(e);
  const opts = { data, x: e.x, y: e.y, w: e.w, h: e.h, altText: e.alt ?? '' };
  if (e.natW && e.natH && e.fit !== 'contain') opts.sizing = { type: 'cover', w: e.w, h: e.h };
  if (e.round) opts.rounding = true;
  slide.addImage(opts);
}

// ---------------------------------------------------------------- deck

/**
 * Build and download a .pptx for one deck. `onProgress(done, total)` reports slides.
 * Returns the file name.
 */
export async function exportPptx(deck, { onProgress } = {}) {
  const PptxGenJS = await loadPptx();
  const pptx = new PptxGenJS();
  pptx.layout = 'LAYOUT_WIDE'; // 13.333 x 7.5 in, the canvas the slides are laid out on
  pptx.title = deck.deck.title;
  pptx.author = deck.deck.author ?? '';
  pptx.company = 'Made with Deck App';
  const total = deck.slides.length;
  for (let i = 0; i < total; i++) {
    const { els } = deck.slides[i];
    const slide = pptx.addSlide();
    slide.background = { data: await backgroundPicture(els) };
    const bgIndex = els.findIndex((e) => e.type === 'rect' && e.w >= SLIDE_W - 0.01 && e.h >= SLIDE_H - 0.01);
    for (let k = 0; k < els.length; k++) {
      const e = els[k];
      if (k === bgIndex || e.type === 'svg' || (e.type === 'ellipse' && e.soft)) continue; // already in the background picture
      try {
        if (e.type === 'text') addText(slide, e);
        else if (e.type === 'rect') addShape(pptx, slide, e, false);
        else if (e.type === 'ellipse') addShape(pptx, slide, e, true);
        else if (e.type === 'line' || e.type === 'arrow') addLine(pptx, slide, e);
        else if (e.type === 'image') await addImage(slide, e);
        else if (e.type === 'chrome') slide.addImage({ data: await chromePicture(e), x: e.x, y: e.y, w: e.w, h: e.h, ...(e.rotate ? { rotate: e.rotate } : {}) });
      } catch (err) {
        console.warn('export: element skipped', e.type, err);
      }
    }
    onProgress?.(i + 1, total);
  }
  const safe = (deck.deck.shortTitle ?? deck.deck.title ?? 'Deck').replace(/[^\p{L}\p{N} _-]+/gu, '').trim().slice(0, 60) || 'Deck';
  const fileName = `${safe} - ${deck.direction.name}.pptx`;
  // hand the file over ourselves, so the browser keeps its name (PptxGenJS's own download can lose it)
  const blob = await pptx.write({ outputType: 'blob' });
  const url = URL.createObjectURL(blob);
  const a = Object.assign(document.createElement('a'), { href: url, download: fileName });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
  return fileName;
}

/** The free fonts a deck uses that are not part of Office (recipients may need to install them). */
export function bundledFontsOf(deck) {
  const used = new Set(deck.slides.flatMap((s) => s.els.filter((e) => e.type === 'text').map((e) => e.font)));
  return [...used].filter((k) => FONTS[k]?.embed).map((k) => ({ name: FONTS[k].office, file: `fonts/${FONTS[k].file}` }));
}
