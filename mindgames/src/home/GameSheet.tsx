import { useNav } from '../app/nav';
import { useStore } from '../app/store';
import { Button, Pill, Sheet } from '../components/ui';
import { GAMES, type GameId } from '../games/types';
import { GameArt } from './illustrations';

const nf = new Intl.NumberFormat('en-US');

export function GameSheet({ id, open }: { id: GameId; open: boolean }) {
  const nav = useNav();
  const { data, derived } = useStore();
  const meta = GAMES[id];
  const stats = data.stats[id];
  const today = data.daily[derived.today]?.results[id];
  const inProgress = (data.progress[`${derived.today}:${id}`]?.length ?? 0) > 0;

  return (
    <Sheet open={open} onClose={nav.closeSheet} game={id}>
      <div className="game-sheet-hero">
        <div className="game-sheet-art">
          <GameArt game={id} />
        </div>
        <div className="stack gap-2">
          <Pill tone="accent" icon="clock">
            {meta.rounds} rounds · {meta.playtime}
          </Pill>
          <h2 className="display d-lg">{meta.title}</h2>
          <p className="muted">{meta.blurb}</p>
        </div>
      </div>

      <ol className="howto">
        {meta.howTo.map((line, i) => (
          <li key={i}>
            <span className="display">{i + 1}</span>
            <p className="small">{line}</p>
          </li>
        ))}
      </ol>

      <div className="stat-strip">
        <div>
          <span className="display d-sm">{stats.best ? nf.format(stats.best) : '—'}</span>
          <span className="eyebrow">Best</span>
        </div>
        <div>
          <span className="display d-sm">{stats.plays ? nf.format(Math.round(stats.total / stats.plays)) : '—'}</span>
          <span className="eyebrow">Average</span>
        </div>
        <div>
          <span className="display d-sm">{stats.plays}</span>
          <span className="eyebrow">Played</span>
        </div>
      </div>

      <div className="stack gap-3">
        {today ? (
          <div className="card card-tight row between">
            <span className="stack">
              <span className="eyebrow">Today's challenge</span>
              <b>Completed</b>
            </span>
            <span className="display d-md" style={{ color: 'var(--lime)' }}>
              {nf.format(today.score)}
            </span>
          </div>
        ) : (
          <Button block size="lg" iconRight="chevron" onClick={() => nav.play(id, 'daily')}>
            {inProgress ? "Resume today's challenge" : "Play today's challenge"}
          </Button>
        )}
        <Button block variant="secondary" icon="refresh" onClick={() => nav.play(id, 'practice')}>
          Practice run
        </Button>
        <p className="small dim center">Practice uses fresh puzzles and earns half XP. It never affects your daily score.</p>
      </div>
    </Sheet>
  );
}
