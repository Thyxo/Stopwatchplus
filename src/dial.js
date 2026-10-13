// Analog urskive (SVG). Alle mål i pt ved 393 pt skærmbredde – viewBox skalerer resten.
// Målt fra skærmbillederne: radius 173, 240 streger (hvert 1/4 sek.), hvide ved hvert 5. sek.,
// tal i radius 136. Lille 30-minutters skive med centrum 62,2 pt over midten.

const NS = 'http://www.w3.org/2000/svg';
const R = 173;
const SUB_Y = -62.2;

function el(name, attrs, parent) {
  const e = document.createElementNS(NS, name);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
  if (parent) parent.appendChild(e);
  return e;
}

function tick(g, cx, cy, deg, r0, r1, color, width) {
  const a = (deg * Math.PI) / 180;
  const s = Math.sin(a);
  const c = -Math.cos(a);
  el('line', {
    x1: (cx + r0 * s).toFixed(2), y1: (cy + r0 * c).toFixed(2),
    x2: (cx + r1 * s).toFixed(2), y2: (cy + r1 * c).toFixed(2),
    stroke: color, 'stroke-width': width,
  }, g);
}

function label(g, cx, cy, deg, r, text, cls, size) {
  const a = (deg * Math.PI) / 180;
  // grundlinje = midte + 0,3525 em (cifrenes højde i SF Pro er 0,705 em)
  el('text', {
    x: (cx + r * Math.sin(a)).toFixed(2),
    y: (cy - r * Math.cos(a) + size * 0.3525).toFixed(2),
    'text-anchor': 'middle',
    class: cls,
  }, g).textContent = text;
}

export function buildDial(svg) {
  svg.textContent = '';
  const face = el('g', {}, svg);
  const TICK = getComputedStyle(document.documentElement).getPropertyValue('--tick').trim() || '#4a4a4a';

  // hovedskive: 240 streger
  for (let i = 0; i < 240; i++) {
    const deg = i * 1.5;
    const major = i % 20 === 0;
    const long = i % 4 === 0;
    tick(face, 0, 0, deg, long ? R - 14 : R - 7.2, R, major ? '#fff' : TICK, 1.9);
  }
  for (let n = 1; n <= 12; n++) label(face, 0, 0, n * 30, 136, String(n * 5), 'num', 28);

  // lille skive: 30 minutter, 60 streger
  for (let i = 0; i < 60; i++) {
    const deg = i * 6;
    const major = i % 10 === 0;
    const long = i % 2 === 0;
    tick(face, 0, SUB_Y, deg, major ? 48.4 - 9 : long ? 48.4 - 8.7 : 48.4 - 5.4, 48.4, major ? '#fff' : TICK, 1.5);
  }
  for (let n = 1; n <= 6; n++) label(face, 0, SUB_Y, n * 60, 27, String(n * 5), 'snum', 15);

  // visere
  const subHand = el('g', {}, svg);
  el('line', { x1: 0, y1: SUB_Y, x2: 0, y2: SUB_Y - 46.5, stroke: 'var(--orange)', 'stroke-width': 1.8, class: 'hand' }, subHand);
  el('circle', { cx: 0, cy: SUB_Y, r: 3.6, fill: 'var(--orange)' }, svg);

  const lapHand = el('g', { visibility: 'hidden' }, svg);
  el('line', { x1: 0, y1: 34.3, x2: 0, y2: -R, stroke: 'var(--blue)', 'stroke-width': 2, class: 'hand' }, lapHand);

  const secHand = el('g', {}, svg);
  el('line', { x1: 0, y1: 34.3, x2: 0, y2: -R, stroke: 'var(--orange)', 'stroke-width': 2, class: 'hand' }, secHand);
  el('circle', { cx: 0, cy: 0, r: 3.7, fill: '#000', stroke: 'var(--orange)', 'stroke-width': 2 }, svg);

  let last = '';
  return function update(totalMs, lapMs, showLap) {
    const sec = ((totalMs / 1000) % 60) * 6;
    const min = ((totalMs / 60000) % 30) * 12;
    const lap = ((Math.max(0, lapMs) / 1000) % 60) * 6;
    const key = `${sec.toFixed(2)}|${min.toFixed(2)}|${showLap ? lap.toFixed(2) : '-'}`;
    if (key === last) return;
    last = key;
    secHand.setAttribute('transform', `rotate(${sec.toFixed(3)})`);
    subHand.setAttribute('transform', `rotate(${min.toFixed(3)} 0 ${SUB_Y})`);
    lapHand.setAttribute('visibility', showLap ? 'visible' : 'hidden');
    if (showLap) lapHand.setAttribute('transform', `rotate(${lap.toFixed(3)})`);
  };
}
