// Little synthesized sounds: engines, chimes, crunches. No audio files.
let ctx = null, master = null, noiseBuf = null;
let muted = false;
try { muted = localStorage.getItem('sr-muted') === '1'; } catch { /* private mode */ }

export function unlock() {
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = muted ? 0 : 0.7;
    master.connect(ctx.destination);
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  if (ctx.state === 'suspended') ctx.resume();
}

export const isMuted = () => muted;
export function setMuted(m) {
  muted = m;
  try { localStorage.setItem('sr-muted', m ? '1' : '0'); } catch { /* ignore */ }
  if (master) master.gain.value = m ? 0 : 0.7;
}

function tone(freq, dur, { type = 'sine', vol = 0.3, at = 0, slide = 0 } = {}) {
  if (!ctx) return;
  const t = ctx.currentTime + at;
  const o = ctx.createOscillator(), g = ctx.createGain();
  o.type = type; o.frequency.setValueAtTime(freq, t);
  if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, freq * slide), t + dur);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(master);
  o.start(t); o.stop(t + dur + 0.05);
}

function noise(dur, { vol = 0.3, freq = 1200, q = 1, at = 0, type = 'bandpass' } = {}) {
  if (!ctx) return;
  const t = ctx.currentTime + at;
  const s = ctx.createBufferSource(); s.buffer = noiseBuf;
  const f = ctx.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q;
  const g = ctx.createGain();
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  s.connect(f).connect(g).connect(master);
  s.start(t, Math.random() * 0.5); s.stop(t + dur + 0.05);
}

export const sfx = {
  pick(big) { tone(880, 0.12, { vol: 0.25, type: 'triangle' }); tone(1320, 0.18, { vol: 0.22, type: 'triangle', at: 0.06 }); if (big) tone(1760, 0.3, { vol: 0.2, type: 'triangle', at: 0.13 }); },
  lose() { tone(500, 0.25, { vol: 0.2, type: 'square', slide: 0.5 }); },
  bump(f) { noise(0.15, { vol: Math.min(0.5, f * 0.02), freq: 500, q: 0.8 }); },
  ram() { noise(0.35, { vol: 0.6, freq: 300, q: 0.6 }); tone(90, 0.3, { vol: 0.5, type: 'sine', slide: 0.5 }); },
  wall(f) { noise(0.12, { vol: Math.min(0.4, f * 0.015), freq: 700, q: 1 }); },
  land(f) { noise(0.1, { vol: Math.min(0.35, f * 0.02), freq: 250, q: 0.8 }); },
  pad() { noise(0.5, { vol: 0.25, freq: 2500, q: 0.5, type: 'highpass' }); tone(300, 0.4, { vol: 0.12, type: 'sawtooth', slide: 3 }); },
  beep(hi) { tone(hi ? 1046 : 523, hi ? 0.45 : 0.18, { vol: 0.25, type: 'square' }); },
  big() { [660, 880, 1100].forEach((f, i) => tone(f, 0.2, { vol: 0.18, type: 'triangle', at: i * 0.08 })); },
  win() { [523, 659, 784, 1046].forEach((f, i) => tone(f, 0.35, { vol: 0.22, type: 'triangle', at: i * 0.13 })); },
  sad() { [392, 349, 311].forEach((f, i) => tone(f, 0.4, { vol: 0.2, type: 'triangle', at: i * 0.18 })); },
  click() { tone(600, 0.05, { vol: 0.12, type: 'square' }); },
};

// one engine per car this phone drives
export class Engine {
  constructor() {
    if (!ctx) return;
    this.o1 = ctx.createOscillator(); this.o1.type = 'sawtooth';
    this.o2 = ctx.createOscillator(); this.o2.type = 'square';
    this.f = ctx.createBiquadFilter(); this.f.type = 'lowpass'; this.f.frequency.value = 600;
    this.g = ctx.createGain(); this.g.gain.value = 0;
    this.o1.connect(this.f); this.o2.connect(this.f); this.f.connect(this.g).connect(master);
    this.o1.start(); this.o2.start();
    // tyre squeal
    this.sq = ctx.createBufferSource(); this.sq.buffer = noiseBuf; this.sq.loop = true;
    this.sf = ctx.createBiquadFilter(); this.sf.type = 'bandpass'; this.sf.frequency.value = 2800; this.sf.Q.value = 6;
    this.sg = ctx.createGain(); this.sg.gain.value = 0;
    this.sq.connect(this.sf).connect(this.sg).connect(master);
    this.sq.start();
  }
  set(speed, throttle, drifting, boosting, vol = 1) {
    if (!this.o1) return;
    const t = ctx.currentTime;
    const gear = (speed % 14) / 14;
    const f = 55 + speed * 2.2 + gear * 30 + (boosting ? 40 : 0);
    this.o1.frequency.setTargetAtTime(f, t, 0.05);
    this.o2.frequency.setTargetAtTime(f * 0.5, t, 0.05);
    this.f.frequency.setTargetAtTime(400 + Math.abs(throttle) * 900 + speed * 15, t, 0.05);
    this.g.gain.setTargetAtTime((0.05 + Math.min(1, speed / 40) * 0.05 + Math.abs(throttle) * 0.03) * vol, t, 0.08);
    this.sg.gain.setTargetAtTime(drifting ? 0.06 * vol : 0, t, 0.05);
  }
  stop() {
    if (!this.o1) return;
    const t = ctx.currentTime;
    this.g.gain.setTargetAtTime(0, t, 0.05); this.sg.gain.setTargetAtTime(0, t, 0.05);
    setTimeout(() => { try { this.o1.stop(); this.o2.stop(); this.sq.stop(); } catch { /* already stopped */ } }, 300);
  }
}
