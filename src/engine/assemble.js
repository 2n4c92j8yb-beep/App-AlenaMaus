// Turns a content pool into an ordered list of slides for one story structure.
// The pool is what the AI step will produce from the user's notes (step 2);
// in step 1 it is a hand-written sample.

import { FORM_FOR_KIND } from '../library/structures.js';

// Tags that give an item a fixed job. An item with one of these is only used
// by a role that asks for that job (a counter-argument never becomes the thesis).
const ROLE_TAGS = new Set(['thesis', 'counter', 'takeaway', 'hook', 'task', 'context', 'discussion']);

const REPEAT_CAP = { light: 1, medium: 2, dense: 4 };

export function assembleDeck(pool, structure, density = 'medium') {
  const used = new Set();
  const slides = [{ form: 'cover' }];
  let sectionCount = 0;
  let photoCount = 0;

  for (const role of structure.roles) {
    if (role.optional && density === 'light') continue;
    const n = role.repeat ? Math.min(role.repeat, REPEAT_CAP[density] ?? 2) : 1;
    const items = pick(pool.items, role, n, used, density);
    if (!items.length) continue;
    if (structure.chronological) items.sort((a, b) => (a.year ?? 0) - (b.year ?? 0));
    if (role.section && density !== 'light') {
      slides.push({ form: 'section', item: { number: ++sectionCount, label: role.section }, sectionNo: sectionCount });
    }
    items.forEach((item, i) => {
      used.add(item);
      let form = FORM_FOR_KIND[item.kind];
      // pictures alternate between full-screen and half-screen slides
      if (item.kind === 'image') form = photoCount++ % 2 === 0 ? 'photo' : 'photoSplit';
      slides.push({ form, item, kicker: i === 0 ? role.kicker : undefined, sectionNo: sectionCount });
    });
  }

  // A single section divider adds nothing; drop it.
  const sections = slides.filter((s) => s.form === 'section');
  return sections.length < 2 ? slides.filter((s) => s.form !== 'section') : slides;
}

function pick(items, role, n, used, density) {
  const open = items.filter((it) => !used.has(it) && role.kinds.includes(it.kind));
  let candidates = open;
  if (role.tags) {
    const tagged = open.filter((it) => (it.tags ?? []).some((t) => role.tags.includes(t)));
    candidates = tagged.length ? tagged : open.filter((it) => !(it.tags ?? []).some((t) => ROLE_TAGS.has(t)));
    if (!tagged.length && role.optional) candidates = [];
  }
  if (density === 'light') {
    const strong = candidates.filter((it) => (it.weight ?? 1) >= 2);
    if (strong.length) candidates = strong;
  }
  // Round-robin across kinds (in the role's order of preference), strongest
  // item of each kind first, so a repeated role mixes forms instead of
  // showing the same slide type several times in a row.
  const groups = role.kinds
    .map((k) => candidates.filter((it) => it.kind === k).sort((a, b) => (b.weight ?? 1) - (a.weight ?? 1)))
    .filter((g) => g.length);
  const out = [];
  while (out.length < n && groups.some((g) => g.length)) {
    for (const g of groups) if (g.length && out.length < n) out.push(g.shift());
  }
  return out;
}
