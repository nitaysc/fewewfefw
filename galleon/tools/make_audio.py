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
print('audio written to', os.path.abspath(OUT))
