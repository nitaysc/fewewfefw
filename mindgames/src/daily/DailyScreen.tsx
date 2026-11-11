import { useEffect, useState, type CSSProperties } from 'react';
import { useNav } from '../app/nav';
import { useStore } from '../app/store';
import { Icon } from '../components/Icon';
import { Button, IconButton, Pill, SectionTitle, Sheet } from '../components/ui';
import { GAME_COLORS } from '../home/HomeScreen';
import { GameGlyph } from '../home/illustrations';
import { GAME_IDS, GAMES } from '../games/types';
import { addDays, dailyNumber, dateKey, formatLong, monthName, weekStart } from '../services/date';
import { haptic } from '../services/haptics';
import { completedCount, DAILY_BONUS_XP, dailyTotal, isComplete } from './daily';

const nf = new Intl.NumberFormat('en-US');
const pad = (n: number) => String(n).padStart(2, '0');

function useCountdownToMidnight(): string {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);
  const d = new Date(now);
  const end = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1).getTime();
  const s = Math.max(0, Math.floor((end - now) / 1000));
  return `${pad(Math.floor(s / 3600))}:${pad(Math.floor((s % 3600) / 60))}:${pad(s % 60)}`;
}

export function DailyScreen() {
  const nav = useNav();
  const { data, derived } = useStore();
  const today = derived.today;
  const entry = data.daily[today];
  const complete = isComplete(entry);
  const countdown = useCountdownToMidnight();
  const [month, setMonth] = useState(() => ({ y: Number(today.slice(0, 4)), m: Number(today.slice(5, 7)) - 1 }));

  const first = new Date(month.y, month.m, 1);
  const lead = (first.getDay() + 6) % 7;
  const count = new Date(month.y, month.m + 1, 0).getDate();
  const cells: (string | null)[] = [...Array(lead).fill(null), ...Array.from({ length: count }, (_, i) => dateKey(new Date(month.y, month.m, i + 1)))];
  const monday = weekStart(today);
  const canGoForward = month.y < Number(today.slice(0, 4)) || month.m < Number(today.slice(5, 7)) - 1;
  const shift = (delta: number) => setMonth(({ y, m }) => {
    const d = new Date(y, m + delta, 1);
    return { y: d.getFullYear(), m: d.getMonth() };
  });

  return (
    <div className="screen">
      <header className="row between page-head">
        <div className="stack">
          <span className="eyebrow" style={{ color: 'var(--lime)' }}>
            Daily #{dailyNumber(today)}
          </span>
          <h1 className="display d-lg">{formatLong(today)}</h1>
        </div>
        <Pill icon="clock">
          <span className="tnum">{countdown}</span>
        </Pill>
      </header>

      <section className="card rise daily-list">
        {GAME_IDS.map((g) => {
          const result = entry?.results[g];
          const progress = data.progress[`${today}:${g}`]?.length ?? 0;
          return (
            <div key={g} className="daily-row" data-game={g}>
              <span className={`daily-row-icon ${result ? 'done' : ''}`}>
                <GameGlyph game={g} size={20} />
              </span>
              <div className="stack grow">
                <b>{GAMES[g].title}</b>
                <span className="small muted">{result ? `${Math.round(result.accuracy * 100)}% accuracy` : progress ? `In progress · round ${Math.min(progress + 1, GAMES[g].rounds)} of ${GAMES[g].rounds}` : `${GAMES[g].rounds} rounds · ${GAMES[g].playtime}`}</span>
              </div>
              {result ? (
                <span className="display d-md tnum">{nf.format(result.score)}</span>
              ) : (
                <Button size="sm" variant="accent" onClick={() => nav.play(g, 'daily')}>
                  {progress ? 'Resume' : 'Play'}
                </Button>
              )}
            </div>
          );
        })}
        <div className="daily-total">
          <div className="stack">
            <span className="eyebrow">{complete ? "Today's total" : 'So far'}</span>
            <span className="display d-lg tnum">
              {nf.format(dailyTotal(entry))} <span className="dim d-sm">/ 3,000</span>
            </span>
          </div>
          {complete ? (
            <Button icon="share" onClick={() => nav.openSheet({ type: 'share', payload: { kind: 'daily', date: today } })}>
              Share
            </Button>
          ) : (
            <Pill tone="lime" icon="bolt">
              +{DAILY_BONUS_XP} XP for all three
            </Pill>
          )}
        </div>
      </section>

      <section className="card rise streak-card" style={{ '--i': 1 } as CSSProperties}>
        <div className="row between">
          <div className="row gap-3">
            <span className={`streak-flame ${derived.playedToday ? 'lit' : ''}`}>
              <Icon name="flame" size={26} filled />
            </span>
            <div className="stack">
              <span className="display d-md">
                {derived.streak} day{derived.streak === 1 ? '' : 's'}
              </span>
              <span className="small muted">{derived.playedToday ? 'Streak safe for today' : derived.streak ? 'Play any daily game to keep it alive' : 'Play a daily game to start a streak'}</span>
            </div>
          </div>
          <div className="stack" style={{ alignItems: 'flex-end' }}>
            <span className="display d-sm">{Math.max(data.bestStreak, derived.streak)}</span>
            <span className="eyebrow">Best</span>
          </div>
        </div>
        <div className="week">
          {Array.from({ length: 7 }, (_, i) => addDays(monday, i)).map((key) => {
            const n = completedCount(data.daily[key]);
            return (
              <div key={key} className={`week-day ${key === today ? 'today' : ''} ${n === 3 ? 'full' : n ? 'part' : ''} ${key > today ? 'future' : ''}`}>
                <span className="week-dot">{n === 3 ? <Icon name="check" size={14} /> : n ? n : ''}</span>
                <span className="eyebrow">{'MTWTFSS'[(new Date(key + 'T12:00').getDay() + 6) % 7]}</span>
              </div>
            );
          })}
        </div>
      </section>

      <SectionTitle
        action={
          <div className="row gap-2">
            <IconButton icon="back" label="Previous month" onClick={() => shift(-1)} />
            <IconButton icon="chevron" label="Next month" onClick={() => canGoForward && shift(1)} className={canGoForward ? '' : 'disabled'} />
          </div>
        }
      >
        {monthName(month.y, month.m)}
      </SectionTitle>
      <section className="card card-tight calendar">
        {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((d, i) => (
          <span key={i} className="eyebrow center">
            {d}
          </span>
        ))}
        {cells.map((key, i) => {
          if (!key) return <span key={i} />;
          const n = completedCount(data.daily[key]);
          const cls = `cal-day ${key === today ? 'today' : ''} ${n === 3 ? 'full' : n ? 'part' : ''} ${key > today ? 'future' : ''}`;
          return (
            <button
              key={i}
              type="button"
              className={cls}
              disabled={!n}
              aria-label={`${formatLong(key)}${n ? `, ${n} of 3 played` : ''}`}
              onClick={() => {
                haptic.tap();
                nav.openSheet({ type: 'day', date: key });
              }}
            >
              <span className="tnum">{Number(key.slice(8))}</span>
              <span className="cal-pips">
                {GAME_IDS.map((g) => (
                  <i key={g} style={{ background: data.daily[key]?.results[g] ? GAME_COLORS[g] : undefined }} />
                ))}
              </span>
            </button>
          );
        })}
      </section>
      <p className="small dim center" style={{ marginTop: 'var(--s4)' }}>
        Tap a played day to see its scores. Everyone gets the same three puzzles each day.
      </p>
    </div>
  );
}

export function DaySheet({ date, open }: { date: string; open: boolean }) {
  const nav = useNav();
  const { data } = useStore();
  const entry = data.daily[date];
  return (
    <Sheet open={open} onClose={nav.closeSheet} title={`Daily #${dailyNumber(date)}`}>
      <div className="stack gap-4">
        <p className="muted">{formatLong(date)}</p>
        <div className="card card-tight daily-list">
          {GAME_IDS.map((g) => {
            const r = entry?.results[g];
            return (
              <div key={g} className="daily-row" data-game={g}>
                <span className={`daily-row-icon ${r ? 'done' : ''}`}>
                  <GameGlyph game={g} size={20} />
                </span>
                <div className="stack grow">
                  <b>{GAMES[g].title}</b>
                  <span className="small muted">{r ? `${Math.round(r.accuracy * 100)}% accuracy · ${r.rounds.filter((x) => x.correct).length}/${r.rounds.length} rounds` : 'Not played'}</span>
                </div>
                <span className="display d-md tnum">{r ? nf.format(r.score) : '—'}</span>
              </div>
            );
          })}
        </div>
        <div className="row between">
          <div className="stack">
            <span className="eyebrow">Total</span>
            <span className="display d-lg tnum">{nf.format(dailyTotal(entry))}</span>
          </div>
          <Button icon="share" variant="secondary" onClick={() => nav.openSheet({ type: 'share', payload: { kind: 'daily', date } })}>
            Share
          </Button>
        </div>
      </div>
    </Sheet>
  );
}
