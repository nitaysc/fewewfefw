// A bottle of estate ale: flint glass with condensation, a printed label, golden beer and
// a foam head. The liquid surface stays level however the bottle is tilted: its height is
// found each frame from sample points spread through the bottle's volume.
import * as THREE from '../../vendor/three.module.js';
import { canvasTexture } from '../core/textures.js';
import { rng } from '../core/util.js';

// outer profile [radius, height] (metres); the glass is ~2.5 mm thick
const OUTER = [[0.0, 0.0035], [0.022, 0.0], [0.0295, 0.0008], [0.0318, 0.004], [0.0324, 0.012], [0.0324, 0.132], [0.0318, 0.142],
  [0.0292, 0.156], [0.0245, 0.169], [0.019, 0.181], [0.0152, 0.192], [0.0136, 0.203], [0.0132, 0.214], [0.0137, 0.219],
  [0.0149, 0.222], [0.0151, 0.2275], [0.0143, 0.2305], [0.0122, 0.2318], [0.0102, 0.2312]];
export const BOTTLE_H = 0.2318;
const innerR = (y) => {
  // inner radius at height y
  for (let i = 1; i < OUTER.length; i++) {
    const [r0, y0] = OUTER[i - 1], [r1, y1] = OUTER[i];
    if (y >= y0 && y <= y1) return Math.max(0, r0 + (r1 - r0) * ((y - y0) / Math.max(y1 - y0, 1e-6)) - 0.0026);
  }
  return 0;
};
const LIQ_TOP = 0.226; // the liquid can reach into the neck

function labelTexture() {
  return canvasTexture(1024, 512, (ctx, w, h) => {
    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, '#efe4c6'); g.addColorStop(1, '#e2d3ae');
    ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
    // paper fibres
    const r = rng(3);
    for (let i = 0; i < 1800; i++) { ctx.fillStyle = `rgba(120,95,60,${r() * 0.05})`; ctx.fillRect(r() * w, r() * h, 1 + r() * 3, 1); }
    ctx.strokeStyle = '#1d3a28'; ctx.lineWidth = 10; ctx.strokeRect(22, 22, w - 44, h - 44);
    ctx.strokeStyle = '#a8823c'; ctx.lineWidth = 3; ctx.strokeRect(40, 40, w - 80, h - 80);
    const cx = w * 0.38;
    // a simple crest: shield with a chevron and three acorns
    ctx.save(); ctx.translate(cx, 175);
    ctx.fillStyle = '#1d3a28';
    ctx.beginPath(); ctx.moveTo(-58, -62); ctx.lineTo(58, -62); ctx.lineTo(58, 8); ctx.quadraticCurveTo(58, 62, 0, 84); ctx.quadraticCurveTo(-58, 62, -58, 8); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = '#c9a457'; ctx.lineWidth = 5; ctx.stroke();
    ctx.fillStyle = '#c9a457'; ctx.beginPath(); ctx.moveTo(-50, 30); ctx.lineTo(0, -12); ctx.lineTo(50, 30); ctx.lineTo(50, 46); ctx.lineTo(0, 4); ctx.lineTo(-50, 46); ctx.fill();
    for (const [x, y] of [[-30, -36], [30, -36], [0, 52]]) { ctx.beginPath(); ctx.ellipse(x, y, 8, 11, 0, 0, Math.PI * 2); ctx.fill(); }
    ctx.restore();
    ctx.fillStyle = '#1d3a28'; ctx.textAlign = 'center';
    ctx.font = '700 64px Georgia, serif'; ctx.fillText('HOLLINGMERE', cx, 330);
    ctx.font = 'italic 44px Georgia, serif'; ctx.fillStyle = '#7a2a1a'; ctx.fillText('Estate Pale Ale', cx, 384);
    ctx.font = '22px Georgia, serif'; ctx.fillStyle = '#3a2d1d'; ctx.fillText('BREWED AT THE HOME FARM SINCE 1784', cx, 428);
    ctx.font = '600 26px Georgia, serif'; ctx.fillText('4.2% vol   ·   330 ml', cx, 466);
    // back of the label: small print
    ctx.textAlign = 'left'; ctx.font = '19px Georgia, serif'; ctx.fillStyle = '#4a3a28';
    const lines = ['Brewed with Maris Otter malt', 'and Fuggles hops grown on', 'the estate. Best enjoyed', 'cool, on a summer lawn,', 'by a gentleman at his ease.'];
    lines.forEach((l, i) => ctx.fillText(l, w * 0.72, 150 + i * 30));
  });
}

function dropletNormals(size = 256, seed = 9) {
  const data = new Uint8Array(size * size * 4);
  for (let i = 0; i < size * size; i++) { data[i * 4] = 128; data[i * 4 + 1] = 128; data[i * 4 + 2] = 255; data[i * 4 + 3] = 255; }
  const r = rng(seed);
  for (let n = 0; n < 260; n++) {
    const cx = r() * size, cy = r() * size, rad = 1.5 + r() * r() * 7, el = 1 + r() * 0.6;
    for (let y = -rad * el; y <= rad * el; y++) for (let x = -rad; x <= rad; x++) {
      const nx = x / rad, ny = y / (rad * el), d2 = nx * nx + ny * ny;
      if (d2 > 1) continue;
      const nz = Math.sqrt(1 - d2);
      const px = ((Math.floor(cx + x) % size) + size) % size, py = ((Math.floor(cy + y) % size) + size) % size;
      const k = (py * size + px) * 4;
      data[k] = Math.round((nx * 0.8 * 0.5 + 0.5) * 255); data[k + 1] = Math.round((-ny * 0.8 * 0.5 + 0.5) * 255); data[k + 2] = Math.round(nz * 255);
    }
  }
  const t = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.generateMipmaps = true; t.minFilter = THREE.LinearMipmapLinearFilter; t.magFilter = THREE.LinearFilter;
  t.needsUpdate = true;
  return t;
}

export class Bottle {
  constructor() {
    this.group = new THREE.Group();
    this.group.name = 'bottle';
    const pts = OUTER.map(([r, y]) => new THREE.Vector2(r, y));
    const glassGeo = new THREE.LatheGeometry(pts, 48);
    const drops = dropletNormals();
    // Glass: mostly reflection. Coverage rises towards the silhouette (Fresnel), and the
    // reflected light is added on top (premultiplied blending), as real glass looks.
    const glassMat = new THREE.MeshPhysicalMaterial({
      color: '#1c2a1a', roughness: 0.035, metalness: 0, transparent: true,
      envMapIntensity: 1.15, clearcoat: 0.6, clearcoatRoughness: 0.02, specularIntensity: 1,
      normalMap: drops, normalScale: new THREE.Vector2(0.45, 0.45), depthWrite: false,
      blending: THREE.CustomBlending, blendSrc: THREE.OneFactor, blendDst: THREE.OneMinusSrcAlphaFactor,
    });
    glassMat.onBeforeCompile = (sh) => {
      sh.fragmentShader = sh.fragmentShader.replace('#include <opaque_fragment>', `
        float fres = pow(1.0 - clamp(abs(dot(normalize(normal), normalize(vViewPosition))), 0.0, 1.0), 2.5);
        float cover = mix(0.08, 0.6, fres);
        gl_FragColor = vec4(outgoingLight * mix(0.45, 0.9, fres) + vec3(0.02, 0.035, 0.02) * cover, cover);`);
    };
    this.glass = new THREE.Mesh(glassGeo, glassMat);
    drops.repeat.set(3, 4);
    this.glass.renderOrder = 5;
    // neck opening (dark mouth so you can see down into it)
    const mouth = new THREE.Mesh(new THREE.RingGeometry(0.0, 0.0101, 24).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: '#2a1d0c' }));
    mouth.position.y = 0.2306;
    // liquid: inner volume clipped by a world-space level
    const inner = [];
    for (let y = 0.0042; y <= LIQ_TOP; y += 0.002) inner.push(new THREE.Vector2(innerR(y), y));
    inner.unshift(new THREE.Vector2(0, 0.0042));
    const liqGeo = new THREE.LatheGeometry(inner, 40);
    this.level = { value: 1 };     // world-space Y of the surface
    const uni = { uLevel: this.level, uFoam: { value: 0.012 } };
    const liqMat = new THREE.MeshPhysicalMaterial({ color: '#d99a2b', roughness: 0.25, metalness: 0, side: THREE.DoubleSide, sheen: 0.4, sheenColor: new THREE.Color('#ffcf6a'), emissive: '#3a1c02', clearcoat: 0.6 });
    liqMat.onBeforeCompile = (s) => {
      Object.assign(s.uniforms, uni);
      s.vertexShader = s.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vWP;')
        .replace('#include <fog_vertex>', '#include <fog_vertex>\nvWP = (modelMatrix * vec4(transformed, 1.0)).xyz;');
      s.fragmentShader = s.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec3 vWP;\nuniform float uLevel; uniform float uFoam;')
        .replace('#include <clipping_planes_fragment>', '#include <clipping_planes_fragment>\nif (vWP.y > uLevel) discard;\nfloat foam = smoothstep(uLevel - uFoam, uLevel - uFoam * 0.6, vWP.y);')
        .replace('#include <color_fragment>', `#include <color_fragment>
          if (!gl_FrontFacing) foam = 1.0;
          diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.93, 0.86, 0.7), foam);`)
        .replace('#include <normal_fragment_begin>', `#include <normal_fragment_begin>
          if (!gl_FrontFacing) normal = normalize((viewMatrix * vec4(0.0, 1.0, 0.0, 0.0)).xyz);`)
        .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\ntotalEmissiveRadiance *= (1.0 - foam);');
    };
    this.liquid = new THREE.Mesh(liqGeo, liqMat);
    this.liquid.renderOrder = 4;
    // labels
    const lab = new THREE.Mesh(new THREE.CylinderGeometry(0.0327, 0.0327, 0.072, 48, 1, true, -Math.PI * 0.82, Math.PI * 1.64), new THREE.MeshStandardMaterial({ map: labelTexture(), roughness: 0.75 }));
    lab.position.y = 0.074;
    const neckLab = new THREE.Mesh(new THREE.CylinderGeometry(0.0141, 0.0156, 0.016, 32, 1, true), new THREE.MeshStandardMaterial({ color: '#1d3a28', roughness: 0.5, metalness: 0.3 }));
    neckLab.position.y = 0.196;
    const foil = new THREE.Mesh(new THREE.CylinderGeometry(0.0152, 0.0149, 0.004, 32, 1, true), new THREE.MeshStandardMaterial({ color: '#c9a457', metalness: 1, roughness: 0.25 }));
    foil.position.y = 0.2045;
    this.group.add(this.liquid, lab, neckLab, foil, mouth, this.glass);
    this.group.traverse((o) => { if (o.isMesh) { o.castShadow = o !== this.glass; o.receiveShadow = true; } });

    // volume samples for the level solver
    const r = rng(17);
    const vol = [];
    let tries = 0;
    while (vol.length < 2400 && tries < 100000) {
      tries++;
      const y = 0.0045 + r() * (LIQ_TOP - 0.0045), x = (r() * 2 - 1) * 0.03, z = (r() * 2 - 1) * 0.03;
      if (Math.hypot(x, z) < innerR(y)) vol.push(x, y, z);
    }
    this.samples = new Float32Array(vol);
    this.heights = new Float32Array(vol.length / 3);
    this.fill = 1;        // 0..1 of 330 ml
    this.fullFrac = 0.93; // a freshly opened bottle is not full to the brim
  }

  // Find the world-space surface height for the current fill and orientation.
  updateLevel() {
    const m = this.group.matrixWorld.elements;
    // world y of a local point = m[1]*x + m[5]*y + m[9]*z + m[13]
    const n = this.heights.length;
    const s = this.samples;
    for (let i = 0; i < n; i++) this.heights[i] = m[1] * s[i * 3] + m[5] * s[i * 3 + 1] + m[9] * s[i * 3 + 2];
    const f = this.fill * this.fullFrac;
    if (f <= 0.001) { this.level.value = -1e4; return; }
    const sorted = this.heights.slice().sort();
    const k = Math.min(n - 1, Math.floor(f * n));
    this.level.value = sorted[k] + m[13];
  }
  // world position of the mouth of the bottle
  mouthWorld(out = new THREE.Vector3()) { return out.set(0, BOTTLE_H, 0).applyMatrix4(this.group.matrixWorld); }
}
