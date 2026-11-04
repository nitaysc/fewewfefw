// The town in 3D: sky, sea, streets, buildings, palms and the big set pieces.
import * as THREE from 'three';
import { mergeGeometries } from '../vendor/BufferGeometryUtils.js';
import { HALF, ROAD_LINES, ROAD_HALF, SIDEWALK, rng } from './world.js';

export const SUN_DIR = new THREE.Vector3(1, 0.13, 0.32).normalize();
export const FOG = new THREE.Color('#f4ad8c');

const col = (c) => new THREE.Color(c);

// ---------- sky ----------
export function makeSky() {
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: {
      uSun: { value: SUN_DIR },
      uTop: { value: col('#5a5fc8') },
      uMid: { value: col('#c98ac9') },
      uLow: { value: col('#ff9f73') },
      uHor: { value: FOG },
      uSunC: { value: col('#fff1b8') },
      uTime: { value: 0 },
    },
    vertexShader: `varying vec3 vDir; void main(){ vDir = normalize(position); vec4 p = projectionMatrix * modelViewMatrix * vec4(position,1.); gl_Position = p.xyww; }`,
    fragmentShader: `
      uniform vec3 uSun, uTop, uMid, uLow, uHor, uSunC; uniform float uTime; varying vec3 vDir;
      float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7))) * 43758.5453); }
      float noise(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.-2.*f);
        return mix(mix(hash(i),hash(i+vec2(1,0)),f.x), mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x), f.y); }
      float fbm(vec2 p){ float v=0., a=.5; for(int i=0;i<4;i++){ v+=a*noise(p); p*=2.03; a*=.5; } return v; }
      void main(){
        vec3 d = normalize(vDir);
        float h = d.y;
        vec3 c = mix(uHor, uLow, smoothstep(0.0, 0.07, h));
        c = mix(c, uMid, smoothstep(0.06, 0.25, h));
        c = mix(c, uTop, smoothstep(0.22, 0.75, h));
        float s = max(dot(d, uSun), 0.);
        c += uSunC * (pow(s, 12.) * 0.35 + pow(s, 90.) * 0.6);
        c = mix(c, uSunC * 1.25, smoothstep(0.9991, 0.9995, s));
        // stretched pink clouds, lit from the sun side
        if (h > 0.015) {
          vec2 uv = d.xz / (h + 0.12) * vec2(1.4, 3.2);
          float n = fbm(uv * 0.9 + vec2(uTime * 0.004, 0.));
          float cl = smoothstep(0.56, 0.78, n) * smoothstep(0.015, 0.12, h) * (1. - smoothstep(0.35, 0.6, h));
          vec3 cc = mix(vec3(0.95, 0.45, 0.5), vec3(1.0, 0.78, 0.55), pow(s, 3.));
          c = mix(c, cc, cl * 0.75);
        }
        if (h < 0.) c = uHor;
        gl_FragColor = vec4(c, 1.);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
  const sky = new THREE.Mesh(new THREE.SphereGeometry(900, 32, 16), mat);
  sky.renderOrder = -10;
  sky.frustumCulled = false;
  return sky;
}

// ---------- the sea ----------
export function makeSea() {
  const mat = new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 }, uSun: { value: SUN_DIR }, uFog: { value: FOG },
      uDeep: { value: col('#2e5fa8') }, uShallow: { value: col('#3fb5c2') }, uSky: { value: col('#ffb08c') }, uGlint: { value: col('#fff0c0') },
    },
    vertexShader: `varying vec3 vW; void main(){ vec4 w = modelMatrix * vec4(position,1.); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`,
    fragmentShader: `
      uniform float uTime; uniform vec3 uSun, uFog, uDeep, uShallow, uSky, uGlint; varying vec3 vW;
      void main(){
        vec3 V = normalize(cameraPosition - vW);
        float t = uTime;
        vec2 p = vW.xz;
        float dx = cos(p.x*0.21 + t*1.1)*0.12 + cos(p.x*0.63 + p.y*0.3 - t*1.9)*0.07 + cos(p.x*1.7 - t*2.8)*0.03;
        float dz = cos(p.y*0.27 - t*0.9)*0.12 + cos(p.y*0.71 + p.x*0.2 + t*1.6)*0.07 + cos(p.y*1.9 + t*3.1)*0.03;
        vec3 N = normalize(vec3(dx, 1., dz));
        float fres = pow(1. - max(dot(V, N), 0.), 4.);
        float shore = smoothstep(150., 130., vW.x);
        vec3 c = mix(uDeep, uShallow, shore * 0.7);
        c = mix(c, uSky, clamp(fres * 0.9 + 0.1, 0., 1.));
        vec3 R = reflect(-V, N);
        float g = pow(max(dot(R, uSun), 0.), 180.);
        c += uGlint * g * 2.5;
        // foam where the sea meets the sand
        float foam = smoothstep(0.6, 1., sin(vW.x * 1.2 - t * 2. + sin(vW.z * 0.1) * 2.) * 0.5 + 0.5) * smoothstep(140., 132., vW.x);
        c = mix(c, vec3(1.), foam * 0.6);
        float d = length(cameraPosition - vW);
        c = mix(c, uFog, smoothstep(200., 650., d));
        gl_FragColor = vec4(c, 1.);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
  const g = new THREE.PlaneGeometry(1600, 2400, 1, 1);
  g.rotateX(-Math.PI / 2);
  const sea = new THREE.Mesh(g, mat);
  sea.position.set(131 + 800, -0.9, 0);
  return sea;
}

// ---------- the street map, painted on one big texture ----------
export function makeGround(world, maxAniso = 4) {
  const N = 2048;
  const cv = document.createElement('canvas');
  cv.width = cv.height = N;
  const g = cv.getContext('2d');
  const S = N / (HALF * 2);
  const X = (x) => (x + HALF) * S;
  const rect = (x0, z0, x1, z1, c) => { g.fillStyle = c; g.fillRect(X(x0), X(z0), (x1 - x0) * S, (z1 - z0) * S); };
  const R = rng(99);

  // sidewalk everywhere, then fill in
  rect(-HALF, -HALF, HALF, HALF, '#d9cfc6');
  // sidewalk tile seams
  g.strokeStyle = 'rgba(120,100,100,0.13)'; g.lineWidth = 1;
  for (let v = -HALF; v < HALF; v += 1.5) {
    g.beginPath(); g.moveTo(X(v), 0); g.lineTo(X(v), N); g.stroke();
    g.beginPath(); g.moveTo(0, X(v)); g.lineTo(N, X(v)); g.stroke();
  }

  for (const b of world.blocks) {
    const m = SIDEWALK;
    const x0 = b.x0 + m, x1 = b.x1 - m, z0 = b.z0 + m, z1 = b.z1 - m;
    if (b.kind === 'beach') { rect(b.x0 - 0.5, b.z0 - ROAD_HALF * 2, HALF, b.z1 + ROAD_HALF * 2, '#f3d9a4'); continue; }
    if (b.kind === 'park' || b.kind === 'park2') {
      rect(x0, z0, x1, z1, '#7fc35a');
      for (let k = 0; k < 8; k++) rect(x0 + (k * (x1 - x0)) / 8, z0, x0 + ((k + 0.5) * (x1 - x0)) / 8, z1, 'rgba(255,255,255,0.06)');
      // a dirt track round the jump
      g.strokeStyle = '#c9a87a'; g.lineWidth = 4.5 * S;
      g.beginPath(); g.ellipse(X((x0 + x1) / 2), X((z0 + z1) / 2), (x1 - x0) * 0.33 * S, (z1 - z0) * 0.33 * S, 0, 0, Math.PI * 2); g.stroke();
      continue;
    }
    if (b.kind === 'plaza') {
      rect(x0, z0, x1, z1, '#ead6b8');
      g.save(); g.translate(X(0), X(0));
      for (let r = 19; r > 0; r -= 3) { g.fillStyle = r % 2 ? '#e3c79f' : '#f0dfc4'; g.beginPath(); g.arc(0, 0, r * S, 0, Math.PI * 2); g.fill(); }
      g.restore();
      continue;
    }
    if (b.kind === 'skate') {
      rect(x0, z0, x1, z1, '#c4c7cf');
      g.strokeStyle = '#e66b9b'; g.lineWidth = 0.5 * S;
      g.strokeRect(X(x0 + 2), X(z0 + 2), (x1 - x0 - 4) * S, (z1 - z0 - 4) * S);
      g.strokeStyle = '#4fb3d9';
      g.beginPath(); g.arc(X((x0 + x1) / 2), X((z0 + z1) / 2), 6 * S, 0, Math.PI * 2); g.stroke();
      continue;
    }
    if (b.kind === 'gas') { rect(x0, z0, x1, z1, '#cbc6c0'); continue; }
    // city block: a darker forecourt; parking lines on open corners
    rect(x0, z0, x1, z1, '#c7beb8');
  }
  // soft contact shadow round each building
  for (const b of world.boxes) {
    g.fillStyle = 'rgba(40,20,40,0.18)';
    g.fillRect(X(b.x0 - 0.8), X(b.z0 - 0.8), (b.x1 - b.x0 + 1.6) * S, (b.z1 - b.z0 + 1.6) * S);
  }
  for (const c of world.deco.cones) {
    g.strokeStyle = 'rgba(255,255,255,0.7)'; g.lineWidth = 0.18 * S;
    for (let k = -1; k <= 1; k++) { g.beginPath(); g.moveTo(X(c.x + k * 3), X(c.z - 2.5)); g.lineTo(X(c.x + k * 3), X(c.z + 2.5)); g.stroke(); }
  }

  // roads
  const asphalt = '#6d6874';
  for (const r of ROAD_LINES) {
    rect(r - ROAD_HALF, -HALF, r + ROAD_HALF, HALF, asphalt);
    rect(-HALF, r - ROAD_HALF, HALF, r + ROAD_HALF, asphalt);
  }
  // patchy asphalt
  for (let k = 0; k < 900; k++) {
    const r = ROAD_LINES[Math.floor(R() * 4)];
    const t = (R() * 2 - 1) * HALF, o = (R() * 2 - 1) * (ROAD_HALF - 1);
    const vert = R() < 0.5;
    g.fillStyle = R() < 0.5 ? 'rgba(255,255,255,0.025)' : 'rgba(0,0,0,0.05)';
    const w = (1 + R() * 3) * S;
    g.beginPath(); g.ellipse(vert ? X(r + o) : X(t), vert ? X(t) : X(r + o), w, w * 0.6, R() * 3, 0, Math.PI * 2); g.fill();
  }
  // curbs
  g.fillStyle = '#9b929a';
  for (const r of ROAD_LINES) {
    for (const e of [-ROAD_HALF, ROAD_HALF]) {
      rect(r + e - 0.25, -HALF, r + e + 0.25, HALF, '#a39aa1');
      rect(-HALF, r + e - 0.25, HALF, r + e + 0.25, '#a39aa1');
    }
  }
  // re-paint junctions so curbs don't cross them
  for (const x of ROAD_LINES) for (const z of ROAD_LINES) rect(x - ROAD_HALF, z - ROAD_HALF, x + ROAD_HALF, z + ROAD_HALF, asphalt);
  for (const r of ROAD_LINES) {
    for (const e of [-ROAD_HALF, ROAD_HALF]) {
      // road ends meeting the edge of town keep their curb only between junctions
    }
  }

  // markings
  const inJunction = (t) => ROAD_LINES.some((q) => Math.abs(q - t) < ROAD_HALF + 0.5);
  const lineAlong = (r, off, w, c, dash, vert) => {
    g.fillStyle = c;
    for (let t = -HALF; t < HALF; t += dash ? dash * 2 : 0.5) {
      const len = dash || 0.5;
      if (inJunction(t) || inJunction(t + len)) continue;
      if (vert) g.fillRect(X(r + off - w / 2), X(t), w * S, len * S + 0.5);
      else g.fillRect(X(t), X(r + off - w / 2), len * S + 0.5, w * S);
    }
  };
  for (const r of ROAD_LINES) {
    for (const vert of [true, false]) {
      lineAlong(r, -0.28, 0.22, '#f2c23a', 0, vert);
      lineAlong(r, 0.28, 0.22, '#f2c23a', 0, vert);
      lineAlong(r, -4, 0.2, 'rgba(255,255,255,0.8)', 2.4, vert);
      lineAlong(r, 4, 0.2, 'rgba(255,255,255,0.8)', 2.4, vert);
    }
  }
  // zebra crossings at every junction
  g.fillStyle = 'rgba(255,255,255,0.9)';
  for (const x of ROAD_LINES) for (const z of ROAD_LINES) {
    for (const side of [-1, 1]) {
      const zc = z + side * (ROAD_HALF + 1.6);
      const xc = x + side * (ROAD_HALF + 1.6);
      for (let k = -ROAD_HALF + 1; k < ROAD_HALF - 0.5; k += 1.6) {
        g.fillRect(X(x + k), X(zc - 1.2), 0.8 * S, 2.4 * S);
        g.fillRect(X(xc - 1.2), X(z + k), 2.4 * S, 0.8 * S);
      }
    }
  }
  // the plaza ring road paint
  g.strokeStyle = 'rgba(255,255,255,0.5)'; g.lineWidth = 0.3 * S; g.setLineDash([2 * S, 2 * S]);
  g.beginPath(); g.arc(X(0), X(0), 10 * S, 0, Math.PI * 2); g.stroke(); g.setLineDash([]);

  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = maxAniso;
  tex.generateMipmaps = true;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  const geo = new THREE.PlaneGeometry(HALF * 2, HALF * 2);
  geo.rotateX(-Math.PI / 2);
  const town = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ map: tex, roughness: 0.92 }));
  town.receiveShadow = true;

  // land beyond the edge of town, and the beach running down to the water
  const group = new THREE.Group();
  group.add(town);
  const outer = new THREE.Mesh(new THREE.PlaneGeometry(1400, 1400).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ color: '#b6a58f', roughness: 1 }));
  outer.position.set(-560, -0.05, 0);
  outer.receiveShadow = true;
  group.add(outer);
  const sand = new THREE.Mesh(new THREE.PlaneGeometry(30, 2400).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ color: '#f1d6a0', roughness: 1 }));
  sand.position.set(HALF + 15, -0.4, 0);
  sand.rotation.z = 0.03;
  sand.receiveShadow = true;
  group.add(sand);
  return { group, canvas: cv };
}

// ---------- buildings ----------
// One shared facade texture. Channels: a = wall (1) or window (0), g = wall shade,
// r = glass gradient, b = window lit by someone inside.
function facadeTexture() {
  const W = 256, H = 256;
  const cv = document.createElement('canvas');
  cv.width = W; cv.height = H;
  const g = cv.getContext('2d');
  const img = g.createImageData(W, H);
  const R = rng(5);
  // 2×2 windows per tile, tile = 4m × 4m
  const lit = [R() < 0.3, R() < 0.15, R() < 0.25, R() < 0.1];
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = (y * W + x) * 4;
    const cx = x % 128, cy = y % 128;
    const win = cx > 22 && cx < 106 && cy > 30 && cy < 104;
    const ledge = cy > 112 && cy < 122;
    const k = (x < 128 ? 0 : 1) + (y < 128 ? 0 : 2);
    if (win) {
      const frame = cx < 27 || cx > 101 || cy < 35 || cy > 99 || Math.abs(cx - 64) < 2;
      if (frame) { img.data[i] = 0; img.data[i + 1] = 235; img.data[i + 2] = 0; img.data[i + 3] = 255; continue; }
      const grad = Math.min(1, Math.max(0, (cy - 35) / 64 * 0.7 + (cx - 27) / 74 * 0.3));
      const streak = ((cx + cy) % 60) < 9 ? 0.35 : 0;
      img.data[i] = Math.round(255 * Math.min(1, grad + streak));
      img.data[i + 1] = 255;
      img.data[i + 2] = lit[k] ? 255 : 0;
      img.data[i + 3] = 0;
    } else {
      img.data[i] = 0; img.data[i + 1] = ledge ? 205 : 255; img.data[i + 2] = 0; img.data[i + 3] = 255;
    }
  }
  g.putImageData(img, 0, 0);
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.NoColorSpace;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.premultiplyAlpha = false;
  return tex;
}

function facadeMaterial() {
  const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.8, map: facadeTexture() });
  mat.onBeforeCompile = (sh) => {
    sh.fragmentShader = sh.fragmentShader.replace('#include <map_fragment>', `
      vec4 fTex = texture2D(map, vMapUv);
      vec3 glass = mix(vec3(0.20, 0.25, 0.45), vec3(0.95, 0.72, 0.62), fTex.r);
      glass = mix(glass, vec3(1.0, 0.78, 0.42), fTex.b);
      diffuseColor.rgb = mix(glass, diffuseColor.rgb * fTex.g, fTex.a);
      float fGlass = 1.0 - fTex.a;
    `).replace('#include <emissivemap_fragment>', `
      totalEmissiveRadiance += vec3(1.0, 0.7, 0.35) * fTex.b * fGlass * 0.8;
    `).replace('#include <roughnessmap_fragment>', `
      float roughnessFactor = mix(roughness, 0.25, fGlass);
    `);
  };
  return mat;
}

// a growable mesh of quads, so a whole skyline is one draw call
class Quads {
  constructor() { this.p = []; this.n = []; this.uv = []; this.c = []; this.idx = []; }
  quad(a, b, c2, d, normal, color, u = 1, v = 1) {
    const base = this.p.length / 3;
    for (const q of [a, b, c2, d]) this.p.push(q[0], q[1], q[2]);
    for (let k = 0; k < 4; k++) { this.n.push(normal[0], normal[1], normal[2]); this.c.push(color.r, color.g, color.b); }
    this.uv.push(0, 0, u, 0, u, v, 0, v);
    this.idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
  }
  // a box from (x0,y0,z0) to (x1,y1,z1); uv in metres / tile
  box(x0, y0, z0, x1, y1, z1, color, tile = 4, top = null, bottom = false) {
    const w = x1 - x0, h = y1 - y0, d = z1 - z0;
    const uh = h / tile;
    this.quad([x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1], [0, 0, 1], color, w / tile, uh);
    this.quad([x1, y0, z0], [x0, y0, z0], [x0, y1, z0], [x1, y1, z0], [0, 0, -1], color, w / tile, uh);
    this.quad([x1, y0, z1], [x1, y0, z0], [x1, y1, z0], [x1, y1, z1], [1, 0, 0], color, d / tile, uh);
    this.quad([x0, y0, z0], [x0, y0, z1], [x0, y1, z1], [x0, y1, z0], [-1, 0, 0], color, d / tile, uh);
    if (top) top.quad([x0, y1, z1], [x1, y1, z1], [x1, y1, z0], [x0, y1, z0], [0, 1, 0], top.color || color, 0, 0);
    if (bottom) this.quad([x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1], [0, -1, 0], color, 0, 0);
  }
  geometry() {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.p, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.n, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(this.uv, 2));
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.c, 3));
    g.setIndex(this.idx);
    g.computeBoundingSphere();
    return g;
  }
}

export function makeBuildings(world) {
  const walls = new Quads();
  const roofs = new Quads();
  const plain = new Quads();          // shop fronts, rooftop clutter, awnings (no windows)
  const R = rng(31);
  const roofCol = col('#8d7f8c');
  for (const b of world.boxes) {
    if (b.kind === 'pump' || b.kind === 'shop' || b.kind === 'tower' && b.h < 8) continue;
    const c = col(b.color);
    // ground floor: a slightly darker band with shop windows
    const groundH = 4;
    walls.box(b.x0, groundH, b.z0, b.x1, b.h, b.z1, c, 4, null);
    const dark = c.clone().multiplyScalar(0.82);
    walls.box(b.x0 + 0.15, 0, b.z0 + 0.15, b.x1 - 0.15, groundH, b.z1 - 0.15, dark, 4, null);
    // parapet and roof
    roofs.color = roofCol;
    plain.box(b.x0 - 0.3, b.h, b.z0 - 0.3, b.x1 + 0.3, b.h + 0.7, b.z1 + 0.3, c.clone().multiplyScalar(1.05), 4, { quad: (...a) => roofs.quad(...a), color: roofCol });
    // awning over the shops on one side
    const ac = col(['#e85d5d', '#3fa7a0', '#f0a23b', '#6c7fd8'][Math.floor(R() * 4)]);
    if (R() < 0.6) plain.box(b.x0 + 1, 3.6, b.z0 - 1.4, b.x1 - 1, 3.85, b.z0, ac);
    // rooftop clutter
    const n = 1 + Math.floor(R() * 3);
    for (let k = 0; k < n; k++) {
      const w = 1.5 + R() * 3, d = 1.5 + R() * 3;
      const x = b.x0 + 1 + R() * Math.max(0.1, b.x1 - b.x0 - w - 2), z = b.z0 + 1 + R() * Math.max(0.1, b.z1 - b.z0 - d - 2);
      plain.box(x, b.h + 0.7, z, x + w, b.h + 0.7 + 1 + R() * 1.5, z + d, col('#bdb3bd'), 4, { quad: (...a) => plain.quad(...a), color: col('#a79ca8') });
    }
    if (b.kind === 'tower') {
      // a crown on the tall ones
      const cx = (b.x0 + b.x1) / 2, cz = (b.z0 + b.z1) / 2;
      plain.box(cx - 3, b.h + 0.7, cz - 3, cx + 3, b.h + 5, cz + 3, c, 4, { quad: (...a) => plain.quad(...a), color: roofCol });
    }
  }

  // a skyline outside town, fogged into the sunset
  const far = new Quads();
  const R2 = rng(77);
  for (let k = 0; k < 140; k++) {
    let x, z;
    const side = Math.floor(R2() * 3);
    const t = (R2() * 2 - 1) * 300;
    const d = 150 + R2() * 220;
    if (side === 0) { x = -d; z = t; } else if (side === 1) { x = t * 0.7 - 60; z = -d; } else { x = t * 0.7 - 60; z = d; }
    if (x > 110) continue;
    const w = 10 + R2() * 18, dd = 10 + R2() * 18;
    const h = 25 + Math.pow(R2(), 2) * 120;
    const c = col(['#b9b3d9', '#c7b4cf', '#a9b8d8', '#d6c2c6', '#9fa7cf'][Math.floor(R2() * 5)]);
    far.box(x - w / 2, 0, z - dd / 2, x + w / 2, h, z + dd / 2, c, 4, { quad: (...a) => roofs.quad(...a), color: c.clone().multiplyScalar(0.8) });
  }

  const fac = facadeMaterial();
  const group = new THREE.Group();
  const wm = new THREE.Mesh(walls.geometry(), fac);
  wm.castShadow = wm.receiveShadow = true;
  const fm = new THREE.Mesh(far.geometry(), fac);
  const rm = new THREE.Mesh(roofs.geometry(), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95 }));
  rm.receiveShadow = true;
  const pm = new THREE.Mesh(plain.geometry(), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85 }));
  pm.castShadow = pm.receiveShadow = true;
  group.add(wm, fm, rm, pm);
  return group;
}

// ---------- props: palms, trees, lamps, benches, cones ----------
function colored(geo, c) {
  geo = geo.index ? geo.toNonIndexed() : geo;
  const cc = col(c);
  const a = new Float32Array(geo.attributes.position.count * 3);
  for (let i = 0; i < a.length; i += 3) { a[i] = cc.r; a[i + 1] = cc.g; a[i + 2] = cc.b; }
  geo.setAttribute('color', new THREE.BufferAttribute(a, 3));
  for (const k of Object.keys(geo.attributes)) if (!['position', 'normal', 'color'].includes(k)) geo.deleteAttribute(k);
  return geo;
}

function palmGeometry() {
  const parts = [];
  // a gently curved trunk made of rings
  let x = 0, y = 0;
  for (let i = 0; i < 7; i++) {
    const seg = new THREE.CylinderGeometry(0.32 - i * 0.025, 0.36 - i * 0.025, 1.25, 7);
    seg.translate(0, 0.62, 0);
    seg.rotateZ(-0.05 * i);
    seg.translate(x, y, 0);
    parts.push(colored(seg, i % 2 ? '#a77650' : '#8e6242'));
    x += Math.sin(0.05 * i) * 1.25; y += Math.cos(0.05 * i) * 1.18;
  }
  // fronds: bent tapering leaves
  for (let k = 0; k < 8; k++) {
    const leaf = new THREE.PlaneGeometry(1.1, 4.2, 1, 6);
    const p = leaf.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const ly = p.getY(i) + 2.1;               // 0..4.2 along the leaf
      const taper = 1 - ly / 4.6;
      p.setX(i, p.getX(i) * taper * (0.6 + Math.sin(ly / 4.2 * Math.PI) * 0.6));
      p.setZ(i, -Math.pow(ly / 4.2, 2) * 1.9 + Math.abs(p.getX(i)) * 0.4);
      p.setY(i, ly);
    }
    leaf.computeVertexNormals();
    leaf.rotateX(Math.PI / 2 - 0.35);          // lie out flat, tip drooping
    leaf.rotateY((k / 8) * Math.PI * 2 + (k % 2) * 0.2);
    leaf.translate(x, y + 0.1, 0);
    parts.push(colored(leaf, k % 2 ? '#3f9e4a' : '#56b84f'));
  }
  const nuts = new THREE.IcosahedronGeometry(0.35, 0);
  nuts.translate(x, y - 0.2, 0);
  parts.push(colored(nuts, '#6b4a2a'));
  return mergeGeometries(parts);
}

function treeGeometry() {
  const parts = [];
  const trunk = new THREE.CylinderGeometry(0.25, 0.35, 2.4, 6);
  trunk.translate(0, 1.2, 0);
  parts.push(colored(trunk, '#7a5638'));
  const blobs = [[0, 3.4, 0, 1.9, '#5fae45'], [0.9, 2.9, 0.4, 1.3, '#6fbd4f'], [-0.8, 3.0, -0.4, 1.4, '#55a23f'], [0.1, 4.4, 0.1, 1.2, '#7cc75a']];
  for (const [x, y, z, r, c] of blobs) {
    const b = new THREE.IcosahedronGeometry(r, 1);
    b.translate(x, y, z);
    parts.push(colored(b, c));
  }
  return mergeGeometries(parts);
}

function lampGeometry() {
  const parts = [];
  const pole = new THREE.CylinderGeometry(0.09, 0.13, 5.5, 6); pole.translate(0, 2.75, 0);
  const arm = new THREE.BoxGeometry(0.1, 0.1, 1.6); arm.translate(0, 5.4, 0.7);
  const head = new THREE.BoxGeometry(0.5, 0.18, 0.8); head.translate(0, 5.3, 1.45);
  const bulb = new THREE.BoxGeometry(0.36, 0.05, 0.6); bulb.translate(0, 5.2, 1.45);
  parts.push(colored(pole, '#5d5a6b'), colored(arm, '#5d5a6b'), colored(head, '#4a4757'), colored(bulb, '#fff3c4'));
  return mergeGeometries(parts);
}

function benchGeometry() {
  const parts = [];
  const seat = new THREE.BoxGeometry(2.2, 0.12, 0.6); seat.translate(0, 0.5, 0);
  const back = new THREE.BoxGeometry(2.2, 0.5, 0.1); back.translate(0, 0.85, -0.28);
  const l1 = new THREE.BoxGeometry(0.1, 0.5, 0.5); l1.translate(-0.9, 0.25, 0);
  const l2 = l1.clone(); l2.translate(1.8, 0, 0);
  parts.push(colored(seat, '#b0703f'), colored(back, '#b0703f'), colored(l1, '#3d3a46'), colored(l2, '#3d3a46'));
  return mergeGeometries(parts);
}

function coneGeometry() {
  const c = new THREE.ConeGeometry(0.35, 0.9, 8); c.translate(0, 0.45, 0);
  const band = new THREE.CylinderGeometry(0.24, 0.27, 0.18, 8); band.translate(0, 0.5, 0);
  const base = new THREE.BoxGeometry(0.8, 0.08, 0.8); base.translate(0, 0.04, 0);
  return mergeGeometries([colored(c, '#ff7a2f'), colored(band, '#ffffff'), colored(base, '#ff7a2f')]);
}

function instanced(geo, list, mat, fn) {
  const m = new THREE.InstancedMesh(geo, mat, Math.max(1, list.length));
  const o = new THREE.Object3D();
  list.forEach((it, i) => { o.position.set(it.x, 0, it.z); o.rotation.set(0, it.r ?? it.ang ?? 0, 0); o.scale.setScalar(it.s || 1); fn?.(o, it); o.updateMatrix(); m.setMatrixAt(i, o.matrix); });
  m.count = list.length;
  m.castShadow = true; m.receiveShadow = true;
  return m;
}

export function makeProps(world) {
  const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85, side: THREE.DoubleSide });
  const g = new THREE.Group();
  const d = world.deco;
  // extra palms along the beach road and outside town for the skyline
  const R = rng(12);
  const palms = [...d.palms];
  for (let z = -120; z <= 120; z += 14) palms.push({ x: 124 + R() * 2, z: z + R() * 4, s: 1 + R() * 0.5, r: R() * 6 });
  g.add(instanced(palmGeometry(), palms, mat));
  g.add(instanced(treeGeometry(), d.trees, mat, (o, it) => { o.rotation.y = it.x * 7.3; }));
  g.add(instanced(lampGeometry(), d.lamps, mat));
  g.add(instanced(benchGeometry(), d.benches, mat));
  g.add(instanced(coneGeometry(), d.cones, mat));
  return g;
}

// ---------- set pieces ----------
function textTexture(text, { w = 512, h = 128, bg = '#e53b30', fg = '#fff', font = '800 92px Fredoka, sans-serif', stroke } = {}) {
  const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
  const g = cv.getContext('2d');
  g.fillStyle = bg; g.fillRect(0, 0, w, h);
  g.font = font; g.textAlign = 'center'; g.textBaseline = 'middle';
  if (stroke) { g.strokeStyle = stroke; g.lineWidth = 10; g.strokeText(text, w / 2, h / 2 + 4); }
  g.fillStyle = fg; g.fillText(text, w / 2, h / 2 + 4);
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  return t;
}

const std = (c, o = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.7, ...o });
const shadowed = (m) => { m.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } }); return m; };

export function makeLandmarks(world) {
  const g = new THREE.Group();
  const anim = [];
  const L = world.landmarks;

  // fountain in the plaza
  if (L.fountain) {
    const f = new THREE.Group();
    const basin = new THREE.Mesh(new THREE.CylinderGeometry(6.5, 6.8, 0.9, 32), std('#e9dccb'));
    basin.position.y = 0.45;
    const water = new THREE.Mesh(new THREE.CylinderGeometry(6, 6, 0.1, 32), std('#5cc6e0', { roughness: 0.1, emissive: '#1d6f8a', emissiveIntensity: 0.4 }));
    water.position.y = 0.8;
    const mid = new THREE.Mesh(new THREE.CylinderGeometry(0.8, 1.2, 3, 12), std('#e9dccb'));
    mid.position.y = 1.5;
    const bowl = new THREE.Mesh(new THREE.CylinderGeometry(2.4, 1.2, 0.6, 20), std('#e9dccb'));
    bowl.position.y = 3.2;
    const jet = new THREE.Mesh(new THREE.ConeGeometry(0.7, 3, 12, 1, true), new THREE.MeshStandardMaterial({ color: '#bff3ff', transparent: true, opacity: 0.6, emissive: '#5fc9e8', emissiveIntensity: 0.5 }));
    jet.position.y = 4.8; jet.rotation.x = Math.PI;
    f.add(basin, water, mid, bowl, jet);
    f.position.set(L.fountain.x, 0, L.fountain.z);
    g.add(shadowed(f));
    anim.push((t) => { jet.scale.y = 1 + Math.sin(t * 6) * 0.08; });
  }

  // gas station with a big sign
  if (L.gas) {
    const gs = new THREE.Group();
    const { x, z } = L.gas;
    const canopy = new THREE.Mesh(new THREE.BoxGeometry(14, 1.1, 20), std('#f6f3ee'));
    canopy.position.set(x - 3, 5.6, z);
    const band = new THREE.Mesh(new THREE.BoxGeometry(14.2, 0.6, 20.2), std('#e53b30'));
    band.position.set(x - 3, 5.3, z);
    gs.add(canopy, band);
    for (const [px, pz] of [[-8, -7], [-8, 7], [2, -7], [2, 7]]) {
      const p = new THREE.Mesh(new THREE.BoxGeometry(0.8, 5, 0.8), std('#f6f3ee'));
      p.position.set(x + px, 2.5, z + pz); gs.add(p);
    }
    for (const pz of [-3, 3]) {
      const pump = new THREE.Mesh(new THREE.BoxGeometry(2, 1.8, 1.2), std('#e5483e'));
      pump.position.set(x - 3, 0.9, z + pz);
      const screen = new THREE.Mesh(new THREE.BoxGeometry(2.05, 0.5, 0.8), std('#ffd35a', { emissive: '#ffb020', emissiveIntensity: 0.5 }));
      screen.position.set(x - 3, 1.4, z + pz);
      gs.add(pump, screen);
    }
    const shop = new THREE.Mesh(new THREE.BoxGeometry(13, 6, 32), std('#f3efe6'));
    const sb = world.boxes.find((b) => b.kind === 'shop');
    shop.position.set((sb.x0 + sb.x1) / 2, 3, (sb.z0 + sb.z1) / 2);
    shop.scale.set((sb.x1 - sb.x0) / 13, 1, (sb.z1 - sb.z0) / 32);
    const glass = new THREE.Mesh(new THREE.BoxGeometry(0.2, 3, (sb.z1 - sb.z0) * 0.7), std('#6fa6d8', { roughness: 0.15, emissive: '#ffcf8a', emissiveIntensity: 0.25 }));
    glass.position.set(sb.x0 - 0.05, 2, (sb.z0 + sb.z1) / 2);
    gs.add(shop, glass);
    const sign = new THREE.Mesh(new THREE.BoxGeometry(0.4, 2.4, 7.5), [std('#e53b30'), std('#e53b30', { map: textTexture('GAS') , emissive: '#ffffff', emissiveMap: textTexture('GAS'), emissiveIntensity: 0.35 }), std('#e53b30'), std('#e53b30'), std('#e53b30'), std('#e53b30')]);
    sign.position.set(x - 10.4, 7.2, z);
    sign.rotation.y = Math.PI;
    gs.add(sign);
    g.add(shadowed(gs));
  }

  // ferris wheel on the beach
  if (L.wheel) {
    const fw = new THREE.Group();
    const R = 10, hub = 12.5;
    const legM = std('#e9e4ef');
    for (const side of [-1, 1]) {
      for (const dz of [-5, 5]) {
        const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.45, 13.5, 8), legM);
        leg.position.set(side * 1.6, hub / 2, dz / 2);
        leg.rotation.x = -Math.sign(dz) * 0.38;
        fw.add(leg);
      }
    }
    const wheel = new THREE.Group();
    wheel.position.y = hub;
    const rimM = std('#fdf6ff', { emissive: '#ff8fc6', emissiveIntensity: 0.25 });
    for (const side of [-1.1, 1.1]) {
      const rim = new THREE.Mesh(new THREE.TorusGeometry(R, 0.22, 8, 48), rimM);
      rim.rotation.y = Math.PI / 2; rim.position.x = side;
      wheel.add(rim);
    }
    const cabColors = ['#ff6b6b', '#ffd166', '#4ecdc4', '#7b8cff', '#ff9ff3', '#6bd36b'];
    const cabins = [];
    for (let k = 0; k < 12; k++) {
      const a = (k / 12) * Math.PI * 2;
      const spoke = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.15, R * 2), rimM);
      spoke.rotation.x = a;
      if (k < 6) wheel.add(spoke);
      const cab = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 0.9, 1.6, 10), std(cabColors[k % cabColors.length]));
      cab.rotation.z = Math.PI / 2;
      cab.userData.a = a;
      wheel.add(cab); cabins.push(cab);
    }
    fw.add(wheel);
    fw.position.set(L.wheel.x, 0, L.wheel.z);
    g.add(shadowed(fw));
    anim.push((t) => {
      const r = t * 0.12;
      wheel.rotation.x = r;
      for (const c of cabins) {
        const a = c.userData.a + r;
        // cabins hang level while the wheel turns
        c.position.set(0, Math.cos(a) * R - 1.1, Math.sin(a) * R);
        c.position.applyAxisAngle(new THREE.Vector3(1, 0, 0), -r);
        c.rotation.set(-r, 0, Math.PI / 2);
      }
    });
  }

  // lifeguard tower
  if (L.tower) {
    const lt = new THREE.Group();
    for (const [dx, dz] of [[-1.7, -1.7], [1.7, -1.7], [-1.7, 1.7], [1.7, 1.7]]) {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.3, 3, 0.3), std('#f5f0e8'));
      leg.position.set(dx, 1.5, dz); lt.add(leg);
    }
    const hut = new THREE.Mesh(new THREE.BoxGeometry(4, 2, 4), std('#f06b5b'));
    hut.position.y = 4;
    const roof = new THREE.Mesh(new THREE.ConeGeometry(3.4, 1.4, 4), std('#3fb0c9'));
    roof.position.y = 5.7; roof.rotation.y = Math.PI / 4;
    lt.add(hut, roof);
    lt.position.set(L.tower.x, 0, L.tower.z);
    g.add(shadowed(lt));
  }

  // sea wall railing along the beach
  const rail = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.9, HALF * 2), std('#f2efe9'));
  rail.position.set(HALF + 0.2, 0.45, 0);
  rail.castShadow = true;
  g.add(rail);
  // low hedges round the other three edges
  const hedgeM = std('#4f9a43');
  for (const [x, z, w, d] of [[-HALF - 0.6, 0, 1.2, HALF * 2], [0, -HALF - 0.6, HALF * 2, 1.2], [0, HALF + 0.6, HALF * 2, 1.2]]) {
    const h = new THREE.Mesh(new THREE.BoxGeometry(w, 1.4, d), hedgeM);
    h.position.set(x, 0.7, z); h.castShadow = true; g.add(h);
  }

  // a rooftop billboard
  const tallest = [...world.boxes].filter((b) => b.kind === 'house' && b.x1 < 90).sort((a, b) => b.h - a.h)[3];
  if (tallest) {
    const tex = textTexture('SUNSET RUMBLE', { w: 1024, h: 256, bg: '#2a2350', fg: '#ffd166', font: '800 150px Fredoka, sans-serif', stroke: '#ff5d8f' });
    const bb = new THREE.Mesh(new THREE.PlaneGeometry(14, 3.5), new THREE.MeshStandardMaterial({ map: tex, emissive: '#ffffff', emissiveMap: tex, emissiveIntensity: 0.5, side: THREE.DoubleSide }));
    bb.position.set((tallest.x0 + tallest.x1) / 2, tallest.h + 4.5, (tallest.z0 + tallest.z1) / 2);
    bb.rotation.y = -Math.PI / 2;
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.4, 3, 0.4), std('#555'));
    post.position.set(bb.position.x, tallest.h + 1.5, bb.position.z);
    g.add(bb, post);
  }

  // a helicopter doing laps, and distant hills across the bay
  const heli = new THREE.Group();
  const body = new THREE.Mesh(new THREE.SphereGeometry(1.4, 12, 8), std('#ececf2'));
  body.scale.set(1, 0.8, 1.6);
  const tail = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.3, 4), std('#ececf2'));
  tail.position.z = -3;
  const rotor = new THREE.Mesh(new THREE.BoxGeometry(7, 0.05, 0.3), std('#333'));
  rotor.position.y = 1.3;
  const stripe = new THREE.Mesh(new THREE.BoxGeometry(2.9, 0.4, 3), std('#e53b30'));
  heli.add(body, tail, rotor, stripe);
  g.add(heli);
  anim.push((t) => {
    const a = t * 0.08;
    heli.position.set(Math.cos(a) * 90 - 10, 48 + Math.sin(t * 0.5) * 2, Math.sin(a) * 90);
    heli.rotation.y = -a;
    rotor.rotation.y = t * 30;
  });

  const hillM = std('#8e86b8', { roughness: 1 });
  const R = rng(3);
  for (let k = 0; k < 9; k++) {
    const hill = new THREE.Mesh(new THREE.ConeGeometry(60 + R() * 70, 30 + R() * 45, 7), hillM);
    hill.position.set(420 + R() * 200, -2, -380 + k * 95 + R() * 40);
    hill.scale.z = 1.6;
    g.add(hill);
  }
  return { group: g, anim };
}

// ---------- ramps and boost pads ----------
export function makeRamps(world) {
  const g = new THREE.Group();
  const cv = document.createElement('canvas'); cv.width = 128; cv.height = 128;
  const c = cv.getContext('2d');
  c.fillStyle = '#ff8a2a'; c.fillRect(0, 0, 128, 128);
  c.fillStyle = '#fff3e0';
  for (let k = -2; k < 4; k++) { c.beginPath(); c.moveTo(k * 48, 128); c.lineTo(k * 48 + 24, 128); c.lineTo(k * 48 + 24 + 128, 0); c.lineTo(k * 48 + 128, 0); c.fill(); }
  const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace; tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  const topM = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.6 });
  const sideM = new THREE.MeshStandardMaterial({ color: '#4a4760', roughness: 0.8 });
  for (const r of world.ramps) {
    const w = r.w / 2, L = r.len / 2, h = r.h;
    const geo = new THREE.BufferGeometry();
    // local: x = side, z = along (rising towards +z)
    const P = [
      // top slope
      -w, 0, -L, w, 0, -L, w, h, L, -w, 0, -L, w, h, L, -w, h, L,
      // back wall
      -w, 0, L, -w, h, L, w, h, L, -w, 0, L, w, h, L, w, 0, L,
      // sides
      w, 0, -L, w, 0, L, w, h, L,
      -w, 0, -L, -w, h, L, -w, 0, L,
    ];
    const UV = [0, 0, r.w / 4, 0, r.w / 4, r.len / 4, 0, 0, r.w / 4, r.len / 4, 0, r.len / 4, ...new Array(24).fill(0)];
    // the list above winds clockwise; flip each triangle so the faces point outwards
    for (let t = 0; t < P.length / 9; t++) {
      for (let k = 0; k < 3; k++) [P[t * 9 + 3 + k], P[t * 9 + 6 + k]] = [P[t * 9 + 6 + k], P[t * 9 + 3 + k]];
      for (let k = 0; k < 2; k++) [UV[t * 6 + 2 + k], UV[t * 6 + 4 + k]] = [UV[t * 6 + 4 + k], UV[t * 6 + 2 + k]];
    }
    geo.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(UV, 2));
    geo.addGroup(0, 6, 0); geo.addGroup(6, 12, 1);
    geo.computeVertexNormals();
    const m = new THREE.Mesh(geo, [topM, sideM]);
    m.position.set(r.x, 0.02, r.z);
    m.rotation.y = r.ang;
    m.castShadow = m.receiveShadow = true;
    g.add(m);
  }

  // pads: glowing chevrons that scroll forwards
  const pc = document.createElement('canvas'); pc.width = 128; pc.height = 128;
  const p = pc.getContext('2d');
  p.clearRect(0, 0, 128, 128);
  p.strokeStyle = '#ffffff'; p.lineWidth = 16; p.lineCap = 'round'; p.lineJoin = 'round';
  p.beginPath(); p.moveTo(24, 40); p.lineTo(64, 88); p.lineTo(104, 40); p.stroke();
  const ptex = new THREE.CanvasTexture(pc); ptex.wrapT = THREE.RepeatWrapping; ptex.colorSpace = THREE.SRGBColorSpace;
  const padM = new THREE.MeshBasicMaterial({ map: ptex, color: '#5ff3ff', transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, polygonOffset: true, polygonOffsetFactor: -2 });
  const baseM = new THREE.MeshBasicMaterial({ color: '#1f6f9a', transparent: true, opacity: 0.3, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -1 });
  for (const pad of world.pads) {
    const geo = new THREE.PlaneGeometry(pad.w, pad.len);
    geo.rotateX(-Math.PI / 2);
    const uv = geo.attributes.uv;
    for (let i = 0; i < uv.count; i++) uv.setY(i, uv.getY(i) * pad.len / 2.2);
    const base = new THREE.Mesh(geo, baseM);
    const arrows = new THREE.Mesh(geo, padM);
    for (const m of [base, arrows]) { m.position.set(pad.x, 0.04, pad.z); m.rotation.y = pad.ang; g.add(m); }
  }
  return { group: g, padTex: ptex };
}
