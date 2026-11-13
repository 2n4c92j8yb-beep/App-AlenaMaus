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

// ---------------------------------------------------------------- Unsplash

import handler, { toPhoto, unsplashKey } from '../api/unsplash.js';

const unsplashResult = (id, o = {}) => ({
  id, width: o.width ?? 6000, height: o.height ?? 4000, created_at: '2019-05-14T10:00:00Z',
  description: o.description ?? null, alt_description: o.alt ?? 'green mountains beside a river during daytime',
  urls: { raw: `https://images.unsplash.com/photo-${id}?ixid=abc` },
  user: { name: o.author ?? 'Willian Justen de Vasconcellos', links: { html: 'https://unsplash.com/@willianjusten' } },
  links: { html: `https://unsplash.com/photos/${id}`, download_location: `https://api.unsplash.com/photos/${id}/download?ixid=abc` },
});

/** The app's server for /api/unsplash plus Commons, as the browser sees them. */
function appFetch({ unsplash = true } = {}) {
  const commons = fakeFetch();
  const calls = [];
  const f = async (url, o) => {
    calls.push(url);
    if (url.startsWith('/api/unsplash?track=')) return { ok: true, status: 204, json: async () => ({}) };
    if (url.startsWith('/api/unsplash')) {
      if (!unsplash) return { ok: false, status: 503, json: async () => ({ error: 'not set up' }) };
      const q = new URLSearchParams(url.split('?')[1]).get('query');
      const photos = q === 'ceviche' ? [] : [toPhoto(unsplashResult(`${q.length}-a`)), toPhoto(unsplashResult(`${q.length}-b`))];
      return { ok: true, status: 200, json: async () => ({ photos }) };
    }
    return commons(url, o);
  };
  f.calls = calls;
  return f;
}

test('an Unsplash result keeps what a slide and its MLA citation need', () => {
  const p = toPhoto(unsplashResult('xyz'));
  assert.equal(p.src, 'https://images.unsplash.com/photo-xyz?ixid=abc&w=1600&q=80&fm=jpg&fit=max');
  assert.equal(p.h, 1067);
  assert.equal(p.download, 'https://api.unsplash.com/photos/xyz/download?ixid=abc');
});

test('Unsplash first, Commons where Unsplash has nothing or for historical subjects', async () => {
  const f = appFetch();
  const searches = [...SEARCHES, { search: 'Machu Picchu', kind: 'historical', title: 'An old view', caption: '' }];
  const out = await attachPictures({ items: [], pictureSearches: searches }, { fetch: f });
  assert.match(out.coverImage.src, /images\.unsplash\.com/);
  assert.match(out.coverImage.credit, /^Photo: Willian Justen de Vasconcellos · Unsplash$/);
  assert.equal(out.coverImage.citation, 'Willian Justen de Vasconcellos. “Green mountains beside a river during daytime.” Unsplash, 14 May 2019, unsplash.com/photos/13-a.');
  const srcs = out.mood.map((m) => m.src);
  assert.ok(srcs.some((s) => /Ceviche/.test(s)), 'ceviche (nothing on Unsplash) comes from Commons');
  assert.ok(srcs.at(-1).includes('Machu'), 'the historical subject comes from Commons');
  assert.equal(new Set(srcs).size, srcs.length, 'no photo twice');
  assert.equal(out.pictureSource, 'Unsplash and Wikimedia Commons');
  const tracked = f.calls.filter((u) => u.includes('track='));
  assert.equal(tracked.length, out.mood.filter((m) => /unsplash/.test(m.src)).length, 'each Unsplash photo used is reported');
});

test('without the Unsplash key the deck still gets Commons photos, asking Unsplash only once', async () => {
  const f = appFetch({ unsplash: false });
  const out = await attachPictures({ items: [], pictureSearches: SEARCHES }, { fetch: f });
  assert.equal(out.mood.length, 5);
  assert.ok(out.mood.every((m) => !/unsplash/.test(m.src)));
  assert.ok(f.calls.filter((u) => u.startsWith('/api/unsplash')).length <= 2, 'two parallel searches at most');
});

test('the server keeps the key, validates input and passes Unsplash results on', async () => {
  const run = async (query, env = 'k-123', upstream) => {
    const saved = { key: process.env.UNSPLASH_ACCESS_KEY, fetch: globalThis.fetch };
    if (env) process.env.UNSPLASH_ACCESS_KEY = env; else delete process.env.UNSPLASH_ACCESS_KEY;
    const seen = [];
    globalThis.fetch = async (url, o) => { seen.push({ url, auth: o?.headers?.Authorization }); return upstream ?? { ok: true, status: 200, json: async () => ({ results: [unsplashResult('a1'), unsplashResult('tall', { width: 1000, height: 3000 })] }) }; };
    const res = { code: 0, body: null, headers: {}, status(c) { this.code = c; return this; }, json(b) { this.body = b; return this; }, end() { return this; }, setHeader(k, v) { this.headers[k] = v; } };
    try { await handler({ method: 'GET', query }, res); } finally {
      if (saved.key === undefined) delete process.env.UNSPLASH_ACCESS_KEY; else process.env.UNSPLASH_ACCESS_KEY = saved.key;
      globalThis.fetch = saved.fetch;
    }
    return { res, seen };
  };
  let { res, seen } = await run({ query: 'Machu Picchu' });
  assert.equal(res.code, 200);
  assert.deepEqual(res.body.photos.map((p) => p.id), ['a1'], 'very tall photos are left out');
  assert.equal(seen[0].auth, 'Client-ID k-123');
  assert.ok(!JSON.stringify(res.body).includes('k-123'), 'the key never reaches the browser');
  ({ res } = await run({ query: 'x' }, ''));
  assert.equal(res.code, 503);
  ({ res, seen } = await run({ track: 'https://evil.example/steal' }));
  assert.equal(res.code, 400);
  assert.equal(seen.length, 0);
  ({ res, seen } = await run({ track: 'https://api.unsplash.com/photos/a1/download?ixid=abc' }));
  assert.equal(res.code, 204);
  ({ res } = await run({ query: 'x' }, 'k', { ok: false, status: 403, json: async () => ({}) }));
  assert.equal(res.code, 403, 'hourly limit reached: the browser falls back to Commons');
  process.env.UNSPLASH_KEY = ' "k-pasted" ';
  delete process.env.UNSPLASH_ACCESS_KEY;
  assert.equal(unsplashKey(), 'k-pasted');
  delete process.env.UNSPLASH_KEY;
});
