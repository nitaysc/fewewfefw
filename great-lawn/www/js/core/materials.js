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

export function stoneMaterial(color = '#fff6e2', scale = 2.2) {
  const m = new THREE.MeshStandardMaterial({
    map: tex('stone_diff'), normalMap: tex('stone_nor'), roughnessMap: tex('stone_arm'),
    color, roughness: 1, metalness: 0,
  });
  m.normalScale.set(0.8, 0.8);
  // weathering: darker towards the ground and in streaks
  return worldMapped(m, scale, {
    tint: 'diffuseColor.rgb *= 1.22 * mix(0.74, 1.0, smoothstep(0.0, 2.5, vWPos2.y)) * (0.93 + 0.07 * sin(vWPos2.x * 1.7 + sin(vWPos2.y * 0.9) * 2.0));',
  });
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
export function glassMaterial() {
  return new THREE.MeshPhysicalMaterial({ color: '#0d1517', roughness: 0.04, metalness: 0.1, envMapIntensity: 1.25, clearcoat: 1, clearcoatRoughness: 0.03 });
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
