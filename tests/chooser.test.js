import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createChooser, nextRound, choose, back, TRAITS } from '../src/engine/chooser.js';
import { DIRECTIONS } from '../src/library/directions.js';

const fits = DIRECTIONS.filter((d) => (d.suits.seminar ?? 0) > 0);
const start = () => createChooser(fits, (d) => d.suits.seminar);

test('every round is an either/or between two directions, until one is left', () => {
  for (let path = 0; path < 64; path++) {
    let ch = start();
    let r;
    let n = 0;
    while ((r = nextRound(ch)).kind !== 'done') {
      assert.equal(r.options.length, 2);
      assert.notEqual(r.options[0].direction.id, r.options[1].direction.id);
      assert.ok(r.left >= 2);
      ch = choose(ch, (path >> n) & 1);
      n++;
      assert.ok(n <= 12, 'narrows down in a few rounds');
    }
    assert.ok(fits.some((d) => d.id === r.direction.id));
    assert.equal(r.round, n);
  }
});

test('a trait question shows one direction from each side, and the answer keeps that side', () => {
  const ch = start();
  const r = nextRound(ch);
  assert.equal(r.kind, 'trait');
  const trait = TRAITS.find((t) => t.id === r.trait);
  assert.equal(trait.of(r.options[0].direction), 0);
  assert.equal(trait.of(r.options[1].direction), 1);
  const after = choose(ch, 1);
  assert.equal(after.left.length, r.options[1].count);
  assert.ok(after.left.every((id) => trait.of(fits.find((d) => d.id === id)) === 1));
});

test('no preference skips the question without dropping anyone; back undoes an answer', () => {
  const ch = start();
  const first = nextRound(ch);
  const skipped = choose(ch, null);
  assert.equal(skipped.left.length, ch.left.length);
  assert.notEqual(nextRound(skipped).trait, first.trait);
  const answered = choose(ch, 0);
  assert.deepEqual(back(answered), ch);
  assert.equal(back(ch), ch);
});

test('the person decides: whatever they pick in a duel wins', () => {
  // two directions that no question tells apart meet head to head
  const twins = [fits[0], { ...fits[0], id: 'twin', name: 'Twin' }];
  let ch = createChooser(twins, (d) => (d.id === 'twin' ? 0 : 5));
  const r = nextRound(ch);
  assert.equal(r.kind, 'duel');
  ch = choose(ch, 1);
  assert.equal(nextRound(ch).direction.id, r.options[1].direction.id);
});
