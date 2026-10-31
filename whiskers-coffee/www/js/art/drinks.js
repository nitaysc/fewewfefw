// Drinks: recipes, extras, and how a drink looks. A drink is built up as layers in a
// vessel (espresso, milk, foam...) plus a "surface" seen from above (latte art, cocoa,
// marshmallows, cream). The same build draws the big cup at the barista station and the
// small cup in the café, so what a player makes is what customers get.
import { Pix, grid, shade, mix, hash } from './pix.js';

export const INK = '#24160f';
export const C = {
  espresso: '#3b2014', crema: '#b0773f', milk: '#efe4cf', foam: '#fbf6ea', latteTop: '#c08a5a',
  choc: '#4a2416', hotchoc: '#7a4630', matcha: '#6f9f45', matchaTop: '#8fbf5a', matchaFoam: '#e4f0cf',
  berry: '#d2405a', pinkmilk: '#f4c9d3', coldmilk: '#f2ead8', cocoa: '#6b3a22', cinnamon: '#a0602a',
  caramel: '#c9822f', cream: '#fffaf0', marsh: '#fff6f0', marshPink: '#f6c4d2',
  water: '#dceef2', coldwater: '#e4f3f6', tea: '#b0642a', chai: '#a8683a', chailatte: '#d2a77a',
  vanilla: '#f2e2b0', caramelsyrup: '#c9822f', chocsyrup: '#3a1a10', lemon: '#f6e070', orange: '#f29a3a', icecream: '#fbf3e0',
  mocha: '#6b3f2a',
};
// what each ingredient is called on the recipe card
export const COMPONENT_NAMES = {
  espresso: 'Espresso', water: 'Hot water', milk: 'Steamed milk', foam: 'Milk foam', coldmilk: 'Cold milk', coldwater: 'Cold water',
  choc: 'Melted chocolate', matcha: 'Matcha', berry: 'Strawberries', lemon: 'Lemon juice', orange: 'Orange juice', tea: 'Tea',
  vanilla: 'Vanilla syrup', caramelsyrup: 'Caramel syrup', chocsyrup: 'Chocolate sauce', chai: 'Chai syrup',
  ice: 'Ice', marsh: 'Marshmallows', icecream: 'Ice cream', teabag: 'Tea bag',
  art: 'Latte art', cocoa: 'Cocoa', cinnamon: 'Cinnamon', drizzle: 'Caramel drizzle', chocdrizzle: 'Chocolate drizzle', cream: 'Whipped cream', mint: 'Mint',
};

// vessel shapes: size of the body, saucer and handle at the station (big) and in the café (small)
export const VESSELS = {
  demi: { name: 'Espresso cup', ceramic: true, body: '#f7f1e6', big: { w: 16, h: 11, saucer: 26 }, small: { w: 6, h: 4, saucer: 9 }, handle: true },
  cup: { name: 'Cup', ceramic: true, body: '#f7f1e6', big: { w: 22, h: 14, saucer: 32 }, small: { w: 8, h: 5, saucer: 11 }, handle: true },
  mug: { name: 'Mug', ceramic: true, body: '#d9826f', big: { w: 20, h: 21 }, small: { w: 7, h: 7 }, handle: true },
  glass: { name: 'Glass mug', glass: true, big: { w: 18, h: 23 }, small: { w: 6, h: 8 }, handle: true },
  tall: { name: 'Tall glass', glass: true, big: { w: 16, h: 30 }, small: { w: 6, h: 10 }, straw: true },
};
export const VESSEL_ORDER = Object.keys(VESSELS);

// extras a customer can ask for on top
export const EXTRAS = {
  cream: { name: 'whipped cream', price: 4, need: { cream: 1 } },
  caramel: { name: 'caramel', price: 4, need: { drizzle: 1 } },
  cinnamon: { name: 'cinnamon', price: 3, need: { cinnamon: 1 } },
  vanilla: { name: 'vanilla', price: 3, need: { vanilla: 0.08 } },
};

// recipes: the cup, the amount of each ingredient (as a share of the cup) and counted
// things like ice cubes; toppings are 1 when they should be there
export const DRINKS = {
  espresso: { name: 'Espresso', price: 12, unlock: 0, vessel: 'demi', need: { espresso: 0.8 }, extras: [] },
  americano: { name: 'Americano', price: 13, unlock: 0, vessel: 'cup', need: { espresso: 0.3, water: 0.6 }, extras: [] },
  latte: { name: 'Latte', price: 18, unlock: 0, vessel: 'glass', need: { espresso: 0.25, milk: 0.55, foam: 0.12, art: 1 }, art: 'heart', extras: ['caramel', 'cinnamon', 'vanilla'] },
  hotchoc: { name: 'Hot chocolate', price: 15, unlock: 0, vessel: 'mug', need: { choc: 0.4, milk: 0.46, marsh: 3 }, extras: ['cream', 'cinnamon'] },
  cappuccino: { name: 'Cappuccino', price: 20, unlock: 80, vessel: 'cup', need: { espresso: 0.3, milk: 0.22, foam: 0.38, cocoa: 1 }, extras: ['caramel', 'cinnamon'] },
  flatwhite: { name: 'Flat white', price: 19, unlock: 70, vessel: 'cup', need: { espresso: 0.38, milk: 0.5, foam: 0.05, art: 1 }, art: 'heart', extras: ['vanilla'] },
  tea: { name: 'Black tea', price: 10, unlock: 40, vessel: 'mug', need: { teabag: 1, tea: 0.85 }, extras: [] },
  iced: { name: 'Iced coffee', price: 18, unlock: 100, vessel: 'tall', need: { ice: 3, espresso: 0.24, coldmilk: 0.62 }, extras: ['caramel', 'cream', 'vanilla'] },
  mocha: { name: 'Mocha', price: 22, unlock: 120, vessel: 'glass', need: { chocsyrup: 0.12, espresso: 0.25, milk: 0.45, foam: 0.1, chocdrizzle: 1 }, extras: ['cream'] },
  strawberry: { name: 'Strawberry milk', price: 22, unlock: 120, vessel: 'tall', need: { berry: 0.22, coldmilk: 0.66, ice: 3 }, extras: ['cream'] },
  lemonade: { name: 'Lemonade', price: 16, unlock: 90, vessel: 'tall', need: { lemon: 0.18, coldwater: 0.7, ice: 3, mint: 1 }, extras: [] },
  orangejuice: { name: 'Orange juice', price: 14, unlock: 60, vessel: 'tall', need: { orange: 0.88 }, extras: [] },
  chai: { name: 'Chai latte', price: 21, unlock: 130, vessel: 'mug', need: { chai: 0.16, milk: 0.62, foam: 0.12, cinnamon: 1 }, extras: ['cream'] },
  macchiato: { name: 'Caramel macchiato', price: 24, unlock: 150, vessel: 'glass', need: { vanilla: 0.08, milk: 0.55, foam: 0.1, espresso: 0.2, drizzle: 1 }, extras: ['cream'] },
  matcha: { name: 'Matcha latte', price: 24, unlock: 140, vessel: 'glass', need: { matcha: 0.3, milk: 0.5, foam: 0.12, art: 1 }, art: 'leaf', extras: ['cream', 'vanilla'] },
  affogato: { name: 'Affogato', price: 20, unlock: 160, vessel: 'cup', need: { icecream: 1, espresso: 0.3 }, extras: ['caramel'] },
};
export const DRINK_ORDER = ['espresso', 'americano', 'latte', 'hotchoc', 'tea', 'orangejuice', 'flatwhite', 'cappuccino', 'lemonade', 'iced', 'mocha', 'strawberry', 'chai', 'matcha', 'macchiato', 'affogato'];
export const START_DRINKS = ['espresso', 'americano', 'latte', 'hotchoc'];
export const COUNTED = new Set(['ice', 'marsh', 'icecream', 'teabag']);
export const TOPPINGS = new Set(['art', 'cocoa', 'cinnamon', 'drizzle', 'chocdrizzle', 'cream', 'mint']);

export const orderName = (id, extra) => DRINKS[id].name + (extra ? ` + ${EXTRAS[extra].name}` : '');
export const orderPrice = (id, extra) => DRINKS[id].price + (extra ? EXTRAS[extra].price : 0);
export const needFor = (id, extra) => ({ ...DRINKS[id].need, ...(extra ? EXTRAS[extra].need : {}) });
// how a drink's quality (0..1) turns into stars and a tip on top of the price
export const starsFor = (q) => (q >= 0.85 ? 3 : q >= 0.55 ? 2 : 1);
export const tipFor = (price, q) => { const s = starsFor(q); return s === 3 ? Math.round(price * 0.5) : s === 2 ? Math.round(price * 0.2) : 0; };

// ---------- latte art and drizzle guides (points on the unit disk, y down) ----------
export function guideShape(kind) {
  const pts = [];
  if (kind === 'heart') {
    for (let i = 0; i <= 20; i++) {
      const t = (i / 20) * Math.PI * 2;
      const x = 16 * Math.sin(t) ** 3, y = 13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t);
      pts.push([x / 26, -y / 26 + 0.08]);
    }
  } else if (kind === 'leaf') {
    for (let i = 0; i <= 8; i++) { const y = -0.6 + i * 0.14, w = 0.5 * (1 - i / 10); pts.push([i % 2 ? w : -w, y]); }
    for (let i = 0; i <= 5; i++) pts.push([0, 0.55 - i * 0.24]);
  } else if (kind === 'zigzag') {
    for (let i = 0; i <= 6; i++) pts.push([-0.6 + i * 0.2, i % 2 ? 0.45 : -0.45]);
  }
  return pts;
}

// ---------- a drink being made ----------
// amt: amounts of each liquid; layers: the same in the order poured (for drawing);
// counts: ice cubes, marshmallows...; top: toppings that are on; messy: spilled
export function newBuild(id = null, extra = '', vessel = null) {
  return { id, extra, vessel, layers: [], amt: {}, counts: {}, tops: {}, top: null, strokes: [], dots: [], marsh: [], chunks: 0, froth: 0, cream: 0, ice: 0, straw: false, map: null, dirty: true, spill: 0, messy: false, artScore: 0, burnt: false, shotQ: 1 };
}
export const fillOf = (b) => b.layers.reduce((a, l) => a + l.amt, 0);
// how a liquid looks once it's in the cup, given what's already there
function mixedKey(b, key) {
  if (key === 'water' && b.counts.teabag) return 'tea';
  if (key === 'milk' && b.amt.choc) return 'hotchoc';
  if (key === 'milk' && b.amt.chai) return 'chailatte';
  if (key === 'milk' && b.amt.chocsyrup) return 'mocha';
  return key;
}
// pour some of a liquid; returns how much spilled over the rim
export function pour(b, key, amt) {
  const room = Math.max(0, 1 - fillOf(b));
  const put = Math.min(room, amt), spilled = amt - put;
  const as = key === 'water' && b.counts.teabag ? 'tea' : key;
  b.amt[as] = (b.amt[as] || 0) + put;
  const look = mixedKey(b, key);
  const last = b.layers[b.layers.length - 1];
  if (put > 0) { if (last && last.key === look) last.amt += put; else b.layers.push({ key: look, c: C[look] || C[key], amt: put }); }
  if (spilled > 0) { b.spill += spilled; b.messy = true; }
  // the surface takes the colour of what was poured last
  if (put > 0) b.top = key === 'espresso' && (b.vessel === 'demi' || b.vessel === 'cup') && !b.amt.milk ? C.crema : key === 'milk' && b.amt.espresso ? C.latteTop : key === 'milk' && b.amt.matcha ? C.matchaTop : key === 'foam' ? (b.amt.matcha ? C.matchaTop : b.amt.espresso && !b.amt.chocsyrup ? '#c8935f' : C.foam) : C[look] || C[key];
  b.dirty = true;
  return spilled;
}
export const addLayer = (b, key, amt) => pour(b, key, amt);

// ---------- judging a drink against its recipe ----------
// returns { q: 0..1, notes: [text] }
export function judge(b, id, extra = '') {
  const need = needFor(id, extra), notes = [];
  if (!b.vessel) return { q: 0, notes: ['There is no cup'] };
  let total = 0, n = 0;
  for (const [k, want] of Object.entries(need)) {
    let sc;
    if (COUNTED.has(k)) { const have = k === 'ice' ? b.ice : k === 'marsh' ? b.marsh.length : (b.counts[k] || 0); sc = have >= want ? Math.max(0.6, 1 - (have - want) * 0.1) : have / want; if (have < want) notes.push(['Not enough: {thing}', k]); }
    else if (TOPPINGS.has(k)) {
      const have = k === 'cream' ? b.cream : k === 'art' ? b.artScore : b.tops[k] || 0;
      sc = k === 'cream' ? (have >= 0.6 && have <= 1.2 ? 1 : have > 0 ? 0.6 : 0) : Math.min(1, have);
      if (!have) notes.push(['Missing: {thing}', k]);
    } else {
      const have = b.amt[k] || 0, tol = Math.max(0.08, want * 0.45);
      sc = Math.max(0, 1 - Math.abs(have - want) / tol);
      if (have < 0.01) notes.push(['Missing: {thing}', k]);
      else if (have > want + tol * 0.4) notes.push(['Too much: {thing}', k]);
      else if (have < want - tol * 0.4) notes.push(['A little more: {thing}', k]);
      if (k === 'espresso') { sc *= b.shotQ; if (b.shotQ < 0.85 && have > 0.01) notes.push([b.shotQ <= 0.6 ? 'The coffee was not tamped' : 'The tamp was a little uneven', null]); }
      if (k === 'milk' && b.burnt) { sc *= 0.7; notes.push(['The milk got too hot', null]); }
    }
    total += sc; n++;
  }
  let q = n ? total / n : 0;
  // things that shouldn't be in it
  for (const [k, v] of Object.entries(b.amt)) if (!need[k] && v > 0.04) { q -= 0.15; notes.push(['Not in this recipe: {thing}', k]); }
  if (b.ice && !need.ice) { q -= 0.15; notes.push(['Not in this recipe: {thing}', 'ice']); }
  if (b.vessel !== DRINKS[id].vessel) { q *= 0.75; notes.push(['Usually served in: {thing}', 'v:' + DRINKS[id].vessel]); }
  if (b.spill > 0.02) { q -= Math.min(0.2, b.spill); }
  return { q: Math.max(0, Math.min(1, q)), notes };
}

// the drink as it looks when made perfectly (for the café sprites)
export function finalBuild(id, extra = '') {
  const d = DRINKS[id], need = needFor(id, extra), b = newBuild(id, extra, d.vessel);
  const order = ['teabag', 'chocsyrup', 'vanilla', 'chai', 'caramelsyrup', 'berry', 'lemon', 'orange', 'matcha', 'choc', 'icecream', 'ice', 'espresso', 'water', 'tea', 'coldwater', 'coldmilk', 'milk', 'foam'];
  // a macchiato is milk first with the shot poured on top
  const seq = id === 'macchiato' ? ['vanilla', 'milk', 'foam', 'espresso'] : order;
  for (const k of seq) {
    if (!need[k]) continue;
    if (k === 'ice') b.ice = need.ice;
    else if (k === 'teabag') b.counts.teabag = 1;
    else if (k === 'icecream') b.counts.icecream = 1;
    else pour(b, k === 'tea' ? 'water' : k, need[k]);
  }
  if (need.marsh) b.marsh.push([-0.3, -0.2], [0.3, -0.1], [0, 0.32]);
  for (const k of ['drizzle', 'chocdrizzle', 'cocoa', 'cinnamon', 'mint']) if (need[k]) b.tops[k] = 1;
  if (need.art) b.artScore = 1;
  if (need.art) b.strokes.push({ c: id === 'matcha' ? '#f4f9e8' : C.foam, w: 0.085, pts: guideShape(d.art), z: 0 });
  if (need.cream) b.cream = 1;
  if (need.drizzle || need.chocdrizzle) b.strokes.push({ c: need.drizzle ? C.caramel : C.chocsyrup, w: 0.045, pts: guideShape('zigzag'), z: 1 });
  for (const k of ['cocoa', 'cinnamon']) if (need[k]) for (let i = 0; i < 46; i++) { const a = hash(i, 3, 7) * Math.PI * 2, r = Math.sqrt(hash(i, 5, 2)) * 0.8; b.dots.push([Math.cos(a) * r, Math.sin(a) * r, C[k]]); }
  if (need.mint) b.dots.push([0.3, -0.2, '#5c9a48'], [0.35, -0.25, '#5c9a48'], [0.25, -0.15, '#3f6b35']);
  b.straw = VESSELS[b.vessel].straw;
  b.dirty = true;
  return b;
}

// ---------- the surface seen from above, as a map over the unit disk ----------
const M = 68;
export const MAP_SIZE = M;
function topColor(b) { return b.top || (b.layers.length ? b.layers[b.layers.length - 1].c : null); }
export function surfaceMap(b) {
  if (b.map && !b.dirty) return b.map;
  const p = new Pix(M, M), R = M / 2;
  const base = topColor(b);
  const inDisk = (x, y) => (x - R + 0.5) ** 2 + (y - R + 0.5) ** 2 <= R * R;
  if (base) {
    for (let y = 0; y < M; y++) for (let x = 0; x < M; x++) {
      if (!inDisk(x, y)) continue;
      let c = base;
      const n = hash(x, y, 17);
      // a soft sheen and a fine bubbly texture on foam and crema
      const d = Math.hypot(x - R * 0.7, y - R * 0.6) / R;
      if (d < 0.35) c = shade(c, 1.06);
      if (n > 0.93) c = shade(c, 1.08); else if (n < 0.05) c = shade(c, 0.93);
      // crema darkens towards the rim
      if (Math.hypot(x - R, y - R) > R - 3) c = shade(c, 0.88);
      p.set(x, y, c);
    }
    if (b.froth > 0) for (let i = 0; i < 90 * b.froth; i++) {
      const a = hash(i, 9, 1) * 6.283, r = Math.sqrt(hash(i, 4, 8)) * (R - 4);
      p.set(R + Math.cos(a) * r, R + Math.sin(a) * r, i % 3 ? C.matchaFoam : shade(C.matchaFoam, 0.9));
    }
    // unmelted chocolate pieces while stirring
    for (let i = 0; i < Math.round(b.chunks * 14); i++) {
      const a = hash(i, 2, 4) * 6.283, r = Math.sqrt(hash(i, 6, 3)) * (R - 8);
      p.rect(Math.round(R + Math.cos(a) * r), Math.round(R + Math.sin(a) * r), 3, 3, '#2e160c');
      p.set(Math.round(R + Math.cos(a) * r), Math.round(R + Math.sin(a) * r), '#5a3020');
    }
  }
  const stroke = (s) => {
    const rad = Math.max(1, s.w * R);
    for (let k = 1; k < s.pts.length; k++) {
      const [ax, ay] = s.pts[k - 1], [bx, by] = s.pts[k];
      const n = Math.ceil(Math.hypot(bx - ax, by - ay) * R) + 1;
      for (let i = 0; i <= n; i++) {
        const t = i / n, cx = R + (ax + (bx - ax) * t) * R, cy = R + (ay + (by - ay) * t) * R;
        for (let dy = -rad; dy <= rad; dy++) for (let dx = -rad; dx <= rad; dx++) if (dx * dx + dy * dy <= rad * rad && inDisk(cx + dx, cy + dy)) p.set(cx + dx, cy + dy, s.c);
      }
    }
    if (s.pts.length === 1) { const [x, y] = s.pts[0]; p.ellipse(Math.round(R + x * R), Math.round(R + y * R), Math.round(rad), Math.round(rad), s.c); }
  };
  for (const s of b.strokes) if (!s.z) stroke(s);
  for (const [x, y, c] of b.dots) { const px = R + x * R, py = R + y * R; if (inDisk(px, py)) { p.set(px, py, c); if (hash(px, py, 1) > 0.5) p.set(px + 1, py, shade(c, 1.15)); } }
  if (b.cream > 0) {
    // a swirl of whipped cream piled in the middle
    const cr = (R - 6) * Math.min(1, b.cream);
    for (let y = 0; y < M; y++) for (let x = 0; x < M; x++) {
      const d = Math.hypot(x - R, y - R);
      if (d > cr) continue;
      const ang = Math.atan2(y - R, x - R);
      const swirl = Math.sin(d * 0.7 - ang * 2);
      p.set(x, y, swirl > 0.55 ? '#e9dfcf' : swirl < -0.6 ? '#ffffff' : C.cream);
    }
  }
  for (const s of b.strokes) if (s.z) stroke(s);
  for (const [x, y] of b.marsh) {
    const px = Math.round(R + x * R) - 3, py = Math.round(R + y * R) - 3;
    p.rect(px, py, 7, 6, C.marsh); p.rect(px, py + 4, 7, 2, C.marshPink); p.rect(px + 1, py, 4, 1, '#ffffff');
    p.hline(px, px + 6, py + 6, '#d8b8a8');
  }
  b.map = p; b.dirty = false;
  return p;
}

// ---------- drawing a drink from the side ----------
function sampleMap(map, nx, ny) {
  const v = map.data[Math.min(M - 1, Math.max(0, Math.floor((ny + 1) / 2 * M))) * M + Math.min(M - 1, Math.max(0, Math.floor((nx + 1) / 2 * M)))];
  return v >>> 24 ? v : 0;
}
// fill an ellipse given by its pixel columns x0..x1 and centre row cy
function ellipseCols(pix, x0, x1, cy, ry, fn) {
  const cx = (x0 + x1) / 2, rx = (x1 - x0 + 1) / 2;
  for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) for (let x = x0; x <= x1; x++) {
    const nx = (x - cx) / rx, ny = (y - cy) / (ry + 0.5);
    if (nx * nx + ny * ny <= 1) { const c = fn(nx, ny, x, y); if (c) pix.set(x, y, c); }
  }
}

// draws the drink with its bottom centre at (cx, by). size: 'big' (station) or 'small' (café)
export function drawDrink(pix, cx, by, b, size = 'big', opts = {}) {
  if (!b.vessel) return;
  const V = VESSELS[b.vessel], d = V[size], big = size === 'big';
  const w = d.w, h = d.h, x0 = Math.round(cx - w / 2), x1 = x0 + w - 1;
  const ry = big ? Math.max(2, Math.round(w / 6)) : 1;
  const yt = by - h;
  const fill = Math.min(1, fillOf(b));
  const map = b.layers.length || b.cream || b.marsh.length || b.dots.length ? surfaceMap(b) : null;
  const glassC = '#d6ecf099', glassEdge = '#f4fbfccc';

  if (d.saucer) {
    const sx0 = Math.round(cx - d.saucer / 2), sx1 = sx0 + d.saucer - 1, sry = big ? 3 : 1;
    ellipseCols(pix, sx0 - 1, sx1 + 1, by, sry + 1, () => INK);
    ellipseCols(pix, sx0, sx1, by, sry, (nx, ny) => (ny < -0.2 ? '#fffaf2' : ny > 0.4 ? '#cfc4b2' : '#ece4d6'));
  }
  // handle (behind for glasses, beside for cups)
  if (V.handle) {
    const hy0 = yt + Math.round(h * 0.2), hy1 = yt + Math.round(h * (big ? 0.7 : 0.75)), hw = big ? 5 : 2;
    const col = V.glass ? '#cfe6ea' : V.body;
    for (let y = hy0; y <= hy1; y++) { pix.set(x1 + hw, y, INK); if (big) { pix.set(x1 + hw - 1, y, col); pix.set(x1 + hw - 2, y, shade(col, 0.85)); } }
    pix.hline(x1, x1 + hw, hy0 - 1, INK); pix.hline(x1, x1 + hw, hy1 + 1, INK);
    if (big) { pix.hline(x1 + 1, x1 + hw - 1, hy0, col); pix.hline(x1 + 1, x1 + hw - 1, hy1, col); pix.vline(x1 + 1, hy0 + 1, hy1 - 1, INK); }
  }
  // body, with a gentle taper at the bottom of cups
  const taper = (y) => (V.ceramic && b.vessel !== 'mug' ? Math.floor(Math.max(0, (y - yt) / h - 0.55) * (big ? 7 : 2)) : 0);
  const innerH = h - 2;
  const levelY = by - 1 - fill * innerH;
  for (let y = yt; y <= by; y++) {
    const ins = taper(y), a = x0 + ins, z = x1 - ins;
    pix.set(a - 1, y, INK); pix.set(z + 1, y, INK);
    for (let x = a; x <= z; x++) {
      if (V.ceramic) {
        const t = (x - a) / Math.max(1, z - a);
        pix.set(x, y, t < 0.18 ? shade(V.body, 1.06) : t > 0.75 ? shade(V.body, 0.86) : V.body);
      } else {
        // glass: the drink shows through in its layers
        let c = null;
        if (y < by && y > levelY) {
          let acc = 0;
          const f = (by - 1 - y) / innerH;
          for (const l of b.layers) { acc += l.amt; if (f <= acc + 0.0001) { c = l.c; break; } }
          c = c || b.layers[b.layers.length - 1]?.c;
        }
        pix.set(x, y, c ? mix(c, '#ffffff', 0.08) : glassC);
        if (x === a || (big && x === a + 1 && y % 3)) pix.set(x, y, glassEdge);
      }
    }
  }
  pix.hline(x0 + taper(by), x1 - taper(by), by + 1, INK);
  if (V.ceramic && big && b.vessel === 'mug') { pix.hline(x0, x1, yt + 4, shade(V.body, 1.12)); pix.hline(x0, x1, by - 3, shade(V.body, 0.9)); }
  // ice cubes in glasses
  if (V.glass && b.ice) {
    const cubes = [[0.3, 0.25], [0.62, 0.4], [0.4, 0.6], [0.68, 0.72]].slice(0, b.ice);
    const s = big ? 5 : 2;
    for (const [fx, fy] of cubes) {
      const x = Math.round(x0 + 1 + fx * (w - s - 2)), y = Math.round(Math.max(levelY + 1, yt + 2) + fy * (by - 2 - Math.max(levelY + 1, yt + 2) - s));
      pix.rect(x, y, s, s, '#eef9fbbb'); if (big) { pix.hline(x, x + s - 1, y, '#ffffffdd'); pix.vline(x + s - 1, y, y + s - 1, '#a9d3dcdd'); }
    }
  }
  // in a glass the surface is an ellipse at the drink's level, seen through the glass
  const glassBack = '#e6f3f5';
  // rim and the top of the drink
  const rimC = V.ceramic ? shade(V.body, 1.05) : '#eef8fa';
  const cxf = (x0 + x1) / 2, rxf = (x1 - x0 + 1) / 2;
  ellipseCols(pix, x0 - 1, x1 + 1, yt, ry + 1, (ox, oy, x, y) => {
    const nx = (x - cxf) / rxf, ny = (y - yt) / (ry + 0.5);
    if (nx * nx + ny * ny > 1) return INK;
    const inner = nx * nx * 1.15 + ny * ny * 1.4 <= 1;
    if (!inner) return rimC;
    if (V.ceramic) {
      // inside of the cup; the drink's surface sits a little lower the emptier it is
      const ly = ny - (1 - fill) * 2.2;
      if (fill > 0.05 && nx * nx + ly * ly <= 1) return (map && sampleMap(map, nx, ly)) || topColor(b) || '#cfc3ae';
      return ny < 0 ? shade(V.body, 0.8) : shade(V.body, 0.9);
    }
    return glassBack;
  });
  if (V.glass && fill > 0.02) {
    const sy = Math.max(yt + (big ? 1 : 0), Math.round(levelY));
    ellipseCols(pix, x0, x1, sy, ry, (nx, ny) => (map && sampleMap(map, nx, ny)) || topColor(b));
    if (big) { pix.set(x0 - 1, sy, INK); pix.set(x1 + 1, sy, INK); }
  }
  // marshmallows bob above the rim of a mug
  if (b.marsh.length && b.vessel === 'mug' && fill > 0.6) {
    b.marsh.forEach(([mx], i) => {
      const px = Math.round(cx + mx * w * 0.4) - (big ? 2 : 0), py = yt - (big ? 2 : 1) + (i % 2);
      if (big) { pix.rect(px, py, 5, 3, C.marsh); pix.rect(px, py + 2, 5, 1, C.marshPink); pix.hline(px, px + 4, py - 1, INK); }
      else pix.set(px, py, C.marsh);
    });
  }
  // whipped cream piled above the rim
  if (b.cream > 0) {
    const ch = Math.round((big ? 9 : 3) * Math.min(1.2, b.cream));
    for (let k = 0; k <= ch; k++) {
      const t = k / (ch + 1), rw = Math.max(1, Math.round((w / 2 - (big ? 1 : 0)) * (1 - t * t * 0.9)));
      const y = yt - k;
      for (let x = Math.round(cx) - rw; x <= Math.round(cx) + rw - 1; x++) pix.set(x, y, x > cx + rw * 0.4 ? '#e9dfcf' : ((x + k) % 4 === 0 ? '#ffffff' : C.cream));
      pix.set(Math.round(cx) - rw - 1, y, INK); pix.set(Math.round(cx) + rw, y, INK);
    }
    pix.hline(Math.round(cx) - 1, Math.round(cx), yt - ch - 1, INK);
    if (b.strokes.some((s) => s.z)) for (let k = 1; k < ch; k += big ? 3 : 2) pix.hline(Math.round(cx) - 2 - (k % 2), Math.round(cx) + 1 + (k % 2), yt - k, C.caramel);
  }
  // a scoop of ice cream sits in the cup
  if (b.counts?.icecream) {
    const r = big ? 6 : 2, sy = yt - (big ? 1 : 0);
    ellipseCols(pix, Math.round(cx) - r - 1, Math.round(cx) + r, sy, big ? 4 : 1, () => INK);
    ellipseCols(pix, Math.round(cx) - r, Math.round(cx) + r - 1, sy - (big ? 1 : 0), big ? 3 : 1, (nx, ny) => (ny < -0.3 && nx < 0 ? '#ffffff' : C.icecream));
  }
  // drips down the side after a spill
  if (b.messy && big) {
    const c = b.cream > 1.2 ? C.cream : topColor(b) || C.espresso;
    for (const [fx, len] of [[0.2, 6], [0.55, 9], [0.8, 4]]) { const x = Math.round(x0 + fx * w); pix.vline(x, yt, yt + len, c); pix.set(x, yt + len + 1, shade(c, 0.85)); }
  }
  // straw
  if (b.straw) {
    const sx = Math.round(cx + w * 0.2), top = yt - (big ? 10 : 4);
    for (let y = top; y < yt + (big ? 8 : 2); y++) pix.set(sx + Math.round((yt + 8 - y) * (big ? 0.25 : 0.3)), y, Math.floor(y / 2) % 2 ? '#e05a6a' : '#fbf6ea');
  }
  if (opts.steam) for (let i = 0; i < 3; i++) pix.set(cx - 2 + i * 2, yt - 3 - ((i * 2) % 3), '#ffffff88');
}

// ---------- small sprites for the café and the menus ----------
const cache = new Map();
export function cupPix(id, extra = '') {
  const b = finalBuild(id, extra);
  const V = VESSELS[b.vessel].small;
  const W = Math.max(V.saucer || 0, V.w + 4) + 4, H = V.h + (b.cream ? 4 : 0) + (b.straw ? 5 : 0) + (V.saucer ? 3 : 2) + 1;
  const p = new Pix(W, H);
  drawDrink(p, Math.floor(W / 2) - (V.saucer ? 0 : 1), H - (V.saucer ? 3 : 2), b, 'small');
  return p;
}
export function cupCanvas(id, extra = '', scale = 1) {
  const key = `${id}|${extra}|${scale}`;
  if (!cache.has(key)) cache.set(key, cupPix(id, extra).toCanvas(scale));
  return cache.get(key);
}

// speech bubble with a drink (or an emote) inside
export function bubblePix(inner, badge = null) {
  const w = Math.max(15, inner.w + 6), h = Math.max(14, inner.h + 6);
  const p = new Pix(w + (badge ? 4 : 0), h + 3);
  const ink = INK, fill = '#fbf6ea';
  p.rect(1, 0, w - 2, h, fill); p.rect(0, 1, w, h - 2, fill);
  p.hline(1, w - 2, 0, ink); p.hline(1, w - 2, h - 1, ink); p.vline(0, 1, h - 2, ink); p.vline(w - 1, 1, h - 2, ink);
  p.set(Math.floor(w / 2) - 1, h, fill); p.set(Math.floor(w / 2), h, fill); p.set(Math.floor(w / 2), h + 1, fill);
  p.set(Math.floor(w / 2) - 2, h, ink); p.set(Math.floor(w / 2) + 1, h, ink); p.set(Math.floor(w / 2) - 1, h + 1, ink); p.set(Math.floor(w / 2) + 1, h + 1, ink); p.set(Math.floor(w / 2), h + 2, ink);
  p.blit(inner, Math.floor((w - inner.w) / 2), Math.floor((h - inner.h) / 2));
  if (badge) p.blit(badge, w - 4, -0);
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
  check: ['.....oo', '....ogo', 'oo.ogo.', 'ogoogo.', '.oggo..', '..oo...'],
  star: ['...o...', '..oyo..', 'ooyyyoo', 'oyyyyyo', '.oyyyo.', '.oyoyo.', '.oo.oo.'],
};
const EPAL = { o: INK, r: '#ff7a90', R: '#ffd0d8', w: '#f4efe6', y: '#ffd27a', g: '#8fd16a' };
const bcache = new Map();
export function bubbleCanvas(kind, extra = '') {
  const key = kind + '|' + extra;
  if (!bcache.has(key)) {
    const inner = DRINKS[kind] ? cupPix(kind, extra) : grid(EMOTES[kind], EPAL);
    bcache.set(key, bubblePix(inner).toCanvas());
  }
  return bcache.get(key);
}
export const emotePix = (k) => grid(EMOTES[k], EPAL);
export const EMOTE_KINDS = Object.keys(EMOTES);
