import test from 'node:test';
import assert from 'node:assert/strict';
import { VALUE_CELLS, SUIT_ROWS, cardFromInput } from '../src/home.js';

test('hjemmeskærm: 13 værdi-ikoner og 4 kulør-rækker (CHSD)', () => {
  const vals = Object.values(VALUE_CELLS).sort((a, b) => a - b);
  assert.deepEqual(vals, [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13]);
  assert.equal(VALUE_CELLS['1,3'], 1); // Påmindelser
  assert.equal(VALUE_CELLS['5,3'], 13); // YouTube
  assert.deepEqual(Object.values(SUIT_ROWS), ['C', 'H', 'S', 'D']);
});

test('kort ud fra input – mangler en del, bruges det gamle kort', () => {
  assert.equal(cardFromInput(7, 'H'), '7H');
  assert.equal(cardFromInput(1, 'S'), 'AS');
  assert.equal(cardFromInput(13, 'D'), 'KD');
  assert.equal(cardFromInput(11, null, '5C'), 'JC');
  assert.equal(cardFromInput(null, 'H', '10S'), '10H');
});
