// Draws the café: room, furniture, people and cats in depth order, then lamp light,
// rain on the windows, steam and hearts. All sprites are drawn at whole-pixel zoom levels
// so the pixel art stays crisp.
import { Pix } from './art/pix.js';
import { IsoPainter } from './art/iso.js';
import { paintRoom, WALL_H } from './art/room.js';
import { catFrame } from './art/cats.js';
import { personSprite } from './art/people.js';
import { cupCanvas, bubbleCanvas, bubblePix, cupPix, emotePix } from './art/drinks.js';
import { plateCanvas, platePix } from './art/foods.js';
import { t as tr } from './i18n.js';
import { icon } from './ui/icons.js';
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
    this.fireGlow = makeGlow(44, 22, '#ff9a4a');
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
    this.fitZoom = Math.max(2, Math.floor(Math.min(this.canvas.width / roomW, (this.canvas.height - this.offsetY) / roomH)));
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

  // preview: { wall, floor } shown while trying a style in the shop
  ensureRoom(cafe, preview) {
    const wall = preview?.wall || cafe.decor?.wall || 'cream', floor = preview?.floor || cafe.decor?.floor || 'oak';
    const key = JSON.stringify(cafe.walls) + wall + floor;
    if (key !== this.roomKey) {
      const r = paintRoom(ROOM_W, ROOM_H, cafe.walls, floor, wall);
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
    this.ensureRoom(cafe, view.build?.preview);
    g.imageSmoothingEnabled = false;
    g.fillStyle = '#1d130d';
    g.fillRect(0, 0, this.canvas.width, this.canvas.height);
    this.backdrop(t);

    this.blit(this.room.canvas, -this.room.ax, -this.room.ay, this.room.canvas.width, this.room.canvas.height);
    this.rain(t, view.sky);

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

    for (const tp of view.tips || []) {
      items.push({ x0: tp.x - 0.1, x1: tp.x + 0.1, y0: tp.y - 0.1, y1: tp.y + 0.1, z0: tp.z, z1: tp.z + 4, key: tp.x + tp.y, draw: () => this.drawTip(tp, t) });
    }
    for (const p of view.players) {
      const r = 0.22;
      items.push({ x0: p.x - r, x1: p.x + r, y0: p.y - r, y1: p.y + r, z0: 0, z1: 30, key: p.x + p.y, draw: () => this.drawPerson(p, t) });
    }
    for (const u of view.customers || []) {
      const r = 0.22;
      let box = { x0: u.x - r, x1: u.x + r, y0: u.y - r, y1: u.y + r, z0: 0, z1: 30 };
      if (u.z > 0) {
        // seated: in front of the seat when facing the camera, behind its back otherwise
        const tx = Math.floor(u.x), ty = Math.floor(u.y);
        box = u.view === 'front' ? { x0: tx, x1: tx + 1, y0: ty, y1: ty + 1, z0: 50, z1: 90 } : { x0: tx, x1: tx + 1, y0: ty, y1: ty + 1, z0: -2, z1: -1 };
      }
      items.push({ ...box, key: u.x + u.y, draw: () => this.drawPerson({ ...u, sitting: u.z > 0 }, t) });
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
    for (const u of view.customers || []) this.bubble(u, t);
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

  // the sky through the windows follows the time of day; rain only on rainy days
  rain(t, sky = {}) {
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
      if (sky.tint) { g.fillStyle = sky.tint; g.fillRect(x0, y0, x1 - x0, y1 - y0); }
      if (sky.sun) { g.fillStyle = sky.sun; const z = this.zoom; g.fillRect(Math.round((x0 + x1) / 2 / z) * z, Math.round((y0 + (y1 - y0) * sky.sunY) / z) * z, z * 3, z * 3); }
      if (sky.rain !== false) {
        const z = this.zoom, n = Math.max(6, Math.round(((x1 - x0) / z) * 0.5));
        g.fillStyle = 'rgba(170,190,220,0.45)';
        for (let i = 0; i < n; i++) {
          const seed = (i * 9301 + 49297) % 233280 / 233280;
          const x = x0 + Math.floor((seed * (x1 - x0)) / z) * z;
          const speed = 90 + seed * 60;
          const y = y0 + ((t * speed * z + seed * 997) % (y1 - y0 + 6 * z)) - 3 * z;
          g.fillRect(x, Math.floor(y / z) * z, z, z * 3);
        }
      }
      g.restore();
    }
  }

  drawTip(tp, t) {
    if (!this.tipImg) this.tipImg = coinPile().toCanvas();
    const px = wx(tp.x, tp.y), py = wy(tp.x, tp.y, tp.z);
    const bob = Math.floor(t * 2 + tp.x) % 2;
    this.blit(this.tipImg, px - 4, py - 5, 9, 6);
    // a little sparkle so tips are easy to spot
    if (Math.floor(t * 3 + tp.y * 5) % 4 === 0) { const [sx, sy] = this.toScreen(px + 3, py - 7 - bob); this.g.fillStyle = '#fff6c4'; this.g.fillRect(sx, sy, this.zoom, this.zoom); }
  }
  tipAt(tips, sx, sy) {
    let best = null, bd = 12 * this.zoom;
    for (const tp of tips || []) { const [cx, cy] = this.toScreen(wx(tp.x, tp.y), wy(tp.x, tp.y, tp.z + 2)); const d = Math.hypot(cx - sx, cy - sy); if (d < bd) { bd = d; best = tp; } }
    return best;
  }

  drawPerson(p, t) {
    const frame = p.sitting ? 6 : p.moving ? Math.floor(t * 8) % 4 : (Math.floor(t * 1.5 + (p.x * 3)) % 2) + 4;
    const s = personSprite(p.look, p.view || 'front', frame, !!p.flip);
    const px = wx(p.x, p.y), py = wy(p.x, p.y, p.z || 0);
    if (!p.z) this.shadow(px, py, 6);
    // seated people rest their hips on the seat with their legs hanging down
    // seated people sink into the seat a little so they sit lower than anyone standing
    const lift = p.sitting ? (p.view === 'back' ? 20 : 18) : 27;
    this.blit(s.canvas, px - 8, py - lift, s.w, s.h);
    // something in hand: what a barista carries, or what a customer is enjoying
    let thing = p.carry ? (p.carry.startsWith('f:') ? plateCanvas(p.carry.slice(2)) : cupCanvas(p.carry, p.carryExtra)) : null;
    if (!thing && p.state === 'drink' && p.items) {
      const d = p.items.find((i) => i.kind === 'drink'), f = p.items.find((i) => i.kind === 'food');
      if (d) thing = cupCanvas(d.id, d.extra);
      if (f) { const pc = plateCanvas(f.id); this.blit(pc, px - 7 + (p.flip ? -6 : 6), py - (p.sitting ? 8 : 12), pc.width, pc.height); }
    }
    if (thing) {
      const hx = p.view === 'back' ? (p.flip ? 3 : -11) : (p.flip ? -10 : 4);
      this.blit(thing, px + hx - Math.max(0, thing.width - 11) / 2, py - (p.sitting ? 11 : 16) - Math.max(0, thing.height - 11), thing.width, thing.height);
    }
  }

  // order bubbles: every item still wanted, who's making it, and ticks for what has arrived
  bubble(u, t) {
    const bob = Math.round(Math.sin(t * 2.5 + u.x) * 1);
    const px = wx(u.x, u.y), py = wy(u.x, u.y, (u.z || 0) + (u.z ? 25 : 31) + bob);
    if (u.emote) { const c = bubbleCanvas(u.emote); this.blit(c, px - Math.floor(c.width / 2), py - c.height, c.width, c.height); return; }
    if (u.state !== 'order' || !u.items?.length) return;
    const key = JSON.stringify(u.items.map((i) => [i.kind, i.id, i.extra, i.byColor, i.done]));
    this.bubbles ??= new Map();
    if (!this.bubbles.has(key)) {
      const parts = u.items.map((i) => {
        const sp = i.kind === 'food' ? platePix(i.id) : cupPix(i.id, i.extra);
        if (i.done) { sp.data = sp.data.map((v) => (v >>> 24 ? ((v & 0x00ffffff) | 0x55000000) >>> 0 : v)); const ck = emotePix('check'); sp.blit(ck, sp.w - ck.w, sp.h - ck.h); }
        else if (i.byColor) { sp.rect(sp.w - 4, 0, 4, 4, '#24160f'); sp.rect(sp.w - 3, 1, 2, 2, i.byColor); }
        return sp;
      });
      const w = parts.reduce((a, q) => a + q.w + 1, -1), h = Math.max(...parts.map((q) => q.h));
      const inner = new Pix(w, h);
      let x = 0;
      for (const q of parts) { inner.blit(q, x, h - q.h); x += q.w + 1; }
      this.bubbles.set(key, bubblePix(inner).toCanvas());
      if (this.bubbles.size > 200) this.bubbles.delete(this.bubbles.keys().next().value);
    }
    const c = this.bubbles.get(key);
    const faded = u.items.every((i) => i.done || i.by);
    this.blit(c, px - Math.floor(c.width / 2), py - c.height, c.width, c.height, faded ? 0.75 : 1);
    // whoever is making it, by name
    const maker = u.items.find((i) => i.by && !i.done);
    if (maker?.byName) this.label(px, py - c.height - 2, tr('{name} is making it', { name: maker.byName }), maker.byColor);
  }

  label(px, py, text, color) {
    const g = this.g, [sx, sy] = this.toScreen(px, py);
    const size = Math.max(9, Math.round(this.zoom * 2.6));
    g.font = `600 ${size}px "Pixelify Sans", monospace`; g.textAlign = 'center'; g.textBaseline = 'middle';
    const w = g.measureText(text).width + size;
    g.fillStyle = 'rgba(36,22,15,0.85)'; g.fillRect(Math.round(sx - w / 2), Math.round(sy - size * 0.65), Math.round(w), Math.round(size * 1.3));
    if (color) { g.fillStyle = color; g.fillRect(Math.round(sx - w / 2), Math.round(sy - size * 0.65), Math.max(2, Math.round(size * 0.3)), Math.round(size * 1.3)); }
    g.fillStyle = '#fbf6ea'; g.fillText(text, sx, sy + 1);
  }

  // tap hit-test for people (customers)
  personAt(list, sx, sy) {
    let best = null, bd = 16 * this.zoom;
    for (const u of list) {
      const [cx, cy] = this.toScreen(wx(u.x, u.y), wy(u.x, u.y, (u.z || 0) + 12));
      const d = Math.hypot(cx - sx, cy - sy);
      if (d < bd) { bd = d; best = u; }
    }
    return best;
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
    const s = catFrame(frame, c.coat, !!c.flip, c.collar || 'none');
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
    // evening dims the room so the lamps glow; morning is a touch brighter
    if (view.sky?.dark) { g.fillStyle = `rgba(20,14,40,${view.sky.dark})`; g.fillRect(0, 0, this.canvas.width, this.canvas.height); }
    // pendant lamps hang over every table and over the counter
    const lamps = [];
    for (const it of cafe.furniture) {
      const def = CATALOG[it.type];
      const [fw, fd] = footprint(it);
      if (def.table || def.station) lamps.push({ x: it.x + fw / 2, y: it.y + fd / 2, hang: true });
      if (def.glow) lamps.push({ x: it.x + fw / 2, y: it.y + fd / 2, z: def.glow, small: true });
      if (def.fire) lamps.push({ x: it.x + fw / 2, y: it.y + fd / 2, fire: true });
    }
    g.globalCompositeOperation = 'lighter';
    for (const l of lamps) {
      let flick = 0.85 + Math.sin(t * 3 + l.x * 5) * 0.03 + Math.sin(t * 11 + l.y) * 0.02;
      if (l.fire) flick = 0.8 + Math.sin(t * 7 + l.x) * 0.08 + Math.sin(t * 17) * 0.06;
      const glow = l.fire ? this.fireGlow : l.small ? this.smallGlow : this.glow;
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
    // fairy lights on holiday trees blink in turn
    const TW = [[-6, 12], [5, 15], [-3, 21], [4, 26], [-2, 32], [2, 37], [7, 9], [0, 18], [-5, 27]];
    const TWC = ['#ff6a6a', '#ffe08a', '#8fd1ff', '#9be37a'];
    for (const it of cafe.furniture) {
      if (!CATALOG[it.type].twinkle || view.build?.hideId === it.id) continue;
      const bx = wx(it.x + 0.5, it.y + 0.5), by = wy(it.x + 0.5, it.y + 0.5);
      TW.forEach(([dx, dz], i) => {
        if ((Math.floor(t * 2.2) + i) % 3 === 0) return;
        const [sx, sy] = this.toScreen(bx + dx, by - dz);
        g.fillStyle = TWC[(i + Math.floor(t * 0.7)) % TWC.length];
        g.fillRect(sx, sy, this.zoom, this.zoom);
      });
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
      if (f.kind === 'coins') {
        const px = wx(f.x, f.y), py = wy(f.x, f.y, (f.z || 20) + k * 18);
        const [sx, sy] = this.toScreen(px, py);
        const g = this.g, z = this.zoom;
        g.globalAlpha = 1 - k * k;
        if (!this.coinImg) { this.coinImg = new Image(); this.coinImg.src = icon('coin', 1); }
        g.imageSmoothingEnabled = false;
        if (this.coinImg.complete) g.drawImage(this.coinImg, sx - 9 * z / 2 - 2 * z, sy - 4 * z, 8 * z, 8 * z);
        g.font = `700 ${Math.round(5 * z)}px "Pixelify Sans", monospace`;
        g.textAlign = 'left'; g.textBaseline = 'middle';
        g.fillStyle = '#24160f'; g.fillText(`+${f.amount}`, sx + z * 3, sy + z);
        g.fillStyle = '#ffd27a'; g.fillText(`+${f.amount}`, sx + z * 2, sy);
        g.globalAlpha = 1;
      }
      if (f.kind === 'coins' && f.stars) {
        for (let i = 0; i < f.stars; i++) {
          const kk = Math.min(1, k * 1.4), px = wx(f.x, f.y) + (i - (f.stars - 1) / 2) * 8, py = wy(f.x, f.y, (f.z || 20) + 14 + kk * 10 + (i === 1 ? 2 : 0));
          if (!this.starImg) this.starImg = starPix().toCanvas();
          this.blit(this.starImg, px - 3, py - 3, 7, 7, 1 - kk * kk);
        }
      }
      if (f.kind === 'flash' && k < 0.25) {
        const [sx, sy] = this.toScreen(wx(f.x, f.y), wy(f.x, f.y, f.z || 20));
        const g = this.g, z = this.zoom, r = (4 + k * 30) * z;
        g.fillStyle = `rgba(255,255,240,${0.8 - k * 3})`;
        g.fillRect(sx - r, sy - z, r * 2, z * 2); g.fillRect(sx - z, sy - r, z * 2, r * 2);
      }
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
function starPix() {
  const rows = ['...o...', '..oyo..', 'ooyyyoo', 'oyyyyyo', '.oyyyo.', '.oyoyo.', '.oo.oo.'];
  const p = new Pix(7, 7);
  rows.forEach((r, y) => [...r].forEach((ch, x) => { if (ch === 'o') p.set(x, y, '#24160f'); if (ch === 'y') p.set(x, y, '#ffd27a'); }));
  p.set(3, 2, '#fff6c4');
  return p;
}
function coinPile() {
  const rows = ['..ooooo..', '.oyyyyyo.', 'ooyyyyyoo', 'oyoyyyoyo', 'oyyoooyyo', '.ooooooo.'];
  const p = new Pix(9, 6);
  rows.forEach((r, y) => [...r].forEach((ch, x) => { if (ch === 'o') p.set(x, y, '#8e5a1c'); if (ch === 'y') p.set(x, y, '#ffd27a'); }));
  p.set(3, 1, '#fff6c4');
  return p;
}
function zPix() {
  const rows = ['zzzzz', '...z.', '..z..', '.z...', 'zzzzz'];
  const p = new Pix(5, 5);
  rows.forEach((r, y) => [...r].forEach((ch, x) => { if (ch === 'z') p.set(x, y, '#e9f0ff'); }));
  return p;
}
