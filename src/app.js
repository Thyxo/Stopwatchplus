// UI for Ur-stopuret: tegning, knapper, swipe, faner, hemmeligt panel og panik.
import { Stopwatch, ForceEngine } from './engine.js';
import { buildPlan, listLines } from './targets.js';
import { loadSettings, saveSettings, engineOptions } from './settings.js';
import { formatCs, msToCs } from './format.js';
import { buildDial } from './dial.js';

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const now = () => performance.now();

const STATE_KEY = 'ur-stopur-tilstand-v1';
const settings = loadSettings();

const engine = new ForceEngine({
  getPlan: () => buildPlan(settings, new Date()),
  getOptions: () => engineOptions(settings),
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
    const res = sw.reset();
    if (res && res.hadHits && settings.mode === 'list' && settings.list.advance) {
      settings.list.index = (settings.list.index | 0) + 1;
      saveSettings(settings);
    }
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
function placePill(animate) {
  const btn = $(`.tab[data-tab="${tab}"]`);
  if (!btn) return;
  const label = btn.querySelector('span');
  const w = Math.max(label.getBoundingClientRect().width, 22.6) + 50;
  const cx = btn.offsetLeft + btn.offsetWidth / 2;
  if (!animate) pill.style.transition = 'none';
  pill.style.width = w + 'px';
  pill.style.transform = `translateX(${cx - w / 2}px)`;
  if (!animate) { void pill.offsetWidth; pill.style.transition = ''; }
}

function setTab(name, animate = true) {
  tab = name;
  app.dataset.tab = name;
  $$('.tab').forEach((b) => b.classList.toggle('on', b.dataset.tab === name));
  $$('.screen').forEach((s) => { s.hidden = s.dataset.screen !== name; });
  placePill(animate);
  if (name === 'stopwatch') { setPage(page); kick(); }
  if (name === 'world') tickWorld();
  saveState();
}
$$('.tab').forEach((b) => b.addEventListener('click', () => setTab(b.dataset.tab)));

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
    if (plan.laps.length) line(`Næste runde: nr. ${engine.lapIndex + 1} af ${plan.laps.length}`, 'off');
    if (settings.mode === 'date' && plan.dateDigits) line(`Dato: ${plan.dateDigits.replace(/(\d\d)(\d\d)(\d\d)/, '$1-$2-$3')}`, 'off');
  }
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

secret.addEventListener('input', (e) => {
  const el = e.target.closest('[data-s]');
  if (!el) return;
  setPath(el.dataset.s, el.type === 'checkbox' ? el.checked : el.value);
  saveSettings(settings);
  renderPlan();
  syncIndicator();
});
secret.addEventListener('change', (e) => {
  const el = e.target.closest('[data-s]');
  if (!el) return;
  setPath(el.dataset.s, el.type === 'checkbox' ? el.checked : el.value);
  saveSettings(settings);
  syncPanel();
  syncIndicator();
});
$$('[data-seg] button', secret).forEach((b) => b.addEventListener('click', () => {
  const path = b.closest('[data-seg]').dataset.seg;
  const old = getPath(path);
  setPath(path, typeof old === 'number' ? Number(b.dataset.v) : b.dataset.v);
  saveSettings(settings);
  syncPanel();
  syncIndicator();
}));
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
  app.style.height = heightFixed ? screen.height + 'px' : '';
  app.style.bottom = heightFixed ? 'auto' : '';
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
