// Input fra den falske hjemmeskærm (fakehome.js).
// Tal: FakeHome's to cifre. Kort: som den gamle kortvælger (layout B), men målt på
// din egen hjemmeskærm ud fra FakeHome's geometri (screenshot-pixels):
//   side 1 → 2: værdien – de 4 nederste ikonrækker, kolonne 2-4 = 1-12 (3 pr. række),
//               det sorte tomme felt under ikonerne = 13 (K)
//   side 2 → 3: kuløren – de 4 nederste rækker = ♣ ♥ ♠ ♦ (CHSD), hvor som helst i rækken

const has = (d) => d !== null && d !== undefined;
const VALUES = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
const SUITS = ['C', 'H', 'S', 'D'];
export const KING_VALUE = 13;

// Cifrene som tekst, så foranstillede nuller bevares ("07"). Null hvis intet blev swipet.
export function numberFromDigits([a, b] = []) {
  if (has(a) && has(b)) return `${a}${b}`;
  if (has(a)) return `${a}`;
  if (has(b)) return `${b}`;
  return null;
}

// Felt under et punkt (x, y i screenshot-pixels): { row, col } (col -1 = mellem kolonner),
// { blank: true } for det sorte felt under ikonerne, ellers null.
export function cellAt(geo, x, y) {
  const { cols, rows, icon } = geo;
  const last = rows.length - 1;
  const blankTop = rows[last] + icon + 10;
  const blankBottom = (geo.dotsTop ?? geo.H) - 5;
  if (y >= blankTop && y <= blankBottom) return { blank: true };
  const rowHalf = (rows[1] - rows[0]) / 2;
  const colHalf = (cols[1] - cols[0]) / 2;
  const row = rows.findIndex((top) => Math.abs(y - (top + icon / 2)) <= rowHalf);
  if (row < 0) return null;
  const col = cols.findIndex((left) => Math.abs(x - (left + icon / 2)) <= colHalf);
  return { row, col };
}

// Værdi 1-13 for et felt på side 1 (null hvis feltet ikke er en værdi)
export function valueAt(geo, cell) {
  if (!cell) return null;
  if (cell.blank) return KING_VALUE;
  const first = geo.rows.length - 4;
  const r = cell.row - first;
  if (r < 0 || r > 3 || cell.col < 1 || cell.col > 3) return null;
  return r * 3 + cell.col;
}

// Kulør for et felt på side 2 (hele rækken tæller)
export function suitAt(geo, cell) {
  if (!cell || cell.blank) return null;
  const r = cell.row - (geo.rows.length - 4);
  return r >= 0 && r <= 3 ? SUITS[r] : null;
}

// Værdi (1-13) + kulør → kort, fx (7, 'H') → '7H'. Manglende del tages fra fallback.
export function cardFromInput(value, suit, fallback) {
  const fb = fallback || 'AS';
  const v = value ? VALUES[value - 1] : fb.slice(0, -1);
  const s = suit || fb.slice(-1);
  return v + s;
}
