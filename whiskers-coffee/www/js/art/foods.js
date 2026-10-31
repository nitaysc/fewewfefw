// Food: plates the players put together by hand. A dish is a base (a cake slice, a salad
// bowl, toast...) plus whatever the player places on it: ingredients set down anywhere,
// sauces drawn with a finger and toppings shaken over it. A recipe only asks for a few
// things; everything else is the player's own decoration.
import { Pix, shade, hash } from './pix.js';
import { HD, drawBaseHD, drawPlateHD } from './foodart.js';

const INK = '#24160f';

// ingredients placed one by one; draw(p, x, y, r) paints one centred at (x, y)
const dot = (p, x, y, pts, c) => { for (const [dx, dy] of pts) p.set(x + dx, y + dy, c); };
export const INGREDIENTS = {
  strawberry: { name: 'Strawberry', cat: 'fruit', c: '#d23a4a', draw(p, x, y, r) { p.ellipse(x, y + 1, 2, 2, '#d23a4a'); p.rect(x - 1, y - 2, 3, 2, '#d23a4a'); dot(p, x, y, [[-1, 0], [1, 1], [0, 2]], '#f6d27a'); p.set(x - 1, y - 3, '#4f8a4a'); p.set(x + 1, y - 3, '#4f8a4a'); p.set(x, y - 3, '#6daa5a'); p.set(x + (r % 2 ? 1 : -1), y, '#f28a96'); } },
  blueberry: { name: 'Blueberry', cat: 'fruit', c: '#3d4a8b', draw(p, x, y) { p.ellipse(x, y, 1, 1, '#3d4a8b'); p.set(x - 1, y - 1, '#6f7fc0'); p.set(x, y, '#2a3366'); } },
  raspberry: { name: 'Raspberry', cat: 'fruit', c: '#c2305a', draw(p, x, y) { p.ellipse(x, y, 2, 2, '#c2305a'); dot(p, x, y, [[-1, -1], [1, 0], [0, 1], [-1, 1]], '#e85a80'); p.set(x, y, '#8e2040'); } },
  banana: { name: 'Banana', cat: 'fruit', c: '#f6e3a0', draw(p, x, y) { p.ellipse(x, y, 2, 2, '#f6e3a0'); p.set(x, y, '#d9c070'); p.set(x - 1, y + 1, '#d9c070'); p.set(x + 1, y - 1, '#d9c070'); } },
  kiwi: { name: 'Kiwi', cat: 'fruit', c: '#7fb04c', draw(p, x, y) { p.ellipse(x, y, 3, 3, '#5c3f22'); p.ellipse(x, y, 2, 2, '#8fc25a'); p.set(x, y, '#e8f0c8'); dot(p, x, y, [[-1, -1], [1, -1], [-1, 1], [1, 1]], INK); } },
  orange: { name: 'Orange slice', cat: 'fruit', c: '#f29a3a', draw(p, x, y, r) { p.ellipse(x, y, 3, 3, '#f6c060'); p.ellipse(x, y, 2, 2, '#f29a3a'); p.line(x - 2, y, x + 2, y, '#f6d890'); p.line(x, y - 2, x, y + 2, '#f6d890'); if (r % 2) p.rect(x - 3, y, 7, 4, '#00000000'); } },
  mint: { name: 'Mint leaf', cat: 'fruit', c: '#4f8a4a', draw(p, x, y, r) { const f = r % 2 ? 1 : -1; p.ellipse(x, y, 2, 1, '#5c9a48'); p.set(x + 2 * f, y - 1, '#5c9a48'); p.line(x - 2 * f, y, x + 2 * f, y - 1, '#3f6b35'); } },
  cream: { name: 'Cream dollop', cat: 'sweet', c: '#fffaf0', draw(p, x, y) { p.ellipse(x, y, 3, 3, '#e9dfcf'); p.ellipse(x, y - 1, 2, 2, '#fffaf0'); p.set(x, y - 2, '#ffffff'); p.set(x + 1, y, '#e9dfcf'); } },
  shaving: { name: 'Chocolate curl', cat: 'sweet', c: '#5a3020', draw(p, x, y, r) { const f = r % 2 ? 1 : -1; p.line(x - f, y - 2, x + f, y + 2, '#5a3020'); p.set(x, y, '#7a4630'); } },
  macaron: { name: 'Macaron', cat: 'sweet', c: '#f2a0b4', draw(p, x, y, r) { const c = ['#f2a0b4', '#a8d08a', '#f6d27a', '#b7a0e0'][r % 4]; p.ellipse(x, y, 3, 2, shade(c, 0.85)); p.ellipse(x, y - 1, 3, 2, c); p.hline(x - 2, x + 2, y + 1, '#fbf6ea'); } },
  cookie: { name: 'Cookie', cat: 'sweet', c: '#c98b4a', draw(p, x, y, r) { p.ellipse(x, y, 4, 4, '#a86a34'); p.ellipse(x, y, 3, 3, '#d29b5a'); dot(p, x, y, [[-1, -1], [2, 0], [0, 2], [-2, 1], [1, -2]].slice(0, 3 + (r % 3)), '#4a2416'); } },
  chocpiece: { name: 'Chocolate', cat: 'sweet', c: '#4a2416', draw(p, x, y) { p.rect(x - 2, y - 2, 4, 4, '#4a2416'); p.hline(x - 2, x + 1, y - 2, '#6b3a22'); p.set(x, y, '#3a1a10'); } },
  butter: { name: 'Butter', cat: 'sweet', c: '#f6e08a', draw(p, x, y) { p.rect(x - 2, y - 2, 5, 4, '#f6e08a'); p.hline(x - 2, x + 2, y - 2, '#fff2b0'); p.vline(x + 2, y - 1, y + 1, '#e0c460'); } },
  lettuce: { name: 'Lettuce', cat: 'veg', c: '#7fb04c', draw(p, x, y, r) { p.ellipse(x, y, 4, 3, '#5c8f3f'); p.ellipse(x - 1 + (r % 2), y - 1, 3, 2, '#8fc25a'); p.line(x - 3, y, x + 3, y - 1, '#c8e0a0'); } },
  tomato: { name: 'Tomato', cat: 'veg', c: '#e04a3a', draw(p, x, y) { p.ellipse(x, y, 2, 2, '#e04a3a'); p.set(x, y, '#f6a090'); dot(p, x, y, [[-1, 0], [1, 0]], '#f6d27a'); p.set(x - 1, y - 1, '#ff8070'); } },
  cucumber: { name: 'Cucumber', cat: 'veg', c: '#a8d08a', draw(p, x, y) { p.ellipse(x, y, 2, 2, '#3f6b35'); p.ellipse(x, y, 1, 1, '#d4ecb8'); p.set(x, y, '#a8d08a'); } },
  carrot: { name: 'Carrot', cat: 'veg', c: '#f2862a', draw(p, x, y, r) { for (let i = 0; i < 3; i++) p.line(x - 2 + i * 2, y - 2 + ((r + i) % 2), x - 1 + i * 2, y + 2, '#f2862a'); } },
  onion: { name: 'Red onion', cat: 'veg', c: '#a05a9a', draw(p, x, y) { for (let a = 0; a < 16; a++) p.set(Math.round(x + Math.cos(a / 16 * 6.283) * 2.5), Math.round(y + Math.sin(a / 16 * 6.283) * 2.5), '#a05a9a'); } },
  olive: { name: 'Olive', cat: 'veg', c: '#2e2b26', draw(p, x, y) { p.ellipse(x, y, 1, 1, '#2e2b26'); p.set(x, y, '#5a4a3a'); } },
  avocado: { name: 'Avocado', cat: 'veg', c: '#a8c860', draw(p, x, y, r) { const f = r % 2 ? 1 : -1; p.ellipse(x, y, 3, 2, '#e6eaa0'); p.ellipse(x + f, y, 2, 1, '#a8c860'); p.hline(x - 3, x + 3, y + 2, '#3f6b35'); } },
  egg: { name: 'Egg', cat: 'veg', c: '#f6c040', draw(p, x, y) { p.ellipse(x, y, 4, 3, '#fbf6ea'); p.ellipse(x, y, 2, 2, '#f6b030'); p.set(x - 1, y - 1, '#ffe090'); } },
  cheese: { name: 'Cheese', cat: 'veg', c: '#f2d060', draw(p, x, y) { p.rect(x - 2, y - 2, 4, 4, '#f2d060'); p.hline(x - 2, x + 1, y - 2, '#fbe490'); p.set(x, y, '#d9b040'); } },
  crouton: { name: 'Crouton', cat: 'veg', c: '#c98b4a', draw(p, x, y) { p.rect(x - 2, y - 2, 4, 4, '#c98b4a'); p.hline(x - 2, x + 1, y - 2, '#e0aa66'); p.set(x + 1, y + 1, '#a86a34'); } },
  corn: { name: 'Corn', cat: 'veg', c: '#f6d040', draw(p, x, y) { dot(p, x, y, [[0, 0], [1, 0], [0, 1], [-1, 1]], '#f6d040'); } },
};
// sauces are drawn with a finger, shakers are swiped over the plate
export const SAUCES = {
  chocsauce: { name: 'Chocolate sauce', c: '#4a2416' }, caramel: { name: 'Caramel sauce', c: '#c9822f' },
  berrysauce: { name: 'Berry sauce', c: '#b5304a' }, syrup: { name: 'Maple syrup', c: '#b8702a' },
  honey: { name: 'Honey', c: '#e8a83a' }, dressing: { name: 'Dressing', c: '#f4ecd6' }, balsamic: { name: 'Balsamic', c: '#3a2420' },
};
export const SHAKERS = {
  sugar: { name: 'Powdered sugar', c: '#ffffff' }, cocoa: { name: 'Cocoa', c: '#6b3a22' },
  pepper: { name: 'Black pepper', c: '#2e2b26' }, chili: { name: 'Chili flakes', c: '#d2402a' }, sesame: { name: 'Sesame', c: '#efe0b8' },
};

// what's on the plate first
export const BASES = {
  plate: { name: 'Empty plate' },
  vanilla: { name: 'Vanilla cake slice' },
  chocolate: { name: 'Chocolate cake slice' },
  cheesecake: { name: 'Cheesecake slice' },
  bowl: { name: 'Salad bowl' },
  toast: { name: 'Toast' },
  pancakes: { name: 'Pancakes' },
  croissant: { name: 'Croissant' },
};
export const BASE_ORDER = Object.keys(BASES);

export const FOODS = {
  croissant: { name: 'Croissant', price: 10, unlock: 0, base: 'croissant', need: {}, nice: ['butter', 'berrysauce', 'sugar'], options: ['butter', 'berrysauce', 'honey', 'sugar', 'strawberry'] },
  shortcake: { name: 'Strawberry shortcake', price: 16, unlock: 0, base: 'vanilla', need: { cream: 2, strawberry: 2 }, options: ['strawberry', 'blueberry', 'mint', 'sugar', 'raspberry', 'cream'] },
  salad: { name: 'Garden salad', price: 15, unlock: 0, base: 'bowl', need: { tomato: 2, cucumber: 2, carrot: 1, dressing: 1 }, options: ['cucumber', 'tomato', 'olive', 'onion', 'corn', 'cheese', 'carrot', 'crouton', 'balsamic', 'pepper'] },
  cookies: { name: 'Cookie plate', price: 9, unlock: 40, base: 'plate', need: { cookie: 3 }, options: ['cookie', 'chocpiece', 'macaron'] },
  pancakes: { name: 'Pancakes', price: 16, unlock: 100, base: 'pancakes', need: { butter: 1, syrup: 1, blueberry: 3 }, options: ['blueberry', 'strawberry', 'banana', 'butter', 'honey', 'sugar'] },
  chococake: { name: 'Chocolate cake', price: 18, unlock: 90, base: 'chocolate', need: { chocsauce: 1, raspberry: 2 }, options: ['raspberry', 'strawberry', 'cream', 'shaving', 'mint', 'sugar'] },
  cheesecake: { name: 'Berry cheesecake', price: 18, unlock: 110, base: 'cheesecake', need: { berrysauce: 1, blueberry: 3 }, options: ['blueberry', 'raspberry', 'strawberry', 'mint', 'cream'] },
  avotoast: { name: 'Avocado toast', price: 18, unlock: 120, base: 'toast', need: { avocado: 3, egg: 1, chili: 1 }, options: ['egg', 'tomato', 'sesame', 'pepper', 'onion', 'cheese'] },
  caesar: { name: 'Caesar salad', price: 20, unlock: 130, base: 'bowl', need: { crouton: 3, cheese: 2, egg: 1, dressing: 1 }, options: ['crouton', 'cheese', 'egg', 'olive', 'pepper', 'tomato'] },
  fruitbowl: { name: 'Fruit bowl', price: 17, unlock: 100, base: 'bowl', need: { kiwi: 2, orange: 2, blueberry: 3, mint: 1 }, options: ['kiwi', 'orange', 'blueberry', 'strawberry', 'banana', 'raspberry', 'mint', 'honey'] },
};
export const FOOD_ORDER = ['croissant', 'shortcake', 'salad', 'cookies', 'pancakes', 'chococake', 'cheesecake', 'fruitbowl', 'avotoast', 'caesar'];
export const START_FOODS = ['croissant', 'shortcake', 'salad'];
// what a customer asks for on top of the recipe: "olive:2|cucumber:1"
export function foodWants(id, rnd = Math.random) {
  const o = FOODS[id].options || [], picks = [];
  const n = rnd() < 0.35 ? 0 : rnd() < 0.6 ? 1 : 2;
  for (let i = 0; i < n && o.length; i++) {
    const k = o[Math.floor(rnd() * o.length)];
    if (picks.some(([x]) => x === k)) continue;
    picks.push([k, INGREDIENTS[k] ? 1 + Math.floor(rnd() * 3) : 1]);
  }
  return picks.map(([k, c]) => `${k}:${c}`).join('|');
}
export const parseWants = (extra) => (extra ? extra.split('|').map((w) => { const [k, c] = w.split(':'); return [k, +c || 1]; }).filter(([k]) => INGREDIENTS[k] || SAUCES[k] || SHAKERS[k]) : []);
export function foodNeed(id, extra = '') {
  const need = { ...FOODS[id].need };
  for (const [k, c] of parseWants(extra)) need[k] = (need[k] || 0) + (INGREDIENTS[k] ? c : 0) || 1;
  return need;
}
export const foodPrice = (id, extra = '') => FOODS[id].price + 2 * parseWants(extra).length;
export const wantsText = (extra, tr = (x) => x) => parseWants(extra).map(([k, c]) => (INGREDIENTS[k] && c > 1 ? `${c} ` : '') + tr(ingName(k))).join(', ');
export const kindOf = (k) => (INGREDIENTS[k] ? 'item' : SAUCES[k] ? 'sauce' : SHAKERS[k] ? 'shake' : null);
export const ingName = (k) => (INGREDIENTS[k] || SAUCES[k] || SHAKERS[k] || BASES[k] || {}).name || k;

// ---------- a plate being made ----------
// items: [{k, x, y, r}] in plate units (-1..1), strokes: [{k, pts}], dust: [[x, y, c]]
export const newPlate = (base = null) => ({ base, items: [], strokes: [], dust: [], dropped: 0 });
export function countOf(pl, k) {
  if (INGREDIENTS[k]) return pl.items.filter((i) => i.k === k).length;
  if (SAUCES[k]) return pl.strokes.filter((s) => s.k === k && s.pts.length > 2).length;
  if (SHAKERS[k]) return pl.dust.filter((d) => d[3] === k).length >= 6 ? 1 : 0;
  return 0;
}
// how well a plate matches its recipe, 0..1, with notes for the player
export function scorePlate(id, pl, extra = '') {
  const f = { ...FOODS[id], need: foodNeed(id, extra) }, notes = [];
  if (pl.base !== f.base) return { q: 0.1, notes: ['That is not the right base'] };
  const need = Object.entries(f.need);
  let sum = 0;
  for (const [k, n] of need) { const have = Math.min(n, countOf(pl, k)); sum += have / n; if (have < n) notes.push(`Needs more: ${ingName(k)}`); }
  let q = need.length ? sum / need.length : 1;
  // a little extra love for decoration
  const extras = new Set([...pl.items.map((i) => i.k), ...pl.strokes.map((s) => s.k), ...pl.dust.map((d) => d[3])].filter((k) => !f.need[k]));
  if (q >= 0.99 && extras.size) notes.push('Lovely decoration');
  q = Math.min(1, q * 0.9 + Math.min(0.1, extras.size * 0.04) + (need.length ? 0 : 0.1));
  if (pl.dropped) { q = Math.max(0.2, q - pl.dropped * 0.05); notes.push('Some bits fell off the plate'); }
  return { q, notes };
}
// the dish as it ideally looks, for the café sprites
export function idealPlate(id, extra = '') {
  const f = { ...FOODS[id], need: foodNeed(id, extra) }, pl = newPlate(f.base);
  let i = 0;
  for (const [k, n] of Object.entries(f.need)) {
    for (let j = 0; j < n; j++, i++) {
      const a = i * 2.4 + 0.5, r = 0.18 + (i % 3) * 0.14;
      if (INGREDIENTS[k]) pl.items.push({ k, x: Math.cos(a) * r, y: Math.sin(a) * r * 0.8, r: i });
      if (SAUCES[k]) pl.strokes.push({ k, pts: [[-0.4, -0.15], [-0.1, 0.1], [0.2, -0.1], [0.45, 0.12]] });
      if (SHAKERS[k]) for (let d = 0; d < 12; d++) pl.dust.push([Math.cos(d * 1.7) * 0.4 * hash(d, 1, 2), Math.sin(d * 1.7) * 0.4, SHAKERS[k].c, k]);
    }
  }
  return pl;
}

// ---------- drawing ----------
// the base, centred at (cx, cy) on a plate of radius R
function drawBase(p, base, cx, cy, R) {
  const s = R / 40;
  if (R < 20) {
    // simple shapes for the little plates in the café
    const col = { vanilla: '#fbf3e4', chocolate: '#5a3020', cheesecake: '#f3e2b0', bowl: '#5c8f3f', toast: '#d4a050', pancakes: '#d29b5a', croissant: '#e8a850' }[base];
    if (!col) return;
    if (base === 'bowl') { p.ellipse(cx, cy, Math.round(R * 0.85), Math.round(R * 0.7), '#e6eef0'); p.ellipse(cx, cy, Math.round(R * 0.65), Math.round(R * 0.5), col); p.set(cx - 1, cy - 1, '#8fc25a'); return; }
    if (base === 'croissant') { p.rect(cx - 3, cy - 1, 7, 2, col); p.set(cx - 4, cy + 1, col); p.set(cx + 4, cy + 1, col); p.set(cx, cy - 1, '#f6c878'); return; }
    if (base === 'vanilla' || base === 'chocolate' || base === 'cheesecake') { p.poly([[cx - 4, cy + 2], [cx + 4, cy + 2], [cx + 3, cy - 3], [cx - 2, cy - 3]], col); p.hline(cx - 4, cx + 3, cy + 2, base === 'chocolate' ? '#3a1a10' : '#e8c27a'); return; }
    p.ellipse(cx, cy, Math.round(R * 0.6), Math.round(R * 0.45), col);
    return;
  }
  const poly = (pts, c) => p.poly(pts.map(([x, y]) => [cx + x * s, cy + y * s]), c);
  if (base === 'vanilla' || base === 'chocolate' || base === 'cheesecake') {
    const top = base === 'vanilla' ? '#fbf3e4' : base === 'chocolate' ? '#5a3020' : '#f3e2b0';
    const side = base === 'vanilla' ? '#e8c27a' : base === 'chocolate' ? '#3a1a10' : '#e8d090';
    const crust = base === 'cheesecake' ? '#b8803a' : base === 'chocolate' ? '#f4ecd6' : '#fbf3e4';
    poly([[-22, 18], [26, 18], [26, 24], [-22, 24]], side);
    if (base !== 'cheesecake') poly([[-22, 20], [26, 20], [26, 21], [-22, 21]], crust);
    else poly([[-22, 22], [26, 22], [26, 24], [-22, 24]], crust);
    poly([[-22, 18], [26, 18], [24, -14], [-16, -22]], INK);
    poly([[-21, 17], [25, 17], [23, -13], [-16, -21]], top);
    poly([[-16, -21], [23, -13], [24, -10], [-17, -18]], shade(top, 0.9));
  } else if (base === 'bowl') {
    p.ellipse(cx, cy, Math.round(34 * s), Math.round(30 * s), INK);
    p.ellipse(cx, cy, Math.round(33 * s), Math.round(29 * s), '#e6eef0');
    p.ellipse(cx, cy, Math.round(28 * s), Math.round(24 * s), '#cfd8da');
    for (let i = 0; i < 18; i++) { const a = i * 2.39, r = Math.sqrt(hash(i, 2, 5)) * 20 * s; INGREDIENTS.lettuce.draw(p, Math.round(cx + Math.cos(a) * r), Math.round(cy + Math.sin(a) * r * 0.85), i); }
  } else if (base === 'toast') {
    poly([[-25, -20], [25, -20], [27, 18], [-27, 18]], INK);
    poly([[-24, -19], [24, -19], [26, 17], [-26, 17]], '#a86a34');
    poly([[-21, -16], [21, -16], [23, 14], [-23, 14]], '#e8c27a');
    for (let i = 0; i < 20; i++) p.set(cx + (hash(i, 1, 3) - 0.5) * 40 * s, cy + (hash(i, 4, 3) - 0.5) * 26 * s, '#d4a860');
  } else if (base === 'pancakes') {
    for (let k = 3; k >= 0; k--) { p.ellipse(cx, cy + k * 2, Math.round(28 * s), Math.round(24 * s), INK); p.ellipse(cx, cy + k * 2, Math.round(27 * s), Math.round(23 * s), k ? '#c98b4a' : '#e0a860'); }
    p.ellipse(cx, cy, Math.round(20 * s), Math.round(16 * s), '#e8b870');
  } else if (base === 'croissant') {
    for (let i = -3; i <= 3; i++) {
      const x = cx + i * 7 * s, y = cy + Math.abs(i) * 3 * s - 4 * s, r = (8 - Math.abs(i) * 1.4) * s;
      p.ellipse(Math.round(x), Math.round(y), Math.round(r) + 1, Math.round(r * 0.8) + 1, INK);
    }
    for (let i = -3; i <= 3; i++) {
      const x = cx + i * 7 * s, y = cy + Math.abs(i) * 3 * s - 4 * s, r = (8 - Math.abs(i) * 1.4) * s;
      p.ellipse(Math.round(x), Math.round(y), Math.round(r), Math.round(r * 0.8), i % 2 ? '#d48a3a' : '#e8a850');
      p.set(Math.round(x - r * 0.3), Math.round(y - r * 0.4), '#f6c878');
    }
  }
}

// a whole plate: dish at (cx, cy) with plate radius R ('big' at the kitchen, small in the café)
export function drawPlate(p, cx, cy, pl, R = 40) {
  if (R >= 50) return drawPlateBig(p, cx, cy, pl, R);
  const s = R / 40;
  p.ellipse(cx, cy + Math.round(2 * s), Math.round(R) + 1, Math.round(R * 0.82) + 1, '#00000033');
  p.ellipse(cx, cy, Math.round(R) + 1, Math.round(R * 0.82) + 1, INK);
  p.ellipse(cx, cy, Math.round(R), Math.round(R * 0.82), '#ece4d6');
  p.ellipse(cx, cy, Math.round(R * 0.8), Math.round(R * 0.66), '#fbf6ee');
  if (R > 20) p.ellipse(cx - Math.round(R * 0.35), cy - Math.round(R * 0.3), Math.round(R * 0.12), Math.round(R * 0.06), '#ffffff');
  if (pl.base) drawBase(p, pl.base, cx, cy, R);
  const P = (x, y) => [Math.round(cx + x * R * 0.8), Math.round(cy + y * R * 0.66)];
  const big = R > 20;
  for (const st of pl.strokes) {
    const c = SAUCES[st.k].c;
    for (let i = 1; i < st.pts.length; i++) {
      const [ax, ay] = P(...st.pts[i - 1]), [bx, by] = P(...st.pts[i]);
      p.line(ax, ay, bx, by, c);
      if (big) { p.line(ax, ay + 1, bx, by + 1, shade(c, 0.85)); p.line(ax + 1, ay, bx + 1, by, c); }
    }
  }
  for (const it of pl.items) {
    const [x, y] = P(it.x, it.y);
    if (big) INGREDIENTS[it.k].draw(p, x, y, it.r || 0);
    else p.set(x, y, INGREDIENTS[it.k].c);
  }
  for (const [x, y, c] of pl.dust) { const [px, py] = P(x, y); p.set(px, py, c); }
}

// the kitchen close-up: detailed plate, base and ingredients
function drawPlateBig(p, cx, cy, pl, R) {
  drawPlateHD(p, cx, cy, R);
  if (pl.base) drawBaseHD(p, pl.base, cx, cy, R);
  const P = (x, y) => [Math.round(cx + x * R * 0.8), Math.round(cy + y * R * 0.66)];
  for (const st of pl.strokes) {
    const c = SAUCES[st.k].c;
    for (let i = 1; i < st.pts.length; i++) {
      const [ax, ay] = P(...st.pts[i - 1]), [bx, by] = P(...st.pts[i]);
      for (const [dx, dy, k] of [[0, 1, 0.75], [1, 1, 0.75], [0, 0, 1], [1, 0, 1], [0, -1, 1.12]]) p.line(ax + dx, ay + dy, bx + dx, by + dy, shade(c, k));
    }
  }
  for (const it of pl.items) { const [x, y] = P(it.x, it.y); HD[it.k](p, x, y, it.r || 0); }
  for (const [x, y, c] of pl.dust) { const [px, py] = P(x, y); p.set(px, py, c); p.set(px + 1, py, c); }
}

const cache = new Map();
export function platePix(id) {
  const p = new Pix(15, 12);
  drawPlate(p, 7, 6, idealPlate(id), 7);
  return p;
}
export function plateCanvas(id, scale = 1) {
  const key = id + '|' + scale;
  if (!cache.has(key)) cache.set(key, platePix(id).toCanvas(scale));
  return cache.get(key);
}
