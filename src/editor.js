// The slide editor: a panel with the fields of one slide and a live preview that the
// design engine lays out again on every keystroke (src/engine/edits.js has the schemas).
// Beside the slides on wide screens, a sheet from the bottom on phones.

import { layoutSlide } from './library/forms.js';
import { renderSlide } from './render/html.js';
import { schemaFor, getPath, setPath, SCHEMAS, NEW_KINDS } from './engine/edits.js';

const $ = (id) => document.getElementById(id);
const clone = (x) => JSON.parse(JSON.stringify(x ?? null));
let session = null; // { close } of the open panel

/**
 * Open the editor for slide `index` of `deck`.
 * `onDone(change)` gets { type: 'cover', fields } | { type: 'section', label } | { type: 'item', id, item }.
 * `pickPicture()` resolves { src, w, h, name } for a replaced picture (or null).
 */
export function openSlideEditor({ deck, index, onDone, pickPicture, opener }) {
  close();
  const slide = deck.slides[index];
  const schema = schemaFor(slide);
  if (!schema) return;
  const isCover = slide.form === 'cover';
  const isSection = slide.form === 'section';
  // the content being edited: cover fields from the deck, otherwise the slide's item
  let draft = isCover ? Object.fromEntries(schema.fields.map((f) => [f.k, deck.deck[f.k] ?? ''])) : clone(slide.item);
  const original = JSON.stringify(draft);

  const panel = $('editor');
  $('editor-title').textContent = `Edit slide ${index + 1}: ${schema.name}`;
  $('editor-add').hidden = true;
  $('editor-form').hidden = false;
  $('editor-done').hidden = false;
  const fields = $('editor-fields');
  const preview = $('editor-preview');
  const fit = $('editor-fit');

  let frame = 0;
  const paint = () => {
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(() => {
      const data = isCover ? { ...deck.deck, ...draft } : deck.deck;
      const els = layoutSlide(deck.direction, data, isCover ? slide : { ...slide, item: draft }, index, deck.slides.length, deck.density);
      preview.replaceChildren(renderSlide(els, { label: `Preview of slide ${index + 1}` }));
      const full = els.filter((e) => e.type === 'text' && !e.fits && !e.bleed);
      fit.hidden = full.length === 0;
      fit.textContent = full.length ? `Too much text for this slide: “${full[0].text.slice(0, 40)}${full[0].text.length > 40 ? '…' : ''}” doesn’t fit. Shorten it, or the slide shows it cut off.` : '';
    });
  };

  const render = () => {
    // every change is a function of the current draft, so fields never undo each other
    const change = (fn, rebuild) => { draft = fn(draft); if (rebuild) render(); paint(); };
    fields.replaceChildren(...schema.fields.map((f) => fieldFor(f, () => draft, change)));
    if (schema.picture) fields.append(pictureControl(() => draft, pickPicture, change));
  };
  render();
  paint();

  const finish = (save) => {
    close();
    if (save && JSON.stringify(draft) !== original) {
      onDone(isCover ? { type: 'cover', fields: draft } : isSection ? { type: 'section', label: draft.label } : { type: 'item', id: slide.item.id, item: draft });
    }
  };
  open(panel, opener, () => finish(false));
  $('editor-done').onclick = () => finish(true);
  $('editor-cancel').onclick = () => finish(false);
  fields.querySelector('input, textarea')?.focus();
}

/** Choose what to add after slide `index`: unused content of this deck, or an empty slide. */
export function openAddPicker({ deck, index, unused, onPick, opener }) {
  close();
  const panel = $('editor');
  $('editor-title').textContent = `Add a slide after slide ${index + 1}`;
  $('editor-form').hidden = true;
  $('editor-done').hidden = true;
  const box = $('editor-add');
  box.hidden = false;
  const section = (title, rows) => {
    const wrap = document.createElement('div');
    wrap.className = 'add-group';
    const h = Object.assign(document.createElement('h4'), { textContent: title });
    const ul = document.createElement('ul');
    ul.append(...rows.map(([label, sub, pick]) => {
      const li = document.createElement('li');
      const b = Object.assign(document.createElement('button'), { type: 'button', className: 'add-option' });
      b.append(Object.assign(document.createElement('b'), { textContent: label }), Object.assign(document.createElement('span'), { textContent: sub }));
      b.addEventListener('click', () => { close(); onPick(pick); });
      li.append(b);
      return li;
    }));
    wrap.append(h, ul);
    return wrap;
  };
  const groups = [];
  if (unused.length) {
    groups.push(section('Content Claude wrote that this direction doesn’t use', unused.map((it) => [SCHEMAS[it.kind]?.name ?? it.kind, excerpt(it), { id: it.id, itemKind: it.kind }])));
  }
  groups.push(section('An empty slide', NEW_KINDS.map(([kind, name]) => [name, 'Start with placeholder text and fill it in', { kind }])));
  box.replaceChildren(...groups);
  open(panel, opener, close);
  box.querySelector('button')?.focus();
}

const excerpt = (it) => {
  const s = it.title ?? it.text ?? it.term ?? '';
  return s.length > 90 ? `${s.slice(0, 89)}…` : s;
};

// ---------------------------------------------------------------- panel open / close

function open(panel, opener, onEscape) {
  panel.hidden = false;
  document.body.classList.add('is-editing');
  const onKey = (e) => { if (e.key === 'Escape') { e.preventDefault(); onEscape(); } };
  document.addEventListener('keydown', onKey);
  $('editor-close').onclick = onEscape;
  session = {
    close() {
      document.removeEventListener('keydown', onKey);
      panel.hidden = true;
      document.body.classList.remove('is-editing');
      if (opener?.isConnected) opener.focus({ preventScroll: true });
    },
  };
}

export function close() {
  const s = session;
  session = null;
  s?.close();
}

export const isOpen = () => Boolean(session);

// ---------------------------------------------------------------- fields

let uid = 0;
const nextId = () => `ef-${++uid}`;

/** One labelled input or textarea with a character guide. */
function input(label, value, { type, max, optional }, onInput) {
  const id = nextId();
  const wrap = document.createElement('div');
  wrap.className = 'ef';
  const lab = Object.assign(document.createElement('label'), { htmlFor: id, textContent: optional ? `${label} (optional)` : label });
  const el = document.createElement(type === 'line' ? 'input' : 'textarea');
  el.id = id;
  if (type === 'line') el.type = 'text';
  else el.rows = 2;
  el.value = value ?? '';
  el.spellcheck = true;
  const count = document.createElement('span');
  count.className = 'ef-count';
  const update = () => {
    const n = el.value.length;
    count.textContent = max ? `${n} / ${max}` : '';
    count.classList.toggle('is-over', Boolean(max) && n > max);
  };
  el.addEventListener('input', () => { update(); onInput(el.value); });
  wrap.append(lab, el, count);
  requestAnimationFrame(update);
  return wrap;
}

function fieldFor(f, current, change) {
  if (f.type === 'line' || f.type === 'text') return input(f.label, getPath(current(), f.k), f, (v) => change((d) => setPath(d, f.k, v)));
  const rows = clone(getPath(current(), f.k)) ?? [];
  const box = document.createElement('fieldset');
  box.className = 'ef-list';
  box.append(Object.assign(document.createElement('legend'), { textContent: f.label }));
  const commit = (next, rebuild) => change((d) => setPath(d, f.k, next), rebuild);
  rows.forEach((row, i) => {
    const r = document.createElement('div');
    r.className = 'ef-row';
    const head = document.createElement('div');
    head.className = 'ef-row-head';
    head.append(Object.assign(document.createElement('span'), { textContent: `${f.type === 'strings' ? 'Line' : f.row[0].label} ${i + 1}` }));
    const tools = document.createElement('div');
    tools.className = 'ef-tools';
    const tool = (text, label, disabled, fn) => {
      const b = Object.assign(document.createElement('button'), { type: 'button', className: 'icon-btn', textContent: text, disabled });
      b.setAttribute('aria-label', `${label} ${i + 1}`);
      b.addEventListener('click', fn);
      tools.append(b);
    };
    tool('↑', 'Move up', i === 0, () => { const n = clone(rows); [n[i - 1], n[i]] = [n[i], n[i - 1]]; commit(n, true); });
    tool('↓', 'Move down', i === rows.length - 1, () => { const n = clone(rows); [n[i + 1], n[i]] = [n[i], n[i + 1]]; commit(n, true); });
    tool('×', 'Remove', rows.length <= (f.min ?? 0), () => { const n = clone(rows); n.splice(i, 1); commit(n, true); });
    head.append(tools);
    r.append(head);
    if (f.type === 'strings') {
      r.append(input('Text', row, { type: f.multiline ? 'text' : 'line', max: f.itemMax }, (v) => { rows[i] = v; commit(clone(rows)); }));
    } else {
      for (const sub of f.row) r.append(input(sub.label, row?.[sub.k], sub, (v) => { rows[i] = { ...rows[i], [sub.k]: v }; commit(clone(rows)); }));
    }
    box.append(r);
  });
  if (rows.length < (f.max ?? Infinity)) {
    const add = Object.assign(document.createElement('button'), { type: 'button', className: 'btn btn-link ef-add', textContent: `+ Add ${f.type === 'strings' ? 'line' : f.row[0].label.toLowerCase()}` });
    add.addEventListener('click', () => commit([...rows, f.type === 'strings' ? '' : clone(f.blank)], true));
    box.append(add);
  }
  return box;
}

function pictureControl(current, pickPicture, change) {
  const draft = current();
  const wrap = document.createElement('div');
  wrap.className = 'ef ef-picture';
  const img = Object.assign(document.createElement('img'), { src: draft.src, alt: '' });
  const b = Object.assign(document.createElement('button'), { type: 'button', className: 'btn btn-secondary', textContent: 'Replace picture' });
  const note = Object.assign(document.createElement('p'), { className: 'field-help', textContent: draft.credit ? `Credit: ${draft.credit}` : '' });
  b.addEventListener('click', async () => {
    const pic = await pickPicture();
    if (!pic) return;
    img.src = pic.src;
    note.textContent = 'Credit: Your own picture';
    change((d) => {
      const next = { ...d, src: pic.src, w: pic.w, h: pic.h, alt: pic.name, credit: 'Your own picture' };
      delete next.citation;
      delete next.base;
      return next;
    });
  });
  wrap.append(img, b, note);
  return wrap;
}
