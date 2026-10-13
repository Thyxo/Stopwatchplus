// Randomiseret selvtest af force-motoren. Kører i Node (npm run selftest) og i appen
// (hemmeligt panel → Kør selvtest). Simulerer tusindvis af tilskuere, der starter,
// stopper, tager omgange og nulstiller på tilfældige tidspunkter.

import { Stopwatch, ForceEngine, matches, VISIBLE } from './engine.js';
import { buildPlan, dateDigits } from './targets.js';
import { DEFAULTS, engineOptions, cloneSettings } from './settings.js';
import { formatCs } from './format.js';

function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const FRAME = 1000 / 60;

function makeRig(settings, now) {
  let t = 1000 + now() * 5000;
  const s = settings;
  const engine = new ForceEngine({ getPlan: () => buildPlan(s, new Date(2026, 9, 13)), getOptions: () => engineOptions(s) });
  const sw = new Stopwatch({ engine, now: () => t });
  return { sw, engine, s, at: (v) => { t = v; }, get t() { return t; } };
}

// Kontrol der ikke stoler på motorens egen vurdering: har et aflæseligt ciffer ændret sig?
function visibleStopJump(x, f) {
  const sx = Math.floor(x / 100);
  const sf = Math.floor(f / 100);
  if (sx === sf) return false;
  if (f > x && 100 - (x % 100) <= 25 && sf === sx + 1) return false;
  if (f < x && x % 100 < 12 && sf === sx - 1) return false;
  return true;
}

function newStats() {
  return {
    runs: 0, events: 0, hit: 0, partial: 0, natural: 0, planned: 0, plannedHit: 0, firstStops: 0, firstHit: 0,
    visibleTotal: 0, totalJump1s: 0, lapRowSecond: 0, nonMonotonic: 0, negativeLap: 0,
    sumMismatch: 0, wrongShown: 0, honestWrong: 0, maxHandDeg: 0, lies: 0,
  };
}

// Kører uret i små skridt og tjekker at tallet aldrig går baglæns, mens det kører
function advance(rig, st, dtMs, rand) {
  const { sw } = rig;
  const steps = Math.min(8, Math.max(1, Math.floor(dtMs / 2000)));
  let prev = sw.state === 'running' ? sw.displayMs(rig.t) : null;
  const end = rig.t + dtMs;
  for (let i = 1; i <= steps; i++) {
    const tt = i === steps ? end : rig.t + rand() * (end - rig.t);
    rig.at(tt);
    if (sw.state === 'running') {
      const d = sw.displayMs(tt);
      if (prev !== null && d < prev - 1e-6) st.nonMonotonic++;
      prev = d;
      if (sw.currentLapCs(tt) < 0) st.negativeLap++;
    }
  }
  // og frame for frame i et kort vindue før næste tryk
  if (sw.state === 'running') {
    let p = sw.displayMs(rig.t);
    for (let k = 0; k < 6; k++) {
      rig.at(rig.t + FRAME);
      const d = sw.displayMs(rig.t);
      if (d < p - 1e-6) st.nonMonotonic++;
      p = d;
    }
  }
}

function checkStop(rig, st, dec, x, analog, expectPattern) {
  const f = dec.total;
  st.events++;
  st[dec.result]++;
  if (!rig.s.blind && visibleStopJump(x, f) && rig.s.jumpTol === 0) st.visibleTotal++;
  if (analog && !rig.s.blind) st.maxHandDeg = Math.max(st.maxHandDeg, Math.abs(f - x) / 100 * 6);
  if (dec.result === 'hit' && expectPattern && !matches(expectPattern.value(rig), expectPattern.pattern)) st.wrongShown++;
  const total = rig.sw.totalCs(rig.t + 1000);
  if (total !== f) st.wrongShown++;
  if (rig.sw.sumLaps() + rig.sw.currentLapCs(rig.t + 1000) !== total) st.sumMismatch++;
}

// ---------- scenarier ----------
const SCENARIOS = {
  // Ét mål på hundrededelene, tilskueren stopper når som helst (0,05 s – 15 min)
  hhRandom(rand) {
    const s = cloneSettings(DEFAULTS);
    s.mode = 'single';
    s.single = { value: String(Math.floor(rand() * 100)).padStart(2, '0'), placement: 'hh' };
    return { s, flow: 'single', stopAt: () => Math.exp(Math.log(50) + rand() * Math.log(900000 / 50)) };
  },
  // Sekunder+hundrededele (fx 14,37) – tilskueren prøver at stoppe på sekundet og ser på uret
  sshhAim(rand) {
    const s = cloneSettings(DEFAULTS);
    const sec = 3 + Math.floor(rand() * 40);
    const hh = Math.floor(rand() * 100);
    s.mode = 'single';
    s.single = { value: String(sec).padStart(2, '0') + String(hh).padStart(2, '0'), placement: 'sshh' };
    // reaktionstid: stopper typisk 0-0,4 s efter de ser sekundet skifte, nogle lidt før
    return { s, flow: 'single', stopAt: () => (sec + gauss(rand) * 0.25 + 0.15) * 1000, aim: true };
  },
  // Sekunder+hundrededele, men tilskueren stopper helt tilfældigt (0-60 s) og ser på uret
  sshhRandom(rand) {
    const s = cloneSettings(DEFAULTS);
    s.mode = 'single';
    s.single = { value: String(Math.floor(rand() * 60)).padStart(2, '0') + String(Math.floor(rand() * 100)).padStart(2, '0'), placement: 'sshh' };
    return { s, flow: 'single', stopAt: () => rand() * 60000 };
  },
  // Blind: tilskueren kigger ikke ved stop → hele målet (MM.SS,HH) skal altid vises
  blindFull(rand) {
    const s = cloneSettings(DEFAULTS);
    s.mode = rand() < 0.5 ? 'code' : 'single';
    s.blind = true;
    if (s.mode === 'code') s.code = { value: String(1000 + Math.floor(rand() * 4900)), placement: 'sshh', stopTakes: true };
    else s.single = { value: String(Math.floor(rand() * 6)) + String(Math.floor(rand() * 10)) + String(Math.floor(rand() * 6)) + String(Math.floor(rand() * 10)) + String(Math.floor(rand() * 100)).padStart(2, '0'), placement: 'mmsshh' };
    return { s, flow: 'single', stopAt: () => 300 + rand() * 120000 };
  },
  // Talrække på omgangene: Lotto (7 af 1-36), telefonnummer (4×2), PIN (4×1)
  sequence(rand) {
    const s = cloneSettings(DEFAULTS);
    s.mode = 'sequence';
    const kind = Math.floor(rand() * 3);
    if (kind === 0) {
      const set = new Set();
      while (set.size < 7) set.add(1 + Math.floor(rand() * 36));
      s.sequence = { text: [...set].join(' '), per: 2, stopTakes: true };
    } else if (kind === 1) {
      s.sequence = { text: String(20000000 + Math.floor(rand() * 79999999)), per: 2, stopTakes: true };
    } else {
      s.sequence = { text: String(Math.floor(rand() * 10000)).padStart(4, '0'), per: 1, stopTakes: true };
    }
    return { s, flow: 'laps' };
  },
  // Dato (i morgen) fordelt på 3 omgange
  dateLaps() {
    const s = cloneSettings(DEFAULTS);
    s.mode = 'date';
    s.date = { which: 'tomorrow', custom: '', placement: 'laps', stopTakes: true };
    return { s, flow: 'laps' };
  },
  // Ærlig tilstand (force slået fra) – skal være et helt almindeligt, korrekt stopur
  honest(rand) {
    const s = cloneSettings(DEFAULTS);
    s.active = false;
    s.mode = rand() < 0.5 ? 'single' : 'sequence';
    return { s, flow: rand() < 0.5 ? 'single' : 'laps', honest: true, stopAt: () => rand() * 600000 };
  },
};

function gauss(rand) {
  let u = 0;
  let v = 0;
  while (u === 0) u = rand();
  while (v === 0) v = rand();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

function runSingle(rig, st, sc, rand, analog) {
  const { sw, s } = rig;
  const plan = buildPlan(s, new Date(2026, 9, 13));
  const exp = plan.stop ? { pattern: plan.stop, value: () => sw.totalCs(rig.t + 1000) } : null;
  const cycles = 1 + (rand() < 0.35 ? Math.floor(rand() * 3) : 0); // flere stop/start i træk
  let realMs = 0;
  sw.start(rig.t);
  for (let c = 0; c < cycles; c++) {
    let dur = c === 0 ? sc.stopAt() : 200 + rand() * 8000;
    if (sc.aim && c === 0) dur = Math.max(50, dur);
    // af og til en omgang undervejs
    if (rand() < 0.25) {
      const tl = dur * rand();
      advance(rig, st, tl, rand);
      sw.lap(rig.t, { analog });
      dur -= tl;
    }
    advance(rig, st, Math.max(1, dur), rand);
    realMs = sw.real + (rig.t - sw.runAt);
    const x = sw.totalCs(rig.t);
    const dec = sw.stop(rig.t, { analog });
    checkStop(rig, st, dec, x, analog, exp);
    if (!sc.honest) {
      st.planned++;
      if (dec.result === 'hit') st.plannedHit++;
      if (c === 0) { st.firstStops++; if (dec.result === 'hit') st.firstHit++; }
    }
    if (sc.honest && Math.abs(sw.totalCs(rig.t + 1000) - Math.floor(realMs / 10)) > 1) st.honestWrong++;
    if (rand() < 0.15) { sw.reset(); sw.start(rig.t); continue; } // nulstilling midt i
    if (c < cycles - 1) { advance(rig, st, 300 + rand() * 3000, rand); sw.start(rig.t); }
  }
}

function runLaps(rig, st, sc, rand, analog) {
  const { sw, s } = rig;
  const plan = buildPlan(s, new Date(2026, 9, 13));
  const n = plan.laps.length;
  sw.start(rig.t);
  const lapsToPress = rand() < 0.7 ? Math.max(0, n - 1) : Math.floor(rand() * (n + 2));
  for (let i = 0; i < lapsToPress; i++) {
    // tilskuere trykker både hurtigt efter hinanden og med lange pauser
    const dt = rand() < 0.3 ? 80 + rand() * 400 : 300 + rand() * 20000;
    advance(rig, st, dt, rand);
    const before = sw.totalCs(rig.t);
    const ccs = sw.currentLapCs(rig.t);
    const dec = sw.lap(rig.t, { analog });
    st.events++;
    st[dec.result]++;
    if (!sc.honest && i < n) { st.planned++; if (dec.result === 'hit') st.plannedHit++; }
    if (dec.jump >= 100) st.totalJump1s++;
    if (Math.floor(dec.lap / 100) !== Math.floor(ccs / 100)) st.lapRowSecond++;
    if (!sc.honest && i < n && dec.result === 'hit' && !matches(dec.lap, plan.laps[i])) st.wrongShown++;
    if (sc.honest && (dec.lap !== ccs || dec.jump !== 0)) st.honestWrong++;
    const after = sw.totalCs(rig.t);
    if (after < before) st.nonMonotonic++;
    if (sw.currentLapCs(rig.t) < 0) st.negativeLap++;
  }
  advance(rig, st, 100 + rand() * 15000, rand);
  const x = sw.totalCs(rig.t);
  const idx = rig.engine.lapIndex;
  const exp = !sc.honest && plan.stopTakesNextLap && idx < n
    ? { pattern: plan.laps[idx], value: () => sw.currentLapCs(rig.t + 1000) } : null;
  const dec = sw.stop(rig.t, { analog });
  checkStop(rig, st, dec, x, analog, exp);
  if (exp) { st.planned++; if (dec.result === 'hit') st.plannedHit++; }
  if (sc.honest && dec.total !== x) st.honestWrong++;
}

export function runSelfTest({ runs = 4000, seed = 2026 } = {}) {
  const rand = rng(seed);
  const names = Object.keys(SCENARIOS);
  const per = {};
  for (const n of names) per[n] = newStats();
  for (let r = 0; r < runs; r++) {
    const name = names[r % names.length];
    const sc = SCENARIOS[name](rand);
    const rig = makeRig(sc.s, rand);
    const st = per[name];
    st.runs++;
    const analog = rand() < 0.35;
    if (sc.flow === 'single') runSingle(rig, st, sc, rand, analog);
    else runLaps(rig, st, sc, rand, analog);
  }
  return { runs, seed, per, tomorrow: dateDigits('tomorrow', '', new Date(2026, 9, 13)) };
}

const LABELS = {
  hhRandom: 'Hundrededele, stop når som helst (0,05 s-15 min)',
  sshhAim: 'SS,HH - tilskueren sigter efter sekundet',
  sshhRandom: 'SS,HH - helt tilfældigt stop (0-60 s)',
  blindFull: 'Blind: hele målet (SS,HH / MM.SS,HH)',
  sequence: 'Talrække på runder (Lotto, tlf., PIN)',
  dateLaps: 'I morgens dato på 3 runder',
  honest: 'Ærlig tilstand (force slået fra)',
};

const pct = (a, b) => (b ? (100 * a / b).toFixed(1).replace('.', ',') + ' %' : '-');

export function formatReport(res) {
  const lines = [`Selvtest: ${res.runs} forløb, seed ${res.seed}`];
  let bad = 0;
  for (const [name, st] of Object.entries(res.per)) {
    const errs = st.visibleTotal + st.nonMonotonic + st.negativeLap + st.sumMismatch + st.wrongShown + st.honestWrong + st.totalJump1s;
    bad += errs;
    lines.push('');
    lines.push(`${LABELS[name] || name}`);
    lines.push(`  forløb ${st.runs}, tryk ${st.events}`);
    if (name !== 'honest') {
      lines.push(`  tryk med mål: ${st.planned}, ramt ${st.plannedHit} (${pct(st.plannedHit, st.planned)})`);
      if (st.firstStops) lines.push(`  første stop ramt: ${st.firstHit}/${st.firstStops} (${pct(st.firstHit, st.firstStops)})`);
      lines.push(`  i alt: ramt ${st.hit}, delvist (kun hundrededele) ${st.partial}, ærligt ${st.natural}`);
    }
    lines.push(`  synlige spring ${st.visibleTotal}, baglæns ${st.nonMonotonic}, negativ omgang ${st.negativeLap}, sum-fejl ${st.sumMismatch}, forkert vist ${st.wrongShown}${name === 'honest' ? `, ikke-ærlig ${st.honestWrong}` : ''}`);
    if (st.lapRowSecond) lines.push(`  omgangsrække skiftede sekund ved frysning: ${st.lapRowSecond} (lille række, ufarligt)`);
    if (st.maxHandDeg) lines.push(`  største viser-ryk ved stop (analog): ${st.maxHandDeg.toFixed(1).replace('.', ',')}°`);
  }
  lines.push('');
  lines.push(bad === 0 ? 'RESULTAT: OK - ingen fejl' : `RESULTAT: ${bad} FEJL`);
  return lines.join('\n');
}

export { formatCs, VISIBLE };
