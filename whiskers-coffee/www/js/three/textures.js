// Painted textures for the 3D café, drawn on canvases at start-up: floor boards and tiles,
// wallpapers, rugs, chalkboards and the painting. Smooth, soft-edged, no pixel art.
import { THREE, rng } from './kit.js';

const cache = new Map();
function canvasTex(key, w, h, paint, { repeat = null, srgb = true } = {}) {
  if (cache.has(key)) return cache.get(key);
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const g = c.getContext('2d');
  paint(g, w, h);
  const t = new THREE.CanvasTexture(c);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(...repeat); }
  cache.set(key, t);
  return t;
}
const shade = (hex, k) => {
  const n = parseInt(hex.slice(1), 16), r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  const f = (v) => Math.max(0, Math.min(255, Math.round(k > 1 ? v + (255 - v) * (k - 1) : v * k)));
  return `rgb(${f(r)},${f(g)},${f(b)})`;
};

// ---------- floors: one texture for the whole floor, 128 px per tile ----------
export function floorTexture(style, W, H) {
  const P = 128;
  return canvasTex(`floor:${style.kind}:${style.cols.join()}:${W}x${H}`, W * P, H * P, (g, w, h) => {
    const R = rng(7);
    if (style.kind === 'planks') {
      const plank = P / 4;
      for (let row = 0; row * plank < h; row++) {
        let x = -Math.floor(R() * P * 2);
        while (x < w) {
          const len = P * (1.5 + R() * 2.5), col = style.cols[Math.floor(R() * style.cols.length)];
          const y = row * plank;
          const gr = g.createLinearGradient(0, y, 0, y + plank);
          gr.addColorStop(0, shade(col, 1.06)); gr.addColorStop(1, shade(col, 0.92));
          g.fillStyle = gr; g.fillRect(x, y, len, plank);
          // grain
          g.strokeStyle = 'rgba(60,30,10,0.10)'; g.lineWidth = 1;
          for (let k = 0; k < 5; k++) {
            const gy = y + 3 + R() * (plank - 6);
            g.beginPath(); g.moveTo(x, gy);
            for (let s = 0; s <= len; s += 16) g.lineTo(x + s, gy + Math.sin(s * 0.02 + k) * 1.4);
            g.stroke();
          }
          if (R() < 0.35) { g.fillStyle = 'rgba(70,40,20,0.18)'; g.beginPath(); g.ellipse(x + R() * len, y + plank / 2, 5, 2.5, 0, 0, 7); g.fill(); }
          g.fillStyle = style.gap; g.fillRect(x, y, 2, plank);
          x += len;
        }
        g.fillStyle = style.gap; g.fillRect(0, row * plank, w, 2);
      }
    } else if (style.kind === 'checker') {
      const s = P / 2;
      for (let y = 0; y < h / s; y++) for (let x = 0; x < w / s; x++) {
        g.fillStyle = style.cols[(x + y) % 2]; g.fillRect(x * s, y * s, s, s);
        g.fillStyle = 'rgba(255,255,255,0.06)'; g.fillRect(x * s + 3, y * s + 3, s - 6, s / 3);
      }
    } else if (style.kind === 'tiles') {
      const s = P / 2;
      g.fillStyle = style.gap; g.fillRect(0, 0, w, h);
      for (let y = 0; y < h / s; y++) for (let x = 0; x < w / s; x++) {
        const col = style.cols[Math.floor(R() * style.cols.length)];
        const gr = g.createLinearGradient(x * s, y * s, x * s + s, y * s + s);
        gr.addColorStop(0, shade(col, 1.08)); gr.addColorStop(1, shade(col, 0.9));
        g.fillStyle = gr; g.fillRect(x * s + 3, y * s + 3, s - 6, s - 6);
      }
    } else if (style.kind === 'tatami') {
      for (let y = 0; y < h / P; y++) for (let x = 0; x < w / (P * 2); x++) {
        const ox = (y % 2) * P, X = x * P * 2 - ox, Y = y * P;
        g.fillStyle = style.cols[(x + y) % style.cols.length]; g.fillRect(X, Y, P * 2, P);
        g.strokeStyle = 'rgba(80,70,30,0.18)';
        for (let k = 4; k < P; k += 5) { g.beginPath(); g.moveTo(X, Y + k); g.lineTo(X + P * 2, Y + k); g.stroke(); }
        g.fillStyle = style.gap; g.fillRect(X, Y, P * 2, 6); g.fillRect(X, Y + P - 6, P * 2, 6);
      }
    }
    // soft vignette so the room's middle feels lit
    const v = g.createRadialGradient(w * 0.55, h * 0.55, P, w / 2, h / 2, Math.max(w, h) * 0.75);
    v.addColorStop(0, 'rgba(255,240,210,0.06)'); v.addColorStop(1, 'rgba(30,15,5,0.16)');
    g.fillStyle = v; g.fillRect(0, 0, w, h);
  });
}

// ---------- wallpaper: one tile-wide repeat, 128 px per tile, 2.7 tiles tall ----------
export function wallTexture(ws, len) {
  const P = 128, H = Math.round(P * 2.7);
  return canvasTex(`wall:${ws.base}:${ws.pattern}:${len}`, len * P, H, (g, w, h) => {
    g.fillStyle = ws.base; g.fillRect(0, 0, w, h);
    const R = rng(3);
    if (ws.pattern === 'stripe') {
      for (let x = 0; x < w; x += 32) { g.fillStyle = ws.stripe; g.globalAlpha = 0.45; g.fillRect(x, 0, 10, h); g.globalAlpha = 1; }
    } else if (ws.pattern === 'flowers') {
      for (let y = 20; y < h; y += 48) for (let x = (y / 48) % 2 ? 24 : 0; x < w; x += 48) {
        g.fillStyle = ws.leaf; g.beginPath(); g.ellipse(x + 7, y + 6, 6, 3, 0.6, 0, 7); g.fill();
        g.fillStyle = ws.stripe; for (let a = 0; a < 5; a++) { g.beginPath(); g.arc(x + Math.cos(a * 1.26) * 5, y + Math.sin(a * 1.26) * 5, 4, 0, 7); g.fill(); }
        g.fillStyle = '#f6e3a0'; g.beginPath(); g.arc(x, y, 3, 0, 7); g.fill();
      }
    } else if (ws.pattern === 'dots') {
      g.fillStyle = ws.stripe;
      for (let i = 0; i < w * h / 900; i++) { const x = R() * w, y = R() * h, r = R() < 0.15 ? 2.6 : 1.3; g.globalAlpha = 0.5 + R() * 0.5; g.beginPath(); g.arc(x, y, r, 0, 7); g.fill(); }
      g.globalAlpha = 1;
    } else if (ws.pattern === 'brick') {
      const bw = 48, bh = 20;
      g.fillStyle = ws.stripe; g.fillRect(0, 0, w, h);
      for (let y = 0; y < h; y += bh) for (let x = (y / bh) % 2 ? -bw / 2 : 0; x < w; x += bw) {
        g.fillStyle = shade(ws.base, 0.85 + R() * 0.3); g.fillRect(x + 2, y + 2, bw - 4, bh - 4);
      }
    } else if (ws.pattern === 'shoji') {
      g.strokeStyle = ws.stripe; g.lineWidth = 5;
      for (let x = 0; x <= w; x += 42) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, h); g.stroke(); }
      for (let y = 0; y <= h; y += 56) { g.beginPath(); g.moveTo(0, y); g.lineTo(w, y); g.stroke(); }
    } else if (ws.pattern === 'planks') {
      for (let x = 0; x < w; x += 40) { g.fillStyle = shade(ws.base, 0.9 + R() * 0.2); g.fillRect(x, 0, 40, h); g.fillStyle = ws.stripe; g.fillRect(x, 0, 3, h); }
    }
    // paint is never perfectly flat
    for (let i = 0; i < 1200; i++) { g.fillStyle = `rgba(${R() < 0.5 ? '255,255,255' : '80,50,30'},0.03)`; g.fillRect(R() * w, R() * h, 3, 3); }
  }, {});
}

// ---------- rugs ----------
export function rugTexture(kind) {
  return canvasTex('rug:' + kind, 512, 512, (g, w, h) => {
    const R = rng(11);
    if (kind === 'rug') {
      g.fillStyle = '#b5483c'; g.fillRect(0, 0, w, h);
      g.fillStyle = '#e8c48a'; g.fillRect(24, 24, w - 48, h - 48);
      g.fillStyle = '#c9614f'; g.fillRect(48, 48, w - 96, h - 96);
      g.strokeStyle = '#f2dcae'; g.lineWidth = 10;
      for (let i = 0; i < 4; i++) { g.beginPath(); g.moveTo(w / 2, 90 + i * 30); g.lineTo(w - 90 - i * 30, h / 2); g.lineTo(w / 2, h - 90 - i * 30); g.lineTo(90 + i * 30, h / 2); g.closePath(); g.stroke(); }
    } else if (kind === 'quilt') {
      const cols = ['#e6a0a8', '#f2d27a', '#8fbf9a', '#7fa6d6', '#f4efe6', '#c9786f'];
      for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) {
        g.fillStyle = cols[Math.floor(R() * cols.length)]; g.fillRect(x * 64, y * 64, 64, 64);
        if (R() < 0.5) { g.fillStyle = 'rgba(255,255,255,0.35)'; g.beginPath(); g.moveTo(x * 64, y * 64); g.lineTo(x * 64 + 64, y * 64 + 64); g.lineTo(x * 64, y * 64 + 64); g.fill(); }
        g.strokeStyle = 'rgba(255,255,255,0.7)'; g.setLineDash([6, 5]); g.lineWidth = 2; g.strokeRect(x * 64 + 4, y * 64 + 4, 56, 56); g.setLineDash([]);
      }
    } else if (kind === 'maple') {
      g.fillStyle = '#c98a4a'; g.fillRect(0, 0, w, h);
      g.fillStyle = '#7a4a2a'; g.fillRect(16, 16, w - 32, h - 32);
      g.fillStyle = '#d9a35a'; g.fillRect(30, 30, w - 60, h - 60);
      g.fillStyle = '#b5483c';
      g.save(); g.translate(w / 2, h / 2);
      for (let a = 0; a < 5; a++) { g.rotate(Math.PI * 2 / 5); g.beginPath(); g.moveTo(0, 0); g.quadraticCurveTo(70, -60, 0, -150); g.quadraticCurveTo(-70, -60, 0, 0); g.fill(); }
      g.restore();
    } else if (kind === 'paw') {
      g.fillStyle = '#e9d6b6'; g.beginPath(); g.ellipse(w / 2, h / 2, w / 2 - 6, h / 2 - 6, 0, 0, 7); g.fill();
      g.strokeStyle = '#c9a47a'; g.lineWidth = 10; g.stroke();
      g.fillStyle = '#9a6a48';
      g.beginPath(); g.ellipse(w / 2, h * 0.6, 80, 66, 0, 0, 7); g.fill();
      [[-95, -40], [-38, -105], [38, -105], [95, -40]].forEach(([x, y]) => { g.beginPath(); g.ellipse(w / 2 + x, h * 0.6 + y, 30, 36, x * 0.004, 0, 7); g.fill(); });
    }
    // woven texture
    for (let y = 0; y < h; y += 4) { g.fillStyle = `rgba(0,0,0,${y % 8 ? 0.04 : 0.07})`; g.fillRect(0, y, w, 2); }
  });
}

// ---------- boards and pictures ----------
export function chalkTexture(kind) {
  return canvasTex('chalk:' + kind, 256, 256, (g, w, h) => {
    g.fillStyle = '#2f4436'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 300; i++) { g.fillStyle = 'rgba(255,255,255,0.025)'; g.fillRect(Math.random() * w, Math.random() * h, 8, 3); }
    g.fillStyle = '#f4efe6'; g.strokeStyle = '#f4efe6'; g.lineCap = 'round';
    g.textAlign = 'center';
    if (kind === 'welcome') {
      g.font = 'italic 700 46px Georgia, serif'; g.fillText('Welcome', w / 2, 100);
      g.font = '28px Georgia, serif'; g.fillStyle = '#f2c1c8'; g.fillText('cats inside', w / 2, 150);
      g.strokeStyle = '#ffd27a'; g.lineWidth = 4; g.beginPath(); g.arc(w / 2, 200, 20, Math.PI, 0); g.stroke();
    } else {
      g.font = 'italic 700 40px Georgia, serif'; g.fillText('Menu', w / 2, 52);
      g.lineWidth = 5;
      const cols = ['#f4efe6', '#ffd27a', '#f2c1c8', '#bfe3c0'];
      for (let i = 0; i < 5; i++) {
        g.strokeStyle = cols[i % 4];
        g.beginPath(); g.moveTo(34, 88 + i * 34); g.lineTo(150 + (i * 37) % 50, 88 + i * 34); g.stroke();
        g.strokeStyle = '#ffd27a'; g.beginPath(); g.moveTo(190, 88 + i * 34); g.lineTo(220, 88 + i * 34); g.stroke();
      }
    }
  });
}
export function paintingTexture() {
  return canvasTex('painting', 256, 192, (g, w, h) => {
    const sky = g.createLinearGradient(0, 0, 0, h);
    sky.addColorStop(0, '#9fd0e8'); sky.addColorStop(1, '#f6e2b8');
    g.fillStyle = sky; g.fillRect(0, 0, w, h);
    g.fillStyle = '#fff4c8'; g.beginPath(); g.arc(190, 50, 22, 0, 7); g.fill();
    g.fillStyle = '#86b36a'; g.beginPath(); g.moveTo(0, 130); g.quadraticCurveTo(80, 80, 160, 125); g.quadraticCurveTo(210, 100, 256, 120); g.lineTo(256, 192); g.lineTo(0, 192); g.fill();
    g.fillStyle = '#5f9150'; g.beginPath(); g.moveTo(0, 160); g.quadraticCurveTo(120, 120, 256, 165); g.lineTo(256, 192); g.lineTo(0, 192); g.fill();
    g.fillStyle = '#e8c070'; g.beginPath(); g.ellipse(70, 165, 30, 6, 0, 0, 7); g.fill();
  });
}
// the clock face
export function clockTexture() {
  return canvasTex('clock', 128, 128, (g, w) => {
    g.fillStyle = '#fbf6ea'; g.beginPath(); g.arc(64, 64, 62, 0, 7); g.fill();
    g.fillStyle = '#3b2a20';
    for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2; g.beginPath(); g.arc(64 + Math.sin(a) * 50, 64 - Math.cos(a) * 50, i % 3 ? 2.5 : 4.5, 0, 7); g.fill(); }
  });
}
// a soft round spot used for glows and contact shadows
export function softSpot(color = '255,255,255') {
  return canvasTex('spot:' + color, 128, 128, (g) => {
    const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
    gr.addColorStop(0, `rgba(${color},1)`); gr.addColorStop(0.45, `rgba(${color},0.45)`); gr.addColorStop(1, `rgba(${color},0)`);
    g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
  }, { srgb: false });
}
// small spines of a row of books
export function booksTexture(seed) {
  return canvasTex('books' + seed, 256, 64, (g, w, h) => {
    const R = rng(seed), cols = ['#b5483c', '#3d4a6b', '#6d8a58', '#d29b3a', '#7a5c9e', '#e8d7b0', '#4f8a8b', '#c9786f', '#5b3a26'];
    let x = 0;
    while (x < w) {
      const bw = 10 + R() * 14, bh = h * (0.7 + R() * 0.3), c = cols[Math.floor(R() * cols.length)];
      g.fillStyle = c; g.fillRect(x, h - bh, bw - 1, bh);
      g.fillStyle = 'rgba(255,255,255,0.25)'; g.fillRect(x + 2, h - bh + 6, bw - 5, 3); g.fillRect(x + 2, h - 10, bw - 5, 2);
      x += bw;
      if (R() < 0.08) x += 18;
    }
  });
}
