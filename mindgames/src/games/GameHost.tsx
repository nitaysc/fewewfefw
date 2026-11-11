import { useCallback, useEffect, useRef, useState } from 'react';
import { useNav, type ActiveGame } from '../app/nav';
import { useStore, type Rewards } from '../app/store';
import { Icon } from '../components/Icon';
import { Button, IconButton, Sheet } from '../components/ui';
import { GameArt } from '../home/illustrations';
import { haptic } from '../services/haptics';
import { sfx } from '../services/sfx';
import { CloseEnoughGame } from './close-enough/CloseEnoughGame';
import { OddOneOutGame } from './odd-one-out/OddOneOutGame';
import { PerceptionGame } from './perception/PerceptionGame';
import type { PlayProps } from './play';
import { ResultScreen } from './ResultScreen';
import { GAMES, meanAccuracy, totalScore, type GameId, type GameResult, type RoundResult } from './types';

const VIEWS: Record<GameId, (props: PlayProps) => JSX.Element> = {
  'close-enough': CloseEnoughGame,
  perception: PerceptionGame,
  'odd-one-out': OddOneOutGame,
};
const TIMED: Record<GameId, boolean> = { 'close-enough': false, perception: true, 'odd-one-out': true };
const MISSED: RoundResult = { points: 0, max: 0, correct: false, accuracy: 0 };

type Phase = 'intro' | 'play' | 'result';

export function GameHost({ game, backSignal }: { game: ActiveGame; backSignal: number }) {
  const nav = useNav();
  const store = useStore();
  const meta = GAMES[game.id];
  const daily = game.mode === 'daily';
  const progressKey = `${game.seed}:${game.id}`;

  // captured once: what was already played when this run opened
  const [initial] = useState<RoundResult[]>(() => (daily ? (store.data.progress[progressKey] ?? []) : []));
  const [avoid] = useState(() => store.data.recentQuestions);
  const firstTime = !store.data.seenHowTo.includes(game.id);
  const [rounds, setRounds] = useState<RoundResult[]>(initial);
  const roundsRef = useRef(rounds);
  const [phase, setPhase] = useState<Phase>('intro');
  const [outcome, setOutcome] = useState<{ result: GameResult; rewards: Rewards } | null>(null);
  const [confirmQuit, setConfirmQuit] = useState(false);
  const finished = useRef(false);

  const finish = useCallback(() => {
    if (finished.current) return;
    finished.current = true;
    const played = roundsRef.current;
    const result: GameResult = { game: game.id, mode: game.mode, seed: game.seed, score: totalScore(played), accuracy: meanAccuracy(played), rounds: played, playedAt: Date.now() };
    const rewards = store.recordGame(result);
    setOutcome({ result, rewards });
    setPhase('result');
    sfx.finish();
    haptic.success();
  }, [game, store]);

  // resumed a daily game whose last round was already spent
  useEffect(() => {
    if (initial.length >= meta.rounds) finish();
  }, [initial, meta.rounds, finish]);

  // familiar games get a short "get ready" beat; first-timers read the rules and tap Start
  useEffect(() => {
    if (phase !== 'intro' || firstTime || initial.length >= meta.rounds) return;
    const id = window.setTimeout(() => setPhase('play'), 1250);
    return () => window.clearTimeout(id);
  }, [phase, firstTime, initial.length, meta.rounds]);

  const start = () => {
    if (firstTime) store.update((d) => (d.seenHowTo.includes(game.id) ? d : { ...d, seenHowTo: [...d.seenHowTo, game.id] }));
    setPhase('play');
  };

  const onRoundStart = useCallback(() => {
    // Timed daily rounds are spent the moment they appear, so leaving mid-round cannot buy a second look.
    if (daily && TIMED[game.id]) store.saveProgress(game.seed, game.id, [...roundsRef.current, MISSED]);
  }, [daily, game, store]);

  const onRound = useCallback(
    (r: RoundResult) => {
      const next = [...roundsRef.current, r];
      roundsRef.current = next;
      setRounds(next);
      if (daily) store.saveProgress(game.seed, game.id, next);
    },
    [daily, game, store],
  );

  const requestClose = useCallback(() => {
    if (phase === 'play') setConfirmQuit(true);
    else nav.closeGame();
  }, [phase, nav]);

  // Android back button
  const firstSignal = useRef(backSignal);
  useEffect(() => {
    if (backSignal === firstSignal.current) return;
    firstSignal.current = backSignal;
    if (confirmQuit) setConfirmQuit(false);
    else requestClose();
  }, [backSignal, confirmQuit, requestClose]);

  const View = VIEWS[game.id];
  const score = totalScore(rounds);
  const current = Math.min(rounds.length + 1, meta.rounds);

  return (
    <div className="game" data-game={game.id}>
      {phase !== 'result' && (
        <header className="game-head">
          <IconButton icon="close" label="Leave game" onClick={requestClose} />
          <div className="stack center grow">
            <span className="display d-sm game-title">{meta.title}</span>
            <span className="eyebrow">{daily ? 'Daily challenge' : `Practice · ${meta.code}-${game.seed}`}</span>
          </div>
          <div className="game-score" aria-label={`Score ${score}`}>
            <span className="display d-sm tnum">{score}</span>
          </div>
        </header>
      )}

      {phase !== 'result' && (
        <div className="pips" aria-label={`Round ${current} of ${meta.rounds}`}>
          {Array.from({ length: meta.rounds }, (_, i) => {
            const r = rounds[i];
            const state = !r ? (i === rounds.length && phase === 'play' ? 'now' : 'todo') : r.points <= 0 ? 'miss' : r.max > 0 && r.points / r.max >= 0.75 ? 'great' : 'ok';
            return <span key={i} className={`pip pip-${state}`} />;
          })}
        </div>
      )}

      {phase === 'intro' && (
        <div className="game-intro" onClick={firstTime ? undefined : start}>
          <div className="game-intro-art">
            <GameArt game={game.id} />
          </div>
          <span className="eyebrow" style={{ color: 'var(--accent)' }}>
            {daily ? 'Daily challenge' : 'Practice run'}
          </span>
          <h1 className="display d-xl">{meta.title}</h1>
          <p className="muted">{meta.tagline}</p>
          {firstTime ? (
            <>
              <ol className="howto">
                {meta.howTo.map((line, i) => (
                  <li key={i}>
                    <span className="display">{i + 1}</span>
                    <p className="small">{line}</p>
                  </li>
                ))}
              </ol>
              <Button block size="lg" variant="accent" iconRight="chevron" onClick={start}>
                Start
              </Button>
            </>
          ) : (
            <div className="get-ready">
              <span className="get-ready-bar" />
              <span className="eyebrow">{initial.length ? `Resuming at round ${Math.min(initial.length + 1, meta.rounds)}` : 'Get ready'}</span>
            </div>
          )}
        </div>
      )}

      {phase === 'play' && <View seed={game.seed} mode={game.mode} done={initial} onRoundStart={onRoundStart} onRound={onRound} onComplete={finish} avoid={avoid} />}

      {phase === 'result' && outcome && <ResultScreen result={outcome.result} rewards={outcome.rewards} />}

      <Sheet open={confirmQuit} onClose={() => setConfirmQuit(false)} title={daily ? 'Leave this challenge?' : 'End practice run?'}>
        <div className="stack gap-4">
          <p className="muted">
            {daily
              ? TIMED[game.id]
                ? 'Finished rounds are saved and you can come back later today. The round on screen now counts as missed.'
                : 'Finished questions are saved. You can pick up where you left off any time today.'
              : 'This run will not be saved.'}
          </p>
          <div className="row gap-3">
            <Button block variant="secondary" onClick={() => setConfirmQuit(false)}>
              Keep playing
            </Button>
            <Button block variant="danger" onClick={nav.closeGame}>
              Leave
            </Button>
          </div>
        </div>
      </Sheet>
    </div>
  );
}

export function RoundFeedback({ correct, points, title, children }: { correct: boolean; points: number; title: string; children?: React.ReactNode }) {
  return (
    <div className={`feedback ${correct ? 'ok' : 'bad'}`}>
      <span className="feedback-icon">
        <Icon name={correct ? 'check' : 'close'} size={18} />
      </span>
      <div className="stack grow">
        <b>{title}</b>
        {children && <p className="small muted">{children}</p>}
      </div>
      <span className="display d-md feedback-points">+{points}</span>
    </div>
  );
}
