import { test } from 'node:test';
import assert from 'node:assert/strict';
import { matchDirections, adaptDirection, scoreDirection, toHsl, TELLS } from '../src/engine/match.js';
import { cleanStyle, analysePrompt } from '../src/engine/style.js';
import { cleanDeckText, slideXmlText, themeOf, backgroundOf, readPptxParts, kindOf, spread, MAX_TEXT } from '../src/engine/import.js';
import { buildFromDirections } from '../src/engine/build.js';
import { DIRECTIONS } from '../src/library/directions.js';
import { OCCASIONS } from '../src/library/occasions.js';
import { contrast } from '../src/library/forms.js';
import { SAMPLE_POOL } from '../src/sample/great-vowel-shift.js';

// Style profiles of typical AI-made decks
const PROFILES = {
  gammaDark: { mode: 'dark', type: 'sans', tone: 'neutral', colors: { background: '#0B1026', text: '#FFFFFF', accent: '#8B5CF6' }, surface: 'gradient', imagery: 'icons', typeScale: 'bold', align: 'center', density: 'medium', tells: ['purple-gradient', 'card-grid', 'emoji-bullets', 'glow-blobs'] },
  photoBold: { mode: 'dark', type: 'sans', tone: 'neutral', colors: { background: '#111111', text: '#FFFFFF', accent: '#E0A030' }, surface: 'photo', imagery: 'photos', typeScale: 'huge', align: 'left', density: 'light', tells: ['generic-stock-photo'] },
  pastel: { mode: 'tint', type: 'sans', tone: 'relaxed', colors: { background: '#F6EDE4', text: '#2A2A2A', accent: '#D9467A' }, surface: 'texture', imagery: 'illustrations', typeScale: 'bold', align: 'center', density: 'light', tells: ['everything-centred'] },
  academic: { mode: 'light', type: 'serif', tone: 'formal', colors: { background: '#FFFFFF', text: '#1A1A1A', accent: '#1F3A93' }, surface: 'flat', imagery: 'none', typeScale: 'quiet', align: 'left', density: 'dense', tells: ['bullet-walls'] },
};

test('each kind of AI deck is matched to the look it resembles', () => {
  const family = (p) => matchDirections(cleanStyle(p))[0].direction.family ?? 'editorial';
  assert.equal(family(PROFILES.gammaDark), 'glass');
  assert.equal(family(PROFILES.photoBold), 'poster');
  assert.equal(family(PROFILES.pastel), 'texture');
  assert.equal(family(PROFILES.academic), 'editorial');
});

test('one best match and two alternatives, each from a different look', () => {
  for (const o of OCCASIONS) for (const p of Object.values(PROFILES)) {
    const m = matchDirections(cleanStyle(p), { occasionId: o.id });
    assert.equal(m.length, 3);
    assert.deepEqual(m.map((x) => x.role), ['best', 'alternative', 'alternative']);
    assert.equal(new Set(m.map((x) => x.direction.family ?? 'editorial')).size, 3);
    assert.ok(m[0].score >= m[1].score && m[0].score >= m[2].score);
    assert.ok(m[0].reason.startsWith('Like your deck'));
    assert.equal(new Set(m.map((x) => x.reason)).size, 3, 'each card explains itself differently');
    for (const x of m) {
      assert.ok((x.direction.suits?.[o.id] ?? 1) > 0, `${x.direction.id} does not suit ${o.id}`);
    }
  }
});

test('a tone chosen in Adjust changes the match', () => {
  const formal = matchDirections(cleanStyle(PROFILES.pastel), { tone: 'formal' });
  const relaxed = matchDirections(cleanStyle(PROFILES.pastel), { tone: 'relaxed' });
  assert.ok(formal[0].score !== relaxed[0].score || formal[0].direction.id !== relaxed[0].direction.id);
});

test('the deck’s accent colour is kept, and stays readable in every direction', () => {
  const accents = ['#8B5CF6', '#E0A030', '#D9467A', '#1F3A93', '#10B981', '#EF4444', '#06B6D4', '#FDE047'];
  for (const d of DIRECTIONS) for (const accent of accents) {
    const a = adaptDirection(d, { colors: { accent } });
    assert.ok(contrast(a.colors.accent, a.colors.bg) >= 3, `${d.id} with ${accent}: ${a.colors.accent} on ${a.colors.bg}`);
    if (a !== d) {
      const gap = (x, y) => { const g = Math.abs(x - y) % 360; return g > 180 ? 360 - g : g; };
      // the new accent sits closer to the deck's hue than the direction's own did
      assert.ok(gap(toHsl(a.colors.accent).h, toHsl(accent).h) <= gap(toHsl(d.colors.accent).h, toHsl(accent).h) + 1, `${d.id} with ${accent}`);
      assert.equal(a.adaptedFrom, d.colors.accent);
      // everything but the accent stays the direction's own
      assert.equal(a.colors.bg, d.colors.bg);
      assert.equal(a.colors.ink, d.colors.ink);
      assert.equal(a.fonts, d.fonts);
    }
  }
});

test('a grey accent leaves the direction’s colours alone', () => {
  for (const d of DIRECTIONS) assert.equal(adaptDirection(d, { colors: { accent: '#808080' } }), d);
});

test('the changes list follows the AI tells that were found', () => {
  const [best] = matchDirections(cleanStyle(PROFILES.gammaDark));
  assert.ok(best.changes.some((c) => /cards/.test(c)));
  assert.ok(best.changes.some((c) => /Emoji/.test(c)));
  assert.ok(best.changes.some((c) => /accent colour is kept/.test(c)));
  const [plain] = matchDirections(cleanStyle({ ...PROFILES.academic, tells: [] }));
  assert.ok(!plain.changes.some((c) => /cards|Emoji/.test(c)));
});

test('matched directions build complete decks', () => {
  for (const p of Object.values(PROFILES)) {
    const m = matchDirections(cleanStyle(p));
    const decks = buildFromDirections({ pool: SAMPLE_POOL, occasionId: 'seminar', seed: 'm', directions: m.map((x) => x.direction) });
    assert.equal(decks.length, 3);
    for (const deck of decks) {
      assert.ok(deck.slides.length > 5);
      assert.equal(deck.direction.colors.accent, m[decks.indexOf(deck)].direction.colors.accent);
    }
  }
});

test('a style profile is cleaned whatever the model sends', () => {
  const s = cleanStyle({ mode: 'neon', type: 'serif', colors: { background: 'ffffff', accent: 'purple' }, tells: ['card-grid', 'made-up', 'card-grid'], summary: '  Dark  slides.  ' });
  assert.equal(s.mode, 'light');
  assert.equal(s.type, 'serif');
  assert.equal(s.colors.background, '#FFFFFF');
  assert.equal(s.colors.accent, '');
  assert.deepEqual(s.tells, ['card-grid']);
  assert.equal(s.summary, 'Dark slides.');
  const empty = cleanStyle(undefined);
  assert.equal(empty.surface, 'flat');
  assert.ok(Number.isFinite(scoreDirection(DIRECTIONS[0], empty, 'seminar').score));
  assert.doesNotThrow(() => matchDirections(empty));
});

test('the analysis prompt asks for content and style and names every AI tell', () => {
  const p = analysePrompt();
  assert.match(p, /Word for word/);
  assert.match(p, /Never add a word/);
  assert.match(p, /"style"/);
  assert.match(p, /"content"/);
  for (const t of TELLS) assert.ok(p.includes(t), t);
});

// ---------------------------------------------------------------- reading files

test('deck text loses footers, tool credits and page numbers; emoji bullets become dashes', () => {
  const slides = [
    'Why sleep matters\n🚀 Memory consolidation\n• Mood\nMade with Gamma\n1',
    'The brain at night\n✅ Glymphatic system\nMade with Gamma\n2',
    'What to do\n→ Fixed bedtime\nMade with Gamma\nSlide 3 of 4',
    'Questions?\nMade with Gamma\n4 / 4',
  ];
  const { text, trimmed } = cleanDeckText(slides);
  assert.equal(trimmed, false);
  assert.doesNotMatch(text, /Gamma|Slide 3 of 4|4 \/ 4/);
  assert.match(text, /^Slide 1\nWhy sleep matters\nMemory consolidation\n- Mood/);
  assert.match(text, /\nGlymphatic system/);
  assert.doesNotMatch(text, /🚀|✅/);
  // a tool credit run into the last line of a PDF page goes too
  assert.equal(cleanDeckText(['🚀 Why sleep matters\nUnlocking rest Made with Gamma']).text, 'Slide 1\nWhy sleep matters\nUnlocking rest');
  assert.match(text, /- Fixed bedtime/);
});

test('long decks drop speaker notes first; the slide text is never cut', () => {
  const slides = Array.from({ length: 30 }, (_, i) => `Point ${i} ${'word '.repeat(80)}`);
  const notes = slides.map(() => 'note '.repeat(300));
  const r = cleanDeckText(slides, notes);
  assert.equal(r.trimmed, true);
  assert.doesNotMatch(r.text, /Speaker notes/);
  for (let i = 0; i < 30; i++) assert.ok(r.text.includes(slides[i].trim()), `slide ${i + 1} complete`);
  assert.throws(() => cleanDeckText(Array.from({ length: 150 }, (_, i) => `Slide topic ${i} ${'word '.repeat(80)}`)), /more text than the app can redesign/);
});

const SLIDE_XML = `<p:sld><p:cSld><p:bg><p:bgPr><a:gradFill><a:gsLst/></a:gradFill></p:bgPr></p:bg><p:spTree>
<p:sp><p:txBody><a:p><a:r><a:t>Sleep &amp; memory</a:t></a:r></a:p></p:txBody></p:sp>
<p:sp><p:txBody><a:p><a:pPr lvl="1"/><a:r><a:rPr lang="en"/><a:t>Deep sleep </a:t></a:r><a:r><a:t>replays the day</a:t></a:r></a:p><a:p><a:endParaRPr/></a:p></p:txBody></p:sp>
</p:spTree></p:cSld></p:sld>`;
const THEME_XML = `<a:theme><a:themeElements><a:clrScheme name="x"><a:dk1><a:sysClr val="windowText" lastClr="000000"/></a:dk1><a:lt1><a:srgbClr val="FFFFFF"/></a:lt1><a:accent1><a:srgbClr val="7c3aed"/></a:accent1></a:clrScheme>
<a:fontScheme><a:majorFont><a:latin typeface="Poppins"/></a:majorFont><a:minorFont><a:latin typeface="Inter"/></a:minorFont></a:fontScheme></a:themeElements></a:theme>`;

test('PowerPoint slide XML gives its text, theme colours, fonts and background kind', () => {
  assert.equal(slideXmlText(SLIDE_XML), 'Sleep & memory\n  Deep sleep replays the day');
  const theme = themeOf(THEME_XML);
  assert.deepEqual(theme.colors.map((c) => c.hex), ['#000000', '#FFFFFF', '#7C3AED']);
  assert.deepEqual(theme.fonts, ['Poppins', 'Inter']);
  assert.equal(backgroundOf(SLIDE_XML), 'gradient');
  assert.equal(backgroundOf('<p:sld><p:bg><a:solidFill/></p:bg></p:sld>'), 'solid');
  assert.equal(backgroundOf('<p:sld/>'), '');
});

test('a PowerPoint file is read in slide order with its notes and pictures', async () => {
  const files = {
    'ppt/slides/slide10.xml': '<a:p><a:r><a:t>Ten</a:t></a:r></a:p>',
    'ppt/slides/slide2.xml': '<a:p><a:r><a:t>Two</a:t></a:r></a:p>',
    'ppt/slides/slide1.xml': SLIDE_XML,
    'ppt/notesSlides/notesSlide2.xml': '<a:p><a:r><a:t>Say this slowly</a:t></a:r></a:p><a:p><a:r><a:t>2</a:t></a:r></a:p>',
    'ppt/theme/theme1.xml': THEME_XML,
    'ppt/slideMasters/slideMaster1.xml': '<p:sldMaster><p:cSld><p:bg><p:bgPr><a:solidFill/></p:bgPr></p:bg></p:cSld></p:sldMaster>',
    'ppt/media/image1.png': '', 'ppt/media/chart.emf': '',
  };
  const parts = await readPptxParts({ names: Object.keys(files), text: async (n) => files[n] });
  assert.deepEqual(parts.slides.map((s) => s.split('\n')[0]), ['Sleep & memory', 'Two', 'Ten']);
  assert.deepEqual(parts.notes, ['', 'Say this slowly', '']);
  assert.deepEqual(parts.theme.fonts, ['Poppins', 'Inter']);
  assert.deepEqual(parts.theme.backgrounds.sort(), ['gradient', 'solid']);
  assert.deepEqual(parts.media, ['ppt/media/image1.png']);
  await assert.rejects(readPptxParts({ names: ['ppt/presentation.xml'], text: async () => '' }), /no slides/);
});

test('uploads are sorted by kind; old formats get a clear answer', () => {
  assert.equal(kindOf({ name: 'Deck.PDF' }), 'pdf');
  assert.equal(kindOf({ name: 'deck.pptx' }), 'pptx');
  assert.equal(kindOf({ name: 'deck.ppt' }), 'unsupported');
  assert.equal(kindOf({ name: 'talk.key' }), 'unsupported');
  assert.equal(kindOf({ name: 'shot.png', type: 'image/png' }), 'image');
  assert.equal(kindOf({ name: 'outline.md' }), 'text');
  assert.equal(kindOf({ name: 'data.xlsx' }), 'unknown');
});

test('long PDFs are sampled evenly, first and last page included', () => {
  assert.deepEqual(spread(4), [1, 2, 3, 4]);
  const s = spread(40);
  assert.equal(s.length, 10);
  assert.equal(s[0], 1);
  assert.equal(s.at(-1), 40);
  assert.deepEqual(s, [...s].sort((a, b) => a - b));
});

// ---------------------------------------------------------------- the server step

import { readBody, analyseDeck, userContent, MAX_IMAGES } from '../api/analyse.js';

const PIXEL = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQ==';
const ANSWER = {
  content: {
    deck: { language: 'en', title: 'Sleep turns the day into memory', shortTitle: 'Sleep and memory' },
    claims: [{ text: 'Deep sleep replays what we learned during the day.', role: 'thesis' }, { text: 'Pupils who sleep less remember less.', role: 'claim' }],
    definitions: [{ term: 'Slow-wave sleep', text: 'The deepest stage of sleep, with slow brain waves.' }],
    questions: [{ text: 'How much did you sleep last night?', role: 'hook' }],
    sources: [],
  },
  style: { mode: 'dark', type: 'sans', tone: 'neutral', colors: { background: '#0B1026', text: '#FFFFFF', accent: '#8B5CF6' }, surface: 'gradient', imagery: 'icons', typeScale: 'bold', align: 'center', density: 'medium', tells: ['purple-gradient', 'emoji-bullets'], summary: 'Dark navy slides with purple gradients.' },
};

test('the server checks what the browser sends', () => {
  assert.throws(() => readBody({}), /no slides or text/);
  assert.throws(() => readBody({ images: ['javascript:alert(1)'] }), /could not be read/);
  assert.throws(() => readBody({ images: Array(MAX_IMAGES + 1).fill(PIXEL) }), /at most/);
  assert.throws(() => readBody({ images: [`data:image/jpeg;base64,${'A'.repeat(4_100_000)}`] }), /too large/);
  assert.throws(() => readBody({ text: 'x'.repeat(MAX_TEXT + 1) }), /limited/);
  const ok = readBody({ images: [PIXEL], theme: { colors: ['#7C3AED', 'red'], fonts: ['Poppins'] }, source: 'pdf' });
  assert.equal(ok.images[0].media_type, 'image/jpeg');
  assert.deepEqual(ok.theme.colors, ['#7C3AED']);
  assert.equal(ok.source, 'pdf');
});

test('Claude gets one picture per slide, then the text and theme', () => {
  const content = userContent({ images: [{ media_type: 'image/jpeg', data: 'AAA' }, { media_type: 'image/png', data: 'BBB' }], text: 'Slide 1\nSleep', theme: { colors: ['#7C3AED'], fonts: ['Poppins'], backgrounds: ['gradient'] }, source: 'pdf' }, 'Seminar presentation');
  assert.deepEqual(content.map((b) => b.type), ['text', 'image', 'text', 'image', 'text']);
  assert.equal(content[1].source.type, 'base64');
  assert.match(content.at(-1).text, /Poppins[\s\S]*gradient[\s\S]*Slide 1\nSleep/);
});

test('the analysis returns a pool and a clean style profile, and handles refusals', async () => {
  let sent;
  const reply = (text, stop = 'end_turn') => ({ stop_reason: stop, content: [{ type: 'text', text }] });
  const fake = (r) => ({ beta: { messages: { create: async (params) => { sent = params; return r; } } } });
  const input = readBody({ images: [PIXEL], text: 'Slide 1\nSleep and memory', source: 'pdf' });
  const out = await analyseDeck(input, 'seminar', fake(reply('```json\n' + JSON.stringify(ANSWER) + '\n```')));
  assert.equal(sent.model, 'claude-opus-5-5');
  assert.equal(sent.fallbacks, 'default');
  assert.match(sent.system, /Job 2, the style/);
  assert.equal(out.pool.title, 'Sleep turns the day into memory');
  assert.ok(out.pool.items.length >= 4);
  assert.equal(out.style.mode, 'dark');
  assert.deepEqual(out.style.tells, ['purple-gradient', 'emoji-bullets']);
  await assert.rejects(analyseDeck(input, 'seminar', fake(reply('', 'refusal'))), /declined/);
  await assert.rejects(analyseDeck(input, 'seminar', fake(reply('no json'))), /could not be read/);
});

// ---------------------------------------------------------------- keeping the uploaded order

import { toPool } from '../src/engine/content.js';
import { assembleDeck, hasSlideOrder } from '../src/engine/assemble.js';
import { AS_UPLOADED, STRUCTURES } from '../src/library/structures.js';

// an analysed deck whose pieces came from slides 1–7, listed out of order as the model groups them by kind
const ORDERED = {
  deck: { language: 'en', title: 'Sleep turns the school day into memory', shortTitle: 'Sleep and learning' },
  claims: [
    { text: 'Teenagers need more sleep than most get, and learning suffers.', role: 'thesis', slide: 2 },
    { text: 'Schools can change start times and teach sleep habits.', role: 'takeaway', slide: 7 },
  ],
  definitions: [{ term: 'Slow-wave sleep', text: 'The deepest stage of sleep, with slow brain waves.', slide: 3 }],
  figures: [{ title: 'Teenagers need eight to ten hours', value: '8–10 h', label: 'recommended sleep', slide: 5 }],
  processes: [{ title: 'What schools can do', steps: [{ title: 'Later start times' }, { title: 'Sleep education in PE' }], slide: 6 }],
  questions: [{ text: 'How much did you sleep last night?', role: 'hook', slide: 1 }],
  pointLists: [{ title: 'Three benefits of sleep', points: [{ head: 'Memory' }, { head: 'Mood' }, { head: 'Focus' }], slide: 4 }],
  sources: ['American Academy of Sleep Medicine. Recommended Amount of Sleep. 2016.'],
};

test('the analysis asks for the slide each piece comes from, and keeps it', () => {
  assert.match(analysePrompt(), /"slide": 0/);
  const pool = toPool(ORDERED);
  assert.deepEqual(pool.items.filter((it) => it.kind !== 'sources').map((it) => it.slide).sort((a, b) => a - b), [1, 2, 3, 4, 5, 6, 7]);
  assert.ok(hasSlideOrder(pool));
  // notes written in the app carry no slide numbers, and a stray value is dropped
  assert.ok(!hasSlideOrder(SAMPLE_POOL));
  assert.equal(toPool({ ...ORDERED, claims: [{ text: 'A claim long enough to count.', role: 'thesis', slide: 'two' }] }).items[0].slide, undefined);
});

test('pictures of a long PDF are labelled with the slide they show', () => {
  const content = userContent({ images: [{ media_type: 'image/jpeg', data: 'A' }, { media_type: 'image/jpeg', data: 'B' }], text: '', theme: null, source: 'pdf', pages: [1, 40] }, 'Seminar presentation');
  assert.equal(content[0].text, 'Picture of slide 1:');
  assert.equal(content[2].text, 'Picture of slide 40:');
  assert.deepEqual(readBody({ images: [PIXEL, PIXEL], pages: [1, 40] }).pages, [1, 40]);
  assert.deepEqual(readBody({ images: [PIXEL, PIXEL], pages: [1] }).pages, [], 'pages that don’t match the pictures are ignored');
});

test('the uploaded order is kept: cover, pieces by slide, photos in between, Works Cited last', () => {
  const photo = (n) => ({ kind: 'image', tags: ['evidence'], weight: 2, src: `p${n}.jpg`, w: 1600, h: 1000, title: `Photo ${n}`, caption: '' });
  const pool = { ...toPool(ORDERED) };
  pool.items = [...pool.items, photo(1), photo(2)];
  const plan = assembleDeck(pool, AS_UPLOADED, 'medium');
  const pieces = plan.filter((s) => s.item?.slide);
  assert.equal(plan[0].form, 'cover');
  assert.equal(plan.at(-1).form, 'references');
  assert.deepEqual(pieces.map((s) => s.item.slide), [1, 2, 3, 4, 5, 6, 7]);
  const photos = plan.map((s, i) => (s.item?.kind === 'image' ? i : -1)).filter((i) => i >= 0);
  assert.equal(photos.length, 2);
  assert.ok(photos.every((i) => i > 1 && i < plan.length - 2), 'photos sit between pieces');
  assert.ok(!plan.some((s) => s.form === 'section'));
  // the lighter version keeps the thesis, the hook and the takeaway, still in order
  const light = assembleDeck(pool, AS_UPLOADED, 'light').filter((s) => s.item?.slide).map((s) => s.item.slide);
  assert.ok(light.length < 7 && light.includes(1) && light.includes(2) && light.includes(7));
  assert.deepEqual(light, [...light].sort((a, b) => a - b));
  // the library structures still re-tell the same pool in their own order
  assert.notDeepEqual(assembleDeck(pool, STRUCTURES[0]).filter((s) => s.item?.slide).map((s) => s.item.slide), [1, 2, 3, 4, 5, 6, 7]);
});

test('every look can lay out a deck in the uploaded order', () => {
  const pool = toPool(ORDERED);
  for (const density of ['light', 'medium', 'dense']) {
    const decks = buildFromDirections({ pool, occasionId: 'seminar', density, seed: 'o', directions: DIRECTIONS, structures: DIRECTIONS.map(() => AS_UPLOADED) });
    for (const deck of decks) {
      assert.equal(deck.structure.name, 'Your original order');
      assert.deepEqual(deck.overflow, [], `${deck.direction.id} ${density}: ${JSON.stringify(deck.overflow)}`);
    }
  }
});

// ---------------------------------------------------------------- the slide text stays as it was

test('a redesigned deck keeps every slide and its text word for word, and adds nothing', async () => {
  const { toPool } = await import('../src/engine/content.js');
  const { AS_UPLOADED } = await import('../src/library/structures.js');
  const long = 'During the night, the brain replays what was learned during the day, strengthening the connections between neurons. This process, known as memory consolidation, is why students who sleep well after studying tend to remember more than those who stay up late cramming for an exam.';
  const bullets = ['Memory consolidation happens mainly during deep sleep stages', 'Emotional regulation improves after a full night of rest', 'Attention and focus drop sharply after only one short night', 'Teenagers need between eight and ten hours of sleep per night', 'Screen use before bed delays the release of melatonin', 'Regular sleep schedules support better academic performance'];
  const answer = {
    deck: { language: 'en', title: 'The Role of Sleep in Learning', shortTitle: 'Sleep and Learning', subtitle: 'How rest shapes memory', author: 'A. Student', course: '', date: '', worksCitedTitle: '', posterWords: ['Sleep'], posterLines: [] },
    pointLists: [
      { slide: 2, title: 'Why Sleep Matters', points: bullets.map((head) => ({ head, text: '' })) },
      { slide: 3, title: 'What Happens at Night', points: [{ head: long, text: '' }] },
    ],
    figures: [{ slide: 4, title: 'Most Teens Are Sleep-Deprived', value: '73 %', label: 'of high school students sleep less than 8 hours', caption: '', source: '', year: 0 }],
    questions: [{ slide: 5, text: 'How could our school help students sleep better?', role: 'discussion', hint: '' }],
    sources: [],
    pictures: [{ search: 'sleeping student', kind: 'detail', title: 'x', caption: 'y' }],
  };
  // pieces that would have been cut or dropped before
  const twelve = Array.from({ length: 12 }, (_, i) => `Bullet number ${i + 1} stays on the slide`);
  const essay = `${long} ${long} ${long}`;
  const extra = structuredClone(answer);
  extra.pointLists.push({ slide: 6, title: 'Twelve bullets', points: twelve.map((head) => ({ head, text: '' })) });
  extra.pointLists.push({ slide: 7, title: 'A long paragraph', points: [{ head: essay, text: '' }] });
  extra.figures.push({ slide: 8, title: 'Not a short number', value: 'about two thirds', label: 'of all students', caption: '', source: '', year: 0 });
  extra.quotes = [{ slide: 9, text: 'Sleep is the best meditation.', author: '', work: '', note: '', year: 0 }];
  const full = toPool(extra, { verbatim: true });
  assert.deepEqual(full.items.find((i) => i.slide === 6).points.map((p) => p.head), twelve, 'twelve bullets, none dropped');
  assert.equal(full.items.find((i) => i.slide === 7).points[0].head, essay, 'no length limit');
  assert.equal(full.items.find((i) => i.slide === 8).points[0].head, 'about two thirds of all students', 'a figure that is not a short number becomes a list');
  assert.equal(full.items.find((i) => i.slide === 9).points[0].head, 'Sleep is the best meditation.', 'a quote without an author is kept');
  assert.ok(!JSON.stringify(full.items).includes('…'), 'nothing shortened');
  const pool = toPool(answer, { verbatim: true });
  assert.equal(pool.verbatim, true);
  assert.deepEqual(pool.pictureSearches, [], 'no topic photos the deck did not have');
  assert.ok(!pool.items.some((i) => i.kind === 'sources'), 'no Works Cited the deck did not have');
  assert.deepEqual(pool.items.find((i) => i.slide === 2).points.map((p) => p.head), bullets, 'six bullets, unchanged');
  assert.equal(pool.items.find((i) => i.slide === 3).points[0].head, long, 'running text is not shortened');
  for (const density of ['light', 'medium', 'dense']) for (let k = 0; k < DIRECTIONS.length; k += 3) {
    const dirs = DIRECTIONS.slice(k, k + 3);
    for (const deck of buildFromDirections({ pool, occasionId: 'seminar', density, seed: 1, directions: dirs, structures: dirs.map(() => AS_UPLOADED) })) {
      assert.deepEqual(deck.slides.map((s) => s.item?.slide ?? 0), [0, 2, 3, 4, 5], `${deck.direction.id}/${density}: every slide, in order`);
      assert.deepEqual(deck.overflow, [], `${deck.direction.id}/${density}`);
    }
  }
  assert.match(analysePrompt(), /One piece per slide/);
});

test('a redesigned deck keeps the hierarchy of its slides: no made-up headlines or labels, headlines stay headlines', async () => {
  const { toPool } = await import('../src/engine/content.js');
  const { AS_UPLOADED } = await import('../src/library/structures.js');
  const answer = {
    deck: { language: 'de', title: 'Plyometrie im Handball', shortTitle: 'Plyometrie', subtitle: '', author: '', course: '', date: '', worksCitedTitle: '', posterWords: ['Sprung'], posterLines: [] },
    pointLists: [{ slide: 2, title: '', points: [{ head: 'Im 8-wöchigen Programm wurden Drop Jumps aus 40cm Höhe ausgeführt.', text: '' }] }],
    figures: [{ slide: 3, title: 'Sprunghöhe nach dem Training', value: '+12 %', label: 'mehr Sprunghöhe', caption: '', source: '', year: 0 }],
    claims: [{ slide: 4, text: 'Drop Jumps gelten als besonders wirksame Übung.', role: 'claim', note: '' }],
    questions: [{ slide: 5, text: 'Wie oft pro Woche?', role: 'discussion', hint: '' }],
  };
  const pool = toPool(answer, { verbatim: true });
  assert.equal(pool.items.find((i) => i.slide === 2).title, '', 'no headline invented');
  assert.equal(pool.subtitle, '', 'no subtitle invented');
  const invented = /^(these|thesis|frage|question|kennzahl|key figure|timeline|step by step)$/i;
  for (const density of ['light', 'medium', 'dense']) for (let k = 0; k < DIRECTIONS.length; k += 3) {
    const dirs = DIRECTIONS.slice(k, k + 3);
    for (const deck of buildFromDirections({ pool, occasionId: 'seminar', density, seed: 1, directions: dirs, structures: dirs.map(() => AS_UPLOADED) })) {
      const name = `${deck.direction.id}/${density}`;
      assert.deepEqual(deck.overflow, [], name);
      for (const s of deck.slides.slice(1)) {
        const texts = s.els.filter((e) => e.type === 'text').map((e) => String(e.text).trim());
        assert.ok(!texts.some((t) => invented.test(t)), `${name} ${s.form}: a label the slide didn't have (${texts.join(' | ')})`);
        if (s.item?.slide === 2) assert.ok(!texts.includes('Plyometrie') || s.els.find((e) => e.text === 'Plyometrie').size <= 11, `${name}: deck title used as a headline`);
        if (s.item?.slide === 3) {
          const title = s.els.find((e) => e.type === 'text' && e.text === 'Sprunghöhe nach dem Training');
          assert.ok(title && title.size >= 16, `${name}: the key figure's headline is shown as a headline (${title?.size}pt)`);
        }
      }
    }
  }
});

test('a redesigned list keeps its own marker: numbers only where the slide numbered its items', async () => {
  const { toPool } = await import('../src/engine/content.js');
  const { AS_UPLOADED } = await import('../src/library/structures.js');
  const list = (slide, marker) => ({ slide, title: 'Ablauf', marker, points: ['Aufwärmen', 'Drop Jumps', 'Auslaufen'].map((head) => ({ head, text: '' })) });
  const pool = toPool({ deck: { title: 'Plyometrie' }, pointLists: [list(1, 'none'), list(2, 'bullet'), list(3, 'number'), { ...list(4), marker: undefined }] }, { verbatim: true });
  assert.deepEqual(pool.items.filter((i) => i.kind === 'points').map((i) => i.marker), ['none', 'bullet', 'number', 'none'], 'unknown marker: none');
  for (let k = 0; k < DIRECTIONS.length; k += 3) {
    const dirs = DIRECTIONS.slice(k, k + 3);
    for (const deck of buildFromDirections({ pool, occasionId: 'seminar', density: 'medium', seed: 1, directions: dirs, structures: dirs.map(() => AS_UPLOADED) })) {
      const bySlide = (n) => deck.slides.find((s) => s.item?.slide === n);
      const numbers = (s) => s.els.filter((e) => e.type === 'text' && /^0\d$/.test(String(e.text)) && e.y < 6.5).length; // not the page number in the footer
      const dots = (s) => s.els.filter((e) => e.type === 'ellipse' && e.w === 0.1).length;
      assert.equal(numbers(bySlide(1)) + dots(bySlide(1)), 0, `${deck.direction.id}: plain lines get no marker`);
      assert.equal(numbers(bySlide(2)), 0, `${deck.direction.id}: bullets are not numbered`);
      assert.equal(dots(bySlide(2)), 3, `${deck.direction.id}: bullets stay bullets`);
      assert.deepEqual(deck.overflow, [], deck.direction.id);
    }
  }
});
