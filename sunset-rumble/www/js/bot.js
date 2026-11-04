// A bot driver: grabs stars, rams you when you're carrying a lot, and finds its way
// round buildings using the road intersections as waypoints.
import { clearLine } from './world.js';

export const SKILL = {
  easy: { speed: 0.72, aggro: 0.25, reaction: 0.35, boost: 0.2 },
  normal: { speed: 0.88, aggro: 0.5, reaction: 0.2, boost: 0.5 },
  hard: { speed: 1, aggro: 0.8, reaction: 0.08, boost: 0.9 },
};

export class Bot {
  constructor(world, me, skill = 'normal') {
    this.world = world;
    this.me = me;
    this.k = SKILL[skill] || SKILL.normal;
    this.goal = null;
    this.path = [];
    this.think = 0;
    this.stuck = 0;
    this.reverse = 0;
    this.lastPos = null;
    this.input = { steer: 0, throttle: 0, drift: false, boost: false };
  }

  update(dt, match) {
    const car = match.cars[this.me];
    const foe = match.cars[1 - this.me];
    const inp = this.input;

    // stuck against something? back up for a moment
    this.stuck = car.speed < 2.5 && match.phase !== 'count' ? this.stuck + dt : 0;
    if (this.stuck > 0.8) { this.reverse = 0.9; this.stuck = 0; this.revSteer = Math.random() < 0.5 ? -1 : 1; }
    if (this.reverse > 0) {
      this.reverse -= dt;
      inp.throttle = -1; inp.steer = this.revSteer; inp.drift = false; inp.boost = false;
      return inp;
    }

    this.think -= dt;
    if (this.think <= 0 || !this.goal) {
      this.think = this.k.reaction + 0.15;
      this.pickGoal(match, car, foe);
    }
    // follow the path; skip ahead when the next point is in sight
    let tgt = this.goal;
    while (this.path.length) {
      const p = this.path[0];
      if (Math.hypot(p.x - car.x, p.z - car.z) < 7) { this.path.shift(); continue; }
      if (this.path.length > 1 || this.goal) {
        const after = this.path[1] || this.goal;
        if (after && clearLine(this.world, car.x, car.z, after.x, after.z)) { this.path.shift(); continue; }
      }
      tgt = p; break;
    }
    if (this.goal && this.goal.chase) { tgt = !this.path.length ? lead(car, foe) : tgt; }

    const dx = tgt.x - car.x, dz = tgt.z - car.z;
    const want = Math.atan2(dx, dz);
    let diff = wrap(want - car.h);
    const dist = Math.hypot(dx, dz);
    // steering right lowers h, so a positive diff means steer left (negative)
    inp.steer = clamp(-diff * 2.2, -1, 1);
    const sharp = Math.abs(diff);
    inp.throttle = (sharp > 1.6 && car.speed > 14 ? 0.2 : 1) * this.k.speed;
    if (sharp > 2.4 && dist < 14) inp.throttle = -0.6;   // it's behind: back round
    inp.drift = sharp > 0.7 && sharp < 2 && car.speed > 20;
    const straight = sharp < 0.18 && dist > 30;
    inp.boost = car.boost > 30 && (straight && Math.random() < this.k.boost * 0.3 || (this.goal.chase && dist < 25 && sharp < 0.25));
    return inp;
  }

  pickGoal(match, car, foe) {
    const scores = match.scores;
    const foeRich = scores[1 - this.me] >= 3 && foe.spin <= 0;
    const foeDist = Math.hypot(foe.x - car.x, foe.z - car.z);
    let best = null, bestScore = Infinity;
    for (const s of match.stars) {
      const d = Math.hypot(s.x - car.x, s.z - car.z);
      // stars ahead are cheaper than ones behind
      const ang = Math.abs(wrap(Math.atan2(s.x - car.x, s.z - car.z) - car.h));
      const foeD = Math.hypot(s.x - foe.x, s.z - foe.z);
      const cost = d * (1 + ang * 0.35) / s.v + (foeD < d * 0.6 ? 25 : 0);
      if (cost < bestScore) { bestScore = cost; best = s; }
    }
    const chase = foeRich && foeDist < 55 && Math.random() < this.k.aggro + scores[1 - this.me] * 0.03;
    const goal = chase || !best ? { x: foe.x, z: foe.z, chase: true } : { x: best.x, z: best.z };
    this.goal = goal;
    this.path = clearLine(this.world, car.x, car.z, goal.x, goal.z) ? [] : route(this.world, car, goal);
  }
}

function lead(car, foe) {
  const t = Math.min(0.8, Math.hypot(foe.x - car.x, foe.z - car.z) / 40);
  return { x: foe.x + foe.vx * t, z: foe.z + foe.vz * t };
}

// shortest road route between the nearest visible intersections (Dijkstra on a tiny graph)
export function route(world, from, to) {
  const { nodes, links } = world;
  const near = (p) => {
    let bi = -1, bd = Infinity;
    nodes.forEach((n, i) => {
      const d = Math.hypot(n.x - p.x, n.z - p.z);
      if (d < bd && clearLine(world, p.x, p.z, n.x, n.z, 1.5)) { bd = d; bi = i; }
    });
    if (bi < 0) nodes.forEach((n, i) => { const d = Math.hypot(n.x - p.x, n.z - p.z); if (d < bd) { bd = d; bi = i; } });
    return bi;
  };
  const s = near(from), e = near(to);
  const dist = nodes.map(() => Infinity), prev = nodes.map(() => -1), done = nodes.map(() => false);
  dist[s] = 0;
  for (;;) {
    let u = -1;
    for (let i = 0; i < nodes.length; i++) if (!done[i] && dist[i] < Infinity && (u < 0 || dist[i] < dist[u])) u = i;
    if (u < 0 || u === e) break;
    done[u] = true;
    for (const v of links[u]) {
      const w = dist[u] + Math.hypot(nodes[u].x - nodes[v].x, nodes[u].z - nodes[v].z);
      if (w < dist[v]) { dist[v] = w; prev[v] = u; }
    }
  }
  const path = [];
  for (let u = e; u >= 0; u = prev[u]) path.unshift(nodes[u]);
  return path;
}

const wrap = (a) => { while (a > Math.PI) a -= Math.PI * 2; while (a < -Math.PI) a += Math.PI * 2; return a; };
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
