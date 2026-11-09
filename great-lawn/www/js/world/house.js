// Hollingmere Park: a Palladian house. Rusticated ground floor, a piano nobile with
// alternately triangular and segmental pediments, a giant Ionic portico, balustraded roof
// lines with urns, colonnades to two pedimented pavilions with cupolas, slate roofs and
// chimney stacks. Repeated parts (windows, columns, balusters, urns) are instanced.
import * as THREE from '../../vendor/three.module.js';
import { Kit, M4, lathe, merge } from '../core/geo.js';
import { stoneMaterial, slateMaterial, paintMaterial, glassMaterial } from '../core/materials.js';
import { HOUSE } from './layout.js';

const B = (x0, x1, y0, y1, z0, z1) => new THREE.BoxGeometry(x1 - x0, y1 - y0, z1 - z0).translate((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);

// Instances of a few shared geometries, collected then built as InstancedMeshes.
class Instancer {
  constructor() { this.sets = new Map(); }
  add(key, geo, mat, matrix) {
    if (!this.sets.has(key)) this.sets.set(key, { geo, mat, list: [] });
    this.sets.get(key).list.push(matrix.clone());
  }
  build(group) {
    for (const [key, s] of this.sets) {
      const m = new THREE.InstancedMesh(s.geo, s.mat, s.list.length);
      s.list.forEach((x, i) => m.setMatrixAt(i, x));
      m.castShadow = true; m.receiveShadow = true;
      m.name = key;
      m.computeBoundingSphere();
      group.add(m);
    }
  }
}

// ---------------------------------------------------------------- parts (local space:
// x right, y up, z out of the wall; origin at the centre of the opening on the wall face)
function sashGeometry(w, h, panesX = 3, panesY = 2) {
  const t = 0.055, parts = [];
  parts.push(B(-w / 2, w / 2, -h / 2, -h / 2 + t, 0.02, 0.07), B(-w / 2, w / 2, h / 2 - t, h / 2, 0.02, 0.07));
  parts.push(B(-w / 2, -w / 2 + t, -h / 2, h / 2, 0.02, 0.07), B(w / 2 - t, w / 2, -h / 2, h / 2, 0.02, 0.07));
  parts.push(B(-w / 2, w / 2, -0.035, 0.035, 0.02, 0.08)); // meeting rail
  const g = 0.022;
  for (let i = 1; i < panesX; i++) { const x = -w / 2 + (w * i) / panesX; parts.push(B(x - g / 2, x + g / 2, -h / 2, h / 2, 0.025, 0.06)); }
  for (const half of [-1, 1]) for (let j = 1; j < panesY; j++) { const y = half * (h / 4) + (j - panesY / 2) * (h / 2 / panesY) * 0; parts.push(B(-w / 2, w / 2, y - g / 2, y + g / 2, 0.025, 0.06)); }
  return merge(parts);
}
function surroundGeometry(w, h, ears = true) {
  const a = 0.24, d = 0.09, parts = [];
  parts.push(B(-w / 2 - a, -w / 2, -h / 2, h / 2 + a, 0, d), B(w / 2, w / 2 + a, -h / 2, h / 2 + a, 0, d));
  parts.push(B(-w / 2, w / 2, h / 2, h / 2 + a, 0, d));
  if (ears) parts.push(B(-w / 2 - a - 0.09, -w / 2 - a + 0.01, h / 2 + a - 0.35, h / 2 + a, 0, d), B(w / 2 + a - 0.01, w / 2 + a + 0.09, h / 2 + a - 0.35, h / 2 + a, 0, d));
  parts.push(B(-w / 2 - a - 0.08, w / 2 + a + 0.08, -h / 2 - 0.13, -h / 2, 0, 0.2)); // sill
  return merge(parts);
}
function pedimentGeometry(w, kind) {
  const half = w / 2 + 0.42, base = 0.0;
  if (kind === 'tri') {
    const rise = half * 0.38;
    const sh = new THREE.Shape([new THREE.Vector2(-half, base), new THREE.Vector2(half, base), new THREE.Vector2(0, base + rise)]);
    const g = new THREE.ExtrudeGeometry(sh, { depth: 0.22, bevelEnabled: false });
    const cornice = B(-half - 0.05, half + 0.05, -0.12, 0.0, -0.01, 0.26);
    return merge([g, cornice]);
  }
  const sh = new THREE.Shape();
  const r = half * 1.5, cy = base - Math.sqrt(r * r - half * half);
  sh.moveTo(-half, base);
  sh.absarc(0, cy, r, Math.PI - Math.asin((base - cy) / r), Math.asin((base - cy) / r), true);
  sh.lineTo(-half, base);
  const g = new THREE.ExtrudeGeometry(sh, { depth: 0.22, bevelEnabled: false, curveSegments: 16 });
  const cornice = B(-half - 0.05, half + 0.05, -0.12, 0.0, -0.01, 0.26);
  return merge([g, cornice]);
}
function balusterGeometry(h = 0.72) {
  const s = h / 0.72;
  return lathe([[0, 0], [0.085, 0], [0.085, 0.05], [0.06, 0.07], [0.055, 0.1], [0.085, 0.22], [0.095, 0.3], [0.07, 0.42], [0.045, 0.5], [0.05, 0.55], [0.075, 0.6], [0.08, 0.66], [0.085, 0.66], [0.085, 0.72], [0, 0.72]].map(([r, y]) => [r * s, y * s]), 10);
}
function urnGeometry() {
  return lathe([[0, 0], [0.24, 0], [0.24, 0.08], [0.12, 0.12], [0.1, 0.2], [0.16, 0.26], [0.27, 0.42], [0.29, 0.55], [0.26, 0.66], [0.22, 0.7], [0.25, 0.74], [0.2, 0.78], [0.12, 0.8], [0.09, 0.9], [0.05, 0.98], [0, 1.0]], 16);
}
function columnGeometry(H, D, order = 'ionic') {
  const R = D / 2, parts = [];
  // shaft with entasis
  const prof = [];
  const n = 14, shaftH = H - (order === 'ionic' ? 0.9 : 0.55) * D;
  const y0 = order === 'ionic' ? 0.5 * D : 0.3 * D;
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    prof.push([R * (1 - 0.16 * Math.max(0, t - 0.33) ** 1.3 - 0.01 * Math.sin(t * Math.PI)), y0 + t * shaftH]);
  }
  parts.push(lathe([[0, y0], ...prof, [0, y0 + shaftH]], 24));
  // attic base: plinth, torus, scotia, torus
  parts.push(B(-R * 1.4, R * 1.4, 0, 0.16 * D, -R * 1.4, R * 1.4));
  parts.push(lathe([[0, 0.16 * D], [R * 1.32, 0.16 * D], [R * 1.36, 0.24 * D], [R * 1.3, 0.3 * D], [R * 1.12, 0.33 * D], [R * 1.08, 0.38 * D], [R * 1.18, 0.42 * D], [R * 1.14, 0.48 * D], [R * 1.02, 0.5 * D], [0, 0.5 * D]], 24));
  const top = y0 + shaftH;
  if (order === 'ionic') {
    parts.push(new THREE.TorusGeometry(R * 0.92, R * 0.1, 8, 24).rotateX(Math.PI / 2).translate(0, top + 0.03 * D, 0));
    parts.push(lathe([[0, top], [R * 0.95, top], [R * 1.08, top + 0.14 * D], [0, top + 0.14 * D]], 24));
    // volutes and the cushion between them
    parts.push(new THREE.CylinderGeometry(0.24 * D, 0.24 * D, 1.05 * D, 18).rotateX(Math.PI / 2).translate(-0.62 * D, top + 0.08 * D, 0));
    parts.push(new THREE.CylinderGeometry(0.24 * D, 0.24 * D, 1.05 * D, 18).rotateX(Math.PI / 2).translate(0.62 * D, top + 0.08 * D, 0));
    parts.push(new THREE.CylinderGeometry(0.18 * D, 0.18 * D, 1.24 * D, 16).rotateZ(Math.PI / 2).translate(0, top + 0.17 * D, 0));
    parts.push(B(-0.7 * D, 0.7 * D, top + 0.26 * D, top + 0.4 * D, -0.62 * D, 0.62 * D)); // abacus
  } else {
    parts.push(lathe([[0, top], [R * 1.05, top], [R * 1.2, top + 0.12 * D], [0, top + 0.12 * D]], 24));
    parts.push(B(-0.65 * D, 0.65 * D, top + 0.12 * D, top + 0.25 * D, -0.65 * D, 0.65 * D));
  }
  return merge(parts);
}

// A run of moulded cornice along x (length L), profile projecting towards +z.
function corniceRun(L, scale = 1) {
  const s = scale;
  const sh = new THREE.Shape([
    [0, 0], [0.08, 0], [0.08, 0.1], [0.18, 0.14], [0.22, 0.24], [0.42, 0.3], [0.48, 0.4], [0.62, 0.44], [0.66, 0.56], [0, 0.56],
  ].map(([z, y]) => new THREE.Vector2(z * s, y * s)));
  const g = new THREE.ExtrudeGeometry(sh, { depth: L, bevelEnabled: false });
  // the shape is drawn as (projection, height) and extruded along +z; turn it so the run
  // lies along x and the moulding projects towards +z
  g.rotateY(-Math.PI / 2);
  g.translate(L / 2, 0, 0);
  return g;
}

export function buildHouse({ quality }) {
  const group = new THREE.Group();
  group.name = 'house';
  const stone = stoneMaterial('#fff4dc', 2.2);
  const ashlar = stoneMaterial('#fff4dc', 2.2, { joints: 'ashlar' });
  const rustic = stoneMaterial('#efe0c2', 1.6, { joints: 'rustic' });
  const slate = slateMaterial();
  const white = paintMaterial('#f2efe6', 0.4);
  const glass = glassMaterial();
  const doorGreen = paintMaterial('#1d3326', 0.35);
  const lead = new THREE.MeshStandardMaterial({ color: '#4d5257', roughness: 0.6, metalness: 0.5 });
  const pot = new THREE.MeshStandardMaterial({ color: '#9a5a3c', roughness: 0.9 });
  const kit = new Kit(), ins = new Instancer();

  const m = HOUSE.main, F = 1.0;            // podium height
  const GF = 5.2, PN = 11.0, TOP = 14.6;    // floor levels: ground floor top, piano nobile top, attic top
  // ---------------- main block ----------------
  kit.add(stone, B(m.x0 - 0.4, m.x1 + 0.4, 0, F, m.z0 - 0.4, m.z1 + 0.4));            // podium
  kit.add(rustic, B(m.x0, m.x1, F, GF, m.z0, m.z1));                                    // rusticated ground floor
  for (let y = F + 0.55; y < GF - 0.1; y += 0.55) {
    // rustication channels: thin projecting courses read as deep joints in the light
    kit.add(rustic, B(m.x0 - 0.05, m.x1 + 0.05, y - 0.04, y + 0.04, m.z0 - 0.05, m.z1 + 0.05));
  }
  kit.add(stone, B(m.x0 - 0.18, m.x1 + 0.18, GF, GF + 0.28, m.z0 - 0.18, m.z1 + 0.18)); // string course
  kit.add(ashlar, B(m.x0, m.x1, GF + 0.28, TOP, m.z0, m.z1));                            // upper walls
  kit.add(stone, B(m.x0 - 0.12, m.x1 + 0.12, PN - 0.1, PN + 0.12, m.z0 - 0.12, m.z1 + 0.12)); // sill band
  // cornice round the block
  const cor = (L, x, z, ry) => kit.add(stone, corniceRun(L, 1.1), M4.c(M4.t(x, TOP, z), M4.ry(ry)));
  cor(m.x1 - m.x0 + 1.4, 0, m.z1, 0); cor(m.x1 - m.x0 + 1.4, 0, m.z0, Math.PI);
  cor(m.z1 - m.z0 + 1.4, m.x1, (m.z0 + m.z1) / 2, Math.PI / 2); cor(m.z1 - m.z0 + 1.4, m.x0, (m.z0 + m.z1) / 2, -Math.PI / 2);
  kit.add(stone, B(m.x0 - 0.1, m.x1 + 0.1, TOP, TOP + 0.62, m.z0 - 0.1, m.z1 + 0.1));   // frieze core behind cornice
  // parapet with balustrade and urns
  const PAR = TOP + 0.62;
  const bal = balusterGeometry(0.72);
  const urn = urnGeometry();
  const parapet = (x0, z0, x1, z1, urns = true) => {
    const L = Math.hypot(x1 - x0, z1 - z0), ang = Math.atan2(-(z1 - z0), x1 - x0);
    const mid = [(x0 + x1) / 2, (z0 + z1) / 2];
    const base = B(-L / 2, L / 2, 0, 0.22, -0.24, 0.24);
    const rail = B(-L / 2, L / 2, 0.94, 1.12, -0.26, 0.26);
    kit.add(stone, merge([base, rail]), M4.c(M4.t(mid[0], PAR, mid[1]), M4.ry(ang)));
    const piers = Math.max(2, Math.round(L / 4.2) + 1);
    for (let i = 0; i < piers; i++) {
      const t = i / (piers - 1);
      const px = x0 + (x1 - x0) * t, pz = z0 + (z1 - z0) * t;
      kit.add(stone, B(-0.32, 0.32, 0, 1.22, -0.32, 0.32), M4.c(M4.t(px, PAR, pz), M4.ry(ang)));
      if (urns) ins.add('urns', urn, stone, M4.c(M4.t(px, PAR + 1.22, pz), M4.s(1.05)));
      if (i < piers - 1) {
        const seg = L / (piers - 1), nb = Math.floor((seg - 0.7) / 0.3);
        for (let b = 0; b < nb; b++) {
          const u = (i * seg + 0.35 + 0.3 * (b + 0.5)) / L;
          ins.add('balusters', bal, stone, M4.t(x0 + (x1 - x0) * u, PAR + 0.22, z0 + (z1 - z0) * u));
        }
      }
    }
  };
  parapet(m.x0 - 0.3, m.z1 + 0.25, m.x1 + 0.3, m.z1 + 0.25);
  parapet(m.x0 - 0.3, m.z0 - 0.25, m.x1 + 0.3, m.z0 - 0.25, false);
  parapet(m.x0 - 0.25, m.z0 - 0.3, m.x0 - 0.25, m.z1 + 0.3, false);
  parapet(m.x1 + 0.25, m.z0 - 0.3, m.x1 + 0.25, m.z1 + 0.3, false);
  // hipped slate roof behind the parapet
  const roof = (x0, x1, z0, z1, y, h, ridgeInset) => {
    const g = new THREE.BufferGeometry();
    const rx0 = x0 + ridgeInset, rx1 = x1 - ridgeInset, rz = (z0 + z1) / 2, yt = y + h;
    const v = [
      x0, y, z1, x1, y, z1, rx1, yt, rz, x0, y, z1, rx1, yt, rz, rx0, yt, rz,   // front
      x1, y, z0, x0, y, z0, rx0, yt, rz, x1, y, z0, rx0, yt, rz, rx1, yt, rz,   // back
      x0, y, z0, x0, y, z1, rx0, yt, rz,                                         // left hip
      x1, y, z1, x1, y, z0, rx1, yt, rz,                                         // right hip
    ];
    g.setAttribute('position', new THREE.Float32BufferAttribute(v, 3));
    g.computeVertexNormals();
    return g;
  };
  kit.add(slate, roof(m.x0 + 0.6, m.x1 - 0.6, m.z0 + 0.6, m.z1 - 0.6, PAR, 4.6, 8.4));
  kit.add(lead, B(-13.2, 13.2, PAR + 4.55, PAR + 4.75, (m.z0 + m.z1) / 2 - 0.15, (m.z0 + m.z1) / 2 + 0.15));
  for (const sx of [-1, 1]) for (const z of [-66.8, -75.2]) {
    const cx = sx * 15.5;
    kit.add(stone, B(cx - 0.75, cx + 0.75, PAR + 1, PAR + 6.4, z - 1.6, z + 1.6));
    kit.add(stone, B(cx - 0.9, cx + 0.9, PAR + 6.4, PAR + 6.75, z - 1.75, z + 1.75));
    for (const dz of [-1.0, 0, 1.0]) kit.add(pot, new THREE.CylinderGeometry(0.15, 0.2, 0.7, 10).translate(cx, PAR + 7.1, z + dz));
  }

  // ---------------- windows ----------------
  const winGeo = {};
  const glassPane = (w, h) => new THREE.PlaneGeometry(w, h).translate(0, 0, 0.012);
  const addWindow = (kind, w, h, pos, ry, ped) => {
    const key = `${kind}`;
    if (!winGeo[key]) winGeo[key] = { glass: glassPane(w, h), sash: sashGeometry(w, h, 3, 2), sur: surroundGeometry(w, h, kind !== 'ground'), tri: pedimentGeometry(w, 'tri'), seg: pedimentGeometry(w, 'seg') };
    const g = winGeo[key];
    const M = M4.c(M4.t(pos.x, pos.y, pos.z), M4.ry(ry));
    ins.add(`${key}-glass`, g.glass, glass, M);
    ins.add(`${key}-sash`, g.sash, white, M);
    ins.add(`${key}-sur`, g.sur, kind === 'ground' ? rustic : stone, M);
    if (ped === 'tri') ins.add(`${key}-tri`, g.tri, stone, M4.c(M, M4.t(0, h / 2 + 0.3, 0)));
    if (ped === 'seg') ins.add(`${key}-seg`, g.seg, stone, M4.c(M, M4.t(0, h / 2 + 0.3, 0)));
  };
  const face = (x0, x1, z, nrm, bays, opts = {}) => {
    // windows on a facade at depth z facing nrm (+1: +z, -1: -z)
    const ry = nrm > 0 ? 0 : Math.PI;
    for (let i = 0; i < bays; i++) {
      const x = x0 + ((i + 0.5) * (x1 - x0)) / bays;
      if (opts.skip && opts.skip(x, i)) continue;
      const P = (y) => new THREE.Vector3(x, y, z);
      if (!(opts.door && opts.door(x, i))) addWindow('ground', 1.2, 2.1, P(F + 2.0), ry, null);
      addWindow('noble', 1.45, 3.05, P(GF + 2.9), ry, i % 2 ? 'seg' : 'tri');
      addWindow('attic', 1.25, 1.55, P(PN + 1.75), ry, null);
    }
  };
  const faceX = (z0, z1, x, nrm, bays) => {
    const ry = nrm > 0 ? Math.PI / 2 : -Math.PI / 2;
    for (let i = 0; i < bays; i++) {
      const z = z0 + ((i + 0.5) * (z1 - z0)) / bays;
      const P = (y) => new THREE.Vector3(x, y, z);
      addWindow('ground', 1.2, 2.1, P(F + 2.0), ry, null);
      addWindow('noble', 1.45, 3.05, P(GF + 2.9), ry, i % 2 ? 'seg' : 'tri');
      addWindow('attic', 1.25, 1.55, P(PN + 1.75), ry, null);
    }
  };
  face(m.x0, m.x1, m.z1, 1, 11, { door: (x) => Math.abs(x) < 0.5 });
  face(m.x0, m.x1, m.z0, -1, 11);
  faceX(m.z0, m.z1 - 3.2, m.x1, 1, 4);
  faceX(m.z0, m.z1 - 3.2, m.x0, -1, 4);
  // front door: panelled green door with a fanlight and a pedimented doorcase
  kit.add(doorGreen, B(-0.95, 0.95, F, F + 3.1, m.z1 - 0.02, m.z1 + 0.06));
  kit.add(glass, new THREE.CircleGeometry(0.95, 24, 0, Math.PI).translate(0, F + 3.12, m.z1 + 0.05));
  kit.add(stone, B(-1.45, -0.95, F, F + 4.1, m.z1, m.z1 + 0.22)); kit.add(stone, B(0.95, 1.45, F, F + 4.1, m.z1, m.z1 + 0.22));
  kit.add(stone, pedimentGeometry(1.9, 'tri'), M4.t(0, F + 4.2, m.z1));
  for (let i = 0; i < 4; i++) kit.add(doorGreen, B(-0.8 + (i % 2) * 0.85, -0.05 + (i % 2) * 0.85, F + 0.3 + Math.floor(i / 2) * 1.45, F + 1.55 + Math.floor(i / 2) * 1.45, m.z1 + 0.06, m.z1 + 0.09));
  kit.add(new THREE.MeshStandardMaterial({ color: '#d4a54f', metalness: 1, roughness: 0.3 }), new THREE.SphereGeometry(0.06, 12, 8).translate(0.55, F + 1.5, m.z1 + 0.13));

  // ---------------- portico ----------------
  const p = HOUSE.portico;
  const colH = TOP - F - 0.0, D = 1.18;
  kit.add(stone, B(p.x0 - 1.0, p.x1 + 1.0, 0, F, p.z0, p.z1 + 0.6));       // stylobate
  for (let s = 0; s < 5; s++) kit.add(stone, B(p.x0 - 0.6 - s * 0.2, p.x1 + 0.6 + s * 0.2, 0, F - s * 0.2, p.z1 + 0.6 + s * 0.32, p.z1 + 0.92 + s * 0.32));
  const col = columnGeometry(colH, D, 'ionic');
  const xs = [-7.5, -4.5, -1.5, 1.5, 4.5, 7.5];
  for (const x of xs) ins.add('columns', col, stone, M4.t(x, F, p.z1 - 0.7));
  for (const x of [-7.5, 7.5]) ins.add('columns', col, stone, M4.t(x, F, p.z0 + 1.6));
  // entablature
  const eY = F + colH;
  kit.add(stone, B(p.x0 - 0.5, p.x1 + 0.5, eY, eY + 0.85, p.z0, p.z1 + 0.05));
  kit.add(stone, B(p.x0 - 0.55, p.x1 + 0.55, eY + 0.85, eY + 0.88, p.z0, p.z1 + 0.1));
  kit.add(stone, B(p.x0 - 0.5, p.x1 + 0.5, eY + 0.88, eY + 1.5, p.z0, p.z1 + 0.05));
  kit.add(stone, corniceRun(p.x1 - p.x0 + 1.9, 1.15), M4.t(0, eY + 1.5, p.z1 + 0.05));
  // dentils
  const dentil = B(-0.06, 0.06, -0.16, 0, 0, 0.14);
  for (let x = p.x0 - 0.4; x <= p.x1 + 0.4; x += 0.24) ins.add('dentils', dentil, stone, M4.t(x, eY + 1.5, p.z1 + 0.06));
  // pediment
  const half = (p.x1 - p.x0) / 2 + 0.9, rise = half * Math.tan(THREE.MathUtils.degToRad(22));
  const pY = eY + 1.5 + 0.62;
  const tymp = new THREE.Shape([new THREE.Vector2(-half, 0), new THREE.Vector2(half, 0), new THREE.Vector2(0, rise)]);
  kit.add(stone, new THREE.ExtrudeGeometry(tymp, { depth: p.z1 - p.z0, bevelEnabled: false }), M4.t(0, pY, p.z0));
  for (const sx of [-1, 1]) {
    const L = Math.hypot(half, rise) + 0.6;
    const rc = corniceRun(L, 1.0);
    kit.add(stone, rc, M4.c(M4.t(sx * half / 2, pY + rise / 2 - 0.25, p.z1 + 0.02), M4.rz(sx * -Math.atan2(rise, half))));
  }
  kit.add(stone, new THREE.CylinderGeometry(1.1, 1.1, 0.25, 32).rotateX(Math.PI / 2).translate(0, pY + rise * 0.38, p.z1 + 0.12)); // oculus cartouche
  kit.add(glass, new THREE.CircleGeometry(0.75, 32).translate(0, pY + rise * 0.38, p.z1 + 0.26));
  ins.add('urns', urn, stone, M4.c(M4.t(0, pY + rise - 0.1, (p.z0 + p.z1) / 2), M4.s(1.3)));
  for (const sx of [-1, 1]) ins.add('urns', urn, stone, M4.c(M4.t(sx * (half - 0.2), pY - 0.05, p.z1 - 0.4), M4.s(1.2)));
  // portico ceiling
  kit.add(white, B(p.x0 - 0.4, p.x1 + 0.4, eY - 0.02, eY + 0.02, p.z0, p.z1));

  // ---------------- colonnades ----------------
  const tus = columnGeometry(5.0, 0.55, 'tuscan');
  for (const c of HOUSE.colonnades) {
    const cx = (c.x0 + c.x1) / 2, L = c.x1 - c.x0;
    kit.add(ashlar, B(c.x0, c.x1, 0, 6.0, c.z0, c.z0 + 0.7));               // back wall
    kit.add(stone, B(c.x0, c.x1, 0, 0.35, c.z0, c.z1 + 0.3));                // floor
    for (let i = 0; i < 4; i++) {
      // niches in the back wall
      const nx = c.x0 + ((i + 0.5) * L) / 4;
      kit.add(new THREE.MeshStandardMaterial({ color: '#7d725f', roughness: 1 }), B(nx - 0.6, nx + 0.6, 1.2, 3.8, c.z0 + 0.69, c.z0 + 0.71));
    }
    const n = 7;
    for (let i = 0; i < n; i++) ins.add('tuscan', tus, stone, M4.t(c.x0 + 1.2 + (i * (L - 2.4)) / (n - 1), 0.35, c.z1 - 0.4));
    kit.add(stone, B(c.x0, c.x1, 5.25, 6.1, c.z0, c.z1 + 0.05));
    kit.add(stone, corniceRun(L, 0.75), M4.t(cx, 6.1, c.z1 + 0.05));
    kit.add(white, B(c.x0, c.x1, 5.2, 5.25, c.z0 + 0.7, c.z1));
  }
  // colonnade roof balustrades (reuse the parapet builder at a lower level)
  const colParapet = (c) => {
    const y = 6.52;
    const L = c.x1 - c.x0;
    kit.add(stone, B(c.x0, c.x1, y, y + 0.18, c.z1 - 0.45, c.z1 - 0.05));
    kit.add(stone, B(c.x0, c.x1, y + 0.78, y + 0.92, c.z1 - 0.47, c.z1 - 0.03));
    const nb = Math.floor(L / 0.3);
    for (let b = 0; b < nb; b++) ins.add('balusters', bal, stone, M4.c(M4.t(c.x0 + 0.15 + b * (L / nb), y + 0.18, c.z1 - 0.25), M4.s(0.83)));
    for (const x of [c.x0 + 0.4, (c.x0 + c.x1) / 2, c.x1 - 0.4]) {
      kit.add(stone, B(x - 0.28, x + 0.28, y, y + 1.0, c.z1 - 0.53, c.z1 + 0.03));
      ins.add('urns', urn, stone, M4.c(M4.t(x, y + 1.0, c.z1 - 0.25), M4.s(0.85)));
    }
  };
  HOUSE.colonnades.forEach(colParapet);

  // ---------------- pavilions ----------------
  for (const pv of HOUSE.pavilions) {
    const cx = (pv.x0 + pv.x1) / 2, H = 10.6;
    kit.add(stone, B(pv.x0 - 0.3, pv.x1 + 0.3, 0, F, pv.z0 - 0.3, pv.z1 + 0.3));
    kit.add(rustic, B(pv.x0, pv.x1, F, GF, pv.z0, pv.z1));
    for (let y = F + 0.55; y < GF - 0.1; y += 0.55) kit.add(rustic, B(pv.x0 - 0.05, pv.x1 + 0.05, y - 0.04, y + 0.04, pv.z0 - 0.05, pv.z1 + 0.05));
    kit.add(stone, B(pv.x0 - 0.16, pv.x1 + 0.16, GF, GF + 0.26, pv.z0 - 0.16, pv.z1 + 0.16));
    kit.add(stone, B(pv.x0, pv.x1, GF + 0.26, H, pv.z0, pv.z1));
    const W = pv.x1 - pv.x0;
    kit.add(stone, corniceRun(W + 1.2, 0.95), M4.t(cx, H, pv.z1));
    kit.add(stone, corniceRun(W + 1.2, 0.95), M4.c(M4.t(cx, H, pv.z0), M4.ry(Math.PI)));
    kit.add(stone, corniceRun(pv.z1 - pv.z0 + 1.2, 0.95), M4.c(M4.t(pv.x0, H, (pv.z0 + pv.z1) / 2), M4.ry(-Math.PI / 2)));
    kit.add(stone, corniceRun(pv.z1 - pv.z0 + 1.2, 0.95), M4.c(M4.t(pv.x1, H, (pv.z0 + pv.z1) / 2), M4.ry(Math.PI / 2)));
    // pedimented front
    const hh = W / 2 + 0.55, rr = hh * Math.tan(THREE.MathUtils.degToRad(22));
    kit.add(stone, new THREE.ExtrudeGeometry(new THREE.Shape([new THREE.Vector2(-hh, 0), new THREE.Vector2(hh, 0), new THREE.Vector2(0, rr)]), { depth: 2.2, bevelEnabled: false }), M4.t(cx, H + 0.5, pv.z1 - 2.0));
    for (const sx of [-1, 1]) kit.add(stone, corniceRun(Math.hypot(hh, rr) + 0.4, 0.85), M4.c(M4.t(cx + sx * hh / 2, H + 0.5 + rr / 2 - 0.2, pv.z1 + 0.2), M4.rz(sx * -Math.atan2(rr, hh))));
    kit.add(stone, new THREE.CylinderGeometry(0.75, 0.75, 0.2, 28).rotateX(Math.PI / 2).translate(cx, H + 0.5 + rr * 0.36, pv.z1 + 0.25));
    // roof and cupola
    kit.add(slate, roof(pv.x0 + 0.3, pv.x1 - 0.3, pv.z0 + 0.3, pv.z1 - 2.0, H + 0.5, 3.2, 6.0));
    const cz = (pv.z0 + pv.z1) / 2 - 1.5, cy = H + 3.5;
    kit.add(white, new THREE.CylinderGeometry(1.25, 1.25, 1.9, 8).translate(cx, cy + 0.95, cz));
    for (let k = 0; k < 8; k++) {
      const a = (k / 8) * Math.PI * 2 + Math.PI / 8;
      kit.add(glass, new THREE.PlaneGeometry(0.62, 1.1).applyMatrix4(M4.c(M4.t(cx + Math.sin(a) * 1.255, cy + 1.0, cz + Math.cos(a) * 1.255), M4.ry(a))));
    }
    kit.add(lead, lathe([[0, 0], [1.42, 0], [1.38, 0.25], [1.15, 0.9], [0.7, 1.45], [0.2, 1.75], [0.12, 1.95], [0.06, 2.5], [0, 2.55]], 24), M4.t(cx, cy + 1.9, cz));
    kit.add(new THREE.MeshStandardMaterial({ color: '#d8ab55', metalness: 1, roughness: 0.3 }), new THREE.SphereGeometry(0.14, 12, 8).translate(cx, cy + 4.5, cz));
    // windows: front 3 bays (central door), sides 3 bays
    for (let i = 0; i < 3; i++) {
      const x = pv.x0 + ((i + 0.5) * W) / 3;
      if (i !== 1) addWindow('ground', 1.2, 2.1, new THREE.Vector3(x, F + 2.0, pv.z1), 0, null);
      addWindow('noble', 1.45, 3.05, new THREE.Vector3(x, GF + 2.7, pv.z1), 0, 'tri');
    }
    kit.add(doorGreen, B(cx - 0.85, cx + 0.85, F, F + 2.9, pv.z1 - 0.02, pv.z1 + 0.06));
    for (const xside of [pv.x0, pv.x1]) {
      const nrm = xside === pv.x0 ? -1 : 1;
      for (let i = 0; i < 3; i++) {
        const z = pv.z0 + ((i + 0.5) * (pv.z1 - pv.z0)) / 3;
        if (xside === pv.x0 && pv.x0 > 0 && z > -65) continue;   // hidden by the colonnade
        if (xside === pv.x1 && pv.x1 < 0 && z > -65) continue;
        addWindow('ground', 1.2, 2.1, new THREE.Vector3(xside, F + 2.0, z), nrm > 0 ? Math.PI / 2 : -Math.PI / 2, null);
        addWindow('noble', 1.45, 3.05, new THREE.Vector3(xside, GF + 2.7, z), nrm > 0 ? Math.PI / 2 : -Math.PI / 2, 'seg');
      }
    }
  }

  // service ranges behind (simple masses, seen over the roofs from the lawn)
  kit.add(stone, B(-34, 34, 0, 8.5, -100, -82));
  kit.add(slate, roof(-34.5, 34.5, -100.5, -81.5, 8.5, 4.0, 9.0));

  kit.build(group);
  ins.build(group);
  group.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  return group;
}
