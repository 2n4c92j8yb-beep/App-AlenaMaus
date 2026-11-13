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
    case 'chrome': return drawChrome(el);
    case 'line':
    case 'arrow': return drawLine(el);
    default: return document.createComment(`unknown ${el.type}`);
  }
}

function drawBox(el, round) {
  const d = document.createElement('div');
  const shadows = [];
  if (el.glass) shadows.push(`inset 0 ${1.5 * PT}px 0 ${el.glass.rim}`, `0 ${0.3 * PX}px ${0.6 * PX}px -${0.3 * PX}px rgba(0,0,0,0.45)`);
  if (el.float) shadows.push(`0 ${0.42 * PX}px ${0.84 * PX}px -${0.25 * PX}px ${el.float}`, `0 ${0.17 * PX}px ${0.34 * PX}px -${0.17 * PX}px ${el.float}`);
  if (el.glow) shadows.push(`0 0 0 ${1.5 * PT}px ${el.glow.edge ?? 'transparent'}`, `0 0 ${el.glow.blur * PX}px ${el.glow.color}`, `0 0 ${el.glow.blur * 2.6 * PX}px ${el.glow.far ?? el.glow.color}`);
  Object.assign(d.style, {
    position: 'absolute', left: `${el.x * PX}px`, top: `${el.y * PX}px`,
    width: `${el.w * PX}px`, height: `${el.h * PX}px`,
    background: el.soft
      ? `radial-gradient(closest-side, ${el.fill}, transparent)`
      : el.gradient ? cssGradient(el.gradient) : (el.fill ?? 'transparent'),
    border: el.stroke ? `${(el.strokeWidth ?? 0.75) * PT}px solid ${el.stroke}` : 'none',
    borderRadius: round ? '50%' : el.radius ? `${el.radius * PX}px` : '0',
    boxSizing: 'border-box',
    opacity: el.alpha ?? 1,
    transform: el.rotate ? `rotate(${el.rotate}deg)` : 'none',
    boxShadow: shadows.length ? shadows.join(', ') : 'none',
  });
  if (el.glass) {
    // frosted glass: blur what lies behind, plus a lit rim
    d.style.backdropFilter = `blur(${el.glass.blur ?? 22}px) saturate(150%)`;
    d.style.webkitBackdropFilter = d.style.backdropFilter;
    d.style.border = `${1.5 * PT}px solid ${el.glass.edge}`;
  }
  if (el.soft && el.blur) d.style.filter = `blur(${el.blur * PX}px)`;
  return d;
}

const cssGradient = (g) => `linear-gradient(${g.angle ?? 115}deg, ${g.stops.map((c, i) => `${c} ${Math.round((i / (g.stops.length - 1)) * 100)}%`).join(', ')})`;

// Chrome objects (sphere, capsule, ring) as vector drawings. PowerPoint export turns them into pictures.
const CHROME = {
  silver: ['#FFFFFF', '#E9EBF0', '#B9BDCA', '#3C404E', '#0C0D12', '#3C404E', '#D6D9E2', '#FFFFFF'],
  gold: ['#FFF6E2', '#F3DDB0', '#C9A15F', '#5A4220', '#160F06', '#5A4220', '#E7C98F', '#FFF6E2'],
};
let chromeId = 0;
function drawChrome(el) {
  const id = `chr${chromeId++}`;
  const [w, h] = [el.w * PX, el.h * PX];
  const stops = CHROME[el.tint] ?? CHROME.silver;
  const lin = (gid, dir) => `<linearGradient id="${gid}" x1="0" y1="0" x2="${dir === 'down' ? 0 : 1}" y2="${dir === 'across' ? 0 : 1}">${stops.map((c, i) => `<stop offset="${(i / (stops.length - 1)).toFixed(2)}" stop-color="${c}"/>`).join('')}</linearGradient>`;
  const holo = el.holo ? `<linearGradient id="${id}h" x1="0" y1="0" x2="1" y2="1">${el.holo.map((c, i) => `<stop offset="${(i / (el.holo.length - 1)).toFixed(2)}" stop-color="${c}"/>`).join('')}</linearGradient>` : '';
  let shape = '';
  let film = '';
  if (el.kind === 'sphere') {
    const r = Math.min(w, h) / 2;
    shape = `<radialGradient id="${id}s" cx="0.4" cy="0.32" r="0.75">${[0, 0.08, 0.3, 0.54, 0.66, 0.8, 0.93, 1].map((o, i) => `<stop offset="${o}" stop-color="${stops[i]}"/>`).join('')}</radialGradient>
      <radialGradient id="${id}l" cx="0.5" cy="0.5" r="0.5"><stop offset="0" stop-color="#fff" stop-opacity="0.95"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient>`;
    shape = `<defs>${shape}${holo}</defs><circle cx="${w / 2}" cy="${h / 2}" r="${r}" fill="url(#${id}s)"/>`;
    if (el.holo) film = `<circle cx="${w / 2}" cy="${h / 2}" r="${r}" fill="url(#${id}h)" style="mix-blend-mode:color" opacity="0.55"/>`;
    film += `<ellipse cx="${w / 2 - r * 0.32}" cy="${h / 2 - r * 0.36}" rx="${r * 0.24}" ry="${r * 0.16}" fill="url(#${id}l)"/>`;
  } else if (el.kind === 'ring') {
    const sw = Math.min(w, h) * 0.13;
    const r = Math.min(w, h) / 2 - sw / 2;
    shape = `<defs>${lin(`${id}g`, 'diagonal')}${holo}</defs><circle cx="${w / 2}" cy="${h / 2}" r="${r}" fill="none" stroke="url(#${el.holo ? `${id}h` : `${id}g`})" stroke-width="${sw}"/>`;
    if (el.holo) film = `<circle cx="${w / 2}" cy="${h / 2}" r="${r + sw / 2 + 2}" fill="none" stroke="url(#${id}g)" stroke-width="${Math.max(2, sw * 0.08)}" opacity="0.8"/>`;
  } else {
    const vertical = h >= w;
    const rr = Math.min(w, h) / 2;
    // the chrome's horizon band runs along the capsule's length
    shape = `<defs>${lin(`${id}g`, vertical ? 'across' : 'down')}${holo}</defs><rect x="0" y="0" width="${w}" height="${h}" rx="${rr}" fill="url(#${id}g)"/>`;
    if (el.holo) film = `<rect x="0" y="0" width="${w}" height="${h}" rx="${rr}" fill="url(#${id}h)" style="mix-blend-mode:color" opacity="0.5"/>`;
  }
  const wrap = document.createElement('div');
  Object.assign(wrap.style, {
    position: 'absolute', left: `${el.x * PX}px`, top: `${el.y * PX}px`, width: `${w}px`, height: `${h}px`,
    transform: el.rotate ? `rotate(${el.rotate}deg)` : 'none', opacity: el.alpha ?? 1,
    filter: `drop-shadow(0 ${0.25 * PX}px ${0.3 * PX}px rgba(0,0,0,0.45))`,
  });
  wrap.innerHTML = `<svg xmlns="${SVG_NS}" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" style="display:block;overflow:visible">${shape}${film}</svg>`;
  return wrap;
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
    borderRadius: el.round ? '50%' : el.radius ? `${el.radius * PX}px` : '0',
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
  if (el.gradient) {
    // holographic text: the gradient shows through the letters
    Object.assign(d.style, {
      backgroundImage: cssGradient(el.gradient), webkitBackgroundClip: 'text', backgroundClip: 'text',
      webkitTextFillColor: 'transparent', color: el.color,
    });
  }
  if (el.glow) d.style.textShadow = `0 0 ${el.glow.blur * PX}px ${el.glow.color}`;
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
