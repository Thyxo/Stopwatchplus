import test from 'node:test';
import assert from 'node:assert/strict';
import { runSelfTest, formatReport } from '../src/selftest.js';

test('randomiseret: 21.000 tilskuere med tilfældige stop-tidspunkter og mål', () => {
  const res = runSelfTest({ runs: 21000, seed: 2026 });
  const report = formatReport(res);
  assert.match(report, /RESULTAT: OK/, report);
  const { per } = res;
  for (const name of ['hhRandom', 'sshhAim', 'sshhRandom', 'blindFull', 'sequence', 'dateLaps']) {
    assert.equal(per[name].visibleTotal, 0, `${name}: synlige spring`);
  }
  assert.ok(per.hhRandom.plannedHit / per.hhRandom.planned > 0.98);
  assert.ok(per.sshhAim.firstHit / per.sshhAim.firstStops > 0.95);
  assert.equal(per.blindFull.plannedHit, per.blindFull.planned);
  assert.equal(per.sequence.plannedHit, per.sequence.planned);
  assert.equal(per.dateLaps.plannedHit, per.dateLaps.planned);
  assert.equal(per.honest.honestWrong, 0);
});
