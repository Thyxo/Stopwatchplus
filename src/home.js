// Perform mode: falsk iPhone-hjemmeskærm (dine egne skærmbilleder, 1179×2556) med skjult kort-input.
// Porteret fra Notes-appen (samme fjeder, gummibånd og åbne-animation).
//
//  Swipe side 1 → 2: ikonet under fingeren, når swipet STARTER, er værdien (1-13):
//      1 = Påmindelser (række 2, kolonne 4), 2-4 = række 3, 5-7 = række 4, 8-10 = række 5, 11-13 = række 6
//      (kolonne 2-4, fra toppen og ned).
//  Swipe side 2 → 3: rækken under fingeren er kuløren (CHSD):
//      række 3 = ♣ klør, række 4 = ♥ hjerter, række 5 = ♠ spar, række 6 = ♦ ruder.
//  Tryk på Ur på side 3 → stopuret "åbner" ud af ikonet med kortet valgt.

const HOME_W = 1179;
const HOME_ICON = 225;
const HOME_DOCK_TOP = 2140;
const ICON_COLS = [58, 337, 618, 897];
const ICON_ROWS = [245, 524, 803, 1082, 1361, 1640];
const OCCUPIED = [
  ['1111', '1111', '1111', '1111', '1111', '1111'],
  ['1111', '1111', '1111', '1111', '1111', '1111'],
  ['1111', '1110', '0000', '1111', '1111', '1111'],
];
// [række, kolonne] (0-baseret) → værdi 1-13 på side 1
export const VALUE_CELLS = {
  '1,3': 1,
  '2,1': 2, '2,2': 3, '2,3': 4,
  '3,1': 5, '3,2': 6, '3,3': 7,
  '4,1': 8, '4,2': 9, '4,3': 10,
  '5,1': 11, '5,2': 12, '5,3': 13,
};
// række → kulør på side 2 (CHSD)
export const SUIT_ROWS = { 2: 'C', 3: 'H', 4: 'S', 5: 'D' };
const UR_CELL = { page: 2, row: 1, col: 2 };
const VALUES = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];

// Værdi (1-13) + kulør → kort, fx (7, 'H') → '7H'
export function cardFromInput(value, suit, fallback) {
  const fb = fallback || 'AS';
  const v = value ? VALUES[value - 1] : fb.slice(0, -1);
  const s = suit || fb.slice(-1);
  return v + s;
}

const SPRING_RESPONSE = 0.28;
const SPRING_DAMPING = 1;

export function initHome({ app, onLaunch }) {
  const home = document.querySelector('#home');
  const stage = document.querySelector('#homeStage');
  const track = document.querySelector('#homeTrack');
  const press = document.querySelector('#homePress');
  const dots = [...document.querySelectorAll('#homeDots img')];
  const linear = window.CSS?.supports?.('animation-timing-function', 'linear(0, 1)') ?? false;

  let page = 0;
  let input = [null, null]; // [værdi, kulør]
  let drag = null;
  let offset = 0;
  let anim = null;

  const scale = () => stage.getBoundingClientRect().width / HOME_W;

  function cellAt(clientX, clientY) {
    const r = stage.getBoundingClientRect();
    const k = r.width / HOME_W;
    const x = (clientX - r.left) / k;
    const y = (clientY - r.top) / k;
    const half = (ICON_COLS[1] - ICON_COLS[0]) / 2;
    const col = ICON_COLS.findIndex((l) => Math.abs(x - (l + HOME_ICON / 2)) <= half);
    const row = ICON_ROWS.findIndex((t) => Math.abs(y - (t + HOME_ICON / 2)) <= half);
    if (col < 0 || row < 0) return null;
    return { row, col };
  }

  function render(px) {
    offset = px;
    track.style.transform = `translate3d(${px}px, 0, 0)`;
  }
  const readOffset = () => new DOMMatrixReadOnly(getComputedStyle(track).transform).m41;
  const currentOffset = () => (anim ? readOffset() : offset);
  function stopAnim() {
    if (!anim) return;
    const n = readOffset();
    anim.stop();
    anim = null;
    render(n);
  }
  function setOffset(px) { stopAnim(); track.style.transition = 'none'; render(px); }

  function springSamples(from, to, velocity) {
    const k = (2 * Math.PI / SPRING_RESPONSE) ** 2;
    const c = (4 * Math.PI * SPRING_DAMPING) / SPRING_RESPONSE;
    const h = 1 / 960;
    const every = 8;
    let x = from;
    let v = velocity * 1000;
    const samples = [x];
    for (let i = 1; i < 960 * 1.5; i += 1) {
      v += (-k * (x - to) - c * v) * h;
      x += v * h;
      if (i % every === 0) {
        samples.push(x);
        if (Math.abs(x - to) < 0.2 && Math.abs(v) < 6) break;
      }
    }
    samples.push(to);
    return { samples, duration: ((samples.length - 1) * every * 1000) / 960 };
  }

  function animateTo(to, velocity) {
    stopAnim();
    track.style.transition = 'none';
    const from = offset;
    if (Math.abs(to - from) < 0.5) { render(to); return; }
    const { samples, duration } = springSamples(from, to, velocity);
    if (linear && track.animate) {
      const points = samples.map((x) => ((x - from) / (to - from)).toFixed(4)).join(', ');
      render(to);
      const a = track.animate(
        [{ transform: `translate3d(${from}px, 0, 0)` }, { transform: `translate3d(${to}px, 0, 0)` }],
        { duration, easing: `linear(${points})` },
      );
      const entry = { stop: () => a.cancel() };
      anim = entry;
      a.onfinish = () => { if (anim === entry) anim = null; };
      return;
    }
    const start = performance.now();
    let raf = 0;
    let alive = true;
    const step = (t) => {
      if (!alive) return;
      const i = Math.min(samples.length - 1, Math.floor(((t - start) / duration) * (samples.length - 1)));
      render(samples[i]);
      if (i >= samples.length - 1) { alive = false; anim = null; return; }
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    const fb = setTimeout(() => { if (!alive) return; alive = false; cancelAnimationFrame(raf); render(to); anim = null; }, duration + 300);
    anim = { stop() { alive = false; cancelAnimationFrame(raf); clearTimeout(fb); } };
  }

  const setDot = (i) => dots.forEach((d, k) => d.classList.toggle('on', k === i));

  function showPress(cell) {
    if (!cell || OCCUPIED[page][cell.row][cell.col] !== '1') return;
    press.style.left = `${(ICON_COLS[cell.col] / HOME_W) * 100}%`;
    press.style.top = `${((ICON_ROWS[cell.row] - 140) / 1900) * 100}%`;
    press.classList.add('on');
  }

  function rubberBand(position, width) {
    const min = -2 * width;
    const band = (over) => (1 - 1 / ((over * 0.55) / width + 1)) * width;
    if (position > 0) return band(position);
    if (position < min) return min - band(min - position);
    return position;
  }

  function velocityOf(d, releaseTime) {
    const s = d.samples;
    const last = s[s.length - 1];
    if (releaseTime - last.t > 150) return 0;
    let first = s[0];
    for (const p of s) { if (last.t - p.t <= 100) { first = p; break; } }
    const dt = last.t - first.t;
    return dt > 0 ? (last.x - first.x) / dt : 0;
  }

  function down(e) {
    if (drag || !e.isPrimary) return;
    const cell = cellAt(e.clientX, e.clientY);
    const width = stage.getBoundingClientRect().width;
    const grabbed = currentOffset();
    stopAnim();
    track.style.transition = 'none';
    render(grabbed);
    const startPage = Math.max(0, Math.min(2, Math.round(-grabbed / width)));
    drag = {
      id: e.pointerId, startX: e.clientX, startY: e.clientY, startOffset: grabbed, startPage,
      samples: [{ x: e.clientX, t: e.timeStamp }], lock: null, width, cell,
    };
    try { stage.setPointerCapture(e.pointerId); } catch { /* ignorer */ }
    page = startPage;
    showPress(cell);
  }

  function move(e) {
    const d = drag;
    if (!d || e.pointerId !== d.id) return;
    const dx = e.clientX - d.startX;
    const dy = e.clientY - d.startY;
    if (!d.lock && Math.hypot(dx, dy) > 8) {
      d.lock = Math.abs(dx) > Math.abs(dy) ? 'x' : 'y';
      press.classList.remove('on');
    }
    if (d.lock !== 'x') return;
    d.samples.push({ x: e.clientX, t: e.timeStamp });
    if (d.samples.length > 12) d.samples.shift();
    const pos = rubberBand(d.startOffset + dx, d.width);
    render(pos);
    setDot(Math.max(0, Math.min(2, Math.round(-pos / d.width))));
  }

  function up(e) {
    const d = drag;
    if (!d || e.pointerId !== d.id) return;
    drag = null;
    press.classList.remove('on');
    if (d.lock === 'x') {
      if (e.clientX !== d.samples[d.samples.length - 1].x) d.samples.push({ x: e.clientX, t: e.timeStamp });
      const v = velocityOf(d, e.timeStamp);
      const pos = offset;
      let target = Math.round(-pos / d.width);
      if (v < -0.3) target = Math.floor(-pos / d.width) + 1;
      else if (v > 0.3) target = Math.ceil(-pos / d.width) - 1;
      target = Math.max(0, Math.min(2, Math.max(d.startPage - 1, Math.min(d.startPage + 1, target))));
      // Swipe fremad registrerer ikonet/rækken under fingeren, hvor swipet startede
      if (target === d.startPage + 1 && d.cell) {
        if (d.startPage === 0) input[0] = VALUE_CELLS[`${d.cell.row},${d.cell.col}`] ?? input[0];
        if (d.startPage === 1) input[1] = SUIT_ROWS[d.cell.row] ?? input[1];
      }
      page = target;
      setDot(page);
      animateTo(-page * d.width, v);
      return;
    }
    if (Math.abs(offset + d.startPage * d.width) > 0.5) {
      page = d.startPage;
      setDot(page);
      animateTo(-page * d.width, 0);
      return;
    }
    if (d.lock === null && e.type === 'pointerup') {
      const cell = cellAt(e.clientX, e.clientY);
      if (cell && page === UR_CELL.page && cell.row === UR_CELL.row && cell.col === UR_CELL.col) launch();
    }
  }

  function cancel(e) {
    if (!drag || e.pointerId !== drag.id) return;
    const w = drag.width;
    drag = null;
    press.classList.remove('on');
    setDot(page);
    animateTo(-page * w, 0);
  }

  function enter() {
    page = 0;
    input = [null, null];
    drag = null;
    stage.style.transition = 'none';
    stage.style.transform = '';
    stage.style.opacity = '';
    home.classList.add('on');
    home.setAttribute('aria-hidden', 'false');
    setOffset(0);
    setDot(0);
  }

  function exit() {
    home.classList.remove('on');
    home.setAttribute('aria-hidden', 'true');
    press.classList.remove('on');
  }

  function launch() {
    onLaunch({ value: input[0], suit: input[1] });
    const W = app.offsetWidth;
    const H = app.offsetHeight;
    const k = scale();
    const sr = stage.getBoundingClientRect();
    const size = HOME_ICON * k;
    const iconLeft = sr.left + ICON_COLS[UR_CELL.col] * k;
    const iconTop = sr.top + ICON_ROWS[UR_CELL.row] * k;
    const s = size / W;
    const a = (H - W) / 2;
    const radius = (size * 0.23) / s;

    const icon = document.createElement('div');
    icon.className = 'launch-icon';
    icon.style.top = `${a}px`;
    icon.style.width = `${W}px`;
    icon.style.height = `${W}px`;
    app.appendChild(icon);

    app.classList.add('launching');
    app.style.transition = 'none';
    app.style.left = '0';
    app.style.transformOrigin = '0 0';
    app.style.transform = `translate3d(${iconLeft}px, ${iconTop - a * s}px, 0) scale(${s})`;
    app.style.clipPath = `inset(${a}px 0 ${H - a - W}px 0 round ${radius}px)`;
    app.style.webkitClipPath = app.style.clipPath;
    app.getBoundingClientRect();

    const ease = 'cubic-bezier(0.2, 0.85, 0.25, 1)';
    app.style.transition = `transform 520ms ${ease}, clip-path 520ms ${ease}, -webkit-clip-path 520ms ${ease}`;
    app.style.transform = 'translate3d(0, 0, 0) scale(1)';
    app.style.clipPath = 'inset(0 0 0 0 round 0px)';
    app.style.webkitClipPath = app.style.clipPath;
    icon.style.transition = 'opacity 200ms ease-out';
    icon.getBoundingClientRect();
    icon.style.opacity = '0';
    stage.style.transition = `transform 520ms ${ease}, opacity 520ms ease`;
    stage.style.transform = 'scale(1.12)';
    stage.style.opacity = '0.4';

    setTimeout(() => {
      icon.remove();
      app.classList.remove('launching');
      for (const p of ['transition', 'transform', 'transformOrigin', 'clipPath', 'webkitClipPath', 'left']) app.style[p] = '';
      exit();
    }, 560);
  }

  stage.addEventListener('pointerdown', down);
  stage.addEventListener('pointermove', move);
  stage.addEventListener('pointerup', up);
  stage.addEventListener('pointercancel', cancel);
  home.addEventListener('contextmenu', (e) => e.preventDefault());

  return { enter, exit, isOn: () => home.classList.contains('on') };
}
