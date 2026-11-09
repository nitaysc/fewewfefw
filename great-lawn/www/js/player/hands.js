// Hands, modelled as anatomy and rigged like a game character's.
// The skin is a signed-distance model (metacarpals, phalanges with fleshy pads, knuckles,
// tendons, veins, thenar and hypothenar, the wrist bone, nails) meshed once with surface
// nets in a relaxed pose. Each vertex is then bound to a skeleton (wrist, three bones per
// finger, three for the thumb) with weights from its distance to every bone, so the
// fingers animate smoothly: gripping the wheel, opening, closing round a bottle, holding
// a cigar to the lips. Grips are solved against the real rim and bottle radii.
// The skin shader adds subsurface glow, knuckle wrinkles and palm creases, pores and nails.
import * as THREE from '../../vendor/three.module.js';
import { meshSDF, smin, smax, roundCone, capsule, ellipsoid, orientedRoundBox } from '../core/sdf.js';
import { canvasTexture } from '../core/textures.js';
import { shared } from '../core/shared.js';

export const NAMES = ['index', 'middle', 'ring', 'little'];
// Right hand, palm down, fingers toward -Z, thumb toward -X, back of the hand +Y. Metres.
const FINGERS = {
  index: { mcp: [-0.0252, 0.0005, -0.0935], base: [-0.0165, 0.0015, -0.014], len: [0.043, 0.0255, 0.0205], r: [0.0092, 0.0082, 0.0073, 0.0066], spread: -0.07 },
  middle: { mcp: [-0.0077, 0.0018, -0.098], base: [-0.0052, 0.0022, -0.012], len: [0.048, 0.029, 0.0215], r: [0.0095, 0.0085, 0.0075, 0.0068], spread: -0.01 },
  ring: { mcp: [0.0098, 0.0005, -0.0925], base: [0.006, 0.0012, -0.013], len: [0.0445, 0.028, 0.0212], r: [0.0089, 0.0079, 0.007, 0.0063], spread: 0.06 },
  little: { mcp: [0.0262, -0.0032, -0.0835], base: [0.0165, -0.0018, -0.016], len: [0.035, 0.0205, 0.0188], r: [0.0079, 0.0069, 0.0061, 0.0055], spread: 0.13 },
};
const THUMB = { cmc: [-0.0195, -0.0075, -0.021], len: [0.045, 0.033, 0.0285], r: [0.0128, 0.0112, 0.0099, 0.009] };
export const HAND_SCALE = 1.08;

const V3 = (a) => new THREE.Vector3(a[0], a[1], a[2]);
const A3 = (v) => [v.x, v.y, v.z];

// Thumb orientation from three angles: a swings it towards the index (radial abduction),
// e brings it under the palm (opposition), roll pronates it so the pad faces the fingers.
function thumbFrame(a, e, roll) {
  const dir = new THREE.Vector3(-Math.sin(a) * Math.cos(e), -Math.sin(e), -Math.cos(a) * Math.cos(e)).normalize();
  const side = new THREE.Vector3().crossVectors(new THREE.Vector3(0, 1, 0), dir).normalize(); // points away from the palm side
  let nail = new THREE.Vector3().crossVectors(dir, side).normalize();
  if (nail.y < 0) nail.negate();
  nail.applyAxisAngle(dir, -roll);
  return { dir, nail };
}

function fingerChain(n, flex, spreadExtra = 0) {
  const f = FINGERS[n];
  const P0 = V3(f.mcp);
  const up0 = new THREE.Vector3(0, 1, 0);
  const d0 = new THREE.Vector3(0, 0, -1).applyAxisAngle(up0, -(f.spread + spreadExtra));
  const lat = new THREE.Vector3().crossVectors(d0, up0).normalize();
  const joints = [P0.clone()], dirs = [], ups = [];
  let cum = 0, p = P0.clone();
  for (let s = 0; s < 3; s++) {
    cum += flex[s];
    const d = d0.clone().applyAxisAngle(lat, -cum);
    const u = up0.clone().applyAxisAngle(lat, -cum);
    p = p.clone().addScaledVector(d, f.len[s]);
    joints.push(p); dirs.push(d); ups.push(u);
  }
  return { joints, dirs, ups, lat, up0, d0, r: f.r };
}

function thumbChain(t) {
  const fr = thumbFrame(t.a, t.e, t.roll);
  const P0 = V3(THUMB.cmc);
  const lat = new THREE.Vector3().crossVectors(fr.dir, fr.nail).normalize();
  const joints = [P0.clone()], dirs = [], ups = [];
  const flex = [0, t.flex[0], t.flex[1]];
  let cum = 0, p = P0.clone();
  for (let s = 0; s < 3; s++) {
    cum += flex[s];
    const d = fr.dir.clone().applyAxisAngle(lat, -cum);
    const u = fr.nail.clone().applyAxisAngle(lat, -cum);
    p = p.clone().addScaledVector(d, THUMB.len[s]);
    joints.push(p); dirs.push(d); ups.push(u);
  }
  return { joints, dirs, ups, lat, frame: fr, r: THUMB.r };
}

// ------------------------------------------------------------------ pose solving
const distToAxis = (p, c, ax) => {
  const vx = p.x - c[0], vy = p.y - c[1], vz = p.z - c[2];
  const t = vx * ax[0] + vy * ax[1] + vz * ax[2];
  return Math.hypot(vx - ax[0] * t, vy - ax[1] * t, vz - ax[2] * t);
};
// Fingers wrap a cylinder: search MCP and PIP flexion (the DIP follows the PIP, as real
// fingers do) so the pads hug the surface without sinking in.
function wrapFinger(n, c, R, spread, ax, slack = 0) {
  let best = null, bestCost = Infinity;
  for (let a = -0.15; a <= 1.75; a += 0.03) {
    for (let b = 0; b <= 1.95; b += 0.03) {
      const flex = [a, b, Math.min(1.3, b * 0.7)];
      const ch = fingerChain(n, flex, spread);
      let cost = 0;
      for (let s = 0; s < 3; s++) {
        const j0 = ch.joints[s], j1 = ch.joints[s + 1];
        for (const t of [0.25, 0.6, 1.0]) {
          const p = j0.clone().lerp(j1, t), r = ch.r[s] + (ch.r[s + 1] - ch.r[s]) * t;
          const gap = distToAxis(p, c, ax) - (R + r * 0.88 + slack);
          if (gap < -0.0004) cost += gap * gap * 4e5;
          else if (s > 0) cost += gap * gap * 900;
        }
      }
      cost += (a * a + b * b) * 0.00002;
      if (cost < bestCost) { bestCost = cost; best = flex; }
    }
  }
  return best;
}
// Thumb: press its pad against the far side of the grip without touching the index finger.
function wrapThumb(c, R, ax, index, prefer) {
  let best = null, bestCost = Infinity;
  const idxPts = [];
  for (let s = 0; s < 3; s++) for (const t of [0.2, 0.6, 1]) idxPts.push([index.joints[s].clone().lerp(index.joints[s + 1], t), index.r[s]]);
  for (let a = 0.2; a <= 1.3; a += 0.1) for (let e = 0.0; e <= 1.1; e += 0.1) for (let roll = 0; roll <= 0.9; roll += 0.15)
    for (let m = 0; m <= 0.8; m += 0.1) for (let ip = 0; ip <= 1.0; ip += 0.125) {
      const th = thumbChain({ a, e, roll, flex: [m, ip] });
      let cost = 0;
      for (let s = 1; s < 3; s++) for (const t of [0.4, 1.0]) {
        const p = th.joints[s].clone().lerp(th.joints[s + 1], t), r = th.r[s];
        const gap = distToAxis(p, c, ax) - (R + r * 0.9);
        cost += gap < 0 ? gap * gap * 3e5 : gap * gap * (s === 2 ? 1500 : 300);
        for (const [q, rq] of idxPts) { const d = p.distanceTo(q) - (r + rq) * 0.95; if (d < 0) cost += d * d * 2e5; }
      }
      cost += ((a - prefer.a) ** 2 + (e - prefer.e) ** 2) * 0.002;
      if (cost < bestCost) { bestCost = cost; best = { a, e, roll, flex: [m, ip] }; }
    }
  return best;
}

export const REST = {
  fingers: { index: [0.4, 0.55, 0.32], middle: [0.42, 0.58, 0.34], ring: [0.45, 0.6, 0.35], little: [0.5, 0.62, 0.36] },
  spread: { index: 0, middle: 0, ring: 0, little: 0 },
  thumb: { a: 0.62, e: 0.42, roll: 0.25, flex: [0.25, 0.3] },
};

function gripPose(c, R, gamma, spread, preferThumb, slack = 0) {
  const ax = [Math.cos(gamma), 0, Math.sin(gamma)];
  const fingers = {};
  for (const n of NAMES) fingers[n] = wrapFinger(n, c, R, spread[n], ax, slack);
  const index = fingerChain('index', fingers.index, spread.index);
  const thumb = wrapThumb(c, R, ax, index, preferThumb);
  return { fingers, spread, thumb, grip: { c, R, ax } };
}

export const POSES = {
  // round the steering-wheel rim (13.5 mm), rim running diagonally across the palm
  wheel: () => gripPose([0, -0.0262, -0.079], 0.0135, 0.42, { index: -0.02, middle: 0.0, ring: 0.02, little: 0.04 }, { a: 0.4, e: 0.75 }),
  // the same, index and middle parted round a cigar
  wheelCigar: () => gripPose([0, -0.0262, -0.079], 0.0135, 0.42, { index: -0.12, middle: 0.07, ring: 0.03, little: 0.05 }, { a: 0.35, e: 0.7 }, 0.0006),
  // round the bottle (32.5 mm)
  bottle: () => gripPose([0, -0.046, -0.066], 0.0325, 0.18, { index: -0.02, middle: 0.0, ring: 0.02, little: 0.05 }, { a: 0.6, e: 0.6 }),
  open: () => ({
    fingers: { index: [0.12, 0.18, 0.1], middle: [0.14, 0.2, 0.12], ring: [0.18, 0.24, 0.14], little: [0.24, 0.28, 0.16] },
    spread: { index: -0.06, middle: 0.0, ring: 0.05, little: 0.1 },
    thumb: { a: 0.9, e: 0.3, roll: 0.15, flex: [0.1, 0.15] },
  }),
  // holding a cigar to the lips: index and middle pinch it at their roots and curl loosely
  // beyond it, the others tucked in
  cigarLips: () => ({
    fingers: { index: [0.42, 1.2, 0.7], middle: [0.48, 1.25, 0.75], ring: [1.05, 1.25, 0.85], little: [1.12, 1.25, 0.82] },
    spread: { index: -0.12, middle: 0.07, ring: 0.03, little: 0.06 },
    thumb: { a: 0.55, e: 0.62, roll: 0.45, flex: [0.25, 0.35] },
  }),
};

export function lerpPose(a, b, t, out = {}) {
  out.fingers = out.fingers || {}; out.spread = out.spread || {};
  for (const n of NAMES) {
    const fa = a.fingers[n], fb = b.fingers[n];
    out.fingers[n] = [fa[0] + (fb[0] - fa[0]) * t, fa[1] + (fb[1] - fa[1]) * t, fa[2] + (fb[2] - fa[2]) * t];
    out.spread[n] = (a.spread?.[n] || 0) + ((b.spread?.[n] || 0) - (a.spread?.[n] || 0)) * t;
  }
  const ta = a.thumb, tb = b.thumb;
  out.thumb = { a: ta.a + (tb.a - ta.a) * t, e: ta.e + (tb.e - ta.e) * t, roll: ta.roll + (tb.roll - ta.roll) * t, flex: [ta.flex[0] + (tb.flex[0] - ta.flex[0]) * t, ta.flex[1] + (tb.flex[1] - ta.flex[1]) * t] };
  return out;
}

// ------------------------------------------------------------------ the skin SDF
export function buildHandSDF(pose) {
  const metas = [], fingers = [], nails = [], knuckles = [], reds = [], pads = [];
  for (const n of NAMES) {
    const f = FINGERS[n];
    const ch = fingerChain(n, pose.fingers[n], pose.spread?.[n] || 0);
    fingers.push(ch);
    metas.push({ a: f.base, b: A3(ch.joints[0]), r1: 0.0098, r2: f.r[0] * 1.07 });
    knuckles.push({ c: A3(ch.joints[0].clone().addScaledVector(new THREE.Vector3(0, 1, 0), 0.004)), r: f.r[0] * 0.8 });
    knuckles.push({ c: A3(ch.joints[1].clone().addScaledVector(ch.ups[0].clone().lerp(ch.ups[1], 0.5), 0.0026)), r: f.r[1] * 0.72 });
    knuckles.push({ c: A3(ch.joints[2].clone().addScaledVector(ch.ups[1].clone().lerp(ch.ups[2], 0.5), 0.002)), r: f.r[2] * 0.66 });
    reds.push(ch.joints[0], ch.joints[1], ch.joints[2], ch.joints[3]);
  }
  const th = thumbChain(pose.thumb);
  fingers.push(th);
  reds.push(th.joints[2], th.joints[3]);
  // fleshy pads on the palm side of every phalanx, fuller at the fingertips
  fingers.forEach((ch, fi) => {
    for (let s = 0; s < 3; s++) {
      if (fi === 4 && s === 0) continue;
      const d = ch.dirs[s], u = ch.ups[s];
      const ex = new THREE.Vector3().crossVectors(d, u).normalize();
      const len = ch.joints[s].distanceTo(ch.joints[s + 1]), r = ch.r[s + 1];
      const tip = s === 2;
      const c = ch.joints[s].clone().addScaledVector(d, len * (tip ? 0.55 : 0.5)).addScaledVector(u, -r * (tip ? 0.3 : 0.32));
      pads.push({ c: A3(c), ex: A3(ex), ey: A3(u), ez: A3(d), r: [r * 0.93, r * (tip ? 0.82 : 0.72), len * (tip ? 0.46 : 0.42)] });
    }
  });
  // nails on every distal phalanx
  for (const ch of fingers) {
    const j0 = ch.joints[2], d = ch.dirs[2], u = ch.ups[2];
    const len = j0.distanceTo(ch.joints[3]);
    const rr = ch.r[3];
    const ex = new THREE.Vector3().crossVectors(d, u).normalize();
    // a real nail covers the outer half of the last joint and about 60% of the finger's width
    const o = j0.clone().addScaledVector(d, len * 0.71).addScaledVector(u, rr * 0.8);
    nails.push({ o: A3(o), ex: A3(ex), ey: A3(u), ez: A3(d), h: [rr * 0.6, 0.0009, len * 0.25] });
  }
  // dorsal tendons, veins, the wrist bone and the muscle between thumb and index
  const tendons = fingers.slice(0, 4).map((ch, i) => ({ a: [metas[i].a[0] * 0.55, 0.0105, -0.024], b: [ch.joints[0].x, ch.joints[0].y + 0.007, ch.joints[0].z + 0.012], r: 0.0025 }));
  tendons.push({ a: [-0.012, 0.008, -0.004], b: [th.joints[1].x * 0.9, th.joints[1].y + 0.004, th.joints[1].z + 0.004], r: 0.0028 });
  const veins = [
    { a: [-0.004, 0.0119, -0.012], b: [-0.011, 0.0114, -0.05], r: 0.0016 },
    { a: [-0.011, 0.0114, -0.05], b: [-0.019, 0.0105, -0.068], r: 0.0014 },
    { a: [0.009, 0.0116, -0.018], b: [0.004, 0.0117, -0.058], r: 0.0015 },
    { a: [0.004, 0.0117, -0.058], b: [0.012, 0.0112, -0.075], r: 0.0012 },
  ];
  const palmPad = { c: [0.0005, -0.0035, -0.056], r: [0.034, 0.0115, 0.041] };
  const thenar = { c: [-0.0215, -0.0105, -0.034], r: [0.0168, 0.0138, 0.026] };
  const web = { c: [-0.024, 0.0035, -0.05], r: [0.0085, 0.0075, 0.016] };
  const hypo = { c: [0.0232, -0.0085, -0.046], r: [0.011, 0.011, 0.031] };
  const styloid = { c: [0.0195, 0.0085, 0.014], r: 0.0042 };
  const wristA = [0, -0.001, 0.01], wristB = [0, 0.0, 0.12];

  const fb = fingers.map((ch) => {
    const c = new THREE.Vector3();
    ch.joints.forEach((j) => c.add(j)); c.multiplyScalar(1 / ch.joints.length);
    let r = 0; ch.joints.forEach((j) => { r = Math.max(r, j.distanceTo(c)); });
    return { c: A3(c), r: r + 0.016 };
  });
  const segs = fingers.map((ch) => [0, 1, 2].map((s) => {
    const a = ch.joints[s], b = ch.joints[s + 1].clone().addScaledVector(ch.dirs[s], s === 2 ? -ch.r[3] : 0);
    return { a: A3(a), b: A3(b), r1: ch.r[s] * (ch === th && s === 0 ? 1.12 : 1), r2: ch.r[s + 1] };
  }));
  const padsByFinger = fingers.map((_, fi) => pads.filter((p, i) => Math.floor(i / 3) === fi || (fi === 4 && i >= 12)));

  const orientedEllipsoid = (x, y, z, e) => {
    const dx = x - e.c[0], dy = y - e.c[1], dz = z - e.c[2];
    return ellipsoid(dx * e.ex[0] + dy * e.ex[1] + dz * e.ex[2], dx * e.ey[0] + dy * e.ey[1] + dz * e.ey[2], dx * e.ez[0] + dy * e.ez[1] + dz * e.ez[2], [0, 0, 0], e.r);
  };
  const palm = (x, y, z) => {
    let d = 1e9;
    for (const m of metas) d = smin(d, roundCone(x, y, z, m.a, m.b, m.r1, m.r2), 0.017);
    d = smin(d, ellipsoid(x, y, z, palmPad.c, palmPad.r), 0.012);
    d = smin(d, ellipsoid(x, y, z, thenar.c, thenar.r), 0.011);
    d = smin(d, ellipsoid(x, y, z, web.c, web.r), 0.008);
    d = smin(d, ellipsoid(x, y, z, hypo.c, hypo.r), 0.01);
    const ws = 0.72;
    d = smin(d, capsule(x, y / ws, z, wristA, wristB, 0.0272) * ws, 0.02);
    d = smin(d, Math.hypot(x - styloid.c[0], y - styloid.c[1], z - styloid.c[2]) - styloid.r, 0.006);
    return d;
  };
  const sdf = (x, y, z) => {
    let d = palm(x, y, z);
    for (const k of knuckles) d = smin(d, Math.hypot(x - k.c[0], y - k.c[1], z - k.c[2]) - k.r, 0.0045);
    for (const t of tendons) d = smin(d, capsule(x, y, z, t.a, t.b, t.r), 0.0042);
    for (const v of veins) d = smin(d, capsule(x, y, z, v.a, v.b, v.r), 0.0026);
    for (let f = 0; f < 5; f++) {
      const b = fb[f];
      const dc = Math.hypot(x - b.c[0], y - b.c[1], z - b.c[2]) - b.r;
      if (dc > d + 0.004) continue;
      let df = 1e9;
      for (const s of segs[f]) df = smin(df, roundCone(x, y, z, s.a, s.b, s.r1, s.r2), 0.003);
      for (const p of padsByFinger[f]) df = smin(df, orientedEllipsoid(x, y, z, p), 0.0035);
      d = smin(d, df, f === 4 ? 0.013 : 0.006);
    }
    // the nail plate is drawn by the skin shader (per pixel, from each nail's coordinates):
    // modelled as a raised box it left a stepped ledge at the fingertip
    return smax(d, z - 0.1, 0.004);
  };
  return { sdf, palm, nails, reds, fingers, segs };
}

// ------------------------------------------------------------------ skin material
export function skinMaterial(tone) {
  const m = new THREE.MeshPhysicalMaterial({
    color: tone, vertexColors: true, roughness: 0.56, metalness: 0,
    sheen: 0.12, sheenColor: new THREE.Color('#ffb59a'), sheenRoughness: 0.55,
    clearcoat: 0.12, clearcoatRoughness: 0.42,
  });
  m.onBeforeCompile = (s) => {
    s.uniforms.uSunDir = shared.uSunDir;
    s.uniforms.uSunColor = shared.uSunColor;
    s.uniforms.uSSS = { value: new THREE.Color(1.0, 0.27, 0.15) };
    s.vertexShader = s.vertexShader
      .replace('#include <common>', '#include <common>\nattribute vec3 aSkin;\nattribute vec3 aCrease;\nattribute vec3 aNail;\nvarying vec3 vSkin;\nvarying vec3 vCrease;\nvarying vec3 vNail;\nvarying vec3 vObj;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvSkin = aSkin;\nvCrease = aCrease;\nvNail = aNail;\nvObj = position;');
    s.fragmentShader = s.fragmentShader
      .replace('#include <common>', `#include <common>
        varying vec3 vSkin; varying vec3 vCrease; varying vec3 vNail; varying vec3 vObj;
        uniform vec3 uSunDir; uniform vec3 uSunColor; uniform vec3 uSSS;
        // Nails, per pixel from each nail's own coordinates (u: base 0 -> tip 1, v: side to
        // side -1..1, w: on the back of the finger): the plate with its pale lunula, the
        // white free edge past the smile line, the cuticle fold behind and the side folds.
        float gNail, gLun, gFree, gCut, gFold, gRidge;
        void nailRegions() {
          float u = vNail.x, v = vNail.y, w = clamp(vNail.z, 0.0, 1.0);
          vec2 fw = fwidth(vNail.xy) * 0.75 + 1e-4;
          float v2 = v * v;
          float prox = 0.06 + 0.12 * v2;
          float tip = 1.0 - 0.08 * v2;
          float inP = smoothstep(prox - fw.x, prox + fw.x, u);
          float side = 0.86 + 0.1 * smoothstep(0.0, 0.5, u);
          float inS = 1.0 - smoothstep(side - fw.y, side + fw.y, abs(v));
          float inT = 1.0 - smoothstep(tip - fw.x, tip + fw.x, u);
          gNail = inP * inS * inT * w;
          float lun = 0.17 - 0.1 * v2;
          gLun = (1.0 - smoothstep(lun - 0.03 - fw.x, lun + 0.03 + fw.x, u)) * gNail;
          float smile = 0.95 - 0.06 * v2;
          gFree = smoothstep(smile - 0.01 - fw.x, smile + 0.01 + fw.x, u) * gNail;
          float behind = prox - u;
          gCut = exp(-pow((behind - 0.035) / 0.035, 2.0)) * (1.0 - smoothstep(1.0, 1.2, abs(v))) * w;
          gFold = exp(-pow((abs(v) - 1.05) / 0.07, 2.0)) * smoothstep(prox - 0.05, prox + 0.05, u) * (1.0 - smoothstep(tip - 0.1, tip, u)) * w;
          gRidge = sin(v * 61.0 + sin(u * 9.0) * 0.6) * 0.35 + sin(v * 97.0 + 1.7) * 0.2;
        }
        float hs(vec3 p) { return fract(sin(dot(p, vec3(17.13, 31.71, 47.37))) * 43758.5453); }
        float vn3(vec3 p) {
          vec3 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
          return mix(mix(mix(hs(i), hs(i + vec3(1,0,0)), f.x), mix(hs(i + vec3(0,1,0)), hs(i + vec3(1,1,0)), f.x), f.y),
                     mix(mix(hs(i + vec3(0,0,1)), hs(i + vec3(1,0,1)), f.x), mix(hs(i + vec3(0,1,1)), hs(i + vec3(1,1,1)), f.x), f.y), f.z);
        }
        // skin relief: knuckle wrinkles across the back of each joint, flexion creases on the
        // palm side, and pores
        float skinRelief(float px) {
          float s = vCrease.x, side = vCrease.y, w = vCrease.z;
          float dors = smoothstep(0.05, 0.55, side) * w;
          float env = exp(-pow(s / 0.0036, 2.0));
          // fine detail fades out once a pixel covers more skin than the detail is wide
          float fine = 1.0 - smoothstep(0.0006, 0.0022, px);
          float wr = (sin(s * 3900.0 + sin(vObj.x * 700.0) * 1.1 + vn3(vObj * 380.0) * 3.2) * 0.5 + 0.5) * env * dors * (0.45 + 0.55 * vn3(vObj * 210.0 + 7.0));
          float crease = exp(-pow(s / 0.0009, 2.0)) * smoothstep(0.15, 0.6, -side) * w;
          float pores = vn3(vObj * 650.0) * 0.6 + vn3(vObj * 260.0 + 3.1) * 0.4;
          return (-wr * 0.32 + pores * 0.14) * fine - crease * 0.6;
        }
      `)
      .replace('#include <color_fragment>', `#include <color_fragment>
        {
          float s = vCrease.x, side = vCrease.y, w = vCrease.z;
          float crease = exp(-pow(s / 0.0008, 2.0)) * smoothstep(0.15, 0.6, -side) * w;
          float wr = exp(-pow(s / 0.0036, 2.0)) * smoothstep(0.05, 0.55, side) * w * (0.5 + 0.5 * sin(s * 3900.0));
          float mott = vn3(vObj * 140.0) * 0.6 + vn3(vObj * 55.0) * 0.4;
          diffuseColor.rgb *= (0.94 + 0.12 * mott) * (1.0 - 0.18 * crease - 0.07 * wr);
          nailRegions();
          vec3 skin = diffuseColor.rgb;
          // the cuticle and side folds: a little redder and darker
          skin *= 1.0 - gCut * vec3(0.04, 0.1, 0.1) - gFold * 0.035;
          // the plate shows the pink nail bed through it, paler at the lunula
          // a man's nail: much the colour of the finger, a little pinker and glossier
          vec3 bed = mix(skin * vec3(1.05, 0.92, 0.9), vec3(0.86, 0.62, 0.58), 0.12);
          bed *= (1.0 + 0.008 * gRidge) * mix(1.04, 0.96, clamp(vNail.x, 0.0, 1.0));
          bed = mix(bed, vec3(0.9, 0.78, 0.75), gLun / max(gNail, 1e-3) * 0.3);
          vec3 freeC = mix(vec3(0.84, 0.8, 0.72), skin * 1.08, 0.5);
          vec3 nailC = mix(bed, freeC, gFree / max(gNail, 1e-3) * 0.7);
          diffuseColor.rgb = mix(skin, nailC, gNail);
        }`)
      .replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
        roughnessFactor = mix(roughnessFactor, mix(0.24, 0.4, gFree / max(gNail, 1e-3)), gNail);
        roughnessFactor = mix(roughnessFactor, 0.66, gCut * 0.6);
        roughnessFactor = mix(roughnessFactor, 0.42, smoothstep(0.3, 0.9, vCrease.z) * smoothstep(0.2, 0.8, vCrease.y) * exp(-pow(vCrease.x / 0.004, 2.0)));`)
      .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
        {
          float px = max(length(dFdx(vObj)) + length(dFdy(vObj)), 1e-5);
          // the nail plate stands proud of the skin, with fine ridges along it
          float hgt = skinRelief(px) * (1.0 - gNail) + gNail * (0.05 + 0.006 * gRidge * (1.0 - smoothstep(0.0006, 0.002, px))) - gCut * 0.02;
          vec2 dH = vec2(dFdx(hgt), dFdy(hgt));
          vec3 sx = dFdx(-vViewPosition), sy = dFdy(-vViewPosition);
          vec3 vSigmaX = sx / max(length(sx), 1e-9), vSigmaY = sy / max(length(sy), 1e-9);
          vec3 R1 = cross(vSigmaY, normal), R2 = cross(normal, vSigmaX);
          float fDet = dot(vSigmaX, R1);
          vec3 vGrad = sign(fDet) * (dH.x * R1 + dH.y * R2);
          vec3 nb = abs(fDet) * normal - vGrad * 0.0009 / px;
          float nl = length(nb);
          if (nl > 1e-6) normal = nb / nl;
        }`)
      .replace('#include <lights_physical_fragment>', `#include <lights_physical_fragment>
        #ifdef USE_CLEARCOAT
          material.clearcoat = mix(material.clearcoat, 0.4, gNail * (1.0 - 0.5 * gFree / max(gNail, 1e-3)));
          material.clearcoatRoughness = mix(material.clearcoatRoughness, 0.12 + geometryRoughness, gNail);
        #endif`)
      .replace('#include <lights_fragment_end>', `#include <lights_fragment_end>
        {
          vec3 Lv = normalize((viewMatrix * vec4(uSunDir, 0.0)).xyz);
          vec3 Vv = normalize(vViewPosition);
          float ndl = dot(normal, Lv);
          float wrapT = max(0.0, (ndl + 0.5) / 1.5) - max(0.0, ndl);
          float trans = pow(max(0.0, dot(-Vv, Lv)), 3.0) * vSkin.y;
          reflectedLight.directDiffuse += diffuseColor.rgb * uSSS * uSunColor * RECIPROCAL_PI * (wrapT * 0.6 + trans * 1.5);
        }`);
  };
  return m;
}

// Each vertex near a nail gets that nail's coordinates: u from the base (0) to the tip (1),
// v across (-1..1), w how squarely it faces out of the back of the finger. The shader draws
// the nail from these, so its outline is sharp however coarse the mesh.
function nailCoords(nails, x, y, z, nx, ny, nz, out) {
  let best = null, bd = 1.6;
  for (const n of nails) {
    const dx = x - n.o[0], dy = y - n.o[1], dz = z - n.o[2];
    const lx = dx * n.ex[0] + dy * n.ex[1] + dz * n.ex[2];
    const ly = dx * n.ey[0] + dy * n.ey[1] + dz * n.ey[2];
    const lz = dx * n.ez[0] + dy * n.ez[1] + dz * n.ez[2];
    if (ly < -0.0045) continue;
    const q = Math.max(Math.abs(lx) / n.h[0], Math.abs(lz) / n.h[2]);
    if (q < bd) { bd = q; best = { n, lx, lz }; }
  }
  if (!best) { out[0] = -1; out[1] = 0; out[2] = 0; return; }
  const { n, lx, lz } = best;
  const facing = nx * n.ey[0] + ny * n.ey[1] + nz * n.ey[2];
  out[0] = (lz + n.h[2]) / (2 * n.h[2]);
  out[1] = lx / n.h[0];
  out[2] = Math.min(1, Math.max(0, (facing - 0.15) / 0.35));
}

// ------------------------------------------------------------------ rig
const BONE_COUNT = 16;   // wrist, 4 fingers x 3, thumb x 3
function buildSkeletonDefs(rest) {
  const defs = [{ name: 'wrist', parent: -1, pos: new THREE.Vector3(0, 0, 0) }];
  const fingerBones = {};
  for (const n of NAMES) {
    const ch = fingerChain(n, rest.fingers[n], rest.spread[n]);
    const ids = [];
    for (let s = 0; s < 3; s++) {
      ids.push(defs.length);
      defs.push({ name: `${n}${s + 1}`, parent: s === 0 ? 0 : defs.length - 1, pos: ch.joints[s].clone(), seg: [ch.joints[s], ch.joints[s + 1]], r: [ch.r[s], ch.r[s + 1]] });
    }
    fingerBones[n] = ids;
  }
  const th = thumbChain(rest.thumb);
  const tids = [];
  for (let s = 0; s < 3; s++) {
    tids.push(defs.length);
    defs.push({ name: `thumb${s + 1}`, parent: s === 0 ? 0 : defs.length - 1, pos: th.joints[s].clone(), seg: [th.joints[s], th.joints[s + 1]], r: [th.r[s] * (s === 0 ? 1.15 : 1), th.r[s + 1]] });
  }
  return { defs, fingerBones, thumbBones: tids, thumbRest: th };
}

function skinWeights(geo, palm, defs) {
  const P = geo.attributes.position.array;
  const n = P.length / 3;
  const si = new Uint16Array(n * 4), sw = new Float32Array(n * 4);
  const w = new Float32Array(BONE_COUNT);
  for (let i = 0; i < n; i++) {
    const x = P[i * 3], y = P[i * 3 + 1], z = P[i * 3 + 2];
    w[0] = Math.exp(-((Math.max(palm(x, y, z), 0) / 0.0048) ** 2));
    for (let b = 1; b < BONE_COUNT; b++) {
      const d = defs[b];
      const dist = roundCone(x, y, z, A3(d.seg[0]), A3(d.seg[1]), d.r[0], d.r[1]);
      w[b] = Math.exp(-((Math.max(dist, 0) / 0.0034) ** 2));
    }
    // four strongest
    const order = [...w.keys()].sort((a, b) => w[b] - w[a]).slice(0, 4);
    let sum = 0;
    for (const k of order) sum += w[k];
    if (sum < 1e-6) { si[i * 4] = 0; sw[i * 4] = 1; continue; }
    order.forEach((k, j) => { si[i * 4 + j] = k; sw[i * 4 + j] = w[k] / sum; });
  }
  geo.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(si, 4));
  geo.setAttribute('skinWeight', new THREE.Float32BufferAttribute(sw, 4));
}

// crease coordinate: signed distance along the finger from the nearest knuckle, which side
// of the finger, and how pronounced the joint's wrinkles are
function creaseAttribute(fingers) {
  const joints = [];
  fingers.forEach((ch, fi) => {
    for (let k = 0; k < 3; k++) {
      const j = ch.joints[k];
      const d = k === 0 ? ch.dirs[0] : ch.dirs[k - 1].clone().add(ch.dirs[k]).normalize();
      const u = k === 0 ? ch.ups[0] : ch.ups[k - 1].clone().add(ch.ups[k]).normalize();
      const weight = fi === 4 ? [0, 0.8, 0.9][k] : [0.55, 1.0, 0.75][k];
      joints.push({ j, d, u, weight, r: ch.r[k] });
    }
  });
  return {
    size: 3, fn: (x, y, z, nx, ny, nz, out) => {
      let best = null, bd = Infinity, bd2 = Infinity;
      for (const J of joints) {
        const dx = x - J.j.x, dy = y - J.j.y, dz = z - J.j.z;
        const dd = dx * dx + dy * dy + dz * dz;
        if (dd < bd) { bd2 = bd; bd = dd; best = J; } else if (dd < bd2) bd2 = dd;
      }
      const dx = x - best.j.x, dy = y - best.j.y, dz = z - best.j.z;
      const s = dx * best.d.x + dy * best.d.y + dz * best.d.z;
      const side = nx * best.u.x + ny * best.u.y + nz * best.u.z;
      const near = Math.sqrt(bd) < best.r * 2.2 ? 1 : 0;
      // halfway between two knuckles the nearest one changes and s jumps; a triangle across
      // that line would sweep through s = 0 and draw a false, speckled crease. The real
      // wrinkles are gone by 7 mm, so fade the weight out before the switch.
      const a = Math.min(1, Math.max(0, (Math.abs(s) - 0.005) / 0.0025));
      // likewise in the valley between two knuckles, where the wrinkles of neighbouring
      // fingers would meet out of step
      const b = Math.min(1, Math.max(0, (Math.sqrt(bd2) - Math.sqrt(bd)) / 0.0035));
      out[0] = s; out[1] = side; out[2] = best.weight * near * (1 - a * a * (3 - 2 * a)) * b * b * (3 - 2 * b);
    },
  };
}

class HandRig {
  constructor(mesh, bones, defsInfo, mirror) {
    this.mesh = mesh; this.bones = bones; this.mirror = mirror;
    this.fingerBones = defsInfo.fingerBones; this.thumbBones = defsInfo.thumbBones;
    this.rest = REST;
    this.restThumb = defsInfo.thumbRest;
    this._q = new THREE.Quaternion(); this._q2 = new THREE.Quaternion();
  }
  // Pose the skeleton (angles in right-hand space; mirrored for the left hand).
  setPose(pose) {
    const q = this._q, q2 = this._q2;
    for (const n of NAMES) {
      const ids = this.fingerBones[n];
      const rest = this.rest.fingers[n];
      const ch = fingerChain(n, rest, 0);
      const ds = (pose.spread?.[n] || 0) - (this.rest.spread[n] || 0);
      for (let s = 0; s < 3; s++) {
        q.setFromAxisAngle(ch.lat, -(pose.fingers[n][s] - rest[s]));
        if (s === 0) { q2.setFromAxisAngle(ch.up0, -ds); q.premultiply(q2); }
        this.setBone(ids[s], q);
      }
    }
    // thumb: carpometacarpal swing from the rest frame to the target frame, then flexion
    const rt = this.restThumb.frame, tf = thumbFrame(pose.thumb.a, pose.thumb.e, pose.thumb.roll);
    const Mr = new THREE.Matrix4().makeBasis(rt.dir, rt.nail, new THREE.Vector3().crossVectors(rt.dir, rt.nail).normalize());
    const Mt = new THREE.Matrix4().makeBasis(tf.dir, tf.nail, new THREE.Vector3().crossVectors(tf.dir, tf.nail).normalize());
    q.setFromRotationMatrix(Mt.multiply(Mr.transpose()));
    this.setBone(this.thumbBones[0], q);
    const lat = this.restThumb.lat;
    q.setFromAxisAngle(lat, -(pose.thumb.flex[0] - this.rest.thumb.flex[0])); this.setBone(this.thumbBones[1], q);
    q.setFromAxisAngle(lat, -(pose.thumb.flex[1] - this.rest.thumb.flex[1])); this.setBone(this.thumbBones[2], q);
  }
  setBone(i, q) {
    const b = this.bones[i];
    if (this.mirror) b.quaternion.set(q.x, -q.y, -q.z, q.w); else b.quaternion.copy(q);
  }
}

function buildHandRig(skin, h, mirror) {
  const info = buildSkeletonDefs(REST);
  const model = buildHandSDF(REST);
  const redPts = model.reds.map((p) => [p.x, p.y, p.z]);
  const sdf = model.sdf;
  const geo = meshSDF(sdf, [-0.075, -0.075, -0.17], [0.07, 0.06, 0.104], h, {
    attributes: {
      color: {
        size: 3, fn: (x, y, z, nx, ny, nz, out) => {
          const ao = Math.min(1, Math.max(0, sdf(x + nx * 0.0035, y + ny * 0.0035, z + nz * 0.0035) / 0.0035));
          let red = 0;
          for (const p of redPts) { const d2 = (x - p[0]) ** 2 + (y - p[1]) ** 2 + (z - p[2]) ** 2; red = Math.max(red, Math.exp(-d2 / 0.0001)); }
          const palmSide = Math.max(0, -ny);
          const a = 0.58 + 0.42 * Math.pow(ao, 0.7);
          // knuckles and fingertips flush pink, the palm is paler, the back a touch more tanned
          out[0] = a * (1.0 + red * 0.06 + palmSide * 0.16);
          out[1] = a * (1.0 - red * 0.15 + palmSide * 0.08 - Math.max(0, ny) * 0.03);
          out[2] = a * (1.0 - red * 0.17 + palmSide * 0.04 - Math.max(0, ny) * 0.05);
        },
      },
      aSkin: {
        size: 3, fn: (x, y, z, nx, ny, nz, out) => {
          const deep = -sdf(x - nx * 0.012, y - ny * 0.012, z - nz * 0.012);
          out[0] = 0; out[1] = Math.min(1, Math.max(0, 1 - deep / 0.011)); out[2] = 0;
        },
      },
      aNail: { size: 3, fn: (x, y, z, nx, ny, nz, out) => nailCoords(model.nails, x, y, z, nx, ny, nz, out) },
      aCrease: creaseAttribute(model.fingers),
    },
  });
  skinWeights(geo, model.palm, info.defs);
  if (mirror) {
    const p = geo.attributes.position, nr = geo.attributes.normal, cr = geo.attributes.aCrease;
    for (let i = 0; i < p.count; i++) { p.setX(i, -p.getX(i)); nr.setX(i, -nr.getX(i)); }
    void cr;
    const idx = geo.index.array;
    for (let i = 0; i < idx.length; i += 3) { const t = idx[i + 1]; idx[i + 1] = idx[i + 2]; idx[i + 2] = t; }
    geo.index.needsUpdate = true;
  }
  const bones = info.defs.map((d) => { const b = new THREE.Bone(); b.name = d.name; return b; });
  info.defs.forEach((d, i) => {
    const pos = d.pos.clone();
    if (d.parent >= 0) pos.sub(info.defs[d.parent].pos);
    if (mirror) pos.x = -pos.x;
    bones[i].position.copy(pos);
    if (d.parent >= 0) bones[d.parent].add(bones[i]);
  });
  const mesh = new THREE.SkinnedMesh(geo, skin);
  mesh.add(bones[0]);
  mesh.bind(new THREE.Skeleton(bones));
  mesh.castShadow = true; mesh.receiveShadow = true;
  mesh.frustumCulled = false;
  return new HandRig(mesh, bones, info, mirror);
}

// ------------------------------------------------------------------ cuffs, sleeves
function tube(r0x, r0y, z0, z1, th, fold = 0, flare = 0) {
  const zc = (z0 + z1) / 2, hl = (z1 - z0) / 2, rr = th * 0.5;
  return (x, y, z) => {
    const t = Math.min(1, Math.max(0, (z - z0) / (z1 - z0)));
    const ang = Math.atan2(y, x);
    const k = 1 + flare * t + fold * (Math.sin(ang * 3 + z * 60) * 0.5 + Math.sin(ang * 5 - z * 110) * 0.35 + Math.sin(z * 190 + ang) * 0.15);
    const rx = r0x * k, ry = r0y * k;
    const e = Math.hypot(x / rx, y / ry);
    const dr = Math.abs((e - 1) * Math.min(rx, ry)) - th * 0.5 + rr;
    const dz = Math.abs(z - zc) - hl + rr;
    return Math.hypot(Math.max(dr, 0), Math.max(dz, 0)) + Math.min(Math.max(dr, dz), 0) - rr;
  };
}
// the shirt cuff round the wrist; the jacket sleeve over it is drawn by the body (body.js)
function meshCuff(h = 0.0022) {
  const cuffT = tube(0.0318, 0.0255, 0.043, 0.09, 0.0032, 0.0, 0.05);
  return meshSDF(cuffT, [-0.05, -0.045, 0.035], [0.05, 0.045, 0.1], h);
}
const cuffMaterial = () => new THREE.MeshPhysicalMaterial({ color: '#f2efe8', roughness: 0.7, sheen: 0.5, sheenColor: new THREE.Color('#ffffff'), sheenRoughness: 0.6 });

// ------------------------------------------------------------------ watch and ring
function watchDial() {
  return canvasTexture(256, 256, (ctx, w) => {
    const c = w / 2;
    const g = ctx.createRadialGradient(c, c * 0.85, 10, c, c, c);
    g.addColorStop(0, '#fbf6e8'); g.addColorStop(1, '#e8dcc0');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(c, c, c, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#1d1a16'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    const R = ['XII', 'I', 'II', 'III', 'IIII', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI'];
    ctx.font = '600 24px Georgia, serif';
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2 - Math.PI / 2;
      ctx.save(); ctx.translate(c + Math.cos(a) * c * 0.72, c + Math.sin(a) * c * 0.72); ctx.rotate(a + Math.PI / 2);
      ctx.fillText(R[i], 0, 0); ctx.restore();
    }
    ctx.strokeStyle = '#1d1a16';
    for (let i = 0; i < 60; i++) {
      const a = (i / 60) * Math.PI * 2;
      ctx.lineWidth = i % 5 ? 1.2 : 2.4;
      ctx.beginPath(); ctx.moveTo(c + Math.cos(a) * c * 0.88, c + Math.sin(a) * c * 0.88); ctx.lineTo(c + Math.cos(a) * c * 0.94, c + Math.sin(a) * c * 0.94); ctx.stroke();
    }
    ctx.font = 'italic 15px Georgia, serif'; ctx.fillText('Hollingmere', c, c * 0.62);
    ctx.font = '11px Georgia, serif'; ctx.fillText('LONDON', c, c * 1.42);
  });
}
function makeWatch() {
  const g = new THREE.Group();
  const gold = new THREE.MeshStandardMaterial({ color: '#e0b765', metalness: 1, roughness: 0.18 });
  const caseG = new THREE.LatheGeometry([[0, -0.004], [0.0162, -0.004], [0.0172, -0.001], [0.0172, 0.002], [0.0158, 0.004], [0, 0.004]].map(([a, b]) => new THREE.Vector2(a, b)), 40);
  const caseM = new THREE.Mesh(caseG, gold);
  const dial = new THREE.Mesh(new THREE.CircleGeometry(0.0149, 40), new THREE.MeshStandardMaterial({ map: watchDial(), roughness: 0.4 }));
  dial.rotation.x = -Math.PI / 2; dial.position.y = 0.0041;
  const crystal = new THREE.Mesh(new THREE.SphereGeometry(0.0156, 32, 8, 0, Math.PI * 2, 0, 0.45), new THREE.MeshPhysicalMaterial({ color: '#ffffff', roughness: 0, transparent: true, opacity: 0.1, envMapIntensity: 2 }));
  crystal.scale.y = 0.3; crystal.position.y = 0.0035;
  const crown = new THREE.Mesh(new THREE.CylinderGeometry(0.0025, 0.0025, 0.004, 12), gold);
  crown.rotation.z = Math.PI / 2; crown.position.set(0.0185, 0, 0);
  g.add(caseM, dial, crystal, crown);
  const handMat = new THREE.MeshStandardMaterial({ color: '#0d0c0b', roughness: 0.4, metalness: 0.5 });
  const mk = (len, wid) => { const p = new THREE.Group(); const m = new THREE.Mesh(new THREE.BoxGeometry(wid, 0.0006, len).translate(0, 0, -len / 2 + 0.002), handMat); p.add(m); p.position.y = 0.0046; g.add(p); return p; };
  const hourH = mk(0.009, 0.0016), minH = mk(0.0128, 0.0011), secH = mk(0.0138, 0.0004);
  secH.children[0].material = new THREE.MeshStandardMaterial({ color: '#8d1b12', roughness: 0.4 });
  g.userData.hands = { hourH, minH, secH };
  return g;
}
function tickWatch(watch) {
  const now = new Date();
  const s = now.getSeconds() + now.getMilliseconds() / 1000;
  const m = now.getMinutes() + s / 60, h = (now.getHours() % 12) + m / 60;
  const { hourH, minH, secH } = watch.userData.hands;
  hourH.rotation.y = -(h / 12) * Math.PI * 2;
  minH.rotation.y = -(m / 60) * Math.PI * 2;
  secH.rotation.y = -(Math.floor(s) / 60) * Math.PI * 2;
}

// Attach an object to a bone so it sits where `worldFrame` (hand space, given pose) says.
function attachToBone(rig, boneIdx, pose, posHand, quatHand, obj) {
  rig.setPose(pose);
  rig.mesh.updateMatrixWorld(true);
  const bone = rig.bones[boneIdx];
  const inv = new THREE.Matrix4().copy(rig.mesh.matrixWorld).invert().multiply(bone.matrixWorld).invert();
  const local = new THREE.Matrix4().compose(posHand, quatHand, new THREE.Vector3(1, 1, 1)).premultiply(inv);
  local.decompose(obj.position, obj.quaternion, obj.scale);
  bone.add(obj);
}

// ------------------------------------------------------------------ both hands
export class Hands {
  constructor({ quality, tone = '#b8805c' }) {
    const h = quality.handRes || (quality.treeDetail >= 1 ? 0.00135 : quality.treeDetail >= 0.7 ? 0.0016 : 0.002);
    this.skin = skinMaterial(tone);
    const cuffMat = cuffMaterial();
    const cuff = meshCuff(h * 1.3);
    this.poses = {
      wheel: POSES.wheel(), wheelCigar: POSES.wheelCigar(), bottle: POSES.bottle(), open: POSES.open(), cigarLips: POSES.cigarLips(),
    };
    const make = (mirror) => {
      const rig = buildHandRig(this.skin, h, mirror);
      const group = new THREE.Group();
      group.add(rig.mesh, new THREE.Mesh(cuff, cuffMat));
      group.scale.setScalar(HAND_SCALE);
      group.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; o.frustumCulled = false; } });
      return { rig, group };
    };
    const R = make(false), L = make(true);
    this.right = R.group; this.rightRig = R.rig;
    this.left = L.group; this.leftRig = L.rig;
    this.right.name = 'right-hand'; this.left.name = 'left-hand';

    // signet ring on the right little finger
    const gold = new THREE.MeshStandardMaterial({ color: '#e3b866', metalness: 1, roughness: 0.2 });
    {
      const p = this.poses.wheelCigar;
      const ch = fingerChain('little', p.fingers.little, p.spread.little);
      const pos = ch.joints[0].clone().lerp(ch.joints[1], 0.42);
      const ring = new THREE.Group();
      const band = new THREE.Mesh(new THREE.TorusGeometry(FINGERS.little.r[0] * 0.93 + 0.0011, 0.0015, 10, 32), gold);
      const seal = new THREE.Mesh(new THREE.CylinderGeometry(0.0042, 0.0042, 0.0022, 20).rotateX(Math.PI / 2).translate(0, FINGERS.little.r[0] + 0.0012, 0), gold);
      seal.rotation.x = -Math.PI / 2;
      ring.add(band, seal);
      const q = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(new THREE.Vector3().crossVectors(ch.ups[0], ch.dirs[0]).normalize(), ch.ups[0], ch.dirs[0]));
      band.rotation.set(0, 0, 0);
      attachToBone(this.rightRig, this.rightRig.fingerBones.little[0], p, pos, q, ring);
    }
    // the cigar: between index and middle, a third of the way along their first phalanges,
    // lit end out past the back of the hand and leaning towards the fingertips
    {
      const p = this.poses.wheelCigar;
      const ix = fingerChain('index', p.fingers.index, p.spread.index), md = fingerChain('middle', p.fingers.middle, p.spread.middle);
      const a = ix.joints[0].clone().lerp(ix.joints[1], 0.36), b = md.joints[0].clone().lerp(md.joints[1], 0.36);
      const pos = a.clone().lerp(b, 0.5);
      const up = ix.ups[0].clone().lerp(md.ups[0], 0.5).normalize();
      const along = ix.dirs[0].clone().lerp(md.dirs[0], 0.5).normalize();
      const axis = up.clone().multiplyScalar(0.86).addScaledVector(along, 0.42).addScaledVector(new THREE.Vector3(-1, 0, 0), 0.12).normalize();
      this.cigarAnchor = new THREE.Object3D();
      // anchor +Z runs along the cigar from its head to the lit end
      const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), axis);
      attachToBone(this.rightRig, this.rightRig.fingerBones.index[0], p, pos, q, this.cigarAnchor);
    }
    // the watch on the left wrist, its strap round it
    this.watch = makeWatch();
    this.watch.position.set(0, 0.0228, 0.036);
    this.watch.rotation.set(-0.08, Math.PI, 0);
    const strap = new THREE.Mesh(new THREE.TorusGeometry(1, 0.075, 8, 48), new THREE.MeshStandardMaterial({ color: '#4a2a16', roughness: 0.55 }));
    strap.scale.set(0.0292, 0.0222, 0.032);
    strap.position.set(0, -0.0005, 0.036);
    this.left.add(this.watch, strap);
    this.watch.traverse((o) => { if (o.isMesh) o.castShadow = true; });

    // grips in each hand's own space (mirrored for the left)
    const g = (p, mirror) => ({ c: new THREE.Vector3(p.grip.c[0] * (mirror ? -1 : 1), p.grip.c[1], p.grip.c[2]), R: p.grip.R, ax: new THREE.Vector3(p.grip.ax[0] * (mirror ? -1 : 1), p.grip.ax[1], p.grip.ax[2]) });
    this.grips = { rightWheel: g(this.poses.wheelCigar, false), leftWheel: g(this.poses.wheel, true), leftBottle: g(this.poses.bottle, true) };
    this.rightRig.setPose(this.poses.wheelCigar);
    this.leftRig.setPose(this.poses.wheel);
    this.poseL = lerpPose(this.poses.wheel, this.poses.wheel, 0);
    this.poseR = lerpPose(this.poses.wheelCigar, this.poses.wheelCigar, 0);
  }
  // blend between two named poses on a hand
  pose(hand, a, b, t) {
    const out = hand === 'left' ? this.poseL : this.poseR;
    lerpPose(this.poses[a], this.poses[b], Math.max(0, Math.min(1, t)), out);
    (hand === 'left' ? this.leftRig : this.rightRig).setPose(out);
  }
  update() { tickWatch(this.watch); }
}
