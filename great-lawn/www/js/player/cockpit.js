// The driver's hands and their business. The right hand steers with the cigar between its
// first two fingers and goes to the lips to draw on it. The left hand keeps the ale, held
// on the knee, and raises it to drink, tilting further as it empties; a finished bottle is
// swapped for a fresh one from the crate on the footboard.
import * as THREE from '../../vendor/three.module.js';
import { Hands, HAND_SCALE } from './hands.js';
import { Bottle, BOTTLE_H } from './beer.js';
import { Cigar, CIGAR_LEN } from './cigar.js';
import { Body } from './body.js';
import { clamp, damp, easeInOut } from '../core/util.js';

const _p = new THREE.Vector3(), _p2 = new THREE.Vector3(), _q = new THREE.Quaternion(), _q2 = new THREE.Quaternion(), _s = new THREE.Vector3(), _s2 = new THREE.Vector3();
const basis = (x, y, z) => new THREE.Matrix4().makeBasis(x, y, z);
const S = HAND_SCALE;
const SCALE_M = new THREE.Matrix4().makeScale(S, S, S);

// Blend two world matrices (rigid + uniform scale), with a lift in the middle of the move.
function blendInto(obj, a, b, t, lift = 0) {
  a.decompose(_p, _q, _s); b.decompose(_p2, _q2, _s2);
  _p.lerp(_p2, t); _p.y += Math.sin(Math.PI * t) * lift;
  _q.slerp(_q2, t);
  obj.position.copy(_p); obj.quaternion.copy(_q); obj.scale.copy(_s).lerp(_s2, t);
  obj.updateMatrixWorld(true);
}
function setWorld(obj, m) { m.decompose(obj.position, obj.quaternion, obj.scale); obj.updateMatrixWorld(true); }
// hand-space frame of a grip cylinder: x along its axis, y the back of the hand
function gripFrameInv(ax) {
  const e1 = ax.clone().normalize(), e2 = new THREE.Vector3(0, 1, 0), e3 = new THREE.Vector3().crossVectors(e1, e2).normalize();
  return basis(e1, e2, e3).transpose();
}

export class Cockpit {
  constructor(game, { tone } = {}) {
    this.game = game;
    const { scene, camera, mower, mowerRoot, Q } = game;
    this.hands = new Hands({ quality: Q, tone });
    this.bottle = new Bottle();
    this.cigar = new Cigar();
    const H = this.hands;
    this.leftRig = new THREE.Group(); this.leftRig.name = 'left-hand-rig';
    this.rightRig = new THREE.Group(); this.rightRig.name = 'right-hand-rig';
    scene.add(this.leftRig, this.rightRig, this.bottle.group);
    this.leftRig.add(H.left); this.rightRig.add(H.right);
    H.left.scale.setScalar(1); H.right.scale.setScalar(1);  // the rig carries the scale
    // the driver: seated body, and sleeves from the wrists to the shoulders
    this.body = new Body(game);
    // the cigar rides on the right index finger: anchor +Z runs head -> lit end
    H.cigarAnchor.add(this.cigar.group);
    this.cigar.group.position.set(0, 0, -0.034);
    mowerRoot.updateMatrixWorld(true);

    // ---------------- hands on the wheel ----------------
    const wheelW = mower.steeringWheel.matrixWorld;
    const placeOnRim = (alpha, grip, side, elbow) => {
      const rimP = mower.rimPoint(alpha);
      const T = new THREE.Vector3(Math.cos(alpha), 0, Math.sin(alpha)).multiplyScalar(side);
      const N = new THREE.Vector3(0, 1, 0), B = new THREE.Vector3().crossVectors(T, N);
      const Hinv = gripFrameInv(grip.ax);
      const make = (beta) => new THREE.Matrix4().makeTranslation(rimP.x, rimP.y, rimP.z)
        .multiply(basis(T, N, B)).multiply(new THREE.Matrix4().makeRotationX(beta)).multiply(Hinv)
        .multiply(new THREE.Matrix4().makeTranslation(-grip.c.x * S, -grip.c.y * S, -grip.c.z * S)).multiply(SCALE_M);
      // roll the hand about the rim until the forearm heads back towards the elbow
      let best = -2, bestM = null;
      for (let k = 0; k < 144; k++) {
        const beta = (k / 144) * Math.PI * 2 - Math.PI;
        const M = make(beta), W = wheelW.clone().multiply(M);
        const wrist = new THREE.Vector3(0, 0, 0.05).applyMatrix4(W);
        const fore = new THREE.Vector3(0, 0, 1).transformDirection(W);
        const sc = fore.dot(elbow.clone().sub(wrist).normalize());
        if (sc > best) { best = sc; bestM = M; }
      }
      const o = new THREE.Object3D();
      o.matrixAutoUpdate = false; o.matrix.copy(bestM);
      mower.steeringWheel.add(o);
      return o;
    };
    this.rightWheel = placeOnRim(0.62, H.grips.rightWheel, 1, new THREE.Vector3(0.3, 0.86, 0.12));

    // ---------------- the ale: held on the knee, crate, grip, lips ----------------
    this.leftRest = new THREE.Object3D();   // bottle frame while held at rest
    this.leftRest.position.set(-0.245, 1.0, -0.12);
    this.leftRest.rotation.set(0.1, 0.25, 0.2);
    mowerRoot.add(this.leftRest);
    this.crate = mower.crateAnchor;        // where fresh bottles come from
    mowerRoot.updateMatrixWorld(true);
    {
      const bg = H.grips.leftBottle;
      const Hinv = gripFrameInv(bg.ax);
      const elbow = new THREE.Vector3(-0.3, 0.86, 0.12);
      const restM = this.leftRest.matrixWorld;
      let best = -2;
      for (let k = 0; k < 72; k++) {
        const gamma = (k / 72) * Math.PI * 2;
        const r = new THREE.Vector3(Math.cos(gamma), 0, Math.sin(gamma));
        // index knuckle at the top (thumb towards the neck), little finger below
        const X = new THREE.Vector3(0, -1, 0), Z = new THREE.Vector3().crossVectors(X, r);
        const M = new THREE.Matrix4().makeTranslation(0, 0.092, 0).multiply(basis(X, r, Z)).multiply(Hinv)
          .multiply(new THREE.Matrix4().makeTranslation(-bg.c.x * S, -bg.c.y * S, -bg.c.z * S)).multiply(SCALE_M);
        const W = restM.clone().multiply(M);
        const wrist = new THREE.Vector3(0, 0, 0.05).applyMatrix4(W);
        const fore = new THREE.Vector3(0, 0, 1).transformDirection(W);
        const sc = fore.dot(elbow.clone().sub(wrist).normalize()) - Math.max(0, -fore.y) * 0.2;
        if (sc > best) { best = sc; this.handOnBottle = M; }
      }
    }
    this.bottleAtLips = new THREE.Object3D();
    game.headLook.add(this.bottleAtLips);
    this.handAtLips = new THREE.Object3D();
    game.headLook.add(this.handAtLips);
    // the cigar in the hand on the wheel: lit end up, leaning out to the right and forward
    {
      setWorld(this.rightRig, this.rightWheel.matrixWorld);
      H.rightRig.setPose(H.poses.wheelCigar);
      this.rightRig.updateMatrixWorld(true);
      const anchor = H.cigarAnchor;
      const want = new THREE.Vector3(0.42, 0.66, -0.62).normalize().transformDirection(mowerRoot.matrixWorld);
      const qw = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), want);
      const pq = anchor.parent.getWorldQuaternion(new THREE.Quaternion());
      anchor.quaternion.copy(pq.invert().multiply(qw));
      anchor.updateMatrixWorld(true);
      this.cigarQWheel = anchor.quaternion.clone();
    }
    // At the lips the fingers turn the cigar square through the gap between them, out of the
    // back of the hand and leaning a little to the fingertips, so the hand can sit flat in
    // front of the mouth with the forearm dropping away to the elbow.
    {
      H.rightRig.setPose(H.poses.cigarLips);
      this.rightRig.position.set(0, 0, 0); this.rightRig.quaternion.identity(); this.rightRig.scale.set(1, 1, 1);
      this.rightRig.updateMatrixWorld(true);
      const anchor = H.cigarAnchor;
      const want = new THREE.Vector3(0, 0.95, -0.3).normalize();   // hand space: +y the back of the hand, -z the fingers
      const qw = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), want);
      const pq = anchor.parent.getWorldQuaternion(new THREE.Quaternion());
      this.cigarQLips = pq.invert().multiply(qw);
      anchor.quaternion.copy(this.cigarQLips);
      this.rightRig.updateMatrixWorld(true);
      // the cigar's frame in hand space when held at the lips
      this.cigarInHand = new THREE.Matrix4().copy(this.rightRig.matrixWorld).invert().multiply(this.cigar.group.matrixWorld);
      anchor.quaternion.copy(this.cigarQWheel);
    }
    // the cigar at the lips, in the head's frame: held in the right corner of the mouth and
    // pointing out to the right; the hand lies across the mouth with the wrist by the right
    // cheek and the forearm dropping down and out to the elbow
    this.lipsCfg = { lips: new THREE.Vector3(0.012, -0.088, -0.068), axis: new THREE.Vector3(0.45, -0.08, -0.89), fore: new THREE.Vector3(0.51, -0.8, 0.3) };

    // ---------------- state ----------------
    this.drinkT = 0;       // 0 on the knee .. 1 at the lips
    this.puffT = 0;        // 0 on the wheel .. 1 at the lips
    this.swapT = -1;       // fetching a fresh bottle: 0..2, -1 when idle
    this.draw = 0; this.ember = 0.35; this.smokeInMouth = 0;
    this.bottles = 1; this.cigars = 1; this.cigarLeft = 1;
    this.tipsy = 0; this.headTilt = 0; this.gulpTimer = 0;
    this.events = [];
    H.leftRig.setPose(H.poses.bottle);
  }

  get fill() { return this.bottle.fill; }
  get swapping() { return this.swapT >= 0; }

  update(dt, ctl, playing) {
    const H = this.hands, cam = this.game.headLook;
    cam.updateMatrixWorld(true);
    this.game.mowerRoot.updateMatrixWorld(true);
    const fill = this.bottle.fill;

    // ---------------- the ale ----------------
    const wantDrink = playing && ctl.drink && fill > 0 && !this.swapping;
    this.wantDrink = wantDrink;
    if (this.swapping) {
      this.swapT += dt / 0.95;
      if (this.swapT >= 1 && !this.refilled) { this.refilled = true; this.bottle.fill = 1; this.bottle.foam = 1; this.bottle.cold = 1; this.bottles++; this.events.push({ type: 'opened' }); }
      if (this.swapT >= 2) { this.swapT = -1; this.refilled = false; }
    } else {
      const rate = wantDrink ? 1.25 : 1.6;
      this.drinkT = clamp(this.drinkT + (wantDrink ? dt * rate : -dt * rate), 0, 1);
    }
    const restW = this.leftRest.matrixWorld;
    if (this.swapping) {
      // down to the crate for a fresh one and back up
      const k = this.swapT < 1 ? this.swapT : 2 - this.swapT;
      blendInto(this.bottle.group, restW, this.crate.matrixWorld, easeInOut(clamp(k)), 0.04);
    } else {
      const elev = THREE.MathUtils.degToRad(8 + (1 - fill) * 58 + (this.drinkT > 0.98 ? 5 : 0));
      const w = new THREE.Vector3(0.12, Math.sin(elev), -Math.cos(elev)).normalize();     // neck -> base
      const lips = new THREE.Vector3(0.0, -0.083, -0.062);
      this.bottleAtLips.position.copy(lips).addScaledVector(w, BOTTLE_H);
      this.bottleAtLips.quaternion.copy(this.rollFor(new THREE.Vector3(0, 1, 0), w.clone().negate(), this.handOnBottle, new THREE.Vector3(-0.55, -0.7, 0.45)));
      this.bottleAtLips.updateMatrixWorld(true);
      blendInto(this.bottle.group, restW, this.bottleAtLips.matrixWorld, easeInOut(this.drinkT), 0.07);
    }
    // the left hand holds it throughout
    setWorld(this.leftRig, this.bottle.group.matrixWorld.clone().multiply(this.handOnBottle));
    this.bottle.update(dt);

    // drinking: the ale must reach the bottle's mouth
    let drinking = false;
    if (!this.swapping && this.drinkT > 0.96 && fill > 0) {
      if (this.bottle.reachesMouth()) {
        drinking = true;
        const rate = 0.075;   // a 330 ml bottle in about 13 s of drinking
        this.bottle.fill = Math.max(0, fill - rate * dt);
        this.bottle.foam = Math.min(1, this.bottle.foam + dt * 0.05);
        this.tipsy = Math.min(3, this.tipsy + rate * dt * 0.55);
        this.gulpTimer -= dt;
        if (this.gulpTimer <= 0) { this.gulpTimer = 0.62 + Math.random() * 0.25; this.events.push({ type: 'gulp' }); }
        if (this.bottle.fill === 0) this.events.push({ type: 'empty' });
      }
    }
    this.drinking = drinking;
    this.tipsy = Math.max(0, this.tipsy - dt * 0.004);

    // ---------------- the cigar ----------------
    const wantPuff = playing && ctl.puff && this.cigarLeft > 0.02;
    this.wantPuff = wantPuff;
    const pr = wantPuff ? 1.5 : 1.8;
    this.puffT = clamp(this.puffT + (wantPuff ? dt * pr : -dt * pr), 0, 1);
    const tC = easeInOut(this.puffT);
    const LC = this.lipsCfg;
    const axis = LC.axis.clone().normalize();
    const handInCig = this.cigarInHand.clone().invert();
    const cq = this.rollFor(new THREE.Vector3(0, 0, 1), axis, handInCig, LC.fore);
    const lipsC = LC.lips;
    // the rig's matrix carries the hand scale: rig x cigarInHand = cigar frame (scaled)
    const handM = new THREE.Matrix4().compose(lipsC, cq, new THREE.Vector3(S, S, S)).multiply(handInCig);
    handM.decompose(this.handAtLips.position, this.handAtLips.quaternion, this.handAtLips.scale);
    this.handAtLips.updateMatrixWorld(true);
    blendInto(this.rightRig, this.rightWheel.matrixWorld, this.handAtLips.matrixWorld, tC, 0.07);
    H.pose('right', 'wheelCigar', 'cigarLips', clamp((tC - 0.15) / 0.7));
    H.cigarAnchor.quaternion.slerpQuaternions(this.cigarQWheel, this.cigarQLips, easeInOut(clamp((tC - 0.1) / 0.75)));

    const atLips = this.puffT > 0.97;
    this.draw = damp(this.draw, atLips ? 1 : 0, atLips ? 2.2 : 5, dt);
    if (atLips) {
      this.smokeInMouth = Math.min(1, this.smokeInMouth + dt * 0.55);
      this.cigarLeft = Math.max(0, this.cigarLeft - dt * 0.0042);
      this.cigar.ashLen = Math.min(0.045, this.cigar.ashLen + dt * 0.0016);
      if (Math.random() < dt * 3) this.events.push({ type: 'draw' });
    } else {
      this.cigarLeft = Math.max(0, this.cigarLeft - dt * 0.00012);
      this.cigar.ashLen = Math.min(0.045, this.cigar.ashLen + dt * 0.00009);
      if (this.smokeInMouth > 0.15 && this.puffT < 0.75) { this.events.push({ type: 'exhale', amount: this.smokeInMouth }); this.smokeInMouth = 0; }
    }
    this.ember = damp(this.ember, 0.32 + this.draw * 1.25, 3, dt);
    this.cigar.burn.value = 0.032 + (CIGAR_LEN - 0.032) * this.cigarLeft;
    this.cigar.update(dt, this.ember);
    if (this.cigar.ashLen > 0.032 && Math.random() < dt * 0.15) this.dropAsh();

    // head: tips back as the bottle comes up, a touch forward to the cigar
    const tD = this.swapping ? 0 : easeInOut(this.drinkT);
    this.headTilt = damp(this.headTilt, tD * (0.12 + (1 - fill) * 0.3) - tC * 0.06, 4, dt);
    H.update();
    this.body.update(this.rightRig, this.leftRig);
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
    if (this.swapping || this.drinkT > 0.05 || this.bottle.fill > 0.02) return false;
    this.swapT = 0; this.refilled = false;
    return true;
  }
  lightNewCigar() {
    if (this.cigarLeft > 0.05) return false;
    this.cigarLeft = 1; this.cigar.ashLen = 0.002; this.cigars++;
    this.events.push({ type: 'lit' });
    return true;
  }
}
