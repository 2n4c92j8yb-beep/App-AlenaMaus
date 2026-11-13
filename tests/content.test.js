import { test } from 'node:test';
import assert from 'node:assert/strict';
import { toPool, parseAnswer, copyPastePrompt, clip } from '../src/engine/content.js';
import { buildDirections } from '../src/engine/build.js';
import { OCCASIONS } from '../src/library/occasions.js';
import { writeDeck, AnswerSchema, MODEL } from '../api/generate.js';

// A realistic answer, in the shape the model returns.
const ANSWER = {
  deck: { title: 'Wearables can make effort in PE visible', shortTitle: 'Wearables in PE', subtitle: 'Heart-rate data in physical education', author: 'A. Student', course: 'Seminar: Sports Pedagogy', date: 'Winter term 2026/27', posterWords: ['Pulse', 'Effort', 'Data'], posterLines: ['40.5 % in MVPA', '50 % recommended', 'Secondary school PE'], placeShort: 'Augsburg' },
  claims: [
    { text: 'Heart-rate monitors show teachers in real time whether a lesson reaches moderate-to-vigorous effort.', role: 'thesis', note: '' },
    { text: 'Pupils spend less time active in PE than the guidelines recommend.', role: 'context', note: '' },
    { text: 'Constant measurement can turn PE into a performance contest.', role: 'counter', note: 'Comparing bodies is a known risk for less sporty pupils.' },
    { text: 'Used well, the data is about the individual pupil, not a ranking.', role: 'takeaway', note: '' },
  ],
  definitions: [{ term: 'MVPA', gloss: 'moderate-to-vigorous physical activity', text: 'Activity intense enough to raise heart rate and breathing noticeably, usually above about 140 beats per minute for pupils.' }],
  figures: [{ title: 'Pupils are active for less than half of a PE lesson', value: '40.5%', label: 'of lesson time in MVPA', caption: 'A meta-analysis of secondary school PE pooled fifteen studies.', source: 'Hollis et al. 2017', year: 2017 }],
  pairs: [],
  timelines: [{ title: 'Heart-rate monitoring moved from labs into classrooms', events: [{ date: '1983', label: 'First wireless chest-strap monitor' }, { date: '2000s', label: 'Monitors used in PE research' }, { date: '2017', label: 'Meta-analysis on MVPA in PE' }, { date: 'today', label: 'Consumer watches in many pupils\' pockets' }], year: 1983 }],
  processes: [{ title: 'A lesson with heart-rate zones', steps: [{ title: 'Set a zone goal', text: 'Each pupil gets a personal target zone.' }, { title: 'Train in stations', text: 'Pupils check their zone between stations.' }, { title: 'Reflect', text: 'The class looks at the curves together.' }] }],
  comparisons: [{ title: 'The data helps and harms at the same time', left: { heading: 'Opportunities', points: ['Makes effort visible', 'Supports personal goals'] }, right: { heading: 'Concerns', points: ['Health data of minors', 'Pressure to perform'] }, verdict: 'The design of the lesson decides which side wins.' }],
  quotes: [],
  questions: [
    { text: 'How hard did you really work in your last PE lesson?', hint: 'Guess first, then check.', role: 'hook' },
    { text: 'Should a PE grade ever draw on heart-rate data?', hint: '', role: 'discussion' },
  ],
  pointLists: [{ title: 'Three things to settle before using wearables', points: [{ head: 'Consent', text: 'Parents and pupils agree in writing.' }, { head: 'Storage', text: 'Data stays on school devices.' }, { head: 'Purpose', text: 'Feedback, never grading.' }] }],
  sources: ['Hollis, Jenna L., et al. "A Systematic Review and Meta-Analysis of Moderate-to-Vigorous Physical Activity Levels in Secondary School Physical Education Lessons." International Journal of Behavioral Nutrition and Physical Activity, vol. 14, 2017, article 52.'],
  pictureCaptions: [{ title: 'The watch shows zone, not ranking', caption: 'Pupils see their own heart-rate zone.' }],
};

const long = (n, word = 'Langwort') => Array.from({ length: n }, (_, i) => `${word}${i % 7}`).join(' ');

test('the answer schema accepts a realistic answer', () => {
  assert.ok(AnswerSchema.safeParse(ANSWER).success);
  assert.equal(MODEL, 'claude-opus-5-5');
});

test('an answer becomes a pool every look can lay out without overflow', () => {
  const pool = toPool(ANSWER);
  assert.equal(pool.items.find((i) => i.kind === 'claim' && i.tags.includes('thesis')).weight, 3);
  for (const family of ['editorial', 'poster', 'glass', 'texture']) for (const o of OCCASIONS) for (const density of ['light', 'medium', 'dense']) {
    for (const deck of buildDirections({ pool, occasionId: o.id, density, seed: 3, family })) {
      assert.deepEqual(deck.overflow, [], `${family}/${deck.direction.id}/${deck.structure.id}/${density}`);
      assert.equal(deck.slides[0].form, 'cover');
    }
  }
});

test('overlong answers are shortened so slides still fit, and nothing is invented', () => {
  const messy = structuredClone(ANSWER);
  messy.deck.title = long(30);
  messy.claims[0].text = long(80);
  messy.figures.push({ title: 'x', value: 'many', label: 'no number', caption: '', source: '', year: 0 }); // not a number: dropped
  messy.timelines[0].events = Array.from({ length: 12 }, (_, i) => ({ date: `${1900 + i}`, label: long(30) }));
  messy.pointLists[0].points = Array.from({ length: 9 }, () => ({ head: long(20), text: long(40) }));
  messy.comparisons[0].left.points = [long(40), long(40), long(40), long(40)];
  const pool = toPool(messy);
  assert.ok(pool.title.length <= 80);
  assert.equal(pool.items.filter((i) => i.kind === 'figure').length, 1);
  assert.equal(pool.items.find((i) => i.kind === 'timeline').events.length, 6);
  for (const family of ['editorial', 'poster', 'glass', 'texture']) for (const density of ['light', 'medium', 'dense']) for (let s = 0; s < 3; s++) {
    for (const deck of buildDirections({ pool, occasionId: 'seminar', density, seed: s, family })) {
      assert.deepEqual(deck.overflow, [], `${family}/${deck.direction.id}/${deck.structure.id}/${density}`);
    }
  }
});

test('works cited never invents sources; too little content is refused', () => {
  const none = structuredClone(ANSWER);
  none.sources = [];
  assert.match(toPool(none).items.find((i) => i.kind === 'sources').entries[0], /No sources were named/);
  assert.throws(() => toPool({ deck: { title: 'x' }, claims: [{ text: 'one', role: 'thesis' }] }), /too short/);
  assert.throws(() => toPool({}), /no title/);
});

test('copy-paste fallback: the prompt carries the notes, and pasted answers are parsed', () => {
  const p = copyPastePrompt('my notes here', 'Seminar presentation');
  assert.ok(p.includes('my notes here') && p.includes('"claims"'));
  assert.deepEqual(parseAnswer('Here you go:\n```json\n{"a": 1}\n```'), { a: 1 });
  assert.throws(() => parseAnswer('no json'), /No JSON/);
  assert.equal(clip('one two three four five', 12), 'one two…');
});

test('the server asks Claude with structured output and the fallback, and handles refusals', async () => {
  let sent;
  const fake = (reply) => ({ beta: { messages: { parse: async (params) => { sent = params; return reply; } } } });
  const pool = await writeDeck('notes '.repeat(20), 'seminar', fake({ stop_reason: 'end_turn', parsed_output: ANSWER }));
  assert.equal(pool.title, ANSWER.deck.title);
  assert.equal(sent.model, 'claude-opus-5-5');
  assert.equal(sent.fallbacks, 'default');
  assert.ok(sent.betas.includes('server-side-fallback-2026-07-01'));
  assert.equal(sent.output_config.format.type, 'json_schema');
  await assert.rejects(writeDeck('notes', 'seminar', fake({ stop_reason: 'refusal', parsed_output: null })), /declined/);
  await assert.rejects(writeDeck('notes', 'seminar', fake({ stop_reason: 'max_tokens', parsed_output: null })), /too much content/);
});
