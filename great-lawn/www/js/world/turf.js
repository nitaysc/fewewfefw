// Textures for mown grass, drawn once at start-up:
//  turf      - looking down into a freshly cut sward: layers of short blades over dark thatch,
//              colour in RGB and height in alpha (for parallax and shading)
//  turfNormal- the same blades as a tangent-space normal map
//  clippings - the cut tops lying where the mower dropped them: loose strands and small
//              clumps, colour in RGB, coverage in alpha
// All tile seamlessly.
import * as THREE from '../../vendor/three.module.js';
import { rng } from '../core/util.js';

function canvas(size) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  return [c, c.getContext('2d')];
}

// Draw a tapered stroke (base -> tip), repeated across the tile edges so the result tiles.
function stroke(ctx, size, x, y, ang, len, w0, w1, bend, fill) {
  const dx = Math.cos(ang), dy = Math.sin(ang), nx = -dy, ny = dx;
  const tx = x + dx * len + nx * bend, ty = y + dy * len + ny * bend;
  const cx = x + dx * len * 0.5 + nx * bend * 0.6, cy = y + dy * len * 0.5 + ny * bend * 0.6;
  const reach = len + w0 + Math.abs(bend);
  for (const ox of [0, -size, size]) for (const oy of [0, -size, size]) {
    if (ox && (x + ox < -reach || x + ox > size + reach)) continue;
    if (oy && (y + oy < -reach || y + oy > size + reach)) continue;
    ctx.beginPath();
    ctx.moveTo(x + ox + nx * w0, y + oy + ny * w0);
    ctx.quadraticCurveTo(cx + ox + nx * (w0 + w1) * 0.5, cy + oy + ny * (w0 + w1) * 0.5, tx + ox + nx * w1, ty + oy + ny * w1);
    ctx.lineTo(tx + ox - nx * w1, ty + oy - ny * w1);
    ctx.quadraticCurveTo(cx + ox - nx * (w0 + w1) * 0.5, cy + oy - ny * (w0 + w1) * 0.5, x + ox - nx * w0, y + oy - ny * w0);
    ctx.closePath();
    ctx.fillStyle = fill;
    ctx.fill();
  }
}

const rgb = (r, g, b) => `rgb(${Math.round(r)},${Math.round(g)},${Math.round(b)})`;

function dataTexture(data, size, { srgb = false, aniso = 8 } = {}) {
  const t = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.magFilter = THREE.LinearFilter; t.minFilter = THREE.LinearMipmapLinearFilter;
  t.generateMipmaps = true; t.anisotropy = aniso;
  t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  t.needsUpdate = true;
  return t;
}

export function turfTextures({ size = 512, seed = 21 } = {}) {
  const r = rng(seed);
  // ---- the sward: colour and height drawn in step ----
  const [cc, cx] = canvas(size);
  const [hc, hx] = canvas(size);
  cx.fillStyle = rgb(30, 36, 18); cx.fillRect(0, 0, size, size);        // thatch and soil
  hx.fillStyle = '#000'; hx.fillRect(0, 0, size, size);
  // dead thatch underneath: pale, fine, lying every which way
  for (let i = 0; i < 2600; i++) {
    const v = 60 + r() * 50;
    const c = rgb(v * 1.05, v * 0.95, v * 0.55);
    const a = r() * Math.PI * 2, l = 6 + r() * 16, x = r() * size, y = r() * size;
    stroke(cx, size, x, y, a, l, 0.7, 0.4, (r() - 0.5) * 3, c);
    stroke(hx, size, x, y, a, l, 0.7, 0.4, (r() - 0.5) * 3, rgb(25, 25, 25));
  }
  // three layers of cut blades, each standing a little higher and catching more light;
  // a few dry or yellowed ones among them
  const layers = [[3600, 0.55, 70], [3000, 0.78, 145], [2200, 1.0, 215]];
  for (const [count, light, hgt] of layers) {
    for (let i = 0; i < count; i++) {
      const x = r() * size, y = r() * size;
      const a = r() * Math.PI * 2;
      const l = 6 + r() * r() * 18, w = 1.6 + r() * 1.6;
      const dry = r() < 0.05;
      const g = (0.8 + r() * 0.4) * light;
      const c = dry ? rgb(128 * g, 124 * g, 72 * g) : rgb((40 + r() * 22) * g, (80 + r() * 30) * g, (32 + r() * 14) * g);
      stroke(cx, size, x, y, a, l, w, w * 0.65, (r() - 0.5) * 4, c);
      // the cut end is square and a shade paler
      const ex = x + Math.cos(a) * l, ey = y + Math.sin(a) * l;
      cx.fillStyle = dry ? rgb(150 * g, 145 * g, 92 * g) : rgb(78 * g, 112 * g, 54 * g);
      cx.fillRect(ex - w * 0.6, ey - w * 0.6, w * 1.2, w * 1.2);
      stroke(hx, size, x, y, a, l, w, w * 0.65, (r() - 0.5) * 4, rgb(hgt * 0.7, hgt * 0.7, hgt * 0.7));
      hx.fillStyle = rgb(hgt, hgt, hgt);
      hx.fillRect(ex - w * 0.5, ey - w * 0.5, w, w);
    }
  }
  // clover leaves here and there: three round leaflets
  for (let i = 0; i < 260; i++) {
    const x = r() * size, y = r() * size, s = 2.2 + r() * 1.6;
    const g = 0.85 + r() * 0.3;
    for (let k = 0; k < 3; k++) {
      const a = k * 2.094 + r() * 0.4;
      cx.fillStyle = rgb(40 * g, 92 * g, 30 * g);
      cx.beginPath(); cx.ellipse(x + Math.cos(a) * s, y + Math.sin(a) * s, s, s * 0.8, a, 0, Math.PI * 2); cx.fill();
      hx.fillStyle = rgb(190, 190, 190);
      hx.beginPath(); hx.ellipse(x + Math.cos(a) * s, y + Math.sin(a) * s, s, s * 0.8, a, 0, Math.PI * 2); hx.fill();
    }
  }
  const col = cx.getImageData(0, 0, size, size).data;
  const hgt = hx.getImageData(0, 0, size, size).data;
  const N = size * size;
  const turf = new Uint8Array(N * 4), nrm = new Uint8Array(N * 4);
  const H = new Float32Array(N);
  for (let i = 0; i < N; i++) H[i] = hgt[i * 4] / 255;
  const wrap = (v) => (v + size) % size;
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const k = y * size + x;
    turf[k * 4] = col[k * 4]; turf[k * 4 + 1] = col[k * 4 + 1]; turf[k * 4 + 2] = col[k * 4 + 2];
    turf[k * 4 + 3] = hgt[k * 4];
    const dx = H[y * size + wrap(x + 1)] - H[y * size + wrap(x - 1)];
    const dy = H[wrap(y + 1) * size + x] - H[wrap(y - 1) * size + x];
    let nx = -dx * 2.2, ny = -dy * 2.2, nz = 1;
    const l = Math.hypot(nx, ny, nz); nx /= l; ny /= l; nz /= l;
    nrm[k * 4] = Math.round((nx * 0.5 + 0.5) * 255); nrm[k * 4 + 1] = Math.round((ny * 0.5 + 0.5) * 255);
    nrm[k * 4 + 2] = Math.round((nz * 0.5 + 0.5) * 255); nrm[k * 4 + 3] = 255;
  }

  // ---- clippings: strands and little clumps, on a transparent ground ----
  const [kc, kx] = canvas(size);
  kx.clearRect(0, 0, size, size);
  const clip = (x, y) => {
    const a = r() * Math.PI * 2, l = 10 + r() * 34, w = 0.9 + r() * 1.1;
    const fresh = r();
    const g = 0.75 + r() * 0.45;
    const c = fresh < 0.7 ? rgb((70 + r() * 40) * g, (112 + r() * 40) * g, (34 + r() * 20) * g)
      : fresh < 0.92 ? rgb(118 * g, 122 * g, 56 * g) : rgb(150 * g, 140 * g, 78 * g);
    stroke(kx, size, x, y, a, l, w, w * 0.5, (r() - 0.5) * 9, c);
  };
  for (let i = 0; i < 1500; i++) clip(r() * size, r() * size);
  for (let i = 0; i < 70; i++) {
    const x = r() * size, y = r() * size, n = 6 + Math.floor(r() * 14);
    for (let j = 0; j < n; j++) clip(x + (r() - 0.5) * 18, y + (r() - 0.5) * 18);
  }
  const kd = kx.getImageData(0, 0, size, size).data;
  const clips = new Uint8Array(N * 4);
  for (let i = 0; i < N * 4; i++) clips[i] = kd[i];
  // where coverage is thin, keep the colour of the nearest strand rather than black, so
  // mipmaps do not darken the edges
  for (let i = 0; i < N; i++) {
    if (clips[i * 4 + 3] === 0) { clips[i * 4] = 92; clips[i * 4 + 1] = 118; clips[i * 4 + 2] = 46; }
  }
  return {
    turf: dataTexture(turf, size, { srgb: true }),
    turfNormal: dataTexture(nrm, size),
    clippings: dataTexture(clips, size, { srgb: true }),
  };
}
