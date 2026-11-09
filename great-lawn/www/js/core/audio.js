// Every sound is synthesised with Web Audio: the single-cylinder engine's putter, the
// blades and the crunch of long grass, gravel under the tyres, wind, blackbirds and rooks,
// gulps of ale, the hiss of a fresh bottle, drawing on the cigar and exhaling.
export class Audio {
  constructor() {
    this.ctx = null;
    this.volume = 0.8;
    this.ready = false;
  }

  start() {
    if (this.ctx) { this.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    const ctx = new AC();
    this.ctx = ctx;
    this.master = ctx.createGain();
    this.master.gain.value = this.volume;
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -14; comp.ratio.value = 3;
    this.master.connect(comp).connect(ctx.destination);
    this.noiseBuf = this.makeNoise(3);
    this.brownBuf = this.makeNoise(4, true);
    this.buildEngine();
    this.buildBlades();
    this.buildAmbience();
    this.buildGravel();
    this.ready = true;
    this.birdTimer = 2; this.rookTimer = 18;
  }
  setVolume(v) { this.volume = v; if (this.master) this.master.gain.setTargetAtTime(v, this.ctx.currentTime, 0.05); }
  suspend() { if (this.ctx) this.ctx.suspend(); }
  resume() { if (this.ctx) this.ctx.resume(); }

  makeNoise(seconds, brown = false) {
    const ctx = this.ctx, n = ctx.sampleRate * seconds;
    const buf = ctx.createBuffer(1, n, ctx.sampleRate), d = buf.getChannelData(0);
    let last = 0;
    for (let i = 0; i < n; i++) {
      const w = Math.random() * 2 - 1;
      if (brown) { last = (last + 0.02 * w) / 1.02; d[i] = last * 3.5; } else d[i] = w;
    }
    return buf;
  }
  noise(brown = false) {
    const s = this.ctx.createBufferSource();
    s.buffer = brown ? this.brownBuf : this.noiseBuf; s.loop = true;
    s.start(0, Math.random() * 2);
    return s;
  }

  // ---- continuous layers ----
  buildEngine() {
    const ctx = this.ctx;
    // firing pulses: a band-limited pulse train at the firing frequency
    const real = new Float32Array(32), imag = new Float32Array(32);
    for (let k = 1; k < 32; k++) { real[k] = 0; imag[k] = Math.pow(0.82, k) * (k % 2 ? 1 : 0.6); }
    const wave = ctx.createPeriodicWave(real, imag);
    const o1 = ctx.createOscillator(); o1.setPeriodicWave(wave);
    const o2 = ctx.createOscillator(); o2.type = 'sawtooth';
    const shaper = ctx.createWaveShaper();
    const curve = new Float32Array(1024);
    for (let i = 0; i < 1024; i++) { const x = (i / 1023) * 2 - 1; curve[i] = Math.tanh(x * 2.2); }
    shaper.curve = curve;
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 500; lp.Q.value = 2;
    const g1 = ctx.createGain(); g1.gain.value = 0.5;
    const g2 = ctx.createGain(); g2.gain.value = 0.12;
    // exhaust hiss chopped by the firing frequency
    const hiss = this.noise(); const hbp = ctx.createBiquadFilter(); hbp.type = 'bandpass'; hbp.frequency.value = 900; hbp.Q.value = 0.8;
    const am = ctx.createGain(); am.gain.value = 0;
    const amOsc = ctx.createOscillator(); amOsc.type = 'square';
    const amDepth = ctx.createGain(); amDepth.gain.value = 0.05;
    amOsc.connect(amDepth).connect(am.gain);
    hiss.connect(hbp).connect(am);
    const out = ctx.createGain(); out.gain.value = 0.0;
    o1.connect(g1).connect(shaper); o2.connect(g2).connect(shaper);
    shaper.connect(lp).connect(out); am.connect(out);
    out.connect(this.master);
    o1.start(); o2.start(); amOsc.start();
    this.eng = { o1, o2, lp, out, amOsc };
  }
  buildBlades() {
    const ctx = this.ctx;
    const whine = ctx.createOscillator(); whine.type = 'triangle'; whine.frequency.value = 180;
    const wg = ctx.createGain(); wg.gain.value = 0.0;
    const air = this.noise(); const abp = ctx.createBiquadFilter(); abp.type = 'bandpass'; abp.frequency.value = 1400; abp.Q.value = 0.6;
    const ag = ctx.createGain(); ag.gain.value = 0.0;
    const crunch = this.noise(); const chp = ctx.createBiquadFilter(); chp.type = 'highpass'; chp.frequency.value = 2200;
    const cg = ctx.createGain(); cg.gain.value = 0.0;
    const cmod = ctx.createOscillator(); cmod.type = 'sawtooth'; cmod.frequency.value = 23;
    const cmodG = ctx.createGain(); cmodG.gain.value = 0.0;
    cmod.connect(cmodG).connect(cg.gain);
    whine.connect(wg).connect(this.master);
    air.connect(abp).connect(ag).connect(this.master);
    crunch.connect(chp).connect(cg).connect(this.master);
    whine.start(); cmod.start();
    this.bl = { whine, wg, ag, cg, cmodG };
  }
  buildAmbience() {
    const ctx = this.ctx;
    const wind = this.noise(true); const wlp = ctx.createBiquadFilter(); wlp.type = 'lowpass'; wlp.frequency.value = 500;
    const wg = ctx.createGain(); wg.gain.value = 0.18;
    const lfo = ctx.createOscillator(); lfo.frequency.value = 0.07; const lg = ctx.createGain(); lg.gain.value = 0.1;
    lfo.connect(lg).connect(wg.gain);
    wind.connect(wlp).connect(wg).connect(this.master);
    lfo.start();
    // leaves in the trees
    const rustle = this.noise(); const rbp = ctx.createBiquadFilter(); rbp.type = 'bandpass'; rbp.frequency.value = 3200; rbp.Q.value = 0.5;
    const rg = ctx.createGain(); rg.gain.value = 0.012;
    const rl = ctx.createOscillator(); rl.frequency.value = 0.13; const rlg = ctx.createGain(); rlg.gain.value = 0.01;
    rl.connect(rlg).connect(rg.gain);
    rustle.connect(rbp).connect(rg).connect(this.master);
    rl.start();
  }
  buildGravel() {
    const ctx = this.ctx;
    const n = this.noise(); const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 3000; bp.Q.value = 0.7;
    const g = ctx.createGain(); g.gain.value = 0;
    const grain = ctx.createOscillator(); grain.type = 'square'; grain.frequency.value = 37;
    const gg = ctx.createGain(); gg.gain.value = 0;
    grain.connect(gg).connect(g.gain);
    n.connect(bp).connect(g).connect(this.master);
    grain.start();
    this.grav = { g, gg, grain };
  }

  // ---- one-shots ----
  env(node, t, a, peak, d, end = 0.0001) {
    node.gain.setValueAtTime(0.0001, t);
    node.gain.exponentialRampToValueAtTime(peak, t + a);
    node.gain.exponentialRampToValueAtTime(end, t + a + d);
  }
  burst({ type = 'bandpass', freq = 1000, q = 1, gain = 0.3, a = 0.005, d = 0.2, freqEnd, delay = 0, pan = 0 }) {
    const ctx = this.ctx, t = ctx.currentTime + delay;
    const s = ctx.createBufferSource(); s.buffer = this.noiseBuf;
    const f = ctx.createBiquadFilter(); f.type = type; f.frequency.setValueAtTime(freq, t); f.Q.value = q;
    if (freqEnd) f.frequency.exponentialRampToValueAtTime(freqEnd, t + a + d);
    const g = ctx.createGain(); this.env(g, t, a, gain, d);
    const p = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
    if (p) { p.pan.value = pan; s.connect(f).connect(g).connect(p).connect(this.master); } else s.connect(f).connect(g).connect(this.master);
    s.start(t, Math.random() * 2); s.stop(t + a + d + 0.05);
  }
  tone({ type = 'sine', freq = 440, freqEnd, gain = 0.2, a = 0.005, d = 0.2, delay = 0, pan = 0 }) {
    const ctx = this.ctx, t = ctx.currentTime + delay;
    const o = ctx.createOscillator(); o.type = type; o.frequency.setValueAtTime(freq, t);
    if (freqEnd) o.frequency.exponentialRampToValueAtTime(freqEnd, t + a + d);
    const g = ctx.createGain(); this.env(g, t, a, gain, d);
    const p = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
    if (p) { p.pan.value = pan; o.connect(g).connect(p).connect(this.master); } else o.connect(g).connect(this.master);
    o.start(t); o.stop(t + a + d + 0.05);
  }
  gulp() {
    this.tone({ freq: 170, freqEnd: 70, gain: 0.35, a: 0.01, d: 0.16 });
    this.burst({ type: 'lowpass', freq: 500, freqEnd: 180, gain: 0.25, a: 0.02, d: 0.22, delay: 0.05 });
    this.tone({ freq: 340 + Math.random() * 120, freqEnd: 900, gain: 0.04, a: 0.01, d: 0.07, delay: 0.12 }); // a bubble back up the neck
  }
  opened() {
    this.tone({ type: 'square', freq: 2400, freqEnd: 1800, gain: 0.05, a: 0.001, d: 0.03 });
    this.burst({ type: 'highpass', freq: 3000, gain: 0.3, a: 0.003, d: 0.55, freqEnd: 6000, delay: 0.02 });
    this.tone({ freq: 3300, gain: 0.05, a: 0.001, d: 0.25, delay: 0.45, pan: -0.4 }); // the cap lands somewhere
    this.tone({ freq: 2900, gain: 0.03, a: 0.001, d: 0.2, delay: 0.58, pan: -0.5 });
  }
  clink() { this.tone({ freq: 2600, gain: 0.06, a: 0.001, d: 0.3, pan: -0.3 }); this.tone({ freq: 4100, gain: 0.03, a: 0.001, d: 0.2, pan: -0.3 }); }
  draw() { this.burst({ type: 'lowpass', freq: 700, gain: 0.05, a: 0.05, d: 0.25 }); if (Math.random() < 0.5) this.burst({ type: 'highpass', freq: 5000, gain: 0.03, a: 0.001, d: 0.02 }); }
  exhale(amount) { this.burst({ type: 'bandpass', freq: 600, freqEnd: 1100, q: 0.5, gain: 0.08 + amount * 0.1, a: 0.12, d: 1.1 }); }
  ash() { this.tone({ type: 'triangle', freq: 1200, gain: 0.04, a: 0.001, d: 0.05 }); }
  lit() { this.burst({ type: 'bandpass', freq: 2500, gain: 0.25, a: 0.002, d: 0.35, freqEnd: 900 }); this.burst({ type: 'lowpass', freq: 600, gain: 0.08, a: 0.1, d: 0.8, delay: 0.3 }); }
  bump(s) { this.tone({ freq: 90, freqEnd: 45, gain: 0.35 * s + 0.1, a: 0.005, d: 0.25 }); this.burst({ type: 'lowpass', freq: 900, gain: 0.2 * s, a: 0.003, d: 0.2 }); }
  lever(on) { this.tone({ type: 'square', freq: on ? 160 : 120, freqEnd: 60, gain: 0.08, a: 0.002, d: 0.08 }); this.burst({ type: 'bandpass', freq: 1800, gain: 0.12, a: 0.002, d: 0.06 }); }
  ui() { this.tone({ freq: 660, gain: 0.04, a: 0.003, d: 0.08 }); }
  bird() {
    // a blackbird-ish phrase: a few gliding whistles, panned somewhere in the trees
    const pan = Math.random() * 1.6 - 0.8, base = 1600 + Math.random() * 1400;
    const n = 3 + Math.floor(Math.random() * 5);
    let t = 0;
    for (let i = 0; i < n; i++) {
      const f0 = base * (0.8 + Math.random() * 0.6), f1 = f0 * (Math.random() < 0.5 ? 1.3 : 0.75);
      const d = 0.06 + Math.random() * 0.14;
      this.tone({ freq: f0, freqEnd: f1, gain: 0.012 + Math.random() * 0.015, a: 0.01, d, delay: t, pan });
      t += d + 0.03 + Math.random() * 0.08;
    }
  }
  rook() {
    const pan = Math.random() * 2 - 1;
    for (let i = 0; i < 2 + Math.floor(Math.random() * 3); i++) {
      this.burst({ type: 'bandpass', freq: 700 + Math.random() * 150, q: 3, gain: 0.03, a: 0.02, d: 0.22, delay: i * 0.45, pan });
      this.tone({ type: 'sawtooth', freq: 420, freqEnd: 330, gain: 0.006, a: 0.02, d: 0.2, delay: i * 0.45, pan });
    }
  }

  // ---- per frame ----
  update(dt, s) {
    if (!this.ready) return;
    const t = this.ctx.currentTime;
    const rpm = s.rpm;
    const fire = rpm / 120;            // single cylinder, four stroke
    const e = this.eng;
    e.o1.frequency.setTargetAtTime(fire, t, 0.05);
    e.o2.frequency.setTargetAtTime(fire * 2, t, 0.05);
    e.amOsc.frequency.setTargetAtTime(fire, t, 0.05);
    e.lp.frequency.setTargetAtTime(380 + rpm * 0.22 + s.load * 300, t, 0.08);
    e.out.gain.setTargetAtTime(s.paused ? 0 : 0.2 + 0.18 * Math.abs(s.throttle) + s.load * 0.12, t, 0.1);
    const b = this.bl, on = s.bladesOn && !s.paused ? 1 : 0;
    b.whine.frequency.setTargetAtTime(150 + rpm * 0.07, t, 0.2);
    b.wg.gain.setTargetAtTime(on * 0.035, t, 0.4);
    b.ag.gain.setTargetAtTime(on * 0.06, t, 0.4);
    b.cmodG.gain.setTargetAtTime(on * s.load * 0.22, t, 0.08);
    const g = this.grav, gr = s.surface === 'gravel' && !s.paused ? Math.min(1, Math.abs(s.speed) / 3) : 0;
    g.gg.gain.setTargetAtTime(gr * 0.18, t, 0.1);
    g.grain.frequency.setTargetAtTime(20 + Math.abs(s.speed) * 12, t, 0.1);
    if (!s.paused) {
      this.birdTimer -= dt; this.rookTimer -= dt;
      if (this.birdTimer < 0) { this.bird(); this.birdTimer = 1.5 + Math.random() * 6; }
      if (this.rookTimer < 0) { this.rook(); this.rookTimer = 25 + Math.random() * 40; }
    }
  }
}
