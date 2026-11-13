// Procedural textures for the Texture look. Every texture is generated from a seed,
// so each deck gets its own contour map, grain or grid offset, and the same seed
// always gives the same picture (the preview and the later export agree).
//
// Each generator returns a self-contained SVG string sized to the slide
// (1280 x 720 px = 13.333 x 7.5 in). The PowerPoint export will turn these
// into background pictures; all text stays separate and editable.

import { createRng } from '../engine/rng.js';

const PW = 1280;
const PH = 720;
const cache = new Map();

/** Cached texture SVG. `variant` gives each slide a slightly different view. */
export function textureSvg(kind, opts) {
  const key = `${kind}|${opts.seed}|${opts.variant ?? 0}|${opts.color}|${(opts.colors ?? []).join(',')}`;
  if (!cache.has(key)) cache.set(key, GENERATORS[kind](opts, idFor(key)));
  return cache.get(key);
}

function idFor(key) {
  let h = 2166136261;
  for (let i = 0; i < key.length; i++) { h ^= key.charCodeAt(i); h = Math.imul(h, 16777619); }
  return `tx${(h >>> 0).toString(36)}`;
}

const svgOpen = (body, defs = '') => `<svg xmlns="http://www.w3.org/2000/svg" width="${PW}" height="${PH}" viewBox="0 0 ${PW} ${PH}" preserveAspectRatio="none">${defs ? `<defs>${defs}</defs>` : ''}${body}</svg>`;

// ---------------------------------------------------------------- noise

/** Smooth value noise with a few octaves, values roughly 0..1. */
function makeNoise(seed) {
  const rng = createRng(`noise:${seed}`);
  const N = 256;
  const perm = Array.from({ length: N }, (_, i) => i);
  for (let i = N - 1; i > 0; i--) { const j = Math.floor(rng.next() * (i + 1)); [perm[i], perm[j]] = [perm[j], perm[i]]; }
  const vals = Array.from({ length: N }, () => rng.next());
  const lat = (x, y) => vals[perm[(perm[x & 255] + y) & 255]];
  const fade = (t) => t * t * (3 - 2 * t);
  const base = (x, y) => {
    const xi = Math.floor(x); const yi = Math.floor(y);
    const xf = fade(x - xi); const yf = fade(y - yi);
    const a = lat(xi, yi); const b = lat(xi + 1, yi); const c = lat(xi, yi + 1); const d = lat(xi + 1, yi + 1);
    return a + (b - a) * xf + (c - a) * yf + (a - b - c + d) * xf * yf;
  };
  return (x, y) => (base(x, y) * 0.6 + base(x * 2.1 + 17, y * 2.1 + 9) * 0.28 + base(x * 4.3 + 41, y * 4.3 + 3) * 0.12);
}

// ---------------------------------------------------------------- contour lines

/** Topographic contour lines (marching squares on smooth noise), every fifth line heavier. */
function contour({ seed, variant = 0, color, levels = 15 }, id) {
  const noise = makeNoise(seed);
  const cols = 96;
  const rows = 54;
  const cw = PW / cols;
  const ch = PH / rows;
  const ox = variant * 1.7;
  const oy = variant * 0.9;
  const scale = 4.2 / cols;
  const f = [];
  for (let j = 0; j <= rows; j++) {
    f[j] = [];
    for (let i = 0; i <= cols; i++) f[j][i] = noise(i * scale * 1.5 + ox, j * scale * 1.5 + oy);
  }
  let lo = Infinity; let hi = -Infinity;
  for (const r of f) for (const v of r) { lo = Math.min(lo, v); hi = Math.max(hi, v); }
  const paths = [];
  for (let l = 1; l < levels; l++) {
    const t = lo + ((hi - lo) * l) / levels;
    const segs = [];
    for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) {
      const a = f[j][i]; const b = f[j][i + 1]; const c = f[j + 1][i + 1]; const d = f[j + 1][i];
      const idx = (a > t ? 8 : 0) | (b > t ? 4 : 0) | (c > t ? 2 : 0) | (d > t ? 1 : 0);
      if (idx === 0 || idx === 15) continue;
      const x = i * cw; const y = j * ch;
      const lerp = (p, q) => (t - p) / (q - p);
      const top = [x + cw * lerp(a, b), y];
      const right = [x + cw, y + ch * lerp(b, c)];
      const bottom = [x + cw * lerp(d, c), y + ch];
      const left = [x, y + ch * lerp(a, d)];
      const table = {
        1: [[left, bottom]], 2: [[bottom, right]], 3: [[left, right]], 4: [[top, right]],
        5: [[left, top], [bottom, right]], 6: [[top, bottom]], 7: [[left, top]], 8: [[left, top]],
        9: [[top, bottom]], 10: [[left, bottom], [top, right]], 11: [[top, right]], 12: [[left, right]],
        13: [[bottom, right]], 14: [[left, bottom]],
      };
      for (const s of table[idx]) segs.push(s);
    }
    paths.push({ d: chain(segs), major: l % 5 === 0 });
  }
  const minor = paths.filter((p) => !p.major).map((p) => p.d).join('');
  const major = paths.filter((p) => p.major).map((p) => p.d).join('');
  return svgOpen(`<g fill="none" stroke="${color}" stroke-linejoin="round" stroke-linecap="round"><path d="${minor}" stroke-width="1" opacity="0.55"/><path d="${major}" stroke-width="2" opacity="0.9"/></g>`);
}

/** Join loose segments into polylines, so the path stays small and the lines read as one stroke. */
function chain(segs) {
  const k = (p) => `${Math.round(p[0] * 10)},${Math.round(p[1] * 10)}`;
  const ends = new Map();
  segs.forEach((s, n) => { for (const p of s) { const key = k(p); if (!ends.has(key)) ends.set(key, []); ends.get(key).push(n); } });
  const used = new Uint8Array(segs.length);
  const r = (v) => Math.round(v * 10) / 10;
  let d = '';
  for (let n = 0; n < segs.length; n++) {
    if (used[n]) continue;
    used[n] = 1;
    const line = [segs[n][0], segs[n][1]];
    for (const dir of [1, -1]) {
      for (;;) {
        const tip = dir === 1 ? line[line.length - 1] : line[0];
        const next = (ends.get(k(tip)) ?? []).find((m) => !used[m]);
        if (next === undefined) break;
        used[next] = 1;
        const [p, q] = segs[next];
        const far = k(p) === k(tip) ? q : p;
        if (dir === 1) line.push(far); else line.unshift(far);
      }
    }
    d += `M${r(line[0][0])} ${r(line[0][1])}${line.slice(1).map((p) => `L${r(p[0])} ${r(p[1])}`).join('')}`;
  }
  return d;
}

// ---------------------------------------------------------------- blueprint grid

/** A drafting grid: fine quarter-inch lines, heavier inch lines, a frame and registration marks. */
function grid({ seed, variant = 0, color }, id) {
  const rng = createRng(`grid:${seed}:${variant}`);
  const minor = 24;
  const major = 96;
  const ox = Math.round(rng.next() * 3) * minor;
  const oy = Math.round(rng.next() * 3) * minor;
  const defs = `<pattern id="${id}m" width="${minor}" height="${minor}" patternUnits="userSpaceOnUse" x="${ox}" y="${oy}"><path d="M${minor} 0H0V${minor}" fill="none" stroke="${color}" stroke-width="0.8" opacity="0.16"/></pattern>`
    + `<pattern id="${id}M" width="${major}" height="${major}" patternUnits="userSpaceOnUse" x="${ox}" y="${oy}"><path d="M${major} 0H0V${major}" fill="none" stroke="${color}" stroke-width="1.2" opacity="0.32"/></pattern>`;
  const inset = 22;
  const cross = (x, y) => `<path d="M${x - 14} ${y}H${x + 14}M${x} ${y - 14}V${y + 14}"/><circle cx="${x}" cy="${y}" r="7"/>`;
  const marks = [[inset + 22, inset + 22], [PW - inset - 22, inset + 22], [inset + 22, PH - inset - 22], [PW - inset - 22, PH - inset - 22]].map(([x, y]) => cross(x, y)).join('');
  // a construction arc somewhere on the sheet, different per slide
  const cx = 300 + rng.next() * 700;
  const cy = 120 + rng.next() * 480;
  const rr = 160 + rng.next() * 220;
  const arc = `<circle cx="${cx.toFixed(0)}" cy="${cy.toFixed(0)}" r="${rr.toFixed(0)}" stroke-dasharray="6 8" opacity="0.35"/><path d="M${(cx - rr - 30).toFixed(0)} ${cy.toFixed(0)}H${(cx + rr + 30).toFixed(0)}M${cx.toFixed(0)} ${(cy - rr - 30).toFixed(0)}V${(cy + rr + 30).toFixed(0)}" opacity="0.3"/>`;
  return svgOpen(`<rect width="${PW}" height="${PH}" fill="url(#${id}m)"/><rect width="${PW}" height="${PH}" fill="url(#${id}M)"/>`
    + `<g fill="none" stroke="${color}" stroke-width="1.2"><rect x="${inset}" y="${inset}" width="${PW - 2 * inset}" height="${PH - 2 * inset}" opacity="0.55"/><g opacity="0.7">${marks}</g>${arc}</g>`, defs);
}

// ---------------------------------------------------------------- grainy gradient

/** Soft colour fields with film grain on top. */
function grain({ seed, variant = 0, colors }, id) {
  const rng = createRng(`grain:${seed}:${variant}`);
  const blobs = colors.map((c, i) => {
    const x = (0.1 + rng.next() * 0.8) * PW;
    const y = (0.1 + rng.next() * 0.8) * PH;
    const r = (0.32 + rng.next() * 0.22) * PW;
    return { c, x, y, r, i };
  });
  const defs = blobs.map((b) => `<radialGradient id="${id}g${b.i}" cx="${b.x.toFixed(0)}" cy="${b.y.toFixed(0)}" r="${b.r.toFixed(0)}" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="${b.c}" stop-opacity="0.95"/><stop offset="1" stop-color="${b.c}" stop-opacity="0"/></radialGradient>`).join('')
    + `<filter id="${id}n" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="2" seed="${Math.floor(rng.next() * 999)}" stitchTiles="stitch"/><feColorMatrix type="saturate" values="0"/><feComponentTransfer><feFuncA type="table" tableValues="0 0.55"/></feComponentTransfer></filter>`;
  return svgOpen(`${blobs.map((b) => `<rect width="${PW}" height="${PH}" fill="url(#${id}g${b.i})"/>`).join('')}<rect width="${PW}" height="${PH}" filter="url(#${id}n)" opacity="0.5" style="mix-blend-mode:overlay"/>`, defs);
}

// ---------------------------------------------------------------- film grain only

/** Fine film grain over the slide colour, nothing else: the quietest texture. */
function film({ seed, variant = 0 }, id) {
  const rng = createRng(`film:${seed}:${variant}`);
  const defs = `<filter id="${id}n" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed="${Math.floor(rng.next() * 999)}" stitchTiles="stitch"/><feColorMatrix type="saturate" values="0"/><feComponentTransfer><feFuncA type="table" tableValues="0 0.5"/></feComponentTransfer></filter>`;
  return svgOpen(`<rect width="${PW}" height="${PH}" filter="url(#${id}n)" style="mix-blend-mode:overlay"/>`, defs);
}

// ---------------------------------------------------------------- thermal gradient

const THERMAL = ['#1B1464', '#6A1B9A', '#D81B60', '#FF6F00', '#FFD54F'];
/** A heat map: nested hot spots running from indigo through magenta and orange to yellow. */
function heat({ seed, variant = 0 }, id) {
  const rng = createRng(`heat:${seed}:${variant}`);
  const spots = [0, 1].map(() => ({ x: (0.55 + rng.next() * 0.4) * PW, y: (0.15 + rng.next() * 0.7) * PH, r: (0.38 + rng.next() * 0.2) * PW }));
  const defs = spots.map((sp, i) => `<radialGradient id="${id}h${i}" cx="${sp.x.toFixed(0)}" cy="${sp.y.toFixed(0)}" r="${sp.r.toFixed(0)}" gradientUnits="userSpaceOnUse">${[...THERMAL].reverse().map((c, k) => `<stop offset="${(k / (THERMAL.length - 1)).toFixed(2)}" stop-color="${c}" stop-opacity="${k === THERMAL.length - 1 ? 0 : 0.85}"/>`).join('')}</radialGradient>`).join('')
    + `<filter id="${id}b"><feGaussianBlur stdDeviation="24"/></filter>`;
  return svgOpen(`<g filter="url(#${id}b)">${spots.map((sp, i) => `<rect width="${PW}" height="${PH}" fill="url(#${id}h${i})"/>`).join('')}</g>`, defs);
}

// ---------------------------------------------------------------- water ripples

/** Ripples on still water: rings seen at an angle, spreading from one point and fading. */
function ripple({ seed, variant = 0, color }, id) {
  const rng = createRng(`ripple:${seed}:${variant}`);
  const sets = [
    { x: (0.6 + rng.next() * 0.3) * PW, y: (0.55 + rng.next() * 0.3) * PH, n: 14 },
    { x: (0.1 + rng.next() * 0.3) * PW, y: (0.7 + rng.next() * 0.2) * PH, n: 7 },
  ];
  let rings = '';
  for (const st of sets) {
    for (let k = 1; k <= st.n; k++) {
      const r = 18 * k + 2.2 * k * k;
      const op = (0.75 * (1 - k / (st.n + 1))).toFixed(2);
      rings += `<ellipse cx="${st.x.toFixed(0)}" cy="${st.y.toFixed(0)}" rx="${r.toFixed(0)}" ry="${(r * 0.36).toFixed(0)}" stroke-width="${k % 3 === 0 ? 1.8 : 1}" opacity="${op}"/>`;
    }
  }
  return svgOpen(`<g fill="none" stroke="${color}">${rings}</g>`);
}

// ---------------------------------------------------------------- single-hued landscape

/** Layered ridges in tints of one colour, lightest far away, darkest in front. Stays in the bottom quarter. */
function landscape({ seed, variant = 0, colors }, id) {
  const noise = makeNoise(`land:${seed}:${variant}`);
  const layers = colors.length;
  let body = '';
  colors.forEach((c, i) => {
    const top = PH * (0.8 + i * 0.05);
    const amp = PH * (0.055 - i * 0.008);
    let d = `M0 ${PH}`;
    for (let x = 0; x <= PW; x += 16) {
      const y = top - amp * (noise(x / 260 + i * 7, i * 3.1) * 1.6 - 0.3);
      d += `L${x} ${y.toFixed(1)}`;
    }
    d += `L${PW} ${PH}Z`;
    body += `<path d="${d}" fill="${c}"/>`;
  });
  return svgOpen(body);
}

// ---------------------------------------------------------------- speckled graphite

/** Graphite: a soft cloudy ground with fine specks in `color`, like pencil dust or a chalkboard. */
function graphite({ seed, variant = 0, color }, id) {
  const rng = createRng(`graphite:${seed}:${variant}`);
  const s1 = Math.floor(rng.next() * 999);
  const n = parseInt(color.slice(1, 7), 16);
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => (v / 255).toFixed(3));
  const tint = `0 0 0 0 ${r}  0 0 0 0 ${g}  0 0 0 0 ${b}`;
  const defs = `<filter id="${id}c" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency="0.006" numOctaves="3" seed="${s1}"/><feColorMatrix type="matrix" values="${tint}  0.9 0 0 0 -0.35"/></filter>`
    + `<filter id="${id}s" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency="1.3" numOctaves="1" seed="${s1 + 7}" stitchTiles="stitch"/><feColorMatrix type="matrix" values="${tint}  1 0 0 0 0"/><feComponentTransfer><feFuncA type="discrete" tableValues="0 0 0 0 0 0 0 0.85 1"/></feComponentTransfer></filter>`;
  return svgOpen(`<rect width="${PW}" height="${PH}" filter="url(#${id}c)" opacity="0.18"/><rect width="${PW}" height="${PH}" filter="url(#${id}s)" opacity="0.5"/>`, defs);
}

// ---------------------------------------------------------------- fluted glass

/** Fluted (reeded) glass: soft colour behind narrow vertical ribs that each catch the light. */
function fluted({ seed, variant = 0, colors }, id) {
  const rng = createRng(`fluted:${seed}:${variant}`);
  const blobs = colors.map((c, i) => ({ c, i, x: (0.15 + rng.next() * 0.7) * PW, y: (0.1 + rng.next() * 0.8) * PH, r: (0.3 + rng.next() * 0.2) * PW }));
  const rib = 26;
  const defs = blobs.map((b) => `<radialGradient id="${id}g${b.i}" cx="${b.x.toFixed(0)}" cy="${b.y.toFixed(0)}" r="${b.r.toFixed(0)}" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="${b.c}" stop-opacity="0.85"/><stop offset="1" stop-color="${b.c}" stop-opacity="0"/></radialGradient>`).join('')
    + `<linearGradient id="${id}r" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#fff" stop-opacity="0.38"/><stop offset="0.35" stop-color="#fff" stop-opacity="0.04"/><stop offset="0.8" stop-color="#000" stop-opacity="0.07"/><stop offset="1" stop-color="#fff" stop-opacity="0.22"/></linearGradient>`
    + `<pattern id="${id}p" width="${rib}" height="${PH}" patternUnits="userSpaceOnUse"><rect width="${rib}" height="${PH}" fill="url(#${id}r)"/></pattern>`
    + `<filter id="${id}b"><feGaussianBlur stdDeviation="18 2"/></filter>`;
  return svgOpen(`<g filter="url(#${id}b)">${blobs.map((b) => `<rect width="${PW}" height="${PH}" fill="url(#${id}g${b.i})"/>`).join('')}</g><rect width="${PW}" height="${PH}" fill="url(#${id}p)"/>`, defs);
}

const GENERATORS = { contour, grid, grain, film, heat, ripple, landscape, graphite, fluted };
export const TEXTURE_KINDS = Object.keys(GENERATORS);
