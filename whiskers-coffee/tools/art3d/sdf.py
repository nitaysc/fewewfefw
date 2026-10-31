# A small SDF ray-marcher that renders 3D-modelled props as pixel art: lit, then snapped to
# hand-made hue-shifted colour ramps, with coloured outlines.
import numpy as np, colorsys
from PIL import Image

def V(*a): return np.array(a, np.float64)
def length(p): return np.sqrt((p * p).sum(-1))
def norm(v): return v / np.linalg.norm(v)

# ---------- primitives: each returns distance for points p (N,3) ----------
def rbox(c, h, r=0.0):
    c, h = V(*c), V(*h)
    def f(p):
        q = np.abs(p - c) - (h - r)
        return length(np.maximum(q, 0)) + np.minimum(q.max(-1), 0) - r
    return f
def cyl(c, r, hh, rr=0.0):  # vertical, centre c, radius r, half height hh, edge rounding rr
    c = V(*c)
    def f(p):
        d = p - c
        q = np.stack([np.sqrt(d[:, 0] ** 2 + d[:, 2] ** 2) - (r - rr), np.abs(d[:, 1]) - (hh - rr)], -1)
        return length(np.maximum(q, 0)) + np.minimum(q.max(-1), 0) - rr
    return f
def ell(c, rad):
    c, rad = V(*c), V(*rad)
    def f(p):
        q = (p - c) / rad
        k0 = length(q); k1 = length(q / rad)
        return k0 * (k0 - 1) / np.maximum(k1, 1e-6)
    return f
def cap(a, b, r):
    a, b = V(*a), V(*b)
    def f(p):
        pa, ba = p - a, b - a
        h = np.clip((pa @ ba) / (ba @ ba), 0, 1)
        return length(pa - h[:, None] * ba) - r
    return f
def torus(c, R, r, axis='y'):
    c = V(*c)
    def f(p):
        d = p - c
        if axis == 'y': a, b, h = d[:, 0], d[:, 2], d[:, 1]
        elif axis == 'z': a, b, h = d[:, 0], d[:, 1], d[:, 2]
        else: a, b, h = d[:, 1], d[:, 2], d[:, 0]
        q = np.stack([np.sqrt(a * a + b * b) - R, h], -1)
        return length(q) - r
    return f
def smin(fs, k=0.05):
    def f(p):
        d = fs[0](p)
        for g in fs[1:]:
            e = g(p); h = np.clip(0.5 + 0.5 * (e - d) / k, 0, 1)
            d = e * (1 - h) + d * h - k * h * (1 - h)
        return d
    return f
def sub(a, b):
    return lambda p: np.maximum(a(p), -b(p))
def xform(f, rot_y=0.0, rot_x=0.0, rot_z=0.0, about=(0, 0, 0)):
    about = V(*about)
    cy, sy, cx, sx, cz, sz = np.cos(rot_y), np.sin(rot_y), np.cos(rot_x), np.sin(rot_x), np.cos(rot_z), np.sin(rot_z)
    Ry = np.array([[cy, 0, sy], [0, 1, 0], [-sy, 0, cy]]); Rx = np.array([[1, 0, 0], [0, cx, -sx], [0, sx, cx]]); Rz = np.array([[cz, -sz, 0], [sz, cz, 0], [0, 0, 1]])
    M = Ry @ Rx @ Rz
    return lambda p: f((p - about) @ M + about)

# ---------- colour ramps ----------
def ramp(base, n=6, spread=0.62, hue_shadow=-0.06, hue_light=0.035):
    r, g, b = [int(base.lstrip('#')[i:i + 2], 16) / 255 for i in (0, 2, 4)]
    h, l, s = colorsys.rgb_to_hls(r, g, b)
    out = []
    for i in range(n):
        t = i / (n - 1) * 2 - 1  # -1 dark .. +1 light
        hh = (h + (hue_shadow * -t if t < 0 else hue_light * t)) % 1
        ll = np.clip(l + t * spread * (0.42 if t > 0 else 0.55), 0.03, 0.97)
        ss = np.clip(s * (1 + 0.25 * -t if t < 0 else 1 - 0.3 * t), 0, 1)
        rr, gg, bb = colorsys.hls_to_rgb(hh, ll, ss)
        out.append((int(rr * 255), int(gg * 255), int(bb * 255)))
    return out

class Mat:
    def __init__(s, base, n=6, spread=0.62, tex=None, spec=0.0, outline=None, gloss=0.0, emissive=0.0, hs=-0.06, hl=0.035):
        s.ramp = ramp(base, n, spread, hs, hl); s.tex = tex; s.spec = spec; s.gloss = gloss; s.emissive = emissive
        s.outline = outline

# textures: return a shade offset
def wood(axis=0, freq=55, amp=0.11, seed=1):
    rs = np.random.RandomState(seed); ph = rs.rand(8) * 6
    def t(p, n):
        a = p[:, axis]; o = [i for i in range(3) if i != axis]
        w = np.sin(p[:, o[0]] * freq + np.sin(a * 6 + ph[0]) * 1.5 + np.sin(p[:, o[1]] * 23 + ph[1]) * 0.8)
        return amp * (w > 0.55) * -1.0 + amp * 0.4 * np.sin(a * 140 + ph[2]) * (np.abs(n[:, 1]) > 0.5)
    return t
def fabric(amp=0.05):
    def t(p, n):
        return amp * (np.sin(p[:, 0] * 260) * np.sin(p[:, 1] * 260 + p[:, 2] * 260) > 0.6)
    return t

# ---------- renderer ----------
def render(scene, size=(96, 96), ppu=48, center=(0, 0.45, 0), pitch=38, yaw=0.0, light=(-0.55, 0.8, 0.65), shadows=True, outline_mode='color'):
    """scene: list of (sdf, Mat). Returns RGBA uint8 image."""
    W, H = size
    pr, yw = np.radians(pitch), np.radians(yaw)
    d = norm(V(np.sin(yw) * -np.cos(pr) * 0 + -np.sin(yw) * np.cos(pr), -np.sin(pr), -np.cos(yw) * np.cos(pr)))
    right = norm(np.cross(d, V(0, 1, 0)))
    up = norm(np.cross(right, d))
    ys, xs = np.mgrid[0:H, 0:W]
    u = (xs.ravel() + 0.5 - W / 2) / ppu; v = (H / 2 - ys.ravel() - 0.5) / ppu
    o = V(*center)[None] + u[:, None] * right[None] + v[:, None] * up[None] - d[None] * 6
    fs = [f for f, m in scene]
    def dist(p):
        ds = np.stack([f(p) for f in fs], -1)
        return ds.min(-1), ds.argmin(-1)
    t = np.zeros(len(o)); hit = np.zeros(len(o), bool); alive = np.ones(len(o), bool)
    for _ in range(140):
        idx = np.where(alive)[0]
        if not len(idx): break
        p = o[idx] + d[None] * t[idx, None]
        dd, _ = dist(p)
        h = dd < 0.0015
        hit[idx[h]] = True; alive[idx[h]] = False
        t[idx] += np.maximum(dd, 0.0008) * 0.9
        far = t[idx] > 14; alive[idx[far]] = False
    img = np.zeros((H * W, 4), np.uint8)
    hi = np.where(hit)[0]
    P = o[hi] + d[None] * t[hi, None]
    _, mid = dist(P)
    e = 0.002
    N = np.stack([dist(P + V(*a)[None] * e)[0] - dist(P - V(*a)[None] * e)[0] for a in ((1, 0, 0), (0, 1, 0), (0, 0, 1))], -1)
    N = N / np.maximum(length(N)[:, None], 1e-9)
    Ld = norm(V(*light))
    dif = np.clip(N @ Ld, 0, 1)
    wrap = np.clip((N @ Ld + 0.35) / 1.35, 0, 1)
    # ambient occlusion
    ao = np.ones(len(P))
    for k in range(1, 6):
        hh = 0.025 * k
        ao -= (hh - dist(P + N * hh)[0]) * (2.2 / k)
    ao = np.clip(ao, 0.25, 1)
    sh = np.ones(len(P))
    if shadows:
        ts = np.full(len(P), 0.02); res = np.ones(len(P))
        for _ in range(48):
            q = P + Ld[None] * ts[:, None]
            dd = dist(q)[0]
            res = np.minimum(res, np.clip(8 * dd / ts, 0, 1))
            ts += np.clip(dd, 0.01, 0.12)
        sh = 0.35 + 0.65 * res
    sky = 0.5 + 0.5 * N[:, 1]
    rgb = np.zeros((len(P), 3)); depth = t[hi]
    mats = [m for f, m in scene]
    shade = 0.1 + 0.72 * wrap * sh + 0.14 * sky
    shade = shade * (0.45 + 0.55 * ao)
    lo, mid_, hi_ = np.percentile(shade, [6, 55, 97])
    if hi_ - lo < 0.08:   # a flat scene (one plane): don't blow tiny differences up into bands
        shade = 0.5 + (shade - mid_)
    else:
        shade = np.where(shade < mid_, 0.5 - 0.42 * (mid_ - shade) / max(mid_ - lo, 1e-6), 0.5 + 0.4 * (shade - mid_) / max(hi_ - mid_, 1e-6))
    # bayer dither so ramps blend softly
    bay = np.array([[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]]) / 16 - 0.5
    bx, by = xs.ravel()[hi] % 4, ys.ravel()[hi] % 4
    for i, m in enumerate(mats):
        sel = mid == i
        if not sel.any(): continue
        s = shade[sel].copy()
        if m.tex: s += m.tex(P[sel], N[sel])
        if m.spec:
            R = d[None] - 2 * (N[sel] @ d)[:, None] * N[sel]
            sp = np.clip(R @ Ld, 0, 1) ** 24 * m.spec * sh[sel]
            s += sp
        if m.emissive: s = s * (1 - m.emissive) + m.emissive
        n = len(m.ramp)
        k = np.clip(np.round(s * (n - 1) + bay[by[sel], bx[sel]] * 0.0), 0, n - 1).astype(int)
        rgb[sel] = np.array(m.ramp)[k]
    img[hi, :3] = rgb; img[hi, 3] = 255
    img = img.reshape(H, W, 4)
    # outlines: silhouette pixels take the darkest colour of their material; depth/material
    # breaks inside get a softer line
    mid_full = np.full(H * W, -1); mid_full[hi] = mid; mid_full = mid_full.reshape(H, W)
    dep = np.full(H * W, 1e9); dep[hi] = depth; dep = dep.reshape(H, W)
    a = img[..., 3] > 0
    out = img.copy()
    for y in range(H):
        for x in range(W):
            if not a[y, x]: continue
            nb = [(y + dy, x + dx) for dy, dx in ((0, 1), (1, 0), (0, -1), (-1, 0))]
            edge = any(not (0 <= yy < H and 0 <= xx < W) or not a[yy, xx] for yy, xx in nb)
            m = mats[mid_full[y, x]]
            if edge:
                c0 = np.array(m.outline) if m.outline is not None else np.array(m.ramp[0]) * 0.72
                out[y, x, :3] = c0.astype(np.uint8)
            else:
                for yy, xx in nb:
                    if dep[yy, xx] - dep[y, x] > 0.09:
                        out[y, x, :3] = (np.array(m.ramp[0]) * 0.85 + np.array(m.ramp[1]) * 0.15).astype(np.uint8); break
    return out

def save(img, path, scale=4, bg=None):
    im = Image.fromarray(img, 'RGBA')
    if bg:
        b = Image.new('RGBA', im.size, bg); b.alpha_composite(im); im = b
    im.resize((im.width * scale, im.height * scale), Image.NEAREST).save(path)

def project(pt, size, ppu, center, pitch=38, yaw=0.0):
    """3D point -> pixel (x, y) in a render made with the same camera"""
    W, H = size
    pr, yw = np.radians(pitch), np.radians(yaw)
    d = norm(V(-np.sin(yw) * np.cos(pr), -np.sin(pr), -np.cos(yw) * np.cos(pr)))
    right = norm(np.cross(d, V(0, 1, 0))); up = norm(np.cross(right, d))
    q = V(*pt) - V(*center)
    return (q @ right) * ppu + W / 2 - 0.5, H / 2 - (q @ up) * ppu - 0.5

def rcone(a, b, ra, rb):
    """rounded cone between points a (radius ra) and b (radius rb)"""
    a, b = V(*a), V(*b)
    def f(p):
        ba = b - a; l2 = ba @ ba; rr = ra - rb; a2 = l2 - rr * rr; il2 = 1 / l2
        pa = p - a; y = pa @ ba; z = y - l2
        xv = pa * l2 - y[:, None] * ba[None]; x2 = (xv * xv).sum(-1); y2 = y * y * l2; z2 = z * z * l2
        k = np.sign(rr) * rr * rr * x2
        out = np.where(np.sign(z) * a2 * z2 > k, np.sqrt(x2 + z2) * il2 - rb,
              np.where(np.sign(y) * a2 * y2 < k, np.sqrt(x2 + y2) * il2 - ra, (np.sqrt(x2 * a2 * il2) + y * rr) * il2 - ra))
        return out
    return f
def inter(a, b): return lambda p: np.maximum(a(p), b(p))
def rot_all(scene, yaw=0.0, about=(0, 0, 0)):
    return [(xform(f, rot_y=yaw, about=about), m) for f, m in scene]
def fcone(y0, y1, r0, r1, c=(0, 0)):
    """flat-ended vertical cone (a frustum) from height y0 (radius r0) to y1 (radius r1), axis at x, z = c"""
    k = (r1 - r0) / (y1 - y0); cs = 1 / np.sqrt(1 + k * k)
    def f(p):
        q = np.hypot(p[:, 0] - c[0], p[:, 2] - c[1])
        side = (q - (r0 + k * (np.clip(p[:, 1], y0, y1) - y0))) * cs
        return np.maximum(side, np.maximum(y0 - p[:, 1], p[:, 1] - y1))
    return f
