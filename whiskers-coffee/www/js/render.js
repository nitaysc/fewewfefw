// Draws the café: room, furniture, people and cats in depth order, then lamp light,
// rain on the windows, steam and hearts. All sprites are drawn at whole-pixel zoom levels
// so the pixel art stays crisp.
import { Pix } from './art/pix.js';
import { IsoPainter } from './art/iso.js';
import { paintRoom, WALL_H } from './art/room.js';
import { catFrame } from './art/cats.js';
import { personSprite } from './art/people.js';
import { CATALOG } from './game/catalog.js';
import { footprint, ROOM_W, ROOM_H, canPlace, tilesOf } from './game/world.js';

const wx = (x, y) => (x - y) * 16;
const wy = (x, y, z = 0) => (x + y) * 8 - z;

export class Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.g = canvas.getContext('2d');
    this.zoom = 4;
    this.offsetY = 0; // canvas pixels hidden under the decorate tray
    this.cam = { x: 0, y: 40 };
    this.sprites = new Map();
    this.fx = [];
    this.roomKey = '';
    this.glow = makeGlow(46, 23, '#ffcf7a');
    this.smallGlow = makeGlow(22, 11, '#ffd99a');
    this.heart = heartPix().toCanvas();
    this.zzz = zPix().toCanvas();
    this.resize();
  }

  resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 3);
    this.dpr = dpr;
    this.canvas.width = Math.round(window.innerWidth * dpr);
    this.canvas.height = Math.round(window.innerHeight * dpr);
    // fit the whole room on screen at a whole-number zoom
    const roomW = (ROOM_W + ROOM_H) * 16 + 16, roomH = (ROOM_W + ROOM_H) * 8 + WALL_H + 6;
    this.fitZoom = Math.max(2, Math.floor(Math.min(this.canvas.width / roomW, (this.canvas.height - this.offsetY * 2) / roomH)));
    if (!this.userZoom) this.zoom = this.fitZoom;
    this.clampCam();
  }

  clampCam() {
    const minx = -ROOM_H * 16, maxx = ROOM_W * 16, miny = -WALL_H, maxy = (ROOM_W + ROOM_H) * 8;
    this.cam.x = Math.max(minx, Math.min(maxx, this.cam.x));
    this.cam.y = Math.max(miny, Math.min(maxy, this.cam.y));
  }
  centre() { this.cam.x = (ROOM_W - ROOM_H) * 8; this.cam.y = (ROOM_W + ROOM_H) * 4 - WALL_H / 2 + 2; }

  // world pixels -> canvas pixels
  toScreen(px, py) {
    return [Math.round((px - Math.round(this.cam.x)) * this.zoom + this.canvas.width / 2), Math.round((py - Math.round(this.cam.y)) * this.zoom + this.canvas.height / 2 - this.offsetY)];
  }
  // canvas pixels -> tile coordinates on the floor
  toTile(sx, sy) {
    const px = (sx - this.canvas.width / 2) / this.zoom + Math.round(this.cam.x), py = (sy - this.canvas.height / 2 + this.offsetY) / this.zoom + Math.round(this.cam.y);
    return [(px / 16 + py / 8) / 2, (py / 8 - px / 16) / 2];
  }

  sprite(type, rot) {
    const key = type + ':' + rot;
    if (!this.sprites.has(key)) {
      const def = CATALOG[type];
      const p = new IsoPainter(def.size[0], def.size[1], def.rotates ? rot : 0);
      def.paint(p);
      const s = p.bake();
      this.sprites.set(key, { canvas: s.pix.toCanvas(), ax: s.ax, ay: s.ay, w: s.pix.w, h: s.pix.h });
    }
    return this.sprites.get(key);
  }

  ensureRoom(cafe) {
    const key = JSON.stringify(cafe.walls);
    if (key !== this.roomKey) {
      const r = paintRoom(ROOM_W, ROOM_H, cafe.walls);
      this.room = { canvas: r.pix.toCanvas(), ax: r.ax, ay: r.ay, windows: r.windows };
      this.roomKey = key;
    }
  }

  blit(img, px, py, w, h, alpha = 1) {
    const [sx, sy] = this.toScreen(px, py);
    const g = this.g;
    if (alpha !== 1) g.globalAlpha = alpha;
    g.drawImage(img, sx, sy, w * this.zoom, h * this.zoom);
    if (alpha !== 1) g.globalAlpha = 1;
  }

  addFx(f) { this.fx.push({ ...f, t0: performance.now() / 1000 }); }

  // view: { cafe, players: [{x,y,view,flip,moving,look,name,me}], cats: [{x,y,z,state,flip,coat,name}], build, time }
  draw(view) {
    const { cafe } = view;
    const g = this.g, t = view.time;
    this.ensureRoom(cafe);
    g.imageSmoothingEnabled = false;
    g.fillStyle = '#1d130d';
    g.fillRect(0, 0, this.canvas.width, this.canvas.height);
    this.backdrop(t);

    this.blit(this.room.canvas, -this.room.ax, -this.room.ay, this.room.canvas.width, this.room.canvas.height);
    this.rain(t);

    // flat things (rugs) lie on the floor under everything
    const items = [];
    for (const it of cafe.furniture) {
      if (view.build?.hideId === it.id) continue;
      const def = CATALOG[it.type];
      const [fw, fd] = footprint(it);
      const s = this.sprite(it.type, it.rot);
      const draw = () => this.blit(s.canvas, wx(it.x, it.y) - s.ax, wy(it.x, it.y) - s.ay, s.w, s.h, view.build?.selectedId === it.id ? 0.85 : 1);
      if (def.flat) { draw(); continue; }
      items.push({ x0: it.x, x1: it.x + fw, y0: it.y, y1: it.y + fd, z0: 0, z1: 40, draw, key: it.x + it.y });
    }
    if (view.build) this.drawBuildGrid(view.build, cafe);

    for (const p of view.players) {
      const r = 0.22;
      items.push({ x0: p.x - r, x1: p.x + r, y0: p.y - r, y1: p.y + r, z0: 0, z1: 30, key: p.x + p.y, draw: () => this.drawPerson(p, t) });
    }
    for (const c of view.cats) {
      const r = 0.2;
      // a cat up on furniture is drawn after the piece it sits on
      items.push({ x0: c.x - r, x1: c.x + r, y0: c.y - r, y1: c.y + r, z0: c.z > 0 ? 100 : 0, z1: c.z > 0 ? 140 : 14, key: c.x + c.y, draw: () => this.drawCat(c, t) });
    }
    for (const it of sortItems(items)) it.draw();

    if (view.build?.ghost) this.drawGhost(view.build.ghost, cafe);
    this.lights(cafe, t, view);
    this.drawFx(t);
    for (const p of view.players) this.nameTag(p);
  }

  backdrop(t) {
    // soft warm vignette behind the dollhouse
    const g = this.g, [cx, cy] = this.toScreen((ROOM_W - ROOM_H) * 8, (ROOM_W + ROOM_H) * 4);
    const r = Math.max(this.canvas.width, this.canvas.height) * 0.7;
    const gr = g.createRadialGradient(cx, cy, r * 0.1, cx, cy, r);
    gr.addColorStop(0, '#3a2618'); gr.addColorStop(1, '#130c08');
    g.fillStyle = gr;
    g.fillRect(0, 0, this.canvas.width, this.canvas.height);
  }

  rain(t) {
    const g = this.g;
    for (const w of this.room.windows) {
      const pt = (u, z) => (w.side === 'north' ? [u, 0, z] : [0, u, z]);
      const corners = [pt(w.u0, w.z1), pt(w.u1, w.z1), pt(w.u1, w.z0), pt(w.u0, w.z0)].map(([x, y, z]) => this.toScreen(x - y, (x + y) / 2 - z));
      g.save();
      g.beginPath();
      corners.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y)));
      g.closePath();
      g.clip();
      const xs = corners.map((c) => c[0]), ys = corners.map((c) => c[1]);
      const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
      const z = this.zoom, n = Math.max(6, Math.round(((x1 - x0) / z) * 0.5));
      g.fillStyle = 'rgba(170,190,220,0.45)';
      for (let i = 0; i < n; i++) {
        const seed = (i * 9301 + 49297) % 233280 / 233280;
        const x = x0 + Math.floor((seed * (x1 - x0)) / z) * z;
        const speed = 90 + seed * 60;
        const y = y0 + ((t * speed * z + seed * 997) % (y1 - y0 + 6 * z)) - 3 * z;
        g.fillRect(x, Math.floor(y / z) * z, z, z * 3);
      }
      g.restore();
    }
  }

  drawPerson(p, t) {
    const frame = p.sitting ? 6 : p.moving ? Math.floor(t * 8) % 4 : (Math.floor(t * 1.5 + (p.x * 3)) % 2) + 4;
    const s = personSprite(p.look, p.view || 'front', frame, !!p.flip);
    const px = wx(p.x, p.y), py = wy(p.x, p.y, p.z || 0);
    this.shadow(px, py, 6);
    this.blit(s.canvas, px - 8, py - 27, s.w, s.h);
  }

  drawCat(c, t) {
    let frame;
    const phase = c.x * 7 + c.y * 3;
    switch (c.state) {
      case 'walk': frame = Math.floor(t * 6 + phase) % 2 ? 'walk1' : 'walk2'; break;
      case 'sleep': frame = Math.floor(t * 0.8 + phase) % 2 ? 'sleep1' : 'sleep2'; break;
      case 'groom': frame = Math.floor(t * 3) % 2 ? 'groom' : 'sit1'; break;
      case 'happy': frame = 'happy'; break;
      case 'perch': frame = Math.floor(t * 0.5 + phase) % 6 === 0 ? 'blink' : (Math.floor(t * 1.2) % 2 ? 'sit1' : 'sit2'); break;
      default: frame = Math.floor(t * 0.6 + phase) % 7 === 0 ? 'blink' : (Math.floor(t * 1.1 + phase) % 2 ? 'sit1' : 'sit2');
    }
    const s = catFrame(frame, c.coat, !!c.flip);
    const px = wx(c.x, c.y), py = wy(c.x, c.y, c.z || 0);
    if (!c.z) this.shadow(px, py, 6);
    this.blit(s.canvas, px - Math.floor(s.w / 2), py - s.h + 2, s.w, s.h);
    if (c.state === 'sleep' && Math.floor(t * 0.7 + phase) % 2) {
      const k = (t * 0.7 + phase) % 1;
      this.blit(this.zzz, px + 4 + k * 4, py - s.h - 2 - k * 8, 5, 5, 1 - k);
    }
  }

  shadow(px, py, r) {
    const g = this.g, [sx, sy] = this.toScreen(px, py), z = this.zoom;
    g.fillStyle = 'rgba(30,15,8,0.35)';
    for (let y = -1; y <= 1; y++) {
      const w = y === 0 ? r : r - 2;
      g.fillRect(sx - w * z, sy + y * z, w * 2 * z, z);
    }
  }

  nameTag(p) {
    if (!p.name) return;
    const g = this.g, [sx, sy] = this.toScreen(wx(p.x, p.y), wy(p.x, p.y) - 34);
    const size = Math.max(10, Math.round(this.zoom * 3.2));
    g.font = `600 ${size}px "Pixelify Sans", monospace`;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    const w = g.measureText(p.name).width + size;
    g.fillStyle = p.me ? 'rgba(59,38,26,0.85)' : 'rgba(36,22,15,0.85)';
    g.fillRect(Math.round(sx - w / 2), Math.round(sy - size * 0.7), Math.round(w), Math.round(size * 1.4));
    g.fillStyle = p.me ? '#ffd27a' : '#f4efe6';
    g.fillText(p.name, sx, sy + 1);
  }

  lights(cafe, t, view) {
    const g = this.g;
    // pendant lamps hang over every table and over the counter
    const lamps = [];
    for (const it of cafe.furniture) {
      const def = CATALOG[it.type];
      const [fw, fd] = footprint(it);
      if (it.type.startsWith('table')) lamps.push({ x: it.x + fw / 2, y: it.y + fd / 2, hang: true });
      if (def.station) lamps.push({ x: it.x + fw / 2, y: it.y + fd / 2, hang: true });
      if (it.type === 'floor_lamp') lamps.push({ x: it.x + 0.5, y: it.y + 0.5, z: 34, small: true });
    }
    g.globalCompositeOperation = 'lighter';
    for (const l of lamps) {
      const flick = 0.85 + Math.sin(t * 3 + l.x * 5) * 0.03 + Math.sin(t * 11 + l.y) * 0.02;
      const glow = l.small ? this.smallGlow : this.glow;
      const px = wx(l.x, l.y), py = wy(l.x, l.y);
      this.blit(glow.canvas, px - glow.w / 2, py - glow.h / 2 - (l.small ? 0 : 6), glow.w, glow.h, 0.42 * flick);
    }
    g.globalCompositeOperation = 'source-over';
    // the lamps themselves, hanging from the ceiling
    for (const l of lamps) {
      if (!l.hang) continue;
      const px = wx(l.x, l.y), py = wy(l.x, l.y, 64);
      const [sx, sy] = this.toScreen(px, py), [, top] = this.toScreen(px, wy(l.x, l.y, WALL_H + 6));
      const z = this.zoom;
      g.fillStyle = '#24160f';
      g.fillRect(sx, Math.max(0, top), z, sy - Math.max(0, top));
      g.fillStyle = '#2f4a3a'; g.fillRect(sx - 3 * z, sy, 7 * z, 2 * z);
      g.fillStyle = '#3c5c48'; g.fillRect(sx - 4 * z, sy + 2 * z, 9 * z, 2 * z);
      g.fillStyle = '#fff1c4'; g.fillRect(sx - z, sy + 4 * z, 3 * z, z);
    }
    // warm evening grade over everything
    g.fillStyle = 'rgba(255,170,90,0.05)';
    g.fillRect(0, 0, this.canvas.width, this.canvas.height);
    // steam from the espresso bar
    for (const it of cafe.furniture) {
      if (!CATALOG[it.type].station) continue;
      const [fw, fd] = footprint(it);
      for (let i = 0; i < 4; i++) {
        const k = (t * 0.4 + i / 4) % 1;
        const px = wx(it.x + fw * 0.35, it.y + fd * 0.5) + Math.sin((t + i) * 2) * 2, py = wy(it.x + fw * 0.35, it.y + fd * 0.5, 36 + k * 18);
        const [sx, sy] = this.toScreen(px, py);
        g.fillStyle = `rgba(255,255,255,${0.35 * (1 - k)})`;
        g.fillRect(sx, sy, this.zoom * 2, this.zoom * 2);
      }
    }
  }

  drawFx(t) {
    const now = performance.now() / 1000;
    this.fx = this.fx.filter((f) => now - f.t0 < 1.6);
    for (const f of this.fx) {
      const k = (now - f.t0) / 1.6;
      if (f.kind === 'hearts') {
        for (let i = 0; i < 3; i++) {
          const kk = Math.min(1, Math.max(0, k * 1.3 - i * 0.15));
          if (kk <= 0) continue;
          const px = wx(f.x, f.y) + (i - 1) * 7 + Math.sin(kk * 6 + i) * 2, py = wy(f.x, f.y, (f.z || 14) + kk * 16);
          this.blit(this.heart, px - 3, py - 3, 7, 6, 1 - kk);
        }
      }
    }
  }

  drawBuildGrid(build, cafe) {
    const g = this.g;
    g.strokeStyle = 'rgba(255,230,180,0.18)';
    g.lineWidth = Math.max(1, this.zoom / 2);
    g.beginPath();
    for (let x = 0; x <= ROOM_W; x++) { const [a, b] = this.toScreen(wx(x, 0), wy(x, 0)), [c, d] = this.toScreen(wx(x, ROOM_H), wy(x, ROOM_H)); g.moveTo(a, b); g.lineTo(c, d); }
    for (let y = 0; y <= ROOM_H; y++) { const [a, b] = this.toScreen(wx(0, y), wy(0, y)), [c, d] = this.toScreen(wx(ROOM_W, y), wy(ROOM_W, y)); g.moveTo(a, b); g.lineTo(c, d); }
    g.stroke();
  }

  drawGhost(ghost, cafe) {
    const ok = canPlace(cafe, ghost, ghost.id);
    const g = this.g;
    g.fillStyle = ok ? 'rgba(140,230,120,0.38)' : 'rgba(240,90,80,0.42)';
    for (const [x, y] of tilesOf(ghost)) {
      const pts = [[x, y], [x + 1, y], [x + 1, y + 1], [x, y + 1]].map(([a, b]) => this.toScreen(wx(a, b), wy(a, b)));
      g.beginPath(); pts.forEach(([a, b], i) => (i ? g.lineTo(a, b) : g.moveTo(a, b))); g.closePath(); g.fill();
    }
    const s = this.sprite(ghost.type, ghost.rot);
    this.blit(s.canvas, wx(ghost.x, ghost.y) - s.ax, wy(ghost.x, ghost.y) - s.ay - 2, s.w, s.h, 0.82);
    ghost.valid = ok;
  }

  // tap hit-test for cats (in tile units via screen distance)
  catAt(cats, sx, sy) {
    let best = null, bd = 14 * this.zoom;
    for (const c of cats) {
      const [cx, cy] = this.toScreen(wx(c.x, c.y), wy(c.x, c.y, (c.z || 0) + 6));
      const d = Math.hypot(cx - sx, cy - sy);
      if (d < bd) { bd = d; best = c; }
    }
    return best;
  }

  // icon of a catalog item for the shop
  icon(type) {
    const s = this.sprite(type, 0);
    return s.canvas;
  }
}

// draw order: whatever is further back (smaller x or y) first, then by depth
function sortItems(items) {
  const sorted = [...items].sort((a, b) => a.key - b.key);
  const behind = (a, b) => a.x1 <= b.x0 + 0.001 || a.y1 <= b.y0 + 0.001 || a.z1 <= b.z0;
  const out = [], seen = new Set();
  const visit = (it) => {
    if (seen.has(it)) return;
    seen.add(it);
    for (const o of sorted) if (o !== it && !seen.has(o) && behind(o, it) && !behind(it, o)) visit(o);
    out.push(it);
  };
  for (const it of sorted) visit(it);
  return out;
}

// dithered pixel glow: dense in the middle, sparse at the edge
function makeGlow(rx, ry, col) {
  const p = new Pix(rx * 2, ry * 2);
  const bayer = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
  for (let y = 0; y < ry * 2; y++) for (let x = 0; x < rx * 2; x++) {
    const dx = (x - rx) / rx, dy = (y - ry) / ry, d = Math.sqrt(dx * dx + dy * dy);
    if (d > 1) continue;
    const v = Math.pow(1 - d, 1.3) * 16;
    if (v > bayer[(y % 4) * 4 + (x % 4)]) p.set(x, y, col + (d < 0.35 ? 'aa' : '77'));
  }
  return { canvas: p.toCanvas(), w: p.w, h: p.h };
}

function heartPix() {
  const rows = ['.oo.oo.', 'ohhohho', 'ohhhhho', '.ohhho.', '..oho..', '...o...'];
  const p = new Pix(7, 6);
  rows.forEach((r, y) => [...r].forEach((ch, x) => { if (ch === 'o') p.set(x, y, '#7a2030'); if (ch === 'h') p.set(x, y, '#ff7a90'); }));
  p.set(2, 1, '#ffd0d8');
  return p;
}
function zPix() {
  const rows = ['zzzzz', '...z.', '..z..', '.z...', 'zzzzz'];
  const p = new Pix(5, 5);
  rows.forEach((r, y) => [...r].forEach((ch, x) => { if (ch === 'z') p.set(x, y, '#e9f0ff'); }));
  return p;
}
