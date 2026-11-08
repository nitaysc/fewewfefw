// A Churchill: oily maduro wrapper, a printed band, a glowing ember that brightens when
// you draw on it, and ash that lengthens until you tap it off (or it falls by itself).
import * as THREE from '../../vendor/three.module.js';
import { canvasTexture } from '../core/textures.js';
import { rng } from '../core/util.js';

export const CIGAR_LEN = 0.145, CIGAR_R = 0.0094;

function wrapperTexture() {
  return canvasTexture(512, 256, (ctx, w, h) => {
    ctx.fillStyle = '#4b2c16'; ctx.fillRect(0, 0, w, h);
    const r = rng(21);
    // mottling
    for (let i = 0; i < 900; i++) {
      ctx.fillStyle = `rgba(${90 + r() * 40},${55 + r() * 25},${25 + r() * 15},${r() * 0.18})`;
      ctx.beginPath(); ctx.ellipse(r() * w, r() * h, 4 + r() * 22, 2 + r() * 8, r() * 3, 0, Math.PI * 2); ctx.fill();
    }
    // leaf veins running diagonally
    for (let i = 0; i < 46; i++) {
      const x = r() * w, y = r() * h, len = 40 + r() * 140;
      ctx.strokeStyle = `rgba(150,105,60,${0.15 + r() * 0.2})`; ctx.lineWidth = 0.8 + r() * 1.4;
      ctx.beginPath(); ctx.moveTo(x, y); ctx.quadraticCurveTo(x + len * 0.5, y + 6 - r() * 12, x + len, y + len * 0.35); ctx.stroke();
    }
    // the spiral seam of the wrapper leaf
    ctx.strokeStyle = 'rgba(30,16,8,0.6)'; ctx.lineWidth = 1.5;
    for (let k = -2; k < 4; k++) { ctx.beginPath(); ctx.moveTo(0, k * 90); ctx.lineTo(w, k * 90 + 180); ctx.stroke(); }
  }, { repeat: true });
}

function bandTexture() {
  return canvasTexture(512, 64, (ctx, w, h) => {
    ctx.fillStyle = '#7b1414'; ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#d9b25e'; ctx.fillRect(0, 4, w, 5); ctx.fillRect(0, h - 9, w, 5);
    ctx.fillStyle = '#f3e7c4'; ctx.font = '600 24px Georgia, serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('HOLLINGMERE  ·  RESERVA', w / 4, h / 2 + 1);
    ctx.fillText('HOLLINGMERE  ·  RESERVA', (3 * w) / 4, h / 2 + 1);
    ctx.fillStyle = '#d9b25e'; ctx.beginPath(); ctx.arc(w / 2, h / 2, 18, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#7b1414'; ctx.font = 'italic 700 22px Georgia, serif'; ctx.fillText('H', w / 2, h / 2 + 1);
  });
}

export class Cigar {
  constructor() {
    this.group = new THREE.Group();
    this.group.name = 'cigar';
    // body along +Z: head (mouth end) at z=0, foot at z=len
    this.len = CIGAR_LEN;
    this.burn = { value: CIGAR_LEN };
    const prof = [[0, 0], [0.0045, 0.0007], [0.0072, 0.0024], [0.0088, 0.0055], [0.0094, 0.01], [0.0095, CIGAR_LEN]];
    const body = new THREE.LatheGeometry(prof.map(([r, y]) => new THREE.Vector2(r, y)), 28, 0, Math.PI * 2);
    body.rotateX(Math.PI / 2); // lathe Y -> +Z
    const wtex = wrapperTexture();
    wtex.repeat.set(1, 1);
    const bodyMat = new THREE.MeshStandardMaterial({ map: wtex, roughness: 0.55, metalness: 0 });
    const uni = { uBurn: this.burn };
    bodyMat.onBeforeCompile = (s) => {
      Object.assign(s.uniforms, uni);
      s.vertexShader = s.vertexShader.replace('#include <common>', '#include <common>\nvarying float vZ;').replace('#include <begin_vertex>', '#include <begin_vertex>\nvZ = position.z;');
      s.fragmentShader = s.fragmentShader.replace('#include <common>', '#include <common>\nvarying float vZ; uniform float uBurn;')
        .replace('#include <clipping_planes_fragment>', '#include <clipping_planes_fragment>\nif (vZ > uBurn) discard;')
        .replace('#include <color_fragment>', '#include <color_fragment>\ndiffuseColor.rgb *= mix(1.0, 0.35, smoothstep(uBurn - 0.006, uBurn, vZ));');
    };
    this.body = new THREE.Mesh(body, bodyMat);
    // band
    const band = new THREE.Mesh(new THREE.CylinderGeometry(CIGAR_R + 0.0004, CIGAR_R + 0.0004, 0.015, 32, 1, true).rotateX(Math.PI / 2), new THREE.MeshStandardMaterial({ map: bandTexture(), roughness: 0.4, metalness: 0.1 }));
    band.position.z = 0.026;
    // ember: a disc on the burning face, its glow driven from the game
    this.glow = { value: 0.3 };
    this.time = { value: 0 };
    const emberMat = new THREE.ShaderMaterial({
      uniforms: { uGlow: this.glow, uTime: this.time },
      vertexShader: 'varying vec2 vP; void main(){ vP = position.xy / 0.0095; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
      fragmentShader: /* glsl */`
        uniform float uGlow, uTime; varying vec2 vP;
        float h(vec2 p){ return fract(sin(dot(p, vec2(41.3, 289.1))) * 43758.5); }
        float n(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.-2.*f); return mix(mix(h(i), h(i+vec2(1,0)), f.x), mix(h(i+vec2(0,1)), h(i+vec2(1,1)), f.x), f.y); }
        void main(){
          float r = length(vP);
          float t = n(vP * 5.0 + uTime * 0.7) * 0.6 + n(vP * 11.0 - uTime * 1.3) * 0.4;
          float heat = clamp(uGlow * (0.55 + 0.9 * t) * (1.15 - r * 0.5), 0.0, 3.0);
          vec3 c = mix(vec3(0.08, 0.07, 0.065), vec3(1.0, 0.25, 0.03), smoothstep(0.15, 0.6, heat));
          c = mix(c, vec3(1.0, 0.62, 0.22), smoothstep(0.7, 1.4, heat));
          c *= 1.0 + heat * 5.0;
          // grey ash flecks
          c = mix(c, vec3(0.32, 0.31, 0.3), smoothstep(0.62, 0.74, n(vP * 7.0 + 3.0)) * (1.0 - smoothstep(0.6, 1.2, heat)));
          gl_FragColor = vec4(c, 1.0);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }`,
    });
    this.ember = new THREE.Mesh(new THREE.CircleGeometry(CIGAR_R * 0.98, 24), emberMat);
    // ash: grey column beyond the ember
    this.ashLen = 0.004;
    const ashMat = new THREE.MeshStandardMaterial({ color: '#8e8a84', roughness: 1, metalness: 0 });
    const ashTex = canvasTexture(64, 256, (ctx, w, h) => {
      const r = rng(5);
      for (let y = 0; y < h; y++) { const v = 110 + r() * 70 + Math.sin(y * 0.35) * 25; ctx.fillStyle = `rgb(${v},${v - 4},${v - 8})`; ctx.fillRect(0, y, w, 1); }
      for (let i = 0; i < 300; i++) { ctx.fillStyle = `rgba(40,38,36,${r() * 0.5})`; ctx.fillRect(r() * w, r() * h, 1 + r() * 2, 1); }
    }, { repeat: true });
    ashMat.map = ashTex;
    this.ash = new THREE.Mesh(new THREE.CylinderGeometry(CIGAR_R * 0.97, CIGAR_R * 0.92, 1, 24, 1).rotateX(Math.PI / 2).translate(0, 0, 0.5), ashMat);
    this.light = new THREE.PointLight('#ff7a2a', 0, 0.35, 2);
    this.group.add(this.body, band, this.ember, this.ash, this.light);
    this.body.castShadow = true; band.castShadow = true;
    this.setBurn(CIGAR_LEN);
  }
  setBurn(z) {
    this.burn.value = z;
    this.ember.position.z = z + 0.0002;
    this.ash.position.z = z + 0.0003;
    this.ash.scale.set(1, 1, Math.max(0.0005, this.ashLen));
    this.ash.visible = this.ashLen > 0.0006;
    this.ember.visible = true;
    this.light.position.z = z + 0.01;
  }
  // world position of the burning tip
  tipWorld(out = new THREE.Vector3()) { return out.set(0, 0, this.burn.value + this.ashLen + 0.002).applyMatrix4(this.group.matrixWorld); }
  update(dt, glow) {
    this.time.value += dt;
    this.glow.value = glow;
    this.light.intensity = 0.02 + glow * 0.12;
    this.setBurn(this.burn.value);
  }
}
