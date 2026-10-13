import test from 'node:test';
import assert from 'node:assert/strict';
import { ROUTINES, applyRoutine, snapshotRoutine } from '../src/routines.js';
import { DEFAULTS, cloneSettings, mergeSettings } from '../src/settings.js';
import { buildPlan } from '../src/targets.js';

test('alle færdige rutiner giver en gyldig plan', () => {
  for (const r of ROUTINES) {
    const s = cloneSettings(DEFAULTS);
    if (r.id === 'birthday') s.date.custom = '240387';
    assert.ok(applyRoutine(s, r.id), r.id);
    assert.equal(s.routine, r.id);
    const plan = buildPlan(s, new Date(2026, 9, 13));
    assert.equal(plan.error, null, `${r.id}: ${plan.error}`);
    assert.ok(plan.stop || plan.laps.length, r.id);
  }
});

test('rutine skifter tilstand men beholder dine tal', () => {
  const s = cloneSettings(DEFAULTS);
  s.sequence.text = '1 2 3';
  applyRoutine(s, 'blind');
  assert.equal(s.blind, true);
  applyRoutine(s, 'lotto');
  assert.equal(s.mode, 'sequence');
  assert.equal(s.blind, false);
  assert.equal(s.sequence.text, '1 2 3');
});

test('egen rutine gemmes, overlever genindlæsning og kan vælges igen', () => {
  const s = cloneSettings(DEFAULTS);
  s.mode = 'code'; s.code.value = '8000'; s.blind = true;
  const item = snapshotRoutine(s, 'Aarhus');
  const s2 = mergeSettings(DEFAULTS, JSON.parse(JSON.stringify(s)));
  assert.equal(s2.custom.length, 1);
  applyRoutine(s2, 'hh');
  assert.equal(s2.mode, 'single');
  applyRoutine(s2, item.id);
  assert.equal(s2.mode, 'code');
  assert.equal(s2.code.value, '8000');
  assert.equal(s2.blind, true);
});
