import test from 'node:test';
import assert from 'node:assert/strict';
import {
  Stopwatch, ForceEngine, pattern, matches, candidatesIn, visCost, VISIBLE, RESYNC,
} from '../src/engine.js';
import { buildPlan } from '../src/targets.js';
import { DEFAULTS, cloneSettings, engineOptions } from '../src/settings.js';
import { formatCs } from '../src/format.js';

function rig(over = {}) {
  const s = Object.assign(cloneSettings(DEFAULTS), over);
  let t = 10000;
  const engine = new ForceEngine({ getPlan: () => buildPlan(s, new Date(2026, 9, 13)), getOptions: () => engineOptions(s) });
  const sw = new Stopwatch({ engine, now: () => t });
  return {
    s, sw, engine,
    start() { sw.start(t); },
    wait(ms) { t += ms; },
    stop(analog = false) { return sw.stop(t, { analog }); },
    lap(analog = false) { return sw.lap(t, { analog }); },
    show() { return formatCs(sw.totalCs(t + 1000)); },
    lapRow(after = 1000) { return formatCs(sw.currentLapCs(t + after)); },
    get t() { return t; },
  };
}
const single = (value, placement = 'auto', extra = {}) => ({ mode: 'single', single: { value, placement }, ...extra });

test('mønstre og kandidater', () => {
  const p = pattern('??1437');
  assert.ok(matches(1437, p));
  assert.ok(matches(6000 + 1437, p));
  assert.ok(!matches(1438, p));
  assert.deepEqual(candidatesIn(pattern('????37'), 500, 800), [537, 637, 737]);
  assert.deepEqual(candidatesIn(pattern('??1437'), 0, 13000), [1437, 7437]);
  assert.deepEqual(candidatesIn(pattern('240387'), 0, 400000), [144387]);
  assert.equal(candidatesIn(pattern('?????7'), 0, 100).length, 10);
});

test('synlighed: kun hele sekunder kan aflæses', () => {
  assert.equal(Math.floor(visCost(512, 537)), 0); // samme sekund
  assert.equal(Math.floor(visCost(595, 510)), 0); // samme sekund, baglæns
  assert.equal(Math.floor(visCost(580, 637)), 1); // sekundet skulle alligevel lige skifte
  assert.ok(visCost(550, 637) >= VISIBLE); // 0,5 s før skiftet: synligt
  assert.ok(visCost(505, 437) < VISIBLE); // sekundet skiftede netop
  assert.ok(visCost(900, 1437) >= VISIBLE);
  assert.ok(visCost(900, 1437, { blind: true }) < 1);
});

test('hundrededele: lander i samme sekund som tilskueren så', () => {
  const r = rig(single('37'));
  r.start(); r.wait(5120); r.stop();
  assert.equal(r.show(), '00.05,37');
  const r2 = rig(single('10'));
  r2.start(); r2.wait(5950); r2.stop();
  assert.equal(r2.show(), '00.05,10');
});

test('SS,HH: ram når tilskueren stopper tæt på, ellers kun hundrededele', () => {
  for (const [ms, want, result] of [
    [14050, '00.14,37', 'hit'],
    [14990, '00.14,37', 'hit'],
    [13800, '00.14,37', 'hit'], // 0,2 s før sekundet skiftede
    [13500, '00.13,37', 'partial'],
    [9000, '00.09,37', 'partial'],
  ]) {
    const r = rig(single('1437'));
    r.start(); r.wait(ms);
    const d = r.stop();
    assert.equal(r.show(), want, `stop ved ${ms} ms`);
    assert.equal(d.result, result);
  }
});

test('ved miss = ærligt vises det ægte tal', () => {
  const r = rig(single('1437', 'auto', { miss: 'none' }));
  r.start(); r.wait(9000);
  assert.equal(r.stop().result, 'natural');
  assert.equal(r.show(), '00.09,00');
});

test('blind: hele målet vises uanset hvornår der stoppes', () => {
  for (const ms of [300, 3000, 25000, 61000]) {
    const r = rig(single('1437', 'auto', { blind: true }));
    r.start(); r.wait(ms); r.stop();
    assert.match(r.show(), /\.14,37$/);
  }
  const r = rig(single('240387', 'auto', { blind: true }));
  r.start(); r.wait(5000); r.stop();
  assert.equal(r.show(), '24.03,87');
});

test('meget tidligt og meget sent stop', () => {
  const a = rig(single('37'));
  a.start(); a.wait(300); a.stop();
  assert.equal(a.show(), '00.00,37');
  const b = rig(single('37'));
  b.start(); b.wait(12 * 60000 + 4210); b.stop();
  assert.equal(b.show(), '12.04,37');
  const c = rig(single('37'));
  c.start(); c.wait(3600000 + 65 * 1000 + 990); c.stop();
  assert.equal(c.show(), '1.01.05,37');
});

test('flere stop/start i træk: hvert stop rammer hundrededelene', () => {
  const r = rig(single('37'));
  r.start();
  let last = 0;
  for (let i = 0; i < 6; i++) {
    r.wait(700 + i * 1337);
    r.stop();
    assert.match(r.show(), /,37$/);
    const v = r.sw.totalCs(r.t);
    assert.ok(v >= last);
    last = v;
    r.wait(500);
    r.start();
  }
});

test('talrække på runder: hver omgang viser næste tal, Stop tager det sidste', () => {
  const r = rig({ mode: 'sequence', sequence: { text: '5 12 17 23', per: 2, stopTakes: true } });
  r.start();
  const rows = [];
  for (const ms of [3210, 250, 9876, 4400]) {
    r.wait(ms);
    if (rows.length < 3) { r.lap(); rows.push(formatCs(r.sw.laps.at(-1))); }
  }
  r.stop();
  rows.push(formatCs(r.sw.currentLapCs(r.t + 1000)));
  assert.deepEqual(rows.map((x) => x.slice(-2)), ['05', '12', '17', '23']);
  assert.equal(r.sw.sumLaps() + r.sw.currentLapCs(r.t + 1000), r.sw.totalCs(r.t + 1000));
});

test('omgang: kortere omgang → resten med i næste, længere → totalen springer lidt frem', () => {
  const a = rig({ mode: 'sequence', sequence: { text: '05', per: 2, stopTakes: false } });
  a.start(); a.wait(3210);
  const da = a.lap();
  assert.equal(da.lap, 305); assert.equal(da.jump, 0);
  assert.equal(a.lapRow(), '00.01,16'); // 0,16 s rest + 1 s
  const b = rig({ mode: 'sequence', sequence: { text: '36', per: 2, stopTakes: false } });
  b.start(); b.wait(3210);
  const db = b.lap();
  assert.equal(db.lap, 336); assert.equal(db.jump, 15);
  assert.equal(b.lapRow(0), '00.00,00'); // ny omgang starter præcis i 0
  assert.equal(b.lapRow(), '00.00,98'); // 0,15 s forskydning glider tilbage med 2 %
});

test('PIN med ét ciffer pr. omgang', () => {
  const r = rig({ mode: 'sequence', sequence: { text: '2580', per: 1, stopTakes: true } });
  r.start();
  for (let i = 0; i < 3; i++) { r.wait(1000 + i * 777); r.lap(); }
  r.wait(2222); r.stop();
  const digits = [...r.sw.laps, r.sw.currentLapCs(r.t + 1000)].map((v) => v % 10);
  assert.deepEqual(digits, [2, 5, 8, 0]);
});

test('nulstil midt i: talrækken starter forfra (eller fortsætter)', () => {
  const r = rig({ mode: 'sequence', sequence: { text: '11 22 33', per: 2, stopTakes: true } });
  r.start(); r.wait(2000); r.lap(); r.wait(1000); r.stop(); r.sw.reset();
  r.start(); r.wait(4321); r.lap();
  assert.equal(r.sw.laps[0] % 100, 11);
  const c = rig({ mode: 'sequence', onReset: 'continue', sequence: { text: '11 22 33', per: 2, stopTakes: true } });
  c.start(); c.wait(2000); c.lap(); c.wait(1000); c.stop(); c.sw.reset();
  c.start(); c.wait(4321); c.lap();
  assert.equal(c.sw.laps[0] % 100, 22);
});

test('force slået fra (panik): helt almindeligt, korrekt stopur', () => {
  const r = rig({ ...single('37'), active: false });
  r.start(); r.wait(5123); r.lap(); r.wait(1111); r.stop();
  assert.equal(r.show(), '00.06,23');
  assert.deepEqual(r.sw.laps, [512]);
  // panik midt i: uret fortsætter uden spring, nye tryk er ærlige
  const p = rig(single('37'));
  p.start(); p.wait(4000); p.stop(); p.start();
  const before = p.sw.displayMs(p.t);
  p.s.active = false;
  assert.equal(p.sw.displayMs(p.t), before);
  p.wait(1000); const x = p.sw.totalCs(p.t); p.stop();
  assert.equal(p.sw.totalCs(p.t), x);
});

test('forskydningen glider tilbage mod ægte tid (max 2 %) og tallet går aldrig baglæns', () => {
  const r = rig(single('99'));
  r.start(); r.wait(5010); r.stop(); // 5,01 → 5,99 (+0,98 s)
  r.start();
  let prev = r.sw.displayMs(r.t);
  for (let i = 0; i < 4000; i++) {
    r.wait(16.7);
    const d = r.sw.displayMs(r.t);
    assert.ok(d >= prev);
    prev = d;
  }
  const real = r.sw.real + (r.t - r.sw.runAt);
  assert.ok(Math.abs(r.sw.displayMs(r.t) - real) < 1, 'efter ~67 s følger uret ægte tid igen');
  assert.equal(RESYNC, 0.02);
});

test('analog: viseren glider kort på plads ved stop', () => {
  const r = rig(single('90'));
  r.start(); r.wait(5100);
  r.stop(true);
  assert.ok(r.sw.landing && r.sw.landing.dur > 0 && r.sw.landing.dur <= 150);
  assert.ok(r.sw.isAnimating(r.t + 10));
  assert.equal(formatCs(r.sw.totalCs(r.t + 200)), '00.05,90');
  assert.ok(!r.sw.isAnimating(r.t + 200));
});

test('gem og gendan: uret kører videre efter genstart af appen', () => {
  const r = rig({ mode: 'sequence', sequence: { text: '11 22 33', per: 2, stopTakes: true } });
  r.start(); r.wait(3000); r.lap();
  const saved = r.sw.serialize(r.t, 1_000_000);
  const r2 = rig({ mode: 'sequence', sequence: { text: '11 22 33', per: 2, stopTakes: true } });
  r2.sw.restore(saved, r2.t, 1_000_000 + 60_000); // 60 s senere
  assert.equal(r2.sw.state, 'running');
  assert.equal(r2.engine.lapIndex, 1);
  const off = Math.round(saved.off / 10); // omgangen sprang 0,11 s frem
  assert.ok(Math.abs(r2.sw.totalCs(r2.t) - (6300 + off)) <= 1);
  r2.wait(1234); r2.lap();
  assert.equal(r2.sw.laps[1] % 100, 22);
});

test('hurtige Start/Stop i træk: tallet går aldrig tilbage eller står stille', () => {
  const r = rig(single('37'));
  r.start();
  let last = 0;
  for (const ms of [5120, 150, 90, 400, 60, 1300, 30]) {
    r.wait(ms);
    r.stop();
    const v = r.sw.totalCs(r.t + 1000);
    assert.ok(v > last, `${formatCs(v)} skal være større end ${formatCs(last)}`);
    last = v;
    r.wait(80);
    r.start();
  }
});

test('efter ramt stop: ærlig resten af forsøget (valgfrit)', () => {
  const r = rig({ ...single('37'), afterHit: 'honest' });
  r.start(); r.wait(5120); r.stop();
  assert.equal(r.show(), '00.05,37');
  r.start(); r.wait(2110); r.stop();
  assert.equal(r.engine.log[0].result, 'natural'); // ærligt stop
  assert.notEqual(r.show().slice(-2), '37');
  r.sw.reset(); r.start(); r.wait(3210); r.stop();
  assert.equal(r.show(), '00.03,37'); // nyt forsøg rammer igen
});
