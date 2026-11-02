// Live-forbindelse til Noter+ og Calcplus via relæet (src/link.js).
// Ren logik uden DOM, så den kan testes: tallets form på uret, modtag "force", send uden dubletter.

import { buildPlan } from './targets.js';
import { findRoutine, selectRoutine, storeActive, builtinRoutine } from './routines.js';

export const LIVE_ROUTINE = {
  id: 'noterlive', name: 'Noter+ (live)', desc: 'Målet kommer live fra Noter+ / Calcplus via koden under Mere',
  patch: { mode: 'single', single: { value: '', placement: 'auto' } },
};
export const BY = 'stopwatch';
const onlyDigits = (s) => String(s ?? '').replace(/\D/g, '');

// Antal bogstaver i et navn fra Noter+ (mellemrum, tal og tegn tælles ikke med)
export function letterCount(name) {
  const m = String(name ?? '').match(/\p{L}/gu);
  return m ? m.length : 0;
}

// Kan cifrene vises som en tid på uret? (1-2 = ,HH · 3-4 = SS,HH · 5-6 = MM.SS,HH)
export function isValidTime(digits) {
  const d = onlyDigits(digits);
  if (!d.length || d.length > 6) return false;
  const p = d.padStart(6, '0');
  return +p.slice(0, 2) <= 59 && +p.slice(2, 4) <= 59;
}

// Tallets form på uret.
//   'auto' (anbefalet): Tid kun når det kan rammes usynligt, uanset hvornår der stoppes –
//          1-2 cifre (hundrededele), eller en gyldig tid med Blind slået til. Ellers Række.
//   'time': Tid, når tallet er en gyldig tid; ellers Række.
// Række: 2 cifre pr. runde, Stop tager den sidste (ulige antal → første runde får et 0 foran).
export function shapeFor(digits, { shape = 'auto', blind = false } = {}) {
  const d = onlyDigits(digits);
  if (!d) return null;
  const valid = isValidTime(d);
  const asTime = d.length <= 2 || (valid && (shape === 'time' || blind));
  if (asTime) {
    const label = d.length <= 2 ? ',HH' : d.length <= 4 ? 'SS,HH' : 'MM.SS,HH';
    let note = '';
    if (d.length > 2 && !blind) note = 'Sekunder/minutter rammes kun, hvis de stopper tæt på – ellers kun hundrededelene.';
    return { mode: 'single', value: d, form: 'tid', label: `Tid (${label})`, note, warn: '' };
  }
  const pairs = d.padStart(Math.ceil(d.length / 2) * 2, '0').match(/../g);
  const laps = pairs.length - 1;
  let note = '';
  if (d.length % 2) note = `Ulige antal cifre: første runde viser ${pairs[0]}.`;
  let warn = '';
  if (pairs.length > 4) warn = `Langt tal: ${laps} × Runde før Stop.`;
  if (!valid && d.length <= 6) note = [note, 'Ikke en gyldig tid (sekunder/minutter over 59).'].filter(Boolean).join(' ');
  return {
    mode: 'sequence', text: pairs.join(' '), form: 'runder',
    label: `Række (${pairs.join(' · ')} – ${laps ? `${laps} × Runde, så Stop` : 'Stop'})`, note, warn,
  };
}

// Modtag rummets force-felt. Ændrer settings og returnerer { digits, name, shape }, eller null.
// Kun nyere end sidst modtagne (forceAt), og aldrig vores eget (by = 'stopwatch').
export function receiveForce(settings, force) {
  const link = settings.link;
  if (!force || typeof force !== 'object' || force.by === BY) return null;
  const at = Number(force.at) || 0;
  if (at <= (link.forceAt || 0)) return null;
  link.forceAt = at;
  const digits = onlyDigits(force.digits);
  if (!digits || !link.receive) return null;
  if (!findRoutine(settings, LIVE_ROUTINE.id)) settings.routines.unshift(builtinRoutine(LIVE_ROUTINE));
  selectRoutine(settings, LIVE_ROUTINE.id); // gemmer den rutine, du stod i, og skifter til live-rutinen
  const shape = shapeFor(digits, { shape: link.shape, blind: settings.blind });
  if (shape.mode === 'single') {
    settings.mode = 'single';
    settings.single.value = shape.value;
    settings.single.placement = 'auto';
  } else {
    settings.mode = 'sequence';
    settings.sequence.text = shape.text;
    settings.sequence.per = 2;
    settings.sequence.stopTakes = true;
  }
  settings.active = true;
  storeActive(settings);
  link.sentDigits = targetDigits(settings); // send ikke det modtagne mål tilbage (heller ikke med 0 foran)
  link.lastIn = { digits, name: force.name ?? null, by: force.by ?? null, at, form: shape.label, note: shape.note, warn: shape.warn };
  return { digits, name: force.name ?? null, shape };
}

// Cifrene i stopurets nuværende mål (det, der står på uret ved Stop/runder)
export function targetDigits(settings, now = new Date()) {
  let plan;
  try { plan = buildPlan(settings, now); } catch { return ''; }
  if (!plan || plan.error) return '';
  const pats = plan.stop ? [...plan.laps, plan.stop] : plan.laps;
  return pats.map((p) => p.filter((x) => x !== null).join('')).join('');
}

// Mål sat i stopurets eget panel → force-felt til rummet. Null, hvis intet nyt at sende.
export function forceToSend(settings, now = Date.now()) {
  const link = settings.link;
  if (!link.room || !link.send || !settings.active) return null;
  const digits = targetDigits(settings, new Date(now));
  if (!digits || digits === link.sentDigits) return null;
  link.sentDigits = digits;
  return { digits, name: null, by: BY, at: now };
}

// Et stop (eller en runde i Række) → result-felt til rummet
export function resultFor(entry, shownText, now = Date.now()) {
  return { value: shownText, digits: onlyDigits(shownText), forced: entry.result === 'hit' || entry.result === 'partial', by: BY, at: now };
}
