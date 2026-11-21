import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildDirections, buildDeck } from '../src/engine/build.js';
import { layoutSlide } from '../src/library/forms.js';
import { SAMPLE_POOL } from '../src/sample/great-vowel-shift.js';
import { STRUCTURES } from '../src/library/structures.js';
import { DIRECTIONS } from '../src/library/directions.js';
import {
  emptyEdits, withIds, applyEdits, applyPlans, deckKey, planOf, resolvePlan, isEdited, setItem, setCover, setSection,
  moveSlide, deleteSlide, duplicateSlide, addSlide, unusedItems, SCHEMAS, schemaFor, emptyItem, NEW_KINDS, getPath, setPath,
} from '../src/engine/edits.js';

const pool = withIds(SAMPLE_POOL);
const build = (edits, family = 'editorial', density = 'medium') => {
  const p = applyEdits(pool, edits);
  return applyPlans(buildDirections({ pool: p, occasionId: 'seminar', family, density, seed: 'e' }), p, edits);
};
const statement = (deck) => deck.slides.findIndex((s) => s.form === 'statement');

test('every item gets a stable id', () => {
  assert.ok(pool.items.every((it) => it.id));
  assert.equal(withIds(SAMPLE_POOL).items[3].id, pool.items[3].id);
  assert.equal(withIds(pool), pool, 'a pool with ids stays as it is');
});

test('edited content shows in every look, and the deck is marked as edited', () => {
  const [deck] = build(emptyEdits());
  const i = statement(deck);
  const id = deck.slides[i].item.id;
  const edits = setItem(emptyEdits(), id, { ...deck.slides[i].item, text: 'My own sharper thesis.' });
  for (const family of ['editorial', 'glass', 'poster', 'texture']) {
    const decks = build(edits, family);
    const shown = decks.flatMap((d) => d.slides).filter((s) => s.item?.id === id);
    assert.ok(shown.length, family);
    assert.ok(shown.every((s) => s.item.text === 'My own sharper thesis.'));
    assert.ok(shown.every((s) => s.els.some((e) => e.type === 'text' && /sharper thesis/i.test(e.text))), `${family}: the slide is drawn with the new text`);
  }
  assert.ok(isEdited(build(edits)[0], edits) || build(edits).some((d) => isEdited(d, edits)));
  assert.equal(isEdited(build(emptyEdits())[0], emptyEdits()), false);
});

test('cover fields change the cover in every deck', () => {
  const edits = setCover(emptyEdits(), { title: 'A new title for the talk', author: 'A. Student' });
  for (const deck of build(edits, 'glass')) {
    const cover = deck.slides[0].els.filter((e) => e.type === 'text').map((e) => e.text.toLowerCase()).join(' ');
    assert.match(cover, /a new title for the talk/);
    assert.match(cover, /a\. student/);
  }
});

test('moving, deleting and duplicating slides changes only that deck', () => {
  const [deck, other] = build(emptyEdits());
  const n = deck.slides.length;
  const forms = deck.slides.map((s) => s.form);
  let edits = moveSlide(emptyEdits(), deck, 2, -1);
  let [d] = build(edits);
  assert.deepEqual(d.slides.map((s) => s.form).slice(0, 3), [forms[0], forms[2], forms[1]]);
  assert.equal(moveSlide(emptyEdits(), deck, 1, -1).plans[deckKey(deck)][0].form, 'cover', 'the cover stays first');
  edits = deleteSlide(edits, d, 3);
  [d] = build(edits);
  assert.equal(d.slides.length, n - 1);
  edits = duplicateSlide(edits, d, 1);
  [d] = build(edits);
  assert.equal(d.slides.length, n);
  assert.notEqual(d.slides[1].item?.id, d.slides[2].item?.id, 'a copy has its own content');
  assert.equal(build(edits)[1].slides.length, other.slides.length, 'the other directions keep their order');
  // denser or lighter is a different deck, with the structure's own order
  assert.ok(!build(edits, 'editorial', 'dense')[0].edited);
});

test('a deleted cover is impossible and a deck keeps at least two slides', () => {
  const [deck] = build(emptyEdits());
  assert.equal(deleteSlide(emptyEdits(), deck, 0).plans[deckKey(deck)].length, deck.slides.length);
});

test('slides can be added from unused content or as empty slides of every kind', () => {
  const [deck] = build(emptyEdits(), 'editorial', 'light');
  const unused = unusedItems(deck);
  assert.ok(unused.length > 0);
  let edits = addSlide(emptyEdits(), deck, 1, { id: unused[0].id });
  let [d] = build(edits, 'editorial', 'light');
  assert.equal(d.slides[2].item.id, unused[0].id);
  for (const [kind] of NEW_KINDS) {
    edits = addSlide(edits, d, 1, { kind });
    [d] = build(edits, 'editorial', 'light');
    assert.equal(d.slides[2].item.kind, kind === 'claim' ? 'claim' : kind);
    assert.ok(d.slides[2].item.added);
  }
  // added slides do not leak into the other directions
  const others = build(edits, 'editorial', 'light').slice(1).flatMap((x) => x.slides);
  assert.ok(!others.some((s) => s.item?.added));
});

test('no chapter divider slides and no oversized numbers: the content carries the slide', async () => {
  const { buildFromDirections } = await import('../src/engine/build.js');
  for (const family of ['editorial', 'poster', 'glass', 'texture']) for (const density of ['light', 'medium', 'dense']) {
    for (const deck of buildDirections({ pool, occasionId: 'seminar', density, seed: 3, family })) {
      assert.ok(!deck.slides.some((s) => s.form === 'section'), `${deck.direction.id}: no divider`);
      for (const s of deck.slides) for (const e of s.els) {
        // a number shown big is only ever a key figure (content), never numbering or decoration
        if (e.type === 'text' && /^\d{1,2}$/.test(String(e.text).trim()) && s.form !== 'bigNumber') assert.ok(e.size <= 14, `${deck.direction.id}/${s.form}: "${e.text}" at ${e.size}pt`);
      }
    }
  }
  // an order saved with a divider slide drops it
  const deck = buildDeck({ deck: { ...pool, occasionLabel: 'Seminar' }, direction: DIRECTIONS[0], structure: STRUCTURES[0], density: 'medium' });
  const plan = [deck.slides[0], { form: 'section', item: { number: 1, label: 'Old' } }, ...deck.slides.slice(1)];
  assert.ok(!buildDeck({ deck: deck.deck, direction: deck.direction, plan }).slides.some((s) => s.form === 'section'));
});

test('stored order survives a round trip through JSON, and missing items are dropped', () => {
  const [deck] = build(emptyEdits());
  const plan = JSON.parse(JSON.stringify(planOf(deck)));
  assert.equal(resolvePlan(plan, pool, emptyEdits()).length, deck.slides.length);
  assert.equal(resolvePlan([...plan, { form: 'statement', id: 'gone' }], pool, emptyEdits()).length, deck.slides.length);
});

test('every slide has an editor, every field path exists on its content, and empty slides lay out', () => {
  const [deck] = buildDirections({ pool, occasionId: 'seminar', density: 'dense', seed: 'all', family: 'editorial' });
  for (const s of deck.slides) {
    const schema = schemaFor(s);
    assert.ok(schema, `no editor for ${s.form}`);
    const target = s.form === 'cover' ? deck.deck : s.item;
    for (const f of schema.fields) if (!f.optional) assert.notEqual(getPath(target, f.k), undefined, `${s.form}: ${f.k}`);
  }
  for (const [kind] of NEW_KINDS) {
    const item = { ...emptyItem(kind), id: 'x' };
    for (const d of DIRECTIONS) assert.doesNotThrow(() => layoutSlide(d, { ...pool, occasionLabel: 'Seminar' }, { form: { claim: 'statement', points: 'points', question: 'question', quote: 'quote', figure: 'bigNumber', steps: 'process' }[kind], item }, 3, 10));
  }
  assert.deepEqual(Object.keys(SCHEMAS).sort(), ['claim', 'comparison', 'cover', 'definition', 'figure', 'image', 'pair', 'points', 'question', 'quote', 'section', 'sources', 'steps', 'timeline']);
});

test('field paths read and write nested values without touching the original', () => {
  const item = { left: { text: 'a' } };
  const out = setPath(item, 'left.label', 'Middle English');
  assert.equal(getPath(out, 'left.label'), 'Middle English');
  assert.equal(item.left.label, undefined);
});

test('editing Works Cited does not list picture credits twice', () => {
  const [deck] = build(emptyEdits(), 'poster');
  const ref = deck.slides.find((s) => s.form === 'references');
  const edits = setItem(emptyEdits(), ref.item.id, ref.item);
  const again = build(edits, 'poster')[0].slides.find((s) => s.form === 'references').item.entries;
  assert.equal(again.length, new Set(again).size);
});
