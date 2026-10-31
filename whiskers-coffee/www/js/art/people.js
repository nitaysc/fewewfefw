// Chibi pixel people built from parts, so players and customers can be customised.
// Front view faces the camera (walking down the screen); back view walks up. Both are
// drawn facing right and mirrored for left.
import { Pix, shade } from './pix.js';

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
  if (sit) {
    part(p, 4, 20, 8, 3, bottom === 'pants' ? pants : bottom === 'dress' ? shirt : pants);
    p.rect(4, 23, 3, 2, shade(legC, 0.85)); p.rect(9, 23, 3, 2, shade(legC, 0.85));
    p.rect(4, 25, 3, 1, shoes); p.rect(9, 25, 3, 1, shade(shoes, 0.85));
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
    const p = drawPerson(look, view, frame);
    let out = p;
    if (flip) { out = new Pix(p.w, p.h); out.blit(p, 0, 0, true); }
    cache.set(key, { canvas: out.toCanvas(), w: out.w, h: out.h });
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
