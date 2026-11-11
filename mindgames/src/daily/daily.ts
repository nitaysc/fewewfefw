import { GAME_IDS, type GameId, type GameResult } from '../games/types';
import { addDays } from '../services/date';

export interface DailyEntry {
  results: Partial<Record<GameId, GameResult>>;
  /** completion bonus already granted */
  bonus?: boolean;
}

export type DailyLog = Record<string, DailyEntry>;

export const DAILY_BONUS_XP = 150;
export const MAX_DAILY_SCORE = 3000;

export function completedCount(entry?: DailyEntry): number {
  if (!entry) return 0;
  return GAME_IDS.filter((g) => entry.results[g]).length;
}

export function isComplete(entry?: DailyEntry): boolean {
  return completedCount(entry) === GAME_IDS.length;
}

export function dailyTotal(entry?: DailyEntry): number {
  if (!entry) return 0;
  return GAME_IDS.reduce((sum, g) => sum + (entry.results[g]?.score ?? 0), 0);
}

export function nextGame(entry?: DailyEntry): GameId | null {
  return GAME_IDS.find((g) => !entry?.results[g]) ?? null;
}

/**
 * A streak is a run of consecutive days with at least one daily game played.
 * It stays alive through today until midnight even if today has not been played yet.
 */
export function computeStreak(log: DailyLog, today: string): { current: number; playedToday: boolean } {
  const played = (key: string) => completedCount(log[key]) > 0;
  const playedToday = played(today);
  let cursor = playedToday ? today : addDays(today, -1);
  let current = 0;
  while (played(cursor)) {
    current++;
    cursor = addDays(cursor, -1);
  }
  return { current, playedToday };
}

export function longestStreak(log: DailyLog): number {
  const keys = Object.keys(log)
    .filter((k) => completedCount(log[k]) > 0)
    .sort();
  let best = 0;
  let run = 0;
  let prev = '';
  for (const key of keys) {
    run = prev && addDays(prev, 1) === key ? run + 1 : 1;
    best = Math.max(best, run);
    prev = key;
  }
  return best;
}
