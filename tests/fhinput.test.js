import { test } from 'node:test';
import assert from 'node:assert/strict';
import { numberFromDigits, cardFromDigits } from '../src/fhinput.js';

test('tal fra cifre bevarer foranstillet nul', () => {
  assert.equal(numberFromDigits([0, 7]), '07');
  assert.equal(numberFromDigits([3, 7]), '37');
  assert.equal(numberFromDigits([4, null]), '4');
  assert.equal(numberFromDigits([null, 9]), '9');
  assert.equal(numberFromDigits([null, null]), null);
});

test('kort-kode: kulør + værdi', () => {
  assert.equal(cardFromDigits([3, 7]), '7S');
  assert.equal(cardFromDigits([1, 1]), 'AC');
  assert.equal(cardFromDigits([2, 0]), '10H');
  assert.equal(cardFromDigits([4, 9]), '9D');
});

test('kort-kode: billedkort med kulør + 4', () => {
  assert.equal(cardFromDigits([5, 1]), 'JC');
  assert.equal(cardFromDigits([6, 2]), 'QH');
  assert.equal(cardFromDigits([7, 3]), 'KS');
  assert.equal(cardFromDigits([8, 3]), 'KD');
});

test('alle 52 kort kan tastes, og ugyldige koder giver null', () => {
  const seen = new Set();
  for (let a = 0; a <= 9; a++) for (let b = 0; b <= 9; b++) { const c = cardFromDigits([a, b]); if (c) seen.add(c); }
  assert.equal(seen.size, 52);
  assert.equal(cardFromDigits([0, 5]), null);
  assert.equal(cardFromDigits([9, 1]), null);
  assert.equal(cardFromDigits([5, 4]), null);
  assert.equal(cardFromDigits([3, null]), null);
});
