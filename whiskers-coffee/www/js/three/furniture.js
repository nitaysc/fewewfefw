// Every catalog item as a small 3D model. A model stands on y = 0, is centred on its footprint
// (x across, z deep, as the item is listed in the catalog) and faces +z. The renderer turns and
// places it. Parts that animate (fire, fairy lights) live in a child group named 'live'.
import { THREE, ZS, WALL_H3, mat, rbox, cyl, ball, cone, torus, leg, rot, rng, hashStr, compact, plane, C } from './kit.js';
import { rugTexture, chalkTexture, booksTexture } from './textures.js';
import { CATALOG } from '../game/catalog.js';

const Y = (px) => px * ZS;

// ---------- reusable pieces ----------
function woodChair(g, { seat = Y(13), col = C.wood, dark = C.woodDark, back = 'panel', panel = C.cream } = {}) {
  const s = 0.4;
  g.add(rbox(s + 0.04, 0.06, s + 0.04, col, 0, seat - 0.03, 0.02, 0.02));
  for (const [x, z] of [[-s / 2 + 0.03, -s / 2 + 0.03], [s / 2 - 0.03, -s / 2 + 0.03], [-s / 2 + 0.03, s / 2 - 0.01], [s / 2 - 0.03, s / 2 - 0.01]]) g.add(leg(0.025, 0, seat - 0.05, dark, x, z));
  const bz = -s / 2 + 0.02, top = seat + 0.5;
  g.add(leg(0.028, seat, top, dark, -s / 2 + 0.03, bz), leg(0.028, seat, top, dark, s / 2 - 0.03, bz));
  g.add(rbox(s + 0.02, 0.08, 0.05, col, 0, top - 0.02, bz, 0.02));
  if (back === 'panel') g.add(rbox(s * 0.6, 0.2, 0.03, panel, 0, seat + 0.27, bz, 0.01));
  else for (let i = -1; i <= 1; i++) g.add(leg(0.014, seat + 0.03, top - 0.05, dark, i * 0.1, bz));
}
function counterBody(g, w, { top = C.woodPale, body = C.wood, panel = C.woodLight } = {}) {
  const h = Y(17), d = 0.78;
  g.add(rbox(w - 0.06, h - 0.06, d - 0.08, body, 0, (h - 0.06) / 2, 0, 0.03));
  // kick plate and raised panels on the front
  g.add(rbox(w - 0.1, 0.06, 0.04, C.woodDark, 0, 0.03, d / 2 - 0.05, 0.01));
  const n = Math.max(1, Math.round(w / 0.5));
  for (let i = 0; i < n; i++) g.add(rbox((w - 0.2) / n - 0.06, h - 0.24, 0.03, panel, -w / 2 + 0.1 + ((w - 0.2) / n) * (i + 0.5), h / 2, d / 2 - 0.04, 0.012));
  g.add(rbox(w, 0.06, d, top, 0, h - 0.03, 0, 0.02));
  return h;
}
function cup(g, x, y, z, col = C.white, s = 1) {
  g.add(cyl(0.045 * s, 0.035 * s, 0.08 * s, col, x, y + 0.04 * s, z, 14));
  g.add(cyl(0.038 * s, 0.038 * s, 0.005, C.coffee, x, y + 0.078 * s, z, 14));
  g.add(rot(torus(0.022 * s, 0.007 * s, col, x + 0.05 * s, y + 0.045 * s, z), 0, 0, Math.PI / 2));
}
function cakeSlice(g, x, y, z, a = 0, cols = C.cake) {
  const p = new THREE.Group();
  p.add(cyl(0.07, 0.07, 0.01, C.white, 0, 0.005, 0, 18));
  const s = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.055, 0.05, 12, 1, false, 0, Math.PI / 2.2), mat(cols[3]));
  s.position.y = 0.035; p.add(s);
  const t = new THREE.Mesh(new THREE.CylinderGeometry(0.056, 0.056, 0.012, 12, 1, false, 0, Math.PI / 2.2), mat(cols[0]));
  t.position.y = 0.064; p.add(t);
  p.add(ball(0.012, cols[4], 0.02, 0.075, 0.02));
  p.position.set(x, y, z); p.rotation.y = a;
  g.add(p);
}
function wholeCake(g, x, y, z, r = 0.12) {
  g.add(cyl(r + 0.03, r + 0.03, 0.012, C.white, x, y + 0.006, z, 24));
  g.add(cyl(r, r, 0.07, C.cake[3], x, y + 0.047, z, 24));
  g.add(cyl(r + 0.004, r + 0.004, 0.022, C.cake[0], x, y + 0.085, z, 24));
  for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2; g.add(ball(0.016, C.cake[4], x + Math.cos(a) * r * 0.75, y + 0.1, z + Math.sin(a) * r * 0.75)); }
}
function pot(g, r = 0.17, h = 0.26, col = C.pot, y = 0) {
  g.add(cyl(r, r * 0.75, h, col, 0, y + h / 2, 0, 20));
  g.add(cyl(r * 1.08, r * 1.08, 0.05, C.potDark, 0, y + h - 0.02, 0, 20));
  g.add(cyl(r * 0.95, r * 0.95, 0.02, '#4a3020', 0, y + h - 0.005, 0, 20));
  return y + h;
}
function leafFan(g, y, R, n, len, lift = 0.6, cols = C.leaf, w = 0.45) {
  for (let i = 0; i < n; i++) {
    const a = i / n * Math.PI * 2 + R() * 0.5, tilt = lift + R() * 0.4;
    const l = ball(len, cols[Math.floor(R() * cols.length)], 0, 0, 0, w, 0.12, 1, { rough: 0.6 });
    const holder = new THREE.Group();
    l.position.set(0, 0, len * 0.9);
    holder.add(l);
    holder.position.set(0, y + R() * 0.1, 0);
    holder.rotation.set(-tilt, a, 0, 'YXZ');
    g.add(holder);
  }
}
function box3(g, w, h, d, col, x, y, z) { g.add(rbox(w, h, d, col, x, y + h / 2, z)); }
function stool(g, seatCol, seat = Y(15)) {
  g.add(cyl(0.18, 0.17, 0.06, seatCol, 0, seat - 0.03, 0, 24));
  g.add(cyl(0.165, 0.165, 0.02, seatCol, 0, seat + 0.005, 0, 24));
  for (let i = 0; i < 4; i++) {
    const a = i * Math.PI / 2 + Math.PI / 4, l = leg(0.022, 0, seat - 0.04, C.woodDark, Math.cos(a) * 0.12, Math.sin(a) * 0.12);
    l.rotation.set(Math.sin(a) * 0.12, 0, -Math.cos(a) * 0.12);
    g.add(l);
  }
  g.add(rot(torus(0.115, 0.012, C.woodDark, 0, seat * 0.4, 0), Math.PI / 2));
}
function armchair(g, col, dark, w = 0.82) {
  const seat = Y(11), d = 0.78;
  g.add(rbox(w, 0.22, d, dark, 0, 0.17, 0, 0.06));
  g.add(rbox(w - 0.26, 0.12, d - 0.16, col, 0, seat - 0.05, 0.05, 0.05));
  g.add(rbox(w, 0.5, 0.2, col, 0, seat + 0.2, -d / 2 + 0.1, 0.08));
  for (const s of [-1, 1]) g.add(rbox(0.16, 0.36, d, col, s * (w / 2 - 0.08), 0.3, 0, 0.07));
  for (const [x, z] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) g.add(cyl(0.025, 0.02, 0.07, C.woodDark, x * (w / 2 - 0.07), 0.035, z * (d / 2 - 0.07), 8));
}
function sofa(g, col, dark, pillow) {
  const w = 1.84, d = 0.8, seat = Y(11);
  g.add(rbox(w, 0.22, d, dark, 0, 0.17, 0, 0.06));
  for (const s of [-1, 1]) g.add(rbox(w / 2 - 0.2, 0.13, d - 0.18, col, s * (w / 4 - 0.04), seat - 0.05, 0.06, 0.06));
  g.add(rbox(w, 0.52, 0.2, col, 0, seat + 0.21, -d / 2 + 0.1, 0.08));
  for (const s of [-1, 1]) g.add(rbox(0.17, 0.38, d, col, s * (w / 2 - 0.085), 0.31, 0, 0.08));
  for (const [x, z] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) g.add(cyl(0.028, 0.022, 0.07, C.woodDark, x * (w / 2 - 0.08), 0.035, z * (d / 2 - 0.08), 8));
  if (pillow) for (const s of [-1, 1]) g.add(rot(rbox(0.26, 0.24, 0.08, pillow, s * 0.55, seat + 0.17, -d / 2 + 0.25, 0.04), -0.25, s * 0.2, 0));
}
function shelfUnit(g, w, h, d, col, shelves) {
  g.add(rbox(w, h, 0.04, C.woodDark, 0, h / 2, -d / 2 + 0.02, 0.01));
  for (const s of [-1, 1]) g.add(rbox(0.05, h, d, col, s * (w / 2 - 0.025), h / 2, 0, 0.015));
  g.add(rbox(w + 0.04, 0.05, d + 0.04, col, 0, h - 0.025, 0, 0.015));
  for (const y of shelves) g.add(rbox(w - 0.08, 0.035, d - 0.02, col, 0, y, 0, 0.01));
}
function jar(g, x, y, z, fill = C.coffee, h = 0.16) {
  g.add(cyl(0.05, 0.05, h, C.glass, x, y + h / 2, z, 14, { opacity: 0.35, rough: 0.1 }));
  g.add(cyl(0.044, 0.044, h * 0.7, fill, x, y + h * 0.35, z, 14));
  g.add(cyl(0.053, 0.053, 0.025, C.woodLight, x, y + h + 0.012, z, 14));
}
function aBoard(g, kind) {
  const tex = chalkTexture(kind);
  const h = 1.05;
  for (const s of [-1, 1]) {
    const side = new THREE.Group();
    side.add(rbox(0.6, h, 0.04, C.woodLight, 0, h / 2, 0, 0.015));
    const face = new THREE.Mesh(new THREE.PlaneGeometry(0.5, h - 0.12), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.95 }));
    face.position.set(0, h / 2, 0.022); side.add(face);
    side.position.z = s * 0.14; side.rotation.x = s * 0.2;
    if (s < 0) side.rotation.y = Math.PI;
    g.add(side);
  }
}

// ---------- the catalog ----------
const BUILD = {
  table_round(g) {
    const top = Y(20);
    g.add(cyl(0.38, 0.38, 0.05, C.woodLight, 0, top - 0.025, 0, 32), cyl(0.39, 0.37, 0.02, C.wood, 0, top - 0.055, 0, 32));
    g.add(cyl(0.045, 0.06, top - 0.06, C.woodDark, 0, (top - 0.06) / 2, 0, 12));
    g.add(cyl(0.2, 0.23, 0.04, C.woodDark, 0, 0.02, 0, 24));
  },
  table_cake(g) { BUILD.table_round(g); wholeCake(g, 0, Y(20), 0); },
  table_square(g) {
    const top = Y(12) + 0.2;
    g.add(rbox(0.66, 0.05, 0.66, C.woodLight, 0, top - 0.025, 0, 0.02));
    for (const [x, z] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) g.add(leg(0.03, 0, top - 0.05, C.woodDark, x * 0.27, z * 0.27));
  },
  coffee_table(g) {
    const top = Y(14);
    g.add(rbox(0.78, 0.05, 0.58, C.woodLight, 0, top - 0.025, 0, 0.025));
    g.add(rbox(0.68, 0.03, 0.48, C.wood, 0, 0.12, 0, 0.01));
    for (const [x, z] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) g.add(leg(0.03, 0, top - 0.05, C.woodDark, x * 0.33, z * 0.23));
  },
  coffee_table_cakes(g) {
    BUILD.coffee_table(g);
    cakeSlice(g, -0.18, Y(14), 0.05, 0.4); cakeSlice(g, 0.16, Y(14), -0.08, 2.2, ['#f3e1c0', '#d9a35a', '#7a4a33', '#e8c48a', '#7a4a33']);
  },
  chabudai(g) {
    const top = Y(7) + 0.05;
    g.add(cyl(0.4, 0.4, 0.05, C.walnut, 0, top - 0.025, 0, 32));
    for (let i = 0; i < 4; i++) { const a = i * Math.PI / 2 + Math.PI / 4; g.add(leg(0.03, 0, top - 0.05, C.walnut, Math.cos(a) * 0.26, Math.sin(a) * 0.26)); }
  },
  chair(g) { woodChair(g); },
  chair_spindle(g) { woodChair(g, { col: '#7a4a2e', dark: '#553420', back: 'spindle' }); },
  wicker_chair(g) {
    const seat = Y(8) + 0.12, col = '#d8b27a';
    g.add(cyl(0.32, 0.26, seat, col, 0, seat / 2, 0, 24, { rough: 1 }));
    g.add(cyl(0.3, 0.3, 0.06, '#f2e2c0', 0, seat + 0.02, 0, 24));
    const back = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.32, 0.5, 24, 1, true, Math.PI * 0.75, Math.PI * 1.5), mat(col, { side: true, rough: 1 }));
    back.position.y = seat + 0.2; back.rotation.y = 0; g.add(back);
    g.add(rot(torus(0.33, 0.035, col, 0, seat + 0.45, 0, {}, Math.PI * 1.5), Math.PI / 2, 0, Math.PI * 0.25));
  },
  stool(g) { stool(g, C.wood); },
  stool_green(g) { stool(g, '#7aa36a'); },
  stool_cream(g) { stool(g, '#efe2c8'); },
  zabuton(g) { g.add(rbox(0.6, 0.1, 0.6, '#b5483c', 0, 0.05, 0, 0.045)); g.add(ball(0.03, '#f2d27a', 0, 0.1, 0)); },
  hay_bale(g) {
    g.add(rbox(0.74, Y(10) + 0.04, 0.5, '#e2bf62', 0, (Y(10) + 0.04) / 2, 0, 0.06, { rough: 1 }));
    for (const s of [-1, 1]) g.add(rbox(0.04, Y(10) + 0.06, 0.52, '#8a5a2b', s * 0.18, (Y(10) + 0.04) / 2, 0, 0.01));
  },
  armchair(g) { armchair(g, '#6f9256', '#577544'); },
  armchair_pink(g) { armchair(g, '#e7a0a6', '#c9808a'); },
  sofa(g) { sofa(g, '#9a5a34', '#7a4426', '#e8d2a6'); },
  sofa_grey(g) { sofa(g, '#9aa1ad', '#7d8490', '#f2d27a'); },

  counter(g) { const h = counterBody(g, 0.98); cup(g, -0.18, h, 0.05); cup(g, 0.05, h, -0.1); },
  counter_long(g) { const h = counterBody(g, 1.96); g.add(cyl(0.05, 0.04, 0.14, '#7fa6d6', 0.6, h + 0.07, -0.1, 14)); g.add(ball(0.045, '#ef8fae', 0.6, h + 0.18, -0.1), ball(0.035, '#f2d27a', 0.64, h + 0.16, -0.07)); cup(g, -0.5, h, 0.1); },
  espresso(g) {
    const h = counterBody(g, 1.96);
    // the machine
    const mx = -0.35;
    g.add(rbox(0.72, 0.34, 0.4, '#d9dde2', mx, h + 0.17, -0.08, 0.05, { metal: 0.6, rough: 0.3 }));
    g.add(rbox(0.74, 0.06, 0.42, '#b5483c', mx, h + 0.3, -0.08, 0.02));
    g.add(rbox(0.7, 0.03, 0.38, C.metalDark, mx, h + 0.355, -0.08, 0.01, { metal: 0.6, rough: 0.35 }));
    for (const s of [-1, 1]) {
      g.add(cyl(0.05, 0.045, 0.06, C.metal, mx + s * 0.16, h + 0.15, 0.15, 14, { metal: 0.8, rough: 0.25 }));
      g.add(rbox(0.04, 0.03, 0.14, '#2a1d16', mx + s * 0.16, h + 0.12, 0.23, 0.01));
      cup(g, mx + s * 0.16, h, 0.15, C.white, 0.8);
    }
    for (let i = 0; i < 3; i++) cup(g, mx - 0.2 + i * 0.18, h + 0.37, -0.1, ['#f4efe6', '#e7a0a6', '#9bc3e0'][i], 0.8);
    g.add(cyl(0.035, 0.035, 0.04, C.ink, mx, h + 0.24, 0.13, 12), cyl(0.03, 0.03, 0.01, '#fbf6ea', mx, h + 0.24, 0.151, 12));
    // grinder
    const gx = 0.35;
    g.add(rbox(0.18, 0.24, 0.2, C.ink, gx, h + 0.12, -0.05, 0.03), cone(0.11, 0.2, C.glass, gx, h + 0.34, -0.05, 18, { opacity: 0.4, rough: 0.1 }));
    g.add(cyl(0.07, 0.04, 0.1, '#5a3622', gx, h + 0.3, -0.05, 14));
    g.add(rbox(0.3, 0.05, 0.2, C.woodDark, 0.72, h + 0.025, 0.05, 0.02));
    cup(g, 0.68, h + 0.05, 0.05, '#f4efe6', 0.8); cup(g, 0.78, h + 0.05, 0.05, '#e8c48a', 0.8);
  },
  pastry(g) { const h = counterBody(g, 0.98, { top: C.woodLight }); glassCase(g, 0.86, h); },
  cake_counter(g) {
    const h = counterBody(g, 1.96, { top: C.woodLight });
    glassCase(g, 1.2, h, -0.3);
    g.add(rbox(0.3, 0.2, 0.22, '#3b3b44', 0.7, h + 0.1, 0, 0.03), rbox(0.24, 0.12, 0.02, '#9fd0b8', 0.7, h + 0.18, 0.12, 0.01, { emissive: '#4f8a6b', glow: 0.4 }));
  },
  counter_register(g) {
    const h = counterBody(g, 1.96);
    g.add(rot(rbox(0.34, 0.2, 0.26, '#3b3b44', -0.5, h + 0.12, 0, 0.03), 0, 0.3, 0));
    g.add(rot(rbox(0.26, 0.16, 0.03, '#1c2a24', -0.5, h + 0.3, -0.06, 0.01, { emissive: '#3f8f6a', glow: 0.5 }), -0.3, 0.3, 0));
    g.add(rbox(0.36, 0.24, 0.03, C.ink, 0.35, h + 0.15, -0.25, 0.01));
    const p = new THREE.Group(); pot(p, 0.07, 0.1); leafFan(p, 0.1, rng(4), 7, 0.08, 0.5); p.position.set(0.7, h, 0); g.add(p);
    cup(g, 0.05, h, 0.1);
  },
  counter_beans(g) {
    const h = counterBody(g, 1.96);
    for (let i = 0; i < 3; i++) jar(g, -0.7 + i * 0.14, h, -0.15, ['#5a3622', '#7a4a33', '#3b2418'][i]);
    for (let i = 0; i < 2; i++) { g.add(rbox(0.2, 0.26, 0.14, '#c8a66e', -0.1 + i * 0.24, h + 0.13, 0, 0.05, { rough: 1 })); g.add(rbox(0.1, 0.07, 0.01, '#5a3a26', -0.1 + i * 0.24, h + 0.13, 0.07, 0.01)); }
    g.add(rbox(0.16, 0.16, 0.16, C.woodDark, 0.6, h + 0.08, 0, 0.02), cyl(0.06, 0.06, 0.08, C.brass, 0.6, h + 0.2, 0, 14, { metal: 0.7, rough: 0.3 }));
    g.add(rot(cyl(0.008, 0.008, 0.12, C.ink, 0.66, h + 0.27, 0, 6), 0, 0, 1.2));
  },
  bookshelf(g) {
    const w = 0.86, h = 1.9, d = 0.34;
    shelfUnit(g, w, h, d, C.wood, [0.06, 0.5, 0.95, 1.4]);
    [0.06, 0.5, 0.95, 1.4].forEach((y, i) => {
      const bt = booksTexture(31 + i), m = new THREE.Mesh(new THREE.PlaneGeometry(w - 0.12, 0.34), new THREE.MeshStandardMaterial({ map: bt, transparent: true, alphaTest: 0.5, roughness: 0.9 }));
      m.position.set(0, y + 0.19, 0.0); g.add(m);
      g.add(rbox(w - 0.14, 0.32, d - 0.1, '#3a281d', 0, y + 0.17, -0.06, 0.01));
    });
  },
  tea_hutch(g) {
    const w = 0.86, d = 0.42;
    g.add(rbox(w, 0.62, d, '#8fb3a8', 0, 0.31, 0, 0.03));
    for (const s of [-1, 1]) { g.add(rbox(w / 2 - 0.08, 0.46, 0.02, '#a8c9bf', s * w / 4, 0.33, d / 2, 0.02)); g.add(ball(0.02, C.brass, s * 0.05, 0.36, d / 2 + 0.02)); }
    g.add(rbox(w + 0.04, 0.04, d + 0.04, C.woodPale, 0, 0.64, 0, 0.01));
    const up = new THREE.Group(); shelfUnit(up, w - 0.06, 1.0, 0.22, '#8fb3a8', [0.35, 0.7]); up.position.set(0, 0.66, -0.1); g.add(up);
    for (let i = 0; i < 4; i++) g.add(rot(cyl(0.08, 0.08, 0.015, ['#f4efe6', '#e7a0a6', '#9bc3e0', '#f2d27a'][i], -0.27 + i * 0.18, 0.66 + 0.48, -0.15, 20), 1.35, 0, 0));
    g.add(ball(0.08, '#f4efe6', -0.18, 0.66 + 0.8, -0.08, 1, 0.8, 1), cyl(0.02, 0.012, 0.08, '#f4efe6', -0.08, 0.66 + 0.8, -0.08, 8));
    cup(g, 0.12, 0.66 + 0.735, -0.08, '#e7a0a6'); cup(g, 0.26, 0.66 + 0.735, -0.08, '#9bc3e0');
  },
  cup_hutch(g) {
    const w = 0.8, h = 1.6, d = 0.34;
    shelfUnit(g, w, h, d, '#9a6a44', [0.05, 0.55, 1.05]);
    for (let i = 0; i < 4; i++) jar(g, -0.27 + i * 0.18, 0.57, 0, ['#5a3622', '#e8c48a', '#7a4a33', '#c9786f'][i]);
    for (let i = 0; i < 4; i++) cup(g, -0.27 + i * 0.18, 1.07, 0.02, ['#f4efe6', '#9bc3e0', '#e7a0a6', '#f2d27a'][i]);
    for (let i = 0; i < 2; i++) g.add(rbox(0.22, 0.28, 0.16, '#c8a66e', -0.15 + i * 0.3, 0.21, 0, 0.05, { rough: 1 }));
  },

  plant_big(g) {
    const t = pot(g, 0.19, 0.3);
    const R = rng(5);
    for (let i = 0; i < 9; i++) {
      const a = i / 9 * Math.PI * 2 + R() * 0.4, h = 0.45 + R() * 0.55, len = 0.35 + R() * 0.15;
      const st = cyl(0.01, 0.012, h, C.leaf[0], Math.cos(a) * 0.08, t + h / 2, Math.sin(a) * 0.08, 6);
      st.rotation.set(Math.sin(a) * 0.35, 0, -Math.cos(a) * 0.35); g.add(st);
      const holder = new THREE.Group();
      const leaf = ball(len / 2, C.leaf[1 + (i % 3)], 0, 0, len / 2, 0.75, 0.1, 1, { rough: 0.55 });
      holder.add(leaf);
      holder.position.set(Math.cos(a) * (0.08 + h * 0.35), t + h, Math.sin(a) * (0.08 + h * 0.35));
      holder.rotation.set(-0.5 - R() * 0.4, Math.PI / 2 - a, 0, 'YXZ');
      g.add(holder);
    }
  },
  plant_small(g) {
    g.add(cyl(0.16, 0.16, 0.03, C.woodDark, 0, 0.5, 0, 20));
    for (let i = 0; i < 3; i++) { const a = i / 3 * Math.PI * 2; const l = leg(0.018, 0, 0.5, C.woodDark, Math.cos(a) * 0.12, Math.sin(a) * 0.12); l.rotation.set(Math.sin(a) * 0.1, 0, -Math.cos(a) * 0.1); g.add(l); }
    const t = pot(g, 0.13, 0.18, '#e8d7b0', 0.515);
    leafFan(g, t, rng(9), 14, 0.22, 0.2, C.leaf, 0.3);
  },
  potted_fern(g) { const t = pot(g, 0.15, 0.22, '#c46f4a'); leafFan(g, t, rng(12), 13, 0.2, 0.3, C.leaf, 0.3); },
  bonsai(g) {
    g.add(rbox(0.42, 0.1, 0.3, '#3b4a5a', 0, 0.05, 0, 0.03));
    g.add(rbox(0.38, 0.13, 0.26, '#2f3c4a', 0, 0.165, 0, 0.03));
    const tr = cyl(0.03, 0.05, 0.36, '#6b4a33', 0.04, 0.4, 0, 8); tr.rotation.z = 0.35; g.add(tr);
    for (const [x, y, z, r] of [[-0.06, 0.62, 0, 0.13], [0.12, 0.56, 0.05, 0.1], [0.02, 0.72, -0.03, 0.1]]) g.add(ball(r, C.leaf[1], x, y, z, 1.3, 0.65, 1.1, { rough: 0.9 }));
  },
  flower_box(g) {
    g.add(rbox(0.66, 0.24, 0.36, '#9a6a44', 0, 0.12, 0, 0.03));
    for (let i = 0; i < 3; i++) g.add(rbox(0.64, 0.015, 0.02, '#7a4e30', 0, 0.06 + i * 0.07, 0.18, 0.005));
    g.add(rbox(0.6, 0.02, 0.3, '#4a3020', 0, 0.24, 0, 0.01));
    const R = rng(8), cols = ['#ef8fae', '#f2d27a', '#f4efe6', '#b7a0e0', '#e46a5a'];
    for (let i = 0; i < 14; i++) {
      const x = -0.26 + R() * 0.52, z = -0.12 + R() * 0.24, h = 0.08 + R() * 0.14;
      g.add(cyl(0.008, 0.008, h, C.leaf[0], x, 0.25 + h / 2, z, 5), ball(0.035, cols[i % cols.length], x, 0.25 + h, z, 1, 0.7, 1), ball(0.04, C.leaf[2], x + 0.03, 0.26, z, 1, 0.4, 0.6));
    }
  },
  pumpkins(g) {
    for (const [x, z, r, c] of [[-0.12, 0.05, 0.17, '#e07a3a'], [0.16, -0.06, 0.13, '#f0a050'], [0.08, 0.18, 0.09, '#d9c18a']]) {
      for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2; g.add(ball(r * 0.6, c, x + Math.cos(a) * r * 0.4, r * 0.75, z + Math.sin(a) * r * 0.4, 1, 1.1, 1)); }
      g.add(cyl(0.015, 0.02, 0.07, '#6b5a2a', x, r * 1.4, z, 6));
    }
  },
  apple_crate(g) {
    for (let i = 0; i < 3; i++) for (const s of [-1, 1]) g.add(rbox(0.62, 0.07, 0.025, '#b98455', 0, 0.06 + i * 0.1, s * 0.22, 0.01));
    for (const s of [-1, 1]) g.add(rbox(0.025, 0.3, 0.46, '#9a6a44', s * 0.3, 0.15, 0, 0.01));
    g.add(rbox(0.6, 0.02, 0.44, '#9a6a44', 0, 0.02, 0));
    const R = rng(21);
    for (let i = 0; i < 12; i++) g.add(ball(0.06, R() < 0.2 ? '#9bbf4a' : '#c8302a', -0.22 + (i % 4) * 0.145 + R() * 0.02, 0.3 + R() * 0.04, -0.13 + Math.floor(i / 4) * 0.13, 1, 0.92, 1, { rough: 0.45 }));
  },
  gifts(g) {
    for (const [w, h, x, z, c, r] of [[0.32, 0.26, -0.1, 0.05, '#b5483c', '#f2d27a'], [0.22, 0.2, 0.18, -0.1, '#3f6f8a', '#f4efe6'], [0.18, 0.14, 0.15, 0.2, '#6d8a58', '#e46a5a'], [0.2, 0.18, -0.08, 0.06 + 0, '#f2d27a', '#b5483c']].slice(0, 3)) {
      g.add(rbox(w, h, w, c, x, h / 2, z, 0.02));
      g.add(rbox(w + 0.005, h + 0.005, 0.04, r, x, h / 2, z, 0.005), rbox(0.04, h + 0.005, w + 0.005, r, x, h / 2, z, 0.005));
      g.add(rot(torus(0.035, 0.012, r, x - 0.03, h + 0.02, z), 0, 0.5, 0.6), rot(torus(0.035, 0.012, r, x + 0.03, h + 0.02, z), 0, -0.5, -0.6));
    }
    g.add(rbox(0.16, 0.12, 0.16, '#f2d27a', -0.12, 0.32, 0.03, 0.02));
  },
  xmas_tree(g) {
    g.add(cyl(0.16, 0.13, 0.18, '#b5483c', 0, 0.09, 0, 18), cyl(0.04, 0.05, 0.2, '#6b4a33', 0, 0.25, 0, 8));
    [[0.42, 0.5, 0.55], [0.34, 0.45, 0.9], [0.24, 0.4, 1.2], [0.14, 0.3, 1.45]].forEach(([r, h, y]) => g.add(cone(r, h, '#2f6b45', 0, y, 0, 20, { rough: 0.9 })));
    g.add(cone(0.06, 0.12, '#ffd27a', 0, 1.66, 0, 5, { emissive: '#ffcf60', glow: 0.8 }));
    const R = rng(77), live = new THREE.Group(); live.name = 'live';
    for (let i = 0; i < 22; i++) {
      const y = 0.45 + R() * 1.0, r = 0.42 * (1 - (y - 0.3) / 1.4) + 0.02, a = R() * Math.PI * 2;
      const b = ball(0.028, '#ffffff', Math.cos(a) * r, y, Math.sin(a) * r, 1, 1, 1, null, 8);
      b.material = new THREE.MeshStandardMaterial({ color: '#ffffff', emissive: new THREE.Color(['#ff6a6a', '#ffe08a', '#8fd1ff', '#9be37a'][i % 4]), emissiveIntensity: 1 });
      b.userData.twinkle = i; live.add(b);
    }
    g.add(live);
  },
  fireplace(g) {
    const w = 1.7, h = 1.1, d = 0.5, z0 = -0.22;
    g.add(rbox(w, h, d, '#b8a28a', 0, h / 2, z0, 0.03, { rough: 1 }));
    g.add(rbox(w + 0.12, 0.08, d + 0.12, C.woodDark, 0, h + 0.04, z0 + 0.02, 0.02));
    g.add(rbox(0.8, 0.6, 0.1, '#2a1d16', 0, 0.36, z0 + d / 2 - 0.03, 0.04));
    g.add(rbox(1.0, 0.06, 0.25, '#8a7a6a', 0, 0.03, z0 + d / 2 + 0.1, 0.02));
    for (const x of [-0.6, 0.6]) g.add(cyl(0.03, 0.03, 0.14, '#f4efe6', x, h + 0.15, z0, 10), ball(0.02, '#ffd27a', x, h + 0.24, z0, 1, 1.5, 1, { emissive: '#ffb040', glow: 1.2 }));
    for (let i = 0; i < 3; i++) g.add(rot(cyl(0.04, 0.04, 0.5, '#6b4a33', 0, 0.12 + i * 0.03, z0 + 0.12 + i * 0.03, 8), 0, 0.3 * (i - 1), Math.PI / 2));
    const live = new THREE.Group(); live.name = 'live';
    for (let i = 0; i < 5; i++) {
      const f = cone(0.08 - i * 0.008, 0.28 - i * 0.03, '#ff9a3a', -0.16 + i * 0.08, 0.3, z0 + 0.15, 8);
      f.material = new THREE.MeshStandardMaterial({ color: '#ffb040', emissive: new THREE.Color(i % 2 ? '#ff7a20' : '#ffc050'), emissiveIntensity: 1.6, transparent: true, opacity: 0.9 });
      f.userData.flame = i; live.add(f);
    }
    g.add(live);
  },
  floor_lamp(g) {
    g.add(cyl(0.16, 0.18, 0.04, C.ink, 0, 0.02, 0, 24), cyl(0.018, 0.018, 1.3, C.brass, 0, 0.67, 0, 8, { metal: 0.7, rough: 0.3 }));
    const shade = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.22, 0.24, 24, 1, true), mat('#f3e0b0', { side: true, emissive: '#ffd890', glow: 0.75 }));
    shade.position.y = 1.36; g.add(shade);
    g.add(ball(0.05, '#fff6d6', 0, 1.3, 0, 1, 1, 1, { emissive: '#ffe6a0', glow: 2 }));
  },
  andon(g) {
    const h = 0.62;
    g.add(rbox(0.34, h, 0.34, '#f6ecd4', 0, h / 2 + 0.06, 0, 0.01, { emissive: '#ffd890', glow: 0.7 }));
    for (const [x, z] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) g.add(rbox(0.03, h + 0.1, 0.03, C.walnut, x * 0.17, h / 2 + 0.05, z * 0.17, 0.005));
    for (const y of [0.08, h + 0.06]) for (const s of [-1, 1]) { g.add(rbox(0.36, 0.025, 0.025, C.walnut, 0, y, s * 0.17, 0.005), rbox(0.025, 0.025, 0.36, C.walnut, s * 0.17, y, 0, 0.005)); }
  },
  shoji_screen(g) {
    for (let i = 0; i < 3; i++) {
      const p = new THREE.Group(), w = 0.6, h = 1.55;
      p.add(rbox(w - 0.04, h - 0.06, 0.02, '#f6ecd4', 0, h / 2, 0, 0.005, { emissive: '#ffe8c0', glow: 0.18 }));
      for (const s of [-1, 1]) p.add(rbox(0.04, h, 0.05, C.walnut, s * (w / 2 - 0.02), h / 2, 0, 0.01));
      for (const y of [0.03, h - 0.03, h * 0.33, h * 0.66]) p.add(rbox(w, 0.03, 0.04, C.walnut, 0, y, 0, 0.005));
      p.add(rbox(0.02, h, 0.03, C.walnut, 0, h / 2, 0, 0.005));
      p.position.set(-0.6 + i * 0.6, 0, i % 2 ? 0.08 : -0.08); p.rotation.y = i % 2 ? 0.25 : -0.25;
      g.add(p);
    }
  },
  rug(g) { rugFloor(g, 'rug', 1.8, 1.8); },
  quilt_rug(g) { rugFloor(g, 'quilt', 1.8, 1.8); },
  maple_rug(g) { rugFloor(g, 'maple', 1.8, 1.8); },
  rug_paw(g) { rugFloor(g, 'paw', 0.9, 0.9, true); },
  cat_tree(g) {
    const sisal = '#d8bf8e', pad = '#efe2c8';
    g.add(rbox(0.8, 0.07, 0.8, pad, 0, 0.035, 0, 0.03));
    g.add(cyl(0.065, 0.065, 1.2, sisal, -0.2, 0.62, -0.2, 14, { rough: 1 }), cyl(0.06, 0.06, 0.7, sisal, 0.22, 0.4, 0.15, 14, { rough: 1 }));
    g.add(cyl(0.26, 0.26, 0.05, pad, 0.18, 0.76, 0.12, 24), cyl(0.3, 0.3, 0.06, pad, -0.15, Y(34) - 0.03, -0.12, 24));
    g.add(torus(0.22, 0.05, '#e8d7b0', -0.15, Y(34) + 0.02, -0.12), cyl(0.2, 0.2, 0.02, '#d9c3a5', -0.15, Y(34), -0.12, 20));
    g.add(cyl(0.004, 0.004, 0.24, C.ink, 0.38, 0.62, 0.12, 4), ball(0.04, '#e46a5a', 0.38, 0.48, 0.12));
  },
  cattree_small(g) {
    g.add(rbox(0.66, 0.62, 0.6, '#d8bf8e', 0, 0.31, 0, 0.06, { rough: 1 }));
    g.add(cyl(0.15, 0.15, 0.02, '#3a281d', 0, 0.28, 0.301, 24));
    g.children[g.children.length - 1].rotation.x = Math.PI / 2;
    g.add(rbox(0.74, 0.06, 0.68, '#efe2c8', 0, Y(24) - 0.03, 0, 0.03), torus(0.22, 0.05, '#e7a0a6', 0, Y(24) + 0.02, 0));
    g.children[g.children.length - 1].rotation.x = Math.PI / 2;
  },
  cat_bed(g) {
    g.add(cyl(0.3, 0.3, 0.05, '#d9c3a5', 0, 0.025, 0, 28));
    const t = torus(0.27, 0.085, '#e8d7b0', 0, 0.09, 0); t.rotation.x = Math.PI / 2; g.add(t);
    g.add(cyl(0.24, 0.24, 0.04, '#f6ecd4', 0, 0.07, 0, 24));
  },
  menu_board(g) { aBoard(g, 'menu'); },
  welcome_board(g) { aBoard(g, 'welcome'); },
  hanging_plant(g) {
    const y = 1.55;
    for (let i = 0; i < 3; i++) { const a = i / 3 * Math.PI * 2; const r = cyl(0.006, 0.006, WALL_H3 - y - 0.2, '#e8d7b0', Math.cos(a) * 0.07, (WALL_H3 + y + 0.2) / 2, Math.sin(a) * 0.07, 4); r.rotation.set(Math.sin(a) * 0.05, 0, -Math.cos(a) * 0.05); g.add(r); }
    pot(g, 0.14, 0.18, '#f4efe6', y);
    const R = rng(6);
    for (let i = 0; i < 10; i++) {
      const a = R() * Math.PI * 2, len = 0.25 + R() * 0.45;
      for (let k = 0; k < 6; k++) { const t = k / 6; g.add(ball(0.035, C.leaf[1 + (k % 3)], Math.cos(a) * (0.13 + t * 0.06), y + 0.15 - t * len, Math.sin(a) * (0.13 + t * 0.06), 1, 0.5, 1)); }
    }
  },
};
function glassCase(g, w, h, x = 0) {
  g.add(rbox(w, 0.04, 0.6, C.woodDark, x, h + 0.02, 0, 0.01));
  for (let i = 0; i < 3; i++) {
    const cx = x - w / 3 + i * (w / 3);
    wholeCake(g, cx, h + 0.04, 0.04, 0.09);
  }
  g.add(rbox(w - 0.04, 0.02, 0.5, C.white, x, h + 0.2, 0, 0.005));
  for (let i = 0; i < 3; i++) cakeSlice(g, x - w / 3 + i * (w / 3), h + 0.21, 0, i);
  const glass = rbox(w, 0.4, 0.62, '#dff2f6', x, h + 0.24, 0, 0.03, { opacity: 0.22, rough: 0.05, metal: 0.1 });
  glass.name = 'glass';
  const live = new THREE.Group(); live.name = 'live'; live.add(glass); g.add(live);
}
function rugFloor(g, kind, w, d, round) {
  const m = new THREE.MeshStandardMaterial({ map: rugTexture(kind), roughness: 1, transparent: !!round, alphaTest: round ? 0.5 : 0 });
  const geo = round ? new THREE.CircleGeometry(0.5, 40) : new THREE.PlaneGeometry(1, 1);
  const r = new THREE.Mesh(geo, m);
  r.rotation.x = -Math.PI / 2; r.position.y = 0.008; r.scale.set(w, d, 1);
  if (round) r.scale.set(w, d * 0.8, 1);
  r.receiveShadow = true;
  const live = new THREE.Group(); live.name = 'live'; live.add(r); g.add(live);
}

// one model per type, cloned for every copy in the café
const models = new Map();
export function itemModel(type) {
  if (!models.has(type)) {
    const g = new THREE.Group();
    (BUILD[type] || fallback)(g, type);
    const out = compact(g);
    out.userData.type = type;
    models.set(type, out);
  }
  return models.get(type).clone();
}
function fallback(g, type) {
  const def = CATALOG[type] || { size: [1, 1] };
  const [w, d] = def.size;
  g.add(rbox(w * 0.8, 0.5, d * 0.8, C.woodLight, 0, 0.25, 0, 0.06));
}
export const hasModel = (type) => !!BUILD[type];
