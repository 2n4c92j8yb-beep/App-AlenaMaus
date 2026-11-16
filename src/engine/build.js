// One call that produces the three directions shown to the user.

import { sampleDirections, sampleStructures } from './sampler.js';
import { assembleDeck } from './assemble.js';
import { layoutSlide } from '../library/forms.js';
import { occasionById } from '../library/occasions.js';
import { assignMood } from '../library/posters.js';
import { assignAccents } from '../library/accents.js';
import { t } from '../library/labels.js';
import { toSpec, directionFor, briefOf } from './director.js';
import { withIds, resolvePlan } from './edits.js';

export function buildDirections({ pool, occasionId, density = 'medium', formality = 'neutral', seed, family = 'editorial' }) {
  const occasion = occasionById(occasionId);
  const dirs = sampleDirections({ occasionId: occasion.id, formality, seed, family });
  return buildFromDirections({ pool, occasionId, density, seed, directions: dirs });
}

/** Decks for directions chosen elsewhere (e.g. matched to an uploaded deck, src/engine/match.js). */
export function buildFromDirections({ pool, occasionId, density = 'medium', seed, directions, structures }) {
  const occasion = occasionById(occasionId);
  const structs = structures ?? sampleStructures({ occasionId: occasion.id, seed, count: directions.length });
  const deck = { ...pool, occasionLabel: t(pool.language, occasion.name) };
  return directions.map((direction, i) => buildDeck({ deck, direction, structure: structs[i], density }));
}

/** One deck. `plan` (slides chosen and ordered by the person, src/engine/edits.js) replaces the story structure's order. */
export function buildDeck({ deck, direction, structure, density = 'medium', plan: own }) {
  const base = own ? own.map((s) => ({ form: s.form, item: s.item, kicker: s.kicker, sectionNo: s.sectionNo ?? 0, ...(s.moment ? { moment: s.moment } : {}) })) : localize(assembleDeck(deck, structure, density), deck.language);
  // a loud statement fills the slide with the accent colour (forms.js); that is its effect, so it takes no second one
  const plan = assignAccents(assignMood(base, deck, direction), deck, direction, structure).map((s) => {
    if (!isLoud(s) || !s.accent) return s;
    const { accent, ...plain } = s;
    return plain;
  });
  const lay = (s, i) => ({ ...s, els: layoutSlide(direction, deck, s, i, plan.length, density) });
  // pictures are cited once they are known to be on a slide, so Works Cited lists exactly what the deck shows
  const laid = plan.map(lay);
  const cited = withImageCitations(plan, deck, laid);
  const slides = cited.map((s, i) => (s === plan[i] ? laid[i] : lay(s, i)));
  const overflow = slides.flatMap((s, i) => s.els.filter((e) => e.type === 'text' && !e.fits && !e.bleed).map((e) => ({ slide: i + 1, form: s.form, text: e.text.slice(0, 60) })));
  return { direction, structure, density, deck, slides, overflow };
}

const isLoud = (s) => s.moment === 'loud' && s.form === 'statement';

// Not a story structure from the library: the art director chose the pieces and their order.
// Saved edits are keyed by direction, structure and density (deckKey() in edits.js), so every
// take gets its own id and a new take never inherits the order of an earlier one.
export const directorStructure = (take = 0) => ({ id: take > 0 ? `director-${take}` : 'director', name: 'Art director', roles: [] });

/**
 * The art director's deck from a checked spec (toSpec() in director.js): the spec's direction
 * with its accent hue, and its plan in place of a story structure. Returns null when the spec
 * names no usable direction or too few of its pieces are in the pool.
 */
export function buildDirected({ pool, spec, occasionId, density = 'medium', take = 0 }) {
  const direction = directionFor(spec);
  if (!direction || !Array.isArray(spec?.plan)) return null;
  const p = withIds(pool);
  const plan = resolvePlan(spec.plan, p);
  if (plan[0]?.form !== 'cover' || plan.filter((s) => s.item?.id && s.form !== 'references').length < 3) return null;
  const occasion = occasionById(occasionId);
  const deck = { ...p, occasionLabel: t(p.language, occasion.name) };
  return { ...buildDeck({ deck, direction, structure: directorStructure(take), density, plan }), directed: true, why: spec.why ?? '', warnings: spec.warnings ?? [] };
}

/**
 * One take from the art director. `ask` is the call to api/direct.js and returns its checked
 * spec; the spec is checked again here, because its ids must be the ones in this pool.
 * Returns { spec, deck }, or null after a refusal, an unreadable answer or a failed call.
 */
export async function askDirector({ ask, pool, occasionId, density = 'medium', formality = 'neutral', seed, avoid = [], take = 0 }) {
  try {
    const answer = await ask({ pool: briefOf(pool), occasionId, formality, avoid });
    const checked = toSpec(answer, pool, { occasionId, formality, avoid, seed });
    const spec = { ...checked, warnings: [...(Array.isArray(answer?.warnings) ? answer.warnings : []), ...checked.warnings] };
    const deck = buildDirected({ pool, spec, occasionId, density, take });
    return deck ? { spec, deck } : null;
  } catch {
    return null;
  }
}

/**
 * The art director's deck with today's three sampled directions beside it. Without a usable
 * take `directed` stays empty and the person simply sees the classic directions.
 */
export async function directOrSample({ ask, pool, occasionId, density = 'medium', formality = 'neutral', seed, family = 'editorial', avoid = [], take = 0 }) {
  const decks = buildDirections({ pool, occasionId, density, formality, seed, family });
  const taken = await askDirector({ ask, pool, occasionId, density, formality, seed, avoid, take });
  return { directed: taken?.deck ?? null, spec: taken?.spec ?? null, decks };
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
    ? { ...s, item: { ...s.item, entries: [...new Set([...s.item.entries, ...cites])].sort((a, b) => a.localeCompare(b)) } }
    : s));
}
