// Draws a slide's element list as HTML at 1280 x 720 px (96 px per inch).
// The wrapper scales it to whatever width it gets.

import { FONTS } from '../library/fonts.js';

const PX = 96;              // px per inch
const PT = 96 / 72;         // px per point
const SVG_NS = 'http://www.w3.org/2000/svg';

export function renderSlide(els, { label, present = false } = {}) {
  const frame = document.createElement('div');
  frame.className = 'slide-frame';
  if (label) { frame.setAttribute('role', 'img'); frame.setAttribute('aria-label', label); }
  const slide = document.createElement('div');
  slide.className = present ? 'slide is-present' : 'slide';
  slide.setAttribute('aria-hidden', 'true');
  for (const el of els) {
    const node = draw(el);
    if (node.nodeType === 1) {
      node.dataset.seq = String(el.seq ?? 0);
      node.style.setProperty('--seq', String(el.seq ?? 0));
    }
    slide.append(node);
  }
  frame.append(slide);
  fitToWidth(frame, slide);
  return frame;
}

function draw(el) {
  switch (el.type) {
    case 'text': return drawText(el);
    case 'rect': return drawBox(el, false);
    case 'ellipse': return drawBox(el, true);
    case 'image': return drawImage(el);
    case 'line':
    case 'arrow': return drawLine(el);
    default: return document.createComment(`unknown ${el.type}`);
  }
}

function drawBox(el, round) {
  const d = document.createElement('div');
  Object.assign(d.style, {
    position: 'absolute', left: `${el.x * PX}px`, top: `${el.y * PX}px`,
    width: `${el.w * PX}px`, height: `${el.h * PX}px`,
    background: el.fill ?? 'transparent',
    border: el.stroke ? `${(el.strokeWidth ?? 0.75) * PT}px solid ${el.stroke}` : 'none',
    borderRadius: round ? '50%' : '0',
    boxSizing: 'border-box',
    opacity: el.alpha ?? 1,
    transform: el.rotate ? `rotate(${el.rotate}deg)` : 'none',
  });
  return d;
}

function drawImage(el) {
  const img = document.createElement('img');
  img.src = el.src;
  img.alt = el.alt ?? '';
  img.decoding = 'async';
  Object.assign(img.style, {
    position: 'absolute', left: `${el.x * PX}px`, top: `${el.y * PX}px`,
    width: `${el.w * PX}px`, height: `${el.h * PX}px`,
    objectFit: el.fit === 'contain' ? 'contain' : 'cover',
    objectPosition: el.pos ?? 'center',
    borderRadius: el.round ? '50%' : '0',
    maxWidth: 'none',
    filter: el.filter ?? 'none',
  });
  return img;
}

function drawLine(el) {
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('width', '1280'); svg.setAttribute('height', '720');
  svg.setAttribute('viewBox', '0 0 1280 720');
  svg.style.cssText = 'position:absolute;left:0;top:0;overflow:visible;pointer-events:none';
  const w = el.width * PT;
  const ln = document.createElementNS(SVG_NS, 'line');
  const [x1, y1, x2, y2] = [el.x1, el.y1, el.x2, el.y2].map((v) => v * PX);
  ln.setAttribute('x1', x1); ln.setAttribute('y1', y1);
  ln.setAttribute('x2', el.type === 'arrow' ? x2 - w * 3 : x2); ln.setAttribute('y2', y2);
  ln.setAttribute('stroke', el.color); ln.setAttribute('stroke-width', w);
  svg.append(ln);
  if (el.type === 'arrow') {
    const head = document.createElementNS(SVG_NS, 'polygon');
    const s = w * 4;
    head.setAttribute('points', `${x2},${y2} ${x2 - s * 1.2},${y2 - s * 0.6} ${x2 - s * 1.2},${y2 + s * 0.6}`);
    head.setAttribute('fill', el.color);
    svg.append(head);
  }
  return svg;
}

function drawText(el) {
  const f = FONTS[el.font];
  const d = document.createElement('div');
  Object.assign(d.style, {
    position: 'absolute', left: `${el.x * PX}px`, top: `${el.y * PX}px`,
    width: `${el.w * PX}px`, height: `${el.h * PX}px`,
    display: 'flex', flexDirection: 'column',
    justifyContent: { top: 'flex-start', middle: 'center', bottom: 'flex-end' }[el.valign] ?? 'flex-start',
    fontFamily: f.css, fontSize: `${el.size * PT}px`, lineHeight: String(el.lineHeight),
    fontWeight: el.bold ? '700' : String(f.weight ?? 400),
    fontStyle: el.italic ? 'italic' : 'normal',
    color: el.color, textAlign: el.align,
    letterSpacing: el.tracking ? `${el.tracking}em` : 'normal',
    textTransform: el.caps ? 'uppercase' : 'none',
    overflowWrap: 'break-word',
  });
  if (!el.fits && !el.bleed) d.dataset.overflow = 'true';
  if (el.alpha != null) d.style.opacity = String(el.alpha);
  if (el.fillImage) {
    // the photo shows through the letters
    Object.assign(d.style, {
      color: 'transparent', backgroundImage: `url("${el.fillImage}")`, backgroundSize: 'cover', backgroundPosition: 'center',
      webkitBackgroundClip: 'text', backgroundClip: 'text', webkitTextFillColor: 'transparent',
    });
  }
  if (el.rotate === 90 || el.rotate === -90) {
    // lay the text out along the box's height, then turn it into place
    const [w, h] = [el.w * PX, el.h * PX];
    Object.assign(d.style, {
      width: `${h}px`, height: `${w}px`,
      left: `${el.x * PX + (w - h) / 2}px`, top: `${el.y * PX + (h - w) / 2}px`,
      transform: `rotate(${el.rotate}deg)`, whiteSpace: 'nowrap',
    });
  }
  for (const para of el.text.split('\n')) {
    const p = document.createElement('p');
    p.textContent = para;
    p.style.margin = '0';
    if (el.hanging) { p.style.paddingLeft = '0.5in'; p.style.textIndent = '-0.5in'; }
    d.append(p);
  }
  return d;
}

// Scale the fixed-size slide to the frame's width.
const observer = typeof ResizeObserver !== 'undefined'
  ? new ResizeObserver((entries) => {
    for (const e of entries) {
      const slide = e.target.firstElementChild;
      if (slide) slide.style.transform = `scale(${e.contentRect.width / 1280})`;
    }
  })
  : null;

function fitToWidth(frame, slide) {
  if (observer) observer.observe(frame);
  else slide.style.transform = 'scale(0.5)';
}
