// three.js scenes: the chess board and the duel arena. Pieces are modelled in code from
// lathe profiles so the same model serves as a board piece and as a full-size fighter.
import * as THREE from '../vendor/three.module.min.js';
import { fileOf, rankOf, sq, typeOf, colorOf } from './chess.js';
import { eyeHeight } from './duel.js';

const canvas = document.getElementById('view');
export const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;

const COLORS = {
  w: { body: 0xf3e9d6, trim: 0xd9b45a, glow: 0x7fd7ff },
  b: { body: 0x2b2c38, trim: 0xb04a4a, glow: 0xff6b5a },
};

// ---------- piece models (height 1, base on y=0) ----------
const P = (pts) => pts.map(([r, y]) => new THREE.Vector2(r, y));
const BASE = [[0, 0], [0.42, 0], [0.42, 0.06], [0.38, 0.1], [0.3, 0.14]];
const PROFILES = {
  p: P([...BASE, [0.2, 0.22], [0.15, 0.45], [0.24, 0.5], [0.13, 0.55], [0.2, 0.62], [0.22, 0.72], [0.18, 0.82], [0.1, 0.88], [0, 0.9]]),
  r: P([...BASE, [0.28, 0.2], [0.25, 0.7], [0.33, 0.74], [0.33, 0.95], [0.24, 0.95], [0.24, 0.88], [0, 0.88]]),
  n: P([...BASE, [0.26, 0.2], [0.22, 0.32], [0.3, 0.36], [0.3, 0.42], [0, 0.42]]),
  b: P([...BASE, [0.22, 0.22], [0.13, 0.58], [0.24, 0.62], [0.12, 0.66], [0.19, 0.74], [0.18, 0.85], [0.1, 0.94], [0.04, 0.97], [0.06, 1.0], [0, 1.02]]),
  q: P([...BASE, [0.24, 0.22], [0.13, 0.62], [0.26, 0.66], [0.14, 0.7], [0.22, 0.86], [0.26, 0.9], [0.16, 0.9], [0.12, 0.96], [0, 0.97]]),
  k: P([...BASE, [0.25, 0.22], [0.14, 0.62], [0.27, 0.66], [0.15, 0.7], [0.24, 0.86], [0.2, 0.9], [0, 0.9]]),
};
const HEIGHTS = { p: 0.62, n: 0.78, b: 0.86, r: 0.72, q: 0.95, k: 1.0 };

const geoCache = {};
function lathe(t) {
  return geoCache[t] ||= new THREE.LatheGeometry(PROFILES[t], 28);
}
function knightHead() {
  if (geoCache.nh) return geoCache.nh;
  const s = new THREE.Shape();
  // a stylised horse head in profile, facing +x
  s.moveTo(-0.22, 0); s.lineTo(0.18, 0); s.lineTo(0.12, 0.18); s.lineTo(0.3, 0.3);
  s.lineTo(0.34, 0.42); s.lineTo(0.2, 0.5); s.lineTo(0.06, 0.62); s.lineTo(0.0, 0.7);
  s.lineTo(-0.06, 0.62); s.lineTo(-0.2, 0.52); s.lineTo(-0.26, 0.3); s.lineTo(-0.22, 0);
  const g = new THREE.ExtrudeGeometry(s, { depth: 0.22, bevelEnabled: true, bevelSize: 0.04, bevelThickness: 0.04, bevelSegments: 2 });
  g.translate(0, 0, -0.11);
  return (geoCache.nh = g);
}

const matCache = {};
function mats(c) {
  return matCache[c] ||= {
    body: new THREE.MeshStandardMaterial({ color: COLORS[c].body, roughness: c === 'w' ? 0.45 : 0.35, metalness: c === 'w' ? 0.05 : 0.3 }),
    trim: new THREE.MeshStandardMaterial({ color: COLORS[c].trim, roughness: 0.3, metalness: 0.7 }),
    glow: new THREE.MeshStandardMaterial({ color: COLORS[c].glow, emissive: COLORS[c].glow, emissiveIntensity: 1.4 }),
  };
}

// Returns a Group of height `h` with its base at the origin. `armed` adds a visor and a gun.
export function pieceModel(type, color, h = 1, armed = false) {
  const m = mats(color);
  const g = new THREE.Group();
  const inner = new THREE.Group();
  const body = new THREE.Mesh(lathe(type), m.body);
  body.castShadow = true; body.receiveShadow = true;
  inner.add(body);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.4, 0.025, 8, 32), m.trim);
  ring.rotation.x = Math.PI / 2; ring.position.y = 0.08;
  inner.add(ring);
  if (type === 'n') {
    const head = new THREE.Mesh(knightHead(), m.body);
    head.position.y = 0.4; head.castShadow = true;
    // the head faces the piece's forward (-z)
    head.rotation.y = Math.PI / 2;
    inner.add(head);
    const mane = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.4, 0.26), m.trim);
    mane.position.set(0, 0.85, 0.2); mane.rotation.x = -0.35;
    inner.add(mane);
  }
  if (type === 'r') {
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      const b = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.1, 0.1), m.body);
      b.position.set(Math.cos(a) * 0.28, 1.0, Math.sin(a) * 0.28); b.rotation.y = -a;
      b.castShadow = true;
      inner.add(b);
    }
  }
  if (type === 'q') {
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      const b = new THREE.Mesh(new THREE.SphereGeometry(0.045, 10, 8), m.trim);
      b.position.set(Math.cos(a) * 0.22, 0.95, Math.sin(a) * 0.22);
      inner.add(b);
    }
  }
  if (type === 'k') {
    const v = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.24, 0.07), m.trim);
    v.position.y = 1.02;
    const hz = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.07, 0.07), m.trim);
    hz.position.y = 1.05;
    inner.add(v, hz);
  }
  if (type === 'b') {
    const slit = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.14, 0.2), m.trim);
    slit.position.set(0.05, 0.86, -0.08); slit.rotation.z = 0.5;
    inner.add(slit);
  }
  const natural = type === 'r' ? 1.05 : type === 'k' ? 1.14 : type === 'n' ? 1.1 : 1.0;
  if (armed) {
    const visorY = type === 'n' ? 0.8 : type === 'r' ? 0.8 : 0.78;
    const visor = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.06, 0.08), m.glow);
    visor.position.set(0, visorY, -0.2);
    inner.add(visor);
    const gun = new THREE.Group();
    const barrel = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, 0.55), new THREE.MeshStandardMaterial({ color: 0x30333c, metalness: 0.7, roughness: 0.35 }));
    barrel.position.z = -0.2;
    const tip = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.06, 0.06), m.glow);
    tip.position.z = -0.5;
    gun.add(barrel, tip);
    gun.position.set(0.32, 0.6, -0.15);
    inner.add(gun);
    g.userData.gun = gun;
  }
  inner.scale.setScalar(h / natural);
  g.add(inner);
  g.userData.type = type; g.userData.color = color;
  return g;
}

// ---------- board scene ----------
const boardScene = new THREE.Scene();
boardScene.background = new THREE.Color(0x0d1220);
boardScene.fog = new THREE.Fog(0x0d1220, 18, 40);
const boardCam = new THREE.PerspectiveCamera(42, 1, 0.1, 100);
{
  boardScene.add(new THREE.HemisphereLight(0xbfd4ff, 0x1a1420, 1.1));
  const sun = new THREE.DirectionalLight(0xfff1dd, 2.2);
  sun.position.set(4, 10, 5);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  Object.assign(sun.shadow.camera, { left: -6, right: 6, top: 6, bottom: -6, near: 1, far: 25 });
  boardScene.add(sun);
  const rim = new THREE.DirectionalLight(0x6fa8ff, 0.8);
  rim.position.set(-6, 4, -6);
  boardScene.add(rim);
}
const tileGeo = new THREE.BoxGeometry(1, 0.2, 1);
const tileMats = {
  light: new THREE.MeshStandardMaterial({ color: 0xd8c7a3, roughness: 0.6 }),
  dark: new THREE.MeshStandardMaterial({ color: 0x5c4a3d, roughness: 0.6 }),
};
const tiles = [];
const sqPos = (s) => new THREE.Vector3(fileOf(s) - 3.5, 0, 3.5 - rankOf(s));
for (let s = 0; s < 64; s++) {
  const light = (fileOf(s) + rankOf(s)) % 2 === 1;
  const t = new THREE.Mesh(tileGeo, light ? tileMats.light : tileMats.dark);
  t.position.copy(sqPos(s)); t.position.y = -0.1;
  t.receiveShadow = true;
  t.userData.sq = s;
  boardScene.add(t);
  tiles.push(t);
}
{
  const frame = new THREE.Mesh(new THREE.BoxGeometry(9, 0.3, 9), new THREE.MeshStandardMaterial({ color: 0x2a1d16, roughness: 0.5, metalness: 0.2 }));
  frame.position.y = -0.2; frame.receiveShadow = true;
  boardScene.add(frame);
  const ground = new THREE.Mesh(new THREE.CircleGeometry(30, 48), new THREE.MeshStandardMaterial({ color: 0x141a2a, roughness: 0.9 }));
  ground.rotation.x = -Math.PI / 2; ground.position.y = -0.36; ground.receiveShadow = true;
  boardScene.add(ground);
  // file and rank labels
  const lbl = (text, x, z) => {
    const c = document.createElement('canvas'); c.width = c.height = 64;
    const x2 = c.getContext('2d');
    x2.fillStyle = '#c9b38b'; x2.font = 'bold 40px sans-serif'; x2.textAlign = 'center'; x2.textBaseline = 'middle';
    x2.fillText(text, 32, 34);
    const m = new THREE.Mesh(new THREE.PlaneGeometry(0.32, 0.32), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(c), transparent: true }));
    m.rotation.x = -Math.PI / 2; m.position.set(x, -0.04, z);
    boardScene.add(m);
    return m;
  };
  for (let i = 0; i < 8; i++) { lbl('abcdefgh'[i], i - 3.5, 4.25); lbl(String(i + 1), -4.25, 3.5 - i); }
}

// markers
const markGroup = new THREE.Group();
boardScene.add(markGroup);
const markMats = {
  sel: new THREE.MeshBasicMaterial({ color: 0x59c3ff, transparent: true, opacity: 0.55 }),
  move: new THREE.MeshBasicMaterial({ color: 0x8cf08c, transparent: true, opacity: 0.8 }),
  cap: new THREE.MeshBasicMaterial({ color: 0xff5a4e, transparent: true, opacity: 0.85 }),
  last: new THREE.MeshBasicMaterial({ color: 0xffd25a, transparent: true, opacity: 0.35 }),
  check: new THREE.MeshBasicMaterial({ color: 0xff2020, transparent: true, opacity: 0.5 }),
};
const flat = new THREE.PlaneGeometry(0.96, 0.96);
const dot = new THREE.CircleGeometry(0.14, 20);
const ringGeo = new THREE.RingGeometry(0.36, 0.46, 32);

let pieceMeshes = new Map(); // square -> mesh
let boardSide = 'w';
let camAngle = 0, camAngleGoal = 0;

export function setBoardSide(c) {
  boardSide = c;
  camAngleGoal = c === 'w' ? 0 : Math.PI;
  camAngle = camAngleGoal;
}

// Rebuilds pieces from a chess state. `anim` = {from, to} slides that piece in.
export function syncBoard(state, anim) {
  const want = new Map();
  for (let s = 0; s < 64; s++) if (state.board[s]) want.set(s, state.board[s]);
  const old = pieceMeshes;
  pieceMeshes = new Map();
  for (const [s, p] of want) {
    let mesh = null;
    if (anim && anim.to === s && old.get(anim.from)?.userData.piece === p) {
      mesh = old.get(anim.from); old.delete(anim.from);
      mesh.userData.slideFrom = mesh.position.clone();
      mesh.userData.slideT = 0;
    } else if (old.get(s)?.userData.piece === p) {
      mesh = old.get(s); old.delete(s);
    } else {
      mesh = pieceModel(typeOf(p), colorOf(p), HEIGHTS[typeOf(p)] * 0.95);
      mesh.userData.piece = p;
      mesh.position.copy(sqPos(s));
      // pieces face the enemy
      mesh.rotation.y = colorOf(p) === 'w' ? 0 : Math.PI;
      boardScene.add(mesh);
    }
    mesh.userData.target = sqPos(s);
    pieceMeshes.set(s, mesh);
  }
  for (const m of old.values()) boardScene.remove(m);
}

export function setMarks({ selected = -1, moves = [], last = null, check = -1 } = {}) {
  markGroup.clear();
  const put = (geo, mat, s, y = 0.005) => {
    const m = new THREE.Mesh(geo, mat);
    m.rotation.x = -Math.PI / 2;
    m.position.copy(sqPos(s)); m.position.y = y;
    markGroup.add(m);
  };
  if (last) { put(flat, markMats.last, last.from); put(flat, markMats.last, last.to); }
  if (check >= 0) put(flat, markMats.check, check, 0.007);
  if (selected >= 0) put(flat, markMats.sel, selected, 0.008);
  const seen = new Set();
  for (const m of moves) {
    if (seen.has(m.to)) continue;
    seen.add(m.to);
    if (m.captured) put(ringGeo, markMats.cap, m.to, 0.01); else put(dot, markMats.move, m.to, 0.01);
  }
}

const raycaster = new THREE.Raycaster();
export function pickSquare(clientX, clientY) {
  const r = canvas.getBoundingClientRect();
  const ndc = new THREE.Vector2(((clientX - r.left) / r.width) * 2 - 1, -((clientY - r.top) / r.height) * 2 + 1);
  raycaster.setFromCamera(ndc, boardCam);
  const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  const p = new THREE.Vector3();
  if (!raycaster.ray.intersectPlane(plane, p)) return -1;
  const f = Math.floor(p.x + 4), r8 = Math.floor(4 - p.z);
  return f >= 0 && f < 8 && r8 >= 0 && r8 < 8 ? sq(f, r8) : -1;
}

export function rotateBoardView(delta) { camAngleGoal += delta; }

function updateBoard(dt) {
  camAngle += (camAngleGoal - camAngle) * Math.min(1, dt * 6);
  const aspect = boardCam.aspect;
  const dist = aspect > 1.3 ? 8.6 : 11.5;
  const h = aspect > 1.3 ? 8.8 : 11;
  boardCam.position.set(Math.sin(camAngle) * dist, h, Math.cos(camAngle) * dist);
  boardCam.lookAt(0, -0.6, Math.cos(camAngle) * 0.4);
  for (const m of pieceMeshes.values()) {
    const u = m.userData;
    if (u.slideFrom) {
      u.slideT = Math.min(1, u.slideT + dt * 3);
      const k = u.slideT < 0.5 ? 2 * u.slideT * u.slideT : 1 - (-2 * u.slideT + 2) ** 2 / 2;
      m.position.lerpVectors(u.slideFrom, u.target, k);
      m.position.y = Math.sin(k * Math.PI) * (u.piece.toLowerCase() === 'n' ? 0.8 : 0.25);
      if (u.slideT >= 1) u.slideFrom = null;
    } else {
      m.position.lerp(u.target, Math.min(1, dt * 10));
    }
  }
}

// ---------- duel scene ----------
const duelScene = new THREE.Scene();
const duelCam = new THREE.PerspectiveCamera(75, 1, 0.05, 200);
duelCam.rotation.order = 'YXZ';
duelScene.add(duelCam);
let arenaGroup = null, oppMesh = null, myFighter = null, oppFighter = null;
const fx = [];
let viewGun = null, viewKick = 0, flashLight = null;

function arenaTexture(light) {
  const c = document.createElement('canvas'); c.width = c.height = 256;
  const x = c.getContext('2d');
  const a = light ? '#d9c8a5' : '#4d3e33', b = light ? '#c4b08a' : '#3d3129';
  for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) { x.fillStyle = (i + j) % 2 ? a : b; x.fillRect(i * 64, j * 64, 64, 64); }
  x.strokeStyle = 'rgba(0,0,0,.15)'; x.lineWidth = 2;
  for (let i = 0; i <= 4; i++) { x.beginPath(); x.moveTo(i * 64, 0); x.lineTo(i * 64, 256); x.moveTo(0, i * 64); x.lineTo(256, i * 64); x.stroke(); }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function makeViewGun(weapon, color) {
  const g = new THREE.Group();
  const dark = new THREE.MeshStandardMaterial({ color: 0x2a2d35, metalness: 0.6, roughness: 0.4 });
  const m = mats(color);
  const long = weapon.zoom ? 0.75 : weapon.pellets > 1 ? 0.55 : weapon.rocket ? 0.6 : weapon.rate < 0.2 ? 0.5 : 0.38;
  const thick = weapon.rocket ? 0.12 : weapon.pellets > 1 ? 0.09 : 0.07;
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.11, long * 0.6), m.body);
  body.position.z = -long * 0.2;
  const barrel = new THREE.Mesh(weapon.rocket ? new THREE.CylinderGeometry(thick, thick, long, 14) : new THREE.BoxGeometry(thick, thick, long), dark);
  if (weapon.rocket) barrel.rotation.x = Math.PI / 2;
  barrel.position.set(0, 0.03, -long * 0.55);
  const grip = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.14, 0.07), dark);
  grip.position.set(0, -0.1, 0.02); grip.rotation.x = 0.3;
  const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.095, 0.02, long * 0.5), m.glow);
  stripe.position.set(0, 0.06, -long * 0.25);
  g.add(body, barrel, grip, stripe);
  if (weapon.zoom) {
    const scope = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.22, 10), dark);
    scope.rotation.x = Math.PI / 2; scope.position.set(0, 0.11, -0.2);
    g.add(scope);
  }
  g.userData.muzzle = new THREE.Vector3(0, 0.03, -long * 1.05);
  return g;
}

export function startDuelScene(arena, me, opp, myColor, oppColor) {
  if (arenaGroup) duelScene.remove(arenaGroup);
  arenaGroup = new THREE.Group();
  duelScene.add(arenaGroup);
  const light = arena.kind === 'light';
  duelScene.background = new THREE.Color(light ? 0x9fc4e8 : 0x10131f);
  duelScene.fog = new THREE.Fog(duelScene.background, 25, 70);
  arenaGroup.add(new THREE.HemisphereLight(light ? 0xdfefff : 0x8090c0, light ? 0x806a50 : 0x201820, light ? 1.4 : 0.9));
  const sun = new THREE.DirectionalLight(light ? 0xfff2dc : 0xa8b8ff, light ? 2.3 : 1.2);
  sun.position.set(8, 18, 6);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  Object.assign(sun.shadow.camera, { left: -20, right: 20, top: 20, bottom: -20, near: 1, far: 50 });
  arenaGroup.add(sun);
  const tex = arenaTexture(light);
  tex.repeat.set(arena.w / 4, arena.d / 4);
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(arena.w, arena.d), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.75 }));
  floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true;
  arenaGroup.add(floor);
  const wallMat = new THREE.MeshStandardMaterial({ color: light ? 0xb9a27c : 0x2c2a3a, roughness: 0.8 });
  const blockMat = new THREE.MeshStandardMaterial({ color: light ? 0xe9dfc8 : 0x3e3a52, roughness: 0.55 });
  const lowMat = new THREE.MeshStandardMaterial({ color: light ? 0x8c6b4c : 0x6a3b44, roughness: 0.6 });
  const edgeMat = mats(light ? 'w' : 'b').glow;
  for (const b of arena.boxes) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(b.w, b.h, b.d), b.wall ? wallMat : b.h < 2 ? lowMat : blockMat);
    mesh.position.set(b.x, b.h / 2, b.z);
    mesh.castShadow = !b.wall; mesh.receiveShadow = true;
    arenaGroup.add(mesh);
    if (!b.wall) {
      const edge = new THREE.Mesh(new THREE.BoxGeometry(b.w + 0.04, 0.06, b.d + 0.04), edgeMat);
      edge.position.set(b.x, b.h, b.z);
      arenaGroup.add(edge);
    }
  }
  // giant chess pieces outside the walls for scenery
  for (let i = 0; i < 10; i++) {
    const t = 'prnbqk'[i % 6];
    const side = i % 2 ? 1 : -1;
    const m = pieceModel(t, i % 3 ? 'w' : 'b', 9 + (i % 3) * 3);
    m.position.set(side * (arena.w / 2 + 7 + (i % 3) * 3), 0, -arena.d / 2 + (i / 10) * arena.d * 1.1);
    arenaGroup.add(m);
  }
  oppMesh = pieceModel(opp.type, oppColor, opp.height, true);
  arenaGroup.add(oppMesh);
  myFighter = me; oppFighter = opp;
  if (viewGun) duelCam.remove(viewGun);
  viewGun = makeViewGun(me.weapon, myColor);
  viewGun.position.set(0.22, -0.2, -0.35);
  duelCam.add(viewGun);
  flashLight = new THREE.PointLight(0xffc070, 0, 6);
  viewGun.add(flashLight);
  flashLight.position.copy(viewGun.userData.muzzle);
  fx.length = 0;
}

export function endDuelScene() {
  if (arenaGroup) duelScene.remove(arenaGroup);
  arenaGroup = null;
  for (const e of fx) duelScene.remove(e.obj);
  fx.length = 0;
}

const tracerMat = new THREE.LineBasicMaterial({ color: 0xffe9a0, transparent: true });
export function addTracer(from, to, mine) {
  const geo = new THREE.BufferGeometry().setFromPoints([
    mine && viewGun ? viewGun.localToWorld(viewGun.userData.muzzle.clone()) : new THREE.Vector3(from.x, from.y - 0.15, from.z),
    new THREE.Vector3(to.x, to.y, to.z),
  ]);
  const line = new THREE.Line(geo, tracerMat.clone());
  duelScene.add(line);
  fx.push({ obj: line, life: 0.12, max: 0.12, kind: 'tracer' });
  const spark = new THREE.Mesh(new THREE.SphereGeometry(0.06, 6, 4), new THREE.MeshBasicMaterial({ color: 0xffd080, transparent: true }));
  spark.position.set(to.x, to.y, to.z);
  duelScene.add(spark);
  fx.push({ obj: spark, life: 0.2, max: 0.2, kind: 'spark' });
}

export function muzzleFlash() {
  viewKick = 1;
  if (flashLight) flashLight.intensity = 6;
}

export function addExplosion(p, radius) {
  const m = new THREE.Mesh(new THREE.SphereGeometry(1, 16, 12), new THREE.MeshBasicMaterial({ color: 0xffa040, transparent: true, opacity: 0.9 }));
  m.position.set(p.x, p.y, p.z);
  duelScene.add(m);
  fx.push({ obj: m, life: 0.45, max: 0.45, kind: 'boom', radius });
}

const rocketMeshes = new Map();
const rocketGeo = new THREE.SphereGeometry(0.16, 10, 8);
const rocketMat = new THREE.MeshBasicMaterial({ color: 0xffb050 });
export function syncRockets(list) {
  const seen = new Set();
  for (const rk of list) {
    seen.add(rk);
    let m = rocketMeshes.get(rk);
    if (!m) { m = new THREE.Mesh(rocketGeo, rocketMat); duelScene.add(m); rocketMeshes.set(rk, m); }
    m.position.set(rk.x, rk.y, rk.z);
  }
  for (const [rk, m] of rocketMeshes) if (!seen.has(rk)) { duelScene.remove(m); rocketMeshes.delete(rk); }
}

export function setZoom(on) {
  duelCam.fov = on ? 30 : 75;
  duelCam.updateProjectionMatrix();
  if (viewGun) viewGun.visible = !on;
}

function updateDuel(dt) {
  if (!myFighter) return;
  duelCam.position.set(myFighter.x, eyeHeight(myFighter), myFighter.z);
  duelCam.rotation.set(myFighter.pitch, myFighter.yaw, 0);
  if (viewGun) {
    viewKick = Math.max(0, viewKick - dt * 8);
    const moving = Math.hypot(myFighter.vx, myFighter.vz) > 0.5;
    const tt = performance.now() / 1000;
    const bob = moving ? Math.sin(tt * 9) * 0.012 : 0;
    viewGun.position.set(0.22 + (moving ? Math.cos(tt * 4.5) * 0.008 : 0), -0.2 + bob - (myFighter.reloading > 0 ? 0.12 : 0), -0.35 + viewKick * 0.06);
    viewGun.rotation.x = viewKick * 0.15 + (myFighter.reloading > 0 ? -0.5 : 0);
    if (flashLight) flashLight.intensity = Math.max(0, flashLight.intensity - dt * 60);
  }
  if (oppMesh && oppFighter) {
    oppMesh.visible = oppFighter.hp > 0 || oppMesh.userData.fall < 1;
    oppMesh.position.set(oppFighter.x, 0, oppFighter.z);
    oppMesh.rotation.y = oppFighter.yaw;
    if (oppFighter.hp <= 0) {
      oppMesh.userData.fall = Math.min(1, (oppMesh.userData.fall || 0) + dt * 2);
      oppMesh.rotation.x = -oppMesh.userData.fall * Math.PI / 2;
    } else { oppMesh.userData.fall = 0; oppMesh.rotation.x = 0; }
    const gun = oppMesh.userData.gun;
    if (gun) gun.rotation.x = oppFighter.pitch;
  }
  for (let i = fx.length - 1; i >= 0; i--) {
    const e = fx[i];
    e.life -= dt;
    const k = Math.max(0, e.life / e.max);
    if (e.kind === 'boom') { e.obj.scale.setScalar(e.radius * (1.1 - k * 0.8)); e.obj.material.opacity = k * 0.9; }
    else e.obj.material.opacity = k;
    if (e.life <= 0) { duelScene.remove(e.obj); e.obj.geometry.dispose(); fx.splice(i, 1); }
  }
}

// screen position of the opponent for the HUD (null when behind the camera)
export function oppScreenPos() {
  if (!oppFighter || !oppMesh) return null;
  const v = new THREE.Vector3(oppFighter.x, oppFighter.height + 0.35, oppFighter.z).project(duelCam);
  if (v.z > 1) return null;
  return { x: (v.x + 1) / 2, y: (1 - v.y) / 2 };
}

// ---------- frame ----------
let mode = 'board';
export const setMode = (m) => { mode = m; };
function resize() {
  const w = window.innerWidth, h = window.innerHeight;
  renderer.setSize(w, h, false);
  for (const c of [boardCam, duelCam]) { c.aspect = w / h; c.updateProjectionMatrix(); }
}
window.addEventListener('resize', resize);
resize();

export function frame(dt) {
  if (mode === 'duel') { updateDuel(dt); renderer.render(duelScene, duelCam); }
  else { updateBoard(dt); renderer.render(boardScene, boardCam); }
}
