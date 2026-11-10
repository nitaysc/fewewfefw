/* Sound: recorded piece and bell sounds, played from one decoded sprite through WebAudio.
   Takes are varied a little in pitch and level so repeated moves never sound identical. */
(function (g) {
  const RW = (g.RW = g.RW || {});
  const MAP = RW.SOUND_MAP || {};
  const AC = g.AudioContext || g.webkitAudioContext;
  const MOVES = ['move1', 'move2', 'move3', 'move4'];
  const CAPS = ['capture1', 'capture2', 'capture3'];
  let ctx = null, buf = null, master = null, state = 'idle', enabled = true;
  let bytes = null, pending = null;
  const last = {};

  /* Fetch the recordings early (no audio context needed yet) so the first tap can decode at once. */
  function preload() {
    if (!bytes) {
      bytes = fetch('sounds/sounds.wav').then((r) => { if (!r.ok) throw new Error('missing'); return r.arrayBuffer(); });
      bytes.catch(() => {});
    }
    return bytes;
  }
  // a sound asked for while the recordings were still decoding is played as soon as they are ready
  function flush() {
    const p = pending;
    pending = null;
    if (p && Date.now() - p.t < 700) play(p.ev, p.o);
  }

  function init() {
    if (ctx || !AC) { if (!AC) state = 'failed'; return; }
    try { ctx = new AC({ latencyHint: 'interactive' }); } catch (e) { try { ctx = new AC(); } catch (e2) { state = 'failed'; return; } }
    master = ctx.createGain();
    master.gain.value = 0.9;
    master.connect(ctx.destination);
    state = 'loading';
    preload()
      .then((ab) => new Promise((res, rej) => { const p = ctx.decodeAudioData(ab.slice(0), res, rej); if (p && p.catch) p.catch(rej); }))
      .then((b) => { buf = b; state = 'ready'; flush(); })
      .catch(() => { state = 'failed'; flush(); });
  }
  /* Call from a tap: browsers only let audio start after the first interaction. */
  function unlock() {
    init();
    if (ctx && ctx.state === 'suspended') ctx.resume().catch(() => {});
  }

  function clip(name, o) {
    const m = MAP[name];
    if (!m || !buf) return;
    const s = ctx.createBufferSource(), gn = ctx.createGain();
    s.buffer = buf;
    s.playbackRate.value = o.rate || 1;
    gn.gain.value = o.gain == null ? 1 : o.gain;
    s.connect(gn);
    gn.connect(master);
    s.start(ctx.currentTime + (o.delay || 0), m[0], m[1]);
  }
  const vary = (names, key) => {
    let n;
    do { n = names[Math.floor(Math.random() * names.length)]; } while (names.length > 1 && n === last[key]);
    last[key] = n;
    return n;
  };
  const jit = (c, spread) => c * (1 + (Math.random() * 2 - 1) * spread);

  // Last resort when the recordings cannot be loaded: a plain click so moves are not silent.
  function fallback(freq, dur, delay) {
    if (!ctx) return;
    try {
      const o = ctx.createOscillator(), gn = ctx.createGain(), t = ctx.currentTime + (delay || 0);
      o.type = 'triangle';
      o.frequency.setValueAtTime(freq, t);
      o.frequency.exponentialRampToValueAtTime(freq * 0.5, t + dur);
      gn.gain.setValueAtTime(0.25, t);
      gn.gain.exponentialRampToValueAtTime(0.001, t + dur);
      o.connect(gn);
      gn.connect(master);
      o.start(t);
      o.stop(t + dur);
    } catch (e) {}
  }

  const EV = {
    move(o) { clip(vary(MOVES, 'm'), { rate: jit(o.opponent ? 0.9 : 1, 0.03) * (o.firm ? 1.06 : 1), gain: jit(o.opponent ? 0.8 : 0.95, 0.07), delay: o.delay }); },
    capture(o) { clip(vary(CAPS, 'c'), { rate: jit(o.opponent ? 0.92 : 1, 0.03), gain: jit(1, 0.05), delay: o.delay }); },
    castle(o) { clip('castle', { rate: jit(o.opponent ? 0.92 : 1, 0.02), gain: 1, delay: o.delay }); },
    // a small bright ting on top of the piece sound
    check(o) { clip('ding1', { rate: 2, gain: 0.3, delay: (o.delay || 0) + 0.02 }); },
    promote(o) {
      clip('ding1', { rate: 1.5, gain: 0.3, delay: (o.delay || 0) + 0.07 });
      clip('ding1', { rate: 2.25, gain: 0.26, delay: (o.delay || 0) + 0.19 });
    },
    start() { clip('ding1', { rate: 1, gain: 0.55 }); },
    win() { clip('ding2', { rate: 1, gain: 0.55 }); clip('ding2', { rate: 1.5, gain: 0.5, delay: 0.17 }); },
    lose() { clip('ding3', { rate: 0.84, gain: 0.5 }); clip('ding3', { rate: 0.63, gain: 0.5, delay: 0.24 }); },
    draw() { clip('ding2', { rate: 1, gain: 0.5 }); clip('ding2', { rate: 1, gain: 0.42, delay: 0.22 }); },
    illegal() { clip('move3', { rate: 0.55, gain: 0.55 }); clip('move4', { rate: 0.5, gain: 0.45, delay: 0.1 }); },
    takeback() { clip(vary(MOVES, 'm'), { rate: 0.85, gain: 0.6 }); },
    tap() { clip('move3', { rate: 1.5, gain: 0.18 }); }
  };
  const FALLBACK = { move: [200, 0.07], capture: [150, 0.1], castle: [200, 0.07], check: [700, 0.1], promote: [600, 0.15], start: [520, 0.15], win: [660, 0.3], lose: [300, 0.3], draw: [440, 0.25], illegal: [110, 0.1], takeback: [170, 0.07] };

  function play(ev, o) {
    if (!enabled) return;
    unlock();
    if (state === 'ready') { if (EV[ev]) EV[ev](o || {}); }
    else if (state === 'loading') pending = { ev, o, t: Date.now() };
    else if (state === 'failed' && FALLBACK[ev]) fallback(FALLBACK[ev][0], FALLBACK[ev][1], o && o.delay);
  }

  /* The right sound for a chess move. chess is the position after the move. */
  function forMove(m, chess, o) {
    o = Object.assign({}, o);
    const check = chess.in_check();
    if (check) o.firm = true;
    if (m.flags.includes('k') || m.flags.includes('q')) play('castle', o);
    else if (m.captured) play('capture', o);
    else play('move', o);
    if (m.promotion) play('promote', o);
    if (check && !chess.in_checkmate()) play('check', o);
  }

  RW.Sound = {
    preload, unlock, play, forMove,
    setEnabled(v) { enabled = !!v; },
    get state() { return state; }
  };
})(typeof window !== 'undefined' ? window : globalThis);
