// The ride-on mower's driving model: a bicycle model with a governed engine, blades that
// load the engine in long grass, collisions that slide along the plan's solids, and a
// sprung body that follows the ground under its four wheels.
import * as THREE from '../../vendor/three.module.js';
import { clamp, damp, noise2 } from '../core/util.js';
import { heightAt, START } from '../world/layout.js';

export const DIM = {
  wheelbase: 1.4, rearZ: 0.55, frontZ: -0.85, rearTrack: 1.02, frontTrack: 0.88,
  rearR: 0.31, frontR: 0.215,
  deckZ: -0.12, deckR: 0.62,               // cutting width 1.24 m
  eye: new THREE.Vector3(0, 1.39, 0.22),
};
const MAX_STEER = 0.6;
const PROBES = [[-0.6, -1.22], [0.6, -1.22], [-0.62, -0.4], [0.62, -0.4], [-0.62, 0.45], [0.62, 0.45], [-0.55, 1.02], [0.55, 1.02], [0, -1.3], [0, 1.08]];

export class Vehicle {
  constructor(plan) {
    this.plan = plan;
    this.reset();
    this.events = [];
  }
  reset(x = START.x, z = START.z, heading = START.heading) {
    this.x = x; this.z = z; this.heading = heading;
    this.v = 0; this.steer = 0; this.steerInput = 0;
    this.y = heightAt(x, z); this.vy = 0;
    this.pitch = 0; this.roll = 0; this.pitchV = 0; this.rollV = 0;
    this.rpm = 1100; this.load = 0; this.throttle = 0;
    this.wheelSpin = 0; this.frontSpin = 0;
    this.surface = 'grass';
    this.deck = new THREE.Vector2(); this.prevDeck = null;
    this.odometer = 0;
  }
  get fx() { return -Math.sin(this.heading); }
  get fz() { return -Math.cos(this.heading); }
  // local (lx right, lz back) -> world xz
  toWorld(lx, lz, out) {
    const c = Math.cos(this.heading), s = Math.sin(this.heading);
    out.x = this.x + c * lx + s * lz;
    out.y = this.z - s * lx + c * lz;
    return out;
  }

  update(dt, ctl, cutLoad, bladesOn) {
    // ---- steering ----
    const speed = Math.abs(this.v);
    this.steerInput = ctl.steer;
    const target = ctl.steer * MAX_STEER * (1 - 0.3 * clamp(speed / 5));
    const rate = ctl.steer !== 0 ? 2.6 : 3.6;
    const ds = target - this.steer;
    this.steer += clamp(ds, -rate * dt, rate * dt);

    // ---- drive ----
    const load = bladesOn ? cutLoad : 0;
    this.load = damp(this.load, load, 4, dt);
    const vMax = (ctl.boost ? 5.3 : 3.2) * (1 - 0.3 * this.load) * (bladesOn ? 0.92 : 1);
    let tgt = 0, acc = 1.6;
    const th = ctl.throttle;
    if (th > 0.05) {
      if (this.v < -0.05) { tgt = 0; acc = 4.5; } else { tgt = th * vMax; acc = ctl.boost ? 1.7 : 1.3; }
    } else if (th < -0.05) {
      if (this.v > 0.12) { tgt = 0; acc = 4.8; } else { tgt = th * 1.7; acc = 1.3; }
    } else {
      tgt = 0; acc = 1.9;
    }
    const dv = tgt - this.v;
    this.v += clamp(dv, -acc * dt, acc * dt);
    // gravity along slopes
    this.v -= 9.81 * Math.sin(this.pitch) * dt * 0.35;

    // ---- heading & position: kinematic bicycle about the rear axle ----
    const ox = this.x, oz = this.z;
    const back = DIM.rearZ;
    let rx = this.x - this.fx * back, rz = this.z - this.fz * back;
    rx += this.fx * this.v * dt; rz += this.fz * this.v * dt;
    this.heading -= (this.v / DIM.wheelbase) * Math.tan(this.steer) * dt;
    this.x = rx + this.fx * back; this.z = rz + this.fz * back;
    this.collide(dt);
    const moved = Math.hypot(this.x - ox, this.z - oz);
    this.odometer += moved;
    this.wheelSpin += (moved * Math.sign(this.v)) / DIM.rearR;
    this.frontSpin += (moved * Math.sign(this.v)) / DIM.frontR;

    // ---- body on the ground ----
    const p = new THREE.Vector2();
    const hAt = (lx, lz) => { this.toWorld(lx, lz, p); return heightAt(p.x, p.y); };
    const fl = hAt(-DIM.frontTrack / 2, DIM.frontZ), fr = hAt(DIM.frontTrack / 2, DIM.frontZ);
    const rl = hAt(-DIM.rearTrack / 2, DIM.rearZ), rr = hAt(DIM.rearTrack / 2, DIM.rearZ);
    // small bumps the wheels feel on the lawn
    const bump = (noise2(this.x * 1.7, this.z * 1.7) * 0.012 + noise2(this.x * 4.1, this.z * 4.3) * 0.006) * (this.surface === 'gravel' ? 1.6 : 1);
    const yT = (fl + fr + rl + rr) / 4 + bump;
    const pitchT = Math.atan2((fl + fr) / 2 - (rl + rr) / 2, DIM.wheelbase);
    const rollT = Math.atan2((fr + rr) / 2 - (fl + rl) / 2, (DIM.frontTrack + DIM.rearTrack) / 2);
    // critically damped-ish springs (suspension is just the tyres on a ride-on)
    const k = 160, c = 18;
    this.vy += ((yT - this.y) * k - this.vy * c) * dt; this.y += this.vy * dt;
    this.pitchV += ((pitchT - this.pitch) * k - this.pitchV * c) * dt; this.pitch += this.pitchV * dt;
    this.rollV += ((rollT - this.roll) * k - this.rollV * c) * dt; this.roll += this.rollV * dt;

    // ---- engine ----
    const gov = 1100 + 2200 * clamp(Math.abs(th) * (ctl.boost ? 1 : 0.78) + (bladesOn ? 0.18 : 0));
    const rpmT = gov - this.load * 650 + speed * 40;
    this.rpm = damp(this.rpm, rpmT, 3.2, dt);
    this.throttle = th;

    // ---- surface underneath ----
    const s = this.plan.surface(this.x, this.z);
    this.surface = s.gravel > 0.5 ? 'gravel' : s.paving > 0.5 ? 'stone' : 'grass';

    // ---- the deck's swept path ----
    this.toWorld(0, DIM.deckZ, this.deck);
  }

  collide(dt) {
    const p = new THREE.Vector2();
    const e = 0.15;
    let hitN = null, hitDepth = 0;
    for (let it = 0; it < 3; it++) {
      let px = 0, pz = 0, any = false;
      for (const [lx, lz] of PROBES) {
        this.toWorld(lx, lz, p);
        const d = this.plan.sdf(p.x, p.y);
        if (d >= 0) continue;
        let nx = this.plan.sdf(p.x + e, p.y) - this.plan.sdf(p.x - e, p.y);
        let nz = this.plan.sdf(p.x, p.y + e) - this.plan.sdf(p.x, p.y - e);
        const l = Math.hypot(nx, nz) || 1; nx /= l; nz /= l;
        if (-d > hitDepth) { hitDepth = -d; hitN = [nx, nz]; }
        px += nx * -d; pz += nz * -d; any = true;
      }
      if (!any) break;
      // move out by the strongest correction (averaging would under-correct corners)
      const l = Math.hypot(px, pz);
      const m = Math.min(l, 0.5);
      this.x += (px / l) * m; this.z += (pz / l) * m;
    }
    if (hitN) {
      const into = -(this.fx * hitN[0] + this.fz * hitN[1]) * this.v;
      if (into > 0.05) {
        if (into > 0.7) this.events.push({ type: 'bump', strength: clamp(into / 3) });
        this.v *= 0.35;
      }
    }
  }

  // world transform for the body (y from the springs, yaw/pitch/roll)
  applyTo(obj) {
    obj.position.set(this.x, this.y, this.z);
    obj.rotation.set(this.pitch, this.heading, this.roll, 'YXZ');
  }
}
