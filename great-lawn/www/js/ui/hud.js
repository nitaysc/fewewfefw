// The HUD: progress, ale and cigar, blades, notices, and the engraved plan of the lawn that
// fills in with stripes as you mow.
import { MAP, LAWN, HOUSE, FORECOURT, ISLAND, HEDGES, BORDER, FEATURES, HAHA } from '../world/layout.js';
import { GRID } from '../world/cutmap.js';

const $ = (id) => document.getElementById(id);
const ordinal = (n) => `No. ${n}`;

// plan window in world metres (north up)
const PX0 = -76, PX1 = 76, PZ0 = -64, PZ1 = 74;
const CELL = MAP.size / GRID; // 0.5 m

export class Hud {
  constructor(game) {
    this.game = game;
    this.el = {
      root: $('hud'), pct: $('pct'), pctBar: $('pctBar'), beerBar: $('beerBar'), beerCount: $('beerCount'),
      cigarBar: $('cigarBar'), cigarCount: $('cigarCount'), blades: $('bladesState'), toast: $('toast'), prompt: $('prompt'), fps: $('fps'),
      plan: $('planCanvas'), tAction: $('tAction'), tBlades: $('tBlades'),
    };
    // plan canvas: one pixel per 0.5 m cell
    const W = Math.round((PX1 - PX0) / CELL), H = Math.round((PZ1 - PZ0) / CELL);
    this.W = W; this.H = H;
    const cv = this.el.plan;
    cv.width = W; cv.height = H;
    cv.style.aspectRatio = `${W} / ${H}`;
    this.ctx = cv.getContext('2d');
    this.base = this.drawBase(W, H);
    this.mown = document.createElement('canvas'); this.mown.width = W; this.mown.height = H;
    this.mctx = this.mown.getContext('2d');
    this.img = this.mctx.createImageData(W, H);
    this.dirty = true;
    this.i0 = Math.round((PX0 - MAP.min) / CELL); this.j0 = Math.round((PZ0 - MAP.min) / CELL);
    game.cutmap.listeners.push((i, j, dir) => this.paintCell(i, j, dir));
    this.toastTimer = 0; this.last = {};
    this.planTimer = 0; this.textTimer = 0;
  }

  // engraving of the house, lawn and gardens on paper
  drawBase(W, H) {
    const c = document.createElement('canvas'); c.width = W; c.height = H;
    const x = c.getContext('2d');
    x.fillStyle = '#e8dec6'; x.fillRect(0, 0, W, H);
    for (let i = 0; i < 2500; i++) { x.fillStyle = `rgba(110,90,60,${Math.random() * 0.06})`; x.fillRect(Math.random() * W, Math.random() * H, 1 + Math.random() * 2, 1); }
    const s = 1 / CELL;
    x.setTransform(s, 0, 0, s, -PX0 * s, -PZ0 * s);
    const ink = '#4a3a26';
    x.strokeStyle = ink; x.fillStyle = ink; x.lineWidth = 0.5;
    const rect = (o, fill) => { if (fill) { x.fillStyle = fill; x.fillRect(o.x0, o.z0, o.x1 - o.x0, o.z1 - o.z0); x.fillStyle = ink; } x.strokeRect(o.x0, o.z0, o.x1 - o.x0, o.z1 - o.z0); };
    // gravel
    x.fillStyle = '#d9cba9';
    x.beginPath(); x.roundRect(FORECOURT.x0, FORECOURT.z0, FORECOURT.x1 - FORECOURT.x0, FORECOURT.z1 - FORECOURT.z0, 6); x.fill();
    x.fillStyle = ink;
    // house (hatched)
    const hatch = (o) => {
      x.save(); x.beginPath(); x.rect(o.x0, o.z0, o.x1 - o.x0, o.z1 - o.z0); x.clip();
      x.lineWidth = 0.35;
      for (let k = o.x0 - 30; k < o.x1 + 30; k += 1.6) { x.beginPath(); x.moveTo(k, o.z0); x.lineTo(k + (o.z1 - o.z0), o.z1); x.stroke(); }
      x.restore(); x.lineWidth = 0.6; rect(o);
    };
    hatch(HOUSE.main); hatch(HOUSE.portico); HOUSE.colonnades.forEach(hatch); HOUSE.pavilions.forEach(hatch);
    // lawn outline
    x.lineWidth = 0.8;
    x.beginPath(); x.roundRect(LAWN.x0, LAWN.z0, LAWN.x1 - LAWN.x0, LAWN.z1 - LAWN.z0, LAWN.r); x.stroke();
    x.lineWidth = 0.5;
    // island and fountain
    x.beginPath(); x.arc(ISLAND.x, ISLAND.z, ISLAND.r, 0, Math.PI * 2); x.stroke();
    x.beginPath(); x.arc(ISLAND.x, ISLAND.z, ISLAND.basin, 0, Math.PI * 2); x.fillStyle = '#9fb3b4'; x.fill(); x.stroke(); x.fillStyle = ink;
    // hedges and border
    for (const h of HEDGES) { x.fillStyle = '#5e6b45'; x.fillRect(h.x0, h.z0, h.x1 - h.x0, h.z1 - h.z0); }
    x.fillStyle = 'rgba(160,90,110,0.35)'; x.fillRect(BORDER.x0, BORDER.z0, BORDER.x1 - BORDER.x0, BORDER.z1 - BORDER.z0);
    x.fillStyle = ink;
    // ha-ha
    x.setLineDash([2, 1.2]); x.beginPath(); x.moveTo(PX0, HAHA.z); x.lineTo(PX1, HAHA.z); x.stroke(); x.setLineDash([]);
    // trees as engraved circles
    const tree = (tx, tz, r) => {
      x.beginPath();
      for (let a = 0; a <= Math.PI * 2 + 0.01; a += Math.PI / 9) { const rr = r * (0.88 + 0.12 * Math.sin(a * 5)); x.lineTo(tx + Math.cos(a) * rr, tz + Math.sin(a) * rr); }
      x.stroke();
      x.beginPath(); x.arc(tx, tz, 0.6, 0, Math.PI * 2); x.fill();
    };
    tree(FEATURES.cedar.x, FEATURES.cedar.z, 13); tree(FEATURES.oak.x, FEATURES.oak.z, 9);
    for (const t of FEATURES.topiary) { x.beginPath(); x.arc(t.x, t.z, 0.9, 0, Math.PI * 2); x.fill(); }
    for (const u of FEATURES.urns) x.fillRect(u.x - 0.6, u.z - 0.6, 1.2, 1.2);
    x.fillRect(FEATURES.statue.x - 1.1, FEATURES.statue.z - 1.1, 2.2, 2.2);
    x.beginPath(); x.arc(FEATURES.sundial.x, FEATURES.sundial.z, 0.8, 0, Math.PI * 2); x.fill();
    x.setTransform(1, 0, 0, 1, 0, 0);
    // a compass arrow and a scale bar
    x.fillStyle = ink; x.font = `italic ${Math.round(H * 0.045)}px Georgia, serif`;
    x.fillText('N', W - 18, 20);
    x.beginPath(); x.moveTo(W - 14, 26); x.lineTo(W - 18, 40); x.lineTo(W - 10, 40); x.closePath(); x.fill();
    return c;
  }

  paintCell(i, j, dir) {
    const px = i - this.i0, py = j - this.j0;
    if (px < 0 || py < 0 || px >= this.W || py >= this.H) return;
    // stripes on the plan: shade by direction of travel
    const a = (dir / 255) * Math.PI * 2;
    const k = 0.5 + 0.5 * Math.cos(a * 2) * Math.sign(Math.cos(a) + 1e-3);
    const o = (py * this.W + px) * 4, d = this.img.data;
    d[o] = 92 + 34 * k; d[o + 1] = 128 + 34 * k; d[o + 2] = 62 + 18 * k; d[o + 3] = 200;
    this.dirty = true;
  }

  toast(text, seconds = 3.2) {
    const t = this.el.toast;
    t.textContent = text; t.classList.add('show');
    this.toastTimer = seconds;
  }
  setPrompt(text) {
    if (this.last.prompt === text) return;
    this.last.prompt = text;
    this.el.prompt.textContent = text || '';
  }

  update(dt, fps) {
    const g = this.game, ck = g.cockpit, v = g.vehicle;
    this.textTimer -= dt;
    if (this.textTimer <= 0) {
      this.textTimer = 0.2;
      const pct = (g.cutmap.progress * 100);
      const txt = `${pct < 10 ? pct.toFixed(1) : pct.toFixed(pct >= 99.95 ? 0 : 1)}%`;
      if (this.last.pct !== txt) { this.el.pct.textContent = txt; this.el.pctBar.style.width = `${Math.min(100, pct)}%`; this.last.pct = txt; }
      this.el.beerBar.style.width = `${Math.round(ck.bottle.fill * 100)}%`;
      this.el.beerBar.parentElement.parentElement.classList.toggle('low', ck.bottle.fill < 0.2);
      this.el.cigarBar.style.width = `${Math.round(ck.cigarLeft * 100)}%`;
      if (this.last.beers !== ck.bottles) { this.el.beerCount.textContent = ordinal(ck.bottles); this.last.beers = ck.bottles; }
      if (this.last.cigars !== ck.cigars) { this.el.cigarCount.textContent = ordinal(ck.cigars); this.last.cigars = ck.cigars; }
      if (this.last.blades !== g.bladesOn) {
        this.el.blades.textContent = g.bladesOn ? 'Engaged' : 'Disengaged';
        this.el.blades.classList.toggle('on', g.bladesOn);
        this.el.tBlades.classList.toggle('on', g.bladesOn);
        this.last.blades = g.bladesOn;
      }
      // contextual prompts
      let p = '';
      const touch = document.body.classList.contains('touch');
      if (ck.bottle.fill <= 0.001 && !ck.swapping) p = touch ? 'Tap “New bottle” for a fresh ale' : 'R  ·  Open a fresh bottle from the crate';
      else if (ck.cigarLeft <= 0.02) p = touch ? 'Tap “New cigar” to light another' : 'R  ·  Light a fresh cigar';
      else if (ck.cigar.ashLen > 0.024) p = touch ? '' : 'F  ·  Tap the ash';
      this.setPrompt(p);
      const act = this.el.tAction;
      const want = ck.bottle.fill <= 0.001 ? 'New bottle' : ck.cigarLeft <= 0.02 ? 'New cigar' : '';
      if (act.textContent !== want) act.textContent = want;
      act.hidden = !want;
      if (fps !== undefined && !this.el.fps.hidden) this.el.fps.textContent = `${fps.toFixed(0)} fps · ${(g.grass.bladeCount / 1000).toFixed(0)}k blades · ${g.qualityName}`;
    }
    if (this.toastTimer > 0) { this.toastTimer -= dt; if (this.toastTimer <= 0) this.el.toast.classList.remove('show'); }

    // plan: redraw a few times a second
    this.planTimer -= dt;
    if (this.planTimer <= 0) {
      this.planTimer = 0.15;
      if (this.dirty) { this.mctx.putImageData(this.img, 0, 0); this.dirty = false; }
      const c = this.ctx;
      c.drawImage(this.base, 0, 0);
      c.drawImage(this.mown, 0, 0);
      // mower
      const s = 1 / CELL, mx = (v.x - PX0) * s, mz = (v.z - PZ0) * s;
      c.save(); c.translate(mx, mz); c.rotate(-v.heading);
      c.fillStyle = '#7a1d14'; c.strokeStyle = '#f2e9d2'; c.lineWidth = 1.5;
      c.beginPath(); c.moveTo(0, -7); c.lineTo(4.5, 5); c.lineTo(0, 2.5); c.lineTo(-4.5, 5); c.closePath(); c.fill(); c.stroke();
      c.restore();
    }
  }
}
