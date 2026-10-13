// Færdige rutiner (presets). Hver rutine er et sæt indstillinger + ét felt, du skriver dit tal i.

export const ROUTINES = [
  {
    id: 'hh', name: 'To sidste cifre', desc: 'Stop når som helst – hundrededelene bliver dit tal',
    patch: { mode: 'single', single: { placement: 'hh' }, blind: false },
    input: { path: 'single.value', label: 'Tal (00-99)', ph: '37', im: 'numeric' },
  },
  {
    id: 'aim', name: 'Ram sekundet', desc: '"Prøv at stoppe på præcis 10 sekunder"',
    patch: { mode: 'single', single: { placement: 'sshh' }, blind: false },
    input: { path: 'single.value', label: 'SS,HH', ph: '1037', im: 'numeric' },
  },
  {
    id: 'blind', name: 'Blind stop', desc: 'Tilskueren kigger væk og stopper – hele tiden bliver dit tal',
    patch: { mode: 'single', single: { placement: 'auto' }, blind: true },
    input: { path: 'single.value', label: 'Tid (1437 eller 240387)', ph: '1437', im: 'numeric' },
  },
  {
    id: 'lotto', name: 'Lotto-række', desc: 'Runde 6 gange og Stop – 7 tal',
    patch: { mode: 'sequence', sequence: { per: 2, stopTakes: true }, blind: false },
    input: { path: 'sequence.text', label: '7 tal', ph: '5 12 17 23 28 31 36', im: 'decimal' },
  },
  {
    id: 'phone', name: 'Telefonnummer', desc: 'Runde 3 gange og Stop – 8 cifre',
    patch: { mode: 'sequence', sequence: { per: 2, stopTakes: true }, blind: false },
    input: { path: 'sequence.text', label: 'Nummer', ph: '12345678', im: 'numeric' },
  },
  {
    id: 'pin', name: 'PIN-kode', desc: 'Ét ciffer pr. runde – Runde 3 gange og Stop',
    patch: { mode: 'sequence', sequence: { per: 1, stopTakes: true }, blind: false },
    input: { path: 'sequence.text', label: 'PIN', ph: '2580', im: 'numeric' },
  },
  {
    id: 'tomorrow', name: 'I morgens dato', desc: 'Runde, Runde, Stop → DD · MM · ÅÅ',
    patch: { mode: 'date', date: { which: 'tomorrow', placement: 'laps', stopTakes: true }, blind: false },
  },
  {
    id: 'birthday', name: 'Fødselsdag', desc: 'Runde, Runde, Stop → DD · MM · ÅÅ',
    patch: { mode: 'date', date: { which: 'custom', placement: 'laps', stopTakes: true }, blind: false },
    input: { path: 'date.custom', label: 'DDMMÅÅ', ph: '240387', im: 'numeric' },
  },
  {
    id: 'zip', name: 'Postnummer', desc: '"Stop på 20 sekunder" → 00.21,00',
    patch: { mode: 'code', code: { placement: 'sshh' }, blind: false },
    input: { path: 'code.value', label: 'Postnummer', ph: '2100', im: 'numeric' },
  },
  {
    id: 'book', name: 'Bogtest', desc: 'Side · linje · ord på runderne – ny linje pr. tilskuer',
    patch: { mode: 'list', list: { placement: 'laps', advance: true, stopTakes: true }, blind: false },
    input: { path: 'list.text', label: 'Én linje pr. tilskuer', ph: '47 12 05', textarea: true },
  },
];

// Felter en egen rutine gemmer
export const SNAPSHOT_KEYS = ['mode', 'single', 'sequence', 'date', 'code', 'list', 'blind', 'jumpTol', 'miss', 'onReset'];

function deepAssign(target, patch) {
  for (const [k, v] of Object.entries(patch)) {
    if (v && typeof v === 'object' && !Array.isArray(v) && target[k] && typeof target[k] === 'object') deepAssign(target[k], v);
    else target[k] = v;
  }
  return target;
}

export function applyRoutine(settings, id) {
  const r = ROUTINES.find((x) => x.id === id);
  const c = (settings.custom || []).find((x) => x.id === id);
  if (r) deepAssign(settings, JSON.parse(JSON.stringify(r.patch)));
  else if (c) deepAssign(settings, JSON.parse(JSON.stringify(c.snapshot)));
  else return false;
  settings.routine = id;
  settings.active = true;
  return true;
}

export function snapshotRoutine(settings, name) {
  const snapshot = {};
  for (const k of SNAPSHOT_KEYS) snapshot[k] = JSON.parse(JSON.stringify(settings[k]));
  const item = { id: 'c' + Date.now().toString(36), name: String(name).slice(0, 40), snapshot };
  settings.custom = [...(settings.custom || []), item];
  settings.routine = item.id;
  return item;
}
