# Cuts sprites out of the owner's reference sheets: removes the paper background,
# snaps the art to its pixel grid and saves clean transparent PNGs for the game.
import json, sys
import numpy as np
from PIL import Image
from scipy import ndimage
REF = '/home/user/fewewfefw/whiskers-coffee/docs/art-references/'
OUT = sys.argv[1]
F, A, V = 'target-characters-furniture.jpg', 'target-animation-sprites.jpg', 'target-character-cat-views.jpg'
# name: (sheet, x0, y0, x1, y1) in preview coordinates (half the sheet size)
S = {
  # people
  'pink_front': (F, 40, 125, 155, 342), 'pink_back': (F, 180, 125, 270, 342), 'pink_side': (F, 315, 125, 415, 342),
  'jacket_front': (F, 465, 140, 575, 342), 'sweater_front': (F, 598, 135, 695, 342), 'jacket2_front': (F, 735, 140, 835, 342),
  'cap_front': (F, 870, 125, 970, 342), 'cap2_front': (F, 995, 125, 1092, 342),
  'barista_front': (A, 38, 112, 168, 340), 'barista_back': (A, 240, 112, 370, 340), 'barista_side': (A, 435, 112, 545, 340),
  'barista_walk1': (A, 855, 135, 955, 340), 'barista_walk2': (A, 975, 135, 1080, 340), 'barista_walk3': (A, 1100, 135, 1205, 340), 'barista_walkf': (A, 1225, 125, 1340, 340),
  'hoodie_front': (A, 28, 392, 170, 642), 'hoodie_back': (A, 240, 392, 370, 642), 'hoodie_side': (A, 435, 392, 560, 642),
  'hoodie_walk1': (A, 598, 405, 712, 642), 'hoodie_walk2': (A, 716, 405, 815, 642), 'hoodie_walk3': (A, 832, 405, 940, 642), 'hoodie_walk4': (A, 955, 405, 1065, 642),
  'hoodie_sit1': (A, 1115, 392, 1228, 605), 'hoodie_sit2': (A, 1232, 392, 1348, 608),
  'catear_front': (V, 38, 108, 175, 342), 'catear_side': (V, 250, 108, 375, 342), 'catear_back': (V, 435, 108, 565, 342), 'catear_walk': (V, 845, 108, 985, 342),
  'hoodie_34': (V, 615, 392, 740, 645), 'hoodie_sitcup': (V, 775, 392, 910, 645),
  # cats
  'orange_groom': (A, 40, 676, 133, 765), 'orangew_sleep': (A, 147, 686, 258, 760), 'orange_sleep': (A, 265, 680, 381, 760),
  'orange_walk1': (A, 415, 660, 535, 762), 'orange_walk2': (A, 554, 664, 675, 762), 'calico_walk1': (A, 700, 664, 823, 762), 'calico_walk2': (A, 845, 664, 966, 762),
  'orange_walk3': (A, 990, 666, 1098, 762), 'orange_leap': (A, 1097, 644, 1235, 750), 'calico_leap': (A, 1236, 638, 1357, 748),
  'orange_stand': (V, 1040, 118, 1168, 225), 'calico_stand': (V, 1190, 118, 1325, 228), 'orange_sit': (V, 1058, 240, 1150, 350), 'calico_walk3': (V, 1210, 240, 1335, 350),
  'calico_sit': (V, 968, 512, 1056, 618), 'calico_sleep': (V, 1228, 542, 1348, 616), 'orange_sleep2': (V, 1078, 542, 1208, 616),
  'grey_sit': (F, 1122, 125, 1202, 197), 'grey_stand': (F, 1203, 125, 1273, 197), 'calicoF_sleep': (F, 1277, 140, 1358, 197),
  'dark_sit': (F, 1122, 203, 1202, 274), 'tux_stand': (F, 1203, 203, 1273, 274), 'black_walk': (F, 1277, 203, 1362, 274),
  'tux_sit': (F, 1125, 278, 1198, 343), 'orangeF_sleep': (F, 1198, 285, 1275, 343),
  # furniture
  'sofa_grey': (F, 26, 405, 200, 562), 'sofa_grey_cat': (F, 205, 405, 380, 562), 'sofa_brown': (F, 22, 578, 212, 750), 'sofa_brown2': (F, 210, 578, 378, 750),
  'chair1': (F, 393, 418, 478, 540), 'chair2': (F, 476, 412, 560, 535), 'chair3': (F, 558, 425, 642, 538),
  'armchair_pink': (F, 392, 542, 508, 668), 'armchair_green': (F, 506, 542, 622, 668),
  'stool_brown': (F, 406, 672, 476, 750), 'stool_green': (F, 488, 675, 557, 750), 'stool_cream': (F, 564, 675, 630, 750),
  'table_round': (F, 670, 432, 784, 536), 'table_cake': (F, 792, 410, 902, 536), 'table_laptop': (F, 910, 405, 1022, 536),
  'coffee_table': (F, 670, 543, 818, 658), 'coffee_table_cakes': (F, 826, 532, 975, 654),
  'counter_a': (F, 657, 655, 828, 752), 'counter_b': (F, 838, 655, 1008, 752),
  'monstera': (F, 1040, 405, 1140, 552), 'hanging_big': (F, 1142, 405, 1220, 552), 'hanging_small': (F, 1216, 405, 1270, 490),
  'cattree_small': (F, 1252, 405, 1360, 545), 'menu_board': (F, 1040, 552, 1115, 658), 'welcome_board': (F, 1115, 565, 1195, 658),
  'plant_mid': (F, 1192, 542, 1268, 658), 'lamp': (F, 1305, 552, 1360, 624), 'plant_small': (F, 1046, 660, 1118, 752),
  'rug_paw': (F, 1110, 685, 1240, 752), 'cattree_tall': (F, 1236, 590, 1362, 752),
}
CELL = 4.7
def grid_fit(rgb, mask):
    # find the offset of the art's pixel grid by minimising the colour spread inside cells
    lum = rgb.mean(2)
    best = None
    for c in (4.5, 4.6, 4.7, 4.8, 4.9):
        for ox in np.arange(0, c, 0.5):
            for oy in np.arange(0, c, 0.5):
                ys = (np.arange(lum.shape[0]) - oy) // c
                xs = (np.arange(lum.shape[1]) - ox) // c
                key = (ys[:, None] * 10000 + xs[None, :]).astype(np.int64)
                m = mask
                k = key[m]; v = lum[m]
                order = np.argsort(k); k = k[order]; v = v[order]
                _, idx, cnt = np.unique(k, return_index=True, return_counts=True)
                s1 = np.add.reduceat(v, idx); s2 = np.add.reduceat(v * v, idx)
                var = (s2 - s1 * s1 / cnt).sum() / len(v)
                if best is None or var < best[0]: best = (var, c, ox, oy)
    return best[1:]
manifest = {}
for name, (sheet, x0, y0, x1, y1) in S.items():
    im = Image.open(REF + sheet).convert('RGB')
    a = np.asarray(im).astype(int)[y0 * 2:y1 * 2, x0 * 2:x1 * 2]
    border = np.concatenate([a[0], a[-1], a[:, 0], a[:, -1]])
    bg = np.median(border, axis=0)
    near = np.abs(a - bg).sum(2) < 52
    # flood fill the background from the edges
    lab, n = ndimage.label(near)
    edge = set(np.unique(np.concatenate([lab[0], lab[-1], lab[:, 0], lab[:, -1]]))) - {0}
    fg = ~np.isin(lab, list(edge))
    # drop specks (guide-line dots, stray text)
    lab2, n2 = ndimage.label(fg)
    sizes = ndimage.sum(fg, lab2, range(1, n2 + 1))
    keep = np.zeros(n2 + 1, bool)
    if n2:
        big = sizes.max()
        for i, sz in enumerate(sizes, 1): keep[i] = sz > max(500, big * 0.04)
    fg = keep[lab2]
    fg = ndimage.binary_fill_holes(fg) & (fg | ~near)
    ys, xs = np.nonzero(fg)
    if not len(ys): print('empty', name); continue
    a = a[ys.min():ys.max() + 1, xs.min():xs.max() + 1]; fg = fg[ys.min():ys.max() + 1, xs.min():xs.max() + 1]
    c, ox, oy = grid_fit(a, fg)
    H = int((a.shape[0] - oy) // c); W = int((a.shape[1] - ox) // c)
    out = np.zeros((H, W, 4), np.uint8)
    for j in range(H):
        for i in range(W):
            ya, yb = int(oy + j * c + c * 0.25), int(oy + j * c + c * 0.75) + 1
            xa, xb = int(ox + i * c + c * 0.25), int(ox + i * c + c * 0.75) + 1
            cellm = fg[int(oy + j * c):int(oy + (j + 1) * c), int(ox + i * c):int(ox + (i + 1) * c)]
            if cellm.size == 0 or cellm.mean() < 0.5: continue
            px = a[ya:yb, xa:xb].reshape(-1, 3)
            out[j, i, :3] = np.median(px, axis=0); out[j, i, 3] = 255
    img = Image.fromarray(out, 'RGBA')
    # tidy the colours: a small palette removes JPEG noise
    rgb = img.convert('RGB').quantize(colors=40, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE).convert('RGB')
    q = np.dstack([np.asarray(rgb), out[:, :, 3]])
    img = Image.fromarray(q, 'RGBA')
    bb = img.getbbox(); img = img.crop(bb)
    img.save(f'{OUT}/{name}.png')
    manifest[name] = [img.width, img.height]
    print(name, img.size, 'cell', c)
json.dump(manifest, open(f'{OUT}/manifest.json', 'w'), separators=(',', ':'))
