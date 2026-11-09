// Ground: the estate (texture-splatted from the plan masks, lawn colour from the cut map)
// and the far countryside (patchwork fields, hedgerows and woods fading into haze).
import * as THREE from '../../vendor/three.module.js';
import { MAP, heightAt, normalAt } from './layout.js';
import { tex } from '../core/textures.js';
import { shared } from '../core/shared.js';

// Half-float height texture covering the plan, sampled by the grass shader.
export function makeHeightTexture(res = 512) {
  const data = new Uint16Array(res * res);
  for (let j = 0; j < res; j++) for (let i = 0; i < res; i++) {
    const x = MAP.min + (i + 0.5) / res * MAP.size, z = MAP.min + (j + 0.5) / res * MAP.size;
    data[j * res + i] = THREE.DataUtils.toHalfFloat(heightAt(x, z));
  }
  const t = new THREE.DataTexture(data, res, res, THREE.RedFormat, THREE.HalfFloatType);
  t.magFilter = t.minFilter = THREE.LinearFilter;
  t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
  t.needsUpdate = true;
  return t;
}

export function makeMaskTexture(plan) {
  const t = new THREE.DataTexture(plan.m.rgba, MAP.res, MAP.res, THREE.RGBAFormat);
  t.magFilter = THREE.LinearFilter; t.minFilter = THREE.LinearMipmapLinearFilter;
  t.generateMipmaps = true; t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
  t.needsUpdate = true;
  return t;
}

function gridGeometry(xs, zs, skip) {
  const nx = xs.length, nz = zs.length;
  const pos = new Float32Array(nx * nz * 3), nor = new Float32Array(nx * nz * 3);
  const n = new THREE.Vector3();
  for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) {
    const k = (j * nx + i) * 3, x = xs[i], z = zs[j];
    pos[k] = x; pos[k + 1] = heightAt(x, z); pos[k + 2] = z;
    normalAt(x, z, n); nor[k] = n.x; nor[k + 1] = n.y; nor[k + 2] = n.z;
  }
  const idx = [];
  for (let j = 0; j < nz - 1; j++) for (let i = 0; i < nx - 1; i++) {
    if (skip && skip(xs[i], zs[j], xs[i + 1], zs[j + 1])) continue;
    const a = j * nx + i, b = a + 1, c = a + nx, d = c + 1;
    idx.push(a, c, b, b, c, d);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  g.setIndex(nx * nz > 65535 ? new THREE.Uint32BufferAttribute(idx, 1) : new THREE.Uint16BufferAttribute(idx, 1));
  g.computeBoundingSphere();
  return g;
}

const range = (a, b, step) => { const r = []; for (let v = a; v <= b + 1e-6; v += step) r.push(v); return r; };

export function createGround({ maskTex, cutTex, noiseTex, quality }) {
  const step = quality.groundStep;
  const g = gridGeometry(range(MAP.min, MAP.max, step), range(MAP.min, MAP.max, step));
  const mat = new THREE.MeshStandardMaterial({ roughness: 1, metalness: 0 });
  const uniforms = {
    tMask: { value: maskTex }, tCut: { value: cutTex }, tNoise: { value: noiseTex },
    tSoil: { value: tex('soil_diff') }, tSoilN: { value: tex('soil_nor') },
    tGravel: { value: tex('gravel_diff') }, tGravelN: { value: tex('gravel_nor') }, tGravelR: { value: tex('gravel_arm') },
    tPave: { value: tex('paving_diff') }, tPaveN: { value: tex('paving_nor') }, tPaveR: { value: tex('paving_arm') },
    uMapRect: { value: new THREE.Vector4(MAP.min, MAP.min, MAP.size, 1 / MAP.size) },
    uGrassFar: { value: quality.grassR[2] },
    uCamPos: shared.uCamPos,
  };
  mat.onBeforeCompile = (s) => {
    Object.assign(s.uniforms, uniforms);
    s.vertexShader = s.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vWPos;')
      .replace('#include <fog_vertex>', '#include <fog_vertex>\nvWPos = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    s.fragmentShader = s.fragmentShader
      .replace('#include <common>', `#include <common>
        varying vec3 vWPos;
        uniform sampler2D tMask, tCut, tNoise, tSoil, tSoilN, tGravel, tGravelN, tGravelR, tPave, tPaveN, tPaveR;
        uniform vec4 uMapRect; uniform float uGrassFar; uniform vec3 uCamPos;
        vec4 gW; float gRough; vec3 gNormalW;
        vec3 tri(sampler2D t, vec2 uv) { return texture2D(t, uv).rgb; }
      `)
      .replace('#include <map_fragment>', `
        vec2 wxz = vWPos.xz;
        vec2 muv = (wxz - uMapRect.xy) * uMapRect.w;
        vec4 mk = texture2D(tMask, muv);
        vec4 ct = texture2D(tCut, muv);
        vec4 nz = texture2D(tNoise, wxz * 0.011);
        vec4 nz2 = texture2D(tNoise, wxz * 0.071);
        vec2 uvG = vec2(wxz.x, -wxz.y);
        // weights
        float wGravel = mk.r, wPave = mk.b, wBed = mk.a, wGrass = mk.g;
        float wsum = max(wGravel + wPave + wBed + wGrass, 1e-3);
        gW = vec4(wGravel, wPave, wBed, wGrass) / wsum;
        vec3 soil = tri(tSoil, uvG * 0.42);
        vec3 grav = tri(tGravel, uvG * 0.38) * vec3(1.08, 1.0, 0.9);
        vec3 pave = tri(tPave, uvG * 0.31) * vec3(1.05, 1.0, 0.92);
        // lawn and meadow colour (what the grass looks like from a distance)
        float dCam = distance(wxz, uCamPos.xz);
        vec3 meadow = mix(vec3(0.17, 0.2, 0.06), vec3(0.3, 0.29, 0.1), smoothstep(0.25, 0.8, nz.r));
        meadow = mix(meadow, vec3(0.13, 0.19, 0.05), smoothstep(0.55, 0.9, nz.g) * 0.6);
        vec3 lawn = vec3(0.085, 0.17, 0.035) * (0.85 + 0.35 * nz2.b);
        vec2 mdir = ct.gb * 2.0 - 1.0;
        vec3 vd = vWPos - uCamPos;
        float stripe = dot(normalize(mdir + 1e-5), normalize(vd.xz + 1e-5)) * clamp(length(mdir) * 2.0, 0.0, 1.0);
        lawn *= 1.0 + 0.32 * stripe;
        float nearBlades = 1.0 - smoothstep(uGrassFar * 0.55, uGrassFar * 0.95, dCam);
        // under standing blades near the camera the ground is shaded thatch
        vec3 thatch = mix(soil * vec3(0.6, 0.68, 0.42), meadow * 0.6, 0.55);
        vec3 tallGround = mix(meadow, thatch, nearBlades * 0.8);
        vec3 cutGround = mix(lawn, soil * vec3(0.5, 0.6, 0.35) * 0.8 + lawn * 0.5, nearBlades * 0.35);
        vec3 grassC = mix(tallGround, cutGround, smoothstep(0.1, 0.9, ct.r));
        vec3 albedo = grav * gW.x + pave * gW.y + soil * 0.8 * gW.z + grassC * gW.w;
        diffuseColor.rgb *= albedo;
      `)
      .replace('#include <roughnessmap_fragment>', `
        float roughnessFactor = roughness;
        float rG = texture2D(tGravelR, uvG * 0.38).g, rP = texture2D(tPaveR, uvG * 0.31).g;
        roughnessFactor = rG * gW.x + rP * gW.y + 0.95 * gW.z + 0.92 * gW.w;
      `)
      .replace('#include <normal_fragment_maps>', `
        {
          vec3 nG = texture2D(tGravelN, uvG * 0.38).xyz * 2.0 - 1.0;
          vec3 nP = texture2D(tPaveN, uvG * 0.31).xyz * 2.0 - 1.0;
          vec3 nS = texture2D(tSoilN, uvG * 0.42).xyz * 2.0 - 1.0;
          vec3 nT = nG * gW.x + nP * gW.y + nS * (gW.z + gW.w * 0.4) + vec3(0.0, 0.0, 1.0) * gW.w * 0.6;
          nT.xy *= 1.0;
          // tangent frame for planar xz mapping: T = +x, B = -z, N = up
          vec3 nW = normalize(vec3(nT.x, nT.z, -nT.y));
          normal = normalize((viewMatrix * vec4(nW, 0.0)).xyz);
        }
      `);
  };
  const mesh = new THREE.Mesh(g, mat);
  mesh.receiveShadow = true;
  mesh.frustumCulled = false;
  mesh.name = 'ground';
  return mesh;
}

// The far countryside: a big grid with a hole where the estate ground is.
export function createFarTerrain(noiseTex) {
  const coords = [];
  let v = 126, s = 6;
  while (v < 3600) { coords.push(v); v += s; s *= 1.09; }
  const xs = [...coords.map((c) => -c).reverse(), ...range(-120, 120, 12), ...coords];
  const geo = gridGeometry(xs, xs, (x0, z0, x1, z1) => Math.max(Math.abs(x0), Math.abs(x1)) < 125.5 && Math.max(Math.abs(z0), Math.abs(z1)) < 125.5);
  geo.translate(0, -0.05, 0);
  const mat = new THREE.MeshStandardMaterial({ roughness: 0.95, metalness: 0 });
  const uniforms = { tNoise: { value: noiseTex } };
  mat.onBeforeCompile = (s) => {
    Object.assign(s.uniforms, uniforms);
    s.vertexShader = s.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vWPos;')
      .replace('#include <fog_vertex>', '#include <fog_vertex>\nvWPos = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    s.fragmentShader = s.fragmentShader
      .replace('#include <common>', `#include <common>
        varying vec3 vWPos; uniform sampler2D tNoise;
        float h21(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      `)
      .replace('#include <map_fragment>', `
        vec2 p = vWPos.xz;
        float r = length(p);
        // fields: a rotated, jittered grid of plots separated by hedgerows
        vec2 q = mat2(0.94, -0.34, 0.34, 0.94) * p / 150.0;
        q += (texture2D(tNoise, p * 0.0009).rg - 0.5) * 0.6;
        vec2 cell = floor(q), f = fract(q);
        float kind = h21(cell);
        vec3 pasture = mix(vec3(0.12, 0.2, 0.05), vec3(0.17, 0.24, 0.07), h21(cell + 3.1));
        vec3 hay = vec3(0.32, 0.31, 0.12), wheat = vec3(0.42, 0.34, 0.14), plough = vec3(0.2, 0.15, 0.09);
        vec3 col = kind < 0.55 ? pasture : kind < 0.75 ? hay : kind < 0.9 ? wheat : plough;
        // mowing / crop lines inside fields
        float lines = sin((kind < 0.55 ? 0.0 : 1.0) * dot(f, vec2(1.0, 0.3)) * 180.0) * 0.5 + 0.5;
        col *= 0.94 + 0.08 * lines;
        // hedgerows
        vec2 e = min(f, 1.0 - f);
        float hedge = 1.0 - smoothstep(0.004, 0.018, min(e.x, e.y));
        col = mix(col, vec3(0.05, 0.08, 0.025), hedge * 0.9);
        // woods
        float wood = smoothstep(0.58, 0.64, texture2D(tNoise, p * 0.00045 + 0.3).b);
        col = mix(col, vec3(0.04, 0.07, 0.025), wood);
        // the park nearer the house is all pasture
        float park = 1.0 - smoothstep(180.0, 340.0, r);
        vec3 parkC = mix(vec3(0.15, 0.2, 0.06), vec3(0.24, 0.25, 0.09), texture2D(tNoise, p * 0.006).r);
        col = mix(col, parkC, park);
        col *= 0.85 + 0.3 * texture2D(tNoise, p * 0.004).g;
        diffuseColor.rgb *= col;
      `);
  };
  const mesh = new THREE.Mesh(geo, mat);
  mesh.receiveShadow = true;
  mesh.frustumCulled = false;
  mesh.name = 'far-terrain';
  return mesh;
}
