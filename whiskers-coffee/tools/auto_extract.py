"""Cut every sprite out of a new reference sheet automatically.

Usage:  python3 tools/auto_extract.py <sheet.png|jpg> <prefix> [--out www/img/ref]

Works best on sheets made with the prompts in tools/ART_PROMPTS.md: sprites on a plain,
flat background with clear space between them. Each sprite is cut out, snapped to its
pixel grid, cleaned and saved as <prefix>_NN.png; a numbered contact sheet
<prefix>_contact.png is written next to them so you can see which number is which, and
the sizes are added to manifest.json. Rename the files you want to keep (for example
espresso_machine.png) and map them in www/js/art/refsprites.js.
"""
import json, sys, os
import numpy as np
from PIL import Image, ImageDraw
from scipy import ndimage

CELLS = (3.5, 4.0, 4.5, 4.6, 4.7, 4.8, 5.0, 5.5, 6.0)

def grid_fit(rgb, mask):
    lum = rgb.mean(2); best = None
    # art pixels are 4-6 sheet pixels on full-size sheets and 2-3 on downscaled ones
    for c in CELLS:
        for ox in np.arange(0, c, 0.5):
            for oy in np.arange(0, c, 0.5):
                ys = (np.arange(lum.shape[0]) - oy) // c; xs = (np.arange(lum.shape[1]) - ox) // c
                key = (ys[:, None] * 10000 + xs[None, :]).astype(np.int64)
                k = key[mask]; v = lum[mask]; o = np.argsort(k); k = k[o]; v = v[o]
                _, idx, cnt = np.unique(k, return_index=True, return_counts=True)
                s1 = np.add.reduceat(v, idx); s2 = np.add.reduceat(v * v, idx)
                var = (s2 - s1 * s1 / cnt).sum() / len(v) + c * 0.02
                if best is None or var < best[0]: best = (var, c, ox, oy)
    return best[1:]

def cut(a, fg):
    c, ox, oy = grid_fit(a, fg)
    H = int((a.shape[0] - oy) // c); W = int((a.shape[1] - ox) // c)
    out = np.zeros((H, W, 4), np.uint8)
    for j in range(H):
        for i in range(W):
            cm = fg[int(oy + j * c):int(oy + (j + 1) * c), int(ox + i * c):int(ox + (i + 1) * c)]
            if cm.size == 0 or cm.mean() < 0.5: continue
            px = a[int(oy + j * c + c * .25):int(oy + j * c + c * .75) + 1, int(ox + i * c + c * .25):int(ox + i * c + c * .75) + 1].reshape(-1, 3)
            out[j, i, :3] = np.median(px, axis=0); out[j, i, 3] = 255
    img = Image.fromarray(out, 'RGBA')
    rgb = img.convert('RGB').quantize(colors=48, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE).convert('RGB')
    img = Image.fromarray(np.dstack([np.asarray(rgb), out[:, :, 3]]), 'RGBA')
    return img.crop(img.getbbox()), c

def clean(img, bg):
    a = np.asarray(img).astype(int).copy(); al = a[:, :, 3] > 0
    for _ in range(2):
        edge = al & ~ndimage.binary_erosion(al, border_value=0)
        al &= ~(edge & (np.abs(a[:, :, :3] - bg).sum(2) < 75))
    a[~al, 3] = 0
    return Image.fromarray(a.astype(np.uint8), 'RGBA')

def main():
    global CELLS
    sheet, prefix = sys.argv[1], sys.argv[2]
    if '--cells' in sys.argv:
        CELLS = tuple(float(x) for x in sys.argv[sys.argv.index('--cells') + 1].split(','))
    gap = int(sys.argv[sys.argv.index('--gap') + 1]) if '--gap' in sys.argv else 8
    minpx = int(sys.argv[sys.argv.index('--min') + 1]) if '--min' in sys.argv else 1500
    out = sys.argv[sys.argv.index('--out') + 1] if '--out' in sys.argv else 'www/img/ref'
    a = np.asarray(Image.open(sheet).convert('RGB')).astype(int)
    bg = np.median(np.concatenate([a[0], a[-1], a[:, 0], a[:, -1]]), axis=0)
    near = np.abs(a - bg).sum(2) < 52
    lab, n = ndimage.label(near)
    edge = set(np.unique(np.concatenate([lab[0], lab[-1], lab[:, 0], lab[:, -1]]))) - {0}
    fg = ~np.isin(lab, list(edge))
    fg = ndimage.binary_opening(fg, iterations=2)
    groups, k = ndimage.label(ndimage.binary_dilation(fg, iterations=gap))
    man_path = os.path.join(out, 'manifest.json')
    man = json.load(open(man_path)) if os.path.exists(man_path) else {}
    boxes = []
    for i, sl in enumerate(ndimage.find_objects(groups), 1):
        h = sl[0].stop - sl[0].start; w = sl[1].stop - sl[1].start
        if h < 20 or w < 16: continue
        m = (groups[sl] == i) & fg[sl]
        if m.sum() < minpx: continue
        boxes.append((sl, m))
    row = max(40, a.shape[0] // 12)
    boxes.sort(key=lambda b: (b[0][0].start // row, b[0][1].start))
    contact = Image.open(sheet).convert('RGB'); dr = ImageDraw.Draw(contact)
    for n_, (sl, m) in enumerate(boxes, 1):
        img, c = cut(a[sl], ndimage.binary_fill_holes(m) & (m | ~near[sl]))
        img = clean(img, bg); img = img.crop(img.getbbox())
        name = f'{prefix}_{n_:02d}'
        img.save(os.path.join(out, name + '.png')); man[name] = [img.width, img.height]
        dr.rectangle([sl[1].start, sl[0].start, sl[1].stop, sl[0].stop], outline=(255, 0, 0), width=4)
        dr.text((sl[1].start + 6, sl[0].start + 6), str(n_), fill=(255, 0, 0))
        print(name, img.size, 'pixel size', c)
    contact.save(os.path.join(out, prefix + '_contact.png'))
    json.dump(man, open(man_path, 'w'), separators=(',', ':'))
    js = os.path.join(os.path.dirname(out.rstrip('/')), '..', 'js', 'art', 'refmanifest.js')
    if os.path.exists(os.path.dirname(js)):
        open(js, 'w').write("// Sizes of the sprites cut from the owner's reference sheets (generated by tools/*extract.py).\nexport const MANIFEST = " + json.dumps(man, separators=(',', ':')) + ";\n")
    print(len(boxes), 'sprites; contact sheet:', prefix + '_contact.png')

if __name__ == '__main__':
    main()
