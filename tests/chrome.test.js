// Glass look: every chrome object has a baked 3D render from its direction's studio.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { buildDirections } from '../src/engine/build.js';
import { OCCASIONS } from '../src/library/occasions.js';
import { SAMPLE_POOL } from '../src/sample/great-vowel-shift.js';
import { chromeSrc, groundFor, STUDIOS, CAPSULE_ASPECT } from '../src/render/studio.js';

test('every chrome object in a Glass deck has its baked render, studio and shadow', () => {
  let n = 0;
  for (const o of OCCASIONS) for (let s = 0; s < 6; s++) {
    for (const deck of buildDirections({ pool: SAMPLE_POOL, occasionId: o.id, seed: s, family: 'glass' })) {
      for (const sl of deck.slides) for (const e of sl.els) {
        if (e.type !== 'chrome') continue;
        n++;
        assert.ok(STUDIOS[e.studio], `${deck.direction.id}: chrome without a studio`);
        const src = chromeSrc(e);
        assert.ok(existsSync(new URL(`../${src}`, import.meta.url)), `missing render ${src}`);
        if (e.kind === 'capsule') {
          const ar = Math.max(e.w / e.h, e.h / e.w);
          assert.ok(Math.abs(ar / CAPSULE_ASPECT - 1) <= 0.15, `${deck.direction.id}: capsule ${e.w}×${e.h} would stretch its render by more than 15%`);
        }
        if (!e.back) for (const g of groundFor(e)) assert.ok(g.y >= e.y, 'the shadow falls below the object');
      }
    }
  }
  assert.ok(n > 0, 'no chrome objects found');
});
