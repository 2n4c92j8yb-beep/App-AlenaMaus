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
export const MAX_TEXT = 15000;      // the same limit as typed notes
const SHOT_WIDTH = 1000;            // px; enough to read a slide, small enough to send
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
 * Returns { text, trimmed } where trimmed says whether speaker notes or text had to be cut.
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
  const cut = slidesOnly.slice(0, MAX_TEXT);
  return { text: cut.slice(0, cut.lastIndexOf('\n') > MAX_TEXT * 0.8 ? cut.lastIndexOf('\n') : MAX_TEXT), trimmed: true };
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
  };
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
  return { source: 'pdf', name: file.name, count: doc.numPages, images: fitBudget(images), pages: shown, text, trimmed, theme: null };
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
  return { source: 'pptx', name: file.name, count: parts.slides.length, images: fitBudget(canvases), text, trimmed, theme: parts.theme };
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
