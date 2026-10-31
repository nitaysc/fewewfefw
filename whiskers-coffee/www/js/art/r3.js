// The detailed art (made by tools/art3d): every piece of furniture in all four turns, the café
// room in every style, and animated people and cats. Each picture has an anchor: the pixel that
// sits on the item's floor corner, a person's feet (or hips when seated) or a cat's paws.
import { R3 } from './r3manifest.js';

export const K3 = 2; // picture pixels per world pixel
const imgs = new Map();
let ready = false;
export const r3Ready = () => ready;
export const hasR3 = (name) => !!R3[name];
export function loadR3() {
  if (typeof Image === 'undefined') return Promise.resolve();
  return Promise.all(Object.keys(R3).map((n) => new Promise((res) => {
    const im = new Image();
    im.onload = () => { imgs.set(n, im); res(); };
    im.onerror = () => res();
    im.src = `img/r3/${n}.png`;
  }))).then(() => { ready = true; });
}
const flipped = new Map();
// { canvas, w, h, ax, ay } in picture pixels; flip mirrors it (and its anchor)
export function r3(name, flip = false) {
  const im = imgs.get(name), info = R3[name];
  if (!im || !info) return null;
  const [w, h, ax, ay] = info;
  if (!flip) return { canvas: im, w, h, ax, ay };
  if (!flipped.has(name)) {
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    const g = c.getContext('2d'); g.translate(w, 0); g.scale(-1, 1); g.drawImage(im, 0, 0);
    flipped.set(name, c);
  }
  return { canvas: flipped.get(name), w, h, ax: w - ax, ay };
}

// ---------- people ----------
export const PEOPLE3 = ['barista', 'catear', 'cap', 'cap2', 'hoodie', 'pink', 'jacket', 'sweater', 'jacket2', 'grandpa', 'raincoat', 'student'];
const STAFF3 = ['barista', 'catear', 'cap', 'cap2'];
export function modelFor(look) {
  if (look?.model && R3[`p_${look.model}_f_idle0`]) return look.model;
  // a custom look becomes the closest ready-made barista
  const s = JSON.stringify(look || {});
  let h = 0; for (const ch of s) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return STAFF3[h % STAFF3.length];
}
// p: { view, flip, moving, sitting, carry, state, table, x, y }
export function personFrame(model, p, t) {
  const v = p.view === 'back' ? 'b' : 'f';
  const flip = !!p.flip;
  const ph = (p.x || 0) * 1.7 + (p.y || 0) * 0.9;
  let a;
  if (p.sitting) {
    const sipping = v === 'f' && p.state === 'drink' && (Math.floor(t / 2.4 + ph) % 3 === 0);
    a = sipping ? 'sip0' : 'sit0';
  } else if (p.moving) {
    a = (p.carry ? 'carry' : 'walk') + (Math.floor(t * 8 + ph) % 4);
  } else {
    a = p.carry ? 'carryidle0' : 'idle' + (Math.floor(t * 1.6 + ph) % 2);
  }
  return { name: `p_${model}_${v}_${a}`, flip };
}
export const PERSON3_H = 27; // world pixels from the feet to the top of the head

// ---------- cats ----------
export function catFrame3(coat, state, t, phase) {
  const c = R3[`c_${coat}_sit0`] ? coat : 'orange';
  let a;
  if (state === 'walk') a = 'walk' + (Math.floor(t * 8 + phase) % 4);
  else if (state === 'sleep') a = 'sleep' + (Math.floor(t * 0.8 + phase) % 2);
  else if (state === 'groom') a = 'groom' + (Math.floor(t * 3) % 2);
  else if (state === 'happy') a = 'happy0';
  else a = ((t * 0.6 + phase) % 7 < 0.18) ? 'sit2' : 'sit' + (Math.floor(t * 1.1 + phase) % 2);
  return `c_${c}_${a}`;
}

// ---------- furniture and the room ----------
export const furniture3 = (type, rot) => r3(`f_${type}_${rot}`) || r3(`f_${type}_0`);

// draws floor, both walls and the wall features into one canvas; returns it with its offset
// (world pixels of the canvas corner) and the window panes for the rain
export function composeRoom3(walls, wallStyle, floorStyle) {
  const parts = [[`r_floor_${floorStyle}`, 0, 0], [`r_walln_${wallStyle}`, 0, 0], [`r_wallw_${wallStyle}`, 0, 0]];
  const windows = [];
  for (const f of walls.north || []) {
    parts.push([`r_fn_${f.type}_${f.len}`, f.at + f.len / 2, 0]);
    if (f.type === 'window') windows.push({ side: 'north', u0: (f.at + 0.1) * 16, u1: (f.at + f.len - 0.1) * 16, z0: 1.0 * 19.6, z1: 2.1 * 19.6 });
  }
  for (const f of walls.west || []) {
    parts.push([`r_fw_${f.type}_${f.len}`, 0, f.at + f.len / 2]);
    if (f.type === 'window') windows.push({ side: 'west', u0: (f.at + 0.1) * 16, u1: (f.at + f.len - 0.1) * 16, z0: 1.0 * 19.6, z1: 2.1 * 19.6 });
  }
  const placed = [];
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const [n, x, y] of parts) {
    const im = r3(n);
    if (!im) continue;
    const sx = (x - y) * 16 * K3 - im.ax, sy = (x + y) * 8 * K3 - im.ay;
    placed.push([im, sx, sy]);
    x0 = Math.min(x0, sx); y0 = Math.min(y0, sy); x1 = Math.max(x1, sx + im.w); y1 = Math.max(y1, sy + im.h);
  }
  if (!placed.length) return null;
  const c = document.createElement('canvas');
  c.width = Math.ceil(x1 - x0); c.height = Math.ceil(y1 - y0);
  const g = c.getContext('2d');
  g.imageSmoothingEnabled = false;
  for (const [im, sx, sy] of placed) g.drawImage(im.canvas, Math.round(sx - x0), Math.round(sy - y0));
  return { canvas: c, ax: -x0 / K3, ay: -y0 / K3, w: c.width / K3, h: c.height / K3, windows };
}

// ---------- drinks and dishes: s = in the café, m = order bubbles, b = menus ----------
export function drink3(id, extra = '', size = 's') {
  return (extra && r3(`d_${id}_${extra}_${size}`)) || r3(`d_${id}_${size}`);
}
export const food3 = (id, size = 's') => r3(`f_${id}_${size}`);
// a menu picture as a data URL (or null before the art has loaded)
const urls = new Map();
export function itemURL(kind, id, extra = '') {
  const key = kind + id + extra;
  if (!urls.has(key)) {
    const im = kind === 'food' ? food3(id, 'b') : drink3(id, extra, 'b');
    if (!im) return null;
    const c = document.createElement('canvas'); c.width = im.w; c.height = im.h;
    c.getContext('2d').drawImage(im.canvas, 0, 0);
    urls.set(key, c.toDataURL());
  }
  return urls.get(key);
}
// an order bubble: rounded card with the wanted things side by side, in picture pixels
const bubbles = new Map();
export function orderBubble3(items) {
  const key = JSON.stringify(items.map((i) => [i.kind, i.id, i.extra, i.byColor, i.done]));
  if (bubbles.has(key)) return bubbles.get(key);
  const pics = items.map((i) => (i.kind === 'food' ? food3(i.id, 'm') : drink3(i.id, i.extra, 'm')));
  if (pics.some((p) => !p)) return null;
  const pad = 6, gap = 4;
  const iw = pics.reduce((a, p) => a + p.w, 0) + gap * (pics.length - 1), ih = Math.max(...pics.map((p) => p.h));
  const w = iw + pad * 2, h = ih + pad * 2, tail = 7;
  const c = document.createElement('canvas'); c.width = w + 4; c.height = h + tail + 4;
  const g = c.getContext('2d');
  const shape = (x, y) => {
    const r = 9;
    g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r);
    g.lineTo(x + w / 2 + 6, y + h); g.lineTo(x + w / 2, y + h + tail); g.lineTo(x + w / 2 - 6, y + h);
    g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath();
  };
  g.fillStyle = 'rgba(30,15,8,0.3)'; shape(3, 4); g.fill();
  g.fillStyle = '#fffaf0'; shape(1, 1); g.fill();
  g.lineWidth = 2; g.strokeStyle = '#3b2418'; g.stroke();
  let x = 1 + pad;
  items.forEach((it, n) => {
    const p = pics[n];
    g.globalAlpha = it.done ? 0.45 : 1;
    g.drawImage(p.canvas, x, 1 + pad + ih - p.h);
    g.globalAlpha = 1;
    if (it.done) { g.fillStyle = '#5aa04a'; g.beginPath(); g.arc(x + p.w - 4, 1 + pad + ih - 4, 6, 0, 7); g.fill(); g.strokeStyle = '#fff'; g.lineWidth = 2; g.beginPath(); g.moveTo(x + p.w - 7, 1 + pad + ih - 4); g.lineTo(x + p.w - 5, 1 + pad + ih - 2); g.lineTo(x + p.w - 1, 1 + pad + ih - 7); g.stroke(); }
    else if (it.byColor) { g.fillStyle = it.byColor; g.strokeStyle = '#3b2418'; g.lineWidth = 2; g.beginPath(); g.arc(x + p.w - 3, 1 + pad + 3, 4, 0, 7); g.fill(); g.stroke(); }
    x += p.w + gap;
  });
  bubbles.set(key, c);
  if (bubbles.size > 200) bubbles.delete(bubbles.keys().next().value);
  return c;
}
