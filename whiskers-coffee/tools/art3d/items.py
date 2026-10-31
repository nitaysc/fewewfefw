from sdf import *
M = dict(
    velvet=Mat('#6f9a5c', 6, 0.66), velvet2=Mat('#79a466', 6, 0.66), pillow=Mat('#efc96a', 5, 0.5),
    rose=Mat('#d98a94', 6, 0.62), rose2=Mat('#e39aa3', 6, 0.62),
    leather=Mat('#9a5a34', 6, 0.66, spec=0.25), leather2=Mat('#a8653c', 6, 0.66, spec=0.25),
    oak=Mat('#b07a4a', 6, 0.6, tex=wood(0, 70, 0.09)), oakT=Mat('#c99560', 6, 0.55, tex=wood(0, 70, 0.08, 3)),
    walnut=Mat('#6e4128', 6, 0.6, tex=wood(1, 60, 0.08, 5)), dark=Mat('#4a2c1c', 5, 0.55),
    cream=Mat('#f1e6d0', 5, 0.42), white=Mat('#f7f2ea', 5, 0.38), coffee=Mat('#6b3d24', 4, 0.4), foam=Mat('#e6c69a', 4, 0.35),
    steel=Mat('#b9c3c8', 6, 0.7, spec=0.9), steelD=Mat('#59636a', 5, 0.6, spec=0.5), red=Mat('#c8473f', 6, 0.6, spec=0.4),
    brass=Mat('#c9a04f', 6, 0.7, spec=0.9), shade=Mat('#f3dfae', 5, 0.4, emissive=0.35),
    pot=Mat('#c46a43', 6, 0.6), soil=Mat('#4a3020', 4, 0.4), leaf=Mat('#4f8a45', 6, 0.66), leaf2=Mat('#3f7a46', 6, 0.66), stem=Mat('#557a3a', 4, 0.5),
    sisal=Mat('#d6bd8c', 6, 0.55, tex=lambda p, n: 0.09 * (np.sin(p[:, 1] * 300) > 0.3)), carpet=Mat('#efe3c9', 5, 0.45), toy=Mat('#e46a5a', 5, 0.6),
    cake=Mat('#f4b6c0', 5, 0.45), sponge=Mat('#f2dcae', 5, 0.4), berry=Mat('#d9364a', 4, 0.5), choc=Mat('#6b3d2a', 5, 0.5),
    glass=Mat('#cfe8ee', 5, 0.35, spec=1.0), book1=Mat('#b5483c', 5, 0.5), book2=Mat('#3d5a8a', 5, 0.5), book3=Mat('#6d8a58', 5, 0.5), book4=Mat('#d29b3a', 5, 0.5),
)

def armchair(a='velvet', b='velvet2', W_=0.42, D_=0.38):
    return [
        (smin([rbox((0, 0.19, 0.0), (W_ - 0.02, 0.11, D_), 0.09), rbox((0, 0.5, -D_ + 0.11), (W_ - 0.06, 0.3, 0.11), 0.11)], 0.08), M[a]),
        (smin([rbox((-W_ + 0.085, 0.3, 0.02), (0.085, 0.14, D_), 0.07), cap((-W_ + 0.085, 0.44, -D_ + 0.05), (-W_ + 0.085, 0.44, D_ - 0.03), 0.095)], 0.05), M[a]),
        (smin([rbox((W_ - 0.085, 0.3, 0.02), (0.085, 0.14, D_), 0.07), cap((W_ - 0.085, 0.44, -D_ + 0.05), (W_ - 0.085, 0.44, D_ - 0.03), 0.095)], 0.05), M[a]),
        (rbox((0, 0.35, 0.07), (W_ - 0.17, 0.065, D_ - 0.1), 0.06), M[b]),
        (xform(rbox((0.08, 0.53, -0.16), (0.15, 0.13, 0.05), 0.06), rot_y=0.35, rot_x=-0.35, about=(0.08, 0.53, -0.16)), M['pillow']),
    ] + [(cap((x * (W_ - 0.08), 0.09, z * (D_ - 0.08)), (x * (W_ - 0.06), 0.0, z * (D_ - 0.06)), 0.024), M['walnut']) for x in (-1, 1) for z in (-1, 1)]

def sofa():
    W_, D_ = 0.9, 0.38
    sc = [
        (smin([rbox((0, 0.19, 0.0), (W_ - 0.02, 0.11, D_), 0.09), rbox((0, 0.5, -D_ + 0.11), (W_ - 0.06, 0.3, 0.11), 0.11)], 0.08), M['leather']),
        (smin([rbox((-W_ + 0.085, 0.3, 0.02), (0.085, 0.14, D_), 0.07), cap((-W_ + 0.085, 0.44, -D_ + 0.05), (-W_ + 0.085, 0.44, D_ - 0.03), 0.095)], 0.05), M['leather']),
        (smin([rbox((W_ - 0.085, 0.3, 0.02), (0.085, 0.14, D_), 0.07), cap((W_ - 0.085, 0.44, -D_ + 0.05), (W_ - 0.085, 0.44, D_ - 0.03), 0.095)], 0.05), M['leather']),
        (rbox((-0.36, 0.35, 0.07), (0.34, 0.065, D_ - 0.1), 0.06), M['leather2']),
        (rbox((0.36, 0.35, 0.07), (0.34, 0.065, D_ - 0.1), 0.06), M['leather2']),
        (rbox((-0.36, 0.6, -0.2), (0.33, 0.17, 0.07), 0.07), M['leather2']),
        (rbox((0.36, 0.6, -0.2), (0.33, 0.17, 0.07), 0.07), M['leather2']),
        (xform(rbox((-0.5, 0.55, -0.1), (0.14, 0.13, 0.05), 0.06), rot_y=-0.3, rot_x=-0.3, about=(-0.5, 0.55, -0.1)), M['pillow']),
        (xform(rbox((0.55, 0.55, -0.1), (0.13, 0.12, 0.05), 0.06), rot_y=0.3, rot_x=-0.3, about=(0.55, 0.55, -0.1)), M['rose2']),
    ]
    return sc + [(cap((x * (W_ - 0.08), 0.09, z * (D_ - 0.08)), (x * (W_ - 0.06), 0.0, z * (D_ - 0.06)), 0.024), M['walnut']) for x in (-1, 1) for z in (-1, 1)]

def mug(x, y, z, body='white', liquid='coffee', s=1.0):
    return [(sub(cyl((x, y + 0.045 * s, z), 0.04 * s, 0.045 * s, 0.01), cyl((x, y + 0.08 * s, z), 0.032 * s, 0.03 * s)), M[body]),
            (cyl((x, y + 0.075 * s, z), 0.033 * s, 0.004), M[liquid]),
            (torus((x + 0.045 * s, y + 0.045 * s, z), 0.02 * s, 0.007 * s, 'z'), M[body])]

def round_table():
    top = 0.72
    return [
        (cyl((0, top - 0.025, 0), 0.4, 0.025, 0.012), M['oakT']),
        (cyl((0, top - 0.06, 0), 0.37, 0.012, 0.005), M['walnut']),
        (cyl((0, top / 2 - 0.03, 0), 0.04, top / 2 - 0.05, 0.01), M['walnut']),
        (smin([cyl((0, 0.025, 0), 0.2, 0.025, 0.012), cyl((0, 0.06, 0), 0.07, 0.03, 0.01)], 0.04), M['walnut']),
    ] + mug(-0.12, top, 0.08, 'white', 'foam') + mug(0.13, top, -0.05, 'rose', 'coffee') + [
        (cyl((0.02, top + 0.006, 0.17), 0.075, 0.006, 0.003), M['white']),
        (xform(rbox((0.02, top + 0.04, 0.17), (0.045, 0.03, 0.03), 0.01), rot_y=0.5, about=(0.02, top + 0.04, 0.17)), M['sponge']),
        (xform(rbox((0.02, top + 0.074, 0.17), (0.046, 0.007, 0.031), 0.006), rot_y=0.5, about=(0.02, top + 0.074, 0.17)), M['cake']),
        (ell((0.03, top + 0.09, 0.17), (0.014, 0.014, 0.014)), M['berry']),
    ]

def chair():
    s, seat = 0.2, 0.46
    sc = [(rbox((0, seat - 0.03, 0.01), (s + 0.01, 0.025, s + 0.01), 0.02), M['oakT'])]
    for x in (-1, 1):
        for z in (-1, 1):
            sc.append((cap((x * (s - 0.03), 0, z * (s - 0.03)), (x * (s - 0.035), seat - 0.04, z * (s - 0.035)), 0.017), M['oak']))
        sc.append((cap((x * (s - 0.03), seat, -s + 0.03), (x * (s - 0.035), seat + 0.5, -s + 0.04), 0.019), M['oak']))
    sc.append((rbox((0, seat + 0.48, -s + 0.04), (s, 0.04, 0.02), 0.015), M['oakT']))
    for k in (-1, 0, 1): sc.append((cap((k * 0.07, seat + 0.02, -s + 0.04), (k * 0.07, seat + 0.44, -s + 0.04), 0.012), M['oak']))
    sc.append((rbox((0, 0.14, 0), (s - 0.03, 0.008, 0.008), 0.006), M['oak']))
    return sc

def espresso_counter():
    w, h, d = 0.95, 0.88, 0.36
    sc = [
        (rbox((0, h / 2 - 0.03, 0), (w - 0.03, h / 2 - 0.03, d - 0.04), 0.02), M['walnut']),
        (rbox((0, h - 0.02, 0), (w, 0.03, d), 0.015), M['cream']),
        (rbox((0, 0.04, 0.02), (w - 0.05, 0.04, d - 0.04), 0.01), M['dark']),
    ]
    for i in range(4):
        sc.append((rbox((-w + 0.24 + i * 0.475, h / 2, d - 0.035), (0.2, h / 2 - 0.12, 0.012), 0.02), M['oak']))
    mx, my = -0.32, h + 0.01
    sc += [
        (rbox((mx, my + 0.2, -0.05), (0.33, 0.2, 0.2), 0.05), M['steel']),
        (rbox((mx, my + 0.36, -0.05), (0.335, 0.045, 0.205), 0.03), M['red']),
        (cyl((mx, my + 0.24, 0.155), 0.045, 0.015, 0.006), M['white']),
        (rbox((mx, my + 0.015, 0.1), (0.3, 0.015, 0.1), 0.008), M['steelD']),
    ]
    for gx in (mx - 0.15, mx + 0.15):
        sc += [(cyl((gx, my + 0.13, 0.13), 0.045, 0.03, 0.01), M['steelD']), (cap((gx, my + 0.11, 0.17), (gx, my + 0.11, 0.3), 0.016), M['dark'])]
        sc += mug(gx, my + 0.03, 0.12, 'white', 'coffee', 0.9)
    for i in range(3): sc += mug(mx - 0.2 + i * 0.2, my + 0.405, -0.08, ['white', 'rose', 'cream'][i], 'coffee', 0.9)
    gx = 0.25
    sc += [(rbox((gx, my + 0.13, -0.05), (0.08, 0.13, 0.09), 0.025), M['dark']), (cyl((gx, my + 0.33, -0.05), 0.07, 0.08, 0.02), M['glass']),
           (cyl((gx, my + 0.3, -0.05), 0.062, 0.045, 0.01), M['choc'])]
    for i in range(3):
        bx = 0.55 + i * 0.13
        sc += [(cyl((bx, my + 0.08, -0.1 + (i % 2) * 0.06), 0.05, 0.08, 0.015), M['glass']), (cyl((bx, my + 0.06, -0.1 + (i % 2) * 0.06), 0.045, 0.055, 0.01), [M['choc'], M['foam'], M['coffee']][i]),
               (cyl((bx, my + 0.17, -0.1 + (i % 2) * 0.06), 0.053, 0.014, 0.006), M['oakT'])]
    return sc

def monstera():
    sc = [(sub(cyl((0, 0.17, 0), 0.19, 0.17, 0.03), cyl((0, 0.3, 0), 0.16, 0.1)), M['pot']), (cyl((0, 0.31, 0), 0.165, 0.012), M['soil'])]
    rs = np.random.RandomState(4)
    for i in range(9):
        a = i / 9 * np.pi * 2 + rs.rand() * 0.5
        hgt = 0.55 + rs.rand() * 0.55; L = 0.17 + rs.rand() * 0.06
        bx, bz = np.cos(a) * (0.08 + hgt * 0.25), np.sin(a) * (0.08 + hgt * 0.25)
        sc.append((cap((0, 0.3, 0), (bx, 0.3 + hgt, bz), 0.012), M['stem']))
        leaf = ell((bx + np.cos(a) * L * 0.8, 0.3 + hgt, bz + np.sin(a) * L * 0.8), (L, 0.018, L * 0.75))
        leaf = xform(leaf, rot_y=-a, about=(bx, 0.3 + hgt, bz))
        leaf = xform(leaf, rot_z=0.0, rot_x=0.35 * np.sin(a) - 0.2, about=(bx, 0.3 + hgt, bz))
        sc.append((leaf, M['leaf'] if i % 2 else M['leaf2']))
    return sc

def floor_lamp():
    return [(cyl((0, 0.02, 0), 0.16, 0.02, 0.01), M['dark']), (cyl((0, 0.65, 0), 0.016, 0.62), M['brass']),
            (sub(cyl((0, 1.33, 0), 0.2, 0.13, 0.02), cyl((0, 1.33, 0), 0.18, 0.16)), M['shade']), (ell((0, 1.24, 0), (0.06, 0.06, 0.06)), M['white'])]

def cat_tree():
    return [(rbox((0, 0.04, 0), (0.42, 0.04, 0.38), 0.03), M['carpet']),
            (cyl((-0.18, 0.6, -0.12), 0.065, 0.56), M['sisal']), (cyl((0.2, 0.35, 0.1), 0.06, 0.32), M['sisal']),
            (cyl((0.17, 0.7, 0.08), 0.26, 0.035, 0.03), M['carpet']), (cyl((-0.15, 1.18, -0.12), 0.3, 0.04, 0.035), M['carpet']),
            (torus((-0.15, 1.24, -0.12), 0.22, 0.05), M['carpet']),
            (cap((0.38, 0.69, 0.1), (0.38, 0.48, 0.1), 0.006), M['dark']), (ell((0.38, 0.45, 0.1), (0.04, 0.04, 0.04)), M['toy'])]

def bookshelf():
    w, h, d = 0.44, 0.95, 0.17
    sc = [(rbox((0, h, -d + 0.01), (w, h, 0.012), 0.005), M['dark'])]
    for x in (-1, 1): sc.append((rbox((x * (w - 0.02), h, 0), (0.025, h, d), 0.01), M['walnut']))
    sc.append((rbox((0, 2 * h - 0.01, 0), (w + 0.02, 0.025, d + 0.02), 0.01), M['walnut']))
    rs = np.random.RandomState(7)
    for k in range(4):
        y = 0.04 + k * 0.47
        sc.append((rbox((0, y, 0), (w - 0.04, 0.018, d - 0.01), 0.006), M['walnut']))
        x = -w + 0.06
        while x < w - 0.08:
            bw = 0.025 + rs.rand() * 0.02; bh = 0.14 + rs.rand() * 0.12
            if k == 3 and x > 0: 
                sc += [(sub(cyl((x + 0.12, y + 0.12, 0), 0.08, 0.1, 0.02), cyl((x + 0.12, y + 0.2, 0), 0.065, 0.1)), M['pot']), (ell((x + 0.12, y + 0.26, 0.02), (0.11, 0.07, 0.09)), M['leaf'])]
                break
            sc.append((rbox((x + bw, y + 0.018 + bh, 0.0), (bw - 0.003, bh, d - 0.04), 0.004), M[['book1', 'book2', 'book3', 'book4', 'cream'][rs.randint(5)]]))
            x += bw * 2 + 0.002
    return sc

ITEMS = [('armchair', armchair(), 0.36, 64, 46), ('armchair_rose', armchair('rose', 'rose2'), 0.36, 64, 46), ('sofa', sofa(), 0.36, 100, 46),
         ('table', round_table(), 0.42, 64, 46), ('chair', chair(), 0.48, 56, 46), ('espresso', espresso_counter(), 0.62, 110, 46),
         ('monstera', monstera(), 0.62, 64, 46), ('lamp', floor_lamp(), 0.74, 40, 46), ('cattree', cat_tree(), 0.66, 64, 46), ('bookshelf', bookshelf(), 0.96, 60, 46)]
