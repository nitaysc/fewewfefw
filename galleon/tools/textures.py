"""Paints the galleon's textures (colour, normal and roughness maps) with numpy.

Run: python3 tools/textures.py   (writes assets/ship/tex/*.png)
"""
import os
import numpy as np
from PIL import Image

OUT = os.path.join(os.path.dirname(__file__), '..', 'assets', 'ship', 'tex')
os.makedirs(OUT, exist_ok=True)
rng = np.random.default_rng(7)

# hull UV: u along the ship, v = height between these two levels (must match build_galleon.py)
HULL_Y0, HULL_Y1 = -3.4, 9.8


def noise(h, w, cells_y, cells_x, octaves=5, seed=None):
    """Tileable fractal value noise in [0, 1]."""
    r = np.random.default_rng(seed if seed is not None else rng.integers(1 << 30))
    out = np.zeros((h, w), np.float32)
    amp, tot = 1.0, 0.0
    cy, cx = cells_y, cells_x
    for _ in range(octaves):
        g = r.random((cy, cx)).astype(np.float32)
        g = np.pad(g, ((0, 1), (0, 1)), mode='wrap')
        img = Image.fromarray((g * 65535).astype(np.uint16).astype(np.int32), mode='I')
        big = np.asarray(img.resize((w + w // cx, h + h // cy), Image.BICUBIC), np.float32) / 65535
        out += amp * big[:h, :w]
        tot += amp
        amp *= 0.5
        cy *= 2; cx *= 2
    return np.clip(out / tot, 0, 1)


def save(name, arr):
    arr = np.clip(arr, 0, 1)
    if arr.ndim == 2:
        Image.fromarray((arr * 255).astype(np.uint8), 'L').save(os.path.join(OUT, name))
    else:
        Image.fromarray((arr * 255).astype(np.uint8), 'RGB').save(os.path.join(OUT, name))


def normal_from_height(h, strength):
    dx = (np.roll(h, -1, 1) - np.roll(h, 1, 1)) * strength
    dy = (np.roll(h, -1, 0) - np.roll(h, 1, 0)) * strength
    n = np.stack([-dx, dy, np.ones_like(h)], -1)
    n /= np.linalg.norm(n, axis=-1, keepdims=True)
    return n * 0.5 + 0.5


def hex_rgb(h):
    h = h.lstrip('#')
    return np.array([int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)], np.float32)


def planks(W, H, plank_px, rows_horizontal=True, base='#a8743c', var=0.12, seed=1):
    """Wood planking: colour, height and roughness arrays."""
    r = np.random.default_rng(seed)
    col = np.zeros((H, W, 3), np.float32)
    height = np.ones((H, W), np.float32)
    grain = noise(H, W, 64, 4, 4) if not rows_horizontal else noise(H, W, 4, 64, 4)
    grain_fine = noise(H, W, 256, 8, 3) if not rows_horizontal else noise(H, W, 8, 256, 3)
    b = hex_rgb(base)
    n_rows = int(np.ceil((H if rows_horizontal else W) / plank_px))
    for i in range(n_rows):
        a0, a1 = i * plank_px, min((i + 1) * plank_px, H if rows_horizontal else W)
        pos = -r.integers(0, 400)
        length_axis = W if rows_horizontal else H
        while pos < length_axis:
            ln = int(r.integers(250, 650))
            p0, p1 = max(pos, 0), min(pos + ln, length_axis)
            tint = b * (1 + r.normal(0, var * 0.12, 3)) * (1 + r.normal(0, var))
            if rows_horizontal:
                col[a0:a1, p0:p1] = tint
                height[a0:a1, max(p0, 0):max(p0, 0) + 2] = 0.3  # butt joint
            else:
                col[p0:p1, a0:a1] = tint
                height[max(p0, 0):max(p0, 0) + 2, a0:a1] = 0.3
            pos += ln
        # seam and slight rounding of each plank
        t = np.linspace(0, 1, a1 - a0)[:, None] if rows_horizontal else np.linspace(0, 1, a1 - a0)[None, :]
        bulge = 1 - 0.25 * (2 * t - 1) ** 4
        if rows_horizontal:
            height[a0:a1] *= bulge
            height[a0:a0 + 2] = 0.0
            col[a0:a0 + 2] *= 0.35
        else:
            height[:, a0:a1] *= bulge
            height[:, a0:a0 + 2] = 0.0
            col[:, a0:a0 + 2] *= 0.35
    col *= (0.82 + 0.3 * grain[..., None]) * (0.9 + 0.15 * grain_fine[..., None])
    height += (grain_fine - 0.5) * 0.15
    rough = 0.72 + 0.18 * grain_fine
    return col, height, rough


def hull():
    W, H = 2048, 1024
    ppm = H / (HULL_Y1 - HULL_Y0)
    row = lambda y: int((1 - (y - HULL_Y0) / (HULL_Y1 - HULL_Y0)) * H)
    col, height, rough = planks(W, H, int(0.24 * ppm), True, '#b07a40', 0.10, seed=3)

    # darker, weathered wood toward the waterline; sun-bleached near the top
    yy = np.linspace(HULL_Y1, HULL_Y0, H)[:, None]
    col *= (0.78 + 0.22 * np.clip((yy - 0.0) / 4.0, 0, 1))[..., None]
    # water streaks running down from the scuppers and gunports
    streak = noise(H, W, 6, 220, 3)
    col *= (1 - 0.18 * np.clip((streak - 0.55) * 4, 0, 1) * (yy < 3.2))[..., None]

    def band(y0, y1, c, h=1.15, r=None):
        a, b = row(y1), row(y0)
        col[a:b] = hex_rgb(c) * (0.85 + 0.2 * noise(b - a, W, 2, 120, 3)[..., None])
        height[a:b] = h + 0.08 * noise(b - a, W, 2, 200, 2)
        if r is not None:
            rough[a:b] = r

    # tarred bottom with weed at the waterline
    a = row(-0.2)
    col[a:] = hex_rgb('#2a1f17') * (0.8 + 0.4 * noise(H - a, W, 8, 120, 4)[..., None])
    weed = noise(H - a, W, 6, 300, 3)
    col[a:] = col[a:] * (1 - 0.5 * weed[..., None]) + hex_rgb('#33402a') * 0.35 * weed[..., None] * (yy[a:] > -1.2)[..., None]
    rough[a:] = 0.55

    # painted decoration: deep red strakes with gold fillets
    for y0, y1 in [(3.4, 3.95), (5.6, 6.1), (7.95, 8.45)]:
        band(y0, y1, '#8d2416', 1.1, 0.5)
        band(y1, y1 + 0.07, '#d4a24a', 1.2, 0.35)
        band(y0 - 0.07, y0, '#d4a24a', 1.2, 0.35)
        # carved panels
        a, b = row(y1 - 0.09), row(y0 + 0.09)
        for x in range(8, W, 30):
            col[a:b, x:x + 20] *= 0.62
            height[a:b, x:x + 20] -= 0.12
    # wales (the thick strakes are geometry too; this darkens around them)
    for y0, y1 in [(0.35, 0.65), (1.05, 1.32), (2.6, 2.9)]:
        band(y0, y1, '#3b2516', 1.2)

    # gunports
    from build_constants import GUNPORTS_U
    for u in GUNPORTS_U:
        x = int(u * W)
        a, b = row(2.3), row(1.5)
        col[a - 5:b + 5, x - 21:x + 21] = hex_rgb('#8d2416')
        height[a - 5:b + 5, x - 21:x + 21] = 1.2
        col[a:b, x - 15:x + 15] = hex_rgb('#0c0806')
        height[a:b, x - 15:x + 15] = 0.0

    save('hull_albedo.png', col)
    save('hull_normal.png', normal_from_height(height, 2.5))


def deck():
    W = H = 1024
    col, height, rough = planks(W, H, 64, False, '#a08a6a', 0.09, seed=11)
    # caulking dots and wear
    wear = noise(H, W, 8, 8, 5)
    col *= (0.85 + 0.25 * wear[..., None])
    save('deck_albedo.png', col)
    save('deck_normal.png', normal_from_height(height, 2.0))


def dark_wood():
    W = H = 512
    g = noise(H, W, 2, 48, 5)
    f = noise(H, W, 4, 160, 3)
    col = hex_rgb('#4a3020') * (0.7 + 0.5 * g[..., None]) * (0.85 + 0.25 * f[..., None])
    save('wood_albedo.png', col)
    save('wood_normal.png', normal_from_height(g * 0.5 + f * 0.5, 1.5))


def sail():
    W = H = 1024
    base = hex_rgb('#eee7d4')
    col = np.ones((H, W, 3), np.float32) * base
    height = np.ones((H, W), np.float32)
    weave = noise(H, W, 256, 256, 2)
    panels = 12
    pw = W // panels
    for i in range(panels):
        col[:, i * pw:(i + 1) * pw] *= 1 + rng.normal(0, 0.025)
        col[:, i * pw:i * pw + 3] *= 0.8
        height[:, i * pw:i * pw + 3] = 0.6
    for y in (0.18, 0.33):
        a = int(y * H)
        col[a:a + 7] *= 0.82
        height[a:a + 7] = 1.3
        for x in range(10, W, 40):
            col[a - 2:a + 9, x:x + 4] *= 0.6  # reef points
    dirt = noise(H, W, 4, 4, 5)
    v = np.linspace(0, 1, H)[:, None]
    col *= (1 - 0.12 * dirt[..., None] - 0.08 * (v ** 3)[..., None])
    col *= (0.96 + 0.06 * weave[..., None])
    # patches
    for _ in range(7):
        x, y = rng.integers(0, W - 120), rng.integers(80, H - 160)
        w, h = rng.integers(50, 110), rng.integers(60, 150)
        col[y:y + h, x:x + w] *= 1 + rng.normal(0, 0.04)
        col[y:y + 2, x:x + w] *= 0.8
    # bolt rope
    col[:8] *= 0.7; col[-8:] *= 0.7; col[:, :8] *= 0.7; col[:, -8:] *= 0.7
    save('sail_albedo.png', col)
    save('sail_normal.png', normal_from_height(height + weave * 0.3, 1.2))


def stern():
    W, H = 1024, 1024
    row = lambda y: int((1 - (y - HULL_Y0) / (HULL_Y1 - HULL_Y0)) * H)
    col, height, rough = planks(W, H, 18, True, '#a9733a', 0.08, seed=5)
    col[row(-0.2):] = hex_rgb('#2a1f17')

    def rect(x0, x1, y0, y1, c, h):
        col[row(y1):row(y0), x0:x1] = hex_rgb(c) if isinstance(c, str) else c
        height[row(y1):row(y0), x0:x1] = h

    for y0, y1 in [(3.4, 5.25), (5.85, 7.7), (8.0, 9.5)]:
        rect(70, W - 70, y0, y1, '#8d2416', 1.1)
        rect(80, W - 80, y1 - 0.08, y1 - 0.03, '#d4a24a', 1.25)
        rect(80, W - 80, y0 + 0.03, y0 + 0.08, '#d4a24a', 1.25)
    for y0, y1 in [(3.75, 4.9), (6.2, 7.35)]:
        for i in range(7):
            x = 150 + i * 110
            rect(x - 8, x + 78, y0 - 0.06, y1 + 0.06, '#d4a24a', 1.3)
            rect(x, x + 70, y0, y1, '#141c26', 0.2)
            rect(x + 33, x + 37, y0, y1, '#b88a3a', 0.6)
            rect(x, x + 70, (y0 + y1) / 2 - 0.02, (y0 + y1) / 2 + 0.02, '#b88a3a', 0.6)
            col[row(y1):row((y0 + y1) / 2), x + 5:x + 30] += 0.15  # glass sheen
    yy, xx = np.mgrid[0:H, 0:W]
    cy, cx = row(8.75), W // 2
    e = ((xx - cx) / 70) ** 2 + ((yy - cy) / 38) ** 2
    col[e < 1] = hex_rgb('#d4a24a'); height[e < 1] = 1.4
    col[e < 0.55] = hex_rgb('#8d2416')
    save('stern_albedo.png', col)
    save('stern_normal.png', normal_from_height(height, 2.5))


def flag():
    W, H = 512, 320
    col = np.ones((H, W, 3), np.float32) * 0.07
    yy, xx = np.mgrid[0:H, 0:W]
    bone = hex_rgb('#ebe4d4')
    skull = ((xx - 256) / 52) ** 2 + ((yy - 120) / 50) ** 2 < 1
    jaw = (abs(xx - 256) < 30) & (yy > 140) & (yy < 185)
    col[skull | jaw] = bone
    for ex in (234, 278):
        col[((xx - ex) / 15) ** 2 + ((yy - 118) / 17) ** 2 < 1] = 0.07
    col[(abs(xx - 256) < 5) & (yy > 140) & (yy < 156)] = 0.07
    for k in range(5):
        col[(yy > 168) & (yy < 185) & (abs(xx - (236 + k * 10)) < 1.5)] = 0.07
    for s in (1, -1):
        d = abs((yy - 250) - s * (xx - 256) * 0.45) < 9
        col[d & (abs(xx - 256) < 120)] = bone
    col *= (0.9 + 0.15 * noise(H, W, 8, 12, 4)[..., None])
    save('flag_albedo.png', col)


if __name__ == '__main__':
    import sys
    sys.path.insert(0, os.path.dirname(__file__))
    hull(); deck(); dark_wood(); sail(); stern(); flag()
    print('textures written to', os.path.abspath(OUT))
