// Chibi pixel people built from parts, so players and customers can be customised.
// Front view faces the camera (walking down the screen); back view walks up. Both are
// drawn facing right and mirrored for left.
import { Pix, shade } from './pix.js';

export const HAIR_STYLES = ['short', 'bob', 'long', 'bun', 'curly', 'spiky'];
export const SKINS = ['#f6d7b8', '#eec39a', '#d9a273', '#b97f55', '#8d5a3b', '#6b4029'];
export const HAIR_COLORS = ['#2b1d16', '#5a3a26', '#8b5a2b', '#c98b4a', '#e6c27a', '#b4473a', '#3d4a6b', '#d8d4cc', '#7a5c9e'];
export const OUTFIT_COLORS = ['#b5483c', '#3d4a6b', '#6d8a58', '#d29b3a', '#c9786f', '#7a5c9e', '#2f3f4a', '#e8d7b0', '#4f8a8b'];

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
  const skin = look.skin, hair = look.hair, shirt = look.shirt, pants = look.pants;
  const apron = look.apron === false ? null : (look.apronColor || '#e8d7b0');
  const leftUp = frame === 1 ? 1 : 0, rightUp = frame === 3 ? 1 : 0;

  // long hair hangs behind the body
  if (look.style === 'long') part(p, 3, 8 + bob, 10, 11, shade(hair, 0.85), false);

  // legs and shoes
  if (sit) {
    part(p, 4, 20, 8, 3, pants);
    p.rect(4, 23, 3, 2, shade(pants, 0.85)); p.rect(9, 23, 3, 2, shade(pants, 0.85));
    p.rect(4, 25, 3, 1, '#3b2a20'); p.rect(9, 25, 3, 1, '#3b2a20');
  } else {
    part(p, 5, 20 - leftUp, 3, 5, pants);
    part(p, 8, 20 - rightUp, 3, 5, shade(pants, 0.92));
    p.rect(5, 25 - leftUp, 3, 2, '#3b2a20');
    p.rect(8, 25 - rightUp, 3, 2, '#2e2019');
  }

  // torso
  const ty = 12 + bob;
  part(p, 4, ty, 8, 8, shirt);
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
  part(p, 2, ty + 1 + swing, 2, 5, shade(shirt, 0.9), false);
  part(p, 12, ty + 1 - swing, 2, 5, shade(shirt, 0.75), false);
  p.rect(2, ty + 6 + swing, 2, 2, skin);
  p.rect(12, ty + 6 - swing, 2, 2, shade(skin, 0.85));

  // head
  const hy = 2 + bob;
  p.rect(4, hy, 8, 10, skin);
  p.rect(3, hy + 1, 10, 8, skin);
  p.rect(12, hy + 2, 1, 6, shade(skin, 0.88));

  if (view === 'front') {
    // eyes, blush, mouth (three-quarter view, looking right)
    p.rect(7, hy + 5, 1, 2, '#2b1d16'); p.rect(10, hy + 5, 1, 2, '#2b1d16');
    p.set(7, hy + 5, '#5a4a40');
    p.set(6, hy + 7, '#e7a0a6'); p.set(11, hy + 7, '#e7a0a6');
    p.set(9, hy + 8, shade(skin, 0.7));
  }

  drawHair(p, look.style, hair, view, hy);
  if (look.hat) drawHat(p, look.hat, hy);
  p.outline('#24160f');
  return p;
}

function drawHair(p, style, c, view, hy) {
  const hl = shade(c, 1.25), dk = shade(c, 0.8);
  const top = () => { p.rect(4, hy - 1, 8, 2, c); p.rect(3, hy, 10, 3, c); p.rect(5, hy - 1, 4, 1, hl); };
  if (view === 'back') {
    top();
    const len = style === 'short' || style === 'spiky' || style === 'curly' ? 7 : style === 'bun' ? 8 : style === 'bob' ? 9 : 14;
    p.rect(3, hy + 2, 10, len - 2, c);
    p.rect(12, hy + 2, 1, len - 2, dk);
    if (style === 'bun') p.ellipse(8, hy - 2, 2, 2, c);
    if (style === 'spiky') for (let x = 3; x <= 12; x += 3) p.set(x, hy - 2, c);
    if (style === 'curly') for (let x = 3; x <= 12; x += 2) p.set(x, hy - 2, c);
    return;
  }
  top();
  switch (style) {
    case 'short':
      p.rect(3, hy + 3, 2, 3, c); p.rect(12, hy + 3, 1, 2, dk);
      p.set(5, hy + 3, c); p.set(8, hy + 3, c); p.set(9, hy + 3, c);
      break;
    case 'bob':
      p.rect(3, hy + 3, 2, 7, c); p.rect(11, hy + 3, 2, 7, dk);
      p.rect(5, hy + 3, 5, 1, c);
      break;
    case 'long':
      p.rect(3, hy + 3, 2, 9, c); p.rect(11, hy + 3, 2, 9, dk);
      p.rect(5, hy + 3, 4, 1, c);
      break;
    case 'bun':
      p.ellipse(8, hy - 3, 2, 2, c); p.set(7, hy - 4, hl);
      p.rect(3, hy + 3, 1, 4, c); p.rect(12, hy + 3, 1, 3, dk);
      break;
    case 'curly':
      for (let x = 3; x <= 12; x += 2) { p.set(x, hy - 2, c); p.set(x + 1, hy + 3, c); }
      p.rect(2, hy + 1, 2, 7, c); p.rect(12, hy + 1, 2, 7, dk);
      p.set(2, hy + 8, c); p.set(13, hy + 8, dk);
      break;
    case 'spiky':
      for (let x = 3; x <= 12; x += 3) { p.set(x, hy - 2, c); p.set(x + 1, hy - 3, c); }
      p.rect(3, hy + 3, 1, 3, c); p.set(6, hy + 3, c); p.set(9, hy + 3, c);
      break;
  }
}

function drawHat(p, hat, hy) {
  if (hat === 'beret') { p.ellipse(8, hy - 1, 5, 2, '#b5483c'); p.set(8, hy - 4, '#b5483c'); }
  if (hat === 'cap') { p.rect(3, hy - 2, 10, 3, '#3d4a6b'); p.rect(10, hy + 1, 5, 1, '#3d4a6b'); }
  if (hat === 'beanie') { p.rect(3, hy - 2, 10, 4, '#6d8a58'); p.rect(3, hy + 1, 10, 1, '#4f6a40'); p.set(8, hy - 3, '#e8d7b0'); }
}

const cache = new Map();
export function personSprite(look, view, frame, flip) {
  const key = JSON.stringify(look) + view + frame + flip;
  if (!cache.has(key)) {
    const p = drawPerson(look, view, frame);
    let out = p;
    if (flip) { out = new Pix(p.w, p.h); out.blit(p, 0, 0, true); }
    cache.set(key, { canvas: out.toCanvas(), w: out.w, h: out.h });
    if (cache.size > 600) cache.delete(cache.keys().next().value);
  }
  return cache.get(key);
}

export function randomLook(r = Math.random) {
  const pick = (a) => a[Math.floor(r() * a.length)];
  return {
    skin: pick(SKINS), hair: pick(HAIR_COLORS), style: pick(HAIR_STYLES),
    shirt: pick(OUTFIT_COLORS), pants: pick(['#3d4a6b', '#4a3a30', '#2f3f4a', '#6b5a48', '#3b3b44']),
    apron: false, hat: r() < 0.2 ? pick(['beret', 'cap', 'beanie']) : null,
  };
}
