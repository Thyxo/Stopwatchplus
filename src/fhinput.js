// Oversættelse af FakeHome-cifrene (to swipes på hjemmeskærmen) til tal eller kort.
// fakehome.js giver cifrene [første, andet] – hvert 0-9 eller null.

const SUIT_ORDER = ['C', 'H', 'S', 'D']; // CHaSeD: 1♣ 2♥ 3♠ 4♦
const LOW = ['10', 'A', '2', '3', '4', '5', '6', '7', '8', '9']; // andet ciffer: 0 = 10, 1 = es
const FACE = { 1: 'J', 2: 'Q', 3: 'K' };

const has = (d) => d !== null && d !== undefined;

// Cifrene som tekst, så foranstillede nuller bevares ("07"). Null hvis intet blev swipet.
export function numberFromDigits([a, b] = []) {
  if (has(a) && has(b)) return `${a}${b}`;
  if (has(a)) return `${a}`;
  if (has(b)) return `${b}`;
  return null;
}

// Kort-kode: første ciffer = kulør, andet = værdi.
//   1♣ 2♥ 3♠ 4♦ + 1=E, 2-9, 0=10      fx 3 7 → 7♠
//   5♣ 6♥ 7♠ 8♦ + 1=B, 2=D, 3=K       fx 6 2 → D♥
// Returnerer fx '7S', eller null hvis koden ikke er et kort.
export function cardFromDigits([a, b] = []) {
  if (!has(a) || !has(b)) return null;
  if (a >= 1 && a <= 4) return LOW[b] + SUIT_ORDER[a - 1];
  if (a >= 5 && a <= 8 && FACE[b]) return FACE[b] + SUIT_ORDER[a - 5];
  return null;
}
