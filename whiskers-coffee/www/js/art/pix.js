// A tiny pixel raster: every shape is filled pixel by pixel with no anti-aliasing,
// so everything we draw stays crisp pixel art at any zoom.

const cache = new Map();
// '#rrggbb' or '#rrggbbaa' -> packed ABGR (the byte order of ImageData on little-endian)
export function rgba(hex) {
  if (typeof hex === 'number') return hex;
  let v = cache.get(hex);
  if (v !== undefined) return v;
  const h = hex.replace('#', '');
  const r = parseInt(h.slice(0, 2), 16), g = parseInt(h.slice(2, 4), 16), b = parseInt(h.slice(4, 6), 16);
  const a = h.length >= 8 ? parseInt(h.slice(6, 8), 16) : 255;
  v = ((a << 24) | (b << 16) | (g << 8) | r) >>> 0;
  cache.set(hex, v);
  return v;
}

// darken (k < 1) or lighten (k > 1) a hex colour
export function shade(hex, k) {
  const h = hex.replace('#', '');
  const c = [0, 2, 4].map((i) => Math.max(0, Math.min(255, Math.round(parseInt(h.slice(i, i + 2), 16) * k))));
  return '#' + c.map((x) => x.toString(16).padStart(2, '0')).join('');
}

export function mix(a, b, t) {
  const pa = [0, 2, 4].map((i) => parseInt(a.slice(1 + i, 3 + i), 16));
  const pb = [0, 2, 4].map((i) => parseInt(b.slice(1 + i, 3 + i), 16));
  return '#' + pa.map((x, i) => Math.round(x + (pb[i] - x) * t).toString(16).padStart(2, '0')).join('');
}

export class Pix {
  constructor(w, h) {
    this.w = w; this.h = h;
    this.data = new Uint32Array(w * h);
    this.ox = 0; this.oy = 0; // drawing offset
  }
  set(x, y, c) {
    x = Math.round(x + this.ox); y = Math.round(y + this.oy);
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return;
    const v = rgba(c);
    if ((v >>> 24) === 255) this.data[y * this.w + x] = v;
    else if (v >>> 24) this.data[y * this.w + x] = blend(this.data[y * this.w + x], v);
  }
  get(x, y) {
    x = Math.round(x + this.ox); y = Math.round(y + this.oy);
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return 0;
    return this.data[y * this.w + x];
  }
  rect(x, y, w, h, c) { for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) this.set(x + i, y + j, c); }
  hline(x0, x1, y, c) { if (x1 < x0) [x0, x1] = [x1, x0]; for (let x = x0; x <= x1; x++) this.set(x, y, c); }
  vline(x, y0, y1, c) { if (y1 < y0) [y0, y1] = [y1, y0]; for (let y = y0; y <= y1; y++) this.set(x, y, c); }
  line(x0, y0, x1, y1, c) {
    x0 = Math.round(x0); y0 = Math.round(y0); x1 = Math.round(x1); y1 = Math.round(y1);
    const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
    let err = dx + dy;
    for (;;) {
      this.set(x0, y0, c);
      if (x0 === x1 && y0 === y1) break;
      const e2 = 2 * err;
      if (e2 >= dy) { err += dy; x0 += sx; }
      if (e2 <= dx) { err += dx; y0 += sy; }
    }
  }
  // isometric 2:1 line: steps two pixels across for each pixel down, the classic pixel-art iso edge
  isoline(x0, y0, x1, y1, c) {
    const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0));
    for (let i = 0; i <= n; i++) {
      const t = n ? i / n : 0;
      this.set(Math.round(x0 + (x1 - x0) * t), Math.floor(y0 + (y1 - y0) * t + 0.0001), c);
    }
  }
  // scanline polygon fill with pixel-centre sampling (no anti-aliasing)
  poly(pts, c) {
    let minY = Infinity, maxY = -Infinity;
    for (const [, y] of pts) { minY = Math.min(minY, y); maxY = Math.max(maxY, y); }
    for (let y = Math.floor(minY); y <= Math.ceil(maxY); y++) {
      const sy = y + 0.5, xs = [];
      for (let i = 0; i < pts.length; i++) {
        const [ax, ay] = pts[i], [bx, by] = pts[(i + 1) % pts.length];
        if ((ay <= sy && by > sy) || (by <= sy && ay > sy)) xs.push(ax + ((sy - ay) / (by - ay)) * (bx - ax));
      }
      xs.sort((a, b) => a - b);
      for (let k = 0; k + 1 < xs.length; k += 2) {
        for (let x = Math.round(xs[k]); x < Math.round(xs[k + 1]); x++) this.set(x, y, c);
      }
    }
  }
  ellipse(cx, cy, rx, ry, c) {
    for (let y = -ry; y <= ry; y++) for (let x = -rx; x <= rx; x++) {
      if ((x * x) / (rx * rx + 0.3) + (y * y) / (ry * ry + 0.3) <= 1) this.set(cx + x, cy + y, c);
    }
  }
  // draw another Pix (or a grid sprite) on top
  blit(src, x, y, flip = false) {
    for (let j = 0; j < src.h; j++) for (let i = 0; i < src.w; i++) {
      const v = src.data[j * src.w + (flip ? src.w - 1 - i : i)];
      if (v >>> 24) this.set(x + i, y + j, v);
    }
  }
  // 1px dark outline around every opaque pixel that touches transparency
  outline(c, onlyBottom = false) {
    const out = new Uint32Array(this.data);
    const v = rgba(c);
    for (let y = 0; y < this.h; y++) for (let x = 0; x < this.w; x++) {
      if (this.data[y * this.w + x] >>> 24) continue;
      const n = (xx, yy) => xx >= 0 && yy >= 0 && xx < this.w && yy < this.h && (this.data[yy * this.w + xx] >>> 24) > 200;
      if (n(x - 1, y) || n(x + 1, y) || n(x, y - 1) || (!onlyBottom && n(x, y + 1))) out[y * this.w + x] = v;
    }
    this.data = out;
  }
  toCanvas(scale = 1) {
    const c = document.createElement('canvas');
    c.width = this.w * scale; c.height = this.h * scale;
    const g = c.getContext('2d');
    const img = g.createImageData(this.w, this.h);
    new Uint32Array(img.data.buffer).set(this.data);
    if (scale === 1) g.putImageData(img, 0, 0);
    else {
      const t = document.createElement('canvas'); t.width = this.w; t.height = this.h;
      t.getContext('2d').putImageData(img, 0, 0);
      g.imageSmoothingEnabled = false;
      g.drawImage(t, 0, 0, c.width, c.height);
    }
    return c;
  }
}

function blend(dst, src) {
  if (!(dst >>> 24)) return src; // nothing underneath: keep the translucent colour as it is
  const a = (src >>> 24) / 255;
  const ch = (v, s) => ((v >>> s) & 255);
  const r = Math.round(ch(src, 0) * a + ch(dst, 0) * (1 - a));
  const g = Math.round(ch(src, 8) * a + ch(dst, 8) * (1 - a));
  const b = Math.round(ch(src, 16) * a + ch(dst, 16) * (1 - a));
  const da = Math.max(dst >>> 24, src >>> 24);
  return ((da << 24) | (b << 16) | (g << 8) | r) >>> 0;
}

// a sprite written as rows of palette letters; '.' is transparent
export function grid(rows, pal) {
  const h = rows.length, w = Math.max(...rows.map((r) => r.length));
  const p = new Pix(w, h);
  rows.forEach((row, y) => [...row].forEach((ch, x) => { if (ch !== '.' && ch !== ' ' && pal[ch]) p.set(x, y, pal[ch]); }));
  return p;
}

// cheap deterministic noise for texture variation
export function hash(x, y, s = 0) {
  let h = (x * 374761393 + y * 668265263 + s * 2147483647) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

// Scale2x (EPX): doubles a sprite and rounds off its diagonal steps, so art drawn at the
// café's base resolution gets smooth, detailed edges at twice the pixel density.
export function scale2x(src) {
  const w = src.w, h = src.h, d = src.data, out = new Pix(w * 2, h * 2), o = out.data;
  const at = (x, y) => d[Math.min(h - 1, Math.max(0, y)) * w + Math.min(w - 1, Math.max(0, x))];
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const P = d[y * w + x], A = at(x, y - 1), B = at(x + 1, y), C = at(x - 1, y), D = at(x, y + 1);
    let p1 = P, p2 = P, p3 = P, p4 = P;
    if (C === A && C !== D && A !== B) p1 = A;
    if (A === B && A !== C && B !== D) p2 = B;
    if (D === C && D !== B && C !== A) p3 = C;
    if (B === D && B !== A && D !== C) p4 = D;
    const i = (y * 2) * w * 2 + x * 2;
    o[i] = p1; o[i + 1] = p2; o[i + w * 2] = p3; o[i + w * 2 + 1] = p4;
  }
  return out;
}

// a 1px outline in a dark, warm version of the colour it borders (softer than black)
export function softOutline(p, k = 0.42, base = [36, 22, 15]) {
  const out = new Uint32Array(p.data), w = p.w, h = p.h;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    if (p.data[y * w + x] >>> 24) continue;
    let n = 0;
    for (const [dx, dy] of [[0, 1], [0, -1], [1, 0], [-1, 0]]) {
      const xx = x + dx, yy = y + dy;
      if (xx < 0 || yy < 0 || xx >= w || yy >= h) continue;
      const v = p.data[yy * w + xx];
      if ((v >>> 24) > 200) { n = v; break; }
    }
    if (!n) continue;
    const r = n & 255, g = (n >>> 8) & 255, b = (n >>> 16) & 255;
    const mixc = (c, bc) => Math.round(c * k + bc * (1 - k) * 0.9);
    out[y * w + x] = ((255 << 24) | (mixc(b, base[2]) << 16) | (mixc(g, base[1]) << 8) | mixc(r, base[0])) >>> 0;
  }
  p.data = out;
  return p;
}

// remove the existing dark outline (pixels of colour `c` touching transparency)
export function stripOutline(p, test) {
  const w = p.w, h = p.h, out = new Uint32Array(p.data);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const v = p.data[y * w + x];
    if (!(v >>> 24) || !test(v)) continue;
    for (const [dx, dy] of [[0, 1], [0, -1], [1, 0], [-1, 0]]) {
      const xx = x + dx, yy = y + dy;
      if (xx < 0 || yy < 0 || xx >= w || yy >= h || !(p.data[yy * w + xx] >>> 24)) { out[y * w + x] = 0; break; }
    }
  }
  p.data = out;
  return p;
}
