// App controller: input → three directions → detail view.

import { OCCASIONS } from './library/occasions.js';
import { buildDirections } from './engine/build.js';
import { renderSlide } from './render/html.js';
import { playSlide, transition, hasGsap } from './render/present.js';
import { SAMPLE_NOTES, SAMPLE_POOL } from './sample/great-vowel-shift.js';

const FORM_LABELS = {
  cover: 'Cover', section: 'Section', statement: 'Statement', bigNumber: 'Key figure', comparison: 'Comparison',
  process: 'Process', timeline: 'Timeline', quote: 'Quote', definition: 'Definition', points: 'Points',
  pair: 'Before / after', question: 'Question', references: 'Works cited',
  photo: 'Picture', photoSplit: 'Picture and text',
};
const STUDENT_OCCASIONS = new Set(['seminar', 'thesis', 'lesson', 'group']);

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
};

const $ = (id) => document.getElementById(id);

function init() {
  $('notes').value = SAMPLE_NOTES;
  renderOccasions();
  $('input-form').addEventListener('submit', (e) => { e.preventDefault(); generate(true); });
  document.querySelectorAll('[data-density]').forEach((b) => b.addEventListener('click', () => { state.density = b.dataset.density; generate(); }));
  document.querySelectorAll('[data-formality]').forEach((b) => b.addEventListener('click', () => { state.formality = b.dataset.formality; generate(); }));
  document.querySelectorAll('[data-family]').forEach((b) => b.addEventListener('click', () => { state.family = b.dataset.family; generate(); }));
  $('reroll').addEventListener('click', () => { state.round += 1; generate(); });
  $('back').addEventListener('click', closeDetail);
  $('edit-notes').addEventListener('click', () => showView('start', () => { window.scrollTo(0, 0); $('notes').focus(); }));
  $('pictures').addEventListener('change', (e) => addPictures([...e.target.files]));
  setupDropzone();
  document.addEventListener('click', (e) => { const d = document.querySelector('.adjust[open]'); if (d && !d.contains(e.target)) d.open = false; });
  $('clear-pictures').addEventListener('click', () => { state.uploads = []; $('pictures').value = ''; renderThumbs(); if (!$('results').hidden) generate(); });
  $('present').addEventListener('click', () => startPresenting(state.decks[state.openIndex]));
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
  const zone = $('dropzone');
  const over = (on) => (e) => { e.preventDefault(); zone.classList.toggle('is-over', on); };
  zone.addEventListener('dragenter', over(true));
  zone.addEventListener('dragover', over(true));
  zone.addEventListener('dragleave', over(false));
  zone.addEventListener('drop', (e) => { over(false)(e); addPictures([...e.dataTransfer.files]); });
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
  if (!state.uploads.length) return SAMPLE_POOL;
  const ups = [...state.uploads];
  const own = (u) => ({
    src: u.src, w: u.w, h: u.h, alt: u.name, credit: 'Your own picture',
    title: u.name, caption: 'Once the AI step is connected, the caption comes from your notes.',
  });
  const items = SAMPLE_POOL.items.map((it) => (it.kind === 'image' && ups.length ? { ...it, ...own(ups.shift()), citation: undefined } : it));
  const coverImage = ups.length ? { ...own(ups.shift()), citation: undefined } : SAMPLE_POOL.coverImage;
  return { ...SAMPLE_POOL, items, coverImage };
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
    $('hero-caption').textContent = `${frames[i].deck.direction.name} · ${looks[i][0]} look`;
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
  const frame = renderSlide(sl.els, { present: true, label: `Slide ${index + 1} of ${deck.slides.length}: ${FORM_LABELS[sl.form]}` });
  if (dir < 0) frame.classList.add('from-left');
  const stage = $('stage');
  [...stage.children].slice(0, -1).forEach((n) => n.remove()); // a transition still running: drop its old frame
  const old = stage.lastElementChild;
  stage.append(frame);
  if (hasGsap()) transition(old, frame, deck.direction.family ?? 'editorial', dir);
  else old?.remove();
  p.ctl = playSlide(frame, sl, { complete });
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
    input.addEventListener('change', () => { state.occasionId = o.id; $('occasion-hint').textContent = o.hint; });
    const span = document.createElement('span');
    span.textContent = o.name;
    if (STUDENT_OCCASIONS.has(o.id)) span.append(Object.assign(document.createElement('em'), { textContent: 'Students' }));
    label.append(input, span);
    box.append(label);
  }
  $('occasion-hint').textContent = OCCASIONS.find((o) => o.id === state.occasionId)?.hint ?? '';
}

function syncToggles() {
  document.querySelectorAll('[data-density]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.density === state.density)));
  document.querySelectorAll('[data-formality]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.formality === state.formality)));
  const looks = [...document.querySelectorAll('[data-family]')];
  looks.forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.family === state.family)));
  document.querySelector('.looks').style.setProperty('--i', String(looks.findIndex((b) => b.dataset.family === state.family)));
}

// ---------- results ----------

function generate(fromStart = false) {
  syncToggles();
  state.decks = buildDirections({
    pool: currentPool(),
    occasionId: state.occasionId,
    density: state.density,
    formality: state.formality,
    family: state.family,
    seed: `${state.baseSeed}:${state.round}`,
  });
  renderCards();
  if (state.openIndex !== null) openDetail(state.openIndex, false);
  $('status').textContent = `Three directions ready: ${state.decks.map((d) => d.direction.name).join(', ')}.`;
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
    const body = document.createElement('div');
    body.className = 'card-body';
    body.innerHTML = '<p class="structure"></p><h3></h3><p class="blurb"></p>';
    body.querySelector('h3').textContent = d.name;
    body.querySelector('.structure').textContent = `Story · ${s.name}`;
    body.querySelector('.blurb').textContent = d.blurb;
    card.append(body);
    const foot = document.createElement('div');
    foot.className = 'card-foot';
    const count = Object.assign(document.createElement('span'), { className: 'count', textContent: `${slides.length} slides` });
    const open = Object.assign(document.createElement('button'), { type: 'button', className: 'btn btn-primary', innerHTML: 'Open <span class="arrow" aria-hidden="true">→</span>' });
    open.setAttribute('aria-label', `Open ${d.name}`);
    open.addEventListener('click', () => openDetail(i, true));
    foot.append(count, open);
    card.append(foot);
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
    $('detail-meta').textContent = `Story: ${s.name}. ${s.blurb} ${slides.length} slides.`;
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
      cap.querySelector('b').textContent = String(n + 1).padStart(2, '0');
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
