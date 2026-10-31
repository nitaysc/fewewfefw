// Isometric pixel painter. Furniture is described as boxes and cylinders in "iso units"
// (one floor tile is 16x16 units, height is in pixels) and painted as 2:1 pixel art.
// Every piece can be rotated a quarter turn at a time, which keeps all four facings
// of a chair or sofa consistent without drawing them by hand.
import { Pix, shade } from './pix.js';

export const TILE_W = 32, TILE_H = 16, U = 16;

export const proj = (x, y, z) => [x - y, (x + y) / 2 - z];

export class IsoPainter {
  // fw/fd: footprint in tiles before rotation; rot: quarter turns
  constructor(fw = 1, fd = 1, rot = 0) {
    this.FW = fw * U; this.FD = fd * U; this.rot = ((rot % 4) + 4) % 4;
    this.ops = [];
    this.cur = null;
  }
  // rotate a point inside the footprint
  rp(x, y) {
    const { FW, FD } = this;
    switch (this.rot) {
      case 1: return [FD - y, x];
      case 2: return [FW - x, FD - y];
      case 3: return [y, FW - x];
      default: return [x, y];
    }
  }
  // rotate a direction (for face visibility)
  rd(nx, ny) {
    switch (this.rot) {
      case 1: return [-ny, nx];
      case 2: return [-nx, -ny];
      case 3: return [ny, -nx];
      default: return [nx, ny];
    }
  }
  p3(x, y, z) { const [a, b] = this.rp(x, y); return proj(a, b, z); }

  // a box from (x,y,z) of size w (along x) by d (along y) by h (up)
  box(x, y, z, w, d, h, col, opts = {}) {
    const [ax, ay] = this.rp(x, y), [bx, by] = this.rp(x + w, y + d);
    const x0 = Math.min(ax, bx), x1 = Math.max(ax, bx), y0 = Math.min(ay, by), y1 = Math.max(ay, by);
    const op = { key: x0 + y0 + (opts.order || 0), b: { x0, x1, y0, y1, z0: z, z1: z + h }, pts: [], z0: z, z1: z + h, x0, x1, y0, y1, col, opts, details: [] };
    op.pts = [proj(x0, y0, z + h), proj(x1, y0, z + h), proj(x1, y1, z + h), proj(x0, y1, z + h), proj(x1, y0, z), proj(x1, y1, z), proj(x0, y1, z)];
    op.draw = (p) => drawBox(p, op);
    this.ops.push(op);
    this.cur = op;
    return this;
  }

  // a vertical cylinder centred at (cx, cy) with radius r
  cyl(cx, cy, z, r, h, col, opts = {}) {
    const [a, b] = this.rp(cx, cy);
    const op = { key: a + b + (opts.order || 0), b: { x0: a - r, x1: a + r, y0: b - r, y1: b + r, z0: z, z1: z + h }, pts: [], details: [] };
    const rx = r * 1.41, ry = r * 0.71;
    const [px, py] = proj(a, b, z);
    op.pts = [[px - rx - 1, py - h - ry - 1], [px + rx + 1, py + ry + 1]];
    op.draw = (p) => drawCyl(p, px, py, rx, ry, h, col, opts);
    this.ops.push(op);
    this.cur = op;
    return this;
  }

  // flat shapes drawn on a face of the last box: face is 'top', 'x' (the +x side), 'y' (the +y side),
  // '-x' or '-y'; (u, v) are along the face, rect is [u, v, w, h]
  faceRect(face, u, v, w, h, c) { return this.detail(face, (pp, fill) => fill([[u, v], [u + w, v], [u + w, v + h], [u, v + h]], c)); }
  faceLine(face, u0, v0, u1, v1, c) { return this.detail(face, (pp, fill, line) => line(u0, v0, u1, v1, c)); }
  facePx(face, u, v, c) { return this.detail(face, (pp, fill, line, px) => px(u, v, c)); }

  detail(face, fn) {
    const op = this.cur;
    op.details.push({ face, fn });
    return this;
  }

  // free-standing details at absolute iso coordinates (drawn in painter order)
  // pts3 are two opposite corners of the shape's bounding box, used for drawing order
  shape(key, pts3, fn) {
    const projected = [];
    const xs = [], ys = [], zs = [];
    for (const [x, y, z] of pts3) {
      const [a, b] = this.rp(x, y);
      xs.push(a); ys.push(b); zs.push(z);
    }
    for (const x of [Math.min(...xs), Math.max(...xs)]) for (const y of [Math.min(...ys), Math.max(...ys)]) for (const z of [Math.min(...zs), Math.max(...zs)]) projected.push(proj(x, y, z));
    const b = { x0: Math.min(...xs), x1: Math.max(...xs), y0: Math.min(...ys), y1: Math.max(...ys), z0: Math.min(...zs), z1: Math.max(...zs) };
    this.ops.push({ key, b, pts: projected, draw: (p) => fn(p, (x, y, z) => this.p3(x, y, z)), details: [] });
    return this;
  }

  bake(outline = '#24160f') {
    let minx = Infinity, miny = Infinity, maxx = -Infinity, maxy = -Infinity;
    for (const op of this.ops) for (const [x, y] of op.pts) {
      minx = Math.min(minx, x); miny = Math.min(miny, y); maxx = Math.max(maxx, x); maxy = Math.max(maxy, y);
    }
    const ox = -Math.floor(minx) + 2, oy = -Math.floor(miny) + 2;
    const p = new Pix(Math.ceil(maxx - minx) + 5, Math.ceil(maxy - miny) + 5);
    p.ox = ox; p.oy = oy;
    const ops = drawOrder(this.ops);
    for (const op of ops) {
      op.draw(p);
      for (const d of op.details) drawDetail(this, p, op, d);
    }
    p.ox = 0; p.oy = 0;
    if (outline) p.outline(outline);
    return { pix: p, ax: ox, ay: oy };
  }
}

function faceColors(col) {
  if (typeof col === 'string') return { top: shade(col, 1.12), left: col, right: shade(col, 0.78), line: shade(col, 0.55) };
  return { top: col.top, left: col.left || col.side, right: col.right || shade(col.left || col.side, 0.8), line: col.line || shade(col.left || col.side, 0.55) };
}

function drawBox(p, op) {
  const { x0, x1, y0, y1, z0, z1 } = op;
  const c = faceColors(op.col);
  const P = (x, y, z) => proj(x, y, z);
  // left face (+y side), right face (+x side), then the top
  p.poly([P(x0, y1, z1), P(x1, y1, z1), P(x1, y1, z0), P(x0, y1, z0)], c.left);
  p.poly([P(x1, y0, z1), P(x1, y1, z1), P(x1, y1, z0), P(x1, y0, z0)], c.right);
  p.poly([P(x0, y0, z1), P(x1, y0, z1), P(x1, y1, z1), P(x0, y1, z1)], c.top);
  if (!op.opts.noEdges) {
    // crisp edges: darker silhouette lines and a light front edge on the top
    const e = (a, b, col) => { const [ax, ay] = P(...a), [bx, by] = P(...b); p.isoline(ax, ay, bx, by, col); };
    e([x0, y1, z1], [x1, y1, z1], shade(c.top, 1.08));
    e([x1, y0, z1], [x1, y1, z1], shade(c.top, 1.0));
    if (z1 - z0 > 2) {
      const [vx, vy] = P(x1, y1, z1);
      p.vline(vx, vy, vy + (z1 - z0) - 1, c.line);
    }
  }
}

function drawCyl(p, px, py, rx, ry, h, col, opts) {
  const c = faceColors(col);
  // body: bottom ellipse + side band, shaded left to right
  for (let x = -Math.round(rx); x <= Math.round(rx); x++) {
    const t = (x + rx) / (2 * rx);
    const colr = t < 0.35 ? shade(c.left, 1.05) : t < 0.75 ? c.left : c.right;
    const yb = ry * Math.sqrt(Math.max(0, 1 - (x * x) / (rx * rx)));
    for (let y = Math.round(py - h); y <= Math.round(py + yb); y++) p.set(px + x, y, colr);
  }
  p.ellipse(Math.round(px), Math.round(py - h), Math.round(rx), Math.round(ry), c.top);
  if (opts.rim) {
    for (let a = 0; a < Math.PI * 2; a += 0.05) {
      const x = Math.round(px + Math.cos(a) * rx), y = Math.round(py - h + Math.sin(a) * ry);
      if (Math.sin(a) > -0.2) p.set(x, y, shade(c.top, 0.8));
    }
  }
}

function drawDetail(painter, p, op, d) {
  // visibility of the face after rotation (top, +x and +y faces are visible)
  const normals = { x: [1, 0], y: [0, 1], '-x': [-1, 0], '-y': [0, -1] };
  if (d.face !== 'top') {
    const [nx, ny] = painter.rd(...normals[d.face]);
    if (nx < 0 || ny < 0) return;
  }
  // map face-local (u, v) to unrotated iso space, then through the painter's rotation
  const { x0, x1, y0, y1, z0, z1 } = unrotatedBox(painter, op);
  const toIso = (u, v) => {
    switch (d.face) {
      case 'top': return [x0 + u, y0 + v, z1];
      case 'x': return [x1, y0 + u, z1 - v];
      case '-x': return [x0, y1 - u, z1 - v];
      case 'y': return [x1 - u, y1, z1 - v];
      case '-y': return [x0 + u, y0, z1 - v];
    }
  };
  const P = (u, v) => painter.p3(...toIso(u, v));
  const fill = (pts, c) => p.poly(pts.map(([u, v]) => P(u, v)), c);
  const line = (u0, v0, u1, v1, c) => { const [ax, ay] = P(u0, v0), [bx, by] = P(u1, v1); p.isoline(ax, ay, bx, by, c); };
  const px = (u, v, c) => { const [a, b] = P(u, v); p.set(a, b, c); };
  d.fn(P, fill, line, px);
}

// the box in pre-rotation coordinates (details are authored in that space)
function unrotatedBox(painter, op) {
  if (!op._src) {
    // invert the rotation of the two stored corners
    const inv = (x, y) => {
      const { FW, FD } = painter;
      switch (painter.rot) {
        case 1: return [y, FD - x];
        case 2: return [FW - x, FD - y];
        case 3: return [FW - y, x];
        default: return [x, y];
      }
    };
    const [ax, ay] = inv(op.x0, op.y0), [bx, by] = inv(op.x1, op.y1);
    op._src = { x0: Math.min(ax, bx), x1: Math.max(ax, bx), y0: Math.min(ay, by), y1: Math.max(ay, by), z0: op.z0, z1: op.z1 };
  }
  return op._src;
}

// parts that sit behind others (further back on x or y, or below) are painted first
const EPS = 0.01;
const behind = (a, b) => a.x1 <= b.x0 + EPS || a.y1 <= b.y0 + EPS || a.z1 <= b.z0 + EPS;
function drawOrder(ops) {
  const sorted = [...ops].sort((a, b) => a.key - b.key);
  const out = [], state = new Map();
  const visit = (op) => {
    if (state.get(op)) return;
    state.set(op, 1);
    for (const other of sorted) if (other !== op && !state.get(other) && behind(other.b, op.b) && !behind(op.b, other.b)) visit(other);
    out.push(op);
  };
  for (const op of sorted) visit(op);
  return out;
}
