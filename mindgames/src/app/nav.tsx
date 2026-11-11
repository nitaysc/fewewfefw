import { createContext, useContext } from 'react';
import type { GameId, GameMode } from '../games/types';
import type { SharePayload } from '../services/share';

export type Tab = 'home' | 'daily' | 'ranks' | 'profile';

export interface ActiveGame {
  id: GameId;
  mode: GameMode;
  /** date key (daily) or challenge code (practice) */
  seed: string;
  /** bumps so replaying remounts the game */
  key: number;
}

export type SheetState =
  | { type: 'game'; id: GameId }
  | { type: 'settings' }
  | { type: 'challenge' }
  | { type: 'share'; payload: SharePayload }
  | { type: 'day'; date: string }
  | null;

export interface Nav {
  tab: Tab;
  go(tab: Tab): void;
  /** start a game; seed defaults to today (daily) or a fresh code (practice) */
  play(id: GameId, mode: GameMode, seed?: string): void;
  closeGame(): void;
  sheet: SheetState;
  openSheet(sheet: SheetState): void;
  closeSheet(): void;
}

export const NavContext = createContext<Nav | null>(null);

export function useNav(): Nav {
  const nav = useContext(NavContext);
  if (!nav) throw new Error('useNav must be used inside <NavContext.Provider>');
  return nav;
}
