// The living café: player movement and cat behaviour. One copy runs on the hosting phone
// (or alone when playing solo); guests send requests and draw the snapshots it shares.
import { CATALOG } from './catalog.js';
import { CustomerSystem } from './customers.js';
import { blockedGrid, findPath, nearestFree, walkable, ROOM_W, ROOM_H, tilesOf, applyBuild, upgradeCafe } from './world.js';

const PLAYER_SPEED = 2.8, CAT_SPEED = 1.5;
export const SPAWN = [1.5, 5.5];

export class Sim {
  constructor(cafe, emit = () => {}) {
    this.cafe = upgradeCafe(cafe);
    this.emit = emit; // (event, data) for effects and changes
    this.players = new Map();
    this.cats = new Map();
    this.t = 0;
    this.rebuildGrids();
    for (const c of cafe.cats) this.spawnCat(c);
    this.shop = new CustomerSystem(this);
  }

  rebuildGrids() {
    this.grid = blockedGrid(this.cafe);
    // cats may also walk onto their own furniture
    this.catGrid = new Uint8Array(this.grid);
    for (const it of this.cafe.furniture) if (CATALOG[it.type].cat) for (const [x, y] of tilesOf(it)) this.catGrid[y * ROOM_W + x] = 0;
  }

  // ---------- players ----------
  addPlayer(id, name, look) {
    const p = this.players.get(id) || { id, x: SPAWN[0], y: SPAWN[1], path: [], view: 'front', flip: false, moving: false, then: null };
    p.name = name; p.look = look;
    this.players.set(id, p);
    this.emit('roster');
    return p;
  }
  removePlayer(id) { this.players.delete(id); this.shop?.playerLeft(id); this.emit('roster'); }

  movePlayer(id, tx, ty, then = null) {
    const p = this.players.get(id);
    if (!p) return false;
    const path = findPath(this.grid, p.x, p.y, tx, ty);
    if (!path) return false;
    p.path = path; p.then = then;
    return true;
  }

  // walk up to a cat and pet it
  petCat(playerId, catId) {
    const p = this.players.get(playerId), c = this.cats.get(catId);
    if (!p || !c) return;
    if (Math.hypot(p.x - c.x, p.y - c.y) < 1.4) return this.doPet(p, c);
    const spot = nearestFree(this.grid, c.x, c.y, p.x, p.y);
    if (!spot) return;
    c.waitFor = playerId; c.waitT = 6;
    if (c.state === 'walk') this.setCat(c, 'sit', 6);
    this.movePlayer(playerId, spot[0], spot[1], { pet: catId });
  }

  doPet(p, c) {
    const data = this.cafe.cats.find((k) => k.id === c.id);
    if (data) data.affection = Math.min(100, (data.affection || 0) + 4);
    c.waitFor = null;
    this.setCat(c, c.z > 0 ? c.state : 'happy', 2.6);
    // face each other
    c.flip = p.x - p.y < c.x - c.y;
    this.emit('fx', { kind: 'hearts', x: c.x, y: c.y, z: c.z + 14, by: p.id, cat: c.id, name: data?.name });
    this.emit('save');
  }

  // ---------- building ----------
  build(op, by) {
    const err = applyBuild(this.cafe, op);
    if (err) return err;
    this.rebuildGrids();
    // anyone standing inside new furniture steps to the nearest free tile
    for (const a of [...this.players.values(), ...this.cats.values()]) {
      const g = this.cats.has(a.id) ? this.catGrid : this.grid;
      if (!walkable(g, Math.floor(a.x), Math.floor(a.y))) {
        const spot = nearestFree(g, a.x, a.y, a.x, a.y);
        if (spot) { a.x = spot[0] + 0.5; a.y = spot[1] + 0.5; }
      }
      a.path = [];
    }
    this.shop.relayout();
    this.syncCats();
    this.emit('cafe', { by });
    this.emit('save');
    return null;
  }

  // ---------- cats ----------
  // a newly adopted cat walks in through the front door
  syncCats() {
    const ids = new Set(this.cafe.cats.map((c) => c.id));
    for (const id of this.cats.keys()) if (!ids.has(id)) this.cats.delete(id);
    for (const data of this.cafe.cats) {
      if (this.cats.has(data.id)) continue;
      this.cats.set(data.id, { id: data.id, x: 0.5, y: 5.5, z: 0, state: 'sit', t: 0, path: [], flip: false, mood: data.mood });
      const c = this.cats.get(data.id);
      const spot = nearestFree(this.catGrid, 3, 5.5, 0.5, 5.5);
      if (spot) this.catGoTo(c, spot[0] + 0.5, spot[1] + 0.5, 'happy', 3);
      this.emit('fx', { kind: 'adopted', x: 2, y: 5.5, z: 14, name: data.name });
      this.emit('fx', { kind: 'bell' });
    }
  }

  spawnCat(data) {
    const free = [];
    for (let y = 2; y < ROOM_H; y++) for (let x = 2; x < ROOM_W; x++) if (walkable(this.catGrid, x, y)) free.push([x, y]);
    const [x, y] = free[Math.floor(Math.random() * free.length)] || [5, 5];
    this.cats.set(data.id, { id: data.id, x: x + 0.5, y: y + 0.5, z: 0, state: 'sit', t: 2 + Math.random() * 3, path: [], flip: Math.random() < 0.5, mood: data.mood });
  }

  setCat(c, state, t) { c.state = state; c.t = t; }

  catThink(c) {
    const mood = c.mood || 'calm';
    const weights = {
      sleepy: { sleep: 4, sit: 3, wander: 2, perch: 1, groom: 1, visit: 1 },
      playful: { wander: 5, perch: 2, sit: 2, groom: 1, visit: 2, sleep: 1 },
      shy: { sit: 4, groom: 2, wander: 2, sleep: 2, perch: 2 },
      calm: { sit: 3, wander: 3, sleep: 2, groom: 2, perch: 1, visit: 1 },
    }[mood] || {};
    // leaving a perch or bed comes first
    if (c.z > 0) { c.z = 0; this.setCat(c, 'sit', 1); return; }
    const total = Object.values(weights).reduce((a, b) => a + b, 0);
    let r = Math.random() * total, pick = 'sit';
    for (const [k, w] of Object.entries(weights)) { if ((r -= w) < 0) { pick = k; break; } }

    if (pick === 'sit') return this.setCat(c, 'sit', 3 + Math.random() * 5);
    if (pick === 'groom') return this.setCat(c, 'groom', 3 + Math.random() * 3);
    if (pick === 'sleep') {
      const bed = this.findFurniture((d) => d.bed) ;
      if (bed && Math.random() < 0.7) return this.catGoTo(c, bed.x + 0.5, bed.y + 0.5, 'sleep', 10 + Math.random() * 15, 3);
      return this.setCat(c, 'sleep', 8 + Math.random() * 12);
    }
    if (pick === 'perch') {
      const tree = this.findFurniture((d) => d.perch);
      if (tree) return this.catGoTo(c, tree.x + 0.5, tree.y + 0.5, 'perch', 8 + Math.random() * 10, CATALOG[tree.type].perch);
    }
    if (pick === 'visit' && this.players.size) {
      const ps = [...this.players.values()];
      const p = ps[Math.floor(Math.random() * ps.length)];
      const spot = nearestFree(this.catGrid, p.x, p.y, c.x, c.y);
      if (spot) return this.catGoTo(c, spot[0] + 0.5, spot[1] + 0.5, 'sit', 5 + Math.random() * 4);
    }
    // wander somewhere nearby
    for (let tries = 0; tries < 12; tries++) {
      const tx = Math.floor(c.x + (Math.random() - 0.5) * 8), ty = Math.floor(c.y + (Math.random() - 0.5) * 8);
      if (walkable(this.catGrid, tx, ty)) return this.catGoTo(c, tx + 0.5, ty + 0.5, Math.random() < 0.5 ? 'sit' : 'groom', 2 + Math.random() * 4);
    }
    this.setCat(c, 'sit', 2);
  }

  findFurniture(test) {
    const list = this.cafe.furniture.filter((f) => test(CATALOG[f.type]));
    // skip furniture another cat is already using
    const used = new Set([...this.cats.values()].map((k) => k.goal && k.goal.join(',')));
    const free = list.filter((f) => !used.has(`${f.x + 0.5},${f.y + 0.5}`));
    return free[Math.floor(Math.random() * free.length)] || null;
  }

  catGoTo(c, x, y, then, t, z = 0) {
    const path = findPath(this.catGrid, c.x, c.y, x, y);
    if (!path) return this.setCat(c, 'sit', 2);
    c.path = path; c.after = { state: then, t, z }; c.goal = [x, y];
    this.setCat(c, 'walk', 30);
  }

  // ---------- update ----------
  step(dt) {
    this.t += dt;
    for (const p of this.players.values()) {
      p.moving = this.follow(p, dt, PLAYER_SPEED);
      if (!p.moving && p.then) {
        const then = p.then; p.then = null;
        const c = then.pet && this.cats.get(then.pet);
        if (c && Math.hypot(p.x - c.x, p.y - c.y) < 1.9) this.doPet(p, c);
        const u = then.serve && this.shop.list.get(then.serve);
        if (u && Math.hypot(p.x - u.x, p.y - u.y) < 1.9) this.shop.deliver(p, u);
      }
    }
    this.shop.step(dt);
    for (const c of this.cats.values()) {
      if (c.state === 'walk') {
        if (!this.follow(c, dt, CAT_SPEED)) {
          const a = c.after || { state: 'sit', t: 2, z: 0 };
          c.after = null;
          c.z = a.z || 0;
          this.setCat(c, a.state, a.t);
          if (c.z) this.emit('fx', { kind: 'hop', x: c.x, y: c.y, z: c.z });
        }
        continue;
      }
      if (c.waitFor) {
        c.waitT -= dt;
        if (c.waitT <= 0 || !this.players.has(c.waitFor)) c.waitFor = null;
        continue;
      }
      c.t -= dt;
      if (c.t <= 0) { c.goal = null; this.catThink(c); }
    }
  }

  // walk along a path; returns true while moving
  follow(a, dt, speed) {
    if (!a.path || !a.path.length) return false;
    let left = speed * dt;
    while (left > 0 && a.path.length) {
      const [tx, ty] = a.path[0];
      const dx = tx - a.x, dy = ty - a.y, d = Math.hypot(dx, dy);
      if (d > 0.001) {
        // screen direction: right when x grows faster than y, towards the camera when x + y grows
        const sx = dx - dy, sy = dx + dy;
        if (Math.abs(sx) > 0.01) a.flip = sx < 0;
        a.view = sy >= -0.01 ? 'front' : 'back';
      }
      if (d <= left) { a.x = tx; a.y = ty; a.path.shift(); left -= d; }
      else { a.x += (dx / d) * left; a.y += (dy / d) * left; left = 0; }
    }
    return true;
  }

  snapshot() {
    return {
      time: Math.round(this.t * 1000),
      p: [...this.players.values()].map((p) => [p.id, +p.x.toFixed(3), +p.y.toFixed(3), p.view === 'back' ? 1 : 0, p.flip ? 1 : 0, p.moving ? 1 : 0, p.carry ? (p.carry.kind === 'food' ? 'f:' : '') + p.carry.id : '', p.carry ? p.carry.extra : '']),
      u: this.shop.snapshot(),
      c: [...this.cats.values()].map((c) => [c.id, +c.x.toFixed(3), +c.y.toFixed(3), c.z, c.state, c.flip ? 1 : 0]),
      m: this.cafe.money,
      d: [this.cafe.day.n, Math.round(this.cafe.day.min), this.cafe.day.phase, this.cafe.day.rain ? 1 : 0],
      tp: this.cafe.tips.map((t) => [t.id, t.x, t.y, t.z, t.amount]),
    };
  }
  roster() { return [...this.players.values()].map((p) => ({ id: p.id, name: p.name, look: p.look })); }
}
