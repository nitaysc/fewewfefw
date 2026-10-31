// Round, soft 3D cats in every coat: they walk, sit, groom, hop for joy and curl up to sleep.
import { THREE, ball, cone, capsule, rot } from './kit.js';
import { COATS } from '../art/cats.js';

export function makeCat(coat = 'cream', collar = 'none') {
  const K = COATS[coat] || COATS.cream;
  const root = new THREE.Group();
  const body = new THREE.Group(); root.add(body);
  const torso = new THREE.Group(); torso.position.set(0, 0.16, 0); body.add(torso);
  torso.add(ball(0.12, K.b, 0, 0, 0, 0.9, 0.85, 1.45, { rough: 0.9 }, 20));
  torso.add(ball(0.1, K.l, 0, -0.03, 0.06, 0.8, 0.7, 1.1, { rough: 0.9 }));
  // coat markings
  if (coat === 'calico') { torso.add(ball(0.07, K.p, 0.05, 0.06, -0.06, 1, 0.6, 1.2, { rough: 0.9 }), ball(0.06, '#3a3236', -0.06, 0.07, 0.08, 1, 0.5, 1, { rough: 0.9 })); }
  if (coat === 'tabby' || coat === 'orange') for (let i = 0; i < 4; i++) torso.add(rot(ball(0.11, K.s, 0, 0.035, -0.11 + i * 0.07, 0.93, 0.8, 0.12), 0, 0, 0));
  // legs
  const legs = [];
  for (const [x, z] of [[-0.055, 0.1], [0.055, 0.1], [-0.06, -0.1], [0.06, -0.1]]) {
    const l = new THREE.Group(); l.position.set(x, 0.12, z);
    l.add(capsule(0.032, 0.06, K.b, 0, -0.06, 0), ball(0.036, coat === 'tuxedo' || coat === 'siamese' ? (coat === 'tuxedo' ? K.l : K.p) : K.b, 0, -0.105, 0.01, 1, 0.6, 1.2));
    body.add(l); legs.push(l);
  }
  // head
  const head = new THREE.Group(); head.position.set(0, 0.27, 0.17); body.add(head);
  head.add(ball(0.105, K.b, 0, 0, 0, 1.1, 0.95, 1, { rough: 0.9 }, 20));
  head.add(ball(0.06, K.l, 0, -0.035, 0.07, 1.2, 0.75, 0.7, { rough: 0.9 }));
  if (coat === 'siamese') head.add(ball(0.07, K.p, 0, -0.01, 0.06, 1.1, 0.9, 0.7));
  if (coat === 'calico') head.add(ball(0.07, K.p, 0.05, 0.05, 0.01, 0.9, 0.7, 0.9));
  for (const s of [-1, 1]) {
    const ear = cone(0.045, 0.08, coat === 'siamese' ? K.p : (coat === 'calico' && s > 0 ? K.p : K.b), s * 0.06, 0.09, -0.01, 4);
    ear.rotation.set(-0.1, 0, -s * 0.3); head.add(ear);
    head.add(rot(cone(0.025, 0.05, '#f0a8b0', s * 0.059, 0.085, 0.005, 4), -0.1, 0, -s * 0.3));
  }
  const eyes = [];
  for (const s of [-1, 1]) {
    const e = ball(0.022, K.e, s * 0.045, 0.012, 0.088, 1, 1.15, 0.6, { rough: 0.2 });
    e.add(ball(0.016, '#15100c', 0, 0, 0.012, 0.45, 1, 0.6));
    head.add(e); eyes.push(e);
    head.add(ball(0.007, '#ffffff', s * 0.045 + 0.007, 0.022, 0.1, 1, 1, 1, { emissive: '#ffffff', glow: 0.5 }));
  }
  head.add(ball(0.012, K.n, 0, -0.02, 0.112, 1.3, 0.8, 0.8));
  for (const s of [-1, 1]) for (let k = 0; k < 2; k++) { const w = capsule(0.002, 0.07, '#fbf7ef', s * 0.07, -0.03 - k * 0.012, 0.09); w.rotation.set(0, 0, Math.PI / 2 + s * (k ? -0.15 : 0.1)); head.add(w); }
  if (collar && collar !== 'none') {
    const col = { red: '#c8302a', blue: '#3f6fb0', green: '#4f8a4a', pink: '#ef8fae', gold: '#d2a03a', purple: '#7a5c9e' }[collar] || '#c8302a';
    const c = new THREE.Mesh(new THREE.TorusGeometry(0.07, 0.014, 8, 20), new THREE.MeshStandardMaterial({ color: col, roughness: 0.6 }));
    c.position.set(0, 0.22, 0.13); c.rotation.x = Math.PI / 2 - 0.5; body.add(c);
    body.add(ball(0.018, '#e2b54a', 0, 0.17, 0.18, 1, 1, 1, { metal: 0.6, rough: 0.3 }));
  }
  // tail: a chain of beads that sways
  const tail = [];
  let parent = body;
  for (let i = 0; i < 7; i++) {
    const seg = new THREE.Group();
    seg.position.set(0, i ? 0.045 : 0.18, i ? 0 : -0.17);
    const tip = coat === 'siamese' || coat === 'tabby' ? (i > 4 ? K.p : K.b) : coat === 'tuxedo' && i === 6 ? K.l : K.b;
    seg.add(ball(0.028 - i * 0.0015, tip, 0, 0.022, 0));
    parent.add(seg); parent = seg; tail.push(seg);
  }
  root.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  return { root, body, torso, legs, head, eyes, tail, heading: 0, coat, collar };
}

// state: walk, sit, sleep, groom, happy, perch, idle
export function poseCat(rig, state, t, phase = 0) {
  const { body, torso, legs, head, eyes, tail } = rig;
  const tt = t + phase;
  body.position.set(0, 0, 0); body.rotation.set(0, 0, 0); body.scale.set(1, 1, 1);
  torso.rotation.set(0, 0, 0); torso.position.set(0, 0.16, 0);
  head.position.set(0, 0.27, 0.17); head.rotation.set(0, 0, 0);
  legs.forEach((l) => { l.rotation.set(0, 0, 0); l.visible = true; l.position.y = 0.12; });
  let blink = (tt % 4.3) < 0.14 ? 0.12 : 1;
  const sway = (amp, up) => tail.forEach((s, i) => { s.rotation.set(i ? -0.25 * up : -0.9 * up, Math.sin(tt * 2 + i * 0.6) * amp, 0); });
  if (state === 'walk') {
    const w = Math.sin(tt * 12);
    legs[0].rotation.x = w * 0.6; legs[3].rotation.x = w * 0.6; legs[1].rotation.x = -w * 0.6; legs[2].rotation.x = -w * 0.6;
    body.position.y = Math.abs(Math.cos(tt * 12)) * 0.012;
    head.rotation.x = Math.sin(tt * 12) * 0.04;
    sway(0.25, 1);
  } else if (state === 'sleep') {
    body.scale.set(1.08, 0.72, 0.85);
    legs.forEach((l) => { l.visible = false; });
    torso.position.y = 0.12;
    head.position.set(0.08, 0.15, 0.13); head.rotation.set(0.35, 0.5, -0.3);
    tail.forEach((s, i) => s.rotation.set(0.2, i ? 0.55 : 1.4, 0));
    body.scale.y = 0.72 + Math.sin(tt * 1.6) * 0.025;
    blink = 0.12;
  } else {
    // sitting upright: front legs straight, hind legs tucked
    torso.rotation.x = -0.75; torso.position.set(0, 0.16, -0.04);
    head.position.set(0, 0.36, 0.08);
    legs[0].position.y = 0.12; legs[1].position.y = 0.12;
    legs[0].rotation.x = -0.15; legs[1].rotation.x = -0.15;
    legs[2].rotation.x = -1.4; legs[3].rotation.x = -1.4; legs[2].position.y = 0.06; legs[3].position.y = 0.06;
    tail.forEach((s, i) => s.rotation.set(i ? 0.15 : 1.3, (i ? 0.4 : 0.9) + Math.sin(tt * 1.3 + i) * 0.05, 0));
    if (state === 'groom') { const k = Math.sin(tt * 5) > 0; head.rotation.set(0.5, 0.4, 0.3); legs[0].rotation.x = k ? -1.6 : -1.3; }
    if (state === 'happy') { body.position.y = Math.abs(Math.sin(tt * 7)) * 0.08; tail.forEach((s, i) => s.rotation.set(i ? -0.08 : -1.2, Math.sin(tt * 8 + i) * 0.15, 0)); head.rotation.z = Math.sin(tt * 3) * 0.15; }
    if (state === 'perch' || state === 'sit' || state === 'idle') head.rotation.y = Math.sin(tt * 0.4) * 0.35;
  }
  eyes.forEach((e) => { e.scale.y = 1.15 * blink; });
}
