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
const HAT_ICONS = { none: '🚫', party: '🎉', tophat: '🎩', crown: '👑', cap: '🧢', cowboy: '🤠' };
const SKILL_NAMES = { easy: 'קל', medium: 'בינוני', hard: 'קשה' };
const Plugins = (window.Capacitor && window.Capacitor.Plugins) || {};

// ---------- saved preferences ----------
const store = {
  get(k, d) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* storage unavailable */ } },
};
const prefs = Object.assign({ name: 'אני', color: '#ffffff', hat: 'party', bots: 2, skill: 'medium', course: 'candy', sound: true, best: {}, taught: false }, store.get('puttParty', {}));
const savePrefs = () => store.set('puttParty', prefs);

// ---------- sound ----------
let audio;
function ctx() { audio = audio || new (window.AudioContext || window.webkitAudioContext)(); return audio; }
function tone(freq, dur, type = 'sine', vol = 0.2, slide = 0) {
  if (!prefs.sound) return;
  try {
    const a = ctx(), o = a.createOscillator(), g = a.createGain(), t = a.currentTime;
    o.type = type; o.frequency.setValueAtTime(freq, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, freq + slide), t + dur);
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g).connect(a.destination); o.start(t); o.stop(t + dur);
  } catch { /* no audio */ }
}
function noise(dur, vol = 0.2, freq = 1200) {
  if (!prefs.sound) return;
  try {
    const a = ctx(), len = Math.floor(a.sampleRate * dur), buf = a.createBuffer(1, len, a.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = a.createBufferSource(), f = a.createBiquadFilter(), g = a.createGain();
    f.type = 'bandpass'; f.frequency.value = freq; g.gain.value = vol;
    src.buffer = buf; src.connect(f).connect(g).connect(a.destination); src.start();
  } catch { /* no audio */ }
}
const sfx = {
  putt(p) { noise(0.05, 0.6, 3000); tone(220 + p * 140, 0.1, 'triangle', 0.35, -100); },
  wall(s) { tone(560 + Math.random() * 90, 0.06, 'triangle', Math.min(0.25, s * 0.05)); },
  bumper() { tone(240, 0.2, 'sine', 0.32, 560); },
  boost() { noise(0.4, 0.3, 700); tone(300, 0.35, 'sawtooth', 0.06, 700); },
  sunk() { [0, 55, 110].forEach((d, i) => setTimeout(() => tone(950 - i * 160, 0.05, 'square', 0.07), d)); setTimeout(() => tone(150, 0.28, 'sine', 0.38, -70), 160); },
  cheer() { [523, 659, 784, 1047, 1319].forEach((f, i) => setTimeout(() => tone(f, 0.22, 'triangle', 0.18), 200 + i * 100)); },
  out() { tone(520, 0.45, 'sawtooth', 0.12, -400); },
  click() { tone(1500, 0.03, 'triangle', 0.1); },
  tick(p) { tone(300 + p * 700, 0.02, 'square', 0.03); },
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
  camera.fov = w < h ? 68 : 50;
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
let preview = null;

const cam = { yaw: 0, pitch: 0.5, dist: 3.4, target: new THREE.Vector3(), overview: false, autoYaw: null, spin: 0, aimK: 0 };
const shot = { active: false, power: 0, angle: 0, id: null, x0: 0, y0: 0, lastTick: 0 };

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
function loadHole(i) {
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

  for (const p of players) p.view?.dispose();
  players.forEach((p, k) => {
    p.ball = sim.addBall(p.id, (k - (players.length - 1) / 2) * 0.42);
    p.ball.player = p;
    p.view = new BallView(scene, p, k);
    p.view.sync(p.ball.body, clock, false);
    p.done = false; p.plan = null; p.waiting = false; p.outAt = null; p.lastState = 'rest';
  });
  cam.pitch = 0.5; cam.dist = 3.4;
  cam.yaw = yawToward(layout.start[0], layout.start[2], 0);
  cam.autoYaw = null;
  acc = 0;
}

// the camera yaw that looks from a point toward where the ball should go next
function yawToward(x, z, skipNear = 0.9) {
  const pts = layout.path;
  const remain = new Array(pts.length).fill(0);
  for (let i = pts.length - 2; i >= 0; i--) remain[i] = remain[i + 1] + Math.hypot(pts[i + 1][0] - pts[i][0], pts[i + 1][2] - pts[i][2]);
  let best = pts.length - 1, bc = Infinity;
  pts.forEach((w, i) => { const c = Math.hypot(x - w[0], z - w[2]) + remain[i]; if (c < bc) { bc = c; best = i; } });
  if (Math.hypot(x - pts[best][0], z - pts[best][2]) < skipNear && best < pts.length - 1) best++;
  const [tx, , tz] = pts[best];
  return -Math.atan2(tx - x, -(tz - z));
}

function startCourse() {
  const human = { id: 'me', name: prefs.name.trim() || 'אני', color: prefs.color, hat: prefs.hat, bot: false, scores: [] };
  const palette = COLORS.filter((c) => c !== prefs.color && c !== '#1d1530');
  const hats = ['tophat', 'crown', 'cowboy', 'cap'];
  disposePreview();
  for (const p of players) p.view?.dispose();
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
  $('#fastBtn').classList.remove('on');
  const hole = course.holes[i];
  updateHud();
  holeCard(i + 1, hole.name, hole.par);
}

function finishPlayer(p, score) {
  p.done = true;
  p.scores[holeIdx] = score;
  updateHud();
  if (players.every((q) => q.done)) endTimer = setTimeout(() => showHoleEnd(), 1700);
}

function scoreName(strokes, par) {
  if (strokes === 1) return 'הול אין וואן!';
  const d = strokes - par;
  return d <= -2 ? 'איגל!' : d === -1 ? 'בירדי!' : d === 0 ? 'פאר' : d === 1 ? 'בוגי' : d === 2 ? 'דאבל בוגי' : `+${d}`;
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
      buzz(80);
      if (ball.strokes < par) sfx.cheer();
      confetti.burst(courseView.cupPos.clone().setY(courseView.cupPos.y + 0.1), ball.strokes === 1);
      banner(name, ball.strokes === 1 ? 'מכה אחת!' : `${ball.strokes} מכות`, ball.strokes < par ? 'gold' : '');
    } else toast(`${p.name} · ${name}`, p.color);
    finishPlayer(p, ball.strokes);
  } else if (type === 'out') {
    p.outAt = clock;
    if (mine) { sfx.out(); banner('נפל!', '+1 מכה', 'red'); buzz(50); }
  } else if (type === 'rest') {
    if (ball.strokes >= MAX_STROKES && !p.done) {
      if (mine) banner('נגמרו המכות', `${GIVE_UP_SCORE} נקודות`, 'red');
      else toast(`${p.name} · נגמרו המכות`, p.color);
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
      const t0 = sim.t + 1.3 + Math.random() * 1.2;
      planShot(b.body.position.clone(), t0, p.skill, (s) => {
        if (token !== holeToken) return;
        p.plan = { ...s, t0 };
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
  return players.find((p) => !p.done) || me;
}

const angDiff = (a, b) => Math.atan2(Math.sin(b - a), Math.cos(b - a));

function updateCamera(dt) {
  const { w, d } = layout.bounds;
  let target, yaw = cam.yaw, pitch = cam.pitch, dist = cam.dist;
  const overview = { t: new THREE.Vector3(w / 2, 0, d / 2), pitch: 1.05, dist: Math.max(w, d) * 0.9 + 4 };
  if (phase === 'menu') {
    // close-up of your ball, pushed to the left of the screen beside the menu panel
    const pv = preview.root.position;
    yaw = preview.baseYaw + Math.sin(clock * 0.35) * 0.8; pitch = 0.3; dist = 1.5;
    const right = new THREE.Vector3(Math.cos(yaw), 0, -Math.sin(yaw));
    target = pv.clone().addScaledVector(right, window.innerWidth > window.innerHeight ? 0.42 : 0).setY(pv.y + 0.12);
  } else {
    const f = cameraFocus();
    // tilt up while you pull back, so the aim arrow reads clearly
    cam.aimK += ((shot.active && shot.power > 0 ? 1 : 0) - cam.aimK) * (1 - Math.pow(0.004, dt));
    pitch += (Math.max(pitch, 0.95) - pitch) * cam.aimK;
    dist += 0.9 * cam.aimK;
    if (!f) { target = overview.t; pitch = overview.pitch; dist = overview.dist; }
    else target = f.ball.state === 'sunk' ? courseView.cupPos : f.view.root.position;
    if (phase === 'intro') {
      const k = Math.min(1, introT / 2.6), e = k * k * (3 - 2 * k);
      target = overview.t.clone().lerp(target, e);
      pitch = overview.pitch + (cam.pitch - overview.pitch) * e;
      dist = overview.dist + (cam.dist - overview.dist) * e;
      yaw = cam.yaw + (1 - e) * 0.9;
    }
  }
  if (cam.spin) { cam.yaw += cam.spin * dt * 1.8; cam.autoYaw = null; }
  if (cam.autoYaw != null && !shot.active && touches.size === 0) {
    const diff = angDiff(cam.yaw, cam.autoYaw);
    cam.yaw += diff * (1 - Math.pow(0.03, dt));
    if (Math.abs(diff) < 0.002) cam.autoYaw = null;
  }
  const follow = 1 - Math.pow(phase === 'menu' ? 0.2 : 0.0008, dt);
  cam.target.lerp(target, phase === 'intro' ? 1 : follow);
  const cp = Math.cos(pitch);
  camera.position.set(
    cam.target.x + Math.sin(yaw) * cp * dist,
    cam.target.y + Math.sin(pitch) * dist + 0.1,
    cam.target.z + Math.cos(yaw) * cp * dist,
  );
  camera.lookAt(cam.target.x, cam.target.y + 0.1, cam.target.z);
}

function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.05, (now - (frame.last || now)) / 1000);
  frame.last = now;
  clock += dt;
  if (!sim) return;

  if (!paused) {
    if (phase === 'intro') { introT += dt; if (introT > 2.6) { phase = 'play'; if (!prefs.taught) $('#teach').hidden = false; } }
    const mult = phase === 'play' && fast ? 3 : 1;
    acc += dt * mult;
    let n = 0;
    while (acc >= STEP && n < 40) { sim.step(); acc -= STEP; n++; }
    if (phase === 'play') { updateBots(); handleOuts(); }
  }

  const me = human();
  for (const p of players) {
    if (!p.view || !p.ball) continue;
    if (p.ball.state === 'sunk') p.view.sink(courseView.cupPos, clock);
    else if (p.ball.state !== 'gaveup') p.view.sync(p.ball.body, clock, p === me && canPutt() && !shot.active);
    // when your ball settles, swing the camera to face the next target
    if (p === me && p.lastState === 'moving' && p.ball.state === 'rest') {
      const pos = p.ball.body.position;
      cam.autoYaw = yawToward(pos.x, pos.z);
    }
    p.lastState = p.ball.state;
  }
  if (phase === 'menu' && preview) preview.sync(preview.fake, clock, false);

  if (me && canPutt()) aim.show(me.view.root.position, shot.active ? shot.angle : -cam.yaw, shot.power, clock, shot.active);
  else aim.hide();
  $('#fastBtn').hidden = !(phase === 'play' && me?.done && players.some((p) => !p.done));
  $('#resetBtn').hidden = !(canPutt() && me.ball.strokes > 0);

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
// One finger: when your ball is ready, drag back anywhere and let go to putt (slingshot).
// Otherwise one finger turns the camera. Two fingers always turn and zoom the camera.
const touches = new Map();
let pinch0 = 0, dist0 = 0;
const viewEl = $('#view');
const pullScale = () => Math.min(window.innerWidth, window.innerHeight) * 0.42;

viewEl.addEventListener('pointerdown', (e) => {
  viewEl.setPointerCapture(e.pointerId);
  touches.set(e.pointerId, { x: e.clientX, y: e.clientY });
  if (touches.size === 1 && canPutt()) {
    Object.assign(shot, { active: true, id: e.pointerId, x0: e.clientX, y0: e.clientY, power: 0, angle: -cam.yaw, lastTick: 0 });
    cam.autoYaw = null;
  } else if (touches.size === 2) {
    cancelShot();
    const [a, b] = [...touches.values()];
    pinch0 = Math.hypot(a.x - b.x, a.y - b.y); dist0 = cam.dist;
  }
});
viewEl.addEventListener('pointermove', (e) => {
  const t = touches.get(e.pointerId);
  if (!t) return;
  const dx = e.clientX - t.x, dy = e.clientY - t.y;
  t.x = e.clientX; t.y = e.clientY;
  if (shot.active && e.pointerId === shot.id) {
    const vx = e.clientX - shot.x0, vy = e.clientY - shot.y0, len = Math.hypot(vx, vy);
    shot.power = len < 14 ? 0 : Math.min(1, (len - 14) / pullScale());
    // the ball goes opposite to the pull; straight down on screen putts straight ahead
    if (len >= 14) shot.angle = -cam.yaw + Math.atan2(-vx, vy);
    setPower(shot.power);
    const step = Math.floor(shot.power * 10);
    if (step !== shot.lastTick) { shot.lastTick = step; sfx.tick(shot.power); }
    return;
  }
  if (touches.size === 1) {
    cam.yaw -= dx * 0.0065;
    cam.pitch = Math.min(1.3, Math.max(0.12, cam.pitch + dy * 0.004));
    cam.autoYaw = null;
  } else if (touches.size === 2) {
    const [a, b] = [...touches.values()];
    const d = Math.hypot(a.x - b.x, a.y - b.y);
    if (pinch0) cam.dist = Math.min(14, Math.max(1.6, dist0 * (pinch0 / d)));
    cam.yaw -= dx * 0.0035;
    cam.pitch = Math.min(1.3, Math.max(0.12, cam.pitch + dy * 0.002));
    cam.autoYaw = null;
  }
});
const endTouch = (e) => {
  touches.delete(e.pointerId);
  if (touches.size < 2) pinch0 = 0;
  if (shot.active && e.pointerId === shot.id) {
    const p = shot.power, a = shot.angle;
    cancelShot();
    if (p > 0.02 && canPutt()) {
      const me = human();
      sim.shoot(me.ball, a, p);
      sfx.putt(p); buzz(30);
      updateHud();
      if (!prefs.taught) { prefs.taught = true; savePrefs(); $('#teach').hidden = true; }
    }
  }
};
viewEl.addEventListener('pointerup', endTouch);
viewEl.addEventListener('pointercancel', (e) => { if (e.pointerId === shot.id) cancelShot(); touches.delete(e.pointerId); });
viewEl.addEventListener('wheel', (e) => { cam.dist = Math.min(14, Math.max(1.6, cam.dist * (1 + e.deltaY * 0.001))); }, { passive: true });

function cancelShot() { shot.active = false; shot.power = 0; shot.id = null; setPower(0); }
function setPower(p) {
  const el = $('#power');
  el.classList.toggle('show', shot.active && p > 0);
  $('#powerFill').style.transform = `scaleX(${p})`;
  $('#powerFill').style.background = `linear-gradient(90deg, #b6ff3b, hsl(${110 - p * 110} 95% 55%))`;
  $('#powerPct').textContent = `${Math.round(p * 100)}%`;
}

// hold the arrows to turn the camera with one thumb
for (const [id, dir] of [['#rotL', 1], ['#rotR', -1]]) {
  const b = $(id);
  b.addEventListener('pointerdown', (e) => { b.setPointerCapture(e.pointerId); cam.spin = dir; });
  const stop = () => { cam.spin = 0; };
  b.addEventListener('pointerup', stop); b.addEventListener('pointercancel', stop);
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
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

function updateHud() {
  if (!players.length || phase === 'menu') return;
  const hole = course.holes[holeIdx], me = human();
  $('#holeNum').textContent = holeIdx + 1;
  $('#holeName').textContent = hole.name;
  $('#holePar').textContent = `פאר ${hole.par}`;
  $('#strokes').innerHTML = `<b>${me.ball.strokes}</b><span>מכות</span>`;
  $('#players').innerHTML = players.map((p) => {
    const done = p.done ? (p.scores[holeIdx] >= GIVE_UP_SCORE ? '✖' : '⛳') : '';
    return `<li class="${p.done ? 'done' : ''}${p.bot ? '' : ' me'}"><i style="--c:${p.color}"></i><span>${esc(p.name)}</span><b>${p.ball ? p.ball.strokes : 0}</b><em>${done}</em></li>`;
  }).join('');
}

let bannerTimer;
function banner(title, sub = '', tone = '') {
  const b = $('#banner');
  b.className = tone;
  b.innerHTML = `<div class="ribbon"><b>${esc(title)}</b></div>${sub ? `<span>${esc(sub)}</span>` : ''}`;
  void b.offsetWidth; b.classList.add('show');
  clearTimeout(bannerTimer);
  bannerTimer = setTimeout(() => b.classList.remove('show'), 1900);
}
function holeCard(n, name, par) {
  const c = $('#holeCard');
  c.innerHTML = `<small>גומה</small><b>${n}</b><span>${esc(name)}</span><em>פאר ${par}</em>`;
  c.classList.remove('show'); void c.offsetWidth; c.classList.add('show');
}
let toastTimer;
function toast(text, color) {
  const t = $('#toast');
  t.innerHTML = `${color ? `<i style="--c:${color}"></i>` : ''}${esc(text)}`;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 1800);
}

function scoreCard() {
  const holes = course.holes;
  const head = `<tr><th>גומה</th>${holes.map((_, i) => `<th>${i + 1}</th>`).join('')}<th>סה״כ</th></tr>`;
  const parRow = `<tr class="par"><td>פאר</td>${holes.map((h) => `<td>${h.par}</td>`).join('')}<td>${holes.reduce((s, h) => s + h.par, 0)}</td></tr>`;
  const rows = players.map((p) => {
    const total = p.scores.reduce((s, v) => s + (v || 0), 0);
    return `<tr class="${p.bot ? '' : 'me'}"><td><i style="--c:${p.color}"></i>${esc(p.name)}</td>${holes.map((h, i) => {
      const v = p.scores[i];
      const cls = v == null ? '' : v === 1 ? 'ace' : v <= h.par - 2 ? 'eagle' : v < h.par ? 'birdie' : v === h.par ? '' : v === h.par + 1 ? 'bogey' : 'dbl';
      return `<td><span class="${cls}">${v ?? ''}</span></td>`;
    }).join('')}<td class="tot">${total}</td></tr>`;
  }).join('');
  return `<table class="card">${head}${parRow}${rows}</table>`;
}
const totals = () => players.map((p) => ({ p, total: p.scores.reduce((s, v) => s + (v || 0), 0) })).sort((a, b) => a.total - b.total);

function showHoleEnd() {
  phase = 'holeEnd';
  aim.hide();
  const last = holeIdx === course.holes.length - 1;
  $('#holeEndTitle').textContent = `גומה ${holeIdx + 1} הושלמה`;
  $('#holeEndTable').innerHTML = scoreCard();
  $('#nextHole').innerHTML = last ? 'לתוצאות 🏆' : `גומה ${holeIdx + 2} ▶`;
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
  const place = order.findIndex((o) => o.p === me) + 1;
  // podium: 2nd, 1st, 3rd
  const slots = [order[1], order[0], order[2]];
  $('#podium').innerHTML = slots.map((o, k) => o ? `
    <div class="step s${[2, 1, 3][k]}${o.p === me ? ' me' : ''}">
      <div class="who"><i style="--c:${o.p.color}"></i><b>${esc(o.p.name)}</b><span>${o.total}</span></div>
      <div class="block">${[2, 1, 3][k]}</div>
    </div>` : '').join('')
    + (order[3] ? `<div class="fourth"><i style="--c:${order[3].p.color}"></i>${esc(order[3].p.name)} · ${order[3].total}</div>` : '');
  $('#finalTitle').textContent = place === 1 ? 'ניצחת!' : `מקום ${place}`;
  $('#finalSub').textContent = record ? `🏅 שיא חדש: ${myTotal}` : `השיא שלך: ${prev}`;
  $('#finalTable').innerHTML = scoreCard();
  show('final');
  if (place === 1) { sfx.cheer(); confetti.burst(cam.target.clone(), true); }
}
$('#again').addEventListener('click', () => { sfx.click(); startCourse(); });
$('#toMenu').addEventListener('click', () => { sfx.click(); goMenu(); });

// pause
$('#pauseBtn').addEventListener('click', () => { sfx.click(); paused = true; cancelShot(); show('pause'); });
$('#resume').addEventListener('click', () => { sfx.click(); paused = false; show('hud'); });
$('#restart').addEventListener('click', () => { sfx.click(); paused = false; startCourse(); });
$('#quit').addEventListener('click', () => { sfx.click(); paused = false; goMenu(); });
function soundLabel() { return prefs.sound ? '🔊' : '🔇'; }
$$('.soundBtn').forEach((b) => b.addEventListener('click', () => {
  prefs.sound = !prefs.sound; savePrefs();
  $$('.soundBtn').forEach((x) => { x.textContent = soundLabel(); });
}));

// ---------- menu ----------
function disposePreview() { preview?.dispose(); preview = null; }
function buildPreview() {
  disposePreview();
  preview = new BallView(scene, { color: prefs.color, hat: prefs.hat, name: '', bot: false });
  // stand the preview ball in the middle of the hole, clear of walls and bumpers
  const mid = layout.path[Math.floor(layout.path.length / 2)] || layout.path[0];
  const [sx, sy, sz] = layout.start, [cx, , cz] = layout.cup;
  const x = (sx + cx) / 2, z = (sz + cz) / 2 + (mid ? 0 : 0);
  preview.fake = { position: new THREE.Vector3(x, sy, z), velocity: new THREE.Vector3() };
  preview.baseYaw = -Math.atan2(cx - sx, -(cz - sz));
}
function goMenu() {
  clearTimeout(endTimer);
  phase = 'menu';
  for (const p of players) p.view?.dispose();
  players = [];
  loadHole(0);
  buildPreview();
  cam.target.copy(preview.fake.position);
  renderMenu();
  show('menu');
}
function renderMenu() {
  $('#courseList').innerHTML = COURSES.map((c) => `
    <button class="course${c.id === prefs.course ? ' on' : ''}" data-course="${c.id}" style="--a:${c.theme.felt[0]};--b:${c.theme.side}">
      <span class="ce">${c.emoji}</span><b>${esc(c.name)}</b><small>${c.holes.length} גומות${prefs.best[c.id] != null ? ` · שיא ${prefs.best[c.id]}` : ''}</small>
    </button>`).join('')
    + `<button class="course soon" disabled style="--a:#2bb6c9;--b:#c98a4b"><span class="ce">🏴‍☠️</span><b>אי הפיראטים</b><small>בקרוב</small></button>`
    + `<button class="course soon" disabled style="--a:#5b4bd6;--b:#1b1f4b"><span class="ce">🚀</span><b>תחנת החלל</b><small>בקרוב</small></button>`;
  $('#botsVal').textContent = prefs.bots === 0 ? 'לבד' : prefs.bots;
  $$('#skillSeg button').forEach((b) => b.classList.toggle('on', b.dataset.v === prefs.skill));
  $('#skillSeg').classList.toggle('off', prefs.bots === 0);
  $('#colors').innerHTML = COLORS.map((c) => `<button class="sw${c === prefs.color ? ' on' : ''}" data-c="${c}" style="--c:${c}" aria-label="צבע"></button>`).join('');
  $('#hats').innerHTML = HATS.map((h) => `<button class="hat${h === prefs.hat ? ' on' : ''}" data-h="${h}">${HAT_ICONS[h]}</button>`).join('');
  $('#nameInput').value = prefs.name;
  $$('.soundBtn').forEach((x) => { x.textContent = soundLabel(); });
}
$('#menu').addEventListener('click', (e) => {
  const t = e.target.closest('button');
  if (!t) return;
  let rebuild = false;
  if (t.dataset.course) { prefs.course = t.dataset.course; course = COURSES.find((c) => c.id === prefs.course); loadHole(0); rebuild = true; }
  else if (t.id === 'botsMinus') prefs.bots = Math.max(0, prefs.bots - 1);
  else if (t.id === 'botsPlus') prefs.bots = Math.min(3, prefs.bots + 1);
  else if (t.closest('#skillSeg')) prefs.skill = t.dataset.v;
  else if (t.dataset.c) { prefs.color = t.dataset.c; rebuild = true; }
  else if (t.dataset.h) { prefs.hat = t.dataset.h; rebuild = true; }
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
  if (rebuild) { buildPreview(); cam.target.copy(preview.fake.position); }
  renderMenu();
});
$('#nameInput').addEventListener('change', () => { prefs.name = $('#nameInput').value.trim().slice(0, 12) || 'אני'; savePrefs(); });

// ---------- boot ----------
course = COURSES.find((c) => c.id === prefs.course) || COURSES[0];
if (Plugins.StatusBar) Plugins.StatusBar.hide().catch(() => {});
if (Plugins.App) Plugins.App.addListener('backButton', () => {
  if (phase === 'menu') Plugins.App.exitApp();
  else if (!paused && (phase === 'play' || phase === 'intro')) { paused = true; cancelShot(); show('pause'); }
  else if (paused) { paused = false; show('hud'); }
});
document.addEventListener('visibilitychange', () => {
  if (document.hidden && (phase === 'play' || phase === 'intro')) { paused = true; cancelShot(); show('pause'); }
});
document.fonts?.ready.then(() => goMenu()) ?? goMenu();
requestAnimationFrame(frame);
setTimeout(() => $('#splash').classList.add('gone'), 900);

// test hook for automated checks
window.__putt = { get preview() { return preview; }, camera, get phase() { return phase; }, get players() { return players; }, get sim() { return sim; }, cam, aim, beginHole, showHoleEnd, startCourse };
