// Stopur + skjult force-motor. Ingen DOM – kan køres og testes i Node.
//
// Princip: Det viste tal = ægte tid + en lille forskydning (offset). Forskydningen
// ændres kun i det øjeblik, der trykkes Stop eller Runde, og kun i de cifre, man ikke
// kan nå at aflæse (hundrededele og tiendedele). Bagefter glider den langsomt tilbage
// mod 0 (max 2 % hastighedsændring), så uret igen følger ægte tid.
//
// Ved hvert tryk vælger motoren blandt alle tal, der passer til målet, det tal hvis
// "synlighed" er mindst (se visCost). Kan målet ikke nås usynligt, bruges et delvist
// mål (kun hundrededele) eller det ærlige tal.

import { digits6, msToCs } from './format.js';

// ---------- mønstre ----------
// Et mønster er 6 pladser for cifrene MMSSHH. null = frit ciffer.
const PLACE = [60000, 6000, 1000, 100, 10, 1];
const RANGE = [6, 10, 6, 10, 10, 10];
const CYCLE = [360000, 60000, 6000, 1000, 100, 10];

export function pattern(str) {
  if (typeof str !== 'string' || str.length !== 6) throw new Error('Mønster skal have 6 tegn');
  return [...str].map((c) => (c === '?' ? null : Number(c)));
}

export const patternToString = (p) => p.map((d) => (d === null ? '?' : d)).join('');

export function isValidPattern(p) {
  return Array.isArray(p) && p.length === 6 &&
    p.every((d, i) => d === null || (Number.isInteger(d) && d >= 0 && d < RANGE[i]));
}

export function matches(cs, p) {
  const d = digits6(cs);
  for (let i = 0; i < 6; i++) if (p[i] !== null && d.charCodeAt(i) - 48 !== p[i]) return false;
  return true;
}

export const hhOnly = (p) => [null, null, null, null, p[4], p[5]];
export const isFree = (p) => p.every((d) => d === null);

function offsets(p) {
  const top = p.findIndex((d) => d !== null);
  if (top < 0) return null;
  let offs = [0];
  for (let i = top; i < 6; i++) {
    const next = [];
    const vals = p[i] !== null ? [p[i]] : Array.from({ length: RANGE[i] }, (_, k) => k);
    for (const o of offs) for (const v of vals) next.push(o + v * PLACE[i]);
    offs = next;
  }
  return { period: CYCLE[top], offs };
}

// Alle værdier (cs) i [lo, hi], der passer til mønsteret, sorteret stigende.
export function candidatesIn(p, lo, hi) {
  lo = Math.max(0, Math.ceil(lo));
  hi = Math.floor(hi);
  if (hi < lo) return [];
  const o = offsets(p);
  if (!o) { // frit mønster: alt passer – returnér kun endepunkterne og midten
    return [...new Set([lo, Math.round((lo + hi) / 2), hi])];
  }
  const out = [];
  for (let k = Math.floor(lo / o.period); k * o.period <= hi; k++) {
    for (const off of o.offs) {
      const v = k * o.period + off;
      if (v >= lo && v <= hi) out.push(v);
    }
  }
  return out.sort((a, b) => a - b);
}

// Nærmeste værdi under og over x (uanset afstand)
export function nearestCandidates(p, x, min = 0) {
  const o = offsets(p);
  if (!o) return [Math.max(min, x)];
  const out = [];
  const k0 = Math.floor(x / o.period);
  for (let k = k0 - 1; k <= k0 + 1; k++) {
    for (const off of o.offs) {
      const v = k * o.period + off;
      if (v >= min) out.push(v);
    }
  }
  out.sort((a, b) => Math.abs(a - x) - Math.abs(b - x));
  return out.slice(0, 4);
}

// ---------- synlighed ----------
export const VISIBLE = 10;

// Hvor synligt er det, at et tal skifter fra `from` til `to` (begge cs)?
// Hele sekunder (og opefter) kan aflæses; tiendedele og hundrededele kan ikke, mens uret kører.
//  running: tallet kører videre bagefter (totalen ved Runde) – et lille spring frem
//           ligner bare at sekundet tikkede en anelse tidligt.
//  analog:  viseren er synlig, så selve springets størrelse koster også.
export function visCost(from, to, o = {}) {
  const d = to - from;
  const ad = Math.abs(d);
  if (o.blind) return ad * 0.0005;
  const sf = Math.floor(from / 100);
  const st = Math.floor(to / 100);
  let c;
  if (sf === st) c = 0;
  else if (d > 0 && o.running && d < 100) c = 1 + d / 100;
  else if (d > 0 && st === sf + 1 && 100 - (from % 100) <= (o.fwdTol ?? 25)) c = 1; // sekundet skulle alligevel lige til at skifte
  else if (d < 0 && st === sf - 1 && from % 100 < (o.backTol ?? 12)) c = 1.5; // sekundet skiftede netop
  else if (ad <= (o.jumpTol ?? 0)) c = 3 + ad / 100; // tilladt lille synligt spring (indstilling)
  else c = VISIBLE + ad / 100;
  if (o.analog) c += (ad / 100) * 0.6 + (d < 0 ? 0.25 : 0);
  return c + ad * 0.0005;
}

const SEARCH = 3000; // ±30 sek. omkring det ægte tal

// ---------- force-motor ----------
export class ForceEngine {
  /**
   * @param {object} a
   * @param {() => object|null} a.getPlan     { stop, laps, stopTakesNextLap }
   * @param {() => object} a.getOptions       { active, blind, jumpTol, miss, onReset }
   */
  constructor({ getPlan, getOptions }) {
    this.getPlan = getPlan;
    this.getOptions = getOptions;
    this.lapIndex = 0;
    this.hits = 0;
    this.log = [];
    this.onLog = null;
  }

  resetRun() {
    const o = this.getOptions();
    const hadHits = this.hits > 0;
    if (o.onReset !== 'continue') this.lapIndex = 0;
    this.hits = 0;
    return hadHits;
  }

  record(entry) {
    entry.at = Date.now();
    this.log.unshift(entry);
    if (this.log.length > 30) this.log.length = 30;
    if (entry.result === 'hit' || entry.result === 'partial') this.hits++;
    if (this.onLog) this.onLog(entry);
  }

  // dcs: aktuel visning. Før "armAfter" sekunder er force ikke aktiv endnu.
  activePlan(dcs = Infinity) {
    const o = this.getOptions();
    if (!o.active) return { o, plan: null };
    if (o.armAfter > 0 && dcs < o.armAfter * 100) return { o, plan: null, unarmed: true };
    let plan = null;
    try { plan = this.getPlan(); } catch { plan = null; }
    return { o, plan };
  }

  // Runde trykket. Returnerer { lap, jump } i cs: lap = den frosne omgangstid,
  // jump = hvor meget totalen springer frem (0 = totalen kører uændret videre).
  decideLap({ dcs, sumLaps, analog = false }) {
    const ccs = dcs - sumLaps;
    const { o, plan, unarmed } = this.activePlan(dcs);
    if (unarmed) return this.finish('lap', { lap: ccs, jump: 0, result: 'natural', natural: ccs, index: this.lapIndex });
    const i = this.lapIndex++;
    const pat = plan && plan.laps && i < plan.laps.length ? plan.laps[i] : null;
    if (!pat || isFree(pat)) {
      return this.finish('lap', { lap: ccs, jump: 0, result: 'natural', natural: ccs, index: i });
    }
    let best = searchLap(pat, dcs, ccs, analog, o);
    let result = 'hit';
    if (!best || (best.cost >= VISIBLE && !o.blind)) {
      const part = o.miss === 'none' ? null : hhOnly(pat);
      best = part && !isFree(part) ? searchLap(part, dcs, ccs, analog, o) : null;
      result = best ? 'partial' : 'natural';
    }
    if (!best) return this.finish('lap', { lap: ccs, jump: 0, result: 'natural', natural: ccs, index: i, pattern: pat });
    return this.finish('lap', { lap: best.lap, jump: best.jump, result, natural: ccs, index: i, pattern: pat, cost: best.cost });
  }

  // Stop trykket. Returnerer { total } i cs – det tal, uret fryser på.
  decideStop({ dcs, sumLaps, analog = false }) {
    const ccs = dcs - sumLaps;
    const { o, plan } = this.activePlan(dcs);
    let pat = null;
    let target = 'total';
    if (plan && plan.stop) pat = plan.stop;
    else if (plan && plan.stopTakesNextLap && plan.laps && this.lapIndex < plan.laps.length) {
      pat = plan.laps[this.lapIndex];
      target = 'lap';
    }
    if (!pat || isFree(pat)) return this.finish('stop', { total: dcs, result: 'natural', natural: dcs });
    const search = target === 'total' ? searchStopTotal : searchStopLap;
    let best = search(pat, dcs, sumLaps, analog, o);
    let result = 'hit';
    if (!best || (best.cost >= VISIBLE && !o.blind)) {
      const part = o.miss === 'none' ? null : hhOnly(pat);
      best = part && !isFree(part) ? search(part, dcs, sumLaps, analog, o) : null;
      result = best ? 'partial' : 'natural';
      if (best && best.cost >= VISIBLE) { best = null; result = 'natural'; }
    }
    if (!best) return this.finish('stop', { total: dcs, result: 'natural', natural: dcs, target, pattern: pat });
    return this.finish('stop', {
      total: best.total, result, natural: dcs, naturalLap: ccs, target, pattern: pat, cost: best.cost,
    });
  }

  finish(kind, d) {
    this.record({
      kind, result: d.result, natural: d.natural, index: d.index,
      shown: kind === 'lap' ? d.lap : d.total,
      pattern: d.pattern ? patternToString(d.pattern) : null,
      target: d.target,
    });
    return d;
  }
}

function lapOpts(o, extra) {
  return { blind: o.blind, jumpTol: o.jumpTol || 0, ...extra };
}

function searchLap(pat, dcs, ccs, analog, o) {
  let cands = candidatesIn(pat, ccs - SEARCH, ccs + SEARCH);
  if (!cands.length) cands = nearestCandidates(pat, ccs, 0);
  let best = null;
  for (const L of cands) {
    let cost = 0.7 * visCost(ccs, L, lapOpts(o, { running: false }));
    let jump = 0;
    if (L <= ccs) {
      // Totalen kører uændret videre; resten tælles med i næste omgang.
      const carry = ccs - L;
      cost += carry >= 100 ? 4 + carry / 100 : carry * 0.002;
      if (analog) cost += carry / 100 * 0.1;
    } else {
      // Totalen springer frem med forskellen (kun tiendedele/hundrededele synligt).
      jump = L - ccs;
      cost += visCost(dcs, dcs + jump, lapOpts(o, { running: true, analog }));
    }
    if (L < 5) cost += 2; // en omgang på 0,00 ligner en fejl
    if (!best || cost < best.cost) best = { lap: L, jump, cost };
  }
  return best;
}

function searchStopTotal(pat, dcs, sumLaps, analog, o) {
  const ccs = dcs - sumLaps;
  let cands = candidatesIn(pat, Math.max(sumLaps, dcs - SEARCH), dcs + SEARCH);
  if (o.blind || !cands.length) cands = cands.concat(nearestCandidates(pat, dcs, sumLaps));
  let best = null;
  for (const f of cands) {
    if (f < sumLaps) continue;
    let cost = visCost(dcs, f, lapOpts(o, { running: false, analog }));
    if (sumLaps > 0) cost += 0.5 * visCost(ccs, f - sumLaps, lapOpts(o, { running: false }));
    if (f === 0) cost += 5;
    if (!best || cost < best.cost) best = { total: f, cost };
  }
  return best;
}

function searchStopLap(pat, dcs, sumLaps, analog, o) {
  const ccs = dcs - sumLaps;
  let cands = candidatesIn(pat, ccs - SEARCH, ccs + SEARCH);
  if (o.blind || !cands.length) cands = cands.concat(nearestCandidates(pat, ccs, 0));
  let best = null;
  for (const L of cands) {
    const f = dcs + (L - ccs);
    if (f < 0 || L < 0) continue;
    let cost = visCost(dcs, f, lapOpts(o, { running: false, analog }));
    if (sumLaps > 0) cost += 0.7 * visCost(ccs, L, lapOpts(o, { running: false }));
    if (L < 5) cost += 2;
    if (!best || cost < best.cost) best = { total: f, lap: L, cost };
  }
  return best;
}

// ---------- stopuret ----------
export const RESYNC = 0.02; // forskydningen glider mod 0 med max 2 % hastighedsændring

const easeOut = (k) => 1 - Math.pow(1 - k, 3);

// Hvor længe "landingen" ved Stop varer (ms). Digitalt: med det samme, medmindre
// sekundet lige skulle til at tikke. Analogt: viseren glider kort på plads.
export function landingDuration(deltaMs, analog) {
  const a = Math.abs(deltaMs);
  if (a < 1) return 0;
  if (analog) return Math.min(150, 45 + a * 0.12);
  return 0;
}

export class Stopwatch {
  constructor({ engine = null, now = () => performance.now() } = {}) {
    this.engine = engine;
    this.now = now;
    this.clear();
  }

  clear() {
    this.state = 'idle'; // idle | running | stopped
    this.real = 0; // ægte tid i ms før seneste start
    this.runAt = 0; // tidspunkt for seneste start
    this.offBase = 0; // forskydning (ms) ved offT
    this.offT = 0;
    this.frozen = 0; // vist tid (ms) når uret står stille
    this.laps = []; // færdige omgange (cs)
    this.landing = null;
  }

  offsetAt(t) {
    if (this.state !== 'running') return this.offBase;
    const dec = RESYNC * Math.max(0, t - this.offT);
    const b = this.offBase;
    return b > 0 ? Math.max(0, b - dec) : Math.min(0, b + dec);
  }

  setOffset(v, t) {
    this.offBase = v;
    this.offT = t;
  }

  displayMs(t = this.now()) {
    if (this.state === 'running') return this.real + (t - this.runAt) + this.offsetAt(t);
    if (this.landing) {
      const L = this.landing;
      const k = (t - L.t0) / L.dur;
      if (k < 1) return L.from + (L.to - L.from) * easeOut(Math.max(0, k));
      this.landing = null;
    }
    return this.frozen;
  }

  totalCs(t) { return msToCs(this.displayMs(t)); }
  sumLaps() { return this.laps.reduce((a, b) => a + b, 0); }
  currentLapCs(t) { return Math.max(0, this.totalCs(t) - this.sumLaps()); }
  isAnimating(t = this.now()) { return this.state === 'running' || (this.landing && t - this.landing.t0 < this.landing.dur); }

  start(t = this.now()) {
    if (this.state === 'running') return;
    this.landing = null;
    if (this.state === 'idle') {
      this.real = 0;
      this.laps = [];
      this.offBase = 0;
    }
    this.state = 'running';
    this.runAt = t;
    this.offT = t;
  }

  stop(t = this.now(), { analog = false } = {}) {
    if (this.state !== 'running') return null;
    const x = this.displayMs(t);
    this.real += t - this.runAt;
    const dcs = msToCs(x);
    const sumLaps = this.sumLaps();
    const dec = this.engine
      ? this.engine.decideStop({ dcs, sumLaps, analog })
      : { total: dcs, result: 'natural' };
    const frozen = dec.total === dcs ? x : dec.total * 10 + 5; // midt i hundrededelen
    this.state = 'stopped';
    this.frozen = frozen;
    this.offBase = frozen - this.real;
    this.offT = t;
    const dur = landingDuration(frozen - x, analog);
    this.landing = dur > 0 ? { from: x, to: frozen, t0: t, dur } : null;
    return dec;
  }

  lap(t = this.now(), { analog = false } = {}) {
    if (this.state !== 'running') return null;
    const x = this.displayMs(t);
    const dcs = msToCs(x);
    const sumLaps = this.sumLaps();
    const dec = this.engine
      ? this.engine.decideLap({ dcs, sumLaps, analog })
      : { lap: dcs - sumLaps, jump: 0, result: 'natural' };
    this.laps.push(dec.lap);
    if (dec.jump > 0) this.setOffset(this.offsetAt(t) + dec.jump * 10, t);
    else this.setOffset(this.offsetAt(t), t);
    return dec;
  }

  reset() {
    if (this.state === 'running') return null;
    const hadHits = this.engine ? this.engine.resetRun() : false;
    this.clear();
    return { hadHits };
  }

  // Gem/gendan, så uret kører videre hvis appen lukkes (som på iPhone)
  serialize(t = this.now(), wall = Date.now()) {
    return {
      v: 1,
      state: this.state,
      real: this.state === 'running' ? this.real + (t - this.runAt) : this.real,
      off: this.offsetAt(t),
      frozen: this.landing ? this.landing.to : this.frozen,
      laps: this.laps.slice(),
      wall,
      lapIndex: this.engine ? this.engine.lapIndex : 0,
      hits: this.engine ? this.engine.hits : 0,
    };
  }

  restore(s, t = this.now(), wall = Date.now()) {
    if (!s || s.v !== 1) return false;
    this.clear();
    this.state = s.state;
    this.laps = Array.isArray(s.laps) ? s.laps.map((n) => Math.max(0, n | 0)) : [];
    this.frozen = +s.frozen || 0;
    this.offBase = +s.off || 0;
    this.offT = t;
    if (s.state === 'running') {
      this.real = (+s.real || 0) + Math.max(0, wall - (+s.wall || wall));
      this.runAt = t;
    } else {
      this.real = +s.real || 0;
    }
    if (this.engine) {
      this.engine.lapIndex = s.lapIndex | 0;
      this.engine.hits = s.hits | 0;
    }
    return true;
  }
}
