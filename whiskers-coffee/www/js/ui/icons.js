// Small pixel-art UI icons, drawn from letter grids like the rest of the art.
import { grid } from '../art/pix.js';

const PAL = { C: '#8a5434', V: '#fffaf0', Q: '#c9a04f', E: '#ef8fae', G: '#b8bec0', R: '#e88a96', Z: '#d9b48a', o: '#24160f', y: '#ffd27a', Y: '#d29b3a', w: '#f4efe6', W: '#cdb98f', r: '#e46a5a', g: '#8fd16a', b: '#6f8fc9', p: '#ff8fa3', k: '#7a4e30', K: '#5b3a26', s: '#b8bec0' };

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
  sun: ['...yy...', '.y.yy.y.', '..yYYy..', 'yyYYYYyy', 'yyYYYYyy', '..yYYy..', '.y.yy.y.', '...yy...'],
  moon: ['..oooo..', '.owwwo..', 'owwwo...', 'owwwo...', 'owwwo...', 'owwwwo.o', '.owwwwwo', '..oooooo'],
  cup: ['.w.w.w..', '..w.w...', 'ooooooo.', 'owwwwwooo', 'owwwwwo.o', 'owwwwwooo', '.owwwo..', 'ooooooo.'],
  rag: ['........', '.oooooo.', 'obbbbbbo', 'obwbbwbo', 'obbbbbbo', 'obbwbbbo', '.oooooo.', '........'],
  bin: ['..oooo..', 'oooooooo', '.osssso.', '.osososo'.slice(0, 8), '.osososo'.slice(0, 8), '.osssso.', '.osssso.', '..oooo..'],
  up: ['........', '...oo...', '..owwo..', '.owwwwo.', 'owwwwwwo', 'oooooooo', '........', '........'],
  down: ['........', '........', 'oooooooo', 'owwwwwwo', '.owwwwo.', '..owwo..', '...oo...', '........'],
  mug: ['...w..w.....', '....w..w....', '...w..w.....', 'oooooooooo..', 'oCCCCCCCCooo', 'oVVVVVVVVo.o', 'oVVVVVVVVo.o', 'oVVVVVVVVooo', '.oVVVVVVo...', '..oooooo....', 'oooooooooooo', '.oQQQQQQQQo.'],
  paw2: ['...oo..oo...', '..oEEooEEo..', '..oEEooEEo..', 'oo.oo..oo.oo', 'oEo......oEo', 'oEo.oooo.oEo', '.o.oEEEEo.o.', '..oEEEEEEo..', '.oEEEEEEEEo.', '.oEEEEEEEEo.', '..oEEEEEEo..', '...oooooo...'],
  sofa: ['............', '..oooooooo..', '.oZZZZZZZZo.', '.oZCCCCCCZo.', 'ooZCCCCCCZoo', 'oZooooooooZo', 'oZZZZZZZZZZo', 'oZCCCCCCCCZo', 'oooooooooooo', '.oo......oo.', '............', '............'],
  gear2: ['....oooo....', '..o.oGGo.o..', '.oGooGGooGo.', '..oGGGGGGo..', 'ooGGGooGGGoo', 'oGGGo..oGGGo', 'oGGGo..oGGGo', 'ooGGGooGGGoo', '..oGGGGGGo..', '.oGooGGooGo.', '..o.oGGo.o..', '....oooo....'],
  back: ['...o....', '..owo...', '.owwoooo', 'owwwwwwo', '.owwoooo', '..owo...', '...o....', '........'],
};

const cache = new Map();
export function icon(name, scale = 3) {
  const key = name + scale;
  if (!cache.has(key)) cache.set(key, grid(ICONS[name], PAL).toCanvas(scale).toDataURL());
  return cache.get(key);
}
export const iconImg = (name, scale = 3, cls = 'ic') => `<img class="${cls}" src="${icon(name, scale)}" alt="">`;
