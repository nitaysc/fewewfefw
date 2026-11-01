"""Converts the purchased "Ocean Brig" (CGTrader) Blender file into the game's ship.

Run:  python3 tools/import_brig.py <Ship_Blender.blend> <dir with Sails_Mat_* folders>
Out:  assets/brig/brig.glb  and  assets/brig/sails/<design>.jpg

The model is licensed (royalty-free), so its files must NOT be published: assets/brig/ is
git-ignored and the game falls back to the built-in galleon when it is missing.

What it does:
- bakes the parent transform, scales the ship 1.6x and moves it so the waterline sits at y=0
  and the hull is centred (it then matches the hull the buoyancy physics is tuned for);
- splits the sail mesh into its loose pieces and tags each for the wind shader:
    COLOR.rgb  = direction the cloth bellies out (ship space, *0.5+0.5)
    COLOR.a    = how free the cloth is at this vertex (0 at the edges, 1 in the belly / flag tip)
    UV2.x      = kind: 0 square sail, 0.5 fore-and-aft sail, 1 flag, 2 static cloth
    UV2.y      = metres below the sail's head (used to haul the square sails up to their yards)
- downsizes the 4K textures to 2K (phones) and exports JPEG textures inside the .glb.
"""
import os
import sys
import glob

import bpy  # noqa: I001 (bpy must load before bmesh)
import bmesh
import numpy as np
from mathutils import Matrix, Vector

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
OUT_DIR = os.path.join(ROOT, 'assets', 'brig')
SCALE = 1.6
WATERLINE_Z = 1.9    # in the source model
HULL_CENTER_Y = 0.7  # in the source model (bow is -Y)
TEX = 2048
SAIL_DESIGNS = {
    'white': 'White_Sail', 'dirty_white': 'DirtyWhite_Sail', 'pirate': 'Pirate_Sail', 'black': 'Black_Sail',
    'british': 'British_Sail', 'spanish': 'Spanish_Sail', 'templar': 'Templar_Sail', 'dutch': 'Dutch_Sails',
}


def bake_transforms():
    fix = Matrix.Scale(SCALE, 4) @ Matrix.Translation((0, -HULL_CENTER_Y, -WATERLINE_Z))
    for o in list(bpy.data.objects):
        if o.type != 'MESH':
            continue
        o.data.transform(fix @ o.matrix_world)
        o.parent = None
        o.matrix_world = Matrix.Identity(4)
    for o in list(bpy.data.objects):
        if o.type != 'MESH':
            bpy.data.objects.remove(o)


def loose_parts(bm):
    seen, parts = set(), []
    for v in bm.verts:
        if v.index in seen:
            continue
        stack, comp = [v], []
        seen.add(v.index)
        while stack:
            x = stack.pop()
            comp.append(x.index)
            for e in x.link_edges:
                y = e.other_vert(x)
                if y.index not in seen:
                    seen.add(y.index)
                    stack.append(y)
        parts.append(comp)
    return parts


def tag_sails(obj):
    me = obj.data
    bm = bmesh.new()
    bm.from_mesh(me)
    bm.verts.ensure_lookup_table()
    co = np.array([tuple(v.co) for v in bm.verts])
    boundary = np.array([v.is_boundary for v in bm.verts])
    n = len(co)
    col = np.zeros((n, 4))
    col[:, :3] = 0.5
    uv2 = np.zeros((n, 2))
    uv2[:, 0] = 2.0  # static cloth unless tagged below
    masts_y = []
    parts = loose_parts(bm)
    counts = {'square': 0, 'fore_aft': 0, 'flag': 0, 'static': 0}
    # mast positions from the square sails (to find which end of a flag is tied on)
    for p in parts:
        q = co[p]
        span = q.max(0) - q.min(0)
        if len(p) >= 400 and span[0] > 6:
            masts_y.append(q[:, 1].mean())
    for p in parts:
        q = co[p]
        mn, mx = q.min(0), q.max(0)
        span = mx - mn
        idx = np.array(p)
        if len(p) >= 400 and span[0] > 6 and span[2] > 3:
            kind, direction = 0.0, (0, -1, 0)  # square sail bellies forward (bow is -Y)
        elif span[0] < 0.6 and span[1] > 5 and span[2] > 5:
            kind, direction = 0.5, (1, 0, 0)   # staysail / jib bellies to the side
        elif mn[2] > 30 and 80 < len(p) < 400:
            kind, direction = 1.0, (1, 0, 0)   # pennant at a masthead
        else:
            counts['static'] += 1
            continue
        if kind < 1.0:
            # belly: distance to the nearest edge of the cloth, normalised
            b = q[boundary[idx]]
            if len(b) == 0:
                continue
            d = np.sqrt(((q[:, None, :] - b[None, :, :]) ** 2).sum(-1)).min(1)
            w = d / max(d.max(), 1e-6)
            counts['square' if kind == 0 else 'fore_aft'] += 1
        else:
            # flag: free toward the end away from the mast it is tied to
            mast = min(masts_y, key=lambda y: abs(y - q[:, 1].mean())) if masts_y else 0.0
            tied = mn[1] if abs(mn[1] - mast) < abs(mx[1] - mast) else mx[1]
            w = np.abs(q[:, 1] - tied) / max(span[1], 1e-6)
            counts['flag'] += 1
        col[idx, :3] = np.array(direction) * 0.5 + 0.5
        col[idx, 3] = w
        uv2[idx, 0] = kind
        uv2[idx, 1] = (mx[2] - q[:, 2]) / 50.0
    bm.free()
    # write per-corner colour and second UV layer
    attr = me.color_attributes.new(name='Flex', type='FLOAT_COLOR', domain='POINT')
    for i, c in enumerate(col):
        attr.data[i].color = tuple(c)
    me.color_attributes.active_color = attr
    # keep only the texture UVs, so 'Flex' is exported as the second UV set (Godot UV2)
    while len(me.uv_layers) > 1:
        me.uv_layers.remove(me.uv_layers[-1])
    layer = me.uv_layers.new(name='Flex')
    for loop in me.loops:
        layer.data[loop.index].uv = tuple(uv2[loop.vertex_index])
    me.uv_layers.active_index = 0
    print('sails tagged:', counts)


def shrink_images():
    for img in bpy.data.images:
        if img.size[0] > TEX:
            img.scale(TEX, TEX)
            img.pack()


def export_sail_designs(src_dir):
    from PIL import Image
    Image.MAX_IMAGE_PIXELS = None
    out = os.path.join(OUT_DIR, 'sails')
    os.makedirs(out, exist_ok=True)
    for name, folder in SAIL_DESIGNS.items():
        files = glob.glob(os.path.join(src_dir, folder, '*Base*.png'))
        if not files:
            print('missing sail design', name)
            continue
        im = Image.open(files[0]).convert('RGB').resize((TEX, TEX), Image.LANCZOS)
        im.save(os.path.join(out, name + '.jpg'), quality=90)
    print('sail designs written')


def main():
    args = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else sys.argv[1:]
    blend, sails_dir = args[0], args[1]
    os.makedirs(OUT_DIR, exist_ok=True)
    bpy.ops.wm.open_mainfile(filepath=os.path.abspath(blend))
    bake_transforms()
    names = {'Shipp_MatBody': 'BrigHull', 'Shipp_MatParts': 'BrigParts', 'Shipp_MatSail': 'BrigSails'}
    for old, new in names.items():
        bpy.data.objects[old].name = new
    tag_sails(bpy.data.objects['BrigSails'])
    shrink_images()
    bpy.ops.export_scene.gltf(filepath=os.path.join(OUT_DIR, 'brig.glb'), export_format='GLB', export_yup=True,
                              export_apply=True, export_image_format='JPEG', export_jpeg_quality=88,
                              export_vertex_color='ACTIVE', export_all_vertex_colors=False)
    export_sail_designs(sails_dir)
    print('exported', os.path.join(OUT_DIR, 'brig.glb'))


main()
