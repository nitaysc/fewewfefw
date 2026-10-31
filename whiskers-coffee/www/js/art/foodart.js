// Detailed food art for the kitchen close-up: every ingredient and base is painted pixel by
// pixel with light from the top left, so a strawberry has seeds and leaves, a cheesecake
// has its baked top and biscuit crust, a kiwi has its seed ring. These are drawn at the
// kitchen's high resolution; the small café plates use simpler shapes.
import { shade, hash, mix } from './pix.js';

const INK = '#24160f';

// fill a shape given by a test on normalised coordinates; col(nx, ny, x, y) picks the colour
function blob(p, cx, cy, rx, ry, inside, col) {
  for (let y = Math.floor(-ry - 1); y <= Math.ceil(ry + 1); y++) for (let x = Math.floor(-rx - 1); x <= Math.ceil(rx + 1); x++) {
    const nx = x / rx, ny = y / ry;
    if (inside(nx, ny, x, y)) { const c = col(nx, ny, x, y); if (c) p.set(cx + x, cy + y, c); }
  }
}
const disk = (nx, ny) => nx * nx + ny * ny <= 1;
// light from the top left: k > 0 brighter
const lit = (c, nx, ny, amt = 0.18) => shade(c, 1 + (-nx * 0.6 - ny * 0.8) * amt);
// edge of a disk (for outlines)
const rim = (nx, ny, w = 0.18) => nx * nx + ny * ny > (1 - w) * (1 - w);

// all scanline pixels inside a polygon
export function polyPixels(pts) {
  const out = [];
  let minY = Infinity, maxY = -Infinity;
  for (const [, y] of pts) { minY = Math.min(minY, y); maxY = Math.max(maxY, y); }
  for (let y = Math.floor(minY); y <= Math.ceil(maxY); y++) {
    const sy = y + 0.5, xs = [];
    for (let i = 0; i < pts.length; i++) {
      const [ax, ay] = pts[i], [bx, by] = pts[(i + 1) % pts.length];
      if ((ay <= sy && by > sy) || (by <= sy && ay > sy)) xs.push(ax + ((sy - ay) / (by - ay)) * (bx - ax));
    }
    xs.sort((a, b) => a - b);
    for (let k = 0; k + 1 < xs.length; k += 2) for (let x = Math.round(xs[k]); x < Math.round(xs[k + 1]); x++) out.push([x, y]);
  }
  return out;
}
// outline: pixels next to a filled set
function outlineOf(p, pixels, c) {
  const set = new Set(pixels.map(([x, y]) => x + ',' + y));
  for (const [x, y] of pixels) for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) if (!set.has((x + dx) + ',' + (y + dy))) p.set(x + dx, y + dy, c);
}

// ---------- ingredients ----------
export const HD = {
  strawberry(p, x, y, r) {
    const flip = r % 4 >= 2 ? -1 : 1, half = r % 2 === 1;
    const w = (yy) => { const t = (yy + 5) / 11; return t < 0 || t > 1 ? -1 : t < 0.3 ? 3.6 + t * 4 : 4.8 * Math.pow(1 - (t - 0.3) / 0.7, 0.75); };
    const inside = (xx, yy) => Math.abs(xx) <= w(yy) + (half ? 0.4 : 0);
    // outline first
    for (let yy = -6; yy <= 7; yy++) for (let xx = -6; xx <= 6; xx++) if (!inside(xx, yy) && (inside(xx + 1, yy) || inside(xx - 1, yy) || inside(xx, yy - 1) || inside(xx, yy + 1))) p.set(x + xx * flip, y + yy, '#6a1018');
    for (let yy = -5; yy <= 6; yy++) for (let xx = -6; xx <= 6; xx++) {
      if (!inside(xx, yy)) continue;
      const ww = Math.max(0.5, w(yy)), nx = xx / ww, edge = Math.abs(xx) >= ww - 0.8 || yy === 6;
      let c;
      if (half && !edge) {
        // cut in half: pale flesh, white heart down the middle, red seeds near the skin
        c = Math.abs(nx) < 0.25 ? '#fff4f2' : Math.abs(nx) < 0.6 ? '#ffc4c8' : '#f47884';
        if (Math.abs(nx) > 0.55 && (xx + yy) % 3 === 0) c = '#e8a040';
      } else {
        c = lit('#d8283a', nx, (yy + 0.5) / 6, 0.25);
        if (!edge && (xx * 2 + yy * 3 + 20) % 5 === 0) { c = '#f6d870'; p.set(x + xx * flip, y + yy + 1, '#9c1c28'); }
      }
      p.set(x + xx * flip, y + yy, c);
    }
    if (!half) { p.set(x - 2 * flip, y - 3, '#ff8a90'); p.set(x - 2 * flip, y - 2, '#ff6a72'); }
    // leafy cap and stem
    for (const [lx, ly] of [[-4, -5], [-3, -6], [-2, -5], [0, -6], [2, -5], [3, -6], [4, -5], [-1, -5], [1, -5]]) p.set(x + lx * flip, y + ly, (lx + ly) % 2 ? '#3f7a2a' : '#5c9a3a');
    p.set(x - 1 * flip, y - 6, '#7cc05a'); p.set(x, y - 7, '#4f8a3a'); p.set(x, y - 8, '#3f6a2a');
  },
  blueberry(p, x, y, r) {
    blob(p, x, y, 3.4, 3.4, disk, (nx, ny) => (rim(nx, ny, 0.2) ? '#1a2048' : lit('#3a4684', nx, ny, 0.35)));
    p.set(x - 1, y - 2, '#a8b4e8'); p.set(x - 2, y - 1, '#7a88c8');
    if (r % 3) { p.set(x + 1, y + 1, '#8a94c8'); p.set(x - 1, y + 1, '#5a66a0'); }
    // the little crown
    p.set(x, y, '#141a38'); p.set(x + 1, y, '#232b5a'); p.set(x - 1, y, '#232b5a'); p.set(x, y - 1, '#232b5a'); p.set(x, y + 1, '#232b5a');
  },
  raspberry(p, x, y, r) {
    blob(p, x, y, 5, 4.6, disk, () => '#6a1028');
    const pts = [[0, 0], [-2, -2], [2, -2], [-3, 0], [3, 0], [-2, 2], [2, 2], [0, -3], [0, 3], [-1, -1], [1, 1]];
    for (const [dx, dy] of pts) {
      blob(p, x + dx, y + dy, 1.4, 1.4, disk, (nx, ny) => lit('#d0305a', nx, ny, 0.3));
      p.set(x + dx - 1, y + dy - 1, '#ff9ab4');
    }
    if (r % 2) { p.set(x, y, '#5a0c20'); p.set(x + 1, y, '#7a1430'); }
  },
  banana(p, x, y) {
    blob(p, x, y, 4.6, 4.2, disk, (nx, ny) => (rim(nx, ny, 0.16) ? '#d6be6a' : lit('#fbf0c0', nx, ny, 0.12)));
    for (let a = 0; a < 6; a++) p.set(Math.round(x + Math.cos(a * 1.05) * 1.6), Math.round(y + Math.sin(a * 1.05) * 1.4), '#8a6a30');
    p.set(x, y, '#e6d090');
  },
  kiwi(p, x, y) {
    blob(p, x, y, 5.6, 5.4, disk, (nx, ny) => {
      const d = Math.hypot(nx, ny);
      if (d > 0.88) return '#5a3a1e';
      if (d < 0.26) return '#f2f6d8';
      if (d < 0.42) return '#d8ec98';
      return lit(mix('#9ad048', '#6aa22a', d), nx, ny, 0.12);
    });
    for (let a = 0; a < 12; a++) p.set(Math.round(x + Math.cos(a * 0.524) * 2.6), Math.round(y + Math.sin(a * 0.524) * 2.5), '#1a1408');
    for (let a = 0; a < 8; a++) p.set(Math.round(x + Math.cos(a * 0.785 + 0.3) * 4), Math.round(y + Math.sin(a * 0.785 + 0.3) * 3.9), '#c4e088');
  },
  orange(p, x, y, r) {
    const rot = (r % 4) * Math.PI / 2;
    const inside = (nx, ny) => { const v = -nx * Math.sin(rot) + ny * Math.cos(rot); return nx * nx + ny * ny <= 1 && v <= 0.15; };
    blob(p, x, y, 6.4, 6.4, inside, (nx, ny) => {
      const d = Math.hypot(nx, ny), v = -nx * Math.sin(rot) + ny * Math.cos(rot);
      if (d > 0.86 || v > 0.02) return d > 0.86 ? '#e07a14' : '#fff0d0';
      if (d > 0.74) return '#fff0d0';
      const ang = Math.atan2(ny, nx);
      return Math.abs(Math.sin(ang * 3)) < 0.12 ? '#ffe0a0' : lit('#f6a030', nx, ny, 0.2);
    });
  },
  mint(p, x, y, r) {
    const leaf = (a, sz, ox, oy) => {
      const ca = Math.cos(a), sa = Math.sin(a);
      blob(p, x + ox, y + oy, sz, sz, (nx, ny) => { const u = nx * ca + ny * sa, v = -nx * sa + ny * ca; return (u * u) + (v * v) * 4.5 <= 1; }, (nx, ny) => {
        const u = nx * ca + ny * sa, v = -nx * sa + ny * ca;
        if (Math.abs(v) < 0.07) return '#2f6a28';
        if (Math.abs(v * 2.1) > 0.85 - u * u * 0.3) return '#3f7a30';
        return v < 0 ? '#7cc05a' : '#5c9a48';
      });
    };
    leaf((r % 4) * 0.8, 6, 0, 0);
    if (r % 3 === 0) leaf((r % 4) * 0.8 + 1.4, 4.5, 3, 2);
  },
  cream(p, x, y) {
    blob(p, x, y + 1, 5.6, 4.6, disk, () => '#cdbd9c');
    blob(p, x, y, 5.2, 4.4, disk, (nx, ny) => {
      const d = Math.hypot(nx, ny), a = Math.atan2(ny, nx);
      const s = Math.sin(a * 5 + d * 7);
      if (nx + ny > 0.9) return '#e2d4ba';
      return s > 0.5 ? '#ffffff' : s < -0.5 ? '#ece0c8' : '#fbf5e8';
    });
    p.set(x, y - 2, '#ffffff'); p.set(x, y - 1, '#ffffff'); p.set(x + 1, y - 1, '#e2d4ba');
  },
  shaving(p, x, y, r) {
    const a = (r % 4) * 0.7, ca = Math.cos(a), sa = Math.sin(a);
    blob(p, x, y, 6, 6, (nx, ny) => { const u = nx * ca + ny * sa, v = -nx * sa + ny * ca; return Math.abs(u) <= 0.85 && Math.abs(v) <= 0.32; }, (nx, ny) => {
      const v = -nx * sa + ny * ca, u = nx * ca + ny * sa;
      if (Math.abs(u) > 0.7) return '#3a1a10';
      return v < -0.12 ? '#8a5a3c' : v > 0.15 ? '#2e140a' : '#5a3020';
    });
  },
  macaron(p, x, y, r) {
    const c = ['#f2a0b4', '#a8d08a', '#f6d27a', '#b7a0e0', '#f6c4a0'][r % 5];
    blob(p, x, y, 6.2, 5.6, (nx, ny) => Math.hypot(nx, ny) <= 1 + 0.06 * Math.sin(Math.atan2(ny, nx) * 14), () => shade(c, 0.78));
    blob(p, x, y - 0.5, 5.2, 4.6, disk, (nx, ny) => lit(c, nx, ny, 0.2));
    p.set(x - 2, y - 3, '#ffffff'); p.set(x - 1, y - 3, shade(c, 1.3)); p.set(x - 3, y - 2, shade(c, 1.3));
  },
  cookie(p, x, y, r) {
    blob(p, x, y, 6.6, 6.2, (nx, ny) => Math.hypot(nx, ny) <= 1 + 0.05 * Math.sin(Math.atan2(ny, nx) * 9 + r), (nx, ny, xx, yy) => {
      const d = Math.hypot(nx, ny);
      if (d > 0.84) return '#9a6230';
      return hash(xx + 50, yy + 50, r) > 0.9 ? '#f0c27e' : lit('#d6a05a', nx, ny, 0.15);
    });
    const chips = [[-2, -2], [2, -1], [0, 2], [-3, 2], [3, 3], [1, -4]].slice(0, 4 + (r % 3));
    for (const [cx, cy] of chips) { p.rect(x + cx, y + cy, 2, 2, '#3a1a10'); p.set(x + cx, y + cy, '#6b3a22'); }
  },
  chocpiece(p, x, y) {
    for (let j = 0; j < 2; j++) for (let i = 0; i < 2; i++) {
      const bx = x - 4 + i * 4, by = y - 4 + j * 4;
      p.rect(bx, by, 4, 4, '#4a2416'); p.hline(bx, bx + 3, by, '#7a4a32'); p.vline(bx, by, by + 3, '#6b3a22');
      p.hline(bx, bx + 3, by + 3, '#2e140a'); p.vline(bx + 3, by, by + 3, '#2e140a');
    }
  },
  butter(p, x, y) {
    blob(p, x, y + 1, 6, 4, disk, () => '#f6e08a88');
    p.rect(x - 4, y - 3, 8, 6, '#e8c860'); p.rect(x - 4, y - 3, 8, 4, '#f8e48a'); p.hline(x - 4, x + 3, y - 3, '#fff6c0');
    p.set(x - 3, y - 2, '#ffffff'); p.vline(x + 3, y - 2, y + 2, '#d8b448');
  },
  lettuce(p, x, y, r) {
    const a = (r % 6) * 1.05, ca = Math.cos(a), sa = Math.sin(a);
    blob(p, x, y, 7, 6, (nx, ny) => { const u = nx * ca + ny * sa, v = -nx * sa + ny * ca; const ang = Math.atan2(v, u); return u * u + v * v * 1.4 <= 1 + 0.14 * Math.sin(ang * 9); }, (nx, ny) => {
      const u = nx * ca + ny * sa, v = -nx * sa + ny * ca, d = Math.hypot(u, v);
      if (Math.abs(v) < 0.07 && u > -0.8) return '#e6f4c8';
      if (Math.abs(v - u * 0.5) < 0.05 || Math.abs(v + u * 0.5) < 0.05) return '#b8dc88';
      return d > 0.82 ? '#4f8a3a' : lit(mix('#a8d870', '#6aa84a', d), nx, ny, 0.15);
    });
  },
  tomato(p, x, y, r) {
    if (r % 3 === 0) {
      blob(p, x, y, 4.4, 4.2, disk, (nx, ny) => (rim(nx, ny, 0.16) ? '#8a1a14' : lit('#e0302a', nx, ny, 0.35)));
      p.set(x - 2, y - 2, '#ffd0c8'); p.set(x - 1, y - 2, '#ff8070');
      for (const [dx, dy] of [[0, -3], [-1, -4], [1, -4], [0, -4]]) p.set(x + dx, y + dy, '#4f8a3a');
      return;
    }
    blob(p, x, y, 4.8, 4.6, disk, (nx, ny) => {
      const d = Math.hypot(nx, ny);
      if (d > 0.84) return '#b8201a';
      const lobe = Math.abs(Math.sin(Math.atan2(ny, nx) * 1.5 + r)) > 0.55 && d > 0.3 && d < 0.72;
      return lobe ? '#f6a080' : d < 0.25 ? '#f08070' : '#e8443a';
    });
    for (let a = 0; a < 5; a++) p.set(Math.round(x + Math.cos(a * 1.26 + r) * 2.3), Math.round(y + Math.sin(a * 1.26 + r) * 2.2), '#f8e8a8');
  },
  cucumber(p, x, y) {
    blob(p, x, y, 5.2, 5, disk, (nx, ny) => {
      const d = Math.hypot(nx, ny);
      if (d > 0.88) return '#264a1e';
      if (d > 0.76) return '#5c8f3f';
      return d < 0.42 ? '#eef8da' : lit('#cfe8b0', nx, ny, 0.1);
    });
    for (let a = 0; a < 3; a++) { p.set(Math.round(x + Math.cos(a * 2.09) * 1.3), Math.round(y + Math.sin(a * 2.09) * 1.3), '#b8d498'); }
  },
  carrot(p, x, y, r) {
    if (r % 2) {
      blob(p, x, y, 3.8, 3.8, disk, (nx, ny) => { const d = Math.hypot(nx, ny); return d > 0.8 ? '#d0661a' : d < 0.4 ? '#ffb060' : lit('#f2862a', nx, ny, 0.2); });
      return;
    }
    for (let i = 0; i < 4; i++) {
      const sx = x - 4 + i * 2.6, a = 0.25 * (((r + i) % 3) - 1);
      for (let k = -4; k <= 4; k++) { const px = Math.round(sx + k * a), py = y + k; p.set(px, py, '#f2862a'); p.set(px + 1, py, k < 0 ? '#ffa850' : '#c86018'); }
    }
  },
  onion(p, x, y) {
    blob(p, x, y, 5, 5, (nx, ny) => { const d = Math.hypot(nx, ny); return d <= 1 && d >= 0.45; }, (nx, ny) => {
      const d = Math.hypot(nx, ny);
      return d > 0.85 ? '#7a2a6a' : d > 0.7 ? '#b05aa0' : d > 0.6 ? '#f4e8f0' : '#c87ab8';
    });
  },
  olive(p, x, y, r) {
    blob(p, x, y, 3.4, 2.8, disk, (nx, ny) => (rim(nx, ny, 0.2) ? '#141410' : lit('#3a3a2a', nx, ny, 0.4)));
    p.set(x - 1, y - 1, '#8a8a6a');
    if (r % 2) { p.set(x, y, '#d23a2a'); p.set(x + 1, y, '#a82a1e'); } else p.set(x, y, '#0a0a06');
  },
  avocado(p, x, y, r) {
    const flip = r % 2 ? -1 : 1;
    blob(p, x, y, 8, 4, (nx, ny) => nx * nx + ny * ny <= 1 && (nx * nx + (ny + 0.65) * (ny + 0.65) * 1.2) > 0.8, (nx, ny) => {
      const outer = Math.hypot(nx, ny);
      if (outer > 0.9) return '#24401a';
      return mix('#e6eaa0', '#86b03a', Math.min(1, Math.max(0, (outer - 0.4) / 0.5)));
    });
    if (flip < 0) { /* mirrored slices look natural enough as they are */ }
  },
  egg(p, x, y, r) {
    blob(p, x, y, 7, 5.6, (nx, ny) => Math.hypot(nx, ny) <= 1 + 0.08 * Math.sin(Math.atan2(ny, nx) * 5 + r), (nx, ny) => (nx + ny > 0.95 ? '#e2dccc' : '#fbf8ef'));
    blob(p, x - 1, y - 1, 3, 3, disk, (nx, ny) => lit('#f6a820', nx, ny, 0.35));
    p.set(x - 2, y - 2, '#ffe8a0'); p.set(x - 2, y - 3, '#fff4c8');
  },
  cheese(p, x, y, r) {
    if (r % 2) {
      // a shaving of parmesan
      p.poly([[x - 5, y - 1], [x + 2, y - 3], [x + 5, y + 1], [x - 2, y + 3]], '#f6e8b8');
      p.line(x - 5, y - 1, x + 2, y - 3, '#fff8d8'); p.line(x - 2, y + 3, x + 5, y + 1, '#d8c890');
      return;
    }
    p.poly([[x - 4, y - 2], [x, y - 4], [x + 4, y - 2], [x, y]], '#ffe48a');
    p.poly([[x - 4, y - 2], [x, y], [x, y + 4], [x - 4, y + 2]], '#f2c850');
    p.poly([[x, y], [x + 4, y - 2], [x + 4, y + 2], [x, y + 4]], '#d8a838');
    p.set(x - 1, y - 2, '#e8c860'); p.set(x - 2, y + 1, '#d8a838');
  },
  crouton(p, x, y, r) {
    p.poly([[x - 4, y - 2], [x, y - 4], [x + 4, y - 2], [x, y]], '#e8b46e');
    p.poly([[x - 4, y - 2], [x, y], [x, y + 4], [x - 4, y + 2]], '#b8783a');
    p.poly([[x, y], [x + 4, y - 2], [x + 4, y + 2], [x, y + 4]], '#9a5e2a');
    for (let i = 0; i < 4; i++) p.set(x - 2 + ((i * 3 + r) % 5), y - 3 + ((i * 2) % 3), '#f6d498');
  },
  corn(p, x, y) {
    for (const [dx, dy] of [[-2, -1], [1, -2], [0, 1], [-3, 2], [2, 1]]) { p.rect(x + dx, y + dy, 2, 2, '#f6d040'); p.set(x + dx, y + dy, '#fff090'); p.set(x + dx + 1, y + dy + 1, '#d8a820'); }
  },
};

// ---------- bases ----------
// a cake slice seen from above and a little in front: the top, plus the cut side with its layers
function cakeSlice(p, cx, cy, s, kind) {
  const P = (x, y) => [cx + x * s, cy + y * s];
  const arc = [];
  for (let i = 0; i <= 8; i++) { const a = -0.62 + (i / 8) * 0.78; arc.push(P(-24 + Math.cos(a) * 50, 6 + Math.sin(a) * 50)); }
  const T = P(-24, 6), h = 11 * s;
  const B = arc[arc.length - 1];
  const top = [T, ...arc];
  const side = [T, B, [B[0], B[1] + h], [T[0], T[1] + h]];
  const sidePx = polyPixels(side), topPx = polyPixels(top);
  // shadow
  for (const [x, y] of polyPixels(side.map(([x, y]) => [x + 3, y + 3]))) p.set(x, y, '#00000022');
  outlineOf(p, [...sidePx, ...topPx], INK);
  // the cut side: layers depend on the cake
  const layersOf = {
    vanilla: [[0.12, '#fbf6ee'], [0.42, '#f2d48a'], [0.54, '#fffaf0'], [0.9, '#f2d48a'], [1, '#e0b870']],
    chocolate: [[0.12, '#3a1a10'], [0.44, '#5a3020'], [0.56, '#2a120a'], [0.9, '#5a3020'], [1, '#43221a']],
    cheesecake: [[0.06, '#e8b860'], [0.78, '#f8e8bc'], [1, '#b07838']],
  }[kind];
  const ex = B[0] - T[0], ey = B[1] - T[1];
  for (const [x, y] of sidePx) {
    const t = Math.max(0, Math.min(1, (x - T[0]) / ex)), edgeY = T[1] + ey * t;
    const v = (y - edgeY) / h;
    let c = layersOf.find(([lim]) => v <= lim)?.[1] || layersOf[layersOf.length - 1][1];
    const n = hash(Math.round(x), Math.round(y), 7);
    if (kind !== 'cheesecake' && c !== layersOf[0][1] && n > 0.86) c = shade(c, 0.88);
    if (kind === 'cheesecake' && v > 0.78 && n > 0.7) c = '#d09858';
    if (kind === 'cheesecake' && v < 0.78 && v > 0.06) c = shade(c, 1 - v * 0.08);
    if (kind === 'vanilla' && v > 0.42 && v < 0.54 && n > 0.8) c = '#d8283a';
    p.set(x, y, shade(c, 0.94 + t * 0.06));
  }
  // the top
  const baseTop = { vanilla: '#fbf6ee', chocolate: '#4a2416', cheesecake: '#f6e2a8' }[kind];
  for (const [x, y] of topPx) {
    // distance from the round outer edge (the crust side of the cake)
    const dx = x - T[0], dy = y - T[1], d = 50 * s - Math.hypot(dx, dy);
    let c = baseTop;
    if (kind === 'cheesecake') c = d < 4 * s ? mix('#c88a3a', '#f6e2a8', d / (4 * s)) : baseTop;
    if (kind === 'chocolate') { const band = (x - y * 0.6) % (14 * s); if (band > 0 && band < 2 * s) c = '#7a4a32'; }
    if (kind === 'vanilla' && hash(Math.round(x), Math.round(y), 3) > 0.93) c = '#efe6d6';
    // a soft sheen from the top left
    const k = 1 + ((T[1] - y) * 0.004 - (x - T[0]) * 0.0015);
    p.set(x, y, shade(c, Math.min(1.08, Math.max(0.9, k))));
  }
  // piped frosting along the round edge of the vanilla and chocolate cakes
  if (kind !== 'cheesecake') for (let i = 0; i <= 6; i++) {
    const a = -0.6 + (i / 6) * 0.74, [rx, ry] = P(-24 + Math.cos(a) * 46, 6 + Math.sin(a) * 46);
    const c = kind === 'vanilla' ? '#ffffff' : '#5a3020';
    blobDot(p, Math.round(rx), Math.round(ry), 2.4, c);
  }
  if (kind === 'cheesecake') { const [gx, gy] = P(4, -6); p.hline(Math.round(gx), Math.round(gx + 6 * s), Math.round(gy), '#fff6d8'); }
}
function blobDot(p, x, y, r, c) {
  blob(p, x, y + 1, r, r * 0.8, disk, () => shade(c, 0.78));
  blob(p, x, y, r, r * 0.8, disk, (nx, ny) => lit(c, nx, ny, 0.25));
  p.set(x - 1, y - 1, shade(c, 1.25));
}

function toastBase(p, cx, cy, s) {
  const pts = [];
  // a slice of bread: square bottom, domed top
  pts.push([cx - 24 * s, cy + 20 * s], [cx + 24 * s, cy + 20 * s], [cx + 25 * s, cy - 8 * s]);
  for (let i = 0; i <= 10; i++) { const a = (i / 10) * Math.PI; pts.push([cx + Math.cos(a) * 25 * s, cy - 8 * s - Math.sin(a) * 14 * s + (i === 5 ? 0 : 0)]); }
  const px = polyPixels(pts), set = new Set(px.map(([x, y]) => x + ',' + y));
  for (const [x, y] of polyPixels(pts.map(([x, y]) => [x + 3, y + 3]))) p.set(x, y, '#00000022');
  outlineOf(p, px, INK);
  const near = (x, y, d) => { for (let k = 1; k <= d; k++) for (const [dx, dy] of [[k, 0], [-k, 0], [0, k], [0, -k]]) if (!set.has((x + dx) + ',' + (y + dy))) return true; return false; };
  for (const [x, y] of px) {
    let c;
    if (near(x, y, 2)) c = '#8a4a1c'; else if (near(x, y, 4)) c = '#b8743a';
    else { const n = hash(x, y, 11); c = n > 0.9 ? '#f8dca0' : n < 0.08 ? '#c8904a' : mix('#e8b868', '#f2cc84', 0.5 + 0.5 * Math.sin(x * 0.2) * Math.cos(y * 0.2)); }
    p.set(x, y, c);
  }
}

function pancakeBase(p, cx, cy, s) {
  for (let k = 2; k >= 0; k--) {
    const y0 = cy + k * 3 * s;
    blob(p, cx, y0 + 1, 31 * s, 26 * s, disk, () => INK);
    blob(p, cx, y0, 30 * s, 25 * s, disk, (nx, ny, x, y) => {
      const d = Math.hypot(nx, ny);
      if (k > 0) return d > 0.9 ? '#a86a30' : '#d29b5a';
      if (d > 0.92) return '#b8783a';
      const n = hash(x + 99, y + 99, 5);
      return n > 0.94 ? '#c88a40' : lit(mix('#f2c47a', '#e0a050', d), nx, ny, 0.12);
    });
  }
}

function croissantBase(p, cx, cy, s) {
  const segs = [-3, -2, -1, 0, 1, 2, 3];
  const at = (i) => [cx + i * 7 * s, cy + Math.abs(i) * Math.abs(i) * 1.1 * s - 6 * s, (9 - Math.abs(i) * 1.5) * s];
  for (const i of segs) { const [x, y, r] = at(i); blob(p, Math.round(x), Math.round(y) + 2, r + 1.5, r * 0.8 + 1.5, disk, () => INK); }
  // draw from the tips inwards so the middle sits on top
  for (const i of [-3, 3, -2, 2, -1, 1, 0]) {
    const [x, y, r] = at(i);
    blob(p, Math.round(x), Math.round(y), r, r * 0.8, disk, (nx, ny) => {
      if (Math.abs(nx * 3 % 1) < 0.08 && ny > -0.6) return '#9a5a24';
      const base = Math.abs(i) === 3 ? '#b8702a' : '#e8a850';
      return lit(base, nx, ny, 0.3);
    });
    blob(p, Math.round(x - r * 0.25), Math.round(y - r * 0.35), r * 0.3, r * 0.15, disk, () => '#f6d08a');
  }
}

function bowlBase(p, cx, cy, s, r) {
  blob(p, cx, cy + 2, 36 * s, 31 * s, disk, () => '#00000022');
  blob(p, cx, cy, 35 * s, 30 * s, disk, () => INK);
  blob(p, cx, cy, 34 * s, 29 * s, disk, (nx, ny) => (ny < -0.6 && Math.abs(nx) < 0.5 ? '#ffffff' : lit('#e6eef0', nx, ny, 0.08)));
  blob(p, cx, cy, 29 * s, 24.5 * s, disk, (nx, ny) => lit('#c4d0d4', -nx, -ny, 0.15));
  for (let i = 0; i < 16; i++) { const a = i * 2.39, rr = Math.sqrt(hash(i, 2, 5)) * 19 * s; HD.lettuce(p, Math.round(cx + Math.cos(a) * rr), Math.round(cy + Math.sin(a) * rr * 0.85), i + r); }
}

export function drawBaseHD(p, base, cx, cy, R) {
  const s = R / 40;
  if (base === 'vanilla' || base === 'chocolate' || base === 'cheesecake') cakeSlice(p, cx, cy, s, base);
  else if (base === 'toast') toastBase(p, cx, cy, s);
  else if (base === 'pancakes') pancakeBase(p, cx, cy, s);
  else if (base === 'croissant') croissantBase(p, cx, cy, s);
  else if (base === 'bowl') bowlBase(p, cx, cy, s, 0);
}

// the plate itself, with a soft rim and a highlight
export function drawPlateHD(p, cx, cy, R) {
  blob(p, cx + 3, cy + 4, R, R * 0.82, disk, () => '#00000030');
  blob(p, cx, cy, R + 1, R * 0.82 + 1, disk, () => INK);
  blob(p, cx, cy, R, R * 0.82, disk, (nx, ny) => {
    const d = Math.hypot(nx, ny);
    if (d > 0.78) return d > 0.95 ? '#d8d0c0' : lit('#efe8dc', nx, ny, 0.1);
    if (d > 0.74) return '#ddd5c6';
    return lit('#fbf7f0', nx, ny, 0.04);
  });
  blob(p, Math.round(cx - R * 0.5), Math.round(cy - R * 0.55), R * 0.16, R * 0.05, disk, () => '#ffffff');
}
