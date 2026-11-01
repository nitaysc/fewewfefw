// Tiny synthesised sound effects (no audio files).
let ctx = null, master = null;
export let muted = false;
try { muted = localStorage.getItem('ga-muted') === '1'; } catch {}

export function unlock() {
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = muted ? 0 : 0.5;
    master.connect(ctx.destination);
  }
  if (ctx.state === 'suspended') ctx.resume();
}

export function toggleMute() {
  muted = !muted;
  try { localStorage.setItem('ga-muted', muted ? '1' : '0'); } catch {}
  if (master) master.gain.value = muted ? 0 : 0.5;
  return muted;
}

let noiseBuf = null;
function noise() {
  if (!noiseBuf) {
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 0.6, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  const s = ctx.createBufferSource();
  s.buffer = noiseBuf;
  return s;
}

function burst({ freq = 1200, q = 0.8, dur = 0.12, vol = 0.6, type = 'lowpass', delay = 0 }) {
  if (!ctx) return;
  const t = ctx.currentTime + delay;
  const n = noise();
  const f = ctx.createBiquadFilter();
  f.type = type; f.frequency.value = freq; f.Q.value = q;
  const g = ctx.createGain();
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  n.connect(f); f.connect(g); g.connect(master);
  n.start(t); n.stop(t + dur + 0.02);
}

function tone({ freq = 440, to = freq, dur = 0.1, vol = 0.3, type = 'sine', delay = 0 }) {
  if (!ctx) return;
  const t = ctx.currentTime + delay;
  const o = ctx.createOscillator();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  o.frequency.exponentialRampToValueAtTime(Math.max(20, to), t + dur);
  const g = ctx.createGain();
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  o.connect(g); g.connect(master);
  o.start(t); o.stop(t + dur + 0.02);
}

export const sfx = {
  shot(w, far = false) {
    const v = far ? 0.25 : 0.6;
    if (w.rocket) { burst({ freq: 500, dur: 0.3, vol: v }); tone({ freq: 180, to: 60, dur: 0.25, vol: v * 0.5, type: 'sawtooth' }); }
    else if (w.pellets > 1) burst({ freq: 900, dur: 0.22, vol: v });
    else if (w.zoom) { burst({ freq: 2500, dur: 0.25, vol: v }); tone({ freq: 900, to: 200, dur: 0.15, vol: v * 0.3, type: 'square' }); }
    else if (w.rate < 0.2) burst({ freq: 2000, dur: 0.06, vol: v * 0.7 });
    else burst({ freq: 1600, dur: 0.1, vol: v });
  },
  hit(head) { tone({ freq: head ? 1500 : 1100, dur: 0.06, vol: 0.25, type: 'square' }); },
  hurt() { tone({ freq: 160, to: 90, dur: 0.15, vol: 0.4, type: 'sawtooth' }); },
  boom() { burst({ freq: 300, dur: 0.6, vol: 0.9 }); },
  reload() { tone({ freq: 500, dur: 0.04, vol: 0.15, type: 'square' }); tone({ freq: 700, dur: 0.04, vol: 0.15, type: 'square', delay: 0.12 }); },
  move() { tone({ freq: 220, to: 160, dur: 0.08, vol: 0.3, type: 'triangle' }); },
  select() { tone({ freq: 660, dur: 0.05, vol: 0.15 }); },
  duel() { [330, 440, 660].forEach((f, i) => tone({ freq: f, dur: 0.18, vol: 0.25, type: 'square', delay: i * 0.12 })); },
  count() { tone({ freq: 520, dur: 0.12, vol: 0.25, type: 'square' }); },
  go() { tone({ freq: 880, dur: 0.3, vol: 0.3, type: 'square' }); },
  win() { [523, 659, 784, 1046].forEach((f, i) => tone({ freq: f, dur: 0.2, vol: 0.25, type: 'triangle', delay: i * 0.1 })); },
  lose() { [392, 330, 262].forEach((f, i) => tone({ freq: f, dur: 0.25, vol: 0.25, type: 'triangle', delay: i * 0.14 })); },
};

export function buzz(ms = 20) {
  try {
    const H = window.Capacitor?.Plugins?.Haptics;
    if (H) H.impact({ style: ms > 40 ? 'HEAVY' : 'LIGHT' });
    else navigator.vibrate?.(ms);
  } catch {}
}
