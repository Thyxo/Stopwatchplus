import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isValidTime, shapeFor, receiveForce, forceToSend, targetDigits, resultFor, LIVE_ROUTINE } from '../src/live.js';
import { DEFAULTS } from '../src/settings.js';
import { ensureRoutines, findRoutine } from '../src/routines.js';
import { buildPlan } from '../src/targets.js';

const fresh = () => ensureRoutines(JSON.parse(JSON.stringify(DEFAULTS)));

test('gyldig tid: SS og MM højst 59', () => {
  assert.equal(isValidTime('37'), true);
  assert.equal(isValidTime('1437'), true);
  assert.equal(isValidTime('5937'), true);
  assert.equal(isValidTime('6037'), false);
  assert.equal(isValidTime('59841'), false); // 05.98,41
  assert.equal(isValidTime('51437'), true); // 05.14,37
  assert.equal(isValidTime('1234567'), false);
});

test('form: 1-2 cifre = Tid (,HH)', () => {
  const s = shapeFor('7');
  assert.equal(s.mode, 'single');
  assert.equal(s.label, 'Tid (,HH)');
  assert.equal(shapeFor('42').mode, 'single');
});

test('form auto: længere tal = Række med 2 cifre pr. runde', () => {
  const s = shapeFor('59841');
  assert.equal(s.mode, 'sequence');
  assert.equal(s.text, '05 98 41');
  assert.match(s.note, /første runde viser 05/);
  assert.match(s.note, /Ikke en gyldig tid/);
  assert.equal(shapeFor('1437').mode, 'sequence');
  assert.equal(shapeFor('1437').text, '14 37');
});

test('form: gyldig tid bliver Tid med "Tid når muligt" eller Blind', () => {
  assert.equal(shapeFor('1437', { shape: 'time' }).mode, 'single');
  assert.equal(shapeFor('1437', { blind: true }).mode, 'single');
  assert.equal(shapeFor('51437', { shape: 'time' }).label, 'Tid (MM.SS,HH)');
  assert.equal(shapeFor('59841', { shape: 'time' }).mode, 'sequence'); // ugyldig → række
});

test('form: advarsel ved for langt tal', () => {
  const s = shapeFor('1234567890');
  assert.equal(s.mode, 'sequence');
  assert.match(s.warn, /4 × Runde/);
  assert.equal(shapeFor('123456').warn, '');
});

test('modtag force: sætter mål i live-rutinen og slår force til', () => {
  const st = fresh();
  st.active = false;
  st.single.value = '99'; // din egen rutine
  const r = receiveForce(st, { digits: '59841', name: 'mAds', by: 'notes', at: 1000 });
  assert.ok(r);
  assert.equal(st.routine, LIVE_ROUTINE.id);
  assert.equal(st.mode, 'sequence');
  assert.equal(st.active, true);
  assert.equal(st.link.forceAt, 1000);
  assert.deepEqual(buildPlan(st).laps.map((p) => `${p[4]}${p[5]}`), ['05', '98', '41']);
  assert.equal(findRoutine(st, 'blank').snapshot.single.value, '99'); // andre rutiner urørt
});

test('modtag force: ældre/samme at og eget "by" ignoreres', () => {
  const st = fresh();
  assert.ok(receiveForce(st, { digits: '37', by: 'calc', at: 2000 }));
  assert.equal(receiveForce(st, { digits: '12', by: 'notes', at: 2000 }), null);
  assert.equal(receiveForce(st, { digits: '12', by: 'notes', at: 1500 }), null);
  assert.equal(receiveForce(st, { digits: '12', by: 'stopwatch', at: 9000 }), null);
  assert.equal(st.single.value, '37');
  assert.ok(receiveForce(st, { digits: '12', by: 'notes', at: 2001 }));
  assert.equal(st.single.value, '12');
});

test('modtag slået fra: tidsstempel huskes, målet bruges ikke', () => {
  const st = fresh();
  st.link.receive = false;
  assert.equal(receiveForce(st, { digits: '37', by: 'notes', at: 5 }), null);
  assert.equal(st.link.forceAt, 5);
  assert.notEqual(st.routine, LIVE_ROUTINE.id);
});

test('send: kun ved nyt mål, aldrig det samme to gange, ikke det modtagne tilbage', () => {
  const st = fresh();
  st.link.room = 'test';
  st.mode = 'single';
  st.single.value = '1437';
  st.single.placement = 'auto';
  assert.equal(targetDigits(st), '1437');
  const f = forceToSend(st, 111);
  assert.deepEqual(f, { digits: '1437', name: null, by: 'stopwatch', at: 111 });
  assert.equal(forceToSend(st, 222), null); // uændret
  st.single.value = '1438';
  assert.equal(forceToSend(st, 333).digits, '1438');
  receiveForce(st, { digits: '59841', by: 'notes', at: 444 });
  assert.equal(forceToSend(st, 555), null); // det modtagne sendes ikke retur
  st.link.send = false;
  st.sequence.text = '11 22';
  assert.equal(forceToSend(st, 666), null);
});

test('send: ingen kode = ingenting', () => {
  const st = fresh();
  st.single.value = '37';
  assert.equal(forceToSend(st), null);
});

test('result fra et stop', () => {
  assert.deepEqual(resultFor({ result: 'hit' }, '00.14,37', 7), { value: '00.14,37', digits: '001437', forced: true, by: 'stopwatch', at: 7 });
  assert.equal(resultFor({ result: 'natural' }, '00.03,11').forced, false);
});

import { letterCount } from '../src/live.js';
test('letterCount tæller kun bogstaver', () => {
  assert.equal(letterCount('Søren Åge'), 8);
  assert.equal(letterCount('Anna-Marie 2'), 9);
  assert.equal(letterCount(null), 0);
});
