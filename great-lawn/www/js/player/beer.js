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

// Condensation on a cold bottle, as a tangent-space normal map (RGB) with the density of the
// fine mist in alpha: a frosting of tiny droplets, clear beads of every size that have
// gathered the mist around them, and a few runs where a bead has slid down and wiped a
// clear track behind it. Rows run up the bottle.
function condensationTexture(size = 512, seed = 9) {
  const r = rng(seed);
  const N = size * size;
  const H = new Float32Array(N);
  const mist = new Float32Array(N);
  const wrap = (v) => ((v % size) + size) % size;
  for (let i = 0; i < N; i++) mist[i] = 0.72 + 0.28 * r();
  const clearMist = (cx, cy, rad, amount) => {
    const R = Math.ceil(rad);
    for (let y = -R; y <= R; y++) for (let x = -R; x <= R; x++) {
      const d = Math.hypot(x, y) / rad;
      if (d > 1) continue;
      const k = wrap(Math.round(cy + y)) * size + wrap(Math.round(cx + x));
      mist[k] *= 1 - amount * (1 - d * d);
    }
  };
  const bead = (cx, cy, rad, el) => {
    const ry = rad * el;
    for (let y = -Math.ceil(ry); y <= Math.ceil(ry); y++) for (let x = -Math.ceil(rad); x <= Math.ceil(rad); x++) {
      const nx = x / rad, ny = y / ry, d2 = nx * nx + ny * ny;
      if (d2 > 1) continue;
      const k = wrap(Math.round(cy + y)) * size + wrap(Math.round(cx + x));
      // a lens, slightly heavier at the bottom where the water collects
      const h = Math.sqrt(1 - d2) * rad * (1 + 0.15 * Math.max(0, -ny));
      if (h > H[k]) H[k] = h;
      mist[k] = 0;
    }
    clearMist(cx, cy, rad * 1.7, 0.85);
  };
  // runs: a clear, slightly wavy track ending in a heavier bead
  for (let n = 0; n < 14; n++) {
    const x0 = r() * size, y0 = r() * size, len = 30 + r() * 170, w = 1.5 + r() * 2.2;
    for (let t = 0; t < len; t++) {
      const x = x0 + Math.sin(t * 0.07 + n) * 2.5;
      clearMist(x, y0 - t, w * 1.6, 0.9);
      if (r() < 0.05) bead(x + (r() - 0.5) * w, y0 - t, 0.8 + r() * 1.2, 1.1);
    }
    bead(x0 + Math.sin(len * 0.07 + n) * 2.5, y0 - len, w * 1.6 + r() * 2.5, 1.35);
  }
  // beads of every size, the big ones fewer
  for (let n = 0; n < 900; n++) {
    const rad = 0.9 + Math.pow(r(), 3) * 9;
    bead(r() * size, r() * size, rad, 1 + r() * 0.25 + rad * 0.015);
  }
  const data = new Uint8Array(N * 4);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const k = y * size + x;
    const dx = (H[y * size + wrap(x + 1)] - H[y * size + wrap(x - 1)]) * 0.5;
    const dy = (H[wrap(y + 1) * size + x] - H[wrap(y - 1) * size + x]) * 0.5;
    let nx = -dx * 0.9, ny = -dy * 0.9, nz = 1;
    const l = Math.hypot(nx, ny, nz); nx /= l; ny /= l; nz /= l;
    data[k * 4] = Math.round((nx * 0.5 + 0.5) * 255);
    data[k * 4 + 1] = Math.round((ny * 0.5 + 0.5) * 255);
    data[k * 4 + 2] = Math.round((nz * 0.5 + 0.5) * 255);
    data[k * 4 + 3] = Math.round(Math.min(1, Math.max(0, mist[k])) * 255);
  }
  const t = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.generateMipmaps = true; t.minFilter = THREE.LinearMipmapLinearFilter; t.magFilter = THREE.LinearFilter;
  t.anisotropy = 4;
  t.needsUpdate = true;
  return t;
}

const NOISE_GLSL = /* glsl */`
  float bh(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float vn2(vec2 p) {
    vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
    return mix(mix(bh(i), bh(i + vec2(1.0, 0.0)), f.x), mix(bh(i + vec2(0.0, 1.0)), bh(i + vec2(1.0, 1.0)), f.x), f.y);
  }`;

export class Bottle {
  constructor() {
    this.group = new THREE.Group();
    this.group.name = 'bottle';
    const pts = OUTER.map(([r, y]) => new THREE.Vector2(r, y));
    const glassGeo = new THREE.LatheGeometry(pts, 48);
    const cond = (Bottle.cond ||= condensationTexture());
    this.plane = { value: new THREE.Vector4(0, 1, 0, 1) };   // world-space surface: dot(n, p) = w
    this.cold = 1;                       // a fresh bottle from the crate is ice cold
    this.coldU = { value: 1 };
    // Glass: mostly reflection. Coverage rises towards the silhouette (Fresnel), and the
    // reflected light is added on top (premultiplied blending), as real glass looks. A cold
    // bottle sweats: frosted with fine mist (less above the ale, where the glass is warmer),
    // beaded with drops that catch the light and darken at their rims, run through with
    // clear tracks where drops have slid down.
    const glassMat = new THREE.MeshPhysicalMaterial({
      color: '#000000', roughness: 0.03, metalness: 0, transparent: true,
      envMapIntensity: 1.1, specularIntensity: 1,
      normalMap: cond, normalScale: new THREE.Vector2(0.9, 0.9), depthWrite: false,
      blending: THREE.CustomBlending, blendSrc: THREE.OneFactor, blendDst: THREE.OneMinusSrcAlphaFactor,
    });
    glassMat.onBeforeCompile = (sh) => {
      Object.assign(sh.uniforms, { uCold: this.coldU, uPlane: this.plane, uAmb: shared.uAmbUp, uSunColor: shared.uSunColor, uSunDir: shared.uSunDir });
      sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vWPg;')
        .replace('#include <fog_vertex>', '#include <fog_vertex>\nvWPg = (modelMatrix * vec4(transformed, 1.0)).xyz;');
      sh.fragmentShader = sh.fragmentShader.replace('#include <common>', `#include <common>
          varying vec3 vWPg;
          uniform float uCold; uniform vec4 uPlane; uniform vec3 uAmb; uniform vec3 uSunColor; uniform vec3 uSunDir;
          float gMist, gRim;`)
        .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
          {
            vec4 cs = texture2D(normalMap, vNormalMapUv);
            gRim = smoothstep(0.3, 0.75, length(cs.xy * 2.0 - 1.0));
            float above = smoothstep(-0.004, 0.012, dot(uPlane.xyz, vWPg) - uPlane.w);
            gMist = cs.a * uCold * (1.0 - 0.55 * above);
          }`)
        .replace('#include <opaque_fragment>', `
          float fres = pow(1.0 - clamp(abs(dot(normalize(normal), normalize(vViewPosition))), 0.0, 1.0), 2.5);
          float cover = mix(0.06, 0.55, fres);
          vec3 Nw = inverseTransformDirection(normalize(normal), viewMatrix);
          vec3 veil = (uAmb * 1.15 + uSunColor * max(dot(Nw, uSunDir), 0.0) * 0.22) * vec3(0.93, 0.97, 1.0);
          float m = gMist * 0.3;
          vec3 col = outgoingLight * mix(0.45, 0.9, fres) * (1.0 + gRim * 0.8) + vec3(0.02, 0.035, 0.02) * cover;
          col += veil * m * 0.1;
          cover += (1.0 - cover) * (m * 0.3 + gRim * 0.28);
          gl_FragColor = vec4(hdrSafe(col), cover);`);
    };
    this.glass = new THREE.Mesh(glassGeo, glassMat);
    cond.repeat.set(2, 3);
    this.glass.renderOrder = 5;
    // neck opening (dark mouth so you can see down into it)
    const mouth = new THREE.Mesh(new THREE.RingGeometry(0.0, 0.0101, 24).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: '#2a1d0c' }));
    mouth.position.y = 0.2306;
    // liquid: the inner volume, clipped by a plane whose normal sloshes about the vertical
    const inner = [];
    for (let y = 0.0042; y <= LIQ_TOP; y += 0.002) inner.push(new THREE.Vector2(Math.max(0, innerR(y) - 0.0008), y));
    inner.unshift(new THREE.Vector2(0, 0.0042));
    const liqGeo = new THREE.LatheGeometry(inner, 40);
    this.level = { value: 1 };
    this.foamU = { value: 0.008 };
    this.foamAmtU = { value: 0.4 };
    this.agitU = { value: 0 };
    const uni = {
      uPlane: this.plane, uFoam: this.foamU, uFoamAmt: this.foamAmtU, uAgit: this.agitU, uTime: shared.uTime,
      uSunDir: shared.uSunDir, uSunColor: shared.uSunColor, uAmb: shared.uAmbUp,
      // pale ale: light through it loses blue fast and green more slowly (per metre)
      uSigma: { value: new THREE.Vector3(8, 24, 75) }, uRad: { value: 0.0292 },
      uInvModel: this.invModelU = { value: new THREE.Matrix4() },
    };
    // The ale is drawn as a clear, coloured liquid rather than a painted surface: what is
    // behind it shows through, bent by refraction and tinted by how far the light travels
    // in it (golden at the edges, deep amber through the middle), it glows when the sun is
    // behind it, and the head is a band of foam at the glass and a froth on top that thins
    // into islands and lace as it settles.
    const liqMat = new THREE.MeshPhysicalMaterial({ color: '#ffffff', roughness: 0.08, metalness: 0, side: THREE.DoubleSide, specularIntensity: 0.6 });
    liqMat.onBeforeCompile = (sh) => {
      Object.assign(sh.uniforms, uni);
      sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vWP;')
        .replace('#include <fog_vertex>', '#include <fog_vertex>\nvWP = (modelMatrix * vec4(transformed, 1.0)).xyz;');
      sh.fragmentShader = sh.fragmentShader.replace('#include <common>', `#include <common>
          varying vec3 vWP;
          uniform vec4 uPlane; uniform float uFoam; uniform float uFoamAmt; uniform float uAgit; uniform float uTime;
          uniform vec3 uSunDir; uniform vec3 uSunColor; uniform vec3 uAmb; uniform vec3 uSigma; uniform float uRad;
          uniform mat4 uInvModel;
          ${NOISE_GLSL}
          bool gCap; float gFoam; vec3 gSurf;
          // how far light runs through the ale from p along d (world): to the glass (a cylinder
          // round the bottle's axis), the bottom, or the surface
          float alePath(vec3 p, vec3 d) {
            vec3 lp = (uInvModel * vec4(p, 1.0)).xyz, ld = normalize((uInvModel * vec4(d, 0.0)).xyz);
            float a = dot(ld.xz, ld.xz), b = 2.0 * dot(lp.xz, ld.xz), c = dot(lp.xz, lp.xz) - uRad * uRad;
            float t = 0.3;
            if (a > 1e-6) { float disc = b * b - 4.0 * a * c; if (disc > 0.0) t = min(t, max(0.0, (-b + sqrt(disc)) / (2.0 * a))); }
            if (ld.y < -1e-4) t = min(t, max(0.0, (0.0045 - lp.y) / ld.y));
            float dn = dot(uPlane.xyz, d);
            if (dn > 1e-4) t = min(t, max(0.0, (uPlane.w - dot(uPlane.xyz, p)) / dn));
            return t;
          }`)
        .replace('#include <clipping_planes_fragment>', `#include <clipping_planes_fragment>
          float hp = dot(uPlane.xyz, vWP) - uPlane.w;
          if (hp > 0.0) discard;
          gCap = !gl_FrontFacing;
          {
            // the cap is drawn on the far wall: find where the eye ray meets the surface
            vec3 rdv = normalize(vWP - cameraPosition);
            float den = dot(uPlane.xyz, rdv);
            float tS = (uPlane.w - dot(uPlane.xyz, cameraPosition)) / (abs(den) > 1e-4 ? den : 1e-4);
            gSurf = cameraPosition + rdv * tS;
            // the head against the glass: dense at the top, breaking into bubbles below
            float band = smoothstep(-uFoam, -uFoam * 0.3, hp) * (0.75 + 0.25 * step(0.35, vn2(vWP.xz * 4000.0 + hp * 900.0)));
            float n1 = vn2(gSurf.xz * 380.0) * 0.55 + vn2(gSurf.xz * 1100.0 + 5.0) * 0.3 + vn2(gSurf.xz * 3000.0 + 9.0) * 0.15;
            float froth = smoothstep(0.93 - uFoamAmt, 1.0 - uFoamAmt, n1);
            gFoam = gCap ? froth : band;
          }`)
        .replace('#include <color_fragment>', `#include <color_fragment>
          {
            vec3 fc = vec3(0.95, 0.92, 0.85) * (1.0 - 0.18 * step(0.82, bh(floor(gSurf.xz * 2600.0))));
            diffuseColor.rgb = mix(vec3(0.3, 0.17, 0.035), fc, gFoam);
          }`)
        .replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
          roughnessFactor = gCap ? mix(0.04, 0.65, gFoam) : mix(0.12, 0.65, gFoam);`)
        .replace('#include <normal_fragment_begin>', `#include <normal_fragment_begin>
          if (gCap) {
            vec3 n = uPlane.xyz;
            float k = 0.05 + uAgit * 0.5;
            n.x += sin(gSurf.x * 320.0 + uTime * 9.0) * k + sin(gSurf.z * 410.0 - uTime * 7.0) * k * 0.6;
            n.z += cos(gSurf.z * 350.0 + uTime * 8.0) * k + cos(gSurf.x * 280.0 - uTime * 11.0) * k * 0.6;
            normal = normalize((viewMatrix * vec4(normalize(n), 0.0)).xyz);
          }`)
        .replace('#include <opaque_fragment>', `
          {
            vec3 Nv = normalize(normal), Vv = normalize(vViewPosition);
            float ndv = abs(dot(Nv, Vv));
            vec3 Vw = normalize(cameraPosition - vWP);
            vec3 Nw = inverseTransformDirection(Nv, viewMatrix);
            vec3 into = -Vw;
            #if defined( USE_ENVMAP ) && defined( ENVMAP_TYPE_CUBE_UV )
              vec3 rin = refract(-Vw, Nw, 0.75);
              if (dot(rin, rin) > 1e-4) into = normalize(rin);
            #endif
            float th = alePath(gCap ? gSurf : vWP, into);
            vec3 tint = exp(-uSigma * max(th, 0.004));
            vec3 behind = uAmb * 1.2;
            #if defined( USE_ENVMAP ) && defined( ENVMAP_TYPE_CUBE_UV )
              vec3 rd = refract(-Vw, Nw, 0.75);
              if (dot(rd, rd) < 1e-4) rd = -Vw;
              behind = textureCubeUV(envMap, envMapRotation * rd, 0.22).rgb * envMapIntensity;
            #endif
            float back = pow(max(dot(-Vw, uSunDir), 0.0), 4.0);
            vec3 glow = uSunColor * (0.06 + 0.9 * back) * tint * vec3(1.0, 0.82, 0.5);
            vec3 ale = behind * tint + glow + totalDiffuse * 0.55;
            vec3 col = mix(ale + totalSpecular, totalDiffuse + totalSpecular * 0.3, gFoam);
            gl_FragColor = vec4(hdrSafe(col), 1.0);
          }`);
    };
    this.liquid = new THREE.Mesh(liqGeo, liqMat);
    this.liquid.renderOrder = 4;
    // bubbles: streams rising from a few points on the glass, and strays
    const NB = 110, STREAMS = 7;
    this.bub = { n: NB, a: new Float32Array(NB), y: new Float32Array(NB), v: new Float32Array(NB), ph: new Float32Array(NB), s: new Int8Array(NB) };
    const rb = rng(41);
    this.streamA = Array.from({ length: STREAMS }, () => rb() * Math.PI * 2);
    for (let i = 0; i < NB; i++) {
      const st = i < NB * 0.7 ? i % STREAMS : -1;
      this.bub.s[i] = st;
      this.bub.a[i] = st >= 0 ? this.streamA[st] : rb() * Math.PI * 2;
      this.bub.y[i] = 0.006 + rb() * 0.14; this.bub.v[i] = 0.012 + rb() * 0.02; this.bub.ph[i] = rb() * 6.28;
    }
    const bg = new THREE.BufferGeometry();
    this.bubPos = new THREE.BufferAttribute(new Float32Array(NB * 3), 3);
    bg.setAttribute('position', this.bubPos);
    bg.setAttribute('aSize', new THREE.BufferAttribute(Float32Array.from({ length: NB }, () => 0.0005 + rb() * rb() * 0.0012), 1));
    this.bubScale = { value: 800 };
    this.bubbles = new THREE.Points(bg, new THREE.ShaderMaterial({
      uniforms: { uPlane: this.plane, uScale: this.bubScale, uAmb: shared.uAmbUp, uSunColor: shared.uSunColor },
      vertexShader: /* glsl */`
        attribute float aSize; uniform float uScale; varying vec3 vWP; varying float vS;
        void main() {
          vec4 wp = modelMatrix * vec4(position, 1.0); vWP = wp.xyz;
          vec4 mv = viewMatrix * wp;
          gl_PointSize = max(1.0, aSize * uScale / -mv.z); vS = gl_PointSize;
          gl_Position = projectionMatrix * mv;
        }`,
      fragmentShader: /* glsl */`
        uniform vec4 uPlane; uniform vec3 uAmb; uniform vec3 uSunColor; varying vec3 vWP; varying float vS;
        void main() {
          if (dot(uPlane.xyz, vWP) - uPlane.w > 0.0) discard;
          vec2 c = gl_PointCoord - 0.5; float r = length(c) * 2.0;
          if (r > 1.0) discard;
          float rim = smoothstep(0.55, 0.95, r) * (1.0 - smoothstep(0.95, 1.0, r));
          float glint = smoothstep(0.35, 0.0, length(c - vec2(-0.15, -0.15)));
          float a = (rim * 0.75 + glint) * clamp(vS / 3.0, 0.3, 1.0);
          gl_FragColor = vec4(min(vec3(1.0, 0.95, 0.82) * (0.5 + uAmb + uSunColor * 0.12) * a, vec3(8.0)), a);
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
    const lab = new THREE.Mesh(new THREE.CylinderGeometry(0.0327, 0.0327, 0.072, 48, 1, true, -Math.PI * 0.82, Math.PI * 1.64), new THREE.MeshStandardMaterial({ map: (Bottle.label ||= labelTexture()), roughness: 0.75 }));
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
    this.invModelU.value.copy(g.matrixWorld).invert();
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
    this.foamU.value = 0.0025 + 0.0055 * this.foam;
    this.foamAmtU.value = 0.12 + 0.88 * this.foam;
    // the bottle warms in the hand over a few minutes and sweats less
    this.cold = Math.max(0.35, this.cold - dt / 420);
    this.coldU.value = this.cold;
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
      if (y > LIQ_TOP || pl.x * v.x + pl.y * v.y + pl.z * v.z > pl.w) {
        B.y[i] = 0.005 + Math.random() * 0.01;
        B.a[i] = B.s[i] >= 0 ? this.streamA[B.s[i]] + (Math.random() - 0.5) * 0.02 : Math.random() * Math.PI * 2;
      }
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
