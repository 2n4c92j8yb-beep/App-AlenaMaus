// Vercel serverless function: photo search on Unsplash for the picture finder
// (src/engine/pictures.js). The access key lives only in the Vercel project's
// environment and never reaches the browser.
//
//   GET /api/unsplash?query=Machu%20Picchu   → { photos: [...] }  (landscape-friendly, safe content)
//   GET /api/unsplash?track=<download_location> → tells Unsplash a photo was used (their API guidelines)

const API = 'https://api.unsplash.com';
const UTM = 'utm_source=unprompted&utm_medium=referral';

/** The key under any of the usual names, without stray spaces or quotes from pasting. */
export const unsplashKey = () => String(
  process.env.UNSPLASH_ACCESS_KEY ?? process.env.UNSPLASH_KEY ?? process.env.UNSPLASH_API_KEY ?? process.env.UNSPLASH_CLIENT_ID ?? '',
).trim().replace(/^["']|["']$/g, '');

/** One Unsplash result, reduced to what a slide and its citation need. */
export function toPhoto(r) {
  const raw = String(r?.urls?.raw ?? '');
  if (!raw || !r.width || !r.height) return null;
  const sep = raw.includes('?') ? '&' : '?';
  const w = 1600;
  return {
    id: String(r.id),
    src: `${raw}${sep}w=${w}&q=80&fm=jpg&fit=max`, // hotlinked, as Unsplash asks
    w, h: Math.round((w * r.height) / r.width),
    ratio: r.width / r.height,
    alt: String(r.alt_description ?? r.description ?? '').trim(),
    description: String(r.description ?? r.alt_description ?? '').trim(),
    author: String(r.user?.name ?? '').trim(),
    authorUrl: r.user?.links?.html ? `${r.user.links.html}?${UTM}` : '',
    page: r.links?.html ? `${r.links.html}?${UTM}` : '',
    date: String(r.created_at ?? '').slice(0, 10),
    download: String(r.links?.download_location ?? ''),
  };
}

export async function searchUnsplash(query, key = unsplashKey(), f = fetch) {
  const params = new URLSearchParams({ query, per_page: '12', content_filter: 'high', orientation: 'landscape' });
  const res = await f(`${API}/search/photos?${params}`, { headers: { Authorization: `Client-ID ${key}`, 'Accept-Version': 'v1' } });
  if (!res.ok) {
    const err = new Error(`Unsplash answered ${res.status}`);
    err.status = res.status;
    throw err;
  }
  const data = await res.json();
  return (data?.results ?? []).map(toPhoto).filter((p) => p && p.ratio >= 0.7 && p.ratio <= 2.2);
}

export default async function handler(req, res) {
  if (req.method !== 'GET') { res.status(405).json({ error: 'Use GET.' }); return; }
  const key = unsplashKey();
  if (!key) { res.status(503).json({ error: 'Unsplash is not set up on this server.' }); return; }
  const { query, track } = req.query ?? {};
  try {
    if (track) {
      // only Unsplash's own download links, so this cannot be used to call anything else
      if (!/^https:\/\/api\.unsplash\.com\/photos\/[\w-]+\/download(\?|$)/.test(String(track))) { res.status(400).json({ error: 'Not an Unsplash download link.' }); return; }
      await fetch(String(track), { headers: { Authorization: `Client-ID ${key}`, 'Accept-Version': 'v1' } });
      res.status(204).end();
      return;
    }
    const q = String(query ?? '').trim().slice(0, 80);
    if (!q) { res.status(400).json({ error: 'Add a search term.' }); return; }
    res.setHeader('Cache-Control', 's-maxage=86400, stale-while-revalidate=604800'); // the same search gives the same photos
    res.status(200).json({ photos: await searchUnsplash(q, key) });
  } catch (err) {
    console.error('unsplash failed', err.status ?? '', err.message);
    // 401: wrong key, 403: hourly limit reached; the browser then uses Wikimedia Commons
    res.status(err.status === 401 || err.status === 403 || err.status === 429 ? err.status : 502).json({ error: 'Unsplash could not be searched.' });
  }
}
