import test from 'node:test';
import assert from 'node:assert/strict';
import { STACKS, parseCard, parseStack, stackCards, cardPosition } from '../src/stacks.js';
import { buildPlan } from '../src/targets.js';
import { DEFAULTS, cloneSettings, engineOptions } from '../src/settings.js';
import { Stopwatch, ForceEngine, patternToString } from '../src/engine.js';
import { formatCs } from '../src/format.js';

test('stakkene har 52 forskellige gyldige kort', () => {
  for (const [k, st] of Object.entries(STACKS)) {
    assert.equal(st.cards.length, 52, k);
    assert.equal(new Set(st.cards).size, 52, k);
    for (const c of st.cards) assert.equal(parseCard(c), c, `${k}: ${c}`);
  }
  assert.equal(STACKS.mnemonica.cards[0], '4C');
  assert.equal(STACKS.mnemonica.cards[51], '9D');
});

test('kort kan skrives på mange måder', () => {
  assert.equal(parseCard('7h'), '7H');
  assert.equal(parseCard('Q♠'), 'QS');
  assert.equal(parseCard('E♥'), 'AH');
  assert.equal(parseCard('D♦'), 'QD'); // dansk dame
  assert.equal(parseCard('kn♣'), 'JC');
  assert.equal(parseCard('11h'), null);
  assert.equal(parseStack(STACKS.aronson.cards.join(' ')).length, 52);
  assert.equal(parseStack('AS AS'), null);
});

test('plads i stakken med offset og fra bunden', () => {
  const m = stackCards('mnemonica');
  assert.equal(cardPosition('4C', m), 1);
  assert.equal(cardPosition('AS', m), 7);
  assert.equal(cardPosition('AS', m, 2), 9);
  assert.equal(cardPosition('9D', m, 0, true), 1);
});

test('ACAAN: stoppet viser kortets plads', () => {
  const s = cloneSettings(DEFAULTS);
  s.mode = 'card';
  s.card = { stack: 'mnemonica', custom: '', card: 'KD', offset: 0, fromBottom: false, placement: 'hh', timerInput: true };
  const plan = buildPlan(s);
  assert.equal(plan.cardPos, 26);
  assert.equal(patternToString(plan.stop), '????26');
  let t = 1000;
  const e = new ForceEngine({ getPlan: () => buildPlan(s), getOptions: () => engineOptions(s) });
  const sw = new Stopwatch({ engine: e, now: () => t });
  sw.start(t); t += 7810; sw.stop(t);
  assert.equal(formatCs(sw.totalCs(t)), '00.07,26');
});

test('aktivering: force først efter X sekunder', () => {
  const s = cloneSettings(DEFAULTS);
  s.single = { value: '37', placement: 'hh' };
  s.armAfter = 3;
  let t = 1000;
  const e = new ForceEngine({ getPlan: () => buildPlan(s), getOptions: () => engineOptions(s) });
  const sw = new Stopwatch({ engine: e, now: () => t });
  sw.start(t); t += 2120; sw.stop(t);
  assert.equal(formatCs(sw.totalCs(t)), '00.02,12'); // for tidligt: ærligt
  sw.start(t); t += 2000; sw.stop(t);
  assert.equal(formatCs(sw.totalCs(t)), '00.04,37'); // nu aktiv
  // talrække: runder før tiden bruger ikke tallene
  s.mode = 'sequence'; s.sequence = { text: '11 22', per: 2, stopTakes: true };
  const e2 = new ForceEngine({ getPlan: () => buildPlan(s), getOptions: () => engineOptions(s) });
  const sw2 = new Stopwatch({ engine: e2, now: () => t });
  sw2.start(t); t += 1000; sw2.lap(t); t += 3000; sw2.lap(t); t += 1500; sw2.stop(t);
  assert.equal(sw2.laps[1] % 100, 11);
  assert.equal(sw2.currentLapCs(t) % 100, 22);
});
