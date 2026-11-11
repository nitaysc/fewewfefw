import { useCallback, useEffect, useRef } from 'react';
import type { GameMode, RoundResult } from './types';

/** Contract between the game host (chrome, saving, results) and each game's play view. */
export interface PlayProps {
  seed: string;
  mode: GameMode;
  /** rounds finished before this view mounted (resuming a daily game) */
  done: RoundResult[];
  /** a new round is now on screen */
  onRoundStart(): void;
  /** the player answered (or ran out of time) */
  onRound(result: RoundResult): void;
  /** the player moved past the final round */
  onComplete(): void;
  /** question ids to avoid in practice */
  avoid: string[];
}

/**
 * Round timer. Calls `onExpire` once when time runs out; `elapsed()` reads the time used so far.
 * The clock is wall-time based, so backgrounding the app does not pause it.
 */
export function useRoundTimer(roundKey: number, limitMs: number, active: boolean, onExpire: () => void) {
  const start = useRef(performance.now());
  const expire = useRef(onExpire);
  expire.current = onExpire;

  useEffect(() => {
    start.current = performance.now();
  }, [roundKey]);

  useEffect(() => {
    if (!active) return;
    const remaining = limitMs - (performance.now() - start.current);
    const id = window.setTimeout(() => expire.current(), Math.max(0, remaining));
    return () => window.clearTimeout(id);
  }, [roundKey, limitMs, active]);

  return useCallback(() => Math.min(limitMs, performance.now() - start.current), [limitMs]);
}
