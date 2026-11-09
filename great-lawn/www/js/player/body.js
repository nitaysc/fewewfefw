// The driver himself, so the hands always belong to someone: a seated gentleman in a tweed
// jacket buttoned over a waistcoat, shirt and tie, flannel trousers and polished brogues on
// the footboards. His sleeves are rebuilt every frame from each wrist through a bent elbow
// (two-bone IK against a fixed shoulder) to the shoulder, so the arms run unbroken off the
// edge of the view whatever the hands are doing.
import * as THREE from '../../vendor/three.module.js';
import { superellipse } from '../core/geo.js';
import { tex } from '../core/textures.js';

const TILE = 0.075;                    // metres of cloth per texture repeat
const UPPER = 0.31, FORE = 0.27;       // shoulder -> elbow, elbow -> the sleeve's end
const SLEEVE_Z = 0.072;                // the sleeve's end along the forearm, in hand space
// mower-space anchors; the eye is at (0, 1.39, 0.22), the seat top at y 0.715 and the
// footboards (y 0.36) at x = +-0.4
export const SHOULDER = { right: new THREE.Vector3(0.185, 1.17, 0.34), left: new THREE.Vector3(-0.185, 1.17, 0.34) };

const _v = new THREE.Vector3(), _w = new THREE.Vector3(), _q = new THREE.Quaternion();

// A tube of rings (each `nRad` points, the first repeated for the texture seam).
class RingMesh {
  constructor(nRings, nRad, material, { dynamic = false } = {}) {
    this.nRings = nRings; this.nRad = nRad;
    const nV = nRings * (nRad + 1);
    const geo = new THREE.BufferGeometry();
    this.pos = new THREE.BufferAttribute(new Float32Array(nV * 3), 3);
    this.uv = new THREE.BufferAttribute(new Float32Array(nV * 2), 2);
    if (dynamic) { this.pos.setUsage(THREE.DynamicDrawUsage); }
    geo.setAttribute('position', this.pos);
    geo.setAttribute('uv', this.uv);
    const idx = [];
    for (let i = 0; i < nRings - 1; i++) {
      for (let j = 0; j < nRad; j++) {
        const a = i * (nRad + 1) + j, b = a + 1, c = a + nRad + 1, d = c + 1;
        idx.push(a, b, c, b, d, c);
      }
    }
    geo.setIndex(idx);
    this.geo = geo;
    this.mesh = new THREE.Mesh(geo, material);
    this.mesh.castShadow = true; this.mesh.receiveShadow = true;
  }
  // rings[i][j]: Vector3; v[i]: distance along the tube; perim: metres round
  set(rings, v, perim) {
    const { nRad } = this, P = this.pos.array, U = this.uv.array;
    let k = 0;
    for (let i = 0; i < rings.length; i++) {
      for (let j = 0; j <= nRad; j++) {
        const p = rings[i][j % nRad];
        P[k * 3] = p.x; P[k * 3 + 1] = p.y; P[k * 3 + 2] = p.z;
        U[k * 2] = (j / nRad) * perim / TILE; U[k * 2 + 1] = v[i] / TILE;
        k++;
      }
    }
    this.pos.needsUpdate = true; this.uv.needsUpdate = true;
    this.geo.computeVertexNormals();
    // close the seam: the repeated first column shares its normals
    const N = this.geo.attributes.normal.array;
    for (let i = 0; i < rings.length; i++) {
      const a = i * (nRad + 1), b = a + nRad;
      for (let c = 0; c < 3; c++) { const m = (N[a * 3 + c] + N[b * 3 + c]) / 2; N[a * 3 + c] = N[b * 3 + c] = m; }
    }
    this.geo.attributes.normal.needsUpdate = true;
    this.geo.computeBoundingSphere();
  }
}

// Rotation-minimising frames along a polyline, starting from `n0` (made perpendicular).
function frames(pts, n0) {
  const n = pts.length, T = [], N = [], B = [];
  for (let i = 0; i < n; i++) {
    const a = pts[Math.max(0, i - 1)], b = pts[Math.min(n - 1, i + 1)];
    T.push(b.clone().sub(a).normalize());
  }
  N.push(n0.clone().addScaledVector(T[0], -n0.dot(T[0])).normalize());
  for (let i = 1; i < n; i++) {
    _q.setFromUnitVectors(T[i - 1], T[i]);
    const m = N[i - 1].clone().applyQuaternion(_q);
    m.addScaledVector(T[i], -m.dot(T[i])).normalize();
    N.push(m);
  }
  for (let i = 0; i < n; i++) B.push(new THREE.Vector3().crossVectors(T[i], N[i]));
  return { T, N, B };
}

// Points along a cubic Bezier (excluding the end point).
function bezier(p0, p1, p2, p3, count, out) {
  for (let k = 0; k < count; k++) {
    const t = k / count, u = 1 - t;
    out.push(new THREE.Vector3()
      .addScaledVector(p0, u * u * u).addScaledVector(p1, 3 * u * u * t)
      .addScaledVector(p2, 3 * u * t * t).addScaledVector(p3, t * t * t));
  }
}

// Piecewise-linear lookup: keys [[s, value], ...]
function keyed(keys, s) {
  if (s <= keys[0][0]) return keys[0][1];
  for (let i = 1; i < keys.length; i++) {
    if (s <= keys[i][0]) { const [s0, a] = keys[i - 1], [s1, b] = keys[i]; return a + (b - a) * (s - s0) / (s1 - s0); }
  }
  return keys[keys.length - 1][1];
}

function ringAt(c, N, B, rx, ry, nRad, fold) {
  const r = [];
  for (let j = 0; j < nRad; j++) {
    const t = (j / nRad) * Math.PI * 2;
    const k = fold ? 1 + fold(t) : 1;
    r.push(c.clone().addScaledVector(N, Math.cos(t) * rx * k).addScaledVector(B, Math.sin(t) * ry * k));
  }
  return r;
}

// Two-bone IK. The elbow sits on the circle where an upper arm from the shoulder S and a
// forearm from the wrist W both reach, on the side the forearm already points (F, from the
// wrist towards the elbow), leaning towards `pole` so it never flips up or inwards. Out of
// reach, the arm runs straight along the line.
export function solveElbow(S, W, F, pole, out = new THREE.Vector3(), upper = UPPER, fore = FORE) {
  const d0 = W.distanceTo(S);
  const axis = W.clone().sub(S).normalize();
  if (d0 > upper + fore - 0.002) return out.copy(S).addScaledVector(axis, d0 * upper / (upper + fore));
  const d = Math.max(d0, Math.abs(upper - fore) + 0.01);
  const a = (upper * upper - fore * fore + d * d) / (2 * d);
  const h = Math.sqrt(Math.max(0, upper * upper - a * a));
  const want = W.clone().addScaledVector(F, fore).sub(S);
  want.addScaledVector(axis, -want.dot(axis));
  const p = pole.clone().addScaledVector(axis, -pole.dot(axis));
  if (p.lengthSq() > 1e-8) p.normalize();
  if (want.lengthSq() < 1e-6) want.copy(p); else want.normalize().addScaledVector(p, 0.35);
  if (want.lengthSq() < 1e-8) want.copy(p);
  want.normalize();
  return out.copy(S).addScaledVector(axis, a).addScaledVector(want, h);
}
export const ARM = { UPPER, FORE };

// ------------------------------------------------------------------ a sleeve from wrist to shoulder
const ARM_RAD = 22;
class Arm {
  constructor(side, material) {
    this.side = side;                  // +1 right, -1 left
    this.rm = new RingMesh(2 + 16 + 8 + 9, ARM_RAD, material, { dynamic: true });
    this.rm.mesh.frustumCulled = false;
    this.rm.mesh.name = side > 0 ? 'right-sleeve' : 'left-sleeve';
    this.elbow = new THREE.Vector3();
  }
  // rig: the hand rig's world matrix (carries the hand scale); S: shoulder (world);
  // pole: the way the elbow points (world)
  update(rig, S, pole) {
    const W = new THREE.Vector3(0, 0, SLEEVE_Z).applyMatrix4(rig);
    const F = new THREE.Vector3(0, 0, 1).transformDirection(rig);      // wrist -> elbow
    const X = new THREE.Vector3(1, 0, 0).transformDirection(rig);      // across the wrist
    const E = solveElbow(S, W, F, pole, this.elbow);

    const dE = E.clone().sub(W).normalize();          // along the forearm
    const dU = S.clone().sub(E).normalize();          // along the upper arm
    const lf = W.distanceTo(E), b = Math.min(0.06, lf * 0.25);
    // centre line: forearm (bending out of the wrist), elbow, upper arm
    const pts = [];
    const e0 = E.clone().addScaledVector(dE, -b), e1 = E.clone().addScaledVector(dU, b);
    bezier(W, W.clone().addScaledVector(F, Math.min(0.08, lf * 0.3)), e0.clone().addScaledVector(dE, -Math.min(0.07, lf * 0.25)), e0, 16, pts);
    for (let k = 0; k < 8; k++) {
      const t = k / 8, u = 1 - t;
      pts.push(new THREE.Vector3().addScaledVector(e0, u * u).addScaledVector(E, 2 * u * t).addScaledVector(e1, t * t));
    }
    const end = S.clone().addScaledVector(dU, 0.03);
    for (let k = 0; k <= 8; k++) pts.push(e1.clone().lerp(end, k / 8));
    const { N, B } = frames(pts, X);
    // arc length
    const s = [0];
    for (let i = 1; i < pts.length; i++) s.push(s[i - 1] + pts[i].distanceTo(pts[i - 1]));
    const sE = s[16 + 4];
    // the inside of the elbow, for the creases
    const inner = dU.clone().sub(dE);
    const rx = (q) => keyed([[0, 0.0485], [0.12, 0.0505], [sE, 0.055], [sE + 0.15, 0.058], [s[s.length - 1], 0.063]], q);
    const ry = (q) => rx(q) * keyed([[0, 0.87], [sE, 0.94], [s[s.length - 1], 0.97]], q);
    const rings = [], vs = [];
    // the hem: a lining tucked inside, then the folded edge
    const r0x = rx(0), r0y = ry(0);
    rings.push(ringAt(W.clone().addScaledVector(F, 0.016), N[0], B[0], r0x * 0.86, r0y * 0.86, ARM_RAD)); vs.push(-0.018);
    rings.push(ringAt(W.clone().addScaledVector(F, -0.002), N[0], B[0], r0x * 0.955, r0y * 0.955, ARM_RAD)); vs.push(-0.006);
    for (let i = 0; i < pts.length; i++) {
      const q = s[i];
      const ke = Math.exp(-Math.pow((q - sE) / 0.07, 2));
      const ia = Math.atan2(inner.dot(B[i]), inner.dot(N[i]));
      const fold = (t) => 0.03 * Math.sin(3 * t + q * 37 + this.side) + 0.018 * Math.sin(5 * t - q * 61 + 1.3)
        + 0.012 * Math.sin(7 * t + q * 90) + ke * 0.11 * Math.max(0, Math.cos(t - ia)) * Math.sin(q * 70);
      rings.push(ringAt(pts[i], N[i], B[i], rx(q), ry(q), ARM_RAD, fold)); vs.push(q);
    }
    this.rm.set(rings, vs, 0.33);
  }
}

// ------------------------------------------------------------------ materials
function clothMaterial(color, repeatScale = 1, normalScale = 1.1, { check = false } = {}) {
  const m = new THREE.MeshStandardMaterial({
    map: tex('tweed_diff', { repeat: [repeatScale, repeatScale] }), normalMap: tex('tweed_nor', { repeat: [repeatScale, repeatScale] }),
    color, roughness: 0.95, metalness: 0,
  });
  m.normalScale.set(normalScale, normalScale);
  if (check) m.onBeforeCompile = (sh) => overcheck(sh);
  m.userData.check = check;
  return m;
}
// a country tweed's rust overcheck, about every 4 cm, fading out before it can shimmer
function overcheck(sh) {
  sh.fragmentShader = sh.fragmentShader.replace('#include <map_fragment>', `#include <map_fragment>
    {
      vec2 cu = vMapUv * 1.9;
      vec2 fw = fwidth(cu);
      vec2 d = min(fract(cu), 1.0 - fract(cu));
      vec2 ln = (1.0 - smoothstep(vec2(0.018), vec2(0.04), d)) * (1.0 - smoothstep(vec2(0.05), vec2(0.12), fw));
      float l = max(ln.x, ln.y * 0.8);
      diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * vec3(1.45, 0.82, 0.62), 0.5 * l);
    }`);
}

// The jacket front: buttoned below the chest, opening in a V over a waistcoat, a white shirt
// and a silk tie; worked out per pixel from mower-space position.
function jacketFront(m) {
  m.onBeforeCompile = (sh) => {
    overcheck(sh);
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vBodyPos;\nvarying vec3 vBodyN;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvBodyPos = position;\nvBodyN = normal;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>
        varying vec3 vBodyPos; varying vec3 vBodyN;
        float gTie, gShirt, gVest, gEdge, gButton;
        void frontRegions() {
          vec3 p = vBodyPos;
          float front = smoothstep(-0.2, -0.55, normalize(vBodyN).z);
          float ax = abs(p.x);
          float vJ = 0.105 * clamp((p.y - 0.99) / 0.26, 0.0, 1.0);          // jacket opening
          float vW = 0.06 * clamp((p.y - 1.1) / 0.15, 0.0, 1.0);            // waistcoat opening
          float inJ = (1.0 - smoothstep(vJ - 0.002, vJ + 0.002, ax)) * step(0.99, p.y) * front;
          float inW = (1.0 - smoothstep(vW - 0.002, vW + 0.002, ax)) * step(1.1, p.y) * inJ;
          float tieW = 0.014 + 0.012 * clamp((1.25 - p.y) / 0.15, 0.0, 1.0);
          gTie = (1.0 - smoothstep(tieW - 0.0015, tieW + 0.0015, ax)) * inW;
          gShirt = inW - gTie;
          gVest = inJ - inW;
          gEdge = exp(-pow((ax - vJ) / 0.0035, 2.0)) * step(0.99, p.y) * front;
          float b1 = length(vec2(p.x, p.y - 0.975)), b2 = length(vec2(p.x, p.y - 0.885));
          float b3 = length(vec2(p.x, p.y - 1.035)), b4 = length(vec2(p.x, p.y - 1.075));
          gButton = front * max(max(1.0 - smoothstep(0.0085, 0.0095, b1), 1.0 - smoothstep(0.0085, 0.0095, b2)),
                                max(1.0 - smoothstep(0.0055, 0.0065, b3), 1.0 - smoothstep(0.0055, 0.0065, b4)) * inJ);
        }`)
      .replace('#include <color_fragment>', `#include <color_fragment>
        frontRegions();
        {
          vec3 tieC = vec3(0.32, 0.05, 0.07) * (0.85 + 0.15 * step(0.5, fract((vBodyPos.y + vBodyPos.x) * 90.0)));
          diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * vec3(0.55, 0.5, 0.45), gVest);
          diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.86, 0.85, 0.82), gShirt);
          diffuseColor.rgb = mix(diffuseColor.rgb, tieC, gTie);
          diffuseColor.rgb *= 1.0 - 0.45 * gEdge;
          diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.12, 0.07, 0.04), gButton);
        }`)
      .replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
        roughnessFactor = mix(roughnessFactor, 0.75, gShirt);
        roughnessFactor = mix(roughnessFactor, 0.42, gTie + gButton);`)
      .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
        normal = normalize(mix(normal, nonPerturbedNormal, clamp(gShirt + gTie + gButton, 0.0, 1.0)));`);
  };
  return m;
}

// ------------------------------------------------------------------ the seated body
function torsoGeometry(material) {
  const S = [
    // y, half-width, half-depth, centre z, exponent
    [0.70, 0.170, 0.130, 0.400, 2.6], [0.78, 0.172, 0.135, 0.390, 2.6], [0.86, 0.165, 0.132, 0.380, 2.5],
    [0.94, 0.165, 0.130, 0.370, 2.5], [1.02, 0.172, 0.130, 0.360, 2.6], [1.09, 0.186, 0.125, 0.355, 2.7],
    [1.145, 0.205, 0.110, 0.350, 2.8], [1.19, 0.203, 0.098, 0.350, 2.8], [1.225, 0.165, 0.085, 0.352, 2.6],
    [1.25, 0.085, 0.068, 0.360, 2.2], [1.268, 0.06, 0.055, 0.360, 2.0],
  ];
  const nRad = 40;
  const rm = new RingMesh(S.length + 1, nRad, material);
  const rings = [], vs = [];
  for (const [y, hw, hd, cz, n] of S) {
    const r = [];
    for (let j = 0; j < nRad; j++) {
      // start at the back so the texture seam is out of sight
      const t = (j / nRad) * Math.PI * 2 - Math.PI / 2;
      const [x, z] = superellipse(hw, hd, n, t);
      r.push(new THREE.Vector3(x, y, cz - z));
    }
    rings.push(r); vs.push(y);
  }
  // cap the collar
  rings.push(Array.from({ length: nRad }, () => new THREE.Vector3(0, 1.272, 0.36))); vs.push(1.3);
  rm.set(rings, vs, 1.0);
  return rm.mesh;
}

// a leg in trousers: hip -> knee -> ankle
function legGeometry(side, material) {
  const hip = new THREE.Vector3(0.095 * side, 0.795, 0.43);
  const knee = new THREE.Vector3(0.232 * side, 0.835, -0.025);
  const ankle = new THREE.Vector3(0.366 * side, 0.445, -0.098);
  const d1 = knee.clone().sub(hip).normalize(), d2 = ankle.clone().sub(knee).normalize();
  const k0 = knee.clone().addScaledVector(d1, -0.07), k1 = knee.clone().addScaledVector(d2, 0.07);
  const pts = [];
  for (let k = 0; k < 14; k++) pts.push(hip.clone().lerp(k0, k / 14));
  for (let k = 0; k < 8; k++) { const t = k / 8, u = 1 - t; pts.push(new THREE.Vector3().addScaledVector(k0, u * u).addScaledVector(knee, 2 * u * t).addScaledVector(k1, t * t)); }
  for (let k = 0; k <= 12; k++) pts.push(k1.clone().lerp(ankle, k / 12));
  const { N, B } = frames(pts, new THREE.Vector3(1, 0, 0));
  const s = [0];
  for (let i = 1; i < pts.length; i++) s.push(s[i - 1] + pts[i].distanceTo(pts[i - 1]));
  const sK = s[14 + 4], sEnd = s[s.length - 1];
  const nRad = 28;
  const rx = (q) => keyed([[0, 0.092], [0.12, 0.084], [sK - 0.08, 0.066], [sK, 0.062], [sK + 0.12, 0.058], [sEnd - 0.05, 0.05], [sEnd, 0.052]], q);
  const ry = (q) => rx(q) * keyed([[0, 0.86], [sK, 0.95], [sEnd, 1.0]], q);
  const rings = [], vs = [];
  for (let i = 0; i < pts.length; i++) {
    const q = s[i];
    const kk = Math.exp(-Math.pow((q - sK) / 0.08, 2));
    const fold = (t) => 0.015 * Math.sin(2 * t + q * 23 + side) + kk * 0.05 * Math.sin(q * 60 + t) * Math.max(0, -Math.sin(t));
    rings.push(ringAt(pts[i], N[i], B[i], rx(q), ry(q), nRad, fold)); vs.push(q);
  }
  // close the hem (hidden in the shoe)
  rings.push(Array.from({ length: nRad }, () => ankle.clone().addScaledVector(d2, 0.004))); vs.push(sEnd + 0.06);
  const rm = new RingMesh(rings.length, nRad, material);
  rm.set(rings, vs, 0.42);
  return rm.mesh;
}

// a brogue, sole on the footboard
function shoeGeometry(side, upperMat, soleMat) {
  const xc = 0.37 * side, y0 = 0.3725;
  const S = [
    // z, half-width, height, exponent
    [-0.058, 0.026, 0.07, 2.0], [-0.066, 0.034, 0.088, 2.3], [-0.08, 0.038, 0.097, 2.5], [-0.11, 0.041, 0.098, 2.6],
    [-0.155, 0.045, 0.082, 2.8], [-0.2, 0.048, 0.066, 3.0], [-0.25, 0.05, 0.053, 3.0], [-0.295, 0.047, 0.045, 2.7],
    [-0.328, 0.037, 0.038, 2.3], [-0.346, 0.024, 0.03, 2.1], [-0.355, 0.01, 0.02, 2.0],
  ];
  const nRad = 32;
  const make = (grow, yLift, hMax, mat) => {
    const rings = [], vs = [];
    rings.push(Array.from({ length: nRad }, () => new THREE.Vector3(xc, y0 + 0.03, S[0][0] + 0.004))); vs.push(-0.01);
    for (const [z, hw, h, n] of S) {
      const r = [];
      const hh = Math.min(h, hMax);
      for (let j = 0; j < nRad; j++) {
        const t = (j / nRad) * Math.PI * 2 - Math.PI / 2;
        const [x, y] = superellipse(hw + grow, hh / 2 + grow, n, t);
        r.push(new THREE.Vector3(xc - x, Math.max(y0 + yLift, y0 + yLift + hh / 2 + y), z));
      }
      rings.push(r); vs.push(-z);
    }
    rings.push(Array.from({ length: nRad }, () => new THREE.Vector3(xc, y0 + yLift + 0.006, S[S.length - 1][0] - 0.004))); vs.push(0.37);
    const rm = new RingMesh(rings.length, nRad, mat);
    rm.set(rings, vs, 0.3);
    return rm.mesh;
  };
  const upper = make(0, 0, 1, upperMat);
  const sole = make(0.003, -0.0125, 0.026, soleMat);
  return [upper, sole];
}

export class Body {
  constructor(game) {
    this.game = game;
    const root = game.mowerRoot;
    const tweed = '#c7a678';
    this.sleeveMat = clothMaterial(tweed, 1, 1.4, { check: true });
    this.arms = { right: new Arm(1, this.sleeveMat), left: new Arm(-1, this.sleeveMat) };
    game.scene.add(this.arms.right.rm.mesh, this.arms.left.rm.mesh);
    // the seated figure rides on the mower
    const jacket = jacketFront(clothMaterial(tweed, 1, 1.1));
    const trousers = clothMaterial('#8a8070', 1.6, 1.1);
    const leather = new THREE.MeshPhysicalMaterial({
      map: tex('leather_diff'), normalMap: tex('leather_nor'), color: '#7a4a2c',
      roughness: 0.42, clearcoat: 0.55, clearcoatRoughness: 0.3, sheen: 0.2, sheenColor: new THREE.Color('#ffd9b0'),
    });
    leather.normalScale.set(0.6, 0.6);
    const sole = new THREE.MeshStandardMaterial({ color: '#2a1a10', roughness: 0.7 });
    this.group = new THREE.Group();
    this.group.name = 'driver-body';
    this.group.add(torsoGeometry(jacket));
    for (const sd of [1, -1]) {
      this.group.add(legGeometry(sd, trousers));
      this.group.add(...shoeGeometry(sd, leather, sole));
    }
    root.add(this.group);
    this._S = new THREE.Vector3(); this._pole = new THREE.Vector3();
  }
  update(rightRig, leftRig) {
    const root = this.game.mowerRoot;
    root.updateMatrixWorld(true);
    for (const [name, rig, side] of [['right', rightRig, 1], ['left', leftRig, -1]]) {
      const S = this._S.copy(SHOULDER[name]).applyMatrix4(root.matrixWorld);
      // elbows hang down and a little out
      const pole = this._pole.set(0.65 * side, -1, 0.15).normalize().transformDirection(root.matrixWorld);
      rig.updateMatrixWorld(true);
      this.arms[name].update(rig.matrixWorld, S, pole);
    }
  }
}
