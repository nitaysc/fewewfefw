// Particles: soft lit smoke (cigar wisps, exhaled puffs, exhaust) and tumbling grass
// clippings thrown from the mower's discharge chute.
import * as THREE from '../../vendor/three.module.js';
import { canvasTexture } from '../core/textures.js';
import { shared, LIGHT_GLSL } from '../core/shared.js';
import { rng } from '../core/util.js';

function puffTexture() {
  return canvasTexture(128, 128, (ctx, w, h) => {
    const img = ctx.createImageData(w, h);
    const r = rng(77);
    const grid = new Float32Array(17 * 17).map(() => r());
    const vn = (x, y, s) => {
      const fx = x * s, fy = y * s, x0 = Math.floor(fx) % 16, y0 = Math.floor(fy) % 16;
      const tx = fx - Math.floor(fx), ty = fy - Math.floor(fy);
      const a = grid[y0 * 17 + x0], b = grid[y0 * 17 + x0 + 1], c = grid[(y0 + 1) * 17 + x0], d = grid[(y0 + 1) * 17 + x0 + 1];
      const sx = tx * tx * (3 - 2 * tx), sy = ty * ty * (3 - 2 * ty);
      return (a + (b - a) * sx) * (1 - sy) + (c + (d - c) * sx) * sy;
    };
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const u = x / w, v = y / h;
      const dx = u - 0.5, dy = v - 0.5, rr = Math.sqrt(dx * dx + dy * dy) * 2;
      const n = vn(u, v, 4) * 0.55 + vn(u, v, 8) * 0.3 + vn(u, v, 15) * 0.15;
      const a = Math.max(0, 1 - rr) ** 1.6 * (0.45 + 0.9 * n);
      const k = (y * w + x) * 4;
      img.data[k] = img.data[k + 1] = img.data[k + 2] = 255;
      img.data[k + 3] = Math.max(0, Math.min(255, a * 255));
    }
    ctx.putImageData(img, 0, 0);
  }, { srgb: false });
}

export class Smoke {
  constructor(scene, max = 400) {
    this.max = max;
    const g = new THREE.InstancedBufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute([-0.5, -0.5, 0, 0.5, -0.5, 0, 0.5, 0.5, 0, -0.5, 0.5, 0], 3));
    g.setIndex([0, 1, 2, 0, 2, 3]);
    this.aPos = new THREE.InstancedBufferAttribute(new Float32Array(max * 3), 3).setUsage(THREE.DynamicDrawUsage);
    this.aData = new THREE.InstancedBufferAttribute(new Float32Array(max * 4), 4).setUsage(THREE.DynamicDrawUsage); // size, rot, alpha, tint
    g.setAttribute('aPos', this.aPos); g.setAttribute('aData', this.aData);
    g.instanceCount = 0;
    this.mat = new THREE.ShaderMaterial({
      uniforms: { tPuff: { value: puffTexture() }, uSunDir: shared.uSunDir, uSunColor: shared.uSunColor, uAmbUp: shared.uAmbUp, uAmbDown: shared.uAmbDown, uCamPos: shared.uCamPos },
      vertexShader: /* glsl */`
        attribute vec3 aPos; attribute vec4 aData;
        varying vec2 vUv; varying float vAlpha; varying float vTint; varying vec3 vWP;
        void main() {
          vUv = position.xy + 0.5;
          float c = cos(aData.y), s = sin(aData.y);
          vec2 q = mat2(c, -s, s, c) * position.xy * aData.x;
          vec4 mv = viewMatrix * vec4(aPos, 1.0);
          mv.xy += q;
          vAlpha = aData.z; vTint = aData.w; vWP = aPos;
          gl_Position = projectionMatrix * mv;
        }`,
      fragmentShader: /* glsl */`
        #include <common>
        uniform sampler2D tPuff; uniform vec3 uCamPos;
        ${LIGHT_GLSL}
        varying vec2 vUv; varying float vAlpha; varying float vTint; varying vec3 vWP;
        void main() {
          float a = texture2D(tPuff, vUv).a * vAlpha;
          if (a < 0.003) discard;
          vec3 V = normalize(vWP - uCamPos);
          float fwd = pow(max(dot(V, uSunDir), 0.0), 4.0);
          vec3 base = mix(vec3(0.78, 0.8, 0.84), vec3(0.62, 0.66, 0.74), vTint);
          vec3 col = base * (skyAmbient(vec3(0.0, 1.0, 0.0)) * 0.9 + uSunColor * RECIPROCAL_PI * (0.55 + 2.2 * fwd));
          gl_FragColor = vec4(col * a, a);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }`,
      transparent: true, depthWrite: false, blending: THREE.CustomBlending,
      blendSrc: THREE.OneFactor, blendDst: THREE.OneMinusSrcAlphaFactor,
    });
    this.mesh = new THREE.Mesh(g, this.mat);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 20;
    scene.add(this.mesh);
    this.p = [];
    this.r = rng(99);
  }
  // kind: 'wisp' | 'puff' | 'exhaust'
  spawn(pos, vel, { size = 0.05, grow = 0.2, life = 3, alpha = 0.35, tint = 0, spin = 0.3 } = {}) {
    if (this.p.length >= this.max) this.p.shift();
    this.p.push({ x: pos.x, y: pos.y, z: pos.z, vx: vel.x, vy: vel.y, vz: vel.z, size, grow, life, age: 0, alpha, tint, rot: this.r() * 6.28, spin: (this.r() - 0.5) * spin });
  }
  update(dt, camPos, wind) {
    const ps = this.p;
    for (let i = ps.length - 1; i >= 0; i--) {
      const p = ps[i];
      p.age += dt;
      if (p.age >= p.life) { ps.splice(i, 1); continue; }
      const drag = Math.exp(-dt * 1.6);
      p.vx = p.vx * drag + wind.x * (1 - drag); p.vz = p.vz * drag + wind.y * (1 - drag);
      p.vy = p.vy * drag + 0.06 * (1 - drag);
      // curl: a little turbulent swirl
      const t = p.age * 2.1 + p.rot;
      p.x += (p.vx + Math.sin(t * 1.7) * 0.02) * dt; p.y += p.vy * dt; p.z += (p.vz + Math.cos(t * 1.3) * 0.02) * dt;
      p.size += p.grow * dt; p.rot += p.spin * dt;
    }
    ps.sort((a, b) => ((b.x - camPos.x) ** 2 + (b.y - camPos.y) ** 2 + (b.z - camPos.z) ** 2) - ((a.x - camPos.x) ** 2 + (a.y - camPos.y) ** 2 + (a.z - camPos.z) ** 2));
    const P = this.aPos.array, D = this.aData.array;
    for (let i = 0; i < ps.length; i++) {
      const p = ps[i], k = p.age / p.life;
      const fade = Math.min(1, p.age / 0.25) * (1 - k) * (1 - k);
      P[i * 3] = p.x; P[i * 3 + 1] = p.y; P[i * 3 + 2] = p.z;
      D[i * 4] = p.size; D[i * 4 + 1] = p.rot; D[i * 4 + 2] = p.alpha * fade; D[i * 4 + 3] = p.tint;
    }
    this.mesh.geometry.instanceCount = ps.length;
    this.aPos.needsUpdate = true; this.aData.needsUpdate = true;
  }
}

export class Clippings {
  constructor(scene, max = 1500) {
    this.max = max;
    const blade = new THREE.PlaneGeometry(0.012, 0.035);
    this.mesh = new THREE.InstancedMesh(blade, new THREE.MeshLambertMaterial({ color: '#5f8a2c', side: THREE.DoubleSide }), max);
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(max * 3), 3);
    this.mesh.count = 0;
    this.mesh.frustumCulled = false;
    this.mesh.castShadow = false;
    scene.add(this.mesh);
    this.p = [];
    this.r = rng(5);
    this.m = new THREE.Matrix4(); this.q = new THREE.Quaternion(); this.e = new THREE.Euler(); this.s = new THREE.Vector3(1, 1, 1); this.v = new THREE.Vector3();
    this.c = new THREE.Color();
  }
  spawn(pos, vel, ground) {
    if (this.p.length >= this.max) this.p.shift();
    const r = this.r;
    this.p.push({ x: pos.x, y: pos.y, z: pos.z, vx: vel.x, vy: vel.y, vz: vel.z, ax: r() * 6, ay: r() * 6, az: r() * 6, sx: (r() - 0.5) * 20, sy: (r() - 0.5) * 20, life: 6 + r() * 4, age: 0, ground, landed: false, shade: 0.7 + r() * 0.5, yellow: r() });
  }
  update(dt, groundAt) {
    const ps = this.p;
    let n = 0;
    for (let i = ps.length - 1; i >= 0; i--) {
      const p = ps[i];
      p.age += dt;
      if (p.age > p.life) { ps.splice(i, 1); continue; }
      if (!p.landed) {
        const drag = Math.exp(-dt * 3.2);
        p.vx *= drag; p.vz *= drag; p.vy = p.vy * Math.exp(-dt * 1.2) - 9.81 * dt * 0.45;
        p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
        p.ax += p.sx * dt; p.ay += p.sy * dt;
        const g = groundAt(p.x, p.z) + 0.01;
        if (p.y < g) { p.y = g; p.landed = true; p.ax = Math.PI / 2 + (this.r() - 0.5) * 0.4; }
      }
    }
    for (const p of ps) {
      const sink = p.landed ? Math.min(1, (p.age - (p.life - 1.5)) / 1.5) : 0;
      this.e.set(p.ax, p.ay, p.az);
      this.q.setFromEuler(this.e);
      const sc = 1 - Math.max(0, sink);
      this.s.set(sc, sc, sc);
      this.v.set(p.x, p.y, p.z);
      this.m.compose(this.v, this.q, this.s);
      this.mesh.setMatrixAt(n, this.m);
      this.c.setRGB(0.36 * p.shade + p.yellow * 0.12, 0.55 * p.shade, 0.16 * p.shade);
      this.mesh.setColorAt(n, this.c);
      n++;
    }
    this.mesh.count = n;
    this.mesh.instanceMatrix.needsUpdate = true;
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
  }
}
