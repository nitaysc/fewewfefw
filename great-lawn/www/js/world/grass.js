// Grass: hundreds of thousands of individual blades, drawn as instanced 4 m tiles in three
// levels of detail. Every blade reads the cut map: uncut it is knee-high meadow with seed
// heads and wild flowers; mown it is a short blade laid over in the direction of travel,
// which is what makes the stripes. Wind gusts roll across, the mower parts the grass,
// blades glow when the sun is behind them, and they receive the scene's shadows.
import * as THREE from '../../vendor/three.module.js';
import { MAP } from './layout.js';
import { shared, LIGHT_GLSL, STATIC_SHADOW_GLSL } from '../core/shared.js';
import { GLSL_NOISE } from '../core/util.js';

const TILE = 4;

// `total` is the full-detail blade count: ranks are global, so a coarser level (a prefix of
// the same sequence) thins out at exactly the rate the finer one would have.
function tileGeometry(count, segs, total = count) {
  // R2 low-discrepancy sequence: every prefix is evenly spread, so lower LODs are subsets.
  const g1 = 0.7548776662466927, g2 = 0.5698402909980532;
  const vpb = segs * 2 + 1;
  const blade = new Float32Array(count * vpb * 4);
  const vert = new Float32Array(count * vpb * 2);
  const idx = [];
  for (let n = 0; n < count; n++) {
    const x = ((0.5 + g1 * (n + 1)) % 1) * TILE, z = ((0.5 + g2 * (n + 1)) % 1) * TILE;
    const rank = (n + 0.5) / total;
    for (let v = 0; v < vpb; v++) {
      const o = (n * vpb + v);
      blade.set([x, z, rank, n % 997], o * 4);
      if (v === vpb - 1) vert.set([0, 1], o * 2);
      else vert.set([v % 2 === 0 ? -1 : 1, Math.floor(v / 2) / segs], o * 2);
    }
    const b = n * vpb;
    for (let s = 0; s < segs - 1; s++) {
      const a = b + s * 2;
      idx.push(a, a + 1, a + 2, a + 2, a + 1, a + 3);
    }
    const last = b + (segs - 1) * 2;
    idx.push(last, last + 1, b + vpb - 1);
  }
  const g = new THREE.InstancedBufferGeometry();
  g.setAttribute('aBlade', new THREE.BufferAttribute(blade, 4));
  g.setAttribute('aVert', new THREE.BufferAttribute(vert, 2));
  // three needs a position attribute to know the vertex count
  g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(count * vpb * 3), 3));
  g.setIndex(count * vpb > 65535 ? new THREE.Uint32BufferAttribute(idx, 1) : new THREE.Uint16BufferAttribute(idx, 1));
  return g;
}

const vertexShader = /* glsl */`
#include <common>
#include <shadowmap_pars_vertex>
#include <fog_pars_vertex>
attribute vec4 aBlade;
attribute vec2 aVert;
attribute vec3 aTile;
uniform sampler2D tCut, tMask, tHeight, tNoise;
uniform vec4 uMapRect;
uniform vec3 uCamPos;
uniform vec4 uLod;          // keep radius, fade start, fade end, width boost cap
uniform vec4 uMower;        // x, z, forward x, forward z
uniform float uTime;
uniform vec4 uWind;
uniform float uDensityScale;
varying vec3 vCol;
varying vec3 vNrm;
varying vec3 vWorld;
varying float vT;
varying float vAO;
varying float vCut;
varying vec2 vMow;
varying float vFlower;
${GLSL_NOISE}
void main() {
  vec2 lp = aBlade.xy;
  float sym = aTile.z;
  if (mod(sym, 2.0) >= 1.0) lp.x = ${TILE.toFixed(1)} - lp.x;
  if (mod(floor(sym * 0.5), 2.0) >= 1.0) lp.y = ${TILE.toFixed(1)} - lp.y;
  if (sym >= 4.0) lp = lp.yx;
  vec2 root = aTile.xy + lp;
  vec2 hh = hash22(root * 1.731);
  root += (hh - 0.5) * 0.09;
  vec2 muv = (root - uMapRect.xy) * uMapRect.w;
  float grassAmt = texture2D(tMask, muv).g;
  vec4 cutS = texture2D(tCut, muv);
  // each blade has its own idea of where the cut ends, so the edge of a pass is ragged
  float thr = 0.12 + 0.7 * hash12(root * 5.31 + 1.7);
  float cut = smoothstep(thr - 0.07, thr + 0.07, cutS.r);
  float h0 = texture2D(tHeight, muv).r;

  // ---- level of detail: keep a rank-sorted subset that thins out with distance ----
  float dist = distance(root, uCamPos.xz);
  float keep = clamp(pow(uLod.x / max(dist, 0.001), 2.0), 0.0, 1.0) * (1.0 - smoothstep(uLod.y, uLod.z, dist));
  keep *= uDensityScale;
  float vis = 1.0 - smoothstep(keep * 0.75, keep, aBlade.z);
  vis *= smoothstep(0.35, 0.7, grassAmt);
  float widthBoost = clamp(inversesqrt(max(keep, 0.0001)), 1.0, uLod.w);

  // ---- per-blade character ----
  float r1 = hash12(root * 3.11), r2 = hash12(root * 7.37 + 3.1), r3 = hash12(root * 1.93 - 9.2);
  float patchA = vnoise(root * 0.045) ;
  float patchB = vnoise(root * 0.21 + 17.0);
  float tallH = mix(0.30, 0.74, r1) * (0.72 + 0.55 * patchA);
  // stubble: uneven, and here and there a stalk the blades missed
  float cutH = mix(0.03, 0.075, r1 * r1) * (r2 > 0.985 ? 2.6 : 1.0);
  bool seed = r2 > 0.97;                         // seed-head stems
  float flower = (r2 > 0.957 && r2 <= 0.97 && dist < uLod.x * 3.0) ? 1.0 : 0.0;  // buttercups, daisies, clover
  if (seed) tallH *= 1.3;
  float H = mix(tallH, cutH, cut) * vis;
  float width = (seed ? 0.0035 : mix(0.0075, 0.0145, r3)) * (flower > 0.5 ? 1.0 : widthBoost) * mix(1.0, 0.62, cut);
  vFlower = flower * (1.0 - cut) * smoothstep(0.55, 0.74, aVert.y);

  // ---- shape: lean, wind, mower ----
  float ang = r3 * 6.2831;
  vec2 face = vec2(cos(ang), sin(ang));
  vec2 side = vec2(-face.y, face.x);
  vec2 rdir = normalize(hh - 0.5 + 0.0001);
  vec2 mow = cutS.gb * 2.0 - 1.0;
  float mowLen = length(mow);
  vec2 mowDir = mowLen > 0.05 ? mow / mowLen : rdir;
  vec2 leanDir = normalize(mix(rdir, mowDir, cut));
  float lean = mix(0.18 + 0.45 * r2 * r2, 0.22 + 0.28 * r1, cut);
  // long grass at the edge of a fresh cut has lost its neighbours' support: it flops over
  // onto the mown side
  if (cut < 0.5 && dist < 16.0) {
    float e = 0.28 * uMapRect.w;
    vec2 grad = vec2(texture2D(tCut, muv + vec2(e, 0.0)).r - texture2D(tCut, muv - vec2(e, 0.0)).r,
                     texture2D(tCut, muv + vec2(0.0, e)).r - texture2D(tCut, muv - vec2(0.0, e)).r);
    float edge = clamp(length(grad) * 1.6, 0.0, 1.0) * (1.0 - cut) * (0.55 + 0.45 * r2);
    if (edge > 0.01) {
      leanDir = normalize(mix(leanDir, normalize(grad), edge));
      lean = mix(lean, 0.8, edge * 0.85);
    }
  }
  // wind gusts travel across the lawn
  vec2 wdir = uWind.xy;
  float gust = vnoise(root * 0.07 - wdir * uTime * 0.9) * 0.75 + vnoise(root * 0.23 - wdir * uTime * 2.1) * 0.25;
  float flutter = sin(uTime * (2.3 + r1 * 2.0) + r2 * 6.28) * 0.08;
  vec2 wind = wdir * uWind.z * (0.12 + 0.7 * gust * gust) + side * flutter;
  wind *= mix(1.0, 0.25, cut);
  // the mower parts the grass in front of and under it
  vec2 rel = root - uMower.xy;
  vec2 fw = uMower.zw, rt = vec2(-fw.y, fw.x);
  float lx = dot(rel, rt), lz = dot(rel, fw);
  vec2 q = vec2(abs(lx) - 0.66, abs(lz) - 1.2);
  float bd = length(max(q, 0.0)) + min(max(q.x, q.y), 0.0);
  float push = 1.0 - smoothstep(-0.1, 0.35, bd);
  vec2 pdir = normalize(rt * sign(lx) * 1.2 + fw * 0.5);
  vec2 tip = leanDir * lean + wind;
  tip = mix(tip, pdir * 1.1, push);
  H *= mix(1.0, 0.45, push);
  float tl = length(tip);
  if (tl > 0.95) tip *= 0.95 / tl;
  float tipY = sqrt(max(1.0 - dot(tip, tip), 0.0));

  // quadratic Bezier from root to tip, so blades curve rather than bend at the base
  float t = aVert.y;
  vec3 p1 = vec3(tip.x * 0.15, tipY * 0.62 + 0.38, tip.y * 0.15) * H;
  vec3 p2 = vec3(tip.x, tipY, tip.y) * H;
  vec3 pos = 2.0 * (1.0 - t) * t * p1 + t * t * p2;
  vec3 tang = normalize(2.0 * (1.0 - t) * p1 + 2.0 * t * (p2 - p1) + vec3(0.0, 1e-4, 0.0));
  float taper = seed ? (t > 0.7 ? 2.6 : 1.0) : (1.0 - pow(t, 1.6) * 0.92);
  if (flower > 0.5) taper = t > 0.7 ? 1.7 : 0.4;
  taper = mix(taper, 1.0 - t * 0.35, cut);       // mown blades are cut square
  vec3 sideW = vec3(side.x, 0.0, side.y);
  pos += sideW * aVert.x * width * taper;
  vec3 nrm = normalize(cross(tang, sideW));
  if (dot(nrm.xz, face) < 0.0) nrm = -nrm;
  nrm = normalize(nrm + sideW * aVert.x * 0.45);

  vec3 wp = vec3(root.x, h0, root.y) + pos;
  vWorld = wp;
  vNrm = nrm;
  vT = t;
  vCut = cut;
  vMow = mowDir * clamp(mowLen * 2.0, 0.0, 1.0) * cut;

  // ---- colour ----
  vec3 base = mix(vec3(0.035, 0.065, 0.014), vec3(0.075, 0.12, 0.026), r1);
  vec3 tipTall = mix(vec3(0.27, 0.31, 0.09), vec3(0.44, 0.4, 0.16), r2 * r2 + patchA * 0.35);
  tipTall = mix(tipTall, vec3(0.16, 0.25, 0.05), patchB * 0.5);
  // cut blades: green stubble, a shade paler at the fresh cut, the odd straw-coloured one
  vec3 tipCut = mix(vec3(0.1, 0.19, 0.055), vec3(0.15, 0.25, 0.075), r2);
  if (r3 > 0.93) tipCut = vec3(0.2, 0.19, 0.09);
  vec3 baseCut = tipCut * 0.62;
  vec3 col = mix(mix(base, baseCut, cut), mix(tipTall, tipCut, cut), smoothstep(0.0, 1.0, t));
  if (seed && t > 0.7) col = vec3(0.42, 0.36, 0.2);
  if (vFlower > 0.5) {
    float k = fract(r1 * 13.7);
    col = k < 0.5 ? vec3(0.85, 0.66, 0.04) : k < 0.8 ? vec3(0.8, 0.79, 0.74) : vec3(0.7, 0.4, 0.55);
  }
  col *= 0.85 + 0.3 * patchA;
  vCol = col;
  vAO = mix(mix(0.22, 1.0, smoothstep(0.0, 0.95, t)), mix(0.75, 1.0, t), cut);

  vec4 worldPosition = vec4(wp, 1.0);
  vec4 mvPosition = viewMatrix * worldPosition;
  gl_Position = projectionMatrix * mvPosition;
  vec3 transformedNormal = normalize((viewMatrix * vec4(nrm, 0.0)).xyz);
  #include <shadowmap_vertex>
  #include <fog_vertex>
}
`;

const fragmentShader = /* glsl */`
#include <common>
#include <packing>
#include <lights_pars_begin>
#include <shadowmap_pars_fragment>
#include <shadowmask_pars_fragment>
#include <fog_pars_fragment>
${LIGHT_GLSL}
${STATIC_SHADOW_GLSL}
uniform vec3 uCamPos;
varying vec3 vCol;
varying vec3 vNrm;
varying vec3 vWorld;
varying float vT;
varying float vAO;
varying float vCut;
varying vec2 vMow;
varying float vFlower;
void main() {
  vec3 N = normalize(vNrm) * (gl_FrontFacing ? 1.0 : -1.0);
  vec3 V = normalize(uCamPos - vWorld);
  N = normalize(mix(N, vec3(0.0, 1.0, 0.0), 0.3));
  vec3 L = uSunDir;
  float sh = min(getShadowMask(), staticShadow(vWorld));
  vec3 albedo = vCol;
  // stripes: blades laid away from you show their pale backs
  float stripe = dot(vMow, normalize(-V.xz + 1e-5));
  albedo *= 1.0 + 0.36 * stripe;
  float ndl = clamp(dot(N, L) * 0.75 + 0.25, 0.0, 1.0);
  vec3 col = albedo * RECIPROCAL_PI * uSunColor * ndl * sh;
  // light through the blade when the sun is behind it
  float back = pow(clamp(dot(-V, L), 0.0, 1.0), 2.5);
  col += albedo * vec3(1.05, 1.2, 0.55) * RECIPROCAL_PI * uSunColor * back * sh * (0.25 + 0.75 * vT) * 1.1;
  col += albedo * skyAmbient(N) * vAO;
  vec3 Hh = normalize(L + V);
  float distFade = 1.0 - smoothstep(6.0, 30.0, length(uCamPos - vWorld));
  col += uSunColor * pow(clamp(dot(N, Hh), 0.0, 1.0), 48.0) * 0.05 * sh * vT * (1.0 - vFlower) * distFade;
  col *= mix(1.0, vAO, 0.35);
  col = min(col, vec3(1.6));
  gl_FragColor = vec4(col, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
  #include <fog_fragment>
}
`;

export class Grass {
  constructor({ scene, cutTex, maskTex, heightTex, noiseTex, quality }) {
    this.quality = quality;
    const density = quality.grassDensity;
    const n0 = Math.round(density * TILE * TILE);
    this.R = quality.grassR;
    this.uniforms = THREE.UniformsUtils.merge([THREE.UniformsLib.lights, THREE.UniformsLib.fog, {
      tCut: { value: null }, tMask: { value: null }, tHeight: { value: null }, tNoise: { value: null },
      uMapRect: { value: new THREE.Vector4(MAP.min, MAP.min, MAP.size, 1 / MAP.size) },
      uLod: { value: new THREE.Vector4(this.R[0] * 0.5, this.R[2] * 0.8, this.R[2], 4.0 * quality.grassLodWidth) },
      uMower: { value: new THREE.Vector4(0, 0, 0, -1) },
      uDensityScale: { value: 1 },
    }]);
    this.uniforms.tCut.value = cutTex;
    this.uniforms.tMask.value = maskTex;
    this.uniforms.tHeight.value = heightTex;
    this.uniforms.tNoise.value = noiseTex;
    // shared (live) uniforms
    Object.assign(this.uniforms, {
      uTime: shared.uTime, uWind: shared.uWind, uCamPos: shared.uCamPos,
      uSunDir: shared.uSunDir, uSunColor: shared.uSunColor, uAmbUp: shared.uAmbUp, uAmbDown: shared.uAmbDown,
      tStaticShadow: shared.tStaticShadow, uStaticShadowMatrix: shared.uStaticShadowMatrix,
    });
    this.material = new THREE.ShaderMaterial({
      uniforms: this.uniforms, vertexShader, fragmentShader,
      lights: true, fog: true, side: THREE.DoubleSide,
    });
    this.lods = [];
    const counts = [n0, Math.ceil(n0 / 4), Math.ceil(n0 / 16)];
    const SEGS = quality.grassSegs || [4, 2, 1];
    const maxTiles = Math.ceil((2 * this.R[2] / TILE + 2) ** 2);
    for (let l = 0; l < 3; l++) {
      const g = tileGeometry(counts[l], SEGS[l], n0);
      g.userData.blades = counts[l];
      const tiles = new THREE.InstancedBufferAttribute(new Float32Array(maxTiles * 3), 3);
      tiles.setUsage(THREE.DynamicDrawUsage);
      g.setAttribute('aTile', tiles);
      g.instanceCount = 0;
      const mesh = new THREE.Mesh(g, this.material);
      mesh.frustumCulled = false;
      mesh.receiveShadow = true;
      mesh.renderOrder = -10 + l;
      mesh.name = 'grass-lod' + l;
      scene.add(mesh);
      this.lods.push({ mesh, tiles, list: [] });
    }
    this.frustum = new THREE.Frustum();
    this.m4 = new THREE.Matrix4();
    this.sphere = new THREE.Sphere();
    this.bladeCount = 0;
  }

  setMower(x, z, fx, fz) { this.uniforms.uMower.value.set(x, z, fx, fz); }

  update(camera) {
    const R = this.R;
    this.m4.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
    this.frustum.setFromProjectionMatrix(this.m4);
    const cx = camera.position.x, cz = camera.position.z, cy = camera.position.y;
    const i0 = Math.floor((cx - R[2]) / TILE), i1 = Math.floor((cx + R[2]) / TILE);
    const j0 = Math.floor((cz - R[2]) / TILE), j1 = Math.floor((cz + R[2]) / TILE);
    for (const l of this.lods) l.list.length = 0;
    const half = TILE / 2;
    for (let j = j0; j <= j1; j++) {
      const z = j * TILE;
      if (z + TILE < MAP.min || z > MAP.max) continue;
      for (let i = i0; i <= i1; i++) {
        const x = i * TILE;
        if (x + TILE < MAP.min || x > MAP.max) continue;
        // nearest distance from the camera to the tile (xz)
        const dx = Math.max(x - cx, 0, cx - (x + TILE)), dz = Math.max(z - cz, 0, cz - (z + TILE));
        const dn = Math.hypot(dx, dz);
        if (dn > R[2]) continue;
        this.sphere.center.set(x + half, 0.6, z + half);
        this.sphere.radius = half * 1.42 + 1.4;
        if (dn > 2 && !this.frustum.intersectsSphere(this.sphere)) continue;
        const lod = dn < R[0] ? 0 : dn < R[1] ? 1 : 2;
        const dc = Math.hypot(x + half - cx, z + half - cz) + Math.abs(cy) * 0.01;
        const h = ((i * 73856093) ^ (j * 19349663)) >>> 0;
        this.lods[lod].list.push(dc, x, z, h % 8);
      }
    }
    let blades = 0;
    for (const l of this.lods) {
      // near tiles first (helps early depth rejection)
      const n = l.list.length / 4;
      const order = new Array(n);
      for (let k = 0; k < n; k++) order[k] = k;
      order.sort((a, b) => l.list[a * 4] - l.list[b * 4]);
      const arr = l.tiles.array;
      for (let k = 0; k < n; k++) {
        const s = order[k] * 4;
        arr[k * 3] = l.list[s + 1]; arr[k * 3 + 1] = l.list[s + 2]; arr[k * 3 + 2] = l.list[s + 3];
      }
      l.mesh.geometry.instanceCount = n;
      l.tiles.clearUpdateRanges();
      l.tiles.addUpdateRange(0, n * 3);
      l.tiles.needsUpdate = true;
      blades += n * l.mesh.geometry.userData.blades;
    }
    this.bladeCount = blades;
  }
}
