// Tidsformat som iPhonens stopur med dansk sprog: "00.00,00" (min.sek,hundrededele).
// Fra 1 time: "1.00.00,00" (timer uden foranstillet nul).
// Al tid i motoren regnes i hele hundrededele (cs).

export const CS_PER_MIN = 6000;
export const CS_PER_HOUR = 360000;

const p2 = (n) => (n < 10 ? '0' : '') + n;

export function splitCs(cs) {
  cs = Math.max(0, Math.floor(cs));
  return {
    h: Math.floor(cs / CS_PER_HOUR),
    m: Math.floor(cs / CS_PER_MIN) % 60,
    s: Math.floor(cs / 100) % 60,
    hh: cs % 100,
  };
}

export function formatCs(cs) {
  const { h, m, s, hh } = splitCs(cs);
  const tail = `${p2(m)}.${p2(s)},${p2(hh)}`;
  return h > 0 ? `${h}.${tail}` : tail;
}

// De seks cifre MMSSHH (minutter regnes modulo 60, timer indgår ikke)
export function digits6(cs) {
  const { m, s, hh } = splitCs(cs);
  return p2(m) + p2(s) + p2(hh);
}

export const msToCs = (ms) => Math.floor(ms / 10 + 1e-7);
