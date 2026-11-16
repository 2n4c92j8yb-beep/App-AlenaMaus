// The art director's contract: what the model is asked to decide once the content is
// written, and how its answer becomes a deck plan the design engine can draw.
//
// Claude makes decisions; code draws. The answer is a small spec (a base direction, an
// optional accent hue, the pieces to show in order, section breaks, loud and quiet
// moments). It never carries coordinates, sizes, fonts or colour codes. toSpec() has the
// final word: it checks the spec against the library's rules, repairs what it can, lists
// every repair in `warnings`, and throws when nothing usable is left (the app then shows
// the sampled directions as before).

import { DIRECTIONS, byId } from '../library/directions.js';
import { FORM_FOR_KIND } from '../library/structures.js';
import { occasionById } from '../library/occasions.js';
import { sampleDirections } from './sampler.js';
import { TELLS, adaptDirection, toHsl, fromHsl } from './match.js';
import { clip } from './content.js';

// Phase 1: only the editorial directions. Glass, Poster and Texture have their own composers.
const FAMILY = 'editorial';
const familyOf = (d) => d.family ?? 'editorial';

const MOMENTS = new Set(['loud', 'quiet']);
export const MAX_PIECES = 60;   // pieces sent to the model
export const MAX_SLIDES = 24;   // content slides in one deck
const MAX_LOUD = 2;
const MAX_POINTS = 2;
const MIN_SLIDES = 3;

// ---------------------------------------------------------------- what the model sees

/** The directions open to the art director for an occasion, without those already shown. */
export function catalogue(occasionId, avoid = []) {
  const occasion = occasionById(occasionId);
  const all = DIRECTIONS.filter((d) => familyOf(d) === FAMILY && (d.suits?.[occasion.id] ?? 0) > 0);
  const open = all.filter((d) => !avoid.includes(d.id));
  return open.length ? open : all; // every direction seen: start over rather than offer nothing
}

const str = (v) => (typeof v === 'string' ? v.replace(/\s+/g, ' ').trim() : '');
const list = (v) => (Array.isArray(v) ? v : []);
const cut = (s, n = 170) => clip(str(s), n);
const join = (parts, sep) => parts.map(str).filter(Boolean).join(sep);

/** One line that tells the model what a piece says (never the picture itself). */
export function excerpt(it) {
  if (typeof it?.excerpt === 'string') return cut(it.excerpt);
  switch (it?.kind) {
    case 'definition': return cut(`${str(it.term)}: ${str(it.text)}`);
    case 'figure': return cut(`${join([it.value, it.label], ' ')}. ${str(it.title)}`);
    case 'pair': return cut(`${str(it.title)} (${join([it.left?.text, it.right?.text], ' → ')})`);
    case 'timeline': return cut(`${str(it.title)} (${list(it.events).length} dated events, ${join([list(it.events)[0]?.date, list(it.events).at(-1)?.date], ' to ')})`);
    case 'steps': return cut(`${str(it.title)} (${list(it.steps).length} steps: ${join(list(it.steps).map((s) => s?.title), '; ')})`);
    case 'comparison': return cut(`${str(it.title)} (${join([it.left?.heading, it.right?.heading], ' against ')})`);
    case 'quote': return cut(`“${str(it.text)}” (${str(it.author)})`);
    case 'points': return cut(`${str(it.title)} (${list(it.points).length} points: ${join(list(it.points).map((p) => p?.head), '; ')})`);
    case 'image': return cut(`Picture. ${join([it.title, it.caption], '. ')}`);
    default: return cut(join([it?.text, it?.note ?? it?.hint], ' Note: '));
  }
}

/**
 * The pool as the art director needs it: ids, kinds, tags, weights and one line of text
 * per piece. No pictures, no sources. Also cleans what a browser sends to the server.
 */
export function briefOf(pool) {
  const known = list(pool?.items)
    .map((it, i) => ({ ...it, id: str(it?.id) || `${str(it?.kind)}-${i}` })) // the same ids as withIds() in edits.js
    .filter((it) => FORM_FOR_KIND[it.kind]);
  const items = [...known.filter((it) => it.kind !== 'sources').slice(0, MAX_PIECES), ...known.filter((it) => it.kind === 'sources').slice(0, 1)]
    .map((it) => ({
      id: it.id.slice(0, 40), kind: it.kind,
      tags: list(it.tags).map((t) => str(t).slice(0, 20)).filter(Boolean).slice(0, 4),
      weight: Math.max(1, Math.min(3, Math.round(Number(it.weight)) || 2)),
      ...(it.kind === 'sources' ? {} : { excerpt: excerpt(it) }),
    }));
  return { title: cut(pool?.title, 90), language: /^[a-z]{2}$/i.test(str(pool?.language)) ? str(pool.language).toLowerCase() : 'en', items };
}

// ---------------------------------------------------------------- prompt

export const SYSTEM_PROMPT = `You are the art director for one student presentation. The content is already written and sorted into pieces, and a design engine draws the slides. You decide what a good human designer would decide for this one deck: which look fits the subject, which pieces make the cut, in what order, where the talk breaks into sections, and where the deck is loud or almost empty. You never write or change content, and you never give coordinates, sizes, fonts or colour codes.

How to decide:
- Start from the topic and the argument, not from a template. Read all the pieces first and find the line of the argument. Then choose.
- direction: the id of the one look whose description fits the subject matter and the occasion. Pick the fitting one, not the safest one.
- accentHue: a whole number from 0 to 359 on the colour wheel (0 red, 30 orange, 60 yellow, 120 green, 180 cyan, 220 blue, 270 violet, 330 pink), or null. Shift the accent only when a colour ties the deck to its topic (green for a botany seminar, rust for the Industrial Revolution). If the look's own accent already suits the topic, answer null. Code keeps the colour readable.
- slides: the pieces you show, in order, each by its id, each at most once. One idea per slide. If a piece is tagged thesis, it belongs in the deck.
- Leave pieces out. Drop what is weak, what repeats another piece and what interrupts the argument, and list those ids in dropped. A deck of 9 strong slides beats a deck of 15 complete ones.
- Rhythm: make it uneven on purpose. Some slides are dense (timeline, steps, comparison, points, definition), some are almost empty (claim, question, quote, figure). Let them alternate irregularly. Never put more than two slides of the same kind in a row, and never use more than two points slides in the whole deck.
- moment: mark one slide, at most two, as "loud": the thing the audience must remember. It works best on a claim. Where it helps, mark a slide "quiet" so the deck can breathe after a dense one. Most slides have no moment.
- Sections: an entry { "section": "Name" } opens a section. Use dividers only when the talk has at least two real sections; a short talk needs none. A section name has two to four plain words in the language of the deck.
- kicker: a small label above a slide's headline, one to three words in the language of the deck ("Thesis", "Objection", "For discussion"). Use few, and none where the slide speaks for itself.
- Pictures (kind image) go where they carry an argument, never as a decoration between every slide.
- The cover and the list of sources are added by code. Do not list them.
- why: one sentence a student would understand, in the language of the deck, that says why this look suits this topic. Talk about the topic, not about design terms.

The deck must look made by a person. These are the tells of machine-made slides, by name: ${TELLS.join(', ')}. The design engine keeps them out of the drawing; keep them out of your decisions too. That means no violet or purple-blue accent unless the topic itself is about it, no deck that is one list after another, no slide kinds in a repeating pattern, and no picture slotted in after every second slide.`;

export const EXAMPLE_SPEC = {
  direction: '',
  accentHue: null,
  why: '',
  slides: [{ id: '', kicker: '', moment: '' }, { section: '' }, { id: '' }],
  dropped: [''],
};

/** The system prompt for the server: the rules plus the JSON shape to answer in. */
export function jsonPrompt() {
  return `${SYSTEM_PROMPT}

Answer with JSON only, no other text, in exactly this shape (moment is "loud", "quiet" or left out; kicker may be left out):
${JSON.stringify(EXAMPLE_SPEC, null, 1)}`;
}

const TONE_WORDS = { formal: 'formal', neutral: 'neutral', relaxed: 'relaxed' };

/** The user message: occasion, tone, the directions on offer and the pieces. `pool` may be a brief. */
export function userPrompt(pool, { occasionId, formality = 'neutral', avoid = [] } = {}) {
  const occasion = occasionById(occasionId);
  const brief = briefOf(pool);
  const looks = catalogue(occasion.id, avoid).map((d) => {
    const hue = Math.round(toHsl(d.colors.accent)?.h ?? 0);
    return `- ${d.id} (${d.name}): ${d.blurb} [${d.tags.tone}, ${d.tags.mode}, ${d.tags.type} type; accent hue ${hue}; fit for this occasion ${d.suits[occasion.id]} of 3]`;
  });
  const pieces = brief.items.filter((it) => it.kind !== 'sources')
    .map((it) => `${it.id} | ${it.kind} | ${it.tags.join(', ') || '-'} | ${it.weight} | ${it.excerpt}`);
  return `Occasion: ${occasion.name} (${occasion.hint})
Tone asked for: ${TONE_WORDS[formality] ?? 'neutral'}
Deck title: ${brief.title}
Language of the deck: ${brief.language}

Directions to choose from:
${looks.join('\n')}

Pieces (id | kind | tags | weight from 1 to 3 | what it says):
${pieces.join('\n')}`;
}

// ---------------------------------------------------------------- checking and repairing

// picture slides alternate between two forms but read as one kind of slide
const groupOf = (kind) => (kind === 'image' ? 'picture' : FORM_FOR_KIND[kind]);
const groupOfEntry = (e) => (e.section !== undefined ? 'section' : groupOf(e.item.kind));
const KIND_WORDS = { claim: 'statement', figure: 'key-figure', pair: 'before/after', steps: 'process', image: 'picture' };
const kindWord = (kind) => KIND_WORDS[kind] ?? kind;

/** Never three slides of one kind in a row: the third moves behind the next different slide, or goes. */
function spreadRuns(entries, warn) {
  const out = [];
  const held = [];
  const third = (e) => out.length >= 2 && groupOfEntry(out.at(-1)) === groupOfEntry(e) && groupOfEntry(out.at(-2)) === groupOfEntry(e);
  for (const e of entries) {
    if (e.section !== undefined) { out.push(e); continue; }
    if (third(e)) { held.push(e); continue; }
    out.push(e);
    for (let k = 0; k < held.length;) {
      if (third(held[k])) { k += 1; continue; }
      const [moved] = held.splice(k, 1);
      out.push(moved);
      warn(`Moved ${moved.item.id} later: it was the third ${kindWord(moved.item.kind)} slide in a row.`);
    }
  }
  for (const e of held) warn(`Left out ${e.item.id}: it was the third ${kindWord(e.item.kind)} slide in a row and no other place was free.`);
  return out;
}

/** Sections without slides go; a single divider adds nothing, so it goes too. */
function tidySections(entries, warn) {
  let out = entries.filter((e, i) => {
    if (e.section === undefined) return true;
    const next = entries[i + 1];
    if (next && next.section === undefined) return true;
    warn(`Removed the section “${e.section}”: no slides followed it.`);
    return false;
  });
  const dividers = out.filter((e) => e.section !== undefined);
  if (dividers.length === 1) {
    warn(`Removed the section “${dividers[0].section}”: a single divider adds nothing.`);
    out = out.filter((e) => e.section === undefined);
  }
  return out;
}

/**
 * Turn the model's answer into a checked spec with a deck plan.
 * Returns { direction, accentHue?, why, slides, dropped, plan, warnings }:
 *   slides    the cleaned spec entries ({ id, kicker?, moment? } or { section })
 *   plan      the slide order in the stored format of edits.js (planOf / resolvePlan),
 *             cover first, the sources slide last
 *   warnings  every repair made, for the evaluation
 * A checked spec passes through unchanged. Throws when too little is left to make a deck.
 */
export function toSpec(answer, pool, { occasionId, formality = 'neutral', avoid = [], seed } = {}) {
  const a = answer && typeof answer === 'object' && !Array.isArray(answer) ? answer : {};
  const warnings = [];
  const warn = (m) => warnings.push(m);
  const brief = briefOf(pool);
  const items = brief.items;
  const occasion = occasionById(occasionId);

  // ---- the direction: one the catalogue offers, or the sampler's first pick
  const allowed = catalogue(occasion.id, list(avoid).map(str));
  const asked = str(a.direction);
  let dir = allowed.find((d) => d.id === asked);
  let hue = a.accentHue === null || a.accentHue === undefined || a.accentHue === '' ? undefined : Math.round(Number(a.accentHue));
  let why = cut(a.why, 220);
  if (!dir) {
    const known = byId(asked);
    dir = sampleDirections({ occasionId: occasion.id, formality, seed: seed ?? brief.title, count: DIRECTIONS.length, minDistance: 0, family: FAMILY }).find((d) => allowed.includes(d)) ?? allowed[0];
    const reason = !asked ? 'No direction was chosen'
      : !known ? `The direction “${asked.slice(0, 40)}” does not exist`
      : familyOf(known) !== FAMILY ? `${known.name} belongs to the ${familyOf(known)} look, which is not open to the art director yet`
      : !(known.suits?.[occasion.id] > 0) ? `${known.name} does not suit this occasion`
      : `${known.name} was already shown`;
    warn(`${reason}; using ${dir.name} instead.`);
    // the colour and the reason were chosen for another look
    hue = undefined;
    why = '';
  }
  if (hue !== undefined && !(Number.isInteger(hue) && hue >= 0 && hue <= 359)) {
    warn('The accent hue was not a number from 0 to 359; the direction keeps its own accent.');
    hue = undefined;
  }

  // ---- the slides: known pieces, each once
  const byItemId = new Map(items.map((it) => [it.id, it]));
  const used = new Set();
  let entries = [];
  for (const s of list(a.slides).slice(0, 80)) {
    const section = typeof s === 'object' && s && !str(s.id) ? clip(str(s.section), 40) : '';
    if (section) { entries.push({ section }); continue; }
    const id = typeof s === 'string' ? str(s) : str(s?.id);
    const item = byItemId.get(id);
    if (!item) { warn(`Left out “${id.slice(0, 40)}”: there is no such piece.`); continue; }
    if (item.kind === 'sources') continue; // added by code, at the end
    if (used.has(id)) { warn(`Left out the second ${id}: every piece is shown once.`); continue; }
    used.add(id);
    const kicker = clip(str(s?.kicker), 32);
    entries.push({ item, ...(kicker ? { kicker } : {}), ...(MOMENTS.has(s?.moment) ? { moment: s.moment } : {}) });
  }

  // ---- the thesis is always in the deck
  const thesis = items.find((it) => it.kind === 'claim' && it.tags.includes('thesis'));
  if (thesis && !used.has(thesis.id)) {
    const first = entries.findIndex((e) => e.section === undefined);
    // after an opening question, otherwise first
    const at = first < 0 ? entries.length : entries[first].item.kind === 'question' ? first + 1 : first;
    entries.splice(at, 0, { item: thesis });
    used.add(thesis.id);
    warn(`Added the thesis (${thesis.id}): it was missing from the deck.`);
  }

  // ---- rhythm
  let points = 0;
  entries = entries.filter((e) => {
    if (e.section !== undefined || e.item.kind !== 'points' || ++points <= MAX_POINTS) return true;
    warn(`Left out ${e.item.id}: a deck has at most ${MAX_POINTS} points slides.`);
    return false;
  });
  const content = () => entries.filter((e) => e.section === undefined);
  if (content().length > MAX_SLIDES) {
    const keep = new Set(content().slice(0, MAX_SLIDES));
    warn(`Left out ${content().length - MAX_SLIDES} slides at the end: a deck has at most ${MAX_SLIDES}.`);
    entries = entries.filter((e) => e.section !== undefined || keep.has(e));
  }
  // removing a divider can close a gap between two slides of one kind, so repeat until stable
  for (let pass = 0; pass < 4; pass++) {
    const before = entries.length;
    entries = spreadRuns(tidySections(entries, warn), warn);
    if (entries.length === before) break;
  }
  let loud = 0;
  entries = entries.map((e) => {
    if (e.moment !== 'loud' || ++loud <= MAX_LOUD) return e;
    warn(`${e.item.id} is no longer loud: a deck has at most ${MAX_LOUD} loud moments.`);
    const { moment, ...rest } = e;
    return rest;
  });

  if (content().length < MIN_SLIDES) throw new Error('The art director’s answer has too few usable slides.');

  // ---- the plan, in the stored format of edits.js
  const shown = new Set(content().map((e) => e.item.id));
  const plan = [{ form: 'cover', sectionNo: 0 }];
  let sectionNo = 0;
  let photos = 0;
  for (const e of entries) {
    if (e.section !== undefined) { sectionNo += 1; plan.push({ form: 'section', item: { number: sectionNo, label: e.section }, sectionNo }); continue; }
    // pictures alternate between full-screen and half-screen slides, as in assembleDeck()
    const form = e.item.kind === 'image' ? (photos++ % 2 === 0 ? 'photo' : 'photoSplit') : FORM_FOR_KIND[e.item.kind];
    plan.push({ form, id: e.item.id, ...(e.kicker ? { kicker: e.kicker } : {}), ...(e.moment ? { moment: e.moment } : {}), sectionNo });
  }
  const sources = items.find((it) => it.kind === 'sources');
  if (sources) plan.push({ form: FORM_FOR_KIND.sources, id: sources.id, sectionNo });

  const dropped = [...new Set(list(a.dropped).map(str))].filter((id) => byItemId.has(id) && !shown.has(id) && byItemId.get(id).kind !== 'sources');

  return {
    direction: dir.id,
    ...(hue !== undefined ? { accentHue: hue } : {}),
    why,
    slides: entries.map((e) => (e.section !== undefined ? { section: e.section } : { id: e.item.id, ...(e.kicker ? { kicker: e.kicker } : {}), ...(e.moment ? { moment: e.moment } : {}) })),
    dropped,
    plan,
    warnings,
  };
}

// ---------------------------------------------------------------- the direction a spec asks for

const hueGap = (x, y) => { const d = Math.abs(x - y) % 360; return d > 180 ? 360 - d : d; };

/**
 * The spec's base direction with its accent moved to the chosen hue. adaptDirection()
 * keeps type, layout, background and ink, and holds the accent at 3:1 against the
 * background. Returns null for a direction the art director may not use.
 */
export function directionFor(spec) {
  const dir = byId(str(spec?.direction));
  if (!dir || familyOf(dir) !== FAMILY) return null;
  const hue = spec.accentHue;
  const own = toHsl(dir.colors.accent);
  if (!Number.isInteger(hue) || hue < 0 || hue > 359 || !own || hueGap(hue, own.h) < 10) return dir;
  const adapted = adaptDirection(dir, { colors: { accent: fromHsl({ h: hue, s: Math.max(0.5, own.s), l: 0.5 }) } });
  if (adapted === dir) return dir;
  // a text or on-accent colour tuned to the old accent no longer belongs to it; the layout derives new ones
  const { accentText, onAccent, ...colors } = adapted.colors;
  return { ...adapted, colors };
}
