// Course physics: builds a cannon-es world from a hole's grid and runs the balls.
// Shared by the game, the bots' shot planner and the headless tests, so all three
// see exactly the same course.
import * as CANNON from '../vendor/cannon-es.js';

export const CELL = 2;          // world units per grid cell
export const LEVEL = 0.5;       // height of one floor level
export const BALL_R = 0.18;
export const WALL_H = 0.42;     // wall height above the floor it guards
export const WALL_T = 0.24;
export const CUP_R = 0.3;
export const MAX_SPEED = 11;    // putt speed at full power
export const STEP = 1 / 120;
const BOTTOM = -1;              // underside of every floor column
const GRAVITY = -14;
const ROLL_DECEL = 1.7;         // rolling resistance on the felt
const SINK_SPEED = 4.2;         // faster than this and the ball skips over the cup
const BUMPER_KICK = 4.5;
const MAX_ROLL_TIME = 25;

const RAMP_DIRS = { '^': [0, -1], 'v': [0, 1], '<': [-1, 0], '>': [1, 0] };

// ---------- grid ----------
export function parseGrid(hole) {
  const rows = hole.grid;
  const H = rows.length, W = Math.max(...rows.map((r) => r.length));
  const raw = (c, r) => (r < 0 || r >= H || c < 0 || c >= W ? ' ' : rows[r][c] || ' ');
  const heightOf = (ch) => (ch === '.' ? 0 : ch >= '0' && ch <= '9' ? +ch : null);
  const cells = [];
  for (let r = 0; r < H; r++) {
    for (let c = 0; c < W; c++) {
      const ch = raw(c, r);
      let cell;
      if (ch === ' ') cell = { kind: 'void' };
      else if (ch === '_') cell = { kind: 'gap' };
      else if (RAMP_DIRS[ch]) {
        const [dx, dz] = RAMP_DIRS[ch];
        const low = heightOf(raw(c - dx, r - dz)) ?? 0;
        cell = { kind: 'ramp', dir: [dx, dz], low, high: low + 1, h: low + 1 };
      } else cell = { kind: 'floor', h: heightOf(ch) ?? 0 };
      cell.c = c; cell.r = r;
      cells.push(cell);
    }
  }
  const at = (c, r) => (r < 0 || r >= H || c < 0 || c >= W ? { kind: 'void', c, r } : cells[r * W + c]);
  return { W, H, cells, at };
}

// world position of a cell coordinate (cells are [col, row], may be fractional)
export const cellToWorld = (c, r) => [c * CELL, r * CELL];

// height of the playing surface at a world point (ramps interpolate)
export function surfaceY(grid, x, z) {
  const c = Math.floor(x / CELL), r = Math.floor(z / CELL);
  const cell = grid.at(c, r);
  if (cell.kind === 'floor') return cell.h * LEVEL;
  if (cell.kind === 'ramp') {
    const fx = x / CELL - c, fz = z / CELL - r;
    const [dx, dz] = cell.dir;
    const t = dx ? (dx > 0 ? fx : 1 - fx) : (dz > 0 ? fz : 1 - fz);
    return (cell.low + t) * LEVEL;
  }
  return null;
}

// ---------- static geometry, shared with the renderer ----------
// Returns plain descriptions: { kind, pos:[x,y,z], half:[x,y,z], quat?:[x,y,z,w] }
export function buildLayout(hole) {
  const grid = parseGrid(hole);
  const pieces = [];

  // floors: merge equal-height cells into rectangles so the ball rolls over fewer seams
  const used = new Set();
  for (const cell of grid.cells) {
    if (cell.kind !== 'floor' || used.has(cell)) continue;
    let w = 1, d = 1;
    const same = (c, r) => { const o = grid.at(c, r); return o.kind === 'floor' && o.h === cell.h && !used.has(o); };
    while (same(cell.c + w, cell.r)) w++;
    grow: for (;;) {
      for (let i = 0; i < w; i++) if (!same(cell.c + i, cell.r + d)) break grow;
      d++;
    }
    for (let j = 0; j < d; j++) for (let i = 0; i < w; i++) used.add(grid.at(cell.c + i, cell.r + j));
    const top = cell.h * LEVEL;
    pieces.push({
      kind: 'floor', h: cell.h, cells: [w, d],
      pos: [(cell.c + w / 2) * CELL, (top + BOTTOM) / 2, (cell.r + d / 2) * CELL],
      half: [w * CELL / 2, (top - BOTTOM) / 2, d * CELL / 2],
    });
  }

  // ramps: a tilted slab whose top face runs from the low edge to the high edge
  for (const cell of grid.cells) {
    if (cell.kind !== 'ramp') continue;
    const [dx, dz] = cell.dir;
    const rise = LEVEL, run = CELL, len = Math.hypot(rise, run), T = 0.6;
    const ang = Math.atan2(rise, run);
    const cx = (cell.c + 0.5) * CELL, cz = (cell.r + 0.5) * CELL;
    const midY = (cell.low + 0.5) * LEVEL;
    // rotate about the horizontal axis perpendicular to the slope
    const q = new CANNON.Quaternion();
    if (dx) q.setFromAxisAngle(new CANNON.Vec3(0, 0, 1), dx > 0 ? ang : -ang);
    else q.setFromAxisAngle(new CANNON.Vec3(1, 0, 0), dz > 0 ? -ang : ang);
    const n = q.vmult(new CANNON.Vec3(0, 1, 0));
    pieces.push({
      kind: 'ramp', dir: cell.dir, low: cell.low,
      pos: [cx - n.x * T / 2, midY - n.y * T / 2, cz - n.z * T / 2],
      half: dx ? [len / 2, T / 2, CELL / 2] : [CELL / 2, T / 2, len / 2],
      quat: [q.x, q.y, q.z, q.w],
    });
    // solid column under the slab
    const top = cell.low * LEVEL;
    pieces.push({ kind: 'fill', pos: [cx, (top + BOTTOM) / 2, cz], half: [CELL / 2, (top - BOTTOM) / 2, CELL / 2] });
  }

  // walls on every edge that faces the void; collinear runs are merged
  const runs = new Map();
  const playable = (o) => o.kind === 'floor' || o.kind === 'ramp';
  for (const cell of grid.cells) {
    if (!playable(cell)) continue;
    const top = cell.h * LEVEL + WALL_H;
    for (const [dc, dr] of [[0, -1], [0, 1], [-1, 0], [1, 0]]) {
      if (grid.at(cell.c + dc, cell.r + dr).kind !== 'void') continue;
      const horizontal = dr !== 0;
      const line = horizontal ? (dr < 0 ? cell.r : cell.r + 1) : (dc < 0 ? cell.c : cell.c + 1);
      const key = `${horizontal ? 'h' : 'v'}${line}:${dr || dc}:${top}`;
      if (!runs.has(key)) runs.set(key, { horizontal, line, side: dr || dc, top, at: [] });
      runs.get(key).at.push(horizontal ? cell.c : cell.r);
    }
  }
  for (const run of runs.values()) {
    run.at.sort((a, b) => a - b);
    let s = 0;
    for (let i = 1; i <= run.at.length; i++) {
      if (i < run.at.length && run.at[i] === run.at[i - 1] + 1) continue;
      const from = run.at[s] * CELL - WALL_T, to = (run.at[i - 1] + 1) * CELL + WALL_T;
      const off = run.line * CELL + (run.side * WALL_T) / 2;
      const mid = (from + to) / 2, halfLen = (to - from) / 2, hy = (run.top - BOTTOM) / 2;
      pieces.push({
        kind: 'wall', top: run.top,
        pos: run.horizontal ? [mid, (run.top + BOTTOM) / 2, off] : [off, (run.top + BOTTOM) / 2, mid],
        half: run.horizontal ? [halfLen, hy, WALL_T / 2] : [WALL_T / 2, hy, halfLen],
      });
      s = i;
    }
  }

  const surf = (c, r) => surfaceY(grid, c * CELL, r * CELL) ?? 0;
  const [sx, sz] = cellToWorld(...hole.start), [hx, hz] = cellToWorld(...hole.cup);
  const minTop = Math.min(0, ...grid.cells.filter(playable).map((c) => c.h * LEVEL));
  return {
    grid, pieces,
    start: [sx, surf(...hole.start) + BALL_R, sz],
    cup: [hx, surf(...hole.cup), hz],
    path: (hole.path || [hole.start, hole.cup]).map(([c, r]) => [c * CELL, surf(c, r), r * CELL]),
    minTop,
    bounds: { w: grid.W * CELL, d: grid.H * CELL },
  };
}

// ---------- moving obstacles ----------
// every obstacle's pose is a pure function of time, so a planner can replay any moment
export function obstaclePose(o, t) {
  if (o.type === 'mover') {
    const k = 0.5 - 0.5 * Math.cos((2 * Math.PI * t) / o.period + (o.phase || 0));
    return { x: o._a[0] + (o._b[0] - o._a[0]) * k, z: o._a[1] + (o._b[1] - o._a[1]) * k, angle: 0 };
  }
  if (o.type === 'spinner') return { x: o._at[0], z: o._at[1], angle: (o.phase || 0) + o.speed * t };
  return { x: o._at[0], z: o._at[1], angle: 0 };
}

// ---------- simulation ----------
export class HoleSim {
  constructor(hole, layout = buildLayout(hole)) {
    this.hole = hole;
    this.layout = layout;
    this.t = 0;
    this.balls = [];
    this.onEvent = null;

    const world = (this.world = new CANNON.World({ gravity: new CANNON.Vec3(0, GRAVITY, 0) }));
    world.broadphase = new CANNON.SAPBroadphase(world);
    world.allowSleep = false;
    world.solver.iterations = 8;

    this.ballMat = new CANNON.Material('ball');
    const floorMat = new CANNON.Material('floor'), wallMat = new CANNON.Material('wall'), bumpMat = new CANNON.Material('bumper');
    world.addContactMaterial(new CANNON.ContactMaterial(this.ballMat, floorMat, { friction: 0, restitution: 0.22 }));
    world.addContactMaterial(new CANNON.ContactMaterial(this.ballMat, wallMat, { friction: 0, restitution: 0.72 }));
    world.addContactMaterial(new CANNON.ContactMaterial(this.ballMat, bumpMat, { friction: 0, restitution: 0.9 }));

    const addBox = (p, mat, type = CANNON.Body.STATIC) => {
      const b = new CANNON.Body({ mass: 0, type, material: mat, collisionFilterGroup: 1, collisionFilterMask: 2 });
      b.addShape(new CANNON.Box(new CANNON.Vec3(...p.half)));
      b.position.set(...p.pos);
      if (p.quat) b.quaternion.set(...p.quat);
      world.addBody(b);
      return b;
    };
    for (const p of layout.pieces) addBox(p, p.kind === 'wall' ? wallMat : floorMat);

    // obstacles
    this.obstacles = (hole.obstacles || []).map((src) => {
      const o = { ...src };
      const cellY = (c, r) => surfaceY(layout.grid, c * CELL, r * CELL) ?? 0;
      if (o.at) { o._at = cellToWorld(...o.at); o.y = cellY(...o.at); }
      if (o.a) { o._a = cellToWorld(...o.a); o._b = cellToWorld(...o.b); o.y = cellY(...o.a); }
      if (o.type === 'bumper') {
        const b = new CANNON.Body({ mass: 0, material: bumpMat, collisionFilterGroup: 1, collisionFilterMask: 2 });
        const r = o.r || 0.35;
        b.addShape(new CANNON.Cylinder(r, r, 0.6, 16));
        b.position.set(o._at[0], o.y + 0.3, o._at[1]);
        b.isBumper = true;
        world.addBody(b);
        o.body = b;
      } else if (o.type === 'block') {
        const [w, h, d] = o.size;
        o.body = addBox({ pos: [o._at[0], o.y + h / 2, o._at[1]], half: [w / 2, h / 2, d / 2] }, wallMat);
      } else if (o.type === 'mover' || o.type === 'spinner') {
        const b = new CANNON.Body({ mass: 0, type: CANNON.Body.KINEMATIC, material: wallMat, collisionFilterGroup: 1, collisionFilterMask: 2 });
        if (o.type === 'mover') b.addShape(new CANNON.Box(new CANNON.Vec3(o.size[0] / 2, o.size[1] / 2, o.size[2] / 2)));
        else {
          const arm = new CANNON.Box(new CANNON.Vec3(o.len / 2, 0.2, 0.1));
          for (let i = 0; i < (o.arms || 2); i++) {
            const q = new CANNON.Quaternion(); q.setFromAxisAngle(new CANNON.Vec3(0, 1, 0), (i * Math.PI) / (o.arms || 2));
            b.addShape(arm, new CANNON.Vec3(), q);
          }
        }
        world.addBody(b);
        o.body = b;
        o.h = o.type === 'mover' ? o.size[1] : 0.4;
      }
      return o;
    });
    this.placeObstacles(0);
  }

  placeObstacles(t) {
    for (const o of this.obstacles) {
      if (o.type !== 'mover' && o.type !== 'spinner') continue;
      const p = obstaclePose(o, t), n = obstaclePose(o, t + STEP);
      o.body.position.set(p.x, o.y + o.h / 2, p.z);
      o.body.velocity.set((n.x - p.x) / STEP, 0, (n.z - p.z) / STEP);
      o.body.quaternion.setFromAxisAngle(new CANNON.Vec3(0, 1, 0), -p.angle);
      o.body.angularVelocity.set(0, -(n.angle - p.angle) / STEP, 0);
    }
  }

  addBall(id, offset = 0) {
    const body = new CANNON.Body({
      mass: 1, material: this.ballMat, fixedRotation: true, linearDamping: 0.04,
      collisionFilterGroup: 2, collisionFilterMask: 1,   // balls pass through each other
    });
    body.addShape(new CANNON.Sphere(BALL_R));
    const [sx, sy, sz] = this.layout.start;
    body.position.set(sx + offset, sy, sz);
    this.world.addBody(body);
    const ball = { id, body, state: 'rest', still: 0, rolling: 0, grounded: true, lastRest: body.position.clone(), strokes: 0 };
    body.addEventListener('collide', (e) => this._collide(ball, e));
    this.balls.push(ball);
    return ball;
  }

  _collide(ball, e) {
    const other = e.body;
    const n = e.contact.ni.clone();
    if (e.contact.bi !== ball.body) n.negate(n); // point from the obstacle toward the ball
    const hit = Math.abs(e.contact.getImpactVelocityAlongNormal());
    if (other.isBumper) {
      const kick = new CANNON.Vec3(-n.x, 0, -n.z);
      if (kick.length() > 0.01) {
        kick.normalize();
        ball.body.velocity.vadd(kick.scale(BUMPER_KICK), ball.body.velocity);
      }
      this.onEvent?.('bumper', ball, hit);
    } else if (Math.abs(n.y) < 0.5 && hit > 0.4) this.onEvent?.('wall', ball, hit);
  }

  resetBall(ball, pos) {
    if (!this.world.bodies.includes(ball.body)) this.world.addBody(ball.body);
    ball.body.position.copy(pos);
    ball.body.velocity.setZero();
    ball.state = 'rest'; ball.still = 0; ball.rolling = 0;
    ball.lastRest = ball.body.position.clone();
  }

  // angle 0 putts toward -z ("north" in the grid); power is 0..1
  shoot(ball, angle, power) {
    const v = Math.max(0.03, Math.min(1, power)) * MAX_SPEED;
    ball.body.velocity.set(Math.sin(angle) * v, 0, -Math.cos(angle) * v);
    ball.state = 'moving'; ball.still = 0; ball.rolling = 0;
    ball.strokes++;
  }

  step() {
    this.placeObstacles(this.t);
    this.world.step(STEP);
    this.t += STEP;

    for (const b of this.balls) b.grounded = false;
    for (const c of this.world.contacts) {
      for (const b of this.balls) {
        if (c.bi === b.body && c.ni.y < -0.5) b.grounded = true;
        else if (c.bj === b.body && c.ni.y > 0.5) b.grounded = true;
      }
    }
    for (const b of this.balls) if (b.state === 'moving') this._updateBall(b);
  }

  _updateBall(b) {
    const body = b.body, v = body.velocity, p = body.position;
    b.rolling += STEP;
    if (b.grounded) {
      const hs = Math.hypot(v.x, v.z);
      if (hs > 0) {
        const k = Math.max(0, hs - ROLL_DECEL * STEP) / hs;
        v.x *= k; v.z *= k;
      }
    }

    for (const o of this.obstacles) {
      if (o.type !== 'boost' || !b.grounded) continue;
      const [sw, sd] = o.span || [1, 1];
      if (Math.abs(p.x - o._at[0]) < CELL * sw * 0.48 && Math.abs(p.z - o._at[1]) < CELL * sd * 0.48) {
        const [dx, dz] = RAMP_DIRS[o.dir];
        const along = v.x * dx + v.z * dz, want = o.speed || 9;
        if (along < want) { v.x += dx * (want - along); v.z += dz * (want - along); this.onEvent?.('boost', b, 1); }
      }
    }

    // the cup: a gentle pull near the rim, and the ball drops when it is slow enough
    const [cx, cy, cz] = this.layout.cup;
    const dx = cx - p.x, dz = cz - p.z, dist = Math.hypot(dx, dz), speed = v.length();
    if (Math.abs(p.y - BALL_R - cy) < 0.08) {
      if (dist < CUP_R && speed < SINK_SPEED) {
        b.state = 'sunk';
        this.world.removeBody(body);
        this.onEvent?.('sunk', b, speed);
        return;
      }
      if (dist < CUP_R * 2 && speed < 2.2 && dist > 0.001) {
        v.x += (dx / dist) * 5 * STEP; v.z += (dz / dist) * 5 * STEP;
      }
    }

    if (p.y < this.layout.minTop - 0.6) { b.state = 'out'; this.onEvent?.('out', b, 0); return; }

    if (speed < 0.08 && b.grounded) b.still += STEP; else b.still = 0;
    if (b.still > 0.2 || b.rolling > MAX_ROLL_TIME) {
      v.setZero();
      b.state = 'rest';
      b.lastRest = p.clone();
      this.onEvent?.('rest', b, 0);
    }
  }

  // remaining route length from a point to the cup along the hole's path
  pathDistance(pos) {
    const pts = this.layout.path;
    const remain = new Array(pts.length).fill(0);
    for (let i = pts.length - 2; i >= 0; i--) remain[i] = remain[i + 1] + Math.hypot(pts[i + 1][0] - pts[i][0], pts[i + 1][2] - pts[i][2]);
    let best = Infinity;
    for (let i = 0; i < pts.length; i++) {
      const dy = Math.abs(pos.y - BALL_R - pts[i][1]);
      const d = Math.hypot(pos.x - pts[i][0], pos.z - pts[i][2]) + dy * 6 + remain[i];
      if (d < best) best = d;
    }
    return best;
  }
}
