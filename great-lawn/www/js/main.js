// Boot: loading screen, menus, and the frame loop.
import { Game } from './game.js';
import { Input } from './core/input.js';
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
const game = new Game(canvas, settings);
window.__game = game;

const show = (id, on = true) => { $(id).hidden = !on; };

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
  show('loading', false);
  game.state = 'title';
  if (params.has('autostart')) begin(); else show('title');
  if (params.has('manual')) {
    // test hook: advance the simulation by hand and render one frame
    window.__step = (n = 1, dt = 1 / 30, ctl = {}) => {
      for (let i = 0; i < n; i++) {
        const c = input.poll();
        game.update(dt, { ...c, ...ctl, pressed: new Set(ctl.pressed || []) });
      }
      game.render();
      return true;
    };
  } else requestAnimationFrame(loop);
}

function begin() {
  show('title', false);
  show('hud');
  if (isTouchDevice()) { document.body.classList.add('touch'); show('touch'); }
  game.state = 'playing';
  input.enabled = true;
  if (!isTouchDevice() && !params.has('autostart')) input.requestLock();
}

$('btnBegin').addEventListener('click', begin);

let last = performance.now();
function loop(now) {
  const dt = Math.min(0.05, Math.max(0.0005, (now - last) / 1000));
  last = now;
  const ctl = input.poll();
  game.update(dt, ctl);
  game.render();
  requestAnimationFrame(loop);
}

boot();
export { game, input, settings, saveSettings };
