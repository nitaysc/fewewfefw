// Drinks: recipes (name, price, steps) and their pixel-art cups.
import { Pix, grid } from './pix.js';

export const DRINKS = {
  espresso: { name: 'Espresso', price: 12, unlock: 0, fill: '#4a2a18', top: '#b0773f', steps: [['grind', 'Grind the beans'], ['shot', 'Pull the shot']] },
  latte: { name: 'Latte', price: 18, unlock: 0, fill: '#c89a6a', top: '#f4ead2', art: true, steps: [['grind', 'Grind the beans'], ['shot', 'Pull the shot'], ['milk', 'Steam the milk'], ['art', 'Pour a heart']] },
  hotchoc: { name: 'Hot chocolate', price: 15, unlock: 0, fill: '#6b3a22', top: '#fff6ea', dots: '#f2a0b4', steps: [['choc', 'Melt the chocolate'], ['milk', 'Steam the milk'], ['marsh', 'Add marshmallows']] },
  cappuccino: { name: 'Cappuccino', price: 20, unlock: 80, fill: '#a8774c', top: '#fbf3e4', dust: '#7a4e30', steps: [['grind', 'Grind the beans'], ['shot', 'Pull the shot'], ['foam', 'Foam the milk'], ['cocoa', 'Dust with cocoa']] },
  matcha: { name: 'Matcha latte', price: 24, unlock: 140, fill: '#86b25a', top: '#d8ecb6', art: true, steps: [['whisk', 'Whisk the matcha'], ['milk', 'Steam the milk'], ['art', 'Pour a leaf']] },
  strawberry: { name: 'Strawberry milk', price: 22, unlock: 120, fill: '#f2a0b4', top: '#fde2ea', dots: '#c23a52', cold: true, steps: [['berry', 'Mash the strawberries'], ['pour', 'Pour cold milk'], ['ice', 'Add ice']] },
  iced: { name: 'Iced coffee', price: 18, unlock: 100, fill: '#7a4e30', top: '#e9d2b0', cold: true, steps: [['grind', 'Grind the beans'], ['shot', 'Pull the shot'], ['ice', 'Pour over ice']] },
};
export const DRINK_ORDER = ['espresso', 'latte', 'hotchoc', 'cappuccino', 'iced', 'strawberry', 'matcha'];

// a cup filled up to `progress` (0..1), drawn at small (icon) or large (brewing) size
export function cupPix(id, progress = 1, big = false) {
  const d = DRINKS[id];
  if (d.cold) return glassPix(d, progress, big);
  const W = big ? 30 : 11, H = big ? 26 : 10;
  const p = new Pix(W + (big ? 8 : 3), H + 2);
  const ink = '#24160f', white = '#f4efe6', shade = '#d9d2c4';
  const cw = W, top = 1, bottom = H;
  // cup body tapering a little at the bottom
  for (let y = top; y <= bottom; y++) {
    const inset = Math.floor(((y - top) / (bottom - top)) * (big ? 4 : 1.5));
    for (let x = inset; x < cw - inset; x++) p.set(x, y, x > cw - inset - (big ? 5 : 2) ? shade : white);
    p.set(inset - 1, y, ink); p.set(cw - inset, y, ink);
  }
  p.hline(0, cw - 1, top - 1 < 0 ? 0 : top - 1, ink);
  p.hline(Math.floor(big ? 4 : 1.5), cw - 1 - Math.floor(big ? 4 : 1.5), bottom + 1, ink);
  // handle
  const hx = cw, hy = top + Math.floor((bottom - top) * 0.25), hh = Math.floor((bottom - top) * 0.45);
  for (let y = hy; y <= hy + hh; y++) { p.set(hx + 1, y, white); p.set(hx + (big ? 4 : 2), y, ink); }
  p.hline(hx, hx + (big ? 4 : 2), hy - 1, ink); p.hline(hx, hx + (big ? 4 : 2), hy + hh + 1, ink);
  if (big) for (let y = hy; y <= hy + hh; y++) { p.set(hx + 2, y, white); p.set(hx + 3, y, shade); }
  // the drink, seen from slightly above as a band at the rim
  if (progress > 0) {
    const rows = big ? 4 : 2;
    for (let y = top; y < top + rows; y++) for (let x = 1; x < cw - 1; x++) p.set(x, y, progress >= 0.999 ? d.top : progress > 0.5 ? d.fill : '#00000000');
    if (progress >= 0.999) {
      if (d.art) { const cx = Math.floor(cw / 2); p.set(cx, top + 1, d.fill); if (big) { p.set(cx - 1, top + 1, d.fill); p.set(cx + 1, top + 1, d.fill); p.set(cx, top + 2, d.fill); } }
      if (d.dots) for (let x = 2; x < cw - 2; x += big ? 4 : 3) p.set(x, top + (x % 2), d.dots);
      if (d.dust) for (let x = 2; x < cw - 2; x += 2) p.set(x, top + ((x >> 1) % 2), d.dust);
    }
    if (big && progress < 0.999) {
      // a little coffee level visible through a "window" so the cup fills step by step
      const lvl = Math.round((bottom - top - 3) * progress);
      for (let y = bottom - lvl; y < bottom; y++) for (let x = 6; x < 9; x++) p.set(x, y, d.fill);
    }
  }
  return p;
}

function glassPix(d, progress, big) {
  const W = big ? 22 : 8, H = big ? 30 : 11;
  const p = new Pix(W + 2, H + 3);
  const ink = '#24160f', glass = '#d9eef2';
  for (let y = 1; y <= H; y++) {
    p.set(0, y, ink); p.set(W, y, ink);
    for (let x = 1; x < W; x++) p.set(x, y, glass);
  }
  p.hline(0, W, H + 1, ink);
  const lvl = Math.round((H - 2) * Math.min(1, progress));
  for (let y = H - lvl + 1; y <= H; y++) for (let x = 1; x < W; x++) p.set(x, y, y < H - lvl + (big ? 4 : 2) ? d.top : d.fill);
  if (progress >= 0.999) {
    if (d.dots) for (let i = 0; i < (big ? 6 : 2); i++) p.set(2 + ((i * 5) % (W - 3)), H - 2 - ((i * 7) % Math.max(2, lvl - 2)), d.dots);
    for (let i = 0; i < (big ? 3 : 1); i++) { const x = 3 + i * 6, y = H - lvl + 3 + i * 2; p.rect(x, y, big ? 4 : 2, big ? 4 : 2, '#f4fbfc'); }
    // straw
    p.line(W - (big ? 6 : 2), H - 2, W + 1, -1, '#e05a6a');
  }
  return p;
}

const cache = new Map();
export function cupCanvas(id, progress = 1, big = false, scale = 1) {
  const key = `${id}${progress}${big}${scale}`;
  if (!cache.has(key)) cache.set(key, cupPix(id, progress, big).toCanvas(scale));
  return cache.get(key);
}

// speech bubble with a drink (or an emote) inside
export function bubblePix(inner) {
  const w = Math.max(15, inner.w + 6), h = Math.max(14, inner.h + 6);
  const p = new Pix(w, h + 3);
  const ink = '#24160f', fill = '#fbf6ea';
  p.rect(1, 0, w - 2, h, fill); p.rect(0, 1, w, h - 2, fill);
  p.hline(1, w - 2, 0, ink); p.hline(1, w - 2, h - 1, ink); p.vline(0, 1, h - 2, ink); p.vline(w - 1, 1, h - 2, ink);
  p.set(Math.floor(w / 2) - 1, h, fill); p.set(Math.floor(w / 2), h, fill); p.set(Math.floor(w / 2), h + 1, fill);
  p.set(Math.floor(w / 2) - 2, h, ink); p.set(Math.floor(w / 2) + 1, h, ink); p.set(Math.floor(w / 2) - 1, h + 1, ink); p.set(Math.floor(w / 2) + 1, h + 1, ink); p.set(Math.floor(w / 2), h + 2, ink);
  p.blit(inner, Math.floor((w - inner.w) / 2), Math.floor((h - inner.h) / 2));
  return p;
}

const EMOTES = {
  heart: ['.oo.oo.', 'orroRRo', 'orrrrro', '.orrro.', '..oro..', '...o...'],
  note: ['...oooo', '...owwo', '...o..o', '...o..o', '.ooo.oo', 'owwo.oo', '.oo....'],
  sparkle: ['...o...', '...y...', '.o.y.o.', 'yyyyyyy', '.o.y.o.', '...y...', '...o...'],
  camera: ['..ooo..', 'ooooooo', 'owwowwo', 'owoyowo', 'owwowwo', 'ooooooo'],
  wow: ['.ooo.', '.oro.', '.oro.', '.oro.', '.ooo.', '.....', '.ooo.', '.oro.', '.ooo.'],
  coin: ['.ooo.', 'oyyyo', 'oywyo', 'oyyyo', '.ooo.'],
  smile: ['.ooooo.', 'oyyyyyo', 'oyoyoyo', 'oyyyyyo', 'oyoooyo', 'oyyyyyo', '.ooooo.'],
};
const EPAL = { o: '#24160f', r: '#ff7a90', R: '#ffd0d8', w: '#f4efe6', y: '#ffd27a' };
const bcache = new Map();
export function bubbleCanvas(kind) {
  if (!bcache.has(kind)) {
    const inner = DRINKS[kind] ? cupPix(kind) : grid(EMOTES[kind], EPAL);
    bcache.set(kind, bubblePix(inner).toCanvas());
  }
  return bcache.get(kind);
}
export const EMOTE_KINDS = Object.keys(EMOTES);
