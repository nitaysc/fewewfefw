// The sun never moves, so the shadows of the house, trees and hedges across the whole
// estate are rendered once into a depth map that the grass and ground shaders read. The
// regular shadow map (which follows the player) adds the mower, the hands and fine detail.
import * as THREE from '../../vendor/three.module.js';
import { shared } from '../core/shared.js';

export function bakeStaticShadow(renderer, scene, casters, { extent = 300, res = 2048, center = new THREE.Vector3(0, 0, -6) } = {}) {
  const depthTexture = new THREE.DepthTexture(res, res);
  depthTexture.type = THREE.UnsignedIntType;
  depthTexture.minFilter = depthTexture.magFilter = THREE.NearestFilter;
  const rt = new THREE.WebGLRenderTarget(res, res, { depthTexture, depthBuffer: true, generateMipmaps: false });
  const cam = new THREE.OrthographicCamera(-extent / 2, extent / 2, extent / 2, -extent / 2, 1, 900);
  const dir = shared.uSunDir.value.clone().normalize();
  cam.position.copy(center).addScaledVector(dir, 450);
  cam.up.set(0, 1, 0);
  if (Math.abs(dir.y) > 0.99) cam.up.set(0, 0, 1);
  cam.lookAt(center);
  cam.updateMatrixWorld(); cam.updateProjectionMatrix();
  // only the static casters are drawn
  const hidden = [];
  scene.traverse((o) => { if ((o.isMesh || o.isPoints) && o.visible && !casters.has(o)) { hidden.push(o); o.visible = false; } });
  const prevT = renderer.getRenderTarget(), prevAuto = renderer.autoClear, prevBg = scene.background;
  renderer.setRenderTarget(rt);
  renderer.autoClear = true;
  renderer.render(scene, cam);
  renderer.setRenderTarget(prevT);
  renderer.autoClear = prevAuto; scene.background = prevBg;
  hidden.forEach((o) => { o.visible = true; });
  const bias = new THREE.Matrix4().set(0.5, 0, 0, 0.5, 0, 0.5, 0, 0.5, 0, 0, 0.5, 0.5, 0, 0, 0, 1);
  shared.uStaticShadowMatrix.value.copy(bias).multiply(cam.projectionMatrix).multiply(cam.matrixWorldInverse);
  shared.tStaticShadow.value = depthTexture;
  return { rt, cam };
}
