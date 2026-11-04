// Touch controls (a stick, a drift button and a boost button per player) and the keyboard.

export class TouchPad {
  // root holds .stick, .knob, .drift, .boost; flip = the pad is turned upside down on screen
  constructor(root, flip = false) {
    this.root = root;
    this.flip = flip;
    this.stick = root.querySelector('.stick');
    this.knob = root.querySelector('.knob');
    this.x = 0; this.y = 0;
    this.drift = false; this.boost = false;
    this.used = false;
    this.stickId = null;
    const st = this.stick;
    st.addEventListener('pointerdown', (e) => { e.preventDefault(); this.stickId = e.pointerId; st.setPointerCapture(e.pointerId); this.used = true; this.move(e); });
    st.addEventListener('pointermove', (e) => { if (e.pointerId === this.stickId) this.move(e); });
    const end = (e) => { if (e.pointerId === this.stickId) { this.stickId = null; this.x = this.y = 0; this.knob.style.transform = ''; } };
    st.addEventListener('pointerup', end); st.addEventListener('pointercancel', end);
    this.hold(root.querySelector('.drift'), 'drift');
    this.hold(root.querySelector('.boost'), 'boost');
  }
  hold(el, key) {
    const on = (e) => { e.preventDefault(); this[key] = true; el.classList.add('on'); el.setPointerCapture?.(e.pointerId); this.used = true; };
    const off = () => { this[key] = false; el.classList.remove('on'); };
    el.addEventListener('pointerdown', on);
    el.addEventListener('pointerup', off); el.addEventListener('pointercancel', off); el.addEventListener('lostpointercapture', off);
  }
  move(e) {
    const r = this.stick.getBoundingClientRect();
    const rad = r.width / 2;
    let dx = (e.clientX - (r.left + rad)) / rad;
    let dy = (e.clientY - (r.top + rad)) / rad;
    if (this.flip) { dx = -dx; dy = -dy; }
    const l = Math.hypot(dx, dy);
    if (l > 1) { dx /= l; dy /= l; }
    this.x = dx; this.y = -dy;
    const kx = dx * rad * 0.55, ky = dy * rad * 0.55;
    this.knob.style.transform = `translate(${this.flip ? -kx : kx}px, ${this.flip ? -ky : ky}px)`;
  }
  read() {
    // push the stick sideways to turn; forward and back for gas and brake.
    // pushing mostly sideways still drives forwards, so you can steer with one thumb.
    let throttle = this.y;
    const mag = Math.hypot(this.x, this.y);
    if (mag > 0.25 && this.y > -0.35) throttle = Math.max(throttle, Math.min(1, mag));
    const steer = Math.abs(this.x) < 0.08 ? 0 : this.x;
    return { steer, throttle, drift: this.drift, boost: this.boost };
  }
}

const KEYS = {
  // [left, right, up, down, drift, boost]
  solo: [['KeyA', 'ArrowLeft'], ['KeyD', 'ArrowRight'], ['KeyW', 'ArrowUp'], ['KeyS', 'ArrowDown'], ['Space', 'KeyJ'], ['ShiftLeft', 'ShiftRight', 'KeyK']],
  p1: [['KeyA'], ['KeyD'], ['KeyW'], ['KeyS'], ['KeyF', 'Space'], ['KeyG', 'ShiftLeft']],
  p2: [['ArrowLeft'], ['ArrowRight'], ['ArrowUp'], ['ArrowDown'], ['Period', 'Numpad1', 'KeyL'], ['Slash', 'Numpad2', 'Semicolon', 'ShiftRight']],
};

export class Keyboard {
  constructor() {
    this.down = new Set();
    this.used = false;
    addEventListener('keydown', (e) => {
      if (e.target && e.target.tagName === 'INPUT') return;
      this.down.add(e.code); this.used = true;
      if (e.code.startsWith('Arrow') || e.code === 'Space') e.preventDefault();
    });
    addEventListener('keyup', (e) => this.down.delete(e.code));
    addEventListener('blur', () => this.down.clear());
  }
  read(set = 'solo') {
    const k = KEYS[set];
    const any = (list) => list.some((c) => this.down.has(c));
    const steer = (any(k[1]) ? 1 : 0) - (any(k[0]) ? 1 : 0);
    const throttle = (any(k[2]) ? 1 : 0) - (any(k[3]) ? 1 : 0);
    return { steer, throttle, drift: any(k[4]), boost: any(k[5]), active: steer !== 0 || throttle !== 0 };
  }
}

// merge: keyboard wins when pressed, otherwise touch
export function mix(a, b) {
  if (!b) return a;
  return {
    steer: a.steer || b.steer,
    throttle: a.throttle || b.throttle,
    drift: a.drift || b.drift,
    boost: a.boost || b.boost,
  };
}
