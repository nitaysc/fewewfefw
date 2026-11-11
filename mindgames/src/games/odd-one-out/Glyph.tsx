import type { Cell } from './generator';

const rad = (deg: number) => (deg * Math.PI) / 180;
const pt = (r: number, deg: number) => `${(50 + r * Math.cos(rad(deg))).toFixed(2)} ${(50 + r * Math.sin(rad(deg))).toFixed(2)}`;

function body(c: Cell): JSX.Element {
  const col = c.color;
  switch (c.glyph) {
    case 'arc': {
      const len = 2 * Math.PI * 30;
      return <circle cx="50" cy="50" r="30" fill="none" stroke={col} strokeWidth="11" strokeDasharray={`${len * (290 / 360)} ${len}`} transform="rotate(35 50 50)" />;
    }
    case 'ell':
      return <path d="M36 20V74H72" fill="none" stroke={col} strokeWidth="12" strokeLinecap="round" strokeLinejoin="round" />;
    case 'flag':
      return (
        <>
          <path d="M36 18V82" stroke={col} strokeWidth="8" strokeLinecap="round" />
          <path d="M40 20 78 36 40 52z" fill={col} stroke={col} strokeWidth="4" strokeLinejoin="round" />
        </>
      );
    case 'spokes':
      return (
        <>
          {Array.from({ length: c.n }, (_, i) => (
            <path key={i} d={`M50 50L${pt(34, -90 + (i * 360) / c.n)}`} stroke={col} strokeWidth="8" strokeLinecap="round" />
          ))}
          <circle cx="50" cy="50" r="7" fill={col} />
        </>
      );
    case 'dotgrid': {
      const n = c.n;
      const span = n === 3 ? 52 : 60;
      const r = n === 3 ? 8.500 : 6.500;
      return (
        <>
          {Array.from({ length: n * n }, (_, i) =>
            i === c.a ? null : <circle key={i} cx={50 - span / 2 + ((i % n) * span) / (n - 1)} cy={50 - span / 2 + (Math.floor(i / n) * span) / (n - 1)} r={r} fill={col} />,
          )}
        </>
      );
    }
    case 'bars': {
      const n = c.n;
      const span = n <= 2 ? 22 : 44;
      return (
        <>
          <circle cx="50" cy="50" r="38" fill="none" stroke={col} strokeWidth="5" />
          {Array.from({ length: n }, (_, i) => {
            const x = n === 1 ? 0 : -span / 2 + (i * span) / (n - 1);
            const h = Math.sqrt(29 * 29 - x * x) - 3;
            return <path key={i} d={`M${50 + x} ${50 - h}V${50 + h}`} stroke={col} strokeWidth={n >= 5 ? 5.500 : 7} strokeLinecap="round" />;
          })}
        </>
      );
    }
    case 'poly':
      return <polygon points={Array.from({ length: c.n }, (_, i) => pt(36, -90 + (i * 360) / c.n)).join(' ')} fill="none" stroke={col} strokeWidth="9" strokeLinejoin="round" />;
    case 'rings':
      return (
        <>
          {Array.from({ length: c.n }, (_, i) => (
            <circle key={i} cx="50" cy="50" r={37 - (i * 37) / c.n} fill="none" stroke={col} strokeWidth={c.n >= 4 ? 5 : 6} />
          ))}
        </>
      );
    case 'pie':
      return (
        <>
          <circle cx="50" cy="50" r="37" fill="none" stroke={col} strokeWidth="5" />
          <path d={`M50 50L${pt(37, 0)}A37 37 0 ${c.a > 180 ? 1 : 0} 1 ${pt(37, c.a)}z`} fill={col} />
        </>
      );
    case 'half':
      return (
        <>
          <rect x="15" y="15" width="70" height="70" rx="10" fill="none" stroke={col} strokeWidth="5" />
          <path d="M24 24H76L24 76z" fill={col} stroke={col} strokeWidth="3" strokeLinejoin="round" />
        </>
      );
    case 'tone':
      return <rect x="13" y="13" width="74" height="74" rx="20" fill={`hsl(${c.n} 32% ${c.a}%)`} />;
    case 'core':
      return (
        <>
          <circle cx="50" cy="50" r="37" fill="none" stroke={col} strokeWidth="5" />
          <circle cx="50" cy="50" r={c.a} fill={col} />
        </>
      );
  }
}

/** Draws one grid symbol in a 100×100 box. */
export function Glyph({ cell }: { cell: Cell }) {
  const transform = `rotate(${cell.rot} 50 50)${cell.flip ? ' translate(100 0) scale(-1 1)' : ''}`;
  return (
    <svg viewBox="0 0 100 100" aria-hidden="true">
      <g transform={transform}>{body(cell)}</g>
    </svg>
  );
}
