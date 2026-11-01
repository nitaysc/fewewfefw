"""Synthesises seamless ambience loops: surf (sea_loop.wav) and wind (wind_loop.wav).

Run: python3 tools/make_audio.py
"""
import os
import wave
import numpy as np

SR = 22050
SECS = 16
OUT = os.path.join(os.path.dirname(__file__), '..', 'assets', 'audio')
os.makedirs(OUT, exist_ok=True)
rng = np.random.default_rng(3)
N = SR * SECS


def lowpass(x, cutoff):
    """FFT brick-wall-ish low pass (circular, so loops stay seamless)."""
    X = np.fft.rfft(x)
    f = np.fft.rfftfreq(len(x), 1 / SR)
    X *= 1 / (1 + (f / cutoff) ** 4)
    return np.fft.irfft(X, len(x))


def bandpass(x, lo, hi):
    X = np.fft.rfft(x)
    f = np.fft.rfftfreq(len(x), 1 / SR)
    X *= (1 / (1 + (lo / np.maximum(f, 1)) ** 4)) * (1 / (1 + (f / hi) ** 4))
    return np.fft.irfft(X, len(x))


def periodic_env(k_list):
    t = np.arange(N) / N
    e = np.zeros(N)
    for k, a, ph in k_list:  # integer cycles per loop -> seamless
        e += a * np.sin(2 * np.pi * k * t + ph)
    return e


def save(name, x):
    x = x / np.max(np.abs(x)) * 0.8
    with wave.open(os.path.join(OUT, name), 'wb') as w:
        w.setnchannels(1); w.setsampwidth(2); w.setframerate(SR)
        w.writeframes((x * 32767).astype(np.int16).tobytes())


# sea: deep rumble + hiss of breaking crests, swelling with each wave
white = rng.normal(size=N)
rumble = lowpass(white, 160)
hiss = bandpass(rng.normal(size=N), 500, 5000)
waves = np.clip(0.55 + periodic_env([(2, 0.25, 0.3), (3, 0.18, 1.9), (5, 0.12, 4.1), (7, 0.08, 2.2)]), 0.1, 1)
splash = np.clip(periodic_env([(4, 1, 0.0), (6, 0.7, 1.0), (9, 0.5, 2.0)]), 0, None) ** 3
sea = rumble * 1.4 * waves + hiss * (0.25 + 0.9 * splash) * waves
save('sea_loop.wav', sea)

# wind: band-passed noise whose pitch and strength gust
gust = np.clip(0.6 + periodic_env([(1, 0.25, 0.5), (3, 0.15, 2.0), (5, 0.08, 4.4)]), 0.2, 1)
w1 = bandpass(rng.normal(size=N), 250, 900)
w2 = bandpass(rng.normal(size=N), 900, 2600)
wind = w1 * gust + w2 * gust ** 2 * 0.5
save('wind_loop.wav', wind)

# ---- one-shots for the guns (not looped) ----
def env_exp(n, tau, attack=0.002):
    t = np.arange(n) / SR
    return (1 - np.exp(-t / attack)) * np.exp(-t / tau)


def filt(x, lo, hi):
    X = np.fft.rfft(x)
    f = np.fft.rfftfreq(len(x), 1 / SR)
    if lo:
        X *= 1 / (1 + (lo / np.maximum(f, 1)) ** 4)
    X *= 1 / (1 + (f / hi) ** 4)
    return np.fft.irfft(X, len(x))


def cannon(far=False):
    n = int(SR * (4.5 if far else 3.5))
    t = np.arange(n) / SR
    crack = filt(rng.normal(size=n), 300, 6000) * env_exp(n, 0.035, 0.0005)
    body = filt(rng.normal(size=n), 0, 260) * env_exp(n, 0.45, 0.004) * 3.0
    thump = np.sin(2 * np.pi * (38 + 30 * np.exp(-t / 0.08)) * t) * env_exp(n, 0.25, 0.003) * 1.4
    # rolling echo off the sea and the other ships
    rumble = filt(rng.normal(size=n), 0, 140) * env_exp(n, 1.3, 0.25) * 1.6
    x = crack * (0.15 if far else 1.0) + body + thump + rumble
    if far:
        x = filt(x, 0, 500)
    return x


def splash():
    n = int(SR * 2.2)
    t = np.arange(n) / SR
    plop = np.sin(2 * np.pi * (180 * np.exp(-t / 0.05) + 60) * t) * env_exp(n, 0.06, 0.002)
    hiss = filt(rng.normal(size=n), 800, 7000) * env_exp(n, 0.25, 0.01) * 0.6
    rain = filt(rng.normal(size=n), 1500, 9000) * np.clip((t - 0.5) / 0.2, 0, 1) * np.exp(-np.maximum(t - 0.7, 0) / 0.4) * 0.35
    body = filt(rng.normal(size=n), 0, 400) * env_exp(n, 0.15, 0.003)
    return plop + hiss + rain + body


def impact():
    n = int(SR * 1.6)
    t = np.arange(n) / SR
    crunch = filt(rng.normal(size=n), 150, 3500) * env_exp(n, 0.08, 0.001) * 1.5
    knock = sum(np.sin(2 * np.pi * f * t) * env_exp(n, d, 0.001) for f, d in [(95, 0.12), (170, 0.08), (310, 0.05)])
    debris = filt(rng.normal(size=n), 2000, 8000) * (rng.random(n) < 0.004) * 30 * np.exp(-t / 0.35)
    return crunch + knock + filt(debris, 1500, 8000) * 0.5


def save_once(name, x):
    x = x / np.max(np.abs(x)) * 0.9
    fade = min(len(x), int(SR * 0.05))
    x[-fade:] *= np.linspace(1, 0, fade)
    with wave.open(os.path.join(OUT, name), 'wb') as w:
        w.setnchannels(1); w.setsampwidth(2); w.setframerate(SR)
        w.writeframes((x * 32767).astype(np.int16).tobytes())


save_once('cannon.wav', cannon())
save_once('cannon_far.wav', cannon(True))
save_once('splash.wav', splash())
save_once('impact.wav', impact())
print('audio written to', os.path.abspath(OUT))
