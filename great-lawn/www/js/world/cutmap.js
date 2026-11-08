// Where the lawn has been mown, and in which direction.
// GPU: an RGBA render target over the plan (R = cut, GB = mowing direction) read by the
//      grass and ground shaders; each frame the deck's swept path is stamped into it.
// CPU: a 0.5 m grid of the same strokes for the progress figure, the plan and saving.
import * as THREE from '../../vendor/three.module.js';
import { MAP } from './layout.js';

export const GRID = 512;                 // CPU grid resolution over the plan
const GCELL = MAP.size / GRID;           // 0.5 m

export class CutMap {
  constructor(renderer, plan, res) {
    this.renderer = renderer;
    this.res = res;
    this.rt = new THREE.WebGLRenderTarget(res, res, {
      type: THREE.UnsignedByteType, format: THREE.RGBAFormat, depthBuffer: false, stencilBuffer: false,
      magFilter: THREE.LinearFilter, minFilter: THREE.LinearFilter, generateMipmaps: false,
    });
    this.texture = this.rt.texture;
    this.clear();

    // ---- stamp: a capsule along the deck's path, rasterised in plan space ----
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(12), 3));
    geo.setIndex([0, 1, 2, 2, 1, 3]);
    this.stampGeo = geo;
    this.stampMat = new THREE.ShaderMaterial({
      uniforms: {
        uA: { value: new THREE.Vector2() }, uB: { value: new THREE.Vector2() },
        uR: { value: 0.6 }, uDir: { value: new THREE.Vector2(1, 0) }, uRect: { value: new THREE.Vector4(MAP.min, MAP.size, 0, 0) },
      },
      vertexShader: /* glsl */`
        uniform vec4 uRect; varying vec2 vW;
        void main() { vW = position.xz; vec2 ndc = (position.xz - uRect.x) / uRect.y * 2.0 - 1.0; gl_Position = vec4(ndc, 0.0, 1.0); }`,
      fragmentShader: /* glsl */`
        uniform vec2 uA, uB, uDir; uniform float uR; varying vec2 vW;
        void main() {
          vec2 ab = uB - uA; float t = clamp(dot(vW - uA, ab) / max(dot(ab, ab), 1e-6), 0.0, 1.0);
          float d = length(vW - (uA + ab * t));
          float m = 1.0 - smoothstep(uR - 0.07, uR, d);
          if (m <= 0.0) discard;
          gl_FragColor = vec4(1.0, uDir * 0.5 + 0.5, m);
        }`,
      depthTest: false, depthWrite: false, transparent: true,
      blending: THREE.CustomBlending, blendEquation: THREE.AddEquation,
      blendSrc: THREE.SrcAlphaFactor, blendDst: THREE.OneMinusSrcAlphaFactor,
      blendSrcAlpha: THREE.ZeroFactor, blendDstAlpha: THREE.OneFactor,
    });
    this.stampScene = new THREE.Scene();
    this.stampMesh = new THREE.Mesh(geo, this.stampMat);
    this.stampMesh.frustumCulled = false;
    this.stampScene.add(this.stampMesh);
    this.stampCam = new THREE.OrthographicCamera(-1, 1, 1, -1, -1, 1);
    this.pending = [];

    // ---- CPU grid ----
    this.cut = new Uint8Array(GRID * GRID);
    this.dir = new Uint8Array(GRID * GRID);
    this.lawnCell = new Uint8Array(GRID * GRID);
    let total = 0;
    for (let j = 0; j < GRID; j++) for (let i = 0; i < GRID; i++) {
      const x = MAP.min + (i + 0.5) * GCELL, z = MAP.min + (j + 0.5) * GCELL;
      const k = plan.idx(x, z);
      if (k < 0) continue;
      if (plan.m.lawn[k] > 127 && plan.m.grass[k] > 127 && plan.sdf(x, z) > 0.35) { this.lawnCell[j * GRID + i] = 1; total++; }
    }
    this.totalLawn = total;
    this.cutLawn = 0;
    this.listeners = [];
  }

  clear() {
    const r = this.renderer;
    const prevTarget = r.getRenderTarget(), prevColor = new THREE.Color(), prevAlpha = r.getClearAlpha();
    r.getClearColor(prevColor);
    r.setRenderTarget(this.rt);
    r.setClearColor(new THREE.Color(0, 0.5, 0.5), 0);
    // clear colour is treated as sRGB-agnostic raw values for an UnsignedByte target with no colour space
    r.clear(true, false, false);
    r.setRenderTarget(prevTarget);
    r.setClearColor(prevColor, prevAlpha);
    if (this.cut) { this.cut.fill(0); this.dir.fill(0); this.cutLawn = 0; }
  }

  get progress() { return this.totalLawn ? this.cutLawn / this.totalLawn : 0; }

  // Queue a swept stroke from a to b (Vector2 in metres), radius r, direction (unit Vector2).
  stroke(a, b, r, dir) {
    this.pending.push([a.x, a.y, b.x, b.y, r, dir.x, dir.y]);
    return this.strokeCPU(a.x, a.y, b.x, b.y, r, dir.x, dir.y);
  }

  strokeCPU(ax, az, bx, bz, r, dx, dz) {
    const x0 = Math.floor((Math.min(ax, bx) - r - MAP.min) / GCELL), x1 = Math.ceil((Math.max(ax, bx) + r - MAP.min) / GCELL);
    const z0 = Math.floor((Math.min(az, bz) - r - MAP.min) / GCELL), z1 = Math.ceil((Math.max(az, bz) + r - MAP.min) / GCELL);
    const abx = bx - ax, abz = bz - az, ab2 = Math.max(abx * abx + abz * abz, 1e-9);
    const dByte = Math.round(((Math.atan2(dz, dx) / (Math.PI * 2)) + 1) % 1 * 255);
    let fresh = 0;
    for (let j = Math.max(0, z0); j < Math.min(GRID, z1); j++) {
      for (let i = Math.max(0, x0); i < Math.min(GRID, x1); i++) {
        const x = MAP.min + (i + 0.5) * GCELL, z = MAP.min + (j + 0.5) * GCELL;
        let t = ((x - ax) * abx + (z - az) * abz) / ab2; t = t < 0 ? 0 : t > 1 ? 1 : t;
        const ex = x - (ax + abx * t), ez = z - (az + abz * t);
        if (ex * ex + ez * ez > r * r) continue;
        const k = j * GRID + i;
        if (!this.cut[k]) {
          this.cut[k] = 1;
          if (this.lawnCell[k]) { this.cutLawn++; fresh++; }
          for (const f of this.listeners) f(i, j, dByte);
        } else if (this.dir[k] !== dByte) {
          for (const f of this.listeners) f(i, j, dByte);
        }
        this.dir[k] = dByte;
      }
    }
    return fresh;
  }

  // Draw queued strokes into the GPU map.
  flush() {
    if (!this.pending.length) return;
    const r = this.renderer;
    const prev = r.getRenderTarget(), prevAuto = r.autoClear;
    r.autoClear = false;
    r.setRenderTarget(this.rt);
    const pos = this.stampGeo.attributes.position.array;
    const u = this.stampMat.uniforms;
    for (const [ax, az, bx, bz, rad, dx, dz] of this.pending) {
      const m = rad + 0.1;
      const minx = Math.min(ax, bx) - m, maxx = Math.max(ax, bx) + m, minz = Math.min(az, bz) - m, maxz = Math.max(az, bz) + m;
      pos.set([minx, 0, minz, maxx, 0, minz, minx, 0, maxz, maxx, 0, maxz]);
      this.stampGeo.attributes.position.needsUpdate = true;
      u.uA.value.set(ax, az); u.uB.value.set(bx, bz); u.uR.value = rad; u.uDir.value.set(dx, dz);
      r.render(this.stampScene, this.stampCam);
    }
    this.pending.length = 0;
    r.setRenderTarget(prev);
    r.autoClear = prevAuto;
  }

  // ---- saving: run-length encoded cut + direction grid ----
  serialize() {
    const out = [];
    let prev = -1, run = 0;
    const push = () => { if (run) out.push(prev, run); };
    for (let k = 0; k < GRID * GRID; k++) {
      const v = this.cut[k] ? this.dir[k] + 1 : 0;
      if (v === prev && run < 65535) run++; else { push(); prev = v; run = 1; }
    }
    push();
    return out;
  }
  restore(data) {
    if (!Array.isArray(data)) return false;
    this.clear();
    let k = 0;
    const strokes = [];
    for (let n = 0; n < data.length; n += 2) {
      const v = data[n], run = data[n + 1];
      for (let i = 0; i < run && k < GRID * GRID; i++, k++) {
        if (!v) continue;
        this.cut[k] = 1; this.dir[k] = v - 1;
        if (this.lawnCell[k]) this.cutLawn++;
        strokes.push(k);
      }
    }
    // rebuild the GPU map from the grid with one upscaling blit
    const px = new Uint8Array(GRID * GRID * 4);
    for (let k2 = 0; k2 < GRID * GRID; k2++) {
      if (!this.cut[k2]) { px[k2 * 4 + 1] = 128; px[k2 * 4 + 2] = 128; continue; }
      const a = (this.dir[k2] / 255) * Math.PI * 2;
      px[k2 * 4] = 255; px[k2 * 4 + 1] = Math.round((Math.cos(a) * 0.5 + 0.5) * 255); px[k2 * 4 + 2] = Math.round((Math.sin(a) * 0.5 + 0.5) * 255);
      px[k2 * 4 + 3] = 255;
    }
    const src = new THREE.DataTexture(px, GRID, GRID, THREE.RGBAFormat);
    src.magFilter = src.minFilter = THREE.LinearFilter; src.needsUpdate = true;
    const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.ShaderMaterial({
      uniforms: { t: { value: src } },
      vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }',
      fragmentShader: 'uniform sampler2D t; varying vec2 vUv; void main(){ gl_FragColor = texture2D(t, vUv); }',
      depthTest: false, depthWrite: false,
    }));
    quad.frustumCulled = false;
    const sc = new THREE.Scene(); sc.add(quad);
    const r = this.renderer, prev = r.getRenderTarget();
    r.setRenderTarget(this.rt); r.render(sc, this.stampCam); r.setRenderTarget(prev);
    src.dispose(); quad.geometry.dispose(); quad.material.dispose();
    for (const k2 of strokes) for (const f of this.listeners) f(k2 % GRID, Math.floor(k2 / GRID), this.dir[k2]);
    return true;
  }
}
