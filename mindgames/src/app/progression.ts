import type { GameMode } from '../games/types';

export interface LevelInfo {
  level: number;
  /** XP earned inside the current level */
  into: number;
  /** XP needed to finish the current level */
  need: number;
}

/** Level 1→2 takes 200 XP; each level after needs 75 more than the last. */
export function levelInfo(xp: number): LevelInfo {
  let level = 1;
  let need = 200;
  let into = Math.max(0, Math.floor(xp));
  while (into >= need) {
    into -= need;
    level++;
    need = 200 + (level - 1) * 75;
  }
  return { level, into, need };
}

/** Daily games pay 1 XP per 10 points; practice pays half so the daily stays the main event. */
export function xpForScore(score: number, mode: GameMode): number {
  return Math.round(score / (mode === 'daily' ? 10 : 20));
}

const TITLES = ['Newcomer', 'Thinker', 'Observer', 'Solver', 'Analyst', 'Strategist', 'Savant', 'Mastermind', 'Oracle', 'Grandmaster'];
export function levelTitle(level: number): string {
  return TITLES[Math.min(TITLES.length - 1, Math.floor((level - 1) / 3))];
}
