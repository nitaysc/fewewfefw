import type { DailyLog } from '../daily/daily';
import { GAME_IDS, type GameId } from '../games/types';
import { addDays, formatShort } from '../services/date';

const COLORS: Record<GameId, string> = { 'close-enough': 'var(--amber)', perception: 'var(--lav)', 'odd-one-out': 'var(--aqua)' };

/** Stacked bars: daily score for the last 14 days, split by game (max 3,000). */
export function DailyScoreChart({ log, today }: { log: DailyLog; today: string }) {
  const days = Array.from({ length: 14 }, (_, i) => addDays(today, i - 13));
  const W = 320;
  const H = 150;
  const base = 124;
  const top = 8;
  const slot = (W - 26) / days.length;
  const bar = 12;
  const scale = (base - top) / 3000;
  const any = days.some((d) => log[d]);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="chart" role="img" aria-label="Daily score over the last 14 days">
      {[1000, 2000, 3000].map((v) => (
        <g key={v}>
          <line x1="0" x2={W} y1={base - v * scale} y2={base - v * scale} stroke="rgba(255,255,255,0.06)" strokeDasharray="2 5" />
          <text x={W} y={base - v * scale - 4} textAnchor="end" className="chart-label">
            {v / 1000}k
          </text>
        </g>
      ))}
      <line x1="0" x2={W} y1={base} y2={base} stroke="rgba(255,255,255,0.12)" />
      {days.map((d, i) => {
        const x = i * slot + (slot - bar) / 2;
        let y = base;
        const entry = log[d];
        return (
          <g key={d}>
            {!entry && <rect x={x} y={base - 3} width={bar} height={3} rx={1.5} fill="rgba(255,255,255,0.1)" />}
            {GAME_IDS.map((g) => {
              const score = entry?.results[g]?.score ?? 0;
              if (!entry?.results[g]) return null;
              const h = Math.max(2, score * scale);
              y -= h + 1.5;
              return <rect key={g} x={x} y={y} width={bar} height={h} rx={2.5} fill={COLORS[g]} className="chart-bar" style={{ animationDelay: `${i * 30}ms` }} />;
            })}
            {(i === 0 || i === 13 || i === 6) && (
              <text x={x + bar / 2} y={H - 6} textAnchor="middle" className="chart-label">
                {i === 13 ? 'Today' : formatShort(d)}
              </text>
            )}
          </g>
        );
      })}
      {!any && (
        <text x={W / 2} y={70} textAnchor="middle" className="chart-empty">
          Play a daily challenge to start your chart
        </text>
      )}
    </svg>
  );
}

/** Line + area: accuracy across the most recent games. */
export function AccuracyChart({ values }: { values: number[] }) {
  const W = 320;
  const H = 110;
  const pad = 6;
  if (values.length < 2) {
    return (
      <svg viewBox={`0 0 ${W} ${H}`} className="chart" role="img" aria-label="Accuracy trend">
        <line x1="0" x2={W} y1={H - 20} y2={H - 20} stroke="rgba(255,255,255,0.12)" />
        <text x={W / 2} y={H / 2} textAnchor="middle" className="chart-empty">
          Finish two games to see your trend
        </text>
      </svg>
    );
  }
  const pts = values.map((v, i) => [pad + (i * (W - pad * 2)) / (values.length - 1), 10 + (1 - v) * (H - 34)] as const);
  const line = pts.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)}`).join(' ');
  const last = pts[pts.length - 1];
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="chart" role="img" aria-label={`Accuracy over the last ${values.length} games`}>
      <defs>
        <linearGradient id="acc-fill" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor="#BDF26D" stopOpacity="0.28" />
          <stop offset="1" stopColor="#BDF26D" stopOpacity="0" />
        </linearGradient>
      </defs>
      {[0, 0.5, 1].map((v) => (
        <g key={v}>
          <line x1="0" x2={W} y1={10 + (1 - v) * (H - 34)} y2={10 + (1 - v) * (H - 34)} stroke="rgba(255,255,255,0.06)" strokeDasharray="2 5" />
          <text x={W} y={10 + (1 - v) * (H - 34) - 3} textAnchor="end" className="chart-label">
            {v * 100}%
          </text>
        </g>
      ))}
      <path d={`${line} L${last[0]} ${H - 24} L${pts[0][0]} ${H - 24}z`} fill="url(#acc-fill)" />
      <path d={line} fill="none" stroke="#BDF26D" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="chart-line" pathLength={1} />
      <circle cx={last[0]} cy={last[1]} r="4.5" fill="#BDF26D" stroke="#17171B" strokeWidth="2" />
      <text x={0} y={H - 6} className="chart-label">
        {values.length} games ago
      </text>
      <text x={W} y={H - 6} textAnchor="end" className="chart-label">
        Latest
      </text>
    </svg>
  );
}
