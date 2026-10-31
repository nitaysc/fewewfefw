# Café shell: floors, both back walls in every style, and the wall features.
from items import *
from models import MX
W, H, WH, T = 11, 9, 2.4, 0.14

def floor_tex(kind, cols):
    if kind == 'planks':
        def t(p, n):
            row = np.floor(p[:, 2] / 0.25); off = (np.sin(row * 7.13) * 0.5 + 0.5) * 1.7
            seam = ((p[:, 2] / 0.25) % 1 < 0.09); joint = (((p[:, 0] + off) / 1.7) % 1 < 0.012)
            tone = (np.sin(row * 12.9898 + np.floor((p[:, 0] + off) / 1.7) * 3.1) * 43758.5453) % 1
            return -0.14 * (seam | joint) + (tone - 0.5) * 0.08
        return t
    if kind == 'checker':
        return lambda p, n: 0.5 * (((np.floor(p[:, 0] * 2) + np.floor(p[:, 2] * 2)) % 2) == 0) - 0.25
    if kind == 'tiles':
        return lambda p, n: -0.18 * ((((p[:, 0] * 2) % 1) < 0.06) | (((p[:, 2] * 2) % 1) < 0.06)) + 0.06 * (np.sin(np.floor(p[:, 0] * 2) * 5.3 + np.floor(p[:, 2] * 2) * 9.1) )
    if kind == 'tatami':
        return lambda p, n: -0.2 * ((((p[:, 2] + np.floor(p[:, 0] / 2) * 0.5) % 1) < 0.05) | (((p[:, 0] / 2) % 1) < 0.025)) - 0.04 * ((p[:, 2] * 40) % 1 < 0.3)
FLOORS = {'oak': ('planks', '#c08250'), 'walnut': ('planks', '#6a452c'), 'birch': ('planks', '#d8b386'), 'checker': ('checker', '#b49a82'),
          'terracotta': ('tiles', '#bd6a46'), 'tatami': ('tatami', '#c2bb7c')}

def floor_scene(style):
    kind, col = FLOORS[style]
    fm = Mat(col, 6, 0.5 if kind != 'checker' else 0.75, tex=floor_tex(kind, col), hs=-0.03)
    return [(rbox((W / 2, -0.05, H / 2), (W / 2, 0.05, H / 2)), fm), (rbox((W / 2, -0.3, H / 2), (W / 2 + 0.03, 0.2, H / 2 + 0.03), 0.02), Mat('#4a2e1f', 4, 0.4))]

WALLS = {
    'cream': ('#f3e6cc', 'stripe', '#e2cfab', '#6e4630'), 'sage': ('#b4c29a', 'stripe', '#9fb184', '#4f3a28'), 'rose': ('#ecd0c4', 'dots', '#c9786f', '#6e4630'),
    'navy': ('#45527a', 'dots', '#d2b05a', '#3b261a'), 'brick': ('#a2553c', 'brick', '#d9c3a5', '#4a3020'), 'shoji': ('#f1e7d0', 'grid', '#6e4630', '#b98a5a'),
    'cabin': ('#9c6a42', 'planks', '#5e3c24', '#5b3a26'),
}
def wall_tex(pattern, axis):
    if pattern == 'stripe': return lambda p, n: -0.08 * ((p[:, axis] * 5) % 1 < 0.28)
    if pattern == 'dots': return lambda p, n: 0.35 * ((((p[:, axis] * 5) % 1 - 0.5) ** 2 + (((p[:, 1] * 5 + np.floor(p[:, axis] * 5) * 0.5) % 1) - 0.5) ** 2) < 0.02)
    if pattern == 'brick':
        return lambda p, n: -0.3 * ((((p[:, 1] * 6) % 1) < 0.1) | ((((p[:, axis] * 3 + np.floor(p[:, 1] * 6) * 0.5) % 1) < 0.05))) + 0.06 * np.sin(np.floor(p[:, axis] * 3 + np.floor(p[:, 1] * 6) * 0.5) * 7 + np.floor(p[:, 1] * 6) * 3)
    if pattern == 'grid': return lambda p, n: -0.35 * ((((p[:, axis] * 2.5) % 1) < 0.05) | (((p[:, 1] * 2) % 1) < 0.04))
    if pattern == 'planks': return lambda p, n: -0.2 * (((p[:, axis] * 4) % 1) < 0.06) + 0.05 * np.sin(np.floor(p[:, axis] * 4) * 9)
def panels(axis):
    def t(p, n):
        u = (p[:, axis] * 1.4) % 1; v = p[:, 1]
        return np.where((u < 0.09) | (u > 0.91) | (v < 0.18) | (v > 0.66), 0.06, -0.09)
    return t
def wall_scene(style, side):
    base, pat, acc, wains = WALLS[style]
    ax = 0 if side == 'n' else 2
    paper = Mat(base, 5, 0.25, tex=wall_tex(pat, ax), hs=-0.01, hl=0.0)
    if pat == 'dots': paper = Mat(base, 6, 0.4, tex=wall_tex(pat, ax), hs=-0.01, hl=0.0)
    wm = Mat(wains, 6, 0.5, tex=panels(ax)); trim = Mat('#e2c49a', 5, 0.45); dark = Mat('#3d261a', 4, 0.4)
    L = W if side == 'n' else H
    def box(c, h, m, r=0.0):
        if side == 'n': return (rbox((c[0], c[1], c[2]), h, r), m)
        return (rbox((c[2], c[1], c[0]), (h[2], h[1], h[0]), r), m)
    sc = [box((L / 2, WH / 2 + 0.45, -T / 2), (L / 2 + T, WH / 2 - 0.45, T / 2), paper),
          box((L / 2, 0.45, -T / 2 + 0.01), (L / 2 + T, 0.45, T / 2), wm),
          box((L / 2, 0.92, 0.0), (L / 2, 0.025, 0.04), trim, 0.01), box((L / 2, 0.045, 0.0), (L / 2, 0.045, 0.03), dark, 0.005),
          box((L / 2, WH + 0.04, -T / 2 + 0.03), (L / 2 + T, 0.05, T / 2 + 0.06), trim, 0.01)]
    # ivy trailing along the top
    rs = np.random.RandomState(3 if side == 'n' else 5)
    u = 0.3
    while u < L - 0.3:
        drop = max(0, np.sin(u * 1.3 + (0 if side == 'n' else 2)) * 0.45 + rs.rand() * 0.15)
        blobs = [ell((u + (rs.rand() - 0.5) * 0.1, WH - 0.05 - k * 0.09, 0.05), (0.07, 0.05, 0.03)) for k in range(1 + int(drop * 9))]
        f = smin(blobs, 0.04)
        if side == 'w': f = (lambda g: (lambda p: g(p[:, [2, 1, 0]])))(f)
        sc.append((f, M['leaf'] if rs.rand() < 0.5 else M['leaf2']))
        u += 0.35 + rs.rand() * 0.3
    return sc

# wall features: centred at u = 0 on a wall facing +z, standing on y = 0
sky = Mat('#a8d4ee', 5, 0.3, emissive=0.85)
def feature(kind, length):
    fr = Mat('#f6efe2', 5, 0.35)
    if kind == 'window':
        w2, y0, h2 = length / 2 - 0.08, 1.55, 0.55
        sc = [(rbox((0, y0, 0.0), (w2, h2, 0.012)), sky)]
        for dx in (-w2, 0.0, w2): sc.append((rbox((dx, y0, 0.03), (0.035, h2 + 0.02, 0.035), 0.01), fr))
        for dy in (-h2, 0.0, h2): sc.append((rbox((0, y0 + dy, 0.03), (w2 + 0.03, 0.035, 0.035), 0.01), fr))
        sc.append((rbox((0, y0 - h2 - 0.05, 0.08), (w2 + 0.1, 0.025, 0.09), 0.01), fr))
        sc += [(sub(cyl((-w2 + 0.25, y0 - h2 + 0.02, 0.09), 0.06, 0.05, 0.015), cyl((-w2 + 0.25, y0 - h2 + 0.08, 0.09), 0.045, 0.04)), M['pot']), (ell((-w2 + 0.25, y0 - h2 + 0.12, 0.09), (0.08, 0.06, 0.07)), M['leaf'])]
        return sc
    if kind == 'chalkboard':
        sc = [(rbox((0, 1.55, 0.02), (length / 2 - 0.05, 0.42, 0.025), 0.02), MX['sign']), (rbox((0, 1.55, 0.0), (length / 2, 0.47, 0.022), 0.02), M['walnut'])]
        for i, (w, m) in enumerate(((0.5, 'chalk'), (0.35, 'chalkY'), (0.45, 'chalkP'), (0.3, 'chalk'), (0.4, 'chalkY'))):
            sc.append((rbox((-0.25 + w * 0.25, 1.82 - i * 0.12, 0.05), (w * 0.5, 0.012, 0.004)), MX[m]))
            sc.append((rbox((0.6, 1.82 - i * 0.12, 0.05), (0.06, 0.012, 0.004)), MX['chalkY']))
        return sc
    if kind == 'clock':
        return [(xform(cyl((0, 1.95, 0.03), 0.22, 0.03, 0.015), rot_x=np.pi / 2, about=(0, 1.95, 0.03)), M['walnut']),
                (xform(cyl((0, 1.95, 0.05), 0.19, 0.012), rot_x=np.pi / 2, about=(0, 1.95, 0.05)), M['white']),
                (cap((0, 1.95, 0.07), (0.06, 2.04, 0.07), 0.012), M['dark']), (cap((0, 1.95, 0.07), (-0.1, 1.9, 0.07), 0.01), M['dark'])]
    if kind == 'painting':
        h2 = length * 0.36
        art = Mat('#8fbf7a', 6, 0.5, tex=lambda p, n: 0.35 * (p[:, 1] > 1.62 + 0.1 * np.sin(p[:, 0] * 7 + p[:, 2] * 7)) - 0.15 * (p[:, 1] < 1.5))
        return [(rbox((0, 1.6, 0.02), (length / 2, h2, 0.025), 0.02), M['brass']), (rbox((0, 1.6, 0.04), (length / 2 - 0.07, h2 - 0.07, 0.012)), art)]
    if kind == 'shelf':
        sc = []
        for y, seed in ((1.4, 1), (1.9, 2)):
            sc.append((rbox((0, y, 0.12), (length / 2, 0.022, 0.12), 0.01), M['oakT']))
            rs = np.random.RandomState(seed)
            for i in range(5):
                x = -length / 2 + 0.22 + i * (length - 0.44) / 4
                if rs.rand() < 0.65:
                    sc += [(cyl((x, y + 0.11, 0.12), 0.055, 0.09, 0.015), M['glass']), (cyl((x, y + 0.08, 0.12), 0.05, 0.06, 0.01), [M['choc'], M['foam'], M['coffee']][i % 3]), (cyl((x, y + 0.21, 0.12), 0.058, 0.014, 0.006), M['oakT'])]
                else:
                    sc += [(sub(cyl((x, y + 0.08, 0.12), 0.07, 0.06, 0.02), cyl((x, y + 0.14, 0.12), 0.055, 0.04)), M['pot']), (ell((x, y + 0.2, 0.12), (0.1, 0.07, 0.09)), M['leaf'])]
        return sc
    if kind == 'door':
        door = Mat('#7a4a2e', 6, 0.5, tex=lambda p, n: -0.12 * ((np.abs(p[:, 0]) > length / 2 - 0.12) | (np.abs(p[:, 1] - 1.0) > 0.92)))
        return [(rbox((0, 1.02, 0.02), (length / 2 - 0.05, 1.0, 0.03), 0.02), door), (rbox((0, 1.4, 0.05), (length / 2 - 0.25, 0.32, 0.01), 0.02), sky),
                (rbox((0, 2.08, 0.04), (length / 2 + 0.08, 0.07, 0.06), 0.02), M['walnut'])] + \
               [(rbox((s * (length / 2 + 0.02), 1.05, 0.04), (0.05, 1.05, 0.06), 0.015), M['walnut']) for s in (-1, 1)] + \
               [(ell((length / 2 - 0.2, 1.0, 0.07), (0.035, 0.035, 0.035)), M['brass']), (rbox((0, 0.008, 0.3), (length / 2 - 0.1, 0.008, 0.25), 0.004), MX['paw'])]
    return []
