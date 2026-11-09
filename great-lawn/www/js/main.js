// Boot, menus, saving, sound and the frame loop.
import { Game } from './game.js';
import { Input } from './core/input.js';
import { Audio } from './core/audio.js';
import { Hud } from './ui/hud.js';
import { loadSettings, saveSettings, isTouchDevice } from './core/quality.js';
import { nextFrame } from './core/util.js';

const $ = (id) => document.getElementById(id);
const params = new URLSearchParams(location.search);
const settings = loadSettings();
if (['low', 'medium', 'high', 'ultra'].includes(params.get('quality'))) settings.quality = params.get('quality');
const canvas = $('view');
const input = new Input(canvas);
input.sensitivity = settings.sensitivity;
input.invertY = settings.invertY;
const audio = new Audio();
audio.volume = settings.volume;
const game = new Game(canvas, settings);
window.__game = game;
let hud = null;
const touch = isTouchDevice();
const SAVE_KEY = 'greatlawn.save.v1';

const show = (id, on = true) => { $(id).hidden = !on; };
const screens = ['title', 'pause', 'settings', 'done'];
let settingsReturn = 'title';
function only(id) { for (const s of screens) show(s, s === id); }
const stats = { played: 0, doneShown: false, milestones: new Set() };

// ---------------------------------------------------------------- saving
function readSave() {
  try { return JSON.parse(localStorage.getItem(SAVE_KEY) || 'null'); } catch (e) { return null; }
}
function writeSave() {
  if (!game.cutmap || !game.cockpit || game.state === 'title' || game.state === 'loading') return;
  const v = game.vehicle, ck = game.cockpit;
  const data = {
    v: 1, cut: game.cutmap.serialize(), x: v.x, z: v.z, heading: v.heading,
    bottles: ck.bottles, cigars: ck.cigars, fill: ck.bottle.fill, cigarLeft: ck.cigarLeft, played: stats.played, done: stats.doneShown,
  };
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(data)); } catch (e) { /* storage full or blocked */ }
}
function applySave(s) {
  if (!s || !s.cut) return false;
  game.cutmap.restore(s.cut);
  game.vehicle.reset(s.x, s.z, s.heading);
  const ck = game.cockpit;
  ck.bottles = s.bottles || 1; ck.cigars = s.cigars || 1;
  ck.bottle.fill = s.fill ?? 1; ck.cigarLeft = s.cigarLeft ?? 1;
  stats.played = s.played || 0; stats.doneShown = !!s.done;
  for (const [at] of MILESTONES) if (game.cutmap.progress >= at) stats.milestones.add(at);
  return true;
}

// ---------------------------------------------------------------- boot
async function boot() {
  const bar = $('loadBar'), label = $('loadStep');
  const step = async (p, text) => {
    bar.style.width = `${Math.round(p * 100)}%`;
    if (text) label.textContent = text;
    await nextFrame();
  };
  try {
    await game.load(step);
  } catch (err) {
    console.error(err);
    label.textContent = /WebGL/.test(err.message)
      ? 'This device cannot run WebGL 2, which the game needs.'
      : `Something went wrong while loading: ${err.message}`;
    return;
  }
  hud = new Hud(game);
  if (touch) {
    document.body.classList.add('touch');
    input.bindTouch({
      stick: $('stick'), knob: $('stickKnob'), lookZone: $('lookZone'), drink: $('tDrink'), puff: $('tPuff'),
      blades: $('tBlades'), boost: $('tBoost'), action: $('tAction'), pause: $('tPause'),
    });
    $('controlsBlurb').textContent = 'Left thumb drives and steers, right thumb looks about; the buttons drink, smoke and work the blades.';
  }
  $('fps').hidden = !settings.showFps;
  show('loading', false);
  game.state = 'title';
  const save = readSave();
  $('btnContinue').hidden = !save;
  if (save) $('btnBegin').textContent = 'Start afresh';
  if (params.has('autostart')) begin(false);
  else only('title');
  if (params.has('manual')) {
    // test hook: advance the simulation by hand and render one frame
    window.__step = (n = 1, dt = 1 / 30, ctl = {}) => {
      for (let i = 0; i < n; i++) {
        const c = input.poll();
        game.update(dt, { ...c, ...ctl, pressed: new Set(ctl.pressed || []) });
      }
      game.render();
      if (hud) hud.update(dt, 30);
      return true;
    };
  } else requestAnimationFrame(loop);
}

function begin(fromSave) {
  audio.start();
  audio.setVolume(settings.volume);
  stats.milestones.clear();
  if (fromSave && applySave(readSave())) { /* restored */ } else {
    game.cutmap.clear();
    game.vehicle.reset();
    game.cockpit.bottle.fill = 1; game.cockpit.cigarLeft = 1;
    game.cockpit.bottles = 1; game.cockpit.cigars = 1;
    hud.img.data.fill(0); hud.dirty = true;
    stats.played = 0; stats.doneShown = false;
    try { localStorage.removeItem(SAVE_KEY); } catch (e) { /* ignore */ }
  }
  only(null);
  show('hud');
  if (touch) show('touch');
  game.debugView = null;
  game.state = 'playing';
  game.bladesOn = false;
  input.enabled = true;
  if (!touch && !params.has('autostart')) input.requestLock();
  if (!fromSave) setTimeout(() => hud.toast(touch ? 'Tap Blades to start mowing. Mind his Lordship’s cedar.' : 'Space engages the blades. Mind his Lordship’s cedar.', 4.5), 1200);
}

function pause() {
  if (game.state !== 'playing') return;
  game.state = 'paused';
  input.enabled = false;
  input.releaseLock();
  audio.suspend();
  only('pause');
  writeSave();
}
function resume() {
  only(null);
  game.state = 'playing';
  input.enabled = true;
  audio.resume();
  if (!touch) input.requestLock();
}
input.onUnlock = () => { if (game.state === 'playing' && !touch && !input.dragLook) pause(); };

// ---------------------------------------------------------------- menus
$('btnBegin').addEventListener('click', () => begin(false));
$('btnContinue').addEventListener('click', () => begin(true));
$('btnResume').addEventListener('click', resume);
$('btnRestart').addEventListener('click', () => begin(false));
$('btnSettings1').addEventListener('click', () => { settingsReturn = 'title'; openSettings(); });
$('btnSettings2').addEventListener('click', () => { settingsReturn = 'pause'; openSettings(); });
$('btnSettingsBack').addEventListener('click', closeSettings);
$('btnDoneContinue').addEventListener('click', () => { only(null); game.state = 'playing'; input.enabled = true; audio.resume(); if (!touch) input.requestLock(); });
$('btnDoneRestart').addEventListener('click', () => begin(false));
document.querySelectorAll('button').forEach((b) => b.addEventListener('click', () => { if (audio.ready) audio.ui(); }));

function openSettings() {
  $('setQuality').value = game.qualityName;
  $('setSens').value = settings.sensitivity;
  $('setVolume').value = settings.volume;
  $('setInvert').checked = settings.invertY;
  $('setFps').checked = settings.showFps;
  only('settings');
}
function closeSettings() {
  const q = $('setQuality').value;
  settings.sensitivity = +$('setSens').value; input.sensitivity = settings.sensitivity;
  settings.volume = +$('setVolume').value; audio.setVolume(settings.volume);
  settings.invertY = $('setInvert').checked; input.invertY = settings.invertY;
  settings.showFps = $('setFps').checked; $('fps').hidden = !settings.showFps;
  const qChanged = q !== game.qualityName;
  settings.quality = q;
  saveSettings(settings);
  if (qChanged) {
    // picture quality is fixed when the world is built: save the lawn and reload
    writeSave();
    location.reload();
    return;
  }
  only(settingsReturn);
}

document.addEventListener('visibilitychange', () => {
  if (document.hidden) { if (game.state === 'playing') pause(); else writeSave(); }
});
addEventListener('pagehide', writeSave);

// ---------------------------------------------------------------- events -> sound and notices
const MILESTONES = [
  [0.01, 'A fine first stripe.'],
  [0.1, 'Jenkins nods approvingly from the terrace.'],
  [0.25, 'A quarter of the lawn. The rooks are unimpressed.'],
  [0.5, 'Half the Great Lawn restored.'],
  [0.75, 'His Lordship would hardly know it had been neglected.'],
  [0.9, 'Nearly there. Mind the stripes.'],
];
function handleEvents() {
  for (const e of game.events || []) {
    if (!audio.ready) continue;
    if (e.type === 'gulp') audio.gulp();
    else if (e.type === 'opened') { audio.opened(); const n = game.cockpit.bottles; hud.toast(n >= 5 ? 'Steady on.' : n >= 3 ? 'Another, sir? Very good.' : 'Ah. That’s better.'); }
    else if (e.type === 'empty') audio.clink();
    else if (e.type === 'draw') audio.draw();
    else if (e.type === 'exhale') audio.exhale(e.amount);
    else if (e.type === 'ash') audio.ash();
    else if (e.type === 'lit') { audio.lit(); hud.toast('A fresh Churchill, cut and lit.'); }
    else if (e.type === 'bump') { audio.bump(e.strength); if (e.strength > 0.35) hud.toast(['Steady!', 'Mind the hedge!', 'Whoa there.'][Math.floor(Math.random() * 3)], 1.8); }
    else if (e.type === 'blades') audio.lever(e.on);
  }
  const p = game.cutmap.progress;
  for (const [at, text] of MILESTONES) if (p >= at && !stats.milestones.has(at)) { stats.milestones.add(at); hud.toast(text, 4); }
  if (p >= 0.97 && !stats.doneShown && game.state === 'playing') {
    stats.doneShown = true;
    const mins = Math.max(1, Math.round(stats.played / 60)), ck = game.cockpit;
    $('doneText').textContent = `In ${mins} minute${mins === 1 ? '' : 's'} of steady mowing, ${ck.bottles} bottle${ck.bottles === 1 ? '' : 's'} of estate ale and ${ck.cigars} cigar${ck.cigars === 1 ? '' : 's'}, the Great Lawn has its stripes back. His Lordship will be delighted.`;
    game.state = 'done';
    input.enabled = false; input.releaseLock();
    only('done');
    writeSave();
  }
}

// ---------------------------------------------------------------- frame loop
let last = performance.now(), fpsAcc = 0, fpsN = 0, fps = 60, saveTimer = 20, dynTimer = 0;
const target = touch ? 28 : 52;
function loop(now) {
  const dt = Math.min(0.05, Math.max(0.0005, (now - last) / 1000));
  last = now;
  const ctl = input.poll();
  if (ctl.pressed.has('pause')) { if (game.state === 'playing') pause(); else if (game.state === 'paused') resume(); }
  if (game.state === 'playing') {
    if (ctl.pressed.has('hud')) $('hud').classList.toggle('hud-off');
    if (ctl.pressed.has('map')) $('plan').hidden = !$('plan').hidden;
    stats.played += dt;
  }
  if (game.state === 'title') titleCamera(now / 1000);
  const wasBlades = game.bladesOn;
  game.update(dt, ctl);
  if (game.bladesOn !== wasBlades) (game.events = game.events || []).push({ type: 'blades', on: game.bladesOn });
  game.render();
  if (hud) {
    handleEvents();
    hud.update(dt, fps);
  }
  audio.update(dt, {
    rpm: game.vehicle.rpm, throttle: game.vehicle.throttle, load: game.vehicle.load, bladesOn: game.bladesOn,
    speed: game.vehicle.v, surface: game.vehicle.surface, paused: game.state !== 'playing',
  });
  // frame rate and dynamic resolution
  fpsAcc += dt; fpsN++;
  if (fpsAcc > 1) {
    fps = fpsN / fpsAcc; fpsAcc = 0; fpsN = 0;
    if (game.state === 'playing') {
      dynTimer++;
      const ds = game.dynScale || 1;
      if (fps < target && ds > 0.55 && dynTimer > 1) { game.setDynScale(Math.max(0.55, ds - 0.1)); dynTimer = 0; }
      else if (fps > target + 14 && ds < 1 && dynTimer > 4) { game.setDynScale(Math.min(1, ds + 0.05)); dynTimer = 0; }
    }
  }
  saveTimer -= dt;
  if (saveTimer < 0 && game.state === 'playing') { saveTimer = 20; writeSave(); }
  requestAnimationFrame(loop);
}

// slow fly-over of the estate behind the title card
function titleCamera(t) {
  const a = t * 0.035 + 2.2;
  game.debugView = { pos: [Math.sin(a) * 62, 14 + Math.sin(t * 0.07) * 3, 8 + Math.cos(a) * 62], target: [0, 7, -40], fov: 55 };
}

boot();
export { game, input, settings };
