// The capture duel: arena, movement, shooting and the duel bot. Pure math, no DOM and no
// three.js, so the tests can run whole fights in Node.
import { FIGHTERS } from './pieces.js';

export const DUEL_TIME = 75; // seconds; if nobody falls, the defender holds its square

// Arenas are rooms of axis-aligned boxes {x, z, w, d, h} (centre x/z, size w/d, height h).
// Layouts are mirror-symmetric front to back so neither side has the better spawn.
function mirrorBoxes(half) {
  const out = [];
  for (const b of half) {
    out.push(b);
    if (b.z !== 0) out.push({ ...b, x: -b.x, z: -b.z });
  }
  return out;
}

const LAYOUTS = {
  // light squares: an open courtyard with pillars and low walls
  light: {
    w: 26, d: 36,
    boxes: mirrorBoxes([
      { x: 0, z: 0, w: 4, d: 4, h: 3.2 },
      { x: -7, z: 6, w: 1.6, d: 1.6, h: 3.2 },
      { x: 7, z: 6, w: 1.6, d: 1.6, h: 3.2 },
      { x: -3.5, z: 10, w: 5, d: 0.8, h: 1.1 },
      { x: 6.5, z: 12.5, w: 3, d: 0.8, h: 1.1 },
      { x: -9, z: 0, w: 0.8, d: 5, h: 1.1 },
    ]),
  },
  // dark squares: a tighter maze of tall blocks
  dark: {
    w: 24, d: 34,
    boxes: mirrorBoxes([
      { x: -4, z: 0, w: 3, d: 3, h: 3.2 },
      { x: 4, z: 0, w: 3, d: 3, h: 3.2 },
      { x: 0, z: 6, w: 6, d: 1, h: 3.2 },
      { x: -8, z: 8, w: 2, d: 4, h: 3.2 },
      { x: 8, z: 8, w: 2, d: 4, h: 3.2 },
      { x: 0, z: 11, w: 2, d: 2, h: 1.1 },
      { x: -5, z: 13, w: 3, d: 0.8, h: 1.1 },
    ]),
  },
};

export function makeArena(kind = 'light') {
  const L = LAYOUTS[kind] || LAYOUTS.light;
  const t = 1, H = 5;
  const walls = [
    { x: 0, z: -L.d / 2 - t / 2, w: L.w + 2 * t, d: t, h: H, wall: true },
    { x: 0, z: L.d / 2 + t / 2, w: L.w + 2 * t, d: t, h: H, wall: true },
    { x: -L.w / 2 - t / 2, z: 0, w: t, d: L.d, h: H, wall: true },
    { x: L.w / 2 + t / 2, z: 0, w: t, d: L.d, h: H, wall: true },
  ];
  const arena = { kind, w: L.w, d: L.d, boxes: [...L.boxes.map((b) => ({ ...b })), ...walls] };
  arena.grid = buildGrid(arena);
  return arena;
}

// side 0 = attacker (spawns at +z looking toward -z), side 1 = defender
export function makeFighter(type, side, arena) {
  const F = FIGHTERS[type];
  return {
    type, side,
    x: 0, z: side === 0 ? arena.d / 2 - 2.5 : -arena.d / 2 + 2.5,
    yaw: side === 0 ? 0 : Math.PI, pitch: 0,
    hp: F.hp, maxHp: F.hp,
    radius: F.radius, height: F.height, speed: F.speed,
    weapon: F.weapon,
    ammo: F.weapon.mag, cool: 0, reloading: 0,
    vx: 0, vz: 0,
  };
}

export const eyeHeight = (f) => f.height * 0.86;
export const eye = (f) => ({ x: f.x, y: eyeHeight(f), z: f.z });
export function aimDir(yaw, pitch) {
  const c = Math.cos(pitch);
  return { x: -Math.sin(yaw) * c, y: Math.sin(pitch), z: -Math.cos(yaw) * c };
}

function collides(arena, x, z, r) {
  for (const b of arena.boxes) {
    const cx = Math.max(b.x - b.w / 2, Math.min(x, b.x + b.w / 2));
    const cz = Math.max(b.z - b.d / 2, Math.min(z, b.z + b.d / 2));
    if ((x - cx) ** 2 + (z - cz) ** 2 < r * r) return true;
  }
  return false;
}

// mx: strafe right (+) / left (-); mz: forward (+) / back (-). Both -1..1.
export function moveFighter(f, mx, mz, dt, arena, other) {
  const len = Math.hypot(mx, mz);
  if (len > 1) { mx /= len; mz /= len; }
  const fx = -Math.sin(f.yaw), fz = -Math.cos(f.yaw);
  const rx = Math.cos(f.yaw), rz = -Math.sin(f.yaw);
  const sp = f.speed * (f.weapon.zoom && f.zoomed ? 0.55 : 1);
  // a little acceleration so movement does not feel like teleporting
  const tx = (fx * mz + rx * mx) * sp, tz = (fz * mz + rz * mx) * sp;
  const k = Math.min(1, dt * 14);
  f.vx += (tx - f.vx) * k;
  f.vz += (tz - f.vz) * k;
  const blocked = (x, z) => collides(arena, x, z, f.radius) ||
    (other && other.hp > 0 && (x - other.x) ** 2 + (z - other.z) ** 2 < (f.radius + other.radius) ** 2);
  const nx = f.x + f.vx * dt;
  if (!blocked(nx, f.z)) f.x = nx; else f.vx = 0;
  const nz = f.z + f.vz * dt;
  if (!blocked(f.x, nz)) f.z = nz; else f.vz = 0;
}

// Distance along a ray to the first box it hits (slab method), or max.
export function rayBoxes(arena, o, d, max = 200) {
  let best = max;
  for (const b of arena.boxes) {
    let t0 = 0, t1 = best;
    const lo = [b.x - b.w / 2, 0, b.z - b.d / 2], hi = [b.x + b.w / 2, b.h, b.z + b.d / 2];
    const oo = [o.x, o.y, o.z], dd = [d.x, d.y, d.z];
    let hit = true;
    for (let i = 0; i < 3; i++) {
      if (Math.abs(dd[i]) < 1e-9) {
        if (oo[i] < lo[i] || oo[i] > hi[i]) { hit = false; break; }
        continue;
      }
      let a = (lo[i] - oo[i]) / dd[i], c = (hi[i] - oo[i]) / dd[i];
      if (a > c) [a, c] = [c, a];
      t0 = Math.max(t0, a); t1 = Math.min(t1, c);
      if (t0 > t1) { hit = false; break; }
    }
    if (hit && t0 < best) best = t0;
  }
  // floor
  if (d.y < 0) best = Math.min(best, -o.y / d.y);
  return best;
}

// Distance along a ray to a fighter's body (an upright cylinder), or Infinity.
export function rayFighter(o, d, f) {
  const ox = o.x - f.x, oz = o.z - f.z;
  const a = d.x * d.x + d.z * d.z;
  if (a < 1e-9) return Infinity;
  const b = 2 * (ox * d.x + oz * d.z);
  const c = ox * ox + oz * oz - f.radius * f.radius;
  const disc = b * b - 4 * a * c;
  if (disc < 0) return Infinity;
  const s = Math.sqrt(disc);
  for (const t of [(-b - s) / (2 * a), (-b + s) / (2 * a)]) {
    if (t < 0) continue;
    const y = o.y + d.y * t;
    if (y >= 0 && y <= f.height) return t;
  }
  return Infinity;
}

export function canSee(arena, a, b) {
  const o = eye(a);
  const tx = b.x - o.x, ty = b.height * 0.6 - o.y, tz = b.z - o.z;
  const dist = Math.hypot(tx, ty, tz);
  const d = { x: tx / dist, y: ty / dist, z: tz / dist };
  return rayBoxes(arena, o, d, dist) >= dist - 0.01;
}

export function updateWeapon(f, dt) {
  f.cool = Math.max(0, f.cool - dt);
  if (f.reloading > 0) {
    f.reloading -= dt;
    if (f.reloading <= 0) { f.reloading = 0; f.ammo = f.weapon.mag; }
  }
}

export function startReload(f) {
  if (f.reloading > 0 || f.ammo === f.weapon.mag) return;
  f.reloading = f.weapon.reload;
}

// Fires if ready. Returns a list of shot directions (one per pellet) or null.
export function tryFire(f, rnd = Math.random) {
  if (f.cool > 0 || f.reloading > 0 || f.hp <= 0) return null;
  if (f.ammo <= 0) { startReload(f); return null; }
  const w = f.weapon;
  f.cool = w.rate;
  f.ammo--;
  if (f.ammo === 0) startReload(f);
  const spread = w.spread * (f.zoomed ? 0.25 : 1) * (Math.hypot(f.vx, f.vz) > 1 ? 1.6 : 1);
  const dirs = [];
  for (let i = 0; i < w.pellets; i++) {
    const yaw = f.yaw + (rnd() - 0.5) * 2 * spread;
    const pitch = f.pitch + (rnd() - 0.5) * 2 * spread;
    dirs.push(aimDir(yaw, pitch));
  }
  return dirs;
}

// Resolves hitscan pellets. Returns {damage, hits: [{end, hit}]} for drawing tracers.
export function resolveHitscan(arena, shooter, target, dirs) {
  const o = eye(shooter);
  const w = shooter.weapon;
  let damage = 0, head = false;
  const hits = [];
  for (const d of dirs) {
    const tw = rayBoxes(arena, o, d, w.range);
    const tf = target && target.hp > 0 ? rayFighter(o, d, target) : Infinity;
    const hit = tf < tw;
    const t = hit ? tf : tw;
    const end = { x: o.x + d.x * t, y: o.y + d.y * t, z: o.z + d.z * t };
    if (hit) {
      // falloff past half range, bonus for hits on the top of the piece ("crown shots")
      const fall = t > w.range * 0.5 ? Math.max(0.35, 1 - (t - w.range * 0.5) / w.range) : 1;
      const crown = end.y > target.height * 0.8;
      if (crown) head = true;
      damage += w.dmg * fall * (crown ? 1.5 : 1);
    }
    hits.push({ end, hit });
  }
  return { damage: Math.round(damage), head, hits, origin: o };
}

export function makeRocket(shooter, d) {
  const o = eye(shooter);
  const sp = shooter.weapon.rocketSpeed;
  return { x: o.x + d.x * 0.8, y: o.y - 0.2 + d.y * 0.8, z: o.z + d.z * 0.8, vx: d.x * sp, vy: d.y * sp, vz: d.z * sp, life: 4, owner: shooter.side };
}

// Moves a rocket. Returns null while flying, or the explosion point when it hits something.
export function stepRocket(rk, dt, arena, fighters) {
  const sp = Math.hypot(rk.vx, rk.vy, rk.vz);
  const d = { x: rk.vx / sp, y: rk.vy / sp, z: rk.vz / sp };
  const dist = sp * dt;
  const o = { x: rk.x, y: rk.y, z: rk.z };
  let t = rayBoxes(arena, o, d, dist);
  for (const f of fighters) if (f.side !== rk.owner && f.hp > 0) t = Math.min(t, rayFighter(o, d, f));
  rk.life -= dt;
  if (t < dist || rk.life <= 0) return { x: o.x + d.x * t, y: o.y + d.y * t, z: o.z + d.z * t };
  rk.x += d.x * dist; rk.y += d.y * dist; rk.z += d.z * dist;
  rk.vy -= 3 * dt; // a slight drop
  return null;
}

export function splashDamage(arena, p, f, w) {
  if (f.hp <= 0) return 0;
  const cy = Math.max(0, Math.min(f.height, p.y));
  const dx = f.x - p.x, dz = f.z - p.z;
  const flat = Math.max(0, Math.hypot(dx, dz) - f.radius);
  const dist = Math.hypot(flat, cy - p.y);
  if (dist > w.splash) return 0;
  // walls shield you from the blast
  const o = { x: p.x - (dx / (Math.hypot(dx, dz) || 1)) * 0.05, y: Math.max(0.2, p.y), z: p.z - (dz / (Math.hypot(dx, dz) || 1)) * 0.05 };
  const tx = f.x - o.x, ty = f.height * 0.5 - o.y, tz = f.z - o.z;
  const L = Math.hypot(tx, ty, tz);
  if (L > 0.3 && rayBoxes(arena, o, { x: tx / L, y: ty / L, z: tz / L }, L) < L - 0.3) return 0;
  return Math.round(w.dmg * (1 - 0.7 * (dist / w.splash)));
}

// ---------- navigation grid for the bot ----------
const CELL = 1;
function buildGrid(arena) {
  const cols = Math.round(arena.w / CELL), rows = Math.round(arena.d / CELL);
  const free = new Uint8Array(cols * rows);
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
    const x = -arena.w / 2 + (c + 0.5) * CELL, z = -arena.d / 2 + (r + 0.5) * CELL;
    free[r * cols + c] = collides(arena, x, z, 0.62) ? 0 : 1;
  }
  return { cols, rows, free };
}
const cellOf = (arena, x, z) => {
  const g = arena.grid;
  const c = Math.max(0, Math.min(g.cols - 1, Math.floor((x + arena.w / 2) / CELL)));
  const r = Math.max(0, Math.min(g.rows - 1, Math.floor((z + arena.d / 2) / CELL)));
  return r * g.cols + c;
};
const cellCenter = (arena, i) => {
  const g = arena.grid;
  return { x: -arena.w / 2 + ((i % g.cols) + 0.5) * CELL, z: -arena.d / 2 + (Math.floor(i / g.cols) + 0.5) * CELL };
};

// Breadth-first path; returns the list of cell centres from start to goal (exclusive of start)
export function findPath(arena, from, to) {
  const g = arena.grid;
  const start = cellOf(arena, from.x, from.z), goal = cellOf(arena, to.x, to.z);
  const prev = new Int32Array(g.cols * g.rows).fill(-1);
  prev[start] = start;
  const q = [start];
  for (let qi = 0; qi < q.length; qi++) {
    const i = q[qi];
    if (i === goal) break;
    const c = i % g.cols, r = Math.floor(i / g.cols);
    for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]]) {
      const nc = c + dc, nr = r + dr;
      if (nc < 0 || nr < 0 || nc >= g.cols || nr >= g.rows) continue;
      const n = nr * g.cols + nc;
      if (prev[n] >= 0 || (!g.free[n] && n !== goal)) continue;
      if (dc && dr && (!g.free[r * g.cols + nc] || !g.free[nr * g.cols + c])) continue; // no corner cutting
      prev[n] = i;
      q.push(n);
    }
  }
  if (prev[goal] < 0) return [];
  const path = [];
  for (let i = goal; i !== start; i = prev[i]) path.push(cellCenter(arena, i));
  return path.reverse();
}

const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));

// A duel opponent. level 0..2 changes reaction time, turn speed and aim error.
export class DuelBot {
  constructor(f, arena, level = 1, rnd = Math.random) {
    this.f = f; this.arena = arena; this.rnd = rnd;
    this.level = level;
    this.turnRate = [2.2, 3.4, 5.0][level];
    this.err = [0.11, 0.06, 0.03][level];
    this.react = [0.65, 0.4, 0.22][level];
    this.seenFor = 0;
    this.path = []; this.repath = 0;
    this.strafe = rnd() < 0.5 ? 1 : -1; this.strafeT = 0;
    this.aimOff = { yaw: 0, pitch: 0 }; this.offT = 0;
    const w = f.weapon;
    this.wantDist = w.pellets > 1 ? 4 : w.zoom ? 16 : w.rocket ? 11 : w.rate < 0.2 ? 8 : 10;
  }

  // Returns {mx, mz, fire}; turns the fighter itself.
  think(dt, target) {
    const f = this.f, a = this.arena, rnd = this.rnd;
    const see = target.hp > 0 && canSee(a, f, target);
    this.seenFor = see ? this.seenFor + dt : 0;
    const dx = target.x - f.x, dz = target.z - f.z;
    const dist = Math.hypot(dx, dz);
    let mx = 0, mz = 0, fire = false;

    // aim: drift a random error around the true direction, refreshed now and then
    this.offT -= dt;
    if (this.offT <= 0) {
      this.offT = 0.3 + rnd() * 0.5;
      this.aimOff = { yaw: (rnd() - 0.5) * 2 * this.err, pitch: (rnd() - 0.5) * this.err };
    }
    let goalYaw, goalPitch = 0;
    if (see) {
      const aimY = f.weapon.rocket ? 0.15 : target.height * 0.62; // mortar aims at the feet
      goalYaw = Math.atan2(-dx, -dz) + this.aimOff.yaw;
      goalPitch = Math.atan2(aimY - eyeHeight(f), dist) + this.aimOff.pitch;
    } else {
      const wp = this.path[0] || target;
      goalYaw = Math.atan2(-(wp.x - f.x), -(wp.z - f.z));
    }
    const dy = wrap(goalYaw - f.yaw);
    const maxTurn = this.turnRate * dt;
    f.yaw = wrap(f.yaw + Math.max(-maxTurn, Math.min(maxTurn, dy)));
    f.pitch += Math.max(-maxTurn, Math.min(maxTurn, goalPitch - f.pitch));

    if (see) {
      // keep a comfortable range and strafe
      this.strafeT -= dt;
      if (this.strafeT <= 0) { this.strafe = -this.strafe; this.strafeT = 0.6 + rnd() * 1.2; }
      mx = this.strafe;
      mz = dist > this.wantDist + 2 ? 1 : dist < this.wantDist - 2 ? -0.8 : 0;
      if (this.seenFor > this.react && Math.abs(dy) < 0.08 + 0.25 / Math.max(dist, 1)) fire = true;
      this.path = [];
    } else {
      this.repath -= dt;
      if (this.repath <= 0 || !this.path.length) { this.path = findPath(a, f, target); this.repath = 0.5; }
      while (this.path.length && Math.hypot(this.path[0].x - f.x, this.path[0].z - f.z) < 0.6) this.path.shift();
      mz = 1;
      // turn first, then run, so it does not rub along walls
      if (Math.abs(dy) > 0.9) mz = 0.2;
    }
    if (f.ammo === 0 || (!see && f.ammo < f.weapon.mag * 0.5)) startReload(f);
    return { mx, mz, fire };
  }
}
