// Uniforms shared by every custom shader (sun, sky light, wind, time).
import * as THREE from '../../vendor/three.module.js';

export const shared = {
  uTime: { value: 0 },
  uSunDir: { value: new THREE.Vector3(0.53, 0.75, 0.39).normalize() },
  uSunColor: { value: new THREE.Color(3, 2.85, 2.6) },  // sun irradiance (linear RGB)
  uAmbUp: { value: new THREE.Color(0.55, 0.65, 0.8) },  // cosine-averaged sky radiance from above
  uAmbDown: { value: new THREE.Color(0.12, 0.13, 0.08) }, // bounce light from the ground
  uHaze: { value: new THREE.Color(0.62, 0.7, 0.8) },     // horizon colour used by the aerial perspective
  uWind: { value: new THREE.Vector4(0.8, 0.6, 1.0, 0) },  // xy direction, strength, gust offset
  uCamPos: { value: new THREE.Vector3() },
};

// Common chunk so custom shaders can do the same Lambert + sky lighting as the scene.
export const LIGHT_GLSL = /* glsl */`
uniform vec3 uSunDir;
uniform vec3 uSunColor;
uniform vec3 uAmbUp;
uniform vec3 uAmbDown;
vec3 skyAmbient(vec3 n) { return mix(uAmbDown, uAmbUp, clamp(n.y * 0.5 + 0.5, 0.0, 1.0)); }
`;
