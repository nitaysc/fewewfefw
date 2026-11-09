// The driver's hands and their business: the right hand steers (cigar between its fingers)
// and goes to the lips to draw on the cigar; the left hand keeps the ale on the knee and
// raises it to drink, tilting further as the bottle empties, and fetches a fresh one from
// the crate when it is finished.
import * as THREE from '../../vendor/three.module.js';
import { Hands, HAND_SCALE } from './hands.js';
import { Bottle, BOTTLE_H } from './beer.js';
import { Cigar, CIGAR_LEN } from './cigar.js';
import { clamp, damp, easeInOut, smoothstep } from '../core/util.js';

const _m = new THREE.Matrix4(), _m2 = new THREE.Matrix4(), _p = new THREE.Vector3(), _p2 = new THREE.Vector3();
const _q = new THREE.Quaternion(), _q2 = new THREE.Quaternion(), _s = new THREE.Vector3();

function basis(x, y, z) { return new THREE.Matrix4().makeBasis(x, y, z); }

// Blend two world matrices (rigid), with an optional lift in the middle of the move.
function blendInto(obj, a, b, t, lift = 0, up = new THREE.Vector3(0, 1, 0)) {
  a.decompose(_p, _q, _s); b.decompose(_p2, _q2, _s);
  _p.lerp(_p2, t).addScaledVector(up, Math.sin(Math.PI * t) * lift);
  _q.slerp(_q2, t);
  obj.position.copy(_p); obj.quaternion.copy(_q); obj.scale.set(1, 1, 1);
  obj.updateMatrixWorld(true);
}

export class Cockpit {
  constructor(game, { tone } = {}) {
    this.game = game;
    const { scene, camera, mower, mowerRoot, Q } = game;
    this.hands = new Hands({ quality: Q, tone });
    this.bottle = new Bottle();
    this.cigar = new Cigar();

    // ---------------- left: the ale ----------------
    this.leftRig = new THREE.Group();
    this.leftRig.name = 'ale-in-hand';
    scene.add(this.leftRig);
    this.leftRig.add(this.bottle.group);
    const L = this.hands.left;
    this.bottle.group.add(L);
    L.matrixAutoUpdate = false;
    // rest: bottle on the left knee; mouth: neck at the lips (camera space)
    this.leftRest = new THREE.Object3D();
    this.leftRest.position.set(-0.245, 1.0, -0.12);
    this.leftRest.rotation.set(0.1, 0.25, 0.2);
    mowerRoot.add(this.leftRest);
    mowerRoot.updateMatrixWorld(true);
    {
      // hand round the bottle: grip axis along the bottle, pick the side of the bottle that
      // sends the forearm back towards the left elbow
      const bg = this.hands.bottleGrip;
      const e1 = bg.ax.clone().normalize(), e2 = new THREE.Vector3(0, 1, 0), e3 = new THREE.Vector3().crossVectors(e1, e2);
      const handFrameInv = basis(e1, e2, e3).transpose();
      const elbow = new THREE.Vector3(-0.3, 0.86, 0.12);
      const restM = this.leftRest.matrixWorld;
      let best = -2, bestM = null;
      for (let k = 0; k < 72; k++) {
        const gamma = (k / 72) * Math.PI * 2;
        const r = new THREE.Vector3(Math.cos(gamma), 0, Math.sin(gamma));
        // index knuckle at the top (thumb towards the neck), little finger below
        const X = new THREE.Vector3(0, -1, 0), Z = new THREE.Vector3().crossVectors(X, r);
        const M = new THREE.Matrix4().makeTranslation(0, 0.09, 0).multiply(basis(X, r, Z)).multiply(handFrameInv)
          .multiply(new THREE.Matrix4().makeTranslation(-bg.c.x * HAND_SCALE, -bg.c.y * HAND_SCALE, -bg.c.z * HAND_SCALE))
          .multiply(new THREE.Matrix4().makeScale(HAND_SCALE, HAND_SCALE, HAND_SCALE));
        const W = restM.clone().multiply(M);
        const wrist = new THREE.Vector3(0, 0, 0.06).applyMatrix4(W);
        const fore = new THREE.Vector3(0, 0, 1).transformDirection(W);
        const want = elbow.clone().sub(wrist).normalize();
        const score = fore.dot(want);
        if (score > best) { best = score; bestM = M; }
      }
      L.matrix.copy(bestM);
    }
    this.leftMouth = new THREE.Object3D();
    camera.add(this.leftMouth);
    this.leftCrate = new THREE.Object3D();   // where fresh bottles come from
    this.leftCrate.position.set(-0.55, 0.62, 0.42);
    this.leftCrate.rotation.set(0.2, 0, 0.9);
    mowerRoot.add(this.leftCrate);

    // ---------------- right: steering, cigar ----------------
    this.rightRig = new THREE.Group();
    this.rightRig.name = 'right-hand-rig';
    scene.add(this.rightRig);
    const R = this.hands.right;
    this.rightRig.add(R);
    R.add(this.hands.cigarAnchor);
    this.hands.cigarAnchor.add(this.cigar.group);
    this.cigar.group.rotation.x = Math.PI;              // head toward the palm, ember out the back
    this.cigar.group.position.set(0, 0, 0.05);
    // grip on the rim, a little right of the top; roll the hand about the rim so the
    // forearm heads back towards the right elbow
    const alpha = 0.32;
    const rimP = mower.rimPoint(alpha);
    const T = new THREE.Vector3(Math.cos(alpha), 0, Math.sin(alpha));
    const N = new THREE.Vector3(0, 1, 0);
    const B = new THREE.Vector3().crossVectors(T, N);
    const grip = this.hands.wheelPose.grip;
    const e1 = new THREE.Vector3(...grip.ax).normalize(), e2 = new THREE.Vector3(0, 1, 0), e3 = new THREE.Vector3().crossVectors(e1, e2);
    const handFrameInv = basis(e1, e2, e3).transpose();
    this.rightRest = new THREE.Object3D();
    this.rightRest.matrixAutoUpdate = false;
    mower.steeringWheel.add(this.rightRest);
    mowerRoot.updateMatrixWorld(true);
    const wheelW = mower.steeringWheel.matrixWorld;
    const elbowR = new THREE.Vector3(0.3, 0.88, 0.1);
    let bestB = 0, bestS = -2;
    const make = (beta) => new THREE.Matrix4().makeTranslation(rimP.x, rimP.y, rimP.z)
      .multiply(basis(T, N, B)).multiply(new THREE.Matrix4().makeRotationX(beta)).multiply(handFrameInv)
      .multiply(new THREE.Matrix4().makeTranslation(-grip.c[0] * HAND_SCALE, -grip.c[1] * HAND_SCALE, -grip.c[2] * HAND_SCALE));
    for (let k = 0; k < 120; k++) {
      const beta = (k / 120) * Math.PI * 2 - Math.PI;
      const W = wheelW.clone().multiply(make(beta));
      const wrist = new THREE.Vector3(0, 0, 0.06).applyMatrix4(W);
      const fore = new THREE.Vector3(0, 0, 1).transformDirection(W);
      const sc = fore.dot(elbowR.clone().sub(wrist).normalize());
      if (sc > bestS) { bestS = sc; bestB = beta; }
    }
    this.rightRest.matrix.copy(make(bestB));
    this.rightMouth = new THREE.Object3D();
    camera.add(this.rightMouth);

    // ---------------- state ----------------
    this.drinkT = 0;       // 0 on the knee .. 1 at the lips
    this.puffT = 0;        // 0 on the wheel .. 1 at the lips
    this.draw = 0;         // how hard the cigar is being drawn on (0..1)
    this.ember = 0.35;
    this.smokeInMouth = 0;
    this.swapT = 0;        // fetching a fresh bottle: 0..1
    this.swapping = false;
    this.bottles = 1; this.cigars = 1;
    this.cigarLeft = 1;    // fraction of the smokable length left
    this.tipsy = 0;
    this.headTilt = 0;
    this.gulpTimer = 0;
    this.events = [];
    for (const g of [this.leftRig, this.rightRig]) g.traverse((o) => { if (o.isMesh) o.frustumCulled = false; });
  }

  get fill() { return this.bottle.fill; }

  update(dt, ctl, playing) {
    const g = this.game, cam = g.camera;
    const wantDrink = playing && ctl.drink && this.bottle.fill > 0 && !this.swapping;
    const wantPuff = playing && ctl.puff && this.cigarLeft > 0.02;

    // ---- the ale ----
    const target = wantDrink ? 1 : 0;
    const speed = wantDrink ? 1.25 : 1.6;
    this.drinkT = clamp(this.drinkT + Math.sign(target - this.drinkT) * dt * speed, 0, 1);
    if (Math.abs(target - this.drinkT) < dt * speed) this.drinkT = target;
    const tD = easeInOut(this.drinkT);
    // tilt grows as the bottle empties so the ale still reaches the neck; the bottle is rolled
    // about its own axis so the drinking arm comes up from below-left
    const fill = this.bottle.fill;
    const elev = THREE.MathUtils.degToRad(6 + (1 - fill) * 58 + (this.drinkT > 0.98 ? 5 : 0));
    const w = new THREE.Vector3(0.1, Math.sin(elev), -Math.cos(elev)).normalize();   // neck -> base
    const mouthB = new THREE.Vector3(0.0, -0.082, -0.062);
    this.leftMouth.position.copy(mouthB).addScaledVector(w, BOTTLE_H);
    this.leftMouth.quaternion.copy(this.rollFor(new THREE.Vector3(0, 1, 0), w.clone().negate(), this.hands.left.matrix, new THREE.Vector3(-0.55, -0.7, 0.45)));
    cam.updateMatrixWorld(true);
    g.mowerRoot.updateMatrixWorld(true);

    if (this.swapping) {
      this.swapT += dt / 2.2;
      const k = this.swapT;
      // down to the crate (first half), back up with a new bottle (second half)
      const t = k < 0.5 ? easeInOut(k * 2) : easeInOut((1 - k) * 2);
      blendInto(this.leftRig, this.leftRest.matrixWorld, this.leftCrate.matrixWorld, t, 0.05);
      if (k >= 0.5 && !this.swapped) {
        this.swapped = true;
        this.bottle.fill = 1; this.bottles++;
        this.events.push({ type: 'opened' });
      }
      if (k >= 1) { this.swapping = false; this.swapped = false; }
    } else {
      blendInto(this.leftRig, this.leftRest.matrixWorld, this.leftMouth.matrixWorld, tD, 0.07);
    }
    this.bottle.updateLevel();
    // drinking: the ale must reach the bottle's mouth
    let drinking = false;
    if (this.drinkT > 0.96 && fill > 0) {
      const mw = this.bottle.mouthWorld(_p);
      if (this.bottle.level.value > mw.y - 0.004) {
        drinking = true;
        const rate = 0.075; // fraction of the bottle per second (330 ml in ~13 s)
        this.bottle.fill = Math.max(0, fill - rate * dt);
        this.tipsy = Math.min(3, this.tipsy + rate * dt * 0.55);
        this.gulpTimer -= dt;
        if (this.gulpTimer <= 0) { this.gulpTimer = 0.62 + Math.random() * 0.25; this.events.push({ type: 'gulp' }); }
        if (this.bottle.fill === 0) this.events.push({ type: 'empty' });
      }
    }
    this.drinking = drinking;
    this.tipsy = Math.max(0, this.tipsy - dt * 0.004);

    // ---- the cigar ----
    const tP = wantPuff ? 1 : 0;
    const pspeed = wantPuff ? 1.5 : 1.7;
    this.puffT = clamp(this.puffT + Math.sign(tP - this.puffT) * dt * pspeed, 0, 1);
    if (Math.abs(tP - this.puffT) < dt * pspeed) this.puffT = tP;
    const tC = easeInOut(this.puffT);
    // at the lips: the cigar points out and down, the hand below it, forearm down to the right
    const anchor = this.hands.cigarAnchor;
    anchor.updateMatrix();
    this.cigar.group.updateMatrix();
    const cigInHand = new THREE.Matrix4().makeScale(HAND_SCALE, HAND_SCALE, HAND_SCALE).multiply(anchor.matrix).multiply(this.cigar.group.matrix);   // cigar -> rig
    const handInCig = cigInHand.clone().invert();
    const axis = new THREE.Vector3(0.2, -0.2, -0.96).normalize();
    const cq = this.rollFor(new THREE.Vector3(0, 0, 1), axis, handInCig, new THREE.Vector3(0.45, -0.75, 0.45));
    const lips = new THREE.Vector3(0.008, -0.086, -0.066);
    const cigM = new THREE.Matrix4().compose(lips, cq, new THREE.Vector3(1, 1, 1));
    const handM = cigM.multiply(handInCig);
    handM.decompose(this.rightMouth.position, this.rightMouth.quaternion, _s);
    this.rightMouth.updateMatrixWorld(true);
    this.rightRest.updateMatrixWorld(true);
    blendInto(this.rightRig, this.rightRest.matrixWorld, this.rightMouth.matrixWorld, tC, 0.06);

    // drawing on the cigar
    const atLips = this.puffT > 0.97;
    this.draw = damp(this.draw, atLips ? 1 : 0, atLips ? 2.2 : 5, dt);
    if (atLips) {
      this.smokeInMouth = Math.min(1, this.smokeInMouth + dt * 0.55);
      this.cigarLeft = Math.max(0, this.cigarLeft - dt * 0.0042);
      this.cigar.ashLen = Math.min(0.045, this.cigar.ashLen + dt * 0.0016);
      if (Math.random() < dt * 3) this.events.push({ type: 'draw' });
    } else {
      this.cigarLeft = Math.max(0, this.cigarLeft - dt * 0.00012); // it smoulders between draws
      this.cigar.ashLen = Math.min(0.045, this.cigar.ashLen + dt * 0.00009);
      if (this.smokeInMouth > 0.15 && this.puffT < 0.75) {
        this.events.push({ type: 'exhale', amount: this.smokeInMouth });
        this.smokeInMouth = 0;
      }
    }
    this.ember = damp(this.ember, 0.32 + this.draw * 1.25, 3, dt);
    const burnZ = 0.032 + (CIGAR_LEN - 0.032) * this.cigarLeft;
    this.cigar.burn.value = burnZ;
    this.cigar.update(dt, this.ember);
    if (this.cigar.ashLen > 0.032 && Math.random() < dt * 0.15) this.dropAsh();

    // head: tip back while drinking, a little forward while puffing
    const tiltT = tD * (0.12 + (1 - fill) * 0.3) - tC * 0.07;
    this.headTilt = damp(this.headTilt, tiltT, 4, dt);
    this.hands.update();
  }

  // Orientation that points `localAxis` along `worldAxis`, rolled about it so the forearm of
  // a hand attached with `handMatrix` points as close to `wantFore` as possible.
  rollFor(localAxis, worldAxis, handMatrix, wantFore) {
    const base = new THREE.Quaternion().setFromUnitVectors(localAxis, worldAxis);
    const fore0 = new THREE.Vector3(0, 0, 1).transformDirection(handMatrix);
    const want = wantFore.clone().normalize();
    let best = -2, bestQ = base;
    const q = new THREE.Quaternion(), r = new THREE.Quaternion(), f = new THREE.Vector3();
    for (let k = 0; k < 48; k++) {
      r.setFromAxisAngle(worldAxis, (k / 48) * Math.PI * 2);
      q.multiplyQuaternions(r, base);
      f.copy(fore0).applyQuaternion(q);
      const sc = f.dot(want);
      if (sc > best) { best = sc; bestQ = q.clone(); }
    }
    return bestQ;
  }

  dropAsh() {
    if (this.cigar.ashLen < 0.004) return false;
    const tip = new THREE.Vector3(0, 0, this.cigar.burn.value + this.cigar.ashLen * 0.5).applyMatrix4(this.cigar.group.matrixWorld);
    this.events.push({ type: 'ash', pos: tip, len: this.cigar.ashLen });
    this.cigar.ashLen = 0.001;
    return true;
  }

  freshBottle() {
    if (this.swapping || this.drinkT > 0.05) return false;
    this.swapping = true; this.swapT = 0; this.swapped = false;
    return true;
  }

  lightNewCigar() {
    if (this.cigarLeft > 0.05) return false;
    this.cigarLeft = 1; this.cigar.ashLen = 0.002; this.cigars++;
    this.events.push({ type: 'lit' });
    return true;
  }
}
