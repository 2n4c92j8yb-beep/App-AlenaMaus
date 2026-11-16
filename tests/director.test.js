import { test } from 'node:test';
import assert from 'node:assert/strict';
import { toSpec, directionFor, catalogue, briefOf, excerpt, jsonPrompt, userPrompt, SYSTEM_PROMPT, MAX_SLIDES } from '../src/engine/director.js';
import { buildDirected, buildDirections, directOrSample } from '../src/engine/build.js';
import { withIds, planOf, resolvePlan, applyPlans, deckKey, emptyEdits, moveSlide, deleteSlide, setItem, applyEdits } from '../src/engine/edits.js';
import { sampleDirections } from '../src/engine/sampler.js';
import { TELLS, toHsl } from '../src/engine/match.js';
import { DIRECTIONS, byId } from '../src/library/directions.js';
import { OCCASIONS } from '../src/library/occasions.js';
import { contrast } from '../src/library/forms.js';
import { SAMPLE_POOL } from '../src/sample/great-vowel-shift.js';
import { directDeck, EFFORT } from '../api/direct.js';
import { MODEL } from '../api/generate.js';

const pool = withIds(SAMPLE_POOL);
const id = (kind, n = 0) => pool.items.filter((it) => it.kind === kind)[n].id;
const THESIS = pool.items.find((it) => it.tags?.includes('thesis')).id;
const HOOK = pool.items.find((it) => it.tags?.includes('hook')).id;
const opts = { occasionId: 'seminar', formality: 'neutral', seed: 't' };

// What a sensible art director might answer for the sample deck.
const ANSWER = {
  direction: 'archive',
  accentHue: 150,
  why: 'A talk about medieval manuscripts and old spellings suits warm paper and book type.',
  slides: [
    { id: HOOK, kicker: 'A puzzle' },
    { id: THESIS, moment: 'loud' },
    { section: 'How it moved' },
    { id: id('definition') },
    { id: id('pair'), kicker: '' },
    { id: id('timeline') },
    { id: id('image'), moment: 'quiet' },
    { section: 'What it left behind' },
    { id: id('figure', 1) },
    { id: id('comparison'), kicker: 'Objection' },
    { id: id('question', 1) },
  ],
  dropped: [id('points'), id('quote')],
};

const forms = (spec) => spec.plan.map((s) => s.form);

// ---------------------------------------------------------------- the prompt

test('the prompt names the tells and offers only editorial directions that suit the occasion', () => {
  for (const tell of TELLS) assert.ok(SYSTEM_PROMPT.includes(tell), tell);
  assert.ok(jsonPrompt().includes('"direction"') && jsonPrompt().includes('"dropped"'));
  for (const o of OCCASIONS) {
    const offered = catalogue(o.id);
    assert.ok(offered.length >= 3, o.id);
    assert.ok(offered.every((d) => (d.family ?? 'editorial') === 'editorial' && d.suits[o.id] > 0), o.id);
  }
  const prompt = userPrompt(pool, { occasionId: 'pitch', avoid: ['swiss'] });
  assert.ok(prompt.includes('- signal (Signal)') && !prompt.includes('- swiss ') && !prompt.includes('- prism '), 'no avoided or glass direction');
  assert.ok(!prompt.includes('- archive '), 'Archive does not suit a pitch');
  assert.ok(prompt.includes(`${THESIS} | claim | thesis | 3 | `));
  assert.ok(!/titlePos|boldDisplay|signature|#[0-9A-F]{6}/.test(prompt), 'no layout internals or colour codes');
});

test('the brief carries one line per piece and never a picture', () => {
  const brief = briefOf({ ...pool, items: pool.items.map((it) => (it.kind === 'image' ? { ...it, src: `data:image/jpeg;base64,${'A'.repeat(5000)}` } : it)) });
  assert.ok(JSON.stringify(brief).length < 6000);
  assert.deepEqual(brief.items.map((it) => it.id), pool.items.map((it) => it.id));
  assert.ok(brief.items.filter((it) => it.kind !== 'sources').every((it) => it.excerpt.length > 10 && it.excerpt.length <= 170));
  assert.match(excerpt(pool.items.find((it) => it.kind === 'timeline')), /dated events/);
  assert.deepEqual(briefOf(brief), brief, 'a brief stays as it is');
  assert.deepEqual(briefOf({ items: 'nonsense' }).items, []);
});

// ---------------------------------------------------------------- checking and repairing

test('a valid spec becomes the expected plan', () => {
  const spec = toSpec(ANSWER, pool, opts);
  assert.deepEqual(spec.warnings, []);
  assert.equal(spec.direction, 'archive');
  assert.equal(spec.accentHue, 150);
  assert.equal(spec.why, ANSWER.why);
  assert.deepEqual(forms(spec), ['cover', 'question', 'statement', 'section', 'definition', 'pair', 'timeline', 'photo', 'section', 'bigNumber', 'comparison', 'question', 'references']);
  assert.deepEqual(spec.plan[1], { form: 'question', id: HOOK, kicker: 'A puzzle', sectionNo: 0 });
  assert.deepEqual(spec.plan[2], { form: 'statement', id: THESIS, moment: 'loud', sectionNo: 0 });
  assert.deepEqual(spec.plan[3], { form: 'section', item: { number: 1, label: 'How it moved' }, sectionNo: 1 });
  assert.equal(spec.plan[9].sectionNo, 2);
  assert.equal(spec.plan.at(-1).id, id('sources'));
  assert.deepEqual(spec.dropped, ANSWER.dropped);
  // a checked spec passes through unchanged (the app checks the server's answer again)
  const again = toSpec(spec, pool, opts);
  assert.deepEqual(again, spec);
});

test('unknown and repeated pieces are left out, with warnings', () => {
  const spec = toSpec({ ...ANSWER, slides: [...ANSWER.slides, { id: 'claim-99' }, { id: THESIS }, { id: id('sources') }, 'nonsense', null], dropped: ['claim-99', THESIS, id('points')] }, pool, opts);
  assert.equal(spec.plan.filter((s) => s.id === THESIS).length, 1);
  assert.equal(spec.plan.filter((s) => s.form === 'references').length, 1);
  assert.ok(spec.warnings.some((w) => /claim-99.*no such piece/.test(w)));
  assert.ok(spec.warnings.some((w) => /second/.test(w)));
  assert.deepEqual(spec.dropped, [id('points')], 'only real pieces that the deck does not show');
});

test('three slides of one kind in a row: the third moves, or goes when no place is free', () => {
  const claims = pool.items.filter((it) => it.kind === 'claim').map((it) => ({ id: it.id }));
  const spec = toSpec({ direction: 'archive', slides: [...claims.slice(0, 3), { id: id('timeline') }, { id: id('figure') }] }, pool, opts);
  assert.deepEqual(forms(spec), ['cover', 'statement', 'statement', 'timeline', 'statement', 'bigNumber', 'references']);
  assert.ok(spec.warnings.some((w) => /Moved .* third statement slide in a row/.test(w)));
  const stuck = toSpec({ direction: 'archive', slides: [{ id: id('timeline') }, { id: id('figure') }, ...claims] }, pool, opts);
  assert.equal(stuck.plan.filter((s) => s.form === 'statement').length, 2);
  assert.ok(stuck.warnings.some((w) => /Left out .* no other place was free/.test(w)));
  // two pictures count as one kind of slide, whatever their form
  for (const s of [spec, stuck]) for (let i = 2; i < s.plan.length; i++) assert.ok(new Set(s.plan.slice(i - 2, i + 1).map((x) => x.form)).size > 1);
});

test('a missing thesis is added: after an opening question, otherwise first', () => {
  const rest = [{ id: id('definition') }, { id: id('timeline') }, { id: id('figure') }];
  const hooked = toSpec({ direction: 'archive', slides: [{ id: HOOK }, ...rest] }, pool, opts);
  assert.deepEqual(hooked.plan.slice(1, 3).map((s) => s.id), [HOOK, THESIS]);
  const plain = toSpec({ direction: 'archive', slides: [{ section: 'One' }, ...rest, { section: 'Two' }, { id: id('pair') }] }, pool, opts);
  assert.deepEqual(plain.plan.slice(1, 3).map((s) => s.form), ['section', 'statement'], 'inside the first section');
  assert.equal(plain.plan[2].id, THESIS);
  for (const s of [hooked, plain]) assert.ok(s.warnings.some((w) => /Added the thesis/.test(w)));
});

test('a direction that is unknown, of another look, unsuited or already shown gives way to the sampler’s pick', () => {
  const first = (avoid = []) => sampleDirections({ occasionId: 'seminar', formality: 'neutral', seed: 't', count: 99, minDistance: 0, family: 'editorial' }).find((d) => !avoid.includes(d.id)).id;
  const glass = toSpec({ ...ANSWER, direction: 'prism' }, pool, opts);
  assert.equal(glass.direction, first());
  assert.equal(glass.accentHue, undefined, 'the hue was chosen for another look');
  assert.equal(glass.why, '');
  assert.ok(glass.warnings.some((w) => /glass look.*not open/.test(w)));
  assert.ok(toSpec({ ...ANSWER, direction: 'nonsense' }, pool, opts).warnings.some((w) => /does not exist/.test(w)));
  assert.ok(toSpec({ ...ANSWER, direction: undefined }, pool, opts).warnings.some((w) => /No direction was chosen/.test(w)));
  const pitch = toSpec(ANSWER, pool, { ...opts, occasionId: 'pitch' });
  assert.ok(byId(pitch.direction).suits.pitch > 0);
  assert.ok(pitch.warnings.some((w) => /does not suit this occasion/.test(w)));
});

test('avoid is respected: by the catalogue, the check and the fallback', () => {
  assert.ok(!catalogue('seminar', ['archive']).some((d) => d.id === 'archive'));
  const spec = toSpec(ANSWER, pool, { ...opts, avoid: ['archive'] });
  assert.notEqual(spec.direction, 'archive');
  assert.ok(spec.warnings.some((w) => /already shown/.test(w)));
  const others = DIRECTIONS.filter((d) => (d.family ?? 'editorial') === 'editorial' && d.id !== 'margin').map((d) => d.id);
  assert.equal(toSpec({ ...ANSWER, direction: 'swiss' }, pool, { ...opts, avoid: others }).direction, 'margin', 'the only one left');
  // every direction seen: start over rather than offer nothing
  assert.equal(toSpec(ANSWER, pool, { ...opts, avoid: [...others, 'margin'] }).direction, 'archive');
});

test('rhythm limits: two points slides, two loud moments, real sections only, a bounded deck', () => {
  const many = { ...pool, items: [...pool.items, ...[1, 2].map((n) => ({ id: `points-x${n}`, kind: 'points', weight: 2, title: `More points ${n}`, points: [{ head: 'a' }, { head: 'b' }] }))] };
  const spec = toSpec({
    direction: 'archive', accentHue: 400,
    slides: [{ id: id('points'), moment: 'loud' }, { id: THESIS, moment: 'loud' }, { id: 'points-x1' }, { id: id('figure'), moment: 'loud' }, { id: 'points-x2' }, { section: 'Lonely' }, { id: id('pair'), moment: 'whisper' }, { section: 'Empty' }],
  }, many, opts);
  assert.equal(spec.plan.filter((s) => s.form === 'points').length, 2);
  assert.equal(spec.plan.filter((s) => s.moment === 'loud').length, 2);
  assert.equal(spec.plan.filter((s) => s.moment).length, 2, 'an unknown moment is dropped');
  assert.equal(spec.plan.filter((s) => s.form === 'section').length, 0);
  assert.equal(spec.accentHue, undefined);
  for (const re of [/at most 2 points slides/, /at most 2 loud moments/, /no slides followed it/, /single divider/, /accent hue/]) assert.ok(spec.warnings.some((w) => re.test(w)), String(re));
  const big = { ...pool, items: Array.from({ length: 40 }, (_, i) => ({ id: `p-${i}`, kind: ['claim', 'figure', 'quote'][i % 3], weight: 2, text: `Piece ${i}`, title: `Piece ${i}`, value: '1', label: 'x', author: 'A' })) };
  assert.equal(toSpec({ direction: 'archive', slides: big.items.map((it) => ({ id: it.id })) }, big, opts).plan.length, MAX_SLIDES + 1);
});

test('an empty or useless spec is refused', () => {
  for (const bad of [null, {}, [], 'text', { direction: 'archive', slides: [] }, { direction: 'archive', slides: [{ id: 'x' }, { id: 'y' }, { section: 'S' }] }]) {
    assert.throws(() => toSpec(bad, { ...pool, items: pool.items.filter((it) => !it.tags?.includes('thesis')) }, opts), /too few usable slides/);
  }
  assert.throws(() => toSpec({}, pool, opts), /too few/, 'the thesis alone is no deck');
});

// ---------------------------------------------------------------- the server call

const fake = (reply, seen = {}) => ({ seen, beta: { messages: { create: async (params) => { seen.params = params; if (reply instanceof Error) throw reply; return reply; } } } });
const text = (t, stop = 'end_turn') => ({ stop_reason: stop, content: [{ type: 'thinking', thinking: '' }, { type: 'text', text: t }] });

test('the server asks Claude at medium effort with the fallback on, and returns the checked spec', async () => {
  const client = fake(text('```json\n' + JSON.stringify({ ...ANSWER, slides: [...ANSWER.slides, { id: 'claim-99' }] }) + '\n```'));
  const spec = await directDeck({ pool, ...opts, avoid: ['swiss', 7] }, client);
  assert.deepEqual(spec.plan, toSpec(ANSWER, pool, opts).plan);
  assert.equal(spec.warnings.length, 1);
  const sent = client.seen.params;
  assert.equal(sent.model, MODEL);
  assert.equal(EFFORT, 'medium');
  assert.equal(sent.output_config.effort, 'medium');
  assert.equal(sent.fallbacks, 'default');
  assert.ok(sent.betas.includes('server-side-fallback-2026-07-01'));
  assert.ok(sent.system.includes('art director') && sent.system.includes('"slides"'));
  assert.ok(sent.messages[0].content.includes(THESIS) && !sent.messages[0].content.includes('- swiss '));
  assert.ok(!sent.messages[0].content.includes('data:image'));
});

test('a refusal, a cut-off answer, unreadable JSON and an empty spec are errors on the server', async () => {
  await assert.rejects(directDeck({ pool, ...opts }, fake(text('', 'refusal'))), (e) => e.status === 422 && /declined/.test(e.message));
  await assert.rejects(directDeck({ pool, ...opts }, fake(text('{"direction":', 'max_tokens'))), (e) => e.status === 502 && /incomplete/.test(e.message));
  await assert.rejects(directDeck({ pool, ...opts }, fake(text('Here are my thoughts, no JSON.'))), (e) => e.status === 502 && /could not be read/.test(e.message));
  await assert.rejects(directDeck({ pool: { ...pool, items: pool.items.filter((it) => !it.tags?.includes('thesis')) }, ...opts }, fake(text('{"direction":"archive","slides":[]}'))), (e) => e.status === 502 && /too few/.test(e.message));
});

// ---------------------------------------------------------------- the deck

test('a directed deck is drawn in the chosen direction with its accent hue, without overflow', () => {
  const spec = toSpec(ANSWER, pool, opts);
  const deck = buildDirected({ pool, spec, occasionId: 'seminar' });
  assert.equal(deck.direction.id, 'archive');
  assert.equal(deck.structure.id, 'director');
  assert.equal(deck.why, ANSWER.why);
  assert.ok(deck.directed);
  assert.deepEqual(deck.slides.map((s) => s.form), forms(spec));
  assert.deepEqual(deck.overflow, []);
  // the accent moved to green, and stays readable on the direction's own background
  const hue = toHsl(deck.direction.colors.accent).h;
  assert.ok(Math.abs(hue - 150) < 12, `hue ${hue}`);
  assert.ok(contrast(deck.direction.colors.accent, deck.direction.colors.bg) >= 3);
  assert.equal(deck.direction.colors.bg, byId('archive').colors.bg);
  assert.equal(deck.direction.fonts, byId('archive').fonts);
  assert.equal(byId('archive').colors.accent, '#7A2E2A', 'the library itself is untouched');
  // no hue, or one close to the direction's own: the direction as it is
  assert.equal(directionFor({ direction: 'archive' }), byId('archive'));
  assert.equal(directionFor({ direction: 'archive', accentHue: Math.round(toHsl('#7A2E2A').h) + 4 }), byId('archive'));
  assert.equal(directionFor({ direction: 'prism' }), null);
  // a direction with its own text and on-accent colours gets new ones with a new hue
  const poster = directionFor({ direction: 'poster', accentHue: 200 });
  assert.equal(poster.colors.accentText, undefined);
  assert.equal(poster.colors.onAccent, undefined);
});

test('every editorial direction draws the sample spec at every hue step without overflow or unreadable accents', () => {
  for (const d of DIRECTIONS.filter((x) => (x.family ?? 'editorial') === 'editorial')) for (const accentHue of [undefined, 0, 90, 180, 270]) for (const density of ['light', 'medium', 'dense']) {
    const spec = { ...toSpec({ ...ANSWER, direction: d.id }, pool, { ...opts, occasionId: OCCASIONS.find((o) => d.suits[o.id] > 0).id }), accentHue };
    const deck = buildDirected({ pool, spec, occasionId: 'seminar', density });
    assert.equal(deck.direction.id, d.id);
    assert.deepEqual(deck.overflow, [], `${d.id}/${accentHue}/${density}`);
    if (deck.direction.adaptedFrom) assert.ok(contrast(deck.direction.colors.accent, deck.direction.colors.bg) >= 3, `${d.id}/${accentHue}`);
  }
});

test('the loud statement fills the slide with the accent colour, in the slide data both renderers draw from', () => {
  const deck = buildDirected({ pool, spec: toSpec(ANSWER, pool, opts), occasionId: 'seminar' });
  const loud = deck.slides.find((s) => s.moment === 'loud');
  assert.equal(loud.form, 'statement');
  assert.equal(loud.accent, undefined, 'the loud moment is the effect; it takes no texture or second tone on top');
  const full = (s) => s.els.find((e) => e.type === 'rect' && e.w >= 13.3 && e.h >= 7.49);
  assert.equal(full(loud).fill, deck.direction.colors.accent);
  const words = loud.els.find((e) => e.type === 'text' && e.role === 'display');
  assert.ok(contrast(words.color, deck.direction.colors.accent) >= 3, 'the statement is readable on the accent');
  const quietStatement = buildDirected({ pool, spec: toSpec({ ...ANSWER, slides: ANSWER.slides.map((s) => ({ ...s, moment: undefined })) }, pool, opts), occasionId: 'seminar' }).slides.find((s) => s.form === 'statement');
  assert.notEqual(full(quietStatement).fill, deck.direction.colors.accent);
  // the HTML preview and the PowerPoint export share one element list per slide: everything
  // a directed deck shows is in it, as element types both renderers know
  const KNOWN = new Set(['text', 'rect', 'ellipse', 'image', 'chrome', 'svg', 'line', 'arrow']);
  for (const s of deck.slides) {
    assert.ok(s.els.length > 0);
    assert.ok(s.els.every((e) => KNOWN.has(e.type)), s.form);
    assert.ok(s.els.every((e) => e.type === 'svg' || e.type === 'line' || e.type === 'arrow' || [e.x, e.y, e.w, e.h].every(Number.isFinite)), `${s.form}: positions in inches`);
  }
  assert.deepEqual(JSON.parse(JSON.stringify(deck.slides.map((s) => s.els))), deck.slides.map((s) => JSON.parse(JSON.stringify(s.els))), 'plain data, nothing renderer-only');
});

test('a directed deck survives planOf and resolvePlan, and takes edits like any other deck', () => {
  const spec = toSpec(ANSWER, pool, opts);
  const deck = buildDirected({ pool, spec, occasionId: 'seminar' });
  const stored = planOf(deck);
  assert.deepEqual(stored, spec.plan, 'the stored order is the spec’s plan');
  assert.deepEqual(resolvePlan(JSON.parse(JSON.stringify(stored)), pool).map((s) => [s.form, s.item?.id, s.moment]), deck.slides.map((s) => [s.form, s.item?.id, s.moment]));
  // moving and deleting slides keeps the loud moment with its slide
  let edits = moveSlide(emptyEdits(), deck, 2, 1);
  let [edited] = applyPlans([deck], pool, edits);
  assert.deepEqual(edited.slides.slice(2, 4).map((s) => s.form), ['section', 'statement']);
  assert.equal(edited.slides[3].moment, 'loud');
  assert.equal(deckKey(edited), 'archive|director|medium');
  edits = deleteSlide(edits, edited, 1);
  [edited] = applyPlans([deck], pool, edits);
  assert.equal(edited.slides.length, deck.slides.length - 1);
  // edited content shows on the directed deck
  edits = setItem(edits, THESIS, { ...pool.items.find((it) => it.id === THESIS), text: 'My own sharper thesis.' });
  const p = applyEdits(pool, edits);
  [edited] = applyPlans([buildDirected({ pool: p, spec, occasionId: 'seminar' })], p, edits);
  assert.ok(edited.slides.find((s) => s.item?.id === THESIS).els.some((e) => e.type === 'text' && /sharper thesis/i.test(e.text)));
  // another take has its own saved order
  assert.equal(deckKey(buildDirected({ pool, spec, occasionId: 'seminar', take: 2 })), 'archive|director-2|medium');
  // a spec whose pieces are not in this pool makes no deck
  assert.equal(buildDirected({ pool: { ...pool, items: pool.items.slice(0, 2) }, spec, occasionId: 'seminar' }), null);
});

test('a refusal, unreadable JSON and an empty spec fall back to the sampled directions', async () => {
  const classic = buildDirections({ pool, occasionId: 'seminar', seed: 't', family: 'editorial' }).map((d) => d.direction.id);
  const run = (client, extra = {}) => directOrSample({ ask: (body) => directDeck(body, client), pool, occasionId: 'seminar', seed: 't', ...extra });
  for (const reply of [text('', 'refusal'), text('no JSON at all'), text('{"direction":"archive","slides":[]}'), text('{"slides":[{"id":"nope"}]}'), new Error('network down')]) {
    const out = await run(fake(reply));
    assert.equal(out.directed, null);
    assert.deepEqual(out.decks.map((d) => d.direction.id), classic);
  }
  // and with a good answer: the directed deck, the classic three still at hand
  const client = fake(text(JSON.stringify(ANSWER)));
  const good = await run(client, { avoid: ['swiss'], take: 1 });
  assert.equal(good.directed.direction.id, 'archive');
  assert.equal(good.directed.structure.id, 'director-1');
  assert.deepEqual(good.decks.map((d) => d.direction.id), classic);
  assert.ok(!client.seen.params.messages[0].content.includes('- swiss '), 'avoid reaches the prompt');
  assert.ok(!JSON.stringify(client.seen.params).includes('"src"'), 'only the brief leaves the device');
});
