// Everything you see: the course, its candy scenery, balls, hats, the cup and effects.
import * as THREE from '../vendor/three.module.js';
import { CELL, LEVEL, BALL_R, CUP_R, WALL_H, obstaclePose } from './physics.js';

const CANDY = ['#ff4f8b', '#ffcc33', '#4fc3ff', '#8d6bff', '#2ed47a', '#ff8a3d'];

// ---------- small helpers ----------
function rng(seed) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function canvasTex(w, h, draw, repeat = true) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 4;
  return t;
}
const std = (color, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.55, metalness: 0, ...extra });

// ---------- textures, made once per theme ----------
function themeTextures(theme) {
  const felt = canvasTex(128, 128, (g, w, h) => {
    g.fillStyle = theme.felt[0]; g.fillRect(0, 0, w, h);
    g.fillStyle = theme.felt[1]; g.fillRect(0, 0, w, h / 2);
    const r = rng(7);
    for (let i = 0; i < 900; i++) {
      g.fillStyle = `rgba(${r() < 0.5 ? '255,255,255' : '0,40,20'},${0.05 + r() * 0.05})`;
      g.fillRect(r() * w, r() * h, 1.5, 1.5);
    }
  });
  const stripe = canvasTex(128, 128, (g, w, h) => {
    g.fillStyle = theme.wall; g.fillRect(0, 0, w, h);
    g.fillStyle = theme.wallStripe;
    for (let i = -2; i < 4; i++) {
      g.beginPath();
      g.moveTo(i * 64, h); g.lineTo(i * 64 + 32, h); g.lineTo(i * 64 + 32 + h, 0); g.lineTo(i * 64 + h, 0);
      g.fill();
    }
  });
  const ground = canvasTex(256, 256, (g, w, h) => {
    g.fillStyle = theme.ground; g.fillRect(0, 0, w, h);
    const r = rng(3);
    for (let i = 0; i < 160; i++) {
      g.save();
      g.translate(r() * w, r() * h); g.rotate(r() * Math.PI);
      g.fillStyle = CANDY[(r() * CANDY.length) | 0];
      g.beginPath(); g.roundRect(-5, -1.6, 10, 3.2, 1.6); g.fill();
      g.restore();
    }
  });
  ground.repeat.set(40, 40);
  const swirl = canvasTex(128, 128, (g, w) => {
    g.fillStyle = '#fff'; g.fillRect(0, 0, w, w);
    g.translate(w / 2, w / 2);
    for (let i = 0; i < 6; i++) {
      g.strokeStyle = CANDY[i % CANDY.length]; g.lineWidth = 10;
      g.beginPath();
      for (let a = 0; a < 14; a += 0.1) { const rad = a * 4.2; g.lineTo(Math.cos(a + i) * rad, Math.sin(a + i) * rad); }
      g.stroke();
    }
  }, false);
  const chevrons = canvasTex(64, 64, (g, w, h) => {
    g.clearRect(0, 0, w, h);
    g.strokeStyle = '#fff4a8'; g.lineWidth = 9; g.lineCap = 'round'; g.lineJoin = 'round';
    g.beginPath(); g.moveTo(12, 44); g.lineTo(32, 22); g.lineTo(52, 44); g.stroke();
  });
  return { felt, stripe, ground, swirl, chevrons };
}

// ---------- the course ----------
export class CourseView {
  constructor(scene, theme) {
    this.scene = scene;
    this.theme = theme;
    this.tex = themeTextures(theme);
    this.mats = {
      side: std(theme.side, { roughness: 0.8 }),
      trim: std(theme.trim),
      wall: std(0xffffff, { map: this.tex.stripe, roughness: 0.4 }),
      ground: std(0xffffff, { map: this.tex.ground, roughness: 0.95 }),
    };
    this.group = new THREE.Group();
    scene.add(this.group);
    this.dynamic = [];
    this.bumpers = [];
  }

  bumpAt(pos, t) {
    let best = null, bd = Infinity;
    for (const b of this.bumpers) { const d = Math.hypot(b.position.x - pos.x, b.position.z - pos.z); if (d < bd) { bd = d; best = b; } }
    if (best) best.userData.hitAt = t;
  }

  feltMat(w, d) {
    const map = this.tex.felt.clone();
    map.needsUpdate = true;
    map.repeat.set(w, d);
    return std(0xffffff, { map, roughness: 0.9 });
  }

  build(layout, hole, index) {
    this.clear();
    const g = this.group;
    const add = (mesh, { cast = false, receive = true, dynamic = false } = {}) => {
      mesh.castShadow = cast; mesh.receiveShadow = receive;
      if (!dynamic) { mesh.updateMatrix(); mesh.matrixAutoUpdate = false; }
      g.add(mesh);
      return mesh;
    };

    for (const p of layout.pieces) {
      let half = p.half, pos = p.pos;
      if (p.kind === 'wall') {
        const top = p.pos[1] + p.half[1];
        half = [p.half[0], WALL_H / 2 + 0.05, p.half[2]];
        pos = [p.pos[0], top - half[1], p.pos[2]];
        // the part below the floor line, in the course side colour
        const lowH = (top - WALL_H - 0.1) - (p.pos[1] - p.half[1]);
        if (lowH > 0.01) {
          const low = new THREE.Mesh(new THREE.BoxGeometry(p.half[0] * 2, lowH, p.half[2] * 2), this.mats.side);
          low.position.set(p.pos[0], p.pos[1] - p.half[1] + lowH / 2, p.pos[2]);
          add(low);
        }
      }
      const geo = new THREE.BoxGeometry(half[0] * 2, half[1] * 2, half[2] * 2);
      let mat;
      if (p.kind === 'floor') {
        const top = this.feltMat(p.cells[0], p.cells[1]);
        mat = [this.mats.side, this.mats.side, top, this.mats.side, this.mats.side, this.mats.side];
      } else if (p.kind === 'ramp') {
        const top = this.feltMat(p.dir[0] ? 1.03 : 1, p.dir[1] ? 1.03 : 1);
        mat = [this.mats.side, this.mats.side, top, this.mats.side, this.mats.side, this.mats.side];
      } else if (p.kind === 'wall') {
        const len = Math.max(p.half[0], p.half[2]) * 2;
        const m = this.mats.wall.clone();
        m.map = this.tex.stripe.clone(); m.map.needsUpdate = true;
        m.map.repeat.set(p.half[0] > p.half[2] ? len / 0.9 : 1, 1);
        if (p.half[2] > p.half[0]) { m.map.repeat.set(len / 0.9, 1); m.map.rotation = Math.PI / 2; m.map.center.set(0.5, 0.5); }
        mat = m;
      } else mat = this.mats.side;
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(...pos);
      if (p.quat) mesh.quaternion.set(...p.quat);
      add(mesh, { cast: p.kind === 'wall', receive: true });
    }

    // ground far below, sprinkled
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(400, 400), this.mats.ground);
    ground.rotation.x = -Math.PI / 2;
    ground.position.set(layout.bounds.w / 2, -1.02, layout.bounds.d / 2);
    add(ground);

    this.buildCup(layout, index);
    this.buildObstacles(hole, layout);
    this.buildDecor(layout, index);
  }

  buildCup(layout, index) {
    const [x, y, z] = layout.cup;
    const hole = new THREE.Mesh(new THREE.CircleGeometry(CUP_R, 32), new THREE.MeshBasicMaterial({ color: 0x14081f }));
    hole.rotation.x = -Math.PI / 2; hole.position.set(x, y + 0.004, z);
    this.group.add(hole);
    const rim = new THREE.Mesh(new THREE.RingGeometry(CUP_R, CUP_R + 0.045, 32), new THREE.MeshBasicMaterial({ color: 0xffffff }));
    rim.rotation.x = -Math.PI / 2; rim.position.set(x, y + 0.006, z);
    this.group.add(rim);
    // pulsing target ring so the cup is easy to find from far away
    const glow = new THREE.Mesh(new THREE.RingGeometry(CUP_R + 0.1, CUP_R + 0.16, 40), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.6 }));
    glow.rotation.x = -Math.PI / 2; glow.position.set(x, y + 0.008, z);
    this.group.add(glow);

    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 1.5, 8), std(0xffffff, { roughness: 0.3 }));
    pole.position.set(x, y + 0.75, z); pole.castShadow = true;
    this.group.add(pole);
    const flagTex = canvasTex(128, 80, (gg, w, h) => {
      gg.fillStyle = this.theme.trim; gg.fillRect(0, 0, w, h);
      gg.fillStyle = '#fff'; gg.font = '900 56px Rubik, sans-serif'; gg.textAlign = 'center'; gg.textBaseline = 'middle';
      gg.fillText(String(index + 1), w / 2, h / 2 + 3);
    }, false);
    const flagGeo = new THREE.PlaneGeometry(0.55, 0.34, 8, 1);
    flagGeo.translate(0.275, 0, 0);
    const flag = new THREE.Mesh(flagGeo, new THREE.MeshStandardMaterial({ map: flagTex, side: THREE.DoubleSide, roughness: 0.7 }));
    flag.position.set(x + 0.02, y + 1.32, z); flag.castShadow = true;
    this.group.add(flag);
    const base = flagGeo.attributes.position.array.slice();
    this.dynamic.push((t) => {
      const pos = flagGeo.attributes.position;
      for (let i = 0; i < pos.count; i++) {
        const px = base[i * 3];
        pos.array[i * 3 + 2] = Math.sin(px * 9 - t * 5) * 0.05 * px * 2;
      }
      pos.needsUpdate = true;
      const k = (t * 0.8) % 1;
      glow.scale.setScalar(1 + k * 0.8);
      glow.material.opacity = 0.6 * (1 - k);
    });
    this.cupPos = new THREE.Vector3(x, y, z);
  }

  buildObstacles(hole, layout) {
    const sim = { grid: layout.grid };
    for (const src of hole.obstacles || []) {
      const at = src.at ? [src.at[0] * CELL, src.at[1] * CELL] : null;
      const yAt = (c, r) => {
        const cell = sim.grid.at(Math.floor(c), Math.floor(r));
        if (cell.kind === 'floor') return cell.h * LEVEL;
        if (cell.kind === 'ramp') return cell.h * LEVEL;
        return 0;
      };
      if (src.type === 'bumper') {
        const r = src.r || 0.35, y = yAt(...src.at);
        const color = CANDY[(Math.abs(Math.round(at[0] * 7 + at[1] * 3))) % CANDY.length];
        const grp = new THREE.Group();
        const mat = std(color, { roughness: 0.25 });
        const body = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.92, r, 0.42, 24), mat);
        body.position.y = 0.21;
        const cap = new THREE.Mesh(new THREE.SphereGeometry(r * 0.92, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), mat);
        cap.scale.y = 0.75; cap.position.y = 0.42;
        const shine = new THREE.Mesh(new THREE.SphereGeometry(r * 0.25, 10, 8), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.55 }));
        shine.position.set(-r * 0.35, 0.62, -r * 0.3);
        grp.add(body, cap, shine);
        grp.traverse((m) => { m.castShadow = true; });
        grp.position.set(at[0], y, at[1]);
        this.group.add(grp);
        // squash when hit
        grp.userData.hitAt = -10;
        this.bumpers.push(grp);
        this.dynamic.push((t) => {
          const k = Math.max(0, 1 - (t - grp.userData.hitAt) * 4);
          const s = 1 + Math.sin(k * Math.PI * 3) * 0.12 * k;
          grp.scale.set(s, 2 - s, s);
        });
      } else if (src.type === 'block') {
        const [w, h, d] = src.size, y = yAt(...src.at);
        const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), this.mats.wall);
        m.position.set(at[0], y + h / 2, at[1]); m.castShadow = true; m.receiveShadow = true;
        this.group.add(m);
      } else if (src.type === 'mover') {
        const [w, h, d] = src.size, y = yAt(...src.a);
        const grp = new THREE.Group();
        const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), this.mats.wall);
        m.castShadow = true;
        const capM = new THREE.Mesh(new THREE.BoxGeometry(w + 0.06, 0.08, d + 0.06), this.mats.trim);
        capM.position.y = h / 2;
        grp.add(m, capM);
        this.group.add(grp);
        const o = { ...src, _a: [src.a[0] * CELL, src.a[1] * CELL], _b: [src.b[0] * CELL, src.b[1] * CELL] };
        this.dynamic.push((t, simT) => { const p = obstaclePose(o, simT); grp.position.set(p.x, y + h / 2, p.z); });
      } else if (src.type === 'spinner') {
        const y = yAt(...src.at);
        const grp = new THREE.Group();
        const post = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.28, 0.9, 16), this.mats.trim);
        post.position.y = 0.45; post.castShadow = true;
        const top = new THREE.Mesh(new THREE.SphereGeometry(0.42, 24, 16), new THREE.MeshStandardMaterial({ map: this.tex.swirl, roughness: 0.3 }));
        top.position.y = 1.05; top.scale.set(1, 1, 0.35); top.castShadow = true;
        grp.add(post, top);
        const arms = new THREE.Group();
        for (let i = 0; i < (src.arms || 2); i++) {
          const arm = new THREE.Mesh(new THREE.BoxGeometry(src.len, 0.4, 0.2), this.mats.wall);
          arm.rotation.y = (i * Math.PI) / (src.arms || 2);
          arm.castShadow = true;
          arms.add(arm);
        }
        arms.position.y = 0.2;
        grp.add(arms);
        grp.position.set(at[0], y, at[1]);
        this.group.add(grp);
        const o = { ...src, _at: at };
        this.dynamic.push((t, simT) => { const p = obstaclePose(o, simT); arms.rotation.y = p.angle; top.rotation.y = t * 0.6; });
      } else if (src.type === 'boost') {
        const [sw, sd] = src.span || [1, 1];
        const y = yAt(...src.at);
        const tex = this.tex.chevrons.clone(); tex.needsUpdate = true;
        tex.repeat.set(sw * 2, sd * 2);
        const pad = new THREE.Mesh(new THREE.PlaneGeometry(sw * CELL * 0.96, sd * CELL * 0.96),
          new THREE.MeshBasicMaterial({ map: tex, transparent: true, color: 0xffd23f }));
        pad.rotation.x = -Math.PI / 2;
        pad.rotation.z = { '^': 0, 'v': Math.PI, '<': Math.PI / 2, '>': -Math.PI / 2 }[src.dir];
        pad.position.set(at[0], y + 0.01, at[1]);
        const under = new THREE.Mesh(new THREE.PlaneGeometry(sw * CELL * 0.96, sd * CELL * 0.96), new THREE.MeshBasicMaterial({ color: 0xff6a3d, transparent: true, opacity: 0.55 }));
        under.rotation.copy(pad.rotation); under.position.set(at[0], y + 0.006, at[1]);
        this.group.add(under, pad);
        this.dynamic.push((t) => { tex.offset.y = -t * 1.6; });
      }
    }
  }

  // candy scenery scattered around the course, seeded per hole so it never shuffles
  buildDecor(layout, index) {
    const r = rng(1000 + index * 17);
    const { w, d } = layout.bounds;
    const items = [lollipop, gumdrop, candyCane, donut, wrapped];
    let placed = 0, tries = 0;
    const spots = [];
    while (placed < 44 && tries++ < 600) {
      const x = -16 + r() * (w + 32), z = -16 + r() * (d + 32);
      if (x > -1.8 && x < w + 1.8 && z > -1.8 && z < d + 1.8) continue;
      if (spots.some(([sx, sz]) => Math.hypot(sx - x, sz - z) < 2.4)) continue;
      spots.push([x, z]);
      const make = items[(r() * items.length) | 0];
      const obj = make(r, this.tex);
      obj.position.set(x, -1.02, z);
      obj.rotation.y = r() * Math.PI * 2;
      const near = Math.min(Math.abs(x - w / 2) - w / 2, Math.abs(z - d / 2) - d / 2);
      obj.scale.multiplyScalar(0.8 + r() * 0.6 + Math.max(0, near) * 0.05);
      obj.traverse((m) => { if (m.isMesh) { m.castShadow = false; m.receiveShadow = false; } });
      obj.updateMatrixWorld(true);
      obj.traverse((m) => { m.matrixAutoUpdate = false; });
      this.group.add(obj);
      placed++;
    }
  }

  update(t, simT) { for (const f of this.dynamic) f(t, simT); }

  clear() {
    this.group.traverse((m) => {
      if (m.geometry) m.geometry.dispose();
      if (m.material) (Array.isArray(m.material) ? m.material : [m.material]).forEach((mt) => {
        if (mt.map && !Object.values(this.tex).includes(mt.map)) mt.map.dispose();
        if (!Object.values(this.mats).includes(mt)) mt.dispose();
      });
    });
    this.group.clear();
    this.dynamic = [];
    this.bumpers = [];
  }
}

// ---------- candy scenery ----------
function lollipop(r, tex) {
  const g = new THREE.Group();
  const h = 1.6 + r() * 1.8;
  const stick = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, h, 8), std(0xffffff, { roughness: 0.4 }));
  stick.position.y = h / 2;
  const rad = 0.6 + r() * 0.5;
  const swirl = new THREE.MeshStandardMaterial({ map: tex.swirl, roughness: 0.25 });
  const disc = new THREE.Mesh(new THREE.CylinderGeometry(rad, rad, 0.22, 32), [std(CANDY[(r() * 6) | 0], { roughness: 0.25 }), swirl, swirl]);
  disc.rotation.x = Math.PI / 2;
  disc.position.y = h + rad * 0.8;
  g.add(stick, disc);
  return g;
}
function gumdrop(r) {
  const color = CANDY[(r() * 6) | 0];
  const rad = 0.5 + r() * 0.6;
  const m = new THREE.Mesh(new THREE.SphereGeometry(rad, 24, 14, 0, Math.PI * 2, 0, Math.PI * 0.55),
    std(color, { roughness: 0.2, transparent: true, opacity: 0.92 }));
  m.scale.y = 1.15;
  const g = new THREE.Group(); g.add(m);
  return g;
}
function candyCane(r, tex) {
  const h = 2 + r() * 2;
  const pts = [new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, h, 0)];
  for (let a = 0; a <= Math.PI; a += Math.PI / 8) pts.push(new THREE.Vector3(0.5 - Math.cos(a) * 0.5, h + Math.sin(a) * 0.55, 0));
  const curve = new THREE.CatmullRomCurve3(pts);
  const map = tex.stripe.clone(); map.needsUpdate = true; map.repeat.set(10, 1);
  const m = new THREE.Mesh(new THREE.TubeGeometry(curve, 40, 0.16, 10), std(0xffffff, { map, roughness: 0.3 }));
  const g = new THREE.Group(); g.add(m);
  return g;
}
function donut(r) {
  const R = 0.6 + r() * 0.5;
  const g = new THREE.Group();
  const dough = new THREE.Mesh(new THREE.TorusGeometry(R, R * 0.42, 14, 32), std('#e7b170', { roughness: 0.8 }));
  const icing = new THREE.Mesh(new THREE.TorusGeometry(R, R * 0.44, 14, 32, Math.PI * 2), std(['#ff7fb0', '#7a4a2a', '#fff2f8', '#8fd3ff'][(r() * 4) | 0], { roughness: 0.35 }));
  icing.scale.set(1, 1, 0.55); icing.position.z = R * 0.14;
  const tilt = new THREE.Group();
  tilt.add(dough, icing);
  tilt.rotation.x = -Math.PI / 2 + (r() - 0.5) * 0.5;
  tilt.position.y = R * 0.42;
  g.add(tilt);
  return g;
}
function wrapped(r) {
  const color = CANDY[(r() * 6) | 0];
  const g = new THREE.Group();
  const mat = std(color, { roughness: 0.25, metalness: 0.15 });
  const body = new THREE.Mesh(new THREE.SphereGeometry(0.55, 20, 14), mat);
  body.scale.set(1.25, 0.85, 0.85);
  const endGeo = new THREE.ConeGeometry(0.4, 0.55, 12);
  const a = new THREE.Mesh(endGeo, mat); a.rotation.z = Math.PI / 2; a.position.x = 0.85;
  const b = new THREE.Mesh(endGeo, mat); b.rotation.z = -Math.PI / 2; b.position.x = -0.85;
  g.add(body, a, b);
  g.position.y = 0.5;
  const outer = new THREE.Group(); outer.add(g);
  return outer;
}

// ---------- balls ----------
export const HATS = ['none', 'party', 'tophat', 'crown', 'cap'];
function makeHat(kind, color) {
  const g = new THREE.Group();
  if (kind === 'party') {
    const m = new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.24, 16), std(color === '#ffcc33' ? '#ff4f8b' : '#ffcc33', { roughness: 0.4 }));
    m.position.y = 0.12;
    const pom = new THREE.Mesh(new THREE.SphereGeometry(0.035, 10, 8), std('#ffffff'));
    pom.position.y = 0.25;
    g.add(m, pom);
  } else if (kind === 'tophat') {
    const mat = std('#1d1530', { roughness: 0.5 });
    const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.13, 0.02, 20), mat);
    const top = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.085, 0.18, 20), mat);
    top.position.y = 0.09;
    const band = new THREE.Mesh(new THREE.CylinderGeometry(0.087, 0.087, 0.035, 20), std('#ff4f8b'));
    band.position.y = 0.03;
    g.add(brim, top, band);
  } else if (kind === 'crown') {
    const mat = std('#ffcc33', { roughness: 0.25, metalness: 0.6 });
    const ring = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.07, 20, 1, true), mat);
    ring.material.side = THREE.DoubleSide;
    ring.position.y = 0.035;
    g.add(ring);
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2;
      const spike = new THREE.Mesh(new THREE.ConeGeometry(0.025, 0.07, 6), mat);
      spike.position.set(Math.cos(a) * 0.095, 0.1, Math.sin(a) * 0.095);
      const gem = new THREE.Mesh(new THREE.SphereGeometry(0.014, 8, 6), std(CANDY[i]));
      gem.position.set(Math.cos(a) * 0.1, 0.035, Math.sin(a) * 0.1);
      g.add(spike, gem);
    }
  } else if (kind === 'cap') {
    const mat = std(color === '#4fc3ff' ? '#ff8a3d' : '#4fc3ff', { roughness: 0.6 });
    const dome = new THREE.Mesh(new THREE.SphereGeometry(0.115, 18, 10, 0, Math.PI * 2, 0, Math.PI / 2), mat);
    const bill = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.015, 18, 1, false, -Math.PI / 2, Math.PI), mat);
    bill.position.set(0, 0.005, 0.07);
    g.add(dome, bill);
  }
  g.traverse((m) => { if (m.isMesh) m.castShadow = true; });
  return g;
}

function nameTag(text, color) {
  const tex = canvasTex(256, 72, (g, w, h) => {
    g.font = '900 40px Rubik, sans-serif';
    g.direction = 'rtl'; g.textAlign = 'center'; g.textBaseline = 'middle';
    const tw = Math.min(w - 8, g.measureText(text).width + 36);
    g.fillStyle = 'rgba(20,8,40,.78)';
    g.beginPath(); g.roundRect((w - tw) / 2, 6, tw, h - 12, 26); g.fill();
    g.fillStyle = color; g.beginPath(); g.arc((w - tw) / 2 + 24, h / 2, 9, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#fff'; g.fillText(text, w / 2 + 8, h / 2 + 2);
  }, false);
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthTest: false, transparent: true }));
  s.scale.set(0.8, 0.225, 1);
  s.renderOrder = 10;
  return s;
}

export class BallView {
  constructor(scene, { color, hat, name, bot }, index = 0) {
    this.mine = !bot;
    this.root = new THREE.Group();
    this.ball = new THREE.Mesh(new THREE.SphereGeometry(BALL_R, 28, 20), new THREE.MeshStandardMaterial({ color, roughness: 0.32, metalness: 0.05 }));
    this.ball.castShadow = true;
    // a stripe so you can see it roll
    const band = new THREE.Mesh(new THREE.TorusGeometry(BALL_R * 0.995, 0.012, 6, 32), std(0xffffff, { roughness: 0.4 }));
    this.ball.add(band);
    this.hat = makeHat(hat, color);
    this.hat.position.y = BALL_R * 0.85;
    this.tag = nameTag(name, color);
    this.tag.position.y = 0.42 + index * 0.17;
    this.tag.visible = !this.mine;
    this.root.add(this.ball, this.hat, this.tag);
    scene.add(this.root);
    this.prev = null;
    this.sinkT = null;
  }
  sync(body, dt) {
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
  }
  // drop into the cup
  sink(cup, t) {
    if (this.sinkT == null) this.sinkT = t;
    const k = Math.min(1, (t - this.sinkT) / 0.35);
    this.root.position.lerp(new THREE.Vector3(cup.x, cup.y + BALL_R - k * 0.35, cup.z), 0.35);
    this.ball.scale.setScalar(1 - k * 0.6);
    this.hat.visible = k < 0.6;
    this.tag.visible = false;
  }
  show() { this.root.visible = true; this.ball.scale.setScalar(1); this.hat.visible = true; this.tag.visible = !this.mine; this.sinkT = null; this.prev = null; }
  dispose(scene) {
    scene.remove(this.root);
    this.root.traverse((m) => { m.geometry?.dispose(); m.material?.map?.dispose(); m.material?.dispose?.(); });
  }
}

// ---------- aiming dots ----------
export class AimView {
  constructor(scene) {
    this.n = 20;
    const disc = new THREE.CircleGeometry(0.09, 14).rotateX(-Math.PI / 2);
    this.dots = new THREE.InstancedMesh(disc, new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.95, depthWrite: false }), this.n);
    this.dots.renderOrder = 5;
    this.dots.frustumCulled = false;
    scene.add(this.dots);
    this.m = new THREE.Matrix4();
    this.hide();
  }
  show(pos, angle, power, t) {
    this.dots.visible = true;
    const len = 1.2 + power * 6;
    const dx = Math.sin(angle), dz = -Math.cos(angle);
    for (let i = 0; i < this.n; i++) {
      const k = ((i + (t * 2.2) % 1) / this.n);
      const s = 1 - k * 0.45;
      this.m.makeScale(s, s, s).setPosition(pos.x + dx * (0.25 + k * len), pos.y - BALL_R + 0.03, pos.z + dz * (0.25 + k * len));
      this.dots.setMatrixAt(i, this.m);
    }
    this.dots.instanceMatrix.needsUpdate = true;
    const c = new THREE.Color().setHSL(0.16 - power * 0.16, 1, 0.5 + (1 - power) * 0.45);
    this.dots.material.color.copy(c);
  }
  hide() { this.dots.visible = false; }
}

// ---------- confetti ----------
export class Confetti {
  constructor(scene) {
    this.n = 120;
    const geo = new THREE.PlaneGeometry(0.07, 0.12);
    this.mesh = new THREE.InstancedMesh(geo, new THREE.MeshBasicMaterial({ side: THREE.DoubleSide }), this.n);
    this.mesh.frustumCulled = false;
    this.mesh.visible = false;
    for (let i = 0; i < this.n; i++) this.mesh.setColorAt(i, new THREE.Color(CANDY[i % CANDY.length]));
    scene.add(this.mesh);
    this.parts = [];
    this.m = new THREE.Matrix4(); this.q = new THREE.Quaternion(); this.e = new THREE.Euler();
  }
  burst(pos, big = false) {
    this.parts = Array.from({ length: big ? this.n : 50 }, () => ({
      p: pos.clone(),
      v: new THREE.Vector3((Math.random() - 0.5) * 4, 3 + Math.random() * (big ? 5 : 3), (Math.random() - 0.5) * 4),
      r: new THREE.Vector3(Math.random() * 6, Math.random() * 6, Math.random() * 6),
      life: 1.6 + Math.random(),
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
      const s = pt.life > 0 ? 1 : 0;
      this.m.compose(pt.p, this.q.setFromEuler(this.e), new THREE.Vector3(s, s, s));
      this.mesh.setMatrixAt(i, this.m);
    });
    this.mesh.instanceMatrix.needsUpdate = true;
    if (!alive) this.mesh.visible = false;
  }
}

// ---------- scene, lights, sky ----------
export function createStage(canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.6));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(55, 1, 0.05, 220);
  const hemi = new THREE.HemisphereLight(0xffffff, 0xffc4dc, 1.25);
  const sun = new THREE.DirectionalLight(0xfff4e0, 2.3);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  sun.shadow.bias = -0.0006;
  sun.shadow.normalBias = 0.02;
  scene.add(hemi, sun, sun.target);
  return { renderer, scene, camera, sun };
}

export function applyTheme(stage, theme, layout) {
  const { scene, sun } = stage;
  const sky = canvasTex(4, 256, (g, w, h) => {
    const gr = g.createLinearGradient(0, 0, 0, h);
    gr.addColorStop(0, theme.sky[0]); gr.addColorStop(1, theme.sky[1]);
    g.fillStyle = gr; g.fillRect(0, 0, w, h);
  }, false);
  scene.background?.dispose?.();
  scene.background = sky;
  scene.fog = new THREE.Fog(theme.fog, 28, 75);
  // fit the sun's shadow camera to this hole
  const { w, d } = layout.bounds;
  const cx = w / 2, cz = d / 2, rad = Math.hypot(w, d) / 2 + 2;
  sun.position.set(cx + 8, 18, cz + 5);
  sun.target.position.set(cx, 0, cz);
  const sc = sun.shadow.camera;
  sc.left = -rad; sc.right = rad; sc.top = rad; sc.bottom = -rad; sc.near = 1; sc.far = 50;
  sc.updateProjectionMatrix();
}
