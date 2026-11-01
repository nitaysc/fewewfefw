"""Builds the galleon in Blender and exports assets/ship/galleon.glb.

Run: python3 tools/build_galleon.py      (needs `pip install bpy`; textures from tools/textures.py)

Everything is authored in ship space (as Godot sees it): +Z bow, +Y up, X across,
waterline at Y = 0, and converted to Blender's Z-up axes when the meshes are made.
Exported nodes Godot relies on:
  Hull, Rigging           static parts
  Yard_<name>             pivot on the mast axis (rotates for bracing), with a Sail_<name> child
  Lateen, Sprit           the mizzen lateen and the spritsail yard, same idea
  Rudder                  pivot at the stern post
  Flag_<n>                flat grids the Godot shader makes flutter
"""
import math
import os
import sys

import bpy
from mathutils import Vector, Matrix

sys.path.insert(0, os.path.dirname(__file__))
from build_constants import (LENGTH, DECK, SPLIT, GUNPORTS_U, z_at, rail_top, keel,  # noqa: E402
                             half_width, plan_half)

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
TEX = os.path.join(ROOT, 'assets', 'ship', 'tex')
OUT = os.path.join(ROOT, 'assets', 'ship', 'galleon.glb')
HULL_Y0, HULL_Y1 = -3.4, 9.8

V = Vector


def to_blender(p):
    return (p[0], -p[2], p[1])


# ------------------------------------------------------------------ mesh builder
class Builder:
    """Collects geometry per material, then becomes one Blender object."""

    def __init__(self):
        self.parts = {}

    def _part(self, mat):
        return self.parts.setdefault(mat, {'v': [], 'f': [], 'uv': [], 'smooth': []})

    def face(self, mat, pts, uvs, smooth=True):
        p = self._part(mat)
        base = len(p['v'])
        p['v'].extend(pts)
        p['f'].append(list(range(base, base + len(pts))))
        p['uv'].append(uvs)
        p['smooth'].append(smooth)

    def grid(self, mat, rows, uvrows, smooth=True, flip=False, wrap=False):
        """rows[i][j] points; quads between neighbours. Normal = d(row) x d(col) unless flip."""
        p = self._part(mat)
        nr, nc = len(rows), len(rows[0])
        base = len(p['v'])
        for r in rows:
            p['v'].extend(r)
        cols = nc if wrap else nc - 1
        for i in range(nr - 1):
            for j in range(cols):
                j1 = (j + 1) % nc
                a, b, c, d = base + i * nc + j, base + i * nc + j1, base + (i + 1) * nc + j1, base + (i + 1) * nc + j
                ua, ub = uvrows[i][j], uvrows[i][j1] if not (wrap and j1 == 0) else (uvrows[i][j][0] + (uvrows[i][j][0] - uvrows[i][j - 1][0] if j else 0), uvrows[i][j1][1])
                uc = uvrows[i + 1][j1] if not (wrap and j1 == 0) else (ub[0], uvrows[i + 1][j1][1])
                ud = uvrows[i + 1][j]
                if flip:
                    p['f'].append([a, d, c, b]); p['uv'].append([ua, ud, uc, ub])
                else:
                    p['f'].append([a, b, c, d]); p['uv'].append([ua, ub, uc, ud])
                p['smooth'].append(smooth)

    def tube(self, mat, path, radius, seg=8, smooth=True, caps=False, uv_scale=0.5, radii=None):
        """A round tube along a path (list of Vectors)."""
        rings, uvr = [], []
        n = len(path)
        acc = 0.0
        prev_side = None
        for i, c in enumerate(path):
            t = (path[min(i + 1, n - 1)] - path[max(i - 1, 0)]).normalized()
            ref = V((0, 1, 0)) if abs(t.y) < 0.9 else V((1, 0, 0))
            side = t.cross(ref).normalized() if prev_side is None else (prev_side - t * prev_side.dot(t)).normalized()
            if side.length < 1e-6:
                side = t.cross(ref).normalized()
            prev_side = side
            up = side.cross(t).normalized()
            r = radii[i] if radii else radius
            if i:
                acc += (path[i] - path[i - 1]).length
            ring, uvs = [], []
            for k in range(seg):
                a = 2 * math.pi * k / seg
                ring.append(c + side * (math.cos(a) * r) + up * (math.sin(a) * r))
                uvs.append((k / seg, acc * uv_scale))
            rings.append(ring); uvr.append(uvs)
        self.grid(mat, rings, uvr, smooth, flip=True, wrap=True)
        if caps:
            self.face(mat, list(reversed(rings[0])), [(0.5, 0.5)] * seg, False)
            self.face(mat, rings[-1], [(0.5, 0.5)] * seg, False)

    def cyl(self, mat, a, b, r0, r1=None, seg=10, caps=True, smooth=True, uv_scale=0.5):
        a, b = V(a), V(b)
        steps = max(1, int((b - a).length / 3))
        path = [a.lerp(b, i / steps) for i in range(steps + 1)]
        r1 = r0 if r1 is None else r1
        radii = [r0 + (r1 - r0) * i / steps for i in range(steps + 1)]
        self.tube(mat, path, r0, seg, smooth, caps, uv_scale, radii)

    def lathe(self, mat, base, axis, profile, seg=12, smooth=True):
        """profile: [(radius, height)] around axis from base."""
        axis = V(axis).normalized()
        ref = V((0, 1, 0)) if abs(axis.y) < 0.9 else V((1, 0, 0))
        side = axis.cross(ref).normalized()
        up = side.cross(axis).normalized()
        rings, uvr = [], []
        for i, (r, h) in enumerate(profile):
            c = V(base) + axis * h
            rings.append([c + side * (math.cos(2 * math.pi * k / seg) * r) + up * (math.sin(2 * math.pi * k / seg) * r) for k in range(seg)])
            uvr.append([(k / seg, i / len(profile)) for k in range(seg)])
        self.grid(mat, rings, uvr, smooth, flip=True, wrap=True)

    def box(self, mat, a, b, w, h, up=(0, 1, 0), uv_scale=0.5):
        """Box from a to b (length axis), w across, h along 'up'."""
        a, b = V(a), V(b)
        t = (b - a)
        L = t.length
        t.normalize()
        u = V(up); u = (u - t * u.dot(t))
        if u.length < 1e-5:
            u = V((1, 0, 0)) - t * t.x
        u.normalize()
        s = t.cross(u).normalized()
        hw, hh = w / 2, h / 2
        c = [a + s * sx * hw + u * sy * hh for sx, sy in ((-1, -1), (1, -1), (1, 1), (-1, 1))]
        d = [p + t * L for p in c]
        uvL = L * uv_scale
        quads = [(c[0], c[1], d[1], d[0]), (c[1], c[2], d[2], d[1]), (c[2], c[3], d[3], d[2]), (c[3], c[0], d[0], d[3])]
        for q in quads:
            self.face(mat, list(q), [(0, 0), (w * uv_scale, 0), (w * uv_scale, uvL), (0, uvL)], False)
        self.face(mat, [c[3], c[2], c[1], c[0]], [(0, 0), (1, 0), (1, 1), (0, 1)], False)
        self.face(mat, [d[0], d[1], d[2], d[3]], [(0, 0), (1, 0), (1, 1), (0, 1)], False)

    def make(self, name, materials, location=(0, 0, 0), parent=None):
        verts, faces, uvs, smooth, mats = [], [], [], [], []
        names = list(self.parts.keys())
        for mi, m in enumerate(names):
            p = self.parts[m]
            base = len(verts)
            verts.extend(to_blender(v) for v in p['v'])
            for f, uv, sm in zip(p['f'], p['uv'], p['smooth']):
                faces.append([i + base for i in f]); uvs.append(uv); smooth.append(sm); mats.append(mi)
        mesh = bpy.data.meshes.new(name)
        mesh.from_pydata(verts, [], faces)
        uvl = mesh.uv_layers.new(name='UVMap')
        li = 0
        for poly, uv in zip(mesh.polygons, uvs):
            for k in range(poly.loop_total):
                uvl.data[poly.loop_start + k].uv = uv[k]
            li += poly.loop_total
        for poly, sm, mi in zip(mesh.polygons, smooth, mats):
            poly.use_smooth = sm
            poly.material_index = mi
        for m in names:
            mesh.materials.append(materials[m])
        mesh.validate()
        obj = bpy.data.objects.new(name, mesh)
        obj.location = to_blender(location)
        bpy.context.collection.objects.link(obj)
        if parent:
            obj.parent = parent
        return obj


# ------------------------------------------------------------------ materials
def image(name):
    path = os.path.join(TEX, name)
    img = bpy.data.images.load(path)
    return img


def material(name, color=None, albedo=None, normal=None, rough=0.75, metal=0.0, strength=1.0, emit=None):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    m.use_backface_culling = False
    nt = m.node_tree
    bsdf = nt.nodes['Principled BSDF']
    bsdf.inputs['Roughness'].default_value = rough
    bsdf.inputs['Metallic'].default_value = metal
    if color:
        bsdf.inputs['Base Color'].default_value = (*color, 1)
    if albedo:
        t = nt.nodes.new('ShaderNodeTexImage'); t.image = image(albedo)
        nt.links.new(t.outputs['Color'], bsdf.inputs['Base Color'])
    if normal:
        t = nt.nodes.new('ShaderNodeTexImage'); t.image = image(normal)
        t.image.colorspace_settings.name = 'Non-Color'
        nm = nt.nodes.new('ShaderNodeNormalMap'); nm.inputs['Strength'].default_value = strength
        nt.links.new(t.outputs['Color'], nm.inputs['Color'])
        nt.links.new(nm.outputs['Normal'], bsdf.inputs['Normal'])
    if emit:
        bsdf.inputs['Emission Color'].default_value = (*emit, 1)
        bsdf.inputs['Emission Strength'].default_value = 3.0
    return m


def srgb(h):
    h = h.lstrip('#')
    c = [int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)]
    return tuple(x / 12.92 if x <= 0.04045 else ((x + 0.055) / 1.055) ** 2.4 for x in c)


# ------------------------------------------------------------------ hull
def hull_uv(u, y):
    return (u, (y - HULL_Y0) / (HULL_Y1 - HULL_Y0))


def build_hull(B):
    NU, NV = 140, 52
    THICK = 0.22
    for side in (1, -1):
        outer, inner, uo, ui = [], [], [], []
        for i in range(NU + 1):
            u = i / NU
            top, bot = rail_top(u), keel(u)
            ro, ri, ruo, rui = [], [], [], []
            for j in range(NV + 1):
                s = j / NV
                s = s * s * (3 - 2 * s) * 0.35 + s * 0.65  # more rows near keel and rail
                y = bot + (top - bot) * s
                w = half_width(u, y)
                z = z_at(u)
                ro.append(V((side * w, y, z)))
                ruo.append(hull_uv(u, y))
                ri.append(V((side * max(0.0, w - THICK), y, z + (0.12 if u < 0.002 else 0))))
                rui.append(hull_uv(u, y))
            outer.append(ro); inner.append(ri); uo.append(ruo); ui.append(rui)
        # outer skin: rows along u, columns up the side
        B.grid('hull', outer, uo, True, flip=(side < 0))
        # inner skin (only shows above the decks)
        B.grid('hull_in', inner, ui, True, flip=(side > 0))
        # rail cap joining the two skins
        cap_o = [outer[i][-1] for i in range(NU + 1)]
        cap_i = [inner[i][-1] for i in range(NU + 1)]
        B.grid('wood', [cap_o, cap_i], [[(i / 8, 0) for i in range(NU + 1)], [(i / 8, 0.1) for i in range(NU + 1)]], False, flip=(side > 0))

    # transom: a flat stern with the gallery windows
    N = 40
    top, bot, z = rail_top(0), keel(0), z_at(0)
    maxw = plan_half(0)
    rows, uvs = [], []
    for j in range(N + 1):
        y = bot + (top - bot) * j / N
        w = half_width(0, y)
        rows.append([V((w, y, z)), V((-w, y, z))])
        uvs.append([(0.5 + w / (2 * maxw), (y - HULL_Y0) / (HULL_Y1 - HULL_Y0)), (0.5 - w / (2 * maxw), (y - HULL_Y0) / (HULL_Y1 - HULL_Y0))])
    B.grid('stern', rows, uvs, True, flip=True)


def deck(B, y, u0, u1, mat='deck'):
    N = 50
    rows, uvs = [], []
    for i in range(N + 1):
        u = u0 + (u1 - u0) * i / N
        w = max(0.0, half_width(u, y) - 0.2)
        z = z_at(u)
        rows.append([V((-w, y, z)), V((w, y, z))])
        uvs.append([(-w / 5, z / 5), (w / 5, z / 5)])
    B.grid(mat, rows, uvs, False, flip=True)


def bulkhead(B, u, y0, y1, facing):
    N = 16
    z = z_at(u) + facing * 0.03
    maxw = plan_half(u)
    rows, uvs = [], []
    for j in range(N + 1):
        y = y0 + (y1 - y0) * j / N
        w = half_width(u, y) - 0.2
        rows.append([V((-w, y, z)), V((w, y, z))])
        v = (y - HULL_Y0) / (HULL_Y1 - HULL_Y0)
        uvs.append([(0.5 - w / (2 * maxw), v), (0.5 + w / (2 * maxw), v)])
    B.grid('stern', rows, uvs, False, flip=(facing < 0))
    # doors
    for x in (-1.6, 1.6):
        B.box('wood', V((x, y0, z + facing * 0.05)), V((x, y0 + 1.9, z + facing * 0.05)), 0.95, 0.08, up=(0, 0, 1))
        B.box('gold', V((x + 0.3, y0 + 1.0, z + facing * 0.1)), V((x + 0.3, y0 + 1.08, z + facing * 0.1)), 0.08, 0.08)


def sweep_along_rail(B, mat, y_of_u, offset, w, h, u0=0.0, u1=1.0, steps=160, side=1, inset=0.0):
    pts = []
    for i in range(steps + 1):
        u = u0 + (u1 - u0) * i / steps
        y = y_of_u(u)
        hw = half_width(u, y)
        if hw < 0.05:
            continue
        pts.append(V((side * (hw + offset - inset), y, z_at(u))))
    for a, b in zip(pts, pts[1:]):
        B.box(mat, a, b, w, h)


def wale(B, y, side, r=0.15):
    pts = []
    for i in range(141):
        u = 0.003 + 0.98 * i / 140
        yy = y + (0.3 * ((u - 0.5) * 2) ** 2 if y > 2 else 0.08 * ((u - 0.5) * 2) ** 2)
        if yy >= rail_top(u) - 0.1:
            continue
        w = half_width(u, yy)
        if w < 0.2:
            continue
        pts.append(V((side * (w + 0.02), yy, z_at(u))))
    if len(pts) > 2:
        B.tube('darkwood', pts, r, 8, True, True, 0.3)


def baluster(B, x, y, z, h, mat='red'):
    prof = [(0.07, 0), (0.09, 0.05), (0.05, 0.12), (0.06, h * 0.3), (0.1, h * 0.5), (0.06, h * 0.7), (0.05, h * 0.88), (0.08, h * 0.95), (0.08, h)]
    B.lathe(mat, (x, y, z), (0, 1, 0), prof, 8)


def balustrade(B, u, y, h, facing):
    w = half_width(u, y + h) - 0.3
    z = z_at(u) + facing * 0.15
    n = int(2 * w / 0.38)
    for k in range(n + 1):
        baluster(B, -w + 2 * w * k / n, y, z, h)
    B.box('red', V((-w - 0.1, y + h, z)), V((w + 0.1, y + h, z)), 0.22, 0.14)
    B.box('gold', V((-w - 0.1, y + h + 0.09, z)), V((w + 0.1, y + h + 0.09, z)), 0.12, 0.04)


def cannon(B, pos, direction, length=2.4, r=0.2):
    d = V(direction).normalized()
    prof = [(0.0, 0), (0.12, -0.12), (r * 1.25, 0), (r * 1.3, 0.25), (r * 1.15, 0.3), (r * 1.1, length * 0.45), (r * 1.2, length * 0.47),
            (r * 0.95, length * 0.5), (r * 0.85, length * 0.95), (r * 1.05, length * 0.97), (r * 1.0, length), (r * 0.55, length), (r * 0.5, length * 0.9)]
    B.lathe('iron', V(pos) - d * (length * 0.5), d, prof, 12)


def gun_carriage(B, pos, outward, side):
    p = V(pos)
    for dz in (-0.35, 0.35):
        B.box('darkwood', p + V((-side * 0.9, -0.55, dz)), p + V((side * 0.2, -0.55, dz)), 0.12, 0.55)
    for dx in (-0.7, 0.05):
        B.cyl('iron', p + V((side * dx, -0.85, -0.45)), p + V((side * dx, -0.85, 0.45)), 0.17, seg=10)


def build_deck_furniture(B):
    # main hatch with grating
    zc = z_at(0.46)
    B.box('darkwood', V((0, DECK['main'], zc - 1.6)), V((0, DECK['main'], zc + 1.6)), 2.6, 0.5, up=(0, 1, 0))
    for k in range(-5, 6):
        B.box('wood', V((k * 0.22, DECK['main'] + 0.26, zc - 1.4)), V((k * 0.22, DECK['main'] + 0.26, zc + 1.4)), 0.07, 0.06)
    # capstan
    zc = z_at(0.41)
    B.lathe('darkwood', (0, DECK['main'], zc), (0, 1, 0), [(0.0, 0), (0.55, 0), (0.55, 0.15), (0.38, 0.2), (0.32, 0.8), (0.6, 0.85), (0.6, 1.05), (0.0, 1.06)], 14)
    for k in range(6):
        a = k * math.pi / 3
        B.cyl('wood', V((0, DECK['main'] + 0.95, zc)), V((math.cos(a) * 1.5, DECK['main'] + 0.95, zc + math.sin(a) * 1.5)), 0.05, seg=6)
    # ship's boat on the waist
    z0, z1 = z_at(0.6), z_at(0.73)
    rows, uvs = [], []
    for i in range(21):
        t = i / 20
        z = z0 + (z1 - z0) * t
        bw = 1.15 * math.sin(math.pi * (0.08 + 0.84 * t)) ** 0.6
        row, uv = [], []
        for j in range(9):
            a = math.pi * j / 8
            row.append(V((math.cos(a) * bw, DECK['main'] + 0.35 + 0.75 - math.sin(a) * 0.75 * (0.3 + 0.7 * math.sin(math.pi * t)), z)))
            uv.append((t * 2, j / 8))
        rows.append(row); uvs.append(uv)
    B.grid('boat', rows, uvs, True, flip=False)
    B.box('wood', V((0, DECK['main'] + 1.12, z0 + 0.3)), V((0, DECK['main'] + 1.12, z1 - 0.3)), 2.25, 0.08)
    for zz in (z0 + 1.0, z1 - 1.0):
        B.box('darkwood', V((-1.3, DECK['main'] + 0.1, zz)), V((1.3, DECK['main'] + 0.1, zz)), 0.25, 0.3)
    # belfry / binnacle on the quarterdeck
    zc = z_at(0.24)
    B.box('darkwood', V((0, DECK['quarter'], zc)), V((0, DECK['quarter'] + 1.2, zc)), 0.7, 0.5, up=(0, 0, 1))
    # ship's wheel (whipstaff era, but it reads well)
    B.lathe('gold', (0, DECK['quarter'] + 1.25, zc), (0, 1, 0), [(0, 0), (0.18, 0.05), (0.16, 0.25), (0, 0.3)], 10)


def build_stern_details(B):
    z = z_at(0)
    top = rail_top(0)
    # gold frame up the transom edges
    for side in (1, -1):
        pts = []
        for j in range(30):
            y = -0.3 + (top + 0.3 - -0.3) * j / 29
            pts.append(V((side * (half_width(0, y) + 0.04), y, z - 0.06)))
        B.tube('gold', pts, 0.16, 8, True, True)
    for y in (5.3, 7.75, top):
        w = half_width(0, y)
        B.box('gold', V((-w - 0.15, y, z - 0.12)), V((w + 0.15, y, z - 0.12)), 0.3, 0.32)
    # stern galleries: bay windows overhanging the stern
    for y0, y1 in ((3.6, 5.1), (6.05, 7.55)):
        w = half_width(0, y1) - 0.6
        B.box('red', V((-w, y0 - 0.15, z - 0.55)), V((w, y0 - 0.15, z - 0.55)), 1.0, 0.25)
        B.box('gold', V((-w, y1 + 0.1, z - 0.5)), V((w, y1 + 0.1, z - 0.5)), 1.0, 0.2)
        n = 7
        for k in range(n + 1):
            x = -w + 2 * w * k / n
            B.box('gold', V((x, y0, z - 0.9)), V((x, y1, z - 0.9)), 0.12, 0.12)
        B.box('glass', V((-w, (y0 + y1) / 2, z - 0.9)), V((w, (y0 + y1) / 2, z - 0.9)), y1 - y0, 0.04, up=(0, 1, 0))
    # quarter galleries on the sides of the stern castle
    for side in (1, -1):
        for y0, y1 in ((3.7, 5.2), (6.1, 7.5)):
            u0, u1 = 0.03, 0.13
            for u in (u0, u1):
                pass
            zc0, zc1 = z_at(u0), z_at(u1)
            wx = half_width((u0 + u1) / 2, (y0 + y1) / 2)
            B.box('stern_side', V((side * (wx + 0.25), y0, (zc0 + zc1) / 2)), V((side * (wx + 0.25), y1, (zc0 + zc1) / 2)), zc1 - zc0, 0.9, up=(0, 0, 1))
            B.box('gold', V((side * (wx + 0.3), y1 + 0.05, zc0 - 0.1)), V((side * (wx + 0.3), y1 + 0.05, zc1 + 0.1)), 1.0, 0.18)
            B.box('red', V((side * (wx + 0.3), y0 - 0.1, zc0 - 0.1)), V((side * (wx + 0.3), y0 - 0.1, zc1 + 0.1)), 1.0, 0.2)
            for k in range(4):
                zz = zc0 + 0.5 + (zc1 - zc0 - 1.0) * k / 3
                B.box('glass', V((side * (wx + 0.72), y0 + 0.25, zz)), V((side * (wx + 0.72), y1 - 0.25, zz)), 0.55, 0.03, up=(1, 0, 0))
        # turret roof on top of the gallery
        u = 0.08
        wx = half_width(u, 7.5)
        B.lathe('darkwood', (side * (wx + 0.3), 7.6, z_at(u)), (0, 1, 0), [(1.2, 0), (1.2, 0.15), (0.85, 0.55), (0.3, 0.9), (0.08, 1.25), (0, 1.35)], 12)
    # lanterns
    for x, dy in ((-2.7, 0.6), (0, 1.0), (2.7, 0.6)):
        base = V((x, top + dy - 0.6, z - 0.2))
        B.cyl('gold', base - V((0, 0.6, 0)), base, 0.07, seg=6)
        B.lathe('gold', base, (0, 1, 0), [(0.0, 0), (0.22, 0.02), (0.22, 0.1)], 8)
        B.lathe('lantern', base + V((0, 0.1, 0)), (0, 1, 0), [(0.22, 0), (0.34, 0.45), (0.26, 0.85)], 8)
        B.lathe('gold', base + V((0, 0.95, 0)), (0, 1, 0), [(0.3, -0.1), (0.36, 0), (0.1, 0.45), (0.12, 0.55), (0, 0.7)], 8)


def build_bow(B):
    zs = LENGTH / 2
    # beakhead platform
    rows, uvs = [], []
    for i in range(13):
        t = i / 12
        z = zs - 0.8 + t * 6.2
        w = 1.45 * (1 - t) ** 0.9 + 0.08
        y = 4.75 + 0.9 * t * t
        rows.append([V((-w, y - 0.6 * (1 - t), z)), V((-w, y, z)), V((w, y, z)), V((w, y - 0.6 * (1 - t), z))])
        uvs.append([(0, t), (0.3, t), (0.7, t), (1, t)])
    B.grid('red', rows, uvs, True, flip=False)
    # head rails sweeping up to the figurehead
    for side in (1, -1):
        for k, h in enumerate((0.0, 0.9)):
            pts = [V((side * (half_width(0.97, 5.4) + 0.2), 5.0 + h, zs - 1.2)),
                   V((side * 1.05, 5.0 + h * 0.8, zs + 1.4)),
                   V((side * 0.5, 5.1 + h * 0.5, zs + 3.6)),
                   V((side * 0.12, 5.6, zs + 5.2))]
            B.tube('darkwood' if k == 0 else 'gold', [pts[0], pts[0].lerp(pts[1], 0.5)] + pts[1:], 0.07, 6, True, True)
    # figurehead: a gilded lion
    fz = zs + 5.5
    B.lathe('gold', (0, 5.0, fz - 1.4), (0, 0.55, 0.85), [(0.0, 0), (0.35, 0.15), (0.5, 0.6), (0.48, 1.2), (0.38, 1.6), (0.0, 1.75)], 12)
    B.lathe('gold', (0, 6.05, fz + 0.05), (0, 0.2, 1), [(0.0, -0.1), (0.42, 0.0), (0.5, 0.3), (0.42, 0.6), (0.2, 0.75), (0.0, 0.8)], 12)
    # cathead beams
    for side in (1, -1):
        p = V((side * half_width(0.9, 5.6), 5.6, z_at(0.9)))
        B.box('darkwood', p, p + V((side * 1.4, 0.2, 0.6)), 0.35, 0.35)


def build_guns(B):
    for u in GUNPORTS_U:
        for side in (1, -1):
            w = half_width(u, 1.9)
            cannon(B, V((side * (w + 0.35), 1.9, z_at(u))), V((side, 0.02, 0)), 2.2, 0.17)
            # open port lid hinged at the top
            top = V((side * (w + 0.06), 2.32, z_at(u)))
            B.box('red', top, top + V((side * 0.75, 0.35, 0)), 0.72, 0.08, up=(0, 0, 1))
    # deck guns on carriages in the waist, run out over the bulwark
    for u in (0.43, 0.5, 0.57, 0.66):
        for side in (1, -1):
            y = DECK['main'] + 0.95
            w = half_width(u, y)
            cannon(B, V((side * (w - 0.55), y, z_at(u))), V((side, 0.03, 0)), 2.6, 0.17)
            gun_carriage(B, V((side * (w - 0.9), y, z_at(u))), side, side)


def build_channels(B, mast_z, rig):
    """Chain wales with deadeyes; returns the shroud foot points."""
    u = 0.5 + mast_z / LENGTH
    y = rail_top(u) - 0.55
    feet = {}
    for side in (1, -1):
        w = half_width(u, y)
        B.box('darkwood', V((side * (w + 0.35), y - 0.12, mast_z + 1.4)), V((side * (w + 0.35), y - 0.12, mast_z - 4.2)), 0.75, 0.16)
        pts = []
        for k in range(6):
            z = mast_z + 0.9 - k * 0.8
            p = V((side * (w + 0.6), y + 0.15, z))
            B.lathe('darkwood', p - V((0, 0.12, 0)) + V((side * 0.0, 0, 0)), (0, 1, 0), [(0.0, 0), (0.2, 0.02), (0.22, 0.12), (0.2, 0.24), (0.0, 0.26)], 10)
            # chain plate down the hull
            B.box('iron', p - V((0, 0.1, 0)), V((side * (half_width(u, y - 1.6) + 0.05), y - 1.6, z)), 0.06, 0.06)
            pts.append(p + V((0, 0.2, 0)))
        feet[side] = pts
    return feet


# ------------------------------------------------------------------ masts
MASTS = [
    dict(name='fore', u=0.785, base='fore', lower=20.4, top=18.7, top_r=1.45, upper=(18.0, 30.0), cap=27.8, cap_r=0.9, pole=33.5,
         yards=[dict(y=16.5, half=8.8, drop=9.2, bot=9.6), dict(y=27.3, half=5.8, drop=8.1, bot=8.6)]),
    dict(name='main', u=0.53, base='main', lower=24.6, top=22.4, top_r=1.85, upper=(21.6, 36.2), cap=33.6, cap_r=1.1, pole=40.0,
         yards=[dict(y=20.1, half=11.0, drop=11.5, bot=11.6), dict(y=32.8, half=7.2, drop=9.7, bot=10.8)]),
    dict(name='mizzen', u=0.2, base='quarter', lower=21.0, top=18.8, top_r=1.2, upper=(18.3, 26.0), cap=None, pole=29.0, yards=[]),
]


def build_top(B, m, z):
    r = m['top_r']
    y = m['top']
    # floor and stave-built basket
    B.lathe('darkwood', (0, y - 0.75, z), (0, 1, 0), [(0.0, 0), (r * 0.65, 0), (r * 0.85, 0.25), (r, 0.3)], 24)
    n = 28
    for k in range(n):
        a = 2 * math.pi * k / n
        p0 = V((math.cos(a) * r * 0.82, y - 0.55, z + math.sin(a) * r * 0.82))
        p1 = V((math.cos(a) * r, y + 0.65, z + math.sin(a) * r))
        B.box('darkwood', p0, p1, 0.32, 0.06, up=(math.cos(a), 0, math.sin(a)))
    B.tube('red', [V((math.cos(2 * math.pi * k / 32) * (r + 0.03), y + 0.65, z + math.sin(2 * math.pi * k / 32) * (r + 0.03))) for k in range(33)], 0.08, 6)
    B.tube('darkwood', [V((math.cos(2 * math.pi * k / 32) * (r * 0.92), y + 0.05, z + math.sin(2 * math.pi * k / 32) * (r * 0.92))) for k in range(33)], 0.06, 6)
    # trestle trees under the top
    for dz in (-0.5, 0.5):
        B.box('darkwood', V((-r * 0.9, y - 0.95, z + dz)), V((r * 0.9, y - 0.95, z + dz)), 0.18, 0.22)


def build_masts(B, R):
    info = {}
    for m in MASTS:
        z = z_at(m['u'])
        base = DECK[m['base']]
        # lower mast with rope woldings
        B.cyl('mastwood', (0, base - 3, z), (0, m['lower'], z), 0.66, 0.46, seg=16)
        for y in [base + 1.5 + k * 1.3 for k in range(int((m['top'] - base - 3) / 1.3))]:
            B.cyl('rope', (0, y, z), (0, y + 0.22, z), 0.68 - 0.2 * (y - base) / (m['lower'] - base), seg=14)
        # topmast and pole
        B.cyl('mastwood', (0, m['upper'][0], z - 0.08), (0, m['upper'][1], z - 0.08), 0.36, 0.2, seg=12)
        B.cyl('mastwood', (0, m['upper'][1] - 1, z - 0.08), (0, m['pole'], z - 0.08), 0.17, 0.08, seg=8)
        B.lathe('gold', (0, m['pole'], z - 0.08), (0, 1, 0), [(0, 0), (0.22, 0.05), (0.25, 0.2), (0, 0.4)], 10)
        build_top(B, m, z)
        if m['cap']:
            sub = dict(top=m['cap'], top_r=m['cap_r'])
            build_top(B, sub, z - 0.08)
        # mast cap
        B.box('darkwood', V((0, m['lower'] + 0.1, z - 0.6)), V((0, m['lower'] + 0.1, z + 0.4)), 0.9, 0.35)
        feet = build_channels(B, z, R)
        info[m['name']] = dict(z=z, feet=feet, m=m)
    return info


def rope(R, a, b, r=0.04, sag=0.0, seg=5):
    a, b = V(a), V(b)
    n = 6 if sag else 1
    pts = []
    for i in range(n + 1):
        t = i / n
        p = a.lerp(b, t)
        p.y -= sag * 4 * t * (1 - t)
        pts.append(p)
    R.tube('rope', pts, r, seg, True, False, 1.0)


def build_rigging(R, info):
    for name, d in info.items():
        m, z = d['m'], d['z']
        for side in (1, -1):
            feet = d['feet'][side]
            heads = [V((side * m['top_r'] * 0.85, m['top'] - 0.7, z + 0.25 - k * 0.12)) for k in range(6)]
            for f, h in zip(feet, heads):
                rope(R, f, h, 0.065)
            # ratlines between neighbouring shrouds
            y = feet[0].y + 0.55
            while y < m['top'] - 1.2:
                for k in range(5):
                    def at(a, b):
                        return a.lerp(b, (y - a.y) / (b.y - a.y))
                    rope(R, at(feet[k], heads[k]), at(feet[k + 1], heads[k + 1]), 0.028, seg=4)
                y += 0.45
            # topmast shrouds from the rim of the top
            cap_y = m['cap'] if m['cap'] else m['upper'][1] - 1.5
            tb = [V((side * m['top_r'] * 0.97, m['top'] + 0.6, z + 0.4 - 0.55 * k)) for k in range(4)]
            tt = [V((side * 0.3, cap_y - 0.5, z - 0.08)) for _ in range(4)]
            for a, b in zip(tb, tt):
                rope(R, a, b, 0.045)
            y = m['top'] + 1.0
            while y < cap_y - 1.6:
                for k in range(3):
                    def at(a, b):
                        return a.lerp(b, (y - a.y) / (b.y - a.y))
                    rope(R, at(tb[k], tt[k]), at(tb[k + 1], tt[k + 1]), 0.024, seg=4)
                y += 0.45
            # futtock shrouds under the top
            for k in range(3):
                rope(R, V((side * m['top_r'] * 0.95, m['top'] + 0.6, z - 0.3 * k)), V((side * 0.6, m['top'] - 2.6, z - 0.3 * k)), 0.035)
            # backstays to the hull aft
            ua = max(0.02, m['u'] - 0.14)
            yb = rail_top(ua) - 0.5
            rope(R, V((side * 0.3, m['upper'][1] - 1.0, z - 0.1)), V((side * (half_width(ua, yb) + 0.4), yb, z_at(ua))), 0.05)
    f, mn, mz = info['fore'], info['main'], info['mizzen']
    sprit_from = V((0, 6.0, LENGTH / 2 - 0.7))
    sprit_dir = V((0, math.sin(0.42), math.cos(0.42)))
    sprit = lambda t: sprit_from + sprit_dir * (17.5 * t)
    # stays: heavy ropes running forward
    rope(R, (0, mn['m']['top'] + 0.2, mn['z'] + 0.6), (0, DECK['fore'] + 1.2, f['z'] - 0.7), 0.13, 0.3)
    rope(R, (0, mn['m']['top'] + 0.5, mn['z'] + 0.6), (0, DECK['fore'] + 2.2, f['z'] - 0.7), 0.08, 0.3)
    rope(R, (0, mn['m']['upper'][1] - 0.8, mn['z']), (0, f['m']['top'] + 0.6, f['z']), 0.07, 0.2)
    rope(R, (0, f['m']['top'] + 0.2, f['z'] + 0.5), sprit(0.42), 0.11, 0.25)
    rope(R, (0, f['m']['upper'][1] - 0.8, f['z']), sprit(0.96), 0.07, 0.3)
    rope(R, (0, mz['m']['top'] + 0.2, mz['z'] + 0.5), (0, 11.5, mn['z'] - 0.6), 0.08, 0.15)
    rope(R, (0, mz['m']['upper'][1] - 0.6, mz['z']), (0, mn['m']['top'] - 0.6, mn['z'] - 0.6), 0.05, 0.15)
    rope(R, sprit(0.99), (0, 1.3, LENGTH / 2 + 0.1), 0.08)
    rope(R, sprit(0.7), (0, 2.3, LENGTH / 2 + 0.2), 0.08)
    return sprit, sprit_dir


# ------------------------------------------------------------------ yards and sails
def sail_grid(S, mat, top_half, bot_half, drop, z, nx=18, ny=14):
    rows, uvs = [], []
    for j in range(ny + 1):
        t = j / ny
        half = top_half + (bot_half - top_half) * t
        rows.append([V(((2 * i / nx - 1) * half, -0.25 - t * drop, z)) for i in range(nx + 1)])
        uvs.append([(i / nx, 1 - t) for i in range(nx + 1)])
    S.grid(mat, rows, uvs, True, flip=True)


def yard_mesh(Y, half, z=0.6, r=0.3):
    n = 12
    pts = [V((-half - 0.4 + (2 * half + 0.8) * i / n, 0, z)) for i in range(n + 1)]
    radii = [r - 0.17 * ((2 * i / n - 1) ** 2) for i in range(n + 1)]
    Y.tube('mastwood', pts, r, 10, True, True, 0.5, radii)
    # yardarm cleats and the footrope hanging below
    foot = []
    for i in range(13):
        t = i / 12
        x = (-half + 0.2) + (2 * half - 0.4) * t
        foot.append(V((x, -0.9 - 0.35 * math.sin(math.pi * ((t * 2) % 1)), z + 0.35)))
    Y.tube('rope', foot, 0.035, 5, True, False, 1.0)
    # the parrel that holds the yard to the mast
    Y.lathe('darkwood', (0, -0.3, 0.0), (0, 1, 0), [(0.75, 0), (0.75, 0.6)], 12)


def build_yards(info, mats, sprit, sprit_dir):
    yards = []
    for name, d in info.items():
        m, z = d['m'], d['z']
        for k, yd in enumerate(m['yards']):
            label = f"{name}_{'course' if k == 0 else 'topsail'}"
            Y = Builder()
            yard_mesh(Y, yd['half'])
            lift_to = V((0, (m['top'] + 0.9 if k == 0 else m['upper'][1] - 0.7) - yd['y'], 0))
            for s in (1, -1):
                rope(Y, (s * yd['half'], 0, 0.6), lift_to, 0.04)
            yobj = Y.make('Yard_' + label, mats, location=(0, yd['y'], z))
            S = Builder()
            sail_grid(S, 'sail', yd['half'] - 0.35, yd['bot'], yd['drop'], 0.75)
            S.make('Sail_' + label, mats, parent=yobj)
            yards.append(yobj)
    # spritsail under the bowsprit
    p = sprit(0.55)
    Y = Builder()
    yard_mesh(Y, 5.2, 0.0, 0.2)
    yobj = Y.make('Yard_sprit', mats, location=(p.x, p.y - 0.6, p.z))
    S = Builder()
    sail_grid(S, 'sail', 4.9, 5.2, 4.8, 0.2, 14, 10)
    S.make('Sail_sprit', mats, parent=yobj)
    # lateen on the mizzen
    mz = info['mizzen']
    a, b, c = V((0, 8.2, 7.4)), V((0, 27.0, -9.6)), V((0, DECK['poop'] + 1.2, -8.8))
    Y = Builder()
    n = 14
    pts = [a.lerp(b, i / n) + V((0.35, 0, 0)) for i in range(n + 1)]
    Y.tube('mastwood', [p - (b - a).normalized() * 0.6 if i == 0 else p for i, p in enumerate(pts)], 0.25, 10, True, True, 0.5,
           [0.26 - 0.13 * abs(2 * i / n - 1) for i in range(n + 1)])
    rope(Y, (0, mz['m']['top'] + 0.2 - 0.0, 0), a.lerp(b, 0.55), 0.05)
    yobj = Y.make('Lateen', mats, location=(0, 0, mz['z']))
    S = Builder()
    rows, uvs = [], []
    nx, ny = 18, 12
    for j in range(ny + 1):
        t = j / ny
        rows.append([(a.lerp(b, i / nx) + V((0.15, -0.2, 0))).lerp(c, t) for i in range(nx + 1)])
        uvs.append([(i / nx, 1 - t) for i in range(nx + 1)])
    S.grid('sail', rows, uvs, True, flip=True)
    S.make('Sail_lateen', mats, parent=yobj)
    return dict(lateen_a=a + V((0.15, -0.2, 0)), lateen_b=b + V((0.15, -0.2, 0)), lateen_c=c)


def build_flags(mats, info):
    def flag(name, w, h, at):
        F = Builder()
        nx, ny = 20, 6
        rows = [[V((w * i / nx, -h * j / ny, 0)) for i in range(nx + 1)] for j in range(ny + 1)]
        uvs = [[(i / nx, 1 - j / ny) for i in range(nx + 1)] for j in range(ny + 1)]
        F.grid('flag', rows, uvs, True, flip=True)
        F.make(name, mats, location=at)
    flag('Flag_main', 6.0, 3.6, (0, info['main']['m']['pole'] - 0.2, info['main']['z'] - 0.08))
    flag('Flag_stern', 3.8, 2.3, (0, rail_top(0) + 4.4, z_at(0) + 0.7))
    P = Builder()
    nx = 16
    for nm, mast in (('Flag_fore', 'fore'), ('Flag_mizzen', 'mizzen')):
        F = Builder()
        rows = [[V((5.0 * i / nx, -0.9 * (1 - 0.8 * i / nx) * j, 0)) for i in range(nx + 1)] for j in range(2)]
        uvs = [[(i / nx, 1 - j) for i in range(nx + 1)] for j in range(2)]
        F.grid('pennant', rows, uvs, True, flip=True)
        F.make(nm, mats, location=(0, info[mast]['m']['pole'] - 0.1, info[mast]['z'] - 0.08))
    del P


# ------------------------------------------------------------------ main
def main():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    mats = {
        'hull': material('Hull', albedo='hull_albedo.png', normal='hull_normal.png', rough=0.72, strength=1.2),
        'hull_in': material('HullInside', albedo='hull_albedo.png', normal='hull_normal.png', rough=0.8),
        'stern': material('Stern', albedo='stern_albedo.png', normal='stern_normal.png', rough=0.6),
        'stern_side': material('Stern', albedo='stern_albedo.png', normal='stern_normal.png', rough=0.6),
        'deck': material('Deck', albedo='deck_albedo.png', normal='deck_normal.png', rough=0.85),
        'wood': material('Wood', albedo='wood_albedo.png', normal='wood_normal.png', rough=0.8),
        'mastwood': material('MastWood', albedo='wood_albedo.png', normal='wood_normal.png', rough=0.75),
        'darkwood': material('DarkWood', color=srgb('#3b2718'), rough=0.82),
        'boat': material('Boat', color=srgb('#7b5530'), rough=0.8),
        'red': material('Red', color=srgb('#8a2416'), rough=0.55),
        'gold': material('Gold', color=srgb('#c99a44'), rough=0.35, metal=0.85),
        'iron': material('Iron', color=srgb('#1c1c1e'), rough=0.45, metal=0.7),
        'glass': material('Glass', color=srgb('#1d2b38'), rough=0.08, metal=0.2),
        'lantern': material('Lantern', color=srgb('#ffd890'), rough=0.2, emit=srgb('#ffb04a')),
        'rope': material('Rope', color=srgb('#2c1e12'), rough=0.9),
        'sail': material('Sail', albedo='sail_albedo.png', normal='sail_normal.png', rough=0.92),
        'flag': material('Flag', albedo='flag_albedo.png', rough=0.9),
        'pennant': material('Pennant', color=srgb('#9a1c12'), rough=0.85),
    }
    mats['stern_side'] = mats['stern']

    H = Builder()
    build_hull(H)
    deck(H, DECK['main'], 0.0, 1.0)
    deck(H, DECK['quarter'], 0.0, SPLIT['quarter'])
    deck(H, DECK['poop'], 0.0, SPLIT['poop'])
    deck(H, DECK['fore'], SPLIT['fore'], 1.0)
    bulkhead(H, SPLIT['quarter'], DECK['main'], DECK['quarter'], 1)
    bulkhead(H, SPLIT['poop'], DECK['quarter'], DECK['poop'], 1)
    bulkhead(H, SPLIT['fore'], DECK['main'], DECK['fore'], -1)
    balustrade(H, SPLIT['quarter'], DECK['quarter'], 1.05, 1)
    balustrade(H, SPLIT['poop'], DECK['poop'], 1.05, 1)
    balustrade(H, SPLIT['fore'], DECK['fore'], 1.05, -1)
    for side in (1, -1):
        for y in (0.5, 1.18, 2.75):
            wale(H, y, side)
        # red cap rail along the top
        sweep_along_rail(H, 'red', lambda u: rail_top(u) + 0.08, 0.0, 0.34, 0.16, side=side, inset=0.1)
        sweep_along_rail(H, 'gold', lambda u: rail_top(u) - 0.25, 0.03, 0.06, 0.06, side=side)
        # open rail balusters along the castle sides
        for i in range(60):
            u = 0.135 + (SPLIT['quarter'] - 0.15) * i / 59
            y = DECK['quarter'] + 0.0
            w = half_width(u, rail_top(u)) - 0.12
            baluster(H, side * w, rail_top(u) - 1.0, z_at(u), 1.0)
    build_deck_furniture(H)
    build_stern_details(H)
    build_bow(H)
    build_guns(H)
    info = build_masts(H, None)
    # bowsprit
    R = Builder()
    sprit, sprit_dir = build_rigging(R, info)
    H.cyl('mastwood', sprit(-0.15), sprit(1.0), 0.48, 0.18, seg=14)
    H.cyl('mastwood', sprit(0.95), sprit(0.95) + V((0, 4.5, 0.6)), 0.12, 0.07, seg=8)  # sprit topmast
    hull = H.make('Hull', mats)
    R.make('Rigging', mats)

    lateen = build_yards(info, mats, sprit, sprit_dir)
    build_flags(mats, info)
    # ensign staff
    S = Builder()
    S.cyl('mastwood', (0, rail_top(0) - 0.5, z_at(0) + 0.7), (0, rail_top(0) + 4.6, z_at(0) + 0.7), 0.1, 0.06, seg=8)
    S.make('EnsignStaff', mats)

    Rd = Builder()
    Rd.box('darkwood', V((0, -3.0, -0.2)), V((0, 3.5, -0.2)), 0.35, 0.4, up=(0, 0, 1))
    for k in range(8):
        y = -2.9 + k * 0.8
        Rd.box('darkwood', V((0, y, -0.1)), V((0, y, -2.0 + 0.1 * k)), 0.32, 0.75)
    Rd.box('iron', V((0, 2.0, 0.0)), V((0, 2.0, -0.4)), 0.45, 0.12)
    Rd.make('Rudder', mats, location=(0, 0, z_at(0) - 0.35))

    # export, with the lateen geometry the Godot sail shader needs written as custom props
    hull['lateen_a'] = list(lateen['lateen_a'])
    bpy.ops.export_scene.gltf(filepath=OUT, export_format='GLB', export_yup=True, export_apply=True)
    tris = sum(len(o.data.polygons) for o in bpy.data.objects if o.type == 'MESH')
    print('exported', OUT, 'faces:', tris)
    print('LATEEN', [round(c, 3) for c in lateen['lateen_a']], [round(c, 3) for c in lateen['lateen_b']], [round(c, 3) for c in lateen['lateen_c']])


main()
