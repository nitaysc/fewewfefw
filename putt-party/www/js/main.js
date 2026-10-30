// Game flow: menu, holes, turns, bots, camera, controls and scoring.
import * as THREE from '../vendor/three.module.js';
import { COURSES } from './courses.js';
import { HoleSim, buildLayout, STEP, BALL_R } from './physics.js';
import { BotPlanner } from './bot.js';
import { createStage, applyTheme, CourseView, BallView, AimView, Confetti, HATS } from './render.js';

const $ = (s) => document.querySelector(s);
const $$ = (s) => [...document.querySelectorAll(s)];
const MAX_STROKES = 8;
const GIVE_UP_SCORE = 10;
const COLORS = ['#ffffff', '#ff4f8b', '#ffcc33', '#4fc3ff', '#2ed47a', '#8d6bff', '#ff8a3d', '#1d1530'];
const BOT_NAMES = ['רובי', 'בוטון', 'צ׳יפי'];
const HAT_ICONS = { none: '⚪', party: '🎉', tophat: '🎩', crown: '👑', cap: '🧢' };
const Plugins = (window.Capacitor && window.Capacitor.Plugins) || {};

// ---------- saved preferences ----------
const store = {
  get(k, d) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* storage unavailable */ } },
};
const prefs = Object.assign({ name: 'אני', color: '#ffffff', hat: 'party', bots: 2, skill: 'medium', course: 'candy', sound: true, best: {} }, store.get('puttParty', {}));
const savePrefs = () => store.set('puttParty', prefs);

// ---------- sound ----------
let audio;
function tone(freq, dur, type = 'sine', vol = 0.2, slide = 0) {
  if (!prefs.sound) return;
  try {
    audio = audio || new (window.AudioContext || window.webkitAudioContext)();
    const o = audio.createOscillator(), g = audio.createGain(), t = audio.currentTime;
    o.type = type; o.frequency.setValueAtTime(freq, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, freq + slide), t + dur);
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g).connect(audio.destination); o.start(t); o.stop(t + dur);
  } catch { /* no audio */ }
}
function noise(dur, vol = 0.2, freq = 1200) {
  if (!prefs.sound) return;
  try {
    audio = audio || new (window.AudioContext || window.webkitAudioContext)();
    const len = Math.floor(audio.sampleRate * dur), buf = audio.createBuffer(1, len, audio.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = audio.createBufferSource(), f = audio.createBiquadFilter(), g = audio.createGain();
    f.type = 'bandpass'; f.frequency.value = freq; g.gain.value = vol;
    src.buffer = buf; src.connect(f).connect(g).connect(audio.destination); src.start();
  } catch { /* no audio */ }
}
const sfx = {
  putt(p) { noise(0.06, 0.5, 2500); tone(180 + p * 120, 0.09, 'triangle', 0.3, -80); },
  wall(s) { tone(520 + Math.random() * 80, 0.06, 'triangle', Math.min(0.25, s * 0.05)); },
  bumper() { tone(260, 0.18, 'sine', 0.3, 520); },
  boost() { noise(0.35, 0.25, 800); tone(300, 0.3, 'sawtooth', 0.06, 600); },
  sunk() { [0, 60, 120].forEach((d, i) => setTimeout(() => tone(900 - i * 150, 0.05, 'square', 0.08), d)); setTimeout(() => tone(140, 0.25, 'sine', 0.35, -60), 170); },
  cheer() { [523, 659, 784, 1047].forEach((f, i) => setTimeout(() => tone(f, 0.22, 'triangle', 0.2), 220 + i * 110)); },
  out() { tone(500, 0.4, 'sawtooth', 0.12, -380); },
  click() { tone(1300, 0.03, 'triangle', 0.1); },
};
function buzz(ms = 30) {
  if (Plugins.Haptics) Plugins.Haptics.vibrate({ duration: ms }).catch(() => {});
  else if (navigator.vibrate) navigator.vibrate(ms);
}

// ---------- stage ----------
const stage = createStage($('#view'));
const { renderer, scene, camera } = stage;
const aim = new AimView(scene);
const confetti = new Confetti(scene);
let courseView = null;
function resize() {
  const w = window.innerWidth, h = window.innerHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.fov = w < h ? 70 : 55;
  camera.updateProjectionMatrix();
}
window.addEventListener('resize', resize);
resize();

// ---------- game state ----------
let course = COURSES[0];
let holeIdx = 0;
let layout = null, sim = null;
let players = [];
let phase = 'menu';        // menu | intro | play | holeEnd | final
let paused = false;
let fast = false;
let clock = 0, introT = 0;
let holeToken = 0;
let acc = 0;
let endTimer = null;

const cam = { yaw: 0, pitch: 0.55, dist: 5, target: new THREE.Vector3(), mode: 'follow', overview: false };
const aimState = { active: false, power: 0 };

// bot planning in a worker; falls back to the main thread if workers are unavailable
let worker = null, reqId = 0;
const pendingReq = new Map();
try {
  worker = new Worker(new URL('./worker.js', import.meta.url), { type: 'module' });
  worker.onmessage = ({ data }) => { const cb = pendingReq.get(data.req); pendingReq.delete(data.req); cb?.(data); };
  worker.onerror = () => { worker = null; };
} catch { worker = null; }
let localPlanner = null;
function planShot(from, t0, skill, cb) {
  if (worker) {
    const req = ++reqId;
    pendingReq.set(req, cb);
    worker.postMessage({ req, course: course.id, hole: holeIdx, from: { x: from.x, y: from.y, z: from.z }, t0, skill });
    return;
  }
  localPlanner = localPlanner || new BotPlanner(course.holes[holeIdx], layout);
  const gen = localPlanner.plan(from, t0, skill);
  const pump = () => { const r = gen.next(); if (r.done) cb(r.value); else setTimeout(pump, 0); };
  pump();
}

// ---------- holes ----------
function loadHole(i, { showcase = false } = {}) {
  holeIdx = i;
  holeToken++;
  localPlanner = null;
  const hole = course.holes[i];
  layout = buildLayout(hole);
  sim = new HoleSim(hole, layout);
  sim.onEvent = onSimEvent;
  if (!courseView || courseView.theme !== course.theme) {
    courseView?.clear();
    courseView = new CourseView(scene, course.theme);
  }
  applyTheme(stage, course.theme, layout);
  courseView.build(layout, hole, i);

  for (const p of players) p.view?.dispose(scene);
  if (!showcase) {
    players.forEach((p, k) => {
      p.ball = sim.addBall(p.id, (k - (players.length - 1) / 2) * 0.34);
      p.ball.player = p;
      p.view = new BallView(scene, p, k);
      p.view.sync(p.ball.body);
      p.done = false; p.plan = null; p.waiting = false; p.outAt = null;
    });
  }

  // aim the camera down the first leg of the hole
  const [sx, , sz] = layout.path[0], [nx, , nz] = layout.path[1];
  cam.yaw = -Math.atan2(nx - sx, -(nz - sz));
  cam.pitch = 0.55; cam.dist = 5;
  acc = 0;
  updateHud();
}

function startCourse() {
  const human = { id: 'me', name: prefs.name.trim() || 'אני', color: prefs.color, hat: prefs.hat, bot: false, scores: [] };
  const palette = COLORS.filter((c) => c !== prefs.color && c !== '#1d1530');
  const hats = ['tophat', 'crown', 'cap', 'party'];
  players = [human];
  for (let i = 0; i < prefs.bots; i++) {
    players.push({ id: `bot${i}`, name: BOT_NAMES[i], color: palette[(i * 2 + 1) % palette.length], hat: hats[i], bot: true, skill: prefs.skill, scores: [] });
  }
  show('hud');
  beginHole(0);
}

function beginHole(i) {
  clearTimeout(endTimer);
  phase = 'intro';
  loadHole(i);
  introT = 0;
  fast = false;
  const hole = course.holes[i];
  banner(`גומה ${i + 1} · ${hole.name}`, `פאר ${hole.par}`, 2200);
}

function finishPlayer(p, score) {
  p.done = true;
  p.scores[holeIdx] = score;
  updateHud();
  if (players.every((q) => q.done)) {
    endTimer = setTimeout(() => showHoleEnd(), 1600);
  }
}

function scoreName(strokes, par) {
  if (strokes === 1) return 'הול אין וואן!';
  const d = strokes - par;
  return d <= -2 ? 'איגל!' : d === -1 ? 'בירדי!' : d === 0 ? 'פאר' : d === 1 ? 'בוגי' : `+${d}`;
}

// ---------- physics events ----------
function onSimEvent(type, ball, strength) {
  const p = ball.player;
  if (!p) return;
  const mine = !p.bot;
  if (type === 'wall') { if (mine || strength > 2) sfx.wall(strength); }
  else if (type === 'bumper') {
    sfx.bumper();
    courseView.bumpAt(ball.body.position, clock);
    if (mine) buzz(20);
  } else if (type === 'boost') { if (mine) { sfx.boost(); buzz(25); } }
  else if (type === 'sunk') {
    sfx.sunk();
    const par = course.holes[holeIdx].par;
    const name = scoreName(ball.strokes, par);
    if (mine) {
      buzz(70);
      const great = ball.strokes <= par - 1;
      if (great) sfx.cheer();
      confetti.burst(courseView.cupPos.clone().setY(courseView.cupPos.y + 0.1), ball.strokes === 1);
      banner(name, `${ball.strokes} ${ball.strokes === 1 ? 'מכה' : 'מכות'}`, 1800);
    } else toast(`${p.name}: ${name}`);
    finishPlayer(p, ball.strokes);
  } else if (type === 'out') {
    p.outAt = clock;
    if (mine) { sfx.out(); banner('יצא מהמסלול!', '+1 מכה', 1200); buzz(50); }
  } else if (type === 'rest') {
    if (ball.strokes >= MAX_STROKES && !p.done) {
      if (mine) banner('נגמרו המכות', `${GIVE_UP_SCORE} נקודות`, 1600);
      else toast(`${p.name} נגמרו לו המכות`);
      ball.state = 'gaveup';
      p.view.root.visible = false;
      finishPlayer(p, GIVE_UP_SCORE);
    }
  }
}

// ---------- per-frame logic ----------
function human() { return players.find((p) => !p.bot); }

function updateBots() {
  for (const p of players) {
    if (!p.bot || p.done) continue;
    const b = p.ball;
    if (b.state !== 'rest') continue;
    if (!p.plan && !p.waiting) {
      p.waiting = true;
      const token = holeToken;
      const t0 = sim.t + 1.4 + Math.random() * 1.2;
      planShot(b.body.position.clone(), t0, p.skill, (shot) => {
        if (token !== holeToken) return;
        p.plan = { ...shot, t0 };
        p.waiting = false;
      });
    } else if (p.plan && sim.t >= p.plan.t0) {
      sim.shoot(b, p.plan.angle, p.plan.power);
      p.plan = null;
      updateHud();
    }
  }
}

function handleOuts() {
  for (const p of players) {
    if (p.ball?.state === 'out' && p.outAt != null && clock - p.outAt > 0.8) {
      sim.resetBall(p.ball, p.ball.lastRest);
      p.ball.strokes++;
      p.view.show();
      p.outAt = null;
      updateHud();
      if (p.ball.strokes >= MAX_STROKES) onSimEvent('rest', p.ball, 0);
    }
  }
}

function cameraFocus() {
  const me = human();
  if (cam.overview) return null;
  if (me && !me.done) return me;
  // spectate whoever is still playing
  return players.find((p) => !p.done) || me;
}

function updateCamera(dt) {
  const { w, d } = layout.bounds;
  let target, yaw = cam.yaw, pitch = cam.pitch, dist = cam.dist;
  const overview = { t: new THREE.Vector3(w / 2, 0, d / 2), pitch: 1.12, dist: Math.max(w, d) * 0.95 + 4 };
  if (phase === 'menu') {
    target = overview.t; pitch = 0.62; dist = overview.dist * 0.85; yaw = clock * 0.08;
  } else {
    const f = cameraFocus();
    if (!f) { target = overview.t; pitch = overview.pitch; dist = overview.dist; }
    else target = f.ball.state === 'sunk' ? courseView.cupPos : f.view.root.position;
    if (phase === 'intro') {
      const k = Math.min(1, introT / 2.4), e = k * k * (3 - 2 * k);
      target = overview.t.clone().lerp(target, e);
      pitch = overview.pitch + (cam.pitch - overview.pitch) * e;
      dist = overview.dist + (cam.dist - overview.dist) * e;
    }
  }
  const follow = 1 - Math.pow(0.0005, dt);
  cam.target.lerp(target, phase === 'intro' ? 1 : follow);
  const cp = Math.cos(pitch);
  camera.position.set(
    cam.target.x + Math.sin(yaw) * cp * dist,
    cam.target.y + Math.sin(pitch) * dist + 0.15,
    cam.target.z + Math.cos(yaw) * cp * dist,
  );
  camera.lookAt(cam.target.x, cam.target.y + 0.15, cam.target.z);
}

function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.05, (now - (frame.last || now)) / 1000);
  frame.last = now;
  clock += dt;
  if (!sim) return;

  if (!paused) {
    if (phase === 'intro') { introT += dt; if (introT > 2.4) phase = 'play'; }
    const mult = phase === 'play' && fast ? 3 : 1;
    acc += dt * mult;
    let n = 0;
    while (acc >= STEP && n < 40) { sim.step(); acc -= STEP; n++; }
    if (phase === 'play') { updateBots(); handleOuts(); }
  }

  for (const p of players) {
    if (!p.view || !p.ball) continue;
    if (p.ball.state === 'sunk') p.view.sink(courseView.cupPos, clock);
    else if (p.ball.state !== 'gaveup') p.view.sync(p.ball.body);
  }

  const me = human();
  if (phase === 'play' && me && aimState.active && me.ball.state === 'rest') aim.show(me.view.root.position, -cam.yaw, aimState.power, clock);
  else if (phase === 'play' && me && !me.done && me.ball.state === 'rest' && !paused) aim.show(me.view.root.position, -cam.yaw, 0.15, clock);
  else aim.hide();
  $('#pad').classList.toggle('ready', canPutt());
  $('#fastBtn').hidden = !(phase === 'play' && me?.done && players.some((p) => !p.done));
  $('#resetBtn').hidden = !(phase === 'play' && me && !me.done && me.ball.state === 'rest' && me.ball.strokes > 0);

  courseView.update(clock, sim.t);
  confetti.update(dt);
  updateCamera(dt);
  renderer.render(scene, camera);
}

function canPutt() {
  const me = human();
  return phase === 'play' && !paused && me && !me.done && me.ball.state === 'rest';
}

// ---------- controls ----------
// one finger anywhere turns the camera (and with it, your aim); two fingers zoom
const touches = new Map();
let pinch0 = 0, dist0 = 0;
const viewEl = $('#view');
viewEl.addEventListener('pointerdown', (e) => {
  viewEl.setPointerCapture(e.pointerId);
  touches.set(e.pointerId, { x: e.clientX, y: e.clientY });
  if (touches.size === 2) {
    const [a, b] = [...touches.values()];
    pinch0 = Math.hypot(a.x - b.x, a.y - b.y); dist0 = cam.dist;
  }
});
viewEl.addEventListener('pointermove', (e) => {
  const t = touches.get(e.pointerId);
  if (!t) return;
  const dx = e.clientX - t.x, dy = e.clientY - t.y;
  t.x = e.clientX; t.y = e.clientY;
  if (touches.size === 1) {
    cam.yaw -= dx * 0.0065;
    cam.pitch = Math.min(1.35, Math.max(0.12, cam.pitch + dy * 0.004));
  } else if (touches.size === 2) {
    const [a, b] = [...touches.values()];
    const d = Math.hypot(a.x - b.x, a.y - b.y);
    if (pinch0) cam.dist = Math.min(16, Math.max(2, dist0 * (pinch0 / d)));
  }
});
const endTouch = (e) => { touches.delete(e.pointerId); if (touches.size < 2) pinch0 = 0; };
viewEl.addEventListener('pointerup', endTouch);
viewEl.addEventListener('pointercancel', endTouch);
viewEl.addEventListener('wheel', (e) => { cam.dist = Math.min(16, Math.max(2, cam.dist * (1 + e.deltaY * 0.001))); }, { passive: true });

// the putt pad: pull down to charge, sideways to fine-tune the aim, let go to putt
const pad = $('#pad');
let pad0 = null;
pad.addEventListener('pointerdown', (e) => {
  if (!canPutt()) return;
  pad.setPointerCapture(e.pointerId);
  pad0 = { x: e.clientX, y: e.clientY, lastX: e.clientX };
  aimState.active = true; aimState.power = 0;
  setPower(0);
});
pad.addEventListener('pointermove', (e) => {
  if (!pad0) return;
  cam.yaw -= (e.clientX - pad0.lastX) * 0.0022;
  pad0.lastX = e.clientX;
  const p = Math.min(1, Math.max(0, (e.clientY - pad0.y) / (window.innerHeight * 0.32)));
  aimState.power = p;
  setPower(p);
});
const release = () => {
  if (!pad0) return;
  pad0 = null;
  aimState.active = false;
  const p = aimState.power;
  setPower(0);
  if (p > 0.03 && canPutt()) {
    const me = human();
    sim.shoot(me.ball, -cam.yaw, p);
    sfx.putt(p); buzz(25);
    updateHud();
  }
};
pad.addEventListener('pointerup', release);
pad.addEventListener('pointercancel', () => { pad0 = null; aimState.active = false; setPower(0); });
function setPower(p) {
  $('#powerFill').style.transform = `scaleY(${p})`;
  $('#powerFill').style.background = `hsl(${120 - p * 120} 90% 55%)`;
  $('#padLabel').textContent = p > 0 ? `${Math.round(p * 100)}%` : 'משוך ⬇';
}

$('#overviewBtn').addEventListener('click', () => { cam.overview = !cam.overview; $('#overviewBtn').classList.toggle('on', cam.overview); });
$('#fastBtn').addEventListener('click', () => { fast = !fast; $('#fastBtn').classList.toggle('on', fast); });
$('#resetBtn').addEventListener('click', () => {
  const me = human();
  if (!canPutt()) return;
  sim.resetBall(me.ball, me.ball.lastRest.clone());
  me.ball.strokes++;
  toast('הכדור הוחזר · +1');
  updateHud();
  if (me.ball.strokes >= MAX_STROKES) onSimEvent('rest', me.ball, 0);
});

// ---------- HUD and overlays ----------
function show(id) {
  for (const el of $$('.layer')) el.classList.toggle('show', el.id === id);
}
function updateHud() {
  if (!players.length || phase === 'menu') return;
  const hole = course.holes[holeIdx];
  $('#holeInfo').innerHTML = `<b>גומה ${holeIdx + 1}/${course.holes.length}</b><span>${hole.name} · פאר ${hole.par}</span>`;
  $('#chips').innerHTML = players.map((p) => {
    const st = p.done ? (p.scores[holeIdx] >= GIVE_UP_SCORE ? '✖' : '✓') : '';
    return `<span class="chip${p.done ? ' done' : ''}${p.bot ? '' : ' me'}"><i style="background:${p.color}"></i>${esc(p.name)}<b>${p.ball ? p.ball.strokes : 0}${st}</b></span>`;
  }).join('');
}
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
let bannerTimer;
function banner(title, sub = '', ms = 1500) {
  const b = $('#banner');
  b.innerHTML = `<b>${esc(title)}</b>${sub ? `<span>${esc(sub)}</span>` : ''}`;
  b.classList.remove('show'); void b.offsetWidth; b.classList.add('show');
  clearTimeout(bannerTimer);
  bannerTimer = setTimeout(() => b.classList.remove('show'), ms);
}
let toastTimer;
function toast(text) {
  const t = $('#toast');
  t.textContent = text;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 1700);
}

function scoreTable() {
  const holes = course.holes;
  const head = `<tr><th></th>${holes.map((_, i) => `<th>${i + 1}</th>`).join('')}<th>סה״כ</th></tr>`;
  const parRow = `<tr class="par"><td>פאר</td>${holes.map((h) => `<td>${h.par}</td>`).join('')}<td>${holes.reduce((s, h) => s + h.par, 0)}</td></tr>`;
  const rows = players.map((p) => {
    const total = p.scores.reduce((s, v) => s + (v || 0), 0);
    return `<tr class="${p.bot ? '' : 'me'}"><td><i style="background:${p.color}"></i>${esc(p.name)}</td>${holes.map((h, i) => {
      const v = p.scores[i];
      const cls = v == null ? '' : v === 1 ? 'ace' : v < h.par ? 'under' : v > h.par ? 'over' : '';
      return `<td class="${cls}">${v ?? ''}</td>`;
    }).join('')}<td class="tot">${total}</td></tr>`;
  }).join('');
  return `<table class="scores">${head}${parRow}${rows}</table>`;
}
const totals = () => players.map((p) => ({ p, total: p.scores.reduce((s, v) => s + (v || 0), 0) })).sort((a, b) => a.total - b.total);

function showHoleEnd() {
  phase = 'holeEnd';
  aim.hide();
  const last = holeIdx === course.holes.length - 1;
  $('#holeEndTitle').textContent = `סיום גומה ${holeIdx + 1}`;
  $('#holeEndTable').innerHTML = scoreTable();
  $('#nextHole').textContent = last ? 'לתוצאות 🏆' : 'לגומה הבאה ⛳';
  show('holeEnd');
}
$('#nextHole').addEventListener('click', () => {
  sfx.click();
  if (holeIdx === course.holes.length - 1) return showFinal();
  show('hud');
  beginHole(holeIdx + 1);
});

function showFinal() {
  phase = 'final';
  const order = totals();
  const me = human();
  const myTotal = order.find((o) => o.p === me).total;
  const prev = prefs.best[course.id];
  const record = prev == null || myTotal < prev;
  if (record) { prefs.best[course.id] = myTotal; savePrefs(); }
  const medals = ['🥇', '🥈', '🥉', '4'];
  $('#podium').innerHTML = order.map((o, i) => `
    <div class="pod${o.p === me ? ' me' : ''}" style="--i:${i}">
      <span class="medal">${medals[i]}</span>
      <i style="background:${o.p.color}"></i>
      <b>${esc(o.p.name)}</b><span>${o.total}</span>
    </div>`).join('');
  const won = order[0].p === me;
  $('#finalTitle').textContent = won ? 'ניצחת! 🎉' : `מקום ${order.findIndex((o) => o.p === me) + 1}`;
  $('#finalSub').textContent = record ? `שיא חדש במסלול: ${myTotal}` : `השיא שלך: ${prev}`;
  $('#finalTable').innerHTML = scoreTable();
  show('final');
  if (won) { sfx.cheer(); confetti.burst(cam.target.clone(), true); }
}
$('#again').addEventListener('click', () => { sfx.click(); startCourse(); });
$('#toMenu').addEventListener('click', () => { sfx.click(); goMenu(); });

// pause
$('#pauseBtn').addEventListener('click', () => { sfx.click(); paused = true; show('pause'); });
$('#resume').addEventListener('click', () => { sfx.click(); paused = false; show('hud'); });
$('#restart').addEventListener('click', () => { sfx.click(); paused = false; startCourse(); });
$('#quit').addEventListener('click', () => { sfx.click(); paused = false; goMenu(); });
$('#soundToggle').addEventListener('click', () => {
  prefs.sound = !prefs.sound; savePrefs();
  $('#soundToggle').textContent = prefs.sound ? '🔊 צלילים: פועל' : '🔇 צלילים: כבוי';
});

// ---------- menu ----------
function goMenu() {
  clearTimeout(endTimer);
  phase = 'menu';
  for (const p of players) p.view?.dispose(scene);
  players = [];
  loadHole(0, { showcase: true });
  renderMenu();
  show('menu');
}
function renderMenu() {
  $('#courseList').innerHTML = COURSES.map((c) => `
    <button class="course${c.id === prefs.course ? ' on' : ''}" data-course="${c.id}">
      <span class="ce">${c.emoji}</span><b>${esc(c.name)}</b><small>${c.holes.length} גומות${prefs.best[c.id] != null ? ` · שיא ${prefs.best[c.id]}` : ''}</small>
    </button>`).join('')
    + `<button class="course soon" disabled><span class="ce">🏴‍☠️</span><b>אי הפיראטים</b><small>בקרוב</small></button>`
    + `<button class="course soon" disabled><span class="ce">🚀</span><b>תחנת החלל</b><small>בקרוב</small></button>`;
  $$('#botSeg button').forEach((b) => b.classList.toggle('on', +b.dataset.v === prefs.bots));
  $$('#skillSeg button').forEach((b) => b.classList.toggle('on', b.dataset.v === prefs.skill));
  $('#skillRow').hidden = prefs.bots === 0;
  $('#colors').innerHTML = COLORS.map((c) => `<button class="sw${c === prefs.color ? ' on' : ''}" data-c="${c}" style="background:${c}" aria-label="צבע"></button>`).join('');
  $('#hats').innerHTML = HATS.map((h) => `<button class="hat${h === prefs.hat ? ' on' : ''}" data-h="${h}">${HAT_ICONS[h]}</button>`).join('');
  $('#nameInput').value = prefs.name;
  $('#soundToggle').textContent = prefs.sound ? '🔊 צלילים: פועל' : '🔇 צלילים: כבוי';
}
$('#menu').addEventListener('click', (e) => {
  const t = e.target.closest('button');
  if (!t) return;
  if (t.dataset.course) { prefs.course = t.dataset.course; course = COURSES.find((c) => c.id === prefs.course); loadHole(0, { showcase: true }); }
  else if (t.closest('#botSeg')) prefs.bots = +t.dataset.v;
  else if (t.closest('#skillSeg')) prefs.skill = t.dataset.v;
  else if (t.dataset.c) prefs.color = t.dataset.c;
  else if (t.dataset.h) prefs.hat = t.dataset.h;
  else if (t.id === 'play') {
    prefs.name = $('#nameInput').value.trim().slice(0, 12) || 'אני';
    savePrefs();
    sfx.click();
    course = COURSES.find((c) => c.id === prefs.course) || COURSES[0];
    startCourse();
    return;
  } else return;
  sfx.click();
  savePrefs();
  renderMenu();
});
$('#nameInput').addEventListener('change', () => { prefs.name = $('#nameInput').value.trim().slice(0, 12) || 'אני'; savePrefs(); });

// ---------- boot ----------
course = COURSES.find((c) => c.id === prefs.course) || COURSES[0];
if (Plugins.StatusBar) Plugins.StatusBar.hide().catch(() => {});
if (Plugins.App) Plugins.App.addListener('backButton', () => {
  if (phase === 'menu') Plugins.App.exitApp();
  else if (!paused && (phase === 'play' || phase === 'intro')) { paused = true; show('pause'); }
  else if (paused) { paused = false; show('hud'); }
});
document.addEventListener('visibilitychange', () => {
  if (document.hidden && (phase === 'play' || phase === 'intro')) { paused = true; show('pause'); }
});
goMenu();
requestAnimationFrame(frame);
setTimeout(() => $('#splash').classList.add('gone'), 600);

// test hook for automated checks
window.__putt = { get phase() { return phase; }, get players() { return players; }, get sim() { return sim; }, cam, aim, beginHole, showHoleEnd, startCourse };
