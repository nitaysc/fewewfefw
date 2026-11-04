// The match: stars to grab, rams that knock stars loose, a clock and a winner.
// The host (or the only phone in solo / same-screen play) runs this; a guest only mirrors it.
import { newCar, stepCar, collideCars } from './car.js';
import { rng, randomSpot } from './world.js';

export const RULES = {
  goal: 20,            // first to this many stars wins
  time: 150,           // seconds, then most stars wins (tie: next star wins)
  stars: 7,            // loose stars on the map
  pickR: 2.9,
  ramSpeed: 11,        // drive into the other car at least this fast to knock stars out
  dropMax: 3,
  countdown: 3,
  bigEvery: 22,        // a big star (worth 3) shows up this often
};

export class Match {
  constructor(world, { seed = 1, rules = {} } = {}) {
    this.world = world;
    this.rules = { ...RULES, ...rules };
    this.R = rng(seed * 9973 + 17);
    this.cars = world.spawns.map((s, i) => newCar(s, i));
    this.scores = [0, 0];
    this.stars = [];
    this.nextStar = 1;
    this.clock = this.rules.time;
    this.phase = 'count';     // count → play → (overtime) → over
    this.t = -this.rules.countdown;
    this.winner = -1;
    this.events = [];          // drained by the caller: fx, sounds, network
    this.bigTimer = this.rules.bigEvery;
    this.ramCool = 0;
    this.stats = [{ rams: 0, stolen: 0 }, { rams: 0, stolen: 0 }];
    for (let i = 0; i < this.rules.stars; i++) this.spawnStar(1);
  }

  spawnStar(value, at, from) {
    const p = at || randomSpot(this.world, this.R, [...this.cars, ...this.stars], 12);
    const s = { id: this.nextStar++, x: p.x, z: p.z, v: value, born: this.t, fx: from ? from.x : p.x, fz: from ? from.z : p.z, ready: from ? this.t + 0.7 : this.t };
    this.stars.push(s);
    return s;
  }

  // step with one input per car; remote[i] = true means that car is driven elsewhere (online)
  step(dt, inputs, remote = [false, false]) {
    this.t += dt;
    const locked = this.phase === 'count' || this.phase === 'over';
    if (this.phase === 'count' && this.t >= 0) { this.phase = 'play'; this.events.push({ k: 'go' }); }

    this.cars.forEach((c, i) => { if (!remote[i]) stepCar(c, inputs[i], this.world, dt, locked); });

    // bumping
    if (this.ramCool > 0) this.ramCool -= dt;
    const [a, b] = this.cars;
    const hit = collideCars(a, b, { moveA: !remote[0], moveB: !remote[1] });
    if (hit && hit.closing > 3) this.events.push({ k: 'bump', x: hit.x, z: hit.z, f: hit.closing });
    if (hit && !locked && this.ramCool <= 0) this.judgeRam(hit.aInto, hit.bInto, hit);

    if (this.phase === 'play' || this.phase === 'overtime') {
      // pick up stars
      for (let k = this.stars.length - 1; k >= 0; k--) {
        const s = this.stars[k];
        if (this.t < s.ready) continue;
        for (let i = 0; i < 2; i++) {
          const c = this.cars[i];
          if (c.y > 4) continue;
          if (Math.hypot(c.x - s.x, c.z - s.z) < this.rules.pickR) {
            this.stars.splice(k, 1);
            this.scores[i] += s.v;
            if (!remote[i]) c.boost = Math.min(100, c.boost + 6 * s.v);
            this.events.push({ k: 'pick', who: i, v: s.v, x: s.x, z: s.z, boost: 6 * s.v });
            break;
          }
        }
      }
      const loose = this.stars.filter((s) => s.v === 1).length;
      if (loose < this.rules.stars && this.R() < dt * 2.5) this.spawnStar(1);
      this.bigTimer -= dt;
      if (this.bigTimer <= 0 && !this.stars.some((s) => s.v === 3)) {
        this.bigTimer = this.rules.bigEvery;
        const s = this.spawnStar(3);
        this.events.push({ k: 'big', x: s.x, z: s.z });
      }

      if (this.phase === 'play') this.clock = Math.max(0, this.clock - dt);
      const [s0, s1] = this.scores;
      const g = this.rules.goal;
      if (s0 >= g || s1 >= g) this.finish(s0 === s1 ? -1 : s0 > s1 ? 0 : 1);
      else if (this.phase === 'play' && this.clock <= 0) {
        if (s0 === s1) { this.phase = 'overtime'; this.events.push({ k: 'overtime' }); this.otBase = s0; }
        else this.finish(s0 > s1 ? 0 : 1);
      } else if (this.phase === 'overtime' && s0 !== s1) this.finish(s0 > s1 ? 0 : 1);
    }
  }

  // who rammed whom: the one driving into the other harder, by a margin
  judgeRam(aInto, bInto, hit) {
    const r = this.rules.ramSpeed;
    let attacker = -1;
    if (aInto > r && aInto > bInto + 4) attacker = 0;
    else if (bInto > r && bInto > aInto + 4) attacker = 1;
    if (attacker < 0) return;
    this.ram(attacker, Math.max(aInto, bInto), hit);
  }

  ram(attacker, force, at) {
    const victim = 1 - attacker;
    const v = this.cars[victim];
    this.ramCool = 1.2;
    v.spin = 0.9;
    const n = Math.min(this.scores[victim], force > 24 ? this.rules.dropMax : force > 17 ? 2 : 1);
    this.scores[victim] -= n;
    this.stats[attacker].rams++;
    this.stats[attacker].stolen += n;
    const dropped = [];
    for (let i = 0; i < n; i++) {
      const ang = this.R() * Math.PI * 2;
      const dist = 6 + this.R() * 6;
      let to = { x: v.x + Math.cos(ang) * dist, z: v.z + Math.sin(ang) * dist };
      if (!isClear(this.world, to)) to = { x: v.x, z: v.z };
      dropped.push(this.spawnStar(1, to, v).id);
    }
    this.events.push({ k: 'ram', attacker, victim, n, x: at.x, z: at.z, force });
  }

  finish(winner) {
    if (this.phase === 'over') return;
    this.phase = 'over';
    this.winner = winner;
    this.events.push({ k: 'over', winner });
  }

  // what a guest needs to draw the match (cars travel separately)
  snapshot() {
    return {
      ph: this.phase, t: round(this.t), c: round(this.clock), sc: this.scores.slice(), w: this.winner,
      st: this.stars.map((s) => [s.id, round(s.x), round(s.z), s.v, round(s.born), round(s.fx), round(s.fz), round(s.ready)]),
      stats: this.stats,
    };
  }
}

// the same shape, rebuilt from a snapshot on the guest
export function applySnapshot(view, snap) {
  view.phase = snap.ph; view.t = snap.t; view.clock = snap.c; view.scores = snap.sc; view.winner = snap.w; view.stats = snap.stats;
  view.stars = snap.st.map(([id, x, z, v, born, fx, fz, ready]) => ({ id, x, z, v, born, fx, fz, ready }));
}

const round = (v) => Math.round(v * 100) / 100;

function isClear(world, p) {
  if (Math.abs(p.x) > world.HALF - 4 || Math.abs(p.z) > world.HALF - 4) return false;
  for (const b of world.boxes) if (p.x > b.x0 - 2 && p.x < b.x1 + 2 && p.z > b.z0 - 2 && p.z < b.z1 + 2) return false;
  for (const c of world.circles) if (Math.hypot(p.x - c.x, p.z - c.z) < c.r + 2) return false;
  return true;
}
