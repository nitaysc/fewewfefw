// Every piece of furniture: footprint, price, behaviour and how to paint it.
// Paint functions work in iso units inside the unrotated footprint (16 units per tile).
import { P } from '../art/palette.js';
import { shade } from '../art/pix.js';

const legs = (p, x0, y0, x1, y1, h, c, t = 2) => {
  p.box(x0, y0, 0, t, t, h, c).box(x1 - t, y0, 0, t, t, h, c).box(x0, y1 - t, 0, t, t, h, c).box(x1 - t, y1 - t, 0, t, t, h, c);
};

const counterBody = (p, w, top = P.woodPale) => {
  p.box(0, 1, 0, w, 14, 15, { top: P.woodDark, left: P.woodDark, right: shade(P.woodDark, 0.8) })
    .faceRect('y', 2, 3, w - 4, 9, shade(P.woodDark, 1.12))
    .faceLine('y', 2, 3, w - 2, 3, shade(P.woodDark, 0.75))
    .faceRect('x', 2, 3, 10, 9, shade(P.woodDark, 0.95));
  for (let u = 6; u < w - 2; u += 8) p.faceLine('y', u, 4, u, 11, shade(P.woodDark, 0.8));
  p.box(-1, 0, 15, w + 2, 16, 2, { top: top, left: shade(top, 0.8), right: shade(top, 0.65) }, { order: 0.5 });
};

export const CATALOG = {
  table_round: {
    name: 'Round table', cat: 'furniture', price: 60, size: [1, 1], surface: 12, table: true,
    paint(p) {
      p.cyl(8, 8, 0, 4, 1, P.woodDark).cyl(8, 8, 1, 1.4, 10, P.woodDark)
        .cyl(8, 8, 11, 7, 2, { top: P.woodLight, left: P.wood, right: P.woodDark }, { rim: true });
    },
  },
  table_square: {
    name: 'Café table', cat: 'furniture', price: 70, size: [1, 1], surface: 12, table: true,
    paint(p) {
      legs(p, 2, 2, 14, 14, 11, P.woodDark);
      p.box(1, 1, 11, 14, 14, 2, { top: P.woodLight, left: P.wood, right: P.woodDark }, { order: 2 })
        .faceLine('top', 2, 5, 13, 5, shade(P.woodLight, 0.92)).faceLine('top', 2, 10, 13, 10, shade(P.woodLight, 0.92));
    },
  },
  chair: {
    name: 'Wooden chair', cat: 'furniture', price: 35, size: [1, 1], seat: true, rotates: true, seatZ: 6,
    paint(p) {
      legs(p, 4, 4, 13, 13, 4, P.woodDark);
      p.box(3, 3, 4, 11, 11, 2, { top: P.wood, left: P.woodDark, right: shade(P.woodDark, 0.8) }, { order: 1 });
      p.box(3, 3, 6, 11, 2, 12, { top: P.woodLight, left: P.wood, right: P.woodDark }, { order: -3 })
        .faceRect('y', 2, 2, 7, 2, P.woodLight).faceRect('y', 2, 6, 7, 1, shade(P.wood, 1.1));
    },
  },
  stool: {
    name: 'Bar stool', cat: 'furniture', price: 25, size: [1, 1], seat: true, seatZ: 14,
    paint(p) {
      legs(p, 4, 4, 12, 12, 12, P.woodDark);
      p.cyl(8, 8, 12, 5, 2, { top: P.rose, left: shade(P.rose, 0.85), right: shade(P.rose, 0.7) }, { order: 3 });
    },
  },
  armchair: {
    name: 'Armchair', cat: 'furniture', price: 120, size: [1, 1], seat: true, rotates: true, seatZ: 8,
    paint(p) {
      const f = { top: shade(P.sage, 1.1), left: P.sage, right: P.sageDark };
      p.box(1, 2, 0, 14, 13, 8, f)
        .box(1, 2, 8, 14, 4, 11, f, { order: -4 })
        .box(1, 6, 8, 3, 9, 5, f, { order: 0.2 })
        .box(12, 6, 8, 3, 9, 5, f, { order: 0.3 })
        .box(4, 6, 8, 8, 9, 2, { top: shade(P.linen, 1.02), left: P.linenShade, right: shade(P.linenShade, 0.85) }, { order: 0.1 });
    },
  },
  sofa: {
    name: 'Velvet sofa', cat: 'furniture', price: 220, size: [2, 1], seat: true, rotates: true, seatZ: 8,
    paint(p) {
      const f = { top: shade(P.terracotta, 1.1), left: P.terracotta, right: P.terracottaDark };
      p.box(1, 2, 0, 30, 13, 8, f)
        .box(1, 2, 8, 30, 4, 12, f, { order: -6 })
        .faceLine('y', 15, 1, 15, 10, shade(P.terracotta, 0.85))
        .box(1, 6, 8, 3, 9, 6, f, { order: 0.4 })
        .box(28, 6, 8, 3, 9, 6, f, { order: 0.5 })
        .box(4, 6, 8, 12, 9, 2, { top: shade(P.terracotta, 1.18), left: P.terracotta, right: P.terracottaDark }, { order: 0.1 })
        .box(16, 6, 8, 12, 9, 2, { top: shade(P.terracotta, 1.18), left: P.terracotta, right: P.terracottaDark }, { order: 0.2 })
        .box(5, 5, 10, 6, 2, 5, { top: P.mustard, left: shade(P.mustard, 0.85), right: shade(P.mustard, 0.7) }, { order: 0.3 });
    },
  },
  counter: {
    name: 'Counter', cat: 'counter', price: 80, size: [1, 1], surface: 17, rotates: true,
    paint(p) {
      counterBody(p, 16);
      p.cyl(5, 8, 17, 2, 4, { top: P.linen, left: '#f4efe6', right: '#d9d2c4' }).cyl(10, 9, 17, 2, 4, { top: P.linen, left: '#f4efe6', right: '#d9d2c4' });
    },
  },
  espresso: {
    name: 'Espresso bar', cat: 'counter', price: 0, size: [2, 1], surface: 17, rotates: true, station: 'coffee', light: true,
    paint(p) {
      counterBody(p, 32);
      const m = { top: P.chrome, left: P.metal, right: P.metalMid };
      p.box(4, 3, 17, 16, 9, 13, m)
        .faceRect('y', 1, 1, 14, 3, P.redDark)
        .facePx('y', 3, 2, P.lamp).facePx('y', 5, 2, '#9be37a')
        .faceRect('y', 2, 6, 3, 2, P.metalDark).faceRect('y', 10, 6, 3, 2, P.metalDark)
        .faceRect('y', 2, 11, 12, 1, P.metalDark);
      p.box(6, 5, 30, 12, 5, 3, { top: '#f4efe6', left: '#e2dbcf', right: '#cfc7b9' }, { order: 0.5 });
      // grinder
      p.cyl(25, 7, 17, 3, 8, { top: P.metalDark, left: P.metalMid, right: P.metalDark })
        .cyl(25, 7, 25, 3.5, 6, { top: '#5a3a26', left: '#6e4630', right: '#4a2f20' }, { order: 0.6 });
    },
  },
  pastry: {
    name: 'Pastry case', cat: 'counter', price: 150, size: [1, 1], surface: 17, rotates: true,
    paint(p) {
      counterBody(p, 16, P.woodLight);
      p.box(2, 3, 17, 12, 10, 3, { top: P.cake[3], left: shade(P.cake[3], 0.85), right: shade(P.cake[3], 0.7) })
        .box(4, 5, 20, 5, 5, 4, { top: P.cake[1], left: P.cake[0], right: shade(P.cake[0], 0.85) })
        .box(9, 5, 20, 4, 4, 3, { top: P.cake[4], left: P.cake[2], right: shade(P.cake[2], 0.8) });
      p.box(1, 2, 17, 14, 12, 11, { top: P.glass, left: P.glass, right: P.glass }, { order: 1, noEdges: true });
    },
  },
  bookshelf: {
    name: 'Bookshelf', cat: 'decor', price: 110, size: [1, 1], rotates: true,
    paint(p) {
      p.box(1, 1, 0, 14, 7, 40, { top: P.woodLight, left: P.wood, right: P.woodDark });
      for (let s = 0; s < 4; s++) {
        const v = 2 + s * 10;
        p.faceRect('y', 1, v, 12, 7, shade(P.woodDark, 0.8));
        let u = 1.5;
        for (let b = 0; b < 6; b++) {
          const w = 1 + ((b * 7 + s * 3) % 3), col = P.book[(b + s * 2) % P.book.length];
          const tall = 5 + ((b + s) % 3);
          if (u + w > 13) break;
          p.faceRect('y', u, v + 7 - tall, w, tall, col);
          u += w + 0.6;
        }
      }
    },
  },
  plant_big: {
    name: 'Monstera', cat: 'decor', price: 45, size: [1, 1],
    paint(p) {
      p.cyl(8, 8, 0, 5, 9, { top: '#4a3020', left: P.terracotta, right: P.terracottaDark }, { rim: true });
      p.shape(40, [[0, 0, 40], [16, 16, 0]], (pix, at) => leaves(pix, at(8, 8, 9), 30, 11));
    },
  },
  plant_small: {
    name: 'Fern stand', cat: 'decor', price: 30, size: [1, 1],
    paint(p) {
      legs(p, 4, 4, 12, 12, 12, P.woodDark, 1.5);
      p.box(3, 3, 12, 10, 10, 2, P.woodLight, { order: 2 });
      p.cyl(8, 8, 14, 3, 5, { top: '#4a3020', left: '#e9dcc8', right: '#cbbca6' }, { order: 3 });
      p.shape(40, [[0, 0, 36], [16, 16, 14]], (pix, at) => leaves(pix, at(8, 8, 19), 14, 6, 3));
    },
  },
  rug: {
    name: 'Woven rug', cat: 'decor', price: 55, size: [2, 2], flat: true,
    paint(p) {
      p.box(1, 1, 0, 30, 30, 1, { top: P.rose, left: shade(P.rose, 0.8), right: shade(P.rose, 0.7) }, { noEdges: true })
        .faceRect('top', 3, 3, 24, 24, P.linen)
        .faceRect('top', 5, 5, 20, 20, P.rose)
        .faceRect('top', 8, 8, 14, 14, P.mustard)
        .faceRect('top', 11, 11, 8, 8, P.linen);
    },
  },
  cat_tree: {
    name: 'Cat tree', cat: 'cat', price: 140, size: [1, 1], perch: 34,
    paint(p) {
      p.box(1, 1, 0, 14, 14, 3, { top: P.linen, left: P.linenShade, right: shade(P.linenShade, 0.85) });
      p.cyl(8, 8, 3, 2.5, 18, { top: P.sisal, left: P.sisal, right: P.sisalDark }, { order: 1 });
      p.box(2, 2, 21, 12, 12, 3, { top: P.linen, left: P.linenShade, right: shade(P.linenShade, 0.85) }, { order: 2 });
      p.cyl(8, 8, 24, 2.5, 8, { top: P.sisal, left: P.sisal, right: P.sisalDark }, { order: 3 });
      p.box(3, 3, 32, 10, 10, 2, { top: P.rose, left: shade(P.rose, 0.85), right: shade(P.rose, 0.7) }, { order: 4 });
    },
  },
  cat_bed: {
    name: 'Cat bed', cat: 'cat', price: 40, size: [1, 1], bed: true,
    paint(p) {
      p.cyl(8, 8, 0, 6, 4, { top: P.mustard, left: shade(P.mustard, 0.85), right: shade(P.mustard, 0.7) }, { rim: true })
        .cyl(8, 8, 1, 4, 3, { top: P.linen, left: P.linenShade, right: P.linenShade }, { order: 0.5 });
    },
  },
  floor_lamp: {
    name: 'Floor lamp', cat: 'decor', price: 65, size: [1, 1], light: true, glow: 34,
    paint(p) {
      p.cyl(8, 8, 0, 3, 1, P.metalDark).cyl(8, 8, 1, 0.7, 30, P.metalDark)
        .cyl(8, 8, 30, 4, 7, { top: P.lampHot, left: '#f2d9a2', right: '#d9b97a' }, { order: 1 });
    },
  },
  // ---------- Kyoto collection ----------
  chabudai: {
    name: 'Low table', cat: 'furniture', set: 'kyoto', price: 70, size: [1, 1], surface: 7, table: true,
    paint(p) {
      legs(p, 4, 4, 12, 12, 5, P.woodDark);
      p.cyl(8, 8, 5, 7, 2, { top: '#7a4e30', left: '#5b3a26', right: '#4a2f20' }, { rim: true, order: 2 });
      p.cyl(6, 9, 7, 1.6, 2, { top: '#cfd8c4', left: '#a9b79a', right: '#8a9a7a' }, { order: 3 });
      p.cyl(10, 7, 7, 1.3, 2, { top: '#cfd8c4', left: '#a9b79a', right: '#8a9a7a' }, { order: 3.1 });
    },
  },
  zabuton: {
    name: 'Floor cushion', cat: 'furniture', set: 'kyoto', price: 25, size: [1, 1], seat: true, seatZ: 3,
    paint(p) {
      p.box(2, 2, 0, 12, 12, 3, { top: '#b5483c', left: '#8e3329', right: '#73291f' })
        .faceRect('top', 5, 5, 2, 2, '#f2d27a').faceLine('top', 1, 1, 11, 1, shade('#b5483c', 1.12));
    },
  },
  andon: {
    name: 'Paper lantern', cat: 'decor', set: 'kyoto', price: 60, size: [1, 1], light: true, glow: 14,
    paint(p) {
      legs(p, 3, 3, 13, 13, 4, P.woodDark, 1.5);
      p.box(3, 3, 4, 10, 10, 18, { top: P.lampHot, left: '#f6e3b0', right: '#e2c98e' }, { order: 1 });
      for (const f of ['x', 'y']) p.faceLine(f, 0, 0, 0, 18, P.woodDark).faceLine(f, 5, 0, 5, 18, P.woodDark).faceLine(f, 0, 9, 10, 9, P.woodDark);
      p.box(2, 2, 22, 12, 12, 2, P.woodDark, { order: 2 });
    },
  },
  bonsai: {
    name: 'Bonsai', cat: 'decor', set: 'kyoto', price: 75, size: [1, 1],
    paint(p) {
      p.box(2, 2, 0, 12, 12, 7, { top: P.woodLight, left: P.woodDark, right: shade(P.woodDark, 0.8) })
        .faceRect('y', 2, 2, 8, 3, shade(P.woodDark, 0.8));
      p.box(4, 4, 7, 8, 8, 3, { top: '#3a2618', left: '#3d4a6b', right: '#2f3a55' }, { order: 1 });
      p.shape(20, [[0, 0, 30], [16, 16, 10]], (pix, at) => {
        const [x, y] = at(8, 8, 10);
        pix.line(x, y, x - 1, y - 4, '#5b3a26'); pix.line(x - 1, y - 4, x + 3, y - 8, '#5b3a26');
        pix.line(x + 3, y - 8, x + 1, y - 12, '#5b3a26'); pix.line(x, y - 1, x - 1, y - 5, '#7a4e30');
        const L = P.leaf;
        for (const [dx, dy, r] of [[-5, -7, 3], [5, -10, 3], [0, -14, 4], [-3, -12, 2], [4, -6, 2]]) {
          pix.ellipse(x + dx, y + dy, r + 1, r - 1 || 1, L[0]);
          pix.ellipse(x + dx, y + dy - 1, r, Math.max(1, r - 2), L[1]);
          pix.set(x + dx - 1, y + dy - 2, L[2]); pix.set(x + dx + 1, y + dy - 2, L[3]);
        }
      });
    },
  },
  shoji_screen: {
    name: 'Folding screen', cat: 'decor', set: 'kyoto', price: 90, size: [2, 1], rotates: true,
    paint(p) {
      const paper = { top: P.woodDark, left: '#f1e7d0', right: '#d9cdb2' };
      [[1, 6], [11, 8], [21, 6]].forEach(([x, y], i) => {
        p.box(x, y, 0, 10, 2, 34, paper, { order: i * 0.1 })
          .faceLine('y', 0, 0, 0, 34, P.woodDark).faceLine('y', 9.5, 0, 9.5, 34, P.woodDark)
          .faceLine('y', 0, 0, 10, 0, P.woodDark).faceLine('y', 0, 33, 10, 33, P.woodDark)
          .faceLine('y', 5, 1, 5, 33, shade(P.woodDark, 1.3));
        for (let v = 7; v < 33; v += 7) p.faceLine('y', 0, v, 10, v, shade(P.woodDark, 1.3));
        if (i === 1) p.faceRect('y', 2, 9, 3, 3, '#e7a0a6').faceRect('y', 6, 15, 2, 2, '#e7a0a6');
      });
    },
  },

  // ---------- Cottage collection ----------
  wicker_chair: {
    name: 'Wicker chair', cat: 'furniture', set: 'cottage', price: 60, size: [1, 1], seat: true, rotates: true, seatZ: 8,
    paint(p) {
      const f = { top: '#d8b57a', left: P.sisal, right: P.sisalDark };
      p.box(2, 3, 0, 12, 11, 7, f);
      for (let u = 1; u < 12; u += 2) p.faceLine('y', u, 1, u, 6, P.sisalDark);
      p.box(2, 2, 7, 12, 3, 14, f, { order: -4 });
      for (let u = 1; u < 12; u += 2) p.faceLine('-y', u, 1, u, 13, P.sisalDark);
      p.faceLine('y', 0, 3, 12, 3, P.sisalDark).faceLine('y', 0, 8, 12, 8, P.sisalDark);
      p.box(4, 5, 7, 8, 8, 2, { top: '#f2b8b0', left: P.rose, right: shade(P.rose, 0.8) }, { order: 0.2 })
        .faceRect('top', 3, 3, 2, 2, '#fbe3dc');
    },
  },
  flower_box: {
    name: 'Flower planter', cat: 'decor', set: 'cottage', price: 40, size: [1, 1],
    paint(p) {
      p.box(2, 4, 0, 12, 8, 8, { top: '#3a2618', left: P.wood, right: P.woodDark })
        .faceLine('y', 0, 4, 12, 4, P.woodDark).faceLine('x', 0, 4, 8, 4, shade(P.woodDark, 0.8));
      p.shape(20, [[2, 4, 22], [14, 12, 8]], (pix, at) => {
        const [x, y] = at(8, 8, 8);
        const L = P.leaf, cols = ['#ef8fae', '#f2d27a', '#b7a0e0', '#fbf6ea', '#e46a5a'];
        for (let i = 0; i < 9; i++) {
          const dx = -8 + i * 2, dy = -3 - ((i * 5) % 4);
          pix.line(x + dx, y - 1, x + dx, y + dy + 1, L[1]);
          pix.set(x + dx - 1, y - 2, L[2]);
        }
        for (let i = 0; i < 9; i++) {
          const dx = -8 + i * 2, dy = -3 - ((i * 5) % 4), c = cols[i % cols.length];
          pix.set(x + dx, y + dy, c); pix.set(x + dx - 1, y + dy, c); pix.set(x + dx, y + dy - 1, c);
          pix.set(x + dx, y + dy, shade(c, 0.8));
        }
      });
    },
  },
  quilt_rug: {
    name: 'Patchwork rug', cat: 'decor', set: 'cottage', price: 70, size: [2, 2], flat: true,
    paint(p) {
      const cols = ['#c9786f', '#e8d7b0', '#6d8a58', '#d29b3a', '#f2b8b0', '#3d4a6b'];
      p.box(1, 1, 0, 30, 30, 1, { top: P.linen, left: P.linenShade, right: shade(P.linenShade, 0.8) }, { noEdges: true });
      for (let j = 0; j < 4; j++) for (let i = 0; i < 4; i++) p.faceRect('top', 1 + i * 7, 1 + j * 7, 7, 7, cols[(i * 3 + j * 5) % cols.length]);
      for (let k = 1; k < 4; k++) p.faceLine('top', 1 + k * 7, 1, 1 + k * 7, 29, '#fbf6ea').faceLine('top', 1, 1 + k * 7, 29, 1 + k * 7, '#fbf6ea');
    },
  },
  tea_hutch: {
    name: 'Tea dresser', cat: 'decor', set: 'cottage', price: 130, size: [1, 1], rotates: true,
    paint(p) {
      const paint = { top: '#b9c9a4', left: '#9db08a', right: '#7f9270' };
      p.box(1, 2, 0, 14, 12, 16, paint)
        .faceRect('y', 1, 3, 5, 11, '#b1c39c').faceRect('y', 7, 3, 5, 11, '#b1c39c')
        .facePx('y', 5, 8, P.mustard).facePx('y', 7, 8, P.mustard);
      p.box(0, 1, 16, 16, 13, 1, P.woodLight, { order: 0.5 });
      p.box(1, 1, 17, 14, 4, 24, paint, { order: -2 })
        .faceRect('y', 1, 2, 12, 21, '#6f8060')
        .faceRect('y', 1, 9, 12, 1, '#b9c9a4').faceRect('y', 1, 16, 12, 1, '#b9c9a4');
      // plates and cups on the shelves
      for (const [u, v] of [[2, 3], [6, 3], [10, 3]]) p.faceRect('y', u, v, 3, 4, '#fbf6ea').facePx('y', u + 1, v + 1, P.rose);
      for (const u of [2, 5, 8, 11]) p.faceRect('y', u, 12, 2, 3, u % 2 ? '#f4efe6' : '#e7a0a6');
      p.box(0, 0, 41, 16, 6, 2, P.woodLight, { order: -1 });
    },
  },

  // ---------- Autumn collection ----------
  pumpkins: {
    name: 'Pumpkins', cat: 'decor', set: 'autumn', price: 35, size: [1, 1],
    paint(p) {
      const orange = { top: '#f0a052', left: '#d97a2c', right: '#b55f20' };
      p.cyl(6, 9, 0, 4.5, 6, orange, { order: 0 });
      p.cyl(11, 5, 0, 3.5, 5, orange, { order: -1 });
      p.cyl(11, 11, 0, 2.6, 4, { top: '#f6ecd6', left: '#e6d7b8', right: '#c9b894' }, { order: 1 });
      p.shape(10, [[0, 0, 12], [16, 16, 0]], (pix, at) => {
        for (const [x, y, z, r] of [[6, 9, 6, 4.5], [11, 5, 5, 3.5], [11, 11, 4, 2.6]]) {
          const [cx, cy] = at(x, y, z);
          // ribs and a little stem
          pix.vline(cx - Math.round(r * 0.7), cy + 1, cy + z, '#a9561c');
          pix.vline(cx + Math.round(r * 0.5), cy + 1, cy + z, '#a9561c');
          pix.rect(cx, cy - 2, 1, 2, '#4f6a40'); pix.set(cx + 1, cy - 2, '#6d8a58');
        }
      });
    },
  },
  hay_bale: {
    name: 'Hay bale seat', cat: 'furniture', set: 'autumn', price: 30, size: [1, 1], seat: true, seatZ: 10,
    paint(p) {
      p.box(1, 3, 0, 14, 10, 10, { top: '#e8c870', left: '#d4ae52', right: '#b8923e' });
      for (let u = 1; u < 14; u += 3) p.faceLine('y', u, 1, u + 1, 9, '#c29a44');
      p.faceRect('y', 3, 0, 1, 10, '#8e5a2b').faceRect('y', 10, 0, 1, 10, '#8e5a2b')
        .faceRect('top', 3, 0, 1, 10, '#8e5a2b').faceRect('top', 10, 0, 1, 10, '#8e5a2b');
      p.faceLine('top', 1, 3, 12, 3, '#f2d894').faceLine('top', 2, 7, 11, 7, '#d4ae52');
    },
  },
  maple_rug: {
    name: 'Maple rug', cat: 'decor', set: 'autumn', price: 50, size: [2, 2], flat: true,
    paint(p) {
      p.box(1, 1, 0, 30, 30, 1, { top: '#a8452c', left: '#8e3329', right: '#73291f' }, { noEdges: true })
        .faceRect('top', 2, 2, 26, 26, '#d27a3a').faceRect('top', 4, 4, 22, 22, '#a8452c')
        .faceRect('top', 13, 6, 4, 18, P.mustard).faceRect('top', 6, 13, 18, 4, P.mustard)
        .faceRect('top', 9, 9, 12, 12, '#e8954a').faceRect('top', 12, 12, 6, 6, P.mustard);
    },
  },
  apple_crate: {
    name: 'Apple crate', cat: 'decor', set: 'autumn', price: 30, size: [1, 1],
    paint(p) {
      p.box(2, 3, 0, 12, 10, 8, { top: '#3a2618', left: P.woodLight, right: P.wood })
        .faceLine('y', 0, 3, 12, 3, P.woodDark).faceLine('y', 0, 6, 12, 6, P.woodDark)
        .faceLine('x', 0, 3, 10, 3, P.woodDark).faceLine('x', 0, 6, 10, 6, P.woodDark);
      p.shape(10, [[2, 3, 12], [14, 13, 8]], (pix, at) => {
        for (const [x, y] of [[4, 5], [8, 5], [12, 6], [5, 9], [9, 9], [12, 11], [7, 12]]) {
          const [cx, cy] = at(x, y, 8);
          pix.ellipse(cx, cy - 1, 2, 1, (x + y) % 3 ? '#c23a3a' : '#8fb04c');
          pix.set(cx - 1, cy - 2, '#f4a0a0');
        }
      });
    },
  },

  // ---------- Winter collection ----------
  xmas_tree: {
    name: 'Holiday tree', cat: 'decor', set: 'winter', price: 160, size: [1, 1], light: true, glow: 26, twinkle: true,
    paint(p) {
      p.box(4, 4, 0, 8, 8, 6, { top: '#3a2618', left: P.red, right: P.redDark }).faceRect('y', 0, 2, 8, 1, P.mustard);
      p.shape(20, [[0, 0, 50], [16, 16, 6]], (pix, at) => {
        const [x, y] = at(8, 8, 6);
        pix.rect(x - 1, y - 3, 3, 3, '#5b3a26');
        const tiers = [[0, 12, 11], [9, 10, 10], [17, 8, 9], [24, 5, 9]];
        for (const [h0, r, h] of tiers) {
          const by = y - 2 - h0;
          for (let k = 0; k < h; k++) {
            const w = Math.round(r * (1 - k / h)) + 1;
            for (let dx = -w; dx <= w; dx++) pix.set(x + dx, by - k, dx < -w * 0.3 ? '#3f6b35' : dx < w * 0.5 ? '#2f5228' : '#23401f');
          }
          for (let dx = -r; dx <= r; dx++) pix.set(x + dx, by + 1, '#23401f');
        }
        for (const [dx, dy, c] of [[-6, -6, '#d23a3a'], [5, -9, '#f2d27a'], [-3, -15, '#6f8fc9'], [3, -19, '#d23a3a'], [-1, -24, '#f2d27a'], [7, -4, '#6f8fc9']]) pix.set(x + dx, y + dy, c);
        // star
        const sy = y - 36;
        pix.set(x, sy - 1, '#ffe08a'); pix.set(x - 1, sy, '#ffe08a'); pix.set(x, sy, '#fff6c4'); pix.set(x + 1, sy, '#ffe08a'); pix.set(x, sy + 1, '#ffe08a');
      });
    },
  },
  gifts: {
    name: 'Gift pile', cat: 'decor', set: 'winter', price: 40, size: [1, 1],
    paint(p) {
      p.box(2, 7, 0, 7, 7, 7, { top: '#d23a3a', left: '#b5302f', right: '#8e2a26' })
        .faceRect('top', 3, 0, 1, 7, P.lamp).faceRect('top', 0, 3, 7, 1, P.lamp).faceRect('y', 3, 0, 1, 7, P.lamp).faceRect('x', 3, 0, 1, 7, P.lamp);
      p.box(9, 3, 0, 5, 5, 10, { top: '#5c8f3f', left: '#4f7a36', right: '#3f6b35' }, { order: -1 })
        .faceRect('top', 2, 0, 1, 5, '#fbf6ea').faceRect('y', 2, 0, 1, 10, '#fbf6ea').faceRect('x', 2, 0, 1, 10, '#fbf6ea');
      p.box(4, 2, 0, 5, 5, 5, { top: '#8fa9d9', left: '#6f8fc9', right: '#556fa3' }, { order: -2 })
        .faceRect('top', 0, 2, 5, 1, '#ef8fae').faceRect('y', 2, 0, 1, 5, '#ef8fae');
    },
  },
  fireplace: {
    name: 'Fireplace', cat: 'decor', set: 'winter', price: 240, size: [2, 1], rotates: true, light: true, fire: true,
    paint(p) {
      const brick = { top: '#8e4a2f', left: '#a2553c', right: '#7e4030' };
      p.box(1, 4, 0, 30, 11, 30, brick);
      for (let v = 3; v < 30; v += 4) p.faceLine('y', 0, v, 30, v, '#c9a98a');
      for (let v = 0, r = 0; v < 30; v += 4, r++) for (let u = r % 2 ? 3 : 7; u < 30; u += 8) p.faceLine('y', u, v, u, v + 3, '#c9a98a');
      p.faceRect('y', 8, 12, 14, 18, '#1e120c').faceRect('y', 7, 11, 16, 1, '#5e3c24')
        .faceRect('y', 10, 25, 10, 2, '#5b3a26')
        .faceRect('y', 11, 19, 8, 6, '#e8642a').faceRect('y', 12, 16, 6, 4, '#f29a3a').faceRect('y', 13, 20, 4, 4, '#ffd27a').faceRect('y', 14, 14, 2, 3, '#ffd27a');
      p.box(0, 3, 30, 32, 13, 3, { top: P.woodLight, left: P.wood, right: P.woodDark }, { order: 1 });
      p.cyl(5, 9, 33, 1.2, 6, { top: P.lampHot, left: '#f4efe6', right: '#d9d2c4' }, { order: 2 });
      p.cyl(26, 9, 33, 1.2, 4, { top: P.lampHot, left: '#f4efe6', right: '#d9d2c4' }, { order: 2.1 });
      p.box(13, 7, 33, 6, 2, 8, { top: P.woodPale, left: '#a9c2c9', right: '#8aa3aa' }, { order: 2.2 }).faceRect('y', 1, 1, 4, 6, '#d9c3a5');
    },
  },
};

// leafy blob: overlapping dithered ellipses in four greens
function leaves(pix, [cx, cy], h, r, n = 7) {
  const L = P.leaf;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + 0.6;
    const lx = cx + Math.cos(a) * r * 0.6, ly = cy - h * 0.55 + Math.sin(a) * h * 0.3;
    pix.ellipse(Math.round(lx), Math.round(ly), Math.max(2, Math.round(r * 0.55)), Math.max(2, Math.round(h * 0.22)), L[1]);
  }
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    const lx = cx + Math.cos(a) * r * 0.45, ly = cy - h * 0.7 + Math.sin(a) * h * 0.25;
    pix.ellipse(Math.round(lx), Math.round(ly), Math.max(1, Math.round(r * 0.4)), Math.max(1, Math.round(h * 0.15)), L[2]);
    pix.set(Math.round(lx) - 1, Math.round(ly) - 1, L[3]);
    pix.set(Math.round(lx), Math.round(ly) - 2, L[3]);
  }
  // stems into the pot
  pix.line(cx, cy, cx - 2, cy - h * 0.4, L[0]);
  pix.line(cx, cy, cx + 3, cy - h * 0.35, L[0]);
}

export const SHOP_ORDER = ['table_round', 'table_square', 'chair', 'stool', 'armchair', 'sofa', 'counter', 'pastry', 'bookshelf', 'plant_big', 'plant_small', 'rug', 'floor_lamp', 'cat_tree', 'cat_bed',
  'chabudai', 'zabuton', 'andon', 'bonsai', 'shoji_screen',
  'wicker_chair', 'flower_box', 'quilt_rug', 'tea_hutch',
  'hay_bale', 'pumpkins', 'apple_crate', 'maple_rug',
  'xmas_tree', 'gifts', 'fireplace'];

// themed furniture collections, shown as their own tabs in the shop
export const SETS = { kyoto: 'Kyoto', cottage: 'Cottage', autumn: 'Autumn', winter: 'Winter' };
