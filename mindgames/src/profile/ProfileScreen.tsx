import type { CSSProperties } from 'react';
import { useNav } from '../app/nav';
import { levelInfo, levelTitle } from '../app/progression';
import { useStore } from '../app/store';
import { Icon, type IconName } from '../components/Icon';
import { Avatar, IconButton, ProgressBar, SectionTitle } from '../components/ui';
import { completedCount, isComplete } from '../daily/daily';
import { GameGlyph } from '../home/illustrations';
import { GAME_IDS, GAMES } from '../games/types';
import { daysBetween, formatShort } from '../services/date';
import { haptic } from '../services/haptics';
import { AccuracyChart, DailyScoreChart } from '../statistics/charts';

const nf = new Intl.NumberFormat('en-US');

function Tile({ icon, value, label, tone }: { icon: IconName; value: string; label: string; tone?: string }) {
  return (
    <div className="card card-tight tile">
      <span className="tile-icon" style={{ color: tone }}>
        <Icon name={icon} size={17} />
      </span>
      <span className="display d-md tnum">{value}</span>
      <span className="eyebrow">{label}</span>
    </div>
  );
}

export function ProfileScreen() {
  const nav = useNav();
  const { data, derived } = useStore();
  const level = levelInfo(data.xp);
  const days = Math.max(1, daysBetween(data.profile.joined, derived.today) + 1);
  const fullDays = Object.values(data.daily).filter((e) => isComplete(e)).length;
  const history = Object.keys(data.daily)
    .filter((k) => completedCount(data.daily[k]) > 0)
    .sort()
    .reverse()
    .slice(0, 5);

  return (
    <div className="screen">
      <header className="row between page-head">
        <h1 className="display d-lg">Profile</h1>
        <IconButton icon="settings" label="Settings" onClick={() => nav.openSheet({ type: 'settings' })} />
      </header>

      <section className="card rise profile-card">
        <div className="row gap-4">
          <Avatar index={data.profile.avatar} size={68} ring />
          <div className="stack grow">
            <h2 className="display d-md profile-name">{data.profile.name}</h2>
            <span className="small muted">
              {levelTitle(level.level)} · joined {formatShort(data.profile.joined)}
            </span>
          </div>
          <IconButton icon="pencil" label="Edit profile" onClick={() => nav.openSheet({ type: 'settings' })} />
        </div>
        <div className="stack gap-2">
          <div className="row between">
            <span className="row gap-2">
              <span className="level-badge display">{level.level}</span>
              <b>Level {level.level}</b>
            </span>
            <span className="small muted tnum">
              {nf.format(level.into)} / {nf.format(level.need)} XP
            </span>
          </div>
          <ProgressBar value={level.into / level.need} height={8} />
          <span className="small dim tnum">{nf.format(data.xp)} XP earned in total</span>
        </div>
      </section>

      <div className="tiles">
        <Tile icon="flame" value={String(derived.streak)} label="Current streak" tone="var(--amber)" />
        <Tile icon="star" value={String(Math.max(data.bestStreak, derived.streak))} label="Best streak" tone="var(--lime)" />
        <Tile icon="play" value={nf.format(derived.gamesPlayed)} label="Games played" tone="var(--lav)" />
        <Tile icon="trophy" value={nf.format(derived.totalScore)} label="Total score" tone="var(--aqua)" />
        <Tile icon="target" value={derived.gamesPlayed ? `${Math.round(derived.averageAccuracy * 100)}%` : '—'} label="Avg accuracy" tone="var(--lime)" />
        <Tile icon="calendar" value={`${Math.round((fullDays / days) * 100)}%`} label="Daily completion" tone="var(--amber)" />
      </div>

      <SectionTitle>Last 14 days</SectionTitle>
      <section className="card card-tight">
        <DailyScoreChart log={data.daily} today={derived.today} />
        <div className="legend">
          {GAME_IDS.map((g) => (
            <span key={g} data-game={g}>
              <i />
              {GAMES[g].title}
            </span>
          ))}
        </div>
      </section>

      <SectionTitle>By game</SectionTitle>
      <div className="stack gap-3">
        {GAME_IDS.map((g, i) => {
          const s = data.stats[g];
          const avg = s.plays ? Math.round(s.total / s.plays) : 0;
          return (
            <button
              key={g}
              type="button"
              className="card card-tight card-press game-stat rise"
              data-game={g}
              style={{ '--i': i } as CSSProperties}
              onClick={() => {
                haptic.tap();
                nav.openSheet({ type: 'game', id: g });
              }}
            >
              <div className="row gap-3">
                <span className="daily-row-icon done">
                  <GameGlyph game={g} size={20} />
                </span>
                <b className="grow">{GAMES[g].title}</b>
                <span className="small muted">
                  {s.plays} played
                </span>
              </div>
              <ProgressBar value={avg / 1000} color="var(--accent)" />
              <div className="stat-strip flat">
                <div>
                  <span className="display d-sm tnum">{s.plays ? nf.format(avg) : '—'}</span>
                  <span className="eyebrow">Average</span>
                </div>
                <div>
                  <span className="display d-sm tnum">{s.best ? nf.format(s.best) : '—'}</span>
                  <span className="eyebrow">Best</span>
                </div>
                <div>
                  <span className="display d-sm tnum">{s.plays ? `${Math.round((s.accuracySum / s.plays) * 100)}%` : '—'}</span>
                  <span className="eyebrow">Accuracy</span>
                </div>
                <div>
                  <span className="display d-sm tnum">{s.roundsPlayed ? `${s.roundsCorrect}/${s.roundsPlayed}` : '—'}</span>
                  <span className="eyebrow">Rounds won</span>
                </div>
              </div>
            </button>
          );
        })}
      </div>

      <SectionTitle>Accuracy trend</SectionTitle>
      <section className="card card-tight">
        <AccuracyChart values={data.history.slice(-20).map((h) => h.a)} />
      </section>

      <SectionTitle
        action={
          <button type="button" className="link" onClick={() => nav.go('daily')}>
            Calendar
          </button>
        }
      >
        Daily history
      </SectionTitle>
      {history.length ? (
        <section className="card card-tight history">
          {history.map((key) => {
            const e = data.daily[key];
            const total = GAME_IDS.reduce((sum, g) => sum + (e.results[g]?.score ?? 0), 0);
            return (
              <button
                key={key}
                type="button"
                className="history-row"
                onClick={() => {
                  haptic.tap();
                  nav.openSheet({ type: 'day', date: key });
                }}
              >
                <span className="stack grow">
                  <b>{formatShort(key)}</b>
                  <span className="small muted">{completedCount(e)} of 3 played</span>
                </span>
                <span className="history-pips">
                  {GAME_IDS.map((g) => (
                    <i key={g} data-game={g} className={e.results[g] ? 'on' : ''} />
                  ))}
                </span>
                <span className="display d-sm tnum">{nf.format(total)}</span>
                <Icon name="chevron" size={16} className="dim" />
              </button>
            );
          })}
        </section>
      ) : (
        <div className="card empty">
          <Icon name="calendar" size={30} />
          <b>No daily results yet</b>
          <p className="small muted">Finish a daily challenge and it will show up here.</p>
        </div>
      )}
    </div>
  );
}
