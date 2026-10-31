// Customers, orders and the café's day, run by the host. During opening hours customers
// stroll in, take a seat and order a drink, some food, or both. Players make each item
// and serve it; when customers leave they put a tip on the table for a player to pick
// up. At closing time no one new comes in, and once the last customer has gone the day
// ends with a little summary.
import { CATALOG } from './catalog.js';
import { DRINKS, orderPrice, tipFor, starsFor } from '../art/drinks.js';
import { FOODS, foodWants, foodPrice } from '../art/foods.js';
import { findPath, nearestFree, walkable, footprint, ROOM_W, seededRng, newDay } from './world.js';
import { msg } from '../i18n.js';
export { seededRng };

const SPEED = 2.0;
export const DOOR = [0.5, 5.5];
const NAMES = ['Hana', 'Ollie', 'June', 'Milo', 'Rosa', 'Theo', 'Ivy', 'Sam', 'Nora', 'Eli', 'Lea', 'Ben', 'Maya', 'Kai', 'Iris', 'Jonah', 'Vera', 'Lev', 'Sofia', 'Artem'];
// which way a seat faces for each rotation (chairs face +y when not rotated)
const FACING = [[0, 1], [-1, 0], [0, -1], [1, 0]];
// the café is open 8:00 to 20:00; one in-game minute passes every 0.75 s (a day is 9 minutes)
export const OPEN_AT = 8 * 60, DAY_MINUTES = 12 * 60, MIN_PER_SEC = 1 / 0.75;
export const REFUSE_BELOW = 0.35;

export const customerName = (seed) => NAMES[seed % NAMES.length];
export const itemPrice = (it) => (it.kind === 'food' ? foodPrice(it.id, it.extra) : orderPrice(it.id, it.extra));
export const itemName = (it) => (it.kind === 'food' ? FOODS[it.id].name : DRINKS[it.id].name);
export function clockText(min) {
  const m = Math.floor(OPEN_AT + Math.min(min, DAY_MINUTES + 59));
  return `${Math.floor(m / 60)}:${String(m % 60).padStart(2, '0')}`;
}

let seq = 0;

export class CustomerSystem {
  constructor(sim) {
    this.sim = sim;
    this.list = new Map();
    this.nextIn = 5;
  }
  get cafe() { return this.sim.cafe; }
  get day() { return this.sim.cafe.day; }

  // every seat in the café with where it is, how high and which way it faces
  seats() {
    const out = [];
    const tables = this.cafe.furniture.filter((f) => CATALOG[f.type].surface && !CATALOG[f.type].station && !CATALOG[f.type].seat);
    for (const it of this.cafe.furniture) {
      const def = CATALOG[it.type];
      if (!def.seat) continue;
      const [w, d] = footprint(it);
      for (let j = 0; j < d; j++) for (let i = 0; i < w; i++) {
        const x = it.x + i, y = it.y + j;
        let face = FACING[def.rotates ? it.rot % 4 : 0];
        let table = null, bd = 9;
        for (const t of tables) { const dd = Math.hypot(t.x + 0.5 - x - 0.5, t.y + 0.5 - y - 0.5); if (dd < bd) { bd = dd; table = t; } }
        if (!def.rotates && table && bd < 2.5) {
          // a stool or cushion turns towards the closest table
          const dx = table.x - x, dy = table.y - y;
          face = Math.abs(dx) > Math.abs(dy) ? [Math.sign(dx), 0] : [0, Math.sign(dy) || 1];
        }
        out.push({ key: `${it.id}:${i},${j}`, x, y, z: def.seatZ ?? 9, face, table: table && bd < 1.6 ? { x: table.x, y: table.y, z: CATALOG[table.type].surface } : null });
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
    const c = { id: 'u' + (seq++).toString(36) + seed.toString(36).slice(0, 3), seed, name: customerName(seed), x: DOOR[0], y: DOOR[1], z: 0, path, view: 'front', flip: false, state: 'enter', seat, spot, items: [], wait: 0, t: 0, emote: null, emoteT: 0, tip: 0, stars: [] };
    this.list.set(c.id, c);
    this.sim.emit('fx', { kind: 'bell' });
    return true;
  }

  emote(c, kind, secs = 2.2) { c.emote = kind; c.emoteT = secs; }

  // what a customer would like: a drink, some food, or one of each
  makeOrder() {
    const cafe = this.cafe, items = [];
    const drinks = cafe.recipes || [], foods = cafe.foods || [];
    const pick = (a) => a[Math.floor(Math.random() * a.length)];
    const drink = () => {
      const id = pick(drinks), ex = DRINKS[id].extras || [];
      const extra = (cafe.stats.served || 0) >= 1 && ex.length && Math.random() < 0.5 ? pick(ex) : '';
      return { kind: 'drink', id, extra, by: null, done: false };
    };
    const food = () => { const id = pick(foods); return { kind: 'food', id, extra: foodWants(id), by: null, done: false }; };
    const r = Math.random();
    if (!foods.length || r < 0.5) items.push(drink());
    else if (r < 0.75) items.push(food());
    else items.push(drink(), food());
    return items;
  }

  sitDown(c) {
    const s = c.seat;
    c.x = s.x + 0.5; c.y = s.y + 0.5; c.z = s.z;
    // look the way the seat faces
    const [fx, fy] = s.face, sx = fx - fy, sy = fx + fy;
    c.flip = sx < 0; c.view = sy >= 0 ? 'front' : 'back';
    c.state = 'order';
    c.items = this.makeOrder();
    c.wait = 0;
  }

  standUp(c) {
    c.z = 0;
    c.x = c.spot[0] + 0.5; c.y = c.spot[1] + 0.5;
    c.path = findPath(this.sim.grid, c.x, c.y, DOOR[0], DOOR[1]) || [[DOOR[0], DOOR[1]]];
    c.state = 'leave';
  }

  // leaving: the tip goes on their table (or seat) for a player to collect
  leaveTip(c) {
    if (c.tip <= 0) return;
    const t = c.seat.table;
    const tip = { id: 't' + (seq++).toString(36) + Math.floor(Math.random() * 1e4).toString(36), x: t ? t.x + 0.5 + (c.x - t.x - 0.5) * 0.3 : c.x, y: t ? t.y + 0.5 + (c.y - t.y - 0.5) * 0.3 : c.y, z: t ? t.z : c.seat.z, amount: Math.round(c.tip) };
    this.cafe.tips.push(tip);
    if (this.cafe.tips.length > 20) this.cafe.tips.shift();
    c.tip = 0;
    this.sim.emit('save');
  }

  // the furniture layout changed: re-check seats for everyone
  relayout() {
    const seats = new Map(this.seats().map((s) => [s.key, s]));
    for (const c of this.list.values()) {
      const s = seats.get(c.seat.key);
      if (s) { c.seat.table = s.table; continue; }
      // their seat was moved or stored: they wander off happily
      if (c.state !== 'leave') { if (c.state !== 'enter') { c.z = 0; this.emote(c, 'smile'); } this.leaveTip(c); }
      c.path = findPath(this.sim.grid, c.x, c.y, DOOR[0], DOOR[1]) || [];
      c.state = 'leave';
    }
  }

  // ---------- the day ----------
  stepDay(dt) {
    const d = this.day;
    if (this.sim.idle) return;
    if (d.phase === 'open') {
      d.min += dt * MIN_PER_SEC;
      if (d.min >= DAY_MINUTES) { d.min = DAY_MINUTES; d.phase = 'closing'; this.sim.emit('fx', { kind: 'closing' }); this.sim.emit('save'); }
    } else if (d.phase === 'closing') {
      d.min = Math.min(DAY_MINUTES + 59, d.min + dt * MIN_PER_SEC * 0.5);
      if (!this.list.size) { d.phase = 'closed'; this.sim.emit('fx', { kind: 'dayEnd', day: d.n, today: d.today }); this.sim.emit('save'); }
    }
  }
  closeEarly() { if (this.day.phase !== 'open') return 'The café is already closing'; this.day.phase = 'closing'; this.sim.emit('fx', { kind: 'closing' }); return null; }
  nextDay() {
    if (this.day.phase !== 'closed') return 'Finish the day first';
    this.cafe.day = newDay(this.day.n + 1);
    this.nextIn = 4;
    this.sim.emit('fx', { kind: 'dayStart', day: this.cafe.day.n });
    this.sim.emit('save');
    return null;
  }

  step(dt) {
    const sim = this.sim;
    this.stepDay(dt);
    this.nextIn -= dt;
    const busy = [...this.list.values()].filter((c) => c.state !== 'leave').length;
    if (this.nextIn <= 0) {
      // busier at lunch and in the afternoon
      const h = (OPEN_AT + this.day.min) / 60;
      const rush = (h >= 11.5 && h < 13.5) || (h >= 15 && h < 16.5) ? 0.6 : 1;
      this.nextIn = (12 + Math.random() * 12 + busy * 3) * rush;
      if (busy < 6 && (this.day.phase === 'open' || sim.idle)) this.spawn();
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
        if (c.wait > 300 && !c.items.some((i) => i.by && sim.players.has(i.by))) { this.emote(c, 'smile', 3); this.leaveTip(c); this.standUp(c); }
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
        if (c.t <= 0) { this.emote(c, 'smile', 3); this.leaveTip(c); this.standUp(c); }
      }
    }
  }

  // ---------- player actions ----------
  // claim item `idx` of a customer's order: the other player sees who is making it
  claim(pid, id, idx = 0) {
    const c = this.list.get(id), p = this.sim.players.get(pid), it = c?.items[idx | 0];
    if (!c || !p || c.state !== 'order' || !it || it.done) return 'That order is already done';
    if (it.by && it.by !== pid && this.sim.players.has(it.by)) return 'Your friend is already making that one';
    if (p.carry) return 'Your hands are full: serve what you are holding first';
    // one thing at a time: drop any other claim this player had
    for (const u of this.list.values()) for (const x of u.items) if (x.by === pid && x !== it && !x.done) x.by = null;
    it.by = pid;
    // walk over to the espresso bar, or the pastry case for food
    const want = it.kind === 'food' ? (d) => d.type === 'pastry' || d.type === 'counter' : (d) => CATALOG[d.type].station;
    const st = this.cafe.furniture.find(want) || this.cafe.furniture.find((f) => CATALOG[f.type].station);
    if (st) {
      const [w, d] = footprint(st);
      const spot = nearestFree(this.sim.grid, st.x + w / 2, st.y + d / 2, p.x, p.y);
      if (spot) this.sim.movePlayer(pid, spot[0] + 0.5, spot[1] + 0.5);
    }
    return null;
  }
  unclaim(pid, id, idx = 0) { const it = this.list.get(id)?.items[idx | 0]; if (it && it.by === pid) it.by = null; return null; }

  // q: how well it was made, 0..1 (from the barista station or the kitchen)
  brewed(pid, id, idx = 0, q = 0.7) {
    const c = this.list.get(id), p = this.sim.players.get(pid), it = c?.items[idx | 0];
    if (!c || !p || c.state !== 'order' || !it || it.done || it.by !== pid) return 'That order is already done';
    q = Math.max(0, Math.min(1, Number.isFinite(+q) ? +q : 0.7));
    p.carry = { kind: it.kind, id: it.id, extra: it.extra || '', q, for: id, idx: idx | 0 };
    return null;
  }
  // put down what you're holding (it goes in the bin)
  drop(pid) { const p = this.sim.players.get(pid); if (p) p.carry = null; return null; }

  match(c, carry) { return c.items.findIndex((i) => !i.done && i.kind === carry.kind && i.id === carry.id && (i.extra || '') === (carry.extra || '')); }

  serve(pid, id) {
    const c = this.list.get(id), p = this.sim.players.get(pid);
    if (!p || !p.carry) return 'Make something at the counter first';
    if (!c || c.state !== 'order') return 'They already have everything';
    if (this.match(c, p.carry) < 0) return msg('{name} did not order that', { name: c.name });
    if (Math.hypot(p.x - c.x, p.y - c.y) < 1.6) return this.deliver(p, c);
    const spot = nearestFree(this.sim.grid, c.x, c.y, p.x, p.y);
    if (spot) this.sim.movePlayer(pid, spot[0] + 0.5, spot[1] + 0.5, { serve: id });
    return null;
  }

  deliver(p, c) {
    if (!p.carry || c.state !== 'order') return null;
    const i = this.match(c, p.carry);
    if (i < 0) return null;
    const it = c.items[i], q = p.carry.q ?? 0.7;
    // a drink made for someone else can still go to whoever ordered the same thing
    if (p.carry.for !== c.id) { const o = this.list.get(p.carry.for); const oi = o?.items[p.carry.idx]; if (oi && oi.by === p.id) oi.by = null; }
    p.carry = null;
    if (q < REFUSE_BELOW) {
      // a real mix-up: they kindly ask for it again
      it.by = p.id;
      this.emote(c, 'wow', 2.5);
      this.sim.emit('fx', { kind: 'refused', by: p.id, text: msg('{name}: that is not quite right. Could you make it again?', { name: c.name }) });
      return null;
    }
    const price = itemPrice(it), tip = tipFor(price, q), stars = starsFor(q);
    const day = this.day, stats = this.cafe.stats;
    this.cafe.money += price;
    c.tip += tip;
    it.done = true; it.by = null;
    c.stars.push(stars);
    stats.served = (stats.served || 0) + 1;
    day.today.served++; day.today.earned += price;
    if (stars === 3) { stats.perfect = (stats.perfect || 0) + 1; day.today.perfect++; }
    if (c.items.every((x) => x.done)) { c.state = 'drink'; c.t = 25 + Math.random() * 12; }
    this.emote(c, stars === 3 ? 'star' : 'heart', 2.5);
    this.sim.emit('fx', { kind: 'coins', x: c.x, y: c.y, z: c.z + 22, amount: price, stars, by: p.id, name: c.name });
    this.sim.emit('save');
    return null;
  }

  collectTip(pid, tid) {
    const tips = this.cafe.tips, i = tips.findIndex((t) => t.id === tid);
    if (i < 0) return null;
    const [t] = tips.splice(i, 1);
    this.cafe.money += t.amount;
    this.day.today.tips += t.amount;
    this.sim.emit('fx', { kind: 'coins', x: t.x, y: t.y, z: t.z + 4, amount: t.amount, by: pid, tip: true });
    this.sim.emit('save');
    return null;
  }

  playerLeft(pid) { for (const c of this.list.values()) for (const i of c.items) if (i.by === pid) i.by = null; }

  snapshot() {
    return [...this.list.values()].map((c) => [c.id, +c.x.toFixed(3), +c.y.toFixed(3), c.z, c.view === 'back' ? 1 : 0, c.flip ? 1 : 0, c.state, c.seed, c.items.map((i) => [i.kind === 'food' ? 1 : 0, i.id, i.extra || '', i.by || '', i.done ? 1 : 0]), c.emote || '', c.moving ? 1 : 0, c.seat.table ? [c.seat.table.x, c.seat.table.y, c.seat.table.z] : 0]);
  }
}

export { DRINKS, ROOM_W };
