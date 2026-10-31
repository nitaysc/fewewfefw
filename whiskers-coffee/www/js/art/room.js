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

// wallpapers and floors the players can buy; the first of each is what a café starts with
export const WALL_STYLES = {
  cream: { name: 'Cream plaster', price: 0, base: P.cream, stripe: P.creamShade, pattern: 'stripe', wains: P.wainscot, wainsLight: P.wainscotLight },
  sage: { name: 'Sage stripes', price: 90, base: '#b4c29a', stripe: '#a2b287', pattern: 'stripe', wains: '#4f3a28', wainsLight: '#624830' },
  rose: { name: 'Rose garden', price: 120, base: '#ecd0c4', stripe: '#c9786f', leaf: '#8fa070', pattern: 'flowers', wains: '#6e4630', wainsLight: '#83563a' },
  navy: { name: 'Midnight stars', price: 140, base: '#3f4c6e', stripe: '#d2b05a', pattern: 'dots', wains: '#3b261a', wainsLight: '#4a3020' },
  brick: { name: 'Old brick', price: 150, base: '#a2553c', stripe: '#d9c3a5', pattern: 'brick', wains: '#4a3020', wainsLight: '#5b3a26' },
  shoji: { name: 'Paper screens', price: 160, base: '#f1e7d0', stripe: '#6e4630', pattern: 'shoji', wains: '#b98a5a', wainsLight: '#c99a68' },
  cabin: { name: 'Cabin planks', price: 130, base: '#9c6a42', stripe: '#5e3c24', pattern: 'planks', wains: '#5b3a26', wainsLight: '#6e4630' },
};
export const FLOOR_STYLES = {
  oak: { name: 'Oak planks', price: 0, kind: 'planks', cols: P.oak, gap: P.oakGap },
  walnut: { name: 'Walnut planks', price: 110, kind: 'planks', cols: ['#5a3a26', '#634029', '#523422', '#6a452c'], gap: '#36231a' },
  birch: { name: 'Birch planks', price: 110, kind: 'planks', cols: ['#d2ad7c', '#dab689', '#c9a372', '#deba8f'], gap: '#a8835a' },
  checker: { name: 'Checker tiles', price: 140, kind: 'checker', cols: ['#e6d8ba', '#6b4f3e'] },
  terracotta: { name: 'Terracotta', price: 130, kind: 'tiles', cols: ['#b8623f', '#c06a45', '#ad5a3a', '#c4724c'], gap: '#e0c6a4' },
  tatami: { name: 'Tatami mats', price: 160, kind: 'tatami', cols: ['#c2bb7c', '#b5ae70', '#cbc488'], gap: '#3d3a22' },
};
export const WALL_ORDER = Object.keys(WALL_STYLES), FLOOR_ORDER = Object.keys(FLOOR_STYLES);

export function paintRoom(W, H, walls = DEFAULT_WALLS, floorStyle = 'oak', wallStyle = 'cream') {
  const minx = -H * 16 - 10, maxx = W * 16 + 10, miny = -WALL_H - 12, maxy = (W + H) * 8 + 6;
  const pix = new Pix(maxx - minx, maxy - miny);
  pix.ox = -minx; pix.oy = -miny;
  const windows = [];
  const ws = WALL_STYLES[wallStyle] || WALL_STYLES.cream;

  paintFloor(pix, W, H, FLOOR_STYLES[floorStyle] || FLOOR_STYLES.oak);
  paintWall(pix, 'north', W, walls.north, windows, ws);
  paintWall(pix, 'west', H, walls.west, windows, ws);
  paintGreenery(pix, 'north', W * 16, walls.north);
  paintGreenery(pix, 'west', H * 16, walls.west);
  paintWallCaps(pix, W, H);

  pix.ox = 0; pix.oy = 0;
  return { pix, ax: -minx, ay: -miny, windows };
}

// a little sample of a wallpaper (straight on) or a floor (a 2x2 iso corner) for the shop
export function styleSwatch(kind, id) {
  const pix = new Pix(64, 36);
  if (kind === 'wall') {
    const s = WALL_STYLES[id];
    const face = (u0, u1, z0, z1, c) => pix.rect(Math.round(u0), Math.round(36 - z1), Math.round(u1 - u0), Math.round(z1 - z0), c);
    wallpaper(face, s, 64, 11, 36, 0, 'north');
    face(0, 64, 0, 11, s.wains);
    for (let u = 0; u < 64; u += 16) face(u + 2, u + 14, 2, 8, s.wainsLight);
    face(0, 64, 10, 11, P.woodPale);
  } else {
    pix.ox = 32; pix.oy = 1;
    paintFloor(pix, 2, 2, FLOOR_STYLES[id], false);
    pix.ox = 0; pix.oy = 0;
  }
  return pix;
}

function quad(pix, pts, c) { pix.poly(pts.map(([x, y, z]) => proj(x, y, z)), c); }

function paintFloor(pix, W, H, style, wallShadow = true) {
  const total = W * 16, depth = H * 16;
  const cols = style.cols;
  if (style.kind === 'planks') {
    // planks run along x; rows are 5 units deep
    for (let row = 0, y = 0; y < depth; row++, y += 5) {
      const y1 = Math.min(depth, y + 5);
      let x = -((row * 7) % 3) * 9;
      let k = 0;
      while (x < total) {
        const len = 24 + Math.floor(hash(row, k, 3) * 4) * 8;
        const x0 = Math.max(0, x), x1 = Math.min(total, x + len);
        const base = cols[Math.floor(hash(row, k, 1) * cols.length)];
        quad(pix, [[x0, y, 0], [x1, y, 0], [x1, y1, 0], [x0, y1, 0]], base);
        // grain flecks
        for (let g = 0; g < (x1 - x0) / 5; g++) {
          const gx = x0 + hash(row, k * 31 + g, 7) * (x1 - x0), gy = y + 1 + hash(row, k * 17 + g, 9) * 3;
          const [sx, sy] = proj(gx, gy, 0);
          pix.set(sx, sy, shade(base, hash(g, row, 5) > 0.5 ? 1.08 : 0.9));
          pix.set(sx + 1, sy, shade(base, 0.94));
        }
        // end joint
        if (x1 < total) { const [ax, ay] = proj(x1, y, 0), [bx, by] = proj(x1, y1, 0); pix.line(ax, ay, bx, by, style.gap); }
        x += len; k++;
      }
      const [ax, ay] = proj(0, y1, 0), [bx, by] = proj(total, y1, 0);
      if (y1 < depth) pix.isoline(ax, ay, bx, by, shade(style.gap, 1.15));
    }
  } else if (style.kind === 'checker' || style.kind === 'tiles') {
    const T = style.kind === 'checker' ? 16 : 8;
    for (let j = 0; j < depth / T; j++) for (let i = 0; i < total / T; i++) {
      const x0 = i * T, y0 = j * T, x1 = x0 + T, y1 = y0 + T;
      let c = style.kind === 'checker' ? cols[(i + j) & 1] : cols[Math.floor(hash(i, j, 11) * cols.length)];
      if (style.kind === 'checker') c = shade(c, 0.96 + hash(i, j, 4) * 0.08);
      quad(pix, [[x0, y0, 0], [x1, y0, 0], [x1, y1, 0], [x0, y1, 0]], c);
      if (style.kind === 'tiles') {
        // grout along two edges of every tile, and a speck of glaze
        const [ax, ay] = proj(x0, y1, 0), [bx, by] = proj(x1, y1, 0), [cx, cy] = proj(x1, y0, 0);
        pix.isoline(ax, ay, bx, by, style.gap); pix.isoline(cx, cy, bx, by, shade(style.gap, 0.9));
        const [sx, sy] = proj(x0 + 3, y0 + 3, 0); pix.set(sx, sy, shade(c, 1.12));
      } else {
        const [sx, sy] = proj(x0 + 2, y0 + 2, 0); pix.set(sx, sy, shade(c, 1.06));
      }
    }
  } else if (style.kind === 'tatami') {
    // mats of 1x2 tiles laid in alternating directions, with dark cloth borders
    for (let j = 0; j < H; j += 2) for (let i = 0; i < W; i++) {
      const across = ((i + j / 2) & 1) === 0;
      const mats = across ? [[i * 16, j * 16, 16, 32]] : [[i * 16, j * 16, 16, 16], [i * 16, j * 16 + 16, 16, 16]];
      for (const [x0, y0, w, d] of mats) {
        const yy1 = Math.min(depth, y0 + d);
        if (y0 >= depth) continue;
        const c = cols[Math.floor(hash(i, j + y0, 13) * cols.length)];
        quad(pix, [[x0, y0, 0], [x0 + w, y0, 0], [x0 + w, yy1, 0], [x0, yy1, 0]], c);
        // straw weave: fine lines along the long side
        for (let v = 2; v < (yy1 - y0); v += 3) {
          const [ax, ay] = proj(x0 + 1, y0 + v, 0), [bx, by] = proj(x0 + w - 1, y0 + v, 0);
          pix.isoline(ax, ay, bx, by, shade(c, 0.93));
        }
        const e = (a, b, c2, d2) => { const [ax, ay] = proj(a, b, 0), [bx, by] = proj(c2, d2, 0); pix.isoline(ax, ay, bx, by, style.gap); };
        e(x0, yy1, x0 + w, yy1); e(x0 + w, y0, x0 + w, yy1);
      }
    }
  }
  if (!wallShadow) return;
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

// the wallpaper above the wainscot: face(u0, u1, z0, z1, colour) paints a patch of the wall
function wallpaper(face, s, L, zBottom, zTop, seed, side) {
  const C = (c) => c;
  face(0, L, zBottom, zTop, C(s.base));
  if (s.pattern === 'stripe') {
    for (let u = 4; u < L; u += 8) face(u, u + 1, zBottom, zTop - 4, C(s.stripe));
  } else if (s.pattern === 'dots') {
    for (let z = zBottom + 5, r = 0; z < zTop - 5; z += 9, r++) for (let u = (r & 1) * 5 + 2; u < L - 1; u += 10) {
      face(u, u + 1, z, z + 1, C(s.stripe));
      if (hash(u, z, 3) > 0.6) { face(u - 1, u, z, z + 1, C(shade(s.stripe, 0.8))); face(u + 1, u + 2, z, z + 1, C(shade(s.stripe, 0.8))); }
    }
  } else if (s.pattern === 'flowers') {
    for (let z = zBottom + 6, r = 0; z < zTop - 6; z += 11, r++) for (let u = (r & 1) * 6 + 3; u < L - 3; u += 12) {
      face(u, u + 1, z - 3, z, C(s.leaf));
      face(u + 1, u + 2, z - 2, z - 1, C(s.leaf));
      face(u - 1, u + 2, z, z + 1, C(s.stripe));
      face(u, u + 1, z - 1, z + 2, C(s.stripe));
      face(u, u + 1, z, z + 1, C('#f2d27a'));
    }
  } else if (s.pattern === 'brick') {
    for (let z = zBottom, r = 0; z < zTop; z += 5, r++) {
      for (let u = r & 1 ? -6 : 0, k = 0; u < L; u += 12, k++) {
        const c = shade(s.base, 0.88 + hash(k, r, side.length + seed) * 0.24);
        face(Math.max(0, u), Math.min(L, u + 11), z, Math.min(zTop, z + 4), C(c));
      }
      face(0, L, z + 4, Math.min(zTop, z + 5), C(s.stripe));
      for (let u = r & 1 ? 5 : 11; u < L; u += 12) face(u, u + 1, z, Math.min(zTop, z + 4), C(s.stripe));
    }
  } else if (s.pattern === 'shoji') {
    for (let u = 0; u < L; u += 8) face(u, u + 1, zBottom, zTop, C(s.stripe));
    for (let z = zBottom + 9; z < zTop; z += 10) face(0, L, z, z + 1, C(s.stripe));
    for (let u = 1; u < L; u += 8) face(u, u + 1, zBottom, zTop, C(shade(s.base, 0.95)));
  } else if (s.pattern === 'planks') {
    for (let u = 0, k = 0; u < L; u += 6, k++) {
      face(u, u + 6, zBottom, zTop, C(shade(s.base, 0.9 + hash(k, 2, side.length) * 0.2)));
      face(u + 5, u + 6, zBottom, zTop, C(s.stripe));
      if (hash(k, 5, 1) > 0.5) face(u + 2, u + 3, zBottom + 10 + hash(k, 1, 2) * 30, zBottom + 12 + hash(k, 1, 2) * 30, C(s.stripe));
    }
  }
}

// the face of a wall: u runs along the wall (iso units), z is the height
function wallPoint(side, u, z, inset = 0) { return side === 'north' ? [u, inset, z] : [inset, u, z]; }

function paintWall(pix, side, lenTiles, features, windows, ws = WALL_STYLES.cream) {
  const L = lenTiles * 16;
  const face = (u0, u1, z0, z1, c, inset = 0) => quad(pix, [wallPoint(side, u0, z1, inset), wallPoint(side, u1, z1, inset), wallPoint(side, u1, z0, inset), wallPoint(side, u0, z0, inset)], c);
  const lit = side === 'north' ? 1 : 0.86; // the west wall faces away from the light a little
  const C = (c) => shade(c, lit);

  // wallpaper above, wainscot panels below
  wallpaper((u0, u1, z0, z1, c) => face(u0, u1, z0, z1, C(c)), ws, L, 31, WALL_H, 0, side);
  face(0, L, 0, 31, C(ws.wains));
  for (let u = 0; u < L; u += 16) {
    face(u + 2, u + 14, 6, 25, C(ws.wainsLight));
    face(u + 3, u + 13, 7, 24, C(ws.wains));
    face(u + 2, u + 14, 24, 25, C(shade(ws.wainsLight, 1.15)));
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

// ivy trailing down from the top of the wall, and a few hanging pots, for a lush café
function paintGreenery(pix, side, L, features) {
  const at = (u, z) => proj(...wallPoint(side, u, z, 0.5));
  const L4 = ['#2f5228', '#3f6b35', '#5c8f3f', '#7fb04c'];
  const busy = (u) => features.some((f) => u > f.at * 16 - 4 && u < (f.at + f.len) * 16 + 4 && f.type !== 'clock');
  for (let u = 3; u < L - 2; u += 5 + Math.floor(hash(u, side.length, 31) * 6)) {
    const len = busy(u) ? 4 + Math.floor(hash(u, 2, 7) * 6) : 8 + Math.floor(hash(u, 3, 7) * 24);
    let du = 0;
    for (let k = 0; k < len; k++) {
      du += (hash(u, k, 9) - 0.5) * 0.9;
      const [x, y] = at(u + du, WALL_H - 3 - k);
      pix.set(x, y, '#3f5a2a');
      if (k % 3 === 1) { const side2 = hash(u, k, 3) > 0.5 ? 1 : -1; pix.set(x + side2, y, L4[2 + (k % 2)]); pix.set(x + side2 * 2, y, L4[1]); pix.set(x + side2, y - 1, L4[3]); }
    }
  }
  // garland along the very top
  for (let u = 0; u < L; u += 2) { const [x, y] = at(u, WALL_H - 2 - Math.round(Math.sin(u * 0.4) * 1.5)); pix.set(x, y, L4[(u >> 1) % 4]); pix.set(x, y + 1, L4[1]); }
  // hanging pots between features
  for (let u = 24; u < L - 10; u += 40) {
    if (busy(u)) continue;
    const [x, y] = at(u, 66);
    pix.line(x, y - 14, x, y - 3, '#5b3a26');
    pix.line(x - 3, y - 2, x, y - 8, '#5b3a26'); pix.line(x + 3, y - 2, x, y - 8, '#5b3a26');
    pix.rect(x - 3, y - 2, 7, 4, '#b8623f'); pix.hline(x - 3, x + 3, y - 2, '#d47a52'); pix.hline(x - 2, x + 2, y + 2, '#8e4a2f');
    for (let k = 0; k < 9; k++) { pix.set(x - 4 - (k % 2), y + k, L4[(k + 1) % 4]); pix.set(x + 4 + ((k + 1) % 2), y + k + 1, L4[k % 4]); pix.set(x - 1 + (k % 3), y - 3, L4[3]); }
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
