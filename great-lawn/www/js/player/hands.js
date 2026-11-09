// Hands, modelled as anatomy rather than drawn: metacarpals, phalanges, knuckles, tendons,
// thenar pads and fingernails are signed-distance primitives blended into one skin and
// meshed with surface nets. Fingers wrap their grip (steering-wheel rim, bottle) with a
// small solver. The skin shader adds a red subsurface glow where the hand is thin,
// glossy nails and fine bump. Shirt cuffs, tweed sleeves, a wristwatch that keeps real
// time and a signet ring finish them.
import * as THREE from '../../vendor/three.module.js';
import { meshSDF, smin, smax, roundCone, capsule, ellipsoid, orientedRoundBox } from '../core/sdf.js';
import { tex, canvasTexture } from '../core/textures.js';
import { shared } from '../core/shared.js';

const NAMES = ['index', 'middle', 'ring', 'little'];
// Right hand, palm down, fingers toward -Z, thumb toward -X, back of the hand +Y. Metres.
const FINGERS = {
  index: { mcp: [-0.0252, 0.0005, -0.0925], base: [-0.0165, 0.0015, -0.014], len: [0.0415, 0.0252, 0.0205], r: [0.0093, 0.0083, 0.0074, 0.0067], spread: -0.07 },
  middle: { mcp: [-0.0077, 0.0018, -0.097], base: [-0.0052, 0.0022, -0.012], len: [0.0465, 0.0287, 0.0215], r: [0.0096, 0.0086, 0.0076, 0.0069], spread: -0.01 },
  ring: { mcp: [0.0098, 0.0005, -0.0915], base: [0.006, 0.0012, -0.013], len: [0.0428, 0.0276, 0.0212], r: [0.009, 0.008, 0.0071, 0.0064], spread: 0.06 },
  little: { mcp: [0.0262, -0.0032, -0.0825], base: [0.0165, -0.0018, -0.016], len: [0.0342, 0.0198, 0.0186], r: [0.008, 0.007, 0.0062, 0.0056], spread: 0.13 },
};

const V3 = (a) => new THREE.Vector3(a[0], a[1], a[2]);
const A3 = (v) => [v.x, v.y, v.z];

function chain(f, flex, spreadExtra = 0) {
  const P0 = V3(f.mcp);
  const up0 = new THREE.Vector3(0, 1, 0);
  const d0 = new THREE.Vector3(0, 0, -1).applyAxisAngle(up0, -(f.spread + spreadExtra));
  const lat = new THREE.Vector3().crossVectors(d0, up0).normalize();
  const joints = [P0.clone()], dirs = [], ups = [];
  let cum = 0, p = P0.clone();
  for (let s = 0; s < 3; s++) {
    cum += flex[s];
    const d = d0.clone().applyAxisAngle(lat, -cum);
    const u = up0.clone().applyAxisAngle(lat, -cum);
    p = p.clone().addScaledVector(d, f.len[s]);
    joints.push(p); dirs.push(d); ups.push(u);
  }
  return { joints, dirs, ups, lat, r: f.r };
}

// Fingers wrap a cylinder (axis through c along `ax`, radius R): search MCP and PIP flexion
// (DIP follows the PIP, as real fingers do) so the pads hug the surface without sinking in.
function wrapFinger(f, c, R, spread = 0, ax = [1, 0, 0], tight = 1) {
  let best = null, bestCost = Infinity;
  for (let a = -0.15; a <= 1.75; a += 0.035) {
    for (let b = 0; b <= 1.95; b += 0.035) {
      const flex = [a, b, Math.min(1.35, b * 0.72)];
      const ch = chain(f, flex, spread);
      let cost = 0;
      const pts = [];
      for (let s = 0; s < 3; s++) {
        const j0 = ch.joints[s], j1 = ch.joints[s + 1];
        for (const t of [0.25, 0.6, 1.0]) pts.push([j0.clone().lerp(j1, t), ch.r[s] + (ch.r[s + 1] - ch.r[s]) * t, s]);
      }
      for (const [p, r, s] of pts) {
        const vx = p.x - c[0], vy = p.y - c[1], vz = p.z - c[2];
        const t = vx * ax[0] + vy * ax[1] + vz * ax[2];
        const dist = Math.hypot(vx - ax[0] * t, vy - ax[1] * t, vz - ax[2] * t);
        const gap = dist - (R + r);
        if (gap < -0.0006) cost += (gap * gap) * 4e5;
        else if (s > 0) cost += gap * gap * 900 * tight;
      }
      cost += (a * a + b * b) * 0.00002;
      if (cost < bestCost) { bestCost = cost; best = flex; }
    }
  }
  return best;
}

function thumbChain(t) {
  // t: { cmc, dir (metacarpal direction), nail (direction the nail faces), len, flex: [mcp, ip], r }
  const P0 = V3(t.cmc);
  const d0 = V3(t.dir).normalize();
  const n0 = V3(t.nail).normalize();
  const lat = new THREE.Vector3().crossVectors(d0, n0).normalize();
  const joints = [P0.clone()], dirs = [], ups = [];
  let p = P0.clone();
  const flex = [0, t.flex[0], t.flex[1]];
  let cum = 0;
  for (let s = 0; s < 3; s++) {
    cum += flex[s];
    const d = d0.clone().applyAxisAngle(lat, -cum);
    const u = n0.clone().applyAxisAngle(lat, -cum);
    p = p.clone().addScaledVector(d, t.len[s]);
    joints.push(p); dirs.push(d); ups.push(u);
  }
  return { joints, dirs, ups, r: t.r };
}

export function buildHandSDF(pose) {
  const metas = [], fingers = [], nails = [], knuckles = [], reds = [];
  for (const n of NAMES) {
    const f = FINGERS[n];
    const ch = chain(f, pose.fingers[n], pose.spread?.[n] || 0);
    fingers.push(ch);
    metas.push({ a: f.base, b: A3(ch.joints[0]), r1: 0.0098, r2: f.r[0] * 1.07 });
    knuckles.push({ c: A3(ch.joints[0].clone().addScaledVector(new THREE.Vector3(0, 1, 0), 0.0038)), r: f.r[0] * 0.78 });
    knuckles.push({ c: A3(ch.joints[1].clone().addScaledVector(ch.ups[0].clone().lerp(ch.ups[1], 0.5), 0.0024)), r: f.r[1] * 0.7 });
    reds.push(ch.joints[0], ch.joints[1], ch.joints[2], ch.joints[3]);
  }
  const th = thumbChain(pose.thumb);
  fingers.push(th);
  reds.push(th.joints[2], th.joints[3]);
  // nails on every distal phalanx
  for (const ch of fingers) {
    const j0 = ch.joints[2], d = ch.dirs[2], u = ch.ups[2];
    const len = j0.distanceTo(ch.joints[3]);
    const rr = ch.r[3];
    const ex = new THREE.Vector3().crossVectors(d, u).normalize();
    const o = j0.clone().addScaledVector(d, len * 0.58).addScaledVector(u, rr * 0.8);
    nails.push({ o: A3(o), ex: A3(ex), ey: A3(u), ez: A3(d), h: [rr * 0.74, 0.0013, len * 0.43] });
  }
  // dorsal tendons and a vein or two
  const tendons = fingers.slice(0, 4).map((ch, i) => ({ a: [metas[i].a[0] * 0.55, 0.0105, -0.024], b: [ch.joints[0].x, ch.joints[0].y + 0.0068, ch.joints[0].z + 0.012], r: 0.0026 }));
  const veins = [
    { a: [-0.006, 0.0118, -0.018], b: [-0.012, 0.0112, -0.055], r: 0.0016 },
    { a: [-0.012, 0.0112, -0.055], b: [-0.02, 0.0104, -0.07], r: 0.0014 },
    { a: [0.008, 0.0115, -0.022], b: [0.004, 0.0116, -0.06], r: 0.0015 },
  ];
  const palmPad = { c: [0.0005, -0.0035, -0.056], r: [0.034, 0.0115, 0.041] };
  const thenar = { c: [-0.0215, -0.0105, -0.034], r: [0.0165, 0.0135, 0.025] };
  const hypo = { c: [0.0232, -0.0085, -0.046], r: [0.0108, 0.011, 0.031] };
  const wristA = [0, -0.001, 0.01], wristB = [0, 0.0, 0.12];

  // bounding spheres for quick rejection of whole fingers
  const fb = fingers.map((ch) => {
    const c = new THREE.Vector3();
    ch.joints.forEach((j) => c.add(j)); c.multiplyScalar(1 / ch.joints.length);
    let r = 0; ch.joints.forEach((j) => { r = Math.max(r, j.distanceTo(c)); });
    return { c: A3(c), r: r + 0.016 };
  });
  const segs = fingers.map((ch) => [0, 1, 2].map((s) => {
    const a = ch.joints[s], b = ch.joints[s + 1].clone().addScaledVector(ch.dirs[s], s === 2 ? -ch.r[3] : 0);
    return { a: A3(a), b: A3(b), r1: ch.r[s], r2: ch.r[s + 1] };
  }));

  const sdf = (x, y, z) => {
    // palm
    let d = 1e9;
    for (const m of metas) d = smin(d, roundCone(x, y, z, m.a, m.b, m.r1, m.r2), 0.017);
    d = smin(d, ellipsoid(x, y, z, palmPad.c, palmPad.r), 0.012);
    d = smin(d, ellipsoid(x, y, z, thenar.c, thenar.r), 0.011);
    d = smin(d, ellipsoid(x, y, z, hypo.c, hypo.r), 0.01);
    // wrist and forearm, slightly oval
    const ws = 0.72;
    d = smin(d, capsule(x, y / ws, z, wristA, wristB, 0.0272) * ws, 0.02);
    for (const k of knuckles) d = smin(d, Math.hypot(x - k.c[0], y - k.c[1], z - k.c[2]) - k.r, 0.0045);
    for (const t of tendons) d = smin(d, capsule(x, y, z, t.a, t.b, t.r), 0.0042);
    for (const v of veins) d = smin(d, capsule(x, y, z, v.a, v.b, v.r), 0.0028);
    // fingers and thumb
    for (let f = 0; f < 5; f++) {
      const b = fb[f];
      const dc = Math.hypot(x - b.c[0], y - b.c[1], z - b.c[2]) - b.r;
      if (dc > d + 0.004) continue;
      let df = 1e9;
      for (const s of segs[f]) df = smin(df, roundCone(x, y, z, s.a, s.b, s.r1, s.r2), 0.0032);
      d = smin(d, df, f === 4 ? 0.013 : 0.0062);
    }
    for (const n of nails) {
      const dn = orientedRoundBox(x, y, z, n.o, n.ex, n.ey, n.ez, n.h, 0.0011);
      if (dn < d + 0.003) d = smin(d, dn, 0.0013);
    }
    // the hand ends inside the cuff
    return smax(d, z - 0.1, 0.004);
  };
  return { sdf, nails, reds, fingers };
}

// ------------------------------------------------------------------ skin material
export function skinMaterial(tone = '#c68f6e') {
  const m = new THREE.MeshPhysicalMaterial({
    color: tone, vertexColors: true, roughness: 0.52, metalness: 0,
    sheen: 0.18, sheenColor: new THREE.Color('#ffb59a'), sheenRoughness: 0.5,
    clearcoat: 0.08, clearcoatRoughness: 0.5,
  });
  m.onBeforeCompile = (s) => {
    s.uniforms.uSunDir = shared.uSunDir;
    s.uniforms.uSunColor = shared.uSunColor;
    s.uniforms.uSSS = { value: new THREE.Color(1.0, 0.28, 0.16) };
    s.vertexShader = s.vertexShader
      .replace('#include <common>', '#include <common>\nattribute vec3 aSkin;\nvarying vec3 vSkin;\nvarying vec3 vObj;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvSkin = aSkin;\nvObj = position;');
    s.fragmentShader = s.fragmentShader
      .replace('#include <common>', `#include <common>
        varying vec3 vSkin; varying vec3 vObj;
        uniform vec3 uSunDir; uniform vec3 uSunColor; uniform vec3 uSSS;
        float hs(vec3 p) { return fract(sin(dot(p, vec3(17.13, 31.71, 47.37))) * 43758.5453); }
        float vn3(vec3 p) {
          vec3 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
          return mix(mix(mix(hs(i), hs(i + vec3(1,0,0)), f.x), mix(hs(i + vec3(0,1,0)), hs(i + vec3(1,1,0)), f.x), f.y),
                     mix(mix(hs(i + vec3(0,0,1)), hs(i + vec3(1,0,1)), f.x), mix(hs(i + vec3(0,1,1)), hs(i + vec3(1,1,1)), f.x), f.y), f.z);
        }
      `)
      .replace('#include <color_fragment>', `#include <color_fragment>
        {
          vec3 nailC = vec3(0.92, 0.72, 0.68) * mix(1.0, 1.18, vSkin.z);
          nailC = mix(nailC, vec3(0.97, 0.94, 0.88), vSkin.z * 0.8);
          diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * 0.45 + nailC * 0.55, vSkin.x);
        }`)
      .replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
        roughnessFactor = mix(roughnessFactor, 0.22, vSkin.x);`)
      .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
        {
          // pores and fine creases: bump from object-space noise
          float hgt = vn3(vObj * 700.0) * 0.6 + vn3(vObj * 260.0 + 3.1) * 0.4;
          hgt *= (1.0 - vSkin.x);
          vec2 dH = vec2(dFdx(hgt), dFdy(hgt)) * 0.55;
          vec3 vSigmaX = normalize(dFdx(-vViewPosition)), vSigmaY = normalize(dFdy(-vViewPosition));
          vec3 R1 = cross(vSigmaY, normal), R2 = cross(normal, vSigmaX);
          float fDet = dot(vSigmaX, R1);
          vec3 vGrad = sign(fDet) * (dH.x * R1 + dH.y * R2);
          normal = normalize(abs(fDet) * normal - vGrad * 0.0018 / max(length(dFdx(vObj)) + length(dFdy(vObj)), 1e-5) * 0.0015);
        }`)
      .replace('#include <lights_fragment_end>', `#include <lights_fragment_end>
        {
          vec3 Lv = normalize((viewMatrix * vec4(uSunDir, 0.0)).xyz);
          vec3 Vv = normalize(vViewPosition);
          float ndl = dot(normal, Lv);
          float wrapT = max(0.0, (ndl + 0.5) / 1.5) - max(0.0, ndl);
          float trans = pow(max(0.0, dot(-Vv, Lv)), 3.0) * vSkin.y;
          reflectedLight.directDiffuse += diffuseColor.rgb * uSSS * uSunColor * RECIPROCAL_PI * (wrapT * 0.55 + trans * 1.4);
        }`);
  };
  return m;
}

function nailInfo(nails, x, y, z) {
  let mask = 0, edge = 0;
  for (const n of nails) {
    const dx = x - n.o[0], dy = y - n.o[1], dz = z - n.o[2];
    const lx = dx * n.ex[0] + dy * n.ex[1] + dz * n.ex[2];
    const ly = dx * n.ey[0] + dy * n.ey[1] + dz * n.ey[2];
    const lz = dx * n.ez[0] + dy * n.ez[1] + dz * n.ez[2];
    const sx = Math.min(1, Math.max(0, (n.h[0] * 1.02 - Math.abs(lx)) / (n.h[0] * 0.18)));
    const sz = Math.min(1, Math.max(0, (n.h[2] * 1.0 - Math.abs(lz)) / (n.h[2] * 0.15)));
    const sy = ly > -0.0018 ? 1 : 0;
    const m = sx * sz * sy;
    if (m > mask) { mask = m; edge = lz > n.h[2] * 0.62 ? 1 : 0; }
  }
  return [mask, edge];
}

export function meshHand(pose, h = 0.0016) {
  const { sdf, nails, reds } = buildHandSDF(pose);
  const redPts = reds.map((p) => [p.x, p.y, p.z]);
  const geo = meshSDF(sdf, [-0.075, -0.075, -0.17], [0.07, 0.06, 0.104], h, {
    attributes: {
      color: {
        size: 3, fn: (x, y, z, nx, ny, nz, out) => {
          // crevice darkening from the distance field, flush on knuckles and fingertips
          const ao = Math.min(1, Math.max(0, sdf(x + nx * 0.0035, y + ny * 0.0035, z + nz * 0.0035) / 0.0035));
          let red = 0;
          for (const p of redPts) { const d2 = (x - p[0]) ** 2 + (y - p[1]) ** 2 + (z - p[2]) ** 2; red = Math.max(red, Math.exp(-d2 / 0.00011)); }
          const palm = Math.max(0, -ny) * 0.12;
          const a = 0.55 + 0.45 * Math.pow(ao, 0.7);
          out[0] = a * (1.0 + red * 0.05 + palm * 0.2);
          out[1] = a * (1.0 - red * 0.14 + palm * 0.1);
          out[2] = a * (1.0 - red * 0.16 + palm * 0.06);
        },
      },
      aSkin: {
        size: 3, fn: (x, y, z, nx, ny, nz, out) => {
          const [m, e] = nailInfo(nails, x, y, z);
          const deep = -sdf(x - nx * 0.012, y - ny * 0.012, z - nz * 0.012);
          out[0] = m; out[1] = Math.min(1, Math.max(0, 1 - deep / 0.011)); out[2] = e;
        },
      },
    },
  });
  return { geo, sdf, nails };
}

// ------------------------------------------------------------------ cuffs, sleeves
// Hollow cloth tube with rounded ends: elliptical mid-surface, thickness th, folds.
function tube(r0x, r0y, z0, z1, th, fold = 0, flare = 0) {
  const zc = (z0 + z1) / 2, hl = (z1 - z0) / 2, rr = th * 0.5;
  return (x, y, z) => {
    const t = Math.min(1, Math.max(0, (z - z0) / (z1 - z0)));
    const ang = Math.atan2(y, x);
    const k = 1 + flare * t + fold * (Math.sin(ang * 3 + z * 60) * 0.5 + Math.sin(ang * 5 - z * 110) * 0.35 + Math.sin(z * 190 + ang) * 0.15);
    const rx = r0x * k, ry = r0y * k;
    const e = Math.hypot(x / rx, y / ry);
    const dr = Math.abs((e - 1) * Math.min(rx, ry)) - th * 0.5 + rr;
    const dz = Math.abs(z - zc) - hl + rr;
    return Math.hypot(Math.max(dr, 0), Math.max(dz, 0)) + Math.min(Math.max(dr, dz), 0) - rr;
  };
}

export function meshSleeve(h = 0.0022) {
  const cuffT = tube(0.0318, 0.0255, 0.043, 0.09, 0.0032, 0.0, 0.05);
  const sleeveT = tube(0.0445, 0.0385, 0.076, 0.42, 0.0045, 0.045, 0.32);
  const cuff = meshSDF(cuffT, [-0.05, -0.045, 0.035], [0.05, 0.045, 0.1], h);
  const slv = meshSDF(sleeveT, [-0.09, -0.085, 0.065], [0.09, 0.085, 0.43], h * 1.4);
  return { cuff, sleeve: slv };
}

function tweedMaterial() {
  const m = new THREE.MeshStandardMaterial({
    map: tex('tweed_diff', { repeat: [4, 4] }), normalMap: tex('tweed_nor', { repeat: [4, 4] }),
    color: '#c7a678', roughness: 0.95, metalness: 0,
  });
  m.normalScale.set(1.2, 1.2);
  return m;
}
const cuffMaterial = () => new THREE.MeshPhysicalMaterial({ color: '#f2efe8', roughness: 0.7, sheen: 0.5, sheenColor: new THREE.Color('#ffffff'), sheenRoughness: 0.6 });

// planar-ish UVs for the tweed so the herringbone wraps the sleeve
function cylUV(geo, scale) {
  const p = geo.attributes.position;
  const uv = new Float32Array(p.count * 2);
  for (let i = 0; i < p.count; i++) {
    uv[i * 2] = (Math.atan2(p.getY(i), p.getX(i)) / (Math.PI * 2) + 0.5) * scale * 0.9;
    uv[i * 2 + 1] = p.getZ(i) * scale * 3.2;
  }
  geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
}

// ------------------------------------------------------------------ watch
function watchDial() {
  return canvasTexture(256, 256, (ctx, w) => {
    const c = w / 2;
    const g = ctx.createRadialGradient(c, c * 0.85, 10, c, c, c);
    g.addColorStop(0, '#fbf6e8'); g.addColorStop(1, '#e8dcc0');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(c, c, c, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#1d1a16'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    const R = ['XII', 'I', 'II', 'III', 'IIII', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI'];
    ctx.font = '600 24px Georgia, serif';
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2 - Math.PI / 2;
      ctx.save(); ctx.translate(c + Math.cos(a) * c * 0.72, c + Math.sin(a) * c * 0.72); ctx.rotate(a + Math.PI / 2);
      ctx.fillText(R[i], 0, 0); ctx.restore();
    }
    ctx.strokeStyle = '#1d1a16';
    for (let i = 0; i < 60; i++) {
      const a = (i / 60) * Math.PI * 2;
      ctx.lineWidth = i % 5 ? 1.2 : 2.4;
      ctx.beginPath(); ctx.moveTo(c + Math.cos(a) * c * 0.88, c + Math.sin(a) * c * 0.88); ctx.lineTo(c + Math.cos(a) * c * 0.94, c + Math.sin(a) * c * 0.94); ctx.stroke();
    }
    ctx.font = 'italic 15px Georgia, serif'; ctx.fillText('Hollingmere', c, c * 0.62);
    ctx.font = '11px Georgia, serif'; ctx.fillText('LONDON', c, c * 1.42);
  });
}

function makeWatch() {
  const g = new THREE.Group();
  const gold = new THREE.MeshStandardMaterial({ color: '#e0b765', metalness: 1, roughness: 0.18 });
  const strap = new THREE.MeshStandardMaterial({ color: '#4a2a16', roughness: 0.55 });
  const caseG = new THREE.LatheGeometry([[0, -0.004], [0.0172, -0.004], [0.0182, -0.001], [0.0182, 0.002], [0.0168, 0.004], [0, 0.004]].map(([a, b]) => new THREE.Vector2(a, b)), 40);
  const caseM = new THREE.Mesh(caseG, gold);
  const dial = new THREE.Mesh(new THREE.CircleGeometry(0.0158, 40), new THREE.MeshStandardMaterial({ map: watchDial(), roughness: 0.4 }));
  dial.rotation.x = -Math.PI / 2; dial.position.y = 0.0041;
  const crystal = new THREE.Mesh(new THREE.SphereGeometry(0.0165, 32, 8, 0, Math.PI * 2, 0, 0.45), new THREE.MeshPhysicalMaterial({ color: '#ffffff', roughness: 0, transparent: true, opacity: 0.1, envMapIntensity: 2 }));
  crystal.scale.y = 0.3; crystal.position.y = 0.0035;
  const crown = new THREE.Mesh(new THREE.CylinderGeometry(0.0025, 0.0025, 0.004, 12), gold);
  crown.rotation.z = Math.PI / 2; crown.position.set(0.0195, 0, 0);
  g.add(caseM, dial, crystal, crown);
  const handMat = new THREE.MeshStandardMaterial({ color: '#0d0c0b', roughness: 0.4, metalness: 0.5 });
  const mk = (len, wid) => { const p = new THREE.Group(); const m = new THREE.Mesh(new THREE.BoxGeometry(wid, 0.0006, len).translate(0, 0, -len / 2 + 0.002), handMat); p.add(m); p.position.y = 0.0046; g.add(p); return p; };
  const hourH = mk(0.0095, 0.0016), minH = mk(0.0135, 0.0011), secH = mk(0.0145, 0.0004);
  secH.children[0].material = new THREE.MeshStandardMaterial({ color: '#8d1b12', roughness: 0.4 });
  // strap: two arcs around the wrist (in wrist space the watch sits on top)
  for (const s of [-1, 1]) {
    const arc = new THREE.Mesh(new THREE.TorusGeometry(0.031, 0.0018, 6, 30, Math.PI * 0.62), strap);
    arc.scale.set(1, 0.82, 1);
    arc.rotation.set(0, Math.PI / 2, 0);
    arc.position.set(0, -0.028, 0);
    arc.rotation.x = s > 0 ? 0 : 0;
    arc.rotation.z = s > 0 ? Math.PI * 0.05 : Math.PI * 0.33;
    const band = new THREE.Mesh(new THREE.BoxGeometry(0.018, 0.0034, 0.004), strap);
    band.position.set(0, -0.001, s * 0.019);
    g.add(band);
  }
  const strapRing = new THREE.Mesh(new THREE.TorusGeometry(1, 0.06, 6, 40), strap);
  strapRing.scale.set(0.0305, 0.0235, 0.03);
  strapRing.rotation.y = 0;
  const strapGroup = new THREE.Group();
  strapGroup.add(strapRing);
  strapGroup.rotation.x = 0;
  g.userData.strap = strapGroup;
  g.userData.hands = { hourH, minH, secH };
  return g;
}

function tickWatch(watch) {
  const now = new Date();
  const s = now.getSeconds() + now.getMilliseconds() / 1000;
  const m = now.getMinutes() + s / 60, h = (now.getHours() % 12) + m / 60;
  const { hourH, minH, secH } = watch.userData.hands;
  hourH.rotation.y = -(h / 12) * Math.PI * 2;
  minH.rotation.y = -(m / 60) * Math.PI * 2;
  secH.rotation.y = -(Math.floor(s) / 60) * Math.PI * 2;
}

// ------------------------------------------------------------------ poses
export const POSES = {
  // right hand round the wheel rim (rim radius 13.5 mm), cigar held between index and middle
  wheel() {
    // the rim runs diagonally across the palm, from the index knuckle to the heel of the hand
    const c = [0, -0.0262, -0.079], R = 0.0135, g = 0.42;
    const ax = [Math.cos(g), 0, Math.sin(g)];
    const fingers = {};
    const spread = { index: -0.06, middle: 0.07, ring: 0.02, little: 0.03 };
    for (const n of NAMES) fingers[n] = wrapFinger(FINGERS[n], c, R, spread[n], ax);
    return {
      fingers, spread, grip: { c, R, ax },
      thumb: { cmc: [-0.019, -0.008, -0.02], dir: [-0.62, -0.36, -0.7], nail: [-0.42, 0.65, 0.2], len: [0.044, 0.032, 0.028], flex: [0.42, 0.55], r: [0.0122, 0.0108, 0.0096, 0.0088] },
    };
  },
  // left hand round a bottle (radius 32 mm), drawn as a right hand and mirrored afterwards
  bottle() {
    const c = [0, -0.046, -0.066], R = 0.0325, g = 0.18;
    const ax = [Math.cos(g), 0, Math.sin(g)];
    const fingers = {};
    const spread = { index: -0.02, middle: 0.0, ring: 0.02, little: 0.05 };
    for (const n of NAMES) fingers[n] = wrapFinger(FINGERS[n], c, R, spread[n], ax);
    return {
      fingers, spread, grip: { c, R, ax },
      thumb: { cmc: [-0.019, -0.008, -0.02], dir: [-0.55, -0.62, -0.56], nail: [-0.55, 0.4, 0.35], len: [0.044, 0.032, 0.028], flex: [0.25, 0.3], r: [0.0122, 0.0108, 0.0096, 0.0088] },
    };
  },
};

export const HAND_SCALE = 1.1;   // a gentleman's hands: a touch above the anatomy tables' average

export class Hands {
  constructor({ quality, tone = '#b8805c' }) {
    const h = quality.handRes || 0.0016;
    this.skin = skinMaterial(tone);
    const tweed = tweedMaterial(), cuffMat = cuffMaterial();
    const { cuff, sleeve } = meshSleeve(h * 1.25);
    cylUV(sleeve, 1);
    // ---- right hand: on the wheel ----
    const wp = POSES.wheel();
    this.wheelPose = wp;
    const rh = meshHand(wp, h);
    this.right = new THREE.Group();
    this.right.name = 'right-hand';
    const rSkin = new THREE.Mesh(rh.geo, this.skin);
    const rCuff = new THREE.Mesh(cuff, cuffMat), rSleeve = new THREE.Mesh(sleeve, tweed);
    this.right.add(rSkin, rCuff, rSleeve);
    // signet ring on the little finger
    const lit = buildFingerFrame(wp, 'little');
    const ring = new THREE.Mesh(new THREE.TorusGeometry(lit.r + 0.0011, 0.0016, 10, 32), new THREE.MeshStandardMaterial({ color: '#e3b866', metalness: 1, roughness: 0.2 }));
    ring.position.copy(lit.pos);
    ring.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), lit.dir);
    const seal = new THREE.Mesh(new THREE.CylinderGeometry(0.0042, 0.0042, 0.0022, 20), ring.material);
    seal.position.copy(lit.pos).addScaledVector(lit.up, lit.r + 0.0022);
    seal.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), lit.up);
    this.right.add(ring, seal);
    // the cigar sits between index and middle fingers, near their knuckles
    const ix = buildFingerFrame(wp, 'index'), md = buildFingerFrame(wp, 'middle');
    this.cigarAnchor = new THREE.Object3D();
    this.cigarAnchor.position.copy(ix.pos).lerp(md.pos, 0.5).addScaledVector(ix.up.clone().lerp(md.up, 0.5), 0.002);
    this.cigarAnchor.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, -1), ix.up.clone().lerp(md.up, 0.5).normalize().add(new THREE.Vector3(-0.35, 0, 0.25)).normalize());
    this.right.add(this.cigarAnchor);

    // ---- left hand: round a bottle (mirror of a right hand) ----
    const bp = POSES.bottle();
    this.bottlePose = bp;
    const lh = meshHand(bp, h);
    const mirror = (g) => {
      g.scale(-1, 1, 1);
      const idx = g.index.array;
      for (let i = 0; i < idx.length; i += 3) { const t = idx[i + 1]; idx[i + 1] = idx[i + 2]; idx[i + 2] = t; }
      g.index.needsUpdate = true;
      return g;
    };
    this.left = new THREE.Group();
    this.left.name = 'left-hand';
    const lSkin = new THREE.Mesh(mirror(lh.geo), this.skin);
    const lCuff = new THREE.Mesh(cuff, cuffMat), lSleeve = new THREE.Mesh(sleeve, tweed);
    this.left.add(lSkin, lCuff, lSleeve);
    this.watch = makeWatch();
    // on the back of the wrist, just short of the cuff
    this.watch.position.set(0, 0.0228, 0.036);
    this.watch.rotation.set(-0.08, Math.PI, 0);
    this.left.add(this.watch);
    const band = new THREE.Mesh(new THREE.TorusGeometry(1, 0.075, 8, 48), new THREE.MeshStandardMaterial({ color: '#4a2a16', roughness: 0.55 }));
    band.scale.set(0.0292, 0.0222, 0.032);
    band.position.set(0, -0.0005, 0.036);
    this.left.add(band);
    // bottle grip in left-hand space (mirrored x)
    this.bottleGrip = { c: new THREE.Vector3(-bp.grip.c[0], bp.grip.c[1], bp.grip.c[2]), R: bp.grip.R, ax: new THREE.Vector3(-bp.grip.ax[0], bp.grip.ax[1], bp.grip.ax[2]) };

    for (const g of [this.left, this.right]) g.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
    this.right.scale.setScalar(HAND_SCALE);
  }
  update() { tickWatch(this.watch); }
}

function buildFingerFrame(pose, name) {
  const f = FINGERS[name];
  const ch = chain(f, pose.fingers[name], pose.spread?.[name] || 0);
  const pos = ch.joints[0].clone().lerp(ch.joints[1], 0.42);
  return { pos, dir: ch.dirs[0].clone(), up: ch.ups[0].clone(), r: f.r[0] * 0.95 + f.r[1] * 0.05 };
}
