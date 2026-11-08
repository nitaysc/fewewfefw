// Sky dome (photographic CC0 sky from Poly Haven), image-based lighting and the sun.
// The sun's direction and strength are measured from the HDR itself, then removed from
// the environment map and handed to a shadow-casting directional light, so the light,
// the shadows and the reflections all agree with the clouds you see.
import * as THREE from '../../vendor/three.module.js';
import { RGBELoader } from '../../vendor/RGBELoader.js';
import { shared } from '../core/shared.js';

const SUN_TARGET_INTENSITY = 3.4; // the sun's irradiance after scaling, in three.js units

function analyseHDR(tex) {
  const { width: W, height: H, data } = tex.image;
  const lum = (i) => 0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2];
  const dirOf = (x, r, out) => {
    const v = 1 - (r + 0.5) / H, u = (x + 0.5) / W;
    const el = (v - 0.5) * Math.PI, phi = (u - 0.5) * Math.PI * 2;
    out.set(Math.cos(el) * Math.cos(phi), Math.sin(el), Math.cos(el) * Math.sin(phi));
    return el;
  };
  // 1) brightest pixel -> sun; percentile of the upper hemisphere for the clamp
  let maxL = 0, maxI = 0;
  const sky = [];
  for (let r = 0; r < H / 2; r++) for (let x = 0; x < W; x++) {
    const i = (r * W + x) * 4, l = lum(i);
    if (l > maxL) { maxL = l; maxI = i / 4; }
    if ((x & 3) === 0) sky.push(l);
  }
  sky.sort((a, b) => a - b);
  const p97 = sky[Math.floor(sky.length * 0.97)];
  const T = Math.max(p97 * 3.0, 1e-3);
  // 2) remove the sun's energy (pixels above T), accumulate it and its direction
  const d = new THREE.Vector3(), sunDir = new THREE.Vector3(), eSun = new THREE.Vector3();
  const eUp = new THREE.Vector3(), haze = new THREE.Vector3(); let hazeN = 0;
  const dOmega0 = (2 * Math.PI / W) * (Math.PI / H);
  for (let r = 0; r < H / 2; r++) for (let x = 0; x < W; x++) {
    const i = (r * W + x) * 4;
    const el = dirOf(x, r, d);
    const dw = dOmega0 * Math.cos(el);
    const l = lum(i);
    if (l > T) {
      const k = T / l;
      const ex = data[i] * (1 - k), ey = data[i + 1] * (1 - k), ez = data[i + 2] * (1 - k);
      eSun.x += ex * dw; eSun.y += ey * dw; eSun.z += ez * dw;
      sunDir.addScaledVector(d, (l - T) * dw);
      data[i] *= k; data[i + 1] *= k; data[i + 2] *= k;
    }
    eUp.x += data[i] * Math.max(d.y, 0) * dw; eUp.y += data[i + 1] * Math.max(d.y, 0) * dw; eUp.z += data[i + 2] * Math.max(d.y, 0) * dw;
    if (el < 0.09) { haze.x += data[i]; haze.y += data[i + 1]; haze.z += data[i + 2]; hazeN++; }
  }
  if (sunDir.lengthSq() < 1e-12) { const x = maxI % W, r = Math.floor(maxI / W); dirOf(x, r, sunDir); }
  sunDir.normalize();
  haze.multiplyScalar(1 / Math.max(hazeN, 1));
  // 3) ground below the horizon: grass lit by sun + sky (for bounce light in reflections)
  const albedo = new THREE.Vector3(0.16, 0.2, 0.075);
  const eGround = eSun.clone().multiplyScalar(Math.max(sunDir.y, 0)).add(eUp);
  const lGround = new THREE.Vector3(albedo.x * eGround.x, albedo.y * eGround.y, albedo.z * eGround.z).multiplyScalar(1 / Math.PI);
  for (let r = H / 2; r < H; r++) {
    const el = (1 - (r + 0.5) / H - 0.5) * Math.PI;           // negative
    const t = Math.min(1, -el / 0.08);                        // short blend into haze at the horizon
    for (let x = 0; x < W; x++) {
      const i = (r * W + x) * 4;
      data[i] = haze.x * (1 - t) + lGround.x * t;
      data[i + 1] = haze.y * (1 - t) + lGround.y * t;
      data[i + 2] = haze.z * (1 - t) + lGround.z * t;
    }
  }
  return { sunDir, eSun, eUp, lGround, haze };
}

export async function createSky(renderer, scene, quality, base = 'assets/sky/') {
  const [bg, hdr] = await Promise.all([
    new THREE.TextureLoader().loadAsync(base + 'sky_bg.jpg'),
    new RGBELoader().setDataType(THREE.FloatType).loadAsync(base + 'sky_1k.hdr'),
  ]);
  bg.colorSpace = THREE.SRGBColorSpace;
  bg.generateMipmaps = false; bg.minFilter = THREE.LinearFilter; bg.wrapS = THREE.RepeatWrapping;

  const info = analyseHDR(hdr);
  // Scale so the sun lands at a comfortable three.js intensity; the sky keeps its ratio to it.
  const sunMag = Math.max(info.eSun.x, info.eSun.y, info.eSun.z, 1e-6);
  const k = SUN_TARGET_INTENSITY / sunMag;
  hdr.needsUpdate = true;
  hdr.mapping = THREE.EquirectangularReflectionMapping;
  const pmrem = new THREE.PMREMGenerator(renderer);
  const env = pmrem.fromEquirectangular(hdr).texture;
  pmrem.dispose(); hdr.dispose();
  scene.environment = env;
  scene.environmentIntensity = k;

  shared.uSunDir.value.copy(info.sunDir);
  const sunCol = new THREE.Color(info.eSun.x * k, info.eSun.y * k, info.eSun.z * k);
  shared.uSunColor.value.copy(sunCol);
  shared.uAmbUp.value.setRGB(info.eUp.x * k / Math.PI, info.eUp.y * k / Math.PI, info.eUp.z * k / Math.PI);
  shared.uAmbDown.value.setRGB(info.lGround.x * k, info.lGround.y * k, info.lGround.z * k);
  shared.uHaze.value.setRGB(info.haze.x * k, info.haze.y * k, info.haze.z * k);

  // ---- the sun ----
  const sun = new THREE.DirectionalLight(0xffffff, 1);
  const inten = Math.max(sunCol.r, sunCol.g, sunCol.b);
  sun.color.setRGB(sunCol.r / inten, sunCol.g / inten, sunCol.b / inten);
  sun.intensity = inten;
  sun.castShadow = true;
  sun.shadow.mapSize.set(quality.shadowMap, quality.shadowMap);
  const span = quality.shadowSpan;
  Object.assign(sun.shadow.camera, { left: -span / 2, right: span / 2, top: span / 2, bottom: -span / 2, near: 1, far: 600 });
  sun.shadow.camera.updateProjectionMatrix();
  sun.shadow.bias = -0.00025;
  sun.shadow.normalBias = 0.035;
  scene.add(sun, sun.target);

  // ---- the dome ----
  const domeMat = new THREE.ShaderMaterial({
    uniforms: {
      tSky: { value: bg }, uSunDir: shared.uSunDir, uSunColor: shared.uSunColor, uHaze: shared.uHaze,
      uExposure: { value: 1.0 },
    },
    vertexShader: /* glsl */`
      varying vec3 vDir;
      void main() {
        vDir = position;
        vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        gl_Position = p.xyww; // at the far plane
      }`,
    fragmentShader: /* glsl */`
      uniform sampler2D tSky; uniform vec3 uSunDir; uniform vec3 uSunColor; uniform vec3 uHaze; uniform float uExposure;
      varying vec3 vDir;
      void main() {
        vec3 d = normalize(vDir);
        float u = atan(d.z, d.x) * 0.15915494 + 0.5;
        float v = asin(clamp(d.y, 0.0, 1.0)) * 0.63661977;
        vec3 col = texture2D(tSky, vec2(u, max(v, 0.002))).rgb;
        // the photo is display-referred: expand its highlights back into scene-linear light
        col = col / max(1.0 - 0.6 * col, 0.25);
        col *= uExposure;
        float c = dot(d, uSunDir);
        col += uSunColor * (smoothstep(0.99996, 0.99999, c) * 6.0 + pow(max(c, 0.0), 1400.0) * 0.6 + pow(max(c, 0.0), 60.0) * 0.06);
        float h = 1.0 - smoothstep(-0.02, 0.10, d.y);
        col = mix(col, uHaze, h * 0.75);
        gl_FragColor = vec4(col, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
    side: THREE.BackSide, depthWrite: false, depthTest: true,
  });
  // Match the photo's brightness at the horizon to the HDR's, so sky and lighting agree.
  try {
    const cv = document.createElement('canvas'); cv.width = 256; cv.height = 64;
    const cx = cv.getContext('2d', { willReadFrequently: true });
    cx.drawImage(bg.image, 0, 0, 256, 64);
    const px = cx.getImageData(0, 58, 256, 6).data;
    const lin = (c) => { c /= 255; return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); };
    const ex = (c) => c / Math.max(1 - 0.6 * c, 0.25);
    let L = 0, n = 0;
    for (let i = 0; i < px.length; i += 4) { L += 0.2126 * ex(lin(px[i])) + 0.7152 * ex(lin(px[i + 1])) + 0.0722 * ex(lin(px[i + 2])); n++; }
    L /= n;
    const hz = shared.uHaze.value;
    const target = 0.2126 * hz.r + 0.7152 * hz.g + 0.0722 * hz.b;
    if (L > 1e-4 && target > 0) domeMat.uniforms.uExposure.value = target / L;
  } catch (e) { domeMat.uniforms.uExposure.value = 3; }
  const dome = new THREE.Mesh(new THREE.SphereGeometry(4000, 64, 32), domeMat);
  dome.frustumCulled = false;
  dome.renderOrder = 1000;
  scene.add(dome);

  const tmp = new THREE.Vector3(), right = new THREE.Vector3(), up = new THREE.Vector3();
  return {
    sun, dome, env, bgTexture: bg, info, scale: k,
    // Keep the dome around the camera and the shadow frustum over the play area ahead.
    update(camera, focus) {
      dome.position.copy(camera.position);
      const dir = shared.uSunDir.value;
      right.crossVectors(dir, THREE.Object3D.DEFAULT_UP).normalize();
      up.crossVectors(right, dir).normalize();
      const texel = span / quality.shadowMap;
      const a = Math.round(focus.dot(right) / texel) * texel;
      const b = Math.round(focus.dot(up) / texel) * texel;
      const c = focus.dot(dir);
      tmp.copy(right).multiplyScalar(a).addScaledVector(up, b).addScaledVector(dir, c);
      sun.target.position.copy(tmp);
      sun.position.copy(tmp).addScaledVector(dir, 260);
      sun.target.updateMatrixWorld();
    },
  };
}
