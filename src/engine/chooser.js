// "Help me choose": people narrow the design directions down themselves, one either/or
// question per round, until a single direction is left. No DOM here (tested in
// tests/chooser.test.js); src/main.js shows each round as two slides side by side.
//
// Each round asks about one visible trait (light or dark, serif or sans …) and shows two
// directions that differ in that trait and as little as possible otherwise, so the
// comparison is about the question asked. The answer keeps that side of the candidates.
// When no trait splits the rest any more, the last few meet head to head.
//
// The chooser is a plain, immutable object, so Back is just the previous one.

/** The questions, each splitting the directions into two sides by one visible trait. */
export const TRAITS = [
  {
    id: 'mode',
    question: 'Which background would you rather present on?',
    sides: ['Light background', 'Dark background'],
    of: (d) => (d.tags.mode === 'dark' ? 1 : 0),
  },
  {
    id: 'surface',
    question: 'How should the space behind your content look?',
    sides: ['Plain and flat', 'Soft depth: light, glass or texture'],
    of: (d) => (['glass', 'texture'].includes(d.family) ? 1 : 0),
  },
  {
    id: 'type',
    question: 'Which lettering do you find easier to read?',
    sides: ['Classic serif type', 'Clean sans-serif type'],
    of: (d) => (d.tags.type === 'sans' ? 1 : 0),
  },
  {
    id: 'tone',
    question: 'Which one suits the way you want to come across?',
    sides: ['More formal', 'More relaxed'],
    of: (d) => (d.tags.tone === 'formal' ? 0 : 1),
  },
  {
    id: 'headline',
    question: 'Where should the headline sit?',
    sides: ['Above the content', 'In a column beside it'],
    of: (d) => (d.layout.titlePos === 'side' ? 1 : 0),
  },
  {
    id: 'align',
    question: 'How should the text line up?',
    sides: ['Left-aligned', 'Centred'],
    of: (d) => (d.layout.align === 'center' ? 1 : 0),
  },
];

const DUEL = { id: 'duel', question: 'Which of these two do you like more?', sides: ['This one', 'This one'] };

/**
 * Start choosing among `directions`. `prior(d)` (higher is better) says which direction
 * shows a side first, e.g. how close it is to an uploaded deck or how well it suits
 * the occasion; it never decides for the person.
 */
export function createChooser(directions, prior = () => 0) {
  const scores = new Map(directions.map((d) => [d.id, prior(d)]));
  return { all: directions, scores, left: directions.map((d) => d.id), asked: [], previous: null, rounds: 0 };
}

const byId = (ch, id) => ch.all.find((d) => d.id === id);
const leftDirs = (ch) => ch.left.map((id) => byId(ch, id));
const score = (ch, d) => ch.scores.get(d.id) ?? 0;
// how much else two directions differ in, besides the trait asked about (a different look counts half)
const otherDiffs = (a, b, skip) => TRAITS.filter((t) => t.id !== skip && t.of(a) !== t.of(b)).length
  + ((a.family ?? 'editorial') !== (b.family ?? 'editorial') ? 0.5 : 0);

/** The best pair (one from each side) for a question: alike in everything else, strongest first. */
function pairFor(ch, sideA, sideB, traitId) {
  let best = null;
  for (const a of sideA) for (const b of sideB) {
    const cost = otherDiffs(a, b, traitId) * 100 - (score(ch, a) + score(ch, b));
    if (!best || cost < best.cost || (cost === best.cost && `${a.id}${b.id}` < `${best.a.id}${best.b.id}`)) best = { a, b, cost };
  }
  return [best.a, best.b];
}

/**
 * What to ask next: { kind: 'trait' | 'duel', trait, question, options: [{ direction, label }, …],
 * left, round } or { kind: 'done', direction, round }.
 */
export function nextRound(ch) {
  const left = leftDirs(ch);
  if (left.length === 1) return { kind: 'done', direction: left[0], round: ch.rounds };
  // the question that splits what is left most evenly
  let pick = null;
  for (const t of TRAITS) {
    if (ch.asked.includes(t.id)) continue;
    const sides = [left.filter((d) => t.of(d) === 0), left.filter((d) => t.of(d) === 1)];
    const balance = Math.min(sides[0].length, sides[1].length);
    if (balance > 0 && (!pick || balance > pick.balance)) pick = { t, sides, balance };
  }
  if (pick) {
    const [a, b] = pairFor(ch, pick.sides[0], pick.sides[1], pick.t.id);
    return {
      kind: 'trait', trait: pick.t.id, question: pick.t.question, left: left.length, round: ch.rounds + 1,
      options: [{ direction: a, label: pick.t.sides[0], count: pick.sides[0].length }, { direction: b, label: pick.t.sides[1], count: pick.sides[1].length }],
    };
  }
  // nothing tells the rest apart any more: the two strongest meet, the winner stays
  const [a, b] = [...left].sort((x, y) => score(ch, y) - score(ch, x) || x.id.localeCompare(y.id));
  return {
    kind: 'duel', trait: DUEL.id, question: DUEL.question, left: left.length, round: ch.rounds + 1,
    options: [{ direction: a, label: a.name, count: 1 }, { direction: b, label: b.name, count: 1 }],
  };
}

/** Answer the current round: 0 or 1 for an option, null for "no preference". Returns a new chooser. */
export function choose(ch, side) {
  const r = nextRound(ch);
  if (r.kind === 'done') return ch;
  const base = { ...ch, previous: ch, rounds: ch.rounds + 1 };
  if (r.kind === 'duel') {
    // no preference in a duel: keep the stronger one
    const loser = r.options[side === 1 ? 0 : 1].direction.id;
    return { ...base, left: ch.left.filter((id) => id !== loser) };
  }
  const trait = TRAITS.find((t) => t.id === r.trait);
  const asked = [...ch.asked, trait.id];
  if (side !== 0 && side !== 1) return { ...base, asked };
  return { ...base, asked, left: ch.left.filter((id) => trait.of(byId(ch, id)) === side) };
}

/** The chooser before the last answer (or the same one at the start). */
export const back = (ch) => ch.previous ?? ch;
