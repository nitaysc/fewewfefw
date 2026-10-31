// Art taken from the owner's reference sheets (docs/art-references): characters, cats and
// furniture cut out, cleaned up and saved as PNGs in www/img/ref. This module loads them
// and says which picture to use for a person, a cat or a piece of furniture; anything
// without a picture falls back to the art drawn in code.
import { MANIFEST } from './refmanifest.js';

const imgs = new Map();
let ready = false;
export const refsReady = () => ready;
export function loadRefs() {
  if (typeof Image === 'undefined') return Promise.resolve();
  const all = Object.keys(MANIFEST).map((n) => new Promise((res) => {
    const im = new Image();
    im.onload = () => { imgs.set(n, im); res(); };
    im.onerror = () => res();
    im.src = `img/ref/${n}.png`;
  }));
  return Promise.all(all).then(() => { ready = true; });
}
const flipped = new Map();
// a loaded picture, optionally mirrored: { canvas, w, h } in the picture's own pixels
export function refImg(name, flip = false) {
  const im = imgs.get(name);
  if (!im) return null;
  if (!flip) return { canvas: im, w: im.width, h: im.height };
  if (!flipped.has(name)) {
    const c = document.createElement('canvas'); c.width = im.width; c.height = im.height;
    const g = c.getContext('2d'); g.translate(im.width, 0); g.scale(-1, 1); g.drawImage(im, 0, 0);
    flipped.set(name, c);
  }
  return { canvas: flipped.get(name), w: im.width, h: im.height };
}

// ---------- people ----------
// side: which way the side and walking pictures face
// sit poses (from the seated sheet): cup = holding a drink, eat = eating cake, sitBack = seen
// from behind, sitSide = side view facing sideFaces (1 right, -1 left)
const seated = (n, sideFaces = 1, cup = n + '_sitcup') => ({ cup, eat: n + '_siteat', sitBack: n + '_sitback', sitSide: n + '_sitside', sideFaces });
export const MODELS = {
  barista: { name: 'Barista', front: 'barista_front', back: 'barista_back', side: 'barista_side', walk: ['barista_walk1', 'barista_walk2', 'barista_walk3', 'barista_walk2'], faces: 1, staff: true },
  catear: { name: 'Cat-ear barista', front: 'catear_front', back: 'catear_back', side: 'catear_side', walk: ['catear_walk', 'catear_side'], faces: 1, staff: true },
  hoodie: { name: 'Hoodie', front: 'hoodie_front', back: 'hoodie_back', side: 'hoodie_side', walk: ['hoodie_walk1', 'hoodie_walk2', 'hoodie_walk1', 'hoodie_walk2'], faces: -1, ...seated('hoodie', 1, 'hoodie_sitcup2') },
  pink: { name: 'Pink coat', front: 'pink_front', back: 'pink_back', side: 'pink_side', walk: ['pink_side'], faces: 1, ...seated('pink', -1) },
  jacket: { name: 'Green jacket', front: 'jacket_front', ...seated('jacket') },
  sweater: { name: 'White sweater', front: 'sweater_front', ...seated('sweater') },
  jacket2: { name: 'Olive jacket', front: 'jacket2_front' },
  grandpa: { name: 'Grandpa', front: 'grandpa_front', back: 'grandpa_back', side: 'grandpa_side', walk: ['grandpa_walk1', 'grandpa_walk2', 'grandpa_walk3', 'grandpa_walk4'], faces: -1 },
  raincoat: { name: 'Raincoat', front: 'raincoat_front', back: 'raincoat_back', side: 'raincoat_walk1', walk: ['raincoat_walk1', 'raincoat_walk2', 'raincoat_walk3', 'raincoat_walk4'], faces: 1 },
  student: { name: 'Student', front: 'student_front', back: 'student_back', side: 'student_side', walk: ['student_walk1', 'student_walk2', 'student_walk3', 'student_walk4'], faces: 1 },
  cap: { name: 'Cap and apron', front: 'cap_front', staff: true, ...seated('cap', -1) },
  cap2: { name: 'Black apron', front: 'cap2_front', staff: true },
};
export const MODEL_ORDER = Object.keys(MODELS);
export const CUSTOMER_MODELS = ['hoodie', 'pink', 'jacket', 'sweater', 'jacket2', 'grandpa', 'raincoat', 'student'];
const PERSON_H = 46; // how tall a person stands in the café, in world pixels
export const personScale = (model) => PERSON_H / (MANIFEST[MODELS[model].front]?.[1] || 92);
export const PERSON_HEIGHT = PERSON_H;
// seated pictures come from another sheet: size them so a seated person is a bit shorter than standing
export const sitScale = (model, name) => (PERSON_H * 0.84) / (MANIFEST[MODELS[model].cup]?.[1] || MANIFEST[name]?.[1] || 88);

// which picture shows a person right now; returns { name, flip }
export function personPose(model, p, t) {
  const M = MODELS[model];
  if (!M) return null;
  if (p.sitting) {
    if (M.cup) {
      if (p.view === 'back') return { name: M.sitBack, flip: false, sit: true };
      // waiting for the order: side on; once it arrives: the cup, or the cake if there is food
      if (p.state === 'drink') {
        const food = p.items?.some((i) => i.kind === 'food'), drink = p.items?.some((i) => i.kind === 'drink');
        return { name: food && (!drink || Math.floor(t / 4 + (p.seed || 0)) % 2) ? M.eat : M.cup, flip: false, sit: true, holding: true };
      }
      return { name: M.sitSide, flip: !!p.flip === (M.sideFaces !== -1), sit: true };
    }
    return { name: p.view === 'back' && M.back ? M.back : M.front, flip: false, cut: true };
  }
  if (p.moving) {
    if (p.view === 'back' && M.back) return { name: M.back, flip: false, bob: true };
    if (M.walk) { const f = M.walk[Math.floor(t * 7) % M.walk.length]; return { name: f, flip: M.faces === -1 ? !p.flip : !!p.flip }; }
    return { name: M.front, flip: false, bob: true };
  }
  if (p.view === 'back' && M.back) return { name: M.back, flip: false };
  return { name: M.front, flip: false };
}

// ---------- cats ----------
const CAT = {
  orange: { sit: 'orange_sit', walk: ['orange_walk1', 'orange_walk2', 'orange_walk3', 'orange_walk2'], sleep: 'orange_sleep', groom: 'orange_groom', happy: 'orange_stand', h: 17 / 43 },
  calico: { sit: 'calico_sit', walk: ['calico_walk1', 'calico_walk2', 'calico_walk3', 'calico_walk2'], sleep: 'calico_sleep', happy: 'calico_stand', h: 17 / 41 },
  grey: { sit: 'grey_sit', walk: ['grey_stand'], sleep: 'calicoF_sleep', happy: 'grey_stand', h: 17 / 27 },
  black: { sit: 'dark_sit', walk: ['black_walk'], happy: 'black_walk', h: 17 / 28 },
  tuxedo: { sit: 'tux_sit', walk: ['tux_stand'], happy: 'tux_stand', h: 15 / 23 },
};
CAT.tabby = CAT.orange;
// which picture shows a cat; the pictures face right
export function catPose(coat, state, t, phase) {
  const C = CAT[coat];
  if (!C) return null;
  let name = C.sit;
  if (state === 'walk') name = C.walk[Math.floor(t * 6 + phase) % C.walk.length];
  else if (state === 'sleep') name = C.sleep || C.sit;
  else if (state === 'groom') name = C.groom || C.sit;
  else if (state === 'happy') name = C.happy || C.sit;
  return { name, scale: C.h };
}

// ---------- furniture ----------
// for each catalog item: the picture for each quarter turn ([name, mirrored]) and its width in the café
// views drawn on the four-ways sheet: [rot0, rot1, rot2, rot3] faces +y, -x, -y, +x
const four = (n) => [[n + '_r0', false], [n + '_r1', false], [n + '_r2', false], [n + '_r3', false]];
// long counters are drawn running up to the right with their front on the right (rot 3); the
// other quarter turns use the same picture or its mirror
const longCounter = (n) => [[n, true], [n, false], [n, true], [n, false]];
export const FURNITURE = {
  chair: { rots: four('chairB'), w: 24, seatZ: 13 },
  chair_spindle: { rots: four('chairA'), w: 23, seatZ: 13 },
  armchair: { rots: four('armgreen'), w: 30, seatZ: 11 },
  armchair_pink: { rots: four('armpink'), w: 30, seatZ: 11 },
  sofa: { rots: [['sofabrown_r0', false], ['sofabrown_back', false], ['sofabrown_back', true], ['sofabrown_r3', false]], w: 50, seatZ: 11 },
  sofa_grey: { rots: [['sofagrey_r0', false], ['sofagrey_back', true], ['sofagrey_back', false], ['sofagrey_r3', false]], w: 50, seatZ: 11 },
  espresso: { rots: longCounter('ctr_espresso'), w: 50 },
  counter_long: { rots: longCounter('ctr_plain'), w: 50 },
  counter_register: { rots: longCounter('ctr_register'), w: 50 },
  counter_beans: { rots: longCounter('ctr_beans'), w: 50 },
  cake_counter: { rots: longCounter('ctr_cakecase'), w: 50 },
  cup_hutch: { rots: [['ctr_shelf', false], ['ctr_shelf', true], ['ctr_shelf', true], ['ctr_shelf', false]], w: 30 },
  stool: { img: 'stool_brown', w: 17, seatZ: 15 },
  stool_green: { img: 'stool_green', w: 17, seatZ: 15 },
  stool_cream: { img: 'stool_cream', w: 17, seatZ: 15 },
  table_round: { img: 'table_round', w: 30, surface: 20 },
  table_cake: { img: 'table_cake', w: 30, surface: 20 },
  coffee_table: { img: 'coffee_table', w: 40, surface: 14 },
  coffee_table_cakes: { img: 'coffee_table_cakes', w: 42, surface: 14 },
  plant_big: { img: 'monstera', w: 26 },
  plant_small: { img: 'plant_mid', w: 20 },
  potted_fern: { img: 'plant_small', w: 18 },
  cat_tree: { img: 'cattree_tall', w: 30 },
  cattree_small: { img: 'cattree_small', w: 28 },
  menu_board: { img: 'menu_board', w: 20 },
  welcome_board: { img: 'welcome_board', w: 20 },
  hanging_plant: { img: 'hanging_big', w: 18, lift: 26 },
  rug_paw: { img: 'rug_paw', w: 44, flat: true },
};
export function furniturePic(type, rot) {
  const F = FURNITURE[type];
  if (!F) return null;
  const [name, flip] = F.rots ? F.rots[rot % 4] : [F.img, false];
  const im = refImg(name, flip);
  if (!im) return null;
  return { ...im, scale: F.w / im.w, lift: F.lift || 0 };
}
