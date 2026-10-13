// Kortstakke til ACAAN. Rækkefølgen er fra toppen af bunken med bagsiden op (nr. 1 = øverste kort).
// Kort skrives som værdi + kulør: A 2-10 J Q K og S (♠) H (♥) D (♦) C (♣).

const split = (s) => s.trim().split(/\s+/);

export const STACKS = {
  mnemonica: {
    name: 'Mnemonica (Tamariz)',
    cards: split('4C 2H 7D 3C 4H 6D AS 5H 9S 2S QH 3D QC 8H 6S 5S 9H KC 2D JH 3S 8S 6H 10C 5D KD 2C 3H 8D 5C KS JD 8C 10S KH JC 7S 10H AD 4S 7H 4D AC 9C JS QD 7C QS 10D 6C AH 9D'),
  },
  aronson: {
    name: 'Aronson',
    cards: split('JS KC 5C 2H 9S AS 3H 6C 8D AC 10S 5H 2D KD 7D 8C 3S AD 7S 5S QD AH 8S 3D 7H QH 5D 7C 4H KH 4D 10D JC JH 10C JD 4S QS 10H 4C 2C 9D 6H 6D KS 3C 9H 2S 6S QC 9C 8H'),
  },
  stebbins: {
    name: 'Si Stebbins (+3, CHaSeD)',
    cards: (() => {
      const V = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
      const S = ['C', 'H', 'S', 'D'];
      return Array.from({ length: 52 }, (_, i) => V[(i * 3) % 13] + S[i % 4]);
    })(),
  },
};

export const SUITS = { S: '♠', H: '♥', D: '♦', C: '♣' };
export const VALUES = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];

// "7h", "Q♠", "10 D", "kd" → "7H", "QS", "10D", "KD" (null hvis ugyldigt)
export function parseCard(txt) {
  let t = String(txt ?? '').toUpperCase().replace(/\s+/g, '')
    .replace('♠', 'S').replace('♥', 'H').replace('♦', 'D').replace('♣', 'C')
    .replace(/^1(?=[SHDC]$)/, 'A').replace(/^E/, 'A').replace(/^KN/, 'J').replace(/^B/, 'J');
  const m = t.match(/^(A|10|[2-9]|J|Q|K|D)([SHDC])$/);
  if (!m) return null;
  return (m[1] === 'D' ? 'Q' : m[1]) + m[2];
}

export const prettyCard = (c) => (c ? c.slice(0, -1) + SUITS[c.slice(-1)] : '');

export function parseStack(text) {
  const cards = String(text ?? '').split(/[\s,;]+/).filter(Boolean).map(parseCard);
  if (cards.length !== 52 || cards.some((c) => !c) || new Set(cards).size !== 52) return null;
  return cards;
}

export function stackCards(key, customText) {
  if (key === 'custom') return parseStack(customText);
  return STACKS[key] ? STACKS[key].cards : null;
}

// Position (1-52+) for kortet i stakken; offset = ekstra kort ovenpå, fromBottom = tæl fra bunden
export function cardPosition(card, cards, offset = 0, fromBottom = false) {
  if (!cards) return null;
  const i = cards.indexOf(card);
  if (i < 0) return null;
  const p = fromBottom ? 52 - i : i + 1;
  return p + (Number(offset) || 0);
}
