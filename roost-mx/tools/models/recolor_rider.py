"""
Turn the Rocketbox "Fire_Male_01" turnout gear (MIT, Microsoft) into a motocross kit by
recolouring its textures. The fabric detail, seams, folds and grime are kept; only colours
change. Navy fabric stays (pants and jersey base), silver reflective stripes and cuffs become
white panels, yellow piping becomes orange, the fire-brigade badges and name tags are removed,
and the yellow helmet shell becomes orange.

  python3 recolor_rider.py <Fire_Male_01/Textures dir> <out dir>
"""
import sys, os
import numpy as np
from PIL import Image

src, out = sys.argv[1], sys.argv[2]
os.makedirs(out, exist_ok=True)
ORANGE = np.array([0.93, 0.36, 0.08]); WHITE = np.array([0.93, 0.94, 0.95]); NAVY_FILL = None

def load(n): return np.asarray(Image.open(os.path.join(src, n)).convert('RGB')).astype(np.float32) / 255
def save(a, n, size=None):
    im = Image.fromarray((np.clip(a, 0, 1) * 255).astype(np.uint8))
    if size: im = im.resize((size, size), Image.LANCZOS)
    im.save(os.path.join(out, n), optimize=True)

def hsv(a):
    mx, mn = a.max(2), a.min(2)
    v = mx; s = np.where(mx > 1e-4, (mx - mn) / np.maximum(mx, 1e-4), 0)
    r, g, b = a[..., 0], a[..., 1], a[..., 2]
    h = np.zeros_like(mx); d = np.maximum(mx - mn, 1e-5)
    h = np.where(mx == r, ((g - b) / d) % 6, h); h = np.where(mx == g, (b - r) / d + 2, h); h = np.where(mx == b, (r - g) / d + 4, h)
    return h * 60, s, v

body = load('m138_body_color.tga'); H, W = body.shape[:2]
h, s, v = hsv(body)
lum = body @ np.array([0.3, 0.59, 0.11])
# name tags ("ARMSTRONG") and the shoulder badges: fill with the surrounding fabric first
def fill(x0, y0, x1, y1, colour):
    body[int(y0 * H):int(y1 * H), int(x0 * W):int(x1 * W)] = colour
navy = np.median(body[int(0.30 * H):int(0.38 * H), int(0.36 * W):int(0.62 * W)].reshape(-1, 3), axis=0)
fill(0.445, 0.215, 0.585, 0.262, navy)       # back name tag
fill(0.380, 0.482, 0.470, 0.505, navy)       # chest name tag
h, s, v = hsv(body); lum = body @ np.array([0.3, 0.59, 0.11])
silver = (s < 0.18) & (v > 0.45)              # reflective tape, cuffs, knee patches
yellow = (h > 35) & (h < 70) & (s > 0.45) & (v > 0.35)
red = ((h < 20) | (h > 340)) & (s > 0.45) & (v > 0.25)
shade = (lum / np.maximum(1e-3, np.percentile(lum[silver], 70)))[..., None] if silver.any() else 1
body = np.where(silver[..., None], WHITE * np.clip(shade, 0.55, 1.08), body)
yl = (lum / np.maximum(1e-3, np.percentile(lum[yellow], 70)))[..., None] if yellow.any() else 1
body = np.where(yellow[..., None], ORANGE * np.clip(yl, 0.5, 1.1), body)
body = np.where(red[..., None], ORANGE * 0.95, body)
# badges sit on silver patches: recolour the whole badge areas orange (shoulders)
for x0, y0, x1, y1 in [(0.115, 0.570, 0.190, 0.650), (0.818, 0.570, 0.893, 0.650)]:
    region = body[int(y0 * H):int(y1 * H), int(x0 * W):int(x1 * W)]
    l = region @ np.array([0.3, 0.59, 0.11])
    body[int(y0 * H):int(y1 * H), int(x0 * W):int(x1 * W)] = ORANGE * np.clip(0.5 + l, 0.6, 1.05)[..., None]
# paint the name tags with the jersey's own dark fabric (after recolouring, so they stay dark)
dark = np.percentile(body[int(0.30 * H):int(0.40 * H), int(0.40 * W):int(0.60 * W)].reshape(-1, 3), 35, axis=0)
fill(0.445, 0.215, 0.585, 0.262, dark)
fill(0.380, 0.482, 0.470, 0.505, dark)
save(body, 'rider_body_color.png', 2048)

helmet = load('m138_helmet_color.tga')
h, s, v = hsv(helmet); lum = helmet @ np.array([0.3, 0.59, 0.11])
yellow = (h > 30) & (h < 75) & (s > 0.35)
ref = np.percentile(lum[yellow], 70) if yellow.any() else 1
helmet = np.where(yellow[..., None], ORANGE * np.clip(lum / ref, 0.45, 1.1)[..., None], helmet)
save(helmet, 'rider_helmet_color.png', 1024)

# head, normal and specular maps are used as they are (copied as PNG for Unity/three)
for n, size in [('m138_head_color.tga', 1024), ('m138_body_normal.tga', 2048), ('m138_head_normal.tga', 1024), ('m138_helmet_normal.tga', 1024)]:
    Image.open(os.path.join(src, n)).convert('RGB').resize((size, size), Image.LANCZOS).save(os.path.join(out, n.replace('m138_', 'rider_').replace('.tga', '.png')), optimize=True)
print('wrote', sorted(os.listdir(out)))
