// Indstillinger fra det hemmelige panel. Gemmes i localStorage på telefonen.

export const SETTINGS_KEY = 'ur-stopur-indstillinger-v1';

export const DEFAULTS = {
  active: true,
  routine: 'blank', // valgt rutine ('' = egen opsætning)
  custom: [], // (gammelt format – flyttes ind i routines)
  routines: [], // alle rutiner med hver sin kopi af indstillingerne (se routines.js)
  routinesSeeded: false,
  blankStart: false, // første start sker på Tom rutine
  mode: 'single', // single | sequence | date | code | list
  single: { value: '', placement: 'hh' }, // auto | hh | sshh | mmsshh
  sequence: { text: '05 12 17 23 28 31 36', per: 2, stopTakes: true },
  date: { which: 'tomorrow', custom: '', plusMin: 0, placement: 'laps', stopTakes: true }, // which: tomorrow|today|custom|clock
  card: { stack: 'mnemonica', custom: '', card: 'AS', offset: 0, fromBottom: false, placement: 'hh', timerInput: true },
  code: { value: '2100', placement: 'sshh', stopTakes: true }, // sshh | mmss | hh | laps
  list: { text: '47 12 05\n112 08 03', index: 0, placement: 'laps', stopTakes: true, advance: true },
  blind: false, // tilskueren ser ikke skærmen ved stop → målet vises altid
  jumpTol: 0, // tilladt synligt spring i cs (0, 50, 100, 200)
  miss: 'hh', // hvis målet ikke kan nås usynligt: 'hh' = ram hundrededele, 'none' = ærligt
  onReset: 'restart', // talrække ved Nulstil: 'restart' | 'continue'
  armAfter: 0, // force først aktiv efter så mange sekunder (0 = med det samme)
  honestRuns: 0, // så mange ærlige forsøg (start → nulstil) først
  once: false, // slå force fra efter første forsøg med force
  afterHit: 'again', // nye stop i samme forsøg: 'again' = ram igen, 'honest' = ærlige
  performStart: false, // åbn appen på den falske hjemmeskærm
  peekHold: true, // hold fingeren på tallet → se det sidste stop efter Nulstil
  indicator: false, // diskret prik når force er klar
  digitWeight: 150, // tykkelse på de store tal (100-300); den rigtige Ur-app er tyndere end 200
  timerHand: true, // Tidtagninger-ikonets viser peger på kl. 9, når force er klar
};

const clone = (o) => JSON.parse(JSON.stringify(o));

function merge(base, extra) {
  const out = clone(base);
  if (!extra || typeof extra !== 'object') return out;
  for (const k of Object.keys(base)) {
    if (!(k in extra)) continue;
    const b = base[k];
    const e = extra[k];
    if (b && typeof b === 'object' && !Array.isArray(b)) out[k] = merge(b, e);
    else if (typeof e === typeof b) out[k] = e;
  }
  return out;
}

export function loadSettings(storage = globalThis.localStorage) {
  try {
    const raw = storage && storage.getItem(SETTINGS_KEY);
    return merge(DEFAULTS, raw ? JSON.parse(raw) : null);
  } catch {
    return clone(DEFAULTS);
  }
}

export function saveSettings(s, storage = globalThis.localStorage) {
  try { storage && storage.setItem(SETTINGS_KEY, JSON.stringify(s)); } catch { /* privat tilstand */ }
}

export function engineOptions(s) {
  return {
    active: !!s.active,
    blind: !!s.blind,
    jumpTol: Number(s.jumpTol) || 0,
    miss: s.miss === 'none' ? 'none' : 'hh',
    onReset: s.onReset === 'continue' ? 'continue' : 'restart',
    armAfter: Math.max(0, Number(s.armAfter) || 0),
    afterHit: s.afterHit === 'honest' ? 'honest' : 'again',
  };
}

export { merge as mergeSettings, clone as cloneSettings };
