import { test } from 'node:test';
import assert from 'node:assert/strict';
import { numberFromDigits, cellAt, valueAt, suitAt, cardFromInput } from '../src/fhinput.js';

// Geometri som FakeHome måler den (6 rækker × 4 kolonner, 1179×2556)
const geo = { W: 1179, H: 2556, icon: 225, cols: [58, 337, 618, 897], rows: [245, 524, 803, 1082, 1361, 1640], dotsTop: 2050 };
const C = [170, 449, 730, 1009];
const R = [357, 636, 915, 1194, 1473, 1752];
const at = (r, c) => cellAt(geo, C[c], R[r]);

test('tal fra cifre bevarer foranstillet nul', () => {
  assert.equal(numberFromDigits([0, 7]), '07');
  assert.equal(numberFromDigits([3, 7]), '37');
  assert.equal(numberFromDigits([4, null]), '4');
  assert.equal(numberFromDigits([null, null]), null);
});

test('værdier: række 3-6, kolonne 2-4 = 1-12, sort felt = K', () => {
  const got = [];
  for (let r = 2; r <= 5; r++) for (let c = 1; c <= 3; c++) got.push(valueAt(geo, at(r, c)));
  assert.deepEqual(got, [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
  assert.equal(valueAt(geo, cellAt(geo, 100, 1960)), 13);
  assert.equal(valueAt(geo, cellAt(geo, 1100, 1960)), 13);
  assert.equal(valueAt(geo, at(2, 0)), null); // venstre kolonne
  assert.equal(valueAt(geo, at(1, 2)), null); // over blokken
});

test('kulør: hele rækken, CHSD', () => {
  assert.equal(suitAt(geo, at(2, 0)), 'C');
  assert.equal(suitAt(geo, at(3, 2)), 'H');
  assert.equal(suitAt(geo, at(4, 3)), 'S');
  assert.equal(suitAt(geo, at(5, 1)), 'D');
  assert.equal(suitAt(geo, at(0, 1)), null);
});

test('flere rækker: blokken regnes fra bunden', () => {
  const g7 = { ...geo, rows: [100, 379, 658, 937, 1216, 1495, 1774], dotsTop: 2300 };
  assert.equal(valueAt(g7, cellAt(g7, 449, 658 + 112)), null);
  assert.equal(valueAt(g7, cellAt(g7, 449, 937 + 112)), 1);
  assert.equal(suitAt(g7, cellAt(g7, 449, 1774 + 112)), 'D');
});

test('kort fra værdi og kulør', () => {
  assert.equal(cardFromInput(7, 'H'), '7H');
  assert.equal(cardFromInput(13, 'S'), 'KS');
  assert.equal(cardFromInput(1, 'C'), 'AC');
  assert.equal(cardFromInput(12, null, '5D'), 'QD');
  assert.equal(cardFromInput(null, 'H', '5D'), '5H');
});
