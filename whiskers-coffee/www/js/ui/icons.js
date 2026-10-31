// Small pixel-art UI icons, drawn from letter grids like the rest of the art.
import { grid } from '../art/pix.js';

const PAL = { o: '#24160f', y: '#ffd27a', Y: '#d29b3a', w: '#f4efe6', W: '#cdb98f', r: '#e46a5a', g: '#8fd16a', b: '#6f8fc9', p: '#ff8fa3', k: '#7a4e30', K: '#5b3a26', s: '#b8bec0' };

const ICONS = {
  coin: ['..oooo..', '.oyyyYo.', 'oyywyyYo', 'oyywyyYo', 'oyywyyYo', 'oyyyyyYo', '.oYYYYo.', '..oooo..'],
  paw: ['.oo..oo.', 'owwo.owwo'.slice(0, 8), 'oo.oo.oo', '.owwwwo.', 'owwwwwwo', 'owwwwwwo', '.owwwwo.', '..oooo..'],
  hammer: ['.ooooo..', 'osssssoo', 'osssssso', '.ooooko.', '....oko.', '....oko.', '....oko.', '....ooo.'],
  rotate: ['..oooo..', '.owwwwo.', 'owo..owo', 'oo....wo', '.....owo', 'ooo..owo', 'owwwwwo.', '.ooooo..'],
  check: ['.......o', '......og', '.....ogo', 'o...ogo.', 'go.ogo..', '.ogogo..', '..ogo...', '...o....'],
  cross: ['oo....oo', 'oro..oro', '.orooro.', '..orro..', '..orro..', '.orooro.', 'oro..oro', 'oo....oo'],
  box: ['.oooooo.', 'oKkkkkKo', 'oooooooo', 'okkyykko', 'okkkkkko', 'okkkkkko', 'okkkkkko', 'oooooooo'],
  move: ['...oo...', '..owwo..', '...ww...', 'ow.ww.wo', 'owwwwwwo', '...ww...', '..owwo..', '...oo...'],
  friend: ['..ooo...', '.owwwo..', '.owwwo.o', '..ooo.og', '.owwwoogg', 'owwwwwog', 'owwwwwo.', 'oooooo..'],
  person: ['..oooo..', '.owwwwo.', '.owwwwo.', '..oooo..', '.owwwwo.', 'owwwwwwo', 'owwwwwwo', 'oooooooo'],
  gear: ['...oo...', '.oowwoo.', '.owwwwo.', 'owwoowwo', 'owwoowwo', '.owwwwo.', '.oowwoo.', '...oo...'],
  heart: ['.oo.oo..', 'oppoppo.', 'opppppo.', '.opppo..', '..opo...', '...o....', '........', '........'],
  star: ['...oo...', '..oyyo..', 'ooyyyyoo', 'oyyyyyyo', '.oyyyyo.', '.oyyyyo.', 'oyyooyyo', 'ooo..ooo'],
  starOff: ['...oo...', '..oKKo..', 'ooKKKKoo', 'oKKKKKKo', '.oKKKKo.', '.oKKKKo.', 'oKKooKKo', 'ooo..ooo'],
  back: ['...o....', '..owo...', '.owwoooo', 'owwwwwwo', '.owwoooo', '..owo...', '...o....', '........'],
};

const cache = new Map();
export function icon(name, scale = 3) {
  const key = name + scale;
  if (!cache.has(key)) cache.set(key, grid(ICONS[name], PAL).toCanvas(scale).toDataURL());
  return cache.get(key);
}
export const iconImg = (name, scale = 3, cls = 'ic') => `<img class="${cls}" src="${icon(name, scale)}" alt="">`;
