// Browser preview of the Stage 1 placeholder bike + rider. This is a line-for-line port of
// MeshBuilder.cs, BikeVisual.cs and RiderVisual.cs (Unity space, left-handed; the root is
// mirrored on Z for three.js), posed from simulation states dumped by
// `dotnet run -c Release --project roost-mx/Tests -- pose` (out/poses.json).
import * as THREE from 'three';

const D2R = Math.PI / 180;
const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const add = (...vs) => vs.reduce((a, b) => a.clone().add(b));
const mul = (v, s) => v.clone().multiplyScalar(s);
const cross = (a, b) => V(a.y * b.z - a.z * b.y, a.z * b.x - a.x * b.z, a.x * b.y - a.y * b.x);
const Q = (x, y, z, w) => new THREE.Quaternion(x, y, z, w);
const qmul = (a, b) => a.clone().multiply(b);           // Hamilton product, same as Unity a*b
const rot = (q, v) => v.clone().applyQuaternion(q);
function angleAxis(deg, axis) { const a = axis.clone().normalize(), h = deg * D2R / 2, s = Math.sin(h); return Q(a.x * s, a.y * s, a.z * s, Math.cos(h)); }
function euler(x, y, z) { return qmul(qmul(angleAxis(y, V(0, 1, 0)), angleAxis(x, V(1, 0, 0))), angleAxis(z, V(0, 0, 1))); }
function lookRotation(f, up = V(0, 1, 0)) {
  const z = f.clone().normalize(); let x = cross(up, z); if (x.lengthSq() < 1e-8) x = cross(V(1, 0, 0), z); x.normalize();
  const y = cross(z, x);
  const m = new THREE.Matrix4().makeBasis(x, y, z); return new THREE.Quaternion().setFromRotationMatrix(m);
}
function fromTo(a, b) { return new THREE.Quaternion().setFromUnitVectors(a.clone().normalize(), b.clone().normalize()); }
const ID = () => Q(0, 0, 0, 1);

class MB {
  constructor() { this.v = []; this.n = []; this.t = []; }
  pushV(p, n) { this.v.push(p.x, p.y, p.z); this.n.push(n.x, n.y, n.z); return this.v.length / 3 - 1; }
  quad(a, b, c, d) { this.t.push(a, b, c, a, c, d); }
  build() {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.v, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.n, 3));
    g.setIndex(this.t); return g;
  }
  torus(major, minor, seg = 40, side = 12, knobs = 0, knobCount = 0) {
    const s0 = this.v.length / 3;
    for (let i = 0; i <= seg; i++) {
      const a = i / seg * Math.PI * 2, dir = V(0, Math.cos(a), Math.sin(a));
      for (let j = 0; j <= side; j++) {
        const b = j / side * Math.PI * 2;
        const local = add(mul(dir, Math.cos(b)), mul(V(1, 0, 0), Math.sin(b)));
        let r = minor;
        if (knobCount > 0) {
          const tread = Math.min(1, Math.max(0, Math.cos(b) * 1.4));
          const block = Math.sin(a * knobCount) > 0.15 ? 1 : 0;
          const shoulder = Math.abs(Math.sin(b)) > 0.55 && Math.sin(a * knobCount + 1.6) > 0.3 ? 0.7 : 0;
          r += knobs * Math.max(block * tread, shoulder * (1 - tread));
        }
        this.pushV(add(mul(dir, major), mul(local, r)), local);
      }
    }
    for (let i = 0; i < seg; i++) for (let j = 0; j < side; j++) { const a0 = s0 + i * (side + 1) + j, a1 = a0 + side + 1; this.quad(a0, a1, a1 + 1, a0 + 1); }
    return this;
  }
  tube(p0, p1, r0, r1 = -1, seg = 10, caps = true) {
    if (r1 < 0) r1 = r0;
    let axis = p1.clone().sub(p0); const len = axis.length(); if (len < 1e-5) return this; axis.divideScalar(len);
    const sideV = cross(axis, Math.abs(axis.y) < 0.9 ? V(0, 1, 0) : V(1, 0, 0)).normalize(), up = cross(sideV, axis);
    const s0 = this.v.length / 3;
    for (let i = 0; i <= seg; i++) {
      const a = i / seg * Math.PI * 2, d = add(mul(sideV, Math.cos(a)), mul(up, Math.sin(a)));
      this.pushV(add(p0, mul(d, r0)), d); this.pushV(add(p1, mul(d, r1)), d);
    }
    for (let i = 0; i < seg; i++) { const a = s0 + i * 2; this.quad(a, a + 1, a + 3, a + 2); }
    if (caps) { this.cap(p0, mul(axis, -1), sideV, up, r0, seg); this.cap(p1, axis, sideV, up, r1, seg); }
    return this;
  }
  cap(c, normal, sideV, up, r, seg) {
    const centre = this.pushV(c, normal);
    for (let i = 0; i <= seg; i++) { const a = i / seg * Math.PI * 2; this.pushV(add(c, mul(add(mul(sideV, Math.cos(a)), mul(up, Math.sin(a))), r)), normal); }
    for (let i = 0; i < seg; i++) this.t.push(centre, centre + i + 1, centre + i + 2);
  }
  box(c, half, q) {
    for (const d of [V(1, 0, 0), V(-1, 0, 0), V(0, 1, 0), V(0, -1, 0), V(0, 0, 1), V(0, 0, -1)]) {
      let a = Math.abs(d.y) > 0.5 ? V(1, 0, 0) : V(0, 1, 0); const b = cross(d, a); a = cross(b, d);
      const s = this.v.length / 3;
      for (let k = 0; k < 4; k++) {
        const sx = (k === 0 || k === 3) ? -1 : 1, sy = k < 2 ? -1 : 1;
        const p = add(d, mul(a, sx), mul(b, sy)).multiply(half);
        this.pushV(add(c, rot(q, p)), rot(q, d));
      }
      this.t.push(s, s + 1, s + 2, s, s + 2, s + 3);
    }
    return this;
  }
  ellipsoid(c, radii, seg = 16, rings = 10) {
    const s0 = this.v.length / 3;
    for (let r = 0; r <= rings; r++) {
      const phi = r / rings * Math.PI;
      for (let s = 0; s <= seg; s++) {
        const th = s / seg * Math.PI * 2;
        const d = V(Math.sin(phi) * Math.cos(th), Math.cos(phi), Math.sin(phi) * Math.sin(th));
        this.pushV(add(c, d.clone().multiply(radii)), V(d.x / radii.x, d.y / radii.y, d.z / radii.z).normalize());
      }
    }
    for (let r = 0; r < rings; r++) for (let s = 0; s < seg; s++) { const a = s0 + r * (seg + 1) + s, b = a + seg + 1; this.quad(a, a + 1, b + 1, b); }
    return this;
  }
  disc(c, rOuter, rInner, th, seg = 24) {
    for (let i = 0; i < seg; i++) {
      const a0 = i / seg * Math.PI * 2, a1 = (i + 1) / seg * Math.PI * 2, am = (a0 + a1) / 2;
      const dir = V(0, Math.cos(am), Math.sin(am)), w = (rOuter - rInner) / 2, l = rOuter * (a1 - a0) / 2;
      this.box(add(c, mul(dir, rInner + w)), V(th / 2, w, l), lookRotation(cross(dir, V(1, 0, 0)), dir));
    }
    return this;
  }
}

const mats = {};
function lit(hex, smooth = 0.35, metal = 0) {
  const k = `${hex}_${smooth}_${metal}`;
  return mats[k] ??= new THREE.MeshStandardMaterial({ color: new THREE.Color().setRGB(hex[0], hex[1], hex[2], THREE.SRGBColorSpace), roughness: 1 - smooth, metalness: metal, side: THREE.DoubleSide });
}
function node(name, parent, pos = V(), q = ID()) { const o = new THREE.Object3D(); o.name = name; o.position.copy(pos); o.quaternion.copy(q); parent.add(o); return o; }
function part(name, parent, mb, mat, pos = V(), q = ID()) {
  const m = new THREE.Mesh(mb.build(), mat); m.name = name; m.position.copy(pos); m.quaternion.copy(q); m.castShadow = m.receiveShadow = true; parent.add(m); return m;
}
const vec = a => V(a[0], a[1], a[2]);

// ------------------------------------------------------------------------------ BikeVisual
function buildBike(root, spec, pose, pal) {
  const plastic = lit(pal.plastic, 0.55), dark = lit(pal.dark, 0.4), frameM = lit(pal.frame, 0.6, 0.6);
  const alu = lit([0.72, 0.73, 0.75], 0.7, 0.9), anod = lit([0.85, 0.62, 0.15], 0.75, 0.9), rubber = lit([0.06, 0.06, 0.06], 0.15);
  const seatM = lit(pal.seat, 0.25), engineM = lit([0.22, 0.22, 0.24], 0.45, 0.7), pipeM = lit([0.55, 0.45, 0.38], 0.6, 0.95), white = lit(pal.graphic, 0.5);
  const rearAxle = vec(spec.rearAxle), frontAxle = vec(spec.frontAxle), pivot = vec(spec.pivot), forkAxis = vec(pose.frontAxis);
  const peg = vec(spec.peg), seat = vec(spec.seat), barPoint = vec(spec.bar);
  const head = add(frontAxle, mul(forkAxis, 0.78), V(0, 0, -0.055));

  const fb = new MB();
  const headLow = add(head, mul(forkAxis, -0.16));
  const pegMount = V(0, peg.y + 0.06, peg.z + 0.05);
  const seatRailEnd = V(0, seat.y - 0.02, rearAxle.z + 0.05);
  for (const side of [-1, 1]) {
    const s = V(side * 0.11, 0, 0);
    fb.tube(add(head, mul(s, 0.3)), V(side * 0.13, 0.12, -0.10), 0.022);
    fb.tube(V(side * 0.13, 0.12, -0.10), add(pivot, s, V(0, 0.05, 0)), 0.022);
    fb.tube(add(headLow, mul(s, 0.25)), V(side * 0.09, -0.24, 0.22), 0.017);
    fb.tube(V(side * 0.09, -0.24, 0.22), add(pegMount, mul(s, 0.85)), 0.017);
    fb.tube(add(pegMount, mul(s, 0.85)), add(pivot, s), 0.017);
    fb.tube(V(side * 0.12, 0.15, -0.15), add(seatRailEnd, mul(s, 0.7)), 0.012);
    fb.tube(add(pivot, s, V(0, 0.06, 0)), add(seatRailEnd, mul(s, 0.7)), 0.011);
    fb.box(V(side * 0.20, peg.y, peg.z), V(0.05, 0.012, 0.025), ID());
  }
  fb.tube(add(head, mul(forkAxis, 0.06)), add(head, mul(forkAxis, -0.18)), 0.028);
  part('Frame', root, fb, frameM);

  const eb = new MB();
  eb.box(V(0, -0.13, 0.02), V(0.105, 0.13, 0.16), euler(-8, 0, 0));
  eb.box(V(0, 0.05, 0.08), V(0.07, 0.11, 0.08), euler(-20, 0, 0));
  eb.tube(V(-0.11, -0.13, 0.02), V(-0.13, -0.13, 0.02), 0.075, -1, 16);
  eb.tube(V(0.11, -0.15, -0.04), V(0.13, -0.15, -0.04), 0.06, -1, 16);
  part('Engine', root, eb, engineM);
  const rb = new MB(); for (const side of [-1, 1]) rb.box(V(side * 0.15, 0.12, 0.24), V(0.025, 0.12, 0.08), euler(0, 0, side * 6));
  part('Radiators', root, rb, alu);

  const pb = new MB();
  pb.box(V(0, 0.28, 0.10), V(0.12, 0.07, 0.16), euler(-6, 0, 0));
  for (const side of [-1, 1]) {
    pb.box(V(side * 0.165, 0.20, 0.22), V(0.012, 0.14, 0.14), euler(-28, side * -8, 0));
    pb.box(V(side * 0.13, 0.20, -0.34), V(0.012, 0.09, 0.20), euler(-6, side * 4, 0));
  }
  pb.box(V(0, 0.30, -0.62), V(0.11, 0.012, 0.30), euler(10, 0, 0));
  part('Plastics', root, pb, plastic);
  const gb = new MB(); for (const side of [-1, 1]) gb.box(V(side * 0.143, 0.21, -0.34), V(0.002, 0.06, 0.11), euler(-6, side * 4, 0));
  part('PlateFields', root, gb, white);
  part('Seat', root, new MB().box(V(0, seat.y + 0.005, -0.16), V(0.09, 0.035, 0.36), euler(2, 0, 0)), seatM);

  const port = V(0.03, 0.05, 0.17), p1 = V(0.12, -0.05, 0.26), p2 = V(0.16, -0.10, 0.02), p3 = V(0.15, 0.12, -0.30);
  part('Header', root, new MB().tube(port, p1, 0.022).tube(p1, p2, 0.024).tube(p2, p3, 0.026), pipeM);
  part('Muffler', root, new MB().tube(p3, V(0.15, 0.24, -0.72), 0.05, 0.045, 14), alu);

  // steering assembly
  const steer = angleAxis(pose.steer / D2R, forkAxis);
  const sa = node('SteerAssembly', root, head, steer);
  const up = forkAxis;
  const clampTop = add(mul(up, 0.05), V(0, 0, 0.055)), clampBot = add(mul(up, -0.17), V(0, 0, 0.055));
  const cl = new MB();
  for (const side of [-1, 1]) cl.tube(add(clampTop, V(side * 0.09, 0, 0)), add(clampBot, mul(up, -0.18), V(side * 0.09, 0, 0)), 0.026);
  cl.box(clampTop, V(0.12, 0.012, 0.035), fromTo(V(0, 1, 0), up));
  cl.box(clampBot, V(0.12, 0.016, 0.04), fromTo(V(0, 1, 0), up));
  part('Clamps', sa, cl, alu);
  const barC = barPoint.clone().sub(head);
  part('Bars', sa, new MB().tube(add(barC, V(-0.40, 0.02, -0.03)), add(barC, V(0.40, 0.02, -0.03)), 0.012, -1, 8).tube(clampTop, barC, 0.014), anod);
  const gr = new MB(); for (const side of [-1, 1]) gr.tube(add(barC, V(side * 0.30, 0.02, -0.03)), add(barC, V(side * 0.41, 0.02, -0.03)), 0.017, -1, 8);
  part('Grips', sa, gr, rubber);
  const ff = new MB();
  ff.box(add(clampBot, mul(up, -0.05), V(0, 0, 0.18)), V(0.075, 0.01, 0.24), qmul(fromTo(V(0, 1, 0), up), euler(14, 0, 0)));
  ff.box(add(clampTop, V(0, -0.02, 0.12)), V(0.12, 0.10, 0.01), euler(-18, 0, 0));
  part('FrontPlastics', sa, ff, plastic);

  // fork lowers + front wheel at the simulated hub
  const tilt = fromTo(V(0, 1, 0), forkAxis);
  const fl = node('ForkLowers', root, vec(pose.frontHub), qmul(steer, tilt));
  const flm = new MB(); for (const side of [-1, 1]) flm.tube(V(side * 0.09, 0.03, -0.01), V(side * 0.09, 0.40, -0.01), 0.031);
  part('Lowers', fl, flm, lit([0.15, 0.15, 0.17], 0.6, 0.5));
  const fw = buildWheel(fl, spec.rF, spec.crF, rubber, alu, anod, true);
  fw.quaternion.copy(qmul(tilt.clone().invert(), angleAxis(pose.spinF / D2R, V(1, 0, 0))));

  // swingarm, rear wheel, shock, chain
  const hubR = vec(pose.rearHub), arm = hubR.clone().sub(pivot);
  const sw = node('Swingarm', root, pivot, lookRotation(arm.clone().normalize(), V(0, 1, 0)));
  const armLen = rearAxle.clone().sub(pivot).length(), swm = new MB();
  for (const side of [-1, 1]) swm.box(V(side * 0.085, 0, armLen / 2), V(0.018, 0.035, armLen / 2), ID());
  swm.box(V(0, 0, 0.10), V(0.085, 0.03, 0.03), ID());
  part('Arm', sw, swm, alu);
  const rw = buildWheel(root, spec.rR, spec.crR, rubber, alu, anod, false);
  rw.position.copy(hubR); rw.quaternion.copy(angleAxis(pose.spinR / D2R, V(1, 0, 0)));
  const shockFrame = V(0, 0.15, -0.18), armMount = add(pivot, mul(arm, 0.32), V(0, 0.03, 0)), d = armMount.clone().sub(shockFrame);
  const shockQ = lookRotation(d.clone().normalize(), V(0, 0, 1));
  part('ShockBody', root, new MB().tube(V(), V(0, 0, 0.2), 0.03, -1, 12), lit([0.9, 0.75, 0.1], 0.5, 0.3), shockFrame, shockQ);
  const shaft = part('ShockShaft', root, new MB().tube(V(), V(0, 0, 1), 0.009, -1, 8), alu, shockFrame, shockQ); shaft.scale.set(1, 1, d.length());
  const cs = V(-0.10, -0.12, -0.06), sp = add(hubR, V(-0.10, 0, 0));
  const ch = part('Chain', root, new MB().box(V(0, 0, 0.5), V(0.006, 0.008, 0.5), ID()), engineM, cs, lookRotation(sp.clone().sub(cs).normalize(), V(0, 1, 0)));
  ch.scale.set(1, 1, sp.clone().sub(cs).length());
  return { head };
}

function buildWheel(parent, r, cr, rubber, alu, anod, front) {
  const t = node(front ? 'FrontWheel' : 'RearWheel', parent);
  part('Tyre', t, new MB().torus(r - cr, cr * 0.92, 72, 10, 0.012, front ? 34 : 30), rubber);
  const rimR = r - cr * 1.9;
  part('Rim', t, new MB().torus(rimR, 0.012, 48, 6), anod);
  const sp = new MB();
  for (let i = 0; i < 18; i++) {
    const a = i / 18 * Math.PI * 2, side = i % 2 === 0 ? 0.04 : -0.04;
    const outer = mul(V(0, Math.cos(a), Math.sin(a)), rimR - 0.01);
    const inner = mul(V(side, Math.cos(a + 0.5), Math.sin(a + 0.5)), 0.045); inner.x = side;
    sp.tube(inner, outer, 0.0025, -1, 4, false);
  }
  sp.tube(V(-0.055, 0, 0), V(0.055, 0, 0), 0.04, -1, 12);
  part('Spokes', t, sp, alu);
  part('Rotor', t, new MB().disc(V(front ? -0.06 : 0.06, 0, 0), front ? 0.135 : 0.12, 0.09, 0.004, 28), alu);
  return t;
}

// ------------------------------------------------------------------------------ RiderVisual
function solveIK(root, target, l1, l2, pole) {
  const d = target.clone().sub(root);
  const dist = Math.min(Math.max(d.length(), 0.01), (l1 + l2) * 0.999), dir = d.clone().normalize();
  const a = (l1 * l1 - l2 * l2 + dist * dist) / (2 * dist), h = Math.sqrt(Math.max(0, l1 * l1 - a * a));
  const bend = pole.clone().sub(mul(dir, pole.dot(dir))).normalize();
  return add(root, mul(dir, a), mul(bend, h));
}

function buildRider(root, spec, pose, head) {
  const kit = { jersey: [0.95, 0.95, 0.96], accent: [0.10, 0.25, 0.75], pants: [0.12, 0.20, 0.55], boots: [0.92, 0.92, 0.94], gloves: [0.95, 0.95, 0.95], helmet: [0.98, 0.82, 0.10], visor: [0.05, 0.05, 0.06] };
  const tubeG = () => new MB().tube(V(), V(0, 0, 1), 1, -1, 10), ballG = () => new MB().ellipsoid(V(), V(1, 1, 1), 14, 8);
  const bone = (mat, a, b, r) => { const d = b.clone().sub(a), len = Math.max(0.001, d.length()); const m = part('bone', root, tubeG(), mat, a, lookRotation(mul(d, 1 / len), V(0, 1, 0))); m.scale.set(r, r, len); };
  const ball = (mat, p, q, s) => { const m = part('ball', root, ballG(), mat, p, q); m.scale.copy(s); return m; };
  const jersey = lit(kit.jersey, 0.25), accent = lit(kit.accent, 0.3), pants = lit(kit.pants, 0.3), boots = lit(kit.boots, 0.5), gloves = lit(kit.gloves, 0.3), helmetM = lit(kit.helmet, 0.8), visor = lit(kit.visor, 0.9);

  const axis = vec(pose.frontAxis), barRel = add(vec(spec.bar).sub(head), V(0, 0.02, -0.03)), peg = vec(spec.peg);
  const com = vec(pose.rider), stand = pose.standing, body = pose.body;
  const hip = add(com, V(0, -(0.13 + (0.22 - 0.13) * stand), -0.03 + (-0.10 + 0.03) * stand));
  const pitch = 18 + 22 * stand + body[0] / D2R;
  const torsoRot = euler(pitch, body[1] / D2R, body[2] / D2R);
  const upv = rot(torsoRot, V(0, 1, 0)), right = rot(torsoRot, V(1, 0, 0)), fwd = rot(torsoRot, V(0, 0, 1));
  const chest = add(hip, mul(upv, 0.46)), neckTop = add(chest, mul(upv, 0.13)), headC = add(neckTop, mul(upv, 0.10), mul(fwd, 0.03));
  ball(pants, hip, torsoRot, V(0.17, 0.11, 0.12));
  ball(jersey, add(chest, mul(upv, -0.06)), torsoRot, V(0.21, 0.15, 0.13));
  bone(jersey, hip, chest, 0.12);
  bone(accent, chest, neckTop, 0.05);
  const helmet = ball(helmetM, headC, euler(-10 - 15 * stand + pitch * 0.4, body[1] / D2R * 0.5, 0), V(0.135, 0.14, 0.16));
  for (const [p, s, m] of [[V(0, -0.05, 0.55), V(0.75, 0.32, 0.5), visor], [V(0, 0.45, 0.75), V(0.8, 0.12, 0.55), helmetM], [V(0, -0.55, 0.55), V(0.55, 0.35, 0.5), helmetM]]) {
    const c = new THREE.Mesh(ballG().build(), m); c.position.copy(p); c.scale.copy(s); c.castShadow = true; helmet.add(c);
  }
  const steer = angleAxis(pose.steer / D2R, axis);
  for (const side of [-1, 1]) {
    const shoulder = add(chest, mul(right, 0.19 * side), mul(upv, -0.02));
    const grip = add(head, rot(steer, add(barRel, V(0.35 * side, 0, 0))));
    const elbow = solveIK(shoulder, grip, 0.31, 0.30, add(mul(right, side * 0.8), mul(upv, -0.6), V(0, 0, -0.3)));
    bone(accent, shoulder, elbow, 0.048); bone(jersey, elbow, grip, 0.042);
    ball(gloves, grip, ID(), V(0.05, 0.05, 0.05));
    const hipJ = add(hip, mul(right, 0.10 * side)), foot = V(0.20 * side, peg.y + 0.04, peg.z);
    const knee = solveIK(hipJ, foot, 0.45, 0.46, V(side * 0.35, 0, 0.9));
    bone(pants, hipJ, knee, 0.075); bone(boots, knee, foot, 0.058);
    ball(boots, add(foot, V(0, 0, 0.04)), ID(), V(0.06, 0.06, 0.14));
  }
}

// ------------------------------------------------------------------------------ scene
export async function render(canvas, data, idx, view) {
  const pose = data.poses[idx], spec = data.spec;
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true });
  renderer.setSize(canvas.width, canvas.height, false);
  renderer.shadowMap.enabled = true; renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.05;
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x5a4a66); scene.fog = new THREE.Fog(0x8a6a74, 12, 40);
  scene.add(new THREE.HemisphereLight(0xb8a8d8, 0x3a2a24, 0.9));
  const sun = new THREE.DirectionalLight(0xffc48a, 2.4); sun.position.set(-4, 3, 5); sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048); Object.assign(sun.shadow.camera, { left: -3, right: 3, top: 3, bottom: -3 }); scene.add(sun);
  const fill = new THREE.DirectionalLight(0x9fb0ff, 0.6); fill.position.set(4, 2, -3); scene.add(fill);
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(80, 80), new THREE.MeshStandardMaterial({ color: 0x6b5140, roughness: 1 }));
  ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; scene.add(ground);

  // Unity space (left-handed) → three (right-handed): mirror Z on the root
  const world = new THREE.Object3D(); world.scale.set(1, 1, -1); scene.add(world);
  const bike = new THREE.Object3D();
  const roll = -pose.lean / D2R, pitchDeg = -pose.pitch / D2R;
  bike.quaternion.copy(qmul(angleAxis(roll, V(0, 0, 1)), angleAxis(pitchDeg, V(1, 0, 0))));
  const comH = spec.rR - spec.rearAxle[1];
  bike.position.set(0, comH + (pose.name.startsWith('Airborne') ? 0.8 : 0), 0);
  world.add(bike);
  const pal = pose.bike === '250F'
    ? { plastic: [0.10, 0.32, 0.80], dark: [0.06, 0.10, 0.22], frame: [0.12, 0.13, 0.15], seat: [0.07, 0.08, 0.10], graphic: [0.95, 0.95, 0.97] }
    : { plastic: [0.92, 0.36, 0.06], dark: [0.12, 0.12, 0.13], frame: [0.70, 0.32, 0.08], seat: [0.08, 0.08, 0.09], graphic: [0.97, 0.97, 0.97] };
  const { head } = buildBike(bike, spec, pose, pal);
  if (view.rider !== false) buildRider(bike, spec, pose, head);

  const cam = new THREE.PerspectiveCamera(view.fov ?? 34, canvas.width / canvas.height, 0.05, 200);
  const target = V(0, comH + 0.25 + (pose.name.startsWith('Airborne') ? 0.8 : 0), 0);
  cam.position.copy(target.clone().add(V(...view.offset)));
  cam.lookAt(target);
  renderer.render(scene, cam);
}
