// Everything you see: the course, its candy world, balls, hats, the cup and effects.
import * as THREE from '../vendor/three.module.js';
import { RoundedBoxGeometry } from '../vendor/RoundedBoxGeometry.js';
import { RoomEnvironment } from '../vendor/RoomEnvironment.js';
import { CELL, LEVEL, BALL_R, CUP_R, WALL_H, WALL_T, obstaclePose } from './physics.js';

const CANDY = ['#ff4f8b', '#ffcc33', '#4fc3ff', '#8d6bff', '#2ed47a', '#ff8a3d'];
const PASTEL = ['#ffb3d1', '#ffe08a', '#a8e4ff', '#c9b6ff', '#a6f0c6', '#ffc59e'];

// ---------- helpers ----------
export function rng(seed) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function canvasTex(w, h, draw, { repeat = true, color = true } = {}) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  if (color) t.colorSpace = THREE.SRGBColorSpace;
  if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 4;
  return t;
}
const retex = (tex, rx, ry) => { const t = tex.clone(); t.needsUpdate = true; t.repeat.set(rx, ry); return t; };

// shared materials so the scenery can be merged into a handful of draw calls
const matCache = new Map();
function mat(color, { rough = 0.4, metal = 0, map = null, clear = 0, opacity = 1, key = '' } = {}) {
  const k = `${color}|${rough}|${metal}|${map ? map.uuid : ''}|${clear}|${opacity}|${key}`;
  if (!matCache.has(k)) {
    const m = clear
      ? new THREE.MeshPhysicalMaterial({ color, roughness: rough, metalness: metal, map, clearcoat: clear, clearcoatRoughness: 0.15 })
      : new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: metal, map });
    if (opacity < 1) { m.transparent = true; m.opacity = opacity; }
    m.userData.shared = true;
    matCache.set(k, m);
  }
  return matCache.get(k);
}

// collapse a group of static meshes into one mesh per material
function mergeStatic(group) {
  group.updateMatrixWorld(true);
  const buckets = new Map();
  group.traverse((m) => {
    if (!m.isMesh) return;
    let g = m.geometry.index ? m.geometry.toNonIndexed() : m.geometry.clone();
    g.applyMatrix4(m.matrixWorld);
    if (!g.attributes.uv) g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
    if (!buckets.has(m.material)) buckets.set(m.material, []);
    buckets.get(m.material).push(g);
  });
  const out = new THREE.Group();
  for (const [material, geos] of buckets) {
    const n = geos.reduce((s, g) => s + g.attributes.position.count, 0);
    const pos = new Float32Array(n * 3), nor = new Float32Array(n * 3), uv = new Float32Array(n * 2);
    let o = 0;
    for (const g of geos) {
      pos.set(g.attributes.position.array, o * 3);
      nor.set(g.attributes.normal.array, o * 3);
      uv.set(g.attributes.uv.array, o * 2);
      o += g.attributes.position.count;
      g.dispose();
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
    geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    geo.computeBoundingSphere();
    const mesh = new THREE.Mesh(geo, material);
    mesh.matrixAutoUpdate = false;
    out.add(mesh);
  }
  return out;
}

// ---------- textures, made once per theme ----------
let shared = null;
function sharedTextures() {
  if (shared) return shared;
  // golf ball dimples as a normal map
  const W = 512, H = 256;
  const hc = document.createElement('canvas'); hc.width = W; hc.height = H;
  const hg = hc.getContext('2d');
  hg.fillStyle = '#fff'; hg.fillRect(0, 0, W, H);
  for (let row = 0; row < 14; row++) {
    const v = (row + 0.5) / 14, lat = (v - 0.5) * Math.PI, per = Math.max(3, Math.round(30 * Math.cos(lat)));
    for (let i = 0; i < per; i++) {
      const u = (i + (row % 2) * 0.5) / per;
      const r = 7.5, rx = r / Math.max(0.25, Math.cos(lat));
      for (const du of [-1, 0, 1]) {
        const gr = hg.createRadialGradient(0, 0, 0, 0, 0, 1);
        gr.addColorStop(0, '#6a6a6a'); gr.addColorStop(0.8, '#d8d8d8'); gr.addColorStop(1, '#ffffff');
        hg.save(); hg.translate((u + du) * W, v * H); hg.scale(rx, r);
        hg.fillStyle = gr; hg.beginPath(); hg.arc(0, 0, 1, 0, Math.PI * 2); hg.fill(); hg.restore();
      }
    }
  }
  const hd = hg.getImageData(0, 0, W, H).data;
  const nc = document.createElement('canvas'); nc.width = W; nc.height = H;
  const ng = nc.getContext('2d'), out = ng.createImageData(W, H);
  const hAt = (x, y) => hd[(((y + H) % H) * W + ((x + W) % W)) * 4] / 255;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const dx = (hAt(x + 1, y) - hAt(x - 1, y)) * 2.2, dy = (hAt(x, y + 1) - hAt(x, y - 1)) * 2.2;
    const l = Math.hypot(dx, dy, 1), i = (y * W + x) * 4;
    out.data[i] = (-dx / l * 0.5 + 0.5) * 255; out.data[i + 1] = (dy / l * 0.5 + 0.5) * 255; out.data[i + 2] = (1 / l * 0.5 + 0.5) * 255; out.data[i + 3] = 255;
  }
  ng.putImageData(out, 0, 0);
  const dimples = new THREE.CanvasTexture(nc);
  dimples.wrapS = THREE.RepeatWrapping;

  const cloud = canvasTex(256, 128, (g, w, h) => {
    const r = rng(11);
    for (let i = 0; i < 14; i++) {
      const x = w * (0.2 + r() * 0.6), y = h * (0.45 + (r() - 0.5) * 0.3), rad = h * (0.2 + r() * 0.22);
      const gr = g.createRadialGradient(x, y, 0, x, y, rad);
      gr.addColorStop(0, 'rgba(255,255,255,0.95)'); gr.addColorStop(0.6, 'rgba(255,255,255,0.7)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = gr; g.beginPath(); g.arc(x, y, rad, 0, Math.PI * 2); g.fill();
    }
  }, { repeat: false });
  const glow = canvasTex(128, 128, (g, w) => {
    const gr = g.createRadialGradient(w / 2, w / 2, 0, w / 2, w / 2, w / 2);
    gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.3, 'rgba(255,250,220,.6)'); gr.addColorStop(1, 'rgba(255,240,200,0)');
    g.fillStyle = gr; g.fillRect(0, 0, w, w);
  }, { repeat: false });
  const cupDepth = canvasTex(128, 128, (g, w) => {
    const gr = g.createRadialGradient(w / 2, w / 2, 0, w / 2, w / 2, w / 2);
    gr.addColorStop(0, '#05010a'); gr.addColorStop(0.65, '#1a0b2e'); gr.addColorStop(0.92, '#3a2550'); gr.addColorStop(1, '#ffffff');
    g.fillStyle = gr; g.beginPath(); g.arc(w / 2, w / 2, w / 2, 0, Math.PI * 2); g.fill();
  }, { repeat: false });
  shared = { dimples, cloud, glow, cupDepth };
  return shared;
}

function themeTextures(theme) {
  const felt = canvasTex(256, 256, (g, w, h) => {
    g.fillStyle = theme.felt[0]; g.fillRect(0, 0, w, h);
    g.fillStyle = theme.felt[1]; g.fillRect(0, 0, w, h / 2);
    const r = rng(7);
    for (let i = 0; i < 2600; i++) {
      const x = r() * w, y = r() * h;
      g.strokeStyle = `rgba(${r() < 0.5 ? '255,255,255' : '0,50,25'},${0.05 + r() * 0.07})`;
      g.lineWidth = 1;
      g.beginPath(); g.moveTo(x, y); g.lineTo(x + (r() - 0.5) * 2, y - 2 - r() * 3); g.stroke();
    }
    // a soft edge at each cell so the grid reads like laid turf
    const e = g.createLinearGradient(0, 0, 0, 6); e.addColorStop(0, 'rgba(0,0,0,.08)'); e.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = e; g.fillRect(0, 0, w, 6);
  });
  const stripe = canvasTex(128, 128, (g, w, h) => {
    g.fillStyle = theme.wall; g.fillRect(0, 0, w, h);
    g.fillStyle = theme.wallStripe;
    for (let i = -2; i < 4; i++) {
      g.beginPath();
      g.moveTo(i * 64, h); g.lineTo(i * 64 + 30, h); g.lineTo(i * 64 + 30 + h, 0); g.lineTo(i * 64 + h, 0);
      g.fill();
    }
    const sh = g.createLinearGradient(0, 0, 0, h);
    sh.addColorStop(0, 'rgba(255,255,255,.25)'); sh.addColorStop(0.5, 'rgba(255,255,255,0)'); sh.addColorStop(1, 'rgba(0,0,0,.12)');
    g.fillStyle = sh; g.fillRect(0, 0, w, h);
  });
  // cake sides with icing dripping over the edge
  const drip = canvasTex(256, 256, (g, w, h) => {
    g.fillStyle = theme.side; g.fillRect(0, 0, w, h);
    const r = rng(5);
    for (let i = 0; i < 260; i++) { g.fillStyle = `rgba(255,255,255,${0.05 + r() * 0.08})`; g.beginPath(); g.arc(r() * w, 60 + r() * (h - 60), 1 + r() * 3, 0, Math.PI * 2); g.fill(); }
    g.fillStyle = theme.icing || '#fff7fb';
    g.fillRect(0, 0, w, 26);
    for (let x = 0; x < w; x += 18 + r() * 10) {
      const len = 20 + r() * 60, wd = 9 + r() * 8;
      g.beginPath(); g.roundRect(x, 10, wd, len, wd / 2); g.fill();
      g.beginPath(); g.arc(x + wd / 2, 10 + len, wd * 0.62, 0, Math.PI * 2); g.fill();
    }
    g.fillStyle = 'rgba(0,0,0,.08)'; g.fillRect(0, 26, w, 3);
  });
  const ground = canvasTex(256, 256, (g, w, h) => {
    g.fillStyle = theme.ground; g.fillRect(0, 0, w, h);
    const r = rng(3);
    for (let i = 0; i < 40; i++) {
      const gr = g.createRadialGradient(r() * w, r() * h, 0, r() * w, r() * h, 40);
      gr.addColorStop(0, 'rgba(255,255,255,.12)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = gr; g.fillRect(0, 0, w, h);
    }
    for (let i = 0; i < 170; i++) {
      g.save();
      g.translate(r() * w, r() * h); g.rotate(r() * Math.PI);
      g.fillStyle = CANDY[(r() * CANDY.length) | 0];
      g.beginPath(); g.roundRect(-5, -1.6, 10, 3.2, 1.6); g.fill();
      g.restore();
    }
  });
  ground.repeat.set(50, 50);
  const swirl = canvasTex(256, 256, (g, w) => {
    g.fillStyle = '#fff'; g.fillRect(0, 0, w, w);
    g.translate(w / 2, w / 2);
    for (let i = 0; i < 6; i++) {
      g.strokeStyle = CANDY[i % CANDY.length]; g.lineWidth = 18;
      g.beginPath();
      for (let a = 0; a < 14; a += 0.08) { const rad = a * 8.6; g.lineTo(Math.cos(a + i) * rad, Math.sin(a + i) * rad); }
      g.stroke();
    }
  }, { repeat: false });
  const chevrons = canvasTex(64, 64, (g, w, h) => {
    g.clearRect(0, 0, w, h);
    g.strokeStyle = '#fff6b0'; g.lineWidth = 10; g.lineCap = 'round'; g.lineJoin = 'round';
    g.beginPath(); g.moveTo(12, 44); g.lineTo(32, 22); g.lineTo(52, 44); g.stroke();
  });
  const choc = canvasTex(128, 64, (g, w, h) => {
    g.fillStyle = '#6b3a1f'; g.fillRect(0, 0, w, h);
    for (let x = 0; x < 4; x++) for (let y = 0; y < 2; y++) {
      g.fillStyle = '#82492a'; g.beginPath(); g.roundRect(x * 32 + 3, y * 32 + 3, 26, 26, 5); g.fill();
      g.fillStyle = 'rgba(255,255,255,.12)'; g.fillRect(x * 32 + 5, y * 32 + 5, 22, 4);
    }
  });
  const sprinkle = canvasTex(128, 128, (g, w, h) => {
    g.fillStyle = '#ff7fb0'; g.fillRect(0, 0, w, h);
    const r = rng(9);
    for (let i = 0; i < 70; i++) {
      g.save(); g.translate(r() * w, r() * h); g.rotate(r() * Math.PI);
      g.fillStyle = CANDY[(r() * 6) | 0]; g.beginPath(); g.roundRect(-5, -1.5, 10, 3, 1.5); g.fill(); g.restore();
    }
  });
  return { felt, stripe, drip, ground, swirl, chevrons, choc, sprinkle };
}

// ---------- the course ----------
export class CourseView {
  constructor(scene, theme) {
    this.scene = scene;
    this.theme = theme;
    this.tex = themeTextures(theme);
    this.shared = sharedTextures();
    this.group = new THREE.Group();
    scene.add(this.group);
    this.dynamic = [];
    this.bumpers = [];
    this.owned = [];
  }

  bumpAt(pos, t) {
    let best = null, bd = Infinity;
    for (const b of this.bumpers) { const d = Math.hypot(b.position.x - pos.x, b.position.z - pos.z); if (d < bd) { bd = d; best = b; } }
    if (best) best.userData.hitAt = t;
  }

  own(m) { this.owned.push(m); return m; }
  feltMat(w, d) { return this.own(new THREE.MeshStandardMaterial({ map: retex(this.tex.felt, w, d), roughness: 0.92 })); }
  dripMat(len, height) { return this.own(new THREE.MeshStandardMaterial({ map: retex(this.tex.drip, Math.max(1, Math.round(len / 1.6)), 1), roughness: 0.6 })); }

  build(layout, hole, index) {
    this.clear();
    const g = this.group;
    const add = (mesh, { cast = false, receive = true } = {}) => {
      mesh.castShadow = cast; mesh.receiveShadow = receive;
      mesh.updateMatrix(); mesh.matrixAutoUpdate = false;
      g.add(mesh);
      return mesh;
    };
    const bottom = mat(this.theme.side, { rough: 0.8 });

    for (const p of layout.pieces) {
      const [hx, hy, hz] = p.half;
      if (p.kind === 'floor' || p.kind === 'ramp' || p.kind === 'fill') {
        const top = p.kind === 'fill' ? bottom : this.feltMat(p.kind === 'floor' ? p.cells[0] : 1, p.kind === 'floor' ? p.cells[1] : 1);
        const sx = this.dripMat(hz * 2), sz = this.dripMat(hx * 2);
        const mesh = new THREE.Mesh(new THREE.BoxGeometry(hx * 2, hy * 2, hz * 2), [sx, sx, top, bottom, sz, sz]);
        mesh.position.set(...p.pos);
        if (p.quat) mesh.quaternion.set(...p.quat);
        add(mesh, { receive: true });
      } else if (p.kind === 'wall') {
        const top = p.pos[1] + hy, len = Math.max(hx, hz) * 2, along = hx > hz;
        // the candy-cane rail above the floor
        const railH = WALL_H - 0.02;
        const geo = new RoundedBoxGeometry(along ? len : WALL_T, railH + 0.12, along ? WALL_T : len, 3, 0.07);
        const m = this.own(new THREE.MeshStandardMaterial({ map: retex(this.tex.stripe, len / 0.9, 1), roughness: 0.32 }));
        if (!along) { m.map.rotation = Math.PI / 2; m.map.center.set(0.5, 0.5); }
        const rail = new THREE.Mesh(geo, m);
        rail.position.set(p.pos[0], top - railH / 2 - 0.06 + 0.06, p.pos[2]);
        add(rail, { cast: true });
        // cake below it
        const lowH = top - railH - 0.06 - (p.pos[1] - hy);
        if (lowH > 0.01) {
          const dm = this.dripMat(len);
          const low = new THREE.Mesh(new THREE.BoxGeometry(hx * 2, lowH, hz * 2), [dm, dm, bottom, bottom, dm, dm]);
          low.position.set(p.pos[0], p.pos[1] - hy + lowH / 2, p.pos[2]);
          add(low);
        }
        // candy knobs at both ends
        for (const s of [-1, 1]) {
          const kx = along ? p.pos[0] + s * (len / 2 - WALL_T / 2) : p.pos[0];
          const kz = along ? p.pos[2] : p.pos[2] + s * (len / 2 - WALL_T / 2);
          const color = CANDY[Math.abs(Math.round(kx * 3 + kz * 5)) % CANDY.length];
          const knob = new THREE.Mesh(new THREE.SphereGeometry(WALL_T * 0.78, 18, 12), mat(color, { rough: 0.2, clear: 1 }));
          knob.position.set(kx, top + 0.05, kz);
          add(knob, { cast: true });
        }
      }
    }

    // ground far below
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(500, 500), mat('#ffffff', { map: this.tex.ground, rough: 0.95 }));
    ground.rotation.x = -Math.PI / 2;
    ground.position.set(layout.bounds.w / 2, -1.02, layout.bounds.d / 2);
    add(ground);

    this.buildTee(layout);
    this.buildCup(layout, index);
    this.buildObstacles(hole, layout);
    this.buildDecor(layout, index);
  }

  buildTee(layout) {
    const [x, y, z] = layout.start;
    const tee = new THREE.Mesh(new RoundedBoxGeometry(1.7, 0.04, 0.9, 2, 0.02), mat(this.theme.trim, { rough: 0.7, key: 'tee' }));
    tee.position.set(x, y - BALL_R + 0.005, z);
    tee.receiveShadow = true;
    const inner = new THREE.Mesh(new RoundedBoxGeometry(1.54, 0.045, 0.74, 2, 0.02), mat(this.theme.felt[1], { rough: 0.95, key: 'tee2' }));
    inner.position.copy(tee.position);
    inner.receiveShadow = true;
    this.group.add(tee, inner);
  }

  buildCup(layout, index) {
    const [x, y, z] = layout.cup;
    const sh = this.shared;
    const hole = new THREE.Mesh(new THREE.CircleGeometry(CUP_R + 0.04, 40), new THREE.MeshBasicMaterial({ map: sh.cupDepth }));
    hole.rotation.x = -Math.PI / 2; hole.position.set(x, y + 0.004, z);
    const glow = new THREE.Mesh(new THREE.RingGeometry(CUP_R + 0.12, CUP_R + 0.2, 48), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.6, depthWrite: false }));
    glow.rotation.x = -Math.PI / 2; glow.position.set(x, y + 0.008, z);
    this.group.add(hole, glow);

    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.028, 1.9, 10), mat('#ffffff', { rough: 0.25, metal: 0.3 }));
    pole.position.set(x, y + 0.95, z); pole.castShadow = true;
    const topBall = new THREE.Mesh(new THREE.SphereGeometry(0.065, 14, 10), mat(this.theme.trim, { rough: 0.2, clear: 1 }));
    topBall.position.set(x, y + 1.92, z);
    this.group.add(pole, topBall);
    const flagTex = canvasTex(160, 100, (gg, w, h) => {
      gg.fillStyle = this.theme.trim; gg.fillRect(0, 0, w, h);
      gg.fillStyle = 'rgba(255,255,255,.18)'; gg.fillRect(0, 0, w, h / 2);
      gg.fillStyle = '#fff'; gg.font = '700 70px Fredoka, sans-serif'; gg.textAlign = 'center'; gg.textBaseline = 'middle';
      gg.fillText(String(index + 1), w / 2, h / 2 + 4);
    }, { repeat: false });
    this.own(flagTex);
    const flagGeo = new THREE.PlaneGeometry(0.7, 0.44, 10, 1);
    flagGeo.translate(0.35, 0, 0);
    const flag = new THREE.Mesh(flagGeo, this.own(new THREE.MeshStandardMaterial({ map: flagTex, side: THREE.DoubleSide, roughness: 0.7 })));
    flag.position.set(x + 0.025, y + 1.64, z); flag.castShadow = true;
    this.group.add(flag);
    const base = flagGeo.attributes.position.array.slice();
    this.dynamic.push((t) => {
      const pos = flagGeo.attributes.position;
      for (let i = 0; i < pos.count; i++) {
        const px = base[i * 3];
        pos.array[i * 3 + 2] = Math.sin(px * 8 - t * 5) * 0.06 * px * 2;
      }
      pos.needsUpdate = true;
      flag.rotation.y = Math.sin(t * 0.7) * 0.25;
      const k = (t * 0.7) % 1;
      glow.scale.setScalar(1 + k * 1.2);
      glow.material.opacity = 0.7 * (1 - k);
    });
    this.cupPos = new THREE.Vector3(x, y, z);
  }

  buildObstacles(hole, layout) {
    const grid = layout.grid;
    const yAt = (c, r) => {
      const cell = grid.at(Math.floor(c), Math.floor(r));
      return cell.kind === 'floor' || cell.kind === 'ramp' ? cell.h * LEVEL : 0;
    };
    for (const src of hole.obstacles || []) {
      const at = src.at ? [src.at[0] * CELL, src.at[1] * CELL] : null;
      if (src.type === 'bumper') {
        const r = src.r || 0.35, y = yAt(...src.at);
        const color = CANDY[(Math.abs(Math.round(at[0] * 7 + at[1] * 3))) % CANDY.length];
        const grp = new THREE.Group();
        const m = mat(color, { rough: 0.15, clear: 1, key: 'gum' });
        const body = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.94, r, 0.4, 32), m);
        body.position.y = 0.2;
        const cap = new THREE.Mesh(new THREE.SphereGeometry(r * 0.94, 32, 14, 0, Math.PI * 2, 0, Math.PI / 2), m);
        cap.scale.y = 0.8; cap.position.y = 0.4;
        const ring = new THREE.Mesh(new THREE.TorusGeometry(r * 1.02, 0.05, 10, 32), mat('#ffffff', { rough: 0.3 }));
        ring.rotation.x = Math.PI / 2; ring.position.y = 0.05;
        // sugar crystals
        const sugar = new THREE.InstancedMesh(new THREE.OctahedronGeometry(0.025), mat('#ffffff', { rough: 0.1, metal: 0.2 }), 40);
        const mm = new THREE.Matrix4(), rr = rng(Math.round(at[0] * 100 + at[1]));
        for (let i = 0; i < 40; i++) {
          const th = rr() * Math.PI * 2, ph = rr() * Math.PI / 2.2;
          mm.makeTranslation(Math.cos(th) * Math.sin(ph) * r * 0.93, 0.4 + Math.cos(ph) * r * 0.75, Math.sin(th) * Math.sin(ph) * r * 0.93);
          sugar.setMatrixAt(i, mm);
        }
        grp.add(body, cap, ring, sugar);
        grp.traverse((o) => { if (o.isMesh) o.castShadow = true; });
        grp.position.set(at[0], y, at[1]);
        this.group.add(grp);
        grp.userData.hitAt = -10;
        this.bumpers.push(grp);
        this.dynamic.push((t) => {
          const k = Math.max(0, 1 - (t - grp.userData.hitAt) * 3.5);
          const s = 1 + Math.sin(k * Math.PI * 3) * 0.16 * k;
          grp.scale.set(s, 2 - s, s);
        });
      } else if (src.type === 'block') {
        const [w, h, d] = src.size, y = yAt(...src.at);
        const m = new THREE.Mesh(new RoundedBoxGeometry(w, h, d, 2, Math.min(0.06, h / 2.2, Math.min(w, d) / 2.2)),
          this.own(new THREE.MeshStandardMaterial({ map: retex(this.tex.choc, Math.max(w, d) / 1.2, 1), roughness: 0.45 })));
        m.position.set(at[0], y + h / 2, at[1]); m.castShadow = true; m.receiveShadow = true;
        this.group.add(m);
      } else if (src.type === 'mover') {
        const [w, h, d] = src.size, y = yAt(...src.a);
        const grp = new THREE.Group();
        const bar = new THREE.Mesh(new RoundedBoxGeometry(w, h, d, 3, 0.08), this.own(new THREE.MeshStandardMaterial({ map: retex(this.tex.choc, w / 0.9, 1), roughness: 0.4 })));
        bar.castShadow = true;
        const wrap = new THREE.Mesh(new RoundedBoxGeometry(w * 0.45, h + 0.04, d + 0.04, 2, 0.06), mat(this.theme.trim, { rough: 0.35, metal: 0.2 }));
        wrap.position.x = w * 0.3;
        grp.add(bar, wrap);
        this.group.add(grp);
        const o = { ...src, _a: [src.a[0] * CELL, src.a[1] * CELL], _b: [src.b[0] * CELL, src.b[1] * CELL] };
        this.dynamic.push((t, simT) => { const p = obstaclePose(o, simT); grp.position.set(p.x, y + h / 2, p.z); });
      } else if (src.type === 'spinner') {
        const y = yAt(...src.at);
        const grp = new THREE.Group();
        const post = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.3, 1.1, 20), mat('#ffffff', { map: this.tex.stripe, rough: 0.3 }));
        post.position.y = 0.55; post.castShadow = true;
        const disc = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.6, 0.16, 40), [mat(CANDY[0], { rough: 0.2, clear: 1 }), mat('#ffffff', { map: this.tex.swirl, rough: 0.2 }), mat('#ffffff', { map: this.tex.swirl, rough: 0.2 })]);
        disc.rotation.x = Math.PI / 2; disc.position.y = 1.55; disc.castShadow = true;
        grp.add(post, disc);
        const arms = new THREE.Group();
        for (let i = 0; i < (src.arms || 2); i++) {
          const arm = new THREE.Mesh(new RoundedBoxGeometry(src.len, 0.4, 0.22, 2, 0.08), this.own(new THREE.MeshStandardMaterial({ map: retex(this.tex.stripe, src.len / 0.9, 1), roughness: 0.3 })));
          arm.rotation.y = (i * Math.PI) / (src.arms || 2);
          arm.castShadow = true;
          arms.add(arm);
          for (const s of [-1, 1]) {
            const end = new THREE.Mesh(new THREE.SphereGeometry(0.17, 16, 12), mat(CANDY[(i * 2 + (s > 0 ? 1 : 0)) % 6], { rough: 0.2, clear: 1 }));
            end.position.set(Math.cos(arm.rotation.y) * s * src.len / 2, 0, -Math.sin(arm.rotation.y) * s * src.len / 2);
            arms.add(end);
          }
        }
        arms.position.y = 0.2;
        grp.add(arms);
        grp.position.set(at[0], y, at[1]);
        this.group.add(grp);
        const o = { ...src, _at: at };
        this.dynamic.push((t, simT) => { const p = obstaclePose(o, simT); arms.rotation.y = p.angle; disc.rotation.z = -t * 0.8; });
      } else if (src.type === 'boost') {
        const [sw, sd] = src.span || [1, 1];
        const y = yAt(...src.at);
        const tex = this.own(retex(this.tex.chevrons, sw * 2, sd * 2));
        const pw = sw * CELL * 0.96, pd = sd * CELL * 0.96;
        const rot = { '^': 0, 'v': Math.PI, '<': Math.PI / 2, '>': -Math.PI / 2 }[src.dir];
        const under = new THREE.Mesh(new THREE.PlaneGeometry(pw, pd), new THREE.MeshBasicMaterial({ color: 0xff6a3d }));
        const pad = new THREE.Mesh(new THREE.PlaneGeometry(pw, pd), new THREE.MeshBasicMaterial({ map: tex, transparent: true, color: 0xffe14d, depthWrite: false }));
        for (const [m, dy] of [[under, 0.006], [pad, 0.012]]) { m.rotation.set(-Math.PI / 2, 0, rot); m.position.set(at[0], y + dy, at[1]); }
        this.group.add(under, pad);
        this.dynamic.push((t) => { tex.offset.y = -t * 1.8; under.material.color.setHSL(0.04 + Math.sin(t * 6) * 0.02, 1, 0.55); });
      }
    }
  }

  // candy world around the course, seeded per hole so it never reshuffles
  buildDecor(layout, index) {
    const r = rng(1000 + index * 17);
    const { w, d } = layout.bounds;
    const cx = w / 2, cz = d / 2;
    const deco = new THREE.Group();
    const spots = [];
    const free = (x, z, rad) => !spots.some(([sx, sz, sr]) => Math.hypot(sx - x, sz - z) < sr + rad);
    const inCourse = (x, z, m) => x > -m && x < w + m && z > -m && z < d + m;
    const place = (make, x, z, scale) => {
      const obj = make(r, this.tex);
      obj.position.set(x, -1.02, z);
      obj.rotation.y = r() * Math.PI * 2;
      obj.scale.multiplyScalar(scale);
      deco.add(obj);
    };
    // small treats hugging the course
    const small = [gumdrop, wrapped, cupcake, iceCream, gumdrop, lollipop];
    for (let i = 0, tries = 0; i < 34 && tries < 800; tries++) {
      const x = -6 + r() * (w + 12), z = -6 + r() * (d + 12);
      if (inCourse(x, z, 1.6) || !free(x, z, 1.1)) continue;
      spots.push([x, z, 1.1]);
      place(small[(r() * small.length) | 0], x, z, 0.7 + r() * 0.5);
      i++;
    }
    // big landmarks further out
    const big = [lollipop, candyCane, donut, cupcake, lollipop, iceCream, candyCane];
    for (let i = 0, tries = 0; i < 30 && tries < 800; tries++) {
      const a = r() * Math.PI * 2, rad = Math.hypot(w, d) / 2 + 5 + r() * 16;
      const x = cx + Math.cos(a) * rad, z = cz + Math.sin(a) * rad;
      if (inCourse(x, z, 3) || !free(x, z, 2.4)) continue;
      spots.push([x, z, 2.4]);
      place(big[(r() * big.length) | 0], x, z, 1.4 + r() * 1.2);
      i++;
    }
    // whipped-cream mountains on the horizon
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2 + r() * 0.3, rad = 55 + r() * 25;
      const m = mountain(r);
      m.position.set(cx + Math.cos(a) * rad, -1.5, cz + Math.sin(a) * rad);
      m.scale.multiplyScalar(1 + r() * 0.8);
      deco.add(m);
    }
    const merged = mergeStatic(deco);
    merged.traverse((m) => { if (m.isMesh) { m.receiveShadow = false; m.castShadow = false; } });
    this.group.add(merged);

    // clouds drifting in the sky
    for (let i = 0; i < 14; i++) {
      const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.shared.cloud, transparent: true, depthWrite: false, opacity: 0.85, fog: false }));
      const a = r() * Math.PI * 2, rad = 30 + r() * 40;
      s.position.set(cx + Math.cos(a) * rad, 14 + r() * 14, cz + Math.sin(a) * rad);
      const sc = 14 + r() * 16;
      s.scale.set(sc, sc / 2, 1);
      this.group.add(s);
      const speed = 0.3 + r() * 0.4, x0 = s.position.x;
      this.dynamic.push((t) => { s.position.x = x0 + Math.sin(t * 0.02 * speed) * 20; });
    }
    const sun = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.shared.glow, transparent: true, depthWrite: false, fog: false, color: 0xfff1c4 }));
    sun.position.set(cx + 60, 45, cz - 70); sun.scale.set(40, 40, 1);
    this.group.add(sun);
  }

  update(t, simT) { for (const f of this.dynamic) f(t, simT); }

  clear() {
    this.group.traverse((m) => {
      if (m.geometry) m.geometry.dispose();
      if (m.isSprite && !m.material.userData.shared) m.material.dispose();
    });
    for (const o of this.owned) { o.map?.dispose?.(); o.dispose(); }
    this.owned = [];
    this.group.clear();
    this.dynamic = [];
    this.bumpers = [];
  }
}

// ---------- candy scenery (shared materials so it all merges) ----------
const pick = (r, arr) => arr[(r() * arr.length) | 0];
function lollipop(r, tex) {
  const g = new THREE.Group();
  const h = 1.6 + r() * 1.6;
  const stick = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, h, 10), mat('#ffffff', { rough: 0.35 }));
  stick.position.y = h / 2;
  const rad = 0.6 + r() * 0.4;
  const swirl = mat('#ffffff', { map: tex.swirl, rough: 0.2 });
  const disc = new THREE.Mesh(new THREE.CylinderGeometry(rad, rad, 0.24, 36), [mat(pick(r, CANDY), { rough: 0.2 }), swirl, swirl]);
  disc.rotation.x = Math.PI / 2;
  disc.position.y = h + rad * 0.8;
  const bow = new THREE.Mesh(new THREE.TorusGeometry(0.12, 0.05, 8, 16), mat(pick(r, CANDY), { rough: 0.4 }));
  bow.position.y = h - 0.05;
  bow.rotation.x = Math.PI / 2;
  g.add(stick, disc, bow);
  return g;
}
function gumdrop(r) {
  const rad = 0.45 + r() * 0.4;
  const m = new THREE.Mesh(new THREE.SphereGeometry(rad, 24, 14, 0, Math.PI * 2, 0, Math.PI * 0.55), mat(pick(r, CANDY), { rough: 0.18 }));
  m.scale.y = 1.2;
  const g = new THREE.Group(); g.add(m);
  return g;
}
function candyCane(r, tex) {
  const h = 2.4 + r() * 2;
  const pts = [new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, h, 0)];
  for (let a = 0; a <= Math.PI; a += Math.PI / 10) pts.push(new THREE.Vector3(0.55 - Math.cos(a) * 0.55, h + Math.sin(a) * 0.6, 0));
  const curve = new THREE.CatmullRomCurve3(pts);
  const m = new THREE.Mesh(new THREE.TubeGeometry(curve, 48, 0.18, 12), mat('#ffffff', { map: tex.stripe, rough: 0.25 }));
  const g = new THREE.Group(); g.add(m);
  return g;
}
function donut(r, tex) {
  const R = 0.7 + r() * 0.4;
  const tilt = new THREE.Group();
  const dough = new THREE.Mesh(new THREE.TorusGeometry(R, R * 0.42, 16, 36), mat('#e7b170', { rough: 0.75 }));
  const icing = new THREE.Mesh(new THREE.TorusGeometry(R, R * 0.44, 16, 36), mat('#ffffff', { map: tex.sprinkle, rough: 0.35 }));
  icing.scale.set(1, 1, 0.55); icing.position.z = R * 0.14;
  tilt.add(dough, icing);
  tilt.rotation.x = -Math.PI / 2 + (r() - 0.5) * 0.4;
  tilt.position.y = R * 0.42;
  const g = new THREE.Group(); g.add(tilt);
  return g;
}
function wrapped(r) {
  const color = pick(r, CANDY);
  const g = new THREE.Group();
  const m = mat(color, { rough: 0.2, metal: 0.25 });
  const body = new THREE.Mesh(new THREE.SphereGeometry(0.5, 20, 14), m);
  body.scale.set(1.25, 0.85, 0.85);
  const endGeo = new THREE.ConeGeometry(0.38, 0.5, 12);
  const a = new THREE.Mesh(endGeo, m); a.rotation.z = Math.PI / 2; a.position.x = 0.8;
  const b = new THREE.Mesh(endGeo, m); b.rotation.z = -Math.PI / 2; b.position.x = -0.8;
  const stripe = new THREE.Mesh(new THREE.TorusGeometry(0.43, 0.06, 8, 24), mat('#ffffff', { rough: 0.3 }));
  stripe.rotation.y = Math.PI / 2;
  g.add(body, a, b, stripe);
  g.position.y = 0.42;
  const outer = new THREE.Group(); outer.add(g);
  return outer;
}
function cupcake(r) {
  const g = new THREE.Group();
  const liner = new THREE.Mesh(new THREE.CylinderGeometry(0.62, 0.45, 0.6, 16), mat(pick(r, PASTEL), { rough: 0.6 }));
  liner.position.y = 0.3;
  g.add(liner);
  const frost = pick(r, ['#fff4fa', '#ff9ec4', '#a8e4ff', '#c9b6ff', '#7a4a2a']);
  for (let i = 0; i < 4; i++) {
    const rad = 0.6 - i * 0.13;
    const t = new THREE.Mesh(new THREE.TorusGeometry(rad, 0.16 - i * 0.02, 10, 24), mat(frost, { rough: 0.45 }));
    t.rotation.x = Math.PI / 2; t.position.y = 0.66 + i * 0.16;
    g.add(t);
  }
  const top = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.3, 12), mat(frost, { rough: 0.45 }));
  top.position.y = 1.25;
  const cherry = new THREE.Mesh(new THREE.SphereGeometry(0.14, 14, 10), mat('#e8143c', { rough: 0.15 }));
  cherry.position.y = 1.45;
  g.add(top, cherry);
  return g;
}
function iceCream(r) {
  const g = new THREE.Group();
  const cone = new THREE.Mesh(new THREE.ConeGeometry(0.4, 1.2, 14), mat('#e2a85f', { rough: 0.8 }));
  cone.rotation.x = Math.PI; cone.position.y = 0.6;
  g.add(cone);
  for (let i = 0; i < 2; i++) {
    const s = new THREE.Mesh(new THREE.SphereGeometry(0.42 - i * 0.05, 18, 12), mat(pick(r, PASTEL), { rough: 0.5 }));
    s.position.y = 1.3 + i * 0.5;
    g.add(s);
  }
  const cherry = new THREE.Mesh(new THREE.SphereGeometry(0.11, 12, 8), mat('#e8143c', { rough: 0.15 }));
  cherry.position.y = 2.18;
  g.add(cherry);
  return g;
}
function mountain(r) {
  const g = new THREE.Group();
  const h = 12 + r() * 14, rad = 10 + r() * 8;
  const base = new THREE.Mesh(new THREE.ConeGeometry(rad, h, 20), mat(pick(r, PASTEL), { rough: 0.9 }));
  base.position.y = h / 2;
  const cap = new THREE.Mesh(new THREE.ConeGeometry(rad * 0.42, h * 0.42, 20), mat('#fffafc', { rough: 0.8 }));
  cap.position.y = h - h * 0.21 + 0.05;
  g.add(base, cap);
  return g;
}

// ---------- balls ----------
export const HATS = ['none', 'party', 'tophat', 'crown', 'cap', 'cowboy'];
function makeHat(kind, color) {
  const g = new THREE.Group();
  const s = BALL_R / 0.14;
  if (kind === 'party') {
    const m = new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.24, 20), mat(color === '#ffcc33' ? '#ff4f8b' : '#ffcc33', { rough: 0.35 }));
    m.position.y = 0.12;
    const pom = new THREE.Mesh(new THREE.SphereGeometry(0.035, 12, 8), mat('#ffffff'));
    pom.position.y = 0.25;
    g.add(m, pom);
  } else if (kind === 'tophat') {
    const m = mat('#1d1530', { rough: 0.45 });
    const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.13, 0.02, 24), m);
    const top = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.085, 0.18, 24), m);
    top.position.y = 0.09;
    const band = new THREE.Mesh(new THREE.CylinderGeometry(0.087, 0.087, 0.035, 24), mat('#ff4f8b'));
    band.position.y = 0.03;
    g.add(brim, top, band);
  } else if (kind === 'crown') {
    const m = mat('#ffcc33', { rough: 0.2, metal: 0.8 });
    const ring = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.07, 24, 1, true), m.clone());
    ring.material.side = THREE.DoubleSide;
    ring.position.y = 0.035;
    g.add(ring);
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2;
      const spike = new THREE.Mesh(new THREE.ConeGeometry(0.025, 0.07, 6), m);
      spike.position.set(Math.cos(a) * 0.095, 0.1, Math.sin(a) * 0.095);
      const gem = new THREE.Mesh(new THREE.SphereGeometry(0.016, 8, 6), mat(CANDY[i], { rough: 0.1, clear: 1 }));
      gem.position.set(Math.cos(a) * 0.1, 0.035, Math.sin(a) * 0.1);
      g.add(spike, gem);
    }
  } else if (kind === 'cap') {
    const m = mat(color === '#4fc3ff' ? '#ff8a3d' : '#4fc3ff', { rough: 0.6 });
    const dome = new THREE.Mesh(new THREE.SphereGeometry(0.115, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2), m);
    const bill = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.015, 20, 1, false, -Math.PI / 2, Math.PI), m);
    bill.position.set(0, 0.005, 0.07);
    const button = new THREE.Mesh(new THREE.SphereGeometry(0.018, 8, 6), mat('#ffffff'));
    button.position.y = 0.115;
    g.add(dome, bill, button);
  } else if (kind === 'cowboy') {
    const m = mat('#9a5b2e', { rough: 0.7 });
    const brim = new THREE.Mesh(new THREE.TorusGeometry(0.12, 0.03, 8, 24), m);
    brim.rotation.x = Math.PI / 2; brim.scale.set(1, 1.25, 0.6);
    const disc = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.13, 0.015, 24), m);
    const crown = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.085, 0.13, 20), m);
    crown.position.y = 0.07;
    const band = new THREE.Mesh(new THREE.CylinderGeometry(0.087, 0.087, 0.025, 20), mat('#1d1530'));
    band.position.y = 0.025;
    g.add(brim, disc, crown, band);
  }
  g.scale.setScalar(s);
  g.traverse((m) => { if (m.isMesh) m.castShadow = true; });
  return g;
}

function nameTag(text, color) {
  const tex = canvasTex(256, 72, (g, w, h) => {
    g.font = '600 38px Fredoka, sans-serif';
    g.direction = 'rtl'; g.textAlign = 'center'; g.textBaseline = 'middle';
    const tw = Math.min(w - 8, g.measureText(text).width + 40);
    g.fillStyle = 'rgba(8,18,44,.82)';
    g.beginPath(); g.roundRect((w - tw) / 2, 8, tw, h - 16, 24); g.fill();
    g.fillStyle = color; g.beginPath(); g.arc((w - tw) / 2 + 22, h / 2, 9, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#fff'; g.fillText(text, w / 2 + 8, h / 2 + 2);
  }, { repeat: false });
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthTest: false, transparent: true }));
  s.scale.set(0.56, 0.16, 1);
  s.renderOrder = 10;
  return s;
}

export class BallView {
  constructor(scene, { color, hat, name, bot }, index = 0) {
    this.scene = scene;
    this.mine = !bot;
    this.color = color;
    this.root = new THREE.Group();
    const sh = sharedTextures();
    this.ballMat = new THREE.MeshPhysicalMaterial({
      color, roughness: 0.35, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.08,
      normalMap: sh.dimples, normalScale: new THREE.Vector2(0.55, 0.55),
    });
    this.ball = new THREE.Mesh(new THREE.SphereGeometry(BALL_R, 48, 32), this.ballMat);
    this.ball.castShadow = true;
    this.hat = makeHat(hat, color);
    this.hat.position.y = BALL_R * 0.86;
    this.tag = nameTag(name, color);
    this.tag.position.y = BALL_R + 0.26 + index * 0.13;
    this.tag.visible = !this.mine;
    // pulsing ring under your ball when it's ready to putt
    this.ring = new THREE.Mesh(new THREE.RingGeometry(BALL_R * 1.5, BALL_R * 1.85, 40), new THREE.MeshBasicMaterial({ color: 0xb6ff3b, transparent: true, depthWrite: false }));
    this.ring.rotation.x = -Math.PI / 2;
    this.ring.position.y = -BALL_R + 0.012;
    this.ring.visible = false;
    this.root.add(this.ball, this.hat, this.tag, this.ring);
    scene.add(this.root);

    // a ribbon trail behind the rolling ball
    this.trailN = 26;
    this.trailPts = [];
    const tg = new THREE.BufferGeometry();
    tg.setAttribute('position', new THREE.BufferAttribute(new Float32Array(this.trailN * 2 * 3), 3));
    tg.setAttribute('color', new THREE.BufferAttribute(new Float32Array(this.trailN * 2 * 3), 3));
    const idx = [];
    for (let i = 0; i < this.trailN - 1; i++) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
    tg.setIndex(idx);
    this.trail = new THREE.Mesh(tg, new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
    this.trail.frustumCulled = false;
    scene.add(this.trail);
    this.trailColor = new THREE.Color(color === '#1d1530' ? '#8d6bff' : color);

    this.prev = null;
    this.sinkT = null;
  }

  sync(body, t, ready) {
    const p = body.position;
    if (this.prev) {
      const dx = p.x - this.prev.x, dz = p.z - this.prev.z, d = Math.hypot(dx, dz);
      if (d > 1e-5) {
        const axis = new THREE.Vector3(dz, 0, -dx).normalize();
        this.ball.quaternion.premultiply(new THREE.Quaternion().setFromAxisAngle(axis, d / BALL_R));
      }
    }
    this.prev = { x: p.x, z: p.z };
    this.root.position.set(p.x, p.y, p.z);
    this.ring.visible = !!ready;
    if (ready) { const k = 1 + Math.sin(t * 5) * 0.12; this.ring.scale.set(k, k, k); this.ring.material.opacity = 0.75 + Math.sin(t * 5) * 0.2; }
    this.updateTrail(p, body.velocity.length());
  }

  updateTrail(p, speed) {
    const pts = this.trailPts;
    if (speed > 0.3) pts.unshift(new THREE.Vector3(p.x, p.y, p.z));
    else if (pts.length) pts.pop();
    if (pts.length > this.trailN) pts.length = this.trailN;
    const pos = this.trail.geometry.attributes.position, col = this.trail.geometry.attributes.color;
    for (let i = 0; i < this.trailN; i++) {
      const a = pts[Math.min(i, pts.length - 1)] || p, b = pts[Math.min(i + 1, pts.length - 1)] || a;
      let dx = a.x - b.x, dz = a.z - b.z; const l = Math.hypot(dx, dz) || 1; dx /= l; dz /= l;
      const k = pts.length ? 1 - i / this.trailN : 0, wdt = BALL_R * 0.85 * k;
      pos.setXYZ(i * 2, a.x - dz * wdt, a.y - BALL_R * 0.4, a.z + dx * wdt);
      pos.setXYZ(i * 2 + 1, a.x + dz * wdt, a.y - BALL_R * 0.4, a.z - dx * wdt);
      const c = this.trailColor, f = k * k * 0.75;
      col.setXYZ(i * 2, c.r * f, c.g * f, c.b * f); col.setXYZ(i * 2 + 1, c.r * f, c.g * f, c.b * f);
    }
    pos.needsUpdate = true; col.needsUpdate = true;
  }

  sink(cup, t) {
    if (this.sinkT == null) this.sinkT = t;
    const k = Math.min(1, (t - this.sinkT) / 0.35);
    this.root.position.lerp(new THREE.Vector3(cup.x, cup.y + BALL_R - k * 0.45, cup.z), 0.35);
    this.ball.scale.setScalar(1 - k * 0.6);
    this.hat.visible = k < 0.6;
    this.tag.visible = false;
    this.ring.visible = false;
    this.updateTrail(this.root.position, 0);
  }
  show() { this.root.visible = true; this.ball.scale.setScalar(1); this.hat.visible = true; this.tag.visible = !this.mine; this.sinkT = null; this.prev = null; this.trailPts = []; }
  dispose() {
    this.scene.remove(this.root, this.trail);
    this.trail.geometry.dispose(); this.trail.material.dispose();
    this.root.traverse((m) => { m.geometry?.dispose(); if (m.material && !m.material.userData?.shared) { m.material.map?.dispose(); m.material.dispose(); } });
  }
}

// ---------- slingshot aim arrow ----------
export class AimView {
  constructor(scene) {
    this.group = new THREE.Group();
    const shape = new THREE.Shape();
    shape.moveTo(-0.11, 0); shape.lineTo(0.11, 0); shape.lineTo(0.11, 0.72); shape.lineTo(0.27, 0.72); shape.lineTo(0, 1); shape.lineTo(-0.27, 0.72); shape.lineTo(-0.11, 0.72); shape.closePath();
    const geo = new THREE.ShapeGeometry(shape).rotateX(-Math.PI / 2);
    this.arrowMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.95, depthWrite: false });
    this.arrow = new THREE.Mesh(geo, this.arrowMat);
    this.arrow.renderOrder = 6;
    const outline = new THREE.Mesh(geo.clone().scale(1.25, 1, 1.08).translate(0, -0.001, 0.02), new THREE.MeshBasicMaterial({ color: 0x0b1a3c, transparent: true, opacity: 0.55, depthWrite: false }));
    outline.renderOrder = 5;
    this.arrowGroup = new THREE.Group();
    this.arrowGroup.add(outline, this.arrow);
    this.n = 14;
    this.dots = new THREE.InstancedMesh(new THREE.CircleGeometry(0.05, 12).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.6, depthWrite: false }), this.n);
    this.dots.frustumCulled = false;
    this.group.add(this.arrowGroup, this.dots);
    scene.add(this.group);
    this.m = new THREE.Matrix4();
    this.hide();
  }
  // power 0 shows only the faint guide; while pulling the arrow grows and warms up
  show(pos, angle, power, t, pulling) {
    this.group.visible = true;
    const y = pos.y - BALL_R + 0.05;
    this.group.position.set(pos.x, y, pos.z);
    // the group's -z axis points along the putt
    this.group.rotation.y = -angle;
    this.arrowGroup.visible = pulling;
    const len = 0.5 + power * 3.2;
    this.arrowGroup.scale.set(1 + power * 0.6, 1, len);
    this.arrowGroup.position.set(0, 0, -BALL_R * 1.3);
    this.arrowMat.color.setHSL(0.3 - power * 0.3, 1, 0.55);
    for (let i = 0; i < this.n; i++) {
      const k = (i + ((t * 1.8) % 1)) / this.n;
      const dist = (pulling ? 0.6 + len : 0.45) + k * (pulling ? 3 : 2.2);
      const s = (1 - k) * (pulling ? 1 : 0.8);
      this.m.makeScale(s, s, s).setPosition(0, 0.004, -dist);
      this.dots.setMatrixAt(i, this.m);
    }
    this.dots.instanceMatrix.needsUpdate = true;
  }
  hide() { this.group.visible = false; }
}

// ---------- confetti ----------
export class Confetti {
  constructor(scene) {
    this.n = 160;
    this.mesh = new THREE.InstancedMesh(new THREE.PlaneGeometry(0.08, 0.14), new THREE.MeshBasicMaterial({ side: THREE.DoubleSide }), this.n);
    this.mesh.frustumCulled = false;
    this.mesh.visible = false;
    for (let i = 0; i < this.n; i++) this.mesh.setColorAt(i, new THREE.Color(CANDY[i % CANDY.length]));
    scene.add(this.mesh);
    this.parts = [];
    this.m = new THREE.Matrix4(); this.q = new THREE.Quaternion(); this.e = new THREE.Euler(); this.s = new THREE.Vector3();
  }
  burst(pos, big = false) {
    this.parts = Array.from({ length: big ? this.n : 60 }, () => ({
      p: pos.clone(),
      v: new THREE.Vector3((Math.random() - 0.5) * 5, 3 + Math.random() * (big ? 6 : 3.5), (Math.random() - 0.5) * 5),
      r: new THREE.Vector3(Math.random() * 6, Math.random() * 6, Math.random() * 6),
      life: 1.8 + Math.random(),
    }));
    this.mesh.count = this.parts.length;
    this.mesh.visible = true;
  }
  update(dt) {
    if (!this.mesh.visible) return;
    let alive = 0;
    this.parts.forEach((pt, i) => {
      pt.life -= dt;
      if (pt.life > 0) alive++;
      pt.v.y -= 7 * dt; pt.v.multiplyScalar(0.985);
      pt.p.addScaledVector(pt.v, dt);
      this.e.set(pt.r.x * pt.life * 3, pt.r.y * pt.life * 3, pt.r.z);
      const sc = pt.life > 0 ? 1 : 0;
      this.m.compose(pt.p, this.q.setFromEuler(this.e), this.s.set(sc, sc, sc));
      this.mesh.setMatrixAt(i, this.m);
    });
    this.mesh.instanceMatrix.needsUpdate = true;
    if (!alive) this.mesh.visible = false;
  }
}

// ---------- scene, lights, sky ----------
export function createStage(canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;
  const scene = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = 0.55;
  const camera = new THREE.PerspectiveCamera(52, 1, 0.05, 260);
  const hemi = new THREE.HemisphereLight(0xffffff, 0xffc4dc, 0.9);
  const sun = new THREE.DirectionalLight(0xfff1dc, 2.4);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.bias = -0.0005;
  sun.shadow.normalBias = 0.02;
  sun.shadow.radius = 3;
  scene.add(hemi, sun, sun.target);
  return { renderer, scene, camera, sun };
}

export function applyTheme(stage, theme, layout) {
  const { scene, sun } = stage;
  const sky = canvasTex(4, 512, (g, w, h) => {
    const gr = g.createLinearGradient(0, 0, 0, h);
    gr.addColorStop(0, theme.sky[0]); gr.addColorStop(0.55, theme.sky[1]); gr.addColorStop(1, theme.fog);
    g.fillStyle = gr; g.fillRect(0, 0, w, h);
  }, { repeat: false });
  scene.background?.dispose?.();
  scene.background = sky;
  scene.fog = new THREE.Fog(theme.fog, 40, 120);
  const { w, d } = layout.bounds;
  const cx = w / 2, cz = d / 2, rad = Math.hypot(w, d) / 2 + 2;
  sun.position.set(cx + 9, 20, cz + 6);
  sun.target.position.set(cx, 0, cz);
  const sc = sun.shadow.camera;
  sc.left = -rad; sc.right = rad; sc.top = rad; sc.bottom = -rad; sc.near = 1; sc.far = 60;
  sc.updateProjectionMatrix();
}
