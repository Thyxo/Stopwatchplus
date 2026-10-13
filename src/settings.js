// Indstillinger fra det hemmelige panel. Gemmes i localStorage på telefonen.

export const SETTINGS_KEY = 'ur-stopur-indstillinger-v1';

export const DEFAULTS = {
  active: true,
  routine: 'hh', // valgt rutine ('' = egen opsætning)
  custom: [], // egne gemte rutiner
  mode: 'single', // single | sequence | date | code | list
  single: { value: '37', placement: 'hh' }, // auto | hh | sshh | mmsshh
  sequence: { text: '05 12 17 23 28 31 36', per: 2, stopTakes: true },
  date: { which: 'tomorrow', custom: '', placement: 'laps', stopTakes: true }, // laps | sshh | mmsshh
  code: { value: '2100', placement: 'sshh', stopTakes: true }, // sshh | mmss | hh | laps
  list: { text: '47 12 05\n112 08 03', index: 0, placement: 'laps', stopTakes: true, advance: true },
  blind: false, // tilskueren ser ikke skærmen ved stop → målet vises altid
  jumpTol: 0, // tilladt synligt spring i cs (0, 50, 100, 200)
  miss: 'hh', // hvis målet ikke kan nås usynligt: 'hh' = ram hundrededele, 'none' = ærligt
  onReset: 'restart', // talrække ved Nulstil: 'restart' | 'continue'
  indicator: false, // diskret prik når force er klar
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
  };
}

export { merge as mergeSettings, clone as cloneSettings };
