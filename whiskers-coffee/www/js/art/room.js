// The café shell: plank floor and the two back walls, painted as one dollhouse cutaway.
// Windows are returned with their glass shapes so the renderer can animate rain behind them.
import { Pix, shade, hash, mix } from './pix.js';
import { proj } from './iso.js';
import { P } from './palette.js';

export const WALL_H = 86;

// wall features, in tiles along each wall
export const DEFAULT_WALLS = {
  north: [
    { type: 'window', at: 1, len: 2 },
    { type: 'chalkboard', at: 4, len: 2 },
    { type: 'clock', at: 6.4, len: 0.6 },
    { type: 'window', at: 7.5, len: 2 },
  ],
  west: [
    { type: 'shelf', at: 0.8, len: 2 },
    { type: 'painting', at: 3.3, len: 1.2 },
    { type: 'door', at: 5.5, len: 1.5 },
  ],
};

export function paintRoom(W, H, walls = DEFAULT_WALLS, floorStyle = 'oak') {
  const minx = -H * 16 - 10, maxx = W * 16 + 10, miny = -WALL_H - 12, maxy = (W + H) * 8 + 6;
  const pix = new Pix(maxx - minx, maxy - miny);
  pix.ox = -minx; pix.oy = -miny;
  const windows = [];

  paintFloor(pix, W, H, floorStyle);
  paintWall(pix, 'north', W, walls.north, windows);
  paintWall(pix, 'west', H, walls.west, windows);
  paintWallCaps(pix, W, H);

  pix.ox = 0; pix.oy = 0;
  return { pix, ax: -minx, ay: -miny, windows };
}

function quad(pix, pts, c) { pix.poly(pts.map(([x, y, z]) => proj(x, y, z)), c); }

function paintFloor(pix, W, H, style) {
  const total = W * 16, depth = H * 16;
  // planks run along x; rows are 5 units deep
  for (let row = 0, y = 0; y < depth; row++, y += 5) {
    const y1 = Math.min(depth, y + 5);
    let x = -((row * 7) % 3) * 9;
    let k = 0;
    while (x < total) {
      const len = 24 + Math.floor(hash(row, k, 3) * 4) * 8;
      const x0 = Math.max(0, x), x1 = Math.min(total, x + len);
      const base = P.oak[Math.floor(hash(row, k, 1) * P.oak.length)];
      quad(pix, [[x0, y, 0], [x1, y, 0], [x1, y1, 0], [x0, y1, 0]], base);
      // grain flecks
      for (let g = 0; g < (x1 - x0) / 5; g++) {
        const gx = x0 + hash(row, k * 31 + g, 7) * (x1 - x0), gy = y + 1 + hash(row, k * 17 + g, 9) * 3;
        const [sx, sy] = proj(gx, gy, 0);
        pix.set(sx, sy, shade(base, hash(g, row, 5) > 0.5 ? 1.08 : 0.9));
        pix.set(sx + 1, sy, shade(base, 0.94));
      }
      // end joint
      if (x1 < total) { const [ax, ay] = proj(x1, y, 0), [bx, by] = proj(x1, y1, 0); pix.line(ax, ay, bx, by, P.oakGap); }
      x += len; k++;
    }
    const [ax, ay] = proj(0, y1, 0), [bx, by] = proj(total, y1, 0);
    if (y1 < depth) pix.isoline(ax, ay, bx, by, shade(P.oakGap, 1.15));
  }
  // soft dithered shadow where the floor meets the walls
  for (let y = 0; y < depth; y++) for (let x = 0; x < total; x++) {
    const d = Math.min(x, y);
    if (d > 10) continue;
    const [sx, sy] = proj(x, y, 0);
    const k = d < 3 ? 2 : d < 6 ? 1 : 0;
    if (k === 2 || (k === 1 && ((Math.round(sx) + Math.round(sy)) & 1))) {
      const cur = pix.get(sx, sy);
      if (cur) pix.set(sx, sy, '#2a180e44');
    }
  }
}

// the face of a wall: u runs along the wall (iso units), z is the height
function wallPoint(side, u, z, inset = 0) { return side === 'north' ? [u, inset, z] : [inset, u, z]; }

function paintWall(pix, side, lenTiles, features, windows) {
  const L = lenTiles * 16;
  const face = (u0, u1, z0, z1, c, inset = 0) => quad(pix, [wallPoint(side, u0, z1, inset), wallPoint(side, u1, z1, inset), wallPoint(side, u1, z0, inset), wallPoint(side, u0, z0, inset)], c);
  const lit = side === 'north' ? 1 : 0.86; // the west wall faces away from the light a little
  const C = (c) => shade(c, lit);

  // plaster with a faint vertical stripe pattern
  face(0, L, 31, WALL_H, C(P.cream));
  for (let u = 4; u < L; u += 8) face(u, u + 1, 31, WALL_H - 4, C(P.creamShade));
  // wainscot panels
  face(0, L, 0, 31, C(P.wainscot));
  for (let u = 0; u < L; u += 16) {
    face(u + 2, u + 14, 6, 25, C(P.wainscotLight));
    face(u + 3, u + 13, 7, 24, C(P.wainscot));
    face(u + 2, u + 14, 24, 25, C(shade(P.wainscotLight, 1.15)));
  }
  face(0, L, 28, 31, C(P.woodLight));
  face(0, L, 30, 31, C(P.woodPale));
  face(0, L, 0, 3, C(shade(P.woodDark, 0.8)));
  face(0, L, WALL_H - 4, WALL_H, C(P.woodLight));
  face(0, L, WALL_H - 5, WALL_H - 4, C(P.woodDark));

  for (const f of features) {
    const u0 = f.at * 16, u1 = (f.at + f.len) * 16;
    if (f.type === 'window') {
      const z0 = 36, z1 = 74;
      face(u0 - 2, u1 + 2, z0 - 3, z1 + 2, C(P.woodDark));
      // glass: evening sky gradient with a far-away skyline
      for (let z = z0; z < z1; z++) {
        const t = (z - z0) / (z1 - z0);
        face(u0, u1, z, z + 1, P.sky[Math.min(3, Math.floor((1 - t) * 4))]);
      }
      for (let u = u0; u < u1; u += 3) {
        const hgt = 4 + Math.floor(hash(u, side === 'north' ? 1 : 2, 4) * 10);
        face(u, u + 3, z0, z0 + hgt, '#2c3346');
        if (hash(u, 9, 2) > 0.55) face(u + 1, u + 2, z0 + hgt - 3, z0 + hgt - 2, '#e9c46a');
      }
      // frame bars and sill
      face(u0, u1, z0 + 18, z0 + 20, C(P.woodDark));
      face((u0 + u1) / 2 - 1, (u0 + u1) / 2 + 1, z0, z1, C(P.woodDark));
      face(u0 - 3, u1 + 3, z0 - 4, z0 - 2, C(P.woodPale));
      windows.push({ side, u0, u1, z0, z1 });
    } else if (f.type === 'chalkboard') {
      const z0 = 38, z1 = 74;
      face(u0, u1, z0, z1, C(P.woodDark));
      face(u0 + 2, u1 - 2, z0 + 2, z1 - 2, P.chalk);
      // menu: a cup doodle, a title and lines of "text"
      const cu = u0 + 6;
      face(cu, cu + 5, z1 - 13, z1 - 8, P.chalkLine);
      face(cu + 1, cu + 4, z1 - 12, z1 - 9, P.chalk);
      face(cu + 5, cu + 6, z1 - 12, z1 - 10, P.chalkLine);
      face(u0 + 14, u1 - 6, z1 - 9, z1 - 8, '#e7a0a6');
      for (let r = 0; r < 4; r++) {
        const z = z1 - 16 - r * 5;
        face(u0 + 5, u0 + 5 + 8 + hash(r, 2, side.length) * 8, z, z + 1, P.chalkLine);
        face(u1 - 9, u1 - 5, z, z + 1, '#f2d27a');
      }
    } else if (f.type === 'clock') {
      const cu = (u0 + u1) / 2, cz = 62;
      for (let a = 0; a < 24; a++) {
        const an = (a / 24) * Math.PI * 2;
        const [x, y] = proj(...wallPoint(side, cu + Math.cos(an) * 5, cz + Math.sin(an) * 5));
        pix.set(x, y, P.woodDark);
      }
      for (let r = 0; r < 5; r++) for (let a = 0; a < 20; a++) {
        const an = (a / 20) * Math.PI * 2;
        const [x, y] = proj(...wallPoint(side, cu + Math.cos(an) * r, cz + Math.sin(an) * r));
        pix.set(x, y, '#f4efe6');
      }
      const hand = (len, an, c) => { for (let t = 0; t <= len; t += 0.5) { const [x, y] = proj(...wallPoint(side, cu + Math.cos(an) * t, cz + Math.sin(an) * t)); pix.set(x, y, c); } };
      hand(3.5, Math.PI / 2, P.ink); hand(2.5, -0.3, P.ink);
    } else if (f.type === 'painting') {
      const z0 = 44, z1 = 66;
      face(u0, u1, z0, z1, C(P.woodPale));
      face(u0 + 2, u1 - 2, z0 + 2, z1 - 2, '#a9c2c9');
      face(u0 + 2, u1 - 2, z0 + 2, z0 + 9, '#6d8a58');
      face(u0 + 4, u0 + 10, z0 + 9, z0 + 14, '#4f6a40');
      face(u1 - 7, u1 - 4, z1 - 8, z1 - 5, '#f2d27a');
    } else if (f.type === 'shelf') {
      // a plank on brackets with jars, cups and a little plant
      const z = 52;
      paintShelf(pix, side, u0, u1, z);
      paintShelf(pix, side, u0, u1, z - 16);
    } else if (f.type === 'door') {
      const z1 = 60;
      face(u0 - 2, u1 + 2, 0, z1 + 3, C(P.woodDark));
      face(u0, u1, 0, z1, C(P.wood));
      face(u0 + 2, u1 - 2, 30, z1 - 3, P.sky[2]);
      face(u0 + 2, u1 - 2, 42, 43, C(P.wood));
      face(u0 + 3, u1 - 3, 6, 26, C(shade(P.wood, 1.1)));
      face(u1 - 5, u1 - 3, 26, 28, P.mustard);
      // "OPEN" sign
      face(u0 + 4, u1 - 4, 46, 52, '#f4efe6');
      face(u0 + 5, u1 - 5, 48, 50, P.red);
      windows.push({ side, u0: u0 + 2, u1: u1 - 2, z0: 30, z1: z1 - 3, door: true });
    }
  }
}

function paintShelf(pix, side, u0, u1, z) {
  const pt = (u, d, h) => (side === 'north' ? [u, d, h] : [d, u, h]);
  const q = (pts, c) => pix.poly(pts.map((a) => proj(...a)), c);
  // plank top and front edge
  q([pt(u0, 0, z), pt(u1, 0, z), pt(u1, 7, z), pt(u0, 7, z)], P.woodPale);
  q([pt(u0, 7, z), pt(u1, 7, z), pt(u1, 7, z - 2), pt(u0, 7, z - 2)], side === 'north' ? P.wood : P.woodDark);
  // items: jars of beans, cups, a plant
  let u = u0 + 2, i = 0;
  while (u < u1 - 4) {
    const kind = i % 4;
    const [cx, cy] = proj(...pt(u + 2, 3.5, z));
    if (kind === 0 || kind === 2) {
      // jar
      for (let y = 0; y < 8; y++) for (let x = -2; x <= 2; x++) pix.set(cx + x, cy - y, y < 6 ? (x === -2 ? '#7a4e30' : '#5b3a26') : '#d9e9ec');
      pix.rect(cx - 2, cy - 9, 5, 1, P.woodPale);
      pix.set(cx + 1, cy - 4, '#c08a55');
    } else if (kind === 1) {
      // stacked cups
      for (let s = 0; s < 2; s++) { pix.rect(cx - 2, cy - 3 - s * 3, 4, 3, '#f4efe6'); pix.set(cx + 2, cy - 2 - s * 3, '#d9d2c4'); }
    } else {
      // little plant
      pix.rect(cx - 1, cy - 3, 3, 3, P.terracotta);
      pix.ellipse(cx, cy - 6, 2, 2, P.leaf[2]);
      pix.set(cx - 1, cy - 7, P.leaf[3]);
    }
    u += 6; i++;
  }
}

function paintWallCaps(pix, W, H) {
  const t = 6, top = WALL_H;
  const q = (pts, c) => pix.poly(pts.map((a) => proj(...a)), c);
  // tops of the walls, like the edge of a dollhouse cutaway
  q([[-t, -t, top], [W * 16, -t, top], [W * 16, 0, top], [0, 0, top], [0, H * 16, top], [-t, H * 16, top]], '#3b261a');
  // cut ends
  q([[W * 16, -t, top], [W * 16, 0, top], [W * 16, 0, 0], [W * 16, -t, 0]], '#2c1c13');
  q([[-t, H * 16, top], [0, H * 16, top], [0, H * 16, 0], [-t, H * 16, 0]], '#33211a');
  // floor edge slab
  q([[0, H * 16, 0], [W * 16, H * 16, 0], [W * 16, H * 16, -6], [0, H * 16, -6]], '#3b261a');
  q([[W * 16, 0, 0], [W * 16, H * 16, 0], [W * 16, H * 16, -6], [W * 16, 0, -6]], '#2c1c13');
}

export { mix };
