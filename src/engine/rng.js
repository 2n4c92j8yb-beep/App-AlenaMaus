// Small seeded random generator (mulberry32), so a set of directions can be
// reproduced from its seed and "three new directions" just moves the seed on.

export function createRng(seed) {
  let a = hashSeed(seed);
  const next = () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return {
    next,
    /** Pick one entry, weighted by weightOf(entry). */
    weighted(list, weightOf) {
      const weights = list.map((x) => Math.max(0, weightOf(x)));
      const total = weights.reduce((s, x) => s + x, 0);
      if (total <= 0) return list[Math.floor(next() * list.length)];
      let r = next() * total;
      for (let i = 0; i < list.length; i++) {
        r -= weights[i];
        if (r <= 0) return list[i];
      }
      return list[list.length - 1];
    },
  };
}

function hashSeed(seed) {
  const s = String(seed);
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
