// Chibi 3D people: big round heads, soft bodies, simple jointed arms and legs that walk, sit,
// carry trays and sip drinks. Built from a "look" (colours and styles from the character
// screen) or from one of the named characters of the reference art.
import { THREE, mat, rbox, ball, capsule, cyl, cone, torus, rot } from './kit.js';

// the named characters as colours and styles
const PRESETS = {
  barista: { skin: '#f6d7b8', hair: '#5a3a26', style: 'long', shirt: '#f4efe6', pants: '#2b2b30', apron: '#2f2b2a' },
  catear: { skin: '#f6d7b8', hair: '#6b4029', style: 'long', shirt: '#f4efe6', pants: '#2b2b30', apron: '#2f2b2a', ears: true },
  hoodie: { skin: '#eec39a', hair: '#2b1d16', style: 'messy', shirt: '#2f2d33', pants: '#2f3f4a', hood: true },
  pink: { skin: '#f6d7b8', hair: '#ef8fae', style: 'long', shirt: '#d9b48a', pants: '#3b2a20', scarf: '#c9a47a' },
  jacket: { skin: '#eec39a', hair: '#1f241d', style: 'messy', shirt: '#5f7a45', pants: '#3d5a7a' },
  sweater: { skin: '#f6d7b8', hair: '#6b3f24', style: 'long', shirt: '#f4efe6', pants: '#3b2a20', bottom: 'skirt' },
  jacket2: { skin: '#d9a273', hair: '#2b1d16', style: 'short', shirt: '#7a7a40', pants: '#4a3a30' },
  grandpa: { skin: '#f0cfae', hair: '#e2e0da', style: 'short', shirt: '#cbb38a', pants: '#3b3b44', glasses: 'round', beard: true },
  raincoat: { skin: '#f6d7b8', hair: '#6b3f24', style: 'bob', shirt: '#f2c230', pants: '#3d4a6b', shoes: '#b5483c', hood: true },
  student: { skin: '#eec39a', hair: '#3b2418', style: 'messy', shirt: '#5f7a45', pants: '#3d5a5a', glasses: 'square', backpack: '#7a4e30' },
  cap: { skin: '#eec39a', hair: '#5a3a26', style: 'short', shirt: '#f4efe6', pants: '#3d4a6b', apron: '#2f2b2a', hat: 'cap', hatColor: '#a89a80' },
  cap2: { skin: '#f6d7b8', hair: '#2b1d16', style: 'bun', shirt: '#f4efe6', pants: '#2b2b30', apron: '#2f2b2a' },
};
const HAIR_MAP = { short: 'short', buzz: 'short', sidepart: 'short', spiky: 'messy', curly: 'curly', afro: 'curly', bob: 'bob', wavy: 'bob', long: 'long', bun: 'bun', ponytail: 'ponytail', twintails: 'twintails' };

export function resolveLook(look = {}) {
  const base = look.model && PRESETS[look.model] ? PRESETS[look.model] : {};
  const L = { skin: '#f6d7b8', hair: '#5a3a26', style: 'short', shirt: '#6f8fc9', pants: '#2f3f4a', shoes: '#3b2a20', ...pickLook(look), ...base };
  L.style = HAIR_MAP[L.style] || L.style;
  return L;
}
function pickLook(l) {
  const o = {};
  for (const k of ['skin', 'hair', 'shirt', 'pants', 'shoes', 'hat', 'hatColor', 'glasses', 'top', 'bottom', 'eyeColor']) if (l[k]) o[k] = l[k];
  if (l.style) o.style = l.style;
  if (l.apron) o.apron = l.apronColor || '#e8d7b0';
  if (l.top === 'hoodie') o.hood = true;
  if (l.top === 'dress') o.bottom = 'dress';
  return o;
}

const darker = (hex, k = 0.8) => { const c = new THREE.Color(hex); c.multiplyScalar(k); return '#' + c.getHexString(); };

export function makePerson(look) {
  const L = resolveLook(look);
  const root = new THREE.Group();
  const body = new THREE.Group(); root.add(body);
  const HIP = 0.44;

  // legs: thigh pivots at the hip, shin at the knee
  const legs = [];
  for (const s of [-1, 1]) {
    const thigh = new THREE.Group(); thigh.position.set(s * 0.075, HIP, 0);
    thigh.add(capsule(0.062, 0.12, L.pants, 0, -0.1, 0));
    const shin = new THREE.Group(); shin.position.set(0, -0.2, 0);
    shin.add(capsule(0.056, 0.1, L.bottom === 'skirt' || L.bottom === 'dress' ? L.skin : L.pants, 0, -0.09, 0));
    shin.add(rbox(0.11, 0.07, 0.17, L.shoes || '#3b2a20', 0, -0.205, 0.03, 0.03));
    thigh.add(shin); body.add(thigh);
    legs.push({ thigh, shin });
  }
  // torso
  const torso = new THREE.Group(); torso.position.y = HIP; body.add(torso);
  torso.add(rbox(0.36, 0.42, 0.26, L.shirt, 0, 0.2, 0, 0.11));
  if (L.bottom === 'skirt' || L.bottom === 'dress') torso.add(cone(0.24, 0.26, L.bottom === 'dress' ? L.shirt : L.pants, 0, 0.02, 0, 20));
  if (L.apron) { torso.add(rbox(0.3, 0.42, 0.03, L.apron, 0, 0.12, 0.13, 0.03)); torso.add(rbox(0.12, 0.06, 0.01, darker(L.apron, 1.4), 0, 0.12, 0.148, 0.01)); }
  if (L.scarf) torso.add(rot(torus(0.13, 0.05, L.scarf, 0, 0.42, 0), Math.PI / 2));
  if (L.hood) torso.add(rot(torus(0.12, 0.06, L.shirt, 0, 0.42, -0.06), Math.PI / 2 + 0.4));
  if (L.backpack) torso.add(rbox(0.3, 0.34, 0.14, L.backpack, 0, 0.22, -0.19, 0.06), rbox(0.2, 0.1, 0.04, darker(L.backpack), 0, 0.14, -0.27, 0.02));
  // arms: pivot at the shoulder
  const arms = [];
  for (const s of [-1, 1]) {
    const arm = new THREE.Group(); arm.position.set(s * 0.215, HIP + 0.36, 0);
    arm.add(capsule(0.05, 0.16, L.shirt, 0, -0.12, 0));
    arm.add(ball(0.052, L.skin, 0, -0.26, 0));
    torso.parent.add(arm);
    arms.push(arm);
  }
  // head
  const head = new THREE.Group(); head.position.y = HIP + 0.66; body.add(head);
  head.add(ball(0.27, L.skin, 0, 0, 0, 1, 0.94, 0.95, null, 24));
  hair(head, L);
  const eyeCol = L.eyeColor || '#2b1d16';
  const eyes = [];
  for (const s of [-1, 1]) {
    const e = ball(0.034, eyeCol, s * 0.095, -0.015, 0.236, 1, 1.35, 0.5, { rough: 0.3 });
    head.add(e); eyes.push(e);
    head.add(ball(0.011, '#ffffff', s * 0.095 + 0.01, 0.012, 0.252, 1, 1, 0.5, { emissive: '#ffffff', glow: 0.4 }));
    head.add(ball(0.04, '#f0a0a0', s * 0.16, -0.085, 0.2, 1, 0.6, 0.4, { opacity: 0.55 }));
  }
  head.add(ball(0.018, '#8a4a3a', 0, -0.1, 0.245, 1.4, 0.6, 0.5));
  if (L.glasses) for (const s of [-1, 1]) head.add(torus(0.055, 0.008, '#3b2a20', s * 0.095, -0.015, 0.25));
  if (L.beard) head.add(ball(0.17, L.hair, 0, -0.16, 0.12, 1.2, 0.55, 0.6));
  if (L.ears) for (const s of [-1, 1]) { const c = cone(0.07, 0.12, L.hair, s * 0.15, 0.25, 0, 4); c.rotation.z = -s * 0.35; head.add(c); head.add(rot(cone(0.04, 0.07, '#f2b0b8', s * 0.148, 0.24, 0.03, 4), 0, 0, -s * 0.35)); }
  if (L.hat === 'cap') { head.add(ball(0.285, L.hatColor || '#b5483c', 0, 0.06, -0.01, 1, 0.75, 1)); head.add(rbox(0.3, 0.025, 0.2, L.hatColor || '#b5483c', 0, 0.1, 0.23, 0.01)); }
  else if (L.hat === 'beanie') head.add(ball(0.29, L.hatColor || '#4f7ac9', 0, 0.08, -0.01, 1, 0.75, 1));
  else if (L.hat === 'beret') head.add(ball(0.24, L.hatColor || '#b5483c', 0.04, 0.22, 0, 1.15, 0.35, 1.1));
  else if (L.hat === 'bow') head.add(ball(0.05, L.hatColor || '#ef8fae', -0.08, 0.26, 0.05, 1.6, 1, 0.6), ball(0.05, L.hatColor || '#ef8fae', 0.08, 0.26, 0.05, 1.6, 1, 0.6));
  else if (L.hat === 'flower') head.add(ball(0.045, '#ef8fae', 0.17, 0.17, 0.08), ball(0.02, '#f2d27a', 0.18, 0.17, 0.12));
  else if (L.hat === 'headband') head.add(rot(torus(0.25, 0.02, L.hatColor || '#e46a5a', 0, 0.1, 0), 0.3, 0, 0));

  // what the hands hold
  const hold = new THREE.Group(); hold.position.set(0, -0.3, 0.04); arms[1].add(hold);
  root.traverse((o) => { if (o.isMesh) { o.castShadow = true; } });

  const rig = { root, body, legs, arms, head, eyes, hold, holding: null, heading: 0, look: L };
  return rig;
}

function hair(head, L) {
  const c = L.hair, st = L.style;
  // cap of hair over the top and back, then a fringe
  head.add(ball(0.285, c, 0, 0.045, -0.035, 1.02, 0.95, 1.0, { rough: 0.6 }, 24));
  head.add(ball(0.2, c, 0, 0.16, 0.12, 1.25, 0.45, 0.7, { rough: 0.6 }));
  for (const s of [-1, 1]) head.add(ball(0.09, c, s * 0.2, 0.02, 0.1, 0.6, 1.2, 0.8, { rough: 0.6 }));
  if (st === 'long') head.add(rbox(0.5, 0.5, 0.18, c, 0, -0.2, -0.12, 0.09, { rough: 0.6 }));
  if (st === 'bob') head.add(ball(0.3, c, 0, -0.05, -0.04, 1.05, 0.8, 1.0, { rough: 0.6 }));
  if (st === 'bun') head.add(ball(0.1, c, 0, 0.26, -0.14));
  if (st === 'ponytail') head.add(capsule(0.06, 0.18, c, 0, -0.08, -0.29));
  if (st === 'twintails') for (const s of [-1, 1]) head.add(capsule(0.065, 0.16, c, s * 0.3, -0.12, -0.05));
  if (st === 'messy') for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI - Math.PI / 2; head.add(rot(cone(0.06, 0.12, c, Math.sin(a) * 0.18, 0.24, Math.cos(a) * 0.05 - 0.04, 6), -0.3 + Math.cos(a) * 0.3, 0, -Math.sin(a) * 0.6)); }
  if (st === 'curly') for (let i = 0; i < 10; i++) { const a = i / 10 * Math.PI * 2; head.add(ball(0.09, c, Math.cos(a) * 0.24, 0.12 + Math.sin(a * 2) * 0.04, Math.sin(a) * 0.2 - 0.04)); }
}

// what a person holds: a drink, a plate, or nothing
const DRINK_COL = { espresso: '#3b2418', latte: '#c99a6a', cappuccino: '#d9b48a', mocha: '#6b4029', hotchoc: '#5a3622', matcha: '#8fbf5a', tea: '#c98b4a', chai: '#c48a5a', americano: '#3b2418', icedlatte: '#d9b48a', lemonade: '#f2d27a', strawberry: '#ef8fae' };
export function heldThing(kind) {
  const g = new THREE.Group();
  if (!kind) return g;
  if (kind.startsWith('f:')) {
    g.add(cyl(0.09, 0.07, 0.015, '#fbf7ef', 0, 0, 0, 20));
    g.add(rbox(0.08, 0.05, 0.06, '#f6d2d8', 0, 0.035, 0, 0.015), ball(0.015, '#c84a5a', 0, 0.07, 0));
  } else {
    const col = DRINK_COL[kind] || DRINK_COL[Object.keys(DRINK_COL).find((k) => kind.includes(k))] || '#c99a6a';
    g.add(cyl(0.05, 0.04, 0.1, '#fbf7ef', 0, 0.05, 0, 16));
    g.add(cyl(0.044, 0.044, 0.006, col, 0, 0.098, 0, 16));
    g.add(rot(torus(0.025, 0.008, '#fbf7ef', 0.055, 0.055, 0), 0, 0, Math.PI / 2));
  }
  g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  return g;
}

// pose the rig. s: { moving, sitting, seatH, carry, drinking, t, dt, phase }
export function posePerson(rig, s) {
  const { legs, arms, body, head, eyes } = rig;
  const t = s.t + (s.phase || 0);
  // blink now and then
  const blink = (t % 3.7) < 0.12 ? 0.15 : 1;
  eyes.forEach((e) => { e.scale.y = 1.35 * blink; });
  body.position.y = 0;
  head.rotation.set(0, 0, 0);
  if (s.sitting) {
    rig.root.position.y = Math.max(0, s.seatH + 0.05 - 0.44);
    legs.forEach(({ thigh, shin }) => { thigh.rotation.x = -Math.PI / 2 + 0.05; shin.rotation.x = Math.PI / 2 - 0.05; });
    arms.forEach((a, i) => { a.rotation.set(-0.5, 0, (i ? -1 : 1) * 0.15); });
    if (s.drinking) {
      // a sip every few seconds
      const sip = Math.max(0, Math.sin(t * 0.9)) ** 6;
      arms[1].rotation.set(-1.1 - sip * 1.1, 0, -0.35 * (1 - sip) - 0.1);
      head.rotation.x = -sip * 0.15;
    }
  } else if (s.moving) {
    const w = Math.sin(t * 10);
    legs[0].thigh.rotation.x = w * 0.55; legs[1].thigh.rotation.x = -w * 0.55;
    legs[0].shin.rotation.x = Math.max(0, -w) * 0.6; legs[1].shin.rotation.x = Math.max(0, w) * 0.6;
    arms[0].rotation.set(-w * 0.5, 0, 0.08); arms[1].rotation.set(w * 0.5, 0, -0.08);
    body.position.y = Math.abs(Math.cos(t * 10)) * 0.035;
  } else {
    legs.forEach(({ thigh, shin }) => { thigh.rotation.x = 0; shin.rotation.x = 0; });
    const br = Math.sin(t * 2) * 0.03;
    arms[0].rotation.set(br, 0, 0.1); arms[1].rotation.set(-br, 0, -0.1);
    head.rotation.z = Math.sin(t * 0.7) * 0.04;
  }
  if (!s.sitting) rig.root.position.y = 0;
  // carrying something: hold it out in front
  if (s.carry) { arms[1].rotation.set(-1.25, 0, -0.15); if (!s.moving) arms[0].rotation.set(-0.2, 0, 0.1); }
  const want = s.carry || (s.drinking ? s.drinkId : null) || null;
  if (want !== rig.holding) {
    rig.hold.clear();
    if (want) { const h = heldThing(want); h.rotation.x = s.carry ? 1.25 : 1.1; rig.hold.add(h); }
    rig.holding = want;
  }
  if (rig.hold.children[0]) rig.hold.children[0].rotation.x = -arms[1].rotation.x;
}
