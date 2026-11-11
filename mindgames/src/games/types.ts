export type GameId = 'close-enough' | 'perception' | 'odd-one-out';
export type GameMode = 'daily' | 'practice';

export const GAME_IDS: GameId[] = ['close-enough', 'perception', 'odd-one-out'];
export const MAX_GAME_SCORE = 1000;

export interface RoundResult {
  points: number;
  max: number;
  correct: boolean;
  /** 0..1 — how accurate the answer was */
  accuracy: number;
  timeMs?: number;
}

export interface GameResult {
  game: GameId;
  mode: GameMode;
  /** date key for daily runs, challenge code for practice runs */
  seed: string;
  score: number;
  /** 0..1 */
  accuracy: number;
  rounds: RoundResult[];
  playedAt: number;
}

export interface GameMeta {
  id: GameId;
  code: 'CE' | 'PE' | 'OO';
  title: string;
  tagline: string;
  blurb: string;
  playtime: string;
  rounds: number;
  howTo: string[];
}

export const GAMES: Record<GameId, GameMeta> = {
  'close-enough': {
    id: 'close-enough',
    code: 'CE',
    title: 'Close Enough',
    tagline: 'How close can you get?',
    blurb: 'Five questions. No multiple choice. Just your best number.',
    playtime: '2 min',
    rounds: 5,
    howTo: [
      'Read the question and type your best estimate.',
      'The closer you land, the more points you earn — up to 200 per question.',
      'Being off by double or half scores nothing, so think in the right ballpark.',
    ],
  },
  perception: {
    id: 'perception',
    code: 'PE',
    title: 'Perception',
    tagline: "Trust your eyes. Or don't.",
    blurb: 'Six visual challenges built to fool you. Measure with your eyes.',
    playtime: '1 min',
    rounds: 6,
    howTo: [
      'Each round shows a figure and asks one question about it.',
      'Tap your answer directly on the figure, or pick from the options.',
      'Correct answers score more the faster you are. You get 15 seconds.',
    ],
  },
  'odd-one-out': {
    id: 'odd-one-out',
    code: 'OO',
    title: 'Odd One Out',
    tagline: "Find what doesn't belong.",
    blurb: 'Eight grids, one impostor in each. They get subtle fast.',
    playtime: '1 min',
    rounds: 8,
    howTo: [
      'Every grid hides exactly one symbol that differs from the rest.',
      'Tap it before the timer runs out. One tap only — choose carefully.',
      'Grids grow and differences shrink as you go.',
    ],
  },
};

export function gameFromCode(code: string): GameId | null {
  const g = GAME_IDS.find((id) => GAMES[id].code === code.toUpperCase());
  return g ?? null;
}

/** Sum of round points, clamped to the game maximum. */
export function totalScore(rounds: RoundResult[]): number {
  return Math.min(MAX_GAME_SCORE, Math.round(rounds.reduce((s, r) => s + r.points, 0)));
}

export function meanAccuracy(rounds: RoundResult[]): number {
  if (!rounds.length) return 0;
  return rounds.reduce((s, r) => s + r.accuracy, 0) / rounds.length;
}

/** Points for a timed round: 40% for being right, 60% scaled by remaining time (after a short grace). */
export function timedPoints(max: number, elapsedMs: number, limitMs: number, graceMs = 1200): number {
  const span = Math.max(1, limitMs - graceMs);
  const frac = 1 - Math.min(1, Math.max(0, (elapsedMs - graceMs) / span));
  return Math.round(max * (0.4 + 0.6 * frac));
}

export function ratingFor(score: number): string {
  if (score >= 950) return 'Flawless';
  if (score >= 850) return 'Razor sharp';
  if (score >= 700) return 'Sharp';
  if (score >= 500) return 'Solid';
  if (score >= 300) return 'Warming up';
  return 'Tough one';
}
