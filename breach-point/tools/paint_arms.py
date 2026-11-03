"""Repaints the CC0 arms texture (tools/arms_skin_source.png, by para on OpenGameArt)
into camo sleeves and tactical gloves: assets/models/arms_kit.png."""
import numpy as np, os
from PIL import Image, ImageFilter
here = os.path.dirname(__file__)
src = np.asarray(Image.open(os.path.join(here, 'arms_skin_source.png')).convert('RGB')).astype(float) / 255
h, w, _ = src.shape
lum = src.mean(axis=2)
mask = lum > 0.04
rng = np.random.default_rng(3)
def blobs(scale, seed):
    r = np.random.default_rng(seed)
    small = r.random((h // scale + 2, w // scale + 2))
    img = Image.fromarray((small * 255).astype(np.uint8)).resize((w, h), Image.BICUBIC).filter(ImageFilter.GaussianBlur(scale / 3))
    return np.asarray(img).astype(float) / 255
# woodland-ish camo from three thresholded noise layers
base = np.array([0.34, 0.36, 0.25])
c1 = np.array([0.24, 0.27, 0.17]); c2 = np.array([0.42, 0.38, 0.27]); c3 = np.array([0.15, 0.15, 0.11])
n1, n2, n3 = blobs(48, 1), blobs(36, 2), blobs(28, 3)
camo = np.tile(base, (h, w, 1))
camo[n1 > 0.58] = c1; camo[n2 > 0.62] = c2; camo[n3 > 0.66] = c3
weave = (np.sin(np.arange(w)[None, :] * 1.9) * np.sin(np.arange(h)[:, None] * 1.9)) * 0.03
camo = camo * (1 + weave[..., None]) * (0.85 + 0.3 * blobs(6, 9)[..., None])
glove = np.tile(np.array([0.10, 0.10, 0.09]), (h, w, 1)) * (0.8 + 0.4 * blobs(4, 5)[..., None])
detail = (lum / max(lum[mask].mean(), 1e-3))[..., None]   # keep the knuckle and fold shading
out = np.zeros_like(src)
top = np.zeros((h, w), bool); top[: int(h * 0.48)] = True
sleeve_px = mask & top
glove_px = mask & ~top
out[sleeve_px] = (camo * np.clip(detail, 0.7, 1.3))[sleeve_px]
out[glove_px] = (glove * np.clip(detail, 0.6, 1.5))[glove_px]
# fingertips and knuckles slightly lighter (worn leather)
out[glove_px] += (np.clip(detail - 1.05, 0, 0.5) * 0.25)[glove_px]
Image.fromarray((np.clip(out, 0, 1) * 255).astype(np.uint8)).save(os.path.join(here, '..', 'assets', 'models', 'arms_kit.png'))
print('ok')
