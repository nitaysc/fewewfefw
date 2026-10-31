// Draws the café in 3D with three.js: a lit dollhouse room seen from an isometric angle, soft
// shadows, warm lamps, animated people and cats. Speech bubbles, names and coin pop-ups are
// drawn on a 2D canvas laid over the top. The public methods match what main.js expects:
// draw(view), resize(), centre(), clampCam(), toTile(), personAt(), catAt(), tipAt(), icon(),
// addFx(), plus cam {x, y} in old "world pixels", zoom, userZoom, offsetY and dpr.
import { THREE, ZS, WALL_H3, compact, rbox, cyl, ball, mat } from './three/kit.js';
import { itemModel } from './three/furniture.js';
import { buildRoom, SkyPane } from './three/room3d.js';
import { makePerson, posePerson, heldThing } from './three/people3d.js';
import { makeCat, poseCat } from './three/cats3d.js';
import { softSpot } from './three/textures.js';
import { Pix } from './art/pix.js';
import { bubblePix, cupPix, emotePix, bubbleCanvas } from './art/drinks.js';
import { platePix } from './art/foods.js';
import { t as tr } from './i18n.js';
import { icon } from './ui/icons.js';
import { CATALOG } from './game/catalog.js';
import { footprint, ROOM_W, ROOM_H, canPlace, tilesOf } from './game/world.js';

const ISO = new THREE.Vector3(1, Math.tan(Math.PI / 6) * Math.SQRT2, 1).normalize();
const PX = 16 * Math.SQRT2; // canvas pixels per tile across the screen at zoom 1
const LAMPS = 6;

export class Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.zoom = 3;
    this.offsetY = 0;
    this.cam = { x: 0, y: 40 };
    this.sprites = { clear: () => {} }; // old sprite cache: nothing to clear in 3D
    this.fx = [];
    this.gl = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance', alpha: true });
    this.gl.setPixelRatio(1);
    this.gl.outputColorSpace = THREE.SRGBColorSpace;
    this.gl.toneMapping = THREE.ACESFilmicToneMapping;
    this.gl.toneMappingExposure = 1.05;
    this.gl.shadowMap.enabled = true;
    this.gl.shadowMap.type = THREE.PCFSoftShadowMap;
    this.gl.setClearColor('#1a110c');

    this.scene = new THREE.Scene();
    this.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 200);
    this.scene.add(this.camera);
    // light: warm sky and bounce, a soft key light through the windows, lamps for the evening
    this.hemi = new THREE.HemisphereLight('#fff1dc', '#6a4a36', 1.55);
    this.scene.add(this.hemi);
    this.sun = new THREE.DirectionalLight('#ffe7c4', 2.1);
    this.sun.position.set(ROOM_W * 0.5 + 6, 12, ROOM_H * 0.5 + 9);
    this.sun.target.position.set(ROOM_W / 2, 0, ROOM_H / 2);
    this.sun.castShadow = true;
    const sc = this.sun.shadow.camera;
    sc.left = -9; sc.right = 9; sc.top = 9; sc.bottom = -9; sc.near = 1; sc.far = 40;
    this.sun.shadow.mapSize.set(2048, 2048);
    this.sun.shadow.bias = -0.0006; this.sun.shadow.normalBias = 0.02; this.sun.shadow.radius = 4;
    this.scene.add(this.sun, this.sun.target);
    this.fill = new THREE.DirectionalLight('#c8d8ff', 0.35);
    this.fill.position.set(-4, 6, -2); this.scene.add(this.fill);
    this.lamps = [];
    for (let i = 0; i < LAMPS; i++) { const l = new THREE.PointLight('#ffb866', 0, 3.6, 1.6); this.scene.add(l); this.lamps.push(l); }

    this.world = new THREE.Group(); this.scene.add(this.world);
    this.itemsG = new THREE.Group(); this.world.add(this.itemsG);
    this.actorsG = new THREE.Group(); this.world.add(this.actorsG);
    this.items = new Map(); // furniture id -> { obj, key }
    this.people = new Map(); // id -> rig
    this.catRigs = new Map();
    this.extras = new THREE.Group(); this.world.add(this.extras); // cups on tables, tips, ghost, grid
    this.sky = new SkyPane();
    this.roomKey = '';
    this.spot = softSpot('20,10,5');
    this.glowTex = softSpot('255,200,120');
    this.shadowMat = new THREE.MeshBasicMaterial({ map: this.spot, transparent: true, opacity: 0.45, depthWrite: false });
    this.shadowGeo = new THREE.PlaneGeometry(1, 1);
    this.glows = [];
    this.steam = [];
    this.lastT = 0;

    // overlay for bubbles and names
    this.ov = document.createElement('canvas');
    this.ov.id = 'overlay';
    Object.assign(this.ov.style, { position: 'fixed', inset: '0', width: '100%', height: '100%', pointerEvents: 'none' });
    canvas.after(this.ov);
    this.g = this.ov.getContext('2d');
    this.heart = heartPix().toCanvas();
    this.zzz = zPix().toCanvas();
    this.resize();
  }

  get ui() { return Math.max(2, Math.min(5, Math.round(this.zoom * 0.85))); }

  resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2.5);
    this.dpr = dpr;
    const w = Math.round(window.innerWidth * dpr), h = Math.round(window.innerHeight * dpr);
    this.gl.setSize(w, h, false);
    this.ov.width = w; this.ov.height = h;
    const roomW = (ROOM_W + ROOM_H) * 16 + 40, roomH = (ROOM_W + ROOM_H) * 8 + 70;
    this.fitZoom = Math.max(1, Math.min(w / roomW, (h - this.offsetY) / roomH));
    if (!this.userZoom) this.zoom = this.fitZoom;
    this.clampCam();
  }
  clampCam() {
    const minx = -ROOM_H * 16, maxx = ROOM_W * 16, miny = -60, maxy = (ROOM_W + ROOM_H) * 8;
    this.cam.x = Math.max(minx, Math.min(maxx, this.cam.x));
    this.cam.y = Math.max(miny, Math.min(maxy, this.cam.y));
  }
  centre() { this.cam.x = (ROOM_W - ROOM_H) * 8; this.cam.y = (ROOM_W + ROOM_H) * 4 - 26; }

  // camera from cam/zoom: the floor point under cam sits at the screen centre (minus the tray)
  placeCamera() {
    const w = this.canvas.width, h = this.canvas.height, s = PX * this.zoom;
    const tx = (this.cam.x / 16 + this.cam.y / 8) / 2, tz = (this.cam.y / 8 - this.cam.x / 16) / 2;
    const target = new THREE.Vector3(tx, 0, tz);
    const c = this.camera;
    c.left = -w / 2 / s; c.right = w / 2 / s;
    c.top = (h / 2 - this.offsetY) / s; c.bottom = -(h / 2 + this.offsetY) / s;
    c.position.copy(target).addScaledVector(ISO, 60);
    c.lookAt(target);
    c.updateProjectionMatrix(); c.updateMatrixWorld();
  }
  // tile coordinates (x, y, height in old pixels) -> canvas pixels
  project(x, y, zpx = 0) {
    const v = new THREE.Vector3(x, zpx * ZS, y).project(this.camera);
    return [(v.x + 1) / 2 * this.canvas.width, (1 - v.y) / 2 * this.canvas.height];
  }
  toTile(sx, sy) {
    this.placeCamera();
    const ndc = new THREE.Vector2(sx / this.canvas.width * 2 - 1, 1 - sy / this.canvas.height * 2);
    const ray = new THREE.Raycaster(); ray.setFromCamera(ndc, this.camera);
    const o = ray.ray.origin, d = ray.ray.direction, k = -o.y / d.y;
    return [o.x + d.x * k, o.z + d.z * k];
  }

  addFx(f) { this.fx.push({ ...f, t0: performance.now() / 1000 }); }

  ensureRoom(cafe, preview) {
    const wall = preview?.wall || cafe.decor?.wall || 'cream', floor = preview?.floor || cafe.decor?.floor || 'oak';
    const key = JSON.stringify(cafe.walls) + wall + floor;
    if (key === this.roomKey) return;
    if (this.room) this.world.remove(this.room);
    this.room = buildRoom(ROOM_W, ROOM_H, cafe.walls, floor, wall, this.sky);
    this.world.add(this.room);
    this.roomKey = key;
  }

  // ---------- furniture ----------
  placeItem(obj, it) {
    const def = CATALOG[it.type], r = def.rotates ? it.rot || 0 : 0;
    const [w0, d0] = footprint(it);
    obj.position.set(it.x + w0 / 2, 0, it.y + d0 / 2);
    obj.rotation.y = -r * Math.PI / 2;
  }
  syncItems(cafe, build) {
    const seen = new Set();
    for (const it of cafe.furniture) {
      if (!CATALOG[it.type]) continue;
      seen.add(it.id);
      let e = this.items.get(it.id);
      if (!e || e.type !== it.type) {
        if (e) this.itemsG.remove(e.obj);
        e = { obj: itemModel(it.type), type: it.type };
        this.items.set(it.id, e); this.itemsG.add(e.obj);
      }
      this.placeItem(e.obj, it);
      e.obj.visible = build?.hideId !== it.id;
    }
    for (const [id, e] of this.items) if (!seen.has(id)) { this.itemsG.remove(e.obj); this.items.delete(id); }
  }

  // ---------- people and cats ----------
  rigFor(map, id, make, key) {
    let r = map.get(id);
    if (!r || r.key !== key) {
      if (r) this.actorsG.remove(r.root);
      r = make(); r.key = key; r.seen = 0;
      r.shadow = new THREE.Mesh(this.shadowGeo, this.shadowMat); r.shadow.rotation.x = -Math.PI / 2; r.shadow.renderOrder = 1;
      this.actorsG.add(r.root, r.shadow);
      map.set(id, r);
    }
    r.seen = this.frameNo;
    return r;
  }
  // smooth heading from movement, or from view/flip when standing still
  heading(r, x, y, view, flip, dt, moving) {
    let want = r.want ?? null;
    if (r.px != null && moving) {
      const dx = x - r.px, dy = y - r.py;
      if (dx * dx + dy * dy > 1e-6) want = Math.atan2(dx, dy);
    } else if (!moving) {
      const sx = flip ? -1 : 1, sy = view === 'back' ? -1 : 1;
      want = Math.atan2((sx + sy) / 2, (sy - sx) / 2);
    }
    r.px = x; r.py = y;
    if (want == null) want = 0;
    r.want = want;
    let d = want - r.heading; d = Math.atan2(Math.sin(d), Math.cos(d));
    r.heading += d * Math.min(1, dt * 12);
    return r.heading;
  }
  drawPeople(view, t, dt) {
    const all = [...view.players.map((p) => ({ ...p, kind: 'p' })), ...(view.customers || []).map((u) => ({ ...u, kind: 'u' }))];
    for (const p of all) {
      const id = p.kind + p.id;
      const r = this.rigFor(this.people, id, () => makePerson(p.look || {}), JSON.stringify(p.look || {}));
      const sitting = (p.z || 0) > 0;
      const hd = this.heading(r, p.x, p.y, p.view, p.flip, dt, p.moving && !sitting);
      r.root.rotation.y = hd;
      const drinking = p.kind === 'u' && p.state === 'drink' && !p.table;
      const drinkId = drinking ? (p.items?.find((i) => i.kind === 'drink')?.id || (p.items?.[0] ? 'f:' + p.items[0].id : null)) : null;
      posePerson(r, { t, sitting, seatH: (p.z || 0) * ZS, moving: p.moving && !sitting, carry: p.carry ? p.carry : null, drinking: !!drinkId, drinkId, phase: (p.seed || p.x * 7) % 10 });
      r.root.position.x = p.x; r.root.position.z = p.y;
      r.shadow.position.set(p.x, 0.012, p.y); r.shadow.scale.set(0.6, 0.6, 1); r.shadow.visible = !sitting;
      // what they ordered, on the table in front of them
      if (p.kind === 'u' && p.state === 'drink' && p.table && p.items) {
        const [tx0, ty0, tz] = p.table;
        const cx = tx0 + 0.5 + (p.x - tx0 - 0.5) * 0.38, cy = ty0 + 0.5 + (p.y - ty0 - 0.5) * 0.38;
        p.items.forEach((i, n) => {
          const ox = (n - (p.items.length - 1) / 2) * 0.2;
          this.tableThing(i.kind === 'food' ? 'f:' + i.id : i.id, cx + ox * 0.7, cy - ox * 0.7, tz * ZS);
        });
      }
    }
    for (const [id, r] of this.people) if (r.seen !== this.frameNo) { this.actorsG.remove(r.root, r.shadow); this.people.delete(id); }
  }
  tableThing(kind, x, y, h) {
    this.thingPool ??= new Map();
    const key = kind + '@' + x.toFixed(2) + ',' + y.toFixed(2);
    let o = this.thingPool.get(key);
    if (!o) { o = heldThing(kind); this.thingPool.set(key, o); this.extras.add(o); }
    o.position.set(x, h, y); o.userData.seen = this.frameNo; o.visible = true;
  }
  drawCats(view, t, dt) {
    for (const c of view.cats) {
      const r = this.rigFor(this.catRigs, c.id, () => makeCat(c.coat, c.collar), (c.coat || '') + (c.collar || ''));
      const moving = c.state === 'walk';
      r.root.rotation.y = this.heading(r, c.x, c.y, 'front', c.flip, dt, moving);
      if (!moving && r.want != null && c.state !== 'walk') r.root.rotation.y = r.heading;
      poseCat(r, c.state === 'perch' ? 'sit' : c.state, t, (c.x * 7 + c.y * 3) % 5);
      r.root.position.set(c.x, (c.z || 0) * ZS, c.y);
      r.shadow.position.set(c.x, (c.z || 0) * ZS + 0.012, c.y); r.shadow.scale.set(0.45, 0.45, 1);
    }
    for (const [id, r] of this.catRigs) if (r.seen !== this.frameNo) { this.actorsG.remove(r.root, r.shadow); this.catRigs.delete(id); }
  }

  // ---------- lights ----------
  lighting(cafe, view, t) {
    const dark = view.sky?.dark || 0;
    const k = 1 - Math.min(1, dark * 2.6);
    this.hemi.intensity = 0.75 + 0.8 * k;
    this.sun.intensity = 0.35 + 1.75 * k;
    this.sun.color.set(dark > 0.1 ? '#ffc890' : '#ffe7c4');
    this.gl.toneMappingExposure = 1.0 + 0.1 * k;
    const lamps = [];
    for (const it of cafe.furniture) {
      const def = CATALOG[it.type]; if (!def) continue;
      const [fw, fd] = footprint(it);
      const x = it.x + fw / 2, y = it.y + fd / 2;
      if (def.fire) lamps.push({ x, y, h: 0.5, c: '#ff8a3a', p: 2.2, fire: true });
      else if (def.glow) lamps.push({ x, y, h: def.glow * ZS, c: '#ffc070', p: 1.4 });
      else if (def.table || def.station) lamps.push({ x, y, h: 1.9, c: '#ffbd70', p: 1.1, hang: true });
    }
    // the closest lamps to the middle of the view get real lights; every lamp gets a glow
    lamps.sort((a, b) => (a.fire ? -1 : 0) - (b.fire ? -1 : 0));
    const night = 0.35 + (1 - k) * 1.2;
    this.lamps.forEach((l, i) => {
      const L = lamps[i];
      if (!L) { l.intensity = 0; return; }
      const flick = L.fire ? 0.8 + Math.sin(t * 7 + L.x) * 0.1 + Math.sin(t * 17) * 0.08 : 0.97 + Math.sin(t * 3 + L.x * 5) * 0.03;
      l.position.set(L.x, L.h, L.y); l.color.set(L.c); l.intensity = L.p * night * flick;
    });
    this.lampList = lamps;
  }
  // pendant lamps over tables and the bar, rebuilt only when the furniture changes
  syncPendants(cafe) {
    const key = cafe.furniture.filter((it) => CATALOG[it.type]?.table || CATALOG[it.type]?.station).map((it) => it.id + it.x + ',' + it.y + it.rot).join('|');
    if (key === this.pendKey) return;
    this.pendKey = key;
    if (this.pendants) this.world.remove(this.pendants);
    const g = new THREE.Group();
    for (const it of cafe.furniture) {
      const def = CATALOG[it.type]; if (!def || !(def.table || def.station)) continue;
      const [fw, fd] = footprint(it), x = it.x + fw / 2, z = it.y + fd / 2;
      g.add(cyl(0.008, 0.008, WALL_H3 + 0.3 - 2.05, '#24160f', x, (WALL_H3 + 0.3 + 2.05) / 2, z, 4));
      const sh = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.2, 0.16, 20, 1, true), mat('#2f4a3a', { side: true, rough: 0.5 }));
      sh.position.set(x, 1.98, z); g.add(sh);
      g.add(ball(0.05, '#fff1c4', x, 1.92, z, 1, 1, 1, { emissive: '#ffe0a0', glow: 2.2 }));
    }
    this.pendants = compact(g, { shadows: false });
    this.world.add(this.pendants);
  }

  // ---------- each frame ----------
  draw(view) {
    const { cafe } = view;
    const t = view.time, dt = Math.min(0.1, Math.max(0.001, t - (this.lastT || t)));
    this.lastT = t;
    this.frameNo = (this.frameNo || 0) + 1;
    this.ensureRoom(cafe, view.build?.preview);
    this.syncItems(cafe, view.build);
    this.syncPendants(cafe);
    this.sky.update(view.sky, t);
    if (this.thingPool) for (const o of this.thingPool.values()) o.visible = false;
    this.drawPeople(view, t, dt);
    this.drawCats(view, t, dt);
    if (this.thingPool) for (const [k, o] of this.thingPool) if (o.userData.seen !== this.frameNo && this.thingPool.size > 60) { this.extras.remove(o); this.thingPool.delete(k); }
    this.drawTips(view.tips || [], t);
    this.drawBuild(view.build, cafe);
    this.animateLive(t);
    this.lighting(cafe, view, t);
    this.placeCamera();
    this.gl.render(this.scene, this.camera);

    // 2D layer on top
    const g = this.g;
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.clearRect(0, 0, this.ov.width, this.ov.height);
    g.imageSmoothingEnabled = false;
    this.drawGlows(t);
    this.drawSteam(cafe, t);
    for (const c of view.cats) if (c.state === 'sleep') this.drawZzz(c, t);
    this.drawFx(t);
    for (const u of view.customers || []) this.bubble(u, t);
    for (const p of view.players) this.nameTag(p);
  }

  animateLive(t) {
    for (const { obj } of this.items.values()) {
      obj.traverse((o) => {
        if (o.userData.flame != null) { const i = o.userData.flame; o.scale.set(1, 0.8 + Math.sin(t * 9 + i * 1.7) * 0.2 + Math.sin(t * 23 + i) * 0.08, 1); }
        if (o.userData.twinkle != null) { o.material.emissiveIntensity = ((Math.floor(t * 2.2) + o.userData.twinkle) % 3) ? 1.6 : 0.1; }
      });
    }
  }

  drawTips(tips, t) {
    this.tipObjs ??= new Map();
    const seen = new Set();
    for (const tp of tips) {
      seen.add(tp.id);
      let o = this.tipObjs.get(tp.id);
      if (!o) {
        o = new THREE.Group();
        for (let i = 0; i < 3; i++) o.add(cyl(0.06, 0.06, 0.018, '#e8b84a', (i - 1) * 0.04, 0.009 + i * 0.018, (i % 2) * 0.03, 18, { metal: 0.7, rough: 0.3, emissive: '#6a4a10', glow: 0.4 }));
        this.tipObjs.set(tp.id, o); this.extras.add(o);
      }
      o.position.set(tp.x, tp.z * ZS, tp.y);
      o.rotation.y = t * 0.8;
    }
    for (const [id, o] of this.tipObjs) if (!seen.has(id)) { this.extras.remove(o); this.tipObjs.delete(id); }
  }

  drawBuild(build, cafe) {
    if (!this.grid) {
      const pts = [];
      for (let x = 0; x <= ROOM_W; x++) pts.push(x, 0.01, 0, x, 0.01, ROOM_H);
      for (let y = 0; y <= ROOM_H; y++) pts.push(0, 0.01, y, ROOM_W, 0.01, y);
      const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
      this.grid = new THREE.LineSegments(geo, new THREE.LineBasicMaterial({ color: '#ffe6b4', transparent: true, opacity: 0.25 }));
      this.extras.add(this.grid);
      this.ghostTiles = new THREE.Group(); this.extras.add(this.ghostTiles);
    }
    this.grid.visible = !!build;
    const ghost = build?.ghost;
    if (this.ghostObj && (!ghost || this.ghostObj.userData.type !== ghost.type)) { this.extras.remove(this.ghostObj); this.ghostObj = null; }
    this.ghostTiles.clear();
    if (!ghost) return;
    const ok = canPlace(cafe, ghost, ghost.id);
    ghost.valid = ok;
    const tm = new THREE.MeshBasicMaterial({ color: ok ? '#8ce678' : '#f05a50', transparent: true, opacity: 0.45, depthWrite: false });
    for (const [x, y] of tilesOf(ghost)) { const p = new THREE.Mesh(this.shadowGeo, tm); p.rotation.x = -Math.PI / 2; p.position.set(x + 0.5, 0.015, y + 0.5); p.scale.set(0.96, 0.96, 1); this.ghostTiles.add(p); }
    if (!this.ghostObj) {
      this.ghostObj = itemModel(ghost.type);
      this.ghostObj.traverse((o) => { if (o.isMesh) { o.material = o.material.clone(); o.material.transparent = true; o.material.opacity = 0.75; o.castShadow = false; } });
      this.ghostObj.userData.type = ghost.type;
      this.extras.add(this.ghostObj);
    }
    this.placeItem(this.ghostObj, ghost);
    this.ghostObj.position.y = 0.04;
  }

  // ---------- overlay ----------
  blit(img, sx, sy, w, h, alpha = 1) {
    const g = this.g;
    if (alpha !== 1) g.globalAlpha = alpha;
    g.drawImage(img, Math.round(sx), Math.round(sy), Math.round(w), Math.round(h));
    if (alpha !== 1) g.globalAlpha = 1;
  }
  drawGlows(t) {
    const g = this.g;
    if (!this.glowCanvas) {
      const c = document.createElement('canvas'); c.width = c.height = 128;
      const x = c.getContext('2d'), gr = x.createRadialGradient(64, 64, 0, 64, 64, 64);
      gr.addColorStop(0, 'rgba(255,214,140,0.55)'); gr.addColorStop(0.4, 'rgba(255,190,110,0.18)'); gr.addColorStop(1, 'rgba(255,170,90,0)');
      x.fillStyle = gr; x.fillRect(0, 0, 128, 128); this.glowCanvas = c;
    }
    g.globalCompositeOperation = 'lighter';
    for (const L of this.lampList || []) {
      const [sx, sy] = this.project(L.x, L.y, L.h / ZS);
      const r = PX * this.zoom * (L.fire ? 1.0 : L.hang ? 0.55 : 0.7) * (1 + Math.sin(t * 3 + L.x) * 0.02);
      this.blit(this.glowCanvas, sx - r, sy - r, r * 2, r * 2, L.fire ? 0.7 : 0.5);
    }
    g.globalCompositeOperation = 'source-over';
  }
  drawSteam(cafe, t) {
    const g = this.g;
    for (const it of cafe.furniture) {
      if (!CATALOG[it.type]?.station) continue;
      const [fw, fd] = footprint(it);
      const r = CATALOG[it.type].rotates ? it.rot || 0 : 0;
      const mx = -0.35, ang = -r * Math.PI / 2;
      const cx = it.x + fw / 2 + Math.cos(ang) * mx, cy = it.y + fd / 2 - Math.sin(ang) * mx;
      for (let i = 0; i < 5; i++) {
        const k = (t * 0.35 + i / 5) % 1;
        const [sx, sy] = this.project(cx + Math.sin((t + i) * 1.7) * 0.05, cy, 30 + k * 30);
        const rad = (2 + k * 5) * this.ui;
        g.fillStyle = `rgba(255,255,255,${0.28 * (1 - k)})`;
        g.beginPath(); g.arc(sx, sy, rad, 0, 7); g.fill();
      }
    }
  }
  drawZzz(c, t) {
    const phase = c.x * 7 + c.y * 3, k = (t * 0.7 + phase) % 1;
    const [sx, sy] = this.project(c.x, c.y, (c.z || 0) + 14 + k * 10);
    const u = this.ui;
    this.blit(this.zzz, sx + 6 * u + k * 4 * u, sy, 5 * u, 5 * u, 1 - k);
  }
  bubble(u, t) {
    const bob = Math.sin(t * 2.5 + u.x) * 1.5;
    const U = this.ui;
    const [px, py0] = this.project(u.x, u.y, (u.z || 0) + (u.z ? 50 : 52));
    const py = py0 + bob;
    if (u.emote) { const c = bubbleCanvas(u.emote); this.blit(c, px - c.width * U / 2, py - c.height * U, c.width * U, c.height * U); return; }
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
    this.blit(c, px - c.width * U / 2, py - c.height * U, c.width * U, c.height * U, faded ? 0.8 : 1);
    const maker = u.items.find((i) => i.by && !i.done);
    if (maker?.byName) this.label(px, py - c.height * U - 3 * U, tr('{name} is making it', { name: maker.byName }), maker.byColor);
  }
  label(sx, sy, text, color) {
    const g = this.g, size = Math.max(10, Math.round(this.ui * 3));
    g.font = `600 ${size}px "Pixelify Sans", system-ui, sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle';
    const w = g.measureText(text).width + size;
    roundRect(g, sx - w / 2, sy - size * 0.7, w, size * 1.4, size * 0.5, 'rgba(36,22,15,0.82)');
    if (color) { g.fillStyle = color; g.beginPath(); g.arc(sx - w / 2 + size * 0.45, sy, size * 0.18, 0, 7); g.fill(); }
    g.fillStyle = '#fbf6ea'; g.fillText(text, sx, sy + 1);
  }
  nameTag(p) {
    if (!p.name) return;
    const g = this.g, [sx, sy] = this.project(p.x, p.y, 58);
    const size = Math.max(11, Math.round(this.ui * 3.4));
    g.font = `600 ${size}px "Pixelify Sans", system-ui, sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle';
    const w = g.measureText(p.name).width + size * 1.2;
    roundRect(g, sx - w / 2, sy - size * 0.75, w, size * 1.5, size * 0.75, p.me ? 'rgba(70,44,28,0.88)' : 'rgba(36,22,15,0.8)');
    g.fillStyle = p.me ? '#ffd27a' : '#f4efe6'; g.fillText(p.name, sx, sy + 1);
  }
  drawFx(t) {
    const now = performance.now() / 1000, g = this.g, U = this.ui;
    this.fx = this.fx.filter((f) => now - f.t0 < 1.6);
    for (const f of this.fx) {
      const k = (now - f.t0) / 1.6;
      if (f.kind === 'coins') {
        const [sx, sy] = this.project(f.x, f.y, (f.z || 20) + 20 + k * 22);
        g.globalAlpha = 1 - k * k;
        if (!this.coinImg) { this.coinImg = new Image(); this.coinImg.src = icon('coin', 1); }
        if (this.coinImg.complete) g.drawImage(this.coinImg, sx - 9 * U / 2 - 2 * U, sy - 4 * U, 8 * U, 8 * U);
        g.font = `700 ${Math.round(5 * U)}px "Pixelify Sans", system-ui, sans-serif`; g.textAlign = 'left'; g.textBaseline = 'middle';
        g.fillStyle = '#24160f'; g.fillText(`+${f.amount}`, sx + U * 3, sy + U);
        g.fillStyle = '#ffd27a'; g.fillText(`+${f.amount}`, sx + U * 2, sy);
        g.globalAlpha = 1;
        if (f.stars) for (let i = 0; i < f.stars; i++) {
          const kk = Math.min(1, k * 1.4), [qx, qy] = this.project(f.x, f.y, (f.z || 20) + 34 + kk * 10);
          if (!this.starImg) this.starImg = starPix().toCanvas();
          this.blit(this.starImg, qx + (i - (f.stars - 1) / 2) * 9 * U - 3.5 * U, qy - 3.5 * U, 7 * U, 7 * U, 1 - kk * kk);
        }
      }
      if (f.kind === 'flash' && k < 0.25) {
        const [sx, sy] = this.project(f.x, f.y, f.z || 20), r = (4 + k * 30) * U;
        g.fillStyle = `rgba(255,255,240,${0.8 - k * 3})`;
        g.fillRect(sx - r, sy - U, r * 2, U * 2); g.fillRect(sx - U, sy - r, U * 2, r * 2);
      }
      if (f.kind === 'hearts') {
        for (let i = 0; i < 3; i++) {
          const kk = Math.min(1, Math.max(0, k * 1.3 - i * 0.15));
          if (kk <= 0) continue;
          const [sx, sy] = this.project(f.x, f.y, (f.z || 14) + 8 + kk * 18);
          this.blit(this.heart, sx + (i - 1) * 8 * U + Math.sin(kk * 6 + i) * 2 * U - 3.5 * U, sy - 3 * U, 7 * U, 6 * U, 1 - kk);
        }
      }
    }
  }

  // ---------- taps ----------
  personAt(list, sx, sy) {
    let best = null, bd = 20 * this.ui;
    for (const u of list) {
      const [cx, cy] = this.project(u.x, u.y, (u.z || 0) + 22);
      const d = Math.hypot(cx - sx, cy - sy);
      if (d < bd) { bd = d; best = u; }
    }
    return best;
  }
  catAt(cats, sx, sy) {
    let best = null, bd = 16 * this.ui;
    for (const c of cats) {
      const [cx, cy] = this.project(c.x, c.y, (c.z || 0) + 7);
      const d = Math.hypot(cx - sx, cy - sy);
      if (d < bd) { bd = d; best = c; }
    }
    return best;
  }
  tipAt(tips, sx, sy) {
    let best = null, bd = 14 * this.ui;
    for (const tp of tips || []) { const [cx, cy] = this.project(tp.x, tp.y, tp.z + 2); const d = Math.hypot(cx - sx, cy - sy); if (d < bd) { bd = d; best = tp; } }
    return best;
  }

  // ---------- shop pictures: the model rendered on its own ----------
  icon(type) {
    this.iconCache ??= new Map();
    if (this.iconCache.has(type)) return this.iconCache.get(type);
    const S = 96;
    if (!this.iconScene) {
      this.iconScene = new THREE.Scene();
      this.iconScene.add(new THREE.HemisphereLight('#fff1dc', '#6a4a36', 1.8));
      const d = new THREE.DirectionalLight('#ffe7c4', 2.2); d.position.set(3, 6, 4); this.iconScene.add(d);
      this.iconCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 50);
    }
    const obj = itemModel(type);
    this.iconScene.add(obj);
    const box = new THREE.Box3().setFromObject(obj), size = box.getSize(new THREE.Vector3()), mid = box.getCenter(new THREE.Vector3());
    const r = Math.max(size.x, size.y, size.z) * 0.62 + 0.05;
    const c = this.iconCam;
    c.left = -r; c.right = r; c.top = r; c.bottom = -r;
    c.position.copy(mid).addScaledVector(ISO, 20); c.lookAt(mid); c.updateProjectionMatrix();
    // draw into the bottom-left corner of the main canvas and copy it out straight away
    const N = S * 2, gl = this.gl;
    gl.setScissorTest(true); gl.setViewport(0, 0, N, N); gl.setScissor(0, 0, N, N);
    gl.setClearColor('#000000', 0); gl.clear();
    gl.render(this.iconScene, c);
    const out = document.createElement('canvas'); out.width = out.height = N;
    out.getContext('2d').drawImage(this.canvas, 0, this.canvas.height - N, N, N, 0, 0, N, N);
    gl.setScissorTest(false); gl.setViewport(0, 0, this.canvas.width, this.canvas.height); gl.setClearColor('#1a110c', 1);
    this.iconScene.remove(obj);
    this.iconCache.set(type, out);
    return out;
  }
}

function roundRect(g, x, y, w, h, r, fill) {
  g.fillStyle = fill; g.beginPath();
  g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r);
  g.closePath(); g.fill();
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
function zPix() {
  const rows = ['zzzzz', '...z.', '..z..', '.z...', 'zzzzz'];
  const p = new Pix(5, 5);
  rows.forEach((r, y) => [...r].forEach((ch, x) => { if (ch === 'z') p.set(x, y, '#e9f0ff'); }));
  return p;
}
