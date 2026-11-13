// Pictures for decks written from the user's notes. The writing step suggests what
// could be shown ("Machu Picchu", "Lake Titicaca" …); this module looks each
// suggestion up on Unsplash (through the app's server, which holds the key) and on
// Wikimedia Commons (free licences only), and adds the photos to the content pool
// with a credit line and an MLA citation for Works Cited.
//
// Runs in the browser (Commons allows anonymous cross-origin requests with
// origin=*), so the server path and the copy-paste fallback both get pictures.
// Any failure leaves the pool as it was: a deck without pictures still works.

const API = 'https://commons.wikimedia.org/w/api.php';

// licences that allow reuse in a presentation with attribution
const FREE = /^(cc0|cc[ -]?zero|public domain|pd\b|pd-|cc by(-sa)? ?\d)/i;
// files that are rarely good slide pictures
const SKIP = /\b(map|maps|karte|locator|location|flag|flagge|coat of arms|wappen|escudo|logo|diagram|chart|graph|stamp|briefmarke|banknote|coin|seal|icon|svg|screenshot|plan)\b/i;

const MOOD_TAGS = {
  historical: ['texture', 'detail', 'interior'],
  landscape: ['wide', 'depth', 'sky', 'city'],
  building: ['architecture', 'interior', 'symmetric', 'depth'],
  detail: ['texture', 'detail'],
};

const plain = (html) => String(html ?? '').replace(/<[^>]*>/g, '').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#0?39;/g, '’').replace(/&[a-z]+;/g, ' ').replace(/\s+/g, ' ').trim();
const meta = (info, key) => plain(info?.extmetadata?.[key]?.value);
const clipWords = (t, max) => (t.length <= max ? t : `${t.slice(0, t.lastIndexOf(' ', max - 1) > max / 2 ? t.lastIndexOf(' ', max - 1) : max - 1)}…`);
const stripTracking = (url) => String(url ?? '').replace(/\?.*$/, '');

/** Ask Commons for photos matching one search. Returns usable candidates, best first. */
export async function searchCommons(query, { fetch: f = globalThis.fetch, signal, limit = 15 } = {}) {
  const params = new URLSearchParams({
    action: 'query', format: 'json', origin: '*',
    generator: 'search', gsrnamespace: '6', gsrsearch: `${query} filetype:bitmap`, gsrlimit: String(limit),
    prop: 'imageinfo', iiprop: 'url|size|mime|extmetadata', iiurlwidth: '1280',
    iiextmetadatafilter: 'LicenseShortName|Artist|ObjectName|DateTimeOriginal',
  });
  let res = await f(`${API}?${params}`, { signal });
  if (res.status === 429) {
    // busy: wait as asked (at most 3 s) and try once more
    const wait = Math.min(3, Number(res.headers?.get?.('retry-after')) || 1.5) * 1000;
    await new Promise((r) => setTimeout(r, wait));
    res = await f(`${API}?${params}`, { signal });
  }
  if (!res.ok) throw new Error(`Commons answered ${res.status}`);
  const data = await res.json();
  const pages = Object.values(data?.query?.pages ?? {});
  return pages
    .map((p) => ({ page: p, info: p.imageinfo?.[0] }))
    .filter(({ page, info }) => {
      if (!info || !/^image\/(jpeg|png)$/.test(info.mime)) return false;
      if (info.width < 1000 || info.height < 650) return false;
      const ratio = info.width / info.height;
      if (ratio < 0.7 || ratio > 2.2) return false;
      if (SKIP.test(page.title)) return false;
      return FREE.test(meta(info, 'LicenseShortName'));
    })
    // Commons' own relevance first, landscape photos slightly preferred (slides are wide)
    .map(({ page, info }) => ({ page, info, score: (page.index ?? 99) + (info.width / info.height < 1.15 ? 4 : 0) }))
    .sort((a, b) => a.score - b.score);
}

/** A Commons result as a picture the deck can show, with its credit and MLA citation. */
export function toPicture({ page, info }, suggestion = {}) {
  const file = page.title.replace(/^File:/, '');
  const name = clipWords(meta(info, 'ObjectName') || file.replace(/\.[a-z0-9]+$/i, '').replace(/_/g, ' '), 90);
  const artist = meta(info, 'Artist').replace(/^(unknown|anonymous)\b.*$/i, '').slice(0, 80);
  const license = meta(info, 'LicenseShortName');
  const year = (meta(info, 'DateTimeOriginal').match(/\b(1[5-9]\d\d|20\d\d)\b/) ?? [])[1] ?? '';
  // the short, stable page link (a long file name would be one unbreakable word on the Works Cited slide)
  const url = String(info.descriptionshorturl ?? `commons.wikimedia.org/w/index.php?curid=${page.pageid}`).replace(/^https?:\/\//, '');
  const w = info.thumbwidth ?? info.width;
  const h = info.thumbheight ?? info.height;
  const title = suggestion.title || name;
  return {
    src: stripTracking(info.thumburl ?? info.url), w, h,
    alt: suggestion.alt || suggestion.title || name,
    title,
    caption: suggestion.caption ?? '',
    credit: [artist ? `Photo: ${artist}` : 'Photo', license, 'Wikimedia Commons'].join(' · '),
    citation: [artist && `${artist.replace(/\.$/, '')}.`, `${name.replace(/\.$/, '')}.`, year && `${year}.`, `Wikimedia Commons, ${license}, ${url}.`].filter(Boolean).join(' '),
    tags: [...(MOOD_TAGS[suggestion.kind] ?? MOOD_TAGS.landscape), ...(w / h > 1.3 ? ['wide'] : [])],
  };
}

/** An Unsplash result (from api/unsplash.js) as a picture, credited and cited the way Unsplash asks. */
export function fromUnsplash(photo, suggestion = {}) {
  const author = photo.author || 'Unknown photographer';
  const desc = clipWords((photo.description || suggestion.title || 'Photograph').replace(/\s+/g, ' ').replace(/^./, (c) => c.toUpperCase()), 80);
  const url = `unsplash.com/photos/${photo.id}`;
  const date = photo.date ? new Date(`${photo.date}T12:00:00Z`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }) : '';
  return {
    src: photo.src, w: photo.w, h: photo.h,
    alt: suggestion.alt || photo.alt || suggestion.title || desc,
    title: suggestion.title || desc,
    caption: suggestion.caption ?? '',
    credit: `Photo: ${author} · Unsplash`,
    // MLA: Photographer. "Description." Unsplash, date, URL.
    citation: [`${author.replace(/\.$/, '')}.`, `“${desc.replace(/\.$/, '')}.”`, `Unsplash${date ? `, ${date}` : ''}, ${url}.`].join(' '),
    tags: [...(MOOD_TAGS[suggestion.kind] ?? MOOD_TAGS.landscape), ...(photo.w / photo.h > 1.3 ? ['wide'] : [])],
    source: 'unsplash',
    id: `unsplash:${photo.id}`,
    download: photo.download,
  };
}

/**
 * Ask the app's own server for Unsplash photos (the key stays there).
 * Returns null when Unsplash is not available (no key, limit reached, running without the server).
 */
export async function searchUnsplashViaServer(query, { fetch: f = globalThis.fetch, signal, base = '' } = {}) {
  const res = await f(`${base}/api/unsplash?query=${encodeURIComponent(query)}`, { signal });
  if (!res.ok) return null;
  const data = await res.json().catch(() => null);
  return Array.isArray(data?.photos) ? data.photos : null;
}

// Historical subjects (artworks, manuscripts, portraits, old objects) are on Commons,
// not on Unsplash; everything else looks best from Unsplash first.
const commonsFirst = (s) => s.kind === 'historical';

/**
 * Look up the pool's picture suggestions and add what was found:
 * the first picture becomes the cover, up to three more become picture slides,
 * and all of them serve as mood photos for the poster look.
 * Sources: Unsplash (through api/unsplash.js) and Wikimedia Commons, each the
 * fallback for the other. Never throws; returns the pool unchanged when nothing is found.
 */
export async function attachPictures(pool, { fetch: f = globalThis.fetch, timeout = 12000, base = '' } = {}) {
  const wanted = (pool?.pictureSearches ?? []).filter((s) => s?.search);
  if (!wanted.length || typeof f !== 'function') return pool;
  const ctrl = typeof AbortController === 'function' ? new AbortController() : null;
  const timer = ctrl ? setTimeout(() => ctrl.abort(), timeout) : null;
  let unsplashOn = true; // switched off after the first sign that Unsplash is not available
  const seen = new Set();

  const fromUnsplashFor = async (s) => {
    if (!unsplashOn) return null;
    const photos = await searchUnsplashViaServer(s.search, { fetch: f, signal: ctrl?.signal, base }).catch(() => null);
    if (photos === null) { unsplashOn = false; return null; }
    const hit = photos.find((p) => !seen.has(`unsplash:${p.id}`));
    if (!hit) return null;
    seen.add(`unsplash:${hit.id}`);
    return fromUnsplash(hit, s);
  };
  const fromCommonsFor = async (s) => {
    const candidates = await searchCommons(s.search, { fetch: f, signal: ctrl?.signal }).catch(() => []);
    const hit = candidates.find((c) => !seen.has(c.page.title));
    if (!hit) return null;
    seen.add(hit.page.title);
    return toPicture(hit, s);
  };
  const find = async (s) => (commonsFirst(s)
    ? (await fromCommonsFor(s)) ?? (await fromUnsplashFor(s))
    : (await fromUnsplashFor(s)) ?? (await fromCommonsFor(s)));

  try {
    // two searches at a time: gentle on both services' rate limits, still quick
    const results = new Array(wanted.length);
    let next = 0;
    const worker = async () => {
      while (next < wanted.length) {
        const i = next++;
        results[i] = await find(wanted[i]).catch(() => null);
      }
    };
    await Promise.all([worker(), worker()]);
    const found = results.filter(Boolean);
    if (!found.length) return pool;
    // Unsplash asks to be told which photos are used
    found.filter((p) => p.download).forEach((p) => f(`${base}/api/unsplash?track=${encodeURIComponent(p.download)}`).catch(() => {}));
    const clean = ({ tags, source, id, download, ...p }) => p;
    const [first, ...rest] = found;
    const cover = clean(first);
    // `tags` on a picture are its mood tags (poster look); as a slide it is evidence
    const slides = rest.slice(0, 3).map((p, i) => ({ ...clean(p), kind: 'image', tags: ['evidence'], weight: i === 0 ? 3 : 2 }));
    const mood = found.map((p) => ({ src: p.src, w: p.w, h: p.h, alt: p.alt, caption: p.title, citation: p.citation, tags: p.tags }));
    const sources = [...new Set(found.map((p) => (p.source === 'unsplash' ? 'Unsplash' : 'Wikimedia Commons')))];
    return { ...pool, coverImage: cover, mood, items: [...pool.items, ...slides], pictureSource: sources.join(' and ') };
  } catch {
    return pool;
  } finally {
    if (timer) clearTimeout(timer);
  }
}
