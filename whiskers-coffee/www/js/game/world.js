// The shared café: layout, cats and money, plus the walkable grid and pathfinding.
// This is plain data so it can be saved, sent over the network and checked anywhere.
import { CATALOG } from './catalog.js';
import { DEFAULT_WALLS, WALL_STYLES, FLOOR_STYLES } from '../art/room.js';
import { DRINKS } from '../art/drinks.js';
import { FOODS, START_FOODS } from '../art/foods.js';
import { COATS, COLLARS } from '../art/cats.js';

export const ROOM_W = 11, ROOM_H = 9;
// tiles kept clear so the front door always works
export const DOOR_TILES = [[0, 5], [0, 6], [1, 5], [1, 6]];

let idSeq = 0;
export const uid = (p = 'i') => p + Date.now().toString(36) + (idSeq++).toString(36) + Math.floor(Math.random() * 1296).toString(36);

export function newCafe(name = 'Our Café') {
  const f = (type, x, y, rot = 0) => ({ id: uid('f'), type, x, y, rot });
  return {
    v: 1,
    id: uid('cafe'),
    name,
    money: 400,
    created: Date.now(),
    modified: Date.now(),
    walls: DEFAULT_WALLS,
    furniture: [
      f('espresso', 4, 2), f('counter', 6, 2), f('pastry', 7, 2),
      f('rug', 6, 5),
      f('table_round', 6, 6), f('chair', 5, 6, 3), f('chair', 7, 6, 1),
      f('table_cake', 3, 6), f('chair', 3, 5, 0), f('chair', 3, 7, 2),
      f('armchair', 9, 4, 1), f('plant_big', 10, 2), f('plant_small', 0, 1),
      f('bookshelf', 10, 0), f('cat_tree', 9, 7), f('cat_bed', 1, 8), f('floor_lamp', 10, 4),
      f('sofa_grey', 6, 8, 0), f('menu_board', 2, 2), f('potted_fern', 10, 8), f('cattree_small', 1, 1),
    ],
    cats: [
      { id: uid('c'), name: 'Mochi', coat: 'cream', mood: 'sleepy', affection: 0 },
      { id: uid('c'), name: 'Biscuit', coat: 'orange', mood: 'playful', affection: 0 },
    ],
    inventory: {},
    recipes: ['espresso', 'latte', 'hotchoc'],
    stats: { served: 0 },
    decor: { wall: 'cream', floor: 'oak', owned: ['cream', 'oak'] },
    adoptSeed: Math.floor(Math.random() * 1e9),
    foods: [...START_FOODS],
    tips: [],
    day: newDay(1),
  };
}

// a fresh day: the clock at opening time and nothing earned yet
export function newDay(n) {
  return { n, min: 0, phase: 'open', rain: n === 1 || Math.random() < 0.4, today: { served: 0, earned: 0, tips: 0, perfect: 0 } };
}

// older saves come from before some features; fill in what they lack
export function upgradeCafe(cafe) {
  cafe.recipes = cafe.recipes || ['espresso', 'latte', 'hotchoc'];
  cafe.stats = cafe.stats || { served: 0 };
  cafe.decor = cafe.decor || { wall: 'cream', floor: 'oak', owned: ['cream', 'oak'] };
  if (!cafe.decor.owned) cafe.decor.owned = ['cream', 'oak'];
  if (cafe.adoptSeed == null) cafe.adoptSeed = Math.floor(Math.random() * 1e9);
  cafe.inventory = cafe.inventory || {};
  cafe.foods = cafe.foods || [...START_FOODS];
  cafe.tips = cafe.tips || [];
  cafe.day = cafe.day || newDay(1);
  cafe.recipes = cafe.recipes.filter((id) => DRINKS[id]);
  cafe.foods = cafe.foods.filter((id) => FOODS[id]);
  return cafe;
}

// a small seeded random generator, so every phone derives the same results from a seed
export function seededRng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---------- cat adoption ----------
export const MAX_CATS = 6;
export const CAT_MOODS = ['sleepy', 'playful', 'shy', 'calm'];
const CAT_NAMES = ['Pudding', 'Miso', 'Tofu', 'Pepper', 'Maple', 'Sesame', 'Noodle', 'Clover', 'Waffle', 'Juniper', 'Pickles', 'Hazel', 'Toast', 'Plum', 'Ginger', 'Olive', 'Bean', 'Sprout', 'Cocoa', 'Nutmeg'];
export const adoptPrice = (cafe) => 150 + 60 * Math.max(0, cafe.cats.length - 2);
export const cleanName = (s, max = 12) => String(s || '').replace(/[<>]/g, '').trim().slice(0, max);

// the cats waiting at the shelter right now; the same on every phone for the same café
export function strays(cafe) {
  const rng = seededRng(cafe.adoptSeed || 1);
  // three different coats, preferring ones the café doesn't have yet
  const have = new Set(cafe.cats.map((c) => c.coat));
  const coats = Object.keys(COATS).map((k) => [k, rng() + (have.has(k) ? 1 : 0)]).sort((a, b) => a[1] - b[1]).map(([k]) => k);
  const taken = new Set(cafe.cats.map((c) => c.name));
  const out = [];
  for (let i = 0; i < 3; i++) {
    let name = CAT_NAMES[Math.floor(rng() * CAT_NAMES.length)];
    for (let k = 0; taken.has(name) && k < 30; k++) name = CAT_NAMES[Math.floor(rng() * CAT_NAMES.length)];
    taken.add(name);
    out.push({ name, coat: coats[i], mood: CAT_MOODS[Math.floor(rng() * CAT_MOODS.length)] });
  }
  return out;
}

export const footprint = (it) => {
  const def = CATALOG[it.type];
  const [w, d] = def.size;
  return it.rot % 2 ? [d, w] : [w, d];
};

export function tilesOf(it) {
  const [w, d] = footprint(it);
  const out = [];
  for (let j = 0; j < d; j++) for (let i = 0; i < w; i++) out.push([it.x + i, it.y + j]);
  return out;
}

// can this item go here? (ignore: the item being moved)
export function canPlace(cafe, it, ignoreId = null) {
  const def = CATALOG[it.type];
  for (const [x, y] of tilesOf(it)) {
    if (x < 0 || y < 0 || x >= ROOM_W || y >= ROOM_H) return false;
    if (!def.flat && DOOR_TILES.some(([dx, dy]) => dx === x && dy === y)) return false;
  }
  for (const other of cafe.furniture) {
    if (other.id === ignoreId) continue;
    const odef = CATALOG[other.type];
    // flat things (rugs) only clash with other flat things
    if (!!odef.flat !== !!def.flat) continue;
    const mine = tilesOf(it), theirs = tilesOf(other);
    if (mine.some(([a, b]) => theirs.some(([c, d]) => a === c && b === d))) return false;
  }
  return true;
}

export function blockedGrid(cafe) {
  const g = new Uint8Array(ROOM_W * ROOM_H);
  for (const it of cafe.furniture) {
    if (CATALOG[it.type].flat) continue;
    for (const [x, y] of tilesOf(it)) if (x >= 0 && y >= 0 && x < ROOM_W && y < ROOM_H) g[y * ROOM_W + x] = 1;
  }
  return g;
}

export const walkable = (grid, x, y) => x >= 0 && y >= 0 && x < ROOM_W && y < ROOM_H && !grid[y * ROOM_W + x];

// A* over tiles with diagonal moves that never cut a corner; returns tile centres
export function findPath(grid, sx, sy, tx, ty) {
  sx = Math.floor(sx); sy = Math.floor(sy); tx = Math.floor(tx); ty = Math.floor(ty);
  if (!walkable(grid, tx, ty)) return null;
  if (sx === tx && sy === ty) return [[tx + 0.5, ty + 0.5]];
  const key = (x, y) => y * ROOM_W + x;
  const open = [[sx, sy]], came = new Map(), gs = new Map([[key(sx, sy), 0]]);
  const h = (x, y) => Math.hypot(tx - x, ty - y);
  const fs = new Map([[key(sx, sy), h(sx, sy)]]);
  while (open.length) {
    let bi = 0;
    for (let i = 1; i < open.length; i++) if (fs.get(key(...open[i])) < fs.get(key(...open[bi]))) bi = i;
    const [cx, cy] = open.splice(bi, 1)[0];
    if (cx === tx && cy === ty) {
      const path = [[tx + 0.5, ty + 0.5]];
      let k = key(cx, cy);
      while (came.has(k)) { k = came.get(k); const x = k % ROOM_W, y = Math.floor(k / ROOM_W); if (x !== sx || y !== sy) path.unshift([x + 0.5, y + 0.5]); }
      return path;
    }
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]]) {
      const nx = cx + dx, ny = cy + dy;
      if (!walkable(grid, nx, ny)) continue;
      if (dx && dy && (!walkable(grid, cx + dx, cy) || !walkable(grid, cx, cy + dy))) continue;
      const g = gs.get(key(cx, cy)) + (dx && dy ? 1.414 : 1);
      if (g < (gs.get(key(nx, ny)) ?? Infinity)) {
        came.set(key(nx, ny), key(cx, cy));
        gs.set(key(nx, ny), g);
        fs.set(key(nx, ny), g + h(nx, ny));
        if (!open.some(([a, b]) => a === nx && b === ny)) open.push([nx, ny]);
      }
    }
  }
  return null;
}

// the walkable tile nearest to a point (for walking up to a cat or a table)
export function nearestFree(grid, x, y, fromX, fromY) {
  let best = null, bd = Infinity;
  for (let j = -2; j <= 2; j++) for (let i = -2; i <= 2; i++) {
    const tx = Math.floor(x) + i, ty = Math.floor(y) + j;
    if (!walkable(grid, tx, ty)) continue;
    const d = Math.hypot(tx + 0.5 - x, ty + 0.5 - y) * 2 + Math.hypot(tx + 0.5 - fromX, ty + 0.5 - fromY) * 0.1;
    if (d < bd) { bd = d; best = [tx, ty]; }
  }
  return best;
}

export function furnitureAt(cafe, x, y, flatToo = true) {
  // topmost: prefer solid furniture over rugs
  let hit = null;
  for (const it of cafe.furniture) {
    if (tilesOf(it).some(([a, b]) => a === x && b === y)) {
      if (!hit || (CATALOG[hit.type].flat && !CATALOG[it.type].flat)) hit = it;
    }
  }
  if (hit && !flatToo && CATALOG[hit.type].flat) return null;
  return hit;
}

// apply a building operation; returns an error string or null. Used by the host for
// its own edits and for edits a guest asks for, so both follow the same rules.
export function applyBuild(cafe, op) {
  if (op.op === 'buy') {
    const def = CATALOG[op.type];
    if (!def) return 'Unknown item';
    if (cafe.money < def.price) return 'Not enough coins';
    const it = { id: op.id || uid('f'), type: op.type, x: op.x, y: op.y, rot: op.rot || 0 };
    if (!canPlace(cafe, it)) return "It doesn't fit there";
    cafe.money -= def.price;
    cafe.furniture.push(it);
  } else if (op.op === 'move') {
    const it = cafe.furniture.find((f) => f.id === op.id);
    if (!it) return 'That item is gone';
    const moved = { ...it, x: op.x, y: op.y, rot: op.rot ?? it.rot };
    if (!CATALOG[it.type].rotates) moved.rot = 0;
    if (!canPlace(cafe, moved, it.id)) return "It doesn't fit there";
    Object.assign(it, moved);
  } else if (op.op === 'store') {
    const i = cafe.furniture.findIndex((f) => f.id === op.id);
    if (i < 0) return 'That item is gone';
    if (CATALOG[cafe.furniture[i].type].station) return 'The espresso bar has to stay';
    const [it] = cafe.furniture.splice(i, 1);
    cafe.inventory[it.type] = (cafe.inventory[it.type] || 0) + 1;
  } else if (op.op === 'place') {
    if (!cafe.inventory[op.type]) return 'None in storage';
    const it = { id: op.id || uid('f'), type: op.type, x: op.x, y: op.y, rot: op.rot || 0 };
    if (!canPlace(cafe, it)) return "It doesn't fit there";
    cafe.inventory[op.type]--;
    if (!cafe.inventory[op.type]) delete cafe.inventory[op.type];
    cafe.furniture.push(it);
  } else if (op.op === 'recipe') {
    // add a drink or a dish to the menu
    upgradeCafe(cafe);
    const food = op.kind === 'food', d = food ? FOODS[op.id] : DRINKS[op.id], list = food ? cafe.foods : cafe.recipes;
    if (!d) return 'Unknown recipe';
    if (list.includes(op.id)) return 'Already on the menu';
    if (cafe.money < d.unlock) return 'Not enough coins';
    cafe.money -= d.unlock;
    list.push(op.id);
  } else if (op.op === 'style') {
    // wallpaper or floor: buying it once keeps it, so switching back later is free
    const list = op.kind === 'wall' ? WALL_STYLES : op.kind === 'floor' ? FLOOR_STYLES : null;
    const st = list && list[op.id];
    if (!st) return 'Unknown style';
    upgradeCafe(cafe);
    if (cafe.decor[op.kind] === op.id) return null;
    if (!cafe.decor.owned.includes(op.id)) {
      if (cafe.money < st.price) return 'Not enough coins';
      cafe.money -= st.price;
      cafe.decor.owned.push(op.id);
    }
    cafe.decor[op.kind] = op.id;
  } else if (op.op === 'adopt') {
    upgradeCafe(cafe);
    if (cafe.cats.length >= MAX_CATS) return 'The café has all the cats it can love';
    const s = strays(cafe)[op.pick | 0];
    if (!s) return 'That cat already found a home';
    const price = adoptPrice(cafe);
    if (cafe.money < price) return 'Not enough coins';
    cafe.money -= price;
    cafe.cats.push({ id: op.id || uid('c'), name: cleanName(op.name) || s.name, coat: s.coat, mood: s.mood, affection: 0, collar: 'none' });
    cafe.adoptSeed = (cafe.adoptSeed * 7 + 13) % 1e9;
  } else if (op.op === 'catname') {
    const c = cafe.cats.find((k) => k.id === op.id);
    const name = cleanName(op.name);
    if (!c) return 'That cat is gone';
    if (!name) return 'Cats need a name';
    c.name = name;
  } else if (op.op === 'collar') {
    const c = cafe.cats.find((k) => k.id === op.id);
    const col = COLLARS[op.collar];
    if (!c || !col) return 'Unknown collar';
    if ((c.collar || 'none') === op.collar) return null;
    if (cafe.money < col.price) return 'Not enough coins';
    cafe.money -= col.price;
    c.collar = op.collar;
  } else return 'Unknown action';
  cafe.modified = Date.now();
  return null;
}
