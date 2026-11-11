import { RNG, rngFrom } from '../../services/rng';

/**
 * ODD ONE OUT puzzle generator.
 *
 * A puzzle is a grid of glyph specs. Every recipe changes exactly one feature on exactly one
 * cell. `featureKey` reduces a cell to the feature being tested (ignoring deliberate noise such
 * as random rotation), and `validatePuzzle` proves there is one and only one odd cell.
 */

export const OO_ROUNDS = 8;

export type GlyphKind = 'arc' | 'ell' | 'flag' | 'spokes' | 'dotgrid' | 'bars' | 'poly' | 'rings' | 'pie' | 'half' | 'tone' | 'core';

export interface Cell {
  glyph: GlyphKind;
  /** rotation in degrees */
  rot: number;
  /** count-like parameter (spokes, bars, sides, rings, grid size) */
  n: number;
  /** mirrored horizontally */
  flip: boolean;
  /** free parameter: sector angle, inner radius, missing-dot index, lightness */
  a: number;
  color: string;
}

export type RecipeId =
  | 'arc-rot'
  | 'ell-rot'
  | 'flag-mirror'
  | 'spokes-count'
  | 'dots-missing'
  | 'bars-count'
  | 'bars-rot'
  | 'poly-sides'
  | 'rings-count'
  | 'pie-angle'
  | 'half-rot'
  | 'tone'
  | 'core-size';

export type Difficulty = 0 | 1 | 2;

export interface Puzzle {
  recipe: RecipeId;
  difficulty: Difficulty;
  cols: number;
  cells: Cell[];
  answer: number;
  timeMs: number;
  /** shown after the round */
  explain: string;
}

export const GLYPH_COLORS = ['#ECECF1', '#ABA6FF', '#BDF26D', '#F4D98B', '#7FD8F0'];

const mod = (v: number, m: number) => ((v % m) + m) % m;

interface Built {
  base: Cell;
  odd: Cell;
  /** per-cell noise that must not affect the tested feature */
  noise?: (cell: Cell, rng: RNG) => Cell;
  explain: string;
}

type Recipe = (rng: RNG, d: Difficulty, color: string) => Built;

const cell = (glyph: GlyphKind, color: string, over: Partial<Cell> = {}): Cell => ({ glyph, rot: 0, n: 0, flip: false, a: 0, color, ...over });
const sign = (rng: RNG) => (rng.chance(0.5) ? 1 : -1);

const RECIPES: Record<RecipeId, Recipe> = {
  'arc-rot': (rng, d, color) => {
    const rot = rng.int(0, 23) * 15;
    const delta = [180, 90, 30][d] * sign(rng);
    const base = cell('arc', color, { rot });
    return { base, odd: { ...base, rot: mod(rot + delta, 360) }, explain: 'Its gap points a different way.' };
  },
  'ell-rot': (rng, d, color) => {
    const rot = rng.int(0, 3) * 90;
    const base = cell('ell', color, { rot });
    if (d === 2) return { base, odd: { ...base, flip: true }, explain: 'It is a mirror image of the others.' };
    return { base, odd: { ...base, rot: mod(rot + (d === 0 ? 180 : 90), 360) }, explain: 'It is turned a different way.' };
  },
  'flag-mirror': (rng, d, color) => {
    const rot = rng.int(0, 3) * 90;
    const base = cell('flag', color, { rot });
    if (d === 0) return { base, odd: { ...base, rot: mod(rot + 180, 360) }, explain: 'It is upside down.' };
    return {
      base,
      odd: { ...base, flip: true },
      noise: d === 2 ? (c, r) => ({ ...c, rot: r.int(0, 3) * 90 }) : undefined,
      explain: d === 2 ? 'Its flag is mirrored — no rotation makes it match.' : 'Its flag points the other way.',
    };
  },
  'spokes-count': (rng, d, color) => {
    const n = [rng.int(3, 4), rng.int(5, 6), rng.int(7, 8)][d];
    const oddN = d === 0 ? n + 2 : n + sign(rng);
    const base = cell('spokes', color, { n });
    return {
      base,
      odd: { ...base, n: oddN },
      noise: d === 2 ? (c, r) => ({ ...c, rot: r.int(0, 11) * 15 }) : undefined,
      explain: `It has ${oddN} spokes instead of ${n}.`,
    };
  },
  'dots-missing': (rng, d, color) => {
    const n = d === 2 ? 4 : 3;
    const total = n * n;
    if (d === 1) {
      const m1 = rng.int(0, total - 1);
      let m2 = rng.int(0, total - 1);
      if (m2 === m1) m2 = (m1 + 1 + rng.int(0, total - 2)) % total;
      const base = cell('dotgrid', color, { n, a: m1 });
      return { base, odd: { ...base, a: m2 }, explain: 'Its missing dot is in a different place.' };
    }
    const base = cell('dotgrid', color, { n, a: -1 });
    return { base, odd: { ...base, a: rng.int(0, total - 1) }, explain: 'It is missing a dot.' };
  },
  'bars-count': (rng, d, color) => {
    const [n, oddN] = [
      [2, 4],
      [3, 4],
      [4, 5],
    ][d];
    const swap = rng.chance(0.5);
    const base = cell('bars', color, { n: swap ? oddN : n, rot: rng.pick([0, 90]) });
    const odd = { ...base, n: swap ? n : oddN };
    return { base, odd, explain: `It has ${odd.n} bars instead of ${base.n}.` };
  },
  'bars-rot': (rng, d, color) => {
    const rot = rng.int(0, 5) * 30;
    const delta = [90, 35, 14][d] * sign(rng);
    const base = cell('bars', color, { n: 4, rot });
    return { base, odd: { ...base, rot: mod(rot + delta, 180) }, explain: 'Its stripes run at a different angle.' };
  },
  'poly-sides': (rng, d, color) => {
    const n = [rng.int(3, 4), 5, 7][d];
    const oddN = d === 0 ? (n === 3 ? 4 : 3) : n + 1;
    const swap = d > 0 && rng.chance(0.5);
    const base = cell('poly', color, { n: swap ? oddN : n });
    const odd = { ...base, n: swap ? n : oddN };
    return { base, odd, explain: `It has ${odd.n} sides instead of ${base.n}.` };
  },
  'rings-count': (rng, d, color) => {
    const [n, oddN] = [
      [1, 3],
      [2, 3],
      [3, 4],
    ][d];
    const swap = rng.chance(0.5);
    const base = cell('rings', color, { n: swap ? oddN : n });
    const odd = { ...base, n: swap ? n : oddN };
    return { base, odd, explain: `It has ${odd.n} ring${odd.n === 1 ? '' : 's'} instead of ${base.n}.` };
  },
  'pie-angle': (rng, d, color) => {
    const rot = rng.int(0, 7) * 45;
    const oddA = [180, 135, 112][d];
    const swap = rng.chance(0.5);
    const base = cell('pie', color, { rot, a: swap ? oddA : 90 });
    const odd = { ...base, a: swap ? 90 : oddA };
    return { base, odd, explain: odd.a > base.a ? 'Its slice is bigger.' : 'Its slice is smaller.' };
  },
  'half-rot': (rng, d, color) => {
    const rot = rng.int(0, 3) * 90;
    const base = cell('half', color, { rot });
    return { base, odd: { ...base, rot: mod(rot + (d === 0 ? 180 : 90 * sign(rng)), 360) }, explain: 'Its filled half faces a different corner.' };
  },
  tone: (rng, d, color) => {
    const light = rng.int(52, 62);
    const delta = [16, 9, 5][d] * sign(rng);
    const base = cell('tone', color, { a: light, n: rng.pick([255, 150, 45, 195]) });
    return { base, odd: { ...base, a: light + delta }, explain: delta > 0 ? 'It is a slightly lighter shade.' : 'It is a slightly darker shade.' };
  },
  'core-size': (rng, d, color) => {
    const delta = [9, 5, 3][d] * sign(rng);
    const base = cell('core', color, { a: 13 });
    return { base, odd: { ...base, a: 13 + delta }, explain: delta > 0 ? 'Its centre dot is bigger.' : 'Its centre dot is smaller.' };
  },
};

export const RECIPE_IDS = Object.keys(RECIPES) as RecipeId[];

/** Rotational symmetry order of each glyph — rotations that leave it looking identical. */
function symmetryStep(c: Cell): number {
  switch (c.glyph) {
    case 'spokes':
    case 'poly':
      return 360 / Math.max(1, c.n);
    case 'bars':
      return 180;
    case 'rings':
    case 'tone':
    case 'core':
      return 1; // fully symmetric
    case 'dotgrid':
      return c.a < 0 ? 90 : 360;
    default:
      return 360;
  }
}

/** Canonical description of how a cell *looks*; two cells with the same key are visually identical. */
export function visualKey(c: Cell): string {
  const rot = Math.round(mod(c.rot, symmetryStep(c)) * 100) / 100;
  return [c.glyph, rot, c.n, c.flip ? 'm' : '', c.a, c.color].join('|');
}

/** The feature a recipe varies, ignoring that recipe's deliberate noise. */
export function featureKey(recipe: RecipeId, difficulty: Difficulty, c: Cell): string {
  const noisyRotation = difficulty === 2 && (recipe === 'flag-mirror' || recipe === 'spokes-count');
  return noisyRotation ? visualKey({ ...c, rot: 0 }) : visualKey(c);
}

export function validatePuzzle(p: Puzzle): boolean {
  if (p.cells.length !== p.cols * p.cols || p.answer < 0 || p.answer >= p.cells.length) return false;
  const groups = new Map<string, number[]>();
  p.cells.forEach((c, i) => {
    const key = featureKey(p.recipe, p.difficulty, c);
    groups.set(key, [...(groups.get(key) ?? []), i]);
  });
  if (groups.size !== 2) return false;
  const singles = [...groups.values()].filter((g) => g.length === 1);
  return singles.length === 1 && singles[0][0] === p.answer;
}

export interface Level {
  cols: number;
  difficulty: Difficulty;
  timeMs: number;
}

/** Eight rounds: grids grow and differences shrink. */
export const LEVELS: Level[] = [
  { cols: 3, difficulty: 0, timeMs: 12000 },
  { cols: 4, difficulty: 0, timeMs: 12000 },
  { cols: 4, difficulty: 1, timeMs: 12000 },
  { cols: 4, difficulty: 1, timeMs: 11000 },
  { cols: 5, difficulty: 1, timeMs: 11000 },
  { cols: 5, difficulty: 2, timeMs: 11000 },
  { cols: 5, difficulty: 2, timeMs: 10000 },
  { cols: 6, difficulty: 2, timeMs: 12000 },
];

export function makePuzzle(recipe: RecipeId, level: Level, seed: string): Puzzle {
  for (let attempt = 0; attempt < 50; attempt++) {
    const rng = rngFrom('oo', recipe, seed, attempt);
    const color = rng.pick(GLYPH_COLORS);
    const built = RECIPES[recipe](rng, level.difficulty, color);
    const count = level.cols * level.cols;
    const answer = rng.int(0, count - 1);
    const cells: Cell[] = [];
    for (let i = 0; i < count; i++) {
      const c = i === answer ? built.odd : built.base;
      cells.push(built.noise ? built.noise({ ...c }, rng) : { ...c });
    }
    const puzzle: Puzzle = { recipe, difficulty: level.difficulty, cols: level.cols, cells, answer, timeMs: level.timeMs, explain: built.explain };
    if (validatePuzzle(puzzle)) return puzzle;
  }
  throw new Error(`Could not build a valid ${recipe} puzzle for seed ${seed}`);
}

/** Eight different recipes per run. Same seed → same grids for everyone. */
export function buildOddSet(seed: string): Puzzle[] {
  const order = rngFrom('oo-order', seed).shuffle(RECIPE_IDS).slice(0, OO_ROUNDS);
  return LEVELS.map((level, i) => makePuzzle(order[i], level, `${seed}:${i}`));
}
