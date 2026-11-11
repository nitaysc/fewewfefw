import type { GameId } from '../games/types';

/** Small vector scenes that give each game card its own identity. Colours follow --accent. */

function CloseEnoughArt() {
  const ticks = Array.from({ length: 13 }, (_, i) => i);
  return (
    <svg viewBox="0 0 160 160" className="art" aria-hidden="true">
      <g fill="none" stroke="currentColor">
        <circle cx="92" cy="80" r="68" strokeWidth="1" opacity="0.18" />
        <circle cx="92" cy="80" r="48" strokeWidth="1" opacity="0.3" />
        <circle cx="92" cy="80" r="28" strokeWidth="1.5" opacity="0.5" />
      </g>
      <g stroke="currentColor" strokeWidth="1.5" opacity="0.35" strokeLinecap="round">
        {ticks.map((i) => (
          <path key={i} d={`M${20 + i * 12} 150v${i % 3 === 0 ? -10 : -5}`} />
        ))}
      </g>
      <circle cx="92" cy="80" r="9" fill="currentColor" />
      <path d="M92 80 124 52" stroke="#F3F3F6" strokeWidth="1.500" strokeDasharray="3 4" opacity="0.7" />
      <g className="art-float">
        <circle cx="124" cy="52" r="11" fill="#0D0D0F" stroke="#F3F3F6" strokeWidth="2.500" />
        <circle cx="124" cy="52" r="3.500" fill="#F3F3F6" />
      </g>
    </svg>
  );
}

function PerceptionArt() {
  const big = [0, 60, 120, 180, 240, 300];
  const small = [0, 45, 90, 135, 180, 225, 270, 315];
  return (
    <svg viewBox="0 0 160 160" className="art" aria-hidden="true">
      <g fill="#34343D">
        {big.map((a) => (
          <circle key={a} cx={104 + 50 * Math.cos((a * Math.PI) / 180)} cy={62 + 50 * Math.sin((a * Math.PI) / 180)} r="21" />
        ))}
      </g>
      <circle cx="104" cy="62" r="19" fill="currentColor" />
      <g fill="#34343D">
        {small.map((a) => (
          <circle key={a} cx={38 + 29 * Math.cos((a * Math.PI) / 180)} cy={122 + 29 * Math.sin((a * Math.PI) / 180)} r="5.500" />
        ))}
      </g>
      <circle cx="38" cy="122" r="19" fill="currentColor" className="art-pulse" />
    </svg>
  );
}

function OddOneOutArt() {
  const cells = Array.from({ length: 9 }, (_, i) => i);
  const c = 2 * Math.PI * 13;
  return (
    <svg viewBox="0 0 160 160" className="art" aria-hidden="true">
      {cells.map((i) => {
        const x = 34 + (i % 3) * 48;
        const y = 32 + Math.floor(i / 3) * 48;
        const odd = i === 5;
        return (
          <g key={i} transform={`rotate(${odd ? 150 : 20} ${x} ${y})`} className={odd ? 'art-odd' : ''} style={{ transformOrigin: `${x}px ${y}px` }}>
            <circle cx={x} cy={y} r="13" fill="none" stroke={odd ? 'currentColor' : '#4A4A55'} strokeWidth="6.500" strokeDasharray={`${c * 0.78} ${c * 0.22}`} />
          </g>
        );
      })}
    </svg>
  );
}

export function GameArt({ game }: { game: GameId }) {
  if (game === 'close-enough') return <CloseEnoughArt />;
  if (game === 'perception') return <PerceptionArt />;
  return <OddOneOutArt />;
}

/** Compact glyph used in lists and indicators. */
export function GameGlyph({ game, size = 18 }: { game: GameId; size?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
      {game === 'close-enough' && (
        <>
          <circle cx="12" cy="12" r="8.500" />
          <circle cx="12" cy="12" r="2.500" fill="currentColor" stroke="none" />
        </>
      )}
      {game === 'perception' && (
        <>
          <path d="M2.500 12S6 5.500 12 5.500 21.500 12 21.500 12 18 18.500 12 18.500 2.500 12 2.500 12z" />
          <circle cx="12" cy="12" r="2.500" fill="currentColor" stroke="none" />
        </>
      )}
      {game === 'odd-one-out' && (
        <>
          <circle cx="6.500" cy="6.500" r="2.500" />
          <circle cx="17.500" cy="6.500" r="2.500" />
          <circle cx="6.500" cy="17.500" r="2.500" />
          <rect x="15" y="15" width="5" height="5" rx="1" fill="currentColor" stroke="none" />
        </>
      )}
    </svg>
  );
}
