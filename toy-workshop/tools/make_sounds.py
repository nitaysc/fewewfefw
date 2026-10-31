# Makes the game's sound effects and music loop as WAV files (python3 make_sounds.py).
import numpy as np, wave, os
SR = 22050
OUT = os.path.join(os.path.dirname(__file__), '..', 'sfx')
os.makedirs(OUT, exist_ok=True)
rng = np.random.default_rng(7)

def t(sec): return np.arange(int(SR * sec)) / SR
def env(n, a=0.004, d=0.2):
    x = np.arange(n) / SR
    return np.minimum(1, x / max(a, 1e-4)) * np.exp(-x / d)
def bell(f, sec, d=0.25, h=(1, 0.5, 0.25)):
    x = t(sec); s = sum(a * np.sin(2 * np.pi * f * (i + 1) * x) * np.exp(-x * i * 3) for i, a in enumerate(h))
    return s * env(len(x), 0.003, d)
def write(name, s, gain=0.5):
    s = s / (np.abs(s).max() + 1e-9) * gain
    w = wave.open(os.path.join(OUT, name + '.wav'), 'wb'); w.setnchannels(1); w.setsampwidth(2); w.setframerate(SR)
    w.writeframes((np.clip(s, -1, 1) * 32767).astype('<i2').tobytes()); w.close()
def mix(*parts):
    n = max(len(p) + o for p, o in parts); out = np.zeros(n)
    for p, o in parts: out[o:o + len(p)] += p
    return out
def sweep(f0, f1, sec, d):
    x = t(sec); f = f0 + (f1 - f0) * x / sec
    return np.sin(2 * np.pi * np.cumsum(f) / SR) * env(len(x), 0.003, d)

write('click', bell(1400, 0.06, 0.015, (1, 0.2)), 0.35)
write('pop', sweep(380, 980, 0.09, 0.05), 0.45)
x = t(0.18)
write('place', mix((np.sin(2 * np.pi * 120 * x) * env(len(x), 0.002, 0.06), 0), (rng.normal(0, 1, len(x)) * env(len(x), 0.001, 0.02) * 0.4, 0), (bell(720, 0.12, 0.04), 0)), 0.6)
write('remove', sweep(520, 160, 0.18, 0.08), 0.45)
write('coin', mix((bell(1318, 0.3, 0.08), 0), (bell(1760, 0.45, 0.16), int(SR * 0.07))), 0.42)
write('ding', mix((bell(1046, 0.6, 0.3), 0), (bell(1318, 0.6, 0.3), int(SR * 0.09)), (bell(1568, 0.9, 0.45), int(SR * 0.18))), 0.5)
write('levelup', mix(*[(bell(f, 1.0, 0.45), int(SR * 0.1 * i)) for i, f in enumerate([523, 659, 784, 1046, 1318, 1568])]), 0.5)
write('error', mix((sweep(220, 180, 0.12, 0.05), 0), (sweep(200, 160, 0.12, 0.05), int(SR * 0.13))), 0.35)
x = t(0.35); noise = rng.normal(0, 1, len(x)); noise = np.convolve(noise, np.ones(30) / 30, 'same')
write('whoosh', noise * np.sin(np.pi * x / x[-1]) ** 2, 0.35)
x = t(0.22); n2 = np.convolve(rng.normal(0, 1, len(x)), np.ones(6) / 6, 'same')
write('saw', n2 * env(len(x), 0.01, 0.08) + 0.3 * np.sin(2 * np.pi * 330 * x) * env(len(x), 0.01, 0.06), 0.18)
write('tap', bell(560, 0.08, 0.03, (1, 0.6)), 0.3)
x = t(0.07); write('step', np.convolve(rng.normal(0, 1, len(x)), np.ones(12) / 12, 'same') * env(len(x), 0.002, 0.02) + 0.4 * np.sin(2 * np.pi * 90 * x) * env(len(x), 0.002, 0.02), 0.25)

# music: a gentle 16-bar loop (C - Am - F - G), electric piano chords, soft bass, a marimba tune
BPM = 96; beat = 60 / BPM; bars = 16; L = int(SR * beat * 4 * bars)
song = np.zeros(L + SR * 3)
def note(f, at, dur, kind):
    o = int(at * SR); x = t(dur)
    if kind == 'ep': s = (np.sin(2 * np.pi * f * x) + 0.25 * np.sin(4 * np.pi * f * x)) * env(len(x), 0.01, 0.9) * 0.16
    elif kind == 'bass': s = (np.sin(2 * np.pi * f * x) + 0.15 * np.sin(4 * np.pi * f * x)) * env(len(x), 0.005, 0.35) * 0.32
    elif kind == 'mar': s = (np.sin(2 * np.pi * f * x) + 0.3 * np.sin(2 * np.pi * f * 4 * x) * np.exp(-x * 30)) * env(len(x), 0.002, 0.25) * 0.2
    else: s = np.convolve(rng.normal(0, 1, len(x)), np.ones(3) / 3, 'same') * env(len(x), 0.002, 0.02) * 0.03
    song[o:o + len(s)] += s
hz = lambda m: 440 * 2 ** ((m - 69) / 12)
chords = [[60, 64, 67, 71], [57, 60, 64, 67], [53, 57, 60, 64], [55, 59, 62, 65]]
roots = [36, 33, 41, 43]
scale = [72, 74, 76, 79, 81, 84, 86, 88]
for bar in range(bars):
    c = chords[(bar // 2) % 4]; r = roots[(bar // 2) % 4]; b0 = bar * 4 * beat
    for k, m in enumerate(c): note(hz(m), b0 + k * 0.02, beat * 3.6, 'ep')
    note(hz(r), b0, beat * 1.5, 'bass'); note(hz(r + 7), b0 + beat * 2, beat * 1.2, 'bass'); note(hz(r), b0 + beat * 3, beat * 0.9, 'bass')
    for s8 in range(8): note(0, b0 + s8 * beat / 2, 0.06, 'sh')
    if bar % 8 >= 2:
        for s8 in range(8):
            if rng.random() < 0.45:
                m = rng.choice([x for x in scale if (x % 12) in [(y % 12) for y in c] or rng.random() < 0.2])
                note(hz(m), b0 + s8 * beat / 2, beat, 'mar')
tail = song[L:].copy(); song = song[:L]; song[:len(tail)] += tail
write('music', song, 0.32)
print('sounds made')
