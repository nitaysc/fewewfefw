"""Small helpers for building stylized models with Blender's Python module (bpy).

Everything is built from code: rounded boxes, cylinders, tori and lofted shells,
with bevel modifiers for the soft, chunky "stylized 3D" look. No ops that need a
window, so it runs headless (pip install bpy).
"""
import math

import bmesh
import bpy
from mathutils import Matrix, Vector


def srgb(hexstr):
    """'#rrggbb' (sRGB) -> linear RGB tuple, the space Blender materials use."""
    h = hexstr.lstrip('#')
    out = []
    for i in (0, 2, 4):
        c = int(h[i:i + 2], 16) / 255.0
        out.append(c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4)
    return tuple(out)


# ---------------------------------------------------------------- materials

def material(name, color, rough=0.5, metal=0.0, coat=0.0, emit=None, emit_strength=0.0,
             alpha=1.0):
    m = bpy.data.materials.get(name)
    if m:
        return m
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    b = m.node_tree.nodes['Principled BSDF']
    col = srgb(color) if isinstance(color, str) else color
    b.inputs['Base Color'].default_value = (*col, 1)
    b.inputs['Roughness'].default_value = rough
    b.inputs['Metallic'].default_value = metal
    b.inputs['Coat Weight'].default_value = coat
    if emit:
        e = srgb(emit) if isinstance(emit, str) else emit
        b.inputs['Emission Color'].default_value = (*e, 1)
        b.inputs['Emission Strength'].default_value = emit_strength
    if alpha < 1:
        b.inputs['Alpha'].default_value = alpha
    return m


# ---------------------------------------------------------------- objects

def _obj_from_bm(name, bm, mat, parent=None, smooth=True):
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    if smooth:
        for p in me.polygons:
            p.use_smooth = True
    ob = bpy.data.objects.new(name, me)
    bpy.context.collection.objects.link(ob)
    if mat:
        me.materials.append(mat)
    if parent:
        ob.parent = parent
    return ob


def bevel(ob, width, segs=3, angle=40):
    if width <= 0:
        return ob
    m = ob.modifiers.new('bevel', 'BEVEL')
    m.width = width
    m.segments = segs
    m.limit_method = 'ANGLE'
    m.angle_limit = math.radians(angle)
    m.harden_normals = True
    m.use_clamp_overlap = True
    return ob


def place(ob, loc=(0, 0, 0), rot=(0, 0, 0)):
    ob.location = loc
    ob.rotation_euler = rot
    return ob


def box(name, size, loc=(0, 0, 0), mat=None, bev=0.02, segs=3, rot=(0, 0, 0), parent=None):
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1.0)
    bmesh.ops.scale(bm, vec=Vector(size), verts=bm.verts)
    ob = _obj_from_bm(name, bm, mat, parent)
    bevel(ob, min(bev, min(size) * 0.45), segs)
    return place(ob, loc, rot)


def cyl(name, r, depth, loc=(0, 0, 0), mat=None, rot=(0, 0, 0), verts=32, bev=0.0, segs=3,
        r2=None, parent=None):
    """Cylinder along local Z (use rot to turn it). r2 makes it a cone/frustum."""
    bm = bmesh.new()
    bmesh.ops.create_cone(bm, cap_ends=True, cap_tris=False, segments=verts,
                          radius1=r, radius2=r if r2 is None else r2, depth=depth)
    ob = _obj_from_bm(name, bm, mat, parent)
    bevel(ob, bev, segs, angle=50)
    return place(ob, loc, rot)


def sphere(name, r, loc=(0, 0, 0), mat=None, scale=(1, 1, 1), parent=None, segs=24):
    bm = bmesh.new()
    bmesh.ops.create_uvsphere(bm, u_segments=segs, v_segments=segs // 2, radius=r)
    bmesh.ops.scale(bm, vec=Vector(scale), verts=bm.verts)
    ob = _obj_from_bm(name, bm, mat, parent)
    return place(ob, loc)


def torus(name, R, r, loc=(0, 0, 0), mat=None, rot=(0, 0, 0), major=48, minor=16,
          scale=(1, 1, 1), arc=2 * math.pi, parent=None):
    bm = bmesh.new()
    rings = []
    closed = arc >= 2 * math.pi - 1e-6
    n_major = major if closed else major + 1
    for i in range(n_major):
        a = arc * i / major
        ca, sa = math.cos(a), math.sin(a)
        ring = []
        for j in range(minor):
            b = 2 * math.pi * j / minor
            rr = R + r * math.cos(b)
            ring.append(bm.verts.new((rr * ca * scale[0], rr * sa * scale[1],
                                      r * math.sin(b) * scale[2])))
        rings.append(ring)
    for i in range(major if closed else major):
        a, b = rings[i], rings[(i + 1) % n_major]
        for j in range(minor):
            bm.faces.new((a[j], a[(j + 1) % minor], b[(j + 1) % minor], b[j]))
    if not closed:
        bm.faces.new(rings[0][::-1])
        bm.faces.new(rings[-1])
    ob = _obj_from_bm(name, bm, mat, parent)
    return place(ob, loc, rot)


def loft(name, stations, mat=None, parent=None, cap=True):
    """stations: list of rings (each a list of (x,y,z)), same point count. Closed tube +
    fan caps at both ends."""
    bm = bmesh.new()
    rings = [[bm.verts.new(p) for p in ring] for ring in stations]
    n = len(stations[0])
    for a, b in zip(rings, rings[1:]):
        for j in range(n):
            bm.faces.new((a[j], b[j], b[(j + 1) % n], a[(j + 1) % n]))
    if cap:
        for ring, flip in ((rings[0], True), (rings[-1], False)):
            c = sum((v.co for v in ring), Vector()) / n
            cv = bm.verts.new(c)
            for j in range(n):
                f = (ring[j], ring[(j + 1) % n], cv)
                bm.faces.new(f[::-1] if flip else f)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    return _obj_from_bm(name, bm, mat, parent)


def poly_prism(name, verts, faces, mat=None, parent=None, bev=0.0, segs=3):
    bm = bmesh.new()
    vs = [bm.verts.new(v) for v in verts]
    for f in faces:
        bm.faces.new([vs[i] for i in f])
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    ob = _obj_from_bm(name, bm, mat, parent)
    bevel(ob, bev, segs)
    return ob


def curve_tube(name, pts, radius, mat=None, parent=None, res=12):
    cu = bpy.data.curves.new(name, 'CURVE')
    cu.dimensions = '3D'
    cu.bevel_depth = radius
    cu.bevel_resolution = 4
    cu.resolution_u = res
    cu.use_fill_caps = True
    sp = cu.splines.new('BEZIER')
    sp.bezier_points.add(len(pts) - 1)
    for bp, p in zip(sp.bezier_points, pts):
        bp.co = p
        bp.handle_left_type = bp.handle_right_type = 'AUTO'
    ob = bpy.data.objects.new(name, cu)
    bpy.context.collection.objects.link(ob)
    if mat:
        cu.materials.append(mat)
    if parent:
        ob.parent = parent
    return ob


def boolean_cut(target, cutter, transfer=True):
    m = target.modifiers.new('cut_' + cutter.name, 'BOOLEAN')
    m.operation = 'DIFFERENCE'
    m.solver = 'EXACT'
    m.object = cutter
    if transfer:
        m.material_mode = 'TRANSFER'
    cutter.hide_render = True
    cutter.hide_viewport = True
    return m


def apply_all(ob):
    """Bake modifiers into the mesh (keeps materials)."""
    dg = bpy.context.evaluated_depsgraph_get()
    me = bpy.data.meshes.new_from_object(ob.evaluated_get(dg))
    old = ob.data
    ob.modifiers.clear()
    ob.data = me
    if old.users == 0:
        bpy.data.meshes.remove(old)
    return ob


def root(name, loc=(0, 0, 0)):
    e = bpy.data.objects.new(name, None)
    bpy.context.collection.objects.link(e)
    e.location = loc
    return e


def descendants(ob):
    out = [ob]
    for c in ob.children:
        out += descendants(c)
    return out
