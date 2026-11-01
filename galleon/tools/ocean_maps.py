"""Generates the ocean's small-scale textures.

- detail_normal.png: slopes of a tileable FFT ocean patch (Phillips spectrum), the
  fine chop layered over the big Gerstner swell in the shader.
- foam.png: tileable cellular noise that breaks foam into lacy streaks.

Run: python3 tools/ocean_maps.py
"""
import os
import numpy as np
from PIL import Image

OUT = os.path.join(os.path.dirname(__file__), '..', 'assets', 'ocean')
os.makedirs(OUT, exist_ok=True)
rng = np.random.default_rng(42)


def fft_patch(N=512, L=48.0, wind=(0.85, 0.53), V=9.0, g=9.81):
    k1 = 2 * np.pi * np.fft.fftfreq(N, L / N)
    kx, kz = np.meshgrid(k1, k1)
    k = np.sqrt(kx ** 2 + kz ** 2)
    k[0, 0] = 1e-6
    Lw = V * V / g
    w = np.array(wind) / np.linalg.norm(wind)
    cos = (kx * w[0] + kz * w[1]) / k
    P = np.exp(-1 / (k * Lw) ** 2) / k ** 4 * np.abs(cos) ** 3 * np.exp(-(k * 0.08) ** 2)
    P[0, 0] = 0
    h0 = (rng.normal(size=(N, N)) + 1j * rng.normal(size=(N, N))) * np.sqrt(P / 2)
    sx = np.real(np.fft.ifft2(1j * kx * h0))
    sz = np.real(np.fft.ifft2(1j * kz * h0))
    h = np.real(np.fft.ifft2(h0))
    return sx, sz, h


def main():
    sx, sz, h = fft_patch()
    s = max(np.abs(sx).max(), np.abs(sz).max())
    scale = 0.45 / np.percentile(np.abs(np.concatenate([sx.ravel(), sz.ravel()])), 99.5)
    r = np.clip(sx * scale * 0.5 + 0.5, 0, 1)
    g = np.clip(sz * scale * 0.5 + 0.5, 0, 1)
    hn = (h - h.min()) / (h.max() - h.min())
    img = np.stack([r, g, hn], -1)
    Image.fromarray((img * 255).astype(np.uint8), 'RGB').save(os.path.join(OUT, 'detail_normal.png'))

    # cellular foam
    S = 256
    yy, xx = np.mgrid[0:S, 0:S].astype(np.float32)

    def cells(n, edge):
        pts = rng.random((n, 2)) * S
        d1 = np.full((S, S), 1e9, np.float32); d2 = np.full((S, S), 1e9, np.float32)
        for px, py in pts:
            dx = np.abs(xx - px); dx = np.minimum(dx, S - dx)
            dy = np.abs(yy - py); dy = np.minimum(dy, S - dy)
            d = np.sqrt(dx * dx + dy * dy)
            nd2 = np.where(d < d1, d1, np.minimum(d2, d))
            d1 = np.minimum(d1, d); d2 = nd2
        return np.clip((d2 - d1) / edge, 0, 1)

    v = 1 - (0.65 * cells(90, 9) + 0.35 * cells(400, 4))
    Image.fromarray((v * 255).astype(np.uint8), 'L').save(os.path.join(OUT, 'foam.png'))
    print('ocean maps written', s)


main()
