"""The game's models: the muscle car, the pressure washer and the garage props.

Units are metres, Z is up. The car's front points to +X. The washer's lance points
to +Y (it becomes -Z, "forward", once exported to glTF).
"""
import math
import random

import bpy

from kit import (apply_all, boolean_cut, box, curve_tube, cyl, loft, material, poly_prism, root,
                 sphere, torus)

PI = math.pi


# ------------------------------------------------------------------ palette

def mats():
    return dict(
        paint=material('CarPaint', '#1450c8', rough=0.18, coat=1.0),
        stripe=material('CarStripe', '#f4f1e8', rough=0.25, coat=1.0),
        chrome=material('Chrome', '#e8edf2', rough=0.12, metal=1.0),
        glass=material('Glass', '#16242e', rough=0.04, metal=0.2),
        rubber=material('Rubber', '#1b1c1f', rough=0.85),
        well=material('WheelWell', '#0c0c0e', rough=0.9),
        grille=material('Grille', '#18191c', rough=0.5, metal=0.4),
        headlight=material('Headlight', '#fff6d8', rough=0.05, emit='#fff1c4', emit_strength=0.6),
        taillight=material('Taillight', '#d11a1a', rough=0.15, emit='#ff2a1a', emit_strength=0.4),
        rim_dark=material('RimDark', '#2a2c31', rough=0.4, metal=0.6),
        # washer
        yellow=material('WasherYellow', '#ffb300', rough=0.3),
        black=material('WasherBlack', '#202226', rough=0.6),
        steel=material('Steel', '#b9c0c8', rough=0.25, metal=1.0),
        brass=material('Brass', '#d4a03c', rough=0.3, metal=1.0),
        nozzle_red=material('NozzleRed', '#e5322d', rough=0.4),
        # props
        wood=material('Wood', '#b87a45', rough=0.65),
        wood_dark=material('WoodDark', '#7a4a28', rough=0.7),
        metal_blue=material('MetalBlue', '#3c5a78', rough=0.45, metal=0.6),
        metal_grey=material('MetalGrey', '#7d858e', rough=0.45, metal=0.7),
        pegboard=material('Pegboard', '#c8a274', rough=0.8),
        tool_red=material('ToolRed', '#d8262a', rough=0.3, coat=0.6),
        tool_black=material('ToolBlack', '#232428', rough=0.4),
        drum_blue=material('DrumBlue', '#2c6fb5', rough=0.4, metal=0.3),
        drum_red=material('DrumRed', '#c8402a', rough=0.45, metal=0.3),
        cardboard=material('Cardboard', '#c29358', rough=0.85),
        can_yellow=material('CanYellow', '#f2b51b', rough=0.3, metal=0.3),
        can_green=material('CanGreen', '#3fa35b', rough=0.3, metal=0.3),
        orange=material('Orange', '#f07b1f', rough=0.4),
        wall=material('Wall', '#d9cdb8', rough=0.85),
        wall_low=material('WallLow', '#8a9aa6', rough=0.8),
        floor=material('Concrete', '#8f8d88', rough=0.6),
        trim=material('Trim', '#5a4a3a', rough=0.8),
        door=material('GarageDoor', '#e6e2d6', rough=0.5),
        lamp=material('Lamp', '#ffffff', rough=0.3, emit='#fff7e6', emit_strength=12.0),
        window=material('WindowLight', '#ffe3a8', rough=0.2, emit='#ffe0a0', emit_strength=5.0),
    )


# ------------------------------------------------------------------ helpers

def interp(pts, x):
    if x <= pts[0][0]:
        return pts[0][1]
    for (x0, y0), (x1, y1) in zip(pts, pts[1:]):
        if x <= x1:
            t = (x - x0) / (x1 - x0)
            t = t * t * (3 - 2 * t)          # smooth between profile points
            return y0 + (y1 - y0) * t
    return pts[-1][1]


def superellipse_ring(x, w, zc, h, n=4.0, pts=48, tumble=0.10):
    ring = []
    for j in range(pts):
        t = 2 * PI * j / pts
        c, s = math.cos(t), math.sin(t)
        y = w * math.copysign(abs(c) ** (2 / n), c)
        z = zc + h * math.copysign(abs(s) ** (2 / n), s)
        if s > 0:                            # sides lean in towards the top
            y *= 1 - tumble * s ** 2
        ring.append((x, y, z))
    return ring


# ------------------------------------------------------------------ the car

L = 2.45  # half length


def car(M):
    """Late-60s style muscle car, about 4.9 m long. Returns the root empty."""
    R = root('Car')

    top = [(-L, 0.9), (-2.3, 0.97), (-1.4, 0.99), (0.5, 0.99), (2.0, 0.97), (L, 0.9)]
    bot = [(-L, 0.42), (-2.15, 0.32), (2.15, 0.32), (L, 0.4)]
    wid = [(-L, 0.86), (-1.55, 0.96), (-0.6, 0.93), (0.5, 0.93), (1.5, 0.95), (L, 0.87)]

    stations = []
    N = 64
    for i in range(N + 1):
        u = -1 + 2 * i / N
        x = L * math.copysign(abs(u) ** 0.8, u) * 0.995   # denser at the ends
        f = (1 - (abs(x) / L) ** 12) ** (1 / 12)          # blunt, rounded nose and tail
        tz, bz = interp(top, x), interp(bot, x)
        zc, h = (tz + bz) / 2, (tz - bz) / 2
        stations.append(superellipse_ring(x, interp(wid, x) * (0.75 + 0.25 * f), zc,
                                          h * (0.8 + 0.2 * f), n=7.0, pts=64, tumble=0.05))
    body = loft('Body', stations, M['paint'], parent=R)

    # wheel wells: four short cylinders cut into the sides, then baked in
    cutters = []
    for wx in (-1.45, 1.45):
        for side in (-1, 1):
            c = cyl('cut', 0.47, 0.7, loc=(wx, side * 1.0, 0.37), mat=M['well'],
                    rot=(PI / 2, 0, 0), verts=40)
            boolean_cut(body, c)
            cutters.append(c)
    apply_all(body)
    for c in cutters:
        bpy.data.objects.remove(c)

    # cabin / greenhouse: a sloped frustum with soft edges
    bx0, bx1, rx0, rx1 = -1.5, 0.45, -1.0, -0.2
    bw, rw, bz, rz = 0.82, 0.7, 0.95, 1.40
    v = [(bx0, -bw, bz), (bx1, -bw, bz), (bx1, bw, bz), (bx0, bw, bz),
         (rx0, -rw, rz), (rx1, -rw, rz), (rx1, rw, rz), (rx0, rw, rz)]
    f = [(0, 3, 2, 1), (4, 5, 6, 7), (0, 1, 5, 4), (1, 2, 6, 5), (2, 3, 7, 6), (3, 0, 4, 7)]
    poly_prism('Cabin', v, f, M['paint'], parent=R, bev=0.11, segs=5)

    # windows: panels just outside each cabin face, shrunk to leave pillars
    def window(name, quad, sx, sy, normal):
        # quad corners ordered around; shrink towards centre, push out along normal
        cx = [sum(p[k] for p in quad) / 4 for k in range(3)]
        pts = []
        for p in quad:
            d = [p[k] - cx[k] for k in range(3)]
            pts.append((cx[0] + d[0] * sx + normal[0] * 0.012,
                        cx[1] + d[1] * sy + normal[1] * 0.012,
                        cx[2] + d[2] * sy + normal[2] * 0.012))
        thick = [(p[0] - normal[0] * 0.02, p[1] - normal[1] * 0.02, p[2] - normal[2] * 0.02)
                 for p in pts]
        verts = pts + thick
        faces = [(0, 1, 2, 3), (7, 6, 5, 4), (0, 4, 5, 1), (1, 5, 6, 2), (2, 6, 7, 3),
                 (3, 7, 4, 0)]
        return poly_prism(name, verts, faces, M['glass'], parent=R, bev=0.025, segs=2)

    def nrm(a, b, c):
        u = [b[k] - a[k] for k in range(3)]
        w = [c[k] - a[k] for k in range(3)]
        n = (u[1] * w[2] - u[2] * w[1], u[2] * w[0] - u[0] * w[2], u[0] * w[1] - u[1] * w[0])
        ln = math.sqrt(sum(k * k for k in n))
        return tuple(k / ln for k in n)

    ws = [v[1], v[2], v[6], v[5]]
    window('Windshield', ws, 0.86, 0.84, nrm(v[1], v[2], v[6]))
    rs = [v[3], v[0], v[4], v[7]]
    window('RearWindow', rs, 0.84, 0.80, nrm(v[3], v[0], v[4]))
    for side, quad in ((-1, [v[0], v[1], v[5], v[4]]), (1, [v[2], v[3], v[7], v[6]])):
        n = nrm(*quad[:3])
        window('SideWindow' + ('L' if side < 0 else 'R'), quad, 0.84, 0.74, n)

    # hood scoop
    box('HoodScoop', (0.8, 0.52, 0.14), loc=(1.25, 0, 1.0), mat=M['paint'], bev=0.06,
        segs=4, parent=R)
    box('ScoopMouth', (0.05, 0.42, 0.07), loc=(1.65, 0, 1.01), mat=M['grille'], bev=0.02,
        parent=R)

    # front: grille, quad headlights, bumper
    box('Grille', (0.12, 1.5, 0.27), loc=(L - 0.06, 0, 0.66), mat=M['grille'], bev=0.04,
        parent=R)
    for k, z in enumerate((0.60, 0.66, 0.72)):
        box('GrilleBar%d' % k, (0.03, 1.1, 0.018), loc=(L + 0.005, 0, z), mat=M['chrome'],
            bev=0.008, parent=R)
    for side in (-1, 1):
        for k, yy in enumerate((0.52, 0.70)):
            p = (L + 0.0, side * yy, 0.66)
            torus('HeadRing', 0.075, 0.018, loc=p, mat=M['chrome'], rot=(0, PI / 2, 0),
                  parent=R)
            cyl('Headlight', 0.07, 0.04, loc=p, mat=M['headlight'], rot=(0, PI / 2, 0),
                parent=R)
    box('FrontBumper', (0.16, 1.92, 0.12), loc=(L + 0.02, 0, 0.45), mat=M['chrome'],
        bev=0.055, segs=4, parent=R)
    box('Emblem', (0.02, 0.12, 0.07), loc=(L + 0.01, 0, 0.66), mat=M['nozzle_red'],
        bev=0.01, parent=R)

    # rear: tail lights, bumper, exhaust
    for side in (-1, 1):
        box('Taillight', (0.06, 0.48, 0.1), loc=(-L + 0.03, side * 0.5, 0.75),
            mat=M['taillight'], bev=0.025, parent=R)
        cyl('Exhaust', 0.045, 0.22, loc=(-L + 0.02, side * 0.55, 0.36), mat=M['chrome'],
            rot=(0, PI / 2, 0), parent=R)
    box('RearBumper', (0.15, 1.9, 0.12), loc=(-L - 0.01, 0, 0.47), mat=M['chrome'],
        bev=0.055, segs=4, parent=R)

    # mirrors and handles
    for side in (-1, 1):
        box('MirrorStalk', (0.03, 0.08, 0.03), loc=(0.3, side * 0.91, 1.0), mat=M['chrome'],
            bev=0.01, parent=R)
        box('Mirror', (0.12, 0.07, 0.08), loc=(0.3, side * 0.96, 1.04), mat=M['chrome'],
            bev=0.03, parent=R)
        box('Handle', (0.16, 0.03, 0.03), loc=(-0.45, side * 0.935, 0.86), mat=M['chrome'],
            bev=0.012, parent=R)

    # wheels
    for wx in (-1.45, 1.45):
        for side in (-1, 1):
            wheel('Wheel', M, (wx, side * 0.82, 0.37), side, R)
    return R


def wheel(name, M, loc, side, parent):
    W = root(name)
    W.parent = parent
    W.location = loc
    rot = (PI / 2, 0, 0)
    cyl('Tire', 0.37, 0.27, mat=M['rubber'], rot=rot, verts=48, bev=0.08, segs=4, parent=W)
    o = side * 0.137
    cyl('RimDish', 0.235, 0.02, loc=(0, o, 0), mat=M['rim_dark'], rot=rot, verts=40, parent=W)
    torus('RimLip', 0.235, 0.024, loc=(0, o, 0), mat=M['chrome'], rot=rot, parent=W)
    for k in range(5):
        a = 2 * PI * k / 5
        box('Spoke', (0.06, 0.03, 0.2), loc=(math.sin(a) * 0.11, o + side * 0.005,
                                             math.cos(a) * 0.11),
            mat=M['chrome'], rot=(0, a, 0), bev=0.012, parent=W)
    cyl('Cap', 0.05, 0.05, loc=(0, o + side * 0.01, 0), mat=M['chrome'], rot=rot, bev=0.015,
        parent=W)
    return W


# ------------------------------------------------------------------ the washer

def washer(M):
    """Pressure washer gun + lance. Origin at the hand, lance along +Y."""
    R = root('Washer')
    # pistol grip, tilted back
    box('Grip', (0.04, 0.05, 0.13), loc=(0, -0.015, -0.065), rot=(-0.28, 0, 0),
        mat=M['black'], bev=0.018, segs=4, parent=R)
    # gun body
    box('GunBody', (0.05, 0.22, 0.065), loc=(0, 0.04, 0.025), mat=M['yellow'], bev=0.02,
        segs=4, parent=R)
    box('GunStripe', (0.052, 0.1, 0.02), loc=(0, 0.06, 0.05), mat=M['black'], bev=0.006,
        parent=R)
    # trigger and guard
    box('Trigger', (0.018, 0.022, 0.06), loc=(0, 0.035, -0.03), rot=(0.25, 0, 0),
        mat=M['nozzle_red'], bev=0.008, parent=R)
    torus('Guard', 0.045, 0.007, loc=(0, 0.035, -0.022), rot=(0, PI / 2, 0), mat=M['black'],
          arc=PI, parent=R).rotation_euler = (PI, PI / 2, 0)
    # brass coupler and lance
    cyl('Coupler', 0.017, 0.04, loc=(0, 0.17, 0.025), rot=(PI / 2, 0, 0), mat=M['brass'],
        verts=16, parent=R)
    cyl('Lance', 0.009, 0.62, loc=(0, 0.48, 0.025), rot=(PI / 2, 0, 0), mat=M['steel'],
        verts=16, parent=R)
    cyl('LanceGrip', 0.02, 0.13, loc=(0, 0.36, 0.025), rot=(PI / 2, 0, 0), mat=M['yellow'],
        verts=20, bev=0.008, parent=R)
    for k, y in enumerate((0.31, 0.33, 0.35, 0.37, 0.39, 0.41)):
        torus('GripRib', 0.02, 0.003, loc=(0, y, 0.025), rot=(PI / 2, 0, 0), mat=M['black'],
              major=24, minor=6, parent=R)
    cyl('NozzleBody', 0.017, 0.05, loc=(0, 0.8, 0.025), rot=(PI / 2, 0, 0), mat=M['black'],
        verts=20, bev=0.005, parent=R)
    cyl('NozzleTip', 0.012, 0.02, r2=0.008, loc=(0, 0.835, 0.025), rot=(-PI / 2, 0, 0),
        mat=M['nozzle_red'], verts=16, parent=R)
    # hose leaving from the bottom of the grip
    curve_tube('Hose', [(0, -0.03, -0.13), (0.01, -0.06, -0.25), (0.06, -0.2, -0.38),
                        (0.12, -0.45, -0.45)], 0.011, M['black'], parent=R)
    return R


# ------------------------------------------------------------------ props

def workbench(M):
    R = root('Workbench')
    w, d, h = 2.0, 0.7, 0.92
    box('Top', (w, d, 0.07), loc=(0, 0, h), mat=M['wood'], bev=0.015, parent=R)
    box('Shelf', (w - 0.1, d - 0.1, 0.04), loc=(0, 0, 0.22), mat=M['wood_dark'], bev=0.01,
        parent=R)
    for sx in (-1, 1):
        for sy in (-1, 1):
            box('Leg', (0.07, 0.07, h), loc=(sx * (w / 2 - 0.08), sy * (d / 2 - 0.08), h / 2),
                mat=M['metal_blue'], bev=0.01, parent=R)
    box('Pegboard', (w, 0.03, 1.0), loc=(0, d / 2 - 0.02, h + 0.6), mat=M['pegboard'],
        bev=0.01, parent=R)
    box('PegFrame', (w + 0.04, 0.05, 0.05), loc=(0, d / 2 - 0.02, h + 1.1),
        mat=M['wood_dark'], bev=0.01, parent=R)
    # wrenches in size order
    for k in range(6):
        s = 0.16 + k * 0.03
        x = -0.85 + k * 0.1
        box('Wrench', (0.022, 0.01, s), loc=(x, d / 2 - 0.045, h + 0.55), mat=M['steel'],
            bev=0.006, parent=R)
        torus('WrenchHead', 0.02, 0.008, loc=(x, d / 2 - 0.045, h + 0.55 + s / 2 + 0.015),
              rot=(PI / 2, 0, 0), mat=M['steel'], major=16, minor=6, parent=R)
    # hammer, screwdrivers
    cyl('HammerHandle', 0.015, 0.32, loc=(-0.15, d / 2 - 0.05, h + 0.5), mat=M['wood'],
        parent=R)
    box('HammerHead', (0.14, 0.04, 0.04), loc=(-0.15, d / 2 - 0.05, h + 0.67),
        mat=M['tool_black'], bev=0.01, parent=R)
    for k, c in enumerate(('tool_red', 'can_yellow', 'can_green', 'tool_red')):
        x = 0.1 + k * 0.08
        cyl('DriverHandle', 0.016, 0.1, loc=(x, d / 2 - 0.05, h + 0.65), mat=M[c], bev=0.005,
            parent=R)
        cyl('DriverShaft', 0.004, 0.14, loc=(x, d / 2 - 0.05, h + 0.53), mat=M['steel'],
            parent=R)
    # vise at the right end
    box('ViseBase', (0.2, 0.16, 0.06), loc=(0.75, -0.15, h + 0.065), mat=M['metal_blue'],
        bev=0.015, parent=R)
    box('ViseJaw', (0.08, 0.16, 0.12), loc=(0.68, -0.15, h + 0.15), mat=M['metal_blue'],
        bev=0.015, parent=R)
    box('ViseJaw2', (0.08, 0.16, 0.12), loc=(0.84, -0.15, h + 0.15), mat=M['metal_blue'],
        bev=0.015, parent=R)
    cyl('ViseScrew', 0.012, 0.3, loc=(0.75, -0.3, h + 0.15), rot=(PI / 2, 0, 0),
        mat=M['steel'], parent=R)
    # clutter on the top
    for k, (x, c) in enumerate(((0.3, 'can_yellow'), (0.4, 'tool_red'), (-0.5, 'can_green'))):
        cyl('Can', 0.055, 0.14, loc=(x, 0.15, h + 0.105), mat=M[c], bev=0.01, parent=R)
    box('Rag', (0.25, 0.18, 0.02), loc=(-0.2, -0.1, h + 0.045), rot=(0, 0, 0.3),
        mat=M['nozzle_red'], bev=0.008, parent=R)
    # boxes on the shelf
    for k, x in enumerate((-0.6, -0.15, 0.45)):
        box('ShelfBox', (0.38, 0.35, 0.25 + 0.05 * k), loc=(x, 0, 0.36 + 0.025 * k),
            mat=M['cardboard'], bev=0.01, parent=R)
    return R


def toolbox(M):
    R = root('Toolbox')
    w, d, h = 0.75, 0.48, 0.9
    box('Cabinet', (w, d, h), loc=(0, 0, 0.1 + h / 2), mat=M['tool_red'], bev=0.025, parent=R)
    box('Mat', (w + 0.02, d + 0.02, 0.025), loc=(0, 0, 0.1 + h + 0.012), mat=M['tool_black'],
        bev=0.008, parent=R)
    hs = [0.1, 0.1, 0.12, 0.15, 0.2]
    z = 0.1 + h - 0.05
    for k, dh in enumerate(hs):
        z -= dh / 2 + 0.03
        box('Drawer', (w - 0.08, 0.02, dh), loc=(0, -d / 2 - 0.005, z), mat=M['tool_red'],
            bev=0.012, parent=R)
        box('Pull', (w - 0.25, 0.025, 0.018), loc=(0, -d / 2 - 0.022, z + dh / 2 - 0.025),
            mat=M['chrome'], bev=0.008, parent=R)
        z -= dh / 2
    for sx in (-1, 1):
        for sy in (-1, 1):
            cyl('Caster', 0.045, 0.035, loc=(sx * (w / 2 - 0.07), sy * (d / 2 - 0.07), 0.05),
                rot=(0, PI / 2, 0), mat=M['tool_black'], bev=0.01, parent=R)
    # top chest
    tz = 0.1 + h + 0.025
    box('Chest', (w - 0.06, d - 0.08, 0.32), loc=(0, 0.02, tz + 0.16), mat=M['tool_red'],
        bev=0.025, parent=R)
    box('Lid', (w - 0.04, d - 0.06, 0.06), loc=(0, 0.02, tz + 0.34), mat=M['tool_red'],
        bev=0.025, parent=R)
    box('ChestHandle', (0.3, 0.03, 0.025), loc=(0, -d / 2 + 0.01, tz + 0.24),
        mat=M['chrome'], bev=0.008, parent=R)
    box('Badge', (0.14, 0.012, 0.04), loc=(0, -d / 2 + 0.015, tz + 0.12),
        mat=M['can_yellow'], bev=0.006, parent=R)
    box('SideBar', (0.03, 0.3, 0.03), loc=(w / 2 + 0.04, 0, 0.75), mat=M['chrome'],
        bev=0.01, parent=R)
    return R


def tire_stack(M, n=4, seed=3):
    rnd = random.Random(seed)
    R = root('TireStack')
    for k in range(n):
        T = root('StackTire')
        T.parent = R
        T.location = (rnd.uniform(-0.04, 0.04), rnd.uniform(-0.04, 0.04), 0.13 + k * 0.25)
        T.rotation_euler = (rnd.uniform(-0.04, 0.04), rnd.uniform(-0.04, 0.04), rnd.random())
        torus('Tire', 0.27, 0.125, mat=M['rubber'], scale=(1, 1, 0.98), major=40, minor=16,
              parent=T)
        # tread blocks
        for j in range(20):
            a = 2 * PI * j / 20
            box('Tread', (0.04, 0.035, 0.18), loc=(math.cos(a) * 0.39, math.sin(a) * 0.39, 0),
                rot=(0, 0, a), mat=M['rubber'], bev=0.01, parent=T)
    # one tire leaning against the stack
    T = root('LeanTire')
    T.parent = R
    T.location = (0.55, -0.15, 0.37)
    T.rotation_euler = (PI / 2 - 0.25, 0, 0.5)
    torus('Tire', 0.24, 0.12, mat=M['rubber'], parent=T)
    cyl('Rim', 0.2, 0.12, mat=M['metal_grey'], parent=T, bev=0.02)
    return R


def drum(M, color='drum_blue', name='Drum'):
    R = root(name)
    cyl('Barrel', 0.29, 0.88, loc=(0, 0, 0.44), mat=M[color], verts=40, bev=0.02, parent=R)
    for z in (0.3, 0.6):
        torus('Rib', 0.292, 0.012, loc=(0, 0, z), mat=M[color], major=40, minor=8, parent=R)
    torus('Rim', 0.285, 0.015, loc=(0, 0, 0.88), mat=M['metal_grey'], major=40, minor=8,
          parent=R)
    cyl('Bung', 0.04, 0.02, loc=(0.15, 0.05, 0.885), mat=M['metal_grey'], parent=R)
    box('Label', (0.3, 0.01, 0.2), loc=(0, -0.29, 0.45), rot=(0, 0, 0), mat=M['stripe'],
        bev=0.004, parent=R)
    return R


def shelf_unit(M, seed=5):
    rnd = random.Random(seed)
    R = root('Shelves')
    w, d, h = 1.4, 0.45, 2.0
    for sx in (-1, 1):
        for sy in (-1, 1):
            box('Post', (0.04, 0.04, h), loc=(sx * (w / 2 - 0.02), sy * (d / 2 - 0.02), h / 2),
                mat=M['metal_grey'], bev=0.006, parent=R)
    for k, z in enumerate((0.15, 0.7, 1.25, 1.8)):
        box('Board', (w, d, 0.03), loc=(0, 0, z), mat=M['metal_grey'], bev=0.006, parent=R)
        x = -w / 2 + 0.1
        while x < w / 2 - 0.2:
            kind = rnd.random()
            if kind < 0.45:
                bw, bh = rnd.uniform(0.25, 0.4), rnd.uniform(0.2, 0.35)
                box('Box', (bw, d - 0.08, bh), loc=(x + bw / 2, 0, z + 0.015 + bh / 2),
                    rot=(0, 0, rnd.uniform(-0.08, 0.08)), mat=M['cardboard'], bev=0.01,
                    parent=R)
                x += bw + 0.05
            else:
                c = rnd.choice(['can_yellow', 'tool_red', 'can_green', 'drum_blue', 'orange'])
                ch = rnd.uniform(0.15, 0.28)
                cyl('Can', 0.06, ch, loc=(x + 0.06, rnd.uniform(-0.1, 0.1), z + 0.015 + ch / 2),
                    mat=M[c], bev=0.01, parent=R)
                x += 0.15
    return R


def bucket(M):
    R = root('Bucket')
    cyl('Pail', 0.17, 0.32, r2=0.2, loc=(0, 0, 0.16), mat=M['orange'], verts=32, bev=0.01,
        parent=R)
    cyl('Suds', 0.185, 0.02, loc=(0, 0, 0.29), mat=M['stripe'], verts=32, parent=R)
    for k in range(7):
        a = k * 0.9
        sphere('Foam', 0.05 + 0.02 * (k % 3), loc=(math.cos(a) * 0.1, math.sin(a) * 0.1, 0.31),
               mat=M['stripe'], parent=R)
    torus('Handle', 0.2, 0.006, loc=(0, 0, 0.32), rot=(PI / 2, 0, 0), arc=PI, mat=M['steel'],
          parent=R)
    return R


def garage(M, size=(11.0, 9.0, 3.6)):
    """Room shell: floor, three walls with a garage door and a window, ceiling lights.
    Centred on the origin; the open side (camera side) is -Y."""
    sx, sy, sz = size
    R = root('Garage')
    box('Floor', (sx, sy, 0.1), loc=(0, 0, -0.05), mat=M['floor'], bev=0, parent=R)
    # back wall (+Y) and side walls
    box('BackWall', (sx, 0.2, sz), loc=(0, sy / 2, sz / 2), mat=M['wall'], bev=0, parent=R)
    box('BackWainscot', (sx, 0.22, 1.0), loc=(0, sy / 2, 0.5), mat=M['wall_low'], bev=0,
        parent=R)
    for side in (-1, 1):
        box('SideWall', (0.2, sy, sz), loc=(side * sx / 2, 0, sz / 2), mat=M['wall'], bev=0,
            parent=R)
        box('SideWainscot', (0.22, sy, 1.0), loc=(side * sx / 2, 0, 0.5), mat=M['wall_low'],
            bev=0, parent=R)
    box('FrontWall', (sx, 0.2, sz), loc=(0, -sy / 2, sz / 2), mat=M['wall'], bev=0, parent=R)
    box('Ceiling', (sx, sy, 0.1), loc=(0, 0, sz + 0.05), mat=M['wall'], bev=0, parent=R)
    # roof beams
    for k in range(5):
        x = -sx / 2 + sx * (k + 0.5) / 5
        box('Beam', (0.18, sy, 0.25), loc=(x, 0, sz - 0.12), mat=M['wood_dark'], bev=0.01,
            parent=R)
    # roll-up garage door on the left wall
    box('DoorFrame', (0.26, 3.4, 2.75), loc=(-sx / 2, -0.5, 1.37), mat=M['trim'], bev=0.01,
        parent=R)
    for k in range(5):
        box('DoorPanel', (0.28, 3.2, 0.5), loc=(-sx / 2 + 0.02, -0.5, 0.27 + k * 0.52),
            mat=M['door'], bev=0.03, parent=R)
    # window on the back wall
    box('WindowFrame', (1.6, 0.26, 1.0), loc=(2.6, sy / 2, 2.0), mat=M['trim'], bev=0.01,
        parent=R)
    box('WindowGlow', (1.4, 0.28, 0.82), loc=(2.6, sy / 2, 2.0), mat=M['window'], bev=0,
        parent=R)
    box('WindowBar', (0.05, 0.3, 0.82), loc=(2.6, sy / 2, 2.0), mat=M['trim'], bev=0,
        parent=R)
    # ceiling lights
    for x in (-2.5, 0.0, 2.5):
        for y in (-1.5, 1.5):
            box('LightHousing', (1.3, 0.22, 0.08), loc=(x, y, sz - 0.3), mat=M['metal_grey'],
                bev=0.01, parent=R)
            box('LightTube', (1.2, 0.12, 0.03), loc=(x, y, sz - 0.35), mat=M['lamp'], bev=0.01,
                parent=R)
    # oil stain decals and floor lines
    for k, (x, y, r) in enumerate(((1.4, 1.6, 0.35), (-2.2, -0.9, 0.25), (3.0, -2.4, 0.3))):
        cyl('Stain', r, 0.004, loc=(x, y, 0.002), mat=material('Stain', '#77746e', rough=0.25),
            verts=24, parent=R)
    for x in (-1.6, 1.6):
        box('FloorLine', (0.08, 6.5, 0.004), loc=(x, 0.3, 0.002),
            mat=material('FloorPaint', '#e8c23a', rough=0.5), bev=0, parent=R)
    return R
