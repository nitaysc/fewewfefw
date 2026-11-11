/** Tiny synthesised UI sounds — no audio files to load. */
let enabled = true;
let ctx: AudioContext | null = null;

export const setSoundEnabled = (on: boolean) => {
  enabled = on;
};

function audio(): AudioContext | null {
  if (!enabled) return null;
  try {
    ctx ??= new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    if (ctx.state === 'suspended') void ctx.resume();
    return ctx;
  } catch {
    return null;
  }
}

function tone(freq: number, start: number, dur: number, gain = 0.05, type: OscillatorType = 'sine') {
  const ac = audio();
  if (!ac) return;
  const t0 = ac.currentTime + start;
  const osc = ac.createOscillator();
  const g = ac.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(gain, t0 + 0.012);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.connect(g).connect(ac.destination);
  osc.start(t0);
  osc.stop(t0 + dur + 0.02);
}

export const sfx = {
  tap: () => tone(520, 0, 0.05, 0.025, 'triangle'),
  correct: () => {
    tone(660, 0, 0.12);
    tone(990, 0.08, 0.18);
  },
  wrong: () => {
    tone(220, 0, 0.16, 0.05, 'triangle');
    tone(165, 0.09, 0.2, 0.05, 'triangle');
  },
  reveal: () => tone(440, 0, 0.2, 0.035),
  finish: () => {
    [523, 659, 784, 1047].forEach((f, i) => tone(f, i * 0.09, 0.26, 0.045));
  },
};
