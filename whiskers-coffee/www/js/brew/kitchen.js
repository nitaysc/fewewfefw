// The kitchen: plating food by hand. Choose the base (a cake slice, a salad bowl, toast...)
// and then put things on it your own way: tap or drag ingredients onto the plate, drag
// them around to arrange them, draw sauces with a finger, swipe shakers over it. Drag
// something off the plate and it falls on the counter. The recipe only asks for a few
// things; the rest is decoration.
import { Pix, shade, hash } from '../art/pix.js';
import { INGREDIENTS, SAUCES, SHAKERS, BASES, FOODS, newPlate, drawPlate, scorePlate, countOf, ingName, kindOf } from '../art/foods.js';
import { starsFor } from '../art/drinks.js';
import { t } from '../i18n.js';

const SW = 120, SH = 80, INK = '#24160f';
const PL = { x: 55, y: 42, r: 36 };
const REFUSE_BELOW = 0.35;
export const KTABS = [['plates', 'Plates'], ['fruit', 'Fruit'], ['sweet', 'Sweet'], ['veg', 'Savoury'], ['sauce', 'Sauces'], ['shake', 'Toppings']];
const tabOf = (k) => (BASES[k] ? 'plates' : SAUCES[k] ? 'sauce' : SHAKERS[k] ? 'shake' : INGREDIENTS[k].cat);

export class Kitchen {
  constructor(els, hooks) {
    this.el = els; this.hooks = hooks;
    this.small = document.createElement('canvas'); this.small.width = SW; this.small.height = SH;
    this.sg = this.small.getContext('2d');
    this.g = els.canvas.getContext('2d');
    this.bg = paintCounter();
    this.icons = new Map();
    this.open = false;
    const c = els.canvas;
    const pt = (e) => { const r = c.getBoundingClientRect(), dpr = this.dpr || 1; return [((e.clientX - r.left) * dpr - this.ox) / this.scale, ((e.clientY - r.top) * dpr - this.oy) / this.scale]; };
    c.addEventListener('pointerdown', (e) => { c.setPointerCapture(e.pointerId); this.down = true; this.input('down', ...pt(e)); });
    c.addEventListener('pointermove', (e) => this.input('move', ...pt(e)));
    const up = (e) => { if (!this.down) return; this.down = false; this.input('up', ...pt(e)); };
    c.addEventListener('pointerup', up); c.addEventListener('pointercancel', up);
    els.close.addEventListener('click', () => { this.hide(); hooks.close(); });
    els.tabs.addEventListener('click', (e) => { const b = e.target.closest('[data-tab]'); if (b) { this.tab = b.dataset.tab; hooks.sound('click'); this.renderTools(); } });
    els.tools.addEventListener('click', (e) => { const b = e.target.closest('[data-tool]'); if (b) this.pick(b.dataset.tool); });
    els.serve.addEventListener('click', () => this.tryServe());
    els.wipe.addEventListener('click', () => this.undo());
    els.bin.addEventListener('click', () => this.binIt());
    els.end.addEventListener('click', (e) => {
      if (e.target.closest('[data-serve]')) { this.hide(); hooks.done(this.quality); }
      if (e.target.closest('[data-keep]')) { this.result = null; this.el.end.innerHTML = ''; this.renderTools(); }
    });
    // the shelf below can change height, so follow the stage's real size
    new ResizeObserver(() => this.open && this.resize()).observe(c.parentElement);
  }

  start(food, forName) {
    this.food = food; this.forName = forName;
    this.pl = newPlate(null);
    this.hist = []; this.fx = []; this.result = null; this.tool = null; this.drag = null; this.tab = 'plates';
    this.open = true;
    this.el.root.hidden = false;
    this.el.title.textContent = t(FOODS[food].name);
    this.el.for.textContent = forName ? t('for {name}', { name: forName }) : '';
    this.el.end.innerHTML = '';
    this.el.wipe.hidden = false;
    this.resize();
    this.renderTools();
    this.el.hint.textContent = t('Pick a plate to start');
    const loop = (now) => { if (!this.open) return; requestAnimationFrame(loop); this.draw(now / 1000); };
    requestAnimationFrame(loop);
  }
  hide() { this.open = false; this.el.root.hidden = true; }
  resize() {
    const c = this.el.canvas, dpr = Math.min(window.devicePixelRatio || 1, 3);
    this.dpr = dpr;
    c.width = Math.round(c.clientWidth * dpr); c.height = Math.round(c.clientHeight * dpr);
    this.scale = Math.max(1, Math.min(c.width / SW, c.height / SH));
    this.ox = Math.round((c.width - SW * this.scale) / 2); this.oy = Math.round((c.height - SH * this.scale) / 2);
  }

  pick(k) {
    if (this.result) return;
    this.hooks.sound('click');
    if (BASES[k]) {
      if (this.pl.base && (this.pl.items.length || this.pl.strokes.length || this.pl.dust.length)) { this.say('Put this plate in the bin first to change the base'); return; }
      this.pl.base = k === 'plate' ? 'plate' : k; this.hist.push({ op: 'base' });
      this.hooks.sound('plate');
      const sug = this.suggest(); if (sug) this.tab = tabOf(sug);
      this.el.hint.textContent = t('Now add what goes on it. Drag things around to arrange them');
      return this.renderTools();
    }
    if (!this.pl.base) { this.say('Pick a plate first'); return; }
    this.tool = k;
    const kind = kindOf(k);
    this.el.hint.textContent = t(kind === 'sauce' ? 'Draw on the plate with your finger to add the sauce' : kind === 'shake' ? 'Swipe back and forth over the plate to sprinkle' : 'Tap the plate to place it, drag to move things, drag off to remove');
    this.renderTools();
  }
  say(text) { this.hooks.toast(t(text)); this.hooks.sound('nope'); }

  suggest() {
    const f = FOODS[this.food];
    if (this.pl.base !== f.base) return f.base;
    for (const [k, n] of Object.entries(f.need)) if (countOf(this.pl, k) < n) return k;
    return null;
  }

  // plate coordinates: x, y in -1..1 over the plate's surface
  toPlate(x, y) { return [(x - PL.x) / (PL.r * 0.8), (y - PL.y) / (PL.r * 0.66)]; }
  onPlate(x, y) { return ((x - PL.x) / PL.r) ** 2 + ((y - PL.y) / (PL.r * 0.82)) ** 2 <= 1; }
  itemAt(x, y) {
    let best = -1, bd = 5;
    this.pl.items.forEach((it, i) => { const sx = PL.x + it.x * PL.r * 0.8, sy = PL.y + it.y * PL.r * 0.66, d = Math.hypot(sx - x, sy - y); if (d < bd) { bd = d; best = i; } });
    return best;
  }

  input(kind, x, y) {
    if (this.result) return;
    this.pointer = [x, y];
    const pl = this.pl, k = this.tool, type = k && kindOf(k);
    if (kind === 'down') {
      const hit = this.itemAt(x, y);
      if (hit >= 0 && type !== 'sauce' && type !== 'shake') { this.drag = { i: hit, moved: false }; return; }
      if (!pl.base) { this.say('Pick a plate first'); return; }
      if (!k) { this.say('Pick something from the shelves below'); return; }
      if (type === 'item') {
        const [px, py] = this.toPlate(x, y);
        pl.items.push({ k, x: px, y: py, r: Math.floor(Math.random() * 4) });
        this.hist.push({ op: 'item' });
        this.drag = { i: pl.items.length - 1, moved: false, fresh: true };
        this.hooks.sound('plop');
      } else if (type === 'sauce') {
        this.stroke = { k, pts: [this.toPlate(x, y)] }; pl.strokes.push(this.stroke); this.hist.push({ op: 'stroke' }); this.hooks.sound('pour');
      } else if (type === 'shake') { this.lastX = x; this.dir = 0; this.travel = 0; this.shakeStart = pl.dust.length; }
    } else if (kind === 'move' && this.down) {
      if (this.drag) { const it = pl.items[this.drag.i]; if (it) { [it.x, it.y] = this.toPlate(x, y); this.drag.moved = true; } }
      else if (this.stroke) { const p = this.toPlate(x, y), l = this.stroke.pts[this.stroke.pts.length - 1]; if (Math.hypot(p[0] - l[0], p[1] - l[1]) > 0.05) this.stroke.pts.push(p); }
      else if (type === 'shake' && this.lastX != null) {
        const dx = x - this.lastX; this.lastX = x;
        if (dx) {
          const dir = Math.sign(dx);
          if (dir !== this.dir) {
            if (this.travel > 4) {
              const c = SHAKERS[k].c;
              for (let i = 0; i < 7; i++) { const px = x + (Math.random() - 0.5) * 14, py = y + (Math.random() - 0.5) * 10; if (this.onPlate(px, py)) pl.dust.push([...this.toPlate(px, py), c, k]); }
              this.hooks.sound('shake'); this.renderCard();
            }
            this.dir = dir; this.travel = 0;
          }
          this.travel += Math.abs(dx);
        }
      }
    } else if (kind === 'up') {
      if (this.drag) {
        const it = pl.items[this.drag.i];
        // dropped off the plate: it falls onto the counter
        if (it && !this.onPlate(x, y)) {
          pl.items.splice(this.drag.i, 1);
          if (!this.drag.fresh) pl.dropped++;
          this.fx.push({ kind: 'fall', k: it.k, x, y, t: 0 });
          this.hooks.sound('drop');
          if (this.drag.fresh) this.hist.pop();
        }
        this.drag = null;
      }
      if (this.stroke) { if (this.stroke.pts.length < 3) { pl.strokes.pop(); this.hist.pop(); } this.stroke = null; }
      if (type === 'shake' && pl.dust.length > this.shakeStart) this.hist.push({ op: 'dust', from: this.shakeStart });
      this.lastX = null;
      this.renderCard();
    }
  }

  undo() {
    if (this.result) return;
    const h = this.hist.pop();
    if (!h) return;
    const pl = this.pl;
    if (h.op === 'item') pl.items.pop();
    if (h.op === 'stroke') pl.strokes.pop();
    if (h.op === 'dust') pl.dust.length = h.from;
    if (h.op === 'base') pl.base = null;
    this.hooks.sound('click');
    this.renderTools();
  }
  binIt() {
    if (this.result || !this.pl.base) return;
    if (!this.binArmed || performance.now() - this.binArmed > 2500) { this.binArmed = performance.now(); this.hooks.toast(t('Tap the bin again to throw this plate away')); return; }
    this.binArmed = 0;
    this.pl = newPlate(null); this.hist = []; this.tool = null; this.tab = 'plates';
    this.hooks.sound('bin');
    this.el.hint.textContent = t('Fresh start! Pick a plate');
    this.renderTools();
  }

  tryServe() {
    if (this.result) return;
    if (!this.pl.base) { this.say('Pick a plate first'); return; }
    const r = scorePlate(this.food, this.pl);
    this.quality = r.q; this.result = r; this.tool = null;
    const stars = starsFor(r.q), bad = r.q < REFUSE_BELOW;
    const notes = r.notes.slice(0, 3).map((n) => `<li>${n.startsWith('Needs more: ') ? t('Needs more: {thing}', { thing: t(n.slice(12)) }) : t(n)}</li>`).join('');
    this.el.end.innerHTML = `<div class="st-rating">${bad ? `<b class="oops">${t('Oops!')}</b>` : starRow(stars)}</div>`
      + (notes ? `<ul class="st-notes">${notes}</ul>` : `<p class="st-good">${t('Just like the recipe!')}</p>`)
      + (bad ? `<p class="st-warn">${t('This does not look like {drink}. They may ask for a new one.', { drink: t(FOODS[this.food].name) })}</p>` : '')
      + `<button class="btn primary" data-serve>${t('Take it to {name}', { name: this.forName || t('the customer') })}</button><button class="btn" data-keep>${t('Keep working')}</button>`;
    this.hooks.sound(bad ? 'nope' : 'done');
    this.renderTools();
  }

  renderCard() {
    const f = FOODS[this.food], pl = this.pl;
    const rows = [`<li class="${pl.base === f.base ? 'done' : pl.base ? 'off' : ''}"><span>${t(BASES[f.base].name)}</span>${pl.base === f.base ? '<span class="tick"></span>' : ''}</li>`];
    for (const [k, n] of Object.entries(f.need)) {
      const have = countOf(pl, k), ok = have >= n;
      rows.push(`<li class="${ok ? 'done' : ''}"><span>${t(ingName(k))}</span><small>${kindOf(k) === 'item' ? `${Math.min(have, 99)}/${n}` : ''}</small>${ok ? '<span class="tick"></span>' : ''}</li>`);
    }
    rows.push(`<li class="free"><span>${t('+ anything you like')}</span></li>`);
    this.el.needs.innerHTML = rows.join('');
    this.el.serve.disabled = !!this.result;
  }

  renderTools() {
    const sug = this.result ? null : this.suggest(), sugTab = sug ? tabOf(sug) : null;
    this.el.tabs.innerHTML = KTABS.map(([k, n]) => `<button class="chip${this.tab === k ? ' on' : ''}${sugTab === k && this.tab !== k ? ' glow' : ''}" data-tab="${k}">${t(n)}</button>`).join('');
    const keys = [...Object.keys(BASES), ...Object.keys(INGREDIENTS), ...Object.keys(SAUCES), ...Object.keys(SHAKERS)].filter((k) => tabOf(k) === this.tab);
    this.el.tools.innerHTML = keys.map((k) => `<button class="tool${this.tool === k || this.pl.base === k ? ' on' : ''}${sug === k ? ' glow' : ''}" data-tool="${k}"><img src="${this.icon(k)}" alt=""><span>${t(ingName(k))}</span></button>`).join('');
    this.renderCard();
  }
  icon(k) { if (!this.icons.has(k)) this.icons.set(k, ingIcon(k).toCanvas(3).toDataURL()); return this.icons.get(k); }

  draw(now) {
    const p = new Pix(SW, SH);
    p.data.set(this.bg.data);
    drawPlate(p, PL.x, PL.y, this.pl, PL.r);
    if (!this.pl.base && Math.floor(now * 2) % 2) for (let a = 0; a < 40; a++) p.set(Math.round(PL.x + Math.cos(a / 40 * 6.283) * (PL.r + 3)), Math.round(PL.y + Math.sin(a / 40 * 6.283) * (PL.r * 0.82 + 3)), '#ffd27a');
    if (this.drag && this.pointer) { const [x, y] = this.pointer; for (let a = 0; a < 12; a++) p.set(Math.round(x + Math.cos(a / 12 * 6.283) * 5), Math.round(y + Math.sin(a / 12 * 6.283) * 5), this.onPlate(x, y) ? '#ffd27a' : '#e46a5a'); }
    if (this.tool && kindOf(this.tool) === 'shake' && this.pointer && this.down) { const [x, y] = this.pointer; p.rect(Math.round(x) - 4, Math.round(y) - 14, 8, 10, INK); p.rect(Math.round(x) - 3, Math.round(y) - 13, 6, 8, '#f4ecd6'); p.rect(Math.round(x) - 4, Math.round(y) - 16, 8, 3, SHAKERS[this.tool].c === '#ffffff' ? '#c9cfd1' : SHAKERS[this.tool].c); }
    this.fx = this.fx.filter((f) => now - (f.t0 ??= now) < 0.8);
    for (const f of this.fx) { const k = now - f.t0; INGREDIENTS[f.k].draw(p, Math.round(f.x), Math.round(f.y + k * k * 60), 0); }
    if (this.result && this.result.q >= REFUSE_BELOW) for (let i = 0; i < 6; i++) { const a = now * 1.2 + i * 1.05; const x = Math.round(PL.x + Math.cos(a) * 46), y = Math.round(PL.y + Math.sin(a) * 36); p.set(x, y, '#ffffff'); p.set(x + 1, y, '#ffd27a'); p.set(x - 1, y, '#ffd27a'); p.set(x, y + 1, '#ffd27a'); p.set(x, y - 1, '#ffd27a'); }
    const img = this.sg.createImageData(SW, SH);
    new Uint32Array(img.data.buffer).set(p.data);
    this.sg.putImageData(img, 0, 0);
    const g = this.g;
    g.imageSmoothingEnabled = false;
    g.fillStyle = '#1d130d'; g.fillRect(0, 0, this.el.canvas.width, this.el.canvas.height);
    g.drawImage(this.small, this.ox, this.oy, SW * this.scale, SH * this.scale);
  }
}

function paintCounter() {
  const p = new Pix(SW, SH);
  for (let y = 0; y < SH; y++) for (let x = 0; x < SW; x++) {
    const plank = Math.floor(y / 12);
    p.set(x, y, y % 12 === 11 ? '#6e4630' : hash(Math.floor((x + plank * 37) / 40), plank, 2) > 0.5 ? '#9c6a42' : '#956240');
    if (hash(x, y, 5) > 0.985) p.set(x, y, '#8a5a36');
  }
  // a linen napkin and a fork beside the plate
  p.rect(99, 22, 18, 36, '#e8d7b0'); for (let y = 22; y < 58; y += 4) p.hline(99, 116, y, '#dcc89e'); p.vline(116, 22, 57, '#cdb98f');
  p.rect(107, 26, 2, 28, '#c9cfd1'); for (let i = 0; i < 4; i++) p.vline(105 + i * 2, 22, 27, '#c9cfd1');
  return p;
}

export function ingIcon(k) {
  const p = new Pix(16, 16);
  if (BASES[k]) { const pl = newPlate(k === 'plate' ? null : k); drawPlate(p, 8, 8, pl, 7.5); return p; }
  if (INGREDIENTS[k]) { INGREDIENTS[k].draw(p, 8, 8, 1); if (['blueberry', 'olive', 'corn'].includes(k)) { INGREDIENTS[k].draw(p, 5, 10, 2); INGREDIENTS[k].draw(p, 11, 10, 3); } p.outline(INK); return p; }
  if (SAUCES[k]) { const c = SAUCES[k].c; p.rect(5, 5, 6, 10, INK); p.rect(6, 6, 4, 8, c); p.rect(7, 1, 2, 4, '#c9cfd1'); for (let i = 0; i < 3; i++) p.set(2 + i * 5, 15 - (i % 2), c); return p; }
  if (SHAKERS[k]) { const c = SHAKERS[k].c; p.rect(4, 5, 8, 10, INK); p.rect(5, 6, 6, 8, '#f4ecd6'); p.rect(5, 9, 6, 4, c === '#ffffff' ? '#e6eef0' : c); p.rect(4, 3, 8, 3, '#8d9496'); return p; }
  return p;
}

function starRow(n) { return `<span class="stars">${[1, 2, 3].map((i) => `<i class="${i <= n ? 'on' : ''}"></i>`).join('')}</span>`; }
