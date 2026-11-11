import type { CSSProperties } from 'react';
import { useNav } from '../app/nav';
import { useStore } from '../app/store';
import { Icon } from '../components/Icon';
import { Avatar, Button, DailyRing, IconButton, LogoMark, Pill, SectionTitle, Wordmark } from '../components/ui';
import { completedCount, dailyTotal, isComplete, nextGame } from '../daily/daily';
import { GAME_IDS, GAMES } from '../games/types';
import { dailyNumber, formatLong } from '../services/date';
import { haptic } from '../services/haptics';
import { GameArt, GameGlyph } from './illustrations';

export const GAME_COLORS = { 'close-enough': 'var(--amber)', perception: 'var(--lav)', 'odd-one-out': 'var(--aqua)' } as const;
const nf = new Intl.NumberFormat('en-US');

function greeting(): string {
  const h = new Date().getHours();
  if (h < 5) return 'Up late';
  if (h < 12) return 'Good morning';
  if (h < 18) return 'Good afternoon';
  return 'Good evening';
}

export function DailyCard() {
  const nav = useNav();
  const { data, derived } = useStore();
  const entry = data.daily[derived.today];
  const done = completedCount(entry);
  const complete = isComplete(entry);
  const next = nextGame(entry);
  const started = done > 0 || GAME_IDS.some((g) => data.progress[`${derived.today}:${g}`]?.length);

  return (
    <section className="card daily-card rise" style={{ '--i': 1 } as CSSProperties}>
      <div className="row between gap-4">
        <div className="stack gap-2 grow">
          <div className="row gap-2">
            <span className="eyebrow" style={{ color: 'var(--lime)' }}>
              Daily #{dailyNumber(derived.today)}
            </span>
            {complete && <Pill tone="lime" icon="check">Complete</Pill>}
          </div>
          <h1 className="display d-md">{formatLong(derived.today)}</h1>
          <p className="small muted">{complete ? 'All three done. New set at midnight.' : done ? `${3 - done} to go. Same puzzles for everyone today.` : 'Three challenges. One attempt each.'}</p>
        </div>
        <DailyRing done={GAME_IDS.map((g) => Boolean(entry?.results[g]))} colors={GAME_IDS.map((g) => GAME_COLORS[g])}>
          {complete ? (
            <Icon name="check" size={26} style={{ color: 'var(--lime)' }} />
          ) : (
            <span className="display d-sm">
              {done}
              <span className="dim">/3</span>
            </span>
          )}
        </DailyRing>
      </div>

      <div className="daily-dots">
        {GAME_IDS.map((g) => {
          const result = entry?.results[g];
          return (
            <div key={g} className={`daily-dot ${result ? 'done' : ''}`} data-game={g}>
              <span className="daily-dot-icon">
                <GameGlyph game={g} size={16} />
              </span>
              <span className="daily-dot-score display">{result ? nf.format(result.score) : '—'}</span>
            </div>
          );
        })}
      </div>

      {complete ? (
        <div className="row gap-3">
          <div className="stack grow">
            <span className="eyebrow">Today's total</span>
            <span className="display d-lg">
              {nf.format(dailyTotal(entry))} <span className="dim d-sm">/ 3,000</span>
            </span>
          </div>
          <Button variant="secondary" icon="share" onClick={() => nav.openSheet({ type: 'share', payload: { kind: 'daily', date: derived.today } })}>
            Share
          </Button>
        </div>
      ) : (
        <Button block size="lg" iconRight="chevron" onClick={() => next && nav.play(next, 'daily')}>
          {started ? `Continue · ${GAMES[next!].title}` : "Play today's set"}
        </Button>
      )}
    </section>
  );
}

export function HomeScreen() {
  const nav = useNav();
  const { data, derived } = useStore();
  const entry = data.daily[derived.today];

  return (
    <div className="screen">
      <header className="row between home-head">
        <div className="row gap-2">
          <LogoMark size={30} />
          <Wordmark size={25} />
        </div>
        <div className="row gap-2">
          <button type="button" className={`streak-pill ${derived.playedToday ? 'lit' : ''}`} onClick={() => nav.go('daily')} aria-label={`${derived.streak} day streak`}>
            <Icon name="flame" size={16} filled />
            <span className="display">{derived.streak}</span>
          </button>
          <IconButton icon="settings" label="Settings" onClick={() => nav.openSheet({ type: 'settings' })} />
          <button type="button" onClick={() => nav.go('profile')} aria-label="Profile" className="avatar-btn">
            <Avatar index={data.profile.avatar} size={40} />
          </button>
        </div>
      </header>

      <p className="small muted rise home-hello">
        {greeting()}, <b>{data.profile.name}</b>
      </p>

      <DailyCard />

      <SectionTitle>Games</SectionTitle>
      <div className="stack gap-3">
        {GAME_IDS.map((g, i) => {
          const meta = GAMES[g];
          const result = entry?.results[g];
          const stats = data.stats[g];
          return (
            <button
              key={g}
              type="button"
              className="card card-press game-card rise"
              data-game={g}
              style={{ '--i': i + 2 } as CSSProperties}
              onClick={() => {
                haptic.tap();
                nav.openSheet({ type: 'game', id: g });
              }}
            >
              <div className="game-card-art">
                <GameArt game={g} />
              </div>
              <div className="game-card-body">
                <h3 className="display d-md">{meta.title}</h3>
                <p className="small muted">{meta.tagline}</p>
                <div className="row gap-2 game-card-meta">
                  <Pill icon="clock">{meta.playtime}</Pill>
                  {result ? (
                    <Pill tone="lime" icon="check">
                      Today · {nf.format(result.score)}
                    </Pill>
                  ) : (
                    <Pill tone="accent">Today's challenge</Pill>
                  )}
                  {stats.best > 0 && !result && <Pill icon="star">{nf.format(stats.best)}</Pill>}
                </div>
              </div>
            </button>
          );
        })}
      </div>

      <button
        type="button"
        className="card card-tight card-press code-row rise"
        style={{ '--i': 5 } as CSSProperties}
        onClick={() => {
          haptic.tap();
          nav.openSheet({ type: 'challenge' });
        }}
      >
        <span className="code-row-icon">
          <Icon name="code" size={18} />
        </span>
        <span className="stack grow">
          <b>Got a challenge code?</b>
          <span className="small muted">Play the exact puzzle set a friend sent you.</span>
        </span>
        <Icon name="chevron" size={18} className="dim" />
      </button>
    </div>
  );
}
