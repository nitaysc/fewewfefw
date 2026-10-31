// Customers and the coffee service, run by the host. Customers stroll in, take a seat,
// order a drink and wait as long as it takes; once served they sip, enjoy the cats and
// head home. Nothing here ever fails or hurries the players.
import { CATALOG } from './catalog.js';
import { DRINKS, orderName, orderPrice, tipFor, starsFor } from '../art/drinks.js';
import { findPath, nearestFree, walkable, footprint, ROOM_W, seededRng } from './world.js';
export { seededRng };

const SPEED = 2.0;
export const DOOR = [0.5, 5.5];
const NAMES = ['Hana', 'Ollie', 'June', 'Milo', 'Rosa', 'Theo', 'Ivy', 'Sam', 'Nora', 'Eli', 'Lea', 'Ben', 'Maya', 'Kai', 'Iris', 'Jonah'];
// which way a seat faces for each rotation (chairs face +y when not rotated)
const FACING = [[0, 1], [-1, 0], [0, -1], [1, 0]];

export const customerName = (seed) => NAMES[seed % NAMES.length];

let seq = 0;

export class CustomerSystem {
  constructor(sim) {
    this.sim = sim;
    this.list = new Map();
    this.nextIn = 6;
    const cafe = sim.cafe;
    if (!cafe.recipes) cafe.recipes = ['espresso', 'latte', 'hotchoc'];
    if (!cafe.stats) cafe.stats = { served: 0 };
  }

  // every seat in the café with where it is, how high and which way it faces
  seats() {
    const out = [];
    const tables = this.sim.cafe.furniture.filter((f) => CATALOG[f.type].surface && !CATALOG[f.type].station && !CATALOG[f.type].seat);
    for (const it of this.sim.cafe.furniture) {
      const def = CATALOG[it.type];
      if (!def.seat) continue;
      const [w, d] = footprint(it);
      for (let j = 0; j < d; j++) for (let i = 0; i < w; i++) {
        const x = it.x + i, y = it.y + j;
        let face = FACING[def.rotates ? it.rot % 4 : 0];
        if (!def.rotates && tables.length) {
          // a stool turns towards the closest table or counter
          let best = null, bd = 9;
          for (const t of tables) { const dd = Math.hypot(t.x + 0.5 - x - 0.5, t.y + 0.5 - y - 0.5); if (dd < bd) { bd = dd; best = t; } }
          if (best && bd < 2.5) { const dx = best.x - x, dy = best.y - y; face = Math.abs(dx) > Math.abs(dy) ? [Math.sign(dx), 0] : [0, Math.sign(dy) || 1]; }
        }
        out.push({ key: `${it.id}:${i},${j}`, x, y, z: def.seatZ ?? 9, face });
      }
    }
    return out;
  }

  // a free floor tile next to a seat, preferring the open side in front of it
  approach(seat) {
    const g = this.sim.grid;
    const front = [seat.x + seat.face[0], seat.y + seat.face[1]];
    if (walkable(g, front[0], front[1])) return front;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, 1], [1, -1], [-1, -1]]) if (walkable(g, seat.x + dx, seat.y + dy)) return [seat.x + dx, seat.y + dy];
    return null;
  }

  spawn() {
    const used = new Set([...this.list.values()].map((c) => c.seat.key));
    const free = this.seats().filter((s) => !used.has(s.key) && this.approach(s));
    if (!free.length) return false;
    const seat = free[Math.floor(Math.random() * free.length)];
    const spot = this.approach(seat);
    const path = findPath(this.sim.grid, DOOR[0], DOOR[1], spot[0] + 0.5, spot[1] + 0.5);
    if (!path) return false;
    const seed = Math.floor(Math.random() * 2 ** 31);
    const c = { id: 'u' + (seq++).toString(36) + seed.toString(36).slice(0, 3), seed, name: customerName(seed), x: DOOR[0], y: DOOR[1], z: 0, path, view: 'front', flip: false, state: 'enter', seat, spot, order: null, claimedBy: null, wait: 0, t: 0, emote: null, emoteT: 0, tip: 0 };
    this.list.set(c.id, c);
    this.sim.emit('fx', { kind: 'bell' });
    return true;
  }

  emote(c, kind, secs = 2.2) { c.emote = kind; c.emoteT = secs; }

  sitDown(c) {
    const s = c.seat;
    c.x = s.x + 0.5; c.y = s.y + 0.5; c.z = s.z;
    // look the way the seat faces
    const [fx, fy] = s.face, sx = fx - fy, sy = fx + fy;
    c.flip = sx < 0; c.view = sy >= 0 ? 'front' : 'back';
    c.state = 'order';
    const menu = this.sim.cafe.recipes;
    c.order = menu[Math.floor(Math.random() * menu.length)];
    // once the café is warmed up, some customers like something extra on top
    const extras = DRINKS[c.order].extras;
    c.extra = (this.sim.cafe.stats.served || 0) >= 3 && extras.length && Math.random() < 0.45 ? extras[Math.floor(Math.random() * extras.length)] : '';
    c.wait = 0;
  }

  standUp(c) {
    c.z = 0;
    c.x = c.spot[0] + 0.5; c.y = c.spot[1] + 0.5;
    c.path = findPath(this.sim.grid, c.x, c.y, DOOR[0], DOOR[1]) || [[DOOR[0], DOOR[1]]];
    c.state = 'leave';
  }

  // the furniture layout changed: re-check seats for everyone
  relayout() {
    const keys = new Set(this.seats().map((s) => s.key));
    for (const c of this.list.values()) {
      if (keys.has(c.seat.key)) continue;
      // their seat was moved or stored: they wander off happily
      if (c.state === 'enter') { c.path = findPath(this.sim.grid, c.x, c.y, DOOR[0], DOOR[1]) || []; c.state = 'leave'; }
      else if (c.state !== 'leave') { c.z = 0; this.emote(c, 'smile'); c.path = findPath(this.sim.grid, c.x, c.y, DOOR[0], DOOR[1]) || []; c.state = 'leave'; }
    }
  }

  step(dt) {
    const sim = this.sim;
    this.nextIn -= dt;
    const busy = [...this.list.values()].filter((c) => c.state !== 'leave').length;
    if (this.nextIn <= 0) {
      this.nextIn = 14 + Math.random() * 14 + busy * 4;
      if (busy < 6) this.spawn();
    }
    for (const c of [...this.list.values()]) {
      if (c.emoteT > 0 && (c.emoteT -= dt) <= 0) c.emote = null;
      if (c.state === 'enter' || c.state === 'leave') {
        const moving = sim.follow(c, dt, SPEED);
        c.moving = moving;
        if (!moving) {
          if (c.state === 'enter') this.sitDown(c);
          else { this.list.delete(c.id); continue; }
        }
      } else if (c.state === 'order') {
        c.wait += dt;
        // nobody minds waiting; after a long while they simply come back another day
        if (c.wait > 300 && !c.claimedBy) { this.emote(c, 'smile', 3); this.standUp(c); }
      } else if (c.state === 'drink') {
        c.t -= dt;
        // enjoying the cats
        if (!c.emote && Math.random() < dt * 0.35) {
          const near = [...sim.cats.values()].some((k) => Math.hypot(k.x - c.x, k.y - c.y) < 1.8);
          if (near) {
            const kind = ['heart', 'camera', 'wow', 'heart'][Math.floor(Math.random() * 4)];
            this.emote(c, kind);
            c.tip += kind === 'camera' ? 3 : 2;
            if (kind === 'camera') sim.emit('fx', { kind: 'flash', x: c.x, y: c.y, z: c.z + 20 });
          } else if (Math.random() < 0.3) this.emote(c, Math.random() < 0.5 ? 'note' : 'sparkle');
        }
        if (c.t <= 0) {
          if (c.tip > 0) { sim.cafe.money += c.tip; sim.emit('fx', { kind: 'coins', x: c.x, y: c.y, z: c.z + 22, amount: c.tip }); sim.emit('save'); }
          this.emote(c, 'smile', 3);
          this.standUp(c);
        }
      }
    }
  }

  // ---------- player actions ----------
  claim(pid, id) {
    const c = this.list.get(id), p = this.sim.players.get(pid);
    if (!c || !p || c.state !== 'order') return 'That order is already done';
    if (c.claimedBy && c.claimedBy !== pid && this.sim.players.has(c.claimedBy)) return 'Your friend is already making that one';
    if (p.carry) return 'Your hands are full: serve your drink first';
    c.claimedBy = pid;
    // walk over to the espresso bar
    const bar = this.sim.cafe.furniture.find((f) => CATALOG[f.type].station);
    if (bar) {
      const [w, d] = footprint(bar);
      const spot = nearestFree(this.sim.grid, bar.x + w / 2, bar.y + d / 2, p.x, p.y);
      if (spot) this.sim.movePlayer(pid, spot[0] + 0.5, spot[1] + 0.5);
    }
    return null;
  }

  // q: how well it was made, 0..1 (from the barista station)
  brewed(pid, id, q = 0.7) {
    const c = this.list.get(id), p = this.sim.players.get(pid);
    if (!c || !p || c.state !== 'order' || c.claimedBy !== pid) return 'That order is already done';
    q = Math.max(0, Math.min(1, Number.isFinite(+q) ? +q : 0.7));
    p.carry = { drink: c.order, extra: c.extra || '', q, for: id };
    this.sim.emit('fx', { kind: 'steam', x: p.x, y: p.y });
    return null;
  }

  serve(pid, id) {
    const c = this.list.get(id), p = this.sim.players.get(pid);
    if (!p || !p.carry) return 'Make a drink at the espresso bar first';
    if (!c || c.state !== 'order') return 'They already have their drink';
    if (c.order !== p.carry.drink || (c.extra || '') !== (p.carry.extra || '')) return `${c.name} ordered ${orderName(c.order, c.extra).toLowerCase()}`;
    if (Math.hypot(p.x - c.x, p.y - c.y) < 1.6) return this.deliver(p, c);
    const spot = nearestFree(this.sim.grid, c.x, c.y, p.x, p.y);
    if (spot) this.sim.movePlayer(pid, spot[0] + 0.5, spot[1] + 0.5, { serve: id });
    return null;
  }

  deliver(p, c) {
    if (!p.carry || c.state !== 'order' || c.order !== p.carry.drink || (c.extra || '') !== (p.carry.extra || '')) return null;
    // a drink made for someone else still goes to whoever ordered the same thing
    if (p.carry.for !== c.id) {
      const other = this.list.get(p.carry.for);
      if (other && other.claimedBy === p.id) other.claimedBy = null;
    }
    const price = orderPrice(c.order, c.extra), q = p.carry.q ?? 0.7, tip = tipFor(price, q), stars = starsFor(q);
    const stats = this.sim.cafe.stats;
    this.sim.cafe.money += price + tip;
    stats.served = (stats.served || 0) + 1;
    if (stars === 3) stats.perfect = (stats.perfect || 0) + 1;
    p.carry = null;
    c.state = 'drink'; c.t = 22 + Math.random() * 12; c.claimedBy = null;
    c.stars = stars;
    this.emote(c, stars === 3 ? 'star' : 'heart', 2.5);
    this.sim.emit('fx', { kind: 'coins', x: c.x, y: c.y, z: c.z + 22, amount: price + tip, tip, stars, by: p.id, name: c.name });
    this.sim.emit('save');
    return null;
  }

  playerLeft(pid) { for (const c of this.list.values()) if (c.claimedBy === pid) c.claimedBy = null; }

  snapshot() {
    return [...this.list.values()].map((c) => [c.id, +c.x.toFixed(3), +c.y.toFixed(3), c.z, c.view === 'back' ? 1 : 0, c.flip ? 1 : 0, c.state, c.seed, c.order || '', c.emote || '', c.claimedBy || '', c.moving ? 1 : 0, c.seat.key, c.extra || '']);
  }
}

export { DRINKS, ROOM_W };
