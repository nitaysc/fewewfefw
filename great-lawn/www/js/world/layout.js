// The estate plan. One source of truth for where everything is:
//  - analytic terrain height
//  - masks rasterised from simple shapes (gravel, grass, paving, beds, solids, the Great Lawn)
//  - a signed distance field of the solids for smooth collisions
// Coordinates: metres, x east, z south, y up. The house stands to the north.
import { clamp, smoothstep, fbm2, noise2, lerp } from '../core/util.js';

export const MAP = { min: -128, max: 128, size: 256, res: 1024 }; // mask covers [-128,128]^2
export const CELL = MAP.size / MAP.res;                            // 0.25 m

export const HOUSE = {
  main: { x0: -21, x1: 21, z0: -80, z1: -62 },
  portico: { x0: -8.4, x1: 8.4, z0: -62, z1: -56.6 },
  colonnades: [{ x0: -38, x1: -21, z0: -64, z1: -59 }, { x0: 21, x1: 38, z0: -64, z1: -59 }],
  pavilions: [{ x0: -54, x1: -38, z0: -72, z1: -56 }, { x0: 38, x1: 54, z0: -72, z1: -56 }],
  floor: 1.0,
};
export const LAWN = { x0: -67.2, x1: 64, z0: -25.2, z1: 68, r: 9 };
export const FORECOURT = { x0: -46, x1: 46, z0: -56, z1: -25 };
export const ISLAND = { x: 0, z: -40, r: 9.5, basin: 4.2 };
export const DRIVE = { x0: 44, x1: 126, z0: -44.5, z1: -35.5 };
export const HAHA = { z: 70, depth: 1.9, width: 5 };
export const HEDGES = [
  { x0: -70, x1: -67.6, z0: -24, z1: 70, h: 2.5 },          // west yew hedge
  { x0: 70.4, x1: 72.8, z0: -24, z1: 70, h: 2.5 },          // east yew hedge (behind the border)
  { x0: -70, x1: -46, z0: -27.2, z1: -25.4, h: 1.5 },        // low hedges closing the forecourt corners
  { x0: 46, x1: 72.8, z0: -27.2, z1: -25.4, h: 1.5 },
];
export const BORDER = { x0: 66.2, x1: 70.4, z0: -18, z1: 64 };   // herbaceous border along the east hedge
export const FEATURES = {
  cedar: { x: -33, z: 30, trunk: 1.15 },
  oak: { x: 46, z: 47, trunk: 0.9 },
  statue: { x: 0, z: 64.2, r: 1.25 },
  sundial: { x: 27, z: 14, r: 0.6 },
  urns: [{ x: -13, z: 64.6 }, { x: 13, z: 64.6 }, { x: -60.5, z: -20.5 }, { x: 60.5, z: -20.5 }],
  benches: [{ x: -66.7, z: 16, rot: Math.PI / 2 }, { x: -66.7, z: 40, rot: Math.PI / 2 }],
  topiary: [],
};
for (let z = -14; z <= 62; z += 12) FEATURES.topiary.push({ x: -66.5, z, kind: 'cone' });
export const START = { x: -46, z: -8, heading: -Math.PI / 2 + 0.25 }; // heading: 0 faces -z (north)

// ---------------------------------------------------------------- terrain
const lawnBlend = (x, z) => {
  // 1 inside the formal area (lawn, forecourt, drive), falling to 0 in the park
  const dx = Math.max(LAWN.x0 - 8 - x, 0, x - (LAWN.x1 + 10));
  const dzS = Math.max(0, z - HAHA.z);
  const dzN = Math.max(0, -95 - z);
  const d = Math.hypot(dx, dzN) + dzS * 3;
  return 1 - smoothstep(0, 18, d);
};

export function heightAt(x, z) {
  // gentle undulation everywhere
  let h = 0.16 * fbm2(x / 55, z / 55, 3) + 0.05 * noise2(x / 9, z / 9);
  const formal = lawnBlend(x, z);
  // park: rolling ground, rising away from the house
  const park = 1.6 * fbm2(x / 90 + 3.1, z / 90 - 1.7, 4) + Math.max(0, z - 90) * 0.035 + Math.max(0, Math.abs(x) - 90) * 0.03;
  h = lerp(park + 0.6, h, formal);
  // house plinth and terrace
  if (z < -55 && Math.abs(x) < 56) h = lerp(h, 0.0, smoothstep(-50, -57, z));
  // ha-ha: the lawn edge drops into a ditch, the far side ramps back up to the park
  if (z > HAHA.z - 0.5 && z < HAHA.z + 12 && Math.abs(x) < 120) {
    const t = z - HAHA.z;
    const ditch = t < 0.35 ? -HAHA.depth * smoothstep(-0.5, 0.35, t) : -HAHA.depth * (1 - smoothstep(0.5, HAHA.width + 3, t));
    h += ditch * (1 - smoothstep(100, 120, Math.abs(x)));
  }
  // far hills beyond the park
  const r = Math.hypot(x, z);
  if (r > 140) {
    const k = smoothstep(140, 700, r);
    h += k * (34 * fbm2(x / 520 + 7, z / 520 - 3, 4) + 26) + smoothstep(700, 2200, r) * 70;
  }
  return h;
}

export function normalAt(x, z, out) {
  const e = 0.35;
  const hx = heightAt(x + e, z) - heightAt(x - e, z);
  const hz = heightAt(x, z + e) - heightAt(x, z - e);
  out.set(-hx, 2 * e, -hz).normalize();
  return out;
}

// ---------------------------------------------------------------- masks
function rrect(ctx, x0, z0, x1, z1, r) {
  ctx.beginPath();
  ctx.moveTo(x0 + r, z0);
  ctx.arcTo(x1, z0, x1, z1, r); ctx.arcTo(x1, z1, x0, z1, r);
  ctx.arcTo(x0, z1, x0, z0, r); ctx.arcTo(x0, z0, x1, z0, r);
  ctx.closePath();
}

function makeCanvas() {
  const c = document.createElement('canvas');
  c.width = c.height = MAP.res;
  const ctx = c.getContext('2d', { willReadFrequently: true });
  ctx.fillStyle = '#000'; ctx.fillRect(0, 0, MAP.res, MAP.res);
  // world -> pixel transform
  const s = MAP.res / MAP.size;
  ctx.setTransform(s, 0, 0, s, -MAP.min * s, -MAP.min * s);
  ctx.fillStyle = '#fff'; ctx.strokeStyle = '#fff';
  return { c, ctx };
}
const channel = (ctx) => {
  const d = ctx.getImageData(0, 0, MAP.res, MAP.res).data;
  const out = new Uint8Array(MAP.res * MAP.res);
  for (let i = 0; i < out.length; i++) out[i] = d[i * 4];
  return out;
};

export function buildMasks() {
  // gravel
  const g = makeCanvas();
  rrect(g.ctx, FORECOURT.x0, FORECOURT.z0, FORECOURT.x1, FORECOURT.z1, 6); g.ctx.fill();
  g.ctx.fillRect(DRIVE.x0, DRIVE.z0, DRIVE.x1 - DRIVE.x0 + 10, DRIVE.z1 - DRIVE.z0);
  g.ctx.fillStyle = '#000'; g.ctx.beginPath(); g.ctx.arc(ISLAND.x, ISLAND.z, ISLAND.r, 0, Math.PI * 2); g.ctx.fill();
  // gravel paths along both hedges and across the lawn's foot, in front of the ha-ha
  g.ctx.fillStyle = '#fff';
  g.ctx.fillRect(LAWN.x1 + 0.6, -25.4, 1.6, 94);
  g.ctx.fillRect(-67.6, 68.2, 136.0, 1.3);
  // paving: the portico podium and the landing in front of it
  const p = makeCanvas();
  p.ctx.fillRect(HOUSE.portico.x0 - 3, HOUSE.portico.z0 - 1, HOUSE.portico.x1 - HOUSE.portico.x0 + 6, HOUSE.portico.z1 - HOUSE.portico.z0 + 3.2);
  p.ctx.fillRect(-56, -62, 112, 3);
  p.ctx.beginPath(); p.ctx.arc(ISLAND.x, ISLAND.z, ISLAND.basin + 0.7, 0, Math.PI * 2); p.ctx.fill();
  p.ctx.beginPath(); p.ctx.arc(FEATURES.statue.x, FEATURES.statue.z, 2.4, 0, Math.PI * 2); p.ctx.fill();
  p.ctx.beginPath(); p.ctx.arc(FEATURES.sundial.x, FEATURES.sundial.z, 1.5, 0, Math.PI * 2); p.ctx.fill();
  for (const u of FEATURES.urns) { p.ctx.fillRect(u.x - 1.1, u.z - 1.1, 2.2, 2.2); }
  // beds (soil)
  const b = makeCanvas();
  b.ctx.fillRect(BORDER.x0, BORDER.z0, BORDER.x1 - BORDER.x0, BORDER.z1 - BORDER.z0);
  b.ctx.fillRect(-46, -59.5, 25, 3.0); b.ctx.fillRect(21, -59.5, 25, 3.0);  // beds under the colonnades
  // grass: everything that is not gravel/paving/bed/house within the plan; the park beyond the ha-ha too
  const gr = makeCanvas();
  gr.ctx.fillRect(MAP.min, MAP.min, MAP.size, MAP.size);
  // the lawn (= progress region)
  const lw = makeCanvas();
  rrect(lw.ctx, LAWN.x0, LAWN.z0, LAWN.x1, LAWN.z1, LAWN.r); lw.ctx.fill();
  lw.ctx.beginPath(); lw.ctx.arc(ISLAND.x, ISLAND.z, ISLAND.r - 0.4, 0, Math.PI * 2); lw.ctx.fill();
  // solids (collision)
  const s = makeCanvas();
  const box = (o, pad = 0) => s.ctx.fillRect(o.x0 - pad, o.z0 - pad, o.x1 - o.x0 + 2 * pad, o.z1 - o.z0 + 2 * pad);
  box(HOUSE.main); box(HOUSE.portico); HOUSE.colonnades.forEach((o) => box(o)); HOUSE.pavilions.forEach((o) => box(o));
  s.ctx.fillRect(-60, -100, 120, 20); // house service ranges behind
  HEDGES.forEach((h) => box(h));
  box(BORDER, -0.2);
  const circ = (x, z, r) => { s.ctx.beginPath(); s.ctx.arc(x, z, r, 0, Math.PI * 2); s.ctx.fill(); };
  circ(ISLAND.x, ISLAND.z, ISLAND.basin + 0.35);
  circ(FEATURES.cedar.x, FEATURES.cedar.z, FEATURES.cedar.trunk + 0.3);
  circ(FEATURES.oak.x, FEATURES.oak.z, FEATURES.oak.trunk + 0.3);
  circ(FEATURES.statue.x, FEATURES.statue.z, FEATURES.statue.r);
  circ(FEATURES.sundial.x, FEATURES.sundial.z, FEATURES.sundial.r);
  FEATURES.urns.forEach((u) => s.ctx.fillRect(u.x - 0.75, u.z - 0.75, 1.5, 1.5));
  FEATURES.benches.forEach((u) => s.ctx.fillRect(u.x - 0.5, u.z - 1.1, 1.0, 2.2));
  FEATURES.topiary.forEach((t) => circ(t.x, t.z, 0.85));
  // the ha-ha and the far ends close the playable area
  s.ctx.fillRect(-130, HAHA.z - 0.2, 260, 60);
  s.ctx.fillRect(-130, -130, 58, 260); // far west (behind the west hedge)
  s.ctx.fillRect(74, -24, 60, 160);    // far east (behind the east hedge)
  s.ctx.fillRect(-130, -130, 260, 28); // far north
  // east of the forecourt: shrubbery except for the drive
  s.ctx.fillRect(46.8, -80, 90, 35.5);
  s.ctx.fillRect(46.8, -35.5, 90, 10.3);
  s.ctx.fillRect(124, -50, 10, 20);    // the lodge gates
  // west of the forecourt
  s.ctx.fillRect(-130, -80, 83.2, 55);

  const gravel = channel(g.ctx), paving = channel(p.ctx), bed = channel(b.ctx), lawn = channel(lw.ctx), solid = channel(s.ctx);
  const grass = channel(gr.ctx);
  for (let i = 0; i < grass.length; i++) {
    const cover = Math.max(gravel[i], paving[i], bed[i]);
    grass[i] = Math.max(0, 255 - cover);
  }
  // house footprint: no grass
  const R = MAP.res, sc = R / MAP.size;
  const clearRect = (o) => {
    for (let pz = Math.floor((o.z0 - MAP.min) * sc); pz < Math.ceil((o.z1 - MAP.min) * sc); pz++)
      for (let px = Math.floor((o.x0 - MAP.min) * sc); px < Math.ceil((o.x1 - MAP.min) * sc); px++)
        if (px >= 0 && pz >= 0 && px < R && pz < R) grass[pz * R + px] = 0;
  };
  clearRect(HOUSE.main); clearRect(HOUSE.portico); HOUSE.colonnades.forEach(clearRect); HOUSE.pavilions.forEach(clearRect);
  HEDGES.forEach(clearRect);

  // packed RGBA texture for shaders: R gravel, G grass, B paving, A bed
  const rgba = new Uint8Array(R * R * 4);
  for (let i = 0; i < R * R; i++) {
    rgba[i * 4] = gravel[i]; rgba[i * 4 + 1] = grass[i]; rgba[i * 4 + 2] = paving[i]; rgba[i * 4 + 3] = bed[i];
  }
  const sdf = distanceField(solid, R, CELL);
  return { gravel, grass, paving, bed, lawn, solid, rgba, sdf };
}

// Signed distance (metres) to the solids, negative inside. Felzenszwalb & Huttenlocher EDT.
function edt1d(f, n, d, v, z) {
  let k = 0; v[0] = 0; z[0] = -Infinity; z[1] = Infinity;
  for (let q = 1; q < n; q++) {
    let s = ((f[q] + q * q) - (f[v[k]] + v[k] * v[k])) / (2 * q - 2 * v[k]);
    while (s <= z[k]) { k--; s = ((f[q] + q * q) - (f[v[k]] + v[k] * v[k])) / (2 * q - 2 * v[k]); }
    k++; v[k] = q; z[k] = s; z[k + 1] = Infinity;
  }
  k = 0;
  for (let q = 0; q < n; q++) { while (z[k + 1] < q) k++; d[q] = (q - v[k]) * (q - v[k]) + f[v[k]]; }
}
function edt(mask, R, inside) {
  const INF = 1e12, grid = new Float64Array(R * R);
  for (let i = 0; i < R * R; i++) grid[i] = (mask[i] > 127) === inside ? 0 : INF;
  const f = new Float64Array(R), d = new Float64Array(R), v = new Int32Array(R), z = new Float64Array(R + 1);
  for (let x = 0; x < R; x++) {
    for (let y = 0; y < R; y++) f[y] = grid[y * R + x];
    edt1d(f, R, d, v, z);
    for (let y = 0; y < R; y++) grid[y * R + x] = d[y];
  }
  for (let y = 0; y < R; y++) {
    for (let x = 0; x < R; x++) f[x] = grid[y * R + x];
    edt1d(f, R, d, v, z);
    for (let x = 0; x < R; x++) grid[y * R + x] = d[x];
  }
  return grid;
}
function distanceField(solid, R, cell) {
  const out = edt(solid, R, true);   // distance to nearest solid cell
  const inn = edt(solid, R, false);  // distance to nearest free cell
  const sdf = new Float32Array(R * R);
  for (let i = 0; i < R * R; i++) sdf[i] = (Math.sqrt(out[i]) - Math.sqrt(inn[i])) * cell;
  return sdf;
}

export class Plan {
  constructor() {
    this.m = buildMasks();
    // lawn cells for the progress count, on a 0.5 m grid (every 2nd mask texel)
    this.R = MAP.res;
  }
  idx(x, z) {
    const px = Math.floor((x - MAP.min) / CELL), pz = Math.floor((z - MAP.min) / CELL);
    if (px < 0 || pz < 0 || px >= this.R || pz >= this.R) return -1;
    return pz * this.R + px;
  }
  sample(arr, x, z) {
    // bilinear
    const fx = (x - MAP.min) / CELL - 0.5, fz = (z - MAP.min) / CELL - 0.5;
    const x0 = clamp(Math.floor(fx), 0, this.R - 2), z0 = clamp(Math.floor(fz), 0, this.R - 2);
    const tx = clamp(fx - x0), tz = clamp(fz - z0);
    const i = z0 * this.R + x0;
    return lerp(lerp(arr[i], arr[i + 1], tx), lerp(arr[i + this.R], arr[i + this.R + 1], tx), tz);
  }
  sdf(x, z) {
    if (x <= MAP.min + 1 || z <= MAP.min + 1 || x >= MAP.max - 1 || z >= MAP.max - 1) return -1;
    return this.sample(this.m.sdf, x, z);
  }
  surface(x, z) {
    const i = this.idx(x, z);
    if (i < 0) return { gravel: 0, grass: 1, paving: 0 };
    return { gravel: this.m.gravel[i] / 255, grass: this.m.grass[i] / 255, paving: this.m.paving[i] / 255 };
  }
}
