import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import { haptic } from '../../services/haptics';
import { sfx } from '../../services/sfx';
import { RoundFeedback } from '../GameHost';
import { useRoundTimer, type PlayProps } from '../play';
import { TimerBar } from '../TimerBar';
import { timedPoints } from '../types';
import { buildOddSet, OO_ROUNDS } from './generator';
import { Glyph } from './Glyph';

const MAX = 1000 / OO_ROUNDS;
const TIMEOUT = -1;
const LEVEL_NAME = ['Easy', 'Medium', 'Hard'];

export function OddOneOutGame({ seed, done, onRoundStart, onRound, onComplete }: PlayProps) {
  const set = useMemo(() => buildOddSet(seed), [seed]);
  const [index, setIndex] = useState(Math.min(done.length, OO_ROUNDS - 1));
  const [picked, setPicked] = useState<number | null>(null);
  const [points, setPoints] = useState(0);
  const puzzle = set[index];
  const answered = picked !== null;

  useEffect(() => {
    onRoundStart();
  }, [index, onRoundStart]);

  const settle = (choice: number, elapsed: number) => {
    if (answered) return;
    const correct = choice === puzzle.answer;
    const earned = correct ? timedPoints(MAX, elapsed, puzzle.timeMs, 1000) : 0;
    setPicked(choice);
    setPoints(earned);
    onRound({ points: earned, max: MAX, correct, accuracy: correct ? 1 : 0, timeMs: Math.round(elapsed) });
    if (correct) {
      haptic.success();
      sfx.correct();
    } else {
      haptic.error();
      sfx.wrong();
    }
  };

  const elapsed = useRoundTimer(index, puzzle.timeMs, !answered, () => settle(TIMEOUT, puzzle.timeMs));

  const next = () => {
    if (index + 1 >= OO_ROUNDS) onComplete();
    else {
      setIndex(index + 1);
      setPicked(null);
    }
  };

  // keep the pace up: move on by itself shortly after the reveal
  useEffect(() => {
    if (!answered) return;
    const id = window.setTimeout(next, picked === puzzle.answer ? 1300 : 2400);
    return () => window.clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [answered]);

  const correct = picked === puzzle.answer;

  return (
    <div className="play oo">
      <div className="stack gap-3">
        <TimerBar roundKey={index} ms={puzzle.timeMs} running={!answered} />
        <div key={index} className="row between rise">
          <div className="stack gap-1">
            <span className="eyebrow">
              Round {index + 1} of {OO_ROUNDS} · {LEVEL_NAME[puzzle.difficulty]}
            </span>
            <h1 className="prompt">Find the odd one out</h1>
          </div>
        </div>
      </div>

      <div key={`g${index}`} className={`oo-grid ${answered ? 'answered' : ''}`} style={{ '--cols': puzzle.cols } as CSSProperties}>
        {puzzle.cells.map((cell, i) => {
          const state = !answered ? '' : i === puzzle.answer ? 'right' : i === picked ? 'wrong' : 'rest';
          return (
            <button key={i} type="button" className={`oo-cell ${state}`} style={{ '--d': `${(i % puzzle.cols) * 18 + Math.floor(i / puzzle.cols) * 18}ms` } as CSSProperties} disabled={answered} onPointerDown={() => settle(i, elapsed())} aria-label={`Symbol ${i + 1}`}>
              <Glyph cell={cell} />
            </button>
          );
        })}
      </div>

      <div className="play-foot" onClick={answered ? next : undefined}>
        {answered ? (
          <RoundFeedback correct={correct} points={points} title={correct ? 'Spotted' : picked === TIMEOUT ? "Time's up" : 'Wrong one'}>
            {puzzle.explain}
          </RoundFeedback>
        ) : (
          <p className="small dim center tap-hint">One tap only — choose carefully</p>
        )}
      </div>
    </div>
  );
}
