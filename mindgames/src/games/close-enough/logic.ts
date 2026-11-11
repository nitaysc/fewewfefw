import { RNG, rngFrom } from '../../services/rng';
import { daysBetween, LAUNCH_DAY } from '../../services/date';
import { QUESTIONS, type Question } from './questions';

export const CE_ROUNDS = 5;
export const CE_MAX_POINTS = 200;
export const MAX_DIGITS = 12;

export interface GuessScore {
  points: number;
  /** 0..1, linear closeness shown to the player */
  accuracy: number;
  diff: number;
  /** signed relative error, e.g. -0.04 = 4% under */
  relError: number;
  perfect: boolean;
  exact: boolean;
}

/**
 * Scoring works on the *ratio* between guess and answer, so being 2× too high is punished
 * exactly like being 2× too low, and the scale works the same for 12 as for 12 million.
 *
 *  - inside the question's tolerance  → full marks
 *  - off by a factor of 2 (or more)   → zero
 *  - in between                        → a smooth curve that strongly rewards precision
 *
 * Zero, negative and non-finite guesses score nothing.
 */
export function scoreGuess(guess: number, question: Pick<Question, 'answer' | 'tol'>): GuessScore {
  const answer = question.answer;
  if (!Number.isFinite(guess) || guess <= 0) {
    return { points: 0, accuracy: 0, diff: Number.isFinite(guess) ? guess - answer : -answer, relError: -1, perfect: false, exact: false };
  }
  const diff = guess - answer;
  const relError = diff / answer;
  const accuracy = Math.max(0, 1 - Math.abs(relError));
  const exact = guess === answer;
  const tolLog = Math.log(1 + (question.tol ?? 0.005));
  const err = Math.abs(Math.log(guess / answer));
  if (exact || err <= tolLog) {
    return { points: CE_MAX_POINTS, accuracy: exact ? 1 : accuracy, diff, relError, perfect: true, exact };
  }
  const t = (err - tolLog) / (Math.LN2 - tolLog);
  const points = t >= 1 ? 0 : Math.round(CE_MAX_POINTS * Math.pow(1 - t, 1.6));
  return { points, accuracy, diff, relError, perfect: false, exact };
}

/** Pick `count` questions, preferring distinct categories. */
function pickVaried(pool: Question[], count: number): Question[] {
  const out: Question[] = [];
  const used = new Set<string>();
  for (const item of pool) {
    if (out.length >= count) break;
    if (!used.has(item.category)) {
      out.push(item);
      used.add(item.category);
    }
  }
  for (const item of pool) {
    if (out.length >= count) break;
    if (!out.includes(item)) out.push(item);
  }
  return out;
}

/**
 * Daily questions walk through a shuffled copy of the whole bank, so nothing repeats
 * until every question has been used. Everyone gets the same five on the same date.
 */
export function dailyQuestions(dateKey: string): Question[] {
  const day = Math.max(0, daysBetween(LAUNCH_DAY, dateKey));
  const perCycle = Math.floor(QUESTIONS.length / CE_ROUNDS);
  const cycle = Math.floor(day / perCycle);
  const slot = day % perCycle;
  const order = rngFrom('ce-cycle', cycle).shuffle(QUESTIONS);
  // deal the shuffled bank into `perCycle` hands with varied categories
  const hands: Question[][] = Array.from({ length: perCycle }, () => []);
  const byCat = new Map<string, Question[]>();
  for (const item of order) {
    const list = byCat.get(item.category) ?? [];
    list.push(item);
    byCat.set(item.category, list);
  }
  const sorted = [...byCat.values()].sort((a, b) => b.length - a.length).flat();
  sorted.forEach((item, i) => {
    const hand = hands[i % perCycle];
    if (hand.length < CE_ROUNDS) hand.push(item);
  });
  return rngFrom('ce-hand', dateKey).shuffle(hands[slot]);
}

export function practiceQuestions(code: string, avoid: string[] = []): Question[] {
  const rng: RNG = rngFrom('ce-practice', code);
  const shuffled = rng.shuffle(QUESTIONS);
  const fresh = shuffled.filter((item) => !avoid.includes(item.id));
  const pool = fresh.length >= CE_ROUNDS ? fresh : shuffled;
  return pickVaried(pool, CE_ROUNDS);
}

const nf = new Intl.NumberFormat('en-US');
export const formatNumber = (n: number): string => nf.format(n);

/** Friendly magnitude hint under the input, e.g. 384400 → "384 thousand". */
export function magnitudeHint(n: number): string {
  if (!Number.isFinite(n) || n < 1000) return '';
  const units: [number, string][] = [
    [1e12, 'trillion'],
    [1e9, 'billion'],
    [1e6, 'million'],
    [1e3, 'thousand'],
  ];
  for (const [size, name] of units) {
    if (n >= size) {
      const v = n / size;
      const text = v >= 100 ? Math.floor(v).toString() : (Math.floor(v * 10) / 10).toString();
      return `${text} ${name}`;
    }
  }
  return '';
}
