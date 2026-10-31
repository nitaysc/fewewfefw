// Hand-drawn cat frames, facing right (mirrored for left). Letters are palette slots, so one
// set of frames serves every coat: o outline, b base, s shade, l light (muzzle/belly),
// p pattern (stripes/patches), e eye, n nose and inner ear, w eye shine.
import { grid } from './pix.js';

const FRAMES = {
  walk1: [
    '..............o...o..',
    '.............ono.ono.',
    '.oo..........obbsbbbo',
    'oppo........obbbbbbbo',
    'opbo........obebbbebo',
    '.obo........obwlnlwbo',
    '..obooooooooobblllbo.',
    '..obbpbbpbbpbbbbbbo..',
    '..obbbbbbbbbbbbbbbo..',
    '...osbbbsssssbbbbso..',
    '...osbo.osso..osbo...',
    '...obo..obo....obo...',
    '...oo...oo.....oo....',
  ],
  walk2: [
    '..............o...o..',
    '.............ono.ono.',
    '..oo.........obbsbbbo',
    '.oppo.......obbbbbbbo',
    '.opbo.......obebbbebo',
    '..obo.......obwlnlwbo',
    '..obooooooooobblllbo.',
    '..obbpbbpbbpbbbbbbo..',
    '..obbbbbbbbbbbbbbbo..',
    '..osbbbbsssssbbbbso..',
    '..osbo..osbo.osbo....',
    '...obo..obo...obo....',
    '...oo....oo...oo.....',
  ],
  sit1: [
    '.......o...o.',
    '......ono.ono',
    '......obbsbbo',
    '.....obbbbbbbo',
    '.....obebbbebo',
    '.....obwlnlwbo',
    '......obblllbo',
    '.....obpbbbbo.',
    '....obbpbbllbo',
    '....obbpbbllbo',
    'oo..obbbbbllbo',
    'opo.osbbbbllbo',
    '.obooosbbsbbbo',
    '..obbbbsbbsbbo',
    '...oooooooooo.',
  ],
  sit2: [
    '.......o...o.',
    '......ono.ono',
    '......obbsbbo',
    '.....obbbbbbbo',
    '.....obebbbebo',
    '.....obwlnlwbo',
    '......obblllbo',
    '.....obpbbbbo.',
    '....obbpbbllbo',
    '....obbpbbllbo',
    '....obbbbbllbo',
    '.oo.osbbbbllbo',
    'opbooosbbsbbbo',
    '.obbbbbsbbsbbo',
    '..ooooooooooo.',
  ],
  blink: [
    '.......o...o.',
    '......ono.ono',
    '......obbsbbo',
    '.....obbbbbbbo',
    '.....obobbbobo',
    '.....obblnlbbo',
    '......obblllbo',
    '.....obpbbbbo.',
    '....obbpbbllbo',
    '....obbpbbllbo',
    'oo..obbbbbllbo',
    'opo.osbbbbllbo',
    '.obooosbbsbbbo',
    '..obbbbsbbsbbo',
    '...oooooooooo.',
  ],
  groom: [
    '.......o...o.',
    '......ono.ono',
    '......obbsbbo',
    '.....obbbbbbbo',
    '.....obobbbobo',
    '.....obblnlbbo',
    '......obbllllo',
    '.....obpbbollo',
    '....obbpbbollo',
    '....obbpbbllbo',
    'oo..obbbbbllbo',
    'opo.osbbbbllbo',
    '.obooosbbsbbbo',
    '..obbbbsbbsbbo',
    '...oooooooooo.',
  ],
  sleep1: [
    '..........o...o...',
    '....oooooono.ono..',
    '..oobbpbbobbsbbbo.',
    '.obbbpbbbbbbbbbbbo',
    'obbbbpbbbbobbbobbo',
    'obbbbbbbbbbblnlbbo',
    'osbbbbbbbbbbblllo.',
    'opssbbbbbbbbbbbso.',
    '.oppsssssssssssso.',
    '..oooooooooooooo..',
  ],
  sleep2: [
    '..................',
    '..........o...o...',
    '....oooooono.ono..',
    '..oobbpbbobbsbbbo.',
    '.obbbpbbbbbbbbbbbo',
    'obbbbpbbbbobbbobbo',
    'obbbbbbbbbbblnlbbo',
    'opssbbbbbbbbblllo.',
    '.oppsssssssssssso.',
    '..oooooooooooooo..',
  ],
  happy: [
    '.......o...o.',
    '......ono.ono',
    '......obbsbbo',
    '.....obbbbbbbo',
    '.....oboobobbo',
    '.....obblnlnbo',
    '......obblllbo',
    '.....obpbbbbo.',
    '....obbpbbllbo',
    '....obbpbbllbo',
    '.oo.obbbbbllbo',
    'opbo.osbbbllbo',
    '.obooosbbsbbbo',
    '..obbbbsbbsbbo',
    '...oooooooooo.',
  ],
};

export const COATS = {
  cream: { b: '#f3e1c0', s: '#d9bf98', l: '#fff6e6', p: '#e8cfa6', e: '#3a2a20', n: '#e7a0a6', w: '#ffffff', o: '#3b2a20' },
  orange: { b: '#e8954a', s: '#c56f2c', l: '#fbe3c4', p: '#c96a28', e: '#2b2018', n: '#e98a8f', w: '#ffffff', o: '#3d2516' },
  black: { b: '#3a3844', s: '#2a2832', l: '#55525f', p: '#33313c', e: '#c9d65a', n: '#a86a76', w: '#ffffff', o: '#16141a' },
  tuxedo: { b: '#34323c', s: '#26252d', l: '#f4f1ea', p: '#34323c', e: '#9bd36a', n: '#e7a0a6', w: '#ffffff', o: '#15141a' },
  grey: { b: '#a7a9b2', s: '#868893', l: '#e4e5ea', p: '#7c7e89', e: '#3f8fb8', n: '#d98c95', w: '#ffffff', o: '#2e2f36' },
  calico: { b: '#f4ede0', s: '#d7cdbb', l: '#ffffff', p: '#d98a3d', e: '#5a3f22', n: '#e7a0a6', w: '#ffffff', o: '#3a2c22' },
};

const cache = new Map();
// returns { canvas, w, h } for a cat frame in the given coat
export function catFrame(frame, coat, flip = false) {
  const key = frame + coat + flip;
  if (!cache.has(key)) {
    const pal = COATS[coat] || COATS.cream;
    let pix = grid(FRAMES[frame], pal);
    if (flip) {
      const f = grid(FRAMES[frame], pal);
      pix = new f.constructor(f.w, f.h);
      pix.blit(f, 0, 0, true);
    }
    cache.set(key, { canvas: pix.toCanvas(), w: pix.w, h: pix.h });
  }
  return cache.get(key);
}

export const CAT_FRAMES = Object.keys(FRAMES);
