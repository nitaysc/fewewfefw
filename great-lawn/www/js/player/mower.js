// The mower: a 1950s-style ride-on in racing green and cream with brass and chrome,
// built from lofts, lathes and tubes. Moving parts (wheels, steering wheel, levers,
// gauge needles, the exhaust flap) are kept as separate objects so they can animate.
import * as THREE from '../../vendor/three.module.js';
import { RoundedBoxGeometry } from '../../vendor/RoundedBoxGeometry.js';
import { Kit, M4, lathe, loftSmooth, superellipse, merge } from '../core/geo.js';
import { tex, pbr, canvasTexture } from '../core/textures.js';
import { DIM } from './vehicle.js';

// ------------------------------------------------------------------ materials
export function mowerMaterials() {
  const paint = new THREE.MeshPhysicalMaterial({ color: '#0e3a25', roughness: 0.42, metalness: 0.0, clearcoat: 1, clearcoatRoughness: 0.045, envMapIntensity: 1.0 });
  const cream = new THREE.MeshPhysicalMaterial({ color: '#e6dcc2', roughness: 0.45, clearcoat: 0.9, clearcoatRoughness: 0.08 });
  const chrome = new THREE.MeshStandardMaterial({ color: '#f4f4f2', roughness: 0.07, metalness: 1 });
  const brass = new THREE.MeshStandardMaterial({ color: '#d9ab55', roughness: 0.2, metalness: 1 });
  const steel = new THREE.MeshStandardMaterial({ color: '#4a4c4e', roughness: 0.55, metalness: 0.85 });
  const rubber = new THREE.MeshStandardMaterial({ color: '#141312', roughness: 0.92, metalness: 0 });
  const blackPaint = new THREE.MeshStandardMaterial({ color: '#0d0e0d', roughness: 0.6, metalness: 0.2 });
  const wood = pbr('wood', { nor: false, physical: true, clearcoat: 0.8, clearcoatRoughness: 0.12, roughness: 0.6, repeat: [6, 1] });
  const leather = pbr('leather', { repeat: [2, 2], roughness: 1, color: '#c89a6a' });
  const glass = new THREE.MeshPhysicalMaterial({ color: '#ffffff', roughness: 0.02, metalness: 0, transmission: 0, transparent: true, opacity: 0.12, envMapIntensity: 1.6 });
  const grilleDark = new THREE.MeshStandardMaterial({ color: '#070807', roughness: 0.8, metalness: 0.3 });
  const knobRed = new THREE.MeshPhysicalMaterial({ color: '#8f1414', roughness: 0.2, clearcoat: 1, clearcoatRoughness: 0.05 });
  const knobBlack = new THREE.MeshPhysicalMaterial({ color: '#0b0b0b', roughness: 0.25, clearcoat: 1, clearcoatRoughness: 0.05 });
  const deckPaint = new THREE.MeshStandardMaterial({ color: '#173b27', roughness: 0.6, metalness: 0.2 });
  const lens = new THREE.MeshPhysicalMaterial({ color: '#fff6e0', roughness: 0.05, metalness: 0, emissive: '#000000', clearcoat: 1 });
  return { paint, cream, chrome, brass, steel, rubber, blackPaint, wood, leather, glass, grilleDark, knobRed, knobBlack, deckPaint, lens };
}

// ------------------------------------------------------------------ gauge faces
function gaugeFace(kind) {
  return canvasTexture(256, 256, (ctx, w) => {
    const c = w / 2;
    const g = ctx.createRadialGradient(c, c * 0.8, 10, c, c, c);
    g.addColorStop(0, '#f6efdc'); g.addColorStop(1, '#ddd0ae');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(c, c, c, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#2a2118'; ctx.fillStyle = '#2a2118';
    const a0 = Math.PI * 0.75, a1 = Math.PI * 2.25;
    const ticks = kind === 'rpm' ? 40 : kind === 'oil' ? 30 : 8;
    for (let i = 0; i <= ticks; i++) {
      const a = a0 + (a1 - a0) * i / ticks;
      const major = kind === 'rpm' ? i % 5 === 0 : kind === 'oil' ? i % 5 === 0 : i % 2 === 0;
      const r0 = c * (major ? 0.7 : 0.78), r1 = c * 0.88;
      ctx.lineWidth = major ? 4 : 2;
      ctx.beginPath(); ctx.moveTo(c + Math.cos(a) * r0, c + Math.sin(a) * r0); ctx.lineTo(c + Math.cos(a) * r1, c + Math.sin(a) * r1); ctx.stroke();
      if (major && kind !== 'fuel') {
        const v = kind === 'rpm' ? i / 5 : i * 2;
        ctx.font = '600 26px Georgia, serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(String(v), c + Math.cos(a) * c * 0.54, c + Math.sin(a) * c * 0.54);
      }
    }
    if (kind === 'rpm') {
      ctx.strokeStyle = '#9b1c14'; ctx.lineWidth = 7;
      ctx.beginPath(); ctx.arc(c, c, c * 0.84, a0 + (a1 - a0) * 0.82, a1); ctx.stroke();
    }
    ctx.font = 'italic 600 22px Georgia, serif'; ctx.textAlign = 'center'; ctx.fillStyle = '#3a2d1d';
    const label = kind === 'rpm' ? 'R.P.M. × 1000' : kind === 'oil' ? 'OIL  lb/in²' : 'FUEL';
    ctx.fillText(label, c, c * 1.42);
    if (kind === 'fuel') { ctx.font = '600 28px Georgia, serif'; ctx.fillText('E', c - c * 0.55, c + c * 0.42); ctx.fillText('F', c + c * 0.55, c + c * 0.42); }
    ctx.font = '600 15px Georgia, serif'; ctx.fillText('HOLLINGMERE', c, c * 0.62);
  });
}

function makerPlate() {
  return canvasTexture(512, 128, (ctx, w, h) => {
    const g = ctx.createLinearGradient(0, 0, w, h);
    g.addColorStop(0, '#caa255'); g.addColorStop(0.5, '#f0d48e'); g.addColorStop(1, '#b88f43');
    ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = '#5a4520'; ctx.lineWidth = 6; ctx.strokeRect(8, 8, w - 16, h - 16);
    ctx.fillStyle = '#3d2c12'; ctx.textAlign = 'center';
    ctx.font = '700 40px Georgia, serif'; ctx.fillText('HOLLINGMERE & SONS', w / 2, 62);
    ctx.font = 'italic 24px Georgia, serif'; ctx.fillText('Garden Tractor · No. 7 · Wiltshire', w / 2, 100);
  });
}

// ------------------------------------------------------------------ parts
function hoodSections() {
  // back (z=-0.40) to front (z=-1.30); boxy-rounded superellipse sections with a crowned top
  const secs = [];
  const N = 48;
  const steps = 18;
  for (let k = 0; k <= steps; k++) {
    const u = k / steps;
    const z = -0.40 - u * 0.9;
    const hw = 0.305 - 0.035 * u * u;
    const top = 0.875 - 0.06 * u - 0.03 * Math.pow(u, 6);
    const bot = 0.42;
    const cy = (top + bot) / 2, hb = (top - bot) / 2;
    const pts = [];
    for (let i = 0; i < N; i++) {
      const t = (i / N) * Math.PI * 2;
      const [x, y] = superellipse(hw, hb, 3.4, t);
      pts.push([x, cy + y + (y > 0 ? 0.012 * (1 - (x / hw) ** 2) : 0)]);
    }
    secs.push({ z, pts });
  }
  return secs;
}

function tyre(r, w, lugs, rInner) {
  const prof = [[rInner, -w / 2], [r - 0.03, -w / 2], [r - 0.008, -w / 2 + 0.012], [r, -w / 2 + 0.03], [r, w / 2 - 0.03], [r - 0.008, w / 2 - 0.012], [r - 0.03, w / 2], [rInner, w / 2]];
  const parts = [lathe(prof, 48)];
  if (lugs) {
    const n = Math.round(r * 75);
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      for (const side of [-1, 1]) {
        const lug = new THREE.BoxGeometry(0.028, 0.02, w * 0.42);
        lug.applyMatrix4(M4.c(M4.ry(a), M4.t(r + 0.006, 0, side * w * 0.22), M4.ry(side * 0.45)));
        parts.push(lug);
      }
    }
  } else {
    for (const o of [-0.35, 0, 0.35]) parts.push(new THREE.TorusGeometry(r + 0.001, 0.006, 6, 48).applyMatrix4(M4.c(M4.rx(Math.PI / 2), M4.t(0, 0, o * w))));
  }
  const g = merge(parts);
  g.rotateZ(Math.PI / 2); // axle along X
  return g;
}

function hubDisc(r) {
  const g = lathe([[0.001, 0.0], [r * 0.25, 0.012], [r * 0.6, 0.02], [r * 0.95, 0.008], [r, -0.01]], 40);
  g.rotateZ(-Math.PI / 2);
  return g;
}

// A vintage sports wheel: a lacquered wooden rim with finger grips riveted to three slotted,
// polished alloy spokes, dished towards a horn push with an enamelled badge.
function badgeTexture() {
  return canvasTexture(256, 256, (ctx, w) => {
    const c = w / 2;
    const g = ctx.createRadialGradient(c, c * 0.8, 10, c, c, c);
    g.addColorStop(0, '#1f4a32'); g.addColorStop(1, '#0d2418');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(c, c, c, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#d9b25e'; ctx.lineWidth = 10; ctx.beginPath(); ctx.arc(c, c, c - 8, 0, Math.PI * 2); ctx.stroke();
    ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(c, c, c - 26, 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = '#e9c873'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.font = 'italic 700 120px Georgia, serif'; ctx.fillText('H', c, c + 6);
    ctx.font = '600 20px Georgia, serif';
    ctx.fillText('HOLLINGMERE', c, c - 82);
  });
}
function buildSteeringWheel(parent, M, RIM) {
  // rim: elliptical tube, grips moulded into the back where the fingers wrap
  const NU = 180, NV = 20, a = 0.0128, b = 0.0148;
  const pos = [], nor = [], uv = [], idx = [];
  const p = new THREE.Vector3(), q = new THREE.Vector3();
  const at = (u, v, out) => {
    const cu = Math.cos(u), su = Math.sin(u), cv = Math.cos(v), sv = Math.sin(v);
    const back = Math.max(0, -sv) * Math.max(0, 0.4 - cv * 0.6);
    const grip = 1 + 0.16 * back * Math.pow(0.5 + 0.5 * Math.cos(u * 36), 3);
    const rr = RIM + a * cv * grip;
    return out.set(cu * rr, b * sv * grip, su * rr);
  };
  for (let i = 0; i <= NU; i++) for (let j = 0; j <= NV; j++) {
    const u = (i / NU) * Math.PI * 2, v = (j / NV) * Math.PI * 2;
    at(u, v, p);
    const e = 1e-3;
    const du = at(u + e, v, new THREE.Vector3()).sub(at(u - e, v, q));
    const dv = at(u, v + e, new THREE.Vector3()).sub(at(u, v - e, q));
    const n = new THREE.Vector3().crossVectors(dv, du).normalize();
    pos.push(p.x, p.y, p.z); nor.push(n.x, n.y, n.z); uv.push((i / NU) * 9, j / NV);
  }
  for (let i = 0; i < NU; i++) for (let j = 0; j < NV; j++) {
    const k = i * (NV + 1) + j, k2 = k + NV + 1;
    idx.push(k, k + 1, k2, k + 1, k2 + 1, k2);
  }
  const rg = new THREE.BufferGeometry();
  rg.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  rg.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  rg.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  rg.setIndex(idx);
  const rim = new THREE.Mesh(rg, M.wood);
  rim.castShadow = true; rim.receiveShadow = true;
  parent.add(rim);
  // spokes: slotted alloy bars dished below the rim
  const alloy = new THREE.MeshStandardMaterial({ color: '#d9dbdd', metalness: 1, roughness: 0.16 });
  const kit = new Kit();
  const r0 = 0.036, r1 = RIM - 0.004, dish = 0.026;
  const shape = new THREE.Shape();
  const w0 = 0.017, w1 = 0.011;
  shape.moveTo(r0, -w0); shape.lineTo(r1, -w1); shape.quadraticCurveTo(r1 + 0.008, 0, r1, w1); shape.lineTo(r0, w0); shape.closePath();
  for (let k = 0; k < 3; k++) {
    const x0 = r0 + 0.022 + k * 0.042, x1 = x0 + 0.028, hw = 0.0042 - k * 0.0005;
    const hole = new THREE.Path();
    hole.absarc(x0, 0, hw, Math.PI / 2, Math.PI * 1.5, false);
    hole.lineTo(x1, -hw); hole.absarc(x1, 0, hw, -Math.PI / 2, Math.PI / 2, false); hole.lineTo(x0, hw);
    shape.holes.push(hole);
  }
  const spoke = new THREE.ExtrudeGeometry(shape, { depth: 0.0032, bevelEnabled: true, bevelThickness: 0.0007, bevelSize: 0.0007, bevelSegments: 2, curveSegments: 10 });
  spoke.rotateX(Math.PI / 2);                          // lie flat in the wheel plane, along +x
  const tilt = Math.atan2(dish, r1 - r0);
  spoke.applyMatrix4(new THREE.Matrix4().makeRotationZ(tilt)); // dish: hub end lower
  spoke.translate(0, -dish - 0.004, 0);
  const rivet = new THREE.SphereGeometry(0.0028, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2);
  for (const ang of [0, Math.PI, -Math.PI / 2]) {
    // 3 o'clock, 9 o'clock and 6 o'clock (towards the driver's lap)
    const m = new THREE.Matrix4().makeRotationY(ang);
    kit.add(alloy, spoke.clone().applyMatrix4(m));
    for (const s of [-0.0065, 0.0065]) kit.add(M.chrome, rivet.clone().translate(r1 - 0.006, b * 0.92, s).applyMatrix4(m));
  }
  // hub and horn push
  kit.add(alloy, lathe([[0, -0.05], [0.04, -0.05], [0.042, -0.035], [0.038, -0.022], [0.03, -0.018], [0, -0.018]], 32));
  kit.add(M.knobBlack, lathe([[0, -0.019], [0.031, -0.019], [0.032, -0.012], [0.028, -0.006], [0.0, -0.004]], 32));
  kit.add(M.brass, new THREE.TorusGeometry(0.0235, 0.0018, 8, 32).rotateX(Math.PI / 2).translate(0, -0.006, 0));
  kit.build(parent);
  const badge = new THREE.Mesh(new THREE.CircleGeometry(0.021, 32).rotateX(-Math.PI / 2), new THREE.MeshPhysicalMaterial({ map: badgeTexture(), roughness: 0.25, clearcoat: 1, clearcoatRoughness: 0.05 }));
  badge.position.y = -0.0045;
  parent.add(badge);
}

export class MowerModel {
  constructor() {
    const M = mowerMaterials();
    this.M = M;
    this.group = new THREE.Group();
    this.group.name = 'mower';
    const kit = new Kit();

    // ---- bonnet ----
    const hood = loftSmooth(hoodSections());
    kit.add(M.paint, hood);
    // cream pinstripe down the crown
    const stripe = [];
    for (let k = 0; k <= 18; k++) {
      const u = k / 18, z = -0.40 - u * 0.9;
      const top = 0.875 - 0.06 * u - 0.03 * Math.pow(u, 6) + 0.012 + 0.0015;
      stripe.push({ z, pts: [[-0.012, top - 0.0006], [0.012, top - 0.0006], [0.012, top - 0.0002], [-0.012, top - 0.0002]] });
    }
    kit.add(M.cream, loftSmooth(stripe));
    // chrome strip along the lower edge of the bonnet sides
    for (const sx of [-1, 1]) {
      const pts = [new THREE.Vector3(sx * 0.304, 0.5, -0.41), new THREE.Vector3(sx * 0.29, 0.5, -0.9), new THREE.Vector3(sx * 0.27, 0.5, -1.28)];
      kit.add(M.chrome, new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 24, 0.006, 6, false));
      // louvres
      for (let i = 0; i < 6; i++) {
        const z = -0.62 - i * 0.075;
        const l = new RoundedBoxGeometry(0.012, 0.016, 0.055, 2, 0.005);
        l.applyMatrix4(M4.c(M4.t(sx * (0.302 - 0.0025 * i), 0.66, z), M4.rx(0.2)));
        kit.add(M.blackPaint, l);
      }
    }
    // ---- grille ----
    const gr = [];
    for (let i = 0; i < 40; i++) {
      const t = (i / 40) * Math.PI * 2;
      const [x, y] = superellipse(0.235, 0.17, 3.4, t);
      gr.push(new THREE.Vector3(x, 0.61 + y, -1.302));
    }
    kit.add(M.chrome, new THREE.TubeGeometry(new THREE.CatmullRomCurve3(gr, true), 80, 0.012, 8, true));
    const hs = hoodSections();
    const nose = new THREE.Shape(hs[hs.length - 1].pts.map(([x, y]) => new THREE.Vector2(x, y)));
    nose.holes.push(new THREE.Path(gr.map((p) => new THREE.Vector2(p.x, p.y)).reverse()));
    const noseG = new THREE.ShapeGeometry(nose, 2);
    noseG.rotateY(Math.PI);
    noseG.translate(0, 0, -1.3);
    kit.add(M.paint, noseG);
    const back = new THREE.ShapeGeometry(new THREE.Shape(gr.map((p) => new THREE.Vector2(p.x, p.y))));
    back.translate(0, 0, -1.292);
    kit.add(M.grilleDark, back);
    for (let i = -6; i <= 6; i++) {
      const x = i * 0.032;
      const hgt = 0.17 * Math.pow(Math.max(0, 1 - Math.pow(Math.abs(x) / 0.235, 3.4)), 1 / 3.4);
      const bar = new THREE.CylinderGeometry(0.004, 0.004, hgt * 2 - 0.01, 6);
      bar.translate(x, 0.61, -1.3);
      kit.add(M.chrome, bar);
    }
    // radiator cap and brass mascot (a leaping hare)
    const cap = lathe([[0.0, 0], [0.026, 0], [0.028, 0.008], [0.022, 0.016], [0.012, 0.022], [0.0, 0.024]], 24);
    cap.translate(0, 0.805, -1.235);
    kit.add(M.brass, cap);
    const hare = [];
    const ell = (x, y, z, rx, ry, rz, rot = 0) => { const s = new THREE.SphereGeometry(1, 14, 10); s.applyMatrix4(M4.c(M4.t(x, y, z), M4.rx(rot), M4.s(rx, ry, rz))); hare.push(s); };
    ell(0, 0.852, -1.24, 0.011, 0.012, 0.03, -0.35);       // body, stretched forward
    ell(0, 0.872, -1.275, 0.009, 0.01, 0.012);             // head
    ell(-0.004, 0.895, -1.265, 0.0025, 0.014, 0.004, 0.5); // ears
    ell(0.004, 0.895, -1.265, 0.0025, 0.014, 0.004, 0.5);
    ell(0, 0.835, -1.205, 0.01, 0.014, 0.018, 0.6);        // haunch
    ell(0, 0.83, -1.25, 0.004, 0.02, 0.005, -0.6);         // fore legs
    ell(0, 0.828, -1.215, 0.004, 0.018, 0.006, 0.9);       // hind legs
    hare.forEach((h) => kit.add(M.brass, h));
    // headlamps on little brackets
    for (const sx of [-1, 1]) {
      const lamp = lathe([[0.0, -0.05], [0.03, -0.045], [0.042, -0.02], [0.045, 0.02], [0.046, 0.03], [0.0, 0.031]], 28);
      lamp.applyMatrix4(M4.c(M4.t(sx * 0.335, 0.7, -1.2), M4.rx(-Math.PI / 2)));
      kit.add(M.chrome, lamp);
      const glassDisc = new THREE.CircleGeometry(0.041, 28);
      glassDisc.applyMatrix4(M4.c(M4.t(sx * 0.335, 0.7, -1.2311), M4.ry(Math.PI)));
      kit.add(M.lens, glassDisc);
      const br = new THREE.CylinderGeometry(0.006, 0.006, 0.09, 6);
      br.applyMatrix4(M4.c(M4.t(sx * 0.31, 0.64, -1.2), M4.rz(sx * 0.9)));
      kit.add(M.chrome, br);
    }
    // fuel filler
    const fuel = lathe([[0, 0], [0.03, 0], [0.032, 0.012], [0.028, 0.02], [0, 0.022]], 24);
    fuel.translate(-0.13, 0.875, -0.52);
    kit.add(M.brass, fuel);

    // ---- dashboard (cream cowl facing the driver) ----
    const dash = new RoundedBoxGeometry(0.62, 0.46, 0.06, 4, 0.025);
    dash.translate(0, 0.66, -0.385);
    kit.add(M.paint, dash);
    const panel = new RoundedBoxGeometry(0.5, 0.15, 0.012, 3, 0.006);
    panel.translate(0, 0.775, -0.352);
    kit.add(M.cream, panel);
    const scuttle = new THREE.CylinderGeometry(0.03, 0.03, 0.6, 16, 1, false, 0, Math.PI);
    scuttle.applyMatrix4(M4.c(M4.t(0, 0.888, -0.385), M4.rz(Math.PI / 2)));
    kit.add(M.paint, scuttle);
    // gauges
    this.needles = [];
    const gauges = [{ x: -0.17, kind: 'oil', r: 0.042 }, { x: 0, kind: 'rpm', r: 0.055 }, { x: 0.17, kind: 'fuel', r: 0.042 }];
    for (const gdef of gauges) {
      const y = gdef.kind === 'rpm' ? 0.79 : 0.775;
      const bezel = new THREE.TorusGeometry(gdef.r + 0.006, 0.0065, 8, 40);
      bezel.translate(gdef.x, y, -0.343);
      kit.add(M.brass, bezel);
      const face = new THREE.Mesh(new THREE.CircleGeometry(gdef.r, 40), new THREE.MeshStandardMaterial({ map: gaugeFace(gdef.kind), roughness: 0.6 }));
      face.position.set(gdef.x, y, -0.345);
      this.group.add(face);
      const gl = new THREE.Mesh(new THREE.SphereGeometry(gdef.r * 1.02, 24, 8, 0, Math.PI * 2, 0, 0.5), M.glass);
      gl.rotation.x = Math.PI / 2;
      gl.position.set(gdef.x, y, -0.346);
      gl.scale.set(1, 1, 0.3);
      this.group.add(gl);
      const needle = new THREE.Group();
      needle.position.set(gdef.x, y, -0.341);
      const nm = new THREE.Mesh(new THREE.BoxGeometry(0.003, gdef.r * 0.85, 0.0015).translate(0, gdef.r * 0.35, 0), new THREE.MeshStandardMaterial({ color: '#9a1612', roughness: 0.4 }));
      needle.add(nm);
      const hubN = new THREE.Mesh(new THREE.CylinderGeometry(0.005, 0.005, 0.004, 12).rotateX(Math.PI / 2), M.brass);
      needle.add(hubN);
      this.group.add(needle);
      this.needles.push({ obj: needle, kind: gdef.kind });
    }
    const plate = new THREE.Mesh(new THREE.PlaneGeometry(0.2, 0.05), new THREE.MeshStandardMaterial({ map: makerPlate(), metalness: 0.9, roughness: 0.3 }));
    plate.position.set(0, 0.665, -0.3535);
    this.group.add(plate);
    // ignition key and choke
    const key = lathe([[0, 0], [0.012, 0], [0.012, 0.01], [0, 0.012]], 16);
    key.applyMatrix4(M4.c(M4.t(-0.15, 0.66, -0.354), M4.rx(Math.PI / 2)));
    kit.add(M.chrome, key);
    const choke = new THREE.SphereGeometry(0.011, 12, 8); choke.translate(0.15, 0.66, -0.348);
    kit.add(M.knobBlack, choke);

    // ---- steering column ----
    this.hub = new THREE.Vector3(0, 1.03, -0.12);
    const colBase = new THREE.Vector3(0, 0.56, -0.40);
    const colDir = this.hub.clone().sub(colBase).normalize();
    const col = new THREE.CylinderGeometry(0.017, 0.022, colBase.distanceTo(this.hub) - 0.03, 12);
    col.applyMatrix4(new THREE.Matrix4().compose(colBase.clone().lerp(this.hub, 0.47), new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), colDir), new THREE.Vector3(1, 1, 1)));
    kit.add(M.blackPaint, col);

    // ---- seat, fenders, platform, footboards ----
    const seatPan = loftSmooth(Array.from({ length: 9 }, (_, k) => {
      const u = k / 8, z = 0.18 + u * 0.36;
      const hw = 0.21 + 0.03 * Math.sin(u * Math.PI);
      const pts = [];
      for (let i = 0; i < 32; i++) {
        const t = (i / 32) * Math.PI * 2;
        const [x, y] = superellipse(hw, 0.05, 2.6, t);
        const lip = Math.pow(Math.abs(x) / hw, 4) * 0.05 + Math.pow(u, 5) * 0.16;
        pts.push([x, 0.665 + y + (y > 0 ? lip : 0)]);
      }
      return { z, pts };
    }));
    kit.add(M.leather, seatPan);
    const backrest = loftSmooth(Array.from({ length: 7 }, (_, k) => {
      const u = k / 6, y = 0.74 + u * 0.3;
      const pts = [];
      for (let i = 0; i < 32; i++) {
        const t = (i / 32) * Math.PI * 2;
        const [x, zz] = superellipse(0.2 - 0.03 * u * u, 0.035, 2.6, t);
        pts.push([x, zz + 0.56 + 0.06 * u - 0.12 * Math.pow(Math.abs(x) / 0.2, 2) * 0.4]);
      }
      return { z: y, pts };
    }));
    backrest.rotateX(-Math.PI / 2);
    backrest.scale(1, 1, -1);
    kit.add(M.leather, backrest);
    const seatPost = new THREE.CylinderGeometry(0.03, 0.035, 0.3, 10); seatPost.translate(0, 0.5, 0.38);
    kit.add(M.blackPaint, seatPost);
    for (const sx of [-1, 1]) {
      const fender = new THREE.CylinderGeometry(0.385, 0.385, 0.25, 32, 1, true, Math.PI * 0.05, Math.PI * 0.95);
      fender.applyMatrix4(M4.c(M4.t(sx * 0.52, DIM.rearR, DIM.rearZ), M4.rz(Math.PI / 2)));
      kit.add(M.paint, fender);
      const edge = new THREE.TorusGeometry(0.385, 0.007, 6, 40, Math.PI * 0.95);
      edge.applyMatrix4(M4.c(M4.t(sx * 0.645, DIM.rearR, DIM.rearZ), M4.ry(Math.PI / 2), M4.rz(Math.PI * 0.025)));
      kit.add(M.cream, edge);
      const edge2 = edge.clone(); edge2.translate(-sx * 0.25, 0, 0); kit.add(M.cream, edge2);
      const foot = new THREE.BoxGeometry(0.3, 0.025, 0.7);
      foot.translate(sx * 0.4, 0.34, -0.05);
      kit.add(M.rubber, foot);
      for (let i = 0; i < 12; i++) {
        const rib = new THREE.BoxGeometry(0.28, 0.008, 0.012);
        rib.translate(sx * 0.4, 0.356, -0.36 + i * 0.056);
        kit.add(M.rubber, rib);
      }
    }
    const platform = new RoundedBoxGeometry(0.62, 0.05, 0.62, 2, 0.015);
    platform.translate(0, 0.36, 0.55);
    kit.add(M.paint, platform);
    const tail = new RoundedBoxGeometry(0.66, 0.26, 0.06, 3, 0.02);
    tail.translate(0, 0.42, 0.88);
    kit.add(M.paint, tail);

    // ---- chassis, deck, chute ----
    for (const sx of [-1, 1]) {
      const rail = new THREE.BoxGeometry(0.05, 0.08, 2.1); rail.translate(sx * 0.27, 0.3, -0.12);
      kit.add(M.blackPaint, rail);
    }
    const deck = loftSmooth(Array.from({ length: 7 }, (_, k) => {
      const u = k / 6, z = -0.62 + u * 1.0;
      const hw = 0.66 * Math.pow(Math.sin(0.25 + u * (Math.PI - 0.5)), 0.25);
      const pts = [];
      for (let i = 0; i < 28; i++) {
        const [x, y] = superellipse(hw, 0.075, 3, (i / 28) * Math.PI * 2);
        pts.push([x, 0.15 + y]);
      }
      return { z, pts };
    }));
    kit.add(M.deckPaint, deck);
    const chute = new RoundedBoxGeometry(0.28, 0.12, 0.3, 2, 0.02);
    chute.applyMatrix4(M4.c(M4.t(0.78, 0.15, -0.1), M4.rz(-0.25)));
    kit.add(M.deckPaint, chute);
    const axleF = new THREE.CylinderGeometry(0.02, 0.02, 0.8, 8); axleF.applyMatrix4(M4.c(M4.t(0, DIM.frontR, DIM.frontZ), M4.rz(Math.PI / 2)));
    kit.add(M.steel, axleF);

    // ---- exhaust stack ----
    const ex = new THREE.CylinderGeometry(0.017, 0.019, 0.24, 16, 1, true); ex.translate(0.25, 0.95, -0.9);
    kit.add(M.chrome, ex);
    const exBase = lathe([[0.0, 0], [0.036, 0], [0.024, 0.025], [0.019, 0.05]], 20); exBase.translate(0.25, 0.81, -0.9);
    kit.add(M.chrome, exBase);
    this.flap = new THREE.Group();
    this.flap.position.set(0.25, 1.07, -0.917);
    const flapMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.003, 18).translate(0, 0, 0.017), M.chrome);
    this.flap.add(flapMesh);
    this.group.add(this.flap);

    // ---- levers ----
    this.levers = {};
    const lever = (name, x, knobMat) => {
      const g = new THREE.Group();
      g.position.set(x, 0.62, -0.345);
      const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.007, 0.24, 8).translate(0, 0.12, 0), M.chrome);
      const knob = new THREE.Mesh(new THREE.SphereGeometry(0.019, 16, 12).translate(0, 0.245, 0), knobMat);
      g.add(rod, knob);
      g.rotation.x = 0.55;
      g.children.forEach((c) => { c.castShadow = true; });
      this.group.add(g);
      this.levers[name] = g;
    };
    lever('throttle', -0.33, M.knobBlack);
    lever('blades', 0.33, M.knobRed);

    // ---- wheels ----
    this.wheels = [];
    const rearT = tyre(DIM.rearR, 0.2, true, 0.17), frontT = tyre(DIM.frontR, 0.12, false, 0.11);
    const rearHub = hubDisc(0.17), frontHub = hubDisc(0.11);
    const cap2 = lathe([[0, 0], [0.04, 0], [0.035, 0.02], [0, 0.03]], 20).rotateZ(-Math.PI / 2);
    for (const [isFront, sx] of [[false, -1], [false, 1], [true, -1], [true, 1]]) {
      const w = new THREE.Group();
      const R = isFront ? DIM.frontR : DIM.rearR;
      w.position.set(sx * (isFront ? DIM.frontTrack : DIM.rearTrack) / 2, R, isFront ? DIM.frontZ : DIM.rearZ);
      const spin = new THREE.Group();
      const t = new THREE.Mesh(isFront ? frontT : rearT, M.rubber);
      const h = new THREE.Mesh(isFront ? frontHub : rearHub, M.cream);
      h.scale.x = sx; h.position.x = sx * (isFront ? 0.045 : 0.075);
      const c = new THREE.Mesh(cap2, M.brass);
      c.scale.x = sx; c.position.x = sx * (isFront ? 0.06 : 0.095); c.scale.multiplyScalar(isFront ? 0.7 : 1);
      spin.add(t, h, c);
      spin.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
      w.add(spin);
      this.group.add(w);
      this.wheels.push({ group: w, spin, front: isFront, side: sx });
    }

    // ---- steering wheel (rotates about its column) ----
    this.wheelPivot = new THREE.Group();
    this.wheelPivot.position.copy(this.hub);
    this.wheelPivot.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), colDir);
    this.steeringWheel = new THREE.Group();
    this.wheelPivot.add(this.steeringWheel);
    const RIM = 0.19;
    this.rimRadius = RIM;
    buildSteeringWheel(this.steeringWheel, M, RIM);
    this.group.add(this.wheelPivot);

    // ---- a crate of spare ale on the left footboard ----
    this.crateAnchor = new THREE.Object3D();
    this.crateAnchor.position.set(-0.43, 0.37, 0.12);
    this.group.add(this.crateAnchor);
    {
      const cx = -0.43, cz = 0.12, y0 = 0.352;
      const crateWood = new THREE.MeshStandardMaterial({ map: M.wood.map, color: '#e8c9a0', roughness: 0.8 });
      for (const [x0, x1, z0, z1] of [[-0.11, 0.11, -0.085, -0.075], [-0.11, 0.11, 0.075, 0.085], [-0.11, -0.1, -0.085, 0.085], [0.1, 0.11, -0.085, 0.085]]) {
        for (const yy of [0.012, 0.062]) kit.add(crateWood, new THREE.BoxGeometry(x1 - x0, 0.04, z1 - z0).translate(cx + (x0 + x1) / 2, y0 + yy + 0.02, cz + (z0 + z1) / 2));
      }
      kit.add(crateWood, new THREE.BoxGeometry(0.22, 0.008, 0.17).translate(cx, y0 + 0.004, cz));
      const amber = new THREE.MeshPhysicalMaterial({ color: '#4a2a0c', roughness: 0.1, clearcoat: 1, metalness: 0 });
      const foil = new THREE.MeshStandardMaterial({ color: '#c9a457', metalness: 1, roughness: 0.25 });
      const neck = new THREE.LatheGeometry([[0, 0], [0.032, 0], [0.032, 0.12], [0.026, 0.15], [0.015, 0.17], [0.0135, 0.21], [0.0148, 0.223], [0, 0.224]].map(([a, b]) => new THREE.Vector2(a, b)), 20);
      for (const [dx, dz] of [[-0.05, -0.035], [0.05, -0.035], [-0.05, 0.035], [0.05, 0.035]]) {
        kit.add(amber, neck.clone().translate(cx + dx, y0 + 0.008, cz + dz));
        kit.add(foil, new THREE.CylinderGeometry(0.0152, 0.0152, 0.03, 16).translate(cx + dx, y0 + 0.008 + 0.21, cz + dz));
      }
    }

    kit.build(this.group);
    this.group.traverse((o) => { if (o.isMesh) { o.receiveShadow = true; } });
    this.flapAngle = 0;
  }

  // Where the right hand grips the rim, in steering-wheel space (angle from the driver's 12 o'clock).
  rimPoint(angle, out = new THREE.Vector3()) {
    // wheel space: rim in the XZ plane; -Z points away from the driver (12 o'clock)
    return out.set(Math.sin(angle) * this.rimRadius, 0, -Math.cos(angle) * this.rimRadius);
  }

  update(dt, v, state) {
    // wheels
    for (const w of this.wheels) {
      w.spin.rotation.x = -(w.front ? v.frontSpin : v.wheelSpin);
      if (w.front) {
        // Ackermann: the inside wheel turns more
        const inside = Math.sign(v.steer) === w.side;
        w.group.rotation.y = -v.steer * (inside ? 1.12 : 0.9);
      }
    }
    this.steeringWheel.rotation.y = -v.steer * 2.6;
    // levers
    const lb = this.levers.blades, lt = this.levers.throttle;
    lb.rotation.x += ((state.bladesOn ? -0.35 : 0.55) - lb.rotation.x) * Math.min(1, dt * 10);
    lt.rotation.x += ((0.55 - 0.9 * Math.max(0, v.throttle) * (state.boost ? 1 : 0.6)) - lt.rotation.x) * Math.min(1, dt * 6);
    // gauges
    for (const n of this.needles) {
      let f = 0;
      if (n.kind === 'rpm') f = v.rpm / 4000;
      else if (n.kind === 'oil') f = 0.35 + 0.35 * (v.rpm - 1000) / 2500;
      else f = state.fuel ?? 0.8;
      const a0 = Math.PI * 0.75, a1 = Math.PI * 2.25;
      const a = a0 + (a1 - a0) * Math.max(0, Math.min(1, f));
      n.obj.rotation.z = -(a - Math.PI * 1.5) + (Math.sin(state.time * 37) * 0.004 * (v.rpm / 3000));
    }
    // exhaust flap bobs with each firing stroke
    const fire = v.rpm / 120;
    this.flapAngle = 0.15 + 0.35 * Math.max(0, Math.sin(state.time * fire * Math.PI * 2)) * (0.4 + Math.abs(v.throttle) * 0.6);
    this.flap.rotation.x = -this.flapAngle;
  }
}
