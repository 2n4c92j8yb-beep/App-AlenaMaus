import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildDirections } from '../src/engine/build.js';
import { distance, sampleDirections } from '../src/engine/sampler.js';
import { fitText, countLines, SLIDE_W, SLIDE_H } from '../src/engine/fit.js';
import { DIRECTIONS } from '../src/library/directions.js';
import { OCCASIONS } from '../src/library/occasions.js';
import { STRUCTURES } from '../src/library/structures.js';
import { FONTS } from '../src/library/fonts.js';
import { contrast } from '../src/library/forms.js';
import { SAMPLE_POOL } from '../src/sample/great-vowel-shift.js';

const DENSITIES = ['light', 'medium', 'dense'];
const TONES = ['formal', 'neutral', 'relaxed'];

test('library is complete and consistent', () => {
  assert.equal(DIRECTIONS.filter((d) => d.family !== 'poster').length, 15);
  assert.equal(DIRECTIONS.filter((d) => d.family === 'poster').length, 3);
  assert.equal(new Set(DIRECTIONS.map((d) => d.id)).size, 18);
  for (const d of DIRECTIONS) {
    for (const role of ['display', 'body', 'label', ...(d.family === 'poster' ? ['poster'] : [])]) assert.ok(FONTS[d.fonts[role]], `${d.id} ${role} font`);
    for (const o of OCCASIONS) assert.ok(o.id in d.suits, `${d.id} has weight for ${o.id}`);
  }
  for (const o of OCCASIONS) for (const id of Object.keys(o.structures)) assert.ok(STRUCTURES.find((s) => s.id === id), id);
});

test('every direction has readable text colours (WCAG 4.5:1 for ink, 3:1 for accent)', () => {
  for (const d of DIRECTIONS) {
    const { bg, ink, muted, accent } = d.colors;
    const accentText = d.colors.accentText ?? accent;
    assert.ok(contrast(ink, bg) >= 7, `${d.id} ink`);
    assert.ok(contrast(muted, bg) >= 4.5, `${d.id} muted ${contrast(muted, bg).toFixed(2)}`);
    assert.ok(contrast(accentText, bg) >= 3, `${d.id} accent text ${contrast(accentText, bg).toFixed(2)}`);
    assert.ok(contrast(accent, bg) >= 1.5, `${d.id} accent shapes visible`);
  }
});

test('the same seed gives the same directions; a new seed can give others', () => {
  const a = sampleDirections({ occasionId: 'seminar', seed: 'x' }).map((d) => d.id);
  const b = sampleDirections({ occasionId: 'seminar', seed: 'x' }).map((d) => d.id);
  assert.deepEqual(a, b);
  const seen = new Set();
  for (let i = 0; i < 30; i++) sampleDirections({ occasionId: 'seminar', seed: i }).forEach((d) => seen.add(d.id));
  assert.ok(seen.size >= 10, `only ${seen.size} directions ever picked for seminars`);
});

test('the three directions always differ visibly and never repeat', () => {
  for (const o of OCCASIONS) for (const formality of TONES) for (let s = 0; s < 25; s++) {
    const dirs = sampleDirections({ occasionId: o.id, formality, seed: s });
    assert.equal(dirs.length, 3);
    assert.equal(new Set(dirs).size, 3);
    for (let i = 0; i < 3; i++) for (let j = i + 1; j < 3; j++) assert.ok(distance(dirs[i], dirs[j]) >= 2, `${o.id} ${dirs[i].id}/${dirs[j].id}`);
    for (const d of dirs) assert.ok(d.suits[o.id] > 0, `${d.id} picked for ${o.id}`);
  }
});

test('every deck builds, starts with a cover, stays on the canvas and fits its text', () => {
  for (const o of OCCASIONS) for (const density of DENSITIES) for (const formality of TONES) for (let s = 0; s < 6; s++) {
    for (const deck of buildDirections({ pool: SAMPLE_POOL, occasionId: o.id, density, formality, seed: s })) {
      const name = `${deck.direction.id}/${deck.structure.id}/${density}`;
      assert.equal(deck.slides[0].form, 'cover', name);
      assert.ok(deck.slides.length >= 5, `${name}: ${deck.slides.length} slides`);
      assert.deepEqual(deck.overflow, [], name);
      for (const sl of deck.slides) for (const e of sl.els) {
        if ((e.type === 'text' && !e.bleed) || e.type === 'image') {
          assert.ok(e.x >= -0.01 && e.y >= -0.01 && e.x + e.w <= SLIDE_W + 0.01 && e.y + e.h <= SLIDE_H + 0.01, `${name} ${sl.form}: element off canvas`);
        }
        if (e.type === 'text' && e.role === 'body') assert.ok(e.size >= 12, `${name} ${sl.form}: body text ${e.size}pt`);
      }
    }
  }
});

test('only the Ledger direction draws lines', () => {
  for (const o of OCCASIONS) for (let s = 0; s < 10; s++) {
    for (const deck of buildDirections({ pool: SAMPLE_POOL, occasionId: o.id, seed: s })) {
      const lines = deck.slides.flatMap((x) => x.els).filter((e) => e.type === 'line');
      if (deck.direction.id !== 'ledger') assert.equal(lines.length, 0, `${deck.direction.id} draws ${lines.length} lines`);
    }
  }
});

test('pictures are used and credited in Works Cited', () => {
  let withPhoto = 0;
  for (let s = 0; s < 20; s++) {
    for (const deck of buildDirections({ pool: SAMPLE_POOL, occasionId: 'seminar', seed: s })) {
      const imgs = deck.slides.flatMap((x) => x.els).filter((e) => e.type === 'image');
      if (deck.slides.some((x) => x.form.startsWith('photo'))) withPhoto++;
      const refs = deck.slides.find((x) => x.form === 'references');
      for (const im of imgs) {
        const item = [SAMPLE_POOL.coverImage, ...SAMPLE_POOL.items].find((it) => it.src === im.src);
        if (refs && item?.citation) assert.ok(refs.item.entries.includes(item.citation), `${im.src} not credited`);
      }
    }
  }
  assert.ok(withPhoto >= 30, `only ${withPhoto} of 60 decks show a picture slide`);
});

test('no deck is a wall of identical slides (the typical AI pattern)', () => {
  for (const o of OCCASIONS) for (let s = 0; s < 10; s++) {
    for (const deck of buildDirections({ pool: SAMPLE_POOL, occasionId: o.id, seed: s })) {
      const forms = deck.slides.map((x) => x.form);
      assert.ok(new Set(forms).size >= 5, `${deck.structure.id}: only ${new Set(forms).size} forms`);
      const points = forms.filter((f) => f === 'points').length;
      assert.ok(points <= 2, 'at most two list slides');
    }
  }
});

test('poster decks: three poster directions, mood photos on key slides, all credited', () => {
  for (const o of OCCASIONS) for (let s = 0; s < 5; s++) {
    const decks = buildDirections({ pool: SAMPLE_POOL, occasionId: o.id, seed: s, family: 'poster' });
    assert.deepEqual(decks.map((d) => d.direction.family), ['poster', 'poster', 'poster']);
    for (const deck of decks) {
      assert.deepEqual(deck.overflow, [], `${deck.direction.id}/${deck.structure.id}`);
      const cover = deck.slides[0];
      assert.ok(cover.mood, `${deck.direction.id} cover has a photo`);
      const refs = deck.slides.find((x) => x.form === 'references');
      const moods = deck.slides.flatMap((x) => [x.mood, x.fillMood]).filter(Boolean);
      if (refs) for (const m of moods) assert.ok(refs.item.entries.includes(m.citation), `${m.base} not credited`);
    }
  }
});

test('lighter decks are shorter than denser decks', () => {
  const light = buildDirections({ pool: SAMPLE_POOL, occasionId: 'seminar', density: 'light', seed: 1 });
  const dense = buildDirections({ pool: SAMPLE_POOL, occasionId: 'seminar', density: 'dense', seed: 1 });
  light.forEach((d, i) => assert.ok(d.slides.length < dense[i].slides.length, d.structure.id));
});

test('text fitting shrinks to fit and reports when it cannot', () => {
  assert.equal(countLines('one two three', 10, 12, 0.5).lines, 1);
  const r = fitText('A long sentence that needs to wrap over several lines in a narrow box', 2, 2, { max: 40, min: 10, factor: 0.5 });
  assert.ok(r.fits && r.size < 40);
  assert.equal(fitText('word '.repeat(400), 2, 1, { max: 20, min: 12, factor: 0.5 }).fits, false);
});
