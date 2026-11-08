// Trees: grown by recursive branching (oak, lime, and a tiered cedar of Lebanon), with
// bark-textured limbs and leaf-card crowns, instanced around the park; far woods are
// billboards rendered from the same trees.
import * as THREE from '../../vendor/three.module.js';
import { tex } from '../core/textures.js';
import { rng } from '../core/util.js';
import { leafClusterTexture, needleTexture, leafMaterial } from './foliage.js';
import { heightAt, FEATURES, HAHA } from './layout.js';

const SPECS = {
  oak: {
    height: 4.2, trunkR: 0.55, depth: 3, segLen: [1.2, 1.0, 0.7, 0.5], up: [0.04, -0.01, 0.02, 0.03], wiggle: [0.25, 0.45, 0.55, 0.6],
    children: [0.9, 1.6, 2.4], lenRatio: [0.8, 0.62, 0.55], radRatio: [0.5, 0.48, 0.5], spread: [1.05, 0.85, 0.75], len0: 7.5,
    leafSize: 1.5, leafPer: 2.2, leafDepth: 2, crown: 'oak', taper: 0.55,
  },
  lime: {
    height: 9.0, trunkR: 0.42, depth: 3, segLen: [1.5, 1.1, 0.8, 0.6], up: [0.12, 0.09, 0.07, 0.05], wiggle: [0.12, 0.3, 0.45, 0.55],
    children: [1.2, 1.5, 2.2], lenRatio: [0.62, 0.6, 0.55], radRatio: [0.45, 0.45, 0.5], spread: [0.7, 0.75, 0.75], len0: 6.0,
    leafSize: 1.35, leafPer: 2.4, leafDepth: 2, crown: 'lime', taper: 0.6,
  },
  cedar: {
    height: 3.4, trunkR: 0.75, depth: 2, segLen: [1.4, 1.1, 0.8], up: [0.0, -0.02, 0.0], wiggle: [0.15, 0.25, 0.3],
    children: [0.75, 1.4], lenRatio: [0.95, 0.42], radRatio: [0.4, 0.4], spread: [1.45, 1.2], len0: 10.5,
    leafSize: 2.4, leafPer: 2.6, leafDepth: 1, crown: 'cedar', taper: 0.65, tiers: true,
  },
};

function grow(spec, seed, detail = 1) {
  const r = rng(seed);
  const segs = [], cards = [];
  const up = new THREE.Vector3(0, 1, 0);
  const randPerp = (d) => {
    const a = new THREE.Vector3(r() - 0.5, r() - 0.5, r() - 0.5).cross(d).normalize();
    return a.lengthSq() > 0 ? a : new THREE.Vector3(1, 0, 0);
  };
  const branch = (p, d, len, rad, depth) => {
    const n = Math.max(2, Math.round(len / spec.segLen[depth]));
    let cur = p.clone();
    const dir = d.clone();
    for (let i = 0; i < n; i++) {
      dir.add(new THREE.Vector3((r() - 0.5) * spec.wiggle[depth], spec.up[depth], (r() - 0.5) * spec.wiggle[depth])).normalize();
      const next = cur.clone().addScaledVector(dir, len / n);
      const t0 = i / n, t1 = (i + 1) / n;
      const r0 = rad * (1 - t0 * spec.taper), r1 = rad * (1 - t1 * spec.taper);
      segs.push({ a: cur.clone(), b: next.clone(), r0, r1, depth });
      // children
      if (depth < spec.depth && (depth > 0 || t0 > 0.25 || spec.tiers)) {
        let k = spec.children[depth] * (len / n) * (spec.tiers && depth === 0 ? 1.0 : 1);
        while (k > 0) {
          if (r() < k) {
            let cd;
            if (spec.tiers && depth === 0) {
              // cedar: near-horizontal limbs in tiers
              const a = r() * Math.PI * 2;
              cd = new THREE.Vector3(Math.cos(a), 0.18 + r() * 0.1, Math.sin(a)).normalize();
            } else {
              cd = dir.clone().applyAxisAngle(randPerp(dir), spec.spread[depth] * (0.6 + r() * 0.6));
              if (depth === 0) cd.y = Math.max(cd.y, 0.05 + r() * 0.3);
              cd.normalize();
            }
            const tl = len * spec.lenRatio[depth] * (0.6 + r() * 0.5) * (spec.tiers && depth === 0 ? (1.15 - t0 * 0.85) : 1);
            branch(next, cd, tl, Math.max(0.02, r1 * spec.radRatio[depth] * (0.8 + r() * 0.4) * 2), depth + 1);
          }
          k -= 1;
        }
      }
      // leaves along the outer branches
      if (depth >= spec.leafDepth) {
        const m = spec.leafPer * detail * (len / n);
        for (let c = 0; c < m || (c === 0 && r() < m); c++) {
          if (c >= m && r() > m - Math.floor(m)) break;
          const pos = cur.clone().lerp(next, r()).add(new THREE.Vector3((r() - 0.5) * 1.2, (r() - 0.3) * 0.9, (r() - 0.5) * 1.2).multiplyScalar(spec.leafSize * 0.6));
          cards.push({ pos, size: spec.leafSize * (0.75 + r() * 0.5), rot: r() * Math.PI * 2, tilt: r(), flat: !!spec.tiers });
        }
      }
      cur = next;
    }
  };
  branch(new THREE.Vector3(0, 0, 0), up.clone(), spec.len0, spec.trunkR, 0);
  // the trunk continues up through the crown for the broadleaves
  return { segs, cards };
}

function barkGeometry(segs, minR = 0.025) {
  const pos = [], nor = [], uv = [], idx = [];
  const tmp = new THREE.Vector3(), q = new THREE.Quaternion(), Y = new THREE.Vector3(0, 1, 0);
  let vOff = 0;
  for (const s of segs) {
    if (s.r1 < minR && s.depth > 1) continue;
    const radial = s.depth === 0 ? 9 : s.depth === 1 ? 6 : 4;
    const d = new THREE.Vector3().subVectors(s.b, s.a);
    const L = d.length();
    q.setFromUnitVectors(Y, d.normalize());
    const base = pos.length / 3;
    for (let ring = 0; ring < 2; ring++) {
      const rr = ring ? s.r1 : s.r0, c = ring ? s.b : s.a;
      // flare the trunk at the ground
      const flare = s.depth === 0 && c.y < 1.2 ? 1 + (1.2 - c.y) * 0.45 : 1;
      for (let k = 0; k <= radial; k++) {
        const a = (k / radial) * Math.PI * 2;
        tmp.set(Math.cos(a), 0, Math.sin(a)).applyQuaternion(q);
        pos.push(c.x + tmp.x * rr * flare, c.y + tmp.y * rr * flare, c.z + tmp.z * rr * flare);
        nor.push(tmp.x, tmp.y, tmp.z);
        uv.push((k / radial) * Math.max(1, Math.round(rr * 6)), vOff + ring * L / 1.6);
      }
    }
    for (let k = 0; k < radial; k++) {
      const a = base + k, b = base + k + 1, c = base + radial + 1 + k, e = base + radial + 2 + k;
      idx.push(a, c, b, b, c, e);
    }
    vOff += L / 1.6;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  return g;
}

function cardGeometry(cards, center) {
  const pos = [], nor = [], uv = [], idx = [];
  const q = new THREE.Quaternion(), e = new THREE.Euler(), v = new THREE.Vector3(), n = new THREE.Vector3();
  const corners = [[-0.5, -0.5, 0, 0], [0.5, -0.5, 1, 0], [0.5, 0.5, 1, 1], [-0.5, 0.5, 0, 1]];
  for (const c of cards) {
    if (c.flat) e.set(-Math.PI / 2 + (c.tilt - 0.5) * 0.5, c.rot, 0, 'YXZ');
    else e.set((c.tilt - 0.5) * 1.6, c.rot, (c.tilt - 0.5) * 1.2, 'YXZ');
    q.setFromEuler(e);
    // soft volumetric shading: normals point out of the crown
    n.subVectors(c.pos, center); n.y *= 0.6; n.normalize();
    if (c.flat) n.lerp(new THREE.Vector3(0, 1, 0), 0.65).normalize();
    const b = pos.length / 3;
    for (const [x, y, u, w] of corners) {
      v.set(x * c.size, y * c.size, 0).applyQuaternion(q).add(c.pos);
      pos.push(v.x, v.y, v.z); nor.push(n.x, n.y, n.z); uv.push(u, w);
    }
    idx.push(b, b + 1, b + 2, b, b + 2, b + 3);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  return g;
}

function makeType(name, seed, detail, mats) {
  const spec = SPECS[name];
  const { segs, cards } = grow(spec, seed, detail);
  const box = new THREE.Box3();
  cards.forEach((c) => box.expandByPoint(c.pos));
  const center = box.getCenter(new THREE.Vector3());
  return { name, bark: barkGeometry(segs), leaves: cardGeometry(cards, center), height: box.max.y, radius: Math.max(box.max.x - box.min.x, box.max.z - box.min.z) / 2, mats };
}

export class Trees {
  constructor({ scene, quality, renderer }) {
    this.group = new THREE.Group();
    this.group.name = 'trees';
    const detail = quality.treeDetail;
    const bark = new THREE.MeshStandardMaterial({ map: tex('bark_diff', { repeat: [1, 1] }), normalMap: tex('bark_nor'), roughnessMap: tex('bark_arm'), color: '#b9ab96', roughness: 1 });
    const a2c = (quality.msaa || 0) > 0;
    const oakLeaf = leafMaterial(leafClusterTexture('oak', { seed: 4 }), { a2c, sway: 0.1 });
    const limeLeaf = leafMaterial(leafClusterTexture('lime', { seed: 8 }), { a2c, sway: 0.13 });
    const cedarLeaf = leafMaterial(needleTexture({ seed: 2, color: '#203a2a', light: '#3f5d44', density: 1.2 }), { a2c, sway: 0.05, translucency: 0.5, color: '#c9d4c4' });
    this.types = {
      oakA: makeType('oak', 11, detail, { bark, leaf: oakLeaf }),
      oakB: makeType('oak', 23, detail, { bark, leaf: oakLeaf }),
      lime: makeType('lime', 5, detail, { bark, leaf: limeLeaf }),
      cedar: makeType('cedar', 3, detail, { bark, leaf: cedarLeaf }),
    };
    this.placements = { oakA: [], oakB: [], lime: [], cedar: [] };
    const r = rng(1234);
    // the generated trees are about 60% of a mature parkland tree: scale them up
    const put = (type, x, z, s = 1, rot = r() * Math.PI * 2) => this.placements[type].push({ x, z, s: s * (type === 'cedar' ? 1.0 : 1.45), rot });
    // specimen trees on the lawn
    put('cedar', FEATURES.cedar.x, FEATURES.cedar.z, 1.6, 0.4);
    put('oakA', FEATURES.oak.x, FEATURES.oak.z, 1.6, 1.2);
    // belts beyond the hedges
    for (let z = -20; z < 125; z += 13 + r() * 6) {
      put(r() < 0.5 ? 'oakA' : 'lime', -84 - r() * 14, z, 0.9 + r() * 0.35);
      put(r() < 0.5 ? 'oakB' : 'lime', 86 + r() * 14, z + 4, 0.9 + r() * 0.35);
      if (r() < 0.6) put(r() < 0.5 ? 'oakB' : 'lime', -103 - r() * 14, z + 6, 0.95 + r() * 0.3);
      if (r() < 0.6) put(r() < 0.5 ? 'oakA' : 'lime', 105 + r() * 14, z + 2, 0.95 + r() * 0.3);
    }
    // woods behind the house
    for (let x = -120; x <= 120; x += 12 + r() * 8) {
      put(r() < 0.55 ? 'lime' : 'oakB', x, -108 - r() * 10, 1.0 + r() * 0.35);
      if (r() < 0.7) put(r() < 0.5 ? 'lime' : 'oakA', x + 5, -122 - r() * 6, 1.0 + r() * 0.3);
    }
    // lime avenue along the east drive
    for (let x = 52; x <= 124; x += 9) { put('lime', x, -49.5, 0.95, r() * 6); put('lime', x + 4.5, -30.5, 0.95, r() * 6); }
    // parkland beyond the ha-ha
    const park = [[-48, 92], [-18, 104], [16, 96], [52, 110], [-80, 118], [84, 92], [30, 122], [-40, 124]];
    park.forEach(([x, z], i) => put(i === 3 ? 'cedar' : i % 2 ? 'oakA' : 'oakB', x, z, 1.0 + r() * 0.35));
    // flanking the forecourt
    for (const sx of [-1, 1]) { put('oakB', sx * 62, -44, 1.05); put('lime', sx * 60, -64, 1.0); put('oakA', sx * 66, -88, 1.1); }

    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), p = new THREE.Vector3();
    for (const [key, list] of Object.entries(this.placements)) {
      if (!list.length) continue;
      const T = this.types[key];
      const barkM = new THREE.InstancedMesh(T.bark, T.mats.bark, list.length);
      const leafM = new THREE.InstancedMesh(T.leaves, T.mats.leaf, list.length);
      leafM.customDepthMaterial = T.mats.leaf.userData.depth;
      list.forEach((pl, i) => {
        p.set(pl.x, heightAt(pl.x, pl.z) - 0.15, pl.z);
        q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), pl.rot);
        s.setScalar(pl.s);
        m4.compose(p, q, s);
        barkM.setMatrixAt(i, m4); leafM.setMatrixAt(i, m4);
      });
      for (const mm of [barkM, leafM]) { mm.castShadow = true; mm.receiveShadow = true; mm.computeBoundingSphere(); this.group.add(mm); }
      barkM.name = `bark-${key}`; leafM.name = `leaves-${key}`;
    }
    scene.add(this.group);
    this.makeFarWoods(scene, renderer, quality);
  }

  // Render each tree type to a texture once, then scatter billboards over the countryside.
  makeFarWoods(scene, renderer, quality) {
    const types = ['oakA', 'lime', 'oakB', 'cedar'];
    const S = 256;
    const rt = new THREE.WebGLRenderTarget(S * types.length, S, { samples: 4 });
    const sc = new THREE.Scene();
    sc.environment = scene.environment; sc.environmentIntensity = scene.environmentIntensity;
    const sun = new THREE.DirectionalLight(0xffffff, 3.0);
    sun.position.set(0.5, 0.8, 0.6); sc.add(sun, new THREE.HemisphereLight('#b8c8e0', '#3a4a2a', 1.2));
    const prevT = renderer.getRenderTarget(), prevCol = new THREE.Color(), prevA = renderer.getClearAlpha();
    renderer.getClearColor(prevCol);
    renderer.setRenderTarget(rt);
    renderer.setClearColor(0x000000, 0);
    renderer.clear();
    const dims = [];
    types.forEach((k, i) => {
      const T = this.types[k];
      const g = new THREE.Group();
      g.add(new THREE.Mesh(T.bark, T.mats.bark), new THREE.Mesh(T.leaves, T.mats.leaf));
      sc.add(g);
      const h = T.height + 1, w = Math.max(T.radius * 2 + 1, h * 0.6);
      const size = Math.max(h, w);
      const cam = new THREE.OrthographicCamera(-size / 2, size / 2, size, 0, -100, 100);
      cam.position.set(0, 0, 30); cam.lookAt(0, 0, 0);
      renderer.setViewport(i * S, 0, S, S);
      renderer.setScissor(i * S, 0, S, S); renderer.setScissorTest(true);
      renderer.render(sc, cam);
      sc.remove(g);
      dims.push(size);
    });
    renderer.setScissorTest(false);
    renderer.setRenderTarget(prevT);
    renderer.setClearColor(prevCol, prevA);
    const size = renderer.getSize(new THREE.Vector2());
    renderer.setViewport(0, 0, size.x, size.y);
    const atlas = rt.texture;
    // billboard instances
    const r = rng(77);
    const inst = [];
    const clumps = 70;
    for (let c = 0; c < clumps; c++) {
      const ang = r() * Math.PI * 2, rad = 150 + Math.pow(r(), 0.8) * 1100;
      const cx = Math.cos(ang) * rad, cz = Math.sin(ang) * rad;
      if (cz < -80 && Math.abs(cx) < 140 && rad < 260) continue;
      const n = 3 + Math.floor(r() * 12);
      for (let i = 0; i < n && inst.length < quality.farTrees; i++) {
        const x = cx + (r() - 0.5) * 70, z = cz + (r() - 0.5) * 70;
        if (Math.abs(x) < 132 && Math.abs(z) < 132) continue;
        const t = Math.floor(r() * 3) + (r() < 0.08 ? 1 : 0);
        inst.push([x, heightAt(x, z) - 0.5, z, dims[t] * (0.85 + r() * 0.4), t]);
      }
    }
    const g = new THREE.InstancedBufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute([-0.5, 0, 0, 0.5, 0, 0, 0.5, 1, 0, -0.5, 1, 0], 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute([0, 0, 1, 0, 1, 1, 0, 1], 2));
    g.setIndex([0, 1, 2, 0, 2, 3]);
    const buf = new THREE.InstancedInterleavedBuffer(new Float32Array(inst.flat()), 5);
    g.setAttribute('aInst', new THREE.InterleavedBufferAttribute(buf, 3, 0));
    g.setAttribute('aSize', new THREE.InterleavedBufferAttribute(buf, 1, 3));
    g.setAttribute('aType', new THREE.InterleavedBufferAttribute(buf, 1, 4));
    g.instanceCount = inst.length;
    const mat = new THREE.ShaderMaterial({
      uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, { tAtlas: { value: null }, uN: { value: types.length } }]),
      vertexShader: /* glsl */`
        #include <common>
        #include <fog_pars_vertex>
        attribute vec3 aInst; attribute float aSize; attribute float aType;
        uniform float uN;
        varying vec2 vUv;
        void main() {
          vUv = vec2((uv.x + aType) / uN, uv.y);
          vec3 toCam = cameraPosition - aInst; toCam.y = 0.0; toCam = normalize(toCam);
          vec3 right = vec3(toCam.z, 0.0, -toCam.x);
          vec3 wp = aInst + right * position.x * aSize + vec3(0.0, position.y * aSize, 0.0);
          vec4 mvPosition = viewMatrix * vec4(wp, 1.0);
          gl_Position = projectionMatrix * mvPosition;
          #include <fog_vertex>
        }`,
      fragmentShader: /* glsl */`
        #include <common>
        #include <fog_pars_fragment>
        uniform sampler2D tAtlas; varying vec2 vUv;
        void main() {
          vec4 c = texture2D(tAtlas, vUv);
          if (c.a < 0.5) discard;
          gl_FragColor = vec4(c.rgb * 0.9 / max(c.a, 0.5), 1.0);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
          #include <fog_fragment>
        }`,
      fog: true,
    });
    mat.uniforms.tAtlas.value = atlas;
    const mesh = new THREE.Mesh(g, mat);
    mesh.frustumCulled = false;
    mesh.name = 'far-woods';
    scene.add(mesh);
    this.far = mesh;
  }
}
