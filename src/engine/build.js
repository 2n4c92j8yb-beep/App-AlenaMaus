// One call that produces the three directions shown to the user.

import { sampleDirections, sampleStructures } from './sampler.js';
import { assembleDeck } from './assemble.js';
import { layoutSlide } from '../library/forms.js';
import { occasionById } from '../library/occasions.js';
import { assignMood } from '../library/posters.js';
import { assignAccents } from '../library/accents.js';
import { t } from '../library/labels.js';

export function buildDirections({ pool, occasionId, density = 'medium', formality = 'neutral', seed, family = 'editorial' }) {
  const occasion = occasionById(occasionId);
  const dirs = sampleDirections({ occasionId: occasion.id, formality, seed, family });
  const structs = sampleStructures({ occasionId: occasion.id, seed, count: dirs.length });
  const deck = { ...pool, occasionLabel: t(pool.language, occasion.name) };
  return dirs.map((direction, i) => buildDeck({ deck, direction, structure: structs[i], density }));
}

export function buildDeck({ deck, direction, structure, density = 'medium' }) {
  const plan = assignAccents(assignMood(localize(assembleDeck(deck, structure, density), deck.language), deck, direction), deck, direction, structure);
  const lay = (s, i) => ({ ...s, els: layoutSlide(direction, deck, s, i, plan.length, density) });
  // pictures are cited once they are known to be on a slide, so Works Cited lists exactly what the deck shows
  const laid = plan.map(lay);
  const cited = withImageCitations(plan, deck, laid);
  const slides = cited.map((s, i) => (s === plan[i] ? laid[i] : lay(s, i)));
  const overflow = slides.flatMap((s, i) => s.els.filter((e) => e.type === 'text' && !e.fits && !e.bleed).map((e) => ({ slide: i + 1, form: s.form, text: e.text.slice(0, 60) })));
  return { direction, structure, density, deck, slides, overflow };
}

// Section names and kickers come from the story structures (in English); show them in the deck's language.
function localize(plan, lang) {
  if (!lang || lang === 'en') return plan;
  return plan.map((s) => ({
    ...s,
    ...(s.kicker ? { kicker: t(lang, s.kicker) } : {}),
    ...(s.form === 'section' ? { item: { ...s.item, label: t(lang, s.item.label) } } : {}),
  }));
}

// Pictures that appear in the deck get their citation added to Works Cited.
// A picture counts as shown when one of its files is on a slide (mood photos have one file per colour grade).
function withImageCitations(plan, deck, laid) {
  const srcs = new Set(laid.flatMap((s) => s.els.flatMap((e) => [e.src, e.fillImage])).filter(Boolean));
  const shows = (it) => srcs.has(it.src) || (it.base && [...srcs].some((src) => src.startsWith(`${it.base}-`)));
  const pictures = [deck.coverImage, ...(deck.mood ?? []), ...plan.map((s) => s.item).filter((it) => it?.kind === 'image')];
  const cites = [...new Set(pictures.filter((it) => it?.citation && shows(it)).map((it) => it.citation))];
  if (!cites.length) return plan;
  return plan.map((s) => (s.form === 'references'
    ? { ...s, item: { ...s.item, entries: [...s.item.entries, ...cites].sort((a, b) => a.localeCompare(b)) } }
    : s));
}
