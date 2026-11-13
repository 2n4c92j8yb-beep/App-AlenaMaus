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

const GENERATORS = { contour, grid, grain };
export const TEXTURE_KINDS = Object.keys(GENERATORS);
