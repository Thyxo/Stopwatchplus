import test from 'node:test';
import assert from 'node:assert/strict';
import { buildPlan, splitItems, dateDigits, patSSHH, checkPattern, fmtPat } from '../src/targets.js';
import { patternToString } from '../src/engine.js';
import { DEFAULTS, cloneSettings, mergeSettings, loadSettings } from '../src/settings.js';

const S = (over) => Object.assign(cloneSettings(DEFAULTS), over);
const P = (p) => patternToString(p);

test('enkelt tid: placering ud fra antal cifre', () => {
  assert.equal(P(buildPlan(S({ mode: 'single', single: { value: '37', placement: 'auto' } })).stop), '????37');
  assert.equal(P(buildPlan(S({ mode: 'single', single: { value: '14:37', placement: 'auto' } })).stop), '??1437');
  assert.equal(P(buildPlan(S({ mode: 'single', single: { value: '240387', placement: 'auto' } })).stop), '240387');
  assert.equal(P(buildPlan(S({ mode: 'single', single: { value: '1437', placement: 'hh' } })).stop), '????37');
});

test('talrække: mellemrum, komma og lange tal', () => {
  assert.deepEqual(splitItems('5 12,17;23'), ['05', '12', '17', '23']);
  assert.deepEqual(splitItems('12345678'), ['12', '34', '56', '78']);
  assert.deepEqual(splitItems('123'), ['01', '23']);
  assert.deepEqual(splitItems('1234', 1), ['1', '2', '3', '4']);
  const plan = buildPlan(S({ mode: 'sequence', sequence: { text: '5 12 17 23 28 31 36', per: 2, stopTakes: true } }));
  assert.equal(plan.laps.length, 7);
  assert.equal(P(plan.laps[0]), '????05');
  assert.equal(plan.stopTakesNextLap, true);
  const pin = buildPlan(S({ mode: 'sequence', sequence: { text: '2580', per: 1, stopTakes: true } }));
  assert.deepEqual(pin.laps.map(P), ['?????2', '?????5', '?????8', '?????0']);
});

test('dato: i dag, i morgen (også månedsskifte) og fødselsdato', () => {
  const d = new Date(2026, 9, 13);
  assert.equal(dateDigits('today', '', d), '131026');
  assert.equal(dateDigits('tomorrow', '', d), '141026');
  assert.equal(dateDigits('tomorrow', '', new Date(2026, 11, 31)), '010127');
  assert.equal(dateDigits('custom', '24-03-87', d), '240387');
  assert.equal(dateDigits('custom', '2403', d), null);
  const laps = buildPlan(S({ mode: 'date', date: { which: 'custom', custom: '240387', placement: 'laps', stopTakes: true } }), d);
  assert.deepEqual(laps.laps.map(P), ['????24', '????03', '????87']);
  const full = buildPlan(S({ mode: 'date', date: { which: 'custom', custom: '240387', placement: 'mmsshh' } }), d);
  assert.equal(P(full.stop), '240387');
  const sshh = buildPlan(S({ mode: 'date', date: { which: 'custom', custom: '240387', placement: 'sshh' } }), d);
  assert.equal(P(sshh.stop), '??2403');
});

test('cifferkode: 2100 som 00.21,00 eller 21.00', () => {
  assert.equal(P(buildPlan(S({ mode: 'code', code: { value: '2100', placement: 'sshh' } })).stop), '??2100');
  assert.equal(P(buildPlan(S({ mode: 'code', code: { value: '2100', placement: 'mmss' } })).stop), '2100??');
  assert.equal(P(buildPlan(S({ mode: 'code', code: { value: '2100', placement: 'hh' } })).stop), '????00');
  assert.deepEqual(buildPlan(S({ mode: 'code', code: { value: '2100', placement: 'laps', stopTakes: true } })).laps.map(P), ['????21', '????00']);
});

test('ugyldige sekunder/minutter giver fejl og ingen force', () => {
  const plan = buildPlan(S({ mode: 'code', code: { value: '7500', placement: 'sshh' } }));
  assert.equal(plan.error, 'Sekunder skal være 00-59');
  assert.equal(plan.stop, null);
  assert.equal(checkPattern(patSSHH('5999')), null);
  assert.equal(fmtPat(patSSHH('1437')), '––.14,37');
});

test('liste: linje for linje, kommentarer ignoreres', () => {
  const s = S({ mode: 'list', list: { text: '# bogtest\n47 12 05\n112 8 3\n', index: 1, placement: 'laps', stopTakes: true, advance: true } });
  const plan = buildPlan(s);
  assert.equal(plan.listIndex, 1);
  assert.equal(plan.listCount, 2);
  assert.deepEqual(plan.laps.map(P), ['????01', '????12', '????08', '????03']);
  s.list.index = 2; // ruller rundt
  assert.equal(buildPlan(s).listIndex, 0);
});

test('indstillinger: ukendte/forkerte felter ignoreres', () => {
  const m = mergeSettings(DEFAULTS, { mode: 'date', jumpTol: 'x', hacker: 1, date: { which: 'today' } });
  assert.equal(m.mode, 'date');
  assert.equal(m.jumpTol, 0);
  assert.equal(m.hacker, undefined);
  assert.equal(m.date.which, 'today');
  assert.equal(m.date.placement, 'laps');
  const broken = { getItem: () => '{ikke json' };
  assert.equal(loadSettings(broken).mode, DEFAULTS.mode);
});
