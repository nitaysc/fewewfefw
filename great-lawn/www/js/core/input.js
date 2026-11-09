// Keyboard, mouse, touch and gamepad, folded into one per-frame control state.
import { clamp } from './util.js';

export class Input {
  constructor(canvas) {
    this.canvas = canvas;
    this.keys = new Set();
    this.pressed = new Set();      // one-shot actions since the last poll
    this.lookDX = 0; this.lookDY = 0;
    this.mouseL = false; this.mouseR = false;
    this.dragLook = false; this.dragging = false;
    this.locked = false;
    this.enabled = false;
    this.sensitivity = 1; this.invertY = false;
    this.touch = { steer: 0, throttle: 0, drink: false, puff: false, boost: false, stickId: null, lookId: null, lx: 0, ly: 0 };
    this.usingTouch = false;
    this.lastGamepadButtons = [];

    addEventListener('keydown', (e) => this.onKey(e, true));
    addEventListener('keyup', (e) => this.onKey(e, false));
    addEventListener('blur', () => { this.keys.clear(); this.mouseL = this.mouseR = false; });

    canvas.addEventListener('mousedown', (e) => {
      if (!this.enabled) return;
      if (!this.locked && !this.dragLook) this.requestLock();
      if (this.locked) {
        if (e.button === 0) this.mouseL = true;
        if (e.button === 2) this.mouseR = true;
      } else {
        this.dragging = true;
      }
    });
    addEventListener('mouseup', (e) => {
      if (e.button === 0) this.mouseL = false;
      if (e.button === 2) this.mouseR = false;
      this.dragging = false;
    });
    addEventListener('mousemove', (e) => {
      if (!this.enabled) return;
      if (this.locked || (this.dragLook && this.dragging)) {
        this.lookDX += e.movementX || 0;
        this.lookDY += e.movementY || 0;
      }
    });
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    document.addEventListener('pointerlockchange', () => {
      this.locked = document.pointerLockElement === canvas;
      if (!this.locked) { this.mouseL = this.mouseR = false; if (this.enabled && this.onUnlock) this.onUnlock(); }
    });
    document.addEventListener('pointerlockerror', () => { this.dragLook = true; });
  }

  requestLock() {
    try {
      const p = this.canvas.requestPointerLock && this.canvas.requestPointerLock();
      if (p && p.catch) p.catch(() => { this.dragLook = true; });
    } catch (e) { this.dragLook = true; }
  }
  releaseLock() { if (document.pointerLockElement) document.exitPointerLock(); }

  onKey(e, down) {
    const k = e.code;
    if (down) {
      if (!this.keys.has(k)) {
        const map = { Space: 'blades', KeyF: 'ash', KeyR: 'action', Escape: 'pause', KeyP: 'pause', KeyH: 'hud', KeyM: 'map', KeyV: 'view' };
        if (map[k]) this.pressed.add(map[k]);
      }
      this.keys.add(k);
      if (this.enabled && (k === 'Space' || k.startsWith('Arrow') || k === 'Tab')) e.preventDefault();
    } else {
      this.keys.delete(k);
    }
  }

  // ---- touch ----
  bindTouch(els) {
    this.usingTouch = true;
    const stick = els.stick, knob = els.knob, look = els.lookZone;
    const R = 62;
    const setStick = (t) => {
      const r = stick.getBoundingClientRect();
      let dx = (t.clientX - (r.left + r.width / 2)) / R;
      let dy = (t.clientY - (r.top + r.height / 2)) / R;
      const m = Math.hypot(dx, dy);
      if (m > 1) { dx /= m; dy /= m; }
      knob.style.transform = `translate(${dx * R}px, ${dy * R}px)`;
      const dz = (v) => (Math.abs(v) < 0.12 ? 0 : (v - Math.sign(v) * 0.12) / 0.88);
      this.touch.steer = dz(dx);
      this.touch.throttle = dz(-dy);
    };
    stick.addEventListener('touchstart', (e) => {
      e.preventDefault();
      const t = e.changedTouches[0];
      this.touch.stickId = t.identifier; setStick(t);
    }, { passive: false });
    look.addEventListener('touchstart', (e) => {
      e.preventDefault();
      const t = e.changedTouches[0];
      this.touch.lookId = t.identifier; this.touch.lx = t.clientX; this.touch.ly = t.clientY;
    }, { passive: false });
    addEventListener('touchmove', (e) => {
      for (const t of e.changedTouches) {
        if (t.identifier === this.touch.stickId) setStick(t);
        if (t.identifier === this.touch.lookId) {
          this.lookDX += (t.clientX - this.touch.lx) * 1.6;
          this.lookDY += (t.clientY - this.touch.ly) * 1.6;
          this.touch.lx = t.clientX; this.touch.ly = t.clientY;
        }
      }
    }, { passive: true });
    const end = (e) => {
      for (const t of e.changedTouches) {
        if (t.identifier === this.touch.stickId) {
          this.touch.stickId = null; this.touch.steer = 0; this.touch.throttle = 0;
          knob.style.transform = '';
        }
        if (t.identifier === this.touch.lookId) this.touch.lookId = null;
      }
    };
    addEventListener('touchend', end); addEventListener('touchcancel', end);

    const hold = (el, key) => {
      el.addEventListener('touchstart', (e) => { e.preventDefault(); this.touch[key] = true; el.classList.add('held'); }, { passive: false });
      const up = (e) => { e.preventDefault(); this.touch[key] = false; el.classList.remove('held'); };
      el.addEventListener('touchend', up, { passive: false }); el.addEventListener('touchcancel', up, { passive: false });
    };
    const tap = (el, action) => el.addEventListener('touchstart', (e) => { e.preventDefault(); this.pressed.add(action); }, { passive: false });
    hold(els.drink, 'drink'); hold(els.puff, 'puff'); hold(els.boost, 'boost');
    tap(els.blades, 'blades'); tap(els.action, 'action'); tap(els.pause, 'pause');
    if (els.view) tap(els.view, 'view');
  }

  // ---- per-frame state ----
  poll() {
    const k = this.keys;
    const kb = (a, b) => (k.has(a) || k.has(b) ? 1 : 0);
    let throttle = kb('KeyW', 'ArrowUp') - kb('KeyS', 'ArrowDown');
    let steer = kb('KeyD', 'ArrowRight') - kb('KeyA', 'ArrowLeft');
    let boost = k.has('ShiftLeft') || k.has('ShiftRight');
    let drink = k.has('KeyQ') || this.mouseL || this.touch.drink;
    let puff = k.has('KeyE') || this.mouseR || this.touch.puff;
    if (this.usingTouch) {
      if (Math.abs(this.touch.throttle) > Math.abs(throttle)) throttle = this.touch.throttle;
      if (Math.abs(this.touch.steer) > Math.abs(steer)) steer = this.touch.steer;
      boost = boost || this.touch.boost;
    }
    let lookX = this.lookDX * 0.0022 * this.sensitivity;
    let lookY = this.lookDY * 0.0022 * this.sensitivity * (this.invertY ? -1 : 1);
    this.lookDX = 0; this.lookDY = 0;

    // Gamepad (standard mapping)
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    for (const gp of pads) {
      if (!gp || !gp.connected) continue;
      const ax = (i) => (Math.abs(gp.axes[i] || 0) > 0.12 ? gp.axes[i] : 0);
      const btn = (i) => !!(gp.buttons[i] && gp.buttons[i].pressed);
      const val = (i) => (gp.buttons[i] ? gp.buttons[i].value : 0);
      if (Math.abs(ax(0)) > Math.abs(steer)) steer = ax(0);
      const thr = val(7) - val(6);
      if (Math.abs(thr) > 0.05) throttle = thr; else if (Math.abs(ax(1)) > 0.3 && throttle === 0) throttle = -ax(1);
      lookX += ax(2) * 0.045 * this.sensitivity;
      lookY += ax(3) * 0.035 * this.sensitivity * (this.invertY ? -1 : 1);
      drink = drink || btn(4); puff = puff || btn(5); boost = boost || btn(10) || btn(1);
      const edge = (i, act) => { if (btn(i) && !this.lastGamepadButtons[i]) this.pressed.add(act); };
      edge(0, 'blades'); edge(2, 'ash'); edge(3, 'action'); edge(9, 'pause'); edge(8, 'view');
      this.lastGamepadButtons = gp.buttons.map((b) => b.pressed);
      break;
    }
    const pressed = this.pressed;
    this.pressed = new Set();
    return {
      throttle: clamp(throttle, -1, 1), steer: clamp(steer, -1, 1), boost,
      drink, puff, lookX, lookY, pressed,
    };
  }
}
