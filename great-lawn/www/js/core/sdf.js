// Signed distance modelling: primitives, smooth blending and a surface-nets mesher with
// sparse evaluation (only blocks near the surface are sampled finely).
import * as THREE from '../../vendor/three.module.js';

export const smin = (a, b, k) => {
  if (k <= 0) return Math.min(a, b);
  const h = Math.max(k - Math.abs(a - b), 0) / k;
  return Math.min(a, b) - h * h * k * 0.25;
};
export const smax = (a, b, k) => -smin(-a, -b, k);

// Round cone (capsule with different end radii), Inigo Quilez's exact formula.
export function roundCone(px, py, pz, a, b, r1, r2) {
  const bax = b[0] - a[0], bay = b[1] - a[1], baz = b[2] - a[2];
  const l2 = bax * bax + bay * bay + baz * baz;
  const rr = r1 - r2, a2 = l2 - rr * rr, il2 = 1 / l2;
  const pax = px - a[0], pay = py - a[1], paz = pz - a[2];
  const y = pax * bax + pay * bay + paz * baz;
  const z = y - l2;
  const xx = pax * l2 - bax * y, xy = pay * l2 - bay * y, xz = paz * l2 - baz * y;
  const x2 = xx * xx + xy * xy + xz * xz;
  const y2 = y * y * l2, z2 = z * z * l2;
  const k = Math.sign(rr) * rr * rr * x2;
  if (Math.sign(z) * a2 * z2 > k) return Math.sqrt(x2 + z2) * il2 - r2;
  if (Math.sign(y) * a2 * y2 < k) return Math.sqrt(x2 + y2) * il2 - r1;
  return (Math.sqrt(x2 * a2 * il2) + y * rr) * il2 - r1;
}

export function capsule(px, py, pz, a, b, r) {
  const bax = b[0] - a[0], bay = b[1] - a[1], baz = b[2] - a[2];
  const pax = px - a[0], pay = py - a[1], paz = pz - a[2];
  let h = (pax * bax + pay * bay + paz * baz) / (bax * bax + bay * bay + baz * baz);
  h = h < 0 ? 0 : h > 1 ? 1 : h;
  const dx = pax - bax * h, dy = pay - bay * h, dz = paz - baz * h;
  return Math.sqrt(dx * dx + dy * dy + dz * dz) - r;
}

// Ellipsoid (approximate distance, good near the surface)
export function ellipsoid(px, py, pz, c, r) {
  const x = (px - c[0]) / r[0], y = (py - c[1]) / r[1], z = (pz - c[2]) / r[2];
  const k0 = Math.sqrt(x * x + y * y + z * z);
  const x1 = x / r[0], y1 = y / r[1], z1 = z / r[2];
  const k1 = Math.sqrt(x1 * x1 + y1 * y1 + z1 * z1);
  return k1 > 0 ? (k0 * (k0 - 1)) / k1 : -Math.min(r[0], r[1], r[2]);
}

// Box with rounded edges in a local frame: o = centre, axes ex, ey, ez (unit), half sizes h, rounding r
export function orientedRoundBox(px, py, pz, o, ex, ey, ez, h, r) {
  const dx = px - o[0], dy = py - o[1], dz = pz - o[2];
  const lx = Math.abs(dx * ex[0] + dy * ex[1] + dz * ex[2]) - h[0] + r;
  const ly = Math.abs(dx * ey[0] + dy * ey[1] + dz * ey[2]) - h[1] + r;
  const lz = Math.abs(dx * ez[0] + dy * ez[1] + dz * ez[2]) - h[2] + r;
  const mx = Math.max(lx, 0), my = Math.max(ly, 0), mz = Math.max(lz, 0);
  return Math.sqrt(mx * mx + my * my + mz * mz) + Math.min(Math.max(lx, ly, lz), 0) - r;
}

// Surface nets. sdf(x,y,z) -> distance. Returns a BufferGeometry (position, normal, + attributes).
export function meshSDF(sdf, min, max, h, { attributes } = {}) {
  const nx = Math.ceil((max[0] - min[0]) / h) + 1;
  const ny = Math.ceil((max[1] - min[1]) / h) + 1;
  const nz = Math.ceil((max[2] - min[2]) / h) + 1;
  const N = nx * ny * nz;
  const vals = new Float32Array(N);
  const id = (i, j, k) => i + nx * (j + ny * k);
  const X = (i) => min[0] + i * h, Y = (j) => min[1] + j * h, Z = (k) => min[2] + k * h;

  // --- sparse evaluation in blocks of B^3 fine cells ---
  const B = 4;
  const cx = Math.ceil((nx - 1) / B), cy = Math.ceil((ny - 1) / B), cz = Math.ceil((nz - 1) / B);
  const reach = B * h * Math.sqrt(3) * 1.25;
  for (let bk = 0; bk < cz; bk++) for (let bj = 0; bj < cy; bj++) for (let bi = 0; bi < cx; bi++) {
    const i0 = bi * B, j0 = bj * B, k0 = bk * B;
    const i1 = Math.min(i0 + B, nx - 1), j1 = Math.min(j0 + B, ny - 1), k1 = Math.min(k0 + B, nz - 1);
    const dc = sdf(X((i0 + i1) / 2), Y((j0 + j1) / 2), Z((k0 + k1) / 2));
    if (Math.abs(dc) > reach) {
      for (let k = k0; k <= k1; k++) for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
        const q = id(i, j, k);
        if (vals[q] === 0) vals[q] = dc; // keep any finely evaluated neighbour value
      }
      continue;
    }
    for (let k = k0; k <= k1; k++) for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
      vals[id(i, j, k)] = sdf(X(i), Y(j), Z(k)) || 1e-7;
    }
  }

  // --- one vertex per cell with a sign change ---
  const cellVert = new Int32Array((nx - 1) * (ny - 1) * (nz - 1)).fill(-1);
  const cid = (i, j, k) => i + (nx - 1) * (j + (ny - 1) * k);
  const pos = [];
  const corner = [[0, 0, 0], [1, 0, 0], [0, 1, 0], [1, 1, 0], [0, 0, 1], [1, 0, 1], [0, 1, 1], [1, 1, 1]];
  const edges = [[0, 1], [2, 3], [4, 5], [6, 7], [0, 2], [1, 3], [4, 6], [5, 7], [0, 4], [1, 5], [2, 6], [3, 7]];
  const v = new Float32Array(8);
  for (let k = 0; k < nz - 1; k++) for (let j = 0; j < ny - 1; j++) for (let i = 0; i < nx - 1; i++) {
    let mask = 0;
    for (let c = 0; c < 8; c++) {
      const [a, b, d] = corner[c];
      v[c] = vals[id(i + a, j + b, k + d)];
      if (v[c] < 0) mask |= 1 << c;
    }
    if (mask === 0 || mask === 255) continue;
    let sx = 0, sy = 0, sz = 0, n = 0;
    for (const [e0, e1] of edges) {
      const a0 = v[e0], a1 = v[e1];
      if ((a0 < 0) === (a1 < 0)) continue;
      const t = a0 / (a0 - a1);
      const p0 = corner[e0], p1 = corner[e1];
      sx += p0[0] + (p1[0] - p0[0]) * t; sy += p0[1] + (p1[1] - p0[1]) * t; sz += p0[2] + (p1[2] - p0[2]) * t;
      n++;
    }
    cellVert[cid(i, j, k)] = pos.length / 3;
    pos.push(X(i) + (sx / n) * h, Y(j) + (sy / n) * h, Z(k) + (sz / n) * h);
  }

  // --- quads across every grid edge with a sign change ---
  const idx = [];
  const quad = (a, b, c, d, flip) => {
    if (a < 0 || b < 0 || c < 0 || d < 0) return;
    if (flip) idx.push(a, b, c, a, c, d); else idx.push(a, c, b, a, d, c);
  };
  for (let k = 1; k < nz - 1; k++) for (let j = 1; j < ny - 1; j++) for (let i = 0; i < nx - 1; i++) {
    const a = vals[id(i, j, k)], b = vals[id(i + 1, j, k)];
    if ((a < 0) === (b < 0)) continue;
    quad(cellVert[cid(i, j - 1, k - 1)], cellVert[cid(i, j, k - 1)], cellVert[cid(i, j, k)], cellVert[cid(i, j - 1, k)], a < 0);
  }
  for (let k = 1; k < nz - 1; k++) for (let j = 0; j < ny - 1; j++) for (let i = 1; i < nx - 1; i++) {
    const a = vals[id(i, j, k)], b = vals[id(i, j + 1, k)];
    if ((a < 0) === (b < 0)) continue;
    quad(cellVert[cid(i - 1, j, k - 1)], cellVert[cid(i - 1, j, k)], cellVert[cid(i, j, k)], cellVert[cid(i, j, k - 1)], a < 0);
  }
  for (let k = 0; k < nz - 1; k++) for (let j = 1; j < ny - 1; j++) for (let i = 1; i < nx - 1; i++) {
    const a = vals[id(i, j, k)], b = vals[id(i, j, k + 1)];
    if ((a < 0) === (b < 0)) continue;
    quad(cellVert[cid(i - 1, j - 1, k)], cellVert[cid(i, j - 1, k)], cellVert[cid(i, j, k)], cellVert[cid(i - 1, j, k)], a < 0);
  }

  // --- project vertices onto the surface, normals from the gradient ---
  const e = h * 0.35;
  const P = new Float32Array(pos), Nr = new Float32Array(pos.length);
  const grad = (x, y, z, out) => {
    out[0] = sdf(x + e, y, z) - sdf(x - e, y, z);
    out[1] = sdf(x, y + e, z) - sdf(x, y - e, z);
    out[2] = sdf(x, y, z + e) - sdf(x, y, z - e);
    const l = Math.hypot(out[0], out[1], out[2]) || 1;
    out[0] /= l; out[1] /= l; out[2] /= l;
  };
  const g = [0, 0, 0];
  for (let q = 0; q < P.length; q += 3) {
    let x = P[q], y = P[q + 1], z = P[q + 2];
    for (let it = 0; it < 2; it++) {
      const d = sdf(x, y, z);
      grad(x, y, z, g);
      const s = Math.max(-h, Math.min(h, d));
      x -= g[0] * s; y -= g[1] * s; z -= g[2] * s;
    }
    P[q] = x; P[q + 1] = y; P[q + 2] = z;
    grad(x, y, z, g);
    Nr[q] = g[0]; Nr[q + 1] = g[1]; Nr[q + 2] = g[2];
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(P, 3));
  geo.setAttribute('normal', new THREE.BufferAttribute(Nr, 3));
  if (attributes) {
    for (const [name, { size, fn }] of Object.entries(attributes)) {
      const arr = new Float32Array((P.length / 3) * size);
      const out = new Array(size).fill(0);
      for (let q = 0, w = 0; q < P.length; q += 3, w += size) {
        fn(P[q], P[q + 1], P[q + 2], Nr[q], Nr[q + 1], Nr[q + 2], out);
        for (let s = 0; s < size; s++) arr[w + s] = out[s];
      }
      geo.setAttribute(name, new THREE.BufferAttribute(arr, size));
    }
  }
  geo.setIndex(P.length / 3 > 65535 ? new THREE.Uint32BufferAttribute(idx, 1) : new THREE.Uint16BufferAttribute(idx, 1));
  geo.computeBoundingSphere();
  return geo;
}
