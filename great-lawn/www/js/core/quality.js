// Picture-quality presets and the first-run guess for this device.

export const PRESETS = {
  low: {
    maxDpr: 1.0, renderScale: 0.8,
    grassDensity: 95, grassR: [9, 24, 48], grassLodWidth: 1.25, grassSegs: [3, 2, 1],
    shadowMap: 2048, shadowSpan: 34, shadowFar: 0, msaa: 0, fxaa: true, bloom: true, grain: false,
    cutRes: 1024, groundStep: 1.0, leafDensity: 0.6, ivy: false, treeDetail: 0.7,
    hedgeLeaves: 0.6, farTrees: 160, particles: 0.5,
  },
  medium: {
    maxDpr: 1.35, renderScale: 0.9,
    grassDensity: 160, grassR: [12, 34, 70], grassLodWidth: 1.15, grassSegs: [3, 2, 1],
    shadowMap: 2048, shadowSpan: 48, shadowFar: 0, msaa: 2, fxaa: false, bloom: true, grain: true,
    cutRes: 2048, groundStep: 0.75, leafDensity: 0.7, ivy: true, treeDetail: 0.75,
    hedgeLeaves: 0.7, farTrees: 220, particles: 0.8,
  },
  high: {
    maxDpr: 1.75, renderScale: 1.0,
    grassDensity: 270, grassR: [16, 46, 100], grassLodWidth: 1.0, grassSegs: [4, 2, 1],
    shadowMap: 4096, shadowSpan: 70, shadowFar: 0, msaa: 4, fxaa: false, bloom: true, grain: true,
    cutRes: 2048, groundStep: 0.5, leafDensity: 1.0, ivy: true, treeDetail: 1.0,
    hedgeLeaves: 1.0, farTrees: 360, particles: 1.0,
  },
  ultra: {
    maxDpr: 2.0, renderScale: 1.0,
    grassDensity: 400, grassR: [20, 60, 130], grassLodWidth: 0.95, grassSegs: [4, 2, 1],
    shadowMap: 4096, shadowSpan: 80, shadowFar: 0, msaa: 4, fxaa: false, bloom: true, grain: true,
    cutRes: 2048, groundStep: 0.5, leafDensity: 1.25, ivy: true, treeDetail: 1.0,
    hedgeLeaves: 1.25, farTrees: 480, particles: 1.0,
  },
};

// On a phone the screen is small and dense, memory is shared and bandwidth is precious: the
// chosen preset keeps its look but is trimmed where it costs most and shows least.
export function forDevice(preset, mobile = isTouchDevice()) {
  if (!mobile) return { ...preset };
  return {
    ...preset,
    maxDpr: Math.min(preset.maxDpr, 1.6),
    shadowMap: Math.min(preset.shadowMap, 2048),
    grassDensity: Math.min(preset.grassDensity, 200),
    grassR: preset.grassR.map((r, i) => Math.min(r, [13, 36, 80][i])),
    grassSegs: [3, 2, 1],
    farTrees: Math.min(preset.farTrees, 300),
    // edge smoothing as a cheap pass: multisampled half-float buffers cost phones bandwidth
    msaa: 0, fxaa: true,
    // the hands' skin carries its fine detail in the shader, so the mesh can be lighter
    handRes: preset.handRes || 0.0019,
    leafDensity: Math.min(preset.leafDensity, 0.85),
    // trees and fine stonework keep their baked shadows on the lawn but stop being redrawn
    // into the sun's shadow map every frame
    bakedSceneryShadows: true,
  };
}

export const isTouchDevice = () =>
  (typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches) || /Android|iPhone|iPad/i.test(navigator.userAgent);

// Guess a preset from the GPU name and the kind of device.
export function guessQuality(gl, mobile = isTouchDevice()) {
  let gpu = '';
  try {
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    gpu = ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER);
  } catch (e) { /* some browsers hide it */ }
  gpu = String(gpu || '');
  if (/swiftshader|llvmpipe|software/i.test(gpu)) return { preset: 'low', gpu };
  if (mobile) {
    // Phones start as high as they can go (the game then adapts its resolution and grass to
    // hold the frame rate): flagships get the full look, the last few years' mid-range get
    // medium, and only clearly old GPUs start low.
    const m = gpu.match(/Adreno \(TM\) (\d{3})|Adreno.*?(\d{3})/i);
    const adreno = m ? parseInt(m[1] || m[2], 10) : 0;
    const mm = gpu.match(/Mali-G(\d{2,3})/i);
    const mali = mm ? parseInt(mm[1], 10) : 0;
    if (adreno >= 730 || mali >= 700 || /Immortalis|Xclipse|Apple GPU/i.test(gpu)) return { preset: 'high', gpu };
    if (adreno >= 618 || mali >= 600 || (mali >= 57 && mali < 100)) return { preset: 'medium', gpu };
    if (adreno || mali || /PowerVR|Mali-T|Mali-4/i.test(gpu)) return { preset: 'low', gpu };
    return { preset: 'medium', gpu };
  }
  if (/Intel|UHD|Iris|Mali|Adreno|PowerVR|Apple M1\b/i.test(gpu)) return { preset: 'medium', gpu };
  if (/RTX [34-9]0[6-9]0|RTX 50|RX 7[89]00|RX 9|Apple M[2-9] (Pro|Max|Ultra)/i.test(gpu)) return { preset: 'ultra', gpu };
  return { preset: 'high', gpu };
}

// Settings persisted between sessions (browser storage can be unavailable: always fall back).
const KEY = 'greatlawn.settings.v1';
// Bump when the automatic choice gets better: a quality stored by an older version (which
// saved its own guess whenever the settings were closed) goes back to automatic once.
const QUALITY_REV = 2;
export function loadSettings() {
  const defaults = { quality: null, sensitivity: 1, volume: 0.8, invertY: false, showFps: false, qualityRev: QUALITY_REV };
  try {
    const s = JSON.parse(localStorage.getItem(KEY) || 'null');
    if (!s) return defaults;
    if ((s.qualityRev || 1) < QUALITY_REV) { s.quality = null; s.qualityRev = QUALITY_REV; }
    return { ...defaults, ...s };
  } catch (e) { return defaults; }
}
export function saveSettings(s) {
  try { localStorage.setItem(KEY, JSON.stringify(s)); } catch (e) { /* ignore */ }
}
