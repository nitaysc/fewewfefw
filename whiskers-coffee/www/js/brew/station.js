// The barista station: a close-up of the counter where a drink is made by hand. Each
// recipe step is a small hands-on moment (turn the grinder crank, tamp on the beat, hold
// to pull the shot, steam milk to the warm zone, trace latte art, dust cocoa...). Steps
// are scored for a star rating that adds to the tip, but nothing can go wrong: every
// drink gets finished and every customer is happy with it.
import { Pix, shade, mix, hash } from '../art/pix.js';
import { DRINKS, EXTRAS, C, INK, VESSELS, newBuild, addLayer, fillOf, applyIdeal, drawDrink, surfaceMap, guideShape, stepsFor, starsFor, orderName, MAP_SIZE } from '../art/drinks.js';

const SW = 180, SH = 100;
const CUP = { x: 86, by: 80 };
const TOP = { x: 90, y: 50, r: MAP_SIZE / 2 };
const CRANK = { x: 33, y: 33, r: 6 };
const SPOUT = { x: 86, y: 51 };
const JUG_HOME = { x: 140, by: 79 };
const SLOT = { x: 156, by: 80 };

// what every step is called, how it plays and what it says
export const STEPS = {
  grind: { name: 'Grind the beans', mech: 'circle', view: 'bar', turns: 3, hint: 'Turn the crank in circles to grind the beans' },
  tamp: { name: 'Tamp', mech: 'timing', view: 'bar', hint: 'Tap when the marker reaches the middle' },
  shot: { name: 'Pull the shot', mech: 'hold', view: 'bar', band: [0.8, 0.95], speed: 0.42, hint: 'Hold to pull the shot, let go in the gold zone' },
  milk: { name: 'Steam the milk', mech: 'hold', view: 'bar', band: [0.6, 0.77], speed: 0.33, temp: true, hint: 'Hold to steam the milk, let go when it is warm' },
  foam: { name: 'Froth the milk', mech: 'hold', view: 'bar', band: [0.6, 0.78], speed: 0.33, temp: true, hint: 'Hold to froth the milk, let go at a fluffy foam' },
  pour: { name: 'Pour the milk', mech: 'hold', view: 'bar', band: [0.82, 0.95], speed: 0.3, hint: 'Hold to pour, stop in the gold zone' },
  cream: { name: 'Whipped cream', mech: 'hold', view: 'bar', band: [0.66, 0.88], speed: 0.45, hint: 'Hold to swirl the cream, let go in the gold zone' },
  art: { name: 'Latte art', mech: 'trace', view: 'top', hint: 'Trace the dots with your finger to pour the art' },
  caramel: { name: 'Caramel drizzle', mech: 'trace', view: 'top', shape: 'zigzag', color: C.caramel, width: 0.045, z: 1, hint: 'Trace the zigzag to drizzle caramel' },
  choc: { name: 'Melt the chocolate', mech: 'circle', view: 'top', turns: 2.5, hint: 'Stir in circles to melt the chocolate' },
  whisk: { name: 'Whisk the matcha', mech: 'shake', view: 'top', count: 10, hint: 'Swipe back and forth to whisk' },
  cocoa: { name: 'Dust with cocoa', mech: 'shake', view: 'top', count: 6, dust: C.cocoa, hint: 'Swipe back and forth over the cup to dust cocoa' },
  cinnamon: { name: 'Cinnamon', mech: 'shake', view: 'top', count: 5, dust: C.cinnamon, hint: 'Swipe back and forth over the cup to shake cinnamon' },
  marsh: { name: 'Marshmallows', mech: 'tap', view: 'top', count: 3, hint: 'Tap the drink to drop in marshmallows' },
  ice: { name: 'Add ice', mech: 'tap', view: 'bar', count: 3, hint: 'Tap to drop in ice cubes' },
  berry: { name: 'Mash strawberries', mech: 'tap', view: 'bar', count: 5, hint: 'Tap to mash the strawberries' },
};
const GRADED = new Set(['hold', 'timing', 'trace']);
const praise = (s) => (s >= 0.85 ? 'Perfect!' : s >= 0.55 ? 'Nice!' : 'Good');

export class Station {
  // els: { root, canvas, title, for, steps, end, hint, close }, hooks: { sound(name), done(quality), close() }
  constructor(els, hooks) {
    this.el = els; this.hooks = hooks;
    this.small = document.createElement('canvas'); this.small.width = SW; this.small.height = SH;
    this.sg = this.small.getContext('2d');
    this.g = els.canvas.getContext('2d');
    this.open = false;
    this.bar = paintBar();
    const c = els.canvas;
    const pt = (e) => {
      const r = c.getBoundingClientRect(), dpr = this.dpr || 1;
      return [((e.clientX - r.left) * dpr - this.ox) / this.scale, ((e.clientY - r.top) * dpr - this.oy) / this.scale];
    };
    c.addEventListener('pointerdown', (e) => { c.setPointerCapture(e.pointerId); this.down = true; this.input('down', ...pt(e)); });
    c.addEventListener('pointermove', (e) => { this.input('move', ...pt(e)); });
    const up = (e) => { if (!this.down) return; this.down = false; this.input('up', ...pt(e)); };
    c.addEventListener('pointerup', up); c.addEventListener('pointercancel', up);
    els.close.addEventListener('click', () => { this.hide(); hooks.close(); });
    els.end.addEventListener('click', (e) => { if (e.target.closest('[data-serve]')) { this.hide(); hooks.done(this.quality); } });
    window.addEventListener('resize', () => this.open && this.resize());
  }

  start(drink, extra, forName) {
    this.drink = drink; this.extra = extra || ''; this.forName = forName;
    this.b = newBuild(drink, this.extra);
    this.keys = stepsFor(drink, this.extra);
    this.results = [];
    this.i = -1;
    this.pf = { at: 'grinder', grounds: 0, tamped: 0 };
    this.beans = 1; this.crank = -Math.PI / 2;
    this.fx = []; this.popup = null; this.finished = false;
    this.topBg = paintTop(this.b.vessel);
    this.open = true;
    this.el.root.hidden = false;
    this.el.title.textContent = orderName(drink, this.extra);
    this.el.for.textContent = forName ? `for ${forName}` : '';
    this.el.end.innerHTML = '';
    this.resize();
    this.next();
    const loop = (now) => { if (!this.open) return; requestAnimationFrame(loop); this.frame(now / 1000); };
    this.last = performance.now() / 1000;
    requestAnimationFrame(loop);
  }
  hide() { this.open = false; this.el.root.hidden = true; }

  resize() {
    const c = this.el.canvas, dpr = Math.min(window.devicePixelRatio || 1, 3);
    this.dpr = dpr;
    c.width = Math.round(c.clientWidth * dpr); c.height = Math.round(c.clientHeight * dpr);
    this.scale = Math.max(1, Math.floor(Math.min(c.width / SW, c.height / SH)));
    this.ox = Math.round((c.width - SW * this.scale) / 2); this.oy = Math.round((c.height - SH * this.scale) / 2);
  }

  // ---------- step flow ----------
  next() {
    this.i++;
    if (this.i >= this.keys.length) return this.finish();
    const key = this.keys[this.i], cfg = STEPS[key];
    this.cur = { key, cfg, t: 0, v: 0, held: false, acc: 0, count: 0, covered: new Set(), lastAng: null, lastX: null, dir: 0, travel: 0, anim: null, stroke: null };
    const b = this.b, d = DRINKS[b.id];
    // things each step sets up before the player starts
    if (key === 'shot') { this.pf.at = 'machine'; this.cur.base = fillOf(b); }
    if (key === 'pour') { this.cur.base = fillOf(b); this.cur.layer = d.pour; }
    if (key === 'choc') { addLayer(b, 'choc', 0.4); b.top = '#3a1a10'; b.chunks = 1; }
    if (key === 'whisk') { addLayer(b, 'matcha', 0.3); b.top = '#4f7a33'; b.froth = 0; }
    if (key === 'art') this.cur.guide = guideShape(d.art);
    if (key === 'caramel') this.cur.guide = guideShape('zigzag');
    this.el.hint.textContent = cfg.hint;
    this.renderCard();
  }

  complete(score) {
    const c = this.cur;
    if (c.done) return;
    c.done = true;
    const graded = GRADED.has(c.cfg.mech);
    this.results[this.i] = { score, graded };
    this.popup = { text: graded ? praise(score) : 'Done!', t: 0, stars: graded ? starsFor(score) : 0 };
    this.hooks.sound(graded && score >= 0.85 ? 'perfect' : 'step');
    this.renderCard();
    setTimeout(() => { if (this.open && this.cur === c) this.next(); }, 750);
  }

  finish() {
    this.finished = true;
    this.b.straw = VESSELS[this.b.vessel].straw;
    this.b.dirty = true;
    const g = this.results.filter((r) => r.graded);
    this.quality = g.length ? g.reduce((a, r) => a + r.score, 0) / g.length : 1;
    const stars = starsFor(this.quality);
    this.cur = null;
    this.el.hint.textContent = stars === 3 ? 'A perfect drink!' : stars === 2 ? 'Looks lovely!' : 'Made with love!';
    this.el.end.innerHTML = `<div class="st-rating">${starRow(stars)}</div><button class="btn primary" data-serve>Take it to ${escapeHtml(this.forName || 'the customer')}</button>`;
    this.renderCard();
    this.hooks.sound('done');
  }

  renderCard() {
    this.el.steps.innerHTML = this.keys.map((k, i) => {
      const r = this.results[i], cls = r ? 'done' : i === this.i ? 'now' : '';
      const mark = r ? (r.graded ? starRow(starsFor(r.score), true) : '<span class="tick"></span>') : '';
      return `<li class="${cls}"><span>${STEPS[k].name}</span>${mark}</li>`;
    }).join('');
  }

  // ---------- input ----------
  input(kind, x, y) {
    const c = this.cur;
    if (!c || c.done || c.anim) return;
    const cfg = c.cfg, b = this.b;
    this.pointer = [x, y];
    if (cfg.mech === 'hold') {
      if (kind === 'down') { c.held = true; this.hooks.sound('start-' + c.key); }
      if (kind === 'up' && c.held) this.release();
    } else if (cfg.mech === 'timing') {
      if (kind === 'down') {
        const p = (Math.sin(c.t * 2.6 - Math.PI / 2) + 1) / 2;
        c.anim = { t: 0, dur: 0.4, kind: 'tamp' };
        c.result = Math.max(0.3, 1 - Math.abs(p - 0.5) * 2.4);
        c.frozen = p;
        this.hooks.sound('tamp');
      }
    } else if (cfg.mech === 'circle') {
      const [cx, cy] = cfg.view === 'top' ? [TOP.x, TOP.y] : [CRANK.x, CRANK.y];
      const ang = Math.atan2(y - cy, x - cx);
      if (kind === 'down') c.lastAng = ang;
      else if (kind === 'move' && this.down && c.lastAng != null) {
        let da = ang - c.lastAng;
        if (da > Math.PI) da -= Math.PI * 2; if (da < -Math.PI) da += Math.PI * 2;
        c.lastAng = ang;
        if (Math.hypot(x - cx, y - cy) < 2) return;
        const before = Math.floor(c.acc / (Math.PI / 2));
        c.acc += Math.abs(da);
        if (Math.floor(c.acc / (Math.PI / 2)) > before) this.hooks.sound(c.key === 'grind' ? 'grind' : 'stir');
        const k = Math.min(1, c.acc / (cfg.turns * Math.PI * 2));
        if (c.key === 'grind') { this.crank = ang; this.beans = 1 - k * 0.55; this.pf.grounds = k; if (Math.random() < 0.5) this.fx.push({ kind: 'ground', x: 19 + Math.random() * 2, y: 49, t: 0 }); }
        else { this.spoon = [x, y]; b.chunks = 1 - k; b.top = mix('#3a1a10', C.choc, k); b.dirty = true; }
        if (k >= 1) this.complete(1);
      } else if (kind === 'up') c.lastAng = null;
    } else if (cfg.mech === 'shake') {
      if (kind === 'down') { c.lastX = x; c.dir = 0; c.travel = 0; }
      if (kind === 'move' && this.down && c.lastX != null) {
        const dx = x - c.lastX; c.lastX = x;
        if (!dx) return;
        const dir = Math.sign(dx);
        if (dir !== c.dir) { if (c.travel > 5) this.shook(x, y); c.dir = dir; c.travel = 0; }
        c.travel += Math.abs(dx);
      }
    } else if (cfg.mech === 'tap') {
      if (kind !== 'down') return;
      c.count++;
      if (c.key === 'marsh') {
        let nx = (x - TOP.x) / TOP.r, ny = (y - TOP.y) / TOP.r;
        const r = Math.hypot(nx, ny); if (r > 0.6) { nx *= 0.6 / r; ny *= 0.6 / r; }
        b.marsh.push([nx, ny]); b.dirty = true; this.hooks.sound('plop');
      } else if (c.key === 'ice') { this.fx.push({ kind: 'ice', t: 0 }); this.hooks.sound('ice'); }
      else if (c.key === 'berry') { addLayer(b, 'berry', 0.044); this.fx.push({ kind: 'mash', t: 0 }); this.hooks.sound('mash'); }
      if (c.count >= c.cfg.count) setTimeout(() => this.complete(1), c.key === 'ice' ? 450 : 150);
    } else if (cfg.mech === 'trace') {
      const nx = (x - TOP.x) / TOP.r, ny = (y - TOP.y) / TOP.r;
      const r = Math.hypot(nx, ny), k = r > 0.92 ? 0.92 / r : 1, px = nx * k, py = ny * k;
      if (kind === 'down') {
        c.stroke = { c: cfg.color || (b.id === 'matcha' ? '#f4f9e8' : C.foam), w: cfg.width || 0.085, pts: [[px, py]], z: cfg.z || 0 };
        b.strokes.push(c.stroke); this.hooks.sound('pour');
      } else if (kind === 'move' && c.stroke) {
        const [lx, ly] = c.stroke.pts[c.stroke.pts.length - 1];
        if (Math.hypot(px - lx, py - ly) > 0.03) { c.stroke.pts.push([px, py]); b.dirty = true; }
      }
      if (c.stroke) c.guide.forEach(([gx, gy], i) => { if (Math.hypot(gx - px, gy - py) < 0.14) c.covered.add(i); });
      const cov = c.covered.size / c.guide.length;
      if (kind === 'up') c.stroke = null;
      if (cov >= 0.95 || (kind === 'up' && cov >= 0.5)) this.complete(Math.min(1, cov / 0.9));
    }
  }

  shook(x, y) {
    const c = this.cur, b = this.b;
    c.count++;
    this.hooks.sound('shake');
    if (c.key === 'whisk') { b.froth = Math.min(1, c.count / c.cfg.count); b.top = mix('#4f7a33', C.matcha, b.froth); }
    else {
      const nx = (x - TOP.x) / TOP.r;
      for (let i = 0; i < 8; i++) {
        const dx = nx + (Math.random() - 0.5) * 0.7, dy = (Math.random() - 0.5) * 1.5;
        if (Math.hypot(dx, dy) < 0.85) b.dots.push([dx, dy, c.cfg.dust]);
      }
    }
    b.dirty = true;
    if (c.count >= c.cfg.count) this.complete(1);
  }

  release() {
    const c = this.cur, cfg = c.cfg, [lo, hi] = cfg.band;
    c.held = false;
    const v = c.v, dist = v < lo ? lo - v : v > hi ? v - hi : 0;
    const score = Math.max(0.3, 1 - dist * 3.2);
    this.hooks.sound('stop');
    if (c.key === 'milk' || c.key === 'foam') {
      // pour the steamed milk into the drink
      c.anim = { t: 0, dur: 1.2, kind: 'pourMilk', score, base: this.b.layers.map((l) => ({ ...l })) };
      this.hooks.sound('pour');
    } else this.complete(score);
  }

  // ---------- update and draw ----------
  frame(now) {
    const dt = Math.min(0.05, now - this.last); this.last = now;
    const c = this.cur, b = this.b, d = DRINKS[b.id];
    if (c) {
      c.t += dt;
      if (c.cfg.mech === 'hold' && c.held && !c.done) {
        c.v += c.cfg.speed * dt * (0.8 + c.v * 0.5);
        if (c.key === 'shot') { const l = b.layers.find((x) => x.key === 'espresso'); const amt = Math.min(1 - c.base, d.shot * c.v / 0.875); if (l) l.amt = amt; else addLayer(b, 'espresso', amt); if (b.vessel === 'demi' || b.vessel === 'cup') b.top = C.crema; b.dirty = true; }
        if (c.key === 'pour') { const amt = Math.min(1 - c.base, (0.9 - c.base) * c.v / 0.885); const l = b.layers.find((x) => x.key === c.layer); if (l) l.amt = amt; else addLayer(b, c.layer, amt); b.top = C[c.layer]; b.dirty = true; }
        if (c.key === 'cream') { b.cream = Math.min(1.25, c.v / 0.77); b.dirty = true; }
        if (Math.floor(c.t * 7) !== Math.floor((c.t - dt) * 7)) this.hooks.sound('tick-' + c.key);
        if (c.v >= 1.15) this.release();
      }
      if (c.anim) {
        const a = c.anim;
        a.t += dt;
        const k = Math.min(1, a.t / a.dur);
        if (a.kind === 'pourMilk') {
          b.layers = a.base.map((l) => ({ ...l }));
          if (d.milk === 'mix' && c.key === 'milk') { const l = b.layers.find((x) => x.key === 'choc'); if (l) { l.amt = 0.4 + 0.46 * k; l.c = mix(C.choc, C.hotchoc, k); } b.top = l?.c; b.chunks = 0; }
          else for (const [key, amt] of c.key === 'milk' ? d.milk : d.foam) addLayer(b, key, amt * k);
          if (k >= 1) { b.top = c.key === 'foam' ? C.foam : d.milk === 'mix' ? C.hotchoc : d.top || b.top; }
          b.dirty = true;
          if (k >= 1) { c.anim = null; this.complete(a.score); }
        } else if (a.kind === 'tamp') {
          this.pf.tamped = Math.min(1, a.t / 0.2);
          if (k >= 1) { c.anim = null; this.complete(c.result); }
        }
      }
    }
    for (const f of this.fx) f.t += dt;
    this.fx = this.fx.filter((f) => f.t < 1);
    for (const f of this.fx) if (f.kind === 'ice' && f.t > 0.4 && !f.landed) { f.landed = true; b.ice = Math.min(4, b.ice + 1); b.dirty = true; this.hooks.sound('clink'); }
    if (this.popup) { this.popup.t += dt; if (this.popup.t > 1.1) this.popup = null; }
    this.draw(now);
  }

  draw(now) {
    const view = this.cur ? this.cur.cfg.view : 'bar';
    const top = view === 'top' && !this.finished;
    const p = new Pix(SW, SH);
    p.data.set((top ? this.topBg : this.bar).data);
    if (top) this.drawTop(p, now); else this.drawBar(p, now);
    const img = this.sg.createImageData(SW, SH);
    new Uint32Array(img.data.buffer).set(p.data);
    this.sg.putImageData(img, 0, 0);
    const g = this.g, s = this.scale;
    g.imageSmoothingEnabled = false;
    g.fillStyle = '#1d130d'; g.fillRect(0, 0, this.el.canvas.width, this.el.canvas.height);
    g.drawImage(this.small, this.ox, this.oy, SW * s, SH * s);
    if (this.popup) {
      const k = this.popup.t, a = k < 0.15 ? k / 0.15 : k > 0.8 ? (1.1 - k) / 0.3 : 1;
      g.globalAlpha = Math.max(0, a);
      const size = Math.round(s * 9);
      g.font = `700 ${size}px "Pixelify Sans", monospace`; g.textAlign = 'center'; g.textBaseline = 'middle';
      const x = this.ox + SW * s / 2, y = this.oy + (22 - k * 6) * s;
      g.fillStyle = INK; g.fillText(this.popup.text, x + s, y + s);
      g.fillStyle = this.popup.stars === 3 ? '#ffd27a' : '#fbf6ea'; g.fillText(this.popup.text, x, y);
      g.globalAlpha = 1;
    }
  }

  drawBar(p, now) {
    const c = this.cur, b = this.b, key = c?.key;
    // beans in the grinder hopper
    const bl = Math.round(16 * this.beans);
    for (let y = 31 - bl; y <= 31; y++) for (let x = 11; x <= 27; x++) {
      const inset = Math.floor((31 - y) * 0.15);
      if (x < 11 + inset || x > 27 - inset) continue;
      p.set(x, y, (x * 3 + y * 5) % 7 < 2 ? '#2a160c' : (x + y) % 3 ? '#5a3420' : '#7a4a2c');
    }
    // crank
    const ca = this.crank, hx = CRANK.x + Math.cos(ca) * CRANK.r, hy = CRANK.y + Math.sin(ca) * CRANK.r;
    p.line(CRANK.x, CRANK.y, hx, hy, INK); p.line(CRANK.x, CRANK.y - 1, hx, hy - 1, '#8d9496');
    p.rect(Math.round(hx) - 1, Math.round(hy) - 2, 3, 4, '#5b3a26'); p.set(Math.round(hx), Math.round(hy) - 2, '#9c6a42');
    p.rect(CRANK.x - 1, CRANK.y - 1, 3, 3, INK);
    // portafilter: under the grinder, then locked into the machine
    const pfAt = this.pf.at === 'machine' ? [SPOUT.x, 46] : [19, 57];
    drawPortafilter(p, pfAt[0], pfAt[1], this.pf.grounds, this.pf.tamped);
    if (key === 'tamp' || (c?.anim?.kind === 'tamp')) {
      const press = c.anim ? Math.sin(Math.min(1, c.anim.t / c.anim.dur) * Math.PI) * 4 : 0;
      const ty = pfAt[1] - 12 + press;
      p.rect(pfAt[0] - 4, ty + 6, 9, 3, '#8d9496'); p.hline(pfAt[0] - 4, pfAt[0] + 4, ty + 6, '#c9cfd1');
      p.rect(pfAt[0] - 1, ty - 2, 3, 8, '#7a4e30'); p.rect(pfAt[0] - 2, ty - 4, 5, 3, '#9c6a42');
      p.hline(pfAt[0] - 5, pfAt[0] + 5, ty + 9, INK);
    }
    // the jug: resting, steaming under the wand, or pouring into the cup
    const cupTop = CUP.by - VESSELS[b.vessel].big.h;
    const surfaceY = Math.round(CUP.by - 1 - Math.min(1, fillOf(b)) * (VESSELS[b.vessel].big.h - 2));
    const steaming = (key === 'milk' || key === 'foam') && !c.anim;
    const pouring = (c?.anim?.kind === 'pourMilk') || (key === 'pour' && c.held);
    const jugMilk = key === 'pour' ? C[DRINKS[b.id].pour] : C.milk;
    if (steaming) {
      drawJug(p, 136, 66, 0, c.v);
      // the wand dips into the milk
      p.line(126, 34, 133, 56, INK); p.line(127, 34, 134, 56, '#c9cfd1');
      if (c.held) for (let i = 0; i < 4; i++) { const k = (now * 1.5 + i / 4) % 1; p.set(130 + Math.sin((now + i) * 5) * 3, 48 - k * 16, `#ffffff${Math.round((1 - k) * 200).toString(16).padStart(2, '0')}`); p.set(131 + Math.sin((now + i) * 4) * 3, 47 - k * 14, '#ffffff66'); }
      if (c.held) for (let i = 0; i < 3; i++) p.set(133 + ((now * 20 + i * 3) % 6) - 3, 51 - (i % 2), '#ffffff');
    } else {
      p.line(126, 34, 129, 52, INK); p.line(127, 34, 130, 52, '#c9cfd1');
    }
    if (pouring) {
      const jx = CUP.x + 16, jy = cupTop - 2;
      drawJug(p, jx, jy, -0.9, 0.6, jugMilk);
      // milk stream into the cup
      for (let y = jy - 12; y < surfaceY; y++) { p.set(jx - 9 + Math.round(Math.sin(y * 0.8 + now * 20) * 0.5), y, jugMilk); p.set(jx - 8, y, shade(jugMilk, 0.92)); }
    } else if (!steaming) drawJug(p, JUG_HOME.x, JUG_HOME.by, 0, key === 'pour' ? 0.9 : 0, jugMilk);
    // the drink
    drawDrink(p, CUP.x, CUP.by, b, 'big');
    // espresso stream while pulling the shot
    if (key === 'shot' && c.held) for (let y = SPOUT.y; y < surfaceY; y++) { p.set(SPOUT.x - 1, y, (y + Math.floor(now * 30)) % 4 ? C.espresso : '#5a3420'); p.set(SPOUT.x + 1, y, (y + Math.floor(now * 30) + 2) % 4 ? C.espresso : '#5a3420'); }
    // tools for the current step
    if (key === 'ice' || (this.fx.some((f) => f.kind === 'ice'))) drawBucket(p, SLOT.x, SLOT.by);
    if (key === 'berry') drawBerries(p, SLOT.x, SLOT.by, c.count / c.cfg.count);
    if (key === 'cream') drawCreamCan(p, CUP.x + 2, cupTop - 6 - Math.round(Math.min(1.2, b.cream) * 9), c.held);
    for (const f of this.fx) {
      if (f.kind === 'ice') {
        const k = Math.min(1, f.t / 0.4), x = Math.round(SLOT.x + (CUP.x - SLOT.x) * k), y = Math.round(SLOT.by - 14 - Math.sin(k * Math.PI) * 14 + (cupTop + 4 - SLOT.by + 14) * k);
        if (f.t < 0.4) { p.rect(x - 2, y - 2, 5, 5, '#eef9fb'); p.hline(x - 2, x + 2, y - 3, INK); p.vline(x + 3, y - 2, y + 2, '#a9d3dc'); }
      }
      if (f.kind === 'mash') { const k = f.t; p.rect(CUP.x - 1, cupTop - 10 + Math.round(Math.sin(k * Math.PI) * 6), 3, 10, '#c08a55'); if (k < 0.4) for (let i = 0; i < 4; i++) p.set(CUP.x - 4 + i * 3, cupTop - 2 - Math.round(k * 10) - i % 2, C.berry); }
      if (f.kind === 'ground' && f.t < 0.4) p.set(f.x, f.y + f.t * 20, '#3b2014');
    }
    if (this.finished) {
      for (let i = 0; i < 6; i++) {
        const a = now * 1.2 + i * 1.05, r = 22 + Math.sin(now * 2 + i) * 2;
        const x = CUP.x + Math.cos(a) * r, y = CUP.by - 16 + Math.sin(a) * r * 0.55;
        sparkle(p, Math.round(x), Math.round(y), (i + Math.floor(now * 3)) % 2);
      }
      if (DRINKS[b.id].vessel !== 'tall') for (let i = 0; i < 3; i++) { const k = (now * 0.6 + i / 3) % 1; p.set(CUP.x - 3 + i * 3 + Math.round(Math.sin(now * 2 + i) * 1.5), cupTop - 4 - k * 14, `#ffffff${Math.round((1 - k) * 170).toString(16).padStart(2, '0')}`); }
    }
    // meters
    if (c && c.cfg.mech === 'hold') drawMeter(p, 168, 14, 46, c.v, c.cfg.band, c.cfg.temp);
    if (c && c.cfg.mech === 'timing') {
      const pos = c.frozen ?? (Math.sin(c.t * 2.6 - Math.PI / 2) + 1) / 2;
      drawTimingBar(p, 46, 7, 90, pos);
    }
    if (c && c.cfg.mech === 'circle' && c.key === 'grind') {
      const k = Math.min(1, c.acc / (c.cfg.turns * Math.PI * 2));
      drawProgress(p, 4, 92, 34, k);
      // a hint arrow circling the crank until the player starts
      if (c.acc === 0) { const a = now * 3; p.set(CRANK.x + Math.cos(a) * 10, CRANK.y + Math.sin(a) * 10, '#ffd27a'); p.set(CRANK.x + Math.cos(a - 0.3) * 10, CRANK.y + Math.sin(a - 0.3) * 10, '#ffd27a88'); }
    }
    if (c && c.cfg.mech === 'tap' && c.cfg.view === 'bar') drawCount(p, SLOT.x, 30, c.count, c.cfg.count, now);
  }

  drawTop(p, now) {
    const c = this.cur, b = this.b, key = c.key;
    const map = surfaceMap(b);
    p.blit(map, TOP.x - TOP.r, TOP.y - TOP.r);
    if (c.cfg.mech === 'trace') {
      // a faint dotted path, and a bead on each point still to reach
      for (let i = 1; i < c.guide.length; i++) {
        const [ax, ay] = c.guide[i - 1], [bx, by] = c.guide[i], n = Math.ceil(Math.hypot(bx - ax, by - ay) * TOP.r / 3);
        for (let k = 0; k < n; k++) { const t = k / n; p.set(TOP.x + (ax + (bx - ax) * t) * TOP.r, TOP.y + (ay + (by - ay) * t) * TOP.r, '#fbf6ea66'); }
      }
      c.guide.forEach(([gx, gy], i) => {
        if (c.covered.has(i)) return;
        const x = Math.round(TOP.x + gx * TOP.r), y = Math.round(TOP.y + gy * TOP.r);
        const blink = (i + Math.floor(now * 4)) % 8 === 0;
        p.rect(x - 1, y - 1, 3, 3, INK); p.set(x, y, blink ? '#ffffff' : '#ffd27a');
      });
      // the next dot to reach is marked
      const nextI = c.guide.findIndex((_, i) => !c.covered.has(i));
      if (nextI >= 0 && !c.stroke) { const [gx, gy] = c.guide[nextI]; ring(p, Math.round(TOP.x + gx * TOP.r), Math.round(TOP.y + gy * TOP.r), 3 + (Math.floor(now * 3) % 2), '#ffd27a'); }
      if (this.down && this.pointer) drawPitcherTop(p, ...this.pointer, c.cfg.color || C.foam);
      drawProgress(p, 150, 92, 26, c.covered.size / c.guide.length);
    }
    if (c.cfg.mech === 'shake' && this.pointer) {
      if (key === 'whisk') drawWhisk(p, ...this.pointer); else drawShaker(p, ...this.pointer, key === 'cocoa' ? '#5b3a26' : '#a0602a');
    }
    if (c.cfg.mech === 'shake') drawProgress(p, 150, 92, 26, c.count / c.cfg.count);
    if (key === 'choc') { if (this.spoon) drawSpoon(p, ...this.spoon); drawProgress(p, 150, 92, 26, Math.min(1, c.acc / (c.cfg.turns * Math.PI * 2))); if (!c.acc) { const a = now * 3; ring(p, Math.round(TOP.x + Math.cos(a) * 22), Math.round(TOP.y + Math.sin(a) * 22), 2, '#ffd27a'); } }
    if (key === 'marsh') { drawJar(p, 22, 80); drawCount(p, 22, 40, c.count, c.cfg.count, now); }
  }
}

// ---------- the static scenes ----------
function paintBar() {
  const p = new Pix(SW, SH);
  // tiled back wall
  for (let y = 0; y < 60; y++) for (let x = 0; x < SW; x++) {
    const row = Math.floor(y / 5), off = row % 2 ? 5 : 0;
    const grout = y % 5 === 4 || (x + off) % 10 === 9;
    p.set(x, y, grout ? '#d4bf98' : hash(Math.floor((x + off) / 10), row, 3) > 0.7 ? '#efe0c2' : '#e8d6b4');
  }
  p.rect(0, 0, SW, 3, '#5b3a26');
  // a shelf with jars of beans and cups
  p.rect(132, 14, 46, 2, '#9c6a42'); p.hline(132, 177, 16, '#5b3a26');
  for (const [x, h] of [[136, 9], [144, 7], [151, 9]]) { p.rect(x, 14 - h, 6, h, '#d9eef2'); p.rect(x + 1, 14 - h + 3, 4, h - 3, '#5a3420'); p.rect(x, 14 - h - 1, 6, 1, '#9c6a42'); p.vline(x, 14 - h, 13, INK); p.vline(x + 5, 14 - h, 13, INK); }
  for (const x of [161, 167]) { p.rect(x, 9, 5, 5, '#f7f1e6'); p.vline(x + 5, 10, 12, INK); p.hline(x, x + 4, 14, INK); }
  p.rect(172, 7, 3, 7, '#b8623f'); p.ellipse(173, 5, 2, 2, '#5c8f3f'); p.set(172, 4, '#7fb04c');
  // counter top and front
  for (let y = 60; y < 84; y++) for (let x = 0; x < SW; x++) p.set(x, y, y === 60 ? '#c08a55' : (Math.floor((x + (y % 2) * 3) / 24) + y) % 9 === 0 ? '#8a5a36' : y < 62 ? '#a87448' : '#9c6a42');
  p.hline(0, SW - 1, 84, INK);
  for (let y = 85; y < SH; y++) for (let x = 0; x < SW; x++) p.set(x, y, x % 30 === 0 || y === 86 ? '#4a2f20' : '#5b3a26');
  // espresso machine
  const mx0 = 44, mx1 = 124, my0 = 20, my1 = 60;
  p.rect(mx0, my0, mx1 - mx0, my1 - my0, '#c9cfd1');
  for (let x = mx0; x < mx1; x++) { p.set(x, my0, '#eef2f2'); if ((x - mx0) < 4) p.vline(x, my0, my1, '#e3e8e8'); if (mx1 - x < 6) p.vline(x, my0, my1, '#9aa2a4'); }
  p.rect(mx0, 26, mx1 - mx0, 7, '#b5483c'); p.hline(mx0, mx1 - 1, 26, '#c95a4c'); p.hline(mx0, mx1 - 1, 32, '#8e3329');
  p.rect(78, 28, 16, 3, '#f2d27a'); p.hline(80, 91, 29, '#b5483c');
  for (const gx of [56, 116]) { p.ellipse(gx, 42, 5, 5, INK); p.ellipse(gx, 42, 4, 4, '#fbf6ea'); p.line(gx, 42, gx + 2, 39, '#b5483c'); p.set(gx, 42, INK); }
  p.rect(76, 38, 20, 6, '#5f6668'); p.rect(78, 44, 16, 3, '#3a3f41'); p.rect(SPOUT.x - 2, 47, 5, 3, '#5f6668'); p.hline(mx0, mx1 - 1, my1 - 1, '#8d9496');
  // cups warming on top of the machine
  for (const x of [52, 62, 106]) { p.rect(x, 15, 7, 5, '#f7f1e6'); p.vline(x + 6, 15, 19, '#d9cfbf'); p.hline(x, x + 6, 14, INK); }
  // outline the machine
  p.hline(mx0 - 1, mx1, my0 - 1, INK); p.vline(mx0 - 1, my0, my1, INK); p.vline(mx1, my0, my1, INK);
  // drip tray on the counter
  p.rect(66, 76, 40, 4, '#5f6668'); for (let x = 67; x < 105; x += 3) p.vline(x, 77, 78, '#3a3f41'); p.hline(65, 106, 80, INK);
  // grinder
  for (let y = 12; y <= 32; y++) { const inset = Math.floor((32 - y) * 0.15); p.set(10 + inset, y, INK); p.set(28 - inset, y, INK); for (let x = 11 + inset; x <= 27 - inset; x++) p.set(x, y, '#d9eef2'); p.set(12 + inset, y, '#f4fbfc'); }
  p.hline(8, 30, 11, INK); p.rect(8, 9, 23, 2, '#3a3f41');
  p.rect(12, 33, 15, 26, '#8e3329'); p.vline(12, 33, 58, '#b5483c'); p.vline(26, 33, 58, '#73291f'); p.rect(11, 33, 17, 2, '#5f6668');
  p.rect(10, 58, 19, 3, '#5f6668'); p.hline(10, 28, 61, INK);
  p.rect(17, 46, 5, 3, '#3a3f41'); p.rect(CRANK.x - 6, CRANK.y - 1, 6, 2, '#5f6668');
  p.vline(11, 33, 58, INK); p.vline(27, 33, 58, INK);
  return p;
}

function paintTop(vessel) {
  const p = new Pix(SW, SH), V = VESSELS[vessel];
  // the counter from above
  for (let y = 0; y < SH; y++) for (let x = 0; x < SW; x++) {
    const plank = Math.floor(y / 12);
    p.set(x, y, y % 12 === 11 ? '#6e4630' : hash(Math.floor((x + plank * 37) / 40), plank, 2) > 0.5 ? '#9c6a42' : '#956240');
    if (hash(x, y, 5) > 0.985) p.set(x, y, '#8a5a36');
  }
  const disk = (r, c) => { for (let y = -r; y <= r; y++) for (let x = -r; x <= r; x++) if (x * x + y * y <= r * r + r * 0.6) p.set(TOP.x + x, TOP.y + y, typeof c === 'function' ? c(x, y) : c); };
  // soft shadow, saucer, handle and the rim
  disk(TOP.r + 10, '#00000033');
  if (V.big.saucer) { disk(TOP.r + 12, INK); disk(TOP.r + 11, (x, y) => (x + y < -20 ? '#fffaf2' : x + y > 24 ? '#d9cfbf' : '#ece4d6')); disk(TOP.r + 7, '#d9cfbf'); }
  const body = V.ceramic ? V.body : '#e6f3f5';
  if (V.handle) { p.rect(TOP.x + TOP.r + 2, TOP.y - 4, 12, 8, INK); p.rect(TOP.x + TOP.r + 2, TOP.y - 3, 11, 6, body); p.hline(TOP.x + TOP.r + 2, TOP.x + TOP.r + 12, TOP.y - 3, shade(body, 1.08)); }
  const rim = V.ceramic ? 5 : 3;
  disk(TOP.r + rim + 1, INK);
  disk(TOP.r + rim, (x, y) => (x + y < -TOP.r ? shade(body, 1.08) : x + y > TOP.r ? shade(body, 0.85) : body));
  disk(TOP.r, V.ceramic ? shade(body, 0.8) : '#cfe3e6');
  return p;
}

// ---------- props ----------
function drawPortafilter(p, x, y, grounds, tamped) {
  p.rect(x - 14, y + 1, 9, 3, '#2e2019'); p.hline(x - 14, x - 6, y + 1, '#4a3428');
  p.rect(x - 6, y, 13, 5, '#8d9496'); p.hline(x - 6, x + 6, y, '#c9cfd1'); p.hline(x - 6, x + 6, y + 5, INK);
  p.set(x - 7, y + 1, INK); p.set(x + 7, y + 1, INK);
  if (grounds > 0) {
    const h = Math.max(1, Math.round(grounds * 3)) - (tamped > 0.5 ? 1 : 0);
    for (let i = 0; i < h; i++) p.hline(x - 5 + (tamped > 0.5 ? 0 : i), x + 5 - (tamped > 0.5 ? 0 : i), y - 1 - i, i % 2 ? '#3b2014' : '#4a2a18');
  }
}
function rotPts(pts, cx, cy, a) { const c = Math.cos(a), s = Math.sin(a); return pts.map(([x, y]) => [cx + x * c - y * s, cy + x * s + y * c]); }
function drawJug(p, cx, by, angle, milk = 0, milkC = C.milk) {
  const pc = [cx, by - 8];
  const body = [[-6, 8], [6, 8], [5, -6], [7, -9], [-5, -8]];
  const out = rotPts(body.map(([x, y]) => [x * 1.18, y * 1.12]), ...pc, angle);
  p.poly(out, INK);
  p.poly(rotPts(body, ...pc, angle), '#c9cfd1');
  p.poly(rotPts([[-6, 8], [-3, 8], [-3, -7], [-5, -8]], ...pc, angle), '#e3e8e8');
  p.poly(rotPts([[3, 8], [6, 8], [5, -6], [3, -6]], ...pc, angle), '#9aa2a4');
  const handle = rotPts([[-6, -4], [-10, -3], [-10, 4], [-6, 5], [-6, 3], [-8, 2], [-8, -1], [-6, -2]], ...pc, angle);
  p.poly(handle, '#5f6668');
  if (milk > 0 && angle === 0) { p.hline(cx - 5, cx + 4, by - 16 + 0, shade(milkC, 0.9)); }
}
function drawBucket(p, x, by) {
  p.poly([[x - 9, by - 12], [x + 9, by - 12], [x + 7, by], [x - 7, by]], INK);
  p.poly([[x - 8, by - 11], [x + 8, by - 11], [x + 6, by - 1], [x - 6, by - 1]], '#c9cfd1');
  p.hline(x - 8, x + 8, by - 11, '#eef2f2');
  for (let i = 0; i < 5; i++) { const ix = x - 7 + i * 3; p.rect(ix, by - 15 + (i % 2), 4, 4, '#eef9fb'); p.hline(ix, ix + 3, by - 16 + (i % 2), '#a9d3dc'); }
}
function drawBerries(p, x, by, k) {
  p.ellipse(x, by - 3, 10, 3, INK); p.ellipse(x, by - 3, 9, 2, '#f7f1e6');
  p.rect(x - 8, by - 3, 17, 3, '#f7f1e6'); p.hline(x - 8, x + 8, by, INK);
  for (let i = 0; i < Math.round(5 * (1 - k)); i++) { const bx = x - 7 + i * 3; p.rect(bx, by - 7, 3, 3, C.berry); p.set(bx + 1, by - 8, '#5c8f3f'); p.set(bx, by - 6, '#ffd0d8'); }
}
function drawCreamCan(p, x, y, on) {
  p.rect(x - 3, y - 18, 7, 14, '#eef2f2'); p.vline(x + 3, y - 18, y - 5, '#b8bec0'); p.rect(x - 3, y - 13, 7, 4, '#e7a0a6');
  p.rect(x - 1, y - 4, 3, 3, '#f7f1e6'); p.set(x, y - 1, '#ffffff');
  p.vline(x - 4, y - 18, y - 5, INK); p.vline(x + 4, y - 18, y - 5, INK); p.hline(x - 3, x + 3, y - 19, INK);
  if (on) for (let i = 0; i < 3; i++) p.set(x + i - 1, y + 1 + (i % 2), '#ffffff');
}
function drawMeter(p, x, y, h, v, [lo, hi], temp) {
  p.rect(x - 1, y - 1, 8, h + 2, INK); p.rect(x, y, 6, h, '#3b261a');
  const yv = (f) => Math.round(y + h - f * h / 1.15);
  p.rect(x, yv(hi), 6, yv(lo) - yv(hi), '#d29b3a'); p.hline(x, x + 5, yv(hi), '#ffd27a'); p.hline(x, x + 5, yv(lo), '#ffd27a');
  const fy = yv(Math.min(1.15, v));
  p.rect(x + 1, fy, 4, y + h - fy, temp ? (v > hi ? '#e46a5a' : '#ff9a6a') : '#fbf6ea');
  p.hline(x - 2, x + 7, fy, INK); p.set(x - 3, fy, '#ffd27a'); p.set(x + 8, fy, '#ffd27a');
  if (temp) { p.ellipse(x + 3, y + h + 3, 3, 3, INK); p.ellipse(x + 3, y + h + 3, 2, 2, '#ff9a6a'); }
}
function drawTimingBar(p, x, y, w, pos) {
  p.rect(x - 1, y - 1, w + 2, 6, INK); p.rect(x, y, w, 4, '#3b261a');
  p.rect(x + Math.round(w * 0.42), y, Math.round(w * 0.16), 4, '#d29b3a');
  p.rect(x + Math.round(w * 0.47), y, Math.round(w * 0.06), 4, '#ffd27a');
  const mx = x + Math.round(pos * (w - 1));
  p.rect(mx - 1, y - 3, 3, 10, '#fbf6ea'); p.vline(mx - 2, y - 3, y + 6, INK); p.vline(mx + 2, y - 3, y + 6, INK);
}
function drawProgress(p, x, y, w, k) {
  p.rect(x - 1, y - 1, w + 2, 5, INK); p.rect(x, y, w, 3, '#3b261a'); p.rect(x, y, Math.round(w * Math.min(1, k)), 3, '#ffd27a');
}
function drawCount(p, x, y, n, of, now) {
  for (let i = 0; i < of; i++) {
    const cx = x - (of - 1) * 3 + i * 6;
    p.rect(cx - 2, y - 2, 5, 5, INK); p.rect(cx - 1, y - 1, 3, 3, i < n ? '#ffd27a' : '#3b261a');
  }
  if (n === 0) { const b = Math.floor(now * 3) % 2; p.set(x, y + 6 + b, '#ffd27a'); p.hline(x - 1, x + 1, y + 5 + b, '#ffd27a'); }
}
function sparkle(p, x, y, big) {
  p.set(x, y, '#ffffff');
  for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) p.set(x + dx, y + dy, '#ffd27a');
  if (big) for (const [dx, dy] of [[2, 0], [-2, 0], [0, 2], [0, -2]]) p.set(x + dx, y + dy, '#ffd27a88');
}
function ring(p, cx, cy, r, c) { for (let a = 0; a < 24; a++) p.set(Math.round(cx + Math.cos(a / 24 * 6.283) * r), Math.round(cy + Math.sin(a / 24 * 6.283) * r), c); }
function drawPitcherTop(p, x, y, milk) {
  p.ellipse(Math.round(x) + 9, Math.round(y) - 9, 8, 8, INK); p.ellipse(Math.round(x) + 9, Math.round(y) - 9, 7, 7, '#c9cfd1'); p.ellipse(Math.round(x) + 9, Math.round(y) - 9, 5, 5, milk);
  p.line(x, y, x + 5, y - 5, '#c9cfd1'); p.set(x, y, milk);
}
function drawShaker(p, x, y, lid) {
  x = Math.round(x); y = Math.round(y) - 8;
  p.ellipse(x, y, 6, 6, INK); p.ellipse(x, y, 5, 5, lid); p.ellipse(x, y, 3, 3, shade(lid, 1.2));
  for (const [dx, dy] of [[-1, -1], [1, -1], [0, 1], [-2, 1], [2, 1]]) p.set(x + dx, y + dy, INK);
}
function drawWhisk(p, x, y) {
  x = Math.round(x); y = Math.round(y);
  p.ellipse(x, y, 5, 4, '#e9d6a8'); for (let i = -4; i <= 4; i += 2) p.line(x, y, x + i, y - 4, '#c9a46b');
  p.rect(x - 1, y - 14, 3, 10, '#c9a46b'); p.vline(x - 2, y - 14, y - 5, INK); p.vline(x + 2, y - 14, y - 5, INK);
}
function drawSpoon(p, x, y) {
  x = Math.round(x); y = Math.round(y);
  p.ellipse(x, y, 3, 2, '#c9cfd1'); p.set(x - 1, y - 1, '#eef2f2');
  p.line(x + 2, y - 1, x + 12, y - 9, '#8d9496'); p.line(x + 3, y - 1, x + 13, y - 9, INK);
}
function drawJar(p, x, by) {
  p.rect(x - 9, by - 22, 19, 22, INK); p.rect(x - 8, by - 21, 17, 20, '#d9eef2');
  p.rect(x - 9, by - 25, 19, 4, '#c9786f'); p.hline(x - 9, x + 9, by - 25, INK);
  for (let i = 0; i < 9; i++) { const mx = x - 7 + (i % 3) * 5, my = by - 6 - Math.floor(i / 3) * 5; p.rect(mx, my, 4, 4, i % 2 ? C.marshPink : C.marsh); }
}

const STAR = ['..o..', '.oyo.', 'oyyyo', '.oyo.', 'o.o.o'];
function starRow(n, small = false) {
  return `<span class="stars${small ? ' small' : ''}">${[1, 2, 3].map((i) => `<i class="${i <= n ? 'on' : ''}"></i>`).join('')}</span>`;
}
const escapeHtml = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export { STAR, EXTRAS };
