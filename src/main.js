// App controller: input → three directions → detail view.

import { OCCASIONS } from './library/occasions.js';
import { buildDirections } from './engine/build.js';
import { renderSlide } from './render/html.js';
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
  family: 'poster',
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
  $('pictures').addEventListener('change', onPictures);
  $('clear-pictures').addEventListener('click', () => { state.uploads = []; $('pictures').value = ''; renderThumbs(); if (!$('results').hidden) generate(); });
  $('present').addEventListener('click', () => startPresenting(state.decks[state.openIndex]));
  $('p-next').addEventListener('click', () => step(1));
  $('p-prev').addEventListener('click', () => step(-1));
  $('p-close').addEventListener('click', stopPresenting);
  $('stage').addEventListener('click', (e) => step(e.clientX < window.innerWidth / 3 ? -1 : 1));
  document.addEventListener('keydown', onKey);
  syncToggles();
}

// ---------- pictures ----------

async function onPictures(e) {
  const files = [...e.target.files].filter((f) => f.type.startsWith('image/'));
  for (const f of files) {
    try { state.uploads.push(await shrink(f)); } catch { /* unreadable file: skip it */ }
  }
  renderThumbs();
  if (!$('results').hidden) generate();
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

// ---------- presenting ----------

function startPresenting(deck) {
  if (!deck) return;
  state.present = { deck, index: 0, opener: document.activeElement };
  $('presenter').hidden = false;
  document.body.style.overflow = 'hidden';
  $('presenter').requestFullscreen?.().catch(() => {});
  showSlide();
  $('p-next').focus();
}

function showSlide() {
  const { deck, index } = state.present;
  const sl = deck.slides[index];
  $('stage').replaceChildren(renderSlide(sl.els, { present: true, label: `Slide ${index + 1} of ${deck.slides.length}: ${FORM_LABELS[sl.form]}` }));
  $('p-count').textContent = `${index + 1} / ${deck.slides.length}`;
  $('p-prev').disabled = index === 0;
  $('p-next').disabled = index === deck.slides.length - 1;
}

function step(d) {
  if (!state.present) return;
  const n = state.present.index + d;
  if (n < 0 || n >= state.present.deck.slides.length) return;
  state.present.index = n;
  showSlide();
}

function stopPresenting() {
  if (!state.present) return;
  const opener = state.present.opener;
  state.present = null;
  $('presenter').hidden = true;
  document.body.style.overflow = '';
  if (document.fullscreenElement) document.exitFullscreen?.().catch(() => {});
  opener?.focus?.();
}

function onKey(e) {
  if (!state.present) return;
  if (['ArrowRight', 'PageDown', ' '].includes(e.key)) { e.preventDefault(); step(1); }
  else if (['ArrowLeft', 'PageUp'].includes(e.key)) { e.preventDefault(); step(-1); }
  else if (e.key === 'Escape') stopPresenting();
}

function renderOccasions() {
  const box = $('occasions');
  for (const o of OCCASIONS) {
    const label = document.createElement('label');
    label.className = 'occasion';
    const input = Object.assign(document.createElement('input'), { type: 'radio', name: 'occasion', value: o.id, checked: o.id === state.occasionId });
    input.addEventListener('change', () => { state.occasionId = o.id; });
    const span = document.createElement('span');
    span.innerHTML = `${STUDENT_OCCASIONS.has(o.id) ? '<em class="tag">For students</em>' : ''}<strong></strong><small></small>`;
    span.querySelector('strong').textContent = o.name;
    span.querySelector('small').textContent = o.hint;
    label.append(input, span);
    box.append(label);
  }
}

function syncToggles() {
  document.querySelectorAll('[data-density]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.density === state.density)));
  document.querySelectorAll('[data-formality]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.formality === state.formality)));
  document.querySelectorAll('[data-family]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.family === state.family)));
}

function generate(scroll = false) {
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
  $('results').hidden = false;
  $('status').textContent = `Three directions ready: ${state.decks.map((d) => d.direction.name).join(', ')}.`;
  if (scroll) $('results').scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
}

function renderCards() {
  const box = $('cards');
  box.replaceChildren();
  state.decks.forEach((deck, i) => {
    const card = document.createElement('article');
    card.className = 'card';
    const { direction: d, structure: s, slides } = deck;
    card.append(renderSlide(slides[0].els, { label: `Cover slide in the ${d.name} direction` }));
    const body = document.createElement('div');
    body.className = 'card-body';
    body.innerHTML = '<h3></h3><p class="structure"></p><p class="blurb"></p><p class="blurb story"></p>';
    body.querySelector('h3').textContent = d.name;
    body.querySelector('.structure').textContent = `Story: ${s.name}`;
    body.querySelector('.blurb').textContent = d.blurb;
    body.querySelector('.story').textContent = s.blurb;
    card.append(body);
    const strip = document.createElement('div');
    strip.className = 'strip';
    strip.setAttribute('aria-hidden', 'true');
    pickPreview(slides).forEach((sl) => strip.append(renderSlide(sl.els)));
    card.append(strip);
    const foot = document.createElement('div');
    foot.className = 'card-foot';
    const count = Object.assign(document.createElement('span'), { className: 'count', textContent: `${slides.length} slides` });
    const open = Object.assign(document.createElement('button'), { type: 'button', className: 'btn btn-secondary', textContent: 'See all slides' });
    open.setAttribute('aria-label', `See all slides of ${d.name}`);
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

function openDetail(i, focus) {
  state.openIndex = i;
  const deck = state.decks[i];
  const { direction: d, structure: s, slides, overflow } = deck;
  $('detail-title').textContent = d.name;
  $('detail-meta').textContent = `Story: ${s.name}. ${s.blurb} ${slides.length} slides.`;
  const check = $('detail-check');
  check.textContent = overflow.length
    ? `Check: ${overflow.length} text box(es) may be too full (marked with a dashed outline).`
    : 'Check: all text fits its boxes.';
  check.classList.toggle('warn', overflow.length > 0);
  const list = $('slide-list');
  list.replaceChildren();
  slides.forEach((sl, n) => {
    const li = document.createElement('li');
    const cap = document.createElement('p');
    cap.className = 'slide-caption';
    cap.innerHTML = '<b></b><span></span>';
    cap.querySelector('b').textContent = String(n + 1).padStart(2, '0');
    cap.querySelector('span').textContent = FORM_LABELS[sl.form] ?? sl.form;
    li.append(renderSlide(sl.els, { label: `Slide ${n + 1}: ${FORM_LABELS[sl.form]}` }), cap);
    list.append(li);
  });
  $('results').hidden = true;
  $('input-form').hidden = true;
  document.querySelector('.intro').hidden = true;
  $('detail').hidden = false;
  if (focus) { window.scrollTo(0, 0); $('detail-title').setAttribute('tabindex', '-1'); $('detail-title').focus(); }
}

function closeDetail() {
  const i = state.openIndex;
  state.openIndex = null;
  $('detail').hidden = true;
  $('results').hidden = false;
  $('input-form').hidden = false;
  document.querySelector('.intro').hidden = false;
  const btn = $('cards').querySelectorAll('.card-foot button')[i];
  if (btn) { btn.scrollIntoView({ block: 'center' }); btn.focus(); }
}

init();
