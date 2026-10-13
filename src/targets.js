// Mål-generatorer: oversætter indstillingerne i det hemmelige panel til en "plan":
//   { stop: mønster|null, laps: [mønster…], stopTakesNextLap, summary, error }
// Et mønster er 6 pladser for MMSSHH (null = frit), se engine.js.

import { stackCards, cardPosition, prettyCard } from './stacks.js';

const onlyDigits = (s) => String(s ?? '').replace(/\D/g, '');
const FREE = () => [null, null, null, null, null, null];

// ---------- byggeklodser ----------
export function patHH(two) { // sidste to cifre (hundrededele)
  const d = onlyDigits(two).slice(-2).padStart(2, '0');
  return [null, null, null, null, +d[0], +d[1]];
}

export function patH2(one) { // kun sidste ciffer
  const d = onlyDigits(one).slice(-1) || '0';
  return [null, null, null, null, null, +d];
}

export function patSSHH(four) { // sekunder + hundrededele: ??.SS,HH
  const d = onlyDigits(four).slice(-4).padStart(4, '0');
  return [null, null, +d[0], +d[1], +d[2], +d[3]];
}

export function patMMSS(four) { // minutter + sekunder: MM.SS,??
  const d = onlyDigits(four).slice(-4).padStart(4, '0');
  return [+d[0], +d[1], +d[2], +d[3], null, null];
}

export function patMMSSHH(six) { // hele visningen: MM.SS,HH
  const d = onlyDigits(six).slice(-6).padStart(6, '0');
  return [...d].map(Number);
}

export function checkPattern(p) {
  if (p[0] !== null && p[0] > 5) return 'Minutter skal være 00-59';
  if (p[2] !== null && p[2] > 5) return 'Sekunder skal være 00-59';
  return null;
}

// "05 12 17,23" → ['05','12','17','23'];  "12345678" → ['12','34','56','78'] (per = 2)
export function splitItems(text, per = 2) {
  const raw = String(text ?? '').trim();
  if (!raw) return [];
  const parts = raw.split(/[\s,.;:/\-–+]+/).map(onlyDigits).filter(Boolean);
  const out = [];
  for (const part of parts) {
    if (part.length <= per) { out.push(part.padStart(per, '0')); continue; }
    const padded = part.padStart(Math.ceil(part.length / per) * per, '0');
    for (let i = 0; i < padded.length; i += per) out.push(padded.slice(i, i + per));
  }
  return out;
}

export function itemsToLaps(items, per = 2) {
  return items.map((it) => (per === 1 ? patH2(it) : patHH(it)));
}

// Dato som DDMMÅÅ. which: 'today' | 'tomorrow' | 'custom'
export function dateDigits(which, custom, now = new Date(), plusMin = 0) {
  if (which === 'clock') { // klokken nu (+ minutter) som TTMM
    const t = new Date(now.getTime() + (Number(plusMin) || 0) * 60000);
    return String(t.getHours()).padStart(2, '0') + String(t.getMinutes()).padStart(2, '0');
  }
  if (which === 'custom') {
    const d = onlyDigits(custom);
    return d.length === 6 ? d : null;
  }
  const t = new Date(now.getFullYear(), now.getMonth(), now.getDate() + (which === 'tomorrow' ? 1 : 0));
  const p2 = (n) => String(n).padStart(2, '0');
  return p2(t.getDate()) + p2(t.getMonth() + 1) + p2(t.getFullYear() % 100);
}

// Ét tal: placering ud fra antal cifre (auto) eller valgt
function singleStop(digits, placement) {
  const n = digits.length;
  let p = placement;
  if (!p || p === 'auto') p = n <= 2 ? 'hh' : n <= 4 ? 'sshh' : 'mmsshh';
  if (p === 'hh') return patHH(digits);
  if (p === 'sshh') return patSSHH(digits);
  if (p === 'mmss') return patMMSS(digits);
  return patMMSSHH(digits);
}

// Linjer i listen (tomme linjer og "#kommentarer" springes over)
export function listLines(text) {
  return String(text ?? '').split(/\n/).map((l) => l.replace(/#.*/, '').trim()).filter((l) => onlyDigits(l));
}

const fmtPat = (p) => {
  const c = p.map((d) => (d === null ? '–' : String(d)));
  return `${c[0]}${c[1]}.${c[2]}${c[3]},${c[4]}${c[5]}`;
};
export { fmtPat };

// ---------- planen ----------
export function buildPlan(s, now = new Date()) {
  const plan = { stop: null, laps: [], stopTakesNextLap: false, summary: '', error: null };
  const withLaps = (items, per, stopTakes) => {
    plan.laps = itemsToLaps(items, per);
    plan.stopTakesNextLap = !!stopTakes;
    plan.summary = items.length
      ? `Runder: ${items.join(' · ')}${stopTakes ? ' (Stop tager næste)' : ''}`
      : 'Ingen tal';
  };

  switch (s.mode) {
    case 'single': {
      const d = onlyDigits(s.single?.value);
      if (!d) { plan.error = 'Skriv et tal'; break; }
      plan.stop = singleStop(d.slice(-6), s.single?.placement);
      plan.summary = `Stop → ${fmtPat(plan.stop)}`;
      break;
    }
    case 'sequence': {
      const per = s.sequence?.per === 1 ? 1 : 2;
      const items = splitItems(s.sequence?.text, per);
      withLaps(items, per, s.sequence?.stopTakes !== false);
      if (!items.length) plan.error = 'Skriv mindst ét tal';
      break;
    }
    case 'date': {
      const d = dateDigits(s.date?.which || 'tomorrow', s.date?.custom, now, s.date?.plusMin);
      if (!d) { plan.error = 'Dato skal være DDMMÅÅ'; break; }
      const pl = s.date?.placement || 'laps';
      if (pl === 'laps') withLaps(splitItems(d, 2), 2, s.date?.stopTakes !== false);
      else if (pl === 'sshh') { plan.stop = patSSHH(d.slice(0, 4)); plan.summary = `Stop → ${fmtPat(plan.stop)}`; }
      else { plan.stop = patMMSSHH(d); plan.summary = `Stop → ${fmtPat(plan.stop)}`; }
      plan.dateDigits = d;
      break;
    }
    case 'code': {
      const d = onlyDigits(s.code?.value);
      if (!d) { plan.error = 'Skriv en kode'; break; }
      const pl = s.code?.placement || 'sshh';
      if (pl === 'laps') withLaps(splitItems(d, 2), 2, s.code?.stopTakes !== false);
      else { plan.stop = singleStop(d.slice(-(pl === 'hh' ? 2 : pl === 'mmsshh' ? 6 : 4)), pl); plan.summary = `Stop → ${fmtPat(plan.stop)}`; }
      break;
    }
    case 'list': {
      const lines = listLines(s.list?.text);
      if (!lines.length) { plan.error = 'Listen er tom'; break; }
      const idx = ((s.list?.index | 0) % lines.length + lines.length) % lines.length;
      const line = lines[idx];
      plan.listIndex = idx;
      plan.listCount = lines.length;
      if ((s.list?.placement || 'laps') === 'laps') {
        withLaps(splitItems(line, 2), 2, s.list?.stopTakes !== false);
      } else {
        plan.stop = singleStop(onlyDigits(line).slice(-6), 'auto');
        plan.summary = `Stop → ${fmtPat(plan.stop)}`;
      }
      plan.summary = `Linje ${idx + 1}/${lines.length}: ${plan.summary}`;
      break;
    }
    case 'card': { // ACAAN: kortets plads i stakken
      const c = s.card || {};
      const cards = stackCards(c.stack || 'mnemonica', c.custom);
      if (!cards) { plan.error = 'Egen stak skal have 52 forskellige kort'; break; }
      const pos = cardPosition(c.card, cards, c.offset, c.fromBottom);
      if (!pos) { plan.error = 'Vælg et kort'; break; }
      if (pos > 99) { plan.error = 'Pladsen er over 99'; break; }
      const two = String(pos).padStart(2, '0');
      plan.stop = c.placement === 'ss' ? [null, null, +two[0], +two[1], null, null] : patHH(two);
      if (plan.stop[2] !== null && plan.stop[2] > 5) { plan.error = 'Sekunder skal være 00-59'; break; }
      plan.cardPos = pos;
      plan.summary = `${prettyCard(c.card)} er nr. ${pos} → Stop ${fmtPat(plan.stop)}`;
      break;
    }
    default:
      plan.error = 'Ukendt tilstand';
  }

  for (const p of [plan.stop, ...plan.laps]) {
    if (!p) continue;
    const err = checkPattern(p);
    if (err) plan.error = err;
  }
  if (plan.error) { plan.stop = null; plan.laps = []; }
  return plan;
}

export { FREE };
