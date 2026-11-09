// Shared materials for the architecture and gardens.
import * as THREE from '../../vendor/three.module.js';
import { tex } from './textures.js';
import { shared } from './shared.js';

// Texture coordinates from world position (box-projected), so stone tiles at true scale on
// any mesh, instanced or not, without UV bookkeeping.
export function worldMapped(mat, scale = 2.0, { tint } = {}) {
  const inv = 1 / scale;
  mat.onBeforeCompile = (s) => {
    s.uniforms.uWScale = { value: inv };
    s.vertexShader = s.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vWPos2; varying vec3 vWNrm2;')
      .replace('#include <fog_vertex>', `#include <fog_vertex>
        {
          vec4 wp = vec4(transformed, 1.0);
          vec3 wn = objectNormal;
          #ifdef USE_INSTANCING
            wp = instanceMatrix * wp; wn = mat3(instanceMatrix) * wn;
          #endif
          vWPos2 = (modelMatrix * wp).xyz;
          vWNrm2 = normalize(mat3(modelMatrix) * wn);
        }`);
    let f = s.fragmentShader
      .replace('#include <common>', `#include <common>
        varying vec3 vWPos2; varying vec3 vWNrm2; uniform float uWScale;
        vec2 worldUV() {
          vec3 n = abs(vWNrm2);
          vec2 uv = n.y > 0.72 ? vWPos2.xz : (n.x > n.z ? vec2(vWPos2.z * sign(vWNrm2.x), vWPos2.y) : vec2(-vWPos2.x * sign(vWNrm2.z), vWPos2.y));
          return uv * uWScale;
        }`)
      .replace('void main() {', 'void main() {\n  vec2 wUV = worldUV();');
    // swap the mesh UVs for world UVs inside main() only (the varyings stay declared)
    const at = f.indexOf('vec2 wUV = worldUV();');
    f = f.slice(0, at) + f.slice(at).replace(/vMapUv|vNormalMapUv|vRoughnessMapUv|vAoMapUv|vMetalnessMapUv/g, 'wUV');
    if (tint) f = f.replace('#include <color_fragment>', `#include <color_fragment>\n${tint}`);
    s.fragmentShader = f;
  };
  // make three generate the uv chunks even though geometry UVs are ignored
  return mat;
}

// Masonry laid in courses on the walls: `ashlar` (fine joints, long blocks) or `rustic`
// (deep channels between big blocks, for the ground floor). Each block has its own shade,
// the joints are recessed (their relief comes from the pattern's slope), rain has left
// streaks down the face and lichen keeps to the foot of the wall. Fades out with distance
// before the joints could shimmer.
const MASONRY = {
  ashlar: { h: 0.42, w: 1.05, jw: 0.006, dark: 0.62, depth: 0.5, y0: 0.0 },
  // courses line up with the house's projecting rustication bands (every 0.55 m from 1 m)
  rustic: { h: 0.55, w: 1.25, jw: 0.022, dark: 0.5, depth: 1.0, y0: 1.0 },
};
function masonryGLSL(k) {
  const c = MASONRY[k], f = (v) => v.toFixed(4);
  return `
    {
      vec3 an = abs(vWNrm2);
      if (an.y < 0.6) {
        float u = an.x > an.z ? vWPos2.z : vWPos2.x;
        float v = vWPos2.y - ${f(c.y0)};
        float row = floor(v / ${f(c.h)});
        float off = mod(row, 2.0) * 0.5;
        float col = floor(u / ${f(c.w)} + off);
        vec2 q = vec2(fract(u / ${f(c.w)} + off) * ${f(c.w)}, fract(v / ${f(c.h)}) * ${f(c.h)});
        float e = min(min(q.x, ${f(c.w)} - q.x), min(q.y, ${f(c.h)} - q.y));
        float px = fwidth(u) + fwidth(v) + 1e-4;
        float vis = 1.0 - smoothstep(${f(c.jw)} * 1.5, ${f(c.jw)} * 6.0, px);
        gJoint = (1.0 - smoothstep(${f(c.jw)} - px, ${f(c.jw)} + px, e)) * vis;
        float bh = fract(sin(dot(vec2(col, row), vec2(12.9898, 78.233))) * 43758.5453);
        diffuseColor.rgb *= mix(0.93, 1.07, bh);
        diffuseColor.rgb *= mix(1.0, ${f(c.dark)}, gJoint);
        gJointDepth = ${f(c.depth)};
        // rain streaks: long, faint, vertical, heavier towards the foot of the wall
        float st = smoothstep(0.55, 1.0, sin(u * 5.1 + sin(u * 0.73) * 4.0) * 0.5 + 0.5) * smoothstep(9.0, 1.5, v - floor(v / 6.0) * 6.0);
        diffuseColor.rgb *= 1.0 - 0.07 * st;
        // a little lichen near the ground
        float li = smoothstep(1.4, 0.2, v) * smoothstep(0.55, 0.75, fract(sin(dot(floor(vec2(u, v) * 3.0), vec2(41.3, 17.1))) * 2731.7));
        diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * vec3(0.78, 0.86, 0.68), li * 0.5);
      }
    }`;
}
export function stoneMaterial(color = '#fff6e2', scale = 2.2, { joints } = {}) {
  const m = new THREE.MeshStandardMaterial({
    map: tex('stone_diff'), normalMap: tex('stone_nor'), roughnessMap: tex('stone_arm'),
    color, roughness: 1, metalness: 0,
  });
  m.normalScale.set(0.8, 0.8);
  // weathering: darker towards the ground and in streaks
  const tint = 'diffuseColor.rgb *= 1.22 * mix(0.74, 1.0, smoothstep(0.0, 2.5, vWPos2.y)) * (0.93 + 0.07 * sin(vWPos2.x * 1.7 + sin(vWPos2.y * 0.9) * 2.0));'
    + (joints ? masonryGLSL(joints) : '');
  worldMapped(m, scale, { tint });
  if (joints) {
    // recess the joints: tilt the normal down the slope of the joint pattern
    const prev = m.onBeforeCompile;
    m.onBeforeCompile = (s) => {
      prev(s);
      s.fragmentShader = s.fragmentShader
        .replace('vec2 wUV = worldUV();', 'vec2 wUV = worldUV();\n  gJoint = 0.0; gJointDepth = 0.0;')
        .replace('vec2 worldUV() {', 'float gJoint, gJointDepth;\nvec2 worldUV() {')
        .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
          {
            float hgt = -gJoint * gJointDepth;
            vec2 dH = vec2(dFdx(hgt), dFdy(hgt));
            vec3 sx = dFdx(-vViewPosition), sy = dFdy(-vViewPosition);
            vec3 R1 = cross(sy, normal), R2 = cross(normal, sx);
            float det = dot(sx, R1);
            vec3 g = sign(det) * (dH.x * R1 + dH.y * R2);
            vec3 nb = abs(det) * normal - g * 0.6;
            float nl = length(nb);
            if (nl > 1e-8) normal = nb / nl;
          }`);
    };
  }
  return m;
}
export function slateMaterial() {
  const m = new THREE.MeshStandardMaterial({ map: tex('slate_diff'), normalMap: tex('slate_nor'), roughnessMap: tex('slate_arm'), color: '#9aa2ab', roughness: 1, metalness: 0.05 });
  return worldMapped(m, 2.5);
}
export function pavingMaterial() {
  const m = new THREE.MeshStandardMaterial({ map: tex('paving_diff'), normalMap: tex('paving_nor'), roughnessMap: tex('paving_arm'), color: '#f0e6d2', roughness: 1 });
  return worldMapped(m, 2.6);
}
export function paintMaterial(color, roughness = 0.45) {
  return new THREE.MeshStandardMaterial({ color, roughness, metalness: 0 });
}
// Window glass. Old crown glass is never quite flat, so each pane tilts the reflection its
// own way; behind it the rooms are dim, with curtains drawn back to either side in each
// window's own colour (some rooms are shuttered).
export function glassMaterial() {
  const m = new THREE.MeshPhysicalMaterial({ color: '#0d1517', roughness: 0.04, metalness: 0.1, envMapIntensity: 1.25, clearcoat: 1, clearcoatRoughness: 0.03 });
  m.onBeforeCompile = (s) => {
    s.vertexShader = s.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec2 vGUv; varying vec3 vGId;')
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        vGUv = uv;
        vGId = vec3(0.0);
        #ifdef USE_INSTANCING
          vGId = instanceMatrix[3].xyz;
        #endif`);
    s.fragmentShader = s.fragmentShader
      .replace('#include <common>', `#include <common>
        varying vec2 vGUv; varying vec3 vGId;
        float gh(vec3 p) { return fract(sin(dot(p, vec3(12.99, 78.23, 37.71))) * 43758.55); }`)
      .replace('#include <color_fragment>', `#include <color_fragment>
        {
          float wid = gh(vGId);
          vec3 room = vec3(0.022, 0.019, 0.016) * (0.7 + 0.6 * gh(vGId + 3.1));
          float cw = mix(0.12, 0.26, gh(vGId + 7.7));
          float side = min(vGUv.x, 1.0 - vGUv.x);
          float curtain = 1.0 - smoothstep(cw - 0.015, cw + 0.015, side);
          vec3 cc = wid < 0.33 ? vec3(0.5, 0.1, 0.09) : wid < 0.66 ? vec3(0.62, 0.55, 0.38) : vec3(0.16, 0.24, 0.17);
          float fa = vGUv.x * 36.0 + wid * 10.0;
          cc *= 0.72 + 0.28 * sin(fa) * clamp(1.0 - fwidth(fa) * 0.6, 0.0, 1.0);
          vec3 inside = mix(room, cc * 0.22, curtain);
          if (gh(vGId + 5.3) > 0.86) inside = vec3(0.09, 0.075, 0.06);   // shutters closed
          diffuseColor.rgb = inside;
        }`)
      .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
        {
          vec2 pane = floor(vGUv * vec2(3.0, 4.0));
          vec3 pid = vec3(pane, 0.0) + vGId;
          vec3 tilt = vec3(gh(pid) - 0.5, gh(pid + 1.7) - 0.5, 0.0) * 0.07;
          normal = normalize(normal + (viewMatrix * vec4(tilt, 0.0)).xyz);
        }`);
  };
  return m;
}
export function waterMaterial() {
  const m = new THREE.MeshPhysicalMaterial({ color: '#1d2b26', roughness: 0.03, metalness: 0, envMapIntensity: 1.1, clearcoat: 1, clearcoatRoughness: 0.0, transparent: false });
  m.onBeforeCompile = (s) => {
    s.uniforms.uTime = shared.uTime;
    s.fragmentShader = s.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform float uTime;')
      .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
        {
          vec2 p = vViewPosition.xz;
          // gentle ripples from the fountain's fall
          vec3 wn = vec3(sin(gl_FragCoord.x * 0.0 + uTime * 2.0 + length(vViewPosition) * 6.0) * 0.03, 1.0, cos(uTime * 1.7 + length(vViewPosition) * 5.0) * 0.03);
          normal = normalize(normal + (viewMatrix * vec4(wn.x, 0.0, wn.z, 0.0)).xyz);
        }`);
  };
  return m;
}
