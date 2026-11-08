// Post-processing: HDR render (optionally multisampled) -> bloom -> filmic tone mapping ->
// grade (split-tone, vignette, grain, a little lens fringing, and the effects of the ale).
import * as THREE from '../../vendor/three.module.js';
import { EffectComposer } from '../../vendor/EffectComposer.js';
import { RenderPass } from '../../vendor/RenderPass.js';
import { ShaderPass } from '../../vendor/ShaderPass.js';
import { UnrealBloomPass } from '../../vendor/UnrealBloomPass.js';
import { OutputPass } from '../../vendor/OutputPass.js';
import { FXAAShader } from '../../vendor/FXAAShader.js';

const GradeShader = {
  uniforms: {
    tDiffuse: { value: null }, uTime: { value: 0 }, uRes: { value: new THREE.Vector2(1, 1) },
    uVignette: { value: 0.32 }, uGrain: { value: 0.028 }, uTipsy: { value: 0 }, uFade: { value: 1 },
    uFringe: { value: 1 },
  },
  vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
  fragmentShader: /* glsl */`
    uniform sampler2D tDiffuse; uniform float uTime, uVignette, uGrain, uTipsy, uFade, uFringe; uniform vec2 uRes;
    varying vec2 vUv;
    float h(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
    void main() {
      vec2 uv = vUv;
      float tip = uTipsy;
      if (tip > 0.001) {
        uv += vec2(sin(uTime * 0.9 + uv.y * 3.0), cos(uTime * 0.7 + uv.x * 2.4)) * 0.0045 * tip;
      }
      vec2 d = uv - 0.5;
      float r2 = dot(d, d);
      vec3 c;
      float f = 0.0018 * uFringe * r2 * 4.0;
      c.r = texture2D(tDiffuse, uv - d * f).r;
      c.g = texture2D(tDiffuse, uv).g;
      c.b = texture2D(tDiffuse, uv + d * f).b;
      if (tip > 0.001) {
        vec2 o = vec2(0.006 + 0.004 * sin(uTime * 0.53), 0.002) * tip;
        c = mix(c, texture2D(tDiffuse, uv + o).rgb, 0.33 * clamp(tip, 0.0, 1.0));
      }
      float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
      // gentle split-tone: cool shade, warm light
      c *= mix(vec3(0.975, 1.0, 1.035), vec3(1.03, 1.0, 0.955), smoothstep(0.15, 0.85, l));
      c = mix(vec3(l), c, 1.06);
      c *= 1.0 - uVignette * smoothstep(0.12, 0.62, r2);
      c += (h(vUv * uRes + fract(uTime * 7.13) * 91.7) - 0.5) * uGrain;
      gl_FragColor = vec4(c * uFade, 1.0);
    }`,
};

export class Post {
  constructor(renderer, scene, camera, quality) {
    this.renderer = renderer;
    this.quality = quality;
    const size = renderer.getDrawingBufferSize(new THREE.Vector2());
    const rt = new THREE.WebGLRenderTarget(size.x, size.y, {
      type: THREE.HalfFloatType, samples: quality.msaa || 0,
    });
    this.composer = new EffectComposer(renderer, rt);
    this.renderPass = new RenderPass(scene, camera);
    this.composer.addPass(this.renderPass);
    if (quality.bloom) {
      // only real highlights bloom: the sun, the ember, glints on chrome and glass
      this.bloom = new UnrealBloomPass(new THREE.Vector2(size.x / 2, size.y / 2), 0.25, 0.6, 2.2);
      this.composer.addPass(this.bloom);
    }
    this.output = new OutputPass();
    this.composer.addPass(this.output);
    if (quality.fxaa) {
      this.fxaa = new ShaderPass(FXAAShader);
      this.composer.addPass(this.fxaa);
    }
    this.grade = new ShaderPass(GradeShader);
    this.grade.uniforms.uGrain.value = quality.grain ? 0.026 : 0;
    this.composer.addPass(this.grade);
    this.setSize();
  }
  setSize() {
    const size = this.renderer.getDrawingBufferSize(new THREE.Vector2());
    const pr = this.renderer.getPixelRatio();
    this.composer.setPixelRatio(1);
    this.composer.setSize(size.x, size.y);
    if (this.fxaa) this.fxaa.material.uniforms.resolution.value.set(1 / size.x, 1 / size.y);
    this.grade.uniforms.uRes.value.set(size.x, size.y);
    this.pr = pr;
  }
  render(time) {
    this.grade.uniforms.uTime.value = time;
    this.composer.render();
  }
}
