// The driver's head, seen only from outside (in third person): a weathered face with a fine
// moustache, ears, short greying hair at the back and sides, a tweed flat cap, a white shirt
// collar and the knot of his tie. Modelled as signed distances and meshed once, in the
// head's own frame: origin between the eyes, looking down -z, +y up.
import * as THREE from '../../vendor/three.module.js';
import { meshSDF, smin, smax, roundCone, capsule, ellipsoid } from '../core/sdf.js';
import { tex } from '../core/textures.js';

const mirrorX = (fn) => (x, y, z) => fn(Math.abs(x), y, z);

function headSDF() {
  const sym = mirrorX((x, y, z) => {
    // ears and cheekbones, mirrored
    let d = ellipsoid(x, y, z, [0.077, -0.012, 0.072], [0.012, 0.03, 0.021]);
    d = smin(d, ellipsoid(x, y, z, [0.077, -0.043, 0.074], [0.009, 0.012, 0.011]), 0.006);
    d = smin(d, ellipsoid(x, y, z, [0.046, -0.022, -0.012], [0.025, 0.019, 0.024]), 0.012);
    return d;
  });
  return (x, y, z) => {
    let d = ellipsoid(x, y, z, [0, 0.03, 0.075], [0.076, 0.095, 0.098]);                 // cranium
    d = smin(d, ellipsoid(x, y, z, [0, -0.05, 0.03], [0.064, 0.075, 0.072]), 0.03);       // face and jaw
    d = smin(d, ellipsoid(x, y, z, [0, -0.1, -0.008], [0.04, 0.03, 0.034]), 0.02);        // chin
    d = smin(d, ellipsoid(x, y, z, [0, 0.018, -0.022], [0.058, 0.016, 0.022]), 0.012);    // brow
    d = smin(d, sym(x, y, z), 0.008);
    d = smin(d, roundCone(x, y, z, [0, 0.004, -0.036], [0, -0.04, -0.061], 0.0075, 0.011), 0.008);   // nose
    d = smin(d, ellipsoid(x, y, z, [0, -0.044, -0.051], [0.016, 0.009, 0.012]), 0.006);   // nostrils
    d = smin(d, ellipsoid(x, y, z, [0, -0.07, -0.044], [0.021, 0.007, 0.01]), 0.006);     // lips
    // moustache, curling up at the ends
    d = smin(d, mirrorX((xx, yy, zz) => ellipsoid(xx, yy, zz, [0.019, -0.056, -0.05], [0.021, 0.0065, 0.009]))(x, y, z), 0.004);
    d = smin(d, mirrorX((xx, yy, zz) => ellipsoid(xx, yy, zz, [0.04, -0.051, -0.042], [0.008, 0.006, 0.006]))(x, y, z), 0.004);
    // eye sockets
    d = smax(d, -mirrorX((xx, yy, zz) => Math.hypot(xx - 0.031, yy, zz + 0.039) - 0.0135)(x, y, z), 0.008);
    d = smin(d, capsule(x, y, z, [0, -0.07, 0.095], [0, -0.21, 0.125], 0.054), 0.025);   // neck
    return d;
  };
}

function capSDF() {
  return (x, y, z) => {
    // a soft crown sloping forward over a short stiff peak
    let d = ellipsoid(x, y, z, [0, 0.07, 0.045], [0.1, 0.064, 0.13]);
    d = smax(d, 0.048 - y + Math.max(0, z - 0.1) * 0.35, 0.01);
    const peak = smax(ellipsoid(x, y, z, [0, 0.053, -0.07], [0.078, 0.0065, 0.055]), z + 0.02 - 0.0, 0.004);
    return smin(d, peak, 0.012);
  };
}

export class DriverHead {
  constructor({ quality, tone = '#b8805c' }) {
    this.group = new THREE.Group();
    this.group.name = 'driver-head';
    const h = quality.treeDetail >= 1 ? 0.0026 : 0.0032;
    const skin = new THREE.Color(tone), hair = new THREE.Color('#4a3f36'), grey = new THREE.Color('#8a8580');
    const lipsC = new THREE.Color('#9a5a48'), rosy = new THREE.Color('#c0705a');
    const sdf = headSDF();
    const geo = meshSDF(sdf, [-0.1, -0.24, -0.08], [0.1, 0.14, 0.19], h, {
      attributes: {
        color: {
          size: 3, fn: (x, y, z, nx, ny, nz, out) => {
            const c = skin.clone();
            // weathered, a little ruddy at the cheeks and nose
            const cheek = Math.exp(-((Math.abs(x) - 0.042) ** 2 + (y + 0.03) ** 2 + (z + 0.02) ** 2) / 0.0006);
            const noseR = Math.exp(-(x * x + (y + 0.035) ** 2 + (z + 0.058) ** 2) / 0.0002);
            c.lerp(rosy, Math.min(1, cheek * 0.35 + noseR * 0.3));
            if (Math.abs(y + 0.07) < 0.006 && z < -0.038 && Math.abs(x) < 0.02) c.lerp(lipsC, 0.6);
            // hair: back and sides of the head, sideburns, and the moustache
            const back = smooth(0.035, 0.07, z) * smooth(-0.075, -0.04, y);
            const side = smooth(0.058, 0.07, Math.abs(x)) * smooth(-0.035, -0.005, y) * smooth(-0.005, 0.02, z) * (1 - smooth(0.06, 0.075, Math.abs(x) - (y > 0 ? 0 : 0.01)) * 0);
            const tache = (Math.abs(y + 0.054) < 0.01 && z < -0.036 && Math.abs(x) < 0.05) ? 1 : 0;
            const hairAmt = Math.max(back, side, tache);
            if (hairAmt > 0) {
              const g = hair.clone().lerp(grey, 0.35 + 0.3 * Math.sin(x * 400 + y * 300) * Math.sin(z * 350));
              c.lerp(g, Math.min(1, hairAmt));
            }
            out[0] = c.r; out[1] = c.g; out[2] = c.b;
          },
        },
      },
    });
    const skinMat = new THREE.MeshPhysicalMaterial({
      vertexColors: true, roughness: 0.58, metalness: 0, sheen: 0.3, sheenColor: new THREE.Color('#ff9f80'), sheenRoughness: 0.6,
    });
    const head = new THREE.Mesh(geo, skinMat);
    // eyes: dark and glossy, set in the sockets
    const eyeMat = new THREE.MeshPhysicalMaterial({ color: '#2a2018', roughness: 0.1, clearcoat: 1, clearcoatRoughness: 0.05 });
    const eyeG = new THREE.SphereGeometry(0.0108, 16, 12);
    for (const sx of [-1, 1]) { const e = new THREE.Mesh(eyeG, eyeMat); e.position.set(sx * 0.031, 0, -0.031); head.add(e); }
    // the flat cap, in a darker herringbone tweed
    const capGeo = meshSDF(capSDF(), [-0.12, 0.02, -0.14], [0.12, 0.15, 0.19], h * 1.2, {
      attributes: {
        uv: { size: 2, fn: (x, y, z, nx, ny, nz, out) => { out[0] = (Math.atan2(x, z - 0.04) / Math.PI + 1) * 2.2; out[1] = y * 9 + z * 6; } },
      },
    });
    const capMat = new THREE.MeshStandardMaterial({
      map: tex('tweed_diff', { repeat: [1, 1] }), normalMap: tex('tweed_nor', { repeat: [1, 1] }),
      color: '#9a8a74', roughness: 0.95,
    });
    const cap = new THREE.Mesh(capGeo, capMat);
    // shirt collar and tie knot
    const collar = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.064, 0.038, 28, 1, true).translate(0, -0.188, 0.118),
      new THREE.MeshStandardMaterial({ color: '#efece6', roughness: 0.7, side: THREE.DoubleSide }));
    collar.rotation.x = -0.18;
    const knot = new THREE.Mesh(new THREE.SphereGeometry(0.014, 16, 12).scale(1, 1.15, 0.7),
      new THREE.MeshStandardMaterial({ color: '#5a1a1e', roughness: 0.45 }));
    knot.position.set(0, -0.2, 0.06);
    this.group.add(head, cap, collar, knot);
    this.group.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  }
}

function smooth(e0, e1, x) { const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0))); return t * t * (3 - 2 * t); }
