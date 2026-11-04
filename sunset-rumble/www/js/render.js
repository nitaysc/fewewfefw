// Draws the match: the town, two cartoon cars, stars, smoke, skid marks and the cameras.
import * as THREE from 'three';
import { RoundedBoxGeometry } from '../vendor/RoundedBoxGeometry.js';
import { makeSky, makeSea, makeGround, makeBuildings, makeProps, makeLandmarks, makeRamps, SUN_DIR, FOG } from './scenery.js';
import { groundAt } from './world.js';

export const CAR_STYLES = ['comet', 'brick', 'bubble'];
export const CAR_COLORS = ['#ef3b36', '#2f7cf6', '#ffb020', '#2fc46b', '#a35cf0', '#ff6fb1', '#f4f1ea', '#2b2b36'];

export class Renderer {
  constructor(canvas, world) {
    this.world = world;
    const r = this.r = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
    this.dpr = Math.min(window.devicePixelRatio || 1, 1.75);
    r.setPixelRatio(this.dpr);
    r.toneMapping = THREE.NeutralToneMapping;
    r.toneMappingExposure = 1.05;
    r.shadowMap.enabled = true;
    r.shadowMap.type = THREE.PCFSoftShadowMap;
    r.setScissorTest(true);

    const s = this.scene = new THREE.Scene();
    s.fog = new THREE.Fog(FOG, 170, 640);
    this.sky = makeSky();
    s.add(this.sky);

    // reflections for the glossy car paint: the sky itself
    const pm = new THREE.PMREMGenerator(r);
    const envScene = new THREE.Scene();
    envScene.add(makeSky());
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(2000, 2000).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: '#7d6a6a' }));
    ground.position.y = -5;
    envScene.add(ground);
    s.environment = pm.fromScene(envScene, 0.02).texture;
    s.environmentIntensity = 0.55;

    s.add(new THREE.HemisphereLight('#e4dcff', '#ffc9a0', 1.7));
    const sun = this.sun = new THREE.DirectionalLight('#ffd2a1', 2.6);
    // the light sits higher than the painted sun so streets aren't all in shadow
    this.lightDir = new THREE.Vector3(SUN_DIR.x, 1.25, SUN_DIR.z + 0.25).normalize();
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    const sc = sun.shadow.camera;
    sc.left = -70; sc.right = 70; sc.top = 70; sc.bottom = -70; sc.near = 1; sc.far = 400;
    sun.shadow.bias = -0.0006;
    sun.shadow.normalBias = 0.04;
    s.add(sun, sun.target);

    this.sea = makeSea();
    s.add(this.sea);
    const gr = makeGround(world, r.capabilities.getMaxAnisotropy());
    this.mapCanvas = gr.canvas;
    s.add(gr.group);
    s.add(makeBuildings(world));
    s.add(makeProps(world));
    const lm = makeLandmarks(world);
    s.add(lm.group);
    this.anims = lm.anim;
    const rp = makeRamps(world);
    s.add(rp.group);
    this.padTex = rp.padTex;

    this.cars = [];
    this.stars = new Map();
    this.starGeo = starGeometry();
    this.starMat = new THREE.MeshStandardMaterial({ color: '#ffc928', emissive: '#ff9d00', emissiveIntensity: 0.65, metalness: 0.4, roughness: 0.3 });
    this.bigMat = new THREE.MeshStandardMaterial({ color: '#ff7ad9', emissive: '#ff3fa8', emissiveIntensity: 0.7, metalness: 0.4, roughness: 0.25 });
    this.beamGeo = new THREE.CylinderGeometry(0.5, 1.1, 30, 12, 1, true).translate(0, 15, 0);
    this.beamMat = new THREE.MeshBasicMaterial({ color: '#ffd76a', transparent: true, opacity: 0.18, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false });
    this.bigBeamMat = this.beamMat.clone(); this.bigBeamMat.color.set('#ff7ad9'); this.bigBeamMat.opacity = 0.28;
    this.glowTex = glowTexture();

    this.fx = new Particles(s, 700);
    this.skids = new Skids(s, 1400);
    this.cams = [0, 1].map(() => ({ cam: new THREE.PerspectiveCamera(65, 1, 0.5, 2000), h: 0, shake: 0, pos: new THREE.Vector3(), look: new THREE.Vector3(), init: false, fovK: 0 }));
    this.menuCam = new THREE.PerspectiveCamera(55, 1, 0.5, 2000);
    this.time = 0;
    this.v = new THREE.Vector3();
  }

  resize(w, h) {
    this.w = w; this.h = h;
    this.r.setSize(w, h, false);
  }

  setCars(list) {
    for (const c of this.cars) this.scene.remove(c.root);
    this.cars = list.map((c) => makeCar(c.style, c.color, c.name));
    for (const c of this.cars) this.scene.add(c.root);
    this.cams.forEach((c) => (c.init = false));
  }

  // a star popped out of something: keep the meshes in step with the list
  syncStars(stars, t) {
    const seen = new Set();
    for (const s of stars) {
      seen.add(s.id);
      let m = this.stars.get(s.id);
      if (!m) {
        m = new THREE.Group();
        const mesh = new THREE.Mesh(this.starGeo, s.v > 1 ? this.bigMat : this.starMat);
        mesh.castShadow = true;
        const beam = new THREE.Mesh(this.beamGeo, s.v > 1 ? this.bigBeamMat : this.beamMat);
        const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.glowTex, color: s.v > 1 ? '#ff8ae0' : '#ffd25a', transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
        glow.scale.setScalar(s.v > 1 ? 7 : 4.5);
        m.add(mesh, beam, glow);
        m.userData = { mesh, glow, beam, s };
        if (s.v > 1) mesh.scale.setScalar(1.6);
        this.scene.add(m);
        this.stars.set(s.id, m);
      }
      m.userData.s = s;
      // dropped stars fly in an arc before they can be grabbed
      let x = s.x, z = s.z, y = 1.6;
      if (t < s.ready) {
        const k = Math.max(0, Math.min(1, (t - s.born) / Math.max(0.01, s.ready - s.born)));
        x = s.fx + (s.x - s.fx) * k; z = s.fz + (s.z - s.fz) * k;
        y = 1.6 + Math.sin(k * Math.PI) * 6;
        m.userData.beam.visible = false;
      } else m.userData.beam.visible = true;
      const g = groundAt(this.world, x, z);
      m.position.set(x, g + y + Math.sin(this.time * 3 + s.id) * 0.3, z);
      m.userData.mesh.rotation.y = this.time * 2.4 + s.id;
      const pop = Math.min(1, (t - s.born) * 3 + 0.2);
      m.scale.setScalar(pop < 1 ? pop * (1.3 - 0.3 * pop) : 1);
    }
    for (const [id, m] of this.stars) {
      if (!seen.has(id)) { this.scene.remove(m); m.userData.glow.material.dispose(); this.stars.delete(id); }
    }
  }

  // events from the match: smoke, sparks, sparkles
  event(e, cars) {
    if (e.k === 'pick') this.fx.burst(e.x, 1.6, e.z, 26, 'sparkle', e.v > 1 ? '#ff8ae0' : '#ffd23f');
    if (e.k === 'bump' || e.k === 'ram') {
      this.fx.burst(e.x, 1, e.z, e.k === 'ram' ? 40 : 10, 'spark', '#fff2a0');
      this.fx.burst(e.x, 0.8, e.z, e.k === 'ram' ? 12 : 4, 'smoke', '#ffffff');
      if (e.k === 'ram') for (const c of this.cams) c.shake = Math.max(c.shake, 0.9);
    }
    if (e.k === 'big') this.fx.burst(e.x, 2, e.z, 40, 'sparkle', '#ff8ae0');
    if (e.k === 'over' && cars) for (const c of cars) this.fx.burst(c.x, 3, c.z, 50, 'confetti');
  }

  update(dt, cars, stars, t) {
    this.time += dt;
    this.sky.material.uniforms.uTime.value = this.time;
    this.sea.material.uniforms.uTime.value = this.time;
    this.padTex.offset.y = (this.time * 1.6) % 1;
    for (const a of this.anims) a(this.time);
    cars.forEach((c, i) => this.cars[i] && this.poseCar(this.cars[i], c, dt));
    this.syncStars(stars, t);
    this.fx.update(dt);
  }

  poseCar(m, c, dt) {
    const s = m.spec;
    m.root.position.set(c.x, c.y, c.z);
    m.root.rotation.y = c.h;
    // body lean: roll into turns, squat on throttle, tumble a bit in the air
    const fwd = c.vx * Math.sin(c.h) + c.vz * Math.cos(c.h);
    const side = c.vx * -Math.cos(c.h) + c.vz * Math.sin(c.h);
    const acc = (fwd - (m.lastF ?? fwd)) / Math.max(dt, 1e-3);
    m.lastF = fwd;
    m.pitch += ((-acc * 0.004 + (c.grounded ? 0 : -c.vy * 0.012)) - m.pitch) * Math.min(1, 8 * dt);
    m.roll += ((side * 0.018 + (c.drifting ? -c.steer * 0.06 : c.steer * fwd * 0.0022)) - m.roll) * Math.min(1, 8 * dt);
    m.pitch = Math.max(-0.25, Math.min(0.25, m.pitch));
    m.roll = Math.max(-0.2, Math.min(0.2, m.roll));
    // squash on landing
    if (c.landed > 8) { m.squash = Math.min(0.35, c.landed * 0.02); }
    m.squash *= Math.exp(-8 * dt);
    m.body.rotation.set(m.pitch, 0, m.roll);
    m.body.scale.set(1 + m.squash * 0.5, 1 - m.squash, 1 + m.squash * 0.3);
    if (c.spinning || c.spin > 0) m.body.position.y = Math.abs(Math.sin(this.time * 18)) * 0.25; else m.body.position.y = 0;
    // wheels
    m.spinA += fwd * dt / s.wheelR;
    for (const w of m.wheels) w.tyre.rotation.x = m.spinA;
    for (const w of m.front) w.rotation.y = -c.steer * 0.45;
    // lights and boost flame
    m.flame.visible = !!c.boosting;
    if (c.boosting) m.flame.scale.set(1, 1, 0.8 + Math.random() * 0.6);
    m.brake.emissiveIntensity = fwd > 2 && m.lastThrottle < -0.1 ? 2.5 : 0.9;
    m.tag.position.y = s.tagY + Math.sin(this.time * 2) * 0.1;

    // tyre smoke and skid marks while drifting or landing
    const sp = Math.hypot(c.vx, c.vz);
    const ch = Math.cos(c.h), sh = Math.sin(c.h);
    if (c.grounded && (c.drifting || Math.abs(side) > 7)) {
      for (const sx of [-1, 1]) {
        const wx = c.x + ch * sx * s.track - sh * s.rear, wz = c.z - sh * sx * s.track - ch * s.rear;
        this.skids.add(m.skidKey + sx, wx, c.y + 0.03, wz, c.h);
        if (Math.random() < 0.55) this.fx.spawn(wx, c.y + 0.3, wz, 'smoke', c.surface === 'sand' ? '#f1d39c' : c.surface === 'grass' ? '#c9e6a6' : '#f4f0f4', -c.vx * 0.05, 1, -c.vz * 0.05);
      }
    } else {
      this.skids.lift(m.skidKey - 1); this.skids.lift(m.skidKey + 1);
      if (c.grounded && sp > 14 && (c.surface === 'sand' || c.surface === 'grass') && Math.random() < 0.4) {
        this.fx.spawn(c.x - sh * s.rear, 0.3, c.z - ch * s.rear, 'smoke', c.surface === 'sand' ? '#f1d39c' : '#a9d488', 0, 0.8, 0);
      }
    }
    if (c.boosting && Math.random() < 0.8) {
      this.fx.spawn(c.x - sh * (s.rear + 1), c.y + 0.55, c.z - ch * (s.rear + 1), 'flame', '#ffb347', -c.vx * 0.2, 0.3, -c.vz * 0.2);
    }
  }

  // follow camera for one player
  follow(view, car, dt, aspect) {
    const C = this.cams[view];
    const cam = C.cam;
    const sp = Math.hypot(car.vx, car.vz);
    // look the way the car travels, so drifts stay framed
    const velH = Math.atan2(car.vx, car.vz);
    const target = sp > 6 && !car.drifting ? lerpAngle(car.h, velH, 0.35) : car.h;
    if (!C.init) { C.h = target; }
    C.h = lerpAngle(C.h, target, Math.min(1, (car.spin > 0 || car.spinning ? 0.6 : 3.2) * dt));
    const portrait = aspect < 1;
    const dist = (portrait ? 12.5 : 11) + sp * 0.06;
    const height = (portrait ? 8.2 : 6) + sp * 0.03;
    const want = this.v.set(car.x - Math.sin(C.h) * dist, Math.max(car.y * 0.6, 0) + height, car.z - Math.cos(C.h) * dist);
    if (!C.init) { C.pos.copy(want); C.init = true; }
    C.pos.lerp(want, Math.min(1, 7 * dt));
    C.look.set(car.x + Math.sin(car.h) * 4, car.y * 0.7 + 1.2, car.z + Math.cos(car.h) * 4);
    cam.position.copy(C.pos);
    if (C.shake > 0) {
      C.shake = Math.max(0, C.shake - dt * 2.2);
      cam.position.x += (Math.random() - 0.5) * C.shake;
      cam.position.y += (Math.random() - 0.5) * C.shake;
    }
    const base = portrait ? 66 : 58;
    C.fovK += ((car.boosting ? 10 : 0) + sp * 0.12 - C.fovK) * Math.min(1, 4 * dt);
    cam.fov = base + C.fovK;
    cam.aspect = aspect;
    cam.updateProjectionMatrix();
    cam.lookAt(C.look);
    return cam;
  }

  shakeView(view, v) { this.cams[view].shake = Math.max(this.cams[view].shake, v); }

  // views: [{ x, y, w, h (pixels), car, flip }]; or null for the menu orbit
  render(dt, views, cars) {
    const r = this.r;
    let center = new THREE.Vector3(0, 0, 0), span = 60;
    if (views && views.length) {
      center.set(0, 0, 0);
      for (const v of views) center.add(this.v.set(cars[v.car].x, 0, cars[v.car].z));
      center.multiplyScalar(1 / views.length);
      if (views.length > 1) span = Math.min(110, 55 + Math.hypot(cars[0].x - cars[1].x, cars[0].z - cars[1].z) / 2);
      else { const c = cars[views[0].car]; center.x += Math.sin(c.h) * 18; center.z += Math.cos(c.h) * 18; }
    }
    this.placeSun(center, span);
    for (const v of views) {
      const cam = this.follow(v.i ?? 0, cars[v.car], dt, v.w / v.h);
      if (v.flip) cam.rotateZ(Math.PI);
      this.sky.position.copy(cam.position);
      const y = this.h - v.y - v.h; // gl counts from the bottom
      r.setViewport(v.x, y, v.w, v.h); r.setScissor(v.x, y, v.w, v.h);
      this.fx.setScale(v.h * this.dpr / (2 * Math.tan((cam.fov * Math.PI) / 360)));
      r.render(this.scene, cam);
    }
  }

  // the title screen: circle slowly round the player's car on a street corner
  renderMenu(dt, car) {
    const r = this.r;
    const a = this.time * 0.18;
    const cam = this.menuCam;
    cam.aspect = this.w / this.h;
    const portrait = cam.aspect < 1;
    cam.fov = portrait ? 60 : 42;
    const d = portrait ? 13 : 11;
    cam.position.set(car.x + Math.cos(a) * d, 2.6, car.z + Math.sin(a) * d);
    // in portrait the car sits in the lower half, under the logo
    cam.lookAt(car.x, portrait ? -1.2 : 1.2, car.z);
    cam.updateProjectionMatrix();
    this.placeSun(new THREE.Vector3(car.x, 0, car.z), 40);
    r.setViewport(0, 0, this.w, this.h); r.setScissor(0, 0, this.w, this.h);
    this.sky.position.copy(cam.position);
    this.fx.setScale(this.h * this.dpr / (2 * Math.tan((cam.fov * Math.PI) / 360)));
    r.render(this.scene, cam);
  }

  placeSun(center, span) {
    const sc = this.sun.shadow.camera;
    if (sc.right !== span) { sc.left = -span; sc.right = span; sc.top = span; sc.bottom = -span; sc.updateProjectionMatrix(); }
    // snap to shadow texels to stop shimmering
    const texel = (span * 2) / 2048;
    const cx = Math.round(center.x / texel) * texel, cz = Math.round(center.z / texel) * texel;
    this.sun.target.position.set(cx, 0, cz);
    this.sun.position.set(cx + this.lightDir.x * 200, this.lightDir.y * 200, cz + this.lightDir.z * 200);
  }

  setThrottle(i, t) { if (this.cars[i]) this.cars[i].lastThrottle = t; }
}

const lerpAngle = (a, b, t) => {
  let d = b - a;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return a + d * t;
};

// ---------- cars ----------
function paint(color) {
  return new THREE.MeshPhysicalMaterial({ color, roughness: 0.32, metalness: 0.15, clearcoat: 1, clearcoatRoughness: 0.12 });
}

function nameTag(name, color) {
  const cv = document.createElement('canvas'); cv.width = 256; cv.height = 72;
  const g = cv.getContext('2d');
  g.font = '700 40px Fredoka, sans-serif';
  const w = Math.min(240, g.measureText(name).width + 40);
  g.fillStyle = 'rgba(30,20,50,0.72)';
  roundRect(g, (256 - w) / 2, 8, w, 54, 27); g.fill();
  g.fillStyle = color; g.beginPath(); g.arc((256 - w) / 2 + 22, 35, 8, 0, 7); g.fill();
  g.fillStyle = '#fff'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText(name, 128 + 8, 37);
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace;
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, depthTest: false, transparent: true }));
  sp.scale.set(4, 1.125, 1);
  sp.renderOrder = 5;
  return sp;
}

function roundRect(g, x, y, w, h, r) {
  g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath();
}

const SPECS = {
  comet: { wheelR: 0.44, track: 0.92, front: 1.35, rear: 1.35, tagY: 3 },
  brick: { wheelR: 0.58, track: 1.0, front: 1.35, rear: 1.3, tagY: 3.6 },
  bubble: { wheelR: 0.46, track: 0.86, front: 1.1, rear: 1.05, tagY: 3.3 },
};

export function makeCar(style, color, name = '') {
  const spec = SPECS[style] || SPECS.comet;
  const root = new THREE.Group();
  const body = new THREE.Group();
  root.add(body);
  const P = paint(color);
  const dark = new THREE.MeshStandardMaterial({ color: '#23222c', roughness: 0.6 });
  const glass = new THREE.MeshPhysicalMaterial({ color: '#1c2440', roughness: 0.05, metalness: 0.2, clearcoat: 1 });
  const chrome = new THREE.MeshStandardMaterial({ color: '#d9dce6', metalness: 1, roughness: 0.2 });
  const head = new THREE.MeshStandardMaterial({ color: '#fffbe8', emissive: '#fff1c0', emissiveIntensity: 1.4 });
  const brake = new THREE.MeshStandardMaterial({ color: '#ff2a2a', emissive: '#ff1010', emissiveIntensity: 0.9 });
  const add = (geo, mat, x, y, z, parent = body) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = true; parent.add(m); return m; };
  const RB = (w, h, d, r = 0.2, seg = 3) => new RoundedBoxGeometry(w, h, d, seg, r);

  if (style === 'brick') {
    add(RB(2.25, 0.95, 4.1, 0.22), P, 0, 0.95, 0);
    add(RB(2.05, 0.85, 2.4, 0.2), glass, 0, 1.8, -0.35);
    add(RB(2.1, 0.12, 2.3, 0.05), P, 0, 2.26, -0.35);
    // roof rack and spare wheel
    for (const z of [-1.2, -0.35, 0.5]) add(new THREE.BoxGeometry(2.0, 0.08, 0.1), dark, 0, 2.42, z);
    add(new THREE.CylinderGeometry(0.5, 0.5, 0.3, 14).rotateX(Math.PI / 2), dark, 0, 1.2, -2.2);
    add(RB(2.3, 0.35, 0.3, 0.1), dark, 0, 0.6, 2.1);   // bull bar
    add(RB(2.3, 0.35, 0.3, 0.1), dark, 0, 0.6, -2.1);
    add(new THREE.BoxGeometry(0.42, 0.24, 0.08), head, -0.72, 1.12, 2.06);
    add(new THREE.BoxGeometry(0.42, 0.24, 0.08), head, 0.72, 1.12, 2.06);
    add(new THREE.BoxGeometry(0.35, 0.3, 0.08), brake, -0.85, 1.12, -2.06);
    add(new THREE.BoxGeometry(0.35, 0.3, 0.08), brake, 0.85, 1.12, -2.06);
  } else if (style === 'bubble') {
    add(RB(2.0, 0.85, 3.5, 0.4, 4), P, 0, 0.85, 0);
    add(RB(1.8, 0.85, 2.0, 0.42, 4), glass, 0, 1.55, -0.2);
    add(RB(1.6, 0.2, 1.6, 0.1), P, 0, 2.0, -0.2);
    const ant = add(new THREE.CylinderGeometry(0.03, 0.03, 1.1, 5), dark, 0.6, 2.6, -0.9);
    add(new THREE.SphereGeometry(0.16, 10, 8), new THREE.MeshStandardMaterial({ color: '#ffd23f', emissive: '#ff9d00', emissiveIntensity: 0.6 }), 0.6, 3.15, -0.9);
    void ant;
    add(new THREE.SphereGeometry(0.24, 12, 8).scale(1, 1, 0.4), head, -0.6, 1.0, 1.72);
    add(new THREE.SphereGeometry(0.24, 12, 8).scale(1, 1, 0.4), head, 0.6, 1.0, 1.72);
    add(new THREE.BoxGeometry(0.3, 0.22, 0.08), brake, -0.68, 1.0, -1.75);
    add(new THREE.BoxGeometry(0.3, 0.22, 0.08), brake, 0.68, 1.0, -1.75);
    add(RB(2.05, 0.25, 0.3, 0.1), chrome, 0, 0.55, 1.7);
  } else {
    // comet: a low coupe with a wing
    add(RB(2.15, 0.62, 4.4, 0.26), P, 0, 0.7, 0);
    add(RB(1.95, 0.3, 1.6, 0.15), P, 0, 1.05, 1.15);   // hood
    add(RB(1.72, 0.58, 2.0, 0.3, 4), glass, 0, 1.2, -0.35);
    add(RB(1.6, 0.1, 1.4, 0.05), P, 0, 1.5, -0.4);
    add(new THREE.BoxGeometry(2.1, 0.08, 0.5), P, 0, 1.42, -2.0);  // wing
    add(new THREE.BoxGeometry(0.08, 0.4, 0.3), dark, -0.7, 1.2, -2.0);
    add(new THREE.BoxGeometry(0.08, 0.4, 0.3), dark, 0.7, 1.2, -2.0);
    add(new THREE.BoxGeometry(0.55, 0.14, 0.08), head, -0.68, 0.82, 2.2);
    add(new THREE.BoxGeometry(0.55, 0.14, 0.08), head, 0.68, 0.82, 2.2);
    add(new THREE.BoxGeometry(0.5, 0.16, 0.08), brake, -0.7, 0.88, -2.2);
    add(new THREE.BoxGeometry(0.5, 0.16, 0.08), brake, 0.7, 0.88, -2.2);
    add(new THREE.BoxGeometry(1.0, 0.08, 0.5), dark, 0, 1.06, 1.6); // hood vent
  }
  // number plate and exhausts
  const plate = add(new THREE.BoxGeometry(0.7, 0.22, 0.03), new THREE.MeshStandardMaterial({ color: '#f5f5f0' }), 0, style === 'brick' ? 0.95 : 0.66, style === 'bubble' ? -1.77 : -2.22);
  void plate;
  const exhZ = style === 'bubble' ? -1.7 : style === 'brick' ? -2.0 : -2.2;
  add(new THREE.CylinderGeometry(0.09, 0.09, 0.3, 8).rotateX(Math.PI / 2), chrome, -0.45, 0.45, exhZ);
  add(new THREE.CylinderGeometry(0.09, 0.09, 0.3, 8).rotateX(Math.PI / 2), chrome, 0.45, 0.45, exhZ);

  // wheels: tyre spins inside a pivot that steers
  const tyreG = new THREE.CylinderGeometry(spec.wheelR, spec.wheelR, 0.42, 18).rotateZ(Math.PI / 2);
  const rimG = new THREE.CylinderGeometry(spec.wheelR * 0.6, spec.wheelR * 0.6, 0.44, 10).rotateZ(Math.PI / 2);
  const wheels = [], front = [];
  for (const [sx, sz] of [[-1, 1], [1, 1], [-1, -1], [1, -1]]) {
    const pivot = new THREE.Group();
    pivot.position.set(sx * spec.track, spec.wheelR, sz > 0 ? spec.front : -spec.rear);
    const tyre = new THREE.Group();
    const t = new THREE.Mesh(tyreG, dark); t.castShadow = true;
    const rim = new THREE.Mesh(rimG, chrome);
    tyre.add(t, rim);
    // a bar on the rim so you can see it turning
    const bar = new THREE.Mesh(new THREE.BoxGeometry(0.46, spec.wheelR * 1.1, 0.12), dark);
    tyre.add(bar);
    pivot.add(tyre);
    root.add(pivot);
    wheels.push({ pivot, tyre });
    if (sz > 0) front.push(pivot);
  }

  // boost flame out the back
  const flame = new THREE.Mesh(new THREE.ConeGeometry(0.28, 1.4, 10).rotateX(-Math.PI / 2).translate(0, 0, -0.7),
    new THREE.MeshBasicMaterial({ color: '#7fe8ff', transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false }));
  flame.position.set(0, 0.45, exhZ - 0.1);
  const flame2 = flame.clone(); flame.position.x = -0.45; flame2.position.x = 0.45;
  const flames = new THREE.Group(); flames.add(flame, flame2);
  body.add(flames);
  flames.visible = false;

  // soft blob shadow so the car sits on the road even in building shade
  const blob = new THREE.Mesh(new THREE.PlaneGeometry(2.8, 5).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ map: glowTexture('#000'), transparent: true, opacity: 0.45, depthWrite: false }));
  blob.position.y = 0.05;
  root.add(blob);

  const tag = nameTag(name || '', color);
  tag.position.set(0, spec.tagY, 0);
  root.add(tag);
  tag.visible = !!name;

  return { root, body, wheels, front, flame: flames, brake, tag, spec, pitch: 0, roll: 0, squash: 0, spinA: 0, lastThrottle: 0, skidKey: Math.floor(Math.random() * 1e6) * 4 };
}

function starGeometry() {
  const sh = new THREE.Shape();
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2 + Math.PI / 2;
    const r = i % 2 ? 0.48 : 1.1;
    const x = Math.cos(a) * r, y = Math.sin(a) * r;
    i ? sh.lineTo(x, y) : sh.moveTo(x, y);
  }
  const g = new THREE.ExtrudeGeometry(sh, { depth: 0.3, bevelEnabled: true, bevelThickness: 0.14, bevelSize: 0.12, bevelSegments: 2 });
  g.center();
  return g;
}

function glowTexture(c = '#fff') {
  const cv = document.createElement('canvas'); cv.width = cv.height = 64;
  const g = cv.getContext('2d');
  const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  gr.addColorStop(0, c === '#000' ? 'rgba(0,0,0,1)' : 'rgba(255,255,255,1)');
  gr.addColorStop(0.4, c === '#000' ? 'rgba(0,0,0,0.6)' : 'rgba(255,255,255,0.35)');
  gr.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
  const t = new THREE.CanvasTexture(cv);
  return t;
}

// ---------- particles: one draw call of soft round points ----------
class Particles {
  constructor(scene, n) {
    this.n = n;
    this.list = [];
    this.pos = new Float32Array(n * 3);
    this.col = new Float32Array(n * 4);
    this.size = new Float32Array(n);
    const g = this.geo = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('aCol', new THREE.BufferAttribute(this.col, 4).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('aSize', new THREE.BufferAttribute(this.size, 1).setUsage(THREE.DynamicDrawUsage));
    this.mat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false,
      uniforms: { uScale: { value: 400 } },
      vertexShader: `attribute vec4 aCol; attribute float aSize; uniform float uScale; varying vec4 vC;
        void main(){ vC = aCol; vec4 mv = modelViewMatrix * vec4(position,1.); gl_PointSize = aSize * uScale / -mv.z; gl_Position = projectionMatrix * mv; }`,
      fragmentShader: `varying vec4 vC; void main(){ vec2 p = gl_PointCoord - .5; float d = length(p); if (d > .5) discard; float a = smoothstep(.5, .2, d); gl_FragColor = vec4(vC.rgb, vC.a * a);
        #include <colorspace_fragment>
      }`,
    });
    this.points = new THREE.Points(g, this.mat);
    this.points.frustumCulled = false;
    scene.add(this.points);
    this.c = new THREE.Color();
  }
  setScale(s) { this.mat.uniforms.uScale.value = s; }
  spawn(x, y, z, kind, color = '#fff', vx = 0, vy = 0, vz = 0) {
    if (this.list.length >= this.n) this.list.shift();
    const p = { x, y, z, vx, vy, vz, kind, age: 0, c: new THREE.Color(color) };
    if (kind === 'smoke') { p.life = 0.9 + Math.random() * 0.5; p.s0 = 0.8; p.s1 = 3.2; p.a = 0.55; p.vx += (Math.random() - 0.5) * 1.5; p.vy += 0.8 + Math.random(); p.vz += (Math.random() - 0.5) * 1.5; }
    if (kind === 'spark') { p.life = 0.4 + Math.random() * 0.3; p.s0 = 0.35; p.s1 = 0.1; p.a = 1; p.g = 18; const a = Math.random() * 6.28, s = 6 + Math.random() * 10; p.vx += Math.cos(a) * s; p.vz += Math.sin(a) * s; p.vy += 3 + Math.random() * 6; }
    if (kind === 'sparkle') { p.life = 0.6 + Math.random() * 0.4; p.s0 = 0.6; p.s1 = 0.05; p.a = 1; p.g = -1; const a = Math.random() * 6.28, s = 2 + Math.random() * 6; p.vx += Math.cos(a) * s; p.vz += Math.sin(a) * s; p.vy += 2 + Math.random() * 5; }
    if (kind === 'flame') { p.life = 0.25 + Math.random() * 0.15; p.s0 = 0.9; p.s1 = 0.2; p.a = 0.9; }
    if (kind === 'confetti') { p.life = 2 + Math.random(); p.s0 = 0.5; p.s1 = 0.4; p.a = 1; p.g = 6; p.c.setHSL(Math.random(), 0.85, 0.6); const a = Math.random() * 6.28, s = 3 + Math.random() * 8; p.vx += Math.cos(a) * s; p.vz += Math.sin(a) * s; p.vy += 8 + Math.random() * 8; }
    this.list.push(p);
  }
  burst(x, y, z, n, kind, color) { for (let i = 0; i < n; i++) this.spawn(x, y, z, kind, color); }
  update(dt) {
    let j = 0;
    for (let i = 0; i < this.list.length; i++) {
      const p = this.list[i];
      p.age += dt;
      if (p.age >= p.life) continue;
      p.vy -= (p.g || 0) * dt;
      p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
      if (p.y < 0.1 && p.g > 0) { p.y = 0.1; p.vy *= -0.3; p.vx *= 0.6; p.vz *= 0.6; }
      if (p.kind === 'smoke') { p.vx *= 0.96; p.vz *= 0.96; p.vy *= 0.97; }
      const k = p.age / p.life;
      this.list[j++] = p;
      const o = (j - 1);
      this.pos[o * 3] = p.x; this.pos[o * 3 + 1] = p.y; this.pos[o * 3 + 2] = p.z;
      let c = p.c;
      if (p.kind === 'flame') c = this.c.copy(p.c).lerp(new THREE.Color('#6fd8ff'), k);
      this.col[o * 4] = c.r; this.col[o * 4 + 1] = c.g; this.col[o * 4 + 2] = c.b;
      this.col[o * 4 + 3] = p.a * (1 - k) * (p.kind === 'smoke' ? Math.min(1, k * 6) : 1);
      this.size[o] = p.s0 + (p.s1 - p.s0) * k;
    }
    this.list.length = j;
    this.geo.setDrawRange(0, j);
    this.geo.attributes.position.needsUpdate = true;
    this.geo.attributes.aCol.needsUpdate = true;
    this.geo.attributes.aSize.needsUpdate = true;
  }
}

// ---------- skid marks: a ring of dark quads on the road ----------
class Skids {
  constructor(scene, n) {
    this.n = n; this.i = 0;
    this.pos = new Float32Array(n * 4 * 3);
    const idx = [];
    for (let k = 0; k < n; k++) { const b = k * 4; idx.push(b, b + 1, b + 2, b, b + 2, b + 3); }
    const g = this.geo = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
    g.setIndex(idx);
    this.mesh = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ color: '#1d1820', transparent: true, opacity: 0.38, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -3, side: THREE.DoubleSide }));
    this.mesh.frustumCulled = false;
    scene.add(this.mesh);
    this.last = new Map();
  }
  add(key, x, y, z, h) {
    const l = this.last.get(key);
    const w = 0.2, cx = Math.cos(h) * w, sz = -Math.sin(h) * w;
    if (l && Math.hypot(x - l.x, z - l.z) < 0.35) return;
    if (l && Math.hypot(x - l.x, z - l.z) < 4) {
      const o = this.i * 12;
      const p = this.pos;
      p.set([l.x - l.cx, l.y, l.z - l.sz, l.x + l.cx, l.y, l.z + l.sz, x + cx, y, z + sz, x - cx, y, z - sz], o);
      this.i = (this.i + 1) % this.n;
      this.geo.attributes.position.needsUpdate = true;
    }
    this.last.set(key, { x, y, z, cx, sz });
  }
  lift(key) { this.last.delete(key); }
}
