# Drinks and dishes, modelled like the furniture. Units: a cup is about 0.5-1 tall; the build
# script picks the scale for each size.
from sdf import *
import numpy as np

def mat(c, n=6, s=0.55, **k): return Mat(c, n, s, **k)
INK = (70, 40, 32)
def O(m, col=INK): m.outline = col; return m
LIQ = {  # colour of each component seen in a glass
    'espresso': '#4a2a18', 'water': '#6b4026', 'milk': '#efe2c8', 'foam': '#fbf4e6', 'coldmilk': '#f4ead8', 'coldwater': '#d6ecf2',
    'choc': '#5a3220', 'matcha': '#8fbf5a', 'berry': '#e86a86', 'lemon': '#f6e070', 'orange': '#f6a03a', 'tea': '#9a4a22',
    'vanilla': '#f2e2b8', 'caramelsyrup': '#c9822f', 'chocsyrup': '#3a1e12', 'chai': '#c48a5a',
}
# what each drink looks like, bottom to top: (component, share of the cup)
LAYERS = {
    'espresso': [('espresso', 0.8)], 'americano': [('water', 0.88)], 'latte': [('espresso', 0.25), ('milk', 0.55), ('foam', 0.12)],
    'hotchoc': [('choc', 0.86)], 'cappuccino': [('espresso', 0.3), ('milk', 0.22), ('foam', 0.38)], 'flatwhite': [('espresso', 0.38), ('milk', 0.5)],
    'tea': [('tea', 0.85)], 'iced': [('espresso', 0.24), ('coldmilk', 0.62)], 'mocha': [('chocsyrup', 0.12), ('espresso', 0.25), ('milk', 0.45), ('foam', 0.1)],
    'strawberry': [('berry', 0.22), ('coldmilk', 0.66)], 'lemonade': [('lemon', 0.18), ('coldwater', 0.7)], 'orangejuice': [('orange', 0.88)],
    'chai': [('chai', 0.78)], 'macchiato': [('vanilla', 0.08), ('milk', 0.55), ('foam', 0.1), ('espresso', 0.2)],
    'matcha': [('matcha', 0.3), ('milk', 0.5), ('foam', 0.12)], 'affogato': [('espresso', 0.3)],
}
TOP = {  # colour of the surface you see from above
    'espresso': '#7a4a2a', 'americano': '#5a3420', 'latte': '#c99a6a', 'hotchoc': '#6b3a22', 'cappuccino': '#f1e2c6', 'flatwhite': '#b98454', 'tea': '#a85a2a',
    'iced': '#c8a27a', 'mocha': '#8a5a3a', 'strawberry': '#f2a8b8', 'lemonade': '#f2e6a0', 'orangejuice': '#f6a03a', 'chai': '#e2c49a', 'macchiato': '#d9a874',
    'matcha': '#a8cc78', 'affogato': '#6b3a22',
}
VES = {  # radius, height, body colour, kind
    'demi': (0.26, 0.3, '#f7f1e6', 'ceramic'), 'cup': (0.36, 0.34, '#f7f1e6', 'ceramic'), 'mug': (0.3, 0.52, '#d9826f', 'ceramic'),
    'glass': (0.29, 0.6, None, 'glass'), 'tall': (0.24, 0.9, None, 'glass'),
}
def heart2d(cx, cz, s):
    def f(p):
        x = (p[:, 0] - cx) / s; y = -(p[:, 2] - cz) / s + 0.3
        a = x * x + y * y - 1
        return np.where(a ** 3 - x * x * y ** 3 <= 0, -1.0, 1.0) * 0.01
    return f
def leaf2d(cx, cz, s):
    def f(p):
        x = (p[:, 0] - cx) / s; z = (p[:, 2] - cz) / s
        inside = (x * x / 0.25 + z * z) < 1
        vein = (np.abs(x) < 0.07) | ((np.abs(z - np.abs(x) * 1.2 + 0.1) % 0.45) < 0.12)
        return np.where(inside & ~vein, -1.0, 1.0) * 0.01
    return f

def drink(id_, vessel, extra=''):
    r, h, body, kind = VES[vessel]
    sc = []
    white = O(mat('#fbf7ef', 5, 0.35))
    fill = sum(a for _, a in LAYERS[id_])
    fill = min(0.92, fill)
    top_y = 0.03 + h * fill
    if kind == 'ceramic':
        bm = O(mat(body, 6, 0.45, spec=0.5))
        outer = rcone((0, 0.0, 0), (0, h + r, 0), r * 0.78, r * 1.08)
        inner = rcone((0, 0.06, 0), (0, h + r, 0), r * 0.7, r * 1.08 - 0.035)
        cup = lambda p: np.maximum(np.maximum(np.maximum(outer(p), p[:, 1] - h), -p[:, 1]), -np.maximum(inner(p), 0.06 - p[:, 1]))
        sc.append((cup, bm))
        sc.append((torus((r + 0.07, h * 0.55, 0), 0.07, 0.022, 'z'), bm))
        if vessel in ('demi', 'cup'):
            sc.append((cyl((0, 0.015, 0), r + 0.2, 0.015, 0.012), white))
            sc.append((torus((0, 0.025, 0), r + 0.17, 0.018), white))
        surf = lambda p: np.maximum(inner(p) + 0.004, np.abs(p[:, 1] - top_y) - 0.01)
    else:
        rim = O(mat('#e9f5f8', 4, 0.3, spec=1.0), (90, 120, 130))
        y = 0.04
        for comp, amt in LAYERS[id_]:
            hh = h * amt * (fill / sum(a for _, a in LAYERS[id_]))
            sc.append((cyl((0, y + hh / 2, 0), r - 0.02, hh / 2 + 0.002), O(mat(LIQ[comp], 5, 0.4), tuple(int(v * 0.6) for v in ramp(LIQ[comp])[0]))))
            y += hh
        top_y = y
        sc.append((cyl((0, 0.02, 0), r, 0.025, 0.01), rim))                       # thick glass base
        sc.append((torus((0, h, 0), r - 0.01, 0.014), rim))                        # rim
        wall = sub(cyl((0, (top_y + h) / 2, 0), r, (h - top_y) / 2 + 0.005), cyl((0, (top_y + h) / 2, 0), r - 0.02, (h - top_y) / 2 + 0.05))
        sc.append((wall, O(mat('#dcecf0', 4, 0.25, spec=1.0), (120, 150, 160))))
        sc.append((rbox((-r * 0.55, (h + 0.05) / 2, r * 0.8), (0.018, h / 2 - 0.06, 0.01), 0.008), O(mat('#ffffff', 3, 0.1, emissive=0.9), (200, 220, 230))))
        if vessel == 'glass': sc.append((torus((r + 0.07, h * 0.5, 0), 0.09, 0.022, 'z'), rim))
        surf = cyl((0, top_y - 0.006, 0), r - 0.02, 0.008)
    topm = O(mat(TOP[id_], 5, 0.35))
    sc.append((surf, topm))
    art = None
    if id_ in ('latte', 'flatwhite'): art = heart2d(0, 0.02, r * 0.45)
    if id_ == 'matcha': art = leaf2d(0, 0.0, r * 0.6)
    if art is not None: sc.append((inter(lambda p: surf(p) - 0.003, art), O(mat('#fbf4e6', 4, 0.25))))
    if id_ in ('cappuccino', 'chai') or extra == 'cinnamon':
        dust = mat('#8a4a28', 4, 0.3)
        sc.append((inter(lambda p: surf(p) - 0.003, lambda p: np.where(((np.sin(p[:, 0] * 160) * np.sin(p[:, 2] * 170)) > 0.55) & (p[:, 0] ** 2 + p[:, 2] ** 2 < (r * 0.75) ** 2), -1, 1) * 0.01), dust))
    if id_ == 'mocha' or id_ == 'macchiato' or extra == 'caramel':
        dc = '#3a1e12' if id_ == 'mocha' else '#c9822f'
        sc.append((inter(lambda p: surf(p) - 0.004, lambda p: np.where((np.abs(np.sin((p[:, 0] + p[:, 2]) * 30)) < 0.25) | (np.abs(np.sin((p[:, 0] - p[:, 2]) * 30)) < 0.25), -1, 1) * 0.01), O(mat(dc, 4, 0.4, spec=0.6))))
    if id_ == 'hotchoc':
        for i, (x, z) in enumerate(((-0.1, 0.05), (0.08, -0.06), (0.06, 0.1))):
            sc.append((xform(rbox((x, top_y + 0.03, z), (0.05, 0.035, 0.05), 0.025), rot_y=i * 0.7, about=(x, top_y, z)), O(mat(['#fbeff0', '#f6c8d4', '#fbeff0'][i], 4, 0.3))))
    if id_ in ('iced', 'strawberry', 'lemonade'):
        ice = O(mat('#eaf6fa', 4, 0.3, spec=1.0), (120, 160, 175))
        for i, (x, z) in enumerate(((-0.08, 0.05), (0.07, -0.05), (0.0, 0.1))):
            sc.append((xform(rbox((x, top_y - 0.02 + i * 0.03, z), (0.055, 0.055, 0.055), 0.015), rot_y=i, rot_x=0.4, about=(x, top_y, z)), ice))
    if vessel == 'tall':
        straw = O(mat('#e46a5a', 4, 0.4))
        sc.append((cap((0.05, 0.1, 0.0), (0.16, h + 0.22, -0.04), 0.022), straw))
    if id_ in ('lemonade', 'strawberry'): sc.append((ell((-0.08, top_y + 0.05, 0.03), (0.07, 0.015, 0.04)), O(mat('#5c9a48', 5, 0.4))))
    if id_ in ('lemonade', 'orangejuice'):
        c = '#f6e070' if id_ == 'lemonade' else '#f6a03a'
        sc.append((xform(cyl((r * 0.9, h - 0.02, 0.0), 0.11, 0.015, 0.008), rot_z=1.3, about=(r * 0.9, h - 0.02, 0)), O(mat(c, 5, 0.4))))
    if id_ == 'strawberry': sc.append((ell((r * 0.85, h + 0.02, 0.0), (0.07, 0.08, 0.07)), O(mat('#d9364a', 5, 0.5, spec=0.5))))
    if id_ == 'tea':
        sc += [(cap((r * 0.6, top_y, 0.05), (r + 0.02, h + 0.02, 0.05), 0.006), mat('#f4efe6', 3, 0.2)), (rbox((r + 0.06, h - 0.12, 0.06), (0.05, 0.06, 0.008), 0.004), O(mat('#c8473f', 4, 0.4)))]
    if id_ == 'affogato': sc.append((ell((0, top_y + 0.07, 0), (0.15, 0.12, 0.15)), O(mat('#fbf3e0', 5, 0.35))))
    if extra == 'cream' or (id_ == 'hotchoc' and extra == 'cream'):
        cm = O(mat('#fffaf0', 5, 0.35))
        cr = smin([torus((0, top_y + 0.03, 0), r * 0.55, 0.06), torus((0, top_y + 0.1, 0), r * 0.35, 0.055), ell((0, top_y + 0.17, 0), (0.08, 0.08, 0.08))], 0.04)
        sc.append((cr, cm))
    return sc

# ---------- food ----------
def plate(r=0.62):
    w = O(mat('#fbf7ef', 5, 0.35, spec=0.4))
    return [(cyl((0, 0.02, 0), r, 0.02, 0.015), w), (torus((0, 0.04, 0), r - 0.06, 0.03), w)]
def wedge(r, y0, y1, ang=0.9, rot=0.0):
    c = cyl((0, (y0 + y1) / 2, 0), r, (y1 - y0) / 2, 0.012)
    a1, a2 = rot - ang / 2, rot + ang / 2
    n1 = np.array([np.sin(a1), 0, -np.cos(a1)]); n2 = np.array([-np.sin(a2), 0, np.cos(a2)])
    return lambda p: np.maximum(c(p), np.maximum(p @ n1, p @ n2))
def slice_(sponge, layers, top, rot=-0.6, r=0.55):
    sc = []
    y = 0.05
    for (h, m) in layers:
        sc.append((xform(wedge(r, y, y + h), about=(0, 0, 0), rot_y=0), m)); y += h
    sc = [(lambda f: (lambda p: f(p - np.array([-0.18, 0, -0.05]))))(f) for f, _ in sc], [m for _, m in sc]
    sc = list(zip(*sc))
    return [(xform(f, rot_y=rot), m) for f, m in sc], y
def berry(x, y, z, col='#d9364a', r=0.07):
    return [(ell((x, y, z), (r, r * 1.1, r)), O(mat(col, 5, 0.5, spec=0.6))), (ell((x, y + r, z), (r * 0.6, 0.015, r * 0.6)), O(mat('#4f8a45', 4, 0.4)))]
def blue(x, y, z): return [(ell((x, y, z), (0.04, 0.04, 0.04)), O(mat('#3d4a8b', 4, 0.5, spec=0.6)))]
def dollop(x, y, z, s=1.0): return [(smin([ell((x, y + 0.03 * s, z), (0.07 * s, 0.05 * s, 0.07 * s)), ell((x, y + 0.07 * s, z), (0.045 * s, 0.04 * s, 0.045 * s)), ell((x, y + 0.1 * s, z), (0.02 * s, 0.03 * s, 0.02 * s))], 0.03), O(mat('#fffaf0', 4, 0.3)))]
def bowl(col='#f4efe6'):
    b = O(mat(col, 5, 0.4, spec=0.4))
    return [(sub(ell((0, 0.18, 0), (0.55, 0.3, 0.55)), ell((0, 0.26, 0), (0.5, 0.28, 0.5))), b), (lambda p: np.maximum(ell((0, 0.18, 0), (0.56, 0.31, 0.56))(p), p[:, 1] - 0.3) if False else cyl((0, 0.02, 0), 0.25, 0.02, 0.01)(p), b)]
def cut_bowl(sc):
    # keep only the part of the bowl below the rim
    return [(lambda p, f=f: np.maximum(f(p), p[:, 1] - 0.3), m) for f, m in sc]

def food(id_):
    sponge = O(mat('#f2dcae', 5, 0.4)); cream = O(mat('#fffaf0', 4, 0.3)); choc = O(mat('#5a3020', 6, 0.5, spec=0.3))
    if id_ == 'croissant':
        gold = O(mat('#d9963e', 6, 0.55, tex=lambda p, n: -0.12 * (np.sin(np.arctan2(p[:, 2], p[:, 0] + 0.1) * 14) > 0.6)), (110, 60, 25))
        pts = [(np.cos(a) * 0.32 - 0.05, 0.1, np.sin(a) * 0.32 * 0.7) for a in np.linspace(-2.4, -0.7, 7)]
        cro = smin([ell(pt, (0.09 + 0.06 * np.sin(i / 6 * np.pi), 0.08 + 0.04 * np.sin(i / 6 * np.pi), 0.1 + 0.05 * np.sin(i / 6 * np.pi))) for i, pt in enumerate(pts)], 0.05)
        return plate() + [(cro, gold), (rbox((0.25, 0.08, 0.2), (0.06, 0.03, 0.05), 0.012), O(mat('#f6e08a', 4, 0.35)))] + [(ell((0.3 + i * 0.06, 0.045, -0.2 + i * 0.05), (0.04, 0.008, 0.035)), O(mat('#b5304a', 4, 0.4, spec=0.5))) for i in range(3)]
    if id_ == 'shortcake':
        sl, y = slice_(sponge, [(0.1, sponge), (0.04, cream), (0.1, sponge), (0.05, cream)], None)
        return plate() + sl + berry(-0.12, y + 0.07, 0.0) + berry(0.02, y + 0.07, -0.06) + dollop(-0.25, y, 0.08, 0.8) + berry(0.3, 0.1, 0.25, r=0.06)
    if id_ == 'chococake':
        sl, y = slice_(choc, [(0.12, choc), (0.03, O(mat('#3a1e12', 4, 0.4))), (0.12, choc), (0.03, O(mat('#3a1e12', 4, 0.4, spec=0.6)))], None)
        sauce = O(mat('#3a1e12', 4, 0.4, spec=0.7))
        return plate() + sl + [(berry(-0.12, y + 0.06, 0.0, '#c2305a', 0.06)[0][0], O(mat('#c2305a', 5, 0.5, spec=0.5))), (berry(0.02, y + 0.06, -0.06, '#c2305a', 0.06)[0][0], O(mat('#c2305a', 5, 0.5)))] + \
               [(ell((0.25 + np.cos(a) * 0.12, 0.045, 0.18 + np.sin(a) * 0.08), (0.03, 0.008, 0.03)), sauce) for a in np.linspace(0, 5, 8)]
    if id_ == 'cheesecake':
        base = O(mat('#b8803e', 5, 0.45)); cheese = O(mat('#f6e6c0', 5, 0.35))
        sl, y = slice_(cheese, [(0.05, base), (0.2, cheese), (0.03, O(mat('#b5304a', 5, 0.45, spec=0.6)))], None)
        return plate() + sl + blue(-0.12, y + 0.04, 0.0) + blue(0.0, y + 0.04, -0.05) + blue(-0.05, y + 0.04, 0.08) + dollop(0.28, 0.04, 0.2, 0.7)
    if id_ == 'cookies':
        sc = plate()
        for i, (x, z, a) in enumerate(((-0.2, 0.05, 0.2), (0.18, -0.08, -0.3), (0.0, 0.2, 0.0))):
            ck = O(mat('#c98b4a', 6, 0.5, tex=lambda p, n: -0.35 * ((np.sin(p[:, 0] * 41) * np.sin(p[:, 2] * 37) > 0.75))), (100, 55, 25))
            sc.append((xform(cyl((x, 0.07 + i * 0.03, z), 0.17, 0.025, 0.02), rot_x=a * 0.4, about=(x, 0.07, z)), ck))
        return sc
    if id_ == 'pancakes':
        pc = O(mat('#d9a35a', 6, 0.5), (110, 65, 25))
        sc = plate() + [(cyl((0, 0.07 + i * 0.06, 0), 0.38 - i * 0.01, 0.03, 0.025), pc) for i in range(3)]
        syrup = O(mat('#a8601e', 5, 0.5, spec=0.8))
        sc.append((smin([cyl((0, 0.205, 0), 0.3, 0.012, 0.01), cap((0.3, 0.2, 0.05), (0.36, 0.1, 0.07), 0.03), cap((-0.2, 0.2, 0.25), (-0.22, 0.12, 0.29), 0.025)], 0.03), syrup))
        sc.append((rbox((0, 0.25, 0), (0.07, 0.035, 0.06), 0.012), O(mat('#f6e08a', 4, 0.35))))
        for x, z in ((-0.15, 0.1), (0.12, 0.12), (0.18, -0.1)): sc += blue(x, 0.24, z)
        return sc
    if id_ in ('salad', 'caesar', 'fruitbowl'):
        sc = bowl('#f4efe6' if id_ != 'fruitbowl' else '#9bc3e0')
        rs = np.random.RandomState(len(id_))
        lettuce = O(mat('#7fb04c', 6, 0.55)); lettuce2 = O(mat('#5c8f3f', 6, 0.55))
        if id_ != 'fruitbowl':
            for i in range(9):
                a = rs.rand() * 6.28; rr = rs.rand() * 0.32
                sc.append((xform(ell((np.cos(a) * rr, 0.3, np.sin(a) * rr), (0.14, 0.03, 0.1)), rot_y=a, rot_z=rs.rand() - 0.5, about=(np.cos(a) * rr, 0.3, np.sin(a) * rr)), lettuce if i % 2 else lettuce2))
        if id_ == 'salad':
            for i in range(3): sc.append((ell((np.cos(i * 2.1) * 0.22, 0.36, np.sin(i * 2.1) * 0.2), (0.06, 0.06, 0.06)), O(mat('#e04a3a', 5, 0.5, spec=0.6))))
            for i in range(3): sc.append((xform(cyl((np.cos(i * 2.1 + 1) * 0.18, 0.35, np.sin(i * 2.1 + 1) * 0.18), 0.06, 0.012, 0.006), rot_x=0.6, about=(0, 0.35, 0)), O(mat('#a8d08a', 4, 0.4), (60, 100, 50))))
            for i in range(2): sc.append((cap((0.05 + i * 0.05, 0.36, -0.05), (0.15 + i * 0.05, 0.38, 0.05), 0.018), O(mat('#f2862a', 4, 0.4))))
        if id_ == 'caesar':
            for i in range(4): sc.append((xform(rbox((np.cos(i * 1.6) * 0.2, 0.36, np.sin(i * 1.6) * 0.18), (0.04, 0.035, 0.04), 0.01), rot_y=i, about=(0, 0.36, 0)), O(mat('#d9a35a', 5, 0.5))))
            sc += [(ell((0.05, 0.37, 0.05), (0.08, 0.04, 0.06)), O(mat('#fbf6ea', 4, 0.3))), (ell((0.06, 0.4, 0.06), (0.035, 0.02, 0.03)), O(mat('#f6b030', 4, 0.4)))]
        if id_ == 'fruitbowl':
            for i in range(3):
                a = i * 2.1
                sc.append((xform(cyl((np.cos(a) * 0.2, 0.3, np.sin(a) * 0.2), 0.1, 0.015, 0.008), rot_x=0.7, rot_y=a, about=(np.cos(a) * 0.2, 0.3, np.sin(a) * 0.2)), O(mat('#8fc25a', 5, 0.4, tex=lambda p, n: 0.4 * (np.hypot(p[:, 0] - np.round(p[:, 0] * 5) / 5, 0) < 0)))))
                sc.append((xform(cyl((np.cos(a + 1) * 0.18, 0.31, np.sin(a + 1) * 0.18), 0.1, 0.015, 0.008), rot_x=0.6, rot_y=a + 1, about=(np.cos(a + 1) * 0.18, 0.31, np.sin(a + 1) * 0.18)), O(mat('#f6a03a', 5, 0.4))))
            for i in range(5): sc += blue(np.cos(i * 1.3) * 0.1, 0.33, np.sin(i * 1.3) * 0.1)
            sc.append((ell((0, 0.37, 0), (0.07, 0.015, 0.04)), O(mat('#5c9a48', 4, 0.4))))
        return cut_bowl(sc[:2]) + sc[2:]
    if id_ == 'avotoast':
        bread = O(mat('#d9a35a', 6, 0.5), (110, 65, 25)); crust = O(mat('#9a5a24', 5, 0.5))
        sc = plate() + [(rbox((0, 0.08, 0), (0.34, 0.04, 0.26), 0.05), crust), (rbox((0, 0.1, 0), (0.31, 0.03, 0.23), 0.03), bread)]
        av = O(mat('#a8c860', 5, 0.45), (60, 90, 40))
        for i in range(4): sc.append((xform(ell((-0.2 + i * 0.12, 0.14, -0.05), (0.06, 0.025, 0.14)), rot_y=0.3, about=(-0.2 + i * 0.12, 0.14, -0.05)), av))
        sc += [(ell((0.1, 0.16, 0.08), (0.14, 0.02, 0.12)), O(mat('#fbf6ea', 4, 0.3))), (ell((0.1, 0.18, 0.08), (0.05, 0.03, 0.05)), O(mat('#f6b030', 5, 0.45, spec=0.6)))]
        return sc
    return plate()
