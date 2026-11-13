import { test } from 'node:test';
import assert from 'node:assert/strict';
import { attachPictures, searchCommons, toPicture } from '../src/engine/pictures.js';
import { toPool } from '../src/engine/content.js';
import { buildDirections } from '../src/engine/build.js';

// A Commons file in the shape the API returns (taken from a real answer, shortened).
const file = (index, title, o = {}) => ({
  pageid: index, ns: 6, title: `File:${title}`, index,
  imageinfo: [{
    width: o.width ?? 4000, height: o.height ?? 2667, mime: o.mime ?? 'image/jpeg',
    thumburl: `https://thumb.wikimedia.org/wikipedia/commons/thumb/a/ab/${encodeURIComponent(title)}/1280px-${encodeURIComponent(title)}?utm_source=commons.wikimedia.org`,
    thumbwidth: 1280, thumbheight: Math.round(1280 * (o.height ?? 2667) / (o.width ?? 4000)),
    url: `https://upload.wikimedia.org/wikipedia/commons/a/ab/${encodeURIComponent(title)}`,
    extmetadata: {
      ObjectName: { value: title.replace(/\.jpg$/i, '') },
      Artist: { value: o.artist ?? 'Martin St-Amant (<a href="//commons.wikimedia.org/wiki/User:S23678">S23678</a>)' },
      LicenseShortName: { value: o.license ?? 'CC BY-SA 3.0' },
      DateTimeOriginal: { value: o.date ?? '2009-06-27' },
    },
  }],
});

const RESULTS = {
  'Machu Picchu': [
    file(1, 'Peru location map.jpg'),                                   // a map: skipped
    file(2, 'Machu Picchu tiny.jpg', { width: 640, height: 480 }),     // too small: skipped
    file(3, 'Machu Picchu all rights reserved.jpg', { license: 'All rights reserved' }), // not free: skipped
    file(4, '80 - Machu Picchu - Juin 2009 - edit.jpg'),
  ],
  'Lake Titicaca': [file(1, 'Amanecer en el lago Titicaca, Puno, Perú, 2015-08-01, DD 01.JPG', { artist: 'Diego Delso', license: 'CC BY-SA 4.0', date: '2015-08-01' })],
  'Cusco Plaza de Armas': [file(1, 'Plaza de Armas del Cusco.jpg', { license: 'CC0', artist: '' })],
  'Peruvian Amazon rainforest': [file(1, 'Amazon river Peru.jpg', { license: 'Public domain' })],
  ceviche: [file(1, 'Ceviche peruano.jpg', { license: 'CC BY 2.0', artist: 'Jane Doe' })],
};

/** A stand-in for fetch that answers like Commons; the first call per query can be "busy". */
function fakeFetch({ busyOnce = false } = {}) {
  const busy = new Set();
  const calls = [];
  const f = async (url) => {
    const q = new URL(url).searchParams.get('gsrsearch').replace(/ filetype:bitmap$/, '');
    calls.push(q);
    if (busyOnce && !busy.has(q)) {
      busy.add(q);
      return { ok: false, status: 429, headers: { get: () => '0' }, json: async () => ({}) };
    }
    const pages = Object.fromEntries((RESULTS[q] ?? []).map((p) => [String(p.pageid), p]));
    return { ok: true, status: 200, headers: { get: () => null }, json: async () => ({ query: { pages } }) };
  };
  f.calls = calls;
  return f;
}

const SEARCHES = [
  { search: 'Lake Titicaca', kind: 'landscape', title: 'Lake Titicaca lies 3,800 m above sea level', caption: 'One of the highest navigable lakes in the world.' },
  { search: 'Machu Picchu', kind: 'building', title: 'Machu Picchu has been a World Heritage Site since 1983', caption: 'Built in the 15th century.' },
  { search: 'Cusco Plaza de Armas', kind: 'building', title: 'Cusco was the Inca capital', caption: '' },
  { search: 'Peruvian Amazon rainforest', kind: 'landscape', title: 'The rainforest covers about 60 % of Peru', caption: '' },
  { search: 'ceviche', kind: 'detail', title: 'Ceviche is the national dish', caption: '' },
];

test('only free, large, photographic files are kept', async () => {
  const found = await searchCommons('Machu Picchu', { fetch: fakeFetch() });
  assert.deepEqual(found.map((c) => c.page.title), ['File:80 - Machu Picchu - Juin 2009 - edit.jpg']);
});

test('a picture carries a credit and an MLA citation without HTML or tracking', () => {
  const [hit] = RESULTS['Machu Picchu'].slice(-1).map((page) => ({ page, info: page.imageinfo[0] }));
  const p = toPicture(hit, SEARCHES[1]);
  assert.equal(p.src.includes('?'), false);
  assert.equal(p.title, SEARCHES[1].title);
  assert.match(p.credit, /^Photo: Martin St-Amant \(S23678\) · CC BY-SA 3\.0 · Wikimedia Commons$/);
  assert.equal(p.citation, 'Martin St-Amant (S23678). 80 - Machu Picchu - Juin 2009 - edit. 2009. Wikimedia Commons, CC BY-SA 3.0, commons.wikimedia.org/w/index.php?curid=4.');
});

test('found pictures become the cover, picture slides and poster mood photos', async () => {
  const pool = { items: [{ kind: 'claim', text: 'x' }], pictureSearches: SEARCHES };
  const out = await attachPictures(pool, { fetch: fakeFetch({ busyOnce: true }) });
  assert.match(out.coverImage.src, /Titicaca/);
  const slides = out.items.filter((it) => it.kind === 'image');
  assert.equal(slides.length, 3, 'three picture slides besides the cover');
  assert.ok(slides.every((it) => it.tags.length === 1 && it.tags[0] === 'evidence'), 'picture slides count as evidence');
  assert.equal(out.mood.length, 5);
  assert.ok(out.items.every((it) => it.kind !== 'image' || it.citation));
});

test('no suggestions, no network, or a failing archive leave the pool as it was', async () => {
  const pool = { items: [], pictureSearches: SEARCHES };
  const bare = { items: [] };
  assert.equal(await attachPictures(bare, { fetch: fakeFetch() }), bare);
  assert.equal(await attachPictures(pool, { fetch: null }), pool);
  assert.equal(await attachPictures(pool, { fetch: async () => ({ ok: false, status: 500 }) }), pool);
  const broken = async () => { throw new Error('offline'); };
  assert.equal(await attachPictures(pool, { fetch: broken }), pool);
});

// The writing step's answer for the Peru notes, as far as the picture part goes.
const PERU = {
  deck: { language: 'en', title: 'Peru between Inca heritage and mass tourism', shortTitle: 'Peru', subtitle: 'Geography, history and culture', posterWords: ['Andes', 'Inca', 'Peru'], posterLines: ['Costa · Sierra · Selva'], placeShort: 'Peru', worksCitedTitle: 'Works Cited' },
  claims: [
    { text: 'Peru must protect its cultural heritage from the pressures of mass tourism.', role: 'thesis' },
    { text: 'Peru has three regions: the coast, the Andean highlands and the Amazon rainforest.', role: 'context' },
    { text: 'Tourism also funds the preservation of sites like Machu Picchu.', role: 'counter' },
    { text: 'Heritage and tourism need one plan, not two.', role: 'takeaway' },
  ],
  figures: [{ title: 'The rainforest covers most of the country', value: '60 %', label: 'of the territory is rainforest', caption: '', source: '', year: 0 }],
  timelines: [{ title: 'From empire to republic', events: [{ date: '15th c.', label: 'Machu Picchu built' }, { date: '1532', label: 'Spanish conquest begins' }, { date: '1821', label: 'Independence declared' }, { date: '1983', label: 'Machu Picchu a World Heritage Site' }] }],
  questions: [{ text: 'How can Peru preserve its heritage while managing mass tourism?', role: 'discussion' }],
  sources: ['UNESCO World Heritage Centre. "Historic Sanctuary of Machu Picchu." UNESCO, whc.unesco.org/en/list/274.'],
  pictures: SEARCHES,
};

test('the writing step passes picture searches on, cleaned', () => {
  const pool = toPool({ ...PERU, pictures: [...SEARCHES, { search: '', title: 'empty' }, { search: 'x', kind: 'weird', title: 'X' }] });
  assert.equal(pool.pictureSearches.length, 5);
  assert.deepEqual(pool.pictureSearches[0], SEARCHES[0]);
  assert.equal(toPool({ ...PERU, pictures: [{ search: 'x', kind: 'weird', title: 'X' }] }).pictureSearches[0].kind, 'landscape');
});

test('a Peru deck shows the found pictures in every look and cites each one', async () => {
  const pool = await attachPictures(toPool(PERU), { fetch: fakeFetch() });
  for (const family of ['glass', 'poster', 'editorial', 'texture']) {
    for (const seed of ['a', 'b', 'c']) {
      for (const deck of buildDirections({ pool, occasionId: 'seminar', family, seed })) {
        const imgs = deck.slides.flatMap((s) => s.els).filter((e) => e.type === 'image' && /^https:/.test(e.src));
        assert.ok(imgs.length >= 1, `${family}/${deck.direction.id} shows a found picture`);
        const refs = deck.slides.find((s) => s.form === 'references');
        for (const im of imgs) {
          const pic = [pool.coverImage, ...pool.items, ...pool.mood].find((p) => p?.src === im.src);
          assert.ok(pic, 'every online picture comes from the pool');
          if (refs) assert.ok(refs.item.entries.includes(pic.citation), `${family}/${deck.direction.id}: ${pic.title} is cited`);
        }
        if (family === 'poster') assert.ok(imgs.every((e) => e.filter), 'online poster photos get the direction\'s colour grade');
        assert.deepEqual(deck.overflow, [], `${family}/${deck.direction.id} has no overflow`);
      }
    }
  }
});
