// Building blocks for the 3D café: cached materials, soft rounded shapes and a helper that
// merges a finished model into one mesh per material so phones draw it cheaply.
// Units: one floor tile is 1; heights from the game logic (in old art pixels) use ZS.
import * as THREE from 'three';
import { RoundedBoxGeometry } from '../../vendor/RoundedBoxGeometry.js';
import { mergeGeometries } from '../../vendor/BufferGeometryUtils.js';

export { THREE };
export const ZS = 1 / 28; // game heights are in old art pixels; this turns them into tiles
export const WALL_H3 = 2.7;

const mats = new Map();
// a matte material by colour; o: { rough, metal, emissive, glow, opacity, side, flat }
export function mat(color, o) {
  o = o || {};
  const key = color + JSON.stringify(o);
  if (!mats.has(key)) {
    const m = new THREE.MeshStandardMaterial({ color, roughness: o.rough ?? 0.82, metalness: o.metal ?? 0 });
    if (o.emissive) { m.emissive = new THREE.Color(o.emissive); m.emissiveIntensity = o.glow ?? 1; }
    if (o.opacity != null) { m.transparent = true; m.opacity = o.opacity; m.depthWrite = o.opacity > 0.6; }
    if (o.side) m.side = THREE.DoubleSide;
    if (o.map) m.map = o.map;
    if (o.flat) m.flatShading = true;
    m.userData.key = key;
    mats.set(key, m);
  }
  return mats.get(key);
}

const geos = new Map();
const geo = (key, make) => { if (!geos.has(key)) geos.set(key, make()); return geos.get(key); };

// every shape is created centred on (x, y, z) unless said otherwise
export function rbox(w, h, d, color, x = 0, y = 0, z = 0, r = null, o) {
  const rr = r ?? Math.min(0.05, Math.min(w, h, d) * 0.3);
  const g = geo(`rb${w.toFixed(3)},${h.toFixed(3)},${d.toFixed(3)},${rr.toFixed(3)}`, () => (rr > 0.004 ? new RoundedBoxGeometry(w, h, d, 2, rr) : new THREE.BoxGeometry(w, h, d)));
  const m = new THREE.Mesh(g, typeof color === 'string' ? mat(color, o) : color);
  m.position.set(x, y, z);
  return m;
}
export function cyl(rt, rb, h, color, x = 0, y = 0, z = 0, seg = 20, o) {
  const g = geo(`cy${rt},${rb},${h},${seg}`, () => new THREE.CylinderGeometry(rt, rb, h, seg));
  const m = new THREE.Mesh(g, typeof color === 'string' ? mat(color, o) : color);
  m.position.set(x, y, z);
  return m;
}
export function ball(r, color, x = 0, y = 0, z = 0, sx = 1, sy = 1, sz = 1, o, seg = 16) {
  const g = geo(`sp${r},${seg}`, () => new THREE.SphereGeometry(r, seg, Math.max(8, seg * 0.75 | 0)));
  const m = new THREE.Mesh(g, typeof color === 'string' ? mat(color, o) : color);
  m.position.set(x, y, z);
  m.scale.set(sx, sy, sz);
  return m;
}
export function cone(r, h, color, x = 0, y = 0, z = 0, seg = 16, o) {
  const g = geo(`co${r},${h},${seg}`, () => new THREE.ConeGeometry(r, h, seg));
  const m = new THREE.Mesh(g, typeof color === 'string' ? mat(color, o) : color);
  m.position.set(x, y, z);
  return m;
}
export function torus(r, tube, color, x = 0, y = 0, z = 0, o, arc = Math.PI * 2) {
  const g = geo(`to${r},${tube},${arc}`, () => new THREE.TorusGeometry(r, tube, 10, 28, arc));
  const m = new THREE.Mesh(g, typeof color === 'string' ? mat(color, o) : color);
  m.position.set(x, y, z);
  return m;
}
export function capsule(r, len, color, x = 0, y = 0, z = 0, o) {
  const g = geo(`ca${r},${len}`, () => new THREE.CapsuleGeometry(r, len, 4, 12));
  const m = new THREE.Mesh(g, typeof color === 'string' ? mat(color, o) : color);
  m.position.set(x, y, z);
  return m;
}
// a flat plane lying on the floor (or rotated by the caller)
export function plane(w, d, material, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d), material);
  m.rotation.x = -Math.PI / 2;
  m.position.set(x, y, z);
  return m;
}
// a vertical round leg between two heights
export const leg = (r, y0, y1, color, x, z) => cyl(r, r * 0.85, y1 - y0, color, x, (y0 + y1) / 2, z, 10);

export function rot(m, x = 0, y = 0, z = 0) { m.rotation.set(x, y, z); return m; }

// small seeded random numbers so the same item always looks the same
export function rng(seed) {
  let s = seed >>> 0 || 1;
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
}
export const hashStr = (str) => { let h = 2166136261; for (const ch of str) h = Math.imul(h ^ ch.charCodeAt(0), 16777619); return h >>> 0; };

// merge every mesh of a model into one mesh per material (keeps animated parts named 'live')
export function compact(group, { shadows = true } = {}) {
  group.updateMatrixWorld(true);
  const inv = new THREE.Matrix4().copy(group.matrixWorld).invert();
  const byMat = new Map(), keep = [];
  group.traverse((o) => {
    if (!o.isMesh) return;
    let live = false;
    for (let p = o; p && p !== group; p = p.parent) if (p.name === 'live') live = true;
    if (live) return;
    const g = (o.geometry.index ? o.geometry.toNonIndexed() : o.geometry.clone());
    for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'uv'].includes(k)) g.deleteAttribute(k);
    if (!g.attributes.uv) g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
    g.applyMatrix4(new THREE.Matrix4().multiplyMatrices(inv, o.matrixWorld));
    if (!byMat.has(o.material)) byMat.set(o.material, []);
    byMat.get(o.material).push(g);
  });
  const out = new THREE.Group();
  for (const [m, list] of byMat) {
    const merged = new THREE.Mesh(mergeGeometries(list, false), m);
    merged.castShadow = shadows && !m.transparent; merged.receiveShadow = true;
    out.add(merged);
    list.forEach((g) => g.dispose());
  }
  group.traverse((o) => { if (o.name === 'live') keep.push(o); });
  for (const k of keep) { k.traverse((m) => { if (m.isMesh) { m.castShadow = shadows && !m.material.transparent; m.receiveShadow = true; } }); out.add(k); }
  out.userData = group.userData;
  return out;
}

// colours that read nicely under warm light
export const C = {
  wood: '#8a5a3a', woodDark: '#5e3c26', woodLight: '#b98455', woodPale: '#e2c49a', walnut: '#4a2e1f',
  cream: '#f4ead8', white: '#fbf7ef', ink: '#2a1d16', brass: '#c9a04f', metal: '#9aa0a6', metalDark: '#4b5056',
  leaf: ['#3f6f3a', '#4f8a45', '#63a052', '#7db866'], pot: '#c46f4a', potDark: '#a65a3b', glass: '#cfe6ee',
  cake: ['#f6d2d8', '#e98aa0', '#7a4a33', '#fff3df', '#c84a5a'], coffee: '#5a3622', foam: '#f3e2c4',
};
