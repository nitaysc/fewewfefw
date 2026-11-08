// Geometry helpers for the hand-built models: lofts, lathes, merges.
import * as THREE from '../../vendor/three.module.js';
import { mergeGeometries } from '../../vendor/BufferGeometryUtils.js';

// Superellipse point (|x/a|^n + |y/b|^n = 1), t in [0, 2pi)
export function superellipse(a, b, n, t) {
  const c = Math.cos(t), s = Math.sin(t);
  return [a * Math.sign(c) * Math.pow(Math.abs(c), 2 / n), b * Math.sign(s) * Math.pow(Math.abs(s), 2 / n)];
}

// Loft through cross-sections. sections: [{ z, pts: [[x,y], ...] }] (same point count, closed loop).
export function loft(sections, { closeStart = false, closeEnd = false } = {}) {
  const n = sections[0].pts.length, m = sections.length;
  const pos = [], uv = [], idx = [];
  // arc length along each section for u
  for (let j = 0; j < m; j++) {
    const s = sections[j];
    let acc = 0; const lens = [0];
    for (let i = 1; i <= n; i++) {
      const a = s.pts[i - 1], b = s.pts[i % n];
      acc += Math.hypot(b[0] - a[0], b[1] - a[1]); lens.push(acc);
    }
    for (let i = 0; i <= n; i++) {
      const p = s.pts[i % n];
      pos.push(p[0], p[1], s.z);
      uv.push(lens[i] / acc, j / (m - 1));
    }
  }
  for (let j = 0; j < m - 1; j++) for (let i = 0; i < n; i++) {
    const a = j * (n + 1) + i, b = a + 1, c = a + (n + 1), d = c + 1;
    idx.push(a, b, c, b, d, c);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  const caps = [];
  const cap = (j, flip) => {
    const s = sections[j];
    const shape = new THREE.Shape(s.pts.map((p) => new THREE.Vector2(p[0], p[1])));
    const cg = new THREE.ShapeGeometry(shape, 1);
    cg.translate(0, 0, s.z);
    if (flip) cg.scale(1, 1, 1), cg.index && cg.index.array.reverse();
    caps.push(cg);
  };
  if (closeStart) cap(0, true);
  if (closeEnd) cap(m - 1, false);
  let out = g.toNonIndexed();
  out.computeVertexNormals();
  if (caps.length) out = mergeGeometries([out, ...caps.map((c) => { const t = c.toNonIndexed(); t.computeVertexNormals(); return t; })]);
  return out;
}

// Smooth-shaded loft (shares vertices so normals are smooth across the surface).
export function loftSmooth(sections) {
  const n = sections[0].pts.length, m = sections.length;
  const pos = [], uv = [], idx = [];
  for (let j = 0; j < m; j++) {
    const s = sections[j];
    for (let i = 0; i <= n; i++) {
      const p = s.pts[i % n];
      pos.push(p[0], p[1], s.z);
      uv.push(i / n, j / (m - 1));
    }
  }
  // sections must be counter-clockwise seen from +z; flip the winding when z decreases
  const flip = sections[m - 1].z < sections[0].z;
  for (let j = 0; j < m - 1; j++) for (let i = 0; i < n; i++) {
    const a = j * (n + 1) + i, b = a + 1, c = a + (n + 1), d = c + 1;
    if (flip) idx.push(a, c, b, b, c, d); else idx.push(a, b, c, b, d, c);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  // weld the seam normals (first and last column share positions)
  const nr = g.attributes.normal;
  for (let j = 0; j < m; j++) {
    const a = j * (n + 1), b = a + n;
    const x = nr.getX(a) + nr.getX(b), y = nr.getY(a) + nr.getY(b), z = nr.getZ(a) + nr.getZ(b);
    const l = Math.hypot(x, y, z) || 1;
    nr.setXYZ(a, x / l, y / l, z / l); nr.setXYZ(b, x / l, y / l, z / l);
  }
  return g;
}

// Lathe around Y from a profile of [radius, y] pairs.
export function lathe(profile, segments = 32, phiStart = 0, phiLength = Math.PI * 2) {
  return new THREE.LatheGeometry(profile.map(([r, y]) => new THREE.Vector2(r, y)), segments, phiStart, phiLength);
}

// Ensure every geometry has the same attribute set, then merge.
export function merge(geos) {
  const list = geos.filter(Boolean).map((g) => {
    let x = g.index ? g.toNonIndexed() : g;
    if (!x.attributes.normal) x.computeVertexNormals();
    if (!x.attributes.uv) x.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(x.attributes.position.count * 2), 2));
    for (const k of Object.keys(x.attributes)) if (!['position', 'normal', 'uv'].includes(k)) x.deleteAttribute(k);
    return x;
  });
  return list.length ? mergeGeometries(list) : null;
}

// Collects geometries per material, then builds one mesh per material.
export class Kit {
  constructor() { this.parts = new Map(); }
  add(mat, geo, matrix) {
    if (matrix) geo.applyMatrix4(matrix);
    if (!this.parts.has(mat)) this.parts.set(mat, []);
    this.parts.get(mat).push(geo);
    return geo;
  }
  build(group, { castShadow = true, receiveShadow = true } = {}) {
    for (const [mat, geos] of this.parts) {
      const g = merge(geos);
      if (!g) continue;
      const mesh = new THREE.Mesh(g, mat);
      mesh.castShadow = castShadow; mesh.receiveShadow = receiveShadow;
      group.add(mesh);
    }
    this.parts.clear();
    return group;
  }
}

export const M4 = {
  t: (x, y, z) => new THREE.Matrix4().makeTranslation(x, y, z),
  rx: (a) => new THREE.Matrix4().makeRotationX(a),
  ry: (a) => new THREE.Matrix4().makeRotationY(a),
  rz: (a) => new THREE.Matrix4().makeRotationZ(a),
  s: (x, y, z) => new THREE.Matrix4().makeScale(x, y ?? x, z ?? x),
  // compose left-to-right: M4.c(a, b, c) applies c first, then b, then a
  c: (...ms) => ms.reduce((acc, m) => acc.multiply(m), new THREE.Matrix4()),
};

// Orient a geometry built along +Y so it runs from a to b.
export function between(geo, a, b) {
  const d = new THREE.Vector3().subVectors(b, a);
  const len = d.length();
  const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize());
  const m = new THREE.Matrix4().compose(a.clone().addScaledVector(d, len / 2), q, new THREE.Vector3(1, 1, 1));
  return { geo, len, m };
}
