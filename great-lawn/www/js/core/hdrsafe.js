// Phones render the scene into half-float buffers, whose largest value is 65504. A sharp sun
// glint on glass, water or chrome (with the sun at full strength and a near-mirror surface)
// can exceed that and be stored as infinity. Bloom then smears the infinity across the screen
// and tone mapping turns it into NaN, which shows as a black flash. Every material's output is
// clamped well below the limit, and NaNs are dropped, before it is written.
import * as THREE from '../../vendor/three.module.js';

export const HDR_MAX = 2048;
export const HDR_SAFE_GLSL = /* glsl */`
vec3 hdrSafe(vec3 c) {
  c = clamp(c, vec3(0.0), vec3(${HDR_MAX.toFixed(1)}));
  return any(isnan(c)) ? vec3(0.0) : c;
}`;

let installed = false;
export function installHdrSafety() {
  if (installed) return;
  installed = true;
  const C = THREE.ShaderChunk;
  const out = 'gl_FragColor = vec4( outgoingLight, diffuseColor.a );';
  if (!C.opaque_fragment.includes(out)) throw new Error('hdrsafe: three.js output chunk changed');
  C.common += '\n' + HDR_SAFE_GLSL + '\n';
  C.opaque_fragment = C.opaque_fragment.replace(out, 'gl_FragColor = vec4( hdrSafe( outgoingLight ), diffuseColor.a );');
}
installHdrSafety();
