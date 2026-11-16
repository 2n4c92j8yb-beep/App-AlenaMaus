// App controller: input → three directions → detail view.

import { OCCASIONS } from './library/occasions.js';
import { buildDirections, buildFromDirections } from './engine/build.js';
import { renderSlide } from './render/html.js';
import { playSlide, transition, hasGsap } from './render/present.js';
import { upgradeChrome } from './render/chrome3d.js';
import { SAMPLE_NOTES, SAMPLE_POOL } from './sample/great-vowel-shift.js';
import { toPool, parseAnswer, copyPastePrompt } from './engine/content.js';
import { attachPictures } from './engine/pictures.js';
import { occasionById } from './library/occasions.js';
import { exportPptx, bundledFontsOf, exportsAsPicture } from './export/pptx.js';
import { readDeck, kindOf } from './engine/import.js';
import { matchDirections, familyName } from './engine/match.js';

const FORM_LABELS = {
  cover: 'Cover', section: 'Section', statement: 'Statement', bigNumber: 'Key figure', comparison: 'Comparison',
  process: 'Process', timeline: 'Timeline', quote: 'Quote', definition: 'Definition', points: 'Points',
  pair: 'Before / after', question: 'Question', references: 'Works cited',
  photo: 'Picture', photoSplit: 'Picture and text',
};

const state = {
  occasionId: 'seminar',
  density: 'medium',
  formality: 'neutral',
  family: 'glass',
  round: 0,
  baseSeed: Math.random().toString(36).slice(2, 8), // different people, different picks
  decks: [],
  openIndex: null,
  uploads: [],      // { src, w, h, name } — the user's own pictures, kept in memory only
  present: null,    // { deck, index }
  original: null,   // { images, name, source } of the analysed upload, for the before/after view
  pool: null,       // the content written from the user's notes (null: the sample)
  poolKey: '',      // notes + occasion the pool was written for
  busy: false,
  imported: null,   // an uploaded AI deck, read on the device (src/engine/import.js)
  style: null,      // that deck's style profile, from the analysis step (api/analyse.js)
  match: null,      // the best direction and two alternatives for it (src/engine/match.js)
};

const $ = (id) => document.getElementById(id);

function init() {
  renderOccasions();
  $('input-form').addEventListener('submit', (e) => { e.preventDefault(); if (state.imported) redesign(); else write(); });
  $('deck-file').addEventListener('change', (e) => { importDeck([...e.target.files]); e.target.value = ''; });
  $('import-undo').addEventListener('click', undoImport);
  $('show-match').addEventListener('click', () => { rematch(); generate(); });
  $('copy-prompt').addEventListener('click', copyPrompt);
  $('use-answer').addEventListener('click', useAnswer);
  $('show-fallback').addEventListener('click', () => { if ($('input-form').reportValidity()) openFallback(''); });
  $('try-example').addEventListener('click', () => {
    if (state.busy) return;
    if (!$('notes').value.trim()) $('notes').value = SAMPLE_NOTES; // never replaces notes someone typed
    hideFallback();
    if (state.imported) undoImport();
    leaveMatch();
    state.pool = null; state.poolKey = ''; // no pool: the directions are built from the sample content
    generate(true);
  });
  $('show-privacy').addEventListener('click', (e) => {
    const note = $('privacy-note');
    note.hidden = !note.hidden;
    e.currentTarget.setAttribute('aria-expanded', String(!note.hidden));
  });
  document.querySelectorAll('[data-density]').forEach((b) => b.addEventListener('click', () => { state.density = b.dataset.density; generate(); }));
  document.querySelectorAll('[data-formality]').forEach((b) => b.addEventListener('click', () => { state.formality = b.dataset.formality; if (state.match) rematch(state.formality); generate(); }));
  // picking a look leaves the matched directions and shows that look's own three
  document.querySelectorAll('[data-family]').forEach((b) => b.addEventListener('click', () => { state.family = b.dataset.family; state.match = null; generate(); }));
  $('reroll').addEventListener('click', () => { state.round += 1; generate(); });
  $('back').addEventListener('click', closeDetail);
  $('edit-notes').addEventListener('click', () => showView('start', () => { window.scrollTo(0, 0); $('notes').focus(); }));
  $('pictures').addEventListener('change', (e) => addPictures([...e.target.files]));
  setupDropzone();
  document.addEventListener('click', (e) => { const d = document.querySelector('.adjust[open]'); if (d && !d.contains(e.target)) d.open = false; });
  $('clear-pictures').addEventListener('click', () => { state.uploads = []; $('pictures').value = ''; renderThumbs(); if (!$('results').hidden) generate(); });
  $('present').addEventListener('click', () => startPresenting(state.decks[state.openIndex]));
  $('export-pptx').addEventListener('click', downloadPptx);
  $('p-next').addEventListener('click', () => step(1));
  $('p-prev').addEventListener('click', () => step(-1));
  $('p-close').addEventListener('click', stopPresenting);
  $('p-grid-btn').addEventListener('click', () => toggleOverview());
  setupStage();
  document.addEventListener('keydown', onKey);
  syncToggles();
  renderHero();
}

// ---------- pictures ----------

async function addPictures(list) {
  const files = list.filter((f) => f.type.startsWith('image/'));
  for (const f of files) {
    try { state.uploads.push(await shrink(f)); } catch { /* unreadable file: skip it */ }
  }
  renderThumbs();
  if (!$('results').hidden) generate();
}

function setupDropzone() {
  const zone = $('dropzone').closest('.composer'); // pictures can be dropped anywhere on the notes box
  const over = (on) => (e) => { if (![...(e.dataTransfer?.types ?? [])].includes('Files')) return; e.preventDefault(); zone.classList.toggle('is-over', on); };
  zone.addEventListener('dragenter', over(true));
  zone.addEventListener('dragover', over(true));
  zone.addEventListener('dragleave', over(false));
  zone.addEventListener('drop', (e) => {
    if (!e.dataTransfer?.files?.length) return;
    over(false)(e);
    const files = [...e.dataTransfer.files];
    // a deck (PDF, PowerPoint, text) goes to the redesign; pictures stay pictures
    if (files.some((f) => ['pdf', 'pptx', 'text', 'unsupported'].includes(kindOf(f)))) importDeck(files);
    else addPictures(files);
  });
}

// Scale photos down on the device (iPad photos are large) and keep them in memory.
function shrink(file, max = 1600) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const k = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
      const w = Math.round(img.naturalWidth * k);
      const h = Math.round(img.naturalHeight * k);
      const canvas = Object.assign(document.createElement('canvas'), { width: w, height: h });
      canvas.getContext('2d').drawImage(img, 0, 0, w, h);
      URL.revokeObjectURL(url);
      resolve({ src: canvas.toDataURL('image/jpeg', 0.85), w, h, name: file.name.replace(/\.[^.]+$/, '') });
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('unreadable')); };
    img.src = url;
  });
}

function renderThumbs() {
  const box = $('thumbs');
  box.replaceChildren(...state.uploads.map((u) => {
    const li = document.createElement('li');
    li.append(Object.assign(document.createElement('img'), { src: u.src, alt: u.name }));
    return li;
  }));
  $('clear-pictures').hidden = state.uploads.length === 0;
}

// The user's pictures take the place of the sample pictures, in order.
function currentPool() {
  const base = state.pool ?? SAMPLE_POOL;
  if (!state.uploads.length) return base;
  const ups = [...state.uploads];
  const captions = [...(base.pictureCaptions ?? [])];
  const own = (u) => {
    const c = captions.shift();
    return { src: u.src, w: u.w, h: u.h, alt: c?.title ?? u.name, credit: 'Your own picture', title: c?.title ?? u.name, caption: c?.caption ?? '' };
  };
  // the user's pictures take the place of the sample pictures; with written content they are added as picture slides
  let items = base.items.map((it) => (it.kind === 'image' && ups.length ? { ...it, ...own(ups.shift()), citation: undefined } : it));
  if (base.generated) items = [...items, ...ups.splice(0, 2).map((u) => ({ kind: 'image', tags: ['evidence'], weight: 2, ...own(u) }))];
  const coverImage = ups.length ? { ...own(ups.shift()), citation: undefined } : base.coverImage;
  return { ...base, items, coverImage };
}

// ---------- PowerPoint ----------

async function downloadPptx() {
  const deck = state.decks[state.openIndex];
  if (!deck) return;
  const btn = $('export-pptx');
  const note = $('export-note');
  btn.disabled = true;
  note.hidden = false;
  note.textContent = 'Preparing the PowerPoint file…';
  try {
    const name = await exportPptx(deck, { onProgress: (d, t) => { note.textContent = `Preparing the PowerPoint file: slide ${d} of ${t}…`; } });
    const fonts = bundledFontsOf(deck);
    const pictured = deck.slides.some((sl) => sl.els.some(exportsAsPicture));
    note.replaceChildren(document.createTextNode(pictured
      ? `Downloaded “${name}”. Headlines in this look's special fonts are pictures, so they look exactly like the preview on any computer (their words are in the speaker notes); all other text is editable. `
      : `Downloaded “${name}”. All text stays editable. `));
    if (fonts.length) {
      note.append(document.createTextNode('This deck uses free fonts that are not part of Office; install them on the presenting computer: '));
      fonts.forEach((f, i) => {
        const a = Object.assign(document.createElement('a'), { href: f.file, textContent: f.name, download: '' });
        note.append(a, document.createTextNode(i < fonts.length - 1 ? ', ' : '.'));
      });
    }
  } catch (err) {
    note.textContent = `The PowerPoint file could not be made: ${err.message}`;
  } finally {
    btn.disabled = false;
  }
}

// ---------- writing step ----------

const notesKey = () => `${state.occasionId}|${$('notes').value.trim()}`;
const isSample = () => $('notes').value.trim() === SAMPLE_NOTES.trim();

/** Turn the notes into content (server, Claude), then show three directions. */
async function write() {
  if (state.busy) return;
  hideFallback();
  leaveMatch();
  if (isSample()) { state.pool = null; state.poolKey = ''; generate(true); return; }
  if (state.pool && state.poolKey === notesKey()) { generate(true); return; }
  setBusy(true);
  try {
    const res = await fetch('/api/generate', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ notes: $('notes').value, occasion: state.occasionId }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error ?? `The writing step failed (${res.status}).`);
    if (!data.pool?.items?.length) throw new Error('The server sent no slide content.');
    // already cleaned on the server with the same rules (toPool); now the pictures
    setBusy(true, 'pictures');
    state.pool = await attachPictures(data.pool);
    state.poolKey = notesKey();
    setBusy(false);
    generate(true);
  } catch (err) {
    setBusy(false);
    openFallback(err.message === 'Failed to fetch' ? 'The app could not reach the server.' : err.message);
  }
}

function setBusy(on, phase = 'writing') {
  state.busy = on;
  const btn = $('submit-btn');
  btn.disabled = on;
  btn.classList.toggle('is-busy', on);
  btn.querySelector('.label').textContent = !on ? submitLabel() : phase === 'pictures' ? 'Finding pictures…' : phase === 'looking' ? 'Looking at your slides…' : 'Writing your slides…';
  // read out for screen readers; sighted users get the bar
  $('busy-note').textContent = !on ? '' : phase === 'pictures'
    ? 'Looking for photos on Unsplash and Wikimedia Commons.'
    : phase === 'looking'
      ? 'Claude is looking at your slides to find the closest look and to read their content. This usually takes under a minute.'
      : 'Claude is writing the content of your slides. This usually takes under a minute.';
  progress(on, phase);
}

// The server reports no progress, so the bar is an estimate: it fills quickly at first and
// ever more slowly, never reaching the end by itself. Writing takes it towards 85 %,
// the picture search from there towards 97 %.
let progressTimer = null;
function progress(on, phase) {
  const bar = $('busy-bar');
  clearInterval(progressTimer);
  if (!on) { bar.hidden = true; return; }
  const from = bar.hidden ? 0 : Number(bar.getAttribute('aria-valuenow')) / 100;
  const [to, tau] = phase === 'pictures' ? [0.97, 4000] : [0.85, 18000];
  const t0 = performance.now();
  const paint = () => {
    const v = from + (to - from) * (1 - Math.exp(-(performance.now() - t0) / tau));
    bar.firstElementChild.style.transform = `scaleX(${v.toFixed(4)})`;
    bar.setAttribute('aria-valuenow', String(Math.round(v * 100)));
  };
  if (bar.hidden) { bar.firstElementChild.style.transform = 'scaleX(0)'; bar.hidden = false; }
  paint();
  progressTimer = setInterval(paint, 250);
}

function openFallback(message) {
  $('fallback').hidden = false;
  $('fallback-error').textContent = message ? `${message} You can still make the deck with your own Claude:` : 'Make the deck with your own Claude:';
  $('fallback-prompt').value = copyPastePrompt($('notes').value.trim(), occasionById(state.occasionId).name);
  $('fallback-answer').value = '';
  $('fallback-status').textContent = '';
  $('fallback').scrollIntoView({ block: 'nearest', behavior: reduced() ? 'auto' : 'smooth' });
}
const hideFallback = () => { $('fallback').hidden = true; };

async function copyPrompt() {
  const box = $('fallback-prompt');
  try { await navigator.clipboard.writeText(box.value); $('fallback-status').textContent = 'Prompt copied. Paste it into Claude, then paste the answer below.'; }
  catch { box.select(); $('fallback-status').textContent = 'Select the prompt and copy it (Ctrl or Cmd + C).'; }
}

async function useAnswer() {
  let pool;
  try {
    pool = toPool(parseAnswer($('fallback-answer').value));
  } catch (err) {
    $('fallback-status').textContent = `That answer could not be used: ${err.message}`;
    return;
  }
  hideFallback();
  setBusy(true, 'pictures');
  state.pool = await attachPictures(pool);
  state.poolKey = notesKey();
  setBusy(false);
  generate(true);
}

// ---------- redesigning an uploaded AI deck ----------

const submitLabel = () => (state.imported ? 'Redesign my deck' : 'Show three directions');

/** Read the chosen deck on the device and put its text into the notes box. */
async function importDeck(files) {
  if (state.busy) return;
  const status = $('import-status');
  status.hidden = false;
  $('import-undo').hidden = true;
  $('import-text').textContent = 'Reading your slides…';
  try {
    const deck = await readDeck(files);
    const notesBefore = state.imported ? state.imported.notesBefore : $('notes').value;
    state.imported = { ...deck, notesBefore };
    $('notes').value = deck.text;
    // screenshots carry no text, so the notes box may stay empty
    $('notes').required = false;
    const what = deck.source === 'text' ? `the text of “${deck.name}”`
      : deck.source === 'images' ? `${deck.count} screenshot${deck.count === 1 ? '' : 's'}`
      : `${deck.count} slide${deck.count === 1 ? '' : 's'} from “${deck.name}”`;
    const notes = [`Read ${what}.`];
    if (deck.source === 'pptx') notes.push('Tip: a PDF export of the same deck lets the app see the slides exactly as they look.');
    if (deck.source === 'pdf' && deck.count > deck.images.length) notes.push(`Claude will look at ${deck.images.length} of them, spread across the deck, and read all the text.`);
    if (deck.trimmed) notes.push(deck.source === 'images' ? 'Only the first 10 screenshots are used.' : 'The text was long, so speaker notes or the end were left out.');
    notes.push('Press “Redesign my deck” to find the closest look.');
    $('import-text').textContent = notes.join(' ');
    $('import-undo').hidden = false;
    $('submit-btn').querySelector('.label').textContent = submitLabel();
  } catch (err) {
    $('import-text').textContent = err.message;
    $('import-undo').hidden = !state.imported;
  }
}

function undoImport() {
  if (!state.imported) return;
  $('notes').value = state.imported.notesBefore;
  state.imported = null;
  $('notes').required = true;
  $('import-status').hidden = true;
  $('submit-btn').querySelector('.label').textContent = submitLabel();
}

/** Send the slides to Claude, then show the closest direction and two alternatives. */
async function redesign() {
  if (state.busy) return;
  hideFallback();
  const imp = state.imported;
  const text = $('notes').value.trim();
  if (!imp.images.length && text.length < 40) { $('import-text').textContent = 'There is too little text to work with. Add a few lines to the notes box.'; return; }
  // the same upload, text and occasion again: no need to ask Claude a second time
  const key = `${state.occasionId}|${imp.name}|${imp.count}|${text}`;
  if (state.style && state.analysedKey === key) { rematch(); generate(true); return; }
  setBusy(true, 'looking');
  try {
    const res = await fetch('/api/analyse', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ images: imp.images, text, theme: imp.theme, source: imp.source, occasion: state.occasionId }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error ?? `The redesign step failed (${res.status}).`);
    if (!data.pool?.items?.length || !data.style) throw new Error('The server sent no slide content.');
    setBusy(true, 'pictures');
    state.pool = await attachPictures(data.pool);
    state.poolKey = '';
    state.style = data.style;
    state.original = { images: imp.images, name: imp.name, source: imp.source };
    state.analysedKey = key;
    rematch();
    setBusy(false);
    generate(true);
  } catch (err) {
    setBusy(false);
    $('import-status').hidden = false;
    $('import-text').textContent = err.message === 'Failed to fetch' ? 'The app could not reach the server.' : err.message;
  }
}

/** Match the analysed deck to our directions again (after a tone change, or to come back to it). */
function rematch(tone) {
  if (!state.style) return;
  state.match = matchDirections(state.style, { occasionId: state.occasionId, tone });
}

/** Notes typed or the example: the matched view of an earlier upload no longer applies. */
function leaveMatch() {
  state.match = null;
  state.style = null;
  state.original = null;
  state.analysedKey = '';
}

function renderOriginal() {
  const box = $('original');
  box.hidden = !state.style;
  if (!state.style) return;
  $('original-summary').textContent = state.style.summary || `Read from “${state.original?.name ?? 'your upload'}”.`;
  $('show-match').hidden = Boolean(state.match);
  const strip = $('original-strip');
  const imgs = state.original?.source === 'pptx' ? [] : state.original?.images ?? []; // PowerPoint pictures are photos from the deck, not slides
  strip.hidden = !imgs.length;
  strip.replaceChildren(...imgs.slice(0, 6).map((src, i) => {
    const li = document.createElement('li');
    li.append(Object.assign(document.createElement('img'), { src, alt: `Uploaded slide ${i + 1}` }));
    return li;
  }));
}

// ---------- views ----------

const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

/** Switch between the start, results and detail screens with a short cross-fade. */
function showView(name, after) {
  const apply = () => {
    $('view-start').hidden = name !== 'start';
    $('results').hidden = name !== 'results';
    $('detail').hidden = name !== 'detail';
    after?.();
  };
  if (document.startViewTransition && !reduced()) document.startViewTransition(apply);
  else apply();
}

// ---------- hero: real covers from the three looks ----------

function renderHero() {
  const box = $('hero-deck');
  const looks = [['glass', 'Glass · Prism'], ['poster', 'Poster'], ['editorial', 'Editorial']];
  const frames = looks.map(([family]) => {
    const [deck] = buildDirections({ pool: SAMPLE_POOL, occasionId: 'seminar', family, seed: 'hero' });
    return { deck, frame: renderSlide(deck.slides[0].els) };
  });
  frames.forEach((f) => box.append(f.frame));
  let i = 0;
  const show = () => {
    frames.forEach((f, k) => {
      f.frame.classList.toggle('is-front', k === i);
      f.frame.classList.toggle('is-back', k === (i + 1) % frames.length);
    });
  };
  show();
  if (reduced()) return;
  setInterval(() => { if (!document.hidden && !$('view-start').hidden) { i = (i + 1) % frames.length; show(); } }, 4200);
}

// ---------- presenting ----------

let idleTimer;
function wake() {
  const p = $('presenter');
  p.classList.remove('is-idle');
  clearTimeout(idleTimer);
  idleTimer = setTimeout(() => { if (state.present && $('p-overview').hidden) p.classList.add('is-idle'); }, 2600);
}

function setupStage() {
  const stage = $('stage');
  let x0 = null;
  stage.addEventListener('pointerdown', (e) => { x0 = e.clientX; });
  stage.addEventListener('pointerup', (e) => {
    if (x0 === null) return;
    const dx = e.clientX - x0;
    x0 = null;
    if (Math.abs(dx) > 40) step(dx < 0 ? 1 : -1);          // swipe
    else step(e.clientX < window.innerWidth / 3 ? -1 : 1); // tap: left third goes back
  });
  $('presenter').addEventListener('pointermove', wake);
}

function startPresenting(deck) {
  if (!deck) return;
  state.present = { deck, index: 0, opener: document.activeElement, dir: 1, ctl: null };
  $('presenter').hidden = false;
  $('presenter').classList.toggle('has-gsap', hasGsap());
  $('p-overview').hidden = true;
  $('p-grid-btn').setAttribute('aria-pressed', 'false');
  $('stage').replaceChildren();
  document.body.style.overflow = 'hidden';
  $('presenter').requestFullscreen?.().catch(() => {});
  showSlide();
  wake();
  $('p-next').focus();
}

/** Show the current slide. `complete` skips the builds (going back, or jumping from the overview). */
function showSlide(complete = false) {
  const p = state.present;
  const { deck, index, dir } = p;
  const sl = deck.slides[index];
  p.ctl?.stop();
  p.chrome?.stop();
  const frame = renderSlide(sl.els, { present: true, label: `Slide ${index + 1} of ${deck.slides.length}: ${FORM_LABELS[sl.form]}` });
  if (dir < 0) frame.classList.add('from-left');
  const stage = $('stage');
  [...stage.children].slice(0, -1).forEach((n) => n.remove()); // a transition still running: drop its old frame
  const old = stage.lastElementChild;
  stage.append(frame);
  if (hasGsap()) transition(old, frame, deck.direction.family ?? 'editorial', dir);
  else old?.remove();
  p.ctl = playSlide(frame, sl, { complete });
  // real 3D chrome for the slide on screen (vector drawings stay as the fallback)
  const handle = { stop() { this.stopped = true; } };
  p.chrome = handle;
  upgradeChrome(frame).then((h) => { if (handle.stopped || state.present?.chrome !== handle) h.stop(); else handle.stop = () => h.stop(); });
  $('p-count').textContent = `${index + 1} / ${deck.slides.length}`;
  $('p-progress').style.width = `${((index + 1) / deck.slides.length) * 100}%`;
  $('p-prev').disabled = index === 0;
  $('p-next').disabled = index === deck.slides.length - 1 && !(p.ctl.remaining?.() > 0);
}

function goTo(n, { complete = false } = {}) {
  if (!state.present || n < 0 || n >= state.present.deck.slides.length || n === state.present.index) return;
  state.present.dir = n > state.present.index ? 1 : -1;
  state.present.index = n;
  showSlide(complete);
}

/** Forward reveals the slide's next build first; back always shows the previous slide complete. */
function step(d) {
  const p = state.present;
  if (!p) return;
  if (d > 0 && p.ctl?.next()) {
    $('p-next').disabled = p.index === p.deck.slides.length - 1 && !(p.ctl.remaining?.() > 0);
    return;
  }
  goTo(p.index + d, { complete: d < 0 });
}

/** Show the rest of the current slide at once. */
function revealAll() {
  state.present?.ctl?.finish();
  if (state.present) $('p-next').disabled = state.present.index === state.present.deck.slides.length - 1;
}

function toggleOverview(force) {
  if (!state.present) return;
  const ov = $('p-overview');
  const open = force ?? ov.hidden;
  ov.hidden = !open;
  $('p-grid-btn').setAttribute('aria-pressed', String(open));
  if (!open) { wake(); return; }
  const { deck, index } = state.present;
  $('p-grid').replaceChildren(...deck.slides.map((sl, n) => {
    const li = document.createElement('li');
    const b = document.createElement('button');
    b.type = 'button';
    if (n === index) b.setAttribute('aria-current', 'true');
    b.setAttribute('aria-label', `Slide ${n + 1}: ${FORM_LABELS[sl.form] ?? sl.form}`);
    const cap = Object.assign(document.createElement('span'), { textContent: `${String(n + 1).padStart(2, '0')}  ${FORM_LABELS[sl.form] ?? sl.form}` });
    b.append(renderSlide(sl.els), cap);
    b.addEventListener('click', () => { toggleOverview(false); goTo(n, { complete: true }); });
    li.append(b);
    return li;
  }));
  $('p-grid').querySelector('[aria-current]')?.focus();
}

function stopPresenting() {
  if (!state.present) return;
  const opener = state.present.opener;
  state.present.ctl?.stop();
  state.present.chrome?.stop();
  state.present = null;
  clearTimeout(idleTimer);
  $('presenter').hidden = true;
  $('presenter').classList.remove('is-idle');
  document.body.style.overflow = '';
  if (document.fullscreenElement) document.exitFullscreen?.().catch(() => {});
  opener?.focus?.();
}

function onKey(e) {
  if (!state.present) return;
  wake();
  if (e.key === 'Escape') { if (!$('p-overview').hidden) toggleOverview(false); else stopPresenting(); return; }
  if (e.key === 'g' || e.key === 'o') { e.preventDefault(); toggleOverview(); return; }
  if (!$('p-overview').hidden) return;
  if ((e.key === 'ArrowRight' && e.shiftKey) || e.key === 's') { e.preventDefault(); revealAll(); }
  else if (['ArrowRight', 'PageDown', ' '].includes(e.key)) { e.preventDefault(); step(1); }
  else if (['ArrowLeft', 'PageUp'].includes(e.key)) { e.preventDefault(); step(-1); }
  else if (e.key === 'Home') goTo(0, { complete: true });
  else if (e.key === 'End') goTo(state.present.deck.slides.length - 1, { complete: true });
}

// ---------- input ----------

function renderOccasions() {
  const box = $('occasions');
  for (const o of OCCASIONS) {
    const label = document.createElement('label');
    label.className = 'chip';
    const input = Object.assign(document.createElement('input'), { type: 'radio', name: 'occasion', value: o.id, checked: o.id === state.occasionId });
    input.addEventListener('change', () => { state.occasionId = o.id; });
    const span = document.createElement('span');
    span.textContent = o.name;
    label.append(input, span);
    box.append(label);
  }
}

function syncToggles() {
  document.querySelectorAll('[data-density]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.density === state.density)));
  document.querySelectorAll('[data-formality]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.formality === state.formality)));
  const looks = [...document.querySelectorAll('[data-family]')];
  // while showing the matched directions no single look is chosen
  looks.forEach((b) => b.setAttribute('aria-pressed', String(!state.match && b.dataset.family === state.family)));
  document.querySelector('.looks').classList.toggle('is-matched', Boolean(state.match));
  document.querySelector('.looks').style.setProperty('--i', String(looks.findIndex((b) => b.dataset.family === state.family)));
}

// ---------- results ----------

function generate(fromStart = false) {
  syncToggles();
  const seed = `${state.baseSeed}:${state.round}`;
  if (state.match) {
    state.decks = buildFromDirections({ pool: currentPool(), occasionId: state.occasionId, density: state.density, seed, directions: state.match.map((m) => m.direction) })
      .map((deck, i) => ({ ...deck, match: state.match[i] }));
  } else {
    state.decks = buildDirections({
      pool: currentPool(),
      occasionId: state.occasionId,
      density: state.density,
      formality: state.formality,
      family: state.family,
      seed,
    });
  }
  $('results-title').textContent = state.match ? 'The closest look, and two others' : 'Pick a direction';
  renderOriginal();
  renderCards();
  if (state.openIndex !== null) openDetail(state.openIndex, false);
  $('status').textContent = state.match
    ? `Closest to your deck: ${state.decks[0].direction.name}. Also: ${state.decks.slice(1).map((d) => d.direction.name).join(', ')}.`
    : `Three directions ready: ${state.decks.map((d) => d.direction.name).join(', ')}.`;
  if (fromStart) showView('results', () => { window.scrollTo(0, 0); $('results-title').setAttribute('tabindex', '-1'); $('results-title').focus({ preventScroll: true }); });
}

function renderCards() {
  const box = $('cards');
  box.replaceChildren();
  state.decks.forEach((deck, i) => {
    const card = document.createElement('article');
    card.className = 'card';
    card.style.setProperty('--n', String(i));
    const { direction: d, structure: s, slides } = deck;
    const preview = document.createElement('div');
    preview.className = 'card-preview';
    preview.append(renderSlide(slides[0].els, { label: `Cover slide in the ${d.name} direction` }));
    // a click on the big slide opens the direction too; keyboard and screen readers use the Open button
    preview.addEventListener('click', () => openDetail(i, true));
    card.append(preview);
    // flip through a few slides of this direction without leaving the page
    const strip = document.createElement('div');
    strip.className = 'strip';
    [slides[0], ...pickPreview(slides)].forEach((sl, k) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.setAttribute('aria-label', `Show the ${FORM_LABELS[sl.form] ?? sl.form} slide of ${d.name}`);
      if (k === 0) b.setAttribute('aria-current', 'true');
      b.append(renderSlide(sl.els));
      b.addEventListener('click', () => {
        strip.querySelectorAll('[aria-current]').forEach((x) => x.removeAttribute('aria-current'));
        b.setAttribute('aria-current', 'true');
        const old = preview.firstElementChild;
        old.classList.add('is-swapping');
        setTimeout(() => preview.replaceChildren(renderSlide(sl.els, { label: `${FORM_LABELS[sl.form]} slide in the ${d.name} direction` })), reduced() ? 0 : 140);
      });
      strip.append(b);
    });
    card.append(strip);
    // one row under the previews: what it is on the left, the way in on the right
    const foot = document.createElement('div');
    foot.className = 'card-foot';
    const body = document.createElement('div');
    body.className = 'card-body';
    body.innerHTML = '<h3></h3><p class="card-meta"></p>';
    body.querySelector('h3').textContent = deck.match ? `${familyName(d.family)} · ${d.name}` : d.name;
    body.querySelector('.card-meta').textContent = s.name;
    if (deck.match) {
      const badge = Object.assign(document.createElement('p'), { className: `match-badge${deck.match.role === 'best' ? ' is-best' : ''}`, textContent: deck.match.role === 'best' ? 'Closest to your deck' : 'Another option' });
      const why = Object.assign(document.createElement('p'), { className: 'match-reason', textContent: deck.match.reason });
      body.prepend(badge);
      body.append(why);
    }
    const open = Object.assign(document.createElement('button'), { type: 'button', className: 'btn btn-primary', innerHTML: 'Open <span class="arrow" aria-hidden="true">→</span>' });
    open.setAttribute('aria-label', `Open ${d.name}`);
    open.addEventListener('click', () => openDetail(i, true));
    foot.append(body, open);
    card.append(foot);
    if (deck.match?.changes.length) {
      const more = document.createElement('details');
      more.className = 'match-changes';
      more.innerHTML = '<summary>What changes</summary><ul></ul>';
      more.querySelector('ul').append(...deck.match.changes.map((c) => Object.assign(document.createElement('li'), { textContent: c })));
      card.append(more);
    }
    box.append(card);
  });
}

// Four slides that show the range of forms in a deck.
function pickPreview(slides) {
  const seen = new Set(['cover', 'section', 'references']);
  const out = [];
  for (const s of slides.slice(1)) {
    if (!seen.has(s.form)) { seen.add(s.form); out.push(s); }
    if (out.length === 4) break;
  }
  return out;
}

// ---------- detail ----------

function openDetail(i, focus) {
  state.openIndex = i;
  const deck = state.decks[i];
  const { direction: d, structure: s, slides, overflow } = deck;
  const fill = () => {
    $('detail-title').textContent = d.name;
    $('detail-meta').textContent = deck.match ? `${familyName(d.family)} · ${s.name} · ${deck.match.reason}` : s.name;
    $('export-note').hidden = true;
    const check = $('detail-check');
    check.hidden = overflow.length === 0;
    check.textContent = `${overflow.length} text box(es) may be too full (marked with a dashed outline).`;
    const list = $('slide-list');
    list.replaceChildren(...slides.map((sl, n) => {
      const li = document.createElement('li');
      li.style.setProperty('--n', String(n));
      const cap = document.createElement('p');
      cap.className = 'slide-caption';
      cap.innerHTML = '<b></b><span></span>';
      cap.querySelector('b').textContent = String(n + 1);
      cap.querySelector('span').textContent = FORM_LABELS[sl.form] ?? sl.form;
      li.append(renderSlide(sl.els, { label: `Slide ${n + 1}: ${FORM_LABELS[sl.form]}` }), cap);
      return li;
    }));
  };
  if (!focus) { fill(); return; }
  showView('detail', () => { fill(); window.scrollTo(0, 0); $('detail-title').setAttribute('tabindex', '-1'); $('detail-title').focus({ preventScroll: true }); });
}

function closeDetail() {
  const i = state.openIndex;
  state.openIndex = null;
  showView('results', () => {
    const btn = $('cards').querySelectorAll('.card-foot button')[i];
    if (btn) { btn.scrollIntoView({ block: 'center' }); btn.focus({ preventScroll: true }); }
  });
}

init();
