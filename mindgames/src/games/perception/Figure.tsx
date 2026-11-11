import type { CSSProperties } from 'react';
import type { Anim, Box, Shape } from './generators';
import { VIEW } from './generators';

function animStyle(anim?: Anim): CSSProperties | undefined {
  if (!anim) return undefined;
  if (anim.kind === 'pulse') return { animation: `pe-pulse ${anim.dur}s ease-in-out ${anim.delay}s infinite alternate` };
  if (anim.kind === 'drift') return { animation: `pe-drift ${anim.dur}s ease-in-out ${anim.delay}s infinite alternate`, '--dx': `${anim.dx}px`, '--dy': `${anim.dy}px` } as CSSProperties;
  return { animation: `pe-spin ${anim.dur}s linear ${anim.delay}s infinite ${anim.dir === 1 ? 'normal' : 'reverse'}`, transformOrigin: `${anim.cx}px ${anim.cy}px` };
}

function draw(s: Shape, key: number): JSX.Element {
  switch (s.t) {
    case 'circle':
      return <circle key={key} cx={s.cx} cy={s.cy} r={s.r} fill={s.fill ?? 'none'} stroke={s.stroke} strokeWidth={s.sw} style={animStyle(s.anim)} />;
    case 'line':
      return <line key={key} x1={s.x1} y1={s.y1} x2={s.x2} y2={s.y2} stroke={s.stroke} strokeWidth={s.sw} strokeLinecap="round" />;
    case 'poly':
      return <polygon key={key} points={s.pts.map((p) => p.join(',')).join(' ')} fill={s.fill ?? 'none'} stroke={s.stroke} strokeWidth={s.sw} strokeLinejoin="round" />;
    case 'rect':
      return <rect key={key} x={s.x} y={s.y} width={s.w} height={s.h} rx={s.rx} fill={s.fill ?? 'none'} stroke={s.stroke} strokeWidth={s.sw} />;
    case 'text':
      return (
        <text key={key} x={s.x} y={s.y} fontSize={s.size} fill={s.fill} textAnchor="middle" fontFamily="var(--font-display)" letterSpacing="0.04em">
          {s.text}
        </text>
      );
    case 'group':
      return (
        <g key={key} style={animStyle(s.anim)}>
          {s.children.map(draw)}
        </g>
      );
  }
}

interface Props {
  shapes: Shape[];
  reveal?: Shape[];
  targets?: Box[];
  answer: number;
  picked: number | null;
  onPick: (i: number) => void;
}

/** Renders a challenge. Tappable regions sit invisibly on top until the round is answered. */
export function Figure({ shapes, reveal, targets, answer, picked, onPick }: Props) {
  const answered = picked !== null;
  return (
    <svg viewBox={`0 0 ${VIEW} ${VIEW}`} className="figure essential-motion" role="img" aria-label="Challenge figure">
      {shapes.map(draw)}
      {answered && <g className="figure-reveal">{reveal?.map(draw)}</g>}
      {targets?.map((t, i) => {
        const state = !answered ? '' : i === answer ? 'right' : i === picked ? 'wrong' : 'rest';
        return (
          <rect
            key={i}
            x={t.x + 2}
            y={t.y + 2}
            width={t.w - 4}
            height={t.h - 4}
            rx={14}
            className={`figure-target ${state}`}
            onPointerDown={answered ? undefined : () => onPick(i)}
            role="button"
            aria-label={`Option ${i + 1}`}
          />
        );
      })}
    </svg>
  );
}
