// The café shell in 3D: a plank floor on a thick base, two back walls with wainscoting,
// windows that show the sky (and rain), the door, a chalkboard, a clock, a shelf and a painting,
// with ivy trailing along the top of the walls.
import { THREE, WALL_H3, mat, rbox, cyl, ball, rot, rng, compact, C } from './kit.js';
import { floorTexture, wallTexture, chalkTexture, paintingTexture, clockTexture } from './textures.js';
import { WALL_STYLES, FLOOR_STYLES } from '../art/room.js';

const T = 0.16; // wall thickness

// a shared canvas for every window pane: sky colour, the sun and rain streaks
export class SkyPane {
  constructor() {
    this.c = document.createElement('canvas'); this.c.width = 128; this.c.height = 160;
    this.tex = new THREE.CanvasTexture(this.c); this.tex.colorSpace = THREE.SRGBColorSpace;
    this.material = new THREE.MeshBasicMaterial({ map: this.tex, toneMapped: false });
    this.key = ''; this.last = 0;
  }
  update(sky = {}, t) {
    if (t - this.last < 1 / 15) return;
    this.last = t;
    const g = this.c.getContext('2d'), w = this.c.width, h = this.c.height;
    const gr = g.createLinearGradient(0, 0, 0, h);
    const tint = sky.tint || 'rgba(150,205,255,0.45)';
    gr.addColorStop(0, '#9fc4e6'); gr.addColorStop(1, '#e8f0f2');
    g.fillStyle = gr; g.fillRect(0, 0, w, h);
    g.fillStyle = tint; g.fillRect(0, 0, w, h);
    if (sky.dark) { g.fillStyle = `rgba(10,12,40,${Math.min(0.9, sky.dark * 2.6)})`; g.fillRect(0, 0, w, h); }
    if (sky.sun) { g.fillStyle = sky.sun; g.beginPath(); g.arc(w * 0.6, h * (sky.sunY ?? 0.3), 13, 0, 7); g.fill(); }
    // distant rooftops
    g.fillStyle = sky.dark ? 'rgba(30,30,60,0.9)' : 'rgba(120,130,150,0.5)';
    for (let i = 0; i < 6; i++) g.fillRect(i * 24 - 4, h - 30 - ((i * 37) % 26), 22, 60);
    if (sky.dark) { g.fillStyle = '#ffd890'; for (let i = 0; i < 8; i++) g.fillRect((i * 29) % w + 4, h - 22 + ((i * 13) % 14), 4, 5); }
    if (sky.rain !== false) {
      g.strokeStyle = 'rgba(220,235,255,0.55)'; g.lineWidth = 1.5;
      for (let i = 0; i < 40; i++) {
        const s = (i * 9301 + 49297) % 233280 / 233280, x = s * w, y = ((t * (220 + s * 120) + s * 997) % (h + 30)) - 15;
        g.beginPath(); g.moveTo(x, y); g.lineTo(x - 2, y + 12); g.stroke();
      }
    }
    // a little glass sheen
    g.fillStyle = 'rgba(255,255,255,0.12)'; g.beginPath(); g.moveTo(0, h * 0.3); g.lineTo(w * 0.4, 0); g.lineTo(w * 0.6, 0); g.lineTo(0, h * 0.5); g.fill();
    this.tex.needsUpdate = true;
  }
}

export function buildRoom(W, H, walls, floorStyle = 'oak', wallStyle = 'cream', sky) {
  const room = new THREE.Group();
  const ws = WALL_STYLES[wallStyle] || WALL_STYLES.cream, fs = FLOOR_STYLES[floorStyle] || FLOOR_STYLES.oak;

  // floor and base
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(W, H), new THREE.MeshStandardMaterial({ map: floorTexture(fs, W, H), roughness: 0.62 }));
  floor.rotation.x = -Math.PI / 2; floor.position.set(W / 2, 0, H / 2); floor.receiveShadow = true; floor.name = 'floor';
  room.add(floor);
  const base = new THREE.Group();
  base.add(rbox(W + T, 0.3, H + T, '#4a2e1f', W / 2 - T / 2, -0.152, H / 2 - T / 2, 0.03));
  base.add(rbox(W + T + 0.04, 0.05, H + T + 0.04, '#6e4630', W / 2 - T / 2, -0.03, H / 2 - T / 2, 0.02));
  room.add(compact(base, { shadows: false }));

  // walls: north runs along x at z = 0, west along z at x = 0
  const shell = new THREE.Group();
  const wallMat = (len) => new THREE.MeshStandardMaterial({ map: wallTexture(ws, len), roughness: 0.95 });
  const WAINS = 0.85;
  const wall = (side, len) => {
    const g = new THREE.Group();
    // inner face runs along +u from 0 to len; the room is on +n
    const paper = new THREE.Mesh(new THREE.PlaneGeometry(len, WALL_H3), wallMat(len));
    paper.position.set(len / 2, WALL_H3 / 2, 0); paper.receiveShadow = true; g.add(paper);
    g.add(rbox(len + T, WALL_H3 + 0.06, T, '#3b261a', len / 2 - T / 2, WALL_H3 / 2, -T / 2 - 0.002, 0.02));
    g.add(rbox(len, WAINS, 0.05, ws.wains, len / 2, WAINS / 2, 0.025, 0.01));
    for (let u = 0.1; u + 0.55 <= len; u += 0.68) g.add(rbox(0.56, WAINS - 0.3, 0.02, ws.wainsLight, u + 0.28, WAINS / 2 + 0.03, 0.055, 0.015));
    g.add(rbox(len, 0.06, 0.09, C.woodPale, len / 2, WAINS + 0.02, 0.04, 0.02));
    g.add(rbox(len, 0.1, 0.06, '#3b261a', len / 2, 0.05, 0.035, 0.01));
    g.add(rbox(len + T, 0.1, T + 0.12, C.woodPale, len / 2 - T / 2, WALL_H3 + 0.04, -T / 2 + 0.04, 0.02));
    if (side === 'west') { g.rotation.y = Math.PI / 2; g.position.set(0, 0, len); } // u runs along -z → flip to run along +z
    return g;
  };
  const north = wall('north', W), west = wall('west', H);
  shell.add(north, west);
  const windows = [];
  // features on the walls
  const put = (side, f) => {
    const g = new THREE.Group();
    feature(g, f, sky, windows);
    const mid = f.at + f.len / 2;
    if (side === 'north') g.position.set(mid, 0, 0.002);
    else { g.position.set(0.002, 0, mid); g.rotation.y = Math.PI / 2; }
    shell.add(g);
  };
  for (const f of walls.north || []) put('north', f);
  for (const f of walls.west || []) put('west', f);
  ivy(shell, W, H);
  // west wall group: built along +x then turned; fix its placement so it runs z 0..H
  west.rotation.y = Math.PI / 2; west.position.set(0, 0, H);
  room.add(compact(shell));
  for (const w of windows) room.add(w);
  return room;
}

// one wall feature, centred at x = 0 on a wall facing +z
function feature(g, f, sky, windows) {
  const w = f.len;
  if (f.type === 'window') {
    const y0 = 1.0, h = 1.25;
    const pane = new THREE.Mesh(new THREE.PlaneGeometry(w - 0.14, h - 0.14), sky.material);
    pane.position.set(0, y0 + h / 2, 0.012);
    const frame = C.cream;
    g.add(rbox(w, 0.08, 0.1, frame, 0, y0 + h, 0.04, 0.02), rbox(w + 0.12, 0.07, 0.2, C.woodPale, 0, y0 - 0.02, 0.08, 0.02));
    for (const s of [-1, 1]) g.add(rbox(0.08, h, 0.1, frame, s * (w / 2 - 0.04), y0 + h / 2, 0.04, 0.02));
    g.add(rbox(0.04, h, 0.06, frame, 0, y0 + h / 2, 0.03, 0.01), rbox(w, 0.04, 0.06, frame, 0, y0 + h * 0.55, 0.03, 0.01));
    // little pots on the sill
    g.add(cyl(0.06, 0.045, 0.1, C.pot, -w / 2 + 0.25, y0 + 0.07, 0.1, 12), ball(0.08, C.leaf[2], -w / 2 + 0.25, y0 + 0.18, 0.1, 1, 0.8, 1));
    const p = new THREE.Group(); p.add(pane); p.position.copy(g.position);
    g.add(p);
    windows.push(null);
    return;
  }
  if (f.type === 'chalkboard') {
    const h = 0.9, y = 1.25;
    g.add(rbox(w, h, 0.05, C.woodDark, 0, y + h / 2, 0.025, 0.02));
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w - 0.1, h - 0.1), new THREE.MeshStandardMaterial({ map: chalkTexture('menu'), roughness: 1 }));
    m.position.set(0, y + h / 2, 0.052); g.add(m);
    return;
  }
  if (f.type === 'clock') {
    const y = 1.95;
    g.add(rot(cyl(0.22, 0.22, 0.05, C.woodDark, 0, y, 0.03, 28), Math.PI / 2));
    const face = new THREE.Mesh(new THREE.CircleGeometry(0.19, 28), new THREE.MeshStandardMaterial({ map: clockTexture(), roughness: 0.6 }));
    face.position.set(0, y, 0.057); g.add(face);
    g.add(rot(rbox(0.02, 0.12, 0.01, C.ink, 0, y + 0.05, 0.062, 0.003), 0, 0, 0.6), rot(rbox(0.02, 0.16, 0.01, C.ink, 0, y + 0.06, 0.066, 0.003), 0, 0, -1.9));
    return;
  }
  if (f.type === 'painting') {
    const h = w * 0.75, y = 1.35;
    g.add(rbox(w, h, 0.05, C.brass, 0, y + h / 2, 0.025, 0.02, { metal: 0.4, rough: 0.5 }));
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w - 0.12, h - 0.12), new THREE.MeshStandardMaterial({ map: paintingTexture(), roughness: 0.8 }));
    m.position.set(0, y + h / 2, 0.052); g.add(m);
    return;
  }
  if (f.type === 'shelf') {
    for (const [y, n] of [[1.45, 0], [1.95, 1]]) {
      g.add(rbox(w, 0.04, 0.24, C.woodLight, 0, y, 0.12, 0.01));
      for (const s of [-1, 1]) g.add(rbox(0.03, 0.12, 0.2, C.woodDark, s * (w / 2 - 0.2), y - 0.08, 0.1, 0.01));
      const R = rng(40 + n);
      for (let i = 0; i < 5; i++) {
        const x = -w / 2 + 0.2 + i * (w - 0.4) / 4;
        if (R() < 0.6) { g.add(cyl(0.055, 0.055, 0.17, C.glass, x, y + 0.105, 0.12, 12, { opacity: 0.35, rough: 0.1 }), cyl(0.048, 0.048, 0.12, ['#5a3622', '#e8c48a', '#7a4a33'][i % 3], x, y + 0.08, 0.12, 12), cyl(0.058, 0.058, 0.03, C.woodPale, x, y + 0.2, 0.12, 12)); }
        else { g.add(cyl(0.06, 0.08, 0.1, C.pot, x, y + 0.07, 0.12, 12), ball(0.09, C.leaf[1 + i % 3], x, y + 0.18, 0.12, 1, 0.8, 1)); }
      }
    }
    return;
  }
  if (f.type === 'door') {
    const h = 2.0;
    g.add(rbox(w, h, 0.06, '#7a4a2e', 0, h / 2, 0.03, 0.02));
    for (const s of [-1, 1]) g.add(rbox(0.1, h + 0.05, 0.12, C.woodDark, s * (w / 2 + 0.03), h / 2, 0.05, 0.02));
    g.add(rbox(w + 0.26, 0.12, 0.13, C.woodDark, 0, h + 0.06, 0.05, 0.02));
    g.add(rbox(w - 0.4, 0.7, 0.02, C.glass, 0, 1.4, 0.065, 0.02, { opacity: 0.5, rough: 0.1, emissive: '#ffe6b0', glow: 0.25 }));
    g.add(rbox(w - 0.4, 0.55, 0.03, '#8a5a3a', 0, 0.5, 0.07, 0.02));
    g.add(ball(0.04, C.brass, w / 2 - 0.16, 1.0, 0.1, 1, 1, 1, { metal: 0.8, rough: 0.3 }));
    // a little "open" sign
    g.add(rbox(0.4, 0.16, 0.02, '#fbf6ea', 0, 1.88, 0.08, 0.03), rbox(0.3, 0.05, 0.01, '#b5483c', 0, 1.88, 0.093, 0.01));
    // door mat
    g.add(rbox(w - 0.1, 0.02, 0.5, '#8a6a48', 0, 0.01, 0.3, 0.01));
    return;
  }
}

function ivy(shell, W, H) {
  const R = rng(17);
  const vine = (side, len) => {
    for (let u = 0.2; u < len - 0.2; u += 0.1 + R() * 0.12) {
      const drop = Math.max(0, Math.sin(u * 1.7 + (side === 'north' ? 0 : 2)) * 0.5 + R() * 0.2);
      for (let k = 0; k < 2 + drop * 10; k++) {
        const y = WALL_H3 - 0.08 - k * 0.05 + R() * 0.02, off = (R() - 0.5) * 0.08;
        const leaf = ball(0.04 + R() * 0.02, C.leaf[Math.floor(R() * 4)], 0, 0, 0, 1, 0.75, 0.45, { rough: 0.7 }, 8);
        if (side === 'north') leaf.position.set(u + off, y, 0.06); else leaf.position.set(0.06, y, u + off);
        leaf.rotation.set(R(), R(), R());
        shell.add(leaf);
      }
    }
  };
  vine('north', W); vine('west', H);
}
