# The barista station and the kitchen, modelled like the rest of the café.
#
# Station ("bar" view): a side-on look at the counter with the espresso machine, grinder,
# shelf and tiled wall, plus props that move (portafilter, jug, carton, bottles, shakers...)
# and every cup and glass from the front and from above. Kitchen: the plate, the bases
# (cake slices, bowl, toast...) and all ingredients, seen from above at an angle.
#
# The game's station scene is 150x100 "scene pixels" and the kitchen 240x160; pictures are
# rendered at KS = 4 picture pixels per scene pixel. Points the game needs (where the cup
# stands, the spout, the crank...) are projected and written to st3manifest.js.
from sdf import *
from items import M
from models import MX
import numpy as np

KS = 4
INK = (70, 40, 32)
def O(m, col=INK): m.outline = col; return m

# ---------- station camera ----------
BAR = dict(pitch=20, yaw=0)
SPX = 12                          # scene px per unit in the bar view
BAR_PPU = SPX * KS
BAR_SIZE = (150 * KS, 100 * KS)
BAR_CEN = (0.0, 2.2, 0.0)
LIGHT = (-0.45, 0.85, 0.55)

tile = Mat('#efe2c6', 5, 0.32, tex=lambda p, n: -0.16 * ((((p[:, 1] + 0.02) * 2.5) % 1 < 0.06) | ((((p[:, 0] + np.floor(p[:, 1] * 2.5) * 0.4) * 2.5) % 1) < 0.05)))
counter_top = O(Mat('#e9dcc0', 5, 0.35, tex=wood(0, 40, 0.04, 7)))
panel = O(Mat('#b07a4a', 6, 0.6, tex=lambda p, n: -0.18 * ((((p[:, 0] + 9) * 0.8) % 1) < 0.05) + wood(1, 60, 0.07, 4)(p, n)))
steel, steelD, red, white = M['steel'], M['steelD'], M['red'], M['white']
gaugeF = Mat('#fbf6ea', 4, 0.3, tex=lambda p, n: -0.3 * (np.abs(p[:, 0] % 0.6 - 0.3) < 0.02))
beans = Mat('#5a3420', 5, 0.55, tex=lambda p, n: 0.18 * (np.sin(p[:, 0] * 90) * np.sin(p[:, 1] * 90 + p[:, 2] * 70) > 0.5) - 0.12 * (np.sin(p[:, 0] * 70 + p[:, 1] * 50) > 0.7))
glassJ = O(Mat('#d6ebf0', 4, 0.3, spec=1.0), (110, 140, 150))
grill = O(Mat('#59636a', 5, 0.5, tex=lambda p, n: -0.25 * ((p[:, 0] * 6) % 1 < 0.3)), (40, 44, 48))

# where things are (units); the game gets them in scene px from st3layout.js
MX = -0.4                          # espresso machine centre
GX = -4.9                          # grinder
CUPZ = 0.15
P = dict(
    cup=(MX, 0.12, CUPZ), spout=(MX, 2.5, CUPZ), pf_machine=(MX, 2.55, CUPZ), pf_grinder=(GX, 0.25, 0.05),
    crank=(GX + 0.95, 2.55, -0.3), chute=(GX, 1.35, 0.05), hopper_bot=(GX, 2.3, -0.4), hopper_top=(GX, 3.55, -0.4),
    wand_tip=(MX + 3.25, 1.35, 0.05), jug_steam=(MX + 3.25, 0.55, 0.05), jug_home=(4.1, 0.0, 0.25), slot=(5.4, 0.0, 0.35),
    meter=(5.6, 3.6, 0.0), water=(MX + 1.55, 2.5, CUPZ),
)

def bar_scene():
    sc = [
        (rbox((0, 4.2, -1.6), (9.5, 4.4, 0.05)), tile),                                  # tiled wall
        (rbox((0, -0.12, -0.25), (9.5, 0.12, 1.3), 0.03), counter_top),                  # counter top
        (rbox((0, -1.7, 0.98), (9.5, 1.5, 0.08)), panel),                                # counter front
        (rbox((0, -0.27, 1.06), (9.5, 0.03, 0.02)), O(Mat('#8a5a36', 4, 0.4))),          # lip
    ]
    mx = MX
    # espresso machine: a tall body at the back, the head over a recessed drip tray
    sc += [
        (rbox((mx, 2.2, -0.95), (2.7, 2.2, 0.5), 0.14), steel),                          # body
        (rbox((mx, 3.75, -0.35), (2.75, 0.65, 0.42), 0.14), steel),                      # upper housing
        (rbox((mx, 4.48, -0.6), (2.8, 0.07, 0.7), 0.04), steelD),                        # top rail
        (rbox((mx, 3.55, 0.08), (2.75, 0.14, 0.03), 0.02), red),
        (rbox((mx, 0.42, -0.44), (2.7, 0.09, 0.03), 0.02), red),
        (rbox((mx, 2.95, CUPZ - 0.05), (0.55, 0.15, 0.25), 0.07), steelD),               # group head
        (rbox((mx, 0.06, 0.12), (1.5, 0.06, 0.5), 0.03), grill),                         # drip tray
        (rbox((mx + 1.55, 2.95, 0.0), (0.18, 0.14, 0.12), 0.05), steelD),                # water tap
        (cyl((mx + 1.55, 2.75, 0.0), 0.06, 0.08, 0.02), steelD),
    ]
    for gx in (mx - 1.75, mx + 1.75):
        sc.append((xform(cyl((gx, 3.8, 0.08), 0.32, 0.04, 0.02), rot_x=np.pi / 2, about=(gx, 3.8, 0.08)), steelD))
        sc.append((xform(cyl((gx, 3.8, 0.12), 0.26, 0.02, 0.01), rot_x=np.pi / 2, about=(gx, 3.8, 0.12)), gaugeF))
        sc.append((cap((gx, 3.8, 0.15), (gx + 0.14, 3.93, 0.15), 0.022), red))
    for cx in (mx - 2.0, mx - 1.3, mx + 1.6):
        sc.append((cyl((cx, 4.72, -0.85), 0.24, 0.17, 0.05), white))
    # steam wand
    wx = mx + 2.85
    sc.append((rbox((wx, 3.15, -0.2), (0.14, 0.14, 0.14), 0.05), steelD))
    sc.append((cap((wx, 3.1, -0.15), (P['wand_tip'][0], P['wand_tip'][1], P['wand_tip'][2]), 0.065), steel))
    sc.append((rbox((wx, 3.45, -0.2), (0.06, 0.25, 0.06), 0.03), O(Mat('#3b2a22', 5, 0.5))))
    # grinder (the bean hopper is a separate picture so the beans can run low)
    gx = GX
    sc += [
        (rbox((gx, 0.12, -0.3), (0.95, 0.12, 0.7), 0.05), steelD),
        (rbox((gx, 1.25, -0.4), (0.72, 1.05, 0.5), 0.14), red),
        (rbox((gx, 1.95, -0.4), (0.74, 0.08, 0.52), 0.04), steelD),
        (rbox((gx, P['chute'][1], 0.12), (0.2, 0.14, 0.14), 0.05), steelD),             # chute
        (cyl((gx, 2.25, -0.4), 0.5, 0.08, 0.03), steelD),                               # hopper collar
        (xform(cyl((P['crank'][0] - 0.12, P['crank'][1], P['crank'][2]), 0.14, 0.1, 0.03), rot_z=np.pi / 2, about=(P['crank'][0] - 0.12, P['crank'][1], P['crank'][2])), steelD),
    ]
    # a shelf on the wall with jars and cups
    sc.append((rbox((5.0, 5.0, -1.38), (2.0, 0.06, 0.2), 0.02), M['oak']))
    for i, x in enumerate((3.5, 4.2, 4.9)):
        sc.append((cyl((x, 5.4, -1.36), 0.24, 0.34, 0.06), glassJ if i % 2 else O(Mat('#cfe2e6', 4, 0.3, spec=0.8), (110, 140, 150))))
        sc.append((cyl((x, 5.3, -1.36), 0.2, 0.22, 0.05), beans))
        sc.append((cyl((x, 5.78, -1.36), 0.22, 0.05, 0.02), M['oak']))
    for x in (5.8, 6.4):
        sc.append((cyl((x, 5.25, -1.36), 0.2, 0.18, 0.05), white))
    sc.append((cyl((6.75, 5.3, -1.36), 0.18, 0.2, 0.05), M['pot']))
    sc.append((ell((6.75, 5.65, -1.36), (0.28, 0.2, 0.2)), M['leaf']))
    # a little plant and a sugar pot at the left end of the bar
    return sc

def hopper(part):
    a, b = P['hopper_bot'], P['hopper_top']
    loc = lambda q: (q[0] - a[0], q[1] - a[1], q[2] - a[2])
    A, B = loc(a), loc(b)
    if part == 'beans': return [(rcone(A, (B[0], B[1] - 0.1, B[2]), 0.42, 0.68), beans)]
    return [(sub(rcone(A, B, 0.46, 0.74), rcone((A[0], A[1] + 0.05, A[2]), (B[0], B[1] + 0.2, B[2]), 0.42, 0.7)), O(Mat('#d4eaf0', 4, 0.25, spec=1.0), (120, 150, 160))),
            (torus(B, 0.74, 0.05), glassJ), (cyl((B[0], B[1] + 0.1, B[2]), 0.76, 0.06, 0.04), steelD)]

# props that move or come and go in the bar view; anchored at their base centre
def portafilter(full):
    sc = [(cyl((0, 0.12, 0), 0.42, 0.12, 0.04), steel), (cap((-0.4, 0.13, 0), (-1.25, 0.18, 0), 0.09), O(Mat('#3b2a22', 5, 0.5)))]
    sc.append((cyl((0, -0.04, 0), 0.1, 0.06, 0.02), steelD))
    if full: sc.append((ell((0, 0.24, 0), (0.36, 0.08, 0.36)), O(Mat('#4a2a18', 4, 0.4))))
    return sc
def knob():
    return [(ell((0, 0, 0), (0.17, 0.17, 0.17)), O(Mat('#9c6a42', 5, 0.5, spec=0.3)))]
def jug(milk=False):
    body = rcone((0, 0.0, 0), (0, 1.15, 0), 0.5, 0.38)
    inside = rcone((0, 0.1, 0), (0, 1.3, 0), 0.43, 0.32)
    sc = [(sub(body, inside), steel), (cap((-0.42, 0.95, 0), (-0.72, 0.6, 0), 0.07), steelD), (ell((0.46, 1.12, 0), (0.12, 0.05, 0.1)), steel)]
    if milk: sc.append((cyl((0, 0.85, 0), 0.4, 0.02), O(Mat('#f6efe0', 4, 0.25), (200, 185, 165))))
    return sc
def carton():
    return [(rbox((0, 0.65, 0), (0.36, 0.65, 0.36), 0.03), O(Mat('#f7f2ea', 5, 0.35))), (rbox((0, 0.65, 0.33), (0.37, 0.18, 0.04), 0.02), O(Mat('#6f8fc9', 5, 0.5))),
            (xform(rbox((0, 1.4, 0), (0.36, 0.14, 0.26), 0.02), rot_z=0.0), O(Mat('#f7f2ea', 5, 0.35))), (cyl((0.15, 1.5, 0.1), 0.08, 0.06, 0.02), O(Mat('#6f8fc9', 4, 0.4)))]
def pitcher():
    body = cyl((0, 0.7, 0), 0.42, 0.7, 0.06)
    return [(body, glassJ), (cyl((0, 0.5, 0), 0.38, 0.5, 0.04), O(Mat('#cfe6ee', 4, 0.3), (110, 140, 150))), (torus((0.48, 0.75, 0), 0.22, 0.05, 'z'), glassJ)]
def bucket():
    sc = [(sub(rcone((0, 0.0, 0), (0, 0.8, 0), 0.5, 0.64), rcone((0, 0.1, 0), (0, 0.9, 0), 0.44, 0.58)), steel), (torus((0, 0.8, 0), 0.64, 0.04), steelD)]
    for i, (x, z) in enumerate(((-0.25, 0.1), (0.2, 0.15), (0.0, -0.2), (0.3, -0.15), (-0.3, -0.2))):
        sc.append((xform(rbox((x, 0.82 + 0.05 * (i % 2), z), (0.14, 0.12, 0.14), 0.04), rot_y=i * 0.7, about=(x, 0.82, z)), O(Mat('#e8f6fa', 4, 0.3, spec=1.0), (140, 170, 180))))
    return sc
def bottle(col):
    return [(cyl((0, 0.55, 0), 0.26, 0.55, 0.08), O(Mat(col, 5, 0.5, spec=0.4))), (rbox((0, 0.55, 0.24), (0.2, 0.16, 0.03), 0.02), O(Mat('#fbf6ea', 4, 0.3))),
            (cyl((0, 1.18, 0), 0.1, 0.1, 0.03), steelD), (cap((0, 1.3, 0), (0.28, 1.3, 0), 0.04), steelD), (cyl((0, 1.25, 0), 0.06, 0.08), steelD)]
def fruit_bowl(col, kind):
    sc = [(sub(ell((0, 0.2, 0), (0.62, 0.32, 0.62)), ell((0, 0.28, 0), (0.56, 0.3, 0.56))), O(Mat('#f7f2ea', 5, 0.35)))]
    for i, (x, z) in enumerate(((-0.22, 0.05), (0.2, 0.08), (0.0, -0.18), (0.05, 0.22))):
        if kind == 'berry': sc.append((ell((x, 0.38, z), (0.16, 0.18, 0.16)), O(Mat(col, 5, 0.55, spec=0.4))))
        else: sc.append((ell((x, 0.4, z), (0.2, 0.18, 0.18)), O(Mat(col, 5, 0.55, spec=0.3))))
    return sc
def tub():
    return [(cyl((0, 0.35, 0), 0.5, 0.35, 0.05), O(Mat('#e6eef0', 5, 0.35))), (cyl((0, 0.45, 0.0), 0.51, 0.08, 0.02), O(Mat('#e7a0a6', 5, 0.45))),
            (ell((0, 0.75, 0), (0.4, 0.14, 0.4)), O(Mat('#fbf3e0', 4, 0.3))), (cap((0.1, 0.8, 0), (0.55, 1.2, 0), 0.04), steel), (ell((0.05, 0.78, 0), (0.12, 0.05, 0.1)), steel)]
def teabox():
    sc = [(rbox((0, 0.3, 0), (0.6, 0.3, 0.32), 0.04), O(Mat('#6d8a58', 5, 0.5))), (rbox((0, 0.3, 0.3), (0.45, 0.12, 0.03), 0.02), O(Mat('#f4ecd6', 4, 0.3)))]
    for i in range(3): sc.append((rbox((-0.3 + i * 0.3, 0.7, 0), (0.1, 0.12, 0.04), 0.02), O(Mat('#f4ecd6', 4, 0.3))))
    return sc
def cream_can():
    return [(cyl((0, 0.7, 0), 0.24, 0.7, 0.06), O(Mat('#eef2f2', 5, 0.4, spec=0.6))), (cyl((0, 0.85, 0), 0.25, 0.14, 0.02), O(Mat('#e7a0a6', 5, 0.45))),
            (rcone((0, 1.4, 0), (0, 1.75, 0), 0.12, 0.05), O(Mat('#f7f2ea', 4, 0.3)))]
def tamper():
    return [(cyl((0, 0.06, 0), 0.4, 0.06, 0.02), steel), (cap((0, 0.12, 0), (0, 0.55, 0), 0.08), O(Mat('#7a4e30', 5, 0.5))), (ell((0, 0.7, 0), (0.2, 0.2, 0.2)), O(Mat('#9c6a42', 5, 0.5)))]
def straw_only():
    return [(cap((0, 0, 0), (0.25, 1.4, 0), 0.05), O(Mat('#e05a6a', 4, 0.4)))]
def ice_cube():
    return [(rbox((0, 0.15, 0), (0.15, 0.15, 0.15), 0.05), O(Mat('#e8f6fa', 4, 0.3, spec=1.0), (150, 180, 190)))]
def cream_dome():
    return [(smin([ell((0, 0.18, 0), (0.62, 0.24, 0.62)), ell((0, 0.42, 0), (0.42, 0.22, 0.42)), ell((0, 0.62, 0), (0.22, 0.18, 0.22)), cap((0, 0.7, 0), (0.08, 0.86, 0), 0.06)], 0.08),
             O(Mat('#fffaf0', 5, 0.3, tex=lambda p, n: -0.12 * (np.sin(np.arctan2(p[:, 2], p[:, 0]) * 6 + p[:, 1] * 40) > 0.6)), (200, 180, 160)))]
def scoop():
    return [(ell((0, 0.28, 0), (0.42, 0.32, 0.42)), O(Mat('#fbf3e0', 5, 0.3), (200, 180, 160)))]
def marsh1():
    return [(cyl((0, 0.15, 0), 0.2, 0.15, 0.06), O(Mat('#fff6f0', 4, 0.25), (210, 180, 180)))]
def marsh_pink():
    return [(cyl((0, 0.15, 0), 0.2, 0.15, 0.06), O(Mat('#f6c4d2', 4, 0.3), (200, 150, 160)))]
def rag():
    return [(rbox((0, 0.06, 0), (0.6, 0.06, 0.45), 0.05), O(Mat('#6f8fc9', 5, 0.5, tex=lambda p, n: 0.12 * (((p[:, 0] + p[:, 2]) * 5) % 1 < 0.2))))]
def shaker(col):
    return [(cyl((0, 0.45, 0), 0.26, 0.45, 0.06), O(Mat('#f4ecd6', 5, 0.35))), (cyl((0, 0.45, 0.0), 0.27, 0.2, 0.02), O(Mat(col, 5, 0.5))), (ell((0, 0.95, 0), (0.27, 0.12, 0.27)), steel)]
def whisk():
    sc = [(cap((0, 0.6, 0), (0, 1.5, 0), 0.07), O(Mat('#c9a46b', 5, 0.5)))]
    sc.append((ell((0, 0.3, 0), (0.3, 0.32, 0.3)), O(Mat('#e9d6a8', 5, 0.45, tex=lambda p, n: -0.15 * (np.sin(np.arctan2(p[:, 2], p[:, 0]) * 16) > 0.4)))))
    return sc
def spoon():
    return [(ell((0, 0.05, 0), (0.22, 0.05, 0.16)), steel), (cap((0.18, 0.06, 0), (1.1, 0.3, 0), 0.04), steel)]
def jar():
    sc = [(cyl((0, 0.6, 0), 0.5, 0.6, 0.08), glassJ), (cyl((0, 1.25, 0), 0.52, 0.08, 0.03), O(Mat('#c9786f', 5, 0.5)))]
    for i, (x, y) in enumerate(((-0.2, 0.25), (0.15, 0.25), (-0.05, 0.55), (0.2, 0.62), (-0.25, 0.8))):
        sc.append((cyl((x, y, 0.3), 0.14, 0.12, 0.05), O(Mat('#f6c4d2' if i % 2 else '#fff6f0', 4, 0.25))))
    return sc
def mint_sprig():
    return [(xform(ell((0.15 * np.cos(a), 0.12, 0.15 * np.sin(a)), (0.2, 0.04, 0.1)), rot_y=-a, about=(0, 0, 0)), M['leaf'] if i % 2 else M['leaf2']) for i, a in enumerate(np.linspace(0, 6, 5))]
def choc_bar():
    return [(rbox((0, 0.08, 0), (0.6, 0.08, 0.4), 0.03), O(Mat('#4a2416', 5, 0.5, tex=lambda p, n: -0.25 * ((((p[:, 0] + 0.6) * 2.5) % 1 < 0.08) | (((p[:, 2] + 0.4) * 2.5) % 1 < 0.08)))))]
def matcha_bowl():
    return [(sub(ell((0, 0.3, 0), (0.6, 0.35, 0.6)), ell((0, 0.4, 0), (0.54, 0.34, 0.54))), O(Mat('#e9dcc0', 5, 0.4))), (cyl((0, 0.5, 0), 0.52, 0.02), O(Mat('#7fae4f', 5, 0.45)))]
def teabag():
    return [(rbox((0, 0.3, 0), (0.22, 0.3, 0.06), 0.05), O(Mat('#f4ecd6', 4, 0.3))), (rbox((0, 0.3, 0.05), (0.15, 0.18, 0.02), 0.02), O(Mat('#b0642a', 4, 0.4)))]
def kettle():
    body = ell((0, 0.5, 0), (0.55, 0.5, 0.55))
    return [(body, steel), (cap((0.45, 0.6, 0), (0.85, 0.95, 0), 0.07), steel), (torus((0, 1.05, 0), 0.28, 0.05, 'x'), steelD)]
def lemons(col):
    return [(ell((x, 0.25, z), (0.28, 0.22, 0.22)), O(Mat(col, 5, 0.55, spec=0.3))) for x, z in ((-0.3, 0), (0.25, 0.1), (0.0, -0.25))]

PROPS = {
    'pf_empty': lambda: portafilter(False), 'pf_full': lambda: portafilter(True), 'jug': jug, 'jug_milk': lambda: jug(True), 'knob': knob, 'carton': carton, 'pitcher': pitcher, 'bucket': bucket,
    'bottle_vanilla': lambda: bottle('#f2e2b0'), 'bottle_caramel': lambda: bottle('#c9822f'), 'bottle_choc': lambda: bottle('#3a1a10'), 'bottle_chai': lambda: bottle('#a8683a'),
    'berries': lambda: fruit_bowl('#d8283a', 'berry'), 'lemons': lambda: lemons('#f6e070'), 'oranges': lambda: lemons('#f29a3a'), 'tub': tub, 'teabox': teabox,
    'creamcan': cream_can, 'tamper': tamper, 'straw': straw_only, 'ice': ice_cube, 'cream': cream_dome, 'scoop': scoop, 'marsh': marsh1, 'marsh2': marsh_pink,
    'rag': rag, 'shaker_cocoa': lambda: shaker('#5b3a26'), 'shaker_cinnamon': lambda: shaker('#a0602a'), 'whisk': whisk, 'spoon': spoon, 'jar': jar,
    'mint': mint_sprig, 'chocbar': choc_bar, 'matchabowl': matcha_bowl, 'teabag': teabag, 'kettle': kettle,
}

# ---------- cups and glasses ----------
VES = {  # radius, height, body colour, kind (station size, units)
    'demi': (0.6, 0.75, '#f7f1e6', 'ceramic'), 'cup': (0.86, 0.9, '#f7f1e6', 'ceramic'), 'mug': (0.75, 1.4, '#d9826f', 'ceramic'),
    'glass': (0.72, 1.7, None, 'glass'), 'tall': (0.6, 2.4, None, 'glass'),
}
glassWall = Mat('#d4eaf0', 4, 0.25, spec=1.0)   # made see-through after rendering
def vessel(v, empty_inside=True):
    r, h, body, kind = VES[v]
    sc = []
    whiteM = O(Mat('#fbf7ef', 5, 0.35))
    if kind == 'ceramic':
        bm = O(Mat(body, 6, 0.45, spec=0.5))
        tap = 0.78 if v != 'mug' else 0.95
        outer = rcone((0, 0.0, 0), (0, h, 0), r * tap, r)
        inner = rcone((0, 0.07, 0), (0, h + 0.2, 0), r * tap - 0.06, r - 0.06)
        cup = lambda p: np.maximum(np.maximum(outer(p), p[:, 1] - h), -inner(p))
        sc.append((cup, bm))
        sc.append((torus((r + 0.1 + h * 0.04, h * 0.55, 0), 0.12 + h * 0.06, 0.05, 'z'), bm))
        if v in ('demi', 'cup'):
            sc.append((cyl((0, 0.02, 0), r + 0.42, 0.025, 0.02), whiteM))
            sc.append((torus((0, 0.04, 0), r + 0.36, 0.035), whiteM))
    else:
        rim = O(Mat('#e9f5f8', 4, 0.3, spec=1.0), (90, 120, 130))
        sc.append((cyl((0, 0.04, 0), r, 0.045, 0.02), rim))
        sc.append((torus((0, h, 0), r - 0.015, 0.022), rim))
        sc.append((sub(cyl((0, h / 2, 0), r, h / 2), cyl((0, h / 2 + 0.06, 0), r - 0.035, h / 2)), O(glassWall, (120, 150, 160))))
        if v == 'glass': sc.append((torus((r + 0.2, h * 0.5, 0), 0.26, 0.05, 'z'), rim))
    return sc

def plate_scene():
    return [(cyl((0, 0.03, 0), 1.0, 0.03, 0.02), O(Mat('#f2ece0', 5, 0.3))), (torus((0, 0.06, 0), 0.9, 0.06), O(Mat('#f7f2ea', 5, 0.3))),
            (cyl((0, 0.045, 0), 0.82, 0.02, 0.01), O(Mat('#fbf7f0', 4, 0.2)))]

# ---------- kitchen: bases and ingredients (seen from the kitchen camera) ----------
KIT = dict(pitch=55, yaw=0)
KIT_PPU = 72 * KS            # the plate (radius 1 unit) is 72 scene px across in the kitchen
sponge = O(Mat('#f4dc9c', 5, 0.28, hs=-0.02, tex=lambda p, n: -0.1 * (np.sin(p[:, 0] * 120) * np.sin(p[:, 1] * 140) > 0.7)))
frost = O(Mat('#fbf6ee', 5, 0.3), (200, 180, 160))
def cake(kind):
    # a wedge: tip at the left, round crust on the right
    TIP, RAD, HALF = -0.36, 0.74, np.radians(28)
    def wedge(y0, y1):
        def f(p):
            x, z = p[:, 0] - TIP, p[:, 2]
            side = np.abs(z) * np.cos(HALF) - x * np.sin(HALF)
            return np.maximum(np.maximum(side, np.hypot(x, z) - RAD), np.maximum(y0 - p[:, 1], p[:, 1] - y1)) - 0.01
        return f
    if kind == 'vanilla': layers = [(0.0, 0.12, sponge), (0.12, 0.16, frost), (0.16, 0.28, sponge), (0.28, 0.36, frost)]
    elif kind == 'chocolate': layers = [(0.0, 0.12, O(Mat('#6e3c26', 5, 0.35, hs=-0.02))), (0.12, 0.16, O(Mat('#3a1a10', 4, 0.35))), (0.16, 0.28, O(Mat('#6e3c26', 5, 0.35, hs=-0.02))), (0.28, 0.36, O(Mat('#4a2416', 5, 0.4, spec=0.6)))]
    else: layers = [(0.0, 0.06, O(Mat('#b8803a', 5, 0.35, hs=-0.02))), (0.06, 0.3, O(Mat('#f8ecc8', 5, 0.25, hs=-0.02))), (0.3, 0.33, O(Mat('#e8c070', 5, 0.3, hs=-0.02)))]
    return [(wedge(a + 0.02, b + 0.02), m) for a, b, m in layers]
def bowl_base():
    sc = [(sub(ell((0, 0.2, 0), (0.78, 0.3, 0.78)), ell((0, 0.3, 0), (0.7, 0.28, 0.7))), O(Mat('#e6eef0', 5, 0.35))), (cyl((0, 0.06, 0), 0.5, 0.06), O(Mat('#d8e2e4', 4, 0.3)))]
    for i in range(14):
        a = i * 2.39; rr = 0.1 + 0.45 * np.sqrt((i * 0.37) % 1)
        sc.append((xform(ell((np.cos(a) * rr, 0.3 + 0.03 * (i % 3), np.sin(a) * rr), (0.24, 0.05, 0.16)), rot_y=a, about=(np.cos(a) * rr, 0.3, np.sin(a) * rr)), M['leaf'] if i % 2 else O(Mat('#8fc25a', 5, 0.55))))
    return sc
def toast_base():
    crust = O(Mat('#a8642c', 5, 0.4)); crumb = O(Mat('#ecc27a', 5, 0.3, hs=-0.02, tex=lambda p, n: 0.08 * (np.sin(p[:, 0] * 160) * np.sin(p[:, 2] * 150) > 0.6) - 0.08 * (np.sin(p[:, 0] * 90 + p[:, 2] * 70) > 0.8)))
    def shape(inset, y, hh):
        return smin([rbox((0, y, 0.12), (0.5 - inset, hh, 0.36 - inset), 0.03), cyl((0, y, -0.2), 0.52 - inset, hh, 0.02)], 0.05)
    return [(shape(0, 0.07, 0.07), crust), (shape(0.06, 0.075, 0.075), crumb)]
def pancakes_base():
    sc = []
    for k in range(3): sc.append((cyl((0, 0.05 + k * 0.1, 0), 0.72 - k * 0.02, 0.05, 0.04), O(Mat('#d29b5a' if k < 2 else '#e0a858', 5, 0.45))))
    return sc
def croissant_base():
    parts = []
    for i in range(-3, 4):
        a = i * 0.36; x = np.sin(a) * 0.42; z = 0.25 - np.cos(a) * 0.42; r = 0.23 - abs(i) * 0.035
        parts.append(xform(ell((x, r * 0.75, z), (r * 0.75, r * 0.8, r)), rot_y=-a, about=(x, 0, z)))
    tex = lambda p, n: -0.14 * (((np.arctan2(p[:, 0], 0.25 - p[:, 2]) + 3) * 8.5) % 1 < 0.14)
    return [(smin(parts, 0.04), O(Mat('#e0a050', 6, 0.45, spec=0.35, hs=-0.03, tex=tex)))]
BASES = {'vanilla': lambda: cake('vanilla'), 'chocolate': lambda: cake('chocolate'), 'cheesecake': lambda: cake('cheesecake'), 'bowl': bowl_base,
         'toast': toast_base, 'pancakes': pancakes_base, 'croissant': croissant_base}

def ing(k):
    s = 0.075  # a strawberry is about 0.15 units long on a plate of radius 1
    E = lambda c, rad, col, **kw: (ell(c, rad), O(Mat(col, 5, kw.get('sp', 0.5), spec=kw.get('spec', 0.3))))
    if k == 'strawberry': return [(rcone((0, 0.06, -0.05), (0, 0.06, 0.07), 0.07, 0.035), O(Mat('#d8283a', 5, 0.55, spec=0.4, tex=lambda p, n: 0.25 * (np.sin(p[:, 0] * 260) * np.sin(p[:, 2] * 260) > 0.75)))), E((0, 0.08, -0.1), (0.05, 0.02, 0.03), '#4f8a3a')]
    if k == 'strawberry_half': return [(inter(rcone((0, 0.04, -0.05), (0, 0.04, 0.07), 0.07, 0.035), lambda p: p[:, 1] - 0.05), O(Mat('#f47884', 5, 0.4))), E((0, 0.052, 0), (0.035, 0.004, 0.06), '#fff0f0')]
    if k == 'blueberry': return [E((0, 0.035, 0), (0.035, 0.032, 0.035), '#3a4684', spec=0.5)]
    if k == 'raspberry': return [(smin([ell((dx, 0.04 + 0.01 * (i % 2), dz), (0.022, 0.022, 0.022)) for i, (dx, dz) in enumerate([(0, 0), (0.03, 0), (-0.03, 0), (0, 0.03), (0, -0.03), (0.02, 0.02), (-0.02, -0.02), (0.02, -0.02), (-0.02, 0.02)])], 0.01), O(Mat('#d0305a', 5, 0.55, spec=0.3)))]
    if k == 'banana': return [(cyl((0, 0.015, 0), 0.055, 0.015, 0.01), O(Mat('#fbf0c0', 5, 0.35, tex=lambda p, n: -0.3 * (np.abs(np.hypot(p[:, 0], p[:, 2]) - 0.02) < 0.006))))]
    if k == 'kiwi': return [(cyl((0, 0.012, 0), 0.07, 0.012, 0.006), O(Mat('#8fc040', 5, 0.4, tex=lambda p, n: 0.35 * (np.hypot(p[:, 0], p[:, 2]) < 0.022) - 0.6 * ((np.abs(np.hypot(p[:, 0], p[:, 2]) - 0.035) < 0.004) & (np.sin(np.arctan2(p[:, 2], p[:, 0]) * 12) > 0.5)) - 0.4 * (np.hypot(p[:, 0], p[:, 2]) > 0.063))))]
    if k == 'orange': return [(inter(cyl((0, 0.015, 0), 0.08, 0.015, 0.006), lambda p: p[:, 2] - 0.0), O(Mat('#f6a030', 5, 0.4, tex=lambda p, n: 0.3 * (np.abs(np.sin(np.arctan2(p[:, 2], p[:, 0]) * 3)) < 0.1) - 0.3 * (np.hypot(p[:, 0], p[:, 2]) > 0.07))))]
    if k == 'mint': return [(xform(ell((0, 0.01, 0), (0.06, 0.01, 0.035)), rot_y=0.5), O(Mat('#5c9a48', 5, 0.5, tex=lambda p, n: -0.3 * (np.abs(p[:, 2] + p[:, 0] * 0.5) < 0.004))))]
    if k == 'cream': return [(smin([ell((0, 0.03, 0), (0.07, 0.035, 0.07)), ell((0, 0.07, 0), (0.045, 0.03, 0.045)), cap((0, 0.08, 0), (0.01, 0.11, 0), 0.015)], 0.02), O(Mat('#fffaf0', 5, 0.3), (200, 180, 160)))]
    if k == 'shaving': return [(cap((-0.04, 0.012, -0.02), (0.04, 0.012, 0.02), 0.012), O(Mat('#5a3020', 5, 0.5, spec=0.4)))]
    if k == 'macaron': return [(cyl((0, 0.02, 0), 0.06, 0.02, 0.015), O(Mat('#f2a0b4', 5, 0.45))), (cyl((0, 0.045, 0), 0.058, 0.012, 0.01), O(Mat('#fbf6ea', 4, 0.3))), (cyl((0, 0.065, 0), 0.06, 0.02, 0.015), O(Mat('#f2a0b4', 5, 0.45)))]
    if k == 'cookie': return [(cyl((0, 0.012, 0), 0.085, 0.012, 0.01), O(Mat('#d6a05a', 5, 0.45, tex=lambda p, n: -0.6 * (np.sin(p[:, 0] * 80 + 1) * np.sin(p[:, 2] * 80) > 0.85))))]
    if k == 'chocpiece': return [(rbox((0, 0.012, 0), (0.05, 0.012, 0.05), 0.006), O(Mat('#4a2416', 5, 0.5, tex=lambda p, n: -0.3 * ((np.abs(p[:, 0]) < 0.004) | (np.abs(p[:, 2]) < 0.004)))))]
    if k == 'butter': return [(rbox((0, 0.025, 0), (0.06, 0.025, 0.045), 0.01), O(Mat('#f8e48a', 5, 0.35, spec=0.4)))]
    if k == 'lettuce': return [(xform(ell((0, 0.02, 0), (0.11, 0.02, 0.07)), rot_y=0.4), O(Mat('#8fc25a', 5, 0.55, tex=lambda p, n: 0.25 * (np.abs(p[:, 2]) < 0.006))))]
    if k == 'tomato': return [(inter(ell((0, 0.0, 0), (0.05, 0.05, 0.05)), lambda p: -p[:, 1]), O(Mat('#e0302a', 5, 0.5, spec=0.4))), E((0, 0.002, 0), (0.035, 0.004, 0.035), '#f6a080')]
    if k == 'cucumber': return [(cyl((0, 0.01, 0), 0.055, 0.01, 0.004), O(Mat('#d4ecb8', 5, 0.35, tex=lambda p, n: -0.55 * (np.hypot(p[:, 0], p[:, 2]) > 0.048) + 0.15 * (np.hypot(p[:, 0], p[:, 2]) < 0.022))))]
    if k == 'carrot': return [(cap((-0.06 + i * 0.03, 0.008, -0.04 + 0.02 * (i % 2)), (-0.03 + i * 0.03, 0.008, 0.05), 0.008), O(Mat('#f2862a', 5, 0.45))) for i in range(4)]
    if k == 'onion': return [(sub(cyl((0, 0.008, 0), 0.05, 0.008), cyl((0, 0.008, 0), 0.035, 0.02)), O(Mat('#a05a9a', 5, 0.45)))]
    if k == 'olive': return [(sub(ell((0, 0.02, 0), (0.035, 0.02, 0.028)), cyl((0, 0.04, 0), 0.01, 0.02)), O(Mat('#3a3a2a', 5, 0.5, spec=0.6)))]
    if k == 'avocado': return [(sub(ell((0, 0.015, 0), (0.1, 0.015, 0.045)), ell((0, 0.015, 0.035), (0.08, 0.03, 0.035))), O(Mat('#b8d068', 5, 0.45, tex=lambda p, n: -0.5 * (p[:, 2] < -0.035))))]
    if k == 'egg': return [(cyl((0, 0.01, 0), 0.08, 0.01, 0.008), O(Mat('#fbf8ef', 4, 0.25))), E((0, 0.022, 0), (0.035, 0.016, 0.035), '#f6a820', spec=0.6)]
    if k == 'cheese': return [(rbox((0, 0.025, 0), (0.025, 0.025, 0.025), 0.004), O(Mat('#f2d060', 5, 0.45)))]
    if k == 'crouton': return [(rbox((0, 0.025, 0), (0.028, 0.025, 0.028), 0.008), O(Mat('#c98b4a', 5, 0.5, tex=lambda p, n: 0.15 * (np.sin(p[:, 0] * 300) > 0.7))))]
    if k == 'corn': return [E((dx, 0.012, dz), (0.014, 0.012, 0.014), '#f6d040') for dx, dz in ((0, 0), (0.025, 0.01), (-0.02, 0.015), (0.005, -0.022))]
    raise KeyError(k)
ING = ['strawberry', 'strawberry_half', 'blueberry', 'raspberry', 'banana', 'kiwi', 'orange', 'mint', 'cream', 'shaving', 'macaron', 'cookie', 'chocpiece', 'butter',
       'lettuce', 'tomato', 'cucumber', 'carrot', 'onion', 'olive', 'avocado', 'egg', 'cheese', 'crouton', 'corn']

def kitchen_bg():
    def planks(p, n):
        row = np.floor((p[:, 2] + 3) * 2.2)
        seam = -0.18 * ((((p[:, 2] + 3) * 2.2) % 1) < 0.035)
        grain = 0.1 * (np.sin(p[:, 2] * 70 + 2.2 * np.sin(p[:, 0] * 1.7 + row * 4.1) + row) > 0.93)
        tint = 0.0 * row
        return (seam - grain + tint) * 3.4
    wood_top = Mat('#b5763f', 6, 0.4, hs=-0.02, tex=planks, emissive=0.72)
    napkin = O(Mat('#f0e6d0', 5, 0.25, hs=-0.02, tex=lambda p, n: -0.05 * ((p[:, 0] * 10) % 1 < 0.06)), (170, 150, 120))
    silver = O(Mat('#d4dadc', 5, 0.35, spec=0.9, hs=-0.02), (90, 98, 102))
    fx, kx = 1.36, 1.6
    fork = [cap((fx, 0.035, 0.66), (fx, 0.035, -0.08), 0.032),                  # handle
            cap((fx, 0.03, -0.08), (fx, 0.03, -0.2), 0.02),                       # neck
            rbox((fx, 0.03, -0.27), (0.075, 0.012, 0.07), 0.012)]                 # head
    fork += [cap((fx - 0.06 + i * 0.04, 0.03, -0.3), (fx - 0.06 + i * 0.04, 0.03, -0.52), 0.011) for i in range(4)]
    knife = [cap((kx, 0.035, 0.66), (kx, 0.035, 0.12), 0.032),
             rbox((kx + 0.015, 0.028, -0.2), (0.045, 0.008, 0.32), 0.008)]
    return [(rbox((0, -0.05, 0), (4.5, 0.05, 3.5)), wood_top), (rbox((1.48, 0.012, 0.05), (0.28, 0.012, 0.7), 0.01), napkin),
            (smin(fork, 0.015), silver), (smin(knife, 0.01), silver)]
def top_bg():
    def planks(p, n):
        row = np.floor((p[:, 2] + 6) * 1.6)
        seam = -0.2 * ((((p[:, 2] + 6) * 1.6) % 1) < 0.06)
        grain = 0.08 * (np.sin(p[:, 2] * 60 + 2.2 * np.sin(p[:, 0] * 1.3 + row * 4.1) + row) > 0.92)
        return (seam - grain) * 3.4
    mat = Mat('#e0bf8c', 6, 0.4, hs=-0.02, tex=planks, emissive=0.6)
    return [(rbox((0, -0.05, 0), (9, 0.05, 7)), mat)]


# ---------- building ----------
import os, sys, json
from multiprocessing import Pool
from PIL import Image
OUT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..', 'www', 'img', 'r3'))
JS = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..', 'www', 'js', 'art', 'st3layout.js'))
KSIZE = (240 * KS, 160 * KS)
TOP_R = 34                     # radius of the drink seen from above, in scene px

def crop_save(name, img, ax, ay):
    im = Image.fromarray(img, 'RGBA'); bb = im.getbbox()
    if not bb: return name, None
    im = im.crop(bb); im.save(os.path.join(OUT, name + '.png'), optimize=True)
    return name, [im.width, im.height, round(ax - bb[0], 1), round(ay - bb[1], 1)]

def see_through(with_wall, without):
    """glass walls: pixels the wall changes become see-through"""
    a, b = with_wall.astype(int), without.astype(int)
    wall = (a[..., 3] > 0) & ((b[..., 3] == 0) | (np.abs(a[..., :3] - b[..., :3]).sum(-1) > 6))
    out = with_wall.copy(); out[wall, 3] = 92
    return out

KLIGHT = (-0.4, 0.85, 0.75)
def prop_job(name, scene, size=(260, 240), ppu=BAR_PPU, cen=(0, 0.8, 0), pitch=20, yaw=0):
    img = render(scene, size, ppu=ppu, center=cen, pitch=pitch, yaw=yaw, light=KLIGHT if pitch == 55 else LIGHT)
    ax, ay = project((0, 0, 0), size, ppu, cen, pitch, yaw)
    return crop_save(name, img, ax + 0.5, ay + 0.5)

def job(args):
    kind, k = args
    if kind == 'bar':
        img = render(bar_scene(), BAR_SIZE, ppu=BAR_PPU, center=BAR_CEN, pitch=20, yaw=0, light=LIGHT)
        Image.fromarray(img, 'RGBA').save(os.path.join(OUT, 'st_bar.png'), optimize=True)
        return 'st_bar', [BAR_SIZE[0], BAR_SIZE[1], 0, 0]
    if kind == 'hopper':
        sc = hopper(k)
        size = (160, 200); cen = (0, 0.7, 0)
        img = render(sc, size, ppu=BAR_PPU, center=cen, pitch=20, light=LIGHT)
        if k == 'glass': img = see_through(img, render(sc[1:], size, ppu=BAR_PPU, center=cen, pitch=20, light=LIGHT))
        ax, ay = project((0, 0, 0), size, BAR_PPU, cen, 20)
        return crop_save('st_hopper_' + k, img, ax + 0.5, ay + 0.5)
    if kind == 'prop':
        return prop_job('st_' + k, PROPS[k]())
    if kind == 'ves':
        r, h, body, vk = VES[k]
        sc = vessel(k)
        size = (int((2 * r + 1.2) * BAR_PPU), int((h + 1.0) * BAR_PPU)); cen = (0.25, h / 2, 0)
        img = render(sc, size, ppu=BAR_PPU, center=cen, pitch=20, light=LIGHT)
        if vk == 'glass':
            wall = [i for i, (f, m) in enumerate(sc) if m is glassWall]
            img = see_through(img, render([x for i, x in enumerate(sc) if i not in wall], size, ppu=BAR_PPU, center=cen, pitch=20, light=LIGHT))
        ax, ay = project((0, 0, 0), size, BAR_PPU, cen, 20)
        return crop_save('sv_' + k, img, ax + 0.5, ay + 0.5)
    if kind == 'vestop':
        r, h, body, vk = VES[k]
        ri = r - (0.06 if vk == 'ceramic' else 0.035)
        ppu = TOP_R * KS / ri
        span = (r + (0.5 if k in ('demi', 'cup') else 0.45)) * 2
        size = (int(span * ppu) + 40, int(span * ppu) + 40); cen = (0.1, h, 0)
        img = render(vessel(k), size, ppu=ppu, center=cen, pitch=89.5, yaw=0, light=LIGHT)
        ax, ay = project((0, h, 0), size, ppu, cen, 89.5, 0)
        return crop_save('sv_' + k + '_top', img, ax + 0.5, ay + 0.5)
    if kind == 'topbg':
        img = render(top_bg(), BAR_SIZE, ppu=BAR_PPU, center=(0, 0, 0), pitch=89.5, yaw=0, light=LIGHT)
        Image.fromarray(img, 'RGBA').save(os.path.join(OUT, 'st_topbg.png'), optimize=True)
        return 'st_topbg', [BAR_SIZE[0], BAR_SIZE[1], 0, 0]
    if kind == 'kbg':
        img = render(kitchen_bg() + plate_scene(), KSIZE, ppu=KIT_PPU, center=(0, 0, 0), pitch=55, yaw=0, light=KLIGHT)
        Image.fromarray(img, 'RGBA').save(os.path.join(OUT, 'k_bg.png'), optimize=True)
        return 'k_bg', [KSIZE[0], KSIZE[1], 0, 0]
    if kind == 'kplate':
        return prop_job('k_plate', plate_scene(), size=(680, 560), ppu=KIT_PPU, cen=(0, 0, 0), pitch=55)
    if kind == 'kbase':
        return prop_job('k_' + k, BASES[k](), size=(680, 600), ppu=KIT_PPU, cen=(0, 0.25, 0), pitch=55)
    if kind == 'king':
        sc = ing(k)
        if k.startswith('macaron'): pass
        return prop_job('k_i_' + k, sc, size=(120, 110), ppu=KIT_PPU, cen=(0, 0.04, 0), pitch=55)
    if kind == 'kmac':
        col = ['#f2a0b4', '#a8d08a', '#f6d27a', '#b7a0e0'][k]
        sc = [(cyl((0, 0.02, 0), 0.06, 0.02, 0.015), O(Mat(col, 5, 0.45))), (cyl((0, 0.045, 0), 0.058, 0.012, 0.01), O(Mat('#fbf6ea', 4, 0.3))), (cyl((0, 0.065, 0), 0.06, 0.02, 0.015), O(Mat(col, 5, 0.45)))]
        return prop_job(f'k_i_macaron{k}', sc, size=(120, 110), ppu=KIT_PPU, cen=(0, 0.04, 0), pitch=55)
    if kind == 'ksauce':
        name, col = k
        sc = [(cap((0, 0.15, 0), (0, 0.85, 0), 0.24), O(Mat(col, 5, 0.5, spec=0.4))), (rbox((0, 0.5, 0.22), (0.18, 0.15, 0.03), 0.02), O(Mat('#fbf6ea', 4, 0.3))),
              (rcone((0, 1.05, 0), (0, 1.4, 0), 0.14, 0.04), O(Mat('#f4ecd6', 4, 0.3))), (cyl((0, 1.07, 0), 0.17, 0.05, 0.02), O(Mat('#f4ecd6', 4, 0.3)))]
        return prop_job('k_s_' + name, sc)
    if kind == 'kshaker':
        name, col = k
        return prop_job('k_h_' + name, shaker(col))
    raise KeyError(kind)

SAUCE_C = {'chocsauce': '#4a2416', 'caramel': '#c9822f', 'berrysauce': '#b5304a', 'syrup': '#b8702a', 'honey': '#e8a83a', 'dressing': '#f4ecd6', 'balsamic': '#3a2420'}
SHAKER_C = {'sugar': '#e6eef0', 'cocoa': '#6b3a22', 'pepper': '#2e2b26', 'chili': '#d2402a', 'sesame': '#efe0b8'}

def layout():
    pj = lambda q: [round(v / KS, 2) for v in project(q, BAR_SIZE, BAR_PPU, BAR_CEN, 20, 0)]
    L = {k: pj(v) for k, v in P.items()}
    ves = {}
    for k, (r, h, body, vk) in VES.items():
        ri = r - (0.06 if vk == 'ceramic' else 0.035)
        rib = (r * (0.78 if k != 'mug' else 0.95) - 0.06) if vk == 'ceramic' else ri
        bot = 0.07 if vk == 'ceramic' else 0.09
        ves[k] = dict(h=round(h * SPX * np.cos(np.radians(20)), 2), rx=round(ri * SPX, 2), rxb=round(rib * SPX, 2),
                      ry=round(np.sin(np.radians(20)), 4), bot=round(bot * SPX * np.cos(np.radians(20)), 2), glass=vk == 'glass',
                      top_r=round((r + 0.0) / ri * TOP_R, 2))
    K = dict(plate=[round(v / KS, 2) for v in project((0, 0, 0), KSIZE, KIT_PPU, (0, 0, 0), 55, 0)], R=KIT_PPU / KS)
    return dict(ks=KS, spx=SPX, bar=L, ves=ves, top_r=TOP_R, kitchen=K)

if __name__ == '__main__':
    want = sys.argv[1:] or ['all']
    jobs = []
    if 'all' in want or 'bar' in want: jobs += [('bar', None), ('topbg', None), ('hopper', 'beans'), ('hopper', 'glass')]
    if 'all' in want or 'props' in want: jobs += [('prop', k) for k in PROPS]
    if 'all' in want or 'ves' in want: jobs += [('ves', k) for k in VES] + [('vestop', k) for k in VES]
    if 'all' in want or 'kitchen' in want:
        jobs += [('kbg', None), ('kplate', None)] + [('kbase', k) for k in BASES] + [('king', k) for k in ING if k != 'macaron'] + [('kmac', i) for i in range(4)]
        jobs += [('ksauce', kv) for kv in SAUCE_C.items()] + [('kshaker', kv) for kv in SHAKER_C.items()]
    only = os.environ.get('ONLY')
    if only: jobs = [j for j in jobs if only in str(j)]
    with Pool(4) as pool: res = pool.map(job, jobs)
    mf = os.path.join(OUT, 'manifest.json')
    man = json.load(open(mf)) if os.path.exists(mf) else {}
    for n, info in res:
        if info: man[n] = info
    json.dump(man, open(mf, 'w'), separators=(',', ':'), sort_keys=True)
    rj = os.path.join(os.path.dirname(JS), 'r3manifest.js')
    open(rj, 'w').write('// generated by tools/art3d/build.py: [w, h, anchorX, anchorY] in sprite pixels\nexport const R3 = ' + json.dumps(man, separators=(',', ':'), sort_keys=True) + ';\n')
    open(JS, 'w').write('// made by tools/art3d/station3d.py: where things are in the station and kitchen pictures (scene px)\nexport const ST3 = ' + json.dumps(layout(), indent=1) + ';\n')
    print('done', len(res))
