// The game: builds the world, runs the frame loop and ties the systems together.
import './core/hdrsafe.js';   // first: guards every shader compiled after it
import * as THREE from '../vendor/three.module.js';
import { PRESETS, guessQuality, forDevice } from './core/quality.js';
import { shared } from './core/shared.js';
import { noiseTexture, setMaxAnisotropy, waitForTextures } from './core/textures.js';
import { Post } from './core/post.js';
import { clamp, damp, nextFrame } from './core/util.js';
import { Plan, START } from './world/layout.js';
import { createSky } from './world/sky.js';
import { createGround, createFarTerrain, makeHeightTexture, makeMaskTexture } from './world/terrain.js';
import { CutMap } from './world/cutmap.js';
import { Grass } from './world/grass.js';
import { Vehicle, DIM } from './player/vehicle.js';
import { MowerModel } from './player/mower.js';
import { Cockpit } from './player/cockpit.js';
import { DriverHead } from './player/head.js';
import { Net } from './net/multiplayer.js';
import { Smoke, Clippings } from './fx/particles.js';
import { heightAt } from './world/layout.js';
import { buildHouse } from './world/house.js';
import { Trees } from './world/trees.js';
import { buildGarden } from './world/garden.js';
import { bakeStaticShadow } from './world/staticshadow.js';
import { Rooks } from './world/wildlife.js';

const _tgt = new THREE.Vector3(), _pos = new THREE.Vector3();

// Fog: a softer curve than exp2 so the lawn stays crisp and the far hills go blue.
THREE.ShaderChunk.fog_fragment = /* glsl */`
#ifdef USE_FOG
  #ifdef FOG_EXP2
    float fogFactor = 1.0 - exp( - pow( fogDensity * vFogDepth, 1.35 ) );
  #else
    float fogFactor = smoothstep( fogNear, fogFar, vFogDepth );
  #endif
  gl_FragColor.rgb = mix( gl_FragColor.rgb, fogColor, fogFactor );
#endif`;

const _v2 = new THREE.Vector2();

export class Game {
  constructor(canvas, settings) {
    this.canvas = canvas;
    this.settings = settings;
    this.state = 'loading';
    this.time = 0;
    this.extras = [];   // systems with update(dt, game)
    this.net = new Net(this);   // playing together (idle until a lawn is hosted or joined)
  }

  async load(step) {
    // ---- renderer ----
    const renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: false, powerPreference: 'high-performance', stencil: false });
    this.renderer = renderer;
    if (!renderer.capabilities.isWebGL2) throw new Error('WebGL 2 is required');
    const guess = guessQuality(renderer.getContext());
    this.gpu = guess.gpu;
    this.guessedQuality = guess.preset;
    const qName = this.settings.quality || guess.preset;
    this.qualityName = qName;
    const Q = forDevice(PRESETS[qName]);
    this.Q = Q;
    // ACES filmic reads best here (AgX available for comparison with ?tm=agx)
    const tm = new URLSearchParams(location.search).get('tm');
    renderer.toneMapping = tm === 'agx' ? THREE.AgXToneMapping : THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = tm === 'agx' ? 1.25 : 1.0;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    setMaxAnisotropy(Math.min(8, renderer.capabilities.getMaxAnisotropy()));

    const scene = new THREE.Scene();
    this.scene = scene;
    const camera = new THREE.PerspectiveCamera(62, 1, 0.05, 6000);
    this.camera = camera;
    this.resize();
    addEventListener('resize', () => this.resize());

    await step(0.05, 'Surveying the estate…');
    this.plan = new Plan();
    await step(0.15, 'Raising the sky…');
    this.sky = await createSky(renderer, scene, Q);
    scene.fog = new THREE.FogExp2(shared.uHaze.value.clone(), 1 / 1900);

    await step(0.25, 'Rolling out the ground…');
    this.noiseTex = noiseTexture(256, 11);
    this.maskTex = makeMaskTexture(this.plan);
    this.heightTex = makeHeightTexture(512);
    this.cutmap = new CutMap(renderer, this.plan, Q.cutRes);
    this.ground = createGround({ maskTex: this.maskTex, cutTex: this.cutmap.texture, noiseTex: this.noiseTex, quality: Q });
    scene.add(this.ground);
    this.far = createFarTerrain(this.noiseTex);
    scene.add(this.far);

    await step(0.35, 'Letting the grass grow…');
    this.grass = new Grass({ scene, cutTex: this.cutmap.texture, maskTex: this.maskTex, heightTex: this.heightTex, noiseTex: this.noiseTex, quality: Q });

    await step(0.4, 'Raising the house…');
    this.house = buildHouse({ quality: Q });
    scene.add(this.house);

    await step(0.43, 'Planting the oaks and the cedar…');
    this.trees = new Trees({ scene, quality: Q, renderer });
    this.rooks = new Rooks(scene, Q.particles >= 1 ? 9 : 5);
    await step(0.44, 'Clipping the yew hedges…');
    this.garden = await buildGarden({ scene, quality: Q, house: this.house });
    {
      // the sun is fixed: bake the estate's shadows once
      const casters = new Set();
      for (const root of [this.house, this.trees.group, this.garden.group]) root.traverse((o) => { if (o.isMesh && o.castShadow !== false && !o.material.transparent) casters.add(o); });
      this.staticShadow = bakeStaticShadow(renderer, scene, casters, { extent: 300, res: Q.shadowMap >= 2048 ? 2048 : 1024 });
      if (Q.bakedSceneryShadows) {
        // phones: the baked map already shades the lawn under these; only the house's walls,
        // columns and steps and the moving things go on casting live shadows
        this.trees.group.traverse((o) => { if (o.isMesh) o.castShadow = false; });
        for (const name of ['balusters', 'border', 'ivy']) {
          this.scene.traverse((o) => { if (o.isMesh && o.name === name) o.castShadow = false; });
        }
      }
    }

    await step(0.45, 'Fuelling the mower…');
    this.vehicle = new Vehicle(this.plan);
    this.mowerRoot = new THREE.Group();
    scene.add(this.mowerRoot);
    this.head = new THREE.Object3D();
    this.head.position.copy(DIM.eye);
    this.mowerRoot.add(this.head);
    // the driver's head turns here; the first-person camera rides in it, and the bottle and
    // cigar poses at the lips follow it whichever view is in use
    this.headLook = new THREE.Object3D();
    this.head.add(this.headLook);
    this.headLook.add(camera);
    this.look = { yaw: 0, pitch: -0.2, yawV: 0, pitchV: 0 };
    this.viewMode = 'first';
    this.third = { yaw: 0, pitch: 0.3, dist: 4.4, base: null, idle: 0 };
    this.mower = new MowerModel();
    this.mowerRoot.add(this.mower.group);

    await step(0.55, 'Washing the gentleman\'s hands…');
    this.cockpit = new Cockpit(this, { tone: this.settings.skinTone });
    this.driverHead = new DriverHead({ quality: Q, tone: this.settings.skinTone });
    this.headLook.add(this.driverHead.group);
    this.driverHead.group.visible = false;
    this.smoke = new Smoke(scene, Q.particles >= 1 ? 500 : 260);
    this.clippings = new Clippings(scene, Math.round(1600 * Q.particles));
    this.emit = { wisp: 0, exhaust: 0 };

    for (const fn of (this.loaders || [])) await fn(this, step);

    await step(0.9, 'Polishing the brass…');
    await waitForTextures();
    this.post = new Post(renderer, scene, camera, Q);
    this.bladesOn = false;
    this.cutLoad = 0;
    await step(1, 'Ready.');
    this.ready = true;
    this.frames = 0;
  }

  resize() {
    const w = innerWidth, h = innerHeight;
    const Q = this.Q;
    const dpr = Math.min(devicePixelRatio || 1, Q.maxDpr) * Q.renderScale;
    this.renderer.setPixelRatio(dpr);
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.fov = w / h < 1 ? 80 : 66;
    this.camera.updateProjectionMatrix();
    if (this.post) this.post.setSize(this.dynScale || 1);
    // resizing clears the canvas: draw straight away so a blank frame is never shown
    if (this.post && this.ready) this.render();
  }
  // Dynamic resolution: only the internal buffers change size; the canvas (and what is on
  // screen) is left alone, so a change never flashes a blank frame.
  setDynScale(s) {
    this.dynScale = s;
    if (this.post) this.post.setSize(s);
  }

  // ---------------------------------------------------------------- frame
  update(dt, ctl) {
    this.time += dt;
    shared.uTime.value = this.time;
    const v = this.vehicle;
    const playing = this.state === 'playing';

    // ---- controls ----
    const c = playing ? ctl : { throttle: 0, steer: 0, boost: false };
    if (playing && ctl.pressed.has('blades')) this.bladesOn = !this.bladesOn;
    v.update(dt, c, this.cutLoad, this.bladesOn);
    v.applyTo(this.mowerRoot);
    this.mowerRoot.updateMatrixWorld();

    // ---- mowing ----
    let fresh = 0;
    if (v.prevDeck && this.bladesOn) {
      const dx = v.deck.x - v.prevDeck.x, dz = v.deck.y - v.prevDeck.y;
      const dist = Math.hypot(dx, dz);
      if (dist > 0.002) {
        const dir = dist > 0.01 ? new THREE.Vector2(dx / dist, dz / dist) : new THREE.Vector2(v.fx, v.fz);
        fresh = this.cutmap.stroke(v.prevDeck, v.deck, DIM.deckR, dir);
        this.net.stroke(v.prevDeck, v.deck, dir);
      }
    }
    // engine load: fraction of fresh (tall) grass going under the deck
    const area = Math.max(Math.abs(v.v) * dt * DIM.deckR * 2, 1e-4);
    this.cutLoad = damp(this.cutLoad, clamp((fresh * 0.25) / area), 3, dt);
    v.prevDeck = v.deck.clone();
    this.cutmap.flush();
    this.grass.setMower(v.x, v.z, v.fx, v.fz);

    // ---- head look (first person) or orbit (third person) ----
    if (playing && ctl.pressed.has('view')) this.setView(this.viewMode === 'first' ? 'third' : 'first');
    const L = this.look, T = this.third, third = this.viewMode === 'third';
    if (playing) {
      if (third) {
        T.yaw = Math.atan2(Math.sin(T.yaw - ctl.lookX), Math.cos(T.yaw - ctl.lookX));
        T.pitch = clamp(T.pitch + ctl.lookY, -0.08, 1.1);
      } else {
        L.yaw = clamp(L.yaw - ctl.lookX, -2.1, 2.1);
        L.pitch = clamp(L.pitch - ctl.lookY, -1.15, 0.85);
      }
    }
    const ck = this.cockpit;
    // engine shake and bumps through the seat
    const shake = 0.0016 * (v.rpm / 3000) + Math.min(0.006, Math.abs(v.vy) * 0.01);
    this.head.position.set(DIM.eye.x + Math.sin(this.time * 61) * shake * 0.4, DIM.eye.y + Math.sin(this.time * 47.3) * shake, DIM.eye.z);
    this.head.rotation.set(0, 0, 0);
    const sway = ck.tipsy > 0.4 ? (ck.tipsy - 0.4) * 0.025 : 0;
    // seen from behind, the driver looks ahead and a little down at the lawn
    const hp = third ? -0.12 : L.pitch, hy = third ? 0 : L.yaw;
    this.headLook.rotation.set(hp + ck.headTilt + Math.sin(this.time * 0.6) * sway, hy + Math.sin(this.time * 0.43) * sway * 1.3, Math.sin(this.time * 0.5) * sway * 0.8, 'YXZ');

    this.mower.update(dt, v, { bladesOn: this.bladesOn, boost: c.boost, time: this.time, fuel: 0.8 });
    this.mowerRoot.updateMatrixWorld(true);
    ck.bottle.bubScale.value = (this.post ? this.post.height : this.renderer.getDrawingBufferSize(_v2).y) / (2 * Math.tan(THREE.MathUtils.degToRad(this.camera.fov) / 2));
    ck.update(dt, c.drink !== undefined ? c : ctl, playing);
    if (playing && ctl.pressed.has('ash')) ck.dropAsh();
    if (playing && ctl.pressed.has('action')) { if (!ck.lightNewCigar()) if (ck.fill <= 0.02) ck.freshBottle(); }
    this.updateEffects(dt, fresh);
    this.rooks.update(this.time);
    for (const e of this.extras) e.update(dt, this, ctl);
    if (this.debugView) {
      // test hook: look at the scene from a free camera
      const dv = this.debugView;
      this.scene.attach(this.camera);
      this.camera.position.set(...dv.pos);
      this.camera.lookAt(...dv.target);
      if (dv.fov) { this.camera.fov = dv.fov; this.camera.updateProjectionMatrix(); }
    } else if (third) {
      if (this.camera.parent !== this.scene) { this.scene.add(this.camera); this.resize(); }
      this.placeChaseCamera(dt, ctl);
    } else if (this.camera.parent !== this.headLook) {
      this.headLook.add(this.camera);
      this.camera.position.set(0, 0, 0);
      this.camera.rotation.set(0, 0, 0);
      this.resize();
    }

    // ---- world systems that follow the camera ----
    this.camera.updateMatrixWorld();
    const camPos = this.camera.getWorldPosition(new THREE.Vector3());
    shared.uCamPos.value.copy(camPos);
    const fwd = new THREE.Vector3(0, 0, -1).applyQuaternion(this.camera.getWorldQuaternion(new THREE.Quaternion()));
    const focus = camPos.clone().addScaledVector(new THREE.Vector3(fwd.x, 0, fwd.z).normalize(), this.Q.shadowSpan * 0.3);
    this.sky.update(this.camera, focus);
    this.grass.update(this.cameraForCulling());
    // other players: send ours, move theirs
    this.net.update(dt);
    // events of this frame, for sound and the HUD
    this.events = [...this.cockpit.events, ...v.events];
    this.cockpit.events.length = 0; v.events.length = 0;
  }

  updateEffects(dt, fresh) {
    const v = this.vehicle, ck = this.cockpit;
    const wind = new THREE.Vector2(shared.uWind.value.x, shared.uWind.value.y).multiplyScalar(0.5);
    // cigar wisp
    this.emit.wisp += dt * (10 + ck.ember * 10);
    const tip = ck.cigar.tipWorld(new THREE.Vector3());
    while (this.emit.wisp > 1) {
      this.emit.wisp--;
      this.smoke.spawn(tip, new THREE.Vector3((Math.random() - 0.5) * 0.02, 0.07 + Math.random() * 0.04, (Math.random() - 0.5) * 0.02), { size: 0.012, grow: 0.07, life: 2.4, alpha: 0.16 + ck.ember * 0.06, tint: 0.6, spin: 0.6 });
    }
    // exhaust
    this.emit.exhaust += dt * (2 + v.rpm / 500);
    const ex = new THREE.Vector3(0.25, 1.11, -0.92).applyMatrix4(this.mowerRoot.matrixWorld);
    while (this.emit.exhaust > 1) {
      this.emit.exhaust--;
      this.smoke.spawn(ex, new THREE.Vector3((Math.random() - 0.5) * 0.08, 0.35 + Math.random() * 0.2, (Math.random() - 0.5) * 0.08), { size: 0.03, grow: 0.22, life: 1.4, alpha: 0.07 + 0.05 * Math.max(0, v.throttle), tint: 1, spin: 0.5 });
    }
    for (const e of ck.events) {
      if (e.type === 'exhale') {
        const camQ = this.headLook.getWorldQuaternion(new THREE.Quaternion());
        const mouth = new THREE.Vector3(0, -0.075, -0.06).applyMatrix4(this.headLook.matrixWorld);
        const n = Math.round(14 + 22 * e.amount);
        for (let i = 0; i < n; i++) {
          const dir = new THREE.Vector3((Math.random() - 0.5) * 0.5, -0.1 + (Math.random() - 0.3) * 0.3, -1).normalize().applyQuaternion(camQ);
          this.smoke.spawn(mouth.clone().addScaledVector(dir, 0.04), dir.multiplyScalar(0.35 + Math.random() * 0.6), { size: 0.03 + Math.random() * 0.03, grow: 0.28, life: 2.2 + Math.random(), alpha: 0.2 * e.amount + 0.08, tint: 0.2, spin: 0.8 });
        }
      } else if (e.type === 'ash') {
        for (let i = 0; i < 4; i++) this.smoke.spawn(e.pos, new THREE.Vector3((Math.random() - 0.5) * 0.1, -0.3, (Math.random() - 0.5) * 0.1), { size: 0.01, grow: 0.05, life: 0.9, alpha: 0.25, tint: 0.5 });
      }
    }
    // clippings thrown out of the side chute
    if (fresh > 0 && this.bladesOn) {
      const n = Math.min(14, Math.round(fresh * 2 * this.Q.particles + Math.random()));
      const chute = new THREE.Vector3(0.95, 0.22, -0.1).applyMatrix4(this.mowerRoot.matrixWorld);
      const right = new THREE.Vector3(1, 0, 0).applyQuaternion(this.mowerRoot.quaternion);
      const fwd = new THREE.Vector3(v.fx, 0, v.fz);
      for (let i = 0; i < n; i++) {
        const vel = right.clone().multiplyScalar(2.2 + Math.random() * 2.4).addScaledVector(fwd, v.v * 0.6 + (Math.random() - 0.5) * 1.2);
        vel.y = 0.6 + Math.random() * 1.6;
        this.clippings.spawn(chute, vel);
      }
    }
    this.smoke.update(dt, this.camera.getWorldPosition(new THREE.Vector3()), wind);
    this.clippings.update(dt, heightAt);
  }

  // 'first': from the driver's seat; 'third': a chase camera behind the mower
  setView(mode) {
    this.viewMode = mode;
    this.driverHead.group.visible = mode === 'third';
    this.camera.near = mode === 'third' ? 0.1 : 0.05;
    this.camera.updateProjectionMatrix();
    if (mode === 'third') Object.assign(this.third, { base: null, yaw: 0, pitch: 0.3, idle: 0 });
  }

  // The chase camera follows the mower round a moment behind, can be swung about with the
  // look controls, and drifts back behind the mower when left alone.
  placeChaseCamera(dt, ctl) {
    const T = this.third, v = this.vehicle, root = this.mowerRoot;
    const heading = Math.atan2(v.fx, v.fz);
    if (T.base === null) T.base = heading;
    const dh = Math.atan2(Math.sin(heading - T.base), Math.cos(heading - T.base));
    T.base += dh * (1 - Math.exp(-dt * 2.5));
    const looking = Math.abs(ctl.lookX || 0) + Math.abs(ctl.lookY || 0) > 1e-5;
    T.idle = looking ? 0 : T.idle + dt;
    if (T.idle > 2.5) {
      const k = 1 - Math.exp(-dt * 1.2);
      T.yaw -= T.yaw * k; T.pitch += (0.3 - T.pitch) * k;
    }
    const ang = T.base + T.yaw, cp = Math.cos(T.pitch), sp = Math.sin(T.pitch);
    const target = _tgt.set(root.position.x, root.position.y + 1.2, root.position.z);
    const pos = _pos.set(target.x - Math.sin(ang) * cp * T.dist, target.y + sp * T.dist + 0.25, target.z - Math.cos(ang) * cp * T.dist);
    pos.y = Math.max(pos.y, heightAt(pos.x, pos.z) + 0.45);
    this.camera.position.copy(pos);
    this.camera.lookAt(target);
  }

  cameraForCulling() {
    // grass culls against the real camera in world space
    const cam = this.camera;
    cam.matrixWorldInverse.copy(cam.matrixWorld).invert();
    return { position: cam.getWorldPosition(new THREE.Vector3()), projectionMatrix: cam.projectionMatrix, matrixWorldInverse: cam.matrixWorldInverse };
  }

  render() {
    this.post.render(this.time);
    if (++this.frames === 3) this.checkShaders();
  }

  // A GPU with tighter limits than ours (most phones allow 16 textures per shader) can refuse
  // a shader outright, and the object then simply vanishes. After the first frames, swap any
  // refused material for its fallback (or a plain one of the same colour) and report it.
  checkShaders() {
    const r = this.renderer, failed = [];
    this.scene.traverse((o) => {
      if (!o.isMesh || !o.material || Array.isArray(o.material)) return;
      const prog = r.properties.get(o.material).currentProgram;
      if (!prog || !prog.diagnostics || prog.diagnostics.runnable !== false) return;
      const fb = o.material.userData.fallback;
      const col = o.material.color ? o.material.color.clone() : new THREE.Color('#808080');
      o.material = fb ? fb() : new THREE.MeshStandardMaterial({ color: col, roughness: 0.9 });
      failed.push(o.name || o.type);
    });
    if (failed.length) console.warn('[great-lawn] shaders refused by this GPU, using fallbacks for:', failed.join(', '));
    this.shaderFallbacks = failed;
  }
}
