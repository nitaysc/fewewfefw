import { useEffect, useMemo, useState } from 'react';
import { Button } from '../../components/ui';
import { haptic } from '../../services/haptics';
import { sfx } from '../../services/sfx';
import { RoundFeedback } from '../GameHost';
import { useRoundTimer, type PlayProps } from '../play';
import { TimerBar } from '../TimerBar';
import { timedPoints } from '../types';
import { Figure } from './Figure';
import { buildPerceptionSet, PE_ROUNDS, PE_TIME_MS } from './generators';

const MAX = Math.round(1000 / PE_ROUNDS);
const TIMEOUT = -1;

export function PerceptionGame({ seed, done, onRoundStart, onRound, onComplete }: PlayProps) {
  const set = useMemo(() => buildPerceptionSet(seed), [seed]);
  const [index, setIndex] = useState(Math.min(done.length, PE_ROUNDS - 1));
  const [picked, setPicked] = useState<number | null>(null);
  const [points, setPoints] = useState(0);
  const challenge = set[index];
  const answered = picked !== null;

  useEffect(() => {
    onRoundStart();
  }, [index, onRoundStart]);

  const settle = (choice: number, elapsed: number) => {
    if (answered) return;
    const correct = choice === challenge.answer;
    const earned = correct ? timedPoints(MAX, elapsed, PE_TIME_MS) : 0;
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

  const elapsed = useRoundTimer(index, PE_TIME_MS, !answered, () => settle(TIMEOUT, PE_TIME_MS));

  const next = () => {
    if (index + 1 >= PE_ROUNDS) onComplete();
    else {
      setIndex(index + 1);
      setPicked(null);
    }
  };

  const correct = picked === challenge.answer;

  return (
    <div className="play pe">
      <div className="stack gap-3">
        <TimerBar roundKey={index} ms={PE_TIME_MS} running={!answered} />
        <div key={index} className="stack gap-1 rise">
          <span className="eyebrow">
            Round {index + 1} of {PE_ROUNDS}
          </span>
          <h1 className="prompt">{challenge.prompt}</h1>
        </div>
      </div>

      <div key={`f${index}`} className={`figure-card ${answered ? (correct ? 'ok' : 'bad') : ''}`}>
        <Figure shapes={challenge.shapes} reveal={challenge.reveal} targets={challenge.targets} answer={challenge.answer} picked={picked} onPick={(i) => settle(i, elapsed())} />
      </div>

      <div className="play-foot">
        {challenge.choices && !answered && (
          <div className="choices">
            {challenge.choices.map((label, i) => (
              <button key={i} type="button" className="choice display" onPointerDown={() => settle(i, elapsed())}>
                {label}
              </button>
            ))}
          </div>
        )}
        {!answered && !challenge.choices && <p className="small dim center tap-hint">Tap your answer on the figure</p>}
        {answered && (
          <>
            <RoundFeedback correct={correct} points={points} title={correct ? 'Correct' : picked === TIMEOUT ? "Time's up" : challenge.choices && picked !== null ? `Not quite — you said ${challenge.choices[picked]}` : 'Not quite'}>
              {challenge.explain}
            </RoundFeedback>
            <Button block size="lg" variant="accent" iconRight="chevron" onClick={next}>
              {index + 1 >= PE_ROUNDS ? 'See results' : 'Next'}
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
