import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { GAME_IDS, type GameId, type GameResult, type RoundResult } from '../games/types';
import { computeStreak, DAILY_BONUS_XP, dailyTotal, isComplete, longestStreak, type DailyLog } from '../daily/daily';
import { dateKey } from '../services/date';
import { readJSON, removeKey, writeJSON } from '../services/storage';
import { setHapticsEnabled } from '../services/haptics';
import { setSoundEnabled } from '../services/sfx';
import { levelInfo, xpForScore } from './progression';

const STORAGE_KEY = 'mindgames.save.v1';

export interface GameStats {
  plays: number;
  total: number;
  best: number;
  accuracySum: number;
  roundsCorrect: number;
  roundsPlayed: number;
}

export interface HistoryItem {
  g: GameId;
  m: 'd' | 'p';
  s: number;
  a: number;
  t: number;
}

export interface Settings {
  haptics: boolean;
  sound: boolean;
  reduceMotion: boolean;
}

export interface SaveData {
  v: 1;
  onboarded: boolean;
  profile: { name: string; avatar: number; joined: string };
  settings: Settings;
  xp: number;
  bestStreak: number;
  daily: DailyLog;
  /** rounds already played in an unfinished daily game, keyed `${date}:${game}` */
  progress: Record<string, RoundResult[]>;
  stats: Record<GameId, GameStats>;
  history: HistoryItem[];
  recentQuestions: string[];
  friends: string[];
  seenHowTo: GameId[];
}

const emptyStats = (): GameStats => ({ plays: 0, total: 0, best: 0, accuracySum: 0, roundsCorrect: 0, roundsPlayed: 0 });

export function defaultSave(): SaveData {
  return {
    v: 1,
    onboarded: false,
    profile: { name: 'Player', avatar: 0, joined: dateKey() },
    settings: { haptics: true, sound: true, reduceMotion: false },
    xp: 0,
    bestStreak: 0,
    daily: {},
    progress: {},
    stats: { 'close-enough': emptyStats(), perception: emptyStats(), 'odd-one-out': emptyStats() },
    history: [],
    recentQuestions: [],
    friends: [],
    seenHowTo: [],
  };
}

/** Merge a loaded save over defaults so older saves gain new fields safely. */
export function hydrate(raw: Partial<SaveData> | null): SaveData {
  const base = defaultSave();
  if (!raw || typeof raw !== 'object' || raw.v !== 1) return base;
  return {
    ...base,
    ...raw,
    profile: { ...base.profile, ...raw.profile },
    settings: { ...base.settings, ...raw.settings },
    stats: {
      'close-enough': { ...emptyStats(), ...raw.stats?.['close-enough'] },
      perception: { ...emptyStats(), ...raw.stats?.perception },
      'odd-one-out': { ...emptyStats(), ...raw.stats?.['odd-one-out'] },
    },
  };
}

export interface Rewards {
  xp: number;
  bonusXp: number;
  levelBefore: number;
  levelAfter: number;
  isBest: boolean;
  previousBest: number;
  streakBefore: number;
  streakAfter: number;
  dailyJustCompleted: boolean;
  dailyTotal: number;
}

/** Pure reducer for finishing a game — exported for tests. */
export function applyResult(data: SaveData, result: GameResult, today: string): { next: SaveData; rewards: Rewards } {
  const streakBefore = computeStreak(data.daily, today).current;
  const stats = data.stats[result.game];
  const previousBest = stats.best;
  const nextStats: GameStats = {
    plays: stats.plays + 1,
    total: stats.total + result.score,
    best: Math.max(stats.best, result.score),
    accuracySum: stats.accuracySum + result.accuracy,
    roundsCorrect: stats.roundsCorrect + result.rounds.filter((r) => r.correct).length,
    roundsPlayed: stats.roundsPlayed + result.rounds.length,
  };

  let daily = data.daily;
  let bonusXp = 0;
  let dailyJustCompleted = false;
  const progress = { ...data.progress };
  if (result.mode === 'daily') {
    const entry = daily[result.seed] ?? { results: {} };
    // a daily game counts once; replays never overwrite the first score
    if (!entry.results[result.game]) {
      const updated = { ...entry, results: { ...entry.results, [result.game]: result } };
      if (isComplete(updated) && !updated.bonus) {
        updated.bonus = true;
        bonusXp = DAILY_BONUS_XP;
        dailyJustCompleted = true;
      }
      daily = { ...daily, [result.seed]: updated };
    }
    delete progress[`${result.seed}:${result.game}`];
  }

  const xp = xpForScore(result.score, result.mode);
  const levelBefore = levelInfo(data.xp).level;
  const totalXp = data.xp + xp + bonusXp;
  const streakAfter = computeStreak(daily, today).current;

  const next: SaveData = {
    ...data,
    xp: totalXp,
    daily,
    progress,
    bestStreak: Math.max(data.bestStreak, streakAfter, longestStreak(daily)),
    stats: { ...data.stats, [result.game]: nextStats },
    history: [...data.history, { g: result.game, m: result.mode === 'daily' ? ('d' as const) : ('p' as const), s: result.score, a: result.accuracy, t: result.playedAt }].slice(-300),
  };

  return {
    next,
    rewards: {
      xp,
      bonusXp,
      levelBefore,
      levelAfter: levelInfo(totalXp).level,
      isBest: result.score > previousBest && result.score > 0,
      previousBest,
      streakBefore,
      streakAfter,
      dailyJustCompleted,
      dailyTotal: dailyTotal(daily[result.seed]),
    },
  };
}

export interface Derived {
  today: string;
  streak: number;
  playedToday: boolean;
  gamesPlayed: number;
  totalScore: number;
  /** 0..1 */
  averageAccuracy: number;
}

interface Store {
  ready: boolean;
  data: SaveData;
  derived: Derived;
  recordGame(result: GameResult): Rewards;
  saveProgress(date: string, game: GameId, rounds: RoundResult[]): void;
  update(patch: (d: SaveData) => SaveData): void;
  reset(): Promise<void>;
}

const Ctx = createContext<Store | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<SaveData>(defaultSave);
  const [ready, setReady] = useState(false);
  const [today, setToday] = useState(dateKey);
  const ref = useRef(data);

  const commit = useCallback((next: SaveData) => {
    ref.current = next;
    setData(next);
    void writeJSON(STORAGE_KEY, next);
  }, []);

  useEffect(() => {
    let alive = true;
    void readJSON<Partial<SaveData>>(STORAGE_KEY).then((raw) => {
      if (!alive) return;
      const loaded = hydrate(raw);
      ref.current = loaded;
      setData(loaded);
      setReady(true);
    });
    return () => {
      alive = false;
    };
  }, []);

  // roll over to the new day while the app stays open
  useEffect(() => {
    const tick = () => setToday((prev) => (prev === dateKey() ? prev : dateKey()));
    const id = window.setInterval(tick, 20000);
    document.addEventListener('visibilitychange', tick);
    return () => {
      window.clearInterval(id);
      document.removeEventListener('visibilitychange', tick);
    };
  }, []);

  useEffect(() => {
    setHapticsEnabled(data.settings.haptics);
    setSoundEnabled(data.settings.sound);
    document.documentElement.classList.toggle('reduce-motion', data.settings.reduceMotion);
  }, [data.settings]);

  const recordGame = useCallback(
    (result: GameResult) => {
      const { next, rewards } = applyResult(ref.current, result, dateKey());
      commit(next);
      return rewards;
    },
    [commit],
  );

  const saveProgress = useCallback(
    (date: string, game: GameId, rounds: RoundResult[]) => {
      commit({ ...ref.current, progress: { ...ref.current.progress, [`${date}:${game}`]: rounds } });
    },
    [commit],
  );

  const update = useCallback((patch: (d: SaveData) => SaveData) => commit(patch(ref.current)), [commit]);

  const reset = useCallback(async () => {
    await removeKey(STORAGE_KEY);
    commit({ ...defaultSave(), onboarded: true, profile: { ...ref.current.profile, joined: dateKey() }, settings: ref.current.settings });
  }, [commit]);

  const derived = useMemo<Derived>(() => {
    const { current, playedToday } = computeStreak(data.daily, today);
    const all = GAME_IDS.map((g) => data.stats[g]);
    const plays = all.reduce((s, x) => s + x.plays, 0);
    return {
      today,
      streak: current,
      playedToday,
      gamesPlayed: plays,
      totalScore: all.reduce((s, x) => s + x.total, 0),
      averageAccuracy: plays ? all.reduce((s, x) => s + x.accuracySum, 0) / plays : 0,
    };
  }, [data, today]);

  const value = useMemo<Store>(() => ({ ready, data, derived, recordGame, saveProgress, update, reset }), [ready, data, derived, recordGame, saveProgress, update, reset]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useStore(): Store {
  const store = useContext(Ctx);
  if (!store) throw new Error('useStore must be used inside <StoreProvider>');
  return store;
}
