// A bottle of estate ale: flint glass beaded with condensation, a printed label, amber ale
// and a creamy head. The ale behaves like a liquid: its surface finds its level however the
// bottle is held (the height comes from sample points spread through the bottle's volume),
// sloshes on a damped spring when the bottle is moved or the mower bumps, ripples, builds
// foam when shaken or freshly opened, and streams of bubbles rise up the glass.
import * as THREE from '../../vendor/three.module.js';
import { canvasTexture } from '../core/textures.js';
import { shared } from '../core/shared.js';
import { rng } from '../core/util.js';

// outer profile [radius, height] (metres); the glass is ~2.5 mm thick
const OUTER = [[0.0, 0.0035], [0.022, 0.0], [0.0295, 0.0008], [0.0318, 0.004], [0.0324, 0.012], [0.0324, 0.132], [0.0318, 0.142],
  [0.0292, 0.156], [0.0245, 0.169], [0.019, 0.181], [0.0152, 0.192], [0.0136, 0.203], [0.0132, 0.214], [0.0137, 0.219],
  [0.0149, 0.222], [0.0151, 0.2275], [0.0143, 0.2305], [0.0122, 0.2318], [0.0102, 0.2312]];
export const BOTTLE_H = 0.2318;
const innerR = (y) => {
  // inner radius at height y
  for (let i = 1; i < OUTER.length; i++) {
    const [r0, y0] = OUTER[i - 1], [r1, y1] = OUTER[i];
    if (y >= y0 && y <= y1) return Math.max(0, r0 + (r1 - r0) * ((y - y0) / Math.max(y1 - y0, 1e-6)) - 0.0026);
  }
  return 0;
};
const LIQ_TOP = 0.226; // the liquid can reach into the neck

function labelTexture() {
  return canvasTexture(1024, 512, (ctx, w, h) => {
    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, '#efe4c6'); g.addColorStop(1, '#e2d3ae');
    ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
    // paper fibres
    const r = rng(3);
    for (let i = 0; i < 1800; i++) { ctx.fillStyle = `rgba(120,95,60,${r() * 0.05})`; ctx.fillRect(r() * w, r() * h, 1 + r() * 3, 1); }
    ctx.strokeStyle = '#1d3a28'; ctx.lineWidth = 10; ctx.strokeRect(22, 22, w - 44, h - 44);
    ctx.strokeStyle = '#a8823c'; ctx.lineWidth = 3; ctx.strokeRect(40, 40, w - 80, h - 80);
    const cx = w * 0.38;
    // a simple crest: shield with a chevron and three acorns
    ctx.save(); ctx.translate(cx, 175);
    ctx.fillStyle = '#1d3a28';
    ctx.beginPath(); ctx.moveTo(-58, -62); ctx.lineTo(58, -62); ctx.lineTo(58, 8); ctx.quadraticCurveTo(58, 62, 0, 84); ctx.quadraticCurveTo(-58, 62, -58, 8); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = '#c9a457'; ctx.lineWidth = 5; ctx.stroke();
    ctx.fillStyle = '#c9a457'; ctx.beginPath(); ctx.moveTo(-50, 30); ctx.lineTo(0, -12); ctx.lineTo(50, 30); ctx.lineTo(50, 46); ctx.lineTo(0, 4); ctx.lineTo(-50, 46); ctx.fill();
    for (const [x, y] of [[-30, -36], [30, -36], [0, 52]]) { ctx.beginPath(); ctx.ellipse(x, y, 8, 11, 0, 0, Math.PI * 2); ctx.fill(); }
    ctx.restore();
    ctx.fillStyle = '#1d3a28'; ctx.textAlign = 'center';
    ctx.font = '700 64px Georgia, serif'; ctx.fillText('HOLLINGMERE', cx, 330);
    ctx.font = 'italic 44px Georgia, serif'; ctx.fillStyle = '#7a2a1a'; ctx.fillText('Estate Pale Ale', cx, 384);
    ctx.font = '22px Georgia, serif'; ctx.fillStyle = '#3a2d1d'; ctx.fillText('BREWED AT THE HOME FARM SINCE 1784', cx, 428);
    ctx.font = '600 26px Georgia, serif'; ctx.fillText('4.2% vol   ·   330 ml', cx, 466);
    // back of the label: small print
    ctx.textAlign = 'left'; ctx.font = '19px Georgia, serif'; ctx.fillStyle = '#4a3a28';
    const lines = ['Brewed with Maris Otter malt', 'and Fuggles hops grown on', 'the estate. Best enjoyed', 'cool, on a summer lawn,', 'by a gentleman at his ease.'];
    lines.forEach((l, i) => ctx.fillText(l, w * 0.72, 150 + i * 30));
  });
}

function dropletNormals(size = 256, seed = 9) {
  const data = new Uint8Array(size * size * 4);
  for (let i = 0; i < size * size; i++) { data[i * 4] = 128; data[i * 4 + 1] = 128; data[i * 4 + 2] = 255; data[i * 4 + 3] = 255; }
  const r = rng(seed);
  for (let n = 0; n < 260; n++) {
    const cx = r() * size, cy = r() * size, rad = 1.5 + r() * r() * 7, el = 1 + r() * 0.6;
    for (let y = -rad * el; y <= rad * el; y++) for (let x = -rad; x <= rad; x++) {
      const nx = x / rad, ny = y / (rad * el), d2 = nx * nx + ny * ny;
      if (d2 > 1) continue;
      const nz = Math.sqrt(1 - d2);
      const px = ((Math.floor(cx + x) % size) + size) % size, py = ((Math.floor(cy + y) % size) + size) % size;
      const k = (py * size + px) * 4;
      data[k] = Math.round((nx * 0.8 * 0.5 + 0.5) * 255); data[k + 1] = Math.round((-ny * 0.8 * 0.5 + 0.5) * 255); data[k + 2] = Math.round(nz * 255);
    }
  }
  const t = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.generateMipmaps = true; t.minFilter = THREE.LinearMipmapLinearFilter; t.magFilter = THREE.LinearFilter;
  t.needsUpdate = true;
  return t;
}

export class Bottle {
  constructor() {
    this.group = new THREE.Group();
    this.group.name = 'bottle';
    const pts = OUTER.map(([r, y]) => new THREE.Vector2(r, y));
    const glassGeo = new THREE.LatheGeometry(pts, 48);
    const drops = dropletNormals();
    // Glass: mostly reflection. Coverage rises towards the silhouette (Fresnel), and the
    // reflected light is added on top (premultiplied blending), as real glass looks.
    const glassMat = new THREE.MeshPhysicalMaterial({
      color: '#1c2a1a', roughness: 0.035, metalness: 0, transparent: true,
      envMapIntensity: 1.15, clearcoat: 0.6, clearcoatRoughness: 0.02, specularIntensity: 1,
      normalMap: drops, normalScale: new THREE.Vector2(0.45, 0.45), depthWrite: false,
      blending: THREE.CustomBlending, blendSrc: THREE.OneFactor, blendDst: THREE.OneMinusSrcAlphaFactor,
    });
    glassMat.onBeforeCompile = (sh) => {
      sh.fragmentShader = sh.fragmentShader.replace('#include <opaque_fragment>', `
        float fres = pow(1.0 - clamp(abs(dot(normalize(normal), normalize(vViewPosition))), 0.0, 1.0), 2.5);
        float cover = mix(0.08, 0.6, fres);
        gl_FragColor = vec4(outgoingLight * mix(0.45, 0.9, fres) + vec3(0.02, 0.035, 0.02) * cover, cover);`);
    };
    this.glass = new THREE.Mesh(glassGeo, glassMat);
    drops.repeat.set(3, 4);
    this.glass.renderOrder = 5;
    // neck opening (dark mouth so you can see down into it)
    const mouth = new THREE.Mesh(new THREE.RingGeometry(0.0, 0.0101, 24).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: '#2a1d0c' }));
    mouth.position.y = 0.2306;
    // liquid: the inner volume, clipped by a plane whose normal sloshes about the vertical
    const inner = [];
    for (let y = 0.0042; y <= LIQ_TOP; y += 0.002) inner.push(new THREE.Vector2(Math.max(0, innerR(y) - 0.0008), y));
    inner.unshift(new THREE.Vector2(0, 0.0042));
    const liqGeo = new THREE.LatheGeometry(inner, 40);
    this.plane = { value: new THREE.Vector4(0, 1, 0, 1) };   // world-space surface: dot(n, p) = w
    this.level = { value: 1 };
    this.foamU = { value: 0.008 };
    this.agitU = { value: 0 };
    const uni = { uPlane: this.plane, uFoam: this.foamU, uAgit: this.agitU, uTime: shared.uTime, uSunDir: shared.uSunDir, uSunColor: shared.uSunColor };
    const liqMat = new THREE.MeshPhysicalMaterial({ color: '#c7801c', roughness: 0.2, metalness: 0, side: THREE.DoubleSide, sheen: 0.35, sheenColor: new THREE.Color('#ffcf6a'), emissive: '#2c1402', clearcoat: 0.7, clearcoatRoughness: 0.08 });
    liqMat.onBeforeCompile = (sh) => {
      Object.assign(sh.uniforms, uni);
      sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vWP;')
        .replace('#include <fog_vertex>', '#include <fog_vertex>\nvWP = (modelMatrix * vec4(transformed, 1.0)).xyz;');
      sh.fragmentShader = sh.fragmentShader.replace('#include <common>', `#include <common>
          varying vec3 vWP;
          uniform vec4 uPlane; uniform float uFoam; uniform float uAgit; uniform float uTime;
          uniform vec3 uSunDir; uniform vec3 uSunColor;
          float bh(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }`)
        .replace('#include <clipping_planes_fragment>', `#include <clipping_planes_fragment>
          float hp = dot(uPlane.xyz, vWP) - uPlane.w;
          if (hp > 0.0) discard;
          float foam = smoothstep(-uFoam, -uFoam * 0.5, hp);
          bool cap = !gl_FrontFacing;`)
        .replace('#include <color_fragment>', `#include <color_fragment>
          {
            // fine streams of carbonation in the ale, a creamy head with bubbles in it
            float streak = step(0.985, bh(vec2(floor(atan(vWP.z, vWP.x) * 60.0), 3.0))) * (0.5 + 0.5 * sin(vWP.y * 900.0 + uTime * 25.0));
            diffuseColor.rgb *= 1.0 + 0.25 * streak;
            float pits = bh(floor(vWP.xz * 2600.0)) * 0.12;
            if (cap) foam = max(foam, 0.8 + 0.2 * smoothstep(0.004, 0.012, uFoam));
            diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.94, 0.88, 0.74) * (1.0 - pits), foam);
          }`)
        .replace('#include <normal_fragment_begin>', `#include <normal_fragment_begin>
          if (cap) {
            vec3 n = uPlane.xyz;
            float k = 0.06 + uAgit * 0.5;
            n.x += sin(vWP.x * 320.0 + uTime * 9.0) * k + sin(vWP.z * 410.0 - uTime * 7.0) * k * 0.6;
            n.z += cos(vWP.z * 350.0 + uTime * 8.0) * k + cos(vWP.x * 280.0 - uTime * 11.0) * k * 0.6;
            normal = normalize((viewMatrix * vec4(normalize(n), 0.0)).xyz);
          }`)
        .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\ntotalEmissiveRadiance *= (1.0 - foam);')
        .replace('#include <lights_fragment_end>', `#include <lights_fragment_end>
          {
            // the ale glows when the sun is behind it
            vec3 Lv = normalize((viewMatrix * vec4(uSunDir, 0.0)).xyz);
            float back = pow(max(dot(-normalize(vViewPosition), Lv), 0.0), 3.0);
            reflectedLight.directDiffuse += diffuseColor.rgb * vec3(1.0, 0.75, 0.35) * uSunColor * RECIPROCAL_PI * back * (1.0 - foam) * 0.9;
          }`);
    };
    this.liquid = new THREE.Mesh(liqGeo, liqMat);
    this.liquid.renderOrder = 4;
    // bubbles rising up the inside of the glass
    const NB = 80;
    this.bub = { n: NB, a: new Float32Array(NB), y: new Float32Array(NB), v: new Float32Array(NB), ph: new Float32Array(NB) };
    const rb = rng(41);
    for (let i = 0; i < NB; i++) { this.bub.a[i] = rb() * Math.PI * 2; this.bub.y[i] = 0.006 + rb() * 0.12; this.bub.v[i] = 0.01 + rb() * 0.025; this.bub.ph[i] = rb() * 6.28; }
    const bg = new THREE.BufferGeometry();
    this.bubPos = new THREE.BufferAttribute(new Float32Array(NB * 3), 3);
    bg.setAttribute('position', this.bubPos);
    bg.setAttribute('aSize', new THREE.BufferAttribute(Float32Array.from({ length: NB }, () => 0.0006 + rb() * 0.0011), 1));
    this.bubScale = { value: 800 };
    this.bubbles = new THREE.Points(bg, new THREE.ShaderMaterial({
      uniforms: { uPlane: this.plane, uScale: this.bubScale, uAmb: shared.uAmbUp },
      vertexShader: /* glsl */`
        attribute float aSize; uniform float uScale; varying vec3 vWP; varying float vS;
        void main() {
          vec4 wp = modelMatrix * vec4(position, 1.0); vWP = wp.xyz;
          vec4 mv = viewMatrix * wp;
          gl_PointSize = max(1.0, aSize * uScale / -mv.z); vS = gl_PointSize;
          gl_Position = projectionMatrix * mv;
        }`,
      fragmentShader: /* glsl */`
        uniform vec4 uPlane; uniform vec3 uAmb; varying vec3 vWP; varying float vS;
        void main() {
          if (dot(uPlane.xyz, vWP) - uPlane.w > 0.0) discard;
          vec2 c = gl_PointCoord - 0.5; float r = length(c) * 2.0;
          if (r > 1.0) discard;
          float rim = smoothstep(0.55, 0.95, r) * (1.0 - smoothstep(0.95, 1.0, r));
          float glint = smoothstep(0.35, 0.0, length(c - vec2(-0.15, -0.15)));
          float a = (rim * 0.7 + glint * 0.9) * clamp(vS / 3.0, 0.3, 1.0);
          gl_FragColor = vec4(vec3(1.0, 0.95, 0.85) * (0.6 + uAmb) * a, a);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }`,
      transparent: true, depthWrite: false,
      blending: THREE.CustomBlending, blendSrc: THREE.OneFactor, blendDst: THREE.OneMinusSrcAlphaFactor,
    }));
    this.bubbles.frustumCulled = false;
    this.bubbles.renderOrder = 4.5;
    // sloshing state
    this.slosh = { s: new THREE.Vector2(), v: new THREE.Vector2(), agit: 0 };
    this.hist = [new THREE.Vector3(), new THREE.Vector3()];
    this.histN = 0;
    this.foam = 0.4;
    // labels
    const lab = new THREE.Mesh(new THREE.CylinderGeometry(0.0327, 0.0327, 0.072, 48, 1, true, -Math.PI * 0.82, Math.PI * 1.64), new THREE.MeshStandardMaterial({ map: labelTexture(), roughness: 0.75 }));
    lab.position.y = 0.074;
    const neckLab = new THREE.Mesh(new THREE.CylinderGeometry(0.0141, 0.0156, 0.016, 32, 1, true), new THREE.MeshStandardMaterial({ color: '#1d3a28', roughness: 0.5, metalness: 0.3 }));
    neckLab.position.y = 0.196;
    const foil = new THREE.Mesh(new THREE.CylinderGeometry(0.0152, 0.0149, 0.004, 32, 1, true), new THREE.MeshStandardMaterial({ color: '#c9a457', metalness: 1, roughness: 0.25 }));
    foil.position.y = 0.2045;
    this.group.add(this.liquid, this.bubbles, lab, neckLab, foil, mouth, this.glass);
    this.group.traverse((o) => { if (o.isMesh) { o.castShadow = o !== this.glass; o.receiveShadow = true; } });

    // volume samples for the level solver
    const r = rng(17);
    const vol = [];
    let tries = 0;
    while (vol.length < 2400 && tries < 100000) {
      tries++;
      const y = 0.0045 + r() * (LIQ_TOP - 0.0045), x = (r() * 2 - 1) * 0.03, z = (r() * 2 - 1) * 0.03;
      if (Math.hypot(x, z) < innerR(y)) vol.push(x, y, z);
    }
    this.samples = new Float32Array(vol);
    this.heights = new Float32Array(vol.length / 3);
    this.fill = 1;        // 0..1 of 330 ml
    this.fullFrac = 0.93; // a freshly opened bottle is not full to the brim
  }

  // Slosh, foam and bubbles; then find where the surface sits for this fill and tilt.
  update(dt) {
    const g = this.group;
    g.updateMatrixWorld(true);
    const m = g.matrixWorld.elements;
    dt = Math.min(Math.max(dt, 1e-3), 0.05);
    // acceleration of the bottle's middle from its last positions
    const c = new THREE.Vector3(0, 0.1, 0).applyMatrix4(g.matrixWorld);
    const [p1, p2] = this.hist;
    let ax = 0, az = 0;
    if (this.histN >= 2) {
      ax = (c.x - 2 * p1.x + p2.x) / (dt * dt); az = (c.z - 2 * p1.z + p2.z) / (dt * dt);
      const l = Math.hypot(ax, az); if (l > 40) { ax *= 40 / l; az *= 40 / l; }
    }
    p2.copy(p1); p1.copy(c); this.histN++;
    // the surface leans against the acceleration and rings like a damped spring
    const S = this.slosh, k = 230, damping = 3.2;
    const tx = -ax / 9.81, tz = -az / 9.81;
    S.v.x += ((tx - S.s.x) * k - S.v.x * damping) * dt; S.v.y += ((tz - S.s.y) * k - S.v.y * damping) * dt;
    S.s.x += S.v.x * dt; S.s.y += S.v.y * dt;
    const len = S.s.length(); if (len > 0.55) S.s.multiplyScalar(0.55 / len);
    S.agit += (Math.min(1, S.v.length() * 0.18) - S.agit) * Math.min(1, dt * 6);
    this.foam = Math.min(1, Math.max(0, this.foam - dt / 14 + S.agit * dt * 0.3));
    this.foamU.value = 0.004 + 0.014 * this.foam;
    this.agitU.value = S.agit;
    const n = new THREE.Vector3(S.s.x, 1, S.s.y).normalize();
    // level: the fill-quantile of the bottle's volume measured along the surface normal
    const cnt = this.heights.length, smp = this.samples;
    const nx = n.x * m[0] + n.y * m[1] + n.z * m[2], ny = n.x * m[4] + n.y * m[5] + n.z * m[6], nz = n.x * m[8] + n.y * m[9] + n.z * m[10];
    for (let i = 0; i < cnt; i++) this.heights[i] = nx * smp[i * 3] + ny * smp[i * 3 + 1] + nz * smp[i * 3 + 2];
    const f = this.fill * this.fullFrac;
    const off = n.x * m[12] + n.y * m[13] + n.z * m[14];
    if (f <= 0.001) { this.plane.value.set(n.x, n.y, n.z, -1e4); this.level.value = -1e4; }
    else {
      const sorted = this.heights.slice().sort();
      const d = sorted[Math.min(cnt - 1, Math.floor(f * cnt))] + off;
      this.plane.value.set(n.x, n.y, n.z, d);
      this.level.value = d;
    }
    // bubbles: rise along the glass, start again at the bottom once they reach the surface
    const B = this.bub, pos = this.bubPos.array, pl = this.plane.value;
    const v = new THREE.Vector3();
    for (let i = 0; i < B.n; i++) {
      B.y[i] += B.v[i] * dt * (0.6 + 0.4 * Math.min(1, this.fill * 3));
      const y = B.y[i];
      const r = Math.max(0.001, innerR(Math.min(y, LIQ_TOP)) - 0.0004);
      const a = B.a[i] + Math.sin(y * 300 + B.ph[i]) * 0.02;
      v.set(Math.cos(a) * r, y, Math.sin(a) * r).applyMatrix4(g.matrixWorld);
      if (y > LIQ_TOP || pl.x * v.x + pl.y * v.y + pl.z * v.z > pl.w) { B.y[i] = 0.005 + Math.random() * 0.01; B.a[i] = Math.random() * Math.PI * 2; }
      pos[i * 3] = Math.cos(a) * r; pos[i * 3 + 1] = Math.min(B.y[i], LIQ_TOP); pos[i * 3 + 2] = Math.sin(a) * r;
    }
    this.bubPos.needsUpdate = true;
  }
  // Is there ale at the bottle's mouth (it has to reach the neck to be drunk)?
  reachesMouth(margin = 0.006) {
    const mw = this.mouthWorld(new THREE.Vector3()), pl = this.plane.value;
    return pl.x * mw.x + pl.y * mw.y + pl.z * mw.z < pl.w + margin;
  }
  // kept for callers that only need an update of the level
  updateLevel() { this.update(1 / 60); }
  // world position of the mouth of the bottle
  mouthWorld(out = new THREE.Vector3()) { return out.set(0, BOTTLE_H, 0).applyMatrix4(this.group.matrixWorld); }
}
