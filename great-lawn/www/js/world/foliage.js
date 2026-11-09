// Foliage: painted leaf-cluster textures and a leaf material that keeps outward-facing
// normals on both sides of a card, lets the sun glow through, and sways in the wind.
import * as THREE from '../../vendor/three.module.js';
import { canvasTexture } from '../core/textures.js';
import { shared } from '../core/shared.js';
import { rng } from '../core/util.js';

function leafShape(ctx, kind, r) {
  ctx.beginPath();
  if (kind === 'oak') {
    // lobed oak leaf along +y
    const lobes = 4;
    ctx.moveTo(0, 0);
    for (let i = 0; i <= lobes; i++) {
      const y = 0.15 + (i / lobes) * 0.85, w = 0.22 + 0.16 * Math.sin((i / lobes) * Math.PI);
      ctx.quadraticCurveTo(w * 1.3, y - 0.12, w, y);
      if (i < lobes) ctx.quadraticCurveTo(w * 0.55, y + 0.04, w * 0.95, y + 0.1);
    }
    ctx.quadraticCurveTo(0.05, 1.08, 0, 1.06);
    for (let i = lobes; i >= 0; i--) {
      const y = 0.15 + (i / lobes) * 0.85, w = 0.22 + 0.16 * Math.sin((i / lobes) * Math.PI);
      if (i < lobes) ctx.quadraticCurveTo(-w * 0.55, y + 0.04, -w * 0.95, y + 0.1);
      ctx.quadraticCurveTo(-w * 1.3, y - 0.12, -w, y);
    }
    ctx.closePath();
  } else if (kind === 'lime') {
    ctx.moveTo(0, 0); ctx.bezierCurveTo(0.55, 0.1, 0.5, 0.75, 0, 1.0); ctx.bezierCurveTo(-0.5, 0.75, -0.6, 0.15, 0, 0);
  } else if (kind === 'ivy') {
    ctx.moveTo(0, 0); ctx.lineTo(0.35, 0.35); ctx.lineTo(0.5, 0.3); ctx.lineTo(0.38, 0.6); ctx.lineTo(0.0, 1.0); ctx.lineTo(-0.38, 0.6); ctx.lineTo(-0.5, 0.3); ctx.lineTo(-0.35, 0.35); ctx.closePath();
  }
  void r;
}

// A cluster of leaves on a transparent card.
export function leafClusterTexture(kind = 'oak', { count = kind === 'ivy' ? 46 : 150, seed = 1, palette } = {}) {
  const pal = palette || (kind === 'oak' ? ['#3a5a20', '#4a6a26', '#58782c', '#33501c', '#6a8a36', '#2c4719', '#7a9640'] : kind === 'lime' ? ['#4c6e26', '#5c802e', '#6c9036', '#44641f', '#7e9c40', '#3a5a1c'] : ['#22381a', '#2c4520', '#365226', '#1d3016']);
  return canvasTexture(512, 512, (ctx, w, h) => {
    const r = rng(seed);
    ctx.clearRect(0, 0, w, h);
    // twigs
    ctx.strokeStyle = '#3b2b1a'; ctx.lineWidth = 3;
    for (let i = 0; i < 5; i++) {
      ctx.beginPath(); ctx.moveTo(w / 2, h * 0.95);
      ctx.quadraticCurveTo(w * (0.3 + r() * 0.4), h * 0.6, w * (0.12 + r() * 0.76), h * (0.1 + r() * 0.35)); ctx.stroke();
    }
    // many smaller leaves, back ones darker, front ones catching the light, so a crown
    // reads as foliage rather than a pattern of scales
    for (let i = 0; i < count; i++) {
      const ang = r() * Math.PI * 2, rad = Math.sqrt(r()) * 0.42;
      const x = w / 2 + Math.cos(ang) * rad * w, y = h / 2 + Math.sin(ang) * rad * h;
      const s = kind === 'ivy' ? 60 + r() * 40 : 38 + r() * 26;
      const front = i / count;
      ctx.save(); ctx.translate(x, y); ctx.rotate(r() * Math.PI * 2); ctx.scale(s, s);
      leafShape(ctx, kind, r);
      const c = pal[Math.floor(r() * pal.length)];
      const k = 0.9 + front * 0.45 + (r() - 0.5) * 0.18;
      const g = ctx.createLinearGradient(-0.3, 0, 0.3, 1);
      g.addColorStop(0, shade(c, k)); g.addColorStop(1, shade(c, k * 1.22));
      ctx.fillStyle = g; ctx.fill();
      if (kind === 'ivy') { ctx.lineWidth = 0.02; ctx.strokeStyle = shade(c, 0.6); ctx.stroke(); }
      ctx.beginPath(); ctx.moveTo(0, 0.04); ctx.lineTo(0, 0.9); ctx.strokeStyle = shade(c, k * 1.3); ctx.lineWidth = 0.02; ctx.stroke();
      ctx.restore();
    }
  }, { mipmaps: true });
}

// Conifer spray (cedar plates, yew): fine needles fanning from a stem.
export function needleTexture({ seed = 3, color = '#2a4423', light = '#4d6b3a', density = 1 } = {}) {
  return canvasTexture(512, 512, (ctx, w, h) => {
    const r = rng(seed);
    ctx.clearRect(0, 0, w, h);
    const sprays = Math.round(16 * density);
    for (let s = 0; s < sprays; s++) {
      const cx = w * (0.2 + r() * 0.6), cy = h * (0.2 + r() * 0.6), a0 = r() * Math.PI * 2, len = w * (0.18 + r() * 0.2);
      const n = Math.round(90 * density);
      for (let i = 0; i < n; i++) {
        const t = r(), px = cx + Math.cos(a0) * len * (t - 0.5), py = cy + Math.sin(a0) * len * (t - 0.5);
        const a = a0 + (r() < 0.5 ? 1 : -1) * (0.6 + r() * 0.7);
        const l = 10 + r() * 16;
        ctx.strokeStyle = r() < 0.35 ? light : color; ctx.lineWidth = 2 + r() * 1.5;
        ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(px + Math.cos(a) * l, py + Math.sin(a) * l); ctx.stroke();
      }
    }
  });
}

function shade(hex, k) {
  const c = new THREE.Color(hex);
  return `rgb(${Math.min(255, c.r * 255 * k) | 0},${Math.min(255, c.g * 255 * k) | 0},${Math.min(255, c.b * 255 * k) | 0})`;
}

// Leaf material. `sway` in metres at the crown's edge.
export function leafMaterial(map, { color = '#ffffff', sway = 0.12, translucency = 0.9, alphaTest = 0.42, a2c = false, roughness = 0.82, vertexColors = false } = {}) {
  const m = new THREE.MeshStandardMaterial({ map, color, alphaTest, side: THREE.DoubleSide, roughness, metalness: 0, alphaToCoverage: a2c, vertexColors });
  const patch = (s, depth) => {
    s.uniforms.uTime = shared.uTime;
    s.uniforms.uWind = shared.uWind;
    s.uniforms.uSway = { value: sway };
    s.vertexShader = s.vertexShader
      .replace('#include <common>', '#include <common>\nuniform float uTime; uniform vec4 uWind; uniform float uSway;')
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        {
          vec3 wp0 = transformed;
          #ifdef USE_INSTANCING
            wp0 = (instanceMatrix * vec4(transformed, 1.0)).xyz;
          #endif
          float ph = dot(wp0.xz, vec2(0.21, 0.17));
          float h = clamp(transformed.y / 10.0, 0.0, 1.5);
          float gust = 0.6 + 0.4 * sin(uTime * 0.7 + ph * 0.3);
          vec3 sw = vec3(uWind.x, 0.0, uWind.y) * (sin(uTime * 1.9 + ph) * 0.6 + 0.4) * gust
                  + vec3(sin(uTime * 3.7 + ph * 3.1), sin(uTime * 4.3 + ph * 2.3) * 0.5, cos(uTime * 3.1 + ph * 2.7)) * 0.35;
          transformed += sw * uSway * h * uWind.z;
        }`);
    if (depth) return;
    s.uniforms.uSunDir = shared.uSunDir;
    s.uniforms.uSunColor = shared.uSunColor;
    s.uniforms.uTrans = { value: translucency };
    s.fragmentShader = s.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform vec3 uSunDir; uniform vec3 uSunColor; uniform float uTrans;')
      .replace('#include <normal_fragment_begin>', THREE.ShaderChunk.normal_fragment_begin.replace('normal *= faceDirection;', ''))
      .replace('#include <lights_fragment_end>', `#include <lights_fragment_end>
        {
          vec3 Lv = normalize((viewMatrix * vec4(uSunDir, 0.0)).xyz);
          vec3 Vv = normalize(vViewPosition);
          float back = pow(max(dot(-Vv, Lv), 0.0), 3.0);
          float rim = 1.0 - max(dot(normal, Lv), 0.0);
          reflectedLight.directDiffuse += diffuseColor.rgb * vec3(0.9, 1.1, 0.5) * uSunColor * RECIPROCAL_PI * uTrans * (back * 0.85 + rim * 0.08);
        }`);
  };
  m.onBeforeCompile = (s) => patch(s, false);
  const depth = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, map, alphaTest, side: THREE.DoubleSide });
  depth.onBeforeCompile = (s) => patch(s, true);
  m.userData.depth = depth;
  return m;
}
