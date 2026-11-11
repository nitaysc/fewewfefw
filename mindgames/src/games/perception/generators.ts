import { RNG, rngFrom } from '../../services/rng';

/**
 * PERCEPTION challenge generators.
 *
 * Every generator returns plain data (shapes in a 320×320 viewBox) so the puzzle logic can be
 * validated without rendering anything. `measure` holds the real value behind each option;
 * the answer is always the unique extreme with a deliberate, measurable margin.
 */

export const PE_ROUNDS = 6;
export const PE_TIME_MS = 15000;
export const VIEW = 320;

export const INK = '#ECECF1';
export const DIM = '#5A5A66';
export const FAINT = '#2C2C34';
export const PALETTE = ['#ABA6FF', '#BDF26D', '#F4D98B', '#7FD8F0', '#FF9C8A'];

export type Anim =
  | { kind: 'drift'; dx: number; dy: number; dur: number; delay: number }
  | { kind: 'spin'; dir: 1 | -1; dur: number; delay: number; cx: number; cy: number }
  | { kind: 'pulse'; dur: number; delay: number };

export type Shape =
  | { t: 'circle'; cx: number; cy: number; r: number; fill?: string; stroke?: string; sw?: number; anim?: Anim }
  | { t: 'line'; x1: number; y1: number; x2: number; y2: number; stroke: string; sw: number }
  | { t: 'poly'; pts: [number, number][]; fill?: string; stroke?: string; sw?: number }
  | { t: 'rect'; x: number; y: number; w: number; h: number; rx?: number; fill?: string; stroke?: string; sw?: number }
  | { t: 'text'; x: number; y: number; text: string; size: number; fill: string }
  | { t: 'group'; children: Shape[]; anim?: Anim };

export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

export type TemplateId = 'circles' | 'sizes' | 'lines' | 'count' | 'drift' | 'spin' | 'symmetry' | 'shade' | 'sides' | 'parallel' | 'dots';

export interface Challenge {
  template: TemplateId;
  prompt: string;
  shapes: Shape[];
  /** tappable regions on the figure (answer by tapping) */
  targets?: Box[];
  /** or answer buttons */
  choices?: string[];
  answer: number;
  explain: string;
  /** shapes added once the round is answered (measurements, guides) */
  reveal?: Shape[];
  /** the real quantity behind each option, used for validation */
  measure: number[];
  /** smallest relative margin between the answer and the runner-up that we allow */
  minMargin: number;
}

const rad = (deg: number) => (deg * Math.PI) / 180;
const round1 = (n: number) => Math.round(n * 10) / 10;
const pct = (a: number, b: number) => Math.round((a / b - 1) * 100);
const side = (i: number, n: number) => (n === 2 ? ['left', 'right'][i] : ['first', 'second', 'third', 'fourth', 'fifth'][i]);

function label(x: number, y: number, text: string): Shape {
  return { t: 'text', x, y, text, size: 13, fill: INK };
}

function regularPolygon(cx: number, cy: number, r: number, n: number, rotDeg: number): [number, number][] {
  const pts: [number, number][] = [];
  for (let i = 0; i < n; i++) {
    const a = rad(rotDeg) + (i * 2 * Math.PI) / n;
    pts.push([round1(cx + r * Math.cos(a)), round1(cy + r * Math.sin(a))]);
  }
  return pts;
}

/** Ebbinghaus illusion: the larger centre circle is surrounded by big neighbours, so it looks smaller. */
function circles(rng: RNG, diff: number): Challenge {
  const base = rng.range(25, 29);
  const delta = 0.12 - 0.05 * diff + rng.range(0, 0.015);
  const bigIdx = rng.int(0, 1);
  const color = rng.pick(PALETTE);
  const centres: [number, number][] = [
    [88, 160 + rng.range(-14, 14)],
    [232, 160 + rng.range(-14, 14)],
  ];
  const shapes: Shape[] = [];
  const measure: number[] = [];
  centres.forEach(([cx, cy], i) => {
    const r = i === bigIdx ? base * (1 + delta) : base;
    measure.push(round1(r * 2));
    const bigNeighbours = i === bigIdx;
    const n = bigNeighbours ? 5 : 8;
    const nr = bigNeighbours ? 21 : 8;
    const dist = r + nr + (bigNeighbours ? 9 : 7);
    const phase = rng.range(0, 360);
    for (let k = 0; k < n; k++) {
      const a = rad(phase + (k * 360) / n);
      shapes.push({ t: 'circle', cx: round1(cx + dist * Math.cos(a)), cy: round1(cy + dist * Math.sin(a)), r: nr, fill: DIM });
    }
    shapes.push({ t: 'circle', cx, cy: round1(cy), r: round1(r), fill: color });
  });
  const targets = centres.map(([cx, cy]) => ({ x: cx - 72, y: cy - 88, w: 144, h: 176 }));
  return {
    template: 'circles',
    prompt: 'Which coloured circle is larger?',
    shapes,
    targets,
    answer: bigIdx,
    measure,
    minMargin: 0.06,
    explain: `The ${side(bigIdx, 2)} one is ${pct(measure[bigIdx], measure[1 - bigIdx])}% wider. Big neighbours make a circle look smaller than it is.`,
    reveal: centres.map(([cx, cy], i) => label(cx, cy + 5, `${Math.round((measure[i] / Math.min(...measure)) * 100)}%`)).map((s) => ({ ...s, fill: '#0D0D0F' } as Shape)),
  };
}

/** Four plain circles in different colours; one is slightly larger. */
function sizes(rng: RNG, diff: number): Challenge {
  const base = rng.range(40, 46);
  const delta = 0.11 - 0.045 * diff;
  const factors = rng.shuffle([1 + delta, 1, 1 - delta * 0.6, 1 - delta * 0.2]);
  const colors = rng.shuffle(PALETTE).slice(0, 4);
  const slots: [number, number][] = [
    [84, 84],
    [236, 84],
    [84, 236],
    [236, 236],
  ];
  const shapes: Shape[] = [];
  const measure: number[] = [];
  const centres = slots.map(([x, y]) => [x + rng.range(-12, 12), y + rng.range(-12, 12)] as [number, number]);
  centres.forEach(([cx, cy], i) => {
    const r = base * factors[i];
    measure.push(round1(r * 2));
    shapes.push({ t: 'circle', cx: round1(cx), cy: round1(cy), r: round1(r), fill: colors[i] });
  });
  const answer = measure.indexOf(Math.max(...measure));
  const sorted = [...measure].sort((a, b) => b - a);
  return {
    template: 'sizes',
    prompt: 'Which circle is the largest?',
    shapes,
    targets: slots.map(([x, y]) => ({ x: x - 72, y: y - 72, w: 144, h: 144 })),
    answer,
    measure,
    minMargin: 0.04,
    explain: `It is ${pct(sorted[0], sorted[1])}% wider than the next largest. Colour and position change how big things feel.`,
    reveal: centres.map(([cx, cy], i) => ({ ...label(cx, cy + 5, `${Math.round((measure[i] / sorted[0]) * 100)}%`), fill: '#0D0D0F' } as Shape)),
  };
}

/** Müller-Lyer illusion: outward arrowheads make the truly longer line look shorter. */
function lines(rng: RNG, diff: number): Challenge {
  const count = diff > 0.5 ? 3 : 2;
  const base = rng.range(128, 150);
  const delta = 0.11 - 0.045 * diff + rng.range(0, 0.01);
  const longIdx = rng.int(0, count - 1);
  const color = rng.pick(PALETTE);
  const gap = count === 2 ? 110 : 84;
  const top = 160 - (gap * (count - 1)) / 2;
  const shapes: Shape[] = [];
  const measure: number[] = [];
  const targets: Box[] = [];
  for (let i = 0; i < count; i++) {
    const len = i === longIdx ? base * (1 + delta) : base * (1 - (i % 2) * 0.015);
    const y = top + i * gap;
    const x1 = 160 - len / 2 + rng.range(-22, 22);
    const x2 = x1 + len;
    measure.push(round1(len));
    const fin = 20;
    // arrowheads (><) pointing inward on the long line shrink it visually; tails on the others stretch them
    const dir = i === longIdx ? 1 : -1;
    shapes.push({ t: 'line', x1: round1(x1), y1: y, x2: round1(x2), y2: y, stroke: color, sw: 4 });
    for (const [x, s] of [
      [x1, 1],
      [x2, -1],
    ] as const) {
      for (const v of [-1, 1]) {
        shapes.push({ t: 'line', x1: round1(x), y1: y, x2: round1(x + s * dir * fin * 0.8), y2: y + v * fin * 0.75, stroke: INK, sw: 3 });
      }
    }
    targets.push({ x: 20, y: y - gap / 2 + 4, w: 280, h: gap - 8 });
  }
  const sorted = [...measure].sort((a, b) => b - a);
  const where = count === 2 ? ['top', 'bottom'][longIdx] : ['top', 'middle', 'bottom'][longIdx];
  return {
    template: 'lines',
    prompt: 'Which coloured line is the longest?',
    shapes,
    targets,
    answer: longIdx,
    measure,
    minMargin: 0.045,
    explain: `The ${where} line is ${pct(sorted[0], sorted[1])}% longer. Arrowheads on the ends make a line look shorter than it is.`,
  };
}

interface Placed {
  x: number;
  y: number;
  r: number;
}

function scatter(rng: RNG, n: number, r: number, box: Box, minGap = 6): Placed[] {
  const out: Placed[] = [];
  let guard = 0;
  while (out.length < n && guard++ < 4000) {
    const p = { x: rng.range(box.x + r, box.x + box.w - r), y: rng.range(box.y + r, box.y + box.h - r), r };
    if (out.every((o) => Math.hypot(o.x - p.x, o.y - p.y) >= o.r + p.r + minGap)) out.push(p);
  }
  return out;
}

/** Count one kind of shape among distractors. */
function count(rng: RNG, diff: number): Challenge {
  const kinds = ['triangles', 'squares', 'circles'] as const;
  const target = rng.pick(kinds);
  const targetCount = rng.int(5, 7 + Math.round(diff * 3));
  const others = rng.int(8, 10 + Math.round(diff * 3));
  const total = targetCount + others;
  const spots = scatter(rng, total, 15, { x: 12, y: 12, w: 296, h: 296 }, 5);
  // scatter() can fall short on very unlucky seeds; the answer follows what was actually placed
  const order: (typeof kinds)[number][] = [];
  const rest = kinds.filter((k) => k !== target);
  for (let i = 0; i < spots.length; i++) order.push(i < targetCount ? target : rest[i % 2]);
  const assigned = rng.shuffle(order);
  const colors = rng.shuffle(PALETTE).slice(0, 3);
  const shapes: Shape[] = [];
  const reveal: Shape[] = [];
  let actual = 0;
  spots.forEach((p, i) => {
    const kind = assigned[i];
    const fill = colors[rng.int(0, 2)];
    if (kind === 'circles') shapes.push({ t: 'circle', cx: round1(p.x), cy: round1(p.y), r: 12, fill });
    else if (kind === 'squares') shapes.push({ t: 'poly', pts: regularPolygon(p.x, p.y, 15, 4, 45 + rng.range(-20, 20)), fill });
    else shapes.push({ t: 'poly', pts: regularPolygon(p.x, p.y, 15, 3, rng.range(0, 120)), fill });
    if (kind === target) {
      actual++;
      reveal.push({ t: 'circle', cx: round1(p.x), cy: round1(p.y), r: 19, stroke: INK, sw: 1.5 });
    }
  });
  const offsets = rng.pick([
    [-2, -1, 0, 1],
    [-1, 0, 1, 2],
    [0, 1, 2, 3],
    [-3, -2, -1, 0],
  ]);
  const options = offsets.map((o) => actual + o);
  return {
    template: 'count',
    prompt: `How many ${target} are there?`,
    shapes,
    choices: options.map(String),
    answer: options.indexOf(actual),
    measure: options.map((o) => -Math.abs(o - actual)),
    minMargin: 0,
    explain: `There are exactly ${actual} ${target}. Mixed colours make quick counting harder.`,
    reveal,
  };
}

/** Everything shimmers, but only one dot actually changes position. */
function drift(rng: RNG, diff: number): Challenge {
  const color = rng.pick(PALETTE);
  const cells: [number, number][] = [];
  for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) cells.push([64 + c * 96 + rng.range(-10, 10), 64 + r * 96 + rng.range(-10, 10)]);
  const answer = rng.int(0, 8);
  const amp = 7 - 3 * diff;
  const horizontal = rng.chance(0.5);
  const shapes: Shape[] = cells.map(([cx, cy], i) => ({
    t: 'group',
    anim: { kind: 'drift', dx: i === answer && horizontal ? amp : 0, dy: i === answer && !horizontal ? amp : 0, dur: 2.6, delay: -rng.range(0, 2.6) },
    children: [{ t: 'circle', cx: round1(cx), cy: round1(cy), r: 17, fill: color, anim: { kind: 'pulse', dur: rng.range(1.1, 1.9), delay: -rng.range(0, 2) } }],
  }));
  return {
    template: 'drift',
    prompt: 'Which dot is actually moving?',
    shapes,
    targets: cells.map(([cx, cy]) => ({ x: cx - 38, y: cy - 38, w: 76, h: 76 })),
    answer,
    measure: cells.map((_, i) => (i === answer ? amp : 0)),
    minMargin: 0.5,
    explain: `Only that dot slides ${horizontal ? 'side to side' : 'up and down'}. The others just flicker in place.`,
  };
}

/** Six spinners; one turns the other way. Speeds vary so speed is not a clue. */
function spin(rng: RNG, _diff: number): Challenge {
  const color = rng.pick(PALETTE);
  const cells: [number, number][] = [];
  for (let r = 0; r < 2; r++) for (let c = 0; c < 3; c++) cells.push([58 + c * 102, 100 + r * 120]);
  const answer = rng.int(0, 5);
  const majority: 1 | -1 = rng.chance(0.5) ? 1 : -1;
  const shapes: Shape[] = cells.map(([cx, cy], i) => {
    const dir = (i === answer ? -majority : majority) as 1 | -1;
    const R = 26;
    const children: Shape[] = [{ t: 'circle', cx, cy, r: R, stroke: FAINT, sw: 3 }];
    // a comet: a bright head with a fading tail of dots trailing behind it
    for (let k = 0; k < 5; k++) {
      const a = rad(-dir * k * 20);
      children.push({ t: 'circle', cx: round1(cx + R * Math.cos(a)), cy: round1(cy + R * Math.sin(a)), r: 7 - k * 1.2, fill: k === 0 ? INK : color });
    }
    return { t: 'group', children, anim: { kind: 'spin', dir, dur: rng.range(1.5, 2.3), delay: -rng.range(0, 2), cx, cy } };
  });
  return {
    template: 'spin',
    prompt: 'Which one spins the other way?',
    shapes,
    targets: cells.map(([cx, cy]) => ({ x: cx - 48, y: cy - 56, w: 96, h: 112 })),
    answer,
    measure: cells.map((_, i) => (i === answer ? 1 : 0)),
    minMargin: 0.5,
    explain: `It turns ${majority === 1 ? 'anticlockwise' : 'clockwise'} while the rest turn ${majority === 1 ? 'clockwise' : 'anticlockwise'}.`,
  };
}

export function symmetryAxes(grid: boolean[][]): { vertical: boolean; horizontal: boolean; diagonal: boolean; anti: boolean } {
  const n = grid.length;
  let vertical = true;
  let horizontal = true;
  let diagonal = true;
  let anti = true;
  for (let r = 0; r < n; r++)
    for (let c = 0; c < n; c++) {
      if (grid[r][c] !== grid[r][n - 1 - c]) vertical = false;
      if (grid[r][c] !== grid[n - 1 - r][c]) horizontal = false;
      if (grid[r][c] !== grid[c][r]) diagonal = false;
      if (grid[r][c] !== grid[n - 1 - c][n - 1 - r]) anti = false;
    }
  return { vertical, horizontal, diagonal, anti };
}

function symmetricGrid(rng: RNG, n: number): boolean[][] {
  for (;;) {
    const g: boolean[][] = Array.from({ length: n }, () => Array(n).fill(false));
    for (let r = 0; r < n; r++)
      for (let c = 0; c < Math.ceil(n / 2); c++) {
        const v = rng.chance(0.5);
        g[r][c] = v;
        g[r][n - 1 - c] = v;
      }
    const filled = g.flat().filter(Boolean).length;
    const ax = symmetryAxes(g);
    // avoid near-empty tiles and tiles with extra symmetries that would muddy the question
    if (filled >= n * n * 0.35 && filled <= n * n * 0.65 && !ax.horizontal && !ax.diagonal && !ax.anti) return g;
  }
}

/** Four tiles; exactly one is mirror-symmetric, the rest have no symmetry at all. */
function symmetry(rng: RNG, diff: number): Challenge {
  const n = diff > 0.5 ? 6 : 5;
  const answer = rng.int(0, 3);
  const color = rng.pick(PALETTE);
  const grids: boolean[][][] = [];
  for (let i = 0; i < 4; i++) {
    const g = symmetricGrid(rng, n);
    if (i !== answer) {
      // break the mirror by flipping one or two cells off the centre column
      for (;;) {
        const copy = g.map((row) => row.slice());
        const flips = diff > 0.5 ? 1 : 2;
        for (let f = 0; f < flips; f++) {
          const r = rng.int(0, n - 1);
          const c = rng.int(0, Math.floor(n / 2) - 1);
          copy[r][c] = !copy[r][c];
        }
        const ax = symmetryAxes(copy);
        if (!ax.vertical && !ax.horizontal && !ax.diagonal && !ax.anti) {
          grids.push(copy);
          break;
        }
      }
    } else grids.push(g);
  }
  const tile = 132;
  const origins: [number, number][] = [
    [16, 16],
    [172, 16],
    [16, 172],
    [172, 172],
  ];
  const shapes: Shape[] = [];
  const pad = 12;
  const cell = (tile - pad * 2) / n;
  origins.forEach(([ox, oy], i) => {
    shapes.push({ t: 'rect', x: ox, y: oy, w: tile, h: tile, rx: 16, fill: '#1B1B21', stroke: FAINT, sw: 1 });
    grids[i].forEach((row, r) =>
      row.forEach((on, c) => {
        if (on) shapes.push({ t: 'rect', x: round1(ox + pad + c * cell + 1.5), y: round1(oy + pad + r * cell + 1.5), w: round1(cell - 3), h: round1(cell - 3), rx: 3, fill: color });
      }),
    );
  });
  const [ax, ay] = origins[answer];
  return {
    template: 'symmetry',
    prompt: 'Which pattern is a perfect mirror image, left to right?',
    shapes,
    targets: origins.map(([x, y]) => ({ x, y, w: tile, h: tile })),
    answer,
    measure: grids.map((g) => (symmetryAxes(g).vertical ? 1 : 0)),
    minMargin: 0.5,
    explain: 'Only this pattern matches itself across the centre line. The others each have a cell or two out of place.',
    reveal: [{ t: 'line', x1: ax + tile / 2, y1: ay + 6, x2: ax + tile / 2, y2: ay + tile - 6, stroke: INK, sw: 1.5 }],
  };
}

/** Simultaneous contrast: the lightest patch sits on the lightest surround, so it looks darker. */
function shade(rng: RNG, diff: number): Challenge {
  const n = 3;
  const base = rng.int(44, 52);
  const delta = Math.round(9 - 3 * diff);
  const answer = rng.int(0, n - 1);
  const hue = rng.pick([255, 230, 200, 150]);
  const surrounds = rng.shuffle([14, 24]);
  const tones: number[] = [];
  const shapes: Shape[] = [];
  const targets: Box[] = [];
  const w = 92;
  for (let i = 0; i < n; i++) {
    const x = 12 + i * (w + 10);
    const tone = i === answer ? base + delta : base;
    tones.push(tone);
    const bg = i === answer ? 82 : surrounds[i % 2];
    shapes.push({ t: 'rect', x, y: 60, w, h: 200, rx: 14, fill: `hsl(${hue} 8% ${bg}%)` });
    shapes.push({ t: 'rect', x: x + 23, y: 137, w: 46, h: 46, rx: 6, fill: `hsl(${hue} 8% ${tone}%)` });
    targets.push({ x, y: 60, w, h: 200 });
  }
  return {
    template: 'shade',
    prompt: 'Which small square is the lightest?',
    shapes,
    targets,
    answer,
    measure: tones,
    minMargin: 0.1,
    explain: `It is ${delta} points lighter than the others. A bright surround makes a patch look darker than it is.`,
    reveal: [{ t: 'rect', x: 35, y: 147, w: 250, h: 26, fill: `hsl(${hue} 8% ${base}%)` }, { t: 'rect', x: 12 + answer * 102 + 23, y: 137, w: 46, h: 46, rx: 6, fill: `hsl(${hue} 8% ${base + delta}%)`, stroke: INK, sw: 1.5 }],
  };
}

const POLY_NAMES: Record<number, string> = { 5: 'pentagon', 6: 'hexagon', 7: 'heptagon', 8: 'octagon', 9: 'nonagon', 10: 'decagon', 11: 'hendecagon' };

/** Four polygons at random rotations; which has the most sides? */
function sides(rng: RNG, diff: number): Challenge {
  const max = rng.int(7, 8 + Math.round(diff * 3));
  const answer = rng.int(0, 3);
  const counts = [0, 1, 2, 3].map((i) => (i === answer ? max : rng.int(Math.max(5, max - 3), max - 1)));
  const colors = rng.shuffle(PALETTE).slice(0, 4);
  const slots: [number, number][] = [
    [84, 84],
    [236, 84],
    [84, 236],
    [236, 236],
  ];
  const shapes: Shape[] = slots.map(([cx, cy], i) => ({
    t: 'poly',
    pts: regularPolygon(cx, cy, rng.range(50, 58), counts[i], rng.range(0, 360)),
    stroke: colors[i],
    sw: 4,
    fill: 'none',
  }));
  return {
    template: 'sides',
    prompt: 'Which shape has the most sides?',
    shapes,
    targets: slots.map(([x, y]) => ({ x: x - 72, y: y - 72, w: 144, h: 144 })),
    answer,
    measure: counts,
    minMargin: 0.09,
    explain: `It is a ${POLY_NAMES[max]} with ${max} sides.`,
    reveal: slots.map(([cx, cy], i) => ({ t: 'text', x: cx, y: cy + 8, text: String(counts[i]), size: 24, fill: INK })),
  };
}

/** Zöllner-style hatching makes parallel lines look skewed; one line really is tilted. */
function parallel(rng: RNG, diff: number): Challenge {
  const n = 5;
  const baseAngle = rng.range(-10, 10);
  const tilt = (5.5 - 2 * diff) * (rng.chance(0.5) ? 1 : -1);
  const answer = rng.int(0, n - 1);
  const color = rng.pick(PALETTE);
  const shapes: Shape[] = [];
  const targets: Box[] = [];
  const angles: number[] = [];
  const gap = 56;
  for (let i = 0; i < n; i++) {
    const cy = 160 + (i - (n - 1) / 2) * gap;
    const angle = baseAngle + (i === answer ? tilt : 0);
    angles.push(angle);
    const dx = Math.cos(rad(angle));
    const dy = Math.sin(rad(angle));
    const half = 132;
    shapes.push({ t: 'line', x1: round1(160 - dx * half), y1: round1(cy - dy * half), x2: round1(160 + dx * half), y2: round1(cy + dy * half), stroke: color, sw: 3.5 });
    const hatch = rad(angle + (i % 2 === 0 ? 58 : -58));
    for (let k = -4; k <= 4; k++) {
      const px = 160 + dx * k * 28;
      const py = cy + dy * k * 28;
      shapes.push({ t: 'line', x1: round1(px - Math.cos(hatch) * 11), y1: round1(py - Math.sin(hatch) * 11), x2: round1(px + Math.cos(hatch) * 11), y2: round1(py + Math.sin(hatch) * 11), stroke: DIM, sw: 2 });
    }
    targets.push({ x: 8, y: cy - gap / 2 + 2, w: 304, h: gap - 4 });
  }
  return {
    template: 'parallel',
    prompt: 'Which line is not parallel to the others?',
    shapes,
    targets,
    answer,
    measure: angles.map((a) => Math.abs(a - baseAngle)),
    minMargin: 0.5,
    explain: `That line is tilted by ${Math.abs(tilt).toFixed(1)}°. The little cross-hatches make the truly parallel lines look skewed too.`,
  };
}

/** Numerosity: the side with fewer dots gets bigger dots, so it can look fuller. */
function dots(rng: RNG, diff: number): Challenge {
  const fewer = rng.int(13, 17);
  const more = fewer + (diff > 0.5 ? 3 : 4);
  const answer = rng.int(0, 1);
  const color = rng.pick(PALETTE);
  const panels: Box[] = [
    { x: 10, y: 50, w: 144, h: 220 },
    { x: 166, y: 50, w: 144, h: 220 },
  ];
  const shapes: Shape[] = [];
  const measure: number[] = [];
  panels.forEach((box, i) => {
    const n = i === answer ? more : fewer;
    const r = i === answer ? 6.5 : 9;
    shapes.push({ t: 'rect', x: box.x, y: box.y, w: box.w, h: box.h, rx: 18, fill: '#1B1B21', stroke: FAINT, sw: 1 });
    const placed = scatter(rng, n, r, { x: box.x + 10, y: box.y + 10, w: box.w - 20, h: box.h - 20 }, 4);
    measure.push(placed.length);
    placed.forEach((p) => shapes.push({ t: 'circle', cx: round1(p.x), cy: round1(p.y), r, fill: color }));
  });
  return {
    template: 'dots',
    prompt: 'Which side has more dots?',
    shapes,
    targets: panels,
    answer,
    measure,
    minMargin: 0.15,
    explain: `${measure[answer]} against ${measure[1 - answer]}. Bigger dots fill more space, so fewer of them can look like more.`,
    reveal: panels.map((box, i) => ({ t: 'text', x: box.x + box.w / 2, y: box.y - 12, text: String(measure[i]), size: 22, fill: INK })),
  };
}

const TEMPLATES: Record<TemplateId, (rng: RNG, diff: number) => Challenge> = { circles, sizes, lines, count, drift, spin, symmetry, shade, sides, parallel, dots };
export const TEMPLATE_IDS = Object.keys(TEMPLATES) as TemplateId[];

/** True when the answer is the single best option by the template's required margin. */
export function validateChallenge(c: Challenge): boolean {
  const options = c.targets?.length ?? c.choices?.length ?? 0;
  if (options < 2 || c.answer < 0 || c.answer >= options || c.measure.length !== options) return false;
  if (c.choices && new Set(c.choices).size !== c.choices.length) return false;
  if (c.choices && c.choices.some((x) => Number(x) < 0)) return false;
  const best = c.measure[c.answer];
  for (let i = 0; i < options; i++) {
    if (i === c.answer) continue;
    if (c.measure[i] >= best) return false;
    if (best > 0 && c.minMargin > 0 && (best - c.measure[i]) / best < c.minMargin - 1e-9) return false;
  }
  if (c.targets) {
    for (const t of c.targets) if (t.w < 44 || t.h < 44) return false;
  }
  return true;
}

export function makeChallenge(template: TemplateId, seed: string, diff: number): Challenge {
  for (let attempt = 0; attempt < 50; attempt++) {
    const c = TEMPLATES[template](rngFrom('pe', template, seed, attempt), diff);
    if (validateChallenge(c)) return c;
  }
  throw new Error(`Could not build a valid ${template} challenge for seed ${seed}`);
}

/** Six different templates per run, easing from gentle to subtle. Same seed → same set for everyone. */
export function buildPerceptionSet(seed: string): Challenge[] {
  // 'circles' and 'sizes' ask a similar question, so a set only ever contains one of them
  const shuffled = rngFrom('pe-order', seed).shuffle(TEMPLATE_IDS);
  const drop = shuffled.indexOf('circles') < shuffled.indexOf('sizes') ? 'sizes' : 'circles';
  const order = shuffled.filter((t) => t !== drop).slice(0, PE_ROUNDS);
  return order.map((template, i) => makeChallenge(template, `${seed}:${i}`, i / (PE_ROUNDS - 1)));
}
