import { test } from 'node:test';
import { widthEm } from '../src/library/glyphs.js';
import { countLinesMeasured } from '../src/engine/fit.js';
import assert from 'node:assert/strict';
import { buildDirections, buildDeck } from '../src/engine/build.js';
import { distance, sampleDirections } from '../src/engine/sampler.js';
import { fitText, countLines, SLIDE_W, SLIDE_H } from '../src/engine/fit.js';
import { DIRECTIONS } from '../src/library/directions.js';
import { OCCASIONS } from '../src/library/occasions.js';
import { STRUCTURES } from '../src/library/structures.js';
import { FONTS } from '../src/library/fonts.js';
import { contrast } from '../src/library/forms.js';
import { SAMPLE_POOL } from '../src/sample/great-vowel-shift.js';
import { kitFor, invertPalette, SHARE } from '../src/library/accents.js';

const DENSITIES = ['light', 'medium', 'dense'];
const TONES = ['formal', 'neutral', 'relaxed'];

test('library is complete and consistent', () => {
  assert.equal(DIRECTIONS.filter((d) => !d.family || d.family === 'editorial').length, 15);
  assert.equal(DIRECTIONS.filter((d) => d.family === 'poster').length, 3);
  assert.equal(DIRECTIONS.filter((d) => d.family === 'glass').length, 3);
  assert.equal(DIRECTIONS.filter((d) => d.family === 'texture').length, 3);
  assert.equal(new Set(DIRECTIONS.map((d) => d.id)).size, 24);
  for (const d of DIRECTIONS) {
    for (const role of ['display', 'body', 'label', ...(d.family === 'poster' || d.family === 'glass' ? ['poster'] : [])]) assert.ok(FONTS[d.fonts[role]], `${d.id} ${role} font`);
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

test('glass decks: three glass directions, fitted text, glass that holds content, no chrome objects', () => {
  for (const o of OCCASIONS) for (const density of DENSITIES) for (let s = 0; s < 4; s++) {
    const decks = buildDirections({ pool: SAMPLE_POOL, occasionId: o.id, density, seed: s, family: 'glass' });
    assert.deepEqual(decks.map((d) => d.direction.family), ['glass', 'glass', 'glass']);
    assert.equal(new Set(decks.map((d) => d.direction.id)).size, 3);
    for (const deck of decks) {
      const name = `${deck.direction.id}/${deck.structure.id}/${density}`;
      assert.deepEqual(deck.overflow, [], name);
      const els = deck.slides.flatMap((x) => x.els);
      assert.ok(!els.some((e) => e.type === 'chrome'), `${name}: no decorative chrome objects`);
      assert.ok(els.some((e) => e.glass || e.glow), `${name}: uses glass or glow`);
      for (const sl of deck.slides) {
        // one hero effect: at most one glowing card per slide
        assert.ok(sl.els.filter((e) => e.type === 'rect' && e.glow && e.h > 1.5).length <= 1, `${name} ${sl.form}: more than one glowing card`);
        // body text must never sit on a holo fill
        assert.ok(!sl.els.some((e) => e.type === 'rect' && e.gradient && e.h > 0.2), `${name} ${sl.form}: large holo fill`);
      }
    }
  }
});

test('glass directions: holo letters only where every gradient stop reads on the background', () => {
  for (const d of DIRECTIONS.filter((x) => x.family === 'glass')) {
    if (d.fx.titleGradient) for (const stop of d.fx.holo) assert.ok(contrast(stop, d.colors.bg) >= 4.5, `${d.id} holo stop ${stop}`);
  }
});

test('texture decks: three texture directions with fitted text', () => {
  for (const o of OCCASIONS) for (const density of DENSITIES) for (let s = 0; s < 3; s++) {
    const decks = buildDirections({ pool: SAMPLE_POOL, occasionId: o.id, density, seed: s, family: 'texture' });
    assert.deepEqual(decks.map((d) => d.direction.family), ['texture', 'texture', 'texture']);
    assert.equal(new Set(decks.map((d) => d.direction.id)).size, 3);
    for (const deck of decks) assert.deepEqual(deck.overflow, [], `${deck.direction.id}/${deck.structure.id}/${density}`);
  }
});

test('design kits: every direction has a kit of at least two effects', () => {
  for (const d of DIRECTIONS) assert.ok(kitFor(d).length >= 2, `${d.id} kit`);
});

test('design kits: effects on about a third of the slides, never on dense slides, never twice in a row', () => {
  const plain = new Set(['points', 'comparison', 'references', 'photo', 'photoSplit']);
  for (const family of ['editorial', 'poster', 'glass', 'texture']) for (const o of OCCASIONS) for (let s = 0; s < 4; s++) {
    for (const deck of buildDirections({ pool: SAMPLE_POOL, occasionId: o.id, seed: s, family })) {
      const name = `${deck.direction.id}/${deck.structure.id}`;
      const acc = deck.slides.map((x) => x.accent);
      const n = acc.filter(Boolean).length;
      // textures are decoration, so only the cover may carry one; invert is a plain second tone
      deck.slides.forEach((sl) => { if (sl.accent?.kind === 'texture') assert.equal(sl.form, 'cover', `${name}: texture on a ${sl.form} slide`); if (sl.accent?.kind === 'invert') assert.ok(!sl.accent.texture, `${name}: texture over inverted content`); });
      assert.ok(n <= Math.round(deck.slides.length * SHARE), `${name}: ${n} of ${deck.slides.length} slides carry an effect`);
      deck.slides.forEach((sl, i) => {
        if (sl.accent) assert.ok(!plain.has(sl.form), `${name}: effect on a ${sl.form} slide`);
        if (i && sl.accent && acc[i - 1]) {
          assert.notEqual(sl.accent.id, acc[i - 1].id, `${name}: ${sl.accent.id} twice in a row`);
          assert.ok(!(sl.accent.strong && acc[i - 1].strong), `${name}: two strong effects side by side`);
        }
        const tex = sl.els.filter((e) => e.type === 'svg');
        assert.ok(tex.length <= 1, `${name} ${sl.form}: ${tex.length} textures`);
        if (tex.length) assert.ok(sl.els.indexOf(tex[0]) <= 1, `${name} ${sl.form}: texture sits behind the content`);
      });
    }
  }
});

test('design kits: a deck is not one look repeated (most slides differ from their neighbour)', () => {
  for (let s = 0; s < 6; s++) for (const deck of buildDirections({ pool: SAMPLE_POOL, occasionId: 'seminar', seed: s, family: 'texture' })) {
    const plainCount = deck.slides.filter((x) => !x.accent).length;
    assert.ok(plainCount >= deck.slides.length / 2, `${deck.direction.id}: only ${plainCount} plain slides`);
  }
});

test('design kits: the second tone stays readable in every direction', () => {
  for (const d of DIRECTIONS) {
    if (!kitFor(d).some((a) => a.kind === 'invert')) continue;
    const c = invertPalette({ ...d.colors }, contrast);
    assert.ok(contrast(c.ink, c.bg) >= 7, `${d.id} inverted ink`);
    assert.ok(contrast(c.muted, c.bg) >= 4.5, `${d.id} inverted muted ${contrast(c.muted, c.bg).toFixed(2)}`);
    assert.ok(contrast(c.accentText, c.bg) >= 3, `${d.id} inverted accent`);
  }
});

test('textures are reproducible from their seed and differ between decks', async () => {
  const { textureSvg } = await import('../src/library/textures.js');
  for (const kind of ['contour', 'grid', 'grain', 'film', 'heat', 'ripple', 'landscape', 'graphite', 'fluted']) {
    const o = { color: '#336655', colors: ['#F6A27E', '#B9A4FF'] };
    assert.equal(textureSvg(kind, { ...o, seed: 'a' }), textureSvg(kind, { ...o, seed: 'a' }), `${kind} same seed`);
    assert.notEqual(textureSvg(kind, { ...o, seed: 'a' }), textureSvg(kind, { ...o, seed: 'b' }), `${kind} new seed`);
  }
});

test('phonetic forms keep their case: capitals-only faces never set the before/after tokens', () => {
  for (const family of ['poster', 'texture', 'editorial', 'glass']) for (let s = 0; s < 6; s++) {
    for (const deck of buildDirections({ pool: SAMPLE_POOL, occasionId: 'seminar', seed: s, family })) {
      for (const sl of deck.slides.filter((x) => x.form === 'pair')) {
        const tokens = sl.els.filter((e) => e.type === 'text' && e.text.startsWith('/'));
        for (const t of tokens) assert.ok(!FONTS[t.font].capsOnly && !t.caps, `${deck.direction.id}: ${t.text} in ${t.font}`);
      }
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

test('the glowing key-figure panel never runs into the text around it', () => {
  const overlaps = (a, b) => !(a.x + a.w <= b.x || a.x >= b.x + b.w || a.y + a.h <= b.y || a.y >= b.y + b.h);
  for (const family of ['editorial', 'poster', 'glass', 'texture']) for (const o of OCCASIONS) for (const density of DENSITIES) for (let s = 0; s < 4; s++) {
    for (const deck of buildDirections({ pool: SAMPLE_POOL, occasionId: o.id, density, seed: s, family })) {
      for (const sl of deck.slides) {
        const panel = sl.els.find((e) => e.accent === 'glow');
        if (!panel) continue;
        const fig = sl.els[sl.els.indexOf(panel) + 1];
        for (const t of sl.els.filter((e) => e.type === 'text' && e !== fig && e.text?.trim())) {
          assert.ok(!overlaps(panel, t), `${deck.direction.id} ${sl.form}: glow panel covers "${t.text.slice(0, 30)}"`);
        }
      }
    }
  }
});

test('open process steps draw no cards, and step headings stay below the slide headline', () => {
  for (const o of OCCASIONS) for (const density of DENSITIES) for (let s = 0; s < 4; s++) {
    for (const deck of buildDirections({ pool: SAMPLE_POOL, occasionId: o.id, density, seed: s, family: 'texture' })) {
      if (deck.direction.layout.steps !== 'open') continue;
      for (const sl of deck.slides.filter((x) => x.form === 'process')) {
        const cards = sl.els.filter((e) => e.type === 'rect' && e.w < SLIDE_W - 0.1);
        if (sl.item.steps.length <= 4) assert.equal(cards.length, 0, `${deck.direction.id}: ${cards.length} cards on a process slide`);
        const display = sl.els.filter((e) => e.type === 'text' && e.role === 'display' && e.text.trim().split(/\s+/).length > 1).map((e) => e.size);
        const [head, ...rest] = display;
        for (const size of rest) assert.ok(head >= size * 1.4, `${deck.direction.id}: step heading ${size}pt against headline ${head}pt`);
      }
    }
  }
});

test('cover text never runs into the author line, even with a long title', () => {
  // at the app's own limits: deck titles are clipped to 80 characters, subtitles to 90
  const long = { ...SAMPLE_POOL, title: 'Why English spelling stopped matching its sounds, and why it still matters today', subtitle: 'The Great Vowel Shift, c. 1400–1700, and what it left behind in our modern spelling' };
  // poster and glass draw their own covers (posters layer giant words over the text on purpose)
  for (const pool of [SAMPLE_POOL, long]) for (const direction of DIRECTIONS.filter((d) => d.family !== 'poster' && d.family !== 'glass')) {
    const deck = buildDeck({ deck: { ...pool, occasionLabel: 'Seminar presentation' }, direction, structure: STRUCTURES[0] });
    // measure the lines actually set, not the box reserved for them
    const span = (e) => {
      const f = FONTS[e.font] ?? { factor: 0.55 };
      const factor = ((e.caps ? f.capsFactor ?? f.factor * 1.08 : f.factor) + (e.tracking ?? 0)) * (e.bold ? 1.06 : 1) * (/\d.*\d/.test(e.text) && e.text.replace(/\D/g, '').length / e.text.length > 0.5 ? 1.3 : 1);
      const content = e.caps ? e.text.toUpperCase() : e.text;
      const mk = FONTS[e.font]?.metrics ?? e.font;
      const measure = widthEm(mk, 'a') != null ? (str) => widthEm(mk, str, e.bold) + (e.tracking ?? 0) * [...str].length : null;
      const { lines } = measure ? countLinesMeasured(content, e.w, e.size, measure) : countLines(e.text, e.w, e.size, factor);
      const hh = lines * (e.size / 72) * (e.lineHeight ?? 1.2);
      const top = e.valign === 'bottom' ? e.y + e.h - hh : e.valign === 'middle' ? e.y + (e.h - hh) / 2 : e.y;
      return { top, bottom: top + hh };
    };
    const texts = deck.slides[0].els.filter((e) => e.type === 'text' && e.text?.trim()).map((e) => ({ e, ...span(e) })).sort((a, b) => a.top - b.top);
    for (let i = 0; i < texts.length; i++) for (let j = i + 1; j < texts.length; j++) {
      const a = texts[i], b = texts[j];
      const sameColumn = a.e.x < b.e.x + b.e.w && b.e.x < a.e.x + a.e.w;
      if (sameColumn) assert.ok(a.bottom <= b.top + 0.02, `${direction.id} cover: "${a.e.text.slice(0, 24)}" runs into "${b.e.text.slice(0, 24)}"`);
    }
  }
});

test('one-line words and figures fit their box by real glyph width: "PLYOMETRIE" and "+12 %" stay whole', async () => {
  const { widthEm } = await import('../src/library/glyphs.js');
  const { toPool } = await import('../src/engine/content.js');
  const pool = { ...SAMPLE_POOL, posterWords: ['PLYOMETRIE', 'SPRUNGKRAFT', 'HANDBALLSPIELERN'], items: [...SAMPLE_POOL.items, ...toPool({ deck: { title: 'x' }, figures: [{ title: 'Sprunghöhe', value: '+12 %', label: 'mehr' }, { title: 'Quote', value: '40,5 %', label: 'mehr' }], claims: [{ text: 'a' }, { text: 'b' }] }).items.filter((i) => i.kind === 'figure')] };
  let checked = 0;
  for (const family of ['poster', 'glass', 'texture', 'editorial']) for (let s = 0; s < 4; s++) {
    for (const deck of buildDirections({ pool, occasionId: 'seminar', density: 'dense', seed: s, family })) {
      for (const sl of deck.slides) for (const e of sl.els) {
        if (e.type !== 'text' || !e.nowrap) continue;
        const em = widthEm(FONTS[e.font]?.metrics ?? e.font, e.caps ? e.text.toUpperCase() : e.text, e.bold);
        if (em == null) continue;
        const run = e.rotate === 90 || e.rotate === -90 ? e.h : e.w;
        const width = (em + (e.tracking ?? 0) * [...e.text].length) * (e.size / 72);
        assert.ok(width <= run + 1e-6, `${deck.direction.id} ${sl.form}: "${e.text}" is ${width.toFixed(2)}in wide in a ${run.toFixed(2)}in box`);
        checked++;
      }
    }
  }
  assert.ok(checked > 50, `checked ${checked} one-line texts`);
});
