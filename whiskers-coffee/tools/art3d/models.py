# Every catalog item as an SDF model: centred on its footprint, standing on y = 0, facing +z
# (rot 0 in the game). One floor tile is 1 unit.
from items import *

def tex_rug(kind):
    if kind == 'rug':
        return lambda p, n: 0.2 * ((np.abs(p[:, 0]) > 0.78) | (np.abs(p[:, 2]) > 0.78)) + 0.14 * ((((np.abs(p[:, 0]) + np.abs(p[:, 2])) * 5) % 1) < 0.22) - 0.1 * ((np.abs(p[:, 0]) > 0.86) | (np.abs(p[:, 2]) > 0.86))
    if kind == 'quilt':
        return lambda p, n: 0.22 * (((np.floor(p[:, 0] * 3) + np.floor(p[:, 2] * 3)) % 2) == 0) - 0.12 * ((((p[:, 0] * 3) % 1) < 0.06) | (((p[:, 2] * 3) % 1) < 0.06))
    if kind == 'maple':
        return lambda p, n: 0.25 * (np.hypot(p[:, 0], p[:, 2]) < 0.35 + 0.12 * np.cos(5 * np.arctan2(p[:, 2], p[:, 0]))) - 0.15 * ((np.abs(p[:, 0]) > 0.82) | (np.abs(p[:, 2]) > 0.82))
    return lambda p, n: -0.25 * ((np.hypot(p[:, 0], p[:, 2] - 0.06) < 0.13) | np.any([np.hypot(p[:, 0] - dx, p[:, 2] + 0.12) < 0.055 for dx in (-0.14, -0.05, 0.05, 0.14)], axis=0))

MX = dict(
    green=Mat('#6f9a5c', 6, 0.66), green2=Mat('#79a466', 6, 0.66), grey=Mat('#9aa1ad', 6, 0.6), grey2=Mat('#a7aeba', 6, 0.6),
    rugR=Mat('#c4574a', 5, 0.45, tex=tex_rug('rug')), quilt=Mat('#e6a0a8', 5, 0.42, tex=tex_rug('quilt')), maple=Mat('#d9a35a', 5, 0.45, tex=tex_rug('maple')),
    paw=Mat('#e9d6b6', 5, 0.4, tex=tex_rug('paw')), straw=Mat('#e2bf62', 6, 0.5, tex=lambda p, n: -0.08 * (np.sin(p[:, 0] * 90 + p[:, 1] * 30) > 0.6)),
    wicker=Mat('#d8b27a', 6, 0.55, tex=lambda p, n: -0.1 * ((np.sin(p[:, 1] * 120) * np.sin(np.arctan2(p[:, 2], p[:, 0]) * 30)) > 0.3)),
    red=Mat('#b5483c', 6, 0.55), zab=Mat('#c8574a', 6, 0.5), navy=Mat('#3b4a5a', 6, 0.5), teal=Mat('#8fb3a8', 6, 0.5), teal2=Mat('#a8c9bf', 5, 0.45),
    paper=Mat('#f6ecd4', 5, 0.3, emissive=0.45), pine=Mat('#2f6b45', 6, 0.6), star=Mat('#ffd27a', 4, 0.4, emissive=0.6),
    stone=Mat('#b8a28a', 6, 0.5, tex=lambda p, n: -0.12 * ((((p[:, 1] * 6) % 1) < 0.08) | ((((p[:, 0] + np.floor(p[:, 1] * 6) * 0.17) * 4) % 1) < 0.05))),
    fire=Mat('#ffb040', 4, 0.5, emissive=0.85), fire2=Mat('#ff7a20', 4, 0.5, emissive=0.8), soot=Mat('#2a1d16', 4, 0.3),
    pumpkin=Mat('#e07a3a', 6, 0.6, spec=0.3), pumpkin2=Mat('#f0a050', 6, 0.6, spec=0.3), squash=Mat('#d9c18a', 5, 0.5),
    apple=Mat('#c8302a', 5, 0.6, spec=0.6), apple2=Mat('#9bbf4a', 5, 0.6, spec=0.5),
    giftR=Mat('#b5483c', 5, 0.5), giftB=Mat('#3f6f8a', 5, 0.5), giftG=Mat('#6d8a58', 5, 0.5), ribbon=Mat('#f2d27a', 4, 0.5, spec=0.4), ribbonW=Mat('#f4efe6', 4, 0.4),
    flowerP=Mat('#ef8fae', 5, 0.5), flowerY=Mat('#f2d27a', 5, 0.5), flowerW=Mat('#f4efe6', 4, 0.3), flowerV=Mat('#b7a0e0', 5, 0.5),
    sign=Mat('#2f4a3c', 5, 0.4), chalk=Mat('#f4efe6', 3, 0.2, emissive=0.4), chalkP=Mat('#f2c1c8', 3, 0.2, emissive=0.4), chalkY=Mat('#ffd27a', 3, 0.2, emissive=0.4),
    screenG=Mat('#9fd0b8', 4, 0.3, emissive=0.6), till=Mat('#4a4e57', 5, 0.5, spec=0.4), bag=Mat('#c8a66e', 6, 0.5), rope=Mat('#e8d7b0', 4, 0.4),
    pinkpad=Mat('#e7a0a6', 5, 0.5), bed=Mat('#e8d7b0', 5, 0.45), bed2=Mat('#f6ecd4', 4, 0.4),
)

def seat_legs(w, d, h, mat, r=0.024):
    return [(cap((x * w, h, z * d), (x * (w + 0.01), 0.0, z * (d + 0.01)), r), mat) for x in (-1, 1) for z in (-1, 1)]

def chair_panel():
    sc = chair()
    sc.append((rbox((0, 0.46 + 0.3, -0.16), (0.12, 0.09, 0.012), 0.01), M['cream']))
    return sc
def chair_spindle():
    sc = chair()
    return [(f, M['walnut'] if m is M['oak'] else m) for f, m in sc]
def stool(seatm):
    h = 0.62
    return [(cyl((0, h - 0.03, 0), 0.19, 0.035, 0.03), seatm), (torus((0, h * 0.38, 0), 0.13, 0.012), M['walnut'])] + seat_legs(0.12, 0.12, h - 0.05, M['walnut'], 0.02)

def counter_body(w):
    h, d = 0.88, 0.36
    sc = [(rbox((0, h / 2 - 0.03, 0), (w - 0.03, h / 2 - 0.03, d - 0.04), 0.02), M['walnut']),
          (rbox((0, h - 0.02, 0), (w, 0.03, d), 0.015), M['cream']),
          (rbox((0, 0.04, 0.02), (w - 0.05, 0.04, d - 0.04), 0.01), M['dark'])]
    n = max(1, int(round(w / 0.24)))
    for i in range(n):
        sc.append((rbox((-w + (2 * w / n) * (i + 0.5), h / 2, d - 0.035), (w / n - 0.04, h / 2 - 0.12, 0.012), 0.02), M['oak']))
    return sc, h + 0.01
def glass_case(x, y, w):
    sc = [(rbox((x, y + 0.01, 0), (w, 0.01, 0.3), 0.005), M['dark'])]
    for i in range(3):
        cx = x - w * 0.6 + i * w * 0.6
        sc += [(cyl((cx, y + 0.03, 0.02), 0.09, 0.008, 0.004), M['white']), (cyl((cx, y + 0.08, 0.02), 0.075, 0.045, 0.012), [M['sponge'], M['choc'], M['sponge']][i]),
               (cyl((cx, y + 0.13, 0.02), 0.077, 0.012, 0.006), [M['cake'], M['choc'], M['cream']][i]), (ell((cx, y + 0.155, 0.02), (0.016, 0.016, 0.016)), M['berry'])]
    sc += [(rbox((x, y + 0.2, -0.12), (w, 0.2, 0.012), 0.01), M['glass']), (rbox((x, y + 0.4, 0), (w, 0.01, 0.14), 0.005), M['glass'])]
    for s in (-1, 1): sc.append((rbox((x + s * w, y + 0.2, 0), (0.012, 0.2, 0.14), 0.005), M['dark']))
    return sc

def table_square():
    top = 0.72
    return [(rbox((0, top - 0.025, 0), (0.32, 0.025, 0.32), 0.012), M['oakT'])] + seat_legs(0.27, 0.27, top - 0.05, M['walnut'], 0.028)
def coffee_table(cakes=False):
    top = 0.42
    sc = [(rbox((0, top - 0.025, 0), (0.4, 0.025, 0.3), 0.015), M['oakT']), (rbox((0, 0.14, 0), (0.34, 0.012, 0.24), 0.008), M['walnut'])] + seat_legs(0.34, 0.24, top - 0.05, M['walnut'], 0.025)
    if cakes:
        for (x, z, m) in ((-0.15, 0.05, 'cake'), (0.14, -0.06, 'choc')):
            sc += [(cyl((x, top + 0.005, z), 0.07, 0.006, 0.003), M['white']), (rbox((x, top + 0.04, z), (0.045, 0.03, 0.03), 0.01), M['sponge']), (rbox((x, top + 0.075, z), (0.046, 0.007, 0.031), 0.006), M[m])]
        sc += mug(0.02, top, 0.14, 'rose', 'foam')
    return sc
def table_cake():
    sc = round_table()[:4]
    top = 0.72
    sc += [(cyl((0, top + 0.006, 0), 0.17, 0.006, 0.003), M['white']), (cyl((0, top + 0.06, 0), 0.13, 0.05, 0.012), M['sponge']),
           (cyl((0, top + 0.115, 0), 0.132, 0.012, 0.008), M['cake'])]
    for i in range(8):
        a = i / 8 * np.pi * 2
        sc.append((ell((np.cos(a) * 0.1, top + 0.135, np.sin(a) * 0.1), (0.016, 0.016, 0.016)), M['berry']))
    return sc
def chabudai():
    top = 0.3
    return [(cyl((0, top - 0.025, 0), 0.4, 0.025, 0.012), M['walnut'])] + [(cap((np.cos(a) * 0.26, top - 0.04, np.sin(a) * 0.26), (np.cos(a) * 0.26, 0, np.sin(a) * 0.26), 0.03), M['walnut']) for a in (np.pi / 4, 3 * np.pi / 4, 5 * np.pi / 4, 7 * np.pi / 4)]
def zabuton():
    return [(rbox((0, 0.05, 0), (0.3, 0.05, 0.3), 0.045), MX['zab']), (ell((0, 0.1, 0), (0.03, 0.02, 0.03)), MX['ribbon'])]
def wicker():
    return [(sub(cyl((0, 0.45, -0.02), 0.34, 0.45, 0.06), cyl((0, 0.7, 0.12), 0.3, 0.3)), MX['wicker']), (cyl((0, 0.44, 0.04), 0.27, 0.04, 0.035), M['cream'])]
def hay():
    return [(rbox((0, 0.22, 0), (0.38, 0.22, 0.26), 0.06), MX['straw'])] + [(rbox((s * 0.18, 0.22, 0), (0.02, 0.225, 0.265), 0.01), M['dark']) for s in (-1, 1)]

def counter_plain(w=0.47, extra=()):
    sc, h = counter_body(w)
    return sc + list(extra), h
def counter_1():
    sc, h = counter_body(0.47)
    return sc + mug(-0.15, h, 0.05) + mug(0.12, h, -0.1, 'rose')
def counter_long():
    sc, h = counter_body(0.95)
    return sc + mug(-0.6, h, 0.08) + [(cyl((0.6, h + 0.09, -0.12), 0.05, 0.09, 0.02), M['glass']), (ell((0.6, h + 0.22, -0.12), (0.05, 0.05, 0.05)), MX['flowerP']), (ell((0.64, h + 0.2, -0.08), (0.04, 0.04, 0.04)), MX['flowerY'])]
def counter_register():
    sc, h = counter_body(0.95)
    sc += [(xform(rbox((-0.5, h + 0.1, 0), (0.17, 0.1, 0.13), 0.03), rot_y=0.3, about=(-0.5, h + 0.1, 0)), MX['till']),
           (xform(rbox((-0.5, h + 0.27, -0.06), (0.13, 0.08, 0.015), 0.01), rot_y=0.3, rot_x=-0.3, about=(-0.5, h + 0.27, -0.06)), MX['screenG']),
           (sub(cyl((0.65, h + 0.06, 0), 0.07, 0.06, 0.02), cyl((0.65, h + 0.12, 0), 0.055, 0.04)), M['pot']), (ell((0.65, h + 0.17, 0), (0.1, 0.07, 0.09)), M['leaf'])]
    return sc + mug(0.1, h, 0.1)
def counter_beans():
    sc, h = counter_body(0.95)
    for i in range(3):
        bx = -0.7 + i * 0.14
        sc += [(cyl((bx, h + 0.08, -0.12), 0.05, 0.08, 0.015), M['glass']), (cyl((bx, h + 0.06, -0.12), 0.045, 0.055, 0.01), [M['choc'], M['coffee'], M['foam']][i]), (cyl((bx, h + 0.17, -0.12), 0.053, 0.014, 0.006), M['oakT'])]
    for i in range(2): sc.append((rbox((-0.1 + i * 0.26, h + 0.14, 0), (0.1, 0.14, 0.07), 0.05), MX['bag']))
    sc += [(rbox((0.6, h + 0.08, 0), (0.08, 0.08, 0.08), 0.015), M['walnut']), (cyl((0.6, h + 0.2, 0), 0.06, 0.04, 0.01), M['brass'])]
    return sc
def pastry():
    sc, h = counter_body(0.47)
    return sc + glass_case(0, h, 0.42)
def cake_counter():
    sc, h = counter_body(0.95)
    sc += glass_case(-0.3, h, 0.6)
    sc += [(xform(rbox((0.65, h + 0.1, 0), (0.15, 0.1, 0.12), 0.03), rot_y=-0.3, about=(0.65, h + 0.1, 0)), MX['till']), (xform(rbox((0.65, h + 0.25, -0.05), (0.12, 0.07, 0.012), 0.01), rot_y=-0.3, rot_x=-0.3, about=(0.65, h + 0.25, -0.05)), MX['screenG'])]
    return sc

def shelf_unit(w, h, d, mat, ys):
    sc = [(rbox((0, h / 2, -d + 0.01), (w, h / 2, 0.012), 0.005), M['dark'])]
    for x in (-1, 1): sc.append((rbox((x * (w - 0.02), h / 2, 0), (0.025, h / 2, d), 0.01), mat))
    sc.append((rbox((0, h - 0.01, 0), (w + 0.02, 0.025, d + 0.02), 0.01), mat))
    for y in ys: sc.append((rbox((0, y, 0), (w - 0.04, 0.018, d - 0.01), 0.006), mat))
    return sc
def tea_hutch():
    sc = [(rbox((0, 0.31, 0), (0.43, 0.31, 0.21), 0.03), MX['teal'])]
    for s in (-1, 1): sc += [(rbox((s * 0.21, 0.33, 0.21), (0.19, 0.23, 0.012), 0.02), MX['teal2']), (ell((s * 0.05, 0.36, 0.23), (0.018, 0.018, 0.018)), M['brass'])]
    sc.append((rbox((0, 0.64, 0), (0.45, 0.02, 0.23), 0.01), M['oakT']))
    up = shelf_unit(0.4, 1.0, 0.11, MX['teal'], [0.35, 0.7])
    sc += [(xform(f, about=(0, 0, 0)) if False else (lambda f=f: (lambda p: f(p - V(0, 0.66, -0.1))))(), m) for f, m in up]
    for i in range(4): sc.append((xform(cyl((-0.27 + i * 0.18, 0.66 + 0.47, -0.14), 0.07, 0.008, 0.004), rot_x=1.3, about=(-0.27 + i * 0.18, 0.66 + 0.47, -0.14)), [M['white'], M['rose'], M['cream'], MX['flowerY']][i]))
    sc += [(ell((-0.15, 0.66 + 0.8, -0.08), (0.08, 0.065, 0.08)), M['white'])] + mug(0.12, 0.66 + 0.71, -0.08, 'rose') + mug(0.26, 0.66 + 0.71, -0.08, 'cream')
    return sc
def cup_hutch():
    sc = shelf_unit(0.4, 1.6, 0.17, M['oak'], [0.05, 0.55, 1.05])
    for i in range(4):
        x = -0.27 + i * 0.18
        sc += [(cyl((x, 0.65, 0), 0.05, 0.08, 0.015), M['glass']), (cyl((x, 0.63, 0), 0.045, 0.055, 0.01), [M['choc'], M['foam'], M['coffee'], M['cake']][i]), (cyl((x, 0.74, 0), 0.053, 0.014, 0.006), M['oakT'])]
        sc += mug(x, 1.07, 0.02, ['white', 'rose', 'cream', 'white'][i])
    for i in range(2): sc.append((rbox((-0.15 + i * 0.3, 0.2, 0), (0.1, 0.14, 0.08), 0.05), MX['bag']))
    return sc

def pot(r=0.17, h=0.26, y=0, mat='pot'):
    return [(sub(cyl((0, y + h / 2, 0), r, h / 2, 0.03), cyl((0, y + h, 0), r - 0.025, 0.06)), M[mat]), (cyl((0, y + h - 0.035, 0), r - 0.025, 0.01), M['soil'])], y + h - 0.03
def fern(y0, n=14, L=0.22, seed=9):
    rs = np.random.RandomState(seed); sc = []
    for i in range(n):
        a = i / n * np.pi * 2 + rs.rand() * 0.4
        tip = (np.cos(a) * L, y0 + 0.12 + rs.rand() * 0.12, np.sin(a) * L)
        mid = (np.cos(a) * L * 0.5, y0 + 0.17 + rs.rand() * 0.06, np.sin(a) * L * 0.5)
        sc += [(smin([ell(mid, (0.06, 0.02, 0.06)), ell(tip, (0.045, 0.015, 0.045)), ell((0, y0 + 0.05, 0), (0.05, 0.03, 0.05))], 0.06), M['leaf'] if i % 2 else M['leaf2'])]
    return sc
def plant_small():
    sc = [(cyl((0, 0.5, 0), 0.17, 0.02, 0.01), M['walnut'])] + [(cap((np.cos(a) * 0.13, 0.49, np.sin(a) * 0.13), (np.cos(a) * 0.16, 0, np.sin(a) * 0.16), 0.018), M['walnut']) for a in (0.3, 2.4, 4.5)]
    p, t = pot(0.13, 0.17, 0.52, 'cream')
    return sc + p + fern(t, 14, 0.22)
def potted_fern():
    p, t = pot(0.15, 0.22)
    return p + fern(t, 13, 0.22, 12)
def bonsai():
    sc = [(rbox((0, 0.06, 0), (0.22, 0.06, 0.15), 0.03), MX['navy']), (cap((0.02, 0.1, 0), (-0.06, 0.4, 0), 0.035), M['walnut']), (cap((-0.06, 0.4, 0), (0.08, 0.52, 0), 0.025), M['walnut'])]
    for x, y, z, r in ((-0.1, 0.48, 0, 0.13), (0.12, 0.56, 0.04, 0.1), (0.0, 0.62, -0.03, 0.1)):
        sc.append((ell((x, y, z), (r * 1.3, r * 0.6, r * 1.1)), M['leaf']))
    return sc
def flower_box():
    sc = [(rbox((0, 0.13, 0), (0.33, 0.13, 0.18), 0.03), M['oak']), (rbox((0, 0.25, 0), (0.3, 0.012, 0.15)), M['soil'])]
    rs = np.random.RandomState(8); cols = ['flowerP', 'flowerY', 'flowerW', 'flowerV', 'flowerP']
    for i in range(12):
        x, z, h = -0.25 + rs.rand() * 0.5, -0.1 + rs.rand() * 0.2, 0.1 + rs.rand() * 0.14
        sc += [(cap((x, 0.25, z), (x, 0.25 + h, z), 0.008), M['stem']), (ell((x, 0.25 + h, z), (0.04, 0.03, 0.04)), MX[cols[i % 5]]), (ell((x + 0.03, 0.28, z), (0.05, 0.015, 0.03)), M['leaf'])]
    return sc
def hanging_plant():
    y = 1.4
    sc = [(cap((np.cos(a) * 0.08, y + 0.15, np.sin(a) * 0.08), (0, 2.25, 0), 0.006), MX['rope']) for a in (0.5, 2.6, 4.7)]
    p, t = pot(0.14, 0.18, y, 'cream')
    sc += p
    rs = np.random.RandomState(6)
    for i in range(9):
        a = rs.rand() * np.pi * 2; L = 0.25 + rs.rand() * 0.4
        sc.append((smin([ell((np.cos(a) * (0.13 + k * 0.02), t + 0.05 - k * L / 4, np.sin(a) * (0.13 + k * 0.02)), (0.04, 0.03, 0.04)) for k in range(5)], 0.04), M['leaf'] if i % 2 else M['leaf2']))
    return sc
def pumpkins():
    sc = []
    for x, z, r, m in ((-0.12, 0.05, 0.17, 'pumpkin'), (0.17, -0.06, 0.13, 'pumpkin2'), (0.08, 0.2, 0.09, 'squash')):
        sc.append((smin([ell((x + np.cos(a) * r * 0.35, r * 0.8, z + np.sin(a) * r * 0.35), (r * 0.6, r * 0.8, r * 0.6)) for a in np.linspace(0, 2 * np.pi, 7)[:-1]], 0.03), MX[m]))
        sc.append((cap((x, r * 1.5, z), (x + 0.02, r * 1.75, z), 0.015), M['stem']))
    return sc
def apple_crate():
    sc = [(rbox((0, 0.02, 0), (0.3, 0.02, 0.22)), M['oak'])]
    for i in range(3):
        for s in (-1, 1): sc.append((rbox((0, 0.07 + i * 0.1, s * 0.22), (0.31, 0.035, 0.012), 0.008), M['oakT']))
    for s in (-1, 1): sc.append((rbox((s * 0.3, 0.15, 0), (0.012, 0.15, 0.23), 0.008), M['oak']))
    rs = np.random.RandomState(21)
    for i in range(12): sc.append((ell((-0.22 + (i % 4) * 0.145, 0.3 + rs.rand() * 0.03, -0.13 + (i // 4) * 0.13), (0.06, 0.055, 0.06)), MX['apple2'] if rs.rand() < 0.2 else MX['apple']))
    return sc
def gifts():
    sc = []
    for w, h, x, z, m, r in ((0.16, 0.26, -0.1, 0.05, 'giftR', 'ribbon'), (0.11, 0.2, 0.18, -0.1, 'giftB', 'ribbonW'), (0.09, 0.14, 0.15, 0.2, 'giftG', 'giftR')):
        sc += [(rbox((x, h / 2, z), (w, h / 2, w), 0.02), MX[m]), (rbox((x, h / 2, z), (w + 0.004, h / 2 + 0.004, 0.02), 0.005), MX[r]), (rbox((x, h / 2, z), (0.02, h / 2 + 0.004, w + 0.004), 0.005), MX[r]),
               (torus((x - 0.03, h + 0.02, z), 0.03, 0.01, 'z'), MX[r]), (torus((x + 0.03, h + 0.02, z), 0.03, 0.01, 'z'), MX[r])]
    return sc
def xmas_tree():
    sc = [(cyl((0, 0.09, 0), 0.16, 0.09, 0.02), MX['red']), (cyl((0, 0.25, 0), 0.045, 0.1), M['walnut'])]
    for r, h, y in ((0.42, 0.5, 0.55), (0.34, 0.45, 0.9), (0.24, 0.4, 1.2), (0.14, 0.3, 1.45)):
        sc.append((rcone((0, y - h / 2, 0), (0, y + h / 2, 0), r, 0.02), MX['pine']))
    sc.append((ell((0, 1.66, 0), (0.06, 0.06, 0.03)), MX['star']))
    rs = np.random.RandomState(77)
    for i in range(18):
        y = 0.4 + rs.rand() * 1.05; r = 0.42 * (1 - (y - 0.3) / 1.4) + 0.01; a = rs.rand() * np.pi * 2
        sc.append((ell((np.cos(a) * r, y, np.sin(a) * r), (0.03, 0.03, 0.03)), [MX['apple'], MX['ribbon'], MX['giftB'], MX['flowerW']][i % 4]))
    return sc
def fireplace():
    z0 = -0.22
    sc = [(sub(rbox((0, 0.55, z0), (0.85, 0.55, 0.25), 0.03), rbox((0, 0.32, z0 + 0.25), (0.4, 0.3, 0.2), 0.04)), MX['stone']),
          (rbox((0, 0.32, z0 + 0.1), (0.4, 0.3, 0.1)), MX['soot']), (rbox((0, 1.14, z0 + 0.02), (0.92, 0.04, 0.31), 0.015), M['walnut']),
          (rbox((0, 0.03, z0 + 0.35), (0.5, 0.03, 0.12), 0.01), MX['stone'])]
    for i in range(3): sc.append((cap((-0.25, 0.08 + i * 0.03, z0 + 0.12 + i * 0.03), (0.25, 0.08 + i * 0.03, z0 + 0.12 + i * 0.03), 0.04), M['walnut']))
    for i in range(5): sc.append((rcone((-0.16 + i * 0.08, 0.12, z0 + 0.18), (-0.16 + i * 0.08, 0.36 - (i % 2) * 0.08, z0 + 0.18), 0.06, 0.01), MX['fire'] if i % 2 else MX['fire2']))
    for x in (-0.6, 0.6): sc += [(cyl((x, 1.25, z0), 0.03, 0.07), M['white']), (ell((x, 1.35, z0), (0.02, 0.03, 0.02)), MX['star'])]
    return sc
def andon():
    h = 0.62
    sc = [(rbox((0, h / 2 + 0.06, 0), (0.16, h / 2, 0.16), 0.01), MX['paper'])]
    for x, z in ((-1, -1), (1, -1), (-1, 1), (1, 1)): sc.append((rbox((x * 0.17, h / 2 + 0.05, z * 0.17), (0.016, h / 2 + 0.05, 0.016), 0.004), M['walnut']))
    for y in (0.08, h + 0.06):
        for s in (-1, 1): sc += [(rbox((0, y, s * 0.17), (0.18, 0.014, 0.014), 0.004), M['walnut']), (rbox((s * 0.17, y, 0), (0.014, 0.014, 0.18), 0.004), M['walnut'])]
    return sc
def shoji():
    sc = []
    for i in range(3):
        x0, zz, ang = -0.6 + i * 0.6, (0.08 if i % 2 else -0.08), (0.25 if i % 2 else -0.25)
        panel = [(rbox((x0, 0.78, zz), (0.28, 0.76, 0.01), 0.004), MX['paper'])]
        for s in (-1, 1): panel.append((rbox((x0 + s * 0.28, 0.78, zz), (0.02, 0.78, 0.025), 0.006), M['walnut']))
        for y in (0.03, 0.52, 1.03, 1.53): panel.append((rbox((x0, y, zz), (0.3, 0.015, 0.02), 0.004), M['walnut']))
        panel.append((rbox((x0, 0.78, zz), (0.01, 0.76, 0.015)), M['walnut']))
        sc += [(xform(f, rot_y=ang, about=(x0, 0, zz)), m) for f, m in panel]
    return sc
def a_board(lines):
    board = [(rbox((0, 0.62, 0.0), (0.3, 0.42, 0.02), 0.012), M['oakT']), (rbox((0, 0.62, 0.016), (0.25, 0.36, 0.012), 0.004), MX['sign'])]
    for i, (w, m) in enumerate(lines): board.append((rbox((-0.05 + w * 0.1, 0.84 - i * 0.12, 0.03), (w * 0.2 + 0.03, 0.012, 0.004)), MX[m]))
    sc = [(xform(f, rot_x=0.12, about=(0, 0, 0)), m) for f, m in board]
    sc += [(cap((s * 0.24, 0.0, 0.08), (s * 0.24, 0.95, -0.03), 0.02), M['oak']) for s in (-1, 1)] + [(cap((0, 0.0, -0.3), (0, 0.9, -0.05), 0.02), M['oak'])]
    return sc
def rug(kind, w=0.9, d=0.9):
    return [(rbox((0, 0.008, 0), (w, 0.008, d), 0.004), {'rug': MX['rugR'], 'quilt': MX['quilt'], 'maple': MX['maple'], 'paw': MX['paw']}[kind])]
def cattree_small():
    return [(sub(rbox((0, 0.32, 0), (0.33, 0.32, 0.3), 0.06), cyl((0, 0.3, 0.32), 0.13, 0.2)), M['sisal']),
            (xform(cyl((0, 0.3, 0.3), 0.13, 0.005), rot_x=np.pi / 2, about=(0, 0.3, 0.3)), MX['soot']),
            (rbox((0, 0.68, 0), (0.37, 0.03, 0.34), 0.03), M['carpet']), (torus((0, 0.74, 0), 0.22, 0.05), MX['pinkpad'])]
def cat_bed():
    return [(cyl((0, 0.025, 0), 0.3, 0.025, 0.01), MX['bed']), (torus((0, 0.09, 0), 0.25, 0.085), MX['bed']), (cyl((0, 0.07, 0), 0.24, 0.02, 0.01), MX['bed2'])]

MODELS = {
    'table_round': round_table, 'table_square': table_square, 'table_cake': table_cake, 'coffee_table': coffee_table, 'coffee_table_cakes': lambda: coffee_table(True),
    'chabudai': chabudai, 'chair': chair_panel, 'chair_spindle': chair_spindle, 'stool': lambda: stool(M['oakT']), 'stool_green': lambda: stool(MX['green']),
    'stool_cream': lambda: stool(M['cream']), 'armchair': armchair, 'armchair_pink': lambda: armchair('rose', 'rose2'), 'sofa': sofa,
    'sofa_grey': lambda: [(f, {id(M['leather']): MX['grey'], id(M['leather2']): MX['grey2']}.get(id(m), m)) for f, m in sofa()],
    'zabuton': zabuton, 'wicker_chair': wicker, 'hay_bale': hay,
    'counter': counter_1, 'counter_long': counter_long, 'counter_register': counter_register, 'counter_beans': counter_beans, 'espresso': espresso_counter,
    'pastry': pastry, 'cake_counter': cake_counter, 'bookshelf': bookshelf, 'tea_hutch': tea_hutch, 'cup_hutch': cup_hutch,
    'plant_big': monstera, 'plant_small': plant_small, 'potted_fern': potted_fern, 'bonsai': bonsai, 'flower_box': flower_box, 'hanging_plant': hanging_plant,
    'pumpkins': pumpkins, 'apple_crate': apple_crate, 'gifts': gifts, 'xmas_tree': xmas_tree, 'fireplace': fireplace, 'floor_lamp': floor_lamp, 'andon': andon,
    'shoji_screen': shoji, 'menu_board': lambda: a_board([(0.6, 'chalk'), (0.4, 'chalkY'), (0.5, 'chalkP'), (0.3, 'chalk')]),
    'welcome_board': lambda: a_board([(0.7, 'chalkY'), (0.3, 'chalkP'), (0.5, 'chalk')]),
    'rug': lambda: rug('rug'), 'quilt_rug': lambda: rug('quilt'), 'maple_rug': lambda: rug('maple'), 'rug_paw': lambda: rug('paw', 0.42, 0.42),
    'cat_tree': cat_tree, 'cattree_small': cattree_small, 'cat_bed': cat_bed,
}
