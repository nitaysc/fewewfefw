// The gardens: clipped yew hedges and topiary, the herbaceous border, the fountain on its
// island, urns, a sundial, Lutyens benches, a bronze rearing horse closing the lawn's axis,
// the ha-ha wall, the lodge gates and ivy on the house.
import * as THREE from '../../vendor/three.module.js';
import { GLTFLoader } from '../../vendor/GLTFLoader.js';
import { Kit, M4, lathe, merge } from '../core/geo.js';
import { stoneMaterial, waterMaterial, paintMaterial } from '../core/materials.js';
import { canvasTexture } from '../core/textures.js';
import { shared } from '../core/shared.js';
import { rng } from '../core/util.js';
import { needleTexture, leafClusterTexture, leafMaterial } from './foliage.js';
import { HEDGES, BORDER, FEATURES, ISLAND, HAHA, DRIVE, HOUSE, heightAt } from './layout.js';

const B = (x0, x1, y0, y1, z0, z1) => new THREE.BoxGeometry(x1 - x0, y1 - y0, z1 - z0).translate((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);

// Leaf cards scattered over a surface: sample(r) -> { p, n } in world space.
function cardsOver(count, sample, size, r) {
  const pos = [], nor = [], uv = [], idx = [];
  const q = new THREE.Quaternion(), v = new THREE.Vector3(), t1 = new THREE.Vector3(), t2 = new THREE.Vector3();
  for (let i = 0; i < count; i++) {
    const { p, n } = sample(r);
    // card roughly facing out of the surface, randomly spun
    const nn = n.clone().add(new THREE.Vector3(r() - 0.5, r() - 0.5, r() - 0.5).multiplyScalar(0.9)).normalize();
    t1.set(r() - 0.5, r() - 0.5, r() - 0.5).cross(nn).normalize();
    t2.crossVectors(nn, t1);
    const s = size * (0.75 + r() * 0.5);
    const c = p.clone().addScaledVector(n, s * 0.12);
    const b = pos.length / 3;
    for (const [x, y, u, w] of [[-0.5, -0.5, 0, 0], [0.5, -0.5, 1, 0], [0.5, 0.5, 1, 1], [-0.5, 0.5, 0, 1]]) {
      v.copy(c).addScaledVector(t1, x * s).addScaledVector(t2, y * s);
      pos.push(v.x, v.y, v.z); nor.push(n.x, n.y, n.z); uv.push(u, w);
    }
    idx.push(b, b + 1, b + 2, b, b + 2, b + 3);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(pos.length / 3 > 65535 ? new THREE.Uint32BufferAttribute(idx, 1) : new THREE.Uint16BufferAttribute(idx, 1));
  return g;
}

function flowerAtlas() {
  // six border plants side by side: delphinium, foxglove, lupin, rose, daisy, achillea
  return canvasTexture(1536, 256, (ctx) => {
    const r = rng(31);
    const plant = (ox, kind) => {
      ctx.save(); ctx.translate(ox, 0);
      // foliage at the base
      for (let i = 0; i < 26; i++) {
        ctx.fillStyle = ['#3e5c24', '#4a6b2a', '#2f4a1c'][i % 3];
        ctx.beginPath(); ctx.ellipse(40 + r() * 176, 170 + r() * 80, 10 + r() * 14, 5 + r() * 6, r() * 3, 0, Math.PI * 2); ctx.fill();
      }
      const spike = (x, top, col, w) => {
        ctx.strokeStyle = '#3c5a22'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(x, 250); ctx.lineTo(x, top); ctx.stroke();
        for (let y = top; y < top + 110; y += 7) {
          const ww = w * (0.4 + (y - top) / 160);
          ctx.fillStyle = col[Math.floor(r() * col.length)];
          ctx.beginPath(); ctx.ellipse(x + (r() - 0.5) * 4, y, ww, 5, 0, 0, Math.PI * 2); ctx.fill();
        }
      };
      const blooms = (n, col, rad, y0, y1) => {
        for (let i = 0; i < n; i++) {
          const x = 30 + r() * 196, y = y0 + r() * (y1 - y0);
          ctx.strokeStyle = '#3c5a22'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x, 250); ctx.lineTo(x + (r() - 0.5) * 10, y); ctx.stroke();
          ctx.fillStyle = col[Math.floor(r() * col.length)];
          ctx.beginPath(); ctx.arc(x, y, rad * (0.7 + r() * 0.6), 0, Math.PI * 2); ctx.fill();
          if (kind === 'daisy') { ctx.fillStyle = '#e8b82c'; ctx.beginPath(); ctx.arc(x, y, rad * 0.35, 0, Math.PI * 2); ctx.fill(); }
        }
      };
      if (kind === 'delph') for (let i = 0; i < 4; i++) spike(60 + i * 45 + r() * 20, 12 + r() * 40, ['#3d5bb8', '#5a74d0', '#2f469a', '#7a8fe0'], 11);
      if (kind === 'fox') for (let i = 0; i < 4; i++) spike(60 + i * 45 + r() * 20, 30 + r() * 40, ['#c45a9a', '#d978b0', '#a8457f', '#e9a0c8'], 9);
      if (kind === 'lupin') for (let i = 0; i < 5; i++) spike(45 + i * 40 + r() * 20, 50 + r() * 40, ['#8a4fb0', '#a96ccd', '#e0c94d', '#c2508a'], 8);
      if (kind === 'rose') blooms(26, ['#b0242c', '#d0414a', '#e88a90', '#f2c0c4'], 11, 60, 200);
      if (kind === 'daisy') blooms(40, ['#f6f3ea', '#ffffff'], 9, 70, 210);
      if (kind === 'achil') blooms(18, ['#e9c43a', '#f0d35c', '#d8a82a'], 16, 80, 190);
      ctx.restore();
    };
    ['delph', 'fox', 'lupin', 'rose', 'daisy', 'achil'].forEach((k, i) => plant(i * 256, k));
  });
}

function benchGeometry() {
  // a Lutyens-style garden bench: slatted seat, curved top rail, scrolled arms
  const parts = [];
  for (let i = 0; i < 5; i++) parts.push(B(-0.95, 0.95, 0.42, 0.45, -0.22 + i * 0.1, -0.15 + i * 0.1));
  for (const x of [-0.95, 0.95]) {
    parts.push(B(x - 0.04, x + 0.04, 0, 0.62, -0.25, -0.17), B(x - 0.04, x + 0.04, 0, 0.95, 0.2, 0.28));
    parts.push(B(x - 0.035, x + 0.035, 0.6, 0.66, -0.3, 0.28));
  }
  for (let i = 0; i < 13; i++) parts.push(B(-0.9 + i * 0.15, -0.88 + i * 0.15, 0.45, 0.88, 0.22, 0.25));
  const top = new THREE.TorusGeometry(2.6, 0.04, 6, 24, 0.82).rotateZ(Math.PI / 2 - 0.41).translate(0, -1.68, 0.24);
  parts.push(top);
  parts.push(B(-0.95, 0.95, 0.38, 0.42, -0.24, 0.28));
  return merge(parts);
}

export async function buildGarden({ scene, quality, house }) {
  const group = new THREE.Group();
  group.name = 'garden';
  const stone = stoneMaterial('#f5ead4', 1.6);
  const kit = new Kit();
  const r = rng(808);
  const a2c = (quality.msaa || 0) > 0;
  const yew = leafMaterial(needleTexture({ seed: 9, color: '#2a4a22', light: '#4d7a3a', density: 1.6 }), { a2c, sway: 0.0, translucency: 0.35, alphaTest: 0.5 });
  const yewCore = new THREE.MeshStandardMaterial({ color: '#1c3218', roughness: 1 });

  // ---------------- hedges ----------------
  const hedgeGeos = [];
  const dens = 7.5 * quality.hedgeLeaves;
  for (const h of HEDGES) {
    const y0 = heightAt((h.x0 + h.x1) / 2, (h.z0 + h.z1) / 2) - 0.05;
    kit.add(yewCore, B(h.x0 + 0.08, h.x1 - 0.08, y0, y0 + h.h - 0.08, h.z0 + 0.08, h.z1 - 0.08));
    const W = h.x1 - h.x0, D = h.z1 - h.z0, H = h.h;
    const faces = [
      { a: W * D, f: (rr) => ({ p: new THREE.Vector3(h.x0 + rr() * W, y0 + H, h.z0 + rr() * D), n: new THREE.Vector3(0, 1, 0) }) },
      { a: W * H, f: (rr) => ({ p: new THREE.Vector3(h.x0 + rr() * W, y0 + rr() * H, h.z0), n: new THREE.Vector3(0, 0, -1) }) },
      { a: W * H, f: (rr) => ({ p: new THREE.Vector3(h.x0 + rr() * W, y0 + rr() * H, h.z1), n: new THREE.Vector3(0, 0, 1) }) },
      { a: D * H, f: (rr) => ({ p: new THREE.Vector3(h.x0, y0 + rr() * H, h.z0 + rr() * D), n: new THREE.Vector3(-1, 0, 0) }) },
      { a: D * H, f: (rr) => ({ p: new THREE.Vector3(h.x1, y0 + rr() * H, h.z0 + rr() * D), n: new THREE.Vector3(1, 0, 0) }) },
    ];
    for (const fc of faces) hedgeGeos.push(cardsOver(Math.round(fc.a * dens), fc.f, 0.42, r));
  }
  // topiary cones
  for (const t of FEATURES.topiary) {
    const y0 = heightAt(t.x, t.z);
    const Hc = 2.7, R0 = 0.85;
    kit.add(yewCore, new THREE.ConeGeometry(R0 - 0.08, Hc - 0.1, 16).translate(t.x, y0 + Hc / 2, t.z));
    hedgeGeos.push(cardsOver(Math.round(9 * dens), (rr) => {
      const a = rr() * Math.PI * 2, k = Math.sqrt(rr());
      const y = (1 - k) * Hc, rad = R0 * k;
      const n = new THREE.Vector3(Math.cos(a), R0 / Hc, Math.sin(a)).normalize();
      return { p: new THREE.Vector3(t.x + Math.cos(a) * rad, y0 + y, t.z + Math.sin(a) * rad), n };
    }, 0.38, r));
    kit.add(stone, B(t.x - 0.5, t.x + 0.5, y0, y0 + 0.08, t.z - 0.5, t.z + 0.5));
  }
  // clipped yew drums flanking the portico steps
  for (const sx of [-1, 1]) {
    const x = sx * 12, z = -54.5, y0 = 0;
    kit.add(yewCore, new THREE.CylinderGeometry(1.0, 1.0, 1.6, 16).translate(x, y0 + 0.8, z));
    hedgeGeos.push(cardsOver(Math.round(18 * dens), (rr) => {
      const a = rr() * Math.PI * 2, top = rr() < 0.3;
      return top ? { p: new THREE.Vector3(x + Math.cos(a) * Math.sqrt(rr()), y0 + 1.6, z + Math.sin(a) * Math.sqrt(rr())), n: new THREE.Vector3(0, 1, 0) }
        : { p: new THREE.Vector3(x + Math.cos(a) * 1.05, y0 + rr() * 1.6, z + Math.sin(a) * 1.05), n: new THREE.Vector3(Math.cos(a), 0, Math.sin(a)) };
    }, 0.36, r));
  }
  const hedgeMesh = new THREE.Mesh(merge(hedgeGeos), yew);
  hedgeMesh.customDepthMaterial = yew.userData.depth;
  hedgeMesh.castShadow = true; hedgeMesh.receiveShadow = true;
  hedgeMesh.name = 'hedges';
  group.add(hedgeMesh);

  // ---------------- herbaceous border ----------------
  {
    const atlas = flowerAtlas();
    const mat = leafMaterial(atlas, { a2c, sway: 0.08, translucency: 0.6, alphaTest: 0.4 });
    const parts = [];
    const n = Math.round(260 * Math.max(0.5, quality.hedgeLeaves));
    for (let i = 0; i < n; i++) {
      const x = BORDER.x0 + 0.3 + r() * (BORDER.x1 - BORDER.x0 - 0.6), z = BORDER.z0 + r() * (BORDER.z1 - BORDER.z0);
      // taller plants at the back of the border, by the hedge
      const back = (x - BORDER.x0) / (BORDER.x1 - BORDER.x0);
      const kind = back > 0.55 ? Math.floor(r() * 3) : 3 + Math.floor(r() * 3);
      const hgt = (kind < 3 ? 1.5 : 0.85) * (0.8 + r() * 0.4), w = hgt * 0.9;
      const y0 = heightAt(x, z) - 0.05;
      for (const rot of [0, Math.PI / 2]) {
        const g = new THREE.PlaneGeometry(w, hgt);
        const uvs = g.attributes.uv;
        for (let k = 0; k < uvs.count; k++) uvs.setX(k, (uvs.getX(k) + kind) / 6);
        g.translate(0, hgt / 2, 0);
        // normals pointing up-out so the clumps shade softly
        const nr = g.attributes.normal;
        for (let k = 0; k < nr.count; k++) nr.setXYZ(k, -0.6, 0.8, 0);
        g.applyMatrix4(M4.c(M4.t(x, y0, z), M4.ry(rot + r() * 0.6)));
        parts.push(g);
      }
    }
    const border = new THREE.Mesh(merge(parts), mat);
    border.customDepthMaterial = mat.userData.depth;
    border.castShadow = true; border.receiveShadow = true;
    border.name = 'border';
    group.add(border);
  }

  // ---------------- fountain ----------------
  {
    const { x, z, basin } = ISLAND;
    const y0 = heightAt(x, z);
    kit.add(stone, lathe([[basin - 0.35, 0], [basin + 0.35, 0], [basin + 0.35, 0.45], [basin + 0.45, 0.5], [basin + 0.45, 0.62], [basin + 0.1, 0.66], [basin - 0.3, 0.62], [basin - 0.3, 0.2], [basin - 0.35, 0.2]], 64).translate(x, y0, z));
    const water = new THREE.Mesh(new THREE.CircleGeometry(basin - 0.28, 64).rotateX(-Math.PI / 2).translate(x, y0 + 0.46, z), waterMaterial());
    water.receiveShadow = true;
    group.add(water);
    const fountain = lathe([
      [0, 0], [0.75, 0], [0.75, 0.25], [0.5, 0.35], [0.38, 0.6], [0.32, 1.1], [0.42, 1.25], [1.5, 1.35], [1.62, 1.5], [1.5, 1.6], [0.5, 1.55],
      [0.24, 1.75], [0.2, 2.2], [0.3, 2.3], [0.85, 2.38], [0.9, 2.5], [0.8, 2.56], [0.25, 2.55], [0.12, 2.75], [0.16, 2.95], [0.07, 3.15], [0, 3.2],
    ], 40);
    kit.add(stone, fountain.translate(x, y0 + 0.2, z));
    // falling water: sheets from the two bowl lips (scrolling streaks)
    const sheetMat = new THREE.ShaderMaterial({
      uniforms: { uTime: shared.uTime, uSunColor: shared.uSunColor, uAmbUp: shared.uAmbUp },
      vertexShader: 'varying vec2 vUv; varying vec3 vN; void main(){ vUv = uv; vN = normalize(mat3(modelMatrix) * normal); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
      fragmentShader: /* glsl */`
        uniform float uTime; uniform vec3 uSunColor; uniform vec3 uAmbUp; varying vec2 vUv; varying vec3 vN;
        float h(vec2 p){ return fract(sin(dot(p, vec2(12.9, 78.2))) * 43758.5); }
        void main(){
          float s = h(vec2(floor(vUv.x * 160.0), 0.0));
          float streak = smoothstep(0.35, 1.0, fract(vUv.y * 3.0 + uTime * (1.6 + s) + s * 7.0));
          float a = (0.18 + 0.5 * streak) * smoothstep(0.0, 0.15, vUv.y) * (0.5 + 0.5 * s);
          vec3 c = uAmbUp * 1.2 + uSunColor * 0.12;
          gl_FragColor = vec4(c * a, a);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }`,
      transparent: true, depthWrite: false, side: THREE.DoubleSide,
      blending: THREE.CustomBlending, blendSrc: THREE.OneFactor, blendDst: THREE.OneMinusSrcAlphaFactor,
    });
    const sheet1 = new THREE.Mesh(new THREE.CylinderGeometry(1.6, 1.85, 1.25, 48, 1, true).translate(x, y0 + 0.2 + 1.5 - 0.62, z), sheetMat);
    const sheet2 = new THREE.Mesh(new THREE.CylinderGeometry(0.88, 1.02, 0.92, 32, 1, true).translate(x, y0 + 0.2 + 2.48 - 0.46, z), sheetMat);
    group.add(sheet1, sheet2);
    this_fountainTop = new THREE.Vector3(x, y0 + 3.45, z);
  }

  // ---------------- urns, sundial, benches, gates ----------------
  const urnG = lathe([[0, 0], [0.32, 0], [0.32, 0.1], [0.16, 0.16], [0.13, 0.28], [0.22, 0.36], [0.38, 0.58], [0.4, 0.76], [0.36, 0.9], [0.3, 0.95], [0.34, 1.0], [0.27, 1.05], [0.15, 1.08], [0, 1.08]], 24);
  for (const u of FEATURES.urns) {
    const y0 = heightAt(u.x, u.z);
    kit.add(stone, B(u.x - 0.55, u.x + 0.55, y0, y0 + 0.15, u.z - 0.55, u.z + 0.55));
    kit.add(stone, B(u.x - 0.42, u.x + 0.42, y0 + 0.15, y0 + 1.05, u.z - 0.42, u.z + 0.42));
    kit.add(stone, B(u.x - 0.5, u.x + 0.5, y0 + 1.05, y0 + 1.17, u.z - 0.5, u.z + 0.5));
    kit.add(stone, urnG.clone().applyMatrix4(M4.t(u.x, y0 + 1.17, u.z)));
  }
  {
    const s = FEATURES.sundial, y0 = heightAt(s.x, s.z);
    kit.add(stone, lathe([[0, 0], [0.42, 0], [0.42, 0.1], [0.3, 0.14], [0.18, 0.3], [0.13, 0.55], [0.17, 0.8], [0.22, 0.9], [0.32, 0.95], [0.34, 1.02], [0, 1.02]], 24).translate(s.x, y0, s.z));
    const bronze = new THREE.MeshStandardMaterial({ color: '#5f6b4a', metalness: 0.8, roughness: 0.45 });
    kit.add(bronze, new THREE.CylinderGeometry(0.3, 0.3, 0.02, 32).translate(s.x, y0 + 1.03, s.z));
    const gnomon = new THREE.Shape([new THREE.Vector2(0, 0), new THREE.Vector2(0.26, 0), new THREE.Vector2(0, 0.2)]);
    kit.add(bronze, new THREE.ExtrudeGeometry(gnomon, { depth: 0.012, bevelEnabled: false }).applyMatrix4(M4.c(M4.t(s.x, y0 + 1.04, s.z - 0.006), M4.ry(-Math.PI / 2))));
  }
  const teak = new THREE.MeshStandardMaterial({ color: '#a89276', roughness: 0.75 });
  const bench = benchGeometry();
  for (const b of FEATURES.benches) kit.add(teak, bench.clone().applyMatrix4(M4.c(M4.t(b.x, heightAt(b.x, b.z), b.z), M4.ry(b.rot))));
  // lodge gates at the end of the drive
  for (const z of [DRIVE.z0 - 0.6, DRIVE.z1 + 0.6]) {
    const x = DRIVE.x1 - 1.5, y0 = heightAt(x, z);
    kit.add(stone, B(x - 0.6, x + 0.6, y0, y0 + 3.4, z - 0.6, z + 0.6));
    kit.add(stone, B(x - 0.72, x + 0.72, y0 + 3.4, y0 + 3.6, z - 0.72, z + 0.72));
    kit.add(stone, new THREE.SphereGeometry(0.42, 16, 12).translate(x, y0 + 4.05, z));
  }
  const iron = paintMaterial('#141614', 0.5);
  for (let k = 0; k <= 30; k++) {
    const z = DRIVE.z0 + (k / 30) * (DRIVE.z1 - DRIVE.z0), x = DRIVE.x1 - 1.5;
    kit.add(iron, new THREE.CylinderGeometry(0.018, 0.018, 2.6, 5).translate(x, heightAt(x, z) + 1.3, z));
  }

  // ---------------- the ha-ha ----------------
  {
    const z = HAHA.z;
    for (let x = -118; x < 118; x += 4) {
      const y = heightAt(x + 2, z - 0.4);
      kit.add(stone, B(x, x + 4.02, y - HAHA.depth - 0.4, y - 0.04, z - 0.05, z + 0.32));
      kit.add(stone, B(x, x + 4.02, y - 0.06, y + 0.06, z - 0.18, z + 0.42));
    }
  }

  // ---------------- the horse ----------------
  {
    const s = FEATURES.statue, y0 = heightAt(s.x, s.z);
    kit.add(stone, B(s.x - 1.1, s.x + 1.1, y0, y0 + 0.3, s.z - 1.1, s.z + 1.1));
    kit.add(stone, B(s.x - 0.85, s.x + 0.85, y0 + 0.3, y0 + 2.1, s.z - 0.85, s.z + 0.85));
    kit.add(stone, B(s.x - 1.0, s.x + 1.0, y0 + 2.1, y0 + 2.32, s.z - 1.0, s.z + 1.0));
    try {
      const gltf = await new GLTFLoader().loadAsync('assets/models/horse/horse.gltf');
      const bronze = new THREE.MeshStandardMaterial({ color: '#4d5a45', metalness: 0.85, roughness: 0.42 });
      const verdigris = 'diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.32, 0.5, 0.42), smoothstep(0.25, 0.85, vNrmW.y) * 0.55);';
      bronze.onBeforeCompile = (sh) => {
        sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vNrmW;').replace('#include <beginnormal_vertex>', '#include <beginnormal_vertex>\nvNrmW = normalize(mat3(modelMatrix) * objectNormal);');
        sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec3 vNrmW;').replace('#include <color_fragment>', '#include <color_fragment>\n' + verdigris);
      };
      gltf.scene.traverse((o) => {
        if (!o.isMesh) return;
        if (/base/.test(o.material.name)) { o.visible = false; return; }
        o.material = bronze; o.castShadow = true; o.receiveShadow = true;
      });
      gltf.scene.scale.setScalar(13.5);
      gltf.scene.rotation.y = Math.PI * 0.5;
      gltf.scene.position.set(s.x, y0 + 2.32 - 0.14, s.z);
      group.add(gltf.scene);
    } catch (e) { console.warn('statue unavailable', e); }
  }

  // ---------------- ivy on the house ----------------
  if (quality.ivy && house) {
    const ivyMat = leafMaterial(leafClusterTexture('ivy', { seed: 13, count: 34, palette: ['#2f5220', '#3d6528', '#4b7630', '#365b24', '#5a8438'] }), { a2c, sway: 0.02, translucency: 0.4, alphaTest: 0.45 });
    const m = HOUSE.main, pv = HOUSE.pavilions[0];
    const patches = [
      { x0: m.x0 + 0.5, x1: m.x0 + 9, z: m.z1 + 0.02, top: 11.5 },     // west end of the main front
      { x0: pv.x0 + 0.2, x1: pv.x0 + 7, z: pv.z1 + 0.02, top: 8.5 },    // west pavilion
      { x0: m.x1 - 5, x1: m.x1 - 0.5, z: m.z1 + 0.02, top: 6.0 },
    ];
    const parts = [];
    for (const p of patches) {
      const W = p.x1 - p.x0;
      parts.push(cardsOver(Math.round(W * p.top * 13 * quality.leafDensity), (rr) => {
        const u = rr(), v = Math.pow(rr(), 0.6);
        // ragged top edge
        const top = p.top * (0.7 + 0.3 * Math.sin(u * 13.0) * Math.sin(u * 5.1 + 1));
        return { p: new THREE.Vector3(p.x0 + u * W, 0.2 + v * top, p.z), n: new THREE.Vector3(0, 0, 1) };
      }, 0.72, r));
    }
    const ivy = new THREE.Mesh(merge(parts), ivyMat);
    ivy.customDepthMaterial = ivyMat.userData.depth;
    ivy.castShadow = true; ivy.receiveShadow = true;
    ivy.name = 'ivy';
    group.add(ivy);
  }

  kit.build(group);
  scene.add(group);
  return { group, fountainTop: this_fountainTop };
}
let this_fountainTop = new THREE.Vector3();
