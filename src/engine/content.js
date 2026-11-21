// The writing step's contract: what the model is asked for, and how its answer
// becomes a content pool the design engine can lay out (the same shape as
// src/sample/great-vowel-shift.js). Shared by the server function (api/generate.js)
// and the copy-paste fallback in the browser, so both paths are checked the same way.
//
// The model writes content only. Layout, type, colour and slide order come from the
// curated library, which is what keeps decks from looking generated.

import { t } from '../library/labels.js';

// ---------------------------------------------------------------- prompt

export const SYSTEM_PROMPT = `You turn a student's notes into the content of a presentation. A separate design engine lays the content out, so you only write words, sorted into slide-sized pieces.

How to write:
- Write in the language of the notes.
- Headlines are statements that say what the slide shows ("Printing fixed spelling while speech kept changing"), not topic labels ("Printing").
- Use only facts, numbers, quotes, names and sources that appear in the notes. Never invent a statistic, a quotation, a date or a source. If the notes don't contain something a piece needs, leave that piece out (an empty list is fine).
- Keep every piece short enough for a slide: headlines up to 12 words, claims up to 30 words, captions and notes up to 35 words, list items up to 15 words.
- Keep phonetic transcriptions, formulas and quoted wording exactly as written in the notes.
- Sources: one entry per source named in the notes, formatted in MLA style as far as the notes allow. No invented details.

What to produce:
- deck: language (the two-letter code of the notes' language, e.g. "en" or "de"), title (a statement, up to 10 words), shortTitle (2 to 4 words, the topic), subtitle, author, course, date (empty strings if the notes don't say), worksCitedTitle (the usual heading for a list of sources in the notes' language, e.g. "Works Cited" or "Literaturverzeichnis"), posterWords (three single strong words from the topic), posterLines (up to five short facts of 2 to 5 words each, for small labels), placeShort (a place connected to the topic, or empty).
- claims: the thesis (role "thesis", exactly one), background facts (role "context"), counter-arguments (role "counter"), the takeaway (role "takeaway"), other claims (role "claim").
- definitions, figures (only numbers that appear in the notes), pairs (before/after or two forms of one thing), timelines (dated events in order), processes (steps in order), comparisons (two sides with up to three points each), quotes (exact wording from the notes), questions (role "hook" to open, "discussion" to close, "task" for an activity), pointLists (three or four parallel points), sources, pictureCaptions (up to three title and caption pairs that could go with pictures the student adds).
- pictures: up to five photos that would make the slides vivid, most important first (the first becomes the cover). For each: search (a short English search term for the photo archive Wikimedia Commons that names one concrete, photographable subject from the notes: a place, building, landscape, object, artwork or historical figure, e.g. "Machu Picchu", "Lake Titicaca", "Ellesmere Chaucer"; never an abstract idea), kind ("landscape", "building", "detail", or "historical" for artworks, manuscripts, portraits and historical objects), title (a headline statement in the language of the notes, saying what the picture shows about the topic), caption (one sentence in the language of the notes, using only facts from the notes). Leave the list empty if the topic has nothing photographable.
- year: the year a piece belongs to, or 0.`;

export const userPrompt = (notes, occasionName) =>
  `Occasion: ${occasionName}\n\nNotes:\n"""\n${notes}\n"""`;

/** The system prompt for the server: the writing rules plus the JSON shape to answer in. */
export function jsonPrompt() {
  return `${SYSTEM_PROMPT}

Answer with JSON only, no other text, in exactly this shape (fill in your content; leave lists empty when the notes don't support them):
${JSON.stringify(EXAMPLE_SHAPE, null, 1)}`;
}

/** The full prompt for the copy-paste fallback (the user runs it in their own Claude). */
export function copyPastePrompt(notes, occasionName) {
  return `${SYSTEM_PROMPT}

Answer with JSON only, no other text, in exactly this shape (fill in your content; leave lists empty when the notes don't support them):
${JSON.stringify(EXAMPLE_SHAPE, null, 1)}

${userPrompt(notes, occasionName)}`;
}

export const EXAMPLE_SHAPE = {
  deck: { language: 'en', title: '', shortTitle: '', subtitle: '', author: '', course: '', date: '', worksCitedTitle: '', posterWords: ['', '', ''], posterLines: [''], placeShort: '' },
  claims: [{ text: '', role: 'thesis', note: '' }],
  definitions: [{ term: '', gloss: '', text: '' }],
  figures: [{ title: '', value: '', label: '', caption: '', source: '', year: 0 }],
  pairs: [{ title: '', word: '', before: { text: '', label: '' }, after: { text: '', label: '' }, caption: '', year: 0 }],
  timelines: [{ title: '', events: [{ date: '', label: '' }], year: 0 }],
  processes: [{ title: '', steps: [{ title: '', text: '' }] }],
  comparisons: [{ title: '', left: { heading: '', points: [''] }, right: { heading: '', points: [''] }, verdict: '' }],
  quotes: [{ text: '', author: '', work: '', note: '', year: 0 }],
  questions: [{ text: '', hint: '', role: 'hook' }],
  pointLists: [{ title: '', points: [{ head: '', text: '' }] }],
  sources: [''],
  pictureCaptions: [{ title: '', caption: '' }],
  pictures: [{ search: '', kind: 'landscape', title: '', caption: '' }],
};

// ---------------------------------------------------------------- cleaning

const str = (v) => (typeof v === 'string' ? v.replace(/\s+/g, ' ').trim() : '');
const num = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);
const list = (v) => (Array.isArray(v) ? v : []);
// the uploaded slide a piece comes from (redesign of an AI deck, api/analyse.js); absent for notes
const fromSlide = (x) => (Number.isInteger(Number(x?.slide)) && Number(x.slide) > 0 && Number(x.slide) < 500 ? { slide: Number(x.slide) } : {});

/** Shorten at a word boundary if a piece is longer than a slide can hold. */
export function clipText(text, max) {
  const t = str(text);
  if (t.length <= max) return t;
  const cut = t.slice(0, max - 1);
  const at = cut.lastIndexOf(' ');
  return `${(at >= max * 0.5 ? cut.slice(0, at) : cut).replace(/[,;:\s]+$/, '')}…`;
}

export const clip = clipText;

/** Keep a number and its unit together: "40,5 %" must not break before the "%". */
const keepNumber = (t) => t.replace(/(\d)\s+(%|‰|°|€|\$|£|km|kg|m|cm|mm|h|min|s|bpm)(?=$|[^\p{L}])/gu, '$1\u202F$2');

// limits that keep every slide form readable at its minimum font size
const L = { title: 90, deckTitle: 80, short: 40, claim: 190, note: 180, caption: 200, item: 95, head: 60, quote: 200, question: 150, value: 9, label: 60, term: 50, gloss: 60, defText: 260, source: 220 };
const PICTURE_KINDS = new Set(['landscape', 'building', 'detail', 'historical']);
const yearOf = (v) => (num(v) > 0 ? num(v) : undefined);
const weighted = (arr, i) => (i === 0 ? 3 : 2);

/**
 * Turn the model's answer (the structured shape above) into a content pool.
 * Anything missing or empty is dropped; anything too long is shortened.
 * Throws if the answer has too little to make a deck.
 */
export function toPool(answer, { verbatim = false } = {}) {
  const a = answer && typeof answer === 'object' ? answer : {};
  // Redesign of an uploaded deck: the slide text is kept word for word. Nothing is shortened
  // and no list loses an item (the layout shrinks the type and says when something no longer
  // fits); a piece that doesn't fit its form becomes a list instead of being dropped; and
  // nothing is added that the deck did not have (no topic photos, no empty Works Cited).
  const clip = verbatim ? (text) => str(text) : clipText;
  const many = (normal) => (verbatim ? Infinity : normal);
  // a headline the original slide didn't have is not made up (redesign)
  const orTitle = (made) => (verbatim ? '' : made);
  const items = [];
  // a piece that doesn't fit its slide form keeps its text as a list (redesign only)
  const rescue = (x, title, lines) => {
    if (!verbatim) return;
    const points = lines.map((l) => (typeof l === 'string' ? { head: str(l) } : { head: str(l.head), text: str(l.text) }))
      .map((p) => (p.head ? p : { head: p.text ?? '' })).filter((p) => p.head).map((p) => (p.text ? p : { head: p.head }));
    if (points.length) items.push({ ...fromSlide(x), kind: 'points', weight: 2, title: str(title), points, marker: 'none' });
  };
  const d = a.deck ?? {};
  const title = clip(d.title, L.deckTitle) || clip(d.shortTitle, L.deckTitle);
  if (!title) throw new Error('The answer has no title.');
  // the short title is the footer label, not slide text
  const shortTitle = clipText(d.shortTitle, L.short) || clipText(title, L.short);

  const ROLES = new Set(['thesis', 'context', 'counter', 'takeaway']);
  let thesisSeen = false;
  list(a.claims).forEach((c, i) => {
    const text = clip(c?.text, L.claim);
    if (!text) return;
    let role = str(c?.role);
    if (role === 'thesis' && thesisSeen) role = 'claim';
    if (role === 'thesis') thesisSeen = true;
    items.push({ ...fromSlide(c), kind: 'claim', tags: ROLES.has(role) ? [role] : [], weight: role === 'thesis' ? 3 : 2, text, ...(str(c?.note) ? { note: clip(c.note, L.note) } : {}) });
  });
  list(a.definitions).forEach((x, i) => {
    const term = clip(x?.term, L.term);
    const text = clip(x?.text, L.defText);
    if (!term || !text) { rescue(x, x?.term, [x?.gloss, x?.text].filter(Boolean)); return; }
    items.push({ ...fromSlide(x), kind: 'definition', weight: weighted(a.definitions, i), term, text, ...(str(x?.gloss) ? { gloss: clip(x.gloss, L.gloss) } : {}) });
  });
  list(a.figures).forEach((x, i) => {
    const value = keepNumber(str(x?.value));
    if (!value || value.length > L.value || !/\d/.test(value)) { rescue(x, x?.title, [[x?.value, x?.label].map(str).filter(Boolean).join(' '), x?.caption, x?.source].filter(Boolean)); return; } // a key figure is a number from the notes
    items.push({
      ...fromSlide(x), kind: 'figure', tags: ['evidence'], weight: weighted(a.figures, i), year: yearOf(x?.year),
      title: clip(x?.title, L.title) || orTitle(clip(x?.label, L.title)), value, label: clip(x?.label, L.label) || ' ',
      ...(str(x?.caption) ? { caption: clip(x.caption, L.caption) } : {}), ...(str(x?.source) ? { source: clip(x.source, L.item) } : {}),
    });
  });
  list(a.pairs).forEach((x, i) => {
    const before = keepNumber(clip(x?.before?.text, 24));
    const after = keepNumber(clip(x?.after?.text, 24));
    if (!before || !after || (verbatim && (before.length > 24 || after.length > 24))) {
      rescue(x, x?.title, [x?.word, { head: x?.before?.label, text: x?.before?.text }, { head: x?.after?.label, text: x?.after?.text }, x?.caption].filter(Boolean)); return;
    }
    items.push({
      ...fromSlide(x), kind: 'pair', tags: ['evidence'], weight: weighted(a.pairs, i), year: yearOf(x?.year),
      title: clip(x?.title, L.title) || orTitle(`${before} → ${after}`), ...(str(x?.word) ? { word: clip(x.word, 30) } : {}),
      left: { text: before, label: clip(x?.before?.label, 30) }, right: { text: after, label: clip(x?.after?.label, 30) },
      ...(str(x?.caption) ? { caption: clip(x.caption, L.caption) } : {}),
    });
  });
  list(a.timelines).forEach((x, i) => {
    if (verbatim && (list(x?.events).length < 3 || list(x?.events).length > 8 || list(x?.events).some((e) => !str(e?.date) || !str(e?.label)))) {
      rescue(x, x?.title, list(x?.events).map((e) => ({ head: e?.date, text: e?.label }))); return;
    }
    const raw = list(x?.events).filter((e) => str(e?.date) && str(e?.label)).slice(0, many(6));
    // more events means narrower columns, so shorter labels
    const events = raw.map((e) => ({ date: clip(e.date, 14), label: clip(e.label, raw.length > 4 ? 50 : 80) }));
    if (events.length < 3) return;
    items.push({ ...fromSlide(x), kind: 'timeline', tags: ['evidence'], weight: 3 - Math.min(1, i), year: yearOf(x?.year), title: clip(x?.title, L.title) || orTitle('Timeline'), events });
  });
  list(a.processes).forEach((x, i) => {
    if (verbatim && (list(x?.steps).length < 2 || list(x?.steps).length > 6 || list(x?.steps).some((st) => !str(st?.title)))) {
      rescue(x, x?.title, list(x?.steps).map((st) => ({ head: st?.title, text: st?.text }))); return;
    }
    const steps = list(x?.steps).map((s) => ({ title: clip(s?.title, L.head), text: clip(s?.text, 150) })).filter((s) => s.title).slice(0, many(5));
    if (steps.length < 2) return;
    items.push({ ...fromSlide(x), kind: 'steps', weight: weighted(a.processes, i), title: clip(x?.title, L.title) || orTitle('Step by step'), steps });
  });
  list(a.comparisons).forEach((x, i) => {
    const side = (s) => ({ heading: clip(s?.heading, 40), points: list(s?.points).map((p) => clip(p, L.item)).filter(Boolean).slice(0, many(3)) });
    const left = side(x?.left);
    const right = side(x?.right);
    if (!left.heading || !right.heading || !left.points.length || !right.points.length) {
      rescue(x, x?.title, [...[x?.left, x?.right].flatMap((sd) => [sd?.heading, ...list(sd?.points)]), x?.verdict].filter((l) => str(l))); return;
    }
    items.push({ ...fromSlide(x), kind: 'comparison', tags: ['counter'], weight: weighted(a.comparisons, i), title: clip(x?.title, L.title) || orTitle(`${left.heading} or ${right.heading}`), left, right, ...(str(x?.verdict) ? { verdict: clip(x.verdict, 150) } : {}) });
  });
  list(a.quotes).forEach((x, i) => {
    const text = clip(x?.text, L.quote);
    const author = clip(x?.author, 60);
    if (!text || !author) { rescue(x, '', [x?.text, x?.author, x?.work, x?.note].filter((l) => str(l))); return; }
    items.push({ ...fromSlide(x), kind: 'quote', tags: ['evidence'], weight: weighted(a.quotes, i), year: yearOf(x?.year), text, author, ...(str(x?.work) ? { work: clip(x.work, 80) } : {}), ...(str(x?.note) ? { note: clip(x.note, L.note) } : {}) });
  });
  const QROLES = new Set(['hook', 'discussion', 'task']);
  list(a.questions).forEach((x) => {
    const text = clip(x?.text, L.question);
    if (!text) return;
    const role = QROLES.has(str(x?.role)) ? str(x.role) : 'discussion';
    items.push({ ...fromSlide(x), kind: 'question', tags: role === 'discussion' ? ['discussion', 'counter'] : [role], weight: role === 'hook' ? 3 : 2, text, ...(str(x?.hint) ? { hint: clip(x.hint, 120) } : {}) });
  });
  list(a.pointLists).forEach((x, i) => {
    // a point with only detail text keeps that text as its line (redesign)
    const given = verbatim ? list(x?.points).map((p) => (str(p?.head) ? p : { head: p?.text, text: '' })) : list(x?.points);
    const rawPoints = given.filter((p) => str(p?.head)).slice(0, many(4));
    const tight = rawPoints.length > 3; // four rows leave less room per point
    const points = rawPoints.map((p) => ({ head: clip(p.head, tight ? 55 : 70), text: clip(p?.text, tight ? 75 : 110) }));
    // an uploaded slide with a headline and one block of text is a list of one
    if (points.length < (verbatim ? 1 : 2)) return;
    // a redesigned list keeps its own marker; nothing is numbered that the slide didn't number
    const marker = verbatim ? (['number', 'bullet', 'none'].includes(str(x?.marker)) ? str(x.marker) : 'none') : undefined;
    items.push({ ...fromSlide(x), kind: 'points', weight: weighted(a.pointLists, i), title: clip(x?.title, L.title) || orTitle(shortTitle), points: points.map((p) => (p.text ? p : { head: p.head })), ...(marker ? { marker } : {}) });
  });
  const entries = list(a.sources).map((s) => clip(s, L.source)).filter(Boolean).slice(0, many(10));
  // Works Cited is always there; with no sources in the notes it says so instead of inventing any.
  // A redesigned deck only gets one when the uploaded deck listed sources.
  if (!verbatim || entries.length) items.push({ kind: 'sources', weight: 3, title: clip(d.worksCitedTitle, 40) || t(d.language, 'Works Cited'), entries: entries.length ? entries : ['No sources were named in the notes. Add your sources here.'] });

  if (items.filter((it) => it.kind !== 'sources').length < (verbatim ? 1 : 3)) throw new Error('The notes were too short to make a deck. Add a few more points and try again.');
  if (!thesisSeen) {
    // the strongest claim becomes the thesis, so thesis-first structures still have one
    const first = items.find((it) => it.kind === 'claim' && !(it.tags ?? []).length);
    if (first) { first.tags = ['thesis']; first.weight = 3; }
  }

  const words = list(d.posterWords).map((w) => clipText(w, 16).split(' ')[0]).filter(Boolean).slice(0, 3);
  const language = /^[a-z]{2}$/i.test(str(d.language)) ? str(d.language).toLowerCase() : 'en';
  return {
    language,
    title,
    shortTitle,
    subtitle: clip(d.subtitle, 90) || orTitle(shortTitle),
    author: clip(d.author, 60), // left empty when the notes don't name one, rather than an English placeholder
    course: clip(d.course, 80),
    date: clip(d.date, 40),
    posterWords: words.length ? words : shortTitle.split(' ').slice(0, 3),
    posterLines: list(d.posterLines).map((l) => clipText(l, 40)).filter(Boolean).slice(0, 5),
    place: clipText(d.placeShort, 40),
    placeShort: clipText(d.placeShort, 24),
    mood: [],
    pictureCaptions: list(a.pictureCaptions).map((p) => ({ title: clip(p?.title, L.title), caption: clip(p?.caption, L.caption) })).filter((p) => p.title).slice(0, 3),
    // what to look up on Wikimedia Commons (src/engine/pictures.js)
    pictureSearches: list(a.pictures).map((p) => ({
      search: clip(p?.search, 60).replace(/…$/, ''), kind: PICTURE_KINDS.has(str(p?.kind)) ? str(p.kind) : 'landscape',
      title: clip(p?.title, L.title), caption: clip(p?.caption, L.caption),
    })).filter((p) => p.search && p.title).slice(0, verbatim ? 0 : 5),
    items,
    generated: true,
    ...(verbatim ? { verbatim: true } : {}),
  };
}

/** Parse a pasted answer (copy-paste fallback): tolerates code fences and text around the JSON. */
export function parseAnswer(text) {
  const s = String(text ?? '');
  const start = s.indexOf('{');
  const end = s.lastIndexOf('}');
  if (start < 0 || end <= start) throw new Error('No JSON found in the pasted answer.');
  return JSON.parse(s.slice(start, end + 1));
}
