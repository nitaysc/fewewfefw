// The game: builds the world, runs the frame loop and ties the systems together.
import * as THREE from '../vendor/three.module.js';
import { PRESETS, guessQuality } from './core/quality.js';
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
import { Smoke, Clippings } from './fx/particles.js';
import { heightAt } from './world/layout.js';
import { buildHouse } from './world/house.js';
import { Trees } from './world/trees.js';
import { buildGarden } from './world/garden.js';
import { bakeStaticShadow } from './world/staticshadow.js';
import { Rooks } from './world/wildlife.js';

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
  }

  async load(step) {
    // ---- renderer ----
    const renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: false, powerPreference: 'high-performance', stencil: false });
    this.renderer = renderer;
    if (!renderer.capabilities.isWebGL2) throw new Error('WebGL 2 is required');
    const guess = guessQuality(renderer.getContext());
    this.gpu = guess.gpu;
    const qName = this.settings.quality || guess.preset;
    this.qualityName = qName;
    const Q = { ...PRESETS[qName] };
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
    }

    await step(0.45, 'Fuelling the mower…');
    this.vehicle = new Vehicle(this.plan);
    this.mowerRoot = new THREE.Group();
    scene.add(this.mowerRoot);
    this.head = new THREE.Object3D();
    this.head.position.copy(DIM.eye);
    this.mowerRoot.add(this.head);
    this.head.add(camera);
    this.look = { yaw: 0, pitch: -0.2, yawV: 0, pitchV: 0 };
    this.mower = new MowerModel();
    this.mowerRoot.add(this.mower.group);

    await step(0.55, 'Washing the gentleman\'s hands…');
    this.cockpit = new Cockpit(this, { tone: this.settings.skinTone });
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
  }

  resize() {
    const w = innerWidth, h = innerHeight;
    const Q = this.Q;
    const dpr = Math.min(devicePixelRatio || 1, Q.maxDpr) * Q.renderScale * (this.dynScale || 1);
    this.renderer.setPixelRatio(dpr);
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.fov = w / h < 1 ? 80 : 66;
    this.camera.updateProjectionMatrix();
    if (this.post) this.post.setSize();
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
      }
    }
    // engine load: fraction of fresh (tall) grass going under the deck
    const area = Math.max(Math.abs(v.v) * dt * DIM.deckR * 2, 1e-4);
    this.cutLoad = damp(this.cutLoad, clamp((fresh * 0.25) / area), 3, dt);
    v.prevDeck = v.deck.clone();
    this.cutmap.flush();
    this.grass.setMower(v.x, v.z, v.fx, v.fz);

    // ---- head look ----
    const L = this.look;
    if (playing) {
      L.yaw = clamp(L.yaw - ctl.lookX, -2.1, 2.1);
      L.pitch = clamp(L.pitch - ctl.lookY, -1.15, 0.85);
    }
    const ck = this.cockpit;
    // engine shake and bumps through the seat
    const shake = 0.0016 * (v.rpm / 3000) + Math.min(0.006, Math.abs(v.vy) * 0.01);
    this.head.position.set(DIM.eye.x + Math.sin(this.time * 61) * shake * 0.4, DIM.eye.y + Math.sin(this.time * 47.3) * shake, DIM.eye.z);
    this.head.rotation.set(0, 0, 0);
    const sway = ck.tipsy > 0.4 ? (ck.tipsy - 0.4) * 0.025 : 0;
    this.camera.rotation.set(L.pitch + ck.headTilt + Math.sin(this.time * 0.6) * sway, L.yaw + Math.sin(this.time * 0.43) * sway * 1.3, Math.sin(this.time * 0.5) * sway * 0.8, 'YXZ');

    this.mower.update(dt, v, { bladesOn: this.bladesOn, boost: c.boost, time: this.time, fuel: 0.8 });
    this.mowerRoot.updateMatrixWorld(true);
    ck.bottle.bubScale.value = this.renderer.getDrawingBufferSize(_v2).y / (2 * Math.tan(THREE.MathUtils.degToRad(this.camera.fov) / 2));
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
    } else if (this.camera.parent !== this.head) {
      this.head.add(this.camera);
      this.camera.position.set(0, 0, 0);
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
        const camQ = this.camera.getWorldQuaternion(new THREE.Quaternion());
        const mouth = new THREE.Vector3(0, -0.075, -0.06).applyMatrix4(this.camera.matrixWorld);
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

  cameraForCulling() {
    // grass culls against the real camera in world space
    const cam = this.camera;
    cam.matrixWorldInverse.copy(cam.matrixWorld).invert();
    return { position: cam.getWorldPosition(new THREE.Vector3()), projectionMatrix: cam.projectionMatrix, matrixWorldInverse: cam.matrixWorldInverse };
  }

  render() {
    this.post.render(this.time);
  }
}
