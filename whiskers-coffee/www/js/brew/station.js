// The barista station: a close-up of the counter where drinks are made by hand, your
// own way. Pick a cup, then use any tool on the shelves below (grind, tamp, pull a shot,
// steam or froth milk, pour, pump syrups, drop in ice, swirl cream, trace latte art...).
// Pour too long and it spills over, pile on too much cream and it topples: wipe it up or
// bin the drink and start again. When it's ready, serve it: the drink is judged against
// the recipe (amounts, cup, toppings) for a star rating that decides the tip.
import { Pix, shade, mix, hash } from '../art/pix.js';
import { DRINKS, EXTRAS, C, INK, VESSELS, VESSEL_ORDER, COMPONENT_NAMES, COUNTED, TOPPINGS, newBuild, pour, fillOf, drawDrink, surfaceMap, guideShape, needFor, starsFor, judge, orderName, MAP_SIZE } from '../art/drinks.js';
import { st3Ready, ST3, spr, sprSize, drawDrink3, surfaceCanvas, stream, iconURL, tone, surfaceY as surfY, stepParts, drawParts, splash, confetti } from '../art/st3.js';
import { t } from '../i18n.js';

const SW = 150, SH = 100;
const CUP = { x: 72, by: 80 };
const TOP = { x: 75, y: 50, r: MAP_SIZE / 2 };
const CRANK = { x: 33, y: 33, r: 6 };
const SPOUT = { x: 72, y: 51 };
const JUG_HOME = { x: 120, by: 79 };
const SLOT = { x: 136, by: 80 };
export const REFUSE_BELOW = 0.35;

// every tool on the counter: which shelf it's on, what it's called and how it plays
export const TOOLS = {
  demi: { tab: 'cups', vessel: 'demi' }, cup: { tab: 'cups', vessel: 'cup' }, mug: { tab: 'cups', vessel: 'mug' }, glass: { tab: 'cups', vessel: 'glass' }, tall: { tab: 'cups', vessel: 'tall' },
  grind: { tab: 'coffee', name: 'Grind', mech: 'circle', view: 'bar', turns: 3, hint: 'Turn the crank in circles to grind the beans' },
  tamp: { tab: 'coffee', name: 'Tamp', mech: 'timing', view: 'bar', hint: 'Tap when the marker reaches the middle' },
  shot: { tab: 'coffee', name: 'Pull shot', mech: 'hold', view: 'bar', pour: 'espresso', rate: 0.26, hint: 'Hold to pull the shot. Let go in the gold zone' },
  water: { tab: 'coffee', name: 'Hot water', mech: 'hold', view: 'bar', pour: 'water', rate: 0.32, hint: 'Hold to pour hot water. Let go in the gold zone' },
  teabag: { tab: 'coffee', name: 'Tea bag', mech: 'tap', view: 'bar', count: 'teabag', max: 1, hint: 'Tap to drop in a tea bag' },
  steam: { tab: 'milk', name: 'Steam milk', mech: 'hold', view: 'bar', heat: 'steam', hint: 'Hold to steam the milk. Let go when it is warm' },
  froth: { tab: 'milk', name: 'Froth milk', mech: 'hold', view: 'bar', heat: 'froth', hint: 'Hold to froth the milk into a thick foam. Let go when warm' },
  pourmilk: { tab: 'milk', name: 'Pour milk', mech: 'hold', view: 'bar', pour: 'jug', rate: 0.28, hint: 'Hold to pour the milk, then the foam. Let go in the gold zone' },
  art: { tab: 'milk', name: 'Latte art', mech: 'trace', view: 'top', hint: 'Trace the dots with your finger to pour the art' },
  ice: { tab: 'cold', name: 'Ice', mech: 'tap', view: 'bar', count: 'ice', max: 4, hint: 'Tap to drop in ice cubes' },
  coldmilk: { tab: 'cold', name: 'Cold milk', mech: 'hold', view: 'bar', pour: 'coldmilk', rate: 0.3, hint: 'Hold to pour cold milk. Let go in the gold zone' },
  coldwater: { tab: 'cold', name: 'Cold water', mech: 'hold', view: 'bar', pour: 'coldwater', rate: 0.32, hint: 'Hold to pour cold water. Let go in the gold zone' },
  berry: { tab: 'cold', name: 'Strawberries', mech: 'tap', view: 'bar', each: ['berry', 0.044], hint: 'Tap to mash strawberries into the glass' },
  lemon: { tab: 'cold', name: 'Lemon', mech: 'tap', view: 'bar', each: ['lemon', 0.06], hint: 'Tap to squeeze a lemon' },
  orange: { tab: 'cold', name: 'Orange', mech: 'tap', view: 'bar', each: ['orange', 0.11], hint: 'Tap to squeeze an orange' },
  icecream: { tab: 'cold', name: 'Ice cream', mech: 'tap', view: 'bar', count: 'icecream', max: 2, hint: 'Tap to add a scoop of ice cream' },
  vanilla: { tab: 'sweet', name: 'Vanilla syrup', mech: 'tap', view: 'bar', each: ['vanilla', 0.04], hint: 'Tap to pump vanilla syrup' },
  caramelsyrup: { tab: 'sweet', name: 'Caramel syrup', mech: 'tap', view: 'bar', each: ['caramelsyrup', 0.04], hint: 'Tap to pump caramel syrup' },
  chocsyrup: { tab: 'sweet', name: 'Chocolate sauce', mech: 'tap', view: 'bar', each: ['chocsyrup', 0.04], hint: 'Tap to pump chocolate sauce' },
  chai: { tab: 'sweet', name: 'Chai syrup', mech: 'tap', view: 'bar', each: ['chai', 0.04], hint: 'Tap to pump chai syrup' },
  choc: { tab: 'sweet', name: 'Chocolate', mech: 'circle', view: 'top', turns: 2.5, hint: 'Stir in circles to melt the chocolate' },
  matcha: { tab: 'sweet', name: 'Matcha', mech: 'shake', view: 'top', count: 10, hint: 'Swipe back and forth to whisk the matcha' },
  cream: { tab: 'top', name: 'Whipped cream', mech: 'hold', view: 'bar', cream: true, hint: 'Hold to swirl the cream. Let go in the gold zone, more topples over' },
  drizzle: { tab: 'top', name: 'Caramel drizzle', mech: 'trace', view: 'top', color: C.caramel, top: 'drizzle', hint: 'Draw a drizzle over the drink (the zigzag is a good start)' },
  chocdrizzle: { tab: 'top', name: 'Chocolate drizzle', mech: 'trace', view: 'top', color: C.chocsyrup, top: 'chocdrizzle', hint: 'Draw a chocolate drizzle over the drink' },
  cocoa: { tab: 'top', name: 'Cocoa', mech: 'shake', view: 'top', count: 6, dust: C.cocoa, top: 'cocoa', hint: 'Swipe back and forth to dust cocoa' },
  cinnamon: { tab: 'top', name: 'Cinnamon', mech: 'shake', view: 'top', count: 5, dust: C.cinnamon, top: 'cinnamon', hint: 'Swipe back and forth to shake cinnamon' },
  marsh: { tab: 'top', name: 'Marshmallows', mech: 'tap', view: 'top', count: 'marsh', max: 6, hint: 'Tap the drink to drop in marshmallows' },
  mint: { tab: 'top', name: 'Mint', mech: 'tap', view: 'top', top: 'mint', max: 3, hint: 'Tap to add a mint leaf' },
};
export const TABS = [['cups', 'Cups'], ['coffee', 'Coffee'], ['milk', 'Milk'], ['cold', 'Cold'], ['sweet', 'Sweet'], ['top', 'Toppings']];
const HEAT_BAND = [0.6, 0.8];

// which tool makes each part of a recipe
const MAKES = { espresso: 'shot', water: 'water', tea: 'water', teabag: 'teabag', coldmilk: 'coldmilk', coldwater: 'coldwater', berry: 'berry', lemon: 'lemon', orange: 'orange', icecream: 'icecream', ice: 'ice', vanilla: 'vanilla', caramelsyrup: 'caramelsyrup', chocsyrup: 'chocsyrup', chai: 'chai', choc: 'choc', matcha: 'matcha', cream: 'cream', drizzle: 'drizzle', chocdrizzle: 'chocdrizzle', cocoa: 'cocoa', cinnamon: 'cinnamon', marsh: 'marsh', mint: 'mint', art: 'art', milk: 'pourmilk', foam: 'pourmilk' };

export class Station {
  // els: { root, canvas, title, for, needs, end, hint, close, tabs, tools, serve, wipe, bin }
  // hooks: { sound(name), done(quality), close(), toast(text) }
  constructor(els, hooks) {
    this.el = els; this.hooks = hooks;
    this.small = document.createElement('canvas'); this.small.width = SW; this.small.height = SH;
    this.sg = this.small.getContext('2d');
    this.g = els.canvas.getContext('2d');
    this.open = false;
    this.bar = paintBar();
    this.tops = {};
    this.tab = 'cups';
    this.icons = new Map();
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
    els.tabs.addEventListener('click', (e) => { const b = e.target.closest('[data-tab]'); if (b) { this.tab = b.dataset.tab; this.hooks.sound('click'); this.renderTools(); } });
    els.tools.addEventListener('click', (e) => { const b = e.target.closest('[data-tool]'); if (b) this.pick(b.dataset.tool); });
    els.serve.addEventListener('click', () => this.trySERVE());
    els.wipe.addEventListener('click', () => this.pick('wipe'));
    els.bin.addEventListener('click', () => this.binIt());
    els.end.addEventListener('click', (e) => {
      if (e.target.closest('[data-serve]')) { this.hide(); hooks.done(this.quality); }
      if (e.target.closest('[data-keep]')) { this.result = null; this.el.end.innerHTML = ''; this.renderCard(); }
    });
    // the shelf below can change height, so follow the stage's real size
    new ResizeObserver(() => this.open && this.resize()).observe(c.parentElement);
  }

  start(drink, extra, forName) {
    this.drink = drink; this.extra = extra || ''; this.forName = forName;
    this.need = needFor(drink, this.extra);
    this.b = newBuild(drink, this.extra, null);
    this.pf = { at: 'grinder', grounds: 0, tamped: 0, tampQ: 0.6, left: 0 };
    this.jug = null;
    this.beans = 1; this.crank = -Math.PI / 2;
    this.fx = []; this.popup = null; this.result = null; this.puddle = 0;
    this.tool = null; this.cur = null; this.tab = 'cups';
    this.open = true;
    this.el.root.hidden = false;
    this.el.title.textContent = t(DRINKS[drink].name) + (this.extra ? ' + ' + t(EXTRAS[this.extra].name) : '');
    this.el.for.textContent = forName ? t('for {name}', { name: forName }) : '';
    this.el.end.innerHTML = '';
    this.resize();
    this.renderCard(); this.renderTools();
    this.el.hint.textContent = t('Pick a cup to start');
    const loop = (now) => { if (!this.open) return; requestAnimationFrame(loop); this.frame(now / 1000); };
    this.last = performance.now() / 1000;
    requestAnimationFrame(loop);
  }
  hide() { this.open = false; this.el.root.hidden = true; }

  resize() {
    const c = this.el.canvas, dpr = Math.min(window.devicePixelRatio || 1, 3);
    this.dpr = dpr;
    c.width = Math.round(c.clientWidth * dpr); c.height = Math.round(c.clientHeight * dpr);
    // fill the space smoothly; the scene keeps its size while tools change
    this.scale = Math.max(1, Math.min(c.width / SW, c.height / SH));
    this.ox = Math.round((c.width - SW * this.scale) / 2); this.oy = Math.round((c.height - SH * this.scale) / 2);
  }

  // ---------- choosing tools ----------
  pick(key) {
    const b = this.b;
    this.hooks.sound('click');
    if (this.result) return;
    if (key === 'wipe') { this.tool = 'wipe'; this.cur = { key: 'wipe', cfg: { mech: 'shake', view: 'bar', count: 6 }, count: 0, t: 0 }; this.el.hint.textContent = t('Swipe back and forth to wipe up'); return this.renderTools(); }
    const cfg = TOOLS[key];
    if (cfg.vessel) {
      if (b.vessel && fillOf(b) + b.ice + (b.counts.icecream || 0) > 0) { this.say('Put this drink in the bin first to change the cup'); return; }
      b.vessel = cfg.vessel; b.dirty = true; this.hooks.sound('clink');
      this.tool = null; this.cur = null;
      this.el.hint.textContent = t('Now choose what goes in. The glowing tool is a good next step');
      this.tab = this.suggest() ? TOOLS[this.suggest()].tab : this.tab;
      this.renderCard(); return this.renderTools();
    }
    if (!b.vessel) { this.say('Pick a cup first'); return; }
    if (key === 'shot' && this.pf.grounds < 0.95) { this.say('Grind the beans first'); return; }
    if (key === 'tamp' && this.pf.grounds < 0.95) { this.say('Grind the beans first'); return; }
    if (key === 'grind' && this.pf.grounds >= 0.95) { this.say('The coffee is ground. Tamp it, then pull the shot'); return; }
    if (key === 'pourmilk' && !this.jug?.ready) { this.say('Steam or froth the milk first'); return; }
    if (key === 'art' && !b.amt.milk) { this.say('Pour the milk first'); return; }
    this.tool = key;
    this.cur = { key, cfg, t: 0, v: 0, held: false, acc: 0, count: 0, covered: new Set(), lastAng: null, lastX: null, dir: 0, travel: 0, stroke: null };
    if (key === 'shot') this.pf.at = 'machine';
    if (key === 'art') this.cur.guide = DRINKS[this.drink].art ? guideShape(DRINKS[this.drink].art) : null;
    if (cfg.top === 'drizzle' || cfg.top === 'chocdrizzle') this.cur.guide = guideShape('zigzag');
    if (cfg.heat) this.jug = { kind: cfg.heat, temp: this.jug?.ready ? 0.3 : 0.1, ready: false };
    if (key === 'choc') { pour(b, 'choc', 0); b.chunks = 1; b.top = '#3a1a10'; this.cur.choc = 0; }
    if (key === 'matcha') { if (!b.amt.matcha) pour(b, 'matcha', 0.3); b.top = '#4f7a33'; b.froth = 0; }
    this.el.hint.textContent = t(cfg.hint);
    this.renderTools();
  }

  say(text) { this.hooks.toast(t(text)); this.hooks.sound('nope'); }

  binIt() {
    if (this.result) return;
    if (!this.b.vessel) return;
    if (!this.binArmed || performance.now() - this.binArmed > 2500) { this.binArmed = performance.now(); this.hooks.toast(t('Tap the bin again to throw this drink away')); return; }
    this.binArmed = 0;
    this.b = newBuild(this.drink, this.extra, null);
    this.puddle = 0; this.jug = null; this.tool = null; this.cur = null; this.tab = 'cups';
    this.hooks.sound('bin');
    this.el.hint.textContent = t('Fresh start! Pick a cup');
    this.renderCard(); this.renderTools();
  }

  // the next tool that would help, following the recipe
  suggest() {
    const b = this.b, need = this.need;
    if (!b.vessel) return DRINKS[this.drink].vessel;
    for (const [k, want] of Object.entries(need)) {
      if (this.done(k, want)) continue;
      if (k === 'espresso') return this.pf.grounds < 0.95 ? 'grind' : !this.pf.tamped ? 'tamp' : 'shot';
      if (k === 'tea' && !b.counts.teabag) return 'teabag';
      if (k === 'milk' || k === 'foam') {
        if (b.amt.milk && k === 'foam' && b.amt.foam === undefined && !this.jug?.ready) return need.foam > 0.3 ? 'froth' : 'steam';
        if (!this.jug?.ready) return (need.foam || 0) > 0.3 ? 'froth' : 'steam';
        return 'pourmilk';
      }
      return MAKES[k];
    }
    return null;
  }
  done(k, want) {
    const b = this.b;
    if (k === 'ice') return b.ice >= want;
    if (k === 'marsh') return b.marsh.length >= want;
    if (COUNTED.has(k)) return (b.counts[k] || 0) >= want;
    if (k === 'cream') return b.cream >= 0.6;
    if (k === 'art') return b.artScore > 0;
    if (TOPPINGS.has(k)) return (b.tops[k] || 0) >= 0.99;
    return Math.abs((b.amt[k] || 0) - want) <= Math.max(0.08, want * 0.45) * 0.4;
  }

  trySERVE() {
    if (this.result) return;
    const b = this.b;
    if (!b.vessel) { this.say('Pick a cup first'); return; }
    if (b.messy) { this.say('Wipe up the spill first'); return; }
    if (this.cur?.held) return;
    const r = judge(b, this.drink, this.extra);
    this.quality = r.q; this.result = r; this.tool = null; this.cur = null;
    b.straw = VESSELS[b.vessel].straw; b.dirty = true;
    const stars = starsFor(r.q), bad = r.q < REFUSE_BELOW;
    const notes = r.notes.slice(0, 3).map(([s, k]) => `<li>${t(s, { thing: k ? (k.startsWith('v:') ? t(VESSELS[k.slice(2)].name) : t(COMPONENT_NAMES[k] || k)) : '' })}</li>`).join('');
    this.el.end.innerHTML = `<div class="st-rating">${bad ? `<b class="oops">${t('Oops!')}</b>` : starRow(stars)}</div>`
      + (notes ? `<ul class="st-notes">${notes}</ul>` : `<p class="st-good">${t('Just like the recipe!')}</p>`)
      + (bad ? `<p class="st-warn">${t('This does not look like {drink}. They may ask for a new one.', { drink: t(DRINKS[this.drink].name) })}</p>` : '')
      + `<button class="btn primary" data-serve>${t('Take it to {name}', { name: this.forName || t('the customer') })}</button>`
      + `<button class="btn" data-keep>${t('Keep working')}</button>`;
    this.el.hint.textContent = bad ? t('Something went wrong. You can keep working, bin it, or serve it anyway') : stars === 3 ? t('A perfect drink!') : stars === 2 ? t('Looks lovely!') : t('Made with love!');
    this.hooks.sound(bad ? 'nope' : 'done');
    this.renderCard(); this.renderTools();
  }

  renderCard() {
    const b = this.b, sug = this.suggest();
    const rows = [];
    rows.push(`<li class="${b.vessel === DRINKS[this.drink].vessel ? 'done' : b.vessel ? 'off' : ''}"><span>${t(VESSELS[DRINKS[this.drink].vessel].name)}</span>${b.vessel === DRINKS[this.drink].vessel ? '<span class="tick"></span>' : ''}</li>`);
    for (const [k, want] of Object.entries(this.need)) {
      const ok = this.done(k, want);
      let bar = '';
      if (!COUNTED.has(k) && !TOPPINGS.has(k)) {
        const have = b.amt[k] || 0, w = Math.min(100, (have / Math.max(want, 0.01)) * 66);
        bar = `<i class="amt"><i style="width:${w}%" class="${have > want + Math.max(0.08, want * 0.45) * 0.4 ? 'over' : ''}"></i><em></em></i>`;
      } else if (COUNTED.has(k)) {
        const have = k === 'ice' ? b.ice : k === 'marsh' ? b.marsh.length : (b.counts[k] || 0);
        bar = `<small>${have}/${want}</small>`;
      }
      rows.push(`<li class="${ok ? 'done' : ''}"><span>${t(COMPONENT_NAMES[k] || k)}</span>${bar}${ok ? '<span class="tick"></span>' : ''}</li>`);
    }
    this.el.needs.innerHTML = rows.join('');
    this.el.wipe.hidden = !b.messy;
    this.el.serve.disabled = !!this.result;
    this.sug = sug;
  }

  renderTools() {
    const sug = this.result ? null : this.suggest(), sugTab = sug && sug !== 'wipe' ? TOOLS[sug]?.tab : null;
    this.el.tabs.innerHTML = TABS.map(([k, n]) => `<button class="chip${this.tab === k ? ' on' : ''}${sugTab === k && this.tab !== k ? ' glow' : ''}" data-tab="${k}">${t(n)}</button>`).join('');
    this.el.tools.innerHTML = Object.entries(TOOLS).filter(([, c]) => c.tab === this.tab).map(([k, c]) => {
      const name = c.vessel ? t(VESSELS[c.vessel].name) : t(c.name);
      return `<button class="tool${this.tool === k ? ' on' : ''}${sug === k ? ' glow' : ''}${c.vessel && this.b.vessel === c.vessel ? ' on' : ''}" data-tool="${k}"><img src="${this.icon(k)}" alt=""><span>${name}</span></button>`;
    }).join('');
    this.renderCard();
  }

  icon(k) {
    if (st3Ready()) { const u = iconURL(TOOL_PICS[k] || []); if (u) return u; }
    if (!this.icons.has(k)) this.icons.set(k, toolIcon(k).toCanvas(3).toDataURL());
    return this.icons.get(k);
  }

  // ---------- input ----------
  input(kind, x, y) {
    const c = this.cur;
    this.pointer = [x, y];
    if (!c || c.done || c.anim) return;
    const cfg = c.cfg, b = this.b;
    if (cfg.mech === 'hold') {
      if (kind === 'down') { c.held = true; c.t = 0; this.hooks.sound('start-' + c.key); }
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
        if (c.key === 'grind') { this.crank = ang; this.beans = Math.max(0.3, this.beans - Math.abs(da) * 0.01); this.pf.grounds = k; this.pf.tamped = 0; this.pf.left = Math.max(0.45, (this.need.espresso || 0) + 0.2); if (Math.random() < 0.5) this.fx.push({ kind: 'ground', x: (this.l3 ? ST3.bar.chute[0] : 19) + Math.random() * 2 - 1, y: this.l3 ? ST3.bar.chute[1] + 1.5 : 49, t: 0 }); }
        else {
          // melting the chocolate pieces: they turn into a smooth layer as you stir
          this.spoon = [x, y];
          const add = 0.4 * k - c.choc; if (add > 0) { pour(b, 'choc', add); c.choc += add; }
          b.chunks = 1 - k; b.top = mix('#3a1a10', C.choc, k); b.dirty = true;
        }
        if (k >= 1) this.finishTool(1, c.key === 'grind' ? 'Ground!' : 'Melted!');
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
      if (cfg.max && this.countOf(c.key) >= cfg.max) { this.say('That is plenty'); return; }
      c.count++;
      if (c.key === 'marsh') {
        let nx = (x - TOP.x) / TOP.r, ny = (y - TOP.y) / TOP.r;
        const r = Math.hypot(nx, ny); if (r > 0.6) { nx *= 0.6 / r; ny *= 0.6 / r; }
        b.marsh.push([nx, ny]); b.dirty = true; this.hooks.sound('plop');
      } else if (c.key === 'mint') {
        let nx = (x - TOP.x) / TOP.r, ny = (y - TOP.y) / TOP.r;
        const r = Math.hypot(nx, ny); if (r > 0.7) { nx *= 0.7 / r; ny *= 0.7 / r; }
        b.dots.push([nx, ny, '#5c9a48'], [nx + 0.06, ny - 0.05, '#5c9a48'], [nx - 0.05, ny + 0.03, '#3f6b35'], [nx + 0.02, ny, '#7fb04c']);
        b.tops.mint = 1; b.dirty = true; this.hooks.sound('plop');
      } else if (c.key === 'ice') { this.fx.push({ kind: 'ice', t: 0 }); this.hooks.sound('ice'); }
      else if (cfg.count) { b.counts[cfg.count] = (b.counts[cfg.count] || 0) + 1; b.dirty = true; this.hooks.sound('plop'); }
      else if (cfg.each) {
        const spilled = pour(b, cfg.each[0], cfg.each[1]);
        this.fx.push({ kind: c.key === 'berry' ? 'mash' : 'drip', t: 0, c: C[cfg.each[0]] });
        this.hooks.sound(c.key === 'berry' ? 'mash' : 'pump');
        if (spilled > 0) this.spilled();
      }
      this.renderCard();
    } else if (cfg.mech === 'trace') {
      const nx = (x - TOP.x) / TOP.r, ny = (y - TOP.y) / TOP.r;
      const r = Math.hypot(nx, ny), k = r > 0.92 ? 0.92 / r : 1, px = nx * k, py = ny * k;
      if (kind === 'down') {
        c.stroke = { c: cfg.color || (b.amt.matcha ? '#f4f9e8' : C.foam), w: cfg.color ? 0.045 : 0.085, pts: [[px, py]], z: cfg.top ? 1 : 0 };
        b.strokes.push(c.stroke); this.hooks.sound('pour');
      } else if (kind === 'move' && c.stroke) {
        const [lx, ly] = c.stroke.pts[c.stroke.pts.length - 1];
        if (Math.hypot(px - lx, py - ly) > 0.03) { c.stroke.pts.push([px, py]); b.dirty = true; c.drawn = (c.drawn || 0) + Math.hypot(px - lx, py - ly); }
      }
      if (c.stroke && c.guide) c.guide.forEach(([gx, gy], i) => { if (Math.hypot(gx - px, gy - py) < 0.14) c.covered.add(i); });
      if (kind === 'up') {
        c.stroke = null;
        const cov = c.guide ? c.covered.size / c.guide.length : 1;
        // free drawing counts too: the guide just earns the best marks for latte art
        const score = c.key === 'art' ? (c.guide ? Math.max(0.5, Math.min(1, cov / 0.9)) : 1) : 1;
        if ((c.drawn || 0) > 0.6) {
          if (c.key === 'art') b.artScore = Math.max(b.artScore, score); else b.tops[cfg.top] = 1;
          if (cov >= 0.95 || !c.guide || c.key !== 'art') this.finishTool(score, score >= 0.85 ? 'Perfect!' : 'Nice!');
          else this.renderCard();
        }
      }
      if (c.guide && c.covered.size / c.guide.length >= 0.95 && c.key === 'art' && c.stroke) { b.artScore = 1; c.stroke = null; this.finishTool(1, 'Perfect!'); }
    }
  }

  countOf(key) {
    const b = this.b;
    if (key === 'ice') return b.ice + this.fx.filter((f) => f.kind === 'ice' && !f.landed).length;
    if (key === 'marsh') return b.marsh.length;
    if (key === 'mint') return b.dots.length / 4;
    return b.counts[TOOLS[key].count] || 0;
  }

  shook(x) {
    const c = this.cur, b = this.b;
    c.count++;
    this.hooks.sound(c.key === 'wipe' ? 'wipe' : 'shake');
    const k = Math.min(1, c.count / c.cfg.count);
    if (c.key === 'wipe') {
      this.puddle *= 0.75;
      if (k >= 1) { b.messy = false; this.puddle = 0; if (b.cream > 1.2) b.cream = 0.9; b.dirty = true; this.finishTool(1, 'Clean!'); this.renderCard(); }
      return;
    }
    if (c.key === 'matcha') { b.froth = k; b.top = mix('#4f7a33', C.matcha, k); }
    else {
      const nx = (x - TOP.x) / TOP.r;
      for (let i = 0; i < 8; i++) { const dx = nx + (Math.random() - 0.5) * 0.7, dy = (Math.random() - 0.5) * 1.5; if (Math.hypot(dx, dy) < 0.85) b.dots.push([dx, dy, c.cfg.dust]); }
      b.tops[c.cfg.top] = k;
    }
    b.dirty = true;
    if (k >= 1) this.finishTool(1, 'Done!');
  }

  release() {
    const c = this.cur, cfg = c.cfg;
    c.held = false;
    this.hooks.sound('stop');
    if (cfg.heat) {
      const j = this.jug, [lo, hi] = HEAT_BAND;
      // the jug holds about what this drink needs: steaming makes silky milk with a
      // little foam, frothing makes lots of foam (the right choice depends on the drink)
      const need = this.need, wantsFoamy = (need.foam || 0) > 0.3;
      if (j.kind === 'steam') { j.milk = need.milk || 0.55; j.foam = wantsFoamy ? 0.1 : (need.foam ?? 0.08); }
      else { j.milk = wantsFoamy ? need.milk || 0.22 : 0.25; j.foam = wantsFoamy ? need.foam : 0.4; }
      j.ready = true;
      this.b.burnt = this.b.burnt || j.temp > hi + 0.12;
      const sc = j.temp < lo ? Math.max(0.4, 1 - (lo - j.temp) * 3) : j.temp > hi ? Math.max(0.3, 1 - (j.temp - hi) * 3) : 1;
      j.q = sc;
      this.finishTool(sc, j.temp > hi + 0.12 ? 'Too hot!' : sc >= 0.85 ? 'Perfect!' : j.temp < lo ? 'A bit cool' : 'Nice!', 'pourmilk');
      return;
    }
    if (c.key === 'shot') { this.pf.left = Math.max(0, this.pf.left); if (this.pf.left <= 0.01) { this.pf.grounds = 0; this.pf.tamped = 0; this.pf.at = 'grinder'; } }
    this.renderCard();
    // a little praise when they stop in the band
    const band = this.band();
    if (band && !cfg.cream) { const f = fillOf(this.b); this.pop(f >= band[0] && f <= band[1] ? 'Perfect!' : f > band[1] ? 'A bit much' : 'Good'); }
    if (cfg.cream) this.pop(this.b.cream > 1.2 ? 'It toppled!' : this.b.cream >= 0.6 ? 'Lovely!' : 'A little more?');
  }

  pop(text, stars = 0) { this.popup = { text: t(text), t: 0, stars }; }
  finishTool(score, text, next) {
    this.pop(text, score >= 0.85 ? 3 : 0);
    this.hooks.sound(score >= 0.85 ? 'perfect' : 'step');
    const c = this.cur;
    if (c) c.done = true;
    setTimeout(() => { if (this.cur === c) { this.cur = null; this.tool = null; if (next && this.open && !this.result) this.pick(next); else { this.renderTools(); this.el.hint.textContent = t(this.suggest() ? 'Nice! The glowing tool is a good next step' : 'Ready? Tap Serve, or keep decorating'); } } }, 650);
    if (c?.key === 'tamp') { this.pf.tamped = 1; this.pf.tampQ = score; }
  }

  spilled() {
    if (!this.spillNoted) { this.say('It is overflowing! Wipe it up, or bin it and start again'); this.spillNoted = true; setTimeout(() => (this.spillNoted = false), 2500); }
    this.hooks.sound('spill');
    this.renderCard();
  }

  // the gold zone on the fill meter: where the cup should be after this pour
  band() {
    const c = this.cur, need = this.need;
    if (!c || c.cfg.mech !== 'hold' || c.cfg.heat || c.cfg.cream) return null;
    const keys = c.key === 'pourmilk' ? ['milk', 'foam'] : c.key === 'water' ? ['water', 'tea'] : [c.cfg.pour];
    if (!keys.some((k) => need[k])) return null;
    let target = 0;
    const order = Object.keys(need);
    const lastIdx = Math.max(...keys.map((k) => order.indexOf(k)));
    for (let i = 0; i <= lastIdx; i++) { const k = order[i]; if (!COUNTED.has(k) && !TOPPINGS.has(k)) target += need[k]; }
    // a macchiato's shot goes on top of the milk, so count what's already in
    target = Math.max(target, fillOf(this.b) - (this.b.amt[keys[0]] || 0) + keys.reduce((a, k) => a + (need[k] || 0), 0));
    target = Math.min(1, target);
    return [Math.max(0, target - 0.05), Math.min(1, target + 0.04)];
  }

  // ---------- update and draw ----------
  frame(now) {
    const dt = Math.min(0.05, now - this.last); this.last = now;
    const c = this.cur, b = this.b;
    if (c) {
      c.t += dt;
      if (c.cfg.mech === 'hold' && c.held && !c.done) {
        const cfg = c.cfg;
        if (cfg.heat) {
          const j = this.jug;
          j.temp += dt * 0.28 * (0.8 + j.temp * 0.4);
          if (j.temp >= 1.25) { this.puddle += dt * 0.5; b.messy = true; b.burnt = true; if (!this.spillNoted) this.spilled(); }
        } else if (cfg.cream) {
          b.cream += dt * 0.55; b.dirty = true;
          if (b.cream > 1.25 && !b.messy) { b.messy = true; this.spilled(); }
        } else {
          let amt = (cfg.rate || 0.3) * dt;
          let spilled = 0;
          if (c.key === 'shot') {
            const take = Math.min(amt, this.pf.left); this.pf.left -= take; amt = take;
            b.shotQ = this.pf.tamped ? this.pf.tampQ : 0.6;
            if (amt <= 0) { this.release(); this.pop('Grind again for another shot'); }
          }
          if (c.key === 'pourmilk') {
            const j = this.jug;
            const m = Math.min(amt, j.milk); j.milk -= m; spilled += pour(b, 'milk', m);
            const f = Math.min(amt - m, j.foam); j.foam -= f; spilled += pour(b, 'foam', f);
            if (j.milk + j.foam <= 0.001) { this.jug = null; this.release(); this.pop('The jug is empty'); }
          } else if (amt > 0) spilled += pour(b, cfg.pour, amt);
          if (spilled > 0) { this.puddle += spilled; this.spilled(); }
        }
        if (Math.floor(c.t * 7) !== Math.floor((c.t - dt) * 7)) { this.hooks.sound('tick-' + c.key); this.renderCard(); }
      }
      if (c.anim) {
        const a = c.anim;
        a.t += dt;
        if (a.kind === 'tamp') {
          this.pf.tamped = Math.min(1, a.t / 0.2);
          if (a.t >= a.dur) { c.anim = null; this.finishTool(c.result, c.result >= 0.85 ? 'Perfect!' : 'Nice!'); }
        }
      }
    }
    for (const f of this.fx) f.t += dt;
    for (const f of this.fx) if (f.kind === 'ice' && f.t > 0.4 && !f.landed) {
      f.landed = true;
      if (b.ice < 4) { b.ice++; b.dirty = true; this.hooks.sound('clink'); this.renderCard(); }
    }
    this.fx = this.fx.filter((f) => f.t < 1);
    if (this.popup) { this.popup.t += dt; if (this.popup.t > 1.1) this.popup = null; }
    this.draw(now);
  }

  draw(now) {
    if (st3Ready()) return this.draw3(now);
    const view = this.cur && !this.result ? this.cur.cfg.view : 'bar';
    const top = view === 'top';
    if (top && this.topVessel !== this.b.vessel) { this.topBg = paintTop(this.b.vessel || 'cup'); this.topVessel = this.b.vessel; }
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
      const size = Math.round(s * 8);
      g.font = `700 ${size}px "Pixelify Sans", monospace`; g.textAlign = 'center'; g.textBaseline = 'middle';
      const x = this.ox + SW * s / 2, y = this.oy + (18 - k * 6) * s;
      g.fillStyle = INK; g.fillText(this.popup.text, x + s, y + s);
      g.fillStyle = this.popup.stars === 3 ? '#ffd27a' : '#fbf6ea'; g.fillText(this.popup.text, x, y);
      g.globalAlpha = 1;
    }
  }

  // ---------- the rendered station (tools/art3d) ----------
  draw3(now) {
    if (!this.l3) {
      const L = ST3.bar;
      CUP.x = L.cup[0]; CUP.by = L.cup[1]; SPOUT.x = L.spout[0]; SPOUT.y = L.spout[1];
      CRANK.x = L.crank[0]; CRANK.y = L.crank[1]; JUG_HOME.x = L.jug_home[0]; JUG_HOME.by = L.jug_home[1];
      SLOT.x = L.slot[0]; SLOT.by = L.slot[1];
      TOP.r = 29;                       // leaves room for the saucer in the view from above
      this.l3 = true;
      if (this.open) this.renderTools();
    }
    const view = this.cur && !this.result ? this.cur.cfg.view : 'bar';
    const dt = Math.min(0.05, Math.max(0, now - (this.t3 ?? now))); this.t3 = now;
    const b = this.b, f = Math.min(1, fillOf(b));
    if (b !== this.lastB || b.vessel !== this.lastVessel) { this.lastB = b; this.lastVessel = b.vessel; this.vFill = f; this.cupT = 0; this.parts = []; this.seenMarsh = b.marsh.length; }
    this.vFill += (f - this.vFill) * Math.min(1, dt * 10);
    this.cupT += dt;
    this.parts = stepParts(this.parts || [], dt);
    if (this.result && this.result.q >= REFUSE_BELOW) { if (!this.partied) { this.partied = true; confetti(this.parts, CUP.x, CUP.by - 20); } } else this.partied = false;
    const g = this.g, s = this.scale;
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.fillStyle = '#1d130d'; g.fillRect(0, 0, this.el.canvas.width, this.el.canvas.height);
    g.setTransform(s, 0, 0, s, this.ox, this.oy);
    g.save(); g.beginPath(); g.rect(0, 0, SW, SH); g.clip();
    g.imageSmoothingEnabled = true; g.imageSmoothingQuality = 'high';
    const p = new Pix(SW, SH);
    if (view === 'top') this.drawTop3(g, p, now); else this.drawBar3(g, p, now);
    // the game's markers and meters on top
    const img = this.sg.createImageData(SW, SH);
    new Uint32Array(img.data.buffer).set(p.data);
    this.sg.putImageData(img, 0, 0);
    g.imageSmoothingEnabled = false;
    g.drawImage(this.small, 0, 0, SW, SH);
    g.restore();
    g.setTransform(1, 0, 0, 1, 0, 0);
    this.drawPopup(g, s);
  }

  drawPopup(g, s) {
    if (!this.popup) return;
    const k = this.popup.t, a = k < 0.15 ? k / 0.15 : k > 0.8 ? (1.1 - k) / 0.3 : 1;
    g.globalAlpha = Math.max(0, a);
    const size = Math.round(s * 8);
    g.font = `700 ${size}px "Pixelify Sans", monospace`; g.textAlign = 'center'; g.textBaseline = 'middle';
    const x = this.ox + SW * s / 2, y = this.oy + (18 - k * 6) * s;
    g.fillStyle = INK; g.fillText(this.popup.text, x + s, y + s);
    g.fillStyle = this.popup.stars === 3 ? '#ffd27a' : '#fbf6ea'; g.fillText(this.popup.text, x, y);
    g.globalAlpha = 1;
  }

  drawBar3(g, p, now) {
    const c = this.cur, b = this.b, key = c?.key, L = ST3.bar;
    spr(g, 'st_bar', 0, 0);
    // beans in the hopper run low as you grind
    const [hx, hb] = L.hopper_bot, ht = L.hopper_top[1];
    g.save(); g.beginPath(); g.rect(0, hb - (hb - ht) * Math.max(0, this.beans) - 1, SW, SH); g.clip();
    spr(g, 'st_hopper_beans', hx, hb); g.restore();
    spr(g, 'st_hopper_glass', hx, hb);
    // crank
    const ca = this.crank, kx = CRANK.x + Math.cos(ca) * CRANK.r, ky = CRANK.y + Math.sin(ca) * CRANK.r;
    g.lineCap = 'round';
    g.strokeStyle = '#4a4f52'; g.lineWidth = 1.9; g.beginPath(); g.moveTo(CRANK.x, CRANK.y); g.lineTo(kx, ky); g.stroke();
    g.strokeStyle = '#c9cfd1'; g.lineWidth = 1.0; g.beginPath(); g.moveTo(CRANK.x, CRANK.y - 0.3); g.lineTo(kx, ky - 0.3); g.stroke();
    spr(g, 'st_knob', kx, ky + 1);
    // portafilter: under the grinder, then locked into the machine
    const pfAt = this.pf.at === 'machine' ? L.pf_machine : L.pf_grinder;
    spr(g, this.pf.grounds > 0.05 ? 'st_pf_full' : 'st_pf_empty', pfAt[0], pfAt[1]);
    if (key === 'tamp') {
      const press = c.anim ? Math.sin(Math.min(1, c.anim.t / c.anim.dur) * Math.PI) * 3 : 0;
      spr(g, 'st_tamper', pfAt[0], pfAt[1] - 6 + press);
    }
    // spills on the counter
    if (this.puddle > 0.005 || b.messy) {
      const r = Math.min(26, 6 + this.puddle * 60), col = b.cream > 1.2 && !this.puddle ? C.cream : (b.layers[b.layers.length - 1]?.c || C.milk);
      g.fillStyle = tone(col, 0.9, 0.9); g.beginPath(); g.ellipse(CUP.x - 4, CUP.by + 2, r, Math.max(2, r / 5), 0, 0, 6.283); g.fill();
      g.fillStyle = tone(col, 1.15, 0.8); g.beginPath(); g.ellipse(CUP.x - 7, CUP.by + 1.2, r * 0.4, 0.8, 0, 0, 6.283); g.fill();
    }
    const V = b.vessel ? ST3.ves[b.vessel] : null;
    const cupTop = V ? CUP.by - V.h : CUP.by - 10;
    const surfaceY = V ? surfY(b, CUP.by, this.vFill) : CUP.by;
    const pouring = c && c.held && c.cfg.mech === 'hold' && !c.cfg.heat && !c.cfg.cream;
    if (pouring && V) {
      const col = key === 'shot' ? C.espresso : key === 'water' ? '#cfe8ee' : key === 'coldwater' ? '#d6ecf0' : key === 'coldmilk' ? C.coldmilk : C.milk;
      this.pourAcc = (this.pourAcc || 0) + (now - (this.pourLast || now)); this.pourLast = now;
      if (this.pourAcc > 0.09) { this.pourAcc = 0; splash(this.parts, CUP.x + (key === 'water' ? 2.5 : 0), surfaceY, b.layers[b.layers.length - 1]?.c || col, 1, ST3.ves[b.vessel].ry); }
    } else this.pourLast = null;
    const steaming = c && c.cfg.heat;
    const pouringMilk = key === 'pourmilk' && c.held;
    const coldPour = c && c.held && (key === 'coldmilk' || key === 'coldwater');
    const jugMilk = key === 'coldwater' ? '#d6ecf0' : key === 'coldmilk' ? C.coldmilk : C.milk;
    const puff = (x, y, r, a) => { g.fillStyle = `rgba(255,255,255,${a})`; g.beginPath(); g.arc(x, y, r, 0, 6.283); g.fill(); };
    if (steaming) {
      spr(g, 'st_jug_milk', L.jug_steam[0], L.jug_steam[1]);
      if (c.held) for (let i = 0; i < 6; i++) { const k = (now * 1.2 + i / 6) % 1; puff(L.wand_tip[0] + Math.sin((now + i) * 3) * 3, L.wand_tip[1] - 10 - k * 18, 1.5 + k * 3, (1 - k) * 0.55); }
      if (this.jug.temp > 1.15) for (let i = 0; i < 4; i++) puff(L.jug_steam[0] - 4 + i * 2.5, L.jug_steam[1] - 13 + Math.sin(now * 20 + i), 0.9, 0.9);
    }
    if (pouringMilk || coldPour) {
      const name = key === 'coldwater' ? 'st_pitcher' : key === 'coldmilk' ? 'st_carton' : 'st_jug_milk';
      const [w, h] = sprSize(name), a = -0.9;
      const lx = -w * 0.42, ly = -h * 0.9;                       // the lip, before tipping
      const tx = lx * Math.cos(a) - ly * Math.sin(a), ty = lx * Math.sin(a) + ly * Math.cos(a);
      const jx = CUP.x + 1 - tx, jy = cupTop - 5 - ty;
      stream(g, CUP.x + 1, cupTop - 5, surfaceY, jugMilk, 0.9, now);
      spr(g, name, jx, jy, 1, { rot: a, flip: true });
    } else if (!steaming) spr(g, this.jug?.ready ? 'st_jug_milk' : 'st_jug', JUG_HOME.x, JUG_HOME.by);
    if (this.jug?.ready && !steaming && !pouringMilk) for (let i = 0; i < 3; i++) { const k = (now * 0.8 + i / 3) % 1; puff(JUG_HOME.x - 2 + i * 2, JUG_HOME.by - 16 - k * 12, 1 + k * 2, (1 - k) * 0.5); }
    // pouring streams from the machine
    if (key === 'shot' && c.held) { stream(g, SPOUT.x - 0.9, SPOUT.y, surfaceY, C.espresso, 0.45, now); stream(g, SPOUT.x + 0.9, SPOUT.y, surfaceY, C.espresso, 0.45, now + 0.3); }
    if (key === 'water' && c.held) stream(g, SPOUT.x + 2.5, SPOUT.y, surfaceY, '#cfe8ee', 0.8, now);
    // the drink, or an empty spot waiting for a cup
    if (b.vessel) {
      const k = Math.min(1, this.cupT / 0.32), lift = (1 - k) * (1 - k) * 22, squash = this.cupT < 0.6 ? Math.sin(Math.min(1, (this.cupT - 0.32) / 0.28) * Math.PI) * 0.08 * (this.cupT > 0.32) : 0;
      drawDrink3(g, CUP.x, CUP.by, b, { fill: this.vFill, wobble: pouring ? 0.35 : 0, t: now, lift, squash });
    } else if (Math.floor(now * 2) % 2) ring(p, Math.round(CUP.x), Math.round(CUP.by - 8), 6, '#ffd27a');
    // tools for the current step
    if (key === 'ice' || this.fx.some((f) => f.kind === 'ice')) spr(g, 'st_bucket', SLOT.x, SLOT.by);
    if (key === 'berry') spr(g, 'st_berries', SLOT.x, SLOT.by);
    if (key === 'lemon' || key === 'orange') spr(g, key === 'lemon' ? 'st_lemons' : 'st_oranges', SLOT.x, SLOT.by);
    if (key === 'icecream') spr(g, 'st_tub', SLOT.x, SLOT.by);
    if (key === 'teabag') spr(g, 'st_teabox', SLOT.x, SLOT.by);
    if (c?.cfg.each && key !== 'berry' && key !== 'lemon' && key !== 'orange') spr(g, { vanilla: 'st_bottle_vanilla', caramelsyrup: 'st_bottle_caramel', chocsyrup: 'st_bottle_choc', chai: 'st_bottle_chai' }[key] || 'st_bottle_vanilla', SLOT.x, SLOT.by);
    if (key === 'cream') spr(g, 'st_creamcan', CUP.x + 1, cupTop - 24 - Math.min(1.3, b.cream) * 7, 1, { rot: Math.PI });
    for (const f of this.fx) {
      if (f.kind === 'ice' && f.t >= 0.4 && !f.splashed && V) { f.splashed = true; splash(this.parts, CUP.x, surfaceY, b.layers[b.layers.length - 1]?.c || '#cfe8ee', 7, V.ry); }
      if ((f.kind === 'drip' || f.kind === 'mash') && f.t >= 0.25 && !f.splashed && V) { f.splashed = true; splash(this.parts, CUP.x + 1, surfaceY, f.c || C.berry, 4, V.ry); }
      if (f.kind === 'ice' && f.t < 0.4) {
        const k = Math.min(1, f.t / 0.4);
        spr(g, 'st_ice', SLOT.x + (CUP.x - SLOT.x) * k, SLOT.by - 14 - Math.sin(k * Math.PI) * 14 + (cupTop + 4 - SLOT.by + 14) * k, 1.2, { rot: k * 3 });
      }
      if (f.kind === 'mash') {
        const k = f.t, y = cupTop - 12 + Math.sin(k * Math.PI) * 6;
        g.fillStyle = '#8a5a36'; g.beginPath(); g.roundRect(CUP.x - 1.2, y, 2.4, 14, 1); g.fill();
        g.fillStyle = '#c08a55'; g.beginPath(); g.roundRect(CUP.x - 0.9, y, 1.2, 14, 0.6); g.fill();
      }
      if (f.kind === 'drip' && f.t < 0.5) stream(g, CUP.x + 2, cupTop - 8, Math.min(surfaceY, cupTop - 8 + f.t * 30), f.c, 0.5, now);
      if (f.kind === 'ground' && f.t < 0.4) { g.fillStyle = '#3b2014'; for (let i = 0; i < 3; i++) { g.beginPath(); g.arc(f.x + i * 0.7 - 0.7, f.y + f.t * f.t * 90 + i * 1.3, 0.5, 0, 6.283); g.fill(); } }
    }
    if (this.result && this.result.q >= REFUSE_BELOW) {
      for (let i = 0; i < 6; i++) {
        const a = now * 1.2 + i * 1.05, r = 22 + Math.sin(now * 2 + i) * 2;
        sparkle(p, Math.round(CUP.x + Math.cos(a) * r), Math.round(CUP.by - 16 + Math.sin(a) * r * 0.55), (i + Math.floor(now * 3)) % 2);
      }
    }
    // meters
    if (c && c.cfg.mech === 'hold') {
      if (c.cfg.heat) drawMeter(p, 142, 14, 46, this.jug.temp, HEAT_BAND, true);
      else if (c.cfg.cream) drawMeter(p, 142, 14, 46, b.cream / 1.25, [0.6 / 1.25, 1.1 / 1.25]);
      else drawMeter(p, 142, 14, 46, Math.min(1.15, fillOf(b) + Math.min(0.15, this.puddle)), this.band() || [2, 2]);
    }
    if (c && c.cfg.mech === 'timing') drawTimingBar(p, 30, 7, 84, c.frozen ?? (Math.sin(c.t * 2.6 - Math.PI / 2) + 1) / 2);
    if (key === 'grind') {
      drawProgress(p, 4, 92, 34, Math.min(1, c.acc / (c.cfg.turns * Math.PI * 2)));
      if (!c.acc) { const a = now * 3; p.set(CRANK.x + Math.cos(a) * 10, CRANK.y + Math.sin(a) * 10, '#ffd27a'); p.set(CRANK.x + Math.cos(a - 0.3) * 10, CRANK.y + Math.sin(a - 0.3) * 10, '#ffd27a88'); }
    }
    drawParts(g, this.parts);
    if (key === 'wipe') {
      drawProgress(p, 120, 92, 26, c.count / c.cfg.count);
      if (this.pointer && this.down) spr(g, 'st_rag', this.pointer[0], this.pointer[1] + 2, 1, { rot: Math.sin(now * 12) * 0.15 });
    }
  }

  drawTop3(g, p, now) {
    const c = this.cur, b = this.b, key = c.key, v = b.vessel || 'cup';
    spr(g, 'st_topbg', 0, 0);
    g.fillStyle = 'rgba(60,35,20,0.18)'; g.beginPath(); g.ellipse(TOP.x + 3, TOP.y + 4, TOP.r * 1.45, TOP.r * 1.42, 0, 0, 6.283); g.fill();
    spr(g, 'sv_' + v + '_top', TOP.x, TOP.y, TOP.r / ST3.top_r);
    if (fillOf(b) > 0.02 || b.cream) g.drawImage(surfaceCanvas(b), TOP.x - TOP.r, TOP.y - TOP.r, TOP.r * 2, TOP.r * 2);
    if (c.cfg.mech === 'trace' && c.guide) {
      g.strokeStyle = 'rgba(251,246,234,0.45)'; g.lineWidth = 0.8; g.setLineDash([1.5, 2]); g.beginPath();
      c.guide.forEach(([gx, gy], i) => (i ? g.lineTo(TOP.x + gx * TOP.r, TOP.y + gy * TOP.r) : g.moveTo(TOP.x + gx * TOP.r, TOP.y + gy * TOP.r)));
      g.stroke(); g.setLineDash([]);
      c.guide.forEach(([gx, gy], i) => {
        if (c.covered.has(i)) return;
        const x = Math.round(TOP.x + gx * TOP.r), y = Math.round(TOP.y + gy * TOP.r);
        p.rect(x - 1, y - 1, 3, 3, INK); p.set(x, y, (i + Math.floor(now * 4)) % 8 === 0 ? '#ffffff' : '#ffd27a');
      });
      const nextI = c.guide.findIndex((_, i) => !c.covered.has(i));
      if (nextI >= 0 && !c.stroke) { const [gx, gy] = c.guide[nextI]; ring(p, Math.round(TOP.x + gx * TOP.r), Math.round(TOP.y + gy * TOP.r), 3 + (Math.floor(now * 3) % 2), '#ffd27a'); }
      drawProgress(p, 120, 92, 26, c.covered.size / c.guide.length);
    }
    const ptr = this.pointer;
    if (c.cfg.mech === 'trace' && this.down && ptr) {
      if (key === 'art') spr(g, 'st_jug_milk', ptr[0] + 9, ptr[1] + 10, 0.9, { rot: -0.7, flip: true });
      else spr(g, key === 'drizzle' ? 'k_s_caramel' : 'k_s_chocsauce', ptr[0], ptr[1] + 1, 0.85, { rot: Math.PI * 0.85 });
    }
    if (c.cfg.mech === 'shake' && ptr) { if (key === 'matcha') spr(g, 'st_whisk', ptr[0], ptr[1] + 2); else spr(g, key === 'cocoa' ? 'st_shaker_cocoa' : 'st_shaker_cinnamon', ptr[0], ptr[1] + 2, 1, { rot: Math.PI * 0.8 }); }
    if (c.cfg.mech === 'shake') drawProgress(p, 120, 92, 26, c.count / c.cfg.count);
    if (key === 'choc') { if (this.spoon) spr(g, 'st_spoon', this.spoon[0], this.spoon[1]); drawProgress(p, 120, 92, 26, Math.min(1, c.acc / (c.cfg.turns * Math.PI * 2))); if (!c.acc) { const a = now * 3; ring(p, Math.round(TOP.x + Math.cos(a) * 22), Math.round(TOP.y + Math.sin(a) * 22), 2, '#ffd27a'); } }
    if (b.marsh.length > (this.seenMarsh || 0)) { for (const [mx, my] of b.marsh.slice(this.seenMarsh || 0)) splash(this.parts, TOP.x + mx * TOP.r, TOP.y + my * TOP.r, topC(b), 6, 1, TOP.y + TOP.r * 2); }
    this.seenMarsh = b.marsh.length;
    drawParts(g, this.parts);
    if (key === 'marsh') spr(g, 'st_jar', 22, 86, 1.3);
    if (key === 'mint') spr(g, 'st_mint', 22, 74, 3);
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
    drawPortafilter(p, pfAt[0], pfAt[1], this.pf.grounds * (this.pf.at === 'machine' ? Math.min(1, this.pf.left / 0.45 + 0.3) : 1), this.pf.tamped);
    if (key === 'tamp') {
      const press = c.anim ? Math.sin(Math.min(1, c.anim.t / c.anim.dur) * Math.PI) * 4 : 0;
      const ty = pfAt[1] - 12 + press;
      p.rect(pfAt[0] - 4, ty + 6, 9, 3, '#8d9496'); p.hline(pfAt[0] - 4, pfAt[0] + 4, ty + 6, '#c9cfd1');
      p.rect(pfAt[0] - 1, ty - 2, 3, 8, '#7a4e30'); p.rect(pfAt[0] - 2, ty - 4, 5, 3, '#9c6a42');
      p.hline(pfAt[0] - 5, pfAt[0] + 5, ty + 9, INK);
    }
    // spills on the counter
    if (this.puddle > 0.005 || b.messy) {
      const r = Math.min(26, 6 + this.puddle * 60), col = b.cream > 1.2 && !this.puddle ? C.cream : (b.layers[b.layers.length - 1]?.c || C.milk);
      p.ellipse(CUP.x - 4, CUP.by + 2, Math.round(r), Math.max(2, Math.round(r / 5)), shade(col, 0.95));
      p.ellipse(CUP.x - 7, CUP.by + 1, Math.round(r * 0.4), 1, shade(col, 1.1));
    }
    // the jug: resting, steaming under the wand, or pouring into the cup
    const cupH = b.vessel ? VESSELS[b.vessel].big.h : 12, cupTop = CUP.by - cupH;
    const surfaceY = Math.round(CUP.by - 1 - Math.min(1, fillOf(b)) * (cupH - 2));
    const steaming = c && c.cfg.heat;
    const pouringMilk = key === 'pourmilk' && c.held;
    const coldPour = c && c.held && (key === 'coldmilk' || key === 'coldwater');
    const jugMilk = key === 'coldwater' ? '#d6ecf0' : key === 'coldmilk' ? C.coldmilk : C.milk;
    if (steaming) {
      drawJug(p, 116, 66, 0, 1);
      p.line(106, 34, 113, 56, INK); p.line(107, 34, 114, 56, '#c9cfd1');
      if (c.held) for (let i = 0; i < 5; i++) { const k = (now * 1.5 + i / 5) % 1; p.set(110 + Math.sin((now + i) * 5) * 3, 48 - k * 16, `#ffffff${Math.round((1 - k) * 200).toString(16).padStart(2, '0')}`); }
      if (this.jug.temp > 1.15) for (let i = 0; i < 4; i++) p.set(110 + i * 2, 50 - (i % 2) + Math.round(Math.sin(now * 20 + i)), C.milk);
    } else { p.line(106, 34, 109, 52, INK); p.line(107, 34, 110, 52, '#c9cfd1'); }
    if (pouringMilk || coldPour) {
      const jx = CUP.x + 16, jy = cupTop - 2;
      if (key === 'coldwater') drawPitcher(p, jx, jy); else if (key === 'coldmilk') drawCarton(p, jx, jy); else drawJug(p, jx, jy, -0.9, 0.6, jugMilk);
      for (let y = jy - 12; y < surfaceY; y++) { p.set(jx - 9 + Math.round(Math.sin(y * 0.8 + now * 20) * 0.5), y, jugMilk); p.set(jx - 8, y, shade(jugMilk, 0.92)); }
    } else if (!steaming) drawJug(p, JUG_HOME.x, JUG_HOME.by, 0, this.jug?.ready ? 1 : 0, C.milk);
    if (this.jug?.ready && !steaming && !pouringMilk) { for (let i = 0; i < 2; i++) { const k = (now + i / 2) % 1; p.set(JUG_HOME.x - 2 + i * 3, JUG_HOME.by - 20 - k * 8, '#ffffff88'); } }
    // the drink, or an empty spot waiting for a cup
    if (b.vessel) drawDrink(p, CUP.x, CUP.by, b, 'big');
    else { p.ellipse(CUP.x, CUP.by, 12, 3, '#8a5a36'); if (Math.floor(now * 2) % 2) ring(p, CUP.x, CUP.by - 10, 6, '#ffd27a'); }
    // pouring streams
    if (key === 'shot' && c.held) for (let y = SPOUT.y; y < surfaceY; y++) { p.set(SPOUT.x - 1, y, (y + Math.floor(now * 30)) % 4 ? C.espresso : '#5a3420'); p.set(SPOUT.x + 1, y, (y + Math.floor(now * 30) + 2) % 4 ? C.espresso : '#5a3420'); }
    if (key === 'water' && c.held) for (let y = 49; y < surfaceY; y++) { p.set(SPOUT.x + 4, y, '#dceef2'); p.set(SPOUT.x + 5, y, (y + Math.floor(now * 30)) % 3 ? '#cfe8ee' : '#ffffff'); }
    // tools for the current step
    if (key === 'ice' || this.fx.some((f) => f.kind === 'ice')) drawBucket(p, SLOT.x, SLOT.by);
    if (key === 'berry') drawBerries(p, SLOT.x, SLOT.by, 0);
    if (key === 'lemon' || key === 'orange') drawFruit(p, SLOT.x, SLOT.by, key === 'lemon' ? '#f6e070' : '#f29a3a');
    if (key === 'icecream') drawTub(p, SLOT.x, SLOT.by);
    if (key === 'teabag') drawTeaBox(p, SLOT.x, SLOT.by);
    if (c?.cfg.each && key !== 'berry' && key !== 'lemon' && key !== 'orange') drawBottle(p, SLOT.x, SLOT.by, C[c.cfg.each[0]]);
    if (key === 'cream') drawCreamCan(p, CUP.x + 2, cupTop - 6 - Math.round(Math.min(1.3, b.cream) * 9), c.held);
    if (b.counts.teabag && b.vessel) { p.line(CUP.x + 4, cupTop - 1, CUP.x + 9, cupTop - 6, '#f4ecd6'); p.rect(CUP.x + 8, cupTop - 9, 4, 4, '#f6e070'); p.set(CUP.x + 9, cupTop - 8, '#b5483c'); }
    for (const f of this.fx) {
      if (f.kind === 'ice' && f.t >= 0.4 && !f.splashed && V) { f.splashed = true; splash(this.parts, CUP.x, surfaceY, b.layers[b.layers.length - 1]?.c || '#cfe8ee', 7, V.ry); }
      if ((f.kind === 'drip' || f.kind === 'mash') && f.t >= 0.25 && !f.splashed && V) { f.splashed = true; splash(this.parts, CUP.x + 1, surfaceY, f.c || C.berry, 4, V.ry); }
      if (f.kind === 'ice' && f.t < 0.4) {
        const k = Math.min(1, f.t / 0.4), x = Math.round(SLOT.x + (CUP.x - SLOT.x) * k), y = Math.round(SLOT.by - 14 - Math.sin(k * Math.PI) * 14 + (cupTop + 4 - SLOT.by + 14) * k);
        p.rect(x - 2, y - 2, 5, 5, '#eef9fb'); p.hline(x - 2, x + 2, y - 3, INK); p.vline(x + 3, y - 2, y + 2, '#a9d3dc');
      }
      if (f.kind === 'mash') { const k = f.t; p.rect(CUP.x - 1, cupTop - 10 + Math.round(Math.sin(k * Math.PI) * 6), 3, 10, '#c08a55'); if (k < 0.4) for (let i = 0; i < 4; i++) p.set(CUP.x - 4 + i * 3, cupTop - 2 - Math.round(k * 10) - i % 2, C.berry); }
      if (f.kind === 'drip' && f.t < 0.5) for (let y = cupTop - 8; y < cupTop - 8 + f.t * 30 && y < surfaceY; y++) p.set(CUP.x + 2, y, f.c);
      if (f.kind === 'ground' && f.t < 0.4) p.set(f.x, f.y + f.t * 20, '#3b2014');
    }
    if (this.result && this.result.q >= REFUSE_BELOW) {
      for (let i = 0; i < 6; i++) {
        const a = now * 1.2 + i * 1.05, r = 22 + Math.sin(now * 2 + i) * 2;
        sparkle(p, Math.round(CUP.x + Math.cos(a) * r), Math.round(CUP.by - 16 + Math.sin(a) * r * 0.55), (i + Math.floor(now * 3)) % 2);
      }
    }
    // meters
    if (c && c.cfg.mech === 'hold') {
      if (c.cfg.heat) drawMeter(p, 142, 14, 46, this.jug.temp, HEAT_BAND, true);
      else if (c.cfg.cream) drawMeter(p, 142, 14, 46, b.cream / 1.25, [0.6 / 1.25, 1.1 / 1.25]);
      else drawMeter(p, 142, 14, 46, Math.min(1.15, fillOf(b) + Math.min(0.15, this.puddle)), this.band() || [2, 2]);
    }
    if (c && c.cfg.mech === 'timing') drawTimingBar(p, 30, 7, 84, c.frozen ?? (Math.sin(c.t * 2.6 - Math.PI / 2) + 1) / 2);
    if (key === 'grind') {
      drawProgress(p, 4, 92, 34, Math.min(1, c.acc / (c.cfg.turns * Math.PI * 2)));
      if (!c.acc) { const a = now * 3; p.set(CRANK.x + Math.cos(a) * 10, CRANK.y + Math.sin(a) * 10, '#ffd27a'); p.set(CRANK.x + Math.cos(a - 0.3) * 10, CRANK.y + Math.sin(a - 0.3) * 10, '#ffd27a88'); }
    }
    if (key === 'wipe') {
      drawProgress(p, 120, 92, 26, c.count / c.cfg.count);
      if (this.pointer && this.down) drawRag(p, ...this.pointer);
    }
  }

  drawTop(p, now) {
    const c = this.cur, b = this.b, key = c.key;
    const map = surfaceMap(b);
    p.blit(map, TOP.x - TOP.r, TOP.y - TOP.r);
    if (c.cfg.mech === 'trace' && c.guide) {
      for (let i = 1; i < c.guide.length; i++) {
        const [ax, ay] = c.guide[i - 1], [bx, by] = c.guide[i], n = Math.ceil(Math.hypot(bx - ax, by - ay) * TOP.r / 3);
        for (let k = 0; k < n; k++) { const tt = k / n; p.set(TOP.x + (ax + (bx - ax) * tt) * TOP.r, TOP.y + (ay + (by - ay) * tt) * TOP.r, '#fbf6ea66'); }
      }
      c.guide.forEach(([gx, gy], i) => {
        if (c.covered.has(i)) return;
        const x = Math.round(TOP.x + gx * TOP.r), y = Math.round(TOP.y + gy * TOP.r);
        p.rect(x - 1, y - 1, 3, 3, INK); p.set(x, y, (i + Math.floor(now * 4)) % 8 === 0 ? '#ffffff' : '#ffd27a');
      });
      const nextI = c.guide.findIndex((_, i) => !c.covered.has(i));
      if (nextI >= 0 && !c.stroke) { const [gx, gy] = c.guide[nextI]; ring(p, Math.round(TOP.x + gx * TOP.r), Math.round(TOP.y + gy * TOP.r), 3 + (Math.floor(now * 3) % 2), '#ffd27a'); }
      drawProgress(p, 120, 92, 26, c.covered.size / c.guide.length);
    }
    if (c.cfg.mech === 'trace' && this.down && this.pointer) drawPitcherTop(p, ...this.pointer, c.cfg.color || C.foam);
    if (c.cfg.mech === 'shake' && this.pointer) { if (key === 'matcha') drawWhisk(p, ...this.pointer); else drawShaker(p, ...this.pointer, key === 'cocoa' ? '#5b3a26' : '#a0602a'); }
    if (c.cfg.mech === 'shake') drawProgress(p, 120, 92, 26, c.count / c.cfg.count);
    if (key === 'choc') { if (this.spoon) drawSpoon(p, ...this.spoon); drawProgress(p, 120, 92, 26, Math.min(1, c.acc / (c.cfg.turns * Math.PI * 2))); if (!c.acc) { const a = now * 3; ring(p, Math.round(TOP.x + Math.cos(a) * 22), Math.round(TOP.y + Math.sin(a) * 22), 2, '#ffd27a'); } }
    if (key === 'marsh') drawJar(p, 22, 80);
    if (key === 'mint') { p.ellipse(22, 70, 8, 5, '#3f6b35'); p.ellipse(22, 69, 7, 4, '#5c9a48'); }
  }
}

const topC = (b) => b.top || b.layers[b.layers.length - 1]?.c || C.milk;
// ---------- tool icons for the shelves ----------
// pictures from tools/art3d for each tool (stacked on one anchor)
const TOOL_PICS = {
  demi: ['sv_demi'], cup: ['sv_cup'], mug: ['sv_mug'], glass: ['sv_glass'], tall: ['sv_tall'],
  grind: ['st_hopper_beans', 'st_hopper_glass'], tamp: ['st_tamper'], shot: ['st_pf_full'], water: ['st_kettle'], teabag: ['st_teabag'],
  steam: ['st_jug'], froth: ['st_jug_milk'], pourmilk: ['st_jug_milk'], art: ['sv_cup_top'], ice: ['st_bucket'], coldmilk: ['st_carton'], coldwater: ['st_pitcher'],
  berry: ['st_berries'], lemon: ['st_lemons'], orange: ['st_oranges'], icecream: ['st_tub'], vanilla: ['st_bottle_vanilla'], caramelsyrup: ['st_bottle_caramel'],
  chocsyrup: ['st_bottle_choc'], chai: ['st_bottle_chai'], choc: ['st_chocbar'], matcha: ['st_matchabowl'], cream: ['st_creamcan'], drizzle: ['k_s_caramel'],
  chocdrizzle: ['k_s_chocsauce'], cocoa: ['st_shaker_cocoa'], cinnamon: ['st_shaker_cinnamon'], marsh: ['st_jar'], mint: ['st_mint'],
};
export function toolIcon(k) {
  const p = new Pix(16, 16), cfg = TOOLS[k];
  if (cfg.vessel) { const b = newBuild(null, '', cfg.vessel); drawDrink(p, 8, 13, b, 'small'); return p; }
  const drop = (c) => { p.ellipse(8, 10, 4, 4, INK); p.ellipse(8, 10, 3, 3, c); p.line(8, 3, 5, 8, INK); p.line(8, 3, 11, 8, INK); p.poly([[8, 4], [5, 9], [11, 9]], c); p.set(6, 9, '#ffffff'); };
  const bottle = (c) => { p.rect(5, 5, 6, 10, INK); p.rect(6, 6, 4, 8, c); p.rect(7, 2, 2, 3, '#5f6668'); p.rect(6, 1, 4, 1, INK); p.rect(6, 9, 4, 2, '#fbf6ea'); };
  const shaker = (c) => { p.rect(4, 5, 8, 10, INK); p.rect(5, 6, 6, 8, '#f4ecd6'); p.rect(4, 3, 8, 3, c); p.set(6, 4, INK); p.set(9, 4, INK); };
  const fruit = (c) => { p.ellipse(8, 9, 5, 5, INK); p.ellipse(8, 9, 4, 4, c); p.set(6, 7, '#ffffff'); p.rect(8, 2, 2, 3, '#4f8a4a'); };
  switch (k) {
    case 'grind': p.rect(4, 2, 8, 6, '#d9eef2'); p.rect(5, 4, 6, 4, '#5a3420'); p.rect(5, 8, 6, 7, '#8e3329'); p.rect(11, 6, 4, 1, '#5f6668'); p.rect(14, 5, 1, 3, '#5b3a26'); p.rect(4, 15, 8, 1, INK); break;
    case 'tamp': p.rect(7, 2, 3, 7, '#7a4e30'); p.rect(4, 9, 9, 3, '#8d9496'); p.rect(3, 12, 11, 2, INK); break;
    case 'shot': p.rect(3, 2, 10, 4, '#5f6668'); p.rect(7, 6, 2, 2, '#3a3f41'); p.vline(7, 8, 11, C.espresso); p.vline(8, 8, 11, C.espresso); p.rect(4, 11, 8, 4, '#f7f1e6'); p.rect(5, 11, 6, 1, C.crema); break;
    case 'water': drop('#cfe8ee'); break;
    case 'teabag': p.rect(4, 6, 7, 8, '#f4ecd6'); p.rect(5, 8, 5, 5, '#b0642a'); p.line(8, 6, 11, 2, '#f4ecd6'); p.rect(11, 1, 3, 3, '#f6e070'); break;
    case 'steam': case 'froth': p.poly([[4, 6], [12, 6], [11, 15], [5, 15]], '#c9cfd1'); p.rect(4, 6, 8, 1, '#eef2f2'); p.rect(12, 7, 2, 1, '#9aa2a4'); for (let i = 0; i < 3; i++) p.set(6 + i * 2, 3 - (i % 2), '#ffffff'); if (k === 'froth') { p.rect(5, 7, 6, 2, '#fbf6ea'); } break;
    case 'pourmilk': p.poly([[3, 4], [10, 2], [12, 9], [5, 11]], '#c9cfd1'); p.vline(2, 6, 14, C.milk); p.rect(1, 14, 5, 1, C.milk); break;
    case 'art': p.ellipse(8, 8, 7, 7, INK); p.ellipse(8, 8, 6, 6, C.latteTop); p.rect(5, 6, 2, 2, '#fbf6ea'); p.rect(9, 6, 2, 2, '#fbf6ea'); p.rect(6, 8, 4, 2, '#fbf6ea'); p.rect(7, 10, 2, 1, '#fbf6ea'); break;
    case 'ice': p.rect(3, 4, 7, 7, '#a9d3dc'); p.rect(4, 5, 5, 5, '#eef9fb'); p.rect(8, 8, 6, 6, '#a9d3dc'); p.rect(9, 9, 4, 4, '#eef9fb'); break;
    case 'coldmilk': p.rect(4, 4, 8, 11, INK); p.rect(5, 5, 6, 9, '#fbf6ea'); p.poly([[4, 4], [8, 1], [12, 4]], '#6f8fc9'); p.rect(5, 8, 6, 3, '#6f8fc9'); break;
    case 'coldwater': drop('#e4f3f6'); p.rect(2, 12, 3, 3, '#a9d3dc'); break;
    case 'berry': fruit('#d23a4a'); break;
    case 'lemon': fruit('#f6e070'); break;
    case 'orange': fruit('#f29a3a'); break;
    case 'icecream': p.poly([[5, 9], [11, 9], [8, 15]], '#d4a860'); p.ellipse(8, 7, 4, 3, '#fbf3e0'); p.set(6, 6, '#ffffff'); break;
    case 'vanilla': bottle(C.vanilla); break;
    case 'caramelsyrup': bottle(C.caramel); break;
    case 'chocsyrup': bottle(C.chocsyrup); break;
    case 'chai': bottle(C.chai); break;
    case 'choc': p.rect(3, 4, 10, 9, '#3a1a10'); p.rect(4, 5, 4, 3, '#5a3020'); p.rect(9, 5, 3, 3, '#5a3020'); p.rect(4, 9, 4, 3, '#5a3020'); p.rect(9, 9, 3, 3, '#5a3020'); break;
    case 'matcha': p.ellipse(8, 10, 6, 4, '#f4ecd6'); p.ellipse(8, 9, 5, 2, C.matcha); p.rect(7, 1, 2, 7, '#c9a46b'); break;
    case 'cream': p.rect(5, 4, 6, 11, '#eef2f2'); p.rect(5, 8, 6, 3, '#e7a0a6'); p.rect(7, 1, 2, 3, '#f7f1e6'); p.vline(4, 4, 14, INK); p.vline(11, 4, 14, INK); break;
    case 'drizzle': case 'chocdrizzle': { const c = k === 'drizzle' ? C.caramel : C.chocsyrup; for (let i = 0; i < 5; i++) p.line(2 + i * 3, i % 2 ? 4 : 12, 5 + i * 3, i % 2 ? 12 : 4, c); break; }
    case 'cocoa': shaker('#5b3a26'); break;
    case 'cinnamon': shaker('#a0602a'); break;
    case 'marsh': p.rect(3, 5, 5, 4, C.marsh); p.rect(3, 8, 5, 1, C.marshPink); p.rect(8, 8, 5, 4, C.marsh); p.rect(8, 11, 5, 1, C.marshPink); break;
    case 'mint': p.ellipse(8, 8, 5, 3, '#5c9a48'); p.line(3, 9, 13, 7, '#3f6b35'); break;
  }
  p.outline(INK);
  return p;
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
  p.rect(112, 14, 37, 2, '#9c6a42'); p.hline(112, 148, 16, '#5b3a26');
  for (const [x, h] of [[115, 9], [122, 7], [129, 9]]) { p.rect(x, 14 - h, 6, h, '#d9eef2'); p.rect(x + 1, 14 - h + 3, 4, h - 3, '#5a3420'); p.rect(x, 14 - h - 1, 6, 1, '#9c6a42'); p.vline(x, 14 - h, 13, INK); p.vline(x + 5, 14 - h, 13, INK); }
  for (const x of [136, 141]) { p.rect(x, 9, 5, 5, '#f7f1e6'); p.vline(x + 5, 10, 12, INK); p.hline(x, x + 4, 14, INK); }
  p.rect(146, 7, 3, 7, '#b8623f'); p.ellipse(147, 5, 2, 2, '#5c8f3f'); p.set(146, 4, '#7fb04c');
  // counter top and front
  for (let y = 60; y < 84; y++) for (let x = 0; x < SW; x++) p.set(x, y, y === 60 ? '#c08a55' : (Math.floor((x + (y % 2) * 3) / 24) + y) % 9 === 0 ? '#8a5a36' : y < 62 ? '#a87448' : '#9c6a42');
  p.hline(0, SW - 1, 84, INK);
  for (let y = 85; y < SH; y++) for (let x = 0; x < SW; x++) p.set(x, y, x % 30 === 0 || y === 86 ? '#4a2f20' : '#5b3a26');
  // espresso machine
  const mx0 = 40, mx1 = 104, my0 = 20, my1 = 60;
  p.rect(mx0, my0, mx1 - mx0, my1 - my0, '#c9cfd1');
  for (let x = mx0; x < mx1; x++) { p.set(x, my0, '#eef2f2'); if ((x - mx0) < 4) p.vline(x, my0, my1, '#e3e8e8'); if (mx1 - x < 6) p.vline(x, my0, my1, '#9aa2a4'); }
  p.rect(mx0, 26, mx1 - mx0, 7, '#b5483c'); p.hline(mx0, mx1 - 1, 26, '#c95a4c'); p.hline(mx0, mx1 - 1, 32, '#8e3329');
  p.rect(64, 28, 16, 3, '#f2d27a'); p.hline(66, 77, 29, '#b5483c');
  for (const gx of [50, 94]) { p.ellipse(gx, 42, 5, 5, INK); p.ellipse(gx, 42, 4, 4, '#fbf6ea'); p.line(gx, 42, gx + 2, 39, '#b5483c'); p.set(gx, 42, INK); }
  p.rect(62, 38, 20, 6, '#5f6668'); p.rect(64, 44, 16, 3, '#3a3f41'); p.rect(SPOUT.x - 2, 47, 5, 3, '#5f6668'); p.hline(mx0, mx1 - 1, my1 - 1, '#8d9496');
  // cups warming on top of the machine
  for (const x of [46, 56, 90]) { p.rect(x, 15, 7, 5, '#f7f1e6'); p.vline(x + 6, 15, 19, '#d9cfbf'); p.hline(x, x + 6, 14, INK); }
  // outline the machine
  p.hline(mx0 - 1, mx1, my0 - 1, INK); p.vline(mx0 - 1, my0, my1, INK); p.vline(mx1, my0, my1, INK);
  // drip tray on the counter
  p.rect(52, 76, 40, 4, '#5f6668'); for (let x = 53; x < 91; x += 3) p.vline(x, 77, 78, '#3a3f41'); p.hline(51, 92, 80, INK);
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

function starRow(n, small = false) {
  return `<span class="stars${small ? ' small' : ''}">${[1, 2, 3].map((i) => `<i class="${i <= n ? 'on' : ''}"></i>`).join('')}</span>`;
}
const escapeHtml = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

function drawRag(p, x, y) { x = Math.round(x); y = Math.round(y); p.poly([[x - 7, y - 3], [x + 6, y - 5], [x + 8, y + 3], [x - 5, y + 5]], INK); p.poly([[x - 6, y - 2], [x + 5, y - 4], [x + 7, y + 2], [x - 4, y + 4]], '#6f8fc9'); p.line(x - 4, y, x + 5, y - 2, '#a9c0e8'); }
function drawPitcher(p, x, by) { p.poly(rotPts([[-6, 8], [6, 8], [6, -8], [-6, -8]], x, by - 8, -0.9), INK); p.poly(rotPts([[-5, 7], [5, 7], [5, -7], [-5, -7]], x, by - 8, -0.9), '#d6ecf0'); p.poly(rotPts([[-5, 7], [5, 7], [5, 0], [-5, 0]], x, by - 8, -0.9), '#bfe0e8'); }
function drawCarton(p, x, by) { p.poly(rotPts([[-5, 9], [5, 9], [5, -6], [0, -10], [-5, -6]], x, by - 8, -0.9), INK); p.poly(rotPts([[-4, 8], [4, 8], [4, -5], [0, -9], [-4, -5]], x, by - 8, -0.9), '#fbf6ea'); p.poly(rotPts([[-4, 2], [4, 2], [4, -2], [-4, -2]], x, by - 8, -0.9), '#6f8fc9'); }
function drawFruit(p, x, by, c) { for (const [dx, dy] of [[-6, 0], [2, 0], [-2, -5]]) { p.ellipse(x + dx, by - 4 + dy, 4, 4, INK); p.ellipse(x + dx, by - 4 + dy, 3, 3, c); p.set(x + dx - 1, by - 6 + dy, '#ffffff'); } p.ellipse(x + 9, by - 3, 4, 3, INK); p.ellipse(x + 9, by - 3, 3, 2, shade(c, 1.1)); p.set(x + 9, by - 3, '#ffffff'); }
function drawTub(p, x, by) { p.rect(x - 8, by - 10, 17, 10, INK); p.rect(x - 7, by - 9, 15, 8, '#e6eef0'); p.ellipse(x, by - 10, 7, 2, '#fbf3e0'); p.rect(x - 7, by - 6, 15, 2, '#e7a0a6'); p.line(x + 4, by - 14, x + 9, by - 20, '#8d9496'); p.ellipse(x + 3, by - 13, 2, 1, '#c9cfd1'); }
function drawTeaBox(p, x, by) { p.rect(x - 9, by - 10, 18, 10, INK); p.rect(x - 8, by - 9, 16, 8, '#6d8a58'); p.rect(x - 6, by - 7, 12, 3, '#f4ecd6'); for (let i = 0; i < 3; i++) { p.rect(x - 6 + i * 5, by - 13, 3, 3, '#f4ecd6'); p.set(x - 5 + i * 5, by - 14, '#f6e070'); } }
function drawBottle(p, x, by, c) { p.rect(x - 4, by - 16, 9, 16, INK); p.rect(x - 3, by - 15, 7, 14, c); p.rect(x - 3, by - 10, 7, 4, '#fbf6ea'); p.rect(x - 1, by - 22, 3, 6, '#5f6668'); p.rect(x - 3, by - 23, 7, 2, INK); p.rect(x + 2, by - 21, 4, 1, '#5f6668'); }
