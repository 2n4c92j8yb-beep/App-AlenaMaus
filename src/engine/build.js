// One call that produces the three directions shown to the user.

import { sampleDirections, sampleStructures } from './sampler.js';
import { assembleDeck } from './assemble.js';
import { layoutSlide } from '../library/forms.js';
import { occasionById } from '../library/occasions.js';
import { assignMood } from '../library/posters.js';

export function buildDirections({ pool, occasionId, density = 'medium', formality = 'neutral', seed, family = 'editorial' }) {
  const occasion = occasionById(occasionId);
  const dirs = sampleDirections({ occasionId: occasion.id, formality, seed, family });
  const structs = sampleStructures({ occasionId: occasion.id, seed, count: dirs.length });
  const deck = { ...pool, occasionLabel: occasion.name };
  return dirs.map((direction, i) => buildDeck({ deck, direction, structure: structs[i], density }));
}

export function buildDeck({ deck, direction, structure, density = 'medium' }) {
  const plan = withImageCitations(assignMood(assembleDeck(deck, structure, density), deck, direction), deck);
  const slides = plan.map((s, i) => ({ ...s, els: layoutSlide(direction, deck, s, i, plan.length, density) }));
  const overflow = slides.flatMap((s, i) => s.els.filter((e) => e.type === 'text' && !e.fits && !e.bleed).map((e) => ({ slide: i + 1, form: s.form, text: e.text.slice(0, 60) })));
  return { direction, structure, density, deck, slides, overflow };
}

// Pictures that appear in the deck get their citation added to Works Cited.
function withImageCitations(plan, deck) {
  const shown = [...plan.map((s) => s.item), ...plan.flatMap((s) => [s.mood, s.fillMood])];
  if (!plan.some((s) => s.form === 'cover' && s.mood)) shown.push(deck.coverImage); // poster covers use a mood photo instead
  const cites = [...new Set(shown.filter((it) => it && it.citation && (it.kind === 'image' || it === deck.coverImage || deck.mood?.includes(it))).map((it) => it.citation))];
  if (!cites.length) return plan;
  return plan.map((s) => (s.form === 'references'
    ? { ...s, item: { ...s.item, entries: [...s.item.entries, ...cites].sort((a, b) => a.localeCompare(b)) } }
    : s));
}
