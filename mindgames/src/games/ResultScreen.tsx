import type { CSSProperties } from 'react';
import { useNav } from '../app/nav';
import { levelInfo, levelTitle } from '../app/progression';
import { useStore, type Rewards } from '../app/store';
import { Confetti } from '../components/Confetti';
import { Icon } from '../components/Icon';
import { Button, CountUp, Pill, ProgressBar } from '../components/ui';
import { completedCount, nextGame } from '../daily/daily';
import { dailyNumber } from '../services/date';
import { randomCode } from '../services/rng';
import { GAMES, ratingFor, type GameResult } from './types';

const nf = new Intl.NumberFormat('en-US');

export function ResultScreen({ result, rewards }: { result: GameResult; rewards: Rewards }) {
  const nav = useNav();
  const { data } = useStore();
  const meta = GAMES[result.game];
  const daily = result.mode === 'daily';
  const entry = daily ? data.daily[result.seed] : undefined;
  const next = daily ? nextGame(entry) : null;
  const leveledUp = rewards.levelAfter > rewards.levelBefore;
  const level = levelInfo(data.xp);
  const celebrate = rewards.dailyJustCompleted || leveledUp || result.score >= 900;
  const arc = 2 * Math.PI * 88 * 0.75;

  return (
    <div className="result">
      {celebrate && <Confetti pieces={rewards.dailyJustCompleted ? 140 : 80} />}
      <span className="eyebrow rise" style={{ color: 'var(--accent)' }}>
        {daily ? `Daily #${dailyNumber(result.seed)}` : 'Practice'} · {meta.title}
      </span>
      <h1 className="display d-lg rise" style={{ '--i': 1 } as CSSProperties}>
        {ratingFor(result.score)}
      </h1>

      <div className="gauge rise" style={{ '--i': 2 } as CSSProperties}>
        <svg viewBox="0 0 200 200" aria-hidden="true">
          <circle cx="100" cy="100" r="88" fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth="10" strokeLinecap="round" strokeDasharray={`${arc} 999`} transform="rotate(135 100 100)" />
          <circle cx="100" cy="100" r="88" fill="none" stroke="var(--accent)" strokeWidth="10" strokeLinecap="round" strokeDasharray={`${arc} 999`} transform="rotate(135 100 100)" className="gauge-fill" style={{ '--len': arc, '--to': arc * (1 - result.score / 1000) } as CSSProperties} />
        </svg>
        <div className="gauge-center">
          <span className="display d-xl">
            <CountUp value={result.score} duration={1100} delay={250} />
          </span>
          <span className="eyebrow">of 1,000</span>
        </div>
      </div>

      <div className="round-bars rise" style={{ '--i': 3 } as CSSProperties} aria-label="Round by round">
        {result.rounds.map((r, i) => {
          const share = r.max > 0 ? r.points / r.max : 0;
          return (
            <div key={i} className="round-bar">
              <div className="round-bar-track">
                <div className={`round-bar-fill ${share <= 0 ? 'miss' : ''}`} style={{ height: `${Math.max(8, share * 100)}%`, animationDelay: `${500 + i * 70}ms` }} />
              </div>
              <span className="tnum">{r.points}</span>
            </div>
          );
        })}
      </div>

      <div className="row gap-2 reward-pills rise" style={{ '--i': 4 } as CSSProperties}>
        <Pill tone="lime" icon="bolt">
          +{rewards.xp} XP
        </Pill>
        {rewards.bonusXp > 0 && (
          <Pill tone="lime" icon="star">
            +{rewards.bonusXp} daily bonus
          </Pill>
        )}
        {rewards.isBest && <Pill tone="accent" icon="trophy">New best</Pill>}
        {rewards.streakAfter > rewards.streakBefore && (
          <Pill icon="flame">
            {rewards.streakAfter}-day streak
          </Pill>
        )}
        <Pill>{Math.round(result.accuracy * 100)}% accuracy</Pill>
      </div>

      <div className={`card card-tight level-card rise ${leveledUp ? 'level-up' : ''}`} style={{ '--i': 5 } as CSSProperties}>
        <div className="row between">
          <span className="row gap-2">
            <span className="level-badge display">{level.level}</span>
            <span className="stack">
              <b>{leveledUp ? `Level up — ${levelTitle(level.level)}` : `Level ${level.level} · ${levelTitle(level.level)}`}</b>
              <span className="small muted tnum">
                {level.into} / {level.need} XP
              </span>
            </span>
          </span>
          {leveledUp && <Icon name="star" filled size={22} style={{ color: 'var(--lime)' }} />}
        </div>
        <ProgressBar value={level.into / level.need} />
      </div>

      <div className="stack gap-3 result-actions rise" style={{ '--i': 6 } as CSSProperties}>
        {daily && next && (
          <Button block size="lg" iconRight="chevron" onClick={() => nav.play(next, 'daily')}>
            Next · {GAMES[next].title}
          </Button>
        )}
        {daily && !next && (
          <>
            <div className="card card-tight row between daily-done">
              <span className="stack">
                <span className="eyebrow" style={{ color: 'var(--lime)' }}>
                  Daily complete
                </span>
                <b>Today's total</b>
              </span>
              <span className="display d-lg">{nf.format(rewards.dailyTotal)}</span>
            </div>
            <Button block size="lg" icon="share" onClick={() => nav.openSheet({ type: 'share', payload: { kind: 'daily', date: result.seed } })}>
              Share today's result
            </Button>
          </>
        )}
        {!daily && (
          <Button block size="lg" icon="refresh" onClick={() => nav.play(result.game, 'practice', randomCode())}>
            Play again
          </Button>
        )}
        <div className="row gap-3">
          {daily ? (
            next ? (
              <Button block variant="secondary" icon="share" onClick={() => nav.openSheet({ type: 'share', payload: { kind: 'game', game: result.game, score: result.score } })}>
                Share
              </Button>
            ) : (
              <Button
                block
                variant="secondary"
                icon="trophy"
                onClick={() => {
                  nav.go('ranks');
                  nav.closeGame();
                }}
              >
                Leaderboard
              </Button>
            )
          ) : (
            <Button block variant="secondary" icon="users" onClick={() => nav.openSheet({ type: 'share', payload: { kind: 'game', game: result.game, score: result.score, code: result.seed } })}>
              Challenge a friend
            </Button>
          )}
          <Button block variant="secondary" onClick={nav.closeGame}>
            Done
          </Button>
        </div>
        {daily && <p className="small dim center">{completedCount(entry)} of 3 daily challenges done</p>}
      </div>
    </div>
  );
}
