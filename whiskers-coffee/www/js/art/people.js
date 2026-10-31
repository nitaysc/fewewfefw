// Chibi pixel people built from parts, so players and customers can be customised.
// Front view faces the camera (walking down the screen); back view walks up. Both are
// drawn facing right and mirrored for left.
import { Pix, shade, softOutline as _soft } from './pix.js';

export const HAIR_STYLES = ['short', 'bob', 'long', 'bun', 'curly', 'spiky', 'ponytail', 'twintails', 'afro', 'sidepart', 'buzz', 'wavy'];
export const SKINS = ['#fbe3cc', '#f6d7b8', '#eec39a', '#d9a273', '#b97f55', '#8d5a3b', '#6b4029', '#4a2c1e'];
export const HAIR_COLORS = ['#2b1d16', '#5a3a26', '#8b5a2b', '#c98b4a', '#e6c27a', '#f2e2a8', '#b4473a', '#e07a3a', '#3d4a6b', '#d8d4cc', '#7a5c9e', '#ef8fae', '#6fbfa8', '#4f7ac9'];
export const OUTFIT_COLORS = ['#b5483c', '#e46a5a', '#3d4a6b', '#4f7ac9', '#6d8a58', '#8fbf5a', '#d29b3a', '#f2d27a', '#c9786f', '#ef8fae', '#7a5c9e', '#b7a0e0', '#2f3f4a', '#e8d7b0', '#f4efe6', '#4f8a8b', '#5b3a26', '#2b2b30'];
export const PANTS_COLORS = ['#2f3f4a', '#3d4a6b', '#4a3a30', '#6b5a48', '#3b3b44', '#8a7a60', '#b5483c', '#6d8a58', '#e8d7b0', '#2b2b30', '#7a5c9e', '#ef8fae'];
export const SHOE_COLORS = ['#3b2a20', '#2b2b30', '#f4efe6', '#b5483c', '#3d4a6b', '#c98b4a', '#ef8fae'];
export const EYE_STYLES = ['dot', 'round', 'happy', 'sleepy', 'lashes', 'sparkle'];
export const EYE_COLORS = ['#2b1d16', '#5a3a26', '#3f6fb0', '#4f8a4a', '#7a7a80', '#8a4a9e', '#b4473a'];
export const TOPS = ['tee', 'sweater', 'hoodie', 'shirt', 'stripes', 'dress'];
export const BOTTOMS = ['pants', 'shorts', 'skirt'];
export const HATS = [null, 'beret', 'cap', 'beanie', 'bow', 'flower', 'headband'];
export const GLASSES = [null, 'round', 'square', 'sun'];

const W = 16, H = 29;

function part(p, x, y, w, h, c, shadeRight = true) {
  p.rect(x, y, w, h, c);
  if (shadeRight && w > 2) p.rect(x + w - 1, y, 1, h, shade(c, 0.8));
}

// frame: 0..3 walking, 4/5 idle breathing, 6 sitting
export function drawPerson(look, view, frame) {
  const p = new Pix(W, H);
  const walk = frame >= 0 && frame <= 3;
  const bob = walk && frame % 2 === 1 ? -1 : frame === 5 ? -1 : 0;
  const sit = frame === 6;
  const skin = look.skin, hair = look.hair, shirt = look.shirt, pants = look.pants || '#2f3f4a';
  const shoes = look.shoes || '#3b2a20';
  const top = look.top || 'tee', bottom = top === 'dress' ? 'dress' : (look.bottom || 'pants');
  const apron = look.apron ? (look.apronColor || '#e8d7b0') : null;
  const leftUp = frame === 1 ? 1 : 0, rightUp = frame === 3 ? 1 : 0;
  const style = look.style;

  // long hair hangs behind the body
  if (style === 'long' || style === 'wavy') part(p, 3, 8 + bob, 10, style === 'wavy' ? 10 : 11, shade(hair, 0.85), false);
  if (view === 'back' && (style === 'ponytail')) part(p, 7, 9 + bob, 3, 7, shade(hair, 0.9), false);

  // legs and shoes; shorts and skirts show the legs
  const legC = bottom === 'pants' ? pants : skin;
  if (sit && view === 'front') {
    // seated, facing us: a lap coming towards the camera, bent knees, feet tucked
    const lap = bottom === 'dress' ? shirt : pants, shin = bottom === 'pants' ? pants : skin;
    part(p, 3, 20, 10, 2, lap);
    p.hline(3, 12, 20, shade(lap, 1.15));
    p.rect(3, 22, 4, 1, shade(lap, 1.05)); p.rect(9, 22, 4, 1, shade(lap, 1.05));
    p.rect(4, 23, 2, 2, shade(shin, 0.85)); p.rect(10, 23, 2, 2, shade(shin, 0.78));
    p.rect(3, 25, 4, 1, shoes); p.rect(9, 25, 4, 1, shade(shoes, 0.85));
  } else if (sit) {
    // seated with our back to the camera: only the seat of the trousers shows
    part(p, 4, 20, 8, 2, bottom === 'dress' ? shirt : pants);
  } else {
    part(p, 5, 20 - leftUp, 3, 5, legC);
    part(p, 8, 20 - rightUp, 3, 5, shade(legC, 0.92));
    if (bottom === 'shorts') { p.rect(5, 20, 6, 2, pants); p.rect(10, 20, 1, 2, shade(pants, 0.8)); }
    if (bottom === 'skirt') { p.rect(4, 20, 8, 3, pants); p.rect(11, 20, 1, 3, shade(pants, 0.8)); p.hline(4, 11, 22, shade(pants, 0.9)); }
    if (bottom === 'dress') { p.rect(4, 20, 8, 3, shirt); p.rect(3, 22, 10, 1, shirt); p.rect(11, 20, 1, 3, shade(shirt, 0.8)); }
    p.rect(5, 25 - leftUp, 3, 2, shoes);
    p.rect(8, 25 - rightUp, 3, 2, shade(shoes, 0.85));
  }

  // torso
  const ty = 12 + bob;
  part(p, 4, ty, 8, 8, shirt);
  if (top === 'stripes') for (let y = ty + 1; y < ty + 8; y += 2) p.hline(4, 11, y, shade(shirt, 1.25));
  if (top === 'sweater') { p.hline(4, 11, ty + 7, shade(shirt, 0.8)); if (view === 'front') for (let y = ty + 2; y < ty + 7; y += 2) p.set(7 + (y % 4 ? 1 : 0), y, shade(shirt, 0.85)); }
  if (top === 'hoodie') { p.rect(4, ty, 8, 2, shade(shirt, 0.88)); if (view === 'front') { p.set(6, ty + 2, '#fbf6ea'); p.set(9, ty + 2, '#fbf6ea'); p.rect(5, ty + 5, 6, 2, shade(shirt, 0.85)); } }
  if (top === 'shirt' && view === 'front') { p.set(6, ty, '#fbf6ea'); p.set(7, ty + 1, '#fbf6ea'); p.set(9, ty, '#fbf6ea'); p.set(8, ty + 1, '#fbf6ea'); for (let y = ty + 2; y < ty + 8; y += 2) p.set(8, y, shade(shirt, 0.7)); }
  if (top === 'dress' && view === 'front') p.hline(4, 11, ty + 5, shade(shirt, 0.85));
  if (view === 'front' && apron) {
    part(p, 5, ty + 2, 6, 6, apron);
    p.set(5, ty, apron); p.set(5, ty + 1, apron); p.set(10, ty, apron); p.set(10, ty + 1, apron);
    p.rect(7, ty + 5, 2, 1, shade(apron, 0.85));
  }
  if (view === 'back' && apron) {
    p.rect(4, ty + 3, 8, 1, apron);
    p.set(7, ty + 4, apron); p.set(8, ty + 4, apron); p.set(6, ty + 5, apron); p.set(9, ty + 5, apron);
  }

  // arms swing while walking
  const swing = walk ? (frame === 1 ? 1 : frame === 3 ? -1 : 0) : 0;
  const sleeve = top === 'tee' || top === 'stripes' || top === 'dress' ? 2 : 5;
  part(p, 2, ty + 1 + swing, 2, 5, skin, false); part(p, 12, ty + 1 - swing, 2, 5, shade(skin, 0.88), false);
  part(p, 2, ty + 1 + swing, 2, sleeve, shade(shirt, 0.9), false);
  part(p, 12, ty + 1 - swing, 2, sleeve, shade(shirt, 0.75), false);
  p.rect(2, ty + 6 + swing, 2, 2, skin);
  p.rect(12, ty + 6 - swing, 2, 2, shade(skin, 0.85));

  // head
  const hy = 2 + bob;
  if (view === 'back' && top === 'hoodie') p.rect(4, hy + 8, 8, 3, shade(shirt, 0.85));
  p.rect(4, hy, 8, 10, skin);
  p.rect(3, hy + 1, 10, 8, skin);
  p.rect(12, hy + 2, 1, 6, shade(skin, 0.88));

  if (view === 'front') {
    drawEyes(p, look.eyes || 'dot', look.eyeColor || '#2b1d16', hy);
    if (look.blush !== false) { p.set(6, hy + 7, '#e7a0a6'); p.set(11, hy + 7, '#e7a0a6'); }
    if (look.freckles) { p.set(6, hy + 6, shade(skin, 0.75)); p.set(5, hy + 7, shade(skin, 0.75)); p.set(11, hy + 6, shade(skin, 0.75)); }
    p.set(9, hy + 8, shade(skin, 0.7));
    if (look.glasses) drawGlasses(p, look.glasses, hy);
  }

  drawHair(p, style, hair, view, hy);
  if (look.hat) drawHat(p, look.hat, hy, look.hatColor);
  p.outline('#24160f');
  return p;
}

function drawEyes(p, style, c, hy) {
  const y = hy + 5;
  for (const x of [7, 10]) {
    if (style === 'dot') { p.rect(x, y, 1, 2, c); p.set(x, y, shade(c, 1.6)); }
    else if (style === 'round') { p.rect(x - 1, y, 2, 2, c); p.set(x - 1, y, '#ffffff'); }
    else if (style === 'happy') { p.set(x - 1, y + 1, c); p.set(x, y, c); p.set(x + 1, y + 1, c); }
    else if (style === 'sleepy') { p.hline(x - 1, x, y + 1, c); }
    else if (style === 'lashes') { p.rect(x, y, 1, 2, c); p.set(x - 1, y - 1, c); p.set(x + 1, y - 1, c); }
    else if (style === 'sparkle') { p.rect(x - 1, y, 2, 2, c); p.set(x, y, '#ffffff'); p.set(x - 1, y + 1, shade(c, 1.4)); }
  }
}

function drawGlasses(p, kind, hy) {
  const y = hy + 4, c = kind === 'sun' ? '#24160f' : '#3b2a20';
  if (kind === 'round') { for (const x of [6, 9]) { p.set(x, y + 1, c); p.set(x + 2, y + 1, c); p.hline(x, x + 2, y, c); p.hline(x, x + 2, y + 3, c); p.vline(x - 0, y, y + 3, c); } p.hline(8, 9, y + 1, c); }
  else { p.rect(6, y, 3, 3, c); p.rect(9, y, 3, 3, c); if (kind !== 'sun') { p.set(7, y + 1, '#d9eef2'); p.set(10, y + 1, '#d9eef2'); } else { p.set(7, y + 1, '#5a4a40'); } }
  p.hline(4, 5, y + 1, c);
}

function drawHair(p, style, c, view, hy) {
  const hl = shade(c, 1.25), dk = shade(c, 0.8);
  const top = () => { p.rect(4, hy - 1, 8, 2, c); p.rect(3, hy, 10, 3, c); p.rect(5, hy - 1, 4, 1, hl); };
  if (style === 'buzz') { p.rect(4, hy, 8, 2, c); p.rect(3, hy + 1, 10, 1, c); if (view === 'back') p.rect(3, hy + 2, 10, 5, c); return; }
  if (style === 'afro') {
    p.ellipse(8, hy + 2, 7, 5, c); p.ellipse(7, hy, 3, 2, hl);
    if (view === 'back') p.rect(2, hy + 2, 12, 7, c); else { p.rect(2, hy + 3, 2, 5, c); p.rect(12, hy + 3, 2, 5, dk); }
    return;
  }
  if (view === 'back') {
    top();
    const len = ['short', 'spiky', 'curly', 'sidepart'].includes(style) ? 7 : style === 'bun' || style === 'ponytail' ? 8 : style === 'bob' ? 9 : 14;
    p.rect(3, hy + 2, 10, len - 2, c);
    p.rect(12, hy + 2, 1, len - 2, dk);
    if (style === 'bun') p.ellipse(8, hy - 2, 2, 2, c);
    if (style === 'spiky') for (let x = 3; x <= 12; x += 3) p.set(x, hy - 2, c);
    if (style === 'curly') for (let x = 3; x <= 12; x += 2) p.set(x, hy - 2, c);
    if (style === 'twintails') { p.rect(1, hy + 3, 2, 8, c); p.rect(13, hy + 3, 2, 8, dk); }
    if (style === 'ponytail') { p.rect(7, hy + 7, 3, 6, c); }
    return;
  }
  top();
  switch (style) {
    case 'short': p.rect(3, hy + 3, 2, 3, c); p.rect(12, hy + 3, 1, 2, dk); p.set(5, hy + 3, c); p.set(8, hy + 3, c); p.set(9, hy + 3, c); break;
    case 'bob': p.rect(3, hy + 3, 2, 7, c); p.rect(11, hy + 3, 2, 7, dk); p.rect(5, hy + 3, 5, 1, c); break;
    case 'long': p.rect(3, hy + 3, 2, 9, c); p.rect(11, hy + 3, 2, 9, dk); p.rect(5, hy + 3, 4, 1, c); break;
    case 'wavy': for (let y = 3; y < 12; y++) { p.set(3 + (y % 3 === 0 ? 0 : 1), hy + y, c); p.set(2 + (y % 3 === 0 ? 0 : 1), hy + y, c); p.set(12 - (y % 3 === 1 ? 1 : 0), hy + y, dk); } p.rect(5, hy + 3, 4, 1, c); break;
    case 'bun': p.ellipse(8, hy - 3, 2, 2, c); p.set(7, hy - 4, hl); p.rect(3, hy + 3, 1, 4, c); p.rect(12, hy + 3, 1, 3, dk); break;
    case 'curly':
      for (let x = 3; x <= 12; x += 2) { p.set(x, hy - 2, c); p.set(x + 1, hy + 3, c); }
      p.rect(2, hy + 1, 2, 7, c); p.rect(12, hy + 1, 2, 7, dk); p.set(2, hy + 8, c); p.set(13, hy + 8, dk);
      break;
    case 'spiky': for (let x = 3; x <= 12; x += 3) { p.set(x, hy - 2, c); p.set(x + 1, hy - 3, c); } p.rect(3, hy + 3, 1, 3, c); p.set(6, hy + 3, c); p.set(9, hy + 3, c); break;
    case 'ponytail': p.rect(3, hy + 3, 1, 3, c); p.rect(12, hy + 3, 1, 2, dk); p.rect(13, hy + 1, 2, 7, dk); p.set(13, hy + 8, c); p.rect(5, hy + 3, 3, 1, c); break;
    case 'twintails': p.rect(1, hy + 2, 2, 9, c); p.rect(13, hy + 2, 2, 9, dk); p.set(3, hy + 2, '#ef8fae'); p.set(12, hy + 2, '#ef8fae'); p.rect(5, hy + 3, 5, 1, c); break;
    case 'sidepart': p.rect(3, hy + 3, 6, 2, c); p.rect(3, hy + 5, 2, 2, c); p.set(12, hy + 3, dk); p.set(9, hy + 3, c); break;
  }
}

function drawHat(p, hat, hy, color) {
  if (hat === 'beret') { const c = color || '#b5483c'; p.ellipse(8, hy - 1, 5, 2, c); p.set(8, hy - 4, c); }
  if (hat === 'cap') { const c = color || '#3d4a6b'; p.rect(3, hy - 2, 10, 3, c); p.rect(10, hy + 1, 5, 1, shade(c, 0.85)); p.set(8, hy - 2, shade(c, 1.3)); }
  if (hat === 'beanie') { const c = color || '#6d8a58'; p.rect(3, hy - 2, 10, 4, c); p.rect(3, hy + 1, 10, 1, shade(c, 0.75)); p.set(8, hy - 3, '#e8d7b0'); }
  if (hat === 'bow') { const c = color || '#e46a5a'; p.rect(9, hy - 2, 2, 2, c); p.rect(7, hy - 3, 2, 4, c); p.rect(11, hy - 3, 2, 4, c); p.set(10, hy - 2, shade(c, 0.7)); }
  if (hat === 'flower') { p.set(11, hy - 1, '#f2d27a'); for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) p.set(11 + dx, hy - 1 + dy, color || '#ef8fae'); p.set(10, hy + 1, '#5c9a48'); }
  if (hat === 'headband') { p.hline(3, 12, hy + 1, color || '#4f7ac9'); p.hline(4, 11, hy, color || '#4f7ac9'); }
}

const cache = new Map();
export function personSprite(look, view, frame, flip) {
  const key = JSON.stringify(look) + view + frame + flip;
  if (!cache.has(key)) {
    // detailed twice-resolution art, placed in the 16x29 footprint of the base sprites
    const p = drawPersonHD(look, view, frame);
    let out = p;
    if (flip) { out = new Pix(p.w, p.h); out.blit(p, 0, 0, true); }
    cache.set(key, { canvas: out.toCanvas(), w: 16, h: 29 });
    if (cache.size > 700) cache.delete(cache.keys().next().value);
  }
  return cache.get(key);
}

export function randomLook(r = Math.random) {
  const pick = (a) => a[Math.floor(r() * a.length)];
  const top = pick(TOPS);
  return {
    skin: pick(SKINS), hair: pick(HAIR_COLORS.slice(0, 11)), style: pick(HAIR_STYLES),
    eyes: pick(EYE_STYLES), eyeColor: pick(EYE_COLORS),
    top, shirt: pick(OUTFIT_COLORS), bottom: pick(BOTTOMS), pants: pick(PANTS_COLORS), shoes: pick(SHOE_COLORS),
    apron: false, hat: r() < 0.25 ? pick(HATS.slice(1)) : null, glasses: r() < 0.2 ? pick(GLASSES.slice(1)) : null,
    freckles: r() < 0.2,
  };
}

// ---------- detailed people (twice the resolution) ----------
// Drawn on a 32×58 grid, the same footprint as the 16×29 sprites at twice the detail:
// a big chibi head with shaded hair, eyes with highlights and blush, clothes with light
// and shadow sides, and a soft coloured outline.

const HW = 32, HH = 58;
function hair(p, c, view, style, hy) {
  const hi = shade(c, 1.32), lo = shade(c, 0.72), mid = shade(c, 1.12);
  const ell = (cx, cy, rx, ry, col) => p.ellipse(cx, cy, rx, ry, col);
  // the cap of hair over the top of the head
  if (style === 'afro') { ell(16, hy + 9, 14, 12, lo); ell(16, hy + 8, 13, 11, c); for (let i = 0; i < 18; i++) p.set(5 + ((i * 7) % 22), hy + 1 + ((i * 5) % 14), i % 2 ? hi : mid); return; }
  if (style === 'buzz') { ell(16, hy + 6, 11, 6, c); p.rect(5, hy + 6, 22, 3, c); if (view === 'back') p.rect(5, hy + 6, 22, 14, c); for (let x = 8; x < 24; x += 3) p.set(x, hy + 3, mid); return; }
  ell(16, hy + 5, 12, 6.5, lo);
  ell(16, hy + 4, 11.5, 6, c);
  // a curved shine band
  p.hline(10, 17, hy + 1, hi); p.hline(9, 12, hy + 2, hi); p.hline(19, 22, hy + 1, mid); p.set(18, hy + 2, mid);
  // long hair falling down the back / sides
  const len = { short: 0, spiky: 0, curly: 6, sidepart: 0, bob: 12, long: 30, wavy: 28, bun: 0, ponytail: 0, twintails: 0 }[style] ?? 0;
  if (view === 'back') {
    p.rect(4, hy + 7, 24, 12 + Math.max(len, 4), c);
    for (let x = 9; x < 26; x += 6) p.vline(x, hy + 10, hy + 15 + Math.max(len, 4), lo);
    for (let x = 12; x < 22; x += 5) p.vline(x, hy + 5, hy + 8, hi);
    if (style === 'wavy') for (let y = hy + 18; y < hy + 18 + len; y += 4) { p.set(3, y, c); p.set(28, y + 2, c); }
  } else {
    if (len) {
      p.rect(3, hy + 6, 4, 10 + len, c); p.rect(25, hy + 6, 4, 10 + len, lo);
      p.vline(4, hy + 10, hy + 14 + len, mid);
      if (style === 'wavy') for (let y = hy + 12; y < hy + 14 + len; y += 4) { p.set(2, y, c); p.set(29, y + 2, lo); }
    } else { p.rect(4, hy + 6, 3, 8, c); p.rect(25, hy + 6, 3, 7, lo); }
    // fringe over the forehead, in strands
    // a soft fringe in a few chunky locks, leaving the forehead and eyebrows visible
    const fringe = style === 'sidepart' ? [6, 6, 6, 5, 5, 5, 4, 4, 3, 3, 3, 2, 2, 2, 2, 1, 1, 1, 1, 1] : style === 'spiky' ? [5, 3, 5, 3, 5, 3, 5, 3, 5, 3, 5, 3, 5, 3, 5, 3, 5, 3, 4, 3] : [4, 5, 5, 4, 3, 4, 5, 6, 5, 4, 3, 3, 4, 5, 5, 4, 3, 3, 3, 2];
    for (let i = 0; i < 20; i++) { const x = 6 + i, d = Math.max(1, fringe[i] - 1); p.vline(x, hy + 5, hy + 5 + d, c); if (i % 5 === 2) p.vline(x, hy + 5, hy + 4 + d, mid); p.set(x, hy + 5 + d, lo); }
  }
  if (style === 'spiky') for (let x = 6; x < 27; x += 4) { p.set(x, hy - 2, c); p.set(x + 1, hy - 1, c); p.set(x, hy - 1, mid); }
  if (style === 'curly') for (let x = 4; x < 29; x += 3) { ell(x, hy + 1 + ((x * 7) % 3), 2, 2, c); p.set(x - 1, hy, hi); }
  if (style === 'bun') { ell(16, hy - 3, 5, 4, lo); ell(16, hy - 3, 4.5, 3.5, c); p.hline(14, 17, hy - 5, hi); }
  if (style === 'ponytail') { if (view === 'back') { p.rect(14, hy + 14, 5, 16, c); p.vline(16, hy + 15, hy + 28, lo); } else { p.rect(26, hy + 6, 4, 18, lo); p.rect(27, hy + 6, 2, 16, c); } }
  if (style === 'twintails') { for (const x of [0, 27]) { p.rect(x, hy + 8, 5, 22, x ? lo : c); p.vline(x + 2, hy + 10, hy + 28, x ? c : mid); p.rect(x + 1, hy + 7, 3, 2, '#ef8fae'); } }
}

function eyes(p, style, col, hy) {
  const y = hy + 14;
  for (const x of [11, 19]) {
    if (style === 'happy') { p.set(x, y + 1, '#2b1d16'); p.hline(x + 1, x + 2, y, '#2b1d16'); p.set(x + 3, y + 1, '#2b1d16'); continue; }
    if (style === 'sleepy') { p.hline(x, x + 3, y + 2, '#2b1d16'); p.set(x, y + 1, '#2b1d16'); continue; }
    const tall = style === 'dot' ? 4 : 5;
    p.rect(x, y, 3, tall, col);
    p.hline(x - 1, x + 3, y, '#2b1d16');
    p.rect(x, y + tall - 2, 3, 2, shade(col, 1.45));
    p.rect(x, y + 1, 2, 2, '#ffffff'); p.set(x + 2, y + 1, shade(col, 0.6)); if (style === 'sparkle' || style === 'round') { p.set(x + 2, y + 2, '#ffffff'); }
    if (style === 'lashes') { p.set(x - 1, y - 1, '#2b1d16'); p.set(x + 3, y - 1, '#2b1d16'); p.hline(x - 1, x + 3, y - 1, '#2b1d16'); }
    if (style === 'round') p.rect(x - 1, y, 1, 3, shade(col, 0.6));
  }
}

export function drawPersonHD(look, view, frame) {
  const p = new Pix(HW, HH);
  const walk = frame >= 0 && frame <= 3, sit = frame === 6;
  const bob = walk && frame % 2 === 1 ? -2 : frame === 5 ? -1 : 0;
  const skin = look.skin, hairC = look.hair, shirt = look.shirt, pants = look.pants || '#2f3f4a', shoes = look.shoes || '#3b2a20';
  const top = look.top || 'tee', bottom = top === 'dress' ? 'dress' : (look.bottom || 'pants');
  const apron = look.apron ? (look.apronColor || '#e8d7b0') : null;
  const style = look.style || 'short';
  const skinLo = shade(skin, 0.86), shirtLo = shade(shirt, 0.8), shirtHi = shade(shirt, 1.12);
  const legC = bottom === 'pants' ? pants : skin;
  const lUp = frame === 1 ? 2 : 0, rUp = frame === 3 ? 2 : 0;
  const ty = 28 + bob;

  // hair that hangs behind the body goes first
  if (view === 'front' && (style === 'long' || style === 'wavy')) { p.rect(5, 12 + bob, 22, 26, shade(hairC, 0.7)); }

  // legs and shoes
  if (sit && view === 'front') {
    const lap = bottom === 'dress' ? shirt : pants;
    p.rect(7, 41, 18, 5, lap); p.hline(7, 24, 41, shade(lap, 1.15)); p.rect(22, 41, 3, 5, shade(lap, 0.8));
    p.rect(8, 46, 6, 2, shade(lap, 1.05)); p.rect(18, 46, 6, 2, shade(lap, 0.95));
    const shin = bottom === 'pants' ? pants : skin;
    p.rect(9, 48, 4, 4, shade(shin, 0.86)); p.rect(19, 48, 4, 4, shade(shin, 0.78));
    p.rect(7, 52, 7, 3, shoes); p.rect(18, 52, 7, 3, shade(shoes, 0.85)); p.hline(7, 13, 54, '#f4efe6'); p.hline(18, 24, 54, '#e4dfd6');
  } else if (sit) {
    p.rect(8, 41, 16, 4, bottom === 'dress' ? shirt : pants);
  } else {
    p.rect(10, 41 - lUp, 6, 9, legC); p.rect(10, 41 - lUp, 2, 9, shade(legC, 1.1));
    p.rect(17, 41 - rUp, 6, 9, shade(legC, 0.86)); p.rect(21, 41 - rUp, 2, 9, shade(legC, 0.74));
    if (bottom === 'shorts') { p.rect(9, 40, 15, 5, pants); p.rect(20, 40, 4, 5, shade(pants, 0.8)); p.vline(16, 41, 44, shade(pants, 0.7)); }
    if (bottom === 'skirt') { p.poly([[8, 40], [25, 40], [27, 47], [6, 47]], pants); p.poly([[20, 40], [25, 40], [27, 47], [22, 47]], shade(pants, 0.82)); for (const x of [11, 16, 21]) p.vline(x, 42, 46, shade(pants, 0.75)); }
    if (bottom === 'dress') { p.poly([[8, 38], [25, 38], [28, 48], [5, 48]], shirt); p.poly([[20, 38], [25, 38], [28, 48], [22, 48]], shirtLo); }
    if (bottom === 'pants') { p.vline(16, 41, 49, shade(pants, 0.7)); }
    p.rect(9, 50 - lUp, 8, 4, shoes); p.hline(9, 16, 53 - lUp, '#f4efe6'); p.set(10, 50 - lUp, shade(shoes, 1.3));
    p.rect(17, 50 - rUp, 8, 4, shade(shoes, 0.85)); p.hline(17, 24, 53 - rUp, '#e4dfd6');
  }

  // body
  p.rect(8, ty, 17, 14, shirt);
  p.rect(8, ty, 4, 14, shirtHi); p.rect(21, ty, 4, 14, shirtLo);
  p.hline(9, 23, ty + 13, shade(shirt, 0.7));
  if (top === 'stripes') for (let y = ty + 2; y < ty + 13; y += 3) p.hline(8, 24, y, shade(shirt, 1.35));
  if (top === 'sweater') { p.hline(8, 24, ty + 12, shade(shirt, 0.75)); p.hline(8, 24, ty + 13, shade(shirt, 0.65)); if (view === 'front') for (let y = ty + 3; y < ty + 11; y += 3) { p.set(14, y, shirtLo); p.set(15, y + 1, shirtLo); p.set(18, y, shirtLo); p.set(17, y + 1, shirtLo); } }
  if (top === 'hoodie') { if (view === 'front') { p.rect(10, ty, 13, 3, shirtLo); p.vline(14, ty + 2, ty + 6, '#f4efe6'); p.vline(18, ty + 2, ty + 6, '#f4efe6'); p.rect(11, ty + 8, 11, 4, shirtLo); p.hline(11, 21, ty + 8, shade(shirt, 0.7)); } else p.rect(10, ty - 2, 13, 6, shirtLo); }
  if (top === 'shirt' && view === 'front') { p.poly([[12, ty], [16, ty + 4], [16, ty]], '#fbf6ea'); p.poly([[20, ty], [17, ty + 4], [17, ty]], '#e8e2d6'); for (let y = ty + 5; y < ty + 13; y += 3) p.set(16, y, shade(shirt, 0.6)); }
  if (top === 'dress' && view === 'front') { p.hline(8, 24, ty + 9, shirtLo); p.set(16, ty + 2, shade(shirt, 1.3)); }
  if (view === 'front' && apron) {
    p.rect(10, ty + 3, 13, 15, apron); p.rect(19, ty + 3, 4, 15, shade(apron, 0.84)); p.rect(10, ty + 3, 2, 15, shade(apron, 1.08));
    p.vline(11, ty - 1, ty + 3, shade(apron, 0.9)); p.vline(21, ty - 1, ty + 3, shade(apron, 0.8));
    p.rect(13, ty + 9, 6, 4, shade(apron, 0.9)); p.hline(13, 18, ty + 9, shade(apron, 0.75));
  }
  if (view === 'back' && apron) { p.hline(8, 24, ty + 6, apron); p.hline(8, 24, ty + 7, shade(apron, 0.85)); p.rect(14, ty + 6, 5, 3, apron); p.set(13, ty + 9, apron); p.set(19, ty + 9, apron); }

  // arms, swinging when walking
  const sw = walk ? (frame === 1 ? 2 : frame === 3 ? -2 : 0) : 0;
  const longSleeve = !['tee', 'stripes', 'dress'].includes(top);
  for (const [x, dy, lo] of [[4, sw, false], [25, -sw, true]]) {
    p.rect(x, ty + 1 + dy, 4, 11, lo ? skinLo : skin);
    p.rect(x, ty + 1 + dy, 4, longSleeve ? 10 : 5, lo ? shirtLo : shirtHi);
    if (top === 'stripes') p.hline(x, x + 3, ty + 3 + dy, shade(shirt, 1.35));
    p.rect(x, ty + 11 + dy, 4, 3, lo ? skinLo : skin);
  }

  // head
  const hy = 4 + bob;
  p.rect(12, hy + 22, 8, 3, skinLo);
  p.ellipse(16, hy + 13, 11, 10, skin);
  p.rect(6, hy + 10, 21, 8, skin);
  p.vline(26, hy + 9, hy + 18, skinLo); p.hline(9, 23, hy + 23, skinLo);
  if (view === 'front') {
    eyes(p, look.eyes || 'dot', look.eyeColor || '#3a2a20', hy);
    p.hline(10, 13, hy + 12, shade(hairC, 0.75)); p.hline(19, 22, hy + 12, shade(hairC, 0.75));
    if (look.blush !== false) { p.hline(8, 10, hy + 20, '#f4a6a0'); p.hline(22, 24, hy + 20, '#f4a6a0'); }
    if (look.freckles) for (const [fx, fy] of [[9, 19], [11, 20], [21, 19], [23, 20]]) p.set(fx, hy + fy, shade(skin, 0.75));
    p.hline(15, 17, hy + 21, '#8a4a3a'); p.set(18, hy + 20, '#8a4a3a');
    if (look.glasses) {
      const gc = look.glasses === 'sun' ? '#24160f' : '#4a3426';
      for (const x of [9, 18]) { if (look.glasses === 'round') { p.ellipse(x + 3, hy + 16, 3, 3, gc); p.ellipse(x + 3, hy + 16, 2, 2, look.glasses === 'sun' ? '#3a3a40' : '#d9eef2aa'); } else { p.rect(x, hy + 13, 7, 6, gc); p.rect(x + 1, hy + 14, 5, 4, look.glasses === 'sun' ? '#3a3a44' : '#d9eef2aa'); } }
      p.hline(15, 18, hy + 15, gc);
      if (look.glasses !== 'sun') eyes(p, look.eyes || 'dot', look.eyeColor || '#3a2a20', hy);
    }
  }
  hair(p, hairC, view, style, hy);
  if (look.hat) {
    const hc = look.hatColor;
    if (look.hat === 'beret') { const c = hc || '#b5483c'; p.ellipse(15, hy + 1, 11, 4, shade(c, 0.8)); p.ellipse(15, hy, 10, 3, c); p.rect(15, hy - 5, 2, 3, c); }
    if (look.hat === 'cap') { const c = hc || '#3d4a6b'; p.ellipse(16, hy + 4, 11, 6, c); p.rect(5, hy + 4, 22, 4, c); p.rect(20, hy + 7, 10, 2, shade(c, 0.8)); p.hline(9, 14, hy, shade(c, 1.25)); }
    if (look.hat === 'beanie') { const c = hc || '#6d8a58'; p.ellipse(16, hy + 4, 12, 7, c); p.rect(4, hy + 6, 24, 5, shade(c, 0.85)); for (let x = 5; x < 28; x += 2) p.vline(x, hy + 6, hy + 10, shade(c, 0.75)); p.ellipse(16, hy - 3, 3, 3, '#f4ecd6'); }
    if (look.hat === 'bow') { const c = hc || '#e46a5a'; p.ellipse(20, hy + 1, 3, 3, c); p.ellipse(26, hy + 1, 3, 3, c); p.rect(22, hy, 2, 3, shade(c, 0.7)); }
    if (look.hat === 'flower') { for (const [dx, dy] of [[0, -2], [2, 0], [0, 2], [-2, 0]]) p.ellipse(23 + dx, hy + 3 + dy, 1.5, 1.5, hc || '#ef8fae'); p.set(23, hy + 3, '#f2d27a'); }
    if (look.hat === 'headband') { p.hline(5, 26, hy + 5, hc || '#4f7ac9'); p.hline(6, 25, hy + 4, hc || '#4f7ac9'); p.set(10, hy + 3, shade(hc || '#4f7ac9', 1.3)); }
  }
  _soft(p, 0.4);
  return p;
}
