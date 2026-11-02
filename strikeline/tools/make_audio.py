#!/usr/bin/env python3
"""Synthesizes every sound effect and both music loops for Strikeline into ../sfx.

Pure numpy, deterministic (fixed seed). Run: python3 tools/make_audio.py
"""
import os
import wave

import numpy as np

SR = 44100
MSR = 32000
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "sfx")
rng = np.random.default_rng(1234)


def t_(d, sr=SR):
    return np.arange(int(d * sr)) / sr


def env(n, a=0.002, d=0.1, sr=SR, curve=4.0):
    t = np.arange(n) / sr
    e = np.minimum(1.0, t / max(a, 1e-5)) * np.exp(-curve * np.maximum(0, t - a) / max(d, 1e-5))
    return e


def lowpass(x, cutoff, sr=SR, taps=101):
    fc = cutoff / sr
    n = np.arange(taps) - (taps - 1) / 2
    h = np.sinc(2 * fc * n) * np.hamming(taps)
    h /= h.sum()
    return np.convolve(x, h, mode="same")


def highpass(x, cutoff, sr=SR):
    return x - lowpass(x, cutoff, sr)


def bandpass(x, lo, hi, sr=SR):
    return lowpass(highpass(x, lo, sr), hi, sr)


def chirp(f0, f1, d, sr=SR, shape=1.0):
    t = t_(d, sr)
    u = (t / d) ** shape
    f = f0 + (f1 - f0) * u
    ph = 2 * np.pi * np.cumsum(f) / sr
    return np.sin(ph)


def noise(d, sr=SR):
    return rng.uniform(-1, 1, int(d * sr))


def sweep_noise(d, f0, f1, q=0.5, sr=SR, steps=24):
    """Noise through a band that moves from f0 to f1 (piecewise)."""
    n = int(d * sr)
    out = np.zeros(n)
    x = noise(d + 0.05, sr)
    seg = n // steps + 1
    for i in range(steps):
        a, b = i * seg, min(n, (i + 1) * seg)
        if a >= n:
            break
        fc = f0 + (f1 - f0) * (i / (steps - 1))
        lo, hi = fc * (1 - q), fc * (1 + q)
        chunk = bandpass(x[max(0, a - 200):b + 200], lo, min(hi, sr / 2 - 100), sr)
        out[a:b] = chunk[(a - max(0, a - 200)):(a - max(0, a - 200)) + (b - a)]
    return out


def soft_clip(x, drive=1.0):
    return np.tanh(x * drive) / np.tanh(drive)


def pad(x, d, sr=SR):
    n = int(d * sr)
    if len(x) < n:
        x = np.concatenate([x, np.zeros(n - len(x))])
    return x[:n]


def mix(*parts):
    n = max(len(p) for p in parts)
    out = np.zeros(n)
    for p in parts:
        out[:len(p)] += p
    return out


def echo(x, delay, fb, n=4, sr=SR):
    d = int(delay * sr)
    out = np.concatenate([x, np.zeros(d * n)])
    for i in range(1, n + 1):
        out[i * d:i * d + len(x)] += x * (fb ** i)
    return out


def reverb(x, sr=SR, mixv=0.25):
    taps = [(0.029, 0.5), (0.037, 0.45), (0.051, 0.38), (0.067, 0.3), (0.089, 0.24), (0.113, 0.18), (0.149, 0.12)]
    out = np.concatenate([x, np.zeros(int(0.5 * sr))])
    wet = np.zeros_like(out)
    for d, g in taps:
        k = int(d * sr)
        wet[k:k + len(x)] += x * g
    wet = lowpass(wet, 5000, sr)
    return out + wet * mixv * 2


def norm(x, peak=0.9):
    m = np.max(np.abs(x)) + 1e-9
    return x / m * peak


def save(name, x, sr=SR, peak=0.9):
    x = norm(x, peak)
    fade = min(len(x), int(0.004 * sr))
    x[-fade:] *= np.linspace(1, 0, fade)
    data = (np.clip(x, -1, 1) * 32767).astype(np.int16)
    with wave.open(os.path.join(OUT, name + ".wav"), "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(sr)
        w.writeframes(data.tobytes())


# ------------------------------------------------------------------ effects
def thump(f0, f1, d, drive=1.5):
    x = chirp(f0, f1, d, shape=0.4) * env(int(d * SR), 0.001, d * 0.35)
    return soft_clip(x, drive)


def crack(d, lo=800, hi=6000, decay=0.05):
    return bandpass(noise(d), lo, hi) * env(int(d * SR), 0.0005, decay)


def hit(level):
    if level == 0:
        return mix(thump(220, 90, 0.08) * 0.9, crack(0.05, 1200, 7000, 0.02) * 0.7)
    if level == 1:
        return mix(thump(180, 60, 0.14, 2.0), crack(0.09, 900, 7000, 0.03) * 0.8, crack(0.12, 200, 1200, 0.05) * 0.5)
    if level == 2:
        body = mix(thump(150, 40, 0.3, 3.0), crack(0.16, 600, 8000, 0.045), crack(0.25, 100, 900, 0.09) * 0.8)
        return reverb(soft_clip(body * 1.4, 1.6), mixv=0.15)
    body = mix(thump(140, 32, 0.45, 3.5), crack(0.2, 500, 9000, 0.06) * 1.1, crack(0.3, 80, 700, 0.12))
    ring = (np.sin(2 * np.pi * 1900 * t_(0.6)) + 0.6 * np.sin(2 * np.pi * 2870 * t_(0.6))) * env(int(0.6 * SR), 0.001, 0.25) * 0.25
    return reverb(mix(soft_clip(body * 1.5, 2.0), ring), mixv=0.3)


def swing(d, f0, f1, vol=1.0):
    x = sweep_noise(d, f0, f1, 0.45)
    e = np.sin(np.pi * np.clip(t_(d) / d, 0, 1)) ** 1.5
    return x * e * vol


def make_effects():
    save("hit_l", hit(0))
    save("hit_m", hit(1))
    save("hit_h", hit(2))
    save("hit_crit", hit(3))
    save("swing_l", swing(0.09, 1800, 4200))
    save("swing_m", swing(0.14, 1200, 4500))
    save("swing_h", mix(swing(0.24, 600, 3800), thump(90, 60, 0.2, 1.0) * 0.15))
    save("jump", mix(chirp(260, 620, 0.09) * env(int(0.09 * SR), 0.003, 0.05) * 0.5, swing(0.1, 800, 2500) * 0.6), peak=0.6)
    save("djump", mix(chirp(420, 980, 0.12) * env(int(0.12 * SR), 0.003, 0.07) * 0.5, swing(0.14, 1500, 5000) * 0.6), peak=0.6)
    save("land", mix(thump(120, 60, 0.07, 1.0), crack(0.05, 200, 2000, 0.02) * 0.4), peak=0.55)
    save("land_heavy", mix(thump(110, 40, 0.18, 2.0), crack(0.12, 150, 2500, 0.05) * 0.6), peak=0.8)
    save("shield_up", chirp(300, 520, 0.12) * env(int(0.12 * SR), 0.01, 0.06) * 0.4, peak=0.45)
    tt = t_(0.18)
    metal = np.sin(2 * np.pi * 1200 * tt + 3 * np.sin(2 * np.pi * 1730 * tt)) * env(len(tt), 0.0005, 0.05)
    save("shield_hit", mix(metal, crack(0.06, 2000, 9000, 0.015) * 0.6), peak=0.7)
    shatter = np.zeros(int(0.9 * SR))
    for i in range(18):
        st = int(rng.uniform(0, 0.35) * SR)
        f = rng.uniform(2000, 6000)
        d = rng.uniform(0.08, 0.3)
        tone = np.sin(2 * np.pi * f * t_(d)) * env(int(d * SR), 0.0005, d * 0.3) * rng.uniform(0.2, 0.5)
        shatter[st:st + len(tone)] += tone
    shatter = mix(shatter, crack(0.4, 1500, 10000, 0.12), thump(200, 50, 0.3, 2.0) * 0.6)
    save("shield_break", reverb(shatter, mixv=0.3))
    save("dodge", swing(0.12, 2500, 6000, 0.8), peak=0.5)
    save("ledge", mix(crack(0.04, 1000, 5000, 0.01), thump(300, 200, 0.04, 1.0) * 0.4), peak=0.5)
    # KO: huge boom with a rising whistle and an echo
    boom = mix(thump(90, 25, 1.4, 4.0), crack(1.0, 60, 3000, 0.35) * 1.2, crack(0.3, 2000, 10000, 0.08) * 0.5)
    whistle = chirp(600, 2400, 0.35, shape=2.0) * env(int(0.35 * SR), 0.2, 0.05) * 0.25
    ko = mix(np.concatenate([np.zeros(int(0.0 * SR)), soft_clip(boom * 1.3, 2.0)]), whistle)
    save("ko", reverb(echo(ko, 0.18, 0.35, 3), mixv=0.35))
    save("beep", np.sign(np.sin(2 * np.pi * 880 * t_(0.16))) * env(int(0.16 * SR), 0.002, 0.08) * 0.4 + np.sin(2 * np.pi * 880 * t_(0.16)) * env(int(0.16 * SR), 0.002, 0.08) * 0.4, peak=0.55)
    tt = t_(0.7)
    go = sum(np.sign(np.sin(2 * np.pi * f * tt)) * 0.25 + np.sin(2 * np.pi * f * tt) * 0.4 for f in [660, 880, 1320]) * env(len(tt), 0.003, 0.3)
    save("go", reverb(mix(lowpass(go, 6000), thump(140, 50, 0.3, 2.0) * 0.6), mixv=0.3), peak=0.8)
    tt = t_(1.3)
    stab = sum(np.sin(2 * np.pi * f * tt) + 0.5 * np.sin(2 * np.pi * 2 * f * tt) + 0.25 * np.sin(2 * np.pi * 3 * f * tt) for f in [220, 277.2, 329.6, 440]) * env(len(tt), 0.005, 0.5)
    save("game", reverb(mix(stab * 0.5, thump(100, 30, 0.8, 3.0), crack(0.5, 100, 4000, 0.15) * 0.6), mixv=0.4))
    save("dash", mix(swing(0.2, 3000, 800, 1.0), thump(150, 80, 0.1, 1.0) * 0.3), peak=0.65)
    tt = t_(0.5)
    ch = chirp(200, 700, 0.5) * (0.6 + 0.4 * np.sin(2 * np.pi * 18 * tt)) * env(len(tt), 0.05, 0.4, curve=1.5)
    save("charge", ch, peak=0.4)
    tt = t_(0.7)
    clang = (np.sin(2 * np.pi * 950 * tt + 4 * np.sin(2 * np.pi * 1410 * tt)) + 0.5 * np.sin(2 * np.pi * 2520 * tt)) * env(len(tt), 0.0005, 0.2)
    save("counter", reverb(mix(clang, crack(0.1, 2000, 10000, 0.02), swing(0.25, 4000, 1000) * 0.6), mixv=0.4))
    tt = t_(0.35)
    save("counter_ready", np.sin(2 * np.pi * 2400 * tt + 2 * np.sin(2 * np.pi * 3100 * tt)) * env(len(tt), 0.01, 0.12) * 0.5, peak=0.4)
    th = np.zeros(int(0.2 * SR))
    for i in range(3):
        s = swing(0.07, 3000, 7000, 0.7)
        st = int(i * 0.035 * SR)
        th[st:st + len(s)] += s
    save("throw", th, peak=0.5)
    tt = t_(0.35)
    orb = np.sin(2 * np.pi * (300 + 120 * np.sin(2 * np.pi * 9 * tt)) * tt) * env(len(tt), 0.01, 0.2) + chirp(800, 300, 0.35) * env(len(tt), 0.001, 0.1) * 0.4
    save("orb", lowpass(orb, 3000), peak=0.6)
    tt = t_(0.22)
    saw = 2 * ((tt * 140 + 0.3 * rng.standard_normal(len(tt)).cumsum() * 0.001) % 1.0) - 1
    zap = mix(saw * env(len(tt), 0.001, 0.12) * 0.7, bandpass(noise(0.22), 2000, 9000) * env(len(tt), 0.001, 0.05) * 0.8)
    save("zap", soft_clip(zap, 2.0), peak=0.6)
    tt = t_(0.7)
    jet = lowpass(noise(0.7), 1400) * np.minimum(1, tt / 0.05) * np.exp(-tt * 2.5) + chirp(120, 260, 0.7) * 0.2 * np.exp(-tt * 2)
    save("jet", jet, peak=0.6)
    v = swing(0.3, 500, 6000)
    save("vanish", mix(v, chirp(1500, 3000, 0.3) * env(int(0.3 * SR), 0.2, 0.05) * 0.2), peak=0.6)
    save("slam", reverb(mix(thump(80, 28, 0.6, 4.0), crack(0.4, 60, 2500, 0.15), crack(0.1, 2000, 8000, 0.03) * 0.5), mixv=0.25))
    save("bounce", mix(thump(160, 70, 0.1, 1.5), crack(0.06, 300, 3000, 0.02) * 0.5), peak=0.6)
    save("tech", mix(chirp(800, 1600, 0.08) * env(int(0.08 * SR), 0.001, 0.04), crack(0.04, 2000, 8000, 0.01) * 0.5), peak=0.5)
    tt = t_(0.9)
    shim = sum(np.sin(2 * np.pi * f * tt) * env(len(tt), 0.05 + i * 0.05, 0.4, curve=2.0) for i, f in enumerate([660, 990, 1320, 1760]))
    save("respawn", reverb(shim * 0.3, mixv=0.4), peak=0.5)
    tt = t_(0.05)
    save("ui_move", np.sin(2 * np.pi * 1400 * tt) * env(len(tt), 0.001, 0.02), peak=0.35)
    tt = t_(0.14)
    ok = np.concatenate([np.sin(2 * np.pi * 988 * t_(0.06)) * env(int(0.06 * SR), 0.001, 0.04),
                         np.sin(2 * np.pi * 1480 * t_(0.09)) * env(int(0.09 * SR), 0.001, 0.05)])
    save("ui_ok", ok, peak=0.45)
    back = np.concatenate([np.sin(2 * np.pi * 1200 * t_(0.06)) * env(int(0.06 * SR), 0.001, 0.04),
                           np.sin(2 * np.pi * 800 * t_(0.09)) * env(int(0.09 * SR), 0.001, 0.05)])
    save("ui_back", back, peak=0.45)
    # --- smash systems ---
    save("grab", mix(crack(0.06, 300, 3000, 0.02), thump(200, 120, 0.08, 1.2) * 0.6), peak=0.6)
    tt = t_(0.9)
    save("core_spawn", reverb(sum(np.sin(2 * np.pi * f * tt) * env(len(tt), 0.02 + i * 0.08, 0.35, curve=2.5) for i, f in enumerate([523, 659, 784, 1047])) * 0.3, mixv=0.5), peak=0.55)
    tt = t_(0.25)
    save("core_hit", mix(np.sin(2 * np.pi * 1568 * tt + 2 * np.sin(2 * np.pi * 2200 * tt)) * env(len(tt), 0.001, 0.08), thump(180, 90, 0.1, 1.5) * 0.6), peak=0.6)
    tt = t_(1.4)
    arp = np.zeros(len(tt))
    for i, f in enumerate([523, 659, 784, 1047, 1319, 1568]):
        st = int(i * 0.06 * SR)
        tone = np.sin(2 * np.pi * f * t_(0.5)) * env(int(0.5 * SR), 0.002, 0.2)
        arp[st:st + len(tone)] += tone * 0.4
    save("core_break", reverb(mix(arp, crack(0.3, 2000, 10000, 0.08) * 0.6, thump(120, 40, 0.4, 2.0) * 0.6), mixv=0.4), peak=0.8)
    save("explosion", reverb(mix(thump(70, 25, 0.9, 4.0), crack(0.8, 50, 4000, 0.25) * 1.3, crack(0.2, 2000, 9000, 0.05) * 0.5), mixv=0.3), peak=0.9)
    save("pickup", np.concatenate([np.sin(2 * np.pi * 660 * t_(0.05)) * env(int(0.05 * SR), 0.001, 0.03), np.sin(2 * np.pi * 990 * t_(0.07)) * env(int(0.07 * SR), 0.001, 0.04)]), peak=0.45)
    tt = t_(0.5)
    save("eat", reverb(sum(np.sin(2 * np.pi * f * tt) * env(len(tt), 0.01 + i * 0.07, 0.2, curve=2.0) for i, f in enumerate([784, 988, 1175, 1568])) * 0.3, mixv=0.3), peak=0.5)
    tt = t_(0.6)
    save("parry", reverb(mix(np.sin(2 * np.pi * 2093 * tt + 1.5 * np.sin(2 * np.pi * 3000 * tt)) * env(len(tt), 0.0005, 0.18), crack(0.05, 3000, 10000, 0.01)), mixv=0.5), peak=0.7)
    tt = t_(1.2)
    star = chirp(1400, 2600, 1.2, shape=0.5) * env(len(tt), 0.01, 0.5, curve=2.0) * 0.4 + np.sin(2 * np.pi * 3136 * tt) * env(len(tt), 0.9, 0.2) * 0.4
    save("star", reverb(star, mixv=0.4), peak=0.55)
    tt = t_(0.06)
    save("tick", np.sin(2 * np.pi * 1760 * tt) * env(len(tt), 0.001, 0.02), peak=0.4)
    tt = t_(1.6)
    rise = sweep_noise(1.2, 300, 6000, 0.4) * np.linspace(0.2, 1, int(1.2 * SR))
    chord = sum(np.sin(2 * np.pi * f * tt) for f in [196, 247, 294, 392]) * env(len(tt), 0.8, 0.5, curve=2.0) * 0.3
    save("fs_start", reverb(mix(rise * 0.7, chord, np.concatenate([np.zeros(int(1.15 * SR)), thump(120, 35, 0.45, 3.0)])), mixv=0.4), peak=0.9)


# ------------------------------------------------------------------ music
NOTE = {"C": 0, "C#": 1, "D": 2, "D#": 3, "E": 4, "F": 5, "F#": 6, "G": 7, "G#": 8, "A": 9, "A#": 10, "B": 11}


def hz(n):
    return 440.0 * 2 ** ((n - 69) / 12)


def additive(f, d, harmonics=12, bright=1.0, sr=MSR, square=False, detune=0.0):
    t = t_(d, sr)
    out = np.zeros(len(t))
    for k in range(1, harmonics + 1):
        if square and k % 2 == 0:
            continue
        fk = f * k
        if fk > sr / 2 - 500:
            break
        amp = (1.0 / k) * np.exp(-(k - 1) * (1.0 - bright) * 0.6)
        out += amp * np.sin(2 * np.pi * fk * t * (1 + detune))
    return out


def place(buf, x, at):
    a = int(at)
    if a >= len(buf):
        return
    b = min(len(buf), a + len(x))
    buf[a:b] += x[:b - a]


def drum_kick(sr=MSR):
    d = 0.32
    x = chirp(160, 42, d, sr, shape=0.25) * env(int(d * sr), 0.001, 0.18, sr)
    return soft_clip(x * 1.5, 2.0)


def drum_snare(sr=MSR):
    d = 0.22
    tone = np.sin(2 * np.pi * 190 * t_(d, sr)) * env(int(d * sr), 0.001, 0.05, sr) * 0.5
    nz = bandpass(noise(d, sr), 1200, 9000, sr) * env(int(d * sr), 0.001, 0.09, sr)
    return tone + nz


def drum_hat(open_=False, sr=MSR):
    d = 0.18 if open_ else 0.05
    return highpass(noise(d, sr), 7000, sr) * env(int(d * sr), 0.0005, d * 0.4, sr) * 0.5


def make_track(name, bpm, bars, chords, style):
    sr = MSR
    beat = 60.0 / bpm
    total = bars * 4 * beat
    n = int(total * sr)
    drums = np.zeros(n)
    bass = np.zeros(n)
    synth = np.zeros(n)
    padb = np.zeros(n)
    kick, snare, hat, ohat = drum_kick(), drum_snare(), drum_hat(), drum_hat(True)
    for bar in range(bars):
        root, quality = chords[bar % len(chords)]
        rn = NOTE[root]
        third = 3 if quality == "m" else 4
        tones = [rn, rn + third, rn + 7, rn + 12]
        b0 = bar * 4 * beat
        section = bar // 4
        # drums
        for q in range(4):
            tq = b0 + q * beat
            if style == "battle":
                place(drums, kick, tq * sr)
                if q in (1, 3):
                    place(drums, snare * 0.8, tq * sr)
                for e in range(4 if section >= 1 else 2):
                    sub = beat / (4 if section >= 1 else 2)
                    place(drums, (ohat if e == 2 and section >= 2 else hat) * (0.7 if e % 2 else 1.0), (tq + e * sub) * sr)
            else:
                if q in (0, 2) or (q == 3 and bar % 2 == 1):
                    place(drums, kick * 0.7, tq * sr)
                if q in (1, 3):
                    place(drums, snare * 0.4, tq * sr)
                place(drums, hat * 0.6, (tq + beat / 2) * sr)
        if style == "battle" and bar % 4 == 3:
            for k in range(4):
                place(drums, snare * (0.4 + k * 0.15), (b0 + 3 * beat + k * beat / 4) * sr)
        # bass: driving 8ths for battle, half notes for menu
        if style == "battle":
            pattern = [0, 0, 12, 0, 0, 12, 0, 7]
            for e in range(8):
                f = hz(36 + rn + pattern[e])
                d = beat / 2 * 0.9
                x = additive(f, d, 10, 0.7, sr) * env(int(d * sr), 0.004, d * 0.8, sr, curve=2.0)
                place(bass, x, (b0 + e * beat / 2) * sr)
        else:
            for e in range(2):
                f = hz(36 + rn)
                d = beat * 2 * 0.95
                x = additive(f, d, 6, 0.4, sr) * env(int(d * sr), 0.01, d * 0.9, sr, curve=1.5)
                place(bass, x, (b0 + e * 2 * beat) * sr)
        # pad
        d = 4 * beat
        chord = np.zeros(int(d * sr))
        for k, tn in enumerate(tones[:3]):
            f = hz(60 + tn)
            chord += additive(f, d, 6, 0.3, sr, detune=0.003) + additive(f, d, 6, 0.3, sr, detune=-0.004)
        att = np.minimum(1, t_(d, sr) / 0.3) * np.minimum(1, (d - t_(d, sr)) / 0.2)
        place(padb, chord * att * 0.12, b0 * sr)
        # arp
        steps = 16 if style == "battle" else 8
        if style == "battle" and section == 0 and bar < 2:
            steps = 0
        order = [0, 1, 2, 3, 2, 1, 2, 3] if style == "battle" else [0, 2, 1, 3]
        for e in range(steps):
            tn = tones[order[e % len(order)]] + (12 if (style == "battle" and section >= 2 and e % 8 >= 4) else 0)
            f = hz(72 + tn)
            dd = (4 * beat / steps) * 0.8
            x = additive(f, dd, 7, 0.8, sr, square=True) * env(int(dd * sr), 0.002, dd * 0.4, sr)
            place(synth, x * (0.32 if style == "battle" else 0.25), (b0 + e * 4 * beat / steps) * sr)
        # lead melody in the second half of the battle loop
        if style == "battle" and section >= 2:
            mel = [tones[3], tones[2], tones[3] + 2, tones[1] + 12]
            for e, tn in enumerate(mel):
                f = hz(72 + tn)
                dd = beat * 0.95
                vib = 1 + 0.004 * np.sin(2 * np.pi * 5.5 * t_(dd, sr))
                x = additive(f, dd, 9, 0.9, sr) * vib * env(int(dd * sr), 0.01, dd * 0.9, sr, curve=1.5)
                place(synth, x * 0.28, (b0 + e * beat) * sr)
    synth = lowpass(synth, 7000, sr)
    bass = lowpass(bass, 1800, sr)
    out = drums * (0.85 if style == "battle" else 0.6) + bass * 0.75 + synth + padb
    # wrap the reverb tail to the loop start so the loop is seamless
    wet = reverb(synth * 0.6 + padb * 0.5, sr, mixv=0.25)
    tail = wet[n:]
    wet = wet[:n]
    wet[:len(tail)] += tail
    out = out + (wet - (synth * 0.6 + padb * 0.5)) * 0.8
    out = soft_clip(out * 0.9, 1.3)
    save("music_" + name, out, sr, peak=0.85)


def main():
    os.makedirs(OUT, exist_ok=True)
    make_effects()
    make_track("battle", 142, 16, [("A", "m"), ("F", ""), ("C", ""), ("G", "")], "battle")
    make_track("menu", 96, 8, [("D", "m"), ("A#", ""), ("F", ""), ("C", "")], "menu")
    print("done:", len(os.listdir(OUT)), "files")


if __name__ == "__main__":
    main()
