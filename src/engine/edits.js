// Editing a generated deck. People change content, never positions: the design
// engine lays every edited slide out again in the chosen direction, so edited
// slides stay on-design and the PowerPoint export and Present mode simply use them.
//
// Two kinds of edits, kept in one plain object that is saved on the device:
//   items  edited content, by item id: follows the content into every direction
//   cover  title, subtitle, author, course, date
//   plans  the slide order of one deck (direction + story + density), after a slide
//          was moved, deleted, duplicated or added; other decks keep their own order

import { buildDeck } from './build.js';

export const emptyEdits = () => ({ v: 1, items: {}, cover: {}, plans: {}, next: 1 });

/** Every item gets a stable id (its kind and position in the pool) unless it has one. */
export function withIds(pool) {
  if (!pool?.items) return pool;
  if (pool.items.every((it) => it.id)) return pool;
  return { ...pool, items: pool.items.map((it, i) => (it.id ? it : { ...it, id: `${it.kind}-${i}` })) };
}

const COVER_FIELDS = ['title', 'subtitle', 'author', 'course', 'date'];

/** The pool with edited content and cover fields in place. Added slides' items stay out: only their deck shows them. */
export function applyEdits(pool, edits) {
  const p = withIds(pool);
  if (!edits) return p;
  const cover = Object.fromEntries(COVER_FIELDS.filter((k) => typeof edits.cover?.[k] === 'string').map((k) => [k, edits.cover[k]]));
  return { ...p, ...cover, items: p.items.map((it) => (edits.items[it.id] ? { ...edits.items[it.id], id: it.id } : it)) };
}

export const deckKey = (deck) => `${deck.direction.id}|${deck.structure.id}|${deck.density}`;

/** A deck's slide order as stored data: item ids where there is an item, the section label otherwise. */
export function planOf(deck) {
  return deck.slides.map((s) => ({
    form: s.form,
    ...(s.item?.id ? { id: s.item.id } : s.item ? { item: { ...s.item } } : {}),
    ...(s.kicker ? { kicker: s.kicker } : {}),
    sectionNo: s.sectionNo ?? 0,
  }));
}

/** Stored order back to slides, with today's content; entries whose item is gone are dropped. */
export function resolvePlan(plan, pool, edits) {
  const byId = new Map(withIds(pool).items.map((it) => [it.id, it]));
  const find = (id) => (edits?.items?.[id] ? { ...edits.items[id], id } : byId.get(id));
  return plan
    .map((e) => (e.id ? (find(e.id) ? { form: e.form, item: find(e.id), kicker: e.kicker, sectionNo: e.sectionNo } : null) : { form: e.form, ...(e.item ? { item: e.item } : {}), kicker: e.kicker, sectionNo: e.sectionNo }))
    .filter(Boolean);
}

/** Decks with their stored slide order (if any) laid out again. */
export function applyPlans(decks, pool, edits) {
  return decks.map((deck) => {
    const plan = edits?.plans?.[deckKey(deck)];
    if (!plan) return deck;
    return { ...buildDeck({ deck: deck.deck, direction: deck.direction, structure: deck.structure, density: deck.density, plan: resolvePlan(plan, pool, edits) }), edited: true };
  });
}

/** Whether a deck shows any edit: its own order, the cover, or edited content. */
export function isEdited(deck, edits) {
  if (!edits) return false;
  if (edits.plans[deckKey(deck)] || COVER_FIELDS.some((k) => typeof edits.cover[k] === 'string')) return true;
  return deck.slides.some((s) => s.item?.id && edits.items[s.item.id]);
}

// ---------------------------------------------------------------- changes (each returns new edits)

const clone = (x) => JSON.parse(JSON.stringify(x));

export function setItem(edits, id, item) {
  const e = clone(edits);
  e.items[id] = { ...clone(item), id };
  return e;
}

export function setCover(edits, fields) {
  const e = clone(edits);
  for (const k of COVER_FIELDS) if (typeof fields[k] === 'string') e.cover[k] = fields[k];
  return e;
}

/** A section slide's label lives in the deck's order; change it there. */
export function setSection(edits, deck, index, label) {
  const e = clone(edits);
  const key = deckKey(deck);
  const plan = e.plans[key] ?? planOf(deck);
  plan[index] = { ...plan[index], item: { ...plan[index].item, label } };
  e.plans[key] = plan;
  return e;
}

function withPlan(edits, deck, change) {
  const e = clone(edits);
  const key = deckKey(deck);
  const plan = e.plans[key] ? [...e.plans[key]] : planOf(deck);
  change(plan, e);
  e.plans[key] = plan;
  return e;
}

/** Move a slide one place up (-1) or down (+1); the cover stays first. */
export const moveSlide = (edits, deck, index, by) => withPlan(edits, deck, (plan) => {
  const to = index + by;
  if (index < 1 || to < 1 || to >= plan.length) return;
  [plan[index], plan[to]] = [plan[to], plan[index]];
});

export const deleteSlide = (edits, deck, index) => withPlan(edits, deck, (plan) => {
  if (index >= 1 && plan.length > 2) plan.splice(index, 1);
});

/** A copy right after the slide, with its own content, so the two can be edited apart. */
export const duplicateSlide = (edits, deck, index) => withPlan(edits, deck, (plan, e) => {
  if (index < 1) return;
  const entry = plan[index];
  const item = entry.id ? (e.items[entry.id] ?? deck.slides[index]?.item) : null;
  if (item) {
    const id = `new-${e.next++}`;
    e.items[id] = { ...clone(item), id, added: true };
    plan.splice(index + 1, 0, { ...entry, id });
  } else plan.splice(index + 1, 0, clone(entry));
});

/** Add a slide after `index`: an unused item from the pool (`{id}`) or an empty one of a kind (`{kind}`). */
export const addSlide = (edits, deck, index, what) => withPlan(edits, deck, (plan, e) => {
  let id = what.id;
  let kind = what.kind;
  if (!id) {
    id = `new-${e.next++}`;
    e.items[id] = { ...emptyItem(kind), id, added: true };
  } else kind = what.itemKind ?? deck.deck.items.find((it) => it.id === id)?.kind;
  plan.splice(Math.min(index + 1, plan.length), 0, { form: FORM_OF[kind] ?? 'statement', id, sectionNo: plan[index]?.sectionNo ?? 0 });
});

/** Pool content this deck does not show, for "Add slide". */
export function unusedItems(deck) {
  const used = new Set(deck.slides.map((s) => s.item?.id).filter(Boolean));
  return withIds(deck.deck).items.filter((it) => !used.has(it.id) && it.kind !== 'sources');
}

// ---------------------------------------------------------------- what each slide lets you edit

export const FORM_OF = { claim: 'statement', definition: 'definition', figure: 'bigNumber', pair: 'pair', timeline: 'timeline', steps: 'process', comparison: 'comparison', quote: 'quote', question: 'question', points: 'points', sources: 'references', image: 'photo' };

// type: line (one line), text (a few lines), list (repeatable rows), strings (a list of lines)
// max: a guide for the counter, not a hard stop; the layout says whether it fits
export const SCHEMAS = {
  cover: { name: 'Cover', fields: [
    { k: 'title', label: 'Title', type: 'text', max: 80 }, { k: 'subtitle', label: 'Subtitle', type: 'line', max: 90 },
    { k: 'author', label: 'Author', type: 'line', max: 60 }, { k: 'course', label: 'Course', type: 'line', max: 80 }, { k: 'date', label: 'Date', type: 'line', max: 40 },
  ] },
  section: { name: 'Section', fields: [{ k: 'label', label: 'Section name', type: 'line', max: 40 }] },
  claim: { name: 'Statement', fields: [{ k: 'text', label: 'Statement', type: 'text', max: 180 }, { k: 'note', label: 'Note', type: 'text', max: 160, optional: true }] },
  definition: { name: 'Definition', fields: [
    { k: 'term', label: 'Term', type: 'line', max: 60 }, { k: 'gloss', label: 'Short gloss', type: 'line', max: 60, optional: true }, { k: 'text', label: 'Definition', type: 'text', max: 220 },
  ] },
  figure: { name: 'Key figure', fields: [
    { k: 'title', label: 'Headline', type: 'text', max: 110 }, { k: 'value', label: 'Number', type: 'line', max: 12 }, { k: 'label', label: 'What the number counts', type: 'line', max: 80 },
    { k: 'caption', label: 'Caption', type: 'text', max: 200, optional: true }, { k: 'source', label: 'Source', type: 'line', max: 120, optional: true },
  ] },
  pair: { name: 'Before / after', fields: [
    { k: 'title', label: 'Headline', type: 'text', max: 110 }, { k: 'word', label: 'Example word', type: 'line', max: 30, optional: true },
    { k: 'left.text', label: 'Before', type: 'line', max: 24 }, { k: 'left.label', label: 'Before: label', type: 'line', max: 30 },
    { k: 'right.text', label: 'After', type: 'line', max: 24 }, { k: 'right.label', label: 'After: label', type: 'line', max: 30 },
    { k: 'caption', label: 'Caption', type: 'text', max: 200, optional: true },
  ] },
  timeline: { name: 'Timeline', fields: [
    { k: 'title', label: 'Headline', type: 'text', max: 110 },
    { k: 'events', label: 'Events', type: 'list', min: 3, max: 8, row: [{ k: 'date', label: 'Date', type: 'line', max: 14 }, { k: 'label', label: 'Event', type: 'line', max: 80 }], blank: { date: '', label: '' } },
  ] },
  steps: { name: 'Process', fields: [
    { k: 'title', label: 'Headline', type: 'text', max: 110 },
    { k: 'steps', label: 'Steps', type: 'list', min: 2, max: 5, row: [{ k: 'title', label: 'Step', type: 'line', max: 60 }, { k: 'text', label: 'Explanation', type: 'text', max: 150, optional: true }], blank: { title: '', text: '' } },
  ] },
  comparison: { name: 'Comparison', fields: [
    { k: 'title', label: 'Headline', type: 'text', max: 110 },
    { k: 'left.heading', label: 'Left side', type: 'line', max: 40 }, { k: 'left.points', label: 'Left points', type: 'strings', min: 1, max: 12, itemMax: 90 },
    { k: 'right.heading', label: 'Right side', type: 'line', max: 40 }, { k: 'right.points', label: 'Right points', type: 'strings', min: 1, max: 12, itemMax: 90 },
    { k: 'verdict', label: 'Conclusion', type: 'text', max: 150, optional: true },
  ] },
  quote: { name: 'Quote', fields: [
    { k: 'text', label: 'Quote', type: 'text', max: 300 }, { k: 'author', label: 'Author', type: 'line', max: 60 },
    { k: 'work', label: 'Work', type: 'line', max: 80, optional: true }, { k: 'note', label: 'Note', type: 'text', max: 160, optional: true },
  ] },
  question: { name: 'Question', fields: [{ k: 'text', label: 'Question', type: 'text', max: 160 }, { k: 'hint', label: 'Hint', type: 'line', max: 120, optional: true }] },
  points: { name: 'Points', fields: [
    { k: 'title', label: 'Headline', type: 'text', max: 110 },
    { k: 'points', label: 'Points', type: 'list', min: 1, max: 20, row: [{ k: 'head', label: 'Point', type: 'line', max: 70 }, { k: 'text', label: 'Detail', type: 'text', max: 110, optional: true }], blank: { head: '', text: '' } },
  ] },
  sources: { name: 'Works cited', fields: [{ k: 'title', label: 'Heading', type: 'line', max: 40 }, { k: 'entries', label: 'Sources (MLA)', type: 'strings', min: 1, max: 12, itemMax: 300, multiline: true }] },
  image: { name: 'Picture', picture: true, fields: [{ k: 'title', label: 'Headline', type: 'text', max: 110 }, { k: 'caption', label: 'Caption', type: 'text', max: 200, optional: true }] },
};

/** Which schema a slide uses. */
export const schemaFor = (slide) => (slide.form === 'cover' ? SCHEMAS.cover : slide.form === 'section' ? SCHEMAS.section : SCHEMAS[slide.item?.kind]);

/** Starting content for a new, empty slide of a kind. */
export function emptyItem(kind) {
  const base = { kind, weight: 2, tags: [] };
  switch (kind) {
    case 'points': return { ...base, title: 'New list', points: [{ head: 'First point' }, { head: 'Second point' }, { head: 'Third point' }] };
    case 'question': return { ...base, text: 'Your question?' };
    case 'quote': return { ...base, text: 'The quotation, word for word.', author: 'Author' };
    case 'figure': return { ...base, title: 'What the number shows', value: '100', label: 'what it counts' };
    case 'steps': return { ...base, title: 'Step by step', steps: [{ title: 'First step' }, { title: 'Second step' }, { title: 'Third step' }] };
    default: return { ...base, kind: 'claim', text: 'Your statement.' };
  }
}
export const NEW_KINDS = [['claim', 'Statement'], ['points', 'Points'], ['question', 'Question'], ['quote', 'Quote'], ['figure', 'Key figure'], ['steps', 'Process']];

// ---------------------------------------------------------------- reading and writing fields by path

export const getPath = (obj, path) => path.split('.').reduce((o, k) => (o == null ? undefined : o[k]), obj);
export function setPath(obj, path, value) {
  const out = clone(obj);
  const keys = path.split('.');
  let o = out;
  keys.slice(0, -1).forEach((k) => { o[k] = o[k] && typeof o[k] === 'object' ? o[k] : {}; o = o[k]; });
  o[keys.at(-1)] = value;
  return out;
}
