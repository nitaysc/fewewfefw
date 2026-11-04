// Arcade car physics on a flat town with ramps. No three.js here.
// Heading h: forward is (sin h, cos h) on (x, z). Steering right lowers h.
import { HALF, groundAt, surfaceAt, padAt } from './world.js';

export const CAR_R = 1.7;           // cars collide as circles
export const MAX_SPEED = 34;        // m/s on the road
export const BOOST_SPEED = 50;
export const GRAVITY = 32;

export function newCar(spawn, id = 0) {
  return {
    id,
    x: spawn.x, z: spawn.z, y: 0, vy: 0, h: spawn.h,
    vx: 0, vz: 0, yaw: 0,
    grounded: true, air: 0,
    boost: 50,            // meter, 0..100
    boosting: false,
    drifting: false, driftTime: 0, driftDir: 0,
    turbo: 0,             // short burst after a long drift
    spin: 0,              // seconds of spin-out after being rammed
    steer: 0,             // smoothed steer, for the front wheels
    bump: 0,              // last impact strength, read and cleared by the renderer/sound
    landed: 0,            // last landing strength
    padCool: 0,
    surface: 'road',
    speed: 0,
  };
}

export const emptyInput = () => ({ steer: 0, throttle: 0, drift: false, boost: false });

export function stepCar(car, input, world, dt, locked = false) {
  const inp = locked || car.spin > 0 ? emptyInput() : input;
  const s = Math.sin(car.h), c = Math.cos(car.h);
  // forward and the driver's right
  const fx = s, fz = c, rx = -c, rz = s;
  let vf = car.vx * fx + car.vz * fz;
  let vl = car.vx * rx + car.vz * rz;

  car.surface = surfaceAt(world, car.x, car.z);
  const rough = car.surface === 'grass' ? 0.82 : car.surface === 'sand' ? 0.72 : 1;

  // boost: hold the button to burn the meter
  car.boosting = !!inp.boost && car.boost > 0 && car.grounded !== null;
  if (car.boosting) car.boost = Math.max(0, car.boost - 34 * dt);
  if (car.turbo > 0) car.turbo -= dt;
  const fast = car.boosting || car.turbo > 0;
  const top = (fast ? BOOST_SPEED : MAX_SPEED) * rough;

  if (car.grounded) {
    // engine and brakes
    const thr = inp.throttle;
    if (thr > 0.05) {
      const acc = (fast ? 40 : 26) * thr;
      if (vf < top) vf += acc * dt * Math.max(0.25, 1 - vf / top);
      else vf += (top - vf) * Math.min(1, 2 * dt);  // ease back down after a pad
    } else if (thr < -0.05) {
      if (vf > 1) vf -= 50 * -thr * dt;              // brake
      else vf = Math.max(-14, vf - 18 * -thr * dt);  // reverse
    } else {
      vf -= vf * 0.9 * dt;                            // coast
    }
    if (fast && thr <= 0.05) vf += 30 * dt;           // boost pushes even without gas
    if (vf > top + 0.5 && !fast) vf += (top - vf) * Math.min(1, 1.5 * dt);

    // drifting: hold the button while turning at speed
    const wantDrift = inp.drift && Math.abs(vf) > 10 && (Math.abs(inp.steer) > 0.2 || car.drifting);
    if (wantDrift && !car.drifting) { car.drifting = true; car.driftTime = 0; car.driftDir = Math.sign(inp.steer) || 1; }
    if (!wantDrift && car.drifting) {
      // a long drift pays out a little turbo
      if (car.driftTime > 0.9) car.turbo = Math.min(1.4, 0.4 + car.driftTime * 0.4);
      car.drifting = false;
    }
    if (car.drifting) {
      car.driftTime += dt;
      car.boost = Math.min(100, car.boost + 16 * dt);
    }

    // steering: needs some speed; drifting swings the tail out
    car.steer += (inp.steer - car.steer) * Math.min(1, 10 * dt);
    const speedK = Math.min(1, Math.abs(vf) / 9) * (1 - Math.min(0.35, Math.abs(vf) / 140));
    let turn = 2.5 * speedK;
    let st = car.steer;
    if (car.drifting) { turn *= 1.25; st = car.driftDir * 0.55 + car.steer * 0.6; }
    const targetYaw = -st * turn * Math.sign(vf || 1);
    car.yaw += (targetYaw - car.yaw) * Math.min(1, (car.drifting ? 5 : 12) * dt);

    // tyre grip pulls sideways speed back into line
    const grip = car.drifting ? 1.4 : 9 * rough;
    vl *= Math.exp(-grip * dt);
    if (car.drifting) vf -= vf * 0.18 * dt;
  } else {
    car.yaw *= Math.exp(-1.5 * dt);
    car.air += dt;
  }

  if (car.spin > 0) {
    car.spin -= dt;
    car.yaw = 11 * Math.max(0, car.spin);   // spin out, slowing down
    vf *= Math.exp(-2 * dt);
    vl *= Math.exp(-3 * dt);
  }

  car.h += car.yaw * dt;
  const s2 = Math.sin(car.h), c2 = Math.cos(car.h);
  // velocity stays put in the world while the body turns, then grip realigns it next step
  car.vx = fx * vf + rx * vl;
  car.vz = fz * vf + rz * vl;
  // keep most of the speed pointing where the car now faces (arcade feel)
  if (car.grounded && car.spin <= 0) {
    const a = car.yaw * dt * (car.drifting ? 0.45 : 0.8);
    const ca = Math.cos(a), sa = Math.sin(a);
    // rotating the vector (vx, vz) the same way the heading turned
    const vx = car.vx * ca + car.vz * sa;
    const vz = -car.vx * sa + car.vz * ca;
    car.vx = vx; car.vz = vz;
  }

  // boost pads
  if (car.padCool > 0) car.padCool -= dt;
  const pad = car.grounded && padAt(world, car.x, car.z);
  if (pad && car.padCool <= 0) {
    const ps = Math.sin(pad.ang), pc = Math.cos(pad.ang);
    const sp = Math.max(Math.hypot(car.vx, car.vz), 10);
    const aligned = (s2 * ps + c2 * pc) > -0.2;
    if (aligned) {
      const boostTo = Math.max(sp, BOOST_SPEED * 1.05);
      car.vx = s2 * boostTo; car.vz = c2 * boostTo;
      car.turbo = Math.max(car.turbo, 0.8);
      car.padCool = 0.6;
      car.padHit = true;
    }
  }

  // move
  const px = car.x, pz = car.z;
  car.x += car.vx * dt;
  car.z += car.vz * dt;

  // vertical: ramps lift the car, leaving one makes it fly
  const g = groundAt(world, car.x, car.z);
  if (car.grounded) {
    if (g > car.y + 0.7) {
      // that's the tall back of a ramp: treat it like a wall
      car.x = px; car.z = pz;
      const k = -0.3;
      car.vx *= k; car.vz *= k;
      car.bump = Math.max(car.bump, 8);
    } else if (g < car.y - 0.05) {
      car.grounded = false; car.air = 0;   // off the lip: keep the climb speed
    } else {
      car.vy = (g - car.y) / dt;
      car.y = g;
    }
  }
  if (!car.grounded) {
    car.vy -= GRAVITY * dt;
    car.y += car.vy * dt;
    if (car.y <= g) {
      car.landed = Math.max(car.landed, -car.vy);
      car.y = g; car.vy = 0; car.grounded = true;
      if (car.air > 0.35) car.boost = Math.min(100, car.boost + 10); // air time feeds the meter
    }
  }

  // walls and buildings (only while low enough to hit them)
  collideWorld(car, world);
  car.speed = Math.hypot(car.vx, car.vz);
  return car;
}

function hitNormal(car, nx, nz, pen) {
  car.x += nx * pen;
  car.z += nz * pen;
  const vn = car.vx * nx + car.vz * nz;
  if (vn < 0) {
    car.vx -= 1.35 * vn * nx;
    car.vz -= 1.35 * vn * nz;
    car.vx *= 0.9; car.vz *= 0.9;
    car.bump = Math.max(car.bump, -vn);
    if (car.drifting && -vn > 8) car.drifting = false;
  }
}

export function collideWorld(car, world) {
  const r = CAR_R;
  const lim = HALF - r;
  if (car.x > lim) hitNormal(car, -1, 0, car.x - lim);
  if (car.x < -lim) hitNormal(car, 1, 0, -lim - car.x);
  if (car.z > lim) hitNormal(car, 0, -1, car.z - lim);
  if (car.z < -lim) hitNormal(car, 0, 1, -lim - car.z);
  for (const b of world.boxes) {
    if (car.y > b.h) continue;
    if (car.x < b.x0 - r || car.x > b.x1 + r || car.z < b.z0 - r || car.z > b.z1 + r) continue;
    const cx = Math.max(b.x0, Math.min(car.x, b.x1));
    const cz = Math.max(b.z0, Math.min(car.z, b.z1));
    let dx = car.x - cx, dz = car.z - cz;
    let d = Math.hypot(dx, dz);
    if (d === 0) {
      // centre inside the box: push out the shortest way
      const opts = [[car.x - b.x0, -1, 0], [b.x1 - car.x, 1, 0], [car.z - b.z0, 0, -1], [b.z1 - car.z, 0, 1]];
      opts.sort((a, q) => a[0] - q[0]);
      const [p, nx, nz] = opts[0];
      hitNormal(car, nx, nz, p + r);
      continue;
    }
    if (d < r) hitNormal(car, dx / d, dz / d, r - d);
  }
  for (const o of world.circles) {
    if (car.y > 3 && o.kind !== 'wheel' && o.kind !== 'palm') continue;
    const dx = car.x - o.x, dz = car.z - o.z;
    const d = Math.hypot(dx, dz) || 0.001;
    const rr = r + o.r;
    if (d < rr) hitNormal(car, dx / d, dz / d, rr - d);
  }
}

// Two cars bump. Returns how hard each drove into the other, so the rules can decide who got rammed.
export function collideCars(a, b, { moveA = true, moveB = true } = {}) {
  const dx = b.x - a.x, dz = b.z - a.z;
  const d = Math.hypot(dx, dz);
  const rr = CAR_R * 2;
  if (d >= rr || d === 0 || Math.abs(a.y - b.y) > 2) return null;
  const nx = dx / d, nz = dz / d;
  const aInto = a.vx * nx + a.vz * nz;        // a's speed towards b
  const bInto = -(b.vx * nx + b.vz * nz);     // b's speed towards a
  const pen = rr - d;
  const share = moveA && moveB ? 0.5 : 1;
  if (moveA) { a.x -= nx * pen * share; a.z -= nz * pen * share; }
  if (moveB) { b.x += nx * pen * share; b.z += nz * pen * share; }
  const closing = aInto + bInto;
  if (closing > 0) {
    // equal masses, a bit bouncy; the impulse goes along the line between them
    const j = closing * 0.85;
    if (moveA) { a.vx -= nx * j; a.vz -= nz * j; a.bump = Math.max(a.bump, closing); }
    if (moveB) { b.vx += nx * j; b.vz += nz * j; b.bump = Math.max(b.bump, closing); }
  }
  return { aInto, bInto, closing, x: (a.x + b.x) / 2, z: (a.z + b.z) / 2 };
}

// a compact state for the network: [x, z, y, h, vx, vz, vy, flags, steer, boost]
export function packCar(c) {
  const f = (c.drifting ? 1 : 0) | (c.boosting || c.turbo > 0 ? 2 : 0) | (c.grounded ? 4 : 0) | (c.spin > 0 ? 8 : 0);
  return [r2(c.x), r2(c.z), r2(c.y), r3(c.h), r2(c.vx), r2(c.vz), r2(c.vy), f, r2(c.steer), Math.round(c.boost)];
}
export function unpackCar(c, a) {
  [c.x, c.z, c.y, c.h, c.vx, c.vz, c.vy] = a;
  c.drifting = !!(a[7] & 1); c.boosting = !!(a[7] & 2); c.grounded = !!(a[7] & 4); c.spinning = !!(a[7] & 8);
  c.steer = a[8]; c.boost = a[9];
  c.speed = Math.hypot(c.vx, c.vz);
  return c;
}
const r2 = (v) => Math.round(v * 100) / 100;
const r3 = (v) => Math.round(v * 1000) / 1000;
