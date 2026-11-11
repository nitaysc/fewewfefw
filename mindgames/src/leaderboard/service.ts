import { rngFrom } from '../services/rng';
import { addDays, daysBetween, weekStart } from '../services/date';
import { dailyTotal, type DailyLog } from '../daily/daily';

/**
 * Leaderboards.
 *
 * `LeaderboardProvider` is the seam for a real backend: swap `SampleLeague` for a provider
 * that calls a server and every screen keeps working. Until then the league is made of
 * clearly-labelled sample players whose scores are simulated on the device — they are
 * not real people, and the UI says so.
 */

export type Period = 'daily' | 'weekly' | 'all';

export interface LeaderboardEntry {
  id: string;
  name: string;
  avatar: number;
  /** points for the selected period */
  score: number;
  /** today's daily score */
  today: number;
  isYou: boolean;
  isFriend: boolean;
  sample: boolean;
  rank: number;
}

export interface PlayerSnapshot {
  name: string;
  avatar: number;
  joined: string;
  log: DailyLog;
  friends: string[];
}

export interface LeaderboardProvider {
  readonly isSample: boolean;
  standings(period: Period, today: string, you: PlayerSnapshot): LeaderboardEntry[];
}

export interface SamplePlayer {
  id: string;
  name: string;
  avatar: number;
  /** 0..1 average share of the maximum score */
  skill: number;
  /** chance of playing on any given day */
  habit: number;
}

const NAMES = ['Mika', 'Jonas', 'Aria', 'Teo', 'Lena', 'Kai', 'Noor', 'Felix', 'Ines', 'Rui', 'Sana', 'Otto', 'Vera', 'Milo', 'Zoe', 'Emil', 'Nia', 'Luca', 'Yuki', 'Omar', 'Elsa', 'Ravi', 'Cleo', 'Hugo'];

export const SAMPLE_PLAYERS: SamplePlayer[] = NAMES.map((name, i) => {
  const rng = rngFrom('sample-player', name);
  return { id: `s${i}`, name, avatar: i % 8, skill: 0.42 + rng.next() * 0.46, habit: 0.6 + rng.next() * 0.38 };
});

export function sampleDailyScore(player: SamplePlayer, dateKey: string): number {
  const rng = rngFrom('sample-day', player.id, dateKey);
  if (!rng.chance(player.habit)) return 0;
  let total = 0;
  for (let g = 0; g < 3; g++) {
    const share = Math.min(0.99, Math.max(0.12, player.skill + rng.gauss() * 0.11));
    total += Math.round((share * 1000) / 5) * 5;
  }
  return total;
}

function sumRange(from: string, to: string, score: (key: string) => number): number {
  let total = 0;
  const span = Math.min(daysBetween(from, to), 400);
  for (let i = 0; i <= span; i++) total += score(addDays(to, -i));
  return total;
}

export class SampleLeague implements LeaderboardProvider {
  readonly isSample = true;

  standings(period: Period, today: string, you: PlayerSnapshot): LeaderboardEntry[] {
    const from = period === 'daily' ? today : period === 'weekly' ? weekStart(today) : you.joined;
    const start = daysBetween(from, today) < 0 ? today : from;
    const rows: Omit<LeaderboardEntry, 'rank'>[] = SAMPLE_PLAYERS.map((p) => ({
      id: p.id,
      name: p.name,
      avatar: p.avatar,
      score: sumRange(start, today, (key) => sampleDailyScore(p, key)),
      today: sampleDailyScore(p, today),
      isYou: false,
      isFriend: you.friends.includes(p.id),
      sample: true,
    }));
    rows.push({
      id: 'you',
      name: you.name,
      avatar: you.avatar,
      score: sumRange(start, today, (key) => dailyTotal(you.log[key])),
      today: dailyTotal(you.log[today]),
      isYou: true,
      isFriend: true,
      sample: false,
    });
    rows.sort((a, b) => b.score - a.score || (a.isYou ? -1 : b.isYou ? 1 : a.name.localeCompare(b.name)));
    return rows.map((r, i) => ({ ...r, rank: i + 1 }));
  }
}

export const leaderboard: LeaderboardProvider = new SampleLeague();
