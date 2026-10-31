# Renders every sprite for the game into www/img/r3 and writes www/js/art/r3manifest.js.
# Usage: python3 build.py [furniture|people|cats|room|all]
import sys, os, json, numpy as np
from multiprocessing import Pool
from PIL import Image
sys.path.insert(0, os.path.dirname(__file__))
from sdf import render, project, rot_all
from models import MODELS
import people as PP, cats as CC

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
OUT = os.path.join(ROOT, 'www', 'img', 'r3')
K = 2                                   # sprite pixels per game world pixel
PPU = 16 * np.sqrt(2) * K               # 1 tile = 16 world px across -> 45.25 sprite px per unit
ISO = dict(pitch=30, yaw=45)
LIGHT = (-0.35, 0.85, 0.45)
CATALOG = json.load(open(os.path.join(os.path.dirname(__file__), 'catalog.json')))

def crop_save(name, img, ax, ay):
    im = Image.fromarray(img, 'RGBA'); bb = im.getbbox()
    if not bb: return name, None
    im = im.crop(bb); im.save(os.path.join(OUT, name + '.png'), optimize=True)
    return name, [im.width, im.height, round(ax - bb[0], 1), round(ay - bb[1], 1)]

def job_item(args):
    typ, r = args
    d = CATALOG[typ]; fw, fd = d['size']
    w0, d0 = (fd, fw) if r % 2 else (fw, fd)
    sc = MODELS[typ]()
    if r: sc = rot_all(sc, -r * np.pi / 2)
    span = (w0 + d0) * 0.75
    W = int(span * PPU) + 40; H = int((span * 0.5 + 2.6) * PPU)
    cen = (0, 1.0, 0)
    img = render(sc, (W, H), ppu=PPU, center=cen, pitch=ISO['pitch'], yaw=ISO['yaw'], light=LIGHT)
    ax, ay = project((-w0 / 2, 0, -d0 / 2), (W, H), PPU, cen, ISO['pitch'], ISO['yaw'])
    return crop_save(f'f_{typ}_{r}', img, ax + 0.5, ay + 0.5)

LOOKS = {
  'barista': dict(skin='#f6d2b0', hair='#6b3f28', top='#f4ece0', top2='#e6dccb', pants='#3d3a44', apron='#3b3533', style='bun'),
  'catear': dict(skin='#f6d2b0', hair='#7a4a32', top='#f4ece0', top2='#e6dccb', pants='#2b2b30', apron='#3b3533', style='long', ears=True),
  'hoodie': dict(skin='#eec39a', hair='#2b2428', top='#3a3a44', top2='#30303a', pants='#3d5a7a', style='messy', shoes='#e8e0d0'),
  'pink': dict(skin='#f6d2b0', hair='#e88aa0', top='#d9b48a', top2='#c9a078', pants='#4a3a30', style='long', scarf='#c8473f'),
  'jacket': dict(skin='#eec39a', hair='#1f241d', top='#5f7a45', top2='#4f6a38', pants='#3d5a7a', style='messy'),
  'sweater': dict(skin='#f6d7b8', hair='#6b3f24', top='#f4ece0', top2='#e6dccb', pants='#3b2a20', style='long'),
  'jacket2': dict(skin='#d9a273', hair='#2b1d16', top='#7a7a40', top2='#6a6a34', pants='#4a3a30', style='short'),
  'grandpa': dict(skin='#f0cfae', hair='#dcd8d0', top='#cbb38a', top2='#b9a078', pants='#3b3b44', style='short', glasses=True),
  'raincoat': dict(skin='#f6d7b8', hair='#7a4a2e', top='#f2c230', top2='#e0ae20', pants='#3d4a6b', style='bob', shoes='#c8473f'),
  'student': dict(skin='#eec39a', hair='#3b2418', top='#5f7a45', top2='#4f6a38', pants='#3d5a5a', style='messy', glasses=True, backpack='#7a4e30'),
  'cap': dict(skin='#eec39a', hair='#5a3a26', top='#f4ece0', top2='#e6dccb', pants='#3d4a6b', apron='#2f2b2a', style='short', hat='beanie', hatc='#a89a80'),
  'cap2': dict(skin='#f6d7b8', hair='#2b1d16', top='#f4ece0', top2='#e6dccb', pants='#2b2b30', apron='#2f2b2a', style='bun'),
}
VIEWS = {'f': 0.3, 'b': np.pi - 0.3}
PW, PH = 52, 84
def job_person(args):
    model, view, anim, i = args
    L = LOOKS[model]; yaw = VIEWS[view]
    if anim in ('sit', 'sip'): yaw = 0.62 if view == 'f' else np.pi - 0.62
    kw = {}
    pose = 'stand'
    if anim == 'walk': pose, kw = 'walk', dict(phase=i * np.pi / 2)
    elif anim == 'idle': kw = dict(bob=-0.008 * i)
    elif anim == 'carry': pose, kw = 'walk', dict(phase=i * np.pi / 2, carry=True)
    elif anim == 'carryidle': kw = dict(carry=True)
    elif anim == 'sit': pose = 'sit'
    elif anim == 'sip': pose, kw = 'sit', dict(sip=True)
    cy = 0.66 if pose != 'sit' else 0.72
    img = PP.render_person(L, pose, yaw=yaw, w=PW, h=PH, ppu=PPU, **kw)
    hip = 0.48 if pose == 'sit' else 0.0
    ax, ay = project((0, hip, 0), (PW, PH), PPU, (0, cy, 0), PP.PITCH, 0)
    return crop_save(f'p_{model}_{view}_{anim}{i}', img, ax + 0.5, ay + 0.5)

CPPU = PPU * 1.12
def job_cat(args):
    coat, anim, i = args
    kw = {}
    pose = 'sit'
    if anim == 'walk': pose, kw = 'walk', dict(phase=i * np.pi / 2)
    elif anim == 'sit': kw = dict(tail=(-1 if i else 1) * 0.6, blink=(i == 2))
    elif anim == 'sleep': pose, kw = 'loaf', dict(breathe=0.012 * i)
    elif anim == 'groom': kw = dict(tail=0.3 * (1 - 2 * i), blink=True)
    elif anim == 'happy': kw = dict(tail=1.2)
    img = CC.render_cat(coat, pose, ppu=CPPU, **kw)
    h, w = img.shape[:2]
    ax, ay = project((0, 0, 0), (w, h), CPPU, (0, 0.3, 0), CC.CPITCH, 0)
    return crop_save(f'c_{coat}_{anim}{i}', img, ax + 0.5, ay + 0.5)

def jobs(kind):
    if kind == 'furniture':
        return job_item, [(t, r) for t in MODELS if t in CATALOG for r in (range(4) if CATALOG[t].get('rotates') else [0])]
    if kind == 'people':
        A = [('idle', 2), ('walk', 4), ('carry', 4), ('carryidle', 1), ('sit', 1), ('sip', 1)]
        return job_person, [(m, v, a, i) for m in LOOKS for v in VIEWS for a, n in A for i in range(n) if not (v == 'b' and a == 'sip')]
    if kind == 'cats':
        A = [('sit', 3), ('walk', 4), ('sleep', 2), ('groom', 2), ('happy', 1)]
        return job_cat, [(c, a, i) for c in CC.COATS if c != 'tux' for a, n in A for i in range(n)]

import room as RM
def job_room(args):
    kind, style = args
    if kind == 'floor': sc = RM.floor_scene(style); nm = f'r_floor_{style}'
    elif kind in ('n', 'w'): sc = RM.wall_scene(style, kind); nm = f'r_wall{kind}_{style}'
    else:
        typ, ln = style
        sc = RM.feature(typ, ln)
        if kind == 'fw': sc = rot_all(sc, np.pi / 2)   # turned to face +x for the west wall
        nm = f'r_{kind}_{typ}_{ln:g}'
    Wd = int((RM.W + RM.H) * 0.71 * PPU) + 60; Hd = int(((RM.W + RM.H) * 0.36 + 3.2) * PPU)
    cen = ((RM.W - RM.H) / 2 * 0 + RM.W / 2, 1.0, RM.H / 2) if kind in ('floor', 'n', 'w') else (0, 1.2, 0)
    if kind not in ('floor', 'n', 'w'): Wd, Hd = 240, 200
    img = render(sc, (Wd, Hd), ppu=PPU, center=cen, pitch=ISO['pitch'], yaw=ISO['yaw'], light=LIGHT, shadows=kind != 'floor')
    ax, ay = project((0, 0, 0), (Wd, Hd), PPU, cen, ISO['pitch'], ISO['yaw'])
    return crop_save(nm, img, ax + 0.5, ay + 0.5)

FEATS = [('window', 2), ('chalkboard', 2), ('clock', 0.6), ('painting', 1.2), ('shelf', 2), ('door', 1.5)]
_jobs = jobs
def jobs(kind):
    if kind == 'room':
        return job_room, [('floor', s) for s in RM.FLOORS] + [(k, s) for s in RM.WALLS for k in ('n', 'w')] + [(k, f) for f in FEATS for k in ('fn', 'fw')]
    return _jobs(kind)

if __name__ == '__main__':
    os.makedirs(OUT, exist_ok=True)
    kinds = sys.argv[1:] or ['furniture', 'people', 'cats']
    if 'all' in kinds: kinds = ['furniture', 'people', 'cats']
    mpath = os.path.join(OUT, 'manifest.json')
    man = json.load(open(mpath)) if os.path.exists(mpath) else {}
    for k in kinds:
        fn, js = jobs(k)
        with Pool(os.cpu_count()) as p:
            for name, info in p.imap_unordered(fn, js):
                if info: man[name] = info
        print(k, len(js))
    json.dump(man, open(mpath, 'w'), separators=(',', ':'), sort_keys=True)
    open(os.path.join(ROOT, 'www', 'js', 'art', 'r3manifest.js'), 'w').write('// generated by tools/art3d/build.py: [w, h, anchorX, anchorY] in sprite pixels\nexport const R3 = ' + json.dumps(man, separators=(',', ':'), sort_keys=True) + ';\n')
    print('total', len(man))

