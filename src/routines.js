// Rutiner (presets). Hver rutine gemmer sin EGEN kopi af indstillingerne (tal, tilstand,
// placering, aktivering …), så tallene ikke deles mellem rutinerne.
// Standardrutinerne kopieres ind i settings.routines første gang og kan derefter
// omdøbes, redigeres, flyttes og slettes som alle andre.

import { DEFAULTS } from './settings.js';

const clone = (o) => JSON.parse(JSON.stringify(o));

// Felter en rutine gemmer
export const SNAPSHOT_KEYS = ['mode', 'single', 'sequence', 'date', 'code', 'list', 'card',
  'blind', 'jumpTol', 'miss', 'onReset', 'armAfter', 'honestRuns', 'once', 'afterHit'];

// input: det ene felt, der vises under rutinen, når den er valgt
export const BUILTIN = [
  {
    id: 'blank', name: 'Tom rutine', desc: 'Intet mål – helt almindeligt stopur, indtil du skriver et tal',
    patch: { mode: 'single', single: { value: '', placement: 'hh' } },
    input: { path: 'single.value', label: 'Tal (tomt = ingen force)', ph: '', im: 'numeric' },
  },
  {
    id: 'hh', name: 'To sidste cifre', desc: 'Stop når som helst – hundrededelene bliver dit tal',
    patch: { mode: 'single', single: { value: '37', placement: 'hh' } },
    input: { path: 'single.value', label: 'Tal (00-99)', ph: '37', im: 'numeric' },
  },
  {
    id: 'honest', name: 'Ærlig prøve først', desc: 'Første forsøg er ægte – andet forsøg rammer dit tal',
    patch: { mode: 'single', single: { value: '07', placement: 'hh' }, honestRuns: 1 },
    input: { path: 'single.value', label: 'Tal (00-99)', ph: '07', im: 'numeric' },
  },
  {
    id: 'aim', name: 'Ram sekundet', desc: '"Prøv at stoppe på præcis 10 sekunder"',
    patch: { mode: 'single', single: { value: '1037', placement: 'sshh' } },
    input: { path: 'single.value', label: 'SS,HH', ph: '1037', im: 'numeric' },
  },
  {
    id: 'blind', name: 'Blind stop', desc: 'Tilskueren kigger væk og stopper – hele tiden bliver dit tal',
    patch: { mode: 'single', single: { value: '1437', placement: 'auto' }, blind: true },
    input: { path: 'single.value', label: 'Tid (1437 eller 240387)', ph: '1437', im: 'numeric' },
  },
  {
    id: 'acaan', name: 'ACAAN (kort i stakken)', desc: 'De nævner et kort – stoppet viser kortets plads',
    patch: { mode: 'card', card: { placement: 'hh' }, armAfter: 1 },
    input: { type: 'card' },
  },
  {
    id: 'lotto', name: 'Lotto-række', desc: 'Runde 6 gange og Stop – 7 tal',
    patch: { mode: 'sequence', sequence: { text: '5 12 17 23 28 31 36', per: 2, stopTakes: true } },
    input: { path: 'sequence.text', label: '7 tal', ph: '5 12 17 23 28 31 36', im: 'decimal' },
  },
  {
    id: 'phone', name: 'Telefonnummer', desc: 'Runde 3 gange og Stop – 8 cifre',
    patch: { mode: 'sequence', sequence: { text: '12345678', per: 2, stopTakes: true } },
    input: { path: 'sequence.text', label: 'Nummer', ph: '12345678', im: 'numeric' },
  },
  {
    id: 'pin', name: 'PIN-kode', desc: 'Ét ciffer pr. runde – Runde 3 gange og Stop',
    patch: { mode: 'sequence', sequence: { text: '2580', per: 1, stopTakes: true } },
    input: { path: 'sequence.text', label: 'PIN', ph: '2580', im: 'numeric' },
  },
  {
    id: 'tomorrow', name: 'I morgens dato', desc: 'Runde, Runde, Stop → DD · MM · ÅÅ',
    patch: { mode: 'date', date: { which: 'tomorrow', placement: 'laps', stopTakes: true } },
  },
  {
    id: 'clock', name: 'Klokken lige nu', desc: 'Runde, Stop → TT · MM (fx når I skal mødes)',
    patch: { mode: 'date', date: { which: 'clock', plusMin: 0, placement: 'laps', stopTakes: true } },
    input: { path: 'date.plusMin', label: 'Minutter frem', ph: '0', im: 'numeric' },
  },
  {
    id: 'birthday', name: 'Fødselsdag', desc: 'Runde, Runde, Stop → DD · MM · ÅÅ',
    patch: { mode: 'date', date: { which: 'custom', custom: '240387', placement: 'laps', stopTakes: true } },
    input: { path: 'date.custom', label: 'DDMMÅÅ', ph: '240387', im: 'numeric' },
  },
  {
    id: 'year', name: 'Fødselsår', desc: 'Runde, Stop → 19 · 87',
    patch: { mode: 'code', code: { value: '1987', placement: 'laps', stopTakes: true } },
    input: { path: 'code.value', label: 'Årstal', ph: '1987', im: 'numeric' },
  },
  {
    id: 'zip', name: 'Postnummer', desc: '"Stop på 20 sekunder" → 00.21,00',
    patch: { mode: 'code', code: { value: '2100', placement: 'sshh' } },
    input: { path: 'code.value', label: 'Postnummer', ph: '2100', im: 'numeric' },
  },
  {
    id: 'book', name: 'Bogtest', desc: 'Side · linje · ord på runderne – ny linje pr. tilskuer',
    patch: { mode: 'list', list: { text: '47 12 05\n112 08 03', placement: 'laps', advance: true, stopTakes: true } },
    input: { path: 'list.text', label: 'Én linje pr. tilskuer', ph: '47 12 05', textarea: true },
  },
];

function deepAssign(target, patch) {
  for (const [k, v] of Object.entries(patch)) {
    if (v && typeof v === 'object' && !Array.isArray(v) && target[k] && typeof target[k] === 'object') deepAssign(target[k], v);
    else target[k] = v;
  }
  return target;
}

function baseSnapshot() {
  const snap = {};
  for (const k of SNAPSHOT_KEYS) snap[k] = clone(DEFAULTS[k]);
  return snap;
}

export function builtinRoutine(b) {
  return { id: b.id, name: b.name, desc: b.desc, input: b.input || null, snapshot: deepAssign(baseSnapshot(), clone(b.patch)) };
}

export function snapshotOf(settings) {
  const snap = {};
  for (const k of SNAPSHOT_KEYS) snap[k] = clone(settings[k]);
  return snap;
}

// Sørg for at rutinelisten findes (første start, eller gamle indstillinger med "custom")
export function ensureRoutines(settings) {
  if (!Array.isArray(settings.routines) || !settings.routinesSeeded) {
    settings.routines = BUILTIN.map(builtinRoutine);
    for (const c of settings.custom || []) {
      if (c && c.snapshot) settings.routines.push({ id: c.id, name: c.name, desc: 'Egen rutine', input: null, snapshot: deepAssign(baseSnapshot(), c.snapshot) });
    }
    settings.custom = [];
    settings.routinesSeeded = true;
  }
  // Tom rutine øverst (ældre versioner havde den ikke) – og start på den én gang
  if (!findRoutine(settings, 'blank')) settings.routines.unshift(builtinRoutine(BUILTIN[0]));
  if (!settings.blankStart) {
    settings.blankStart = true;
    const b = findRoutine(settings, 'blank');
    deepAssign(settings, clone(b.snapshot));
    settings.routine = 'blank';
  }
  // nye felter i snapshots fra ældre versioner
  for (const r of settings.routines) r.snapshot = deepAssign(baseSnapshot(), r.snapshot || {});
  if (settings.routine && !settings.routines.some((r) => r.id === settings.routine)) settings.routine = '';
  return settings;
}

export const findRoutine = (settings, id) => (settings.routines || []).find((r) => r.id === id) || null;

// Gem de nuværende indstillinger i den valgte rutine (kaldes efter hver ændring)
export function storeActive(settings) {
  const r = findRoutine(settings, settings.routine);
  if (r) r.snapshot = snapshotOf(settings);
}

export function selectRoutine(settings, id) {
  const r = findRoutine(settings, id);
  if (!r) return false;
  storeActive(settings);
  deepAssign(settings, clone(r.snapshot));
  settings.routine = id;
  settings.active = true;
  return true;
}

export function newRoutine(settings, name) {
  const r = { id: 'r' + Date.now().toString(36) + Math.floor(Math.random() * 1e4), name: String(name).slice(0, 40), desc: 'Egen rutine', input: null, snapshot: snapshotOf(settings) };
  settings.routines.push(r);
  settings.routine = r.id;
  return r;
}

export function duplicateRoutine(settings, id) {
  const src = findRoutine(settings, id);
  if (!src) return null;
  if (settings.routine === id) storeActive(settings);
  const r = clone(src);
  r.id = 'r' + Date.now().toString(36) + Math.floor(Math.random() * 1e4);
  r.name = (src.name + ' (kopi)').slice(0, 40);
  const i = settings.routines.indexOf(src);
  settings.routines.splice(i + 1, 0, r);
  return r;
}

export function renameRoutine(settings, id, name) {
  const r = findRoutine(settings, id);
  if (r && String(name).trim()) r.name = String(name).trim().slice(0, 40);
}

export function deleteRoutine(settings, id) {
  settings.routines = settings.routines.filter((r) => r.id !== id);
  if (settings.routine === id) settings.routine = '';
}

export function moveRoutine(settings, id, dir) {
  const a = settings.routines;
  const i = a.findIndex((r) => r.id === id);
  const j = i + dir;
  if (i < 0 || j < 0 || j >= a.length) return;
  [a[i], a[j]] = [a[j], a[i]];
}

// Tilføj standardrutiner, der er slettet (rører ikke dine egne eller ændrede)
export function restoreBuiltins(settings) {
  let n = 0;
  for (const b of BUILTIN) {
    if (!findRoutine(settings, b.id)) { settings.routines.push(builtinRoutine(b)); n++; }
  }
  return n;
}
