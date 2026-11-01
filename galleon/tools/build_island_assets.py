"""Shrinks the Poly Haven scans (tools/fetch_island_assets.py) to phone budgets and
exports them to assets/island/ as .glb, plus the ground textures the terrain uses.

  rocks / cliffs: decimated to a few thousand triangles (the scan's normal map keeps the detail)
  trees: trunk and branches decimated; leaf cards thinned out and enlarged so the crown stays full

Run: pip install bpy && python3 tools/build_island_assets.py [cache_dir]
All source assets are CC0 (public domain) from https://polyhaven.com.
"""
import os
import random
import shutil
import sys

import bpy
import bmesh

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
CACHE = os.path.abspath(sys.argv[-1]) if len(sys.argv) > 1 and os.path.isdir(sys.argv[-1]) else os.path.join(ROOT, 'build', 'polyhaven')
OUT = os.path.join(ROOT, 'assets', 'island')

# name: (triangle budget for solid parts, fraction of leaf cards kept)
ROCKS = {'coastal_cliff_01': 7000, 'coastal_cliff_02': 6000, 'coast_rocks_01': 5000, 'coast_rocks_05': 1500}
TREES = {'island_tree_01': (3500, 0.025), 'island_tree_02': (3000, 0.03), 'island_tree_03': (3500, 0.018)}
LEAF_BUDGET = 9000
GROUND = ['coast_sand_01', 'damp_beach_sand', 'forest_leaves_02', 'aerial_rocks_02', 'coral_ground_02']


def tris(me):
    return sum(len(p.vertices) - 2 for p in me.polygons)


def decimate(obj, budget):
    n = tris(obj.data)
    if n <= budget:
        return
    bpy.context.view_layer.objects.active = obj
    m = obj.modifiers.new('dec', 'DECIMATE')
    m.ratio = budget / n
    m.use_collapse_triangulate = True
    bpy.ops.object.modifier_apply(modifier=m.name)


def thin_leaves(obj, keep, grow):
    """Delete most leaf cards (loose parts), enlarge the survivors about their centres."""
    bm = bmesh.new()
    bm.from_mesh(obj.data)
    bm.faces.ensure_lookup_table()
    seen = set()
    rng = random.Random(3)
    kill = []
    for f in bm.faces:
        if f.index in seen:
            continue
        # gather the card this face belongs to
        stack = [f]
        part = []
        seen.add(f.index)
        while stack:
            g = stack.pop()
            part.append(g)
            for e in g.edges:
                for h in e.link_faces:
                    if h.index not in seen:
                        seen.add(h.index)
                        stack.append(h)
        if rng.random() > keep:
            kill.extend(part)
        else:
            verts = {v for g in part for v in g.verts}
            c = sum((v.co for v in verts), verts.__iter__().__next__().co * 0) / len(verts)
            for v in verts:
                v.co = c + (v.co - c) * grow
    bmesh.ops.delete(bm, geom=kill, context='FACES')
    bm.to_mesh(obj.data)
    bm.free()


def load(name):
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=os.path.join(CACHE, name, name + '.gltf'))
    meshes = [o for o in bpy.data.objects if o.type == 'MESH']
    # keep only the highest detail level if the scan ships LODs
    for o in meshes:
        if '_LOD' in o.name and not o.name.endswith('_LOD0'):
            bpy.data.objects.remove(o)
    return [o for o in bpy.data.objects if o.type == 'MESH']


def export(name):
    for img in bpy.data.images:
        if img.size[0] > 1024:
            img.scale(1024, 1024)
    path = os.path.join(OUT, name + '.glb')
    bpy.ops.export_scene.gltf(filepath=path, export_format='GLB', export_image_format='JPEG',
                              export_jpeg_quality=85, export_apply=True)
    total = sum(tris(o.data) for o in bpy.data.objects if o.type == 'MESH')
    print(f'{name}: {total} triangles, {os.path.getsize(path) // 1024} KB')


def main():
    os.makedirs(OUT, exist_ok=True)
    only = os.environ.get('ONLY')
    for name, budget in ROCKS.items():
        if only and only not in name:
            continue
        for o in load(name):
            decimate(o, budget)
        export(name)
    for name, (budget, keep) in TREES.items():
        if only and only not in name:
            continue
        for o in load(name):
            bpy.context.view_layer.objects.active = o
            o.select_set(True)
            bpy.ops.mesh.separate(type='MATERIAL')
        for o in [o for o in bpy.data.objects if o.type == 'MESH']:
            mat = o.data.materials[0].name if o.data.materials else ''
            if mat.endswith('_leaves'):
                thin_leaves(o, keep, 1.0 / keep ** 0.45)
                decimate(o, LEAF_BUDGET)
            else:
                decimate(o, budget if not mat.endswith('_branches') else budget // 2)
        export(name)
    tex = os.path.join(OUT, 'ground')
    os.makedirs(tex, exist_ok=True)
    for g in GROUND:
        for kind in ('diff', 'nor_gl'):
            src = os.path.join(CACHE, 'textures', f'{g}_{kind}.jpg')
            if os.path.exists(src):
                shutil.copy(src, os.path.join(tex, f'{g}_{kind}.jpg'))


main()
