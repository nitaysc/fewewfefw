import json, sys, numpy as np
from PIL import Image
from scipy import ndimage
D = '/home/user/fewewfefw/whiskers-coffee/www/img/ref/'
m = json.load(open(D + 'manifest.json'))
BG = np.array([240, 231, 214])
FURN = {'sofa_grey', 'sofa_grey_cat', 'sofa_brown', 'sofa_brown2', 'chair1', 'chair2', 'chair3', 'armchair_pink', 'armchair_green', 'stool_brown', 'stool_green', 'stool_cream',
        'table_round', 'table_cake', 'table_laptop', 'coffee_table', 'coffee_table_cakes', 'counter_a', 'counter_b', 'monstera', 'cattree_small', 'menu_board', 'welcome_board', 'plant_mid', 'lamp', 'plant_small', 'cattree_tall'}
FURN |= {n for n in m if n.startswith(('ctr_', 'chairA', 'chairB', 'armgreen', 'armpink', 'sofagrey', 'sofabrown', 'stool4'))}
ONLY = set(sys.argv[1:])
for n in m:
    if ONLY and n not in ONLY: continue
    a = np.asarray(Image.open(D + n + '.png')).astype(int).copy()
    al = a[:, :, 3] > 0
    lum = a[:, :, :3].mean(2)
    for _ in range(3):
        # pale cream pixels on the edge are leftovers of the sheet's background
        edge = al & ~ndimage.binary_erosion(al, border_value=0)
        pale = np.abs(a[:, :, :3] - BG).sum(2) < 75
        # light fringe outside the dark outline: an edge pixel clearly lighter than the darkest
        # solid pixel next to it (blend of outline and background). A white object without an
        # outline keeps its edge because its neighbours are just as light.
        inner = np.where(al & ~edge, lum, 999)
        darkest = ndimage.minimum_filter(inner, size=3, mode='constant', cval=999)
        fringe = edge & (lum > 120) & (lum - darkest > 55)
        al = al & ~(edge & (pale | fringe))
    if n in FURN:
        H = a.shape[0]
        rows = np.arange(H)[:, None] > H * 0.6
        lum = a[:, :, :3].mean(2)
        sh = al & rows & (np.abs(a[:, :, :3] - BG).sum(2) < 175) & (lum > 150) & ((a[:, :, 0] - a[:, :, 2]) < 60)
        a[sh, :3] = [40, 24, 14]; a[sh, 3] = 80
    lab, k = ndimage.label(al)
    if k > 1:
        sizes = ndimage.sum(al, lab, range(1, k + 1))
        lim = sizes.max() * (0.5 if n == 'cattree_tall' else 0.08)
        keepl = np.zeros(k + 1, bool); keepl[1:] = sizes >= lim
        al = keepl[lab]
    a[~al, 3] = 0
    a[al & (a[:, :, 3] == 0), 3] = 255
    img = Image.fromarray(a.astype(np.uint8), 'RGBA')
    bb = img.getbbox(); img = img.crop(bb); img.save(D + n + '.png'); m[n] = [img.width, img.height]
json.dump(m, open(D + 'manifest.json', 'w'), separators=(',', ':'))
print('cleaned', len(m))
