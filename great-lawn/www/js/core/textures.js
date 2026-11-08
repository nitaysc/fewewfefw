// Texture loading (CC0 Poly Haven photo textures) and small procedural textures.
import * as THREE from '../../vendor/three.module.js';
import { rng } from './util.js';

export const manager = new THREE.LoadingManager();
const loader = new THREE.TextureLoader(manager);
const cache = new Map();
let maxAniso = 8;
export function setMaxAnisotropy(a) { maxAniso = a; }

// name: e.g. 'stone_diff'; colour textures are sRGB, data textures (normal/ARM) linear.
export function tex(name, { srgb, repeat = [1, 1] } = {}) {
  const isColor = srgb ?? /_diff$/.test(name);
  const key = name + (isColor ? ':c' : ':d');
  let base = cache.get(key);
  if (!base) {
    base = loader.load(`assets/tex/${name}.jpg`);
    base.colorSpace = isColor ? THREE.SRGBColorSpace : THREE.NoColorSpace;
    base.wrapS = base.wrapT = THREE.RepeatWrapping;
    base.anisotropy = maxAniso;
    cache.set(key, base);
  }
  if (repeat[0] === 1 && repeat[1] === 1) return base;
  const t = base.clone();
  t.repeat.set(repeat[0], repeat[1]);
  t.needsUpdate = true;
  return t;
}

// A PBR material from a Poly Haven set (diff + optional nor + arm).
export function pbr(set, { repeat = [1, 1], nor = true, arm = true, color, normalScale = 1, roughness = 1, metalness = 0, envMapIntensity = 1, physical = false, ...rest } = {}) {
  const P = physical ? THREE.MeshPhysicalMaterial : THREE.MeshStandardMaterial;
  const m = new P({
    map: tex(`${set}_diff`, { repeat }),
    normalMap: nor ? tex(`${set}_nor`, { repeat }) : null,
    roughnessMap: arm ? tex(`${set}_arm`, { repeat }) : null,
    aoMap: null,
    roughness, metalness, envMapIntensity, ...rest,
  });
  if (color) m.color.set(color);
  if (nor) m.normalScale.set(normalScale, normalScale);
  return m;
}

// Tileable RGBA value-noise texture: four independent noise layers at different scales.
export function noiseTexture(size = 256, seed = 7) {
  const data = new Uint8Array(size * size * 4);
  const r = rng(seed);
  const layer = (cells) => {
    const g = new Float32Array(cells * cells);
    for (let i = 0; i < g.length; i++) g[i] = r();
    const out = new Float32Array(size * size);
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
      const fx = (x / size) * cells, fy = (y / size) * cells;
      const x0 = Math.floor(fx), y0 = Math.floor(fy);
      let tx = fx - x0, ty = fy - y0;
      tx = tx * tx * (3 - 2 * tx); ty = ty * ty * (3 - 2 * ty);
      const a = g[(y0 % cells) * cells + (x0 % cells)], b = g[(y0 % cells) * cells + ((x0 + 1) % cells)];
      const c = g[((y0 + 1) % cells) * cells + (x0 % cells)], d = g[((y0 + 1) % cells) * cells + ((x0 + 1) % cells)];
      out[y * size + x] = (a + (b - a) * tx) * (1 - ty) + (c + (d - c) * tx) * ty;
    }
    return out;
  };
  const fbm = (base) => {
    const acc = new Float32Array(size * size);
    let amp = 1, tot = 0;
    for (let o = 0; o < 4; o++) {
      const l = layer(base << o);
      for (let i = 0; i < acc.length; i++) acc[i] += l[i] * amp;
      tot += amp; amp *= 0.5;
    }
    for (let i = 0; i < acc.length; i++) acc[i] /= tot;
    return acc;
  };
  const ch = [fbm(4), fbm(8), fbm(16), layer(64)];
  for (let i = 0; i < size * size; i++) for (let c = 0; c < 4; c++) {
    // stretch contrast of the fbm layers back to roughly 0..1
    const v = c < 3 ? (ch[c][i] - 0.5) * 1.9 + 0.5 : ch[c][i];
    data[i * 4 + c] = Math.max(0, Math.min(255, Math.round(v * 255)));
  }
  const t = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.magFilter = THREE.LinearFilter; t.minFilter = THREE.LinearMipmapLinearFilter;
  t.generateMipmaps = true; t.needsUpdate = true;
  return t;
}

// Canvas helper -> texture
export function canvasTexture(w, h, draw, { srgb = true, repeat = false, mipmaps = true } = {}) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = maxAniso;
  t.generateMipmaps = mipmaps;
  if (!mipmaps) t.minFilter = THREE.LinearFilter;
  return t;
}

// Track loading so the loading screen can wait for every queued texture.
const progress = { loaded: 0, total: 0, waiters: [] };
const itemStart = manager.itemStart.bind(manager), itemEnd = manager.itemEnd.bind(manager);
manager.itemStart = (url) => { progress.total++; itemStart(url); };
manager.itemEnd = (url) => {
  progress.loaded++; itemEnd(url);
  if (progress.loaded >= progress.total) { const w = progress.waiters; progress.waiters = []; w.forEach((f) => f()); }
};
manager.onError = (url) => console.warn('Texture failed to load:', url);
export function textureProgress() { return progress.total ? progress.loaded / progress.total : 1; }
export function waitForTextures() {
  return new Promise((resolve) => {
    if (progress.loaded >= progress.total) return resolve();
    progress.waiters.push(resolve);
  });
}
