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
    name: 'Round table', cat: 'furniture', price: 60, size: [1, 1], seatable: false, surface: 12,
    paint(p) {
      p.cyl(8, 8, 0, 4, 1, P.woodDark).cyl(8, 8, 1, 1.4, 10, P.woodDark)
        .cyl(8, 8, 11, 7, 2, { top: P.woodLight, left: P.wood, right: P.woodDark }, { rim: true });
    },
  },
  table_square: {
    name: 'Café table', cat: 'furniture', price: 70, size: [1, 1], surface: 12,
    paint(p) {
      legs(p, 2, 2, 14, 14, 11, P.woodDark);
      p.box(1, 1, 11, 14, 14, 2, { top: P.woodLight, left: P.wood, right: P.woodDark }, { order: 2 })
        .faceLine('top', 2, 5, 13, 5, shade(P.woodLight, 0.92)).faceLine('top', 2, 10, 13, 10, shade(P.woodLight, 0.92));
    },
  },
  chair: {
    name: 'Wooden chair', cat: 'furniture', price: 35, size: [1, 1], seat: true, rotates: true,
    paint(p) {
      legs(p, 4, 4, 13, 13, 7, P.woodDark);
      p.box(3, 3, 7, 11, 11, 2, { top: P.wood, left: P.woodDark, right: shade(P.woodDark, 0.8) }, { order: 1 });
      p.box(3, 3, 9, 11, 2, 11, { top: P.woodLight, left: P.wood, right: P.woodDark }, { order: -3 })
        .faceRect('y', 2, 2, 7, 2, P.woodLight).faceRect('y', 2, 6, 7, 1, shade(P.wood, 1.1));
    },
  },
  stool: {
    name: 'Bar stool', cat: 'furniture', price: 25, size: [1, 1], seat: true,
    paint(p) {
      legs(p, 4, 4, 12, 12, 12, P.woodDark);
      p.cyl(8, 8, 12, 5, 2, { top: P.rose, left: shade(P.rose, 0.85), right: shade(P.rose, 0.7) }, { order: 3 });
    },
  },
  armchair: {
    name: 'Armchair', cat: 'furniture', price: 120, size: [1, 1], seat: true, rotates: true,
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
    name: 'Velvet sofa', cat: 'furniture', price: 220, size: [2, 1], seat: true, rotates: true,
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
    name: 'Floor lamp', cat: 'decor', price: 65, size: [1, 1], light: true,
    paint(p) {
      p.cyl(8, 8, 0, 3, 1, P.metalDark).cyl(8, 8, 1, 0.7, 30, P.metalDark)
        .cyl(8, 8, 30, 4, 7, { top: P.lampHot, left: '#f2d9a2', right: '#d9b97a' }, { order: 1 });
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

export const SHOP_ORDER = ['table_round', 'table_square', 'chair', 'stool', 'armchair', 'sofa', 'counter', 'pastry', 'bookshelf', 'plant_big', 'plant_small', 'rug', 'floor_lamp', 'cat_tree', 'cat_bed'];
