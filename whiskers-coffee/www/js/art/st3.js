// The barista station and kitchen in the rendered art (pictures made by tools/art3d/station3d.py).
// Pictures are drawn with canvas 2D in "scene px" (the station is 150x100, the kitchen 240x160);
// liquids, latte art, sauces and dust are painted on top at run time so every drink and dish
// can be anything the player makes.
import { ST3 } from './st3layout.js';
import { r3, r3Ready, hasR3 } from './r3.js';
import { C, surfaceMap, fillOf } from './drinks.js';

const KS = ST3.ks;
export const st3Ready = () => r3Ready() && !!r3('st_bar') && !!r3('k_bg');
export { ST3 };

// draw picture `name` with its anchor at scene point (x, y); s scales it, sy squashes it
export function spr(g, name, x, y, s = 1, opts = {}) {
  const im = r3(name, !!opts.flip);
  if (!im) return null;
  g.save();
  g.translate(x, y);
  if (opts.rot) g.rotate(opts.rot);
  g.scale(s / KS, (s * (opts.sy ?? 1)) / KS);
  if (opts.alpha != null) g.globalAlpha *= opts.alpha;
  g.drawImage(im.canvas, -im.ax, -im.ay);
  g.restore();
  return im;
}
// a picture's size in scene px
export const sprSize = (name) => { const im = r3(name); return im ? [im.w / KS, im.h / KS] : [0, 0]; };

// ---------- icons for the shelves ----------
const iconCache = new Map();
// several pictures stacked on one anchor, fitted into a square icon
export function iconURL(names, size = 72) {
  names = names.filter((n) => hasR3(n));
  const key = names.join('+') + '|' + size;
  if (iconCache.has(key)) return iconCache.get(key);
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const n of names) { const im = r3(n); if (!im) return null; x0 = Math.min(x0, -im.ax); y0 = Math.min(y0, -im.ay); x1 = Math.max(x1, im.w - im.ax); y1 = Math.max(y1, im.h - im.ay); }
  if (!names.length) return null;
  const c = document.createElement('canvas'); c.width = c.height = size;
  const g = c.getContext('2d'), pad = size * 0.06;
  const k = Math.min((size - pad * 2) / (x1 - x0), (size - pad * 2) / (y1 - y0), 1.6);
  g.imageSmoothingQuality = 'high';
  g.translate(size / 2 - ((x0 + x1) / 2) * k, size / 2 - ((y0 + y1) / 2) * k);
  g.scale(k, k);
  for (const n of names) { const im = r3(n); g.drawImage(im.canvas, -im.ax, -im.ay); }
  const url = c.toDataURL();
  iconCache.set(key, url);
  return url;
}

// ---------- colours ----------
const hex = (c) => { const n = parseInt(c.slice(1, 7), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
const rgb = ([r, g, b], a = 1) => `rgba(${r | 0},${g | 0},${b | 0},${a})`;
export const tone = (c, k, a = 1) => { const v = hex(c); return rgb(k >= 1 ? v.map((x) => x + (255 - x) * (k - 1)) : v.map((x) => x * k), a); };
const hash = (a, b) => { const s = Math.sin(a * 127.1 + b * 311.7) * 43758.5453; return s - Math.floor(s); };

// ---------- the top of a drink, seen from above ----------
const TOPPX = ST3.top_r * KS;   // radius of the surface picture
function topColor(b) { return b.top || (b.layers.length ? b.layers[b.layers.length - 1].c : null); }
export function surfaceCanvas(b) {
  surfaceMap(b);                                  // keeps b.map current; we follow its changes
  if (b.map3 && b.map3src === b.map) return b.map3;
  const R = TOPPX, c = b.map3 || document.createElement('canvas');
  c.width = c.height = R * 2;
  const g = c.getContext('2d');
  g.clearRect(0, 0, R * 2, R * 2);
  g.save();
  g.beginPath(); g.arc(R, R, R, 0, Math.PI * 2); g.clip();
  const base = topColor(b);
  if (base) {
    g.fillStyle = base; g.fillRect(0, 0, R * 2, R * 2);
    // fine bubbles in foam and crema
    for (let i = 0; i < 260; i++) {
      const a = hash(i, 1) * 6.283, r = Math.sqrt(hash(i, 2)) * R;
      g.fillStyle = hash(i, 3) > 0.5 ? tone(base, 1.12, 0.5) : tone(base, 0.9, 0.45);
      g.beginPath(); g.arc(R + Math.cos(a) * r, R + Math.sin(a) * r, 1.2 + hash(i, 4) * 2, 0, 6.283); g.fill();
    }
    if (b.froth > 0) for (let i = 0; i < 160 * b.froth; i++) {
      const a = hash(i, 9) * 6.283, r = Math.sqrt(hash(i, 8)) * (R - 6);
      g.fillStyle = i % 3 ? C.matchaFoam : tone(C.matchaFoam, 0.9);
      g.beginPath(); g.arc(R + Math.cos(a) * r, R + Math.sin(a) * r, 2 + hash(i, 7) * 3, 0, 6.283); g.fill();
    }
    for (let i = 0; i < Math.round(b.chunks * 14); i++) {
      const a = hash(i, 5) * 6.283, r = Math.sqrt(hash(i, 6)) * (R - 22);
      const x = R + Math.cos(a) * r, y = R + Math.sin(a) * r;
      g.fillStyle = '#2e160c'; g.beginPath(); g.roundRect(x - 7, y - 6, 14, 12, 3); g.fill();
      g.fillStyle = '#5a3020'; g.beginPath(); g.roundRect(x - 6, y - 6, 9, 5, 2); g.fill();
    }
  }
  const stroke = (s) => {
    g.strokeStyle = s.c; g.fillStyle = s.c; g.lineCap = 'round'; g.lineJoin = 'round';
    g.lineWidth = Math.max(3, s.w * R * 2);
    g.shadowColor = tone(s.c, 1, 0.6); g.shadowBlur = 4;
    g.beginPath();
    s.pts.forEach(([x, y], i) => (i ? g.lineTo(R + x * R, R + y * R) : g.moveTo(R + x * R, R + y * R)));
    if (s.pts.length === 1) { const [x, y] = s.pts[0]; g.arc(R + x * R, R + y * R, g.lineWidth / 2, 0, 6.283); g.fill(); }
    else g.stroke();
    g.shadowBlur = 0;
  };
  for (const s of b.strokes) if (!s.z) stroke(s);
  // dusting and mint leaves
  b.dots.forEach(([x, y, c], i) => {
    const px = R + x * R, py = R + y * R;
    if (c === '#5c9a48' || c === '#3f6b35' || c === '#7fb04c') {
      if (c !== '#5c9a48' || (b.dots[i - 1] && b.dots[i - 1][2] === '#5c9a48')) return;
      for (const [dx, dy, a, col] of [[0, 0, 0.5, '#5c9a48'], [10, -8, -0.6, '#6fae58'], [-9, 6, 2.4, '#4f8a3e']]) {
        g.save(); g.translate(px + dx, py + dy); g.rotate(a);
        g.fillStyle = tone(col, 0.7); g.beginPath(); g.ellipse(0, 1.5, 15, 8, 0, 0, 6.283); g.fill();
        g.fillStyle = col; g.beginPath(); g.ellipse(0, 0, 14, 7, 0, 0, 6.283); g.fill();
        g.strokeStyle = tone(col, 0.7); g.lineWidth = 1.5; g.beginPath(); g.moveTo(-12, 0); g.lineTo(12, 0); g.stroke();
        g.restore();
      }
      return;
    }
    g.fillStyle = tone(c, 1, 0.85); g.beginPath(); g.arc(px, py, 2.2 + hash(i, 1) * 1.6, 0, 6.283); g.fill();
  });
  if (b.cream > 0) {
    // whipped cream in a swirl
    const cr = (R - 12) * Math.min(1, b.cream);
    const grd = g.createRadialGradient(R - cr * 0.3, R - cr * 0.3, cr * 0.1, R, R, cr);
    grd.addColorStop(0, '#ffffff'); grd.addColorStop(0.7, C.cream); grd.addColorStop(1, '#e9dfcf');
    g.fillStyle = grd; g.beginPath(); g.arc(R, R, cr, 0, 6.283); g.fill();
    g.strokeStyle = 'rgba(200,180,155,0.55)'; g.lineWidth = 3; g.beginPath();
    for (let a = 0; a < 6.283 * 3; a += 0.1) { const r = cr * (1 - a / (6.283 * 3.2)); g.lineTo(R + Math.cos(a) * r, R + Math.sin(a) * r); }
    g.stroke();
  }
  for (const s of b.strokes) if (s.z) stroke(s);
  b.marsh.forEach(([x, y], i) => spr(g, i % 2 ? 'st_marsh2' : 'st_marsh', R + x * R, R + y * R + 10, KS * 1.6));
  // a soft sheen and a darker rim, like a real surface
  if (base) {
    const sh = g.createRadialGradient(R * 0.7, R * 0.6, 0, R, R, R);
    sh.addColorStop(0, 'rgba(255,255,255,0.18)'); sh.addColorStop(0.55, 'rgba(255,255,255,0)'); sh.addColorStop(0.88, 'rgba(0,0,0,0)'); sh.addColorStop(1, 'rgba(40,20,10,0.35)');
    g.fillStyle = sh; g.fillRect(0, 0, R * 2, R * 2);
  }
  g.restore();
  b.map3 = c; b.map3src = b.map;
  return c;
}

// ---------- a drink from the side, standing with its bottom centre at (cx, by) ----------
export function drawDrink3(g, cx, by, b) {
  if (!b.vessel) return;
  const V = ST3.ves[b.vessel];
  const rimY = by - V.h, botY = by - V.bot;
  const fill = Math.min(1, fillOf(b));
  const levelY = botY - fill * (botY - rimY - 0.4);
  const ryk = V.ry;
  const surf = fill > 0.02 ? surfaceCanvas(b) : null;
  const atLevel = (y) => V.rxb + (V.rx - V.rxb) * Math.min(1, Math.max(0, (botY - y) / (botY - rimY)));
  const ellipse = (x, y, rx, ry) => { g.beginPath(); g.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2); };
  if (!V.glass) {
    spr(g, 'sv_' + b.vessel, cx, by);
    if (surf) {
      g.save();
      ellipse(cx, rimY, V.rx, V.rx * ryk); g.clip();
      const rl = atLevel(levelY);
      g.drawImage(surf, cx - rl, levelY - rl * ryk, rl * 2, rl * 2 * ryk);
      g.restore();
    }
  } else {
    // the drink shows through the glass in its layers
    const rx = V.rx;
    if (fill > 0.01) {
      g.save();
      g.beginPath(); g.rect(cx - rx, levelY, rx * 2, botY - levelY); g.ellipse(cx, botY, rx, rx * ryk, 0, 0, Math.PI); g.clip();
      let acc = 0;
      for (const l of b.layers) {
        const y0 = botY - acc * (botY - rimY - 0.4); acc += l.amt;
        const y1 = botY - Math.min(1, acc) * (botY - rimY - 0.4);
        g.fillStyle = l.c;
        ellipse(cx, y0, rx, rx * ryk); g.fill();
        g.fillRect(cx - rx, y1, rx * 2, y0 - y1 + 0.3);
      }
      // roundness: light on the left, shade on the right
      const lg = g.createLinearGradient(cx - rx, 0, cx + rx, 0);
      lg.addColorStop(0, 'rgba(255,255,255,0.28)'); lg.addColorStop(0.25, 'rgba(255,255,255,0.05)'); lg.addColorStop(0.7, 'rgba(0,0,0,0)'); lg.addColorStop(1, 'rgba(30,15,5,0.3)');
      g.fillStyle = lg; g.fillRect(cx - rx, levelY - 2, rx * 2, botY - levelY + rx);
      g.restore();
    }
    // ice cubes float in the drink
    const cubes = [[-0.4, 0.15, 0.3], [0.35, 0.3, -0.4], [-0.1, 0.55, 0.9], [0.3, 0.75, 0.2]].slice(0, b.ice);
    for (const [fx, fy, rot] of cubes) {
      const top = Math.max(levelY + 2, rimY + 3);
      spr(g, 'st_ice', cx + fx * rx, top + fy * (botY - top - 2) + 3, 1.15, { rot, alpha: 0.9 });
    }
    if (b.straw) spr(g, 'st_straw', cx + rx * 0.15, botY - 1, 1.15, { rot: 0.12 });
    if (surf) g.drawImage(surf, cx - rx, levelY - rx * ryk, rx * 2, rx * 2 * ryk);
    spr(g, 'sv_' + b.vessel, cx, by);
  }
  // marshmallows bob above the rim of a mug
  if (b.marsh.length && !V.glass && fill > 0.6) b.marsh.slice(0, 4).forEach(([mx], i) => spr(g, i % 2 ? 'st_marsh2' : 'st_marsh', cx + mx * V.rx * 0.8, rimY + 1 + (i % 2), 1));
  // whipped cream piled above the rim
  if (b.cream > 0) {
    const k = (V.rx * 2 * 0.92) / 14.9;
    spr(g, 'st_cream', cx, rimY + V.rx * ryk * 0.5, k, { sy: Math.min(1.35, 0.35 + b.cream) });
    if (b.strokes.some((s) => s.z)) {
      const col = b.strokes.find((s) => s.z).c;
      g.save(); g.strokeStyle = col; g.lineWidth = 0.9; g.lineCap = 'round'; g.beginPath();
      const ch = 8 * k * Math.min(1.35, 0.35 + b.cream);
      for (let i = 0; i <= 8; i++) g.lineTo(cx + (i % 2 ? 1 : -1) * V.rx * 0.6 * (1 - i / 10), rimY - (i / 8) * ch * 0.8);
      g.stroke(); g.restore();
    }
  }
  if (b.counts?.icecream) spr(g, 'st_scoop', cx, rimY + 1.5, (V.rx * 1.5) / 10);
  if (b.counts?.teabag) {
    g.save(); g.strokeStyle = '#efe6d0'; g.lineWidth = 0.5; g.beginPath(); g.moveTo(cx + V.rx * 0.3, rimY); g.lineTo(cx + V.rx + 2, rimY + 3); g.stroke(); g.restore();
    spr(g, 'st_teabag', cx + V.rx + 2.5, rimY + 9, 0.7);
  }
  // drips down the side after a spill
  if (b.messy) {
    const col = b.cream > 1.2 ? C.cream : topColor(b) || C.espresso;
    g.save(); g.strokeStyle = col; g.fillStyle = col; g.lineCap = 'round'; g.lineWidth = 1.3;
    for (const [fx, len] of [[-0.6, 5], [-0.1, 8], [0.45, 4]]) {
      const x = cx + fx * V.rx; g.beginPath(); g.moveTo(x, rimY); g.lineTo(x, rimY + len); g.stroke();
      g.beginPath(); g.arc(x, rimY + len + 0.4, 0.95, 0, 6.283); g.fill();
    }
    g.restore();
  }
}

// a liquid stream from (x, y0) down to y1
export function stream(g, x, y0, y1, col, w = 1.3, now = 0) {
  if (y1 <= y0) return;
  g.save();
  const lg = g.createLinearGradient(x - w, 0, x + w, 0);
  lg.addColorStop(0, tone(col, 1.15)); lg.addColorStop(0.5, col); lg.addColorStop(1, tone(col, 0.8));
  g.fillStyle = lg;
  g.beginPath();
  g.moveTo(x - w * 0.8, y0);
  for (let y = y0; y <= y1; y += 2) g.lineTo(x - w + Math.sin(y * 0.9 + now * 18) * 0.15, y);
  for (let y = y1; y >= y0; y -= 2) g.lineTo(x + w + Math.sin(y * 0.9 + now * 18 + 1) * 0.15, y);
  g.closePath(); g.fill();
  g.restore();
}
