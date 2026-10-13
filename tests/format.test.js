import test from 'node:test';
import assert from 'node:assert/strict';
import { formatCs, digits6, splitCs, msToCs } from '../src/format.js';

test('dansk stopur-format som iPhone', () => {
  assert.equal(formatCs(0), '00.00,00');
  assert.equal(formatCs(136), '00.01,36');
  assert.equal(formatCs(549), '00.05,49');
  assert.equal(formatCs(6000 * 10 + 1437), '10.14,37');
  assert.equal(formatCs(359999), '59.59,99');
});

test('fra 1 time vises timer uden foranstillet nul', () => {
  assert.equal(formatCs(360000), '1.00.00,00');
  assert.equal(formatCs(360000 * 12 + 6000 * 3 + 405), '12.03.04,05');
});

test('digits6 og splitCs', () => {
  assert.equal(digits6(144387), '240387');
  assert.deepEqual(splitCs(360000 + 6001), { h: 1, m: 1, s: 0, hh: 1 });
  assert.equal(digits6(360000 + 1437), '001437');
});

test('msToCs runder ned og tåler flydende tal', () => {
  assert.equal(msToCs(14370), 1437);
  assert.equal(msToCs(14379.999), 1437);
  assert.equal(msToCs(0.1 * 3 * 10 * 10), 3);
});
