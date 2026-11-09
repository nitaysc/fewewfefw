// A few rooks wheeling over the park and settling into the trees' line of sight: small
// flapping silhouettes on slow, wandering circuits high above the lawn.
import * as THREE from '../../vendor/three.module.js';
import { rng } from '../core/util.js';

export class Rooks {
  constructor(scene, count = 9) {
    const r = rng(512);
    this.birds = [];
    const black = new THREE.MeshStandardMaterial({ color: '#141416', roughness: 0.6, side: THREE.DoubleSide });
    const body = new THREE.SphereGeometry(1, 8, 6).scale(0.09, 0.08, 0.22);
    const head = new THREE.SphereGeometry(0.06, 8, 6).translate(0, 0.02, -0.24);
    const beak = new THREE.ConeGeometry(0.02, 0.09, 6).rotateX(-Math.PI / 2).translate(0, 0.01, -0.33);
    const tail = new THREE.PlaneGeometry(0.14, 0.16).rotateX(-Math.PI / 2).translate(0, 0, 0.27);
    // wing: a tapered fan of feathers along +x
    const wing = new THREE.BufferGeometry();
    wing.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, -0.1, 0.25, 0, -0.12, 0.48, 0, -0.04, 0.5, 0, 0.06, 0.3, 0, 0.12, 0, 0, 0.1], 3));
    wing.setIndex([0, 1, 5, 1, 4, 5, 1, 2, 4, 2, 3, 4]);
    wing.computeVertexNormals();
    for (let i = 0; i < count; i++) {
      const g = new THREE.Group();
      g.add(new THREE.Mesh(body, black), new THREE.Mesh(head, black), new THREE.Mesh(beak, black), new THREE.Mesh(tail, black));
      const lw = new THREE.Mesh(wing, black), rw = new THREE.Mesh(wing, black);
      rw.scale.x = -1;
      const lp = new THREE.Group(), rp = new THREE.Group();
      lp.add(lw); rp.add(rw);
      lp.position.x = 0.07; rp.position.x = -0.07;
      g.add(lp, rp);
      g.scale.setScalar(1.6);
      g.traverse((o) => { if (o.isMesh) o.castShadow = false; });
      scene.add(g);
      this.birds.push({
        g, lp, rp,
        cx: -60 + r() * 120, cz: -40 + r() * 140, R: 25 + r() * 50, h: 22 + r() * 22,
        w: (0.08 + r() * 0.08) * (r() < 0.5 ? 1 : -1), ph: r() * 6.28, flap: 5.5 + r() * 2, glide: r() * 6.28,
      });
    }
  }
  update(t) {
    for (const b of this.birds) {
      const a = b.ph + t * b.w;
      const x = b.cx + Math.cos(a) * b.R + Math.sin(t * 0.07 + b.ph) * 12;
      const z = b.cz + Math.sin(a) * b.R + Math.cos(t * 0.05 + b.ph) * 10;
      const y = b.h + Math.sin(t * 0.3 + b.ph) * 3;
      // heading along the circuit
      const dx = -Math.sin(a) * b.w, dz = Math.cos(a) * b.w;
      b.g.position.set(x, y, z);
      b.g.rotation.set(0, Math.atan2(-dx, -dz), -Math.sign(b.w) * 0.35);
      // flap in bursts, then glide
      const gliding = Math.sin(t * 0.4 + b.glide) > 0.4;
      const f = gliding ? 0.08 : Math.sin(t * b.flap + b.ph) * 0.75;
      b.lp.rotation.z = f; b.rp.rotation.z = -f;
    }
  }
}
