// Reading an uploaded AI-made deck in the browser, so Claude can look at it
// (api/analyse.js). Nothing here leaves the device until the person presses the button.
//
//   PDF          every page becomes a picture (pdf.js, vendor/pdfjs, Apache-2.0) plus its text
//   PowerPoint   browsers cannot draw .pptx, so the file's text, theme colours, fonts,
//                background kinds and largest pictures are read instead (JSZip, already
//                shipped inside vendor/pptxgen.bundle.js)
//   screenshots  used as they are, shrunk
//   text / md    used as notes
//
// The parts that need no browser (text clean-up, PowerPoint XML) are exported for tests.

export const MAX_SLIDES = 10;       // pictures sent to Claude
export const MAX_TEXT = 40000;      // slide text of an uploaded deck (api/analyse.js accepts the same); never cut
const SHOT_WIDTH = 1000;            // px; enough to read a slide, small enough to send
const PICTURE_WIDTH = 1600;         // px; the deck's own pictures, kept on the device for the redesign
const BUDGET = 3_800_000;           // base64 characters for all pictures together

// ---------------------------------------------------------------- text clean-up

// The credit line AI tools add; PDFs often run it into the last line of a slide's text
const CREDIT = /\s*\b(made|created|generated|built|designed) (with|by|in|using) (gamma|canva|beautiful\.ai|tome|pitch|chatgpt|claude|copilot|powerpoint designer|slidesgo|presentations\.ai|plus ai|decktopus)\b\S*/gi;

// Lines AI tools add to every slide that say nothing about the topic
const BOILERPLATE = [
  /^(made|created|generated|built|designed) (with|by|in|using) (gamma|canva|beautiful\.ai|tome|pitch|chatgpt|claude|copilot|powerpoint designer|slidesgo|presentations\.ai|plus ai|decktopus)\b.*$/i,
  /^(slide|page|folie|seite) \d+( (of|von) \d+)?$/i,
  /^\d+ ?(\/|of|von) ?\d+$/i,
  /^\d{1,3}$/,
  /^(click to (add|edit).*|insert (title|text) here)$/i,
];

/**
 * Turn the text of a deck (one string per slide) into notes: boilerplate and footers
 * that repeat on most slides go, emoji go, and bullet characters become dashes.
 * Returns { text, trimmed } where trimmed says whether speaker notes had to be left out.
 * The slide text itself is never cut: a deck with more than MAX_TEXT characters on its
 * slides is refused with a message, so the redesign never loses words.
 */
export function cleanDeckText(slides, notes = []) {
  const lines = slides.map((s) => String(s ?? '').split(/\r?\n/).map((l) => l.replace(/\s+/g, ' ').trim()).filter(Boolean));
  // a line on more than half the slides (at least three) is a footer or a logo text
  const count = new Map();
  lines.forEach((ls) => new Set(ls).forEach((l) => count.set(l, (count.get(l) ?? 0) + 1)));
  const repeated = (l) => slides.length >= 3 && count.get(l) > slides.length / 2;
  const bullet = /^[•●◦▪▫■□➤➢►▶→–—*·-]\s*/u;
  const emoji = /\p{Extended_Pictographic}️?\s*/gu; // decoration, not content: a headline stays a headline
  const tidy = (l) => l.replace(CREDIT, '').replace(emoji, '').replace(/\s+/g, ' ').trim();
  const block = (ls) => ls.filter((l) => !repeated(l) && !BOILERPLATE.some((re) => re.test(l)))
    .map((l) => { const t = tidy(l); return bullet.test(t) ? `- ${t.replace(bullet, '')}` : t; })
    .filter((l) => l && l !== '-');
  const slideText = lines.map(block).map((ls, i) => ls.length ? `Slide ${i + 1}\n${ls.join('\n')}` : '').filter(Boolean);
  const noteText = notes.map((n, i) => String(n ?? '').replace(/\s+/g, ' ').trim() && `Speaker notes, slide ${i + 1}: ${String(n).replace(/\s+/g, ' ').trim()}`).filter(Boolean);
  const full = [...slideText, ...noteText].join('\n\n');
  if (full.length <= MAX_TEXT) return { text: full, trimmed: false };
  const slidesOnly = slideText.join('\n\n'); // speaker notes go first
  if (slidesOnly.length <= MAX_TEXT) return { text: slidesOnly, trimmed: true };
  throw new Error(`This deck has more text than the app can redesign at once (${slidesOnly.length.toLocaleString('en')} of ${MAX_TEXT.toLocaleString('en')} characters). Split it into two parts and upload them one at a time.`);
}

// ---------------------------------------------------------------- PowerPoint

const decode = (s) => s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, '&');

/** The text of one slide's XML: one line per paragraph, indented by bullet level. */
export function slideXmlText(xml) {
  return [...String(xml).matchAll(/<a:p>([\s\S]*?)<\/a:p>|<a:p [^>]*>([\s\S]*?)<\/a:p>/g)]
    .map((m) => {
      const p = m[1] ?? m[2] ?? '';
      const lvl = Number(/<a:pPr[^>]*\blvl="(\d)"/.exec(p)?.[1] ?? 0);
      const t = [...p.matchAll(/<a:t>([^<]*)<\/a:t>|<a:t [^>]*>([^<]*)<\/a:t>/g)].map((x) => decode(x[1] ?? x[2] ?? '')).join('');
      return t.trim() ? `${'  '.repeat(lvl)}${t.trim()}` : '';
    })
    .filter(Boolean)
    .join('\n');
}

/** Theme colours and fonts from ppt/theme/theme1.xml. */
export function themeOf(xml) {
  const scheme = /<a:clrScheme[\s\S]*?<\/a:clrScheme>/.exec(String(xml))?.[0] ?? '';
  const colors = [...scheme.matchAll(/<a:(dk1|lt1|dk2|lt2|accent\d)>[\s\S]*?(?:srgbClr val="([0-9A-Fa-f]{6})"|lastClr="([0-9A-Fa-f]{6})")/g)]
    .map((m) => ({ role: m[1], hex: `#${(m[2] ?? m[3]).toUpperCase()}` }));
  const font = (tag) => new RegExp(`<a:${tag}>[\\s\\S]*?<a:latin typeface="([^"]+)"`).exec(String(xml))?.[1];
  return { colors, fonts: [font('majorFont'), font('minorFont')].filter((f) => f && !f.startsWith('+')) };
}

/** What a slide's, layout's or master's background is made of. */
export function backgroundOf(xml) {
  const bg = /<p:bg>([\s\S]*?)<\/p:bg>/.exec(String(xml))?.[1];
  if (!bg) return '';
  if (bg.includes('<a:gradFill')) return 'gradient';
  if (bg.includes('<a:blipFill')) return 'picture';
  if (bg.includes('<a:pattFill')) return 'pattern';
  if (bg.includes('<a:solidFill')) return 'solid';
  return '';
}

const num = (name) => Number(/(\d+)\.xml$/.exec(name)?.[1] ?? 0);

// ---------------------------------------------------------------- the deck's own pictures

const EMU_PER_INCH = 914400;

/**
 * The pictures a PowerPoint slide shows: `{ target, w, h }` per picture (target resolved to
 * a path in the file, w/h the size on the slide in inches), largest first. Pictures smaller
 * than about an inch and a half are icons or bullets and are left out.
 */
export function slidePictures(slideXml, relsXml) {
  const rels = new Map([...String(relsXml ?? '').matchAll(/<Relationship\b[^>]*>/g)].map(([tag]) => [
    /\bId="([^"]+)"/.exec(tag)?.[1], /\bTarget="([^"]+)"/.exec(tag)?.[1],
  ]).filter(([id, t]) => id && t));
  const out = [];
  for (const [pic] of String(slideXml ?? '').matchAll(/<p:pic\b[\s\S]*?<\/p:pic>/g)) {
    const id = /r:embed="([^"]+)"/.exec(pic)?.[1];
    const ext = /<a:ext\b[^>]*\bcx="(\d+)"[^>]*\bcy="(\d+)"/.exec(pic);
    const target = rels.get(id);
    if (!target || !ext) continue;
    const w = Number(ext[1]) / EMU_PER_INCH;
    const h = Number(ext[2]) / EMU_PER_INCH;
    if (Math.max(w, h) < 1.5) continue;
    const path = target.startsWith('/') ? target.slice(1) : `ppt/${target.replace(/^\.\.\//, '')}`;
    if (!/\.(png|jpe?g|gif|webp)$/i.test(path)) continue; // vector pictures (EMF/SVG) can't be shown as they are
    out.push({ target: path, w, h });
  }
  return out.sort((a, b) => b.w * b.h - a.w * a.h);
}

/**
 * Where a PDF page paints its pictures, from pdf.js's operator list: boxes in the page's
 * viewport coordinates (top-left origin), following save/restore, transforms and form
 * XObjects. `vt` is the viewport transform at the scale the page is rendered.
 */
export function pictureBoxes({ fnArray, argsArray }, OPS, vt) {
  const mul = (m, n) => [m[0] * n[0] + m[2] * n[1], m[1] * n[0] + m[3] * n[1], m[0] * n[2] + m[2] * n[3], m[1] * n[2] + m[3] * n[3], m[0] * n[4] + m[2] * n[5] + m[4], m[1] * n[4] + m[3] * n[5] + m[5]];
  let ctm = [1, 0, 0, 1, 0, 0];
  const stack = [];
  const boxes = [];
  fnArray.forEach((fn, i) => {
    const args = argsArray[i];
    if (fn === OPS.save) stack.push(ctm);
    else if (fn === OPS.restore) ctm = stack.pop() ?? ctm;
    else if (fn === OPS.transform) ctm = mul(ctm, args);
    else if (fn === OPS.paintFormXObjectBegin) { stack.push(ctm); if (Array.isArray(args?.[0]) && args[0].length === 6) ctm = mul(ctm, args[0]); }
    else if (fn === OPS.paintFormXObjectEnd) ctm = stack.pop() ?? ctm;
    else if (fn === OPS.paintImageXObject || fn === OPS.paintInlineImageXObject) {
      // an image fills the unit square of the current transform
      const m = mul(vt, ctm);
      const pts = [[0, 0], [1, 0], [0, 1], [1, 1]].map(([x, y]) => [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]]);
      const xs = pts.map((p) => p[0]);
      const ys = pts.map((p) => p[1]);
      boxes.push({ x: Math.min(...xs), y: Math.min(...ys), w: Math.max(...xs) - Math.min(...xs), h: Math.max(...ys) - Math.min(...ys) });
    }
  });
  return boxes;
}

/**
 * Which pictures to keep: big enough to be content (not an icon), not a background that
 * fills the slide, and not a logo repeated on most slides. `found` is [{ slide, key, area }]
 * (area as a share of the slide); returns the kept entries, at most two per slide, largest first.
 */
export function keepPictures(found, slideCount) {
  const seen = new Map();
  found.forEach((p) => seen.set(p.key, (seen.get(p.key) ?? 0) + 1));
  const logo = (p) => slideCount >= 3 && seen.get(p.key) > slideCount / 2;
  const bySlide = new Map();
  for (const p of found) {
    if (p.area < 0.03 || p.area > 0.9 || logo(p)) continue;
    bySlide.set(p.slide, [...(bySlide.get(p.slide) ?? []), p]);
  }
  return [...bySlide.values()].flatMap((list) => list.sort((a, b) => b.area - a.area).slice(0, 2));
}

/**
 * Read a .pptx. `zip` is anything with `names` (all paths in the file) and
 * `text(path)` / `blob(path)` that resolve to the file's content.
 */
export async function readPptxParts(zip) {
  const slidesNames = zip.names.filter((n) => /^ppt\/slides\/slide\d+\.xml$/.test(n)).sort((a, b) => num(a) - num(b));
  if (!slidesNames.length) throw new Error('This PowerPoint file has no slides that could be read.');
  const slideXml = await Promise.all(slidesNames.map((n) => zip.text(n)));
  const notesXml = await Promise.all(slidesNames.map((n) => {
    const notes = `ppt/notesSlides/notesSlide${num(n)}.xml`;
    return zip.names.includes(notes) ? zip.text(notes) : '';
  }));
  const themeName = zip.names.find((n) => /^ppt\/theme\/theme\d+\.xml$/.test(n));
  const theme = themeName ? themeOf(await zip.text(themeName)) : { colors: [], fonts: [] };
  const layoutXml = await Promise.all(zip.names.filter((n) => /^ppt\/(slideLayouts|slideMasters)\/[^/]+\.xml$/.test(n)).map((n) => zip.text(n)));
  const backgrounds = [...new Set([...slideXml, ...layoutXml].map(backgroundOf).filter(Boolean))];
  // notes slides repeat the slide number and the slide's own placeholder text; keep the typed notes only
  const notes = notesXml.map((x) => slideXmlText(x).split('\n').filter((l) => !/^\d+$/.test(l.trim())).join(' '));
  return {
    slides: slideXml.map(slideXmlText),
    notes,
    theme: { colors: theme.colors.map((c) => c.hex), fonts: theme.fonts, backgrounds },
    media: zip.names.filter((n) => /^ppt\/media\/[^/]+\.(png|jpe?g)$/i.test(n)),
    // the pictures each slide shows, for the redesign (slide numbers count from 1)
    pictures: await Promise.all(slidesNames.map(async (n, i) => {
      const rels = `ppt/slides/_rels/${n.split('/').pop()}.rels`;
      return slidePictures(slideXml[i], zip.names.includes(rels) ? await zip.text(rels) : '').map((p) => ({ ...p, slide: i + 1 }));
    })).then((all) => all.flat()),
    size: sizeOf(zip.names.includes('ppt/presentation.xml') ? await zip.text('ppt/presentation.xml') : ''),
  };
}

/** The slide size in inches from presentation.xml (16:9 at 13.333 x 7.5 if unknown). */
function sizeOf(xml) {
  const m = /<p:sldSz\b[^>]*\bcx="(\d+)"[^>]*\bcy="(\d+)"/.exec(String(xml));
  return m ? { w: Number(m[1]) / EMU_PER_INCH, h: Number(m[2]) / EMU_PER_INCH } : { w: 13.333, h: 7.5 };
}

// ---------------------------------------------------------------- browser parts

/** The kind of upload, from its file name and type. */
export function kindOf(file) {
  const name = String(file?.name ?? '').toLowerCase();
  const type = String(file?.type ?? '');
  if (name.endsWith('.pdf') || type === 'application/pdf') return 'pdf';
  if (name.endsWith('.pptx') || type.includes('presentationml')) return 'pptx';
  if (name.endsWith('.ppt') || name.endsWith('.key') || name.endsWith('.odp')) return 'unsupported';
  if (type.startsWith('image/') || /\.(png|jpe?g|webp)$/.test(name)) return 'image';
  if (type.startsWith('text/') || /\.(txt|md|markdown)$/.test(name)) return 'text';
  return 'unknown';
}

/**
 * Read the files someone dropped in (one deck, or several screenshots).
 * Returns { source, name, count, images: [dataURL], text, trimmed, theme }.
 */
export async function readDeck(files) {
  const list = [...files];
  if (!list.length) throw new Error('No file was chosen.');
  const kinds = list.map(kindOf);
  if (kinds.includes('unsupported')) throw new Error('Old PowerPoint (.ppt), Keynote and OpenDocument files can’t be read here. Save the deck as .pptx or PDF first.');
  if (kinds.every((k) => k === 'image')) return readShots(list);
  const i = kinds.findIndex((k) => k === 'pdf' || k === 'pptx' || k === 'text');
  if (i < 0) throw new Error('Choose a PDF, a PowerPoint file (.pptx), screenshots of slides, or a text file.');
  const file = list[i];
  if (kinds[i] === 'pdf') return readPdf(file);
  if (kinds[i] === 'pptx') return readPptx(file);
  const { text, trimmed } = cleanDeckText(String(await file.text()).split(/\n{2,}/));
  return { source: 'text', name: file.name, count: 0, images: [], text, trimmed, theme: null };
}

/** Pick up to n page numbers spread evenly over the deck (first and last included). */
export const spread = (total, n = MAX_SLIDES) => (total <= n ? Array.from({ length: total }, (_, i) => i + 1)
  : [...new Set(Array.from({ length: n }, (_, i) => 1 + Math.round((i * (total - 1)) / (n - 1))))]);

async function readPdf(file) {
  const pdfjs = await import('../../vendor/pdfjs/pdf.min.mjs');
  pdfjs.GlobalWorkerOptions.workerSrc = new URL('../../vendor/pdfjs/pdf.worker.min.mjs', import.meta.url).href;
  let doc;
  try {
    doc = await pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise;
  } catch (err) {
    if (err?.name === 'PasswordException') throw new Error('This PDF is protected by a password. Save a copy without one and try again.');
    throw new Error('This PDF could not be opened.');
  }
  const pages = await Promise.all(Array.from({ length: doc.numPages }, async (_, k) => {
    const page = await doc.getPage(k + 1);
    const tc = await page.getTextContent();
    return tc.items.map((it) => `${it.str}${it.hasEOL ? '\n' : ' '}`).join('');
  }));
  const images = [];
  const shown = spread(doc.numPages);
  for (const n of shown) {
    const page = await doc.getPage(n);
    const base = page.getViewport({ scale: 1 });
    const viewport = page.getViewport({ scale: SHOT_WIDTH / base.width });
    const canvas = Object.assign(document.createElement('canvas'), { width: Math.round(viewport.width), height: Math.round(viewport.height) });
    await page.render({ canvasContext: canvas.getContext('2d'), viewport }).promise;
    images.push(canvas);
  }
  const { text, trimmed } = cleanDeckText(pages);
  if (!text.trim() && !images.length) throw new Error('No slides could be read from this PDF.');
  const pictures = await pdfPictures(doc, pdfjs.OPS);
  return { source: 'pdf', name: file.name, count: doc.numPages, images: fitBudget(images), pages: shown, text, trimmed, theme: null, pictures };
}

/** The pictures on each PDF page, cut out of the rendered page as they appear (cropping included). */
async function pdfPictures(doc, OPS) {
  const found = [];
  for (let n = 1; n <= doc.numPages; n++) {
    const page = await doc.getPage(n);
    const base = page.getViewport({ scale: 1 });
    const boxes = pictureBoxes(await page.getOperatorList(), OPS, base.transform);
    boxes.forEach((b) => {
      const area = (b.w * b.h) / (base.width * base.height);
      // the same picture at the same place on many pages is a logo
      const key = [b.x, b.y, b.w, b.h].map((v) => Math.round(v / 4)).join(',');
      found.push({ slide: n, key, area, box: b, base });
    });
  }
  const kept = keepPictures(found, doc.numPages);
  const out = [];
  for (const n of [...new Set(kept.map((p) => p.slide))]) {
    const page = await doc.getPage(n);
    const scale = Math.min(3, PICTURE_WIDTH / Math.max(...kept.filter((p) => p.slide === n).map((p) => p.box.w)));
    const viewport = page.getViewport({ scale });
    const canvas = Object.assign(document.createElement('canvas'), { width: Math.round(viewport.width), height: Math.round(viewport.height) });
    await page.render({ canvasContext: canvas.getContext('2d'), viewport }).promise;
    for (const p of kept.filter((k) => k.slide === n)) {
      const x = Math.max(0, Math.round(p.box.x * scale));
      const y = Math.max(0, Math.round(p.box.y * scale));
      const w = Math.min(canvas.width - x, Math.round(p.box.w * scale));
      const h = Math.min(canvas.height - y, Math.round(p.box.h * scale));
      if (w < 40 || h < 40) continue;
      const crop = Object.assign(document.createElement('canvas'), { width: w, height: h });
      crop.getContext('2d').drawImage(canvas, x, y, w, h, 0, 0, w, h);
      out.push({ slide: n, src: crop.toDataURL('image/jpeg', 0.85), w, h });
    }
  }
  return out;
}

async function readShots(files) {
  const shots = files.slice(0, MAX_SLIDES);
  const canvases = await Promise.all(shots.map(async (f) => toCanvas(await loadImage(f), SHOT_WIDTH)));
  return { source: 'images', name: files.length === 1 ? files[0].name : `${files.length} screenshots`, count: files.length, images: fitBudget(canvases), pages: shots.map((_, i) => i + 1), text: '', trimmed: files.length > MAX_SLIDES, theme: null };
}

let jszipLoading = null;
function loadJsZip() {
  if (globalThis.JSZip) return Promise.resolve(globalThis.JSZip);
  // the PowerPoint export's bundle starts with JSZip and registers it globally
  jszipLoading ??= new Promise((resolve, reject) => {
    const s = Object.assign(document.createElement('script'), { src: 'vendor/pptxgen.bundle.js', async: true });
    s.onload = () => (globalThis.JSZip ? resolve(globalThis.JSZip) : reject(new Error('The PowerPoint reader did not load.')));
    s.onerror = () => { jszipLoading = null; reject(new Error('The PowerPoint reader could not be loaded.')); };
    document.head.append(s);
  });
  return jszipLoading;
}

async function readPptx(file) {
  const JSZip = await loadJsZip();
  let zip;
  try { zip = await JSZip.loadAsync(await file.arrayBuffer()); } catch {
    throw new Error('This PowerPoint file could not be opened. If it is password-protected, save a copy without a password.');
  }
  const parts = await readPptxParts({
    names: Object.keys(zip.files),
    text: (n) => zip.file(n).async('string'),
  });
  // the largest pictures in the file show Claude what kind of imagery the deck uses
  const sized = await Promise.all(parts.media.map(async (n) => ({ n, size: (await zip.file(n).async('uint8array')).length })));
  const big = sized.filter((m) => m.size > 30_000).sort((a, b) => b.size - a.size).slice(0, 4);
  const canvases = await Promise.all(big.map(async ({ n }) => {
    const blob = await zip.file(n).async('blob');
    return toCanvas(await loadImage(blob), 800);
  }));
  const { text, trimmed } = cleanDeckText(parts.slides, parts.notes);
  if (!text.trim()) throw new Error('No text could be read from this PowerPoint file.');
  // the deck's own pictures go back onto their slides in the redesign; they stay on the device
  const slideArea = parts.size.w * parts.size.h;
  const kept = keepPictures(parts.pictures.map((p) => ({ ...p, key: p.target, area: (p.w * p.h) / slideArea })), parts.slides.length);
  const pictures = (await Promise.all(kept.map(async (p) => {
    try {
      const file = zip.file(p.target);
      if (!file) return null;
      const c = toCanvas(await loadImage(await file.async('blob')), PICTURE_WIDTH);
      return { slide: p.slide, src: c.toDataURL('image/jpeg', 0.85), w: c.width, h: c.height };
    } catch { return null; }
  }))).filter(Boolean);
  return { source: 'pptx', name: file.name, count: parts.slides.length, images: fitBudget(canvases), text, trimmed, theme: parts.theme, pictures };
}

function loadImage(blob) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('A picture could not be read.')); };
    img.src = url;
  });
}

function toCanvas(img, width) {
  const scale = Math.min(1, width / img.naturalWidth);
  const canvas = Object.assign(document.createElement('canvas'), { width: Math.round(img.naturalWidth * scale), height: Math.round(img.naturalHeight * scale) });
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#FFFFFF'; // transparent PNGs become white, not black, as JPEG
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  return canvas;
}

/** JPEG data URLs that fit the request size together, lowering quality and size if needed. */
function fitBudget(canvases) {
  for (const q of [0.75, 0.6, 0.45]) {
    const urls = canvases.map((c) => c.toDataURL('image/jpeg', q));
    if (urls.reduce((n, u) => n + u.length, 0) <= BUDGET) return urls;
  }
  // still too large: smaller pictures
  return canvases.map((c) => {
    const small = Object.assign(document.createElement('canvas'), { width: Math.round(c.width * 0.6), height: Math.round(c.height * 0.6) });
    small.getContext('2d').drawImage(c, 0, 0, small.width, small.height);
    return small.toDataURL('image/jpeg', 0.5);
  });
}
