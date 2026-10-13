import test from 'node:test';
import assert from 'node:assert/strict';
import {
  BUILTIN, ensureRoutines, selectRoutine, storeActive, newRoutine, renameRoutine, deleteRoutine,
  duplicateRoutine, moveRoutine, restoreBuiltins, findRoutine,
} from '../src/routines.js';
import { DEFAULTS, cloneSettings, mergeSettings } from '../src/settings.js';
import { buildPlan } from '../src/targets.js';

const fresh = () => ensureRoutines(cloneSettings(DEFAULTS));

test('alle standardrutiner giver en gyldig plan', () => {
  const s = fresh();
  assert.equal(s.routines.length, BUILTIN.length);
  for (const r of BUILTIN) {
    assert.ok(selectRoutine(s, r.id), r.id);
    const plan = buildPlan(s, new Date(2026, 9, 13, 14, 5));
    assert.equal(plan.error, null, `${r.id}: ${plan.error}`);
    assert.ok(plan.stop || plan.laps.length, r.id);
  }
});

test('hver rutine har sine EGNE tal', () => {
  const s = fresh();
  selectRoutine(s, 'hh');
  s.single.value = '11'; storeActive(s);
  selectRoutine(s, 'aim');
  assert.equal(s.single.value, '1037'); // ikke 11
  s.single.value = '2222'; storeActive(s);
  selectRoutine(s, 'blind');
  assert.equal(s.single.value, '1437');
  assert.equal(s.blind, true);
  selectRoutine(s, 'hh');
  assert.equal(s.single.value, '11');
  assert.equal(s.blind, false);
  selectRoutine(s, 'aim');
  assert.equal(s.single.value, '2222');
});

test('ny, omdøb, kopi, flyt, slet og gendan', () => {
  const s = fresh();
  s.mode = 'code'; s.code.value = '8000';
  const r = newRoutine(s, 'Aarhus');
  assert.equal(s.routine, r.id);
  renameRoutine(s, r.id, 'Aarhus C');
  assert.equal(findRoutine(s, r.id).name, 'Aarhus C');
  const k = duplicateRoutine(s, r.id);
  assert.equal(findRoutine(s, k.id).snapshot.code.value, '8000');
  const i = s.routines.findIndex((x) => x.id === r.id);
  moveRoutine(s, r.id, -1);
  assert.equal(s.routines.findIndex((x) => x.id === r.id), i - 1);
  deleteRoutine(s, r.id);
  assert.equal(s.routine, '');
  deleteRoutine(s, 'lotto');
  assert.equal(findRoutine(s, 'lotto'), null);
  assert.equal(restoreBuiltins(s), 1);
  assert.ok(findRoutine(s, 'lotto'));
});

test('rutiner overlever genindlæsning, og gamle egne rutiner flyttes over', () => {
  const s = fresh();
  newRoutine(s, 'Min');
  const back = ensureRoutines(mergeSettings(DEFAULTS, JSON.parse(JSON.stringify(s))));
  assert.ok(back.routines.some((r) => r.name === 'Min'));
  const old = mergeSettings(DEFAULTS, { custom: [{ id: 'c1', name: 'Gammel', snapshot: { mode: 'code', code: { value: '5000' } } }] });
  ensureRoutines(old);
  const g = old.routines.find((r) => r.name === 'Gammel');
  assert.equal(g.snapshot.code.value, '5000');
  assert.equal(g.snapshot.single.value, DEFAULTS.single.value);
});
