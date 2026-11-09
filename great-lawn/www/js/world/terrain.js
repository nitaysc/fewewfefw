// Ground: the estate (texture-splatted from the plan masks, lawn colour from the cut map)
// and the far countryside (patchwork fields, hedgerows and woods fading into haze).
import * as THREE from '../../vendor/three.module.js';
import { MAP, heightAt, normalAt } from './layout.js';
import { tex } from '../core/textures.js';
import { shared, STATIC_SHADOW_GLSL } from '../core/shared.js';
import { turfTextures } from './turf.js';

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
  const turf = turfTextures();
  const uniforms = {
    tMask: { value: maskTex }, tCut: { value: cutTex }, tNoise: { value: noiseTex },
    tTurf: { value: turf.turf }, tClip: { value: turf.clippings },
    tSoil: { value: tex('soil_diff') }, tSoilN: { value: tex('soil_nor') },
    tGravel: { value: tex('gravel_diff') }, tGravelN: { value: tex('gravel_nor') },
    tPave: { value: tex('paving_diff') }, tPaveN: { value: tex('paving_nor') },
    uMapRect: { value: new THREE.Vector4(MAP.min, MAP.min, MAP.size, 1 / MAP.size) },
    uGrassFar: { value: quality.grassR[2] },
    uCamPos: shared.uCamPos,
    tStaticShadow: shared.tStaticShadow, uStaticShadowMatrix: shared.uStaticShadowMatrix,
  };
  mat.onBeforeCompile = (s) => {
    Object.assign(s.uniforms, uniforms);
    s.vertexShader = s.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vWPos;')
      .replace('#include <fog_vertex>', '#include <fog_vertex>\nvWPos = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    s.fragmentShader = s.fragmentShader
      .replace('#include <common>', `#include <common>
        varying vec3 vWPos;
        // Phones allow 16 textures per shader, and three adds the environment and shadow
        // maps: keep this list to 12 (the test suite checks it)
        uniform sampler2D tMask, tCut, tNoise, tSoil, tSoilN, tGravel, tGravelN, tPave, tPaveN;
        uniform sampler2D tTurf, tClip;
        uniform vec4 uMapRect; uniform float uGrassFar; uniform vec3 uCamPos;
        vec4 gW; float gRough; vec3 gNormalW;
        float gCutW; vec3 gTurfN; float gClipA;
        ${STATIC_SHADOW_GLSL}
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
        // mown: looking down into the cut sward, with depth (parallax), the thatch showing
        // between the blades, and the cut tops lying on it in patches and clumps
        gCutW = smoothstep(0.1, 0.9, ct.r) * gW.w;
        gTurfN = vec3(0.0, 0.0, 1.0); gClipA = 0.0;
        vec3 cutGround = lawn;
        if (gCutW > 0.002) {
          vec3 Vw = normalize(uCamPos - vWPos);
          vec2 tuv = wxz / 0.42;
          float h0 = texture2D(tTurf, tuv).a;
          vec2 par = -Vw.xz / max(Vw.y, 0.18) * (h0 - 0.7) * (0.022 / 0.42);
          vec4 tf = texture2D(tTurf, tuv + par);
          // relief of the sward from its height map (no separate normal map: see above)
          float hR = texture2D(tTurf, tuv + par + vec2(1.0 / 512.0, 0.0)).a;
          float hU = texture2D(tTurf, tuv + par + vec2(0.0, 1.0 / 512.0)).a;
          gTurfN = normalize(vec3((tf.a - hR) * 4.4, (tf.a - hU) * 4.4, 1.0));
          // patches: greener where it is damp, yellower where it is dry and thin
          float patchG = texture2D(tNoise, wxz * 0.035).g, patchF = texture2D(tNoise, wxz * 0.31 + 0.5).b;
          vec3 tintP = mix(vec3(0.95, 1.05, 1.0), vec3(1.22, 1.12, 0.82), smoothstep(0.35, 0.85, patchG));
          vec3 sward = tf.rgb * tintP * (0.9 + 0.2 * patchF) * mix(0.6, 1.08, tf.a);
          // the bases of long grass were shaded: a first cut leaves the low layers straw-pale
          sward = mix(sward, sward * vec3(1.45, 1.3, 0.85), (1.0 - smoothstep(0.25, 0.6, tf.a)) * 0.45);
          sward *= 1.0 + 0.3 * stripe;
          // clippings: thicker in places, a few clumps, fresh green going to hay
          float den = smoothstep(0.25, 0.7, texture2D(tNoise, wxz * 0.09 + 0.37).r) * 0.9 + 0.3;
          vec4 kp = texture2D(tClip, wxz / 0.9 + par * (0.42 / 0.9));
          gClipA = kp.a * den;
          vec3 clipC = kp.rgb * mix(1.15, 1.35, patchG);
          cutGround = mix(sward, clipC, gClipA);
        }
        vec3 grassC = mix(tallGround, cutGround, smoothstep(0.1, 0.9, ct.r));
        vec3 albedo = grav * gW.x + pave * gW.y + soil * 0.8 * gW.z + grassC * gW.w;
        diffuseColor.rgb *= albedo;
      `)
      .replace('#include <lights_fragment_begin>', `#include <lights_fragment_begin>
        {
          float ss = staticShadow(vWPos);
          reflectedLight.directDiffuse *= ss; reflectedLight.directSpecular *= ss;
        }`)
      .replace('#include <roughnessmap_fragment>', `
        float roughnessFactor = roughness;
        float rG = 0.88, rP = 0.72;
        roughnessFactor = rG * gW.x + rP * gW.y + 0.95 * gW.z + mix(0.92, mix(0.7, 0.82, gClipA), gCutW) * gW.w;
      `)
      .replace('#include <normal_fragment_maps>', `
        {
          vec3 nG = texture2D(tGravelN, uvG * 0.38).xyz * 2.0 - 1.0;
          vec3 nP = texture2D(tPaveN, uvG * 0.31).xyz * 2.0 - 1.0;
          vec3 nS = texture2D(tSoilN, uvG * 0.42).xyz * 2.0 - 1.0;
          vec3 nT = nG * gW.x + nP * gW.y + nS * (gW.z + gW.w * 0.4) + vec3(0.0, 0.0, 1.0) * gW.w * 0.6;
          // tangent frame for planar xz mapping: T = +x, B = -z, N = up
          vec3 nW = normalize(vec3(nT.x, nT.z, -nT.y));
          // the mown sward has its own relief (its texture runs T = +x, B = +z)
          vec3 nTurf = normalize(mix(vec3(gTurfN.x, gTurfN.z, gTurfN.y), vec3(0.0, 1.0, 0.0), gClipA * 0.6));
          nW = normalize(mix(nW, nTurf, gCutW));
          normal = normalize((viewMatrix * vec4(nW, 0.0)).xyz);
        }
      `);
  };
  const mesh = new THREE.Mesh(g, mat);
  mesh.receiveShadow = true;
  mesh.frustumCulled = false;
  mesh.name = 'ground';
  // if a GPU ever refuses the shader above, a plain lawn is better than a hole in the world
  mat.userData.fallback = () => new THREE.MeshStandardMaterial({ color: '#4d5c2a', roughness: 0.95, metalness: 0 });
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
