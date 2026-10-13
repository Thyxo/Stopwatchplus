// UI for Ur-stopuret: tegning, knapper, swipe, faner, hemmeligt panel og panik.
import { Stopwatch, ForceEngine } from './engine.js';
import { buildPlan, listLines } from './targets.js';
import { loadSettings, saveSettings, engineOptions } from './settings.js';
import { formatCs, msToCs } from './format.js';
import { buildDial } from './dial.js';
import {
  BUILTIN, ensureRoutines, findRoutine, storeActive, selectRoutine, newRoutine, duplicateRoutine,
  renameRoutine, deleteRoutine, moveRoutine, restoreBuiltins,
} from './routines.js';
import { STACKS, SUITS, VALUES, prettyCard, stackCards, cardPosition } from './stacks.js';

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const now = () => performance.now();

const STATE_KEY = 'ur-stopur-tilstand-v1';
const settings = ensureRoutines(loadSettings());

// Ærlige forsøg: tælles fra panelet sidst blev lukket (eller rutinen valgt)
let runsDone = 0;
const honestLeft = () => Math.max(0, (settings.honestRuns | 0) - runsDone);

const engine = new ForceEngine({
  getPlan: () => buildPlan(settings, new Date()),
  getOptions: () => ({ ...engineOptions(settings), active: settings.active && honestLeft() === 0 }),
});
engine.onLog = () => { if (!secret.hidden) renderLog(); };
const sw = new Stopwatch({ engine, now });

// ---------- elementer ----------
const app = $('#app');
const big = $('#big');
const mini = $('#mini');
const pages = $('#pages');
const dots = $$('#dots i');
const btnLeft = $('#btnLeft');
const btnRight = $('#btnRight');
const lapList = $('#lapList');
const lapsBox = $('#laps');
const secret = $('#secret');
const indicator = $('#indicator');
const updateDial = buildDial($('#dial'));

let page = 0; // 0 = digital, 1 = analog
let lastRun = null; // sidste forløb før Nulstil (hold-peek)
let tab = 'stopwatch';

// ---------- gem / gendan ----------
function saveState() {
  try {
    localStorage.setItem(STATE_KEY, JSON.stringify({ sw: sw.serialize(now(), Date.now()), page, tab }));
  } catch { /* privat tilstand */ }
}

function loadState() {
  try {
    const raw = localStorage.getItem(STATE_KEY);
    if (!raw) return;
    const s = JSON.parse(raw);
    sw.restore(s.sw, now(), Date.now());
    page = s.page === 1 ? 1 : 0;
    tab = ['world', 'alarms', 'stopwatch', 'timers'].includes(s.tab) ? s.tab : 'stopwatch';
  } catch { /* ignorer */ }
}

// ---------- tegning ----------
let lastBig = '';
let lastLap = '';
let curLapEl = null;

// Tallene skaleres, så "00.00,00" får samme bredde som på iPhonen (348,5 pt af 393 / 90,6 pt
// af urskivens 346). Med San Francisco giver det ca. 90 pt – andre skrifter rammer samme bredde.
// Fra 1 time bliver teksten længere og krymper, så den passer i bredden (som på iPhone).
function fitText(el, refWidth, maxWidth) {
  el.style.fontSize = '';
  const base = parseFloat(getComputedStyle(el).fontSize);
  const probe = document.createElement('span');
  probe.className = el.className;
  probe.style.cssText = 'position:absolute;visibility:hidden;left:-9999px;right:auto;top:0;width:auto;display:inline-block;transform:none;white-space:nowrap';
  probe.textContent = '00.00,00';
  el.parentNode.appendChild(probe);
  const ref = probe.getBoundingClientRect().width;
  probe.textContent = el.textContent;
  const cur = probe.getBoundingClientRect().width;
  probe.remove();
  if (!ref) return;
  let size = (base * refWidth) / ref;
  const w = (cur * size) / base;
  if (w > maxWidth) size *= maxWidth / w;
  el.style.fontSize = size.toFixed(2) + 'px';
}

function fitBig() {
  const W = app.clientWidth;
  fitText(big, (348.5 / 393) * W, W - 40);
  const D = W - 47;
  fitText(mini, (90.6 / 346) * D, D * 0.62);
}

function render(t = now()) {
  if (peeking) return;
  const ms = sw.displayMs(t);
  const total = msToCs(ms);
  const sum = sw.sumLaps();
  const text = formatCs(total);
  if (text !== lastBig) {
    const relayout = text.length !== lastBig.length;
    big.textContent = text;
    mini.textContent = text;
    lastBig = text;
    if (relayout) fitBig();
  }
  if (curLapEl) {
    const lt = formatCs(Math.max(0, total - sum));
    if (lt !== lastLap) { curLapEl.textContent = lt; lastLap = lt; }
  }
  if (page === 1 || pagesMoving) updateDial(ms, ms - sum * 10, sw.laps.length > 0);
}

let raf = 0;
function loop() {
  raf = 0;
  const t = now();
  render(t);
  if (sw.isAnimating(t) || pagesMoving) raf = requestAnimationFrame(loop);
}
function kick() {
  render();
  if (!raf && (sw.isAnimating() || pagesMoving)) raf = requestAnimationFrame(loop);
}

function updateButtons() {
  const st = sw.state;
  btnRight.classList.toggle('start', st !== 'running');
  btnRight.classList.toggle('stop', st === 'running');
  $('#btnRightLabel').textContent = st === 'running' ? 'Stop' : 'Start';
  btnLeft.disabled = st === 'idle';
  $('#btnLeftLabel').textContent = st === 'stopped' ? 'Nulstil' : 'Runde';
}

function buildLaps() {
  lapList.textContent = '';
  curLapEl = null;
  lastLap = '';
  if (sw.state === 'idle') return;
  const laps = sw.laps;
  let best = -1;
  let worst = -1;
  if (laps.length >= 2) {
    best = 0;
    worst = 0;
    laps.forEach((v, i) => {
      if (v < laps[best]) best = i;
      if (v > laps[worst]) worst = i;
    });
    if (laps[best] === laps[worst]) best = worst = -1;
  }
  const frag = document.createDocumentFragment();
  const row = (n, value, cls) => {
    const d = document.createElement('div');
    d.className = 'lap' + (cls ? ' ' + cls : '');
    const a = document.createElement('span');
    a.textContent = `Runde ${n}`;
    const b = document.createElement('span');
    b.textContent = value;
    d.append(a, b);
    frag.appendChild(d);
    return b;
  };
  curLapEl = row(laps.length + 1, formatCs(sw.currentLapCs(now())), '');
  for (let i = laps.length - 1; i >= 0; i--) {
    row(i + 1, formatCs(laps[i]), i === best ? 'best' : i === worst ? 'worst' : '');
  }
  lapList.appendChild(frag);
}

// ---------- knapper ----------
function press(btn, fn) {
  const down = (e) => {
    if (e.button > 0 || btn.disabled) return;
    e.preventDefault();
    btn.classList.add('down');
    fn();
  };
  const up = () => btn.classList.remove('down');
  btn.addEventListener('pointerdown', down);
  btn.addEventListener('pointerup', up);
  btn.addEventListener('pointercancel', up);
  btn.addEventListener('pointerleave', up);
  btn.addEventListener('click', (e) => { if (e.detail === 0 && !btn.disabled) fn(); }); // tastatur
  btn.addEventListener('contextmenu', (e) => e.preventDefault());
}

function onRight() {
  const t = now();
  if (sw.state === 'running') sw.stop(t, { analog: page === 1 });
  else sw.start(t);
  afterAction();
}

function onLeft() {
  const t = now();
  if (sw.state === 'running') {
    sw.lap(t, { analog: page === 1 });
    lapsBox.scrollTop = 0;
  } else if (sw.state === 'stopped') {
    lastRun = { total: sw.totalCs(t), laps: sw.laps.slice() }; // til hold-peek
    const res = sw.reset();
    runsDone++;
    if (res && res.hadHits && settings.mode === 'list' && settings.list.advance) {
      settings.list.index = (settings.list.index | 0) + 1;
    }
    if (res && res.hadHits && settings.once) settings.active = false; // kun én gang
    storeActive(settings);
    saveSettings(settings);
    syncIndicator();
  }
  afterAction();
}

function afterAction() {
  updateButtons();
  buildLaps();
  render();
  kick();
  saveState();
}

press(btnRight, onRight);
press(btnLeft, onLeft);

// ---------- digital / analog (swipe) ----------
let pagesMoving = false;
let moveTimer = 0;
pages.addEventListener('scroll', () => {
  const w = pages.clientWidth || 1;
  const idx = Math.round(pages.scrollLeft / w);
  pagesMoving = true;
  clearTimeout(moveTimer);
  moveTimer = setTimeout(() => { pagesMoving = false; }, 160);
  if (idx !== page) {
    page = idx;
    dots.forEach((d, i) => d.classList.toggle('on', i === page));
    saveState();
  }
  kick();
}, { passive: true });

$('#dots').addEventListener('click', () => {
  pages.scrollTo({ left: (page === 0 ? 1 : 0) * pages.clientWidth, behavior: 'smooth' });
});

function setPage(i) {
  page = i;
  pages.scrollLeft = i * pages.clientWidth;
  dots.forEach((d, k) => d.classList.toggle('on', k === page));
}

// ---------- faner ----------
const pill = $('#tabPill');
const tabbar = $('#tabbar');
const tabBtns = $$('.tab');
const pillWidth = (btn) => Math.max(btn.querySelector('span').getBoundingClientRect().width, 22.6) + 50;

function placePill(animate) {
  const btn = $(`.tab[data-tab="${tab}"]`);
  if (!btn) return;
  const w = pillWidth(btn);
  const cx = btn.offsetLeft + btn.offsetWidth / 2;
  if (!animate) pill.style.transition = 'none';
  pill.style.width = w + 'px';
  pill.style.setProperty('--x', cx - w / 2 + 'px');
  if (!animate) { void pill.offsetWidth; pill.style.transition = ''; }
}

function setTab(name, animate = true) {
  if (tab === 'timers' && name !== 'timers') readTimerCard();
  tab = name;
  app.dataset.tab = name;
  tabBtns.forEach((b) => b.classList.toggle('on', b.dataset.tab === name));
  $$('.screen').forEach((s) => { s.hidden = s.dataset.screen !== name; });
  placePill(animate);
  if (name === 'stopwatch') { setPage(page); kick(); }
  if (name === 'world') tickWorld();
  if (name === 'timers' && !wheelsReady) { wheelsReady = true; initWheels(); }
  saveState();
}

// Liquid Glass: tryk gør bjælken lidt større og pillen til en glaslinse,
// som følger fingeren, hvis man trækker – og lander på nærmeste fane.
function nearestTab(clientX) {
  let best = tabBtns[0];
  let bd = Infinity;
  for (const b of tabBtns) {
    const r = b.getBoundingClientRect();
    const d = Math.abs(clientX - (r.left + r.width / 2));
    if (d < bd) { bd = d; best = b; }
  }
  return best;
}
let drag = null;
function moveLens(clientX) {
  const r = tabbar.getBoundingClientRect();
  const w = parseFloat(pill.style.width) || 82;
  const local = Math.min(Math.max(clientX - r.left, w / 2 + 4), r.width - w / 2 - 4);
  pill.style.setProperty('--x', local - w / 2 + 'px');
  const near = nearestTab(clientX);
  tabBtns.forEach((b) => b.classList.toggle('on', b === near));
}
tabbar.addEventListener('pointerdown', (e) => {
  if (e.button > 0) return;
  drag = { id: e.pointerId, x0: e.clientX, moved: false };
  try { tabbar.setPointerCapture(e.pointerId); } catch { /* ignorer */ }
  tabbar.classList.add('press');
  pill.classList.add('lens');
});
tabbar.addEventListener('pointermove', (e) => {
  if (!drag || e.pointerId !== drag.id) return;
  if (!drag.moved && Math.abs(e.clientX - drag.x0) < 6) return;
  drag.moved = true;
  pill.classList.add('drag');
  pill.style.width = pillWidth(nearestTab(e.clientX)) + 'px';
  moveLens(e.clientX);
});
function endDrag(e, cancel) {
  if (!drag || e.pointerId !== drag.id) return;
  drag = null;
  pill.classList.remove('drag');
  const target = cancel ? $(`.tab[data-tab="${tab}"]`) : nearestTab(e.clientX);
  setTab(target.dataset.tab);
  setTimeout(() => {
    tabbar.classList.remove('press');
    pill.classList.remove('lens');
  }, 260);
}
tabbar.addEventListener('pointerup', (e) => endDrag(e, false));
tabbar.addEventListener('pointercancel', (e) => endDrag(e, true));
tabBtns.forEach((b) => b.addEventListener('click', (e) => { if (e.detail === 0) setTab(b.dataset.tab); })); // tastatur

function tickWorld() {
  const d = new Date();
  $('#worldTime').textContent = `${String(d.getHours()).padStart(2, '0')}.${String(d.getMinutes()).padStart(2, '0')}`;
}
setInterval(() => { if (tab === 'world') tickWorld(); }, 5000);

$$('[data-alarm] .switch').forEach((s) => s.addEventListener('click', () => {
  const on = s.getAttribute('aria-checked') !== 'true';
  s.setAttribute('aria-checked', String(on));
  s.closest('.alarm-row').classList.toggle('off', !on);
}));

// ---------- Tidtagninger: rigtige hjul + skjult kort-input ----------
// Med Kort-tilstand og "Skjult input i Tidtagninger": stil timer = kulør (1 ♣, 2 ♥, 3 ♠, 4 ♦ – CHaSeD)
// og min. = værdi (1 = es … 11 knægt, 12 dame, 13 konge). Kortet gemmes, når du forlader fanen.
const wheels = {};
let wheelsReady = false;
$$('.wheel').forEach((w) => {
  const max = Number(w.dataset.max);
  for (let i = 0; i <= max; i++) {
    const it = document.createElement('i');
    it.textContent = i;
    w.appendChild(it);
  }
  const mark = () => {
    const idx = Math.max(0, Math.min(max, Math.round(w.scrollTop / 34)));
    if (w._idx === idx) return;
    w._idx = idx;
    [...w.children].forEach((c, i) => c.classList.toggle('on', i === idx));
  };
  w.addEventListener('scroll', mark, { passive: true });
  w._set = (v) => { w.scrollTop = v * 34; mark(); };
  w._get = () => Math.max(0, Math.min(max, Math.round(w.scrollTop / 34)));
  wheels[w.dataset.wheel] = w;
});
function initWheels() {
  wheels.h._set(0); wheels.m._set(15); wheels.s._set(0);
}
function readTimerCard() {
  if (settings.mode !== 'card' || !settings.card.timerInput) return;
  const suit = [null, 'C', 'H', 'S', 'D'][wheels.h._get()];
  const val = VALUES[wheels.m._get() - 1];
  if (!suit || !val) return;
  settings.card.card = val + suit;
  storeActive(settings);
  saveSettings(settings);
  engine.record({ kind: 'kort', result: 'natural', natural: null, shown: null, card: settings.card.card });
}

// ---------- hold-peek: hold fingeren på tallet efter Nulstil → se sidste stop ----------
let peekTimer = 0;
let peekStart = null;
let peeking = false;
function showPeek(on) {
  peeking = on;
  if (on && lastRun) {
    big.textContent = formatCs(lastRun.total);
    mini.textContent = big.textContent;
    lapList.textContent = '';
    const rows = [...lastRun.laps, lastRun.total - lastRun.laps.reduce((a, b) => a + b, 0)];
    for (let i = rows.length - 1; i >= 0; i--) {
      const d = document.createElement('div');
      d.className = 'lap';
      d.innerHTML = '<span></span><span></span>';
      d.firstChild.textContent = `Runde ${i + 1}`;
      d.lastChild.textContent = formatCs(rows[i]);
      lapList.appendChild(d);
    }
    fitBig();
  } else {
    lastBig = '';
    buildLaps();
    render();
  }
}
pages.addEventListener('pointerdown', (e) => {
  if (!settings.peekHold || sw.state !== 'idle' || !lastRun) return;
  peekStart = { x: e.clientX, y: e.clientY };
  clearTimeout(peekTimer);
  peekTimer = setTimeout(() => showPeek(true), 450);
});
const endPeek = () => { clearTimeout(peekTimer); peekStart = null; if (peeking) showPeek(false); };
pages.addEventListener('pointerup', endPeek);
pages.addEventListener('pointercancel', endPeek);
pages.addEventListener('pointermove', (e) => {
  if (peekStart && !peeking && Math.hypot(e.clientX - peekStart.x, e.clientY - peekStart.y) > 10) endPeek();
});

// ---------- skjulte gestusser ----------
let safeTop = 20;
function measureSafeTop() {
  const p = document.createElement('div');
  p.style.cssText = 'position:fixed;top:0;height:var(--safe-top);width:1px;visibility:hidden';
  document.body.appendChild(p);
  safeTop = p.getBoundingClientRect().height || 20;
  p.remove();
}

let taps = [];
let panicTimer = 0;
let panicStart = null;
document.addEventListener('pointerdown', (e) => {
  if (!secret.hidden) return;
  const r = app.getBoundingClientRect();
  const x = e.clientX - r.left;
  const y = e.clientY - r.top;
  const zoneY = safeTop + 70;
  if (y > zoneY) return;
  if (x > r.width - 100) {
    // 5 hurtige tryk øverst til højre → panel
    const t = now();
    taps = taps.filter((v) => t - v < 2500);
    taps.push(t);
    if (taps.length >= 5) { taps = []; openSecret(); }
  } else if (x < 100) {
    // hold øverst til venstre i ~1 sek. → panik
    panicStart = { x: e.clientX, y: e.clientY };
    clearTimeout(panicTimer);
    panicTimer = setTimeout(() => { panicStart = null; panic(); }, 900);
  }
}, true);
const cancelPanic = () => { clearTimeout(panicTimer); panicStart = null; };
document.addEventListener('pointerup', cancelPanic, true);
document.addEventListener('pointercancel', cancelPanic, true);
document.addEventListener('pointermove', (e) => {
  if (panicStart && Math.hypot(e.clientX - panicStart.x, e.clientY - panicStart.y) > 14) cancelPanic();
}, true);

function panic() {
  settings.active = false;
  saveSettings(settings);
  engine.record({ kind: 'panik', result: 'natural', natural: null, shown: null });
  syncIndicator();
  if (!secret.hidden) syncPanel();
}

function syncIndicator() {
  const plan = buildPlan(settings, new Date());
  indicator.hidden = !(settings.indicator && settings.active && !plan.error);
}

// ---------- hemmeligt panel ----------
const getPath = (path) => path.split('.').reduce((o, k) => (o ? o[k] : undefined), settings);
function setPath(path, v) {
  const keys = path.split('.');
  const last = keys.pop();
  const obj = keys.reduce((o, k) => o[k], settings);
  obj[last] = v;
}

function openSecret() {
  syncPanel();
  secret.classList.remove('out');
  secret.hidden = false;
  $('#sheetScroll').scrollTop = 0;
}

function closeSecret() {
  if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
  runsDone = 0; // ærlige forsøg tælles fra nu
  editMode = false;
  secret.classList.add('out');
  setTimeout(() => {
    secret.hidden = true;
    secret.classList.remove('out');
    $('#selftestOut').hidden = true;
    $('#selftestOut').textContent = '';
  }, 220);
  syncIndicator();
}
$('#secretDone').addEventListener('click', closeSecret);

function syncPanel() {
  $$('[data-s]', secret).forEach((el) => {
    const v = getPath(el.dataset.s);
    if (el.type === 'checkbox') el.checked = !!v;
    else if (document.activeElement !== el) el.value = v ?? '';
  });
  $$('[data-seg]', secret).forEach((seg) => {
    const v = String(getPath(seg.dataset.seg));
    $$('button', seg).forEach((b) => b.classList.toggle('on', b.dataset.v === v));
  });
  $$('.mode-box', secret).forEach((b) => { b.hidden = b.dataset.mode !== settings.mode; });
  $$('[data-show]', secret).forEach((b) => {
    const [p, v] = b.dataset.show.split('=');
    b.hidden = String(getPath(p)) !== v;
  });
  renderPlan();
  renderLog();
  renderRoutines();
  showPane(ptab);
  measureSafeTop();
  const st = document.createElement('div');
  st.style.cssText = 'position:fixed;top:env(safe-area-inset-top);bottom:env(safe-area-inset-bottom)';
  document.body.appendChild(st);
  const cs = getComputedStyle(st);
  $('#screenInfo').textContent = `Skærm ${innerWidth}×${innerHeight} (${screen.width}×${screen.height}), safe ${parseFloat(cs.top) || 0}/${parseFloat(cs.bottom) || 0}, ${isStandalone() ? 'hjemmeskærm' : 'browser'}${heightFixed ? ', højde rettet' : ''}`;
  st.remove();
}

function renderPlan() {
  const plan = buildPlan(settings, new Date());
  const box = $('#planLine');
  box.textContent = '';
  const line = (txt, cls) => {
    const d = document.createElement('div');
    d.textContent = txt;
    if (cls) d.className = cls;
    box.appendChild(d);
  };
  if (!settings.active) line('Force er slået FRA – helt almindeligt stopur', 'off');
  if (plan.error) line(plan.error, 'err');
  else {
    line(plan.summary);
    const extra = [];
    if (settings.armAfter > 0) extra.push(`først efter ${settings.armAfter} s`);
    if (settings.honestRuns > 0) extra.push(`ærlige forsøg tilbage: ${honestLeft()}`);
    if (settings.once) extra.push('kun én gang');
    if (settings.blind) extra.push('blind');
    if (extra.length) line(extra.join(' · '), 'off');
    if (plan.laps.length) line(`Næste runde: nr. ${engine.lapIndex + 1} af ${plan.laps.length}`, 'off');
    if (settings.mode === 'date' && plan.dateDigits) line(`Dato: ${plan.dateDigits.replace(/(\d\d)(\d\d)(\d\d)/, '$1-$2-$3')}`, 'off');
  }
  const last = engine.log.find((e) => e.kind === 'stop' || e.kind === 'lap');
  $('#peekLine').textContent = last
    ? `Sidst: ${last.kind === 'lap' ? `runde ${last.index + 1}` : 'stop'} ægte ${formatCs(last.natural)} → vist ${formatCs(last.shown)}`
    : '';
  if (settings.mode === 'list') {
    const n = listLines(settings.list.text).length;
    $('#listPos').textContent = n ? `${((settings.list.index | 0) % n) + 1}/${n}` : '0/0';
  }
}

function renderLog() {
  const box = $('#log');
  box.textContent = '';
  const items = engine.log.slice(0, 8);
  if (!items.length) {
    const d = document.createElement('div');
    d.className = 'cell dim';
    d.textContent = 'Ingen endnu';
    box.appendChild(d);
    return;
  }
  for (const e of items) {
    const d = document.createElement('div');
    d.className = 'cell';
    const time = new Date(e.at).toTimeString().slice(0, 8).replace(/:/g, '.');
    if (e.kind === 'kort') {
      d.textContent = `${time}  Kort valgt i Tidtagninger: ${prettyCard(e.card)}`;
      box.appendChild(d);
      continue;
    }
    const what = e.kind === 'panik' ? 'PANIK' : e.kind === 'lap' ? `Runde ${e.index + 1}` : 'Stop';
    const mark = { hit: ['✓', 'ok'], partial: ['½', 'part'], natural: ['–', 'nat'] }[e.result] || ['', ''];
    const s1 = document.createElement('span');
    s1.className = mark[1];
    s1.textContent = mark[0];
    const s2 = document.createElement('span');
    s2.textContent = e.kind === 'panik'
      ? `${time}  PANIK – force slået fra`
      : `${time}  ${what}: ægte ${formatCs(e.natural)} → vist ${formatCs(e.shown)}`;
    d.append(s1, s2);
    box.appendChild(d);
  }
}

// Hver ændring gemmes også i den valgte rutine, så rutinerne har hver sine tal
function changed(full) {
  storeActive(settings);
  saveSettings(settings);
  if (full) syncPanel(); else { renderPlan(); renderCardPos(); }
  syncIndicator();
}

secret.addEventListener('input', (e) => {
  const el = e.target.closest('[data-s]');
  if (!el) return;
  const old = getPath(el.dataset.s);
  let v = el.type === 'checkbox' ? el.checked : el.value;
  if (typeof old === 'number' && el.type !== 'checkbox') v = Number(String(v).replace(',', '.')) || 0;
  setPath(el.dataset.s, v);
  changed(false);
});
secret.addEventListener('change', (e) => {
  const el = e.target.closest('[data-s]');
  if (!el) return;
  // Felter inde i rutinelisten: tegn ikke listen om (så tryk på næste rutine ikke går tabt)
  changed(!el.closest('.rt-input'));
});
$$('[data-seg] button', secret).forEach((b) => b.addEventListener('click', () => {
  const path = b.closest('[data-seg]').dataset.seg;
  const old = getPath(path);
  setPath(path, typeof old === 'number' ? Number(b.dataset.v) : b.dataset.v);
  changed(true);
}));

// ---------- faner i panelet ----------
let ptab = 'setup';
function showPane(name) {
  ptab = name;
  $$('#ptabs button').forEach((b) => b.classList.toggle('on', b.dataset.p === name));
  $$('.pane', secret).forEach((p) => { p.hidden = p.dataset.pane !== name; });
}
$$('#ptabs button').forEach((b) => b.addEventListener('click', () => {
  showPane(b.dataset.p);
  $('#sheetScroll').scrollTop = 0;
  syncPanel();
}));

// ---------- kortvælger (ACAAN) ----------
function cardPicker() {
  const box = document.createElement('div');
  box.className = 'cards';
  const cur = settings.card.card || '';
  const suits = document.createElement('div');
  suits.className = 'card-suits';
  for (const k of ['S', 'H', 'C', 'D']) {
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = SUITS[k];
    b.className = (k === 'H' || k === 'D' ? 'red' : '') + (cur.endsWith(k) ? ' on' : '');
    b.addEventListener('click', () => {
      const v = cur ? cur.slice(0, -1) : 'A';
      settings.card.card = v + k;
      changed(true);
    });
    suits.appendChild(b);
  }
  const vals = document.createElement('div');
  vals.className = 'card-vals';
  for (const v of VALUES) {
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = v;
    b.className = cur && cur.slice(0, -1) === v ? 'on' : '';
    b.addEventListener('click', () => {
      const k = cur ? cur.slice(-1) : 'S';
      settings.card.card = v + k;
      changed(true);
    });
    vals.appendChild(b);
  }
  const res = document.createElement('div');
  res.className = 'card-res';
  box.append(suits, vals, res);
  return box;
}

function renderCardPos() {
  const c = settings.card;
  const cards = stackCards(c.stack, c.custom);
  const pos = cardPosition(c.card, cards, c.offset, c.fromBottom);
  const txt = !cards ? 'Egen stak er ugyldig (skal være 52 forskellige kort)'
    : pos ? `${prettyCard(c.card)} ligger som nr. ${pos}` : 'Vælg kort';
  $$('.card-res', secret).forEach((el) => { el.textContent = txt; });
  const sel = $('#stackSel');
  if (sel && !sel.options.length) {
    for (const [k, v] of Object.entries(STACKS)) sel.add(new Option(v.name, k));
    sel.add(new Option('Egen stak', 'custom'));
  }
}

// ---------- rutiner ----------
let editMode = false;

function routineRow(r, i, n) {
  const on = settings.routine === r.id;
  const wrap = document.createElement('div');
  wrap.className = 'rt' + (on ? ' on' : '') + (editMode ? ' edit' : '');
  const row = document.createElement('button');
  row.type = 'button';
  row.className = 'rt-row';
  const txt = document.createElement('span');
  txt.className = 'rt-text';
  const b = document.createElement('b');
  b.textContent = r.name;
  const sm = document.createElement('small');
  sm.textContent = r.desc || '';
  txt.append(b, sm);
  const chk = document.createElement('span');
  chk.className = 'rt-check';
  chk.textContent = on && !editMode ? '✓' : '';
  row.append(txt, chk);
  wrap.appendChild(row);

  if (editMode) {
    const tools = document.createElement('div');
    tools.className = 'rt-tools';
    const tool = (label, cls, fn, disabled) => {
      const t = document.createElement('button');
      t.type = 'button';
      t.textContent = label;
      if (cls) t.className = cls;
      t.disabled = !!disabled;
      t.addEventListener('click', (e) => { e.stopPropagation(); fn(); saveSettings(settings); syncPanel(); syncIndicator(); });
      tools.appendChild(t);
    };
    tool('↑', '', () => moveRoutine(settings, r.id, -1), i === 0);
    tool('↓', '', () => moveRoutine(settings, r.id, 1), i === n - 1);
    tool('Rediger', '', () => { selectRoutine(settings, r.id); runsDone = 0; editMode = false; showPane('setup'); });
    tool('Omdøb', '', () => { const nm = prompt('Nyt navn', r.name); if (nm) renameRoutine(settings, r.id, nm); });
    tool('Kopi', '', () => duplicateRoutine(settings, r.id));
    tool('Slet', 'danger', () => { if (confirm(`Slet "${r.name}"?`)) deleteRoutine(settings, r.id); });
    wrap.appendChild(tools);
  } else if (on && r.input) {
    if (r.input.type === 'card') {
      wrap.appendChild(cardPicker());
    } else {
      const lab = document.createElement('label');
      lab.className = 'rt-input';
      const sp = document.createElement('span');
      sp.textContent = r.input.label;
      const inp = document.createElement(r.input.textarea ? 'textarea' : 'input');
      inp.className = 'inp wide';
      inp.dataset.s = r.input.path;
      inp.setAttribute('inputmode', r.input.im || 'decimal');
      inp.setAttribute('autocomplete', 'off');
      inp.placeholder = r.input.ph || '';
      if (r.input.textarea) inp.rows = 3;
      inp.value = getPath(r.input.path) ?? '';
      lab.append(sp, inp);
      wrap.appendChild(lab);
    }
  }
  row.addEventListener('click', () => {
    if (editMode) return;
    if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
    selectRoutine(settings, r.id);
    runsDone = 0;
    saveSettings(settings);
    syncPanel();
    syncIndicator();
  });
  return wrap;
}

function renderRoutines() {
  const list = $('#rtList');
  if (secret.contains(document.activeElement) && document.activeElement.closest('.rt-input')) return;
  list.textContent = '';
  const all = settings.routines;
  all.forEach((r, i) => list.appendChild(routineRow(r, i, all.length)));
  if (!all.length) {
    const d = document.createElement('div');
    d.className = 'cell dim';
    d.textContent = 'Ingen rutiner';
    list.appendChild(d);
  }
  $('#rtEdit').textContent = editMode ? 'Færdig' : 'Rediger';
  const r = findRoutine(settings, settings.routine);
  $('#curRoutine').textContent = r ? r.name : 'Egen opsætning (ingen rutine valgt)';
  $('#renameCur').hidden = !r;
  $('#cardInputBox').textContent = '';
  if (settings.mode === 'card') $('#cardInputBox').appendChild(cardPicker());
  renderCardPos();
}

$('#rtEdit').addEventListener('click', () => { editMode = !editMode; renderRoutines(); });
$('#rtNew').addEventListener('click', () => {
  const name = prompt('Navn på den nye rutine (laves ud fra de nuværende indstillinger)', '');
  if (!name || !name.trim()) return;
  storeActive(settings);
  newRoutine(settings, name.trim());
  saveSettings(settings);
  syncPanel();
});
$('#rtRestore').addEventListener('click', () => {
  const n = restoreBuiltins(settings);
  saveSettings(settings);
  syncPanel();
  alert(n ? `${n} standardrutine(r) lagt tilbage` : 'Alle standardrutiner findes allerede');
});
$('#saveRoutine').addEventListener('click', () => {
  const name = prompt('Navn på rutinen', '');
  if (!name || !name.trim()) return;
  storeActive(settings);
  newRoutine(settings, name.trim());
  saveSettings(settings);
  syncPanel();
});
$('#renameCur').addEventListener('click', () => {
  const r = findRoutine(settings, settings.routine);
  if (!r) return;
  const nm = prompt('Nyt navn', r.name);
  if (nm) { renameRoutine(settings, r.id, nm); saveSettings(settings); syncPanel(); }
});
void BUILTIN;

const stepList = (d) => {
  const n = listLines(settings.list.text).length || 1;
  settings.list.index = ((((settings.list.index | 0) + d) % n) + n) % n;
  saveSettings(settings);
  renderPlan();
};
$('#listPrev').addEventListener('click', () => stepList(-1));
$('#listNext').addEventListener('click', () => stepList(1));
$('#panicBtn').addEventListener('click', () => { panic(); closeSecret(); });
$('#runSelftest').addEventListener('click', async () => {
  const out = $('#selftestOut');
  out.hidden = false;
  out.textContent = 'Kører …';
  await new Promise((r) => setTimeout(r, 30));
  const { runSelfTest, formatReport } = await import('./selftest.js');
  out.textContent = formatReport(runSelfTest({ runs: 2000, seed: Date.now() % 100000 }));
});

// ---------- højde: iOS-fejl i hjemmeskærm-apps ----------
// I standalone-tilstand kan iOS melde en sidehøjde, der er statuslinjens højde for kort.
const isStandalone = () => navigator.standalone === true || matchMedia('(display-mode: standalone)').matches;
let heightFixed = false;
function fixHeight() {
  const portrait = innerHeight > innerWidth;
  heightFixed = isStandalone() && portrait && screen.height > innerHeight + 20;
  // body er position:fixed med overflow:hidden og klipper ellers bunden (fanebjælken) væk
  for (const el of [document.body, app, secret]) {
    el.style.height = heightFixed ? screen.height + 'px' : '';
    el.style.bottom = heightFixed ? 'auto' : '';
  }
  document.documentElement.style.height = heightFixed ? screen.height + 'px' : '';
}

function onResize() {
  fixHeight();
  measureSafeTop();
  setPage(page);
  placePill(false);
  fitBig();
}
window.addEventListener('resize', onResize);
window.addEventListener('orientationchange', () => setTimeout(onResize, 300));

// ---------- diverse iOS-finesser ----------
document.addEventListener('gesturestart', (e) => e.preventDefault());
document.addEventListener('dblclick', (e) => e.preventDefault());
document.addEventListener('visibilitychange', () => {
  if (document.hidden) saveState();
  else kick();
});
window.addEventListener('pagehide', saveState);

// ---------- start ----------
loadState();
renderCardPos();
fixHeight();
measureSafeTop();
setTab(tab, false);
setPage(page);
updateButtons();
buildLaps();
syncIndicator();
render();
kick();
if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => { fitBig(); placePill(false); });

if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}
