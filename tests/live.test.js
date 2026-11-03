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

// ---------- Fake Google → Cryptext ----------
import { googleToForce, DUP_MS } from '../src/live.js';
// Testtabel i samme form som Noter+'s wordToDigits (den rigtige ligger i src/cryptext.js)
const fakeW2D = (w) => {
  const T = { m: '1', a: '4', d: '8', s: '95' };
  const unsupported = [];
  let digits = '';
  for (const c of [...String(w).toLowerCase()].reverse()) { if (T[c]) digits += T[c]; else unsupported.push(c); }
  return { digits, name: w, unsupported };
};

test('google: ord → force med by "google", kun nyere end googleAt', () => {
  const st = fresh();
  const g = googleToForce(st, { q: 'mads', at: 100, via: 'search' }, fakeW2D);
  assert.deepEqual(g.force, { digits: '95841', name: 'mads', by: 'google', at: 100 });
  assert.equal(st.link.googleAt, 100);
  assert.equal(googleToForce(st, { q: 'mads', at: 100 }, fakeW2D), null); // samme ord igen
  assert.equal(googleToForce(st, { q: 'kat', at: 50 }, fakeW2D), null); // ældre
  assert.ok(receiveForce(st, g.force, { unsupported: g.unsupported }));
  assert.equal(st.routine, LIVE_ROUTINE.id);
  assert.equal(st.mode, 'sequence');
  assert.equal(st.link.lastIn.shown, '09 · 58 · 41');
});

test('google: æøå springes over med advarsel, ord uden cifre giver ingen fejl', () => {
  const st = fresh();
  const g = googleToForce(st, { q: 'måde', at: 5 }, fakeW2D);
  assert.deepEqual(g.unsupported, ['e', 'å']);
  assert.equal(g.force.digits, '81');
  const none = googleToForce(st, { q: 'øø', at: 6 }, fakeW2D);
  assert.equal(none.force, null);
  assert.match(st.link.lastGoogle.error, /ingen Cryptext-cifre/);
});

test('google slået fra: tidsstempel huskes, ordet bruges ikke', () => {
  const st = fresh();
  st.link.google = false;
  assert.equal(googleToForce(st, { q: 'mads', at: 7 }, fakeW2D), null);
  assert.equal(st.link.googleAt, 7);
});

test('dublet: samme cifre + navn fra Noter inden for 10 s ignoreres', () => {
  const st = fresh();
  const g = googleToForce(st, { q: 'Mads', at: 1000 }, fakeW2D);
  assert.ok(receiveForce(st, g.force));
  // Noter+ sender det samme ord som force 2 s senere
  assert.equal(receiveForce(st, { digits: '95841', name: 'mads', by: 'noter', at: 3000 }), null);
  assert.equal(st.link.forceAt, 3000);
  // samme tal, andet navn → nyt mål
  assert.ok(receiveForce(st, { digits: '95841', name: 'sdam', by: 'noter', at: 4000 }));
  // samme igen efter mere end 10 s → nyt mål
  assert.ok(receiveForce(st, { digits: '95841', name: 'sdam', by: 'noter', at: 4000 + DUP_MS + 1 }));
});

// Den rigtige tabel (src/cryptext.js, uændret kopi fra Noter+)
import { wordToDigits } from '../src/cryptext.js';

test('cryptext: "mads" → 59841 → runder 05 · 98 · 41', () => {
  assert.equal(wordToDigits('mads').digits, '59841');
  const st = fresh();
  const g = googleToForce(st, { q: 'mads', at: 10 }, wordToDigits);
  assert.equal(g.force.digits, '59841');
  receiveForce(st, g.force, { unsupported: g.unsupported });
  assert.equal(st.link.lastIn.shown, '05 · 98 · 41');
});

test('cryptext: æøå giver advarsel og ingen fejl', () => {
  const st = fresh();
  const g = googleToForce(st, { q: 'rødgrød', at: 11 }, wordToDigits);
  assert.ok(g.unsupported.includes('ø'));
  assert.ok(g.force.digits.length > 0);
});
