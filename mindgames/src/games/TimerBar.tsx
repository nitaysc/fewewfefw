import type { CSSProperties } from 'react';

/** A draining bar. Pure CSS so it stays smooth while the puzzle animates. */
export function TimerBar({ roundKey, ms, running }: { roundKey: number; ms: number; running: boolean }) {
  return (
    <div className="timer essential-motion" aria-hidden="true">
      <div key={roundKey} className="timer-fill" style={{ animationDuration: `${ms}ms`, animationPlayState: running ? 'running' : 'paused' } as CSSProperties} />
    </div>
  );
}
