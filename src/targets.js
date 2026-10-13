// Mål-generatorer: oversætter indstillingerne i det hemmelige panel til en "plan":
//   { stop: mønster|null, laps: [mønster…], stopTakesNextLap, summary, error }
// Et mønster er 6 pladser for MMSSHH (null = frit), se engine.js.

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
export function dateDigits(which, custom, now = new Date()) {
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
      const d = dateDigits(s.date?.which || 'tomorrow', s.date?.custom, now);
      if (!d) { plan.error = 'Dato skal være DDMMÅÅ'; break; }
      const pl = s.date?.placement || 'laps';
      if (pl === 'laps') withLaps([d.slice(0, 2), d.slice(2, 4), d.slice(4, 6)], 2, s.date?.stopTakes !== false);
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
