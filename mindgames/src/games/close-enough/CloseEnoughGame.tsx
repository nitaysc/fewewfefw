import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import { useStore } from '../../app/store';
import { Icon } from '../../components/Icon';
import { Button, CountUp, Pill } from '../../components/ui';
import { haptic } from '../../services/haptics';
import { sfx } from '../../services/sfx';
import type { PlayProps } from '../play';
import { CE_MAX_POINTS, CE_ROUNDS, dailyQuestions, formatNumber, magnitudeHint, MAX_DIGITS, practiceQuestions, scoreGuess, type GuessScore } from './logic';

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '000', '0', 'del'] as const;

function verdict(s: GuessScore): string {
  if (s.exact) return 'Dead on';
  if (s.perfect) return 'Bullseye';
  if (s.points >= 150) return 'So close';
  if (s.points >= 80) return 'In the ballpark';
  if (s.points > 0) return 'Not far off';
  return 'Way off';
}

/** Where a guess sits on a ½× … 2× scale centred on the answer (0..1). */
function trackPosition(guess: number, answer: number): number {
  if (guess <= 0) return 0;
  const t = Math.log2(guess / answer);
  return Math.min(1, Math.max(0, (t + 1) / 2));
}

export function CloseEnoughGame({ seed, mode, done, onRoundStart, onRound, onComplete, avoid }: PlayProps) {
  const store = useStore();
  const questions = useMemo(() => (mode === 'daily' ? dailyQuestions(seed) : practiceQuestions(seed, avoid)), [seed, mode, avoid]);
  const [index, setIndex] = useState(Math.min(done.length, CE_ROUNDS - 1));
  const [entry, setEntry] = useState('');
  const [scored, setScored] = useState<{ guess: number; score: GuessScore } | null>(null);
  const question = questions[index];
  const guess = entry ? Number(entry) : NaN;

  useEffect(() => {
    onRoundStart();
  }, [index, onRoundStart]);

  // remember practice questions so the next run feels fresh
  useEffect(() => {
    if (mode !== 'practice') return;
    const ids = questions.map((q) => q.id);
    store.update((d) => ({ ...d, recentQuestions: [...d.recentQuestions.filter((id) => !ids.includes(id)), ...ids].slice(-60) }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [questions, mode]);

  const press = (key: (typeof KEYS)[number]) => {
    if (scored) return;
    haptic.tap();
    sfx.tap();
    setEntry((prev) => {
      if (key === 'del') return prev.slice(0, -1);
      if (prev === '' && (key === '0' || key === '000')) return '0';
      if (prev === '0') return key === '000' ? '0' : key;
      return (prev + key).slice(0, MAX_DIGITS);
    });
  };

  const submit = () => {
    if (scored || !entry) return;
    const score = scoreGuess(guess, question);
    setScored({ guess, score });
    onRound({ points: score.points, max: CE_MAX_POINTS, correct: score.points > 0, accuracy: score.accuracy });
    if (score.points >= 80) {
      haptic.success();
      sfx.correct();
    } else if (score.points > 0) {
      haptic.press();
      sfx.reveal();
    } else {
      haptic.error();
      sfx.wrong();
    }
  };

  const next = () => {
    if (index + 1 >= CE_ROUNDS) onComplete();
    else {
      setIndex(index + 1);
      setEntry('');
      setScored(null);
    }
  };

  const digits = entry.length;
  const size = digits > 10 ? 40 : digits > 7 ? 52 : 68;

  return (
    <div className="play ce" key={index}>
      <div className="ce-question rise">
        <div className="row gap-2">
          <Pill tone="accent">{question.category}</Pill>
          <span className="eyebrow">
            Question {index + 1} of {CE_ROUNDS}
          </span>
        </div>
        <h1 className="ce-text">{question.text}</h1>
      </div>

      {!scored ? (
        <>
          <div className="ce-entry">
            <div className={`ce-number display ${entry ? '' : 'empty'}`} style={{ fontSize: size }} aria-live="polite">
              {entry ? formatNumber(guess) : '0'}
              <span className="ce-caret" />
            </div>
            <span className="small muted ce-hint">{entry ? [magnitudeHint(guess), question.unit].filter(Boolean).join(' · ') || ' ' : `Your best guess${question.unit ? ` in ${question.unit}` : ''}`}</span>
          </div>
          <div className="ce-pad">
            <div className="keypad">
              {KEYS.map((k) => (
                <button key={k} type="button" className={`key ${k === 'del' ? 'key-del' : ''}`} onPointerDown={(e) => { e.preventDefault(); press(k); }} aria-label={k === 'del' ? 'Delete' : k}>
                  {k === 'del' ? <Icon name="delete" size={24} /> : <span className="display">{k}</span>}
                </button>
              ))}
            </div>
            <Button block size="lg" variant="accent" disabled={!entry} onClick={submit}>
              Lock it in
            </Button>
          </div>
        </>
      ) : (
        <div className="ce-reveal">
          <div className="stack center gap-1 rise">
            <span className="eyebrow">The answer</span>
            <span className="display ce-answer">
              <CountUp value={question.answer} from={Math.round(question.answer * 0.6)} duration={800} />
            </span>
            {question.unit && <span className="muted">{question.unit}</span>}
          </div>

          <div className="ce-track rise" style={{ '--i': 1 } as CSSProperties}>
            <div className="ce-track-line">
              <span className="ce-track-zone" />
              <span className="ce-track-mid" />
              <span className={`ce-track-you ${scored.score.points > 0 ? '' : 'off'}`} style={{ '--x': trackPosition(scored.guess, question.answer) } as CSSProperties}>
                <i>You</i>
              </span>
            </div>
            <div className="row between small dim">
              <span>half</span>
              <span>exact</span>
              <span>double</span>
            </div>
          </div>

          <div className="ce-stats rise" style={{ '--i': 2 } as CSSProperties}>
            <div>
              <span className="display d-sm">{formatNumber(scored.guess)}</span>
              <span className="eyebrow">Your guess</span>
            </div>
            <div>
              <span className="display d-sm">
                {scored.score.diff === 0 ? '0' : `${scored.score.diff > 0 ? '+' : '−'}${formatNumber(Math.abs(scored.score.diff))}`}
              </span>
              <span className="eyebrow">Off by</span>
            </div>
            <div>
              <span className="display d-sm">{(Math.floor(scored.score.accuracy * 1000) / 10).toFixed(scored.score.accuracy === 1 || scored.score.accuracy === 0 ? 0 : 1)}%</span>
              <span className="eyebrow">Accuracy</span>
            </div>
          </div>

          <div className={`ce-points rise ${scored.score.points > 0 ? 'ok' : 'bad'}`} style={{ '--i': 3 } as CSSProperties}>
            <div className="stack">
              <b>{verdict(scored.score)}</b>
              {question.note && <span className="small muted">{question.note}</span>}
            </div>
            <span className="display d-lg">
              +<CountUp value={scored.score.points} duration={700} delay={350} />
            </span>
          </div>

          <div className="play-foot">
            <Button block size="lg" variant="accent" iconRight="chevron" onClick={next}>
              {index + 1 >= CE_ROUNDS ? 'See results' : 'Next question'}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
