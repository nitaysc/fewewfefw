import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { App as CapApp } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import { StatusBar, Style } from '@capacitor/status-bar';
import { BottomNav } from '../components/BottomNav';
import { ShareSheet } from '../components/ShareSheet';
import { LogoMark } from '../components/ui';
import { DailyScreen, DaySheet } from '../daily/DailyScreen';
import { GameHost } from '../games/GameHost';
import type { GameId, GameMode } from '../games/types';
import { GameSheet } from '../home/GameSheet';
import { HomeScreen } from '../home/HomeScreen';
import { LeaderboardScreen } from '../leaderboard/LeaderboardScreen';
import { ProfileScreen } from '../profile/ProfileScreen';
import { ChallengeSheet, Onboarding, SettingsSheet } from '../profile/sheets';
import { randomCode } from '../services/rng';
import { NavContext, type ActiveGame, type Nav, type SheetState, type Tab } from './nav';
import { useStore } from './store';

export function App() {
  const { ready, data, derived } = useStore();
  const [tab, setTab] = useState<Tab>('home');
  const [game, setGame] = useState<ActiveGame | null>(null);
  const [sheet, setSheet] = useState<SheetState>(null);
  // keep the last sheet mounted while it animates out
  const [lastSheet, setLastSheet] = useState<SheetState>(null);
  const [backSignal, setBackSignal] = useState(0);
  const counter = useRef(0);

  const openSheet = useCallback((s: SheetState) => {
    setSheet(s);
    if (s) setLastSheet(s);
  }, []);
  const closeSheet = useCallback(() => setSheet(null), []);

  const play = useCallback(
    (id: GameId, mode: GameMode, seed?: string) => {
      counter.current += 1;
      setSheet(null);
      setGame({ id, mode, seed: seed ?? (mode === 'daily' ? derived.today : randomCode()), key: counter.current });
    },
    [derived.today],
  );
  const closeGame = useCallback(() => setGame(null), []);
  const go = useCallback((t: Tab) => setTab(t), []);

  const nav = useMemo<Nav>(() => ({ tab, go, play, closeGame, sheet, openSheet, closeSheet }), [tab, go, play, closeGame, sheet, openSheet, closeSheet]);

  // native chrome + hardware back button
  const state = useRef({ tab, game, sheet });
  state.current = { tab, game, sheet };
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    void StatusBar.setStyle({ style: Style.Dark }).catch(() => {});
    void StatusBar.setBackgroundColor({ color: '#0d0d0f' }).catch(() => {});
    const handle = CapApp.addListener('backButton', () => {
      const s = state.current;
      if (s.sheet) setSheet(null);
      else if (s.game) setBackSignal((n) => n + 1);
      else if (s.tab !== 'home') setTab('home');
      else void CapApp.minimizeApp();
    });
    return () => {
      void handle.then((h) => h.remove());
    };
  }, []);

  if (!ready) {
    return (
      <div className="app splash">
        <LogoMark size={88} />
      </div>
    );
  }

  if (!data.onboarded) {
    return (
      <div className="app">
        <Onboarding />
      </div>
    );
  }

  const shown = sheet ?? lastSheet;
  return (
    <NavContext.Provider value={nav}>
      <div className="app">
        <div key={tab} className="tab-host" aria-hidden={game ? true : undefined}>
          {tab === 'home' && <HomeScreen />}
          {tab === 'daily' && <DailyScreen />}
          {tab === 'ranks' && <LeaderboardScreen />}
          {tab === 'profile' && <ProfileScreen />}
        </div>
        {!game && <BottomNav />}
        {game && <GameHost key={game.key} game={game} backSignal={backSignal} />}
        {shown?.type === 'game' && <GameSheet id={shown.id} open={sheet?.type === 'game'} />}
        {shown?.type === 'settings' && <SettingsSheet open={sheet?.type === 'settings'} />}
        {shown?.type === 'challenge' && <ChallengeSheet open={sheet?.type === 'challenge'} />}
        {shown?.type === 'share' && <ShareSheet payload={shown.payload} open={sheet?.type === 'share'} />}
        {shown?.type === 'day' && <DaySheet date={shown.date} open={sheet?.type === 'day'} />}
      </div>
    </NavContext.Provider>
  );
}
