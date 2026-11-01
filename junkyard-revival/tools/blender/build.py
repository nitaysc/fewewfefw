"""Build every model, export each one to www/models/*.glb and render preview pictures.

    /opt/blendenv/bin/python build.py            # export + all previews
    /opt/blendenv/bin/python build.py export     # only the .glb files
    /opt/blendenv/bin/python build.py hero fpv   # only some previews

Needs `pip install bpy` (Blender as a Python module), nothing else.
"""
import math
PI = math.pi
import os
import sys
import time

import bpy
import addon_utils  # noqa: E402  (only importable after bpy)
from mathutils import Vector

sys.path.insert(0, os.path.dirname(__file__))
import models  # noqa: E402
from kit import descendants, material, srgb  # noqa: E402

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, '..', '..', 'www', 'models')
PREV = os.path.join(HERE, 'previews')

for mod in ('io_scene_gltf2', 'cycles'):
    addon_utils.enable(mod, default_set=True)


def fresh():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    for mod in ('io_scene_gltf2', 'cycles'):
        addon_utils.enable(mod, default_set=True)
    return models.mats()


def build_all(M):
    return dict(
        car=models.car(M), washer=models.washer(M), workbench=models.workbench(M),
        toolbox=models.toolbox(M), tires=models.tire_stack(M),
        drum_blue=models.drum(M, 'drum_blue', 'DrumBlue'),
        drum_red=models.drum(M, 'drum_red', 'DrumRed'),
        shelves=models.shelf_unit(M), bucket=models.bucket(M), garage=models.garage(M),
        lift=models.car_lift(M), washer_unit=models.washer_unit(M), cone=models.cone(M),
        jerry_can=models.jerry_can(M), extinguisher=models.extinguisher(M),
        sign=models.wall_sign(M), drain=models.floor_drain(M))


# ------------------------------------------------------------------ export

def export(objs):
    os.makedirs(OUT, exist_ok=True)
    for name, r in objs.items():
        for o in bpy.data.objects:
            o.select_set(False)
        for o in descendants(r):
            o.select_set(True)
        path = os.path.join(OUT, name + '.glb')
        bpy.ops.export_scene.gltf(filepath=path, export_format='GLB', use_selection=True,
                                  export_apply=True, export_yup=True, export_cameras=False,
                                  export_lights=False, export_extras=False)
        print('  %-10s %6.1f KB' % (name, os.path.getsize(path) / 1024))


# ------------------------------------------------------------------ preview look

def dirty(mat, threshold, mud):
    """Preview only: blend the material with caked mud/rust. Where world X (plus noise) is
    above `threshold` the car is clean, so threshold 9 = all dirty, -9 = all clean."""
    nt = mat.node_tree
    out = nt.nodes['Material Output']
    clean = out.inputs['Surface'].links[0].from_node
    geo = nt.nodes.new('ShaderNodeNewGeometry')
    sep = nt.nodes.new('ShaderNodeSeparateXYZ')
    nt.links.new(geo.outputs['Position'], sep.inputs[0])
    noise = nt.nodes.new('ShaderNodeTexNoise')
    noise.inputs['Scale'].default_value = 2.2
    noise.inputs['Detail'].default_value = 6
    nt.links.new(geo.outputs['Position'], noise.inputs['Vector'])
    wob = nt.nodes.new('ShaderNodeMath')
    wob.operation = 'MULTIPLY_ADD'
    nt.links.new(noise.outputs['Fac'], wob.inputs[0])
    wob.inputs[1].default_value = 1.2
    wob.inputs[2].default_value = -0.6
    add = nt.nodes.new('ShaderNodeMath')
    add.operation = 'ADD'
    nt.links.new(sep.outputs['X'], add.inputs[0])
    nt.links.new(wob.outputs[0], add.inputs[1])
    gt = nt.nodes.new('ShaderNodeMath')
    gt.operation = 'GREATER_THAN'
    nt.links.new(add.outputs[0], gt.inputs[0])
    gt.inputs[1].default_value = threshold
    mix = nt.nodes.new('ShaderNodeMixShader')
    nt.links.new(gt.outputs[0], mix.inputs['Fac'])
    m_out = mud(nt, geo)
    nt.links.new(m_out, mix.inputs[1])
    nt.links.new(clean.outputs[0], mix.inputs[2])
    nt.links.new(mix.outputs[0], out.inputs['Surface'])


def mud_shader(nt, geo):
    """Junkyard look: sun-faded paint, orange rust patches, dark caked mud that gets
    thicker towards the bottom of the car."""
    def node(kind, **inputs):
        n = nt.nodes.new(kind)
        for k, v in inputs.items():
            n.inputs[k].default_value = v
        return n

    def math_(op, a, b):
        n = nt.nodes.new('ShaderNodeMath')
        n.operation = op
        for i, v in enumerate((a, b)):
            if isinstance(v, (int, float)):
                n.inputs[i].default_value = v
            else:
                nt.links.new(v, n.inputs[i])
        return n.outputs[0]

    def mix(fac, a, b):
        n = nt.nodes.new('ShaderNodeMix')
        n.data_type = 'RGBA'
        nt.links.new(fac, n.inputs['Factor'])
        for key, v in (('A', a), ('B', b)):
            if isinstance(v, str):
                n.inputs[key].default_value = (*srgb(v), 1)
            else:
                nt.links.new(v, n.inputs[key])
        return n.outputs['Result']

    pos = geo.outputs['Position']
    sep = nt.nodes.new('ShaderNodeSeparateXYZ')
    nt.links.new(pos, sep.inputs[0])
    n_rust = node('ShaderNodeTexNoise', Scale=2.6, Detail=8.0, Roughness=0.62)
    n_fine = node('ShaderNodeTexNoise', Scale=14.0, Detail=6.0)
    n_mud = node('ShaderNodeTexNoise', Scale=3.5, Detail=7.0, Roughness=0.7)
    for n in (n_rust, n_fine, n_mud):
        nt.links.new(pos, n.inputs['Vector'])
    # rust: sharp-edged blotches
    rust = math_('MULTIPLY', math_('SUBTRACT', n_rust.outputs['Fac'], 0.5), 9.0)
    rust = math_('MINIMUM', math_('MAXIMUM', rust, 0.0), 1.0)
    rust_col = mix(n_fine.outputs['Fac'], '#8a3a12', '#c4661f')
    # mud: more of it lower down
    low = math_('MULTIPLY', math_('SUBTRACT', 0.95, sep.outputs['Z']), 1.3)
    mud = math_('ADD', n_mud.outputs['Fac'], low)
    mud = math_('MINIMUM', math_('MAXIMUM', math_('MULTIPLY', math_('SUBTRACT', mud, 0.85),
                                                  6.0), 0.0), 1.0)
    mud_col = mix(n_fine.outputs['Fac'], '#2e2116', '#5b4128')
    c = mix(n_fine.outputs['Fac'], '#5b7088', '#6f7f8f')        # faded paint
    c = mix(rust, c, rust_col)
    c = mix(mud, c, mud_col)
    b = nt.nodes.new('ShaderNodeBsdfPrincipled')
    b.inputs['Roughness'].default_value = 0.88
    nt.links.new(c, b.inputs['Base Color'])
    bump = node('ShaderNodeBump', Strength=0.5, Distance=0.02)
    nt.links.new(math_('ADD', mud, math_('MULTIPLY', rust, 0.4)), bump.inputs['Height'])
    nt.links.new(bump.outputs['Normal'], b.inputs['Normal'])
    return b.outputs[0]


def stripes(mat, stripe_hex='#f4f1e8'):
    """Twin racing stripes over hood, roof and trunk (world |Y| band on upward faces)."""
    nt = mat.node_tree
    b = nt.nodes['Principled BSDF']
    geo = nt.nodes.new('ShaderNodeNewGeometry')
    sep = nt.nodes.new('ShaderNodeSeparateXYZ')
    nt.links.new(geo.outputs['Position'], sep.inputs[0])
    nsep = nt.nodes.new('ShaderNodeSeparateXYZ')
    nt.links.new(geo.outputs['Normal'], nsep.inputs[0])
    ab = nt.nodes.new('ShaderNodeMath')
    ab.operation = 'ABSOLUTE'
    nt.links.new(sep.outputs['Y'], ab.inputs[0])

    def op(kind, a, bval):
        n = nt.nodes.new('ShaderNodeMath')
        n.operation = kind
        nt.links.new(a, n.inputs[0])
        if isinstance(bval, float):
            n.inputs[1].default_value = bval
        else:
            nt.links.new(bval, n.inputs[1])
        return n.outputs[0]
    s = op('MULTIPLY', op('GREATER_THAN', ab.outputs[0], 0.09),
           op('LESS_THAN', ab.outputs[0], 0.25))
    s = op('MULTIPLY', s, op('GREATER_THAN', nsep.outputs['Z'], 0.6))
    mix = nt.nodes.new('ShaderNodeMix')
    mix.data_type = 'RGBA'
    nt.links.new(s, mix.inputs['Factor'])
    mix.inputs['A'].default_value = b.inputs['Base Color'].default_value[:]
    mix.inputs['B'].default_value = (*srgb(stripe_hex), 1)
    nt.links.new(mix.outputs['Result'], b.inputs['Base Color'])


def concrete(mat):
    nt = mat.node_tree
    b = nt.nodes['Principled BSDF']
    tc = nt.nodes.new('ShaderNodeTexCoord')
    n = nt.nodes.new('ShaderNodeTexNoise')
    n.inputs['Scale'].default_value = 1.6
    n.inputs['Detail'].default_value = 8
    nt.links.new(tc.outputs['Object'], n.inputs['Vector'])
    ramp = nt.nodes.new('ShaderNodeValToRGB')
    el = ramp.color_ramp.elements
    el[0].position, el[0].color = 0.3, (*srgb('#76746f'), 1)
    el[1].position, el[1].color = 0.7, (*srgb('#a29f98'), 1)
    nt.links.new(n.outputs['Fac'], ramp.inputs[0])
    nt.links.new(ramp.outputs[0], b.inputs['Base Color'])
    # wet patches are shinier
    r = nt.nodes.new('ShaderNodeMapRange')
    r.inputs['To Min'].default_value = 0.15
    r.inputs['To Max'].default_value = 0.75
    nt.links.new(n.outputs['Fac'], r.inputs['Value'])
    nt.links.new(r.outputs[0], b.inputs['Roughness'])


# ------------------------------------------------------------------ scene setup

def look_at(ob, target):
    d = Vector(target) - ob.location
    ob.rotation_euler = d.to_track_quat('-Z', 'Y').to_euler()


def camera(loc, target, lens=28):
    cd = bpy.data.cameras.new('Cam')
    cd.lens = lens
    cam = bpy.data.objects.new('Cam', cd)
    bpy.context.collection.objects.link(cam)
    cam.location = loc
    look_at(cam, target)
    bpy.context.scene.camera = cam
    return cam


def area(loc, size, power, color=(1, 0.97, 0.92), target=None, rot=None):
    ld = bpy.data.lights.new('Area', 'AREA')
    ld.shape = 'RECTANGLE'
    ld.size, ld.size_y = size
    ld.energy = power
    ld.color = color
    lo = bpy.data.objects.new('Area', ld)
    bpy.context.collection.objects.link(lo)
    lo.location = loc
    if target:
        look_at(lo, target)
    if rot:
        lo.rotation_euler = rot
    return lo


def render_setup(w=1280, h=720, samples=64, world=(0.06, 0.065, 0.075), strength=1.0):
    s = bpy.context.scene
    s.render.engine = 'CYCLES'
    s.cycles.device = 'CPU'
    s.cycles.samples = int(os.environ.get("SAMPLES", samples))
    s.cycles.use_denoising = True
    s.cycles.max_bounces = 5
    s.cycles.diffuse_bounces = 3
    s.cycles.glossy_bounces = 3
    s.cycles.transparent_max_bounces = 4
    s.render.resolution_x, s.render.resolution_y = w, h
    s.render.resolution_percentage = 100
    s.render.image_settings.file_format = 'PNG'
    try:
        s.view_settings.view_transform = 'AgX'
        s.view_settings.look = 'AgX - Punchy'
    except TypeError:
        pass
    wd = bpy.data.worlds.new('World')
    wd.use_nodes = True
    bg = wd.node_tree.nodes['Background']
    bg.inputs['Color'].default_value = (*world, 1)
    bg.inputs['Strength'].default_value = strength
    s.world = wd


def render(name):
    os.makedirs(PREV, exist_ok=True)
    p = os.path.join(PREV, name + '.png')
    bpy.context.scene.render.filepath = p
    t = time.time()
    bpy.ops.render.render(write_still=True)
    print('  rendered %s in %.0fs' % (name, time.time() - t))


def move(r, loc, rotz=0.0):
    r.location = loc
    r.rotation_euler = (0, 0, rotz)


def remove(r):
    for o in descendants(r):
        bpy.data.objects.remove(o)


def dress_garage(o):
    """Place the props in the room. The room is offset so the camera fits inside."""
    move(o['garage'], (0, 1.0, 0))
    move(o['workbench'], (1.2, 5.1, 0), 0)
    move(o['toolbox'], (-0.6, 5.15, 0), 0)
    move(o['shelves'], (-5.2, 2.6, 0), -math.pi / 2)
    move(o['tires'], (-4.7, 4.9, 0), 0)
    move(o['drum_blue'], (3.7, 5.0, 0))
    move(o['drum_red'], (4.4, 4.6, 0), 1.0)
    move(o['bucket'], (2.0, -1.5, 0))
    move(o['lift'], (-3.6, 0.4, 0))
    move(o['washer_unit'], (2.9, -2.2, 0), 2.4)
    move(o['cone'], (-2.6, -2.6, 0))
    move(o['jerry_can'], (4.9, 3.4, 0), 0.4)
    move(o['extinguisher'], (5.3, 1.5, 0), PI)
    move(o['sign'], (-1.2, 5.38, 2.55))
    move(o['drain'], (0.3, -1.6, 0))
    for x in (-2.5, 0.0, 2.5):
        for y in (-0.5, 2.5):
            area((x, y, 3.2), (1.3, 0.3), 220, color=(1, 0.96, 0.9), rot=(0, 0, 0))
    area((2.6, 5.3, 2.0), (1.4, 0.8), 150, color=(1, 0.8, 0.55), rot=(math.radians(90), 0, 0))


# ------------------------------------------------------------------ previews

def preview_hero():
    M = fresh()
    o = build_all(M)
    remove(o['washer'])
    dress_garage(o)
    stripes(M['paint'])
    for k in ('paint', 'glass', 'chrome', 'rubber', 'stripe'):
        dirty(M[k], 0.15, mud_shader)
    concrete(M['floor'])
    o['car'].rotation_euler = (0, 0, math.radians(-8))
    render_setup()
    camera((4.6, -3.0, 1.75), (-0.2, 0.6, 0.65), lens=26)
    render('hero_half_clean')


def preview_fpv():
    M = fresh()
    o = build_all(M)
    dress_garage(o)
    stripes(M['paint'])
    for k in ('paint', 'glass', 'chrome', 'rubber'):
        dirty(M[k], 0.7, mud_shader)
    concrete(M['floor'])
    render_setup()
    cam = camera((2.6, -2.7, 1.62), (0.6, 0.0, 0.75), lens=30)
    w = o['washer']
    w.parent = cam
    w.location = (0.2, -0.16, -0.46)
    aim = Vector((-0.3, 0.2, -1.0)).normalized()       # towards the screen centre
    w.rotation_euler = aim.to_track_quat('Y', 'Z').to_euler()
    render('first_person')


def studio(floor_hex='#d9dde3', key=1400):
    render_setup(world=(0.6, 0.65, 0.72), strength=0.6)
    f = models.box('StudioFloor', (40, 40, 0.1), loc=(0, 0, -0.05),
                   mat=material('Studio', floor_hex, rough=0.6), bev=0)
    area((3, -3, 5), (4, 4), key, target=(0, 0, 0.5))
    area((-4, 2, 3), (3, 3), 500, color=(0.8, 0.88, 1.0), target=(0, 0, 0.5))
    return f


def preview_car():
    for name, clean, cam, tgt in (
            ('car_front_dirty', 9.0, (5.4, -4.6, 2.0), (0.2, 0, 0.6)),
            ('car_front_clean', -9.0, (5.4, -4.6, 2.0), (0.2, 0, 0.6)),
            ('car_rear_clean', -9.0, (-5.2, -4.4, 2.3), (-0.2, 0, 0.6))):
        M = fresh()
        models.car(M)
        stripes(M['paint'])
        if clean > 0:
            for k in ('paint', 'glass', 'chrome', 'rubber'):
                dirty(M[k], clean, mud_shader)
        studio()
        camera(cam, tgt, lens=40)
        render(name)


def preview_washer():
    M = fresh()
    w = models.washer(M)
    w.location = (0, 0, 0.6)
    w.rotation_euler = (0, 0, math.radians(-90))
    studio('#cfd6de', key=700)
    camera((0.42, -1.45, 0.95), (0.42, 0, 0.55), lens=50)
    render('washer')


def preview_props():
    M = fresh()
    o = dict(workbench=models.workbench(M), toolbox=models.toolbox(M),
             tires=models.tire_stack(M), drum_blue=models.drum(M, 'drum_blue', 'DrumBlue'),
             drum_red=models.drum(M, 'drum_red', 'DrumRed'), shelves=models.shelf_unit(M),
             bucket=models.bucket(M), washer_unit=models.washer_unit(M), cone=models.cone(M),
             jerry_can=models.jerry_can(M), extinguisher=models.extinguisher(M))
    move(o['washer_unit'], (4.6, -0.3, 0), 2.6)
    move(o['cone'], (-2.3, -0.9, 0))
    move(o['jerry_can'], (0.0, -0.9, 0), 0.5)
    move(o['extinguisher'], (1.3, -0.9, 0))
    move(o['shelves'], (-3.4, 0.4, 0))
    move(o['workbench'], (-1.2, 0.3, 0))
    move(o['toolbox'], (0.65, 0.3, 0))
    move(o['tires'], (1.9, 0.2, 0))
    move(o['drum_blue'], (3.1, 0.1, 0))
    move(o['drum_red'], (3.75, 0.5, 0))
    move(o['bucket'], (2.6, -0.6, 0))
    studio()
    camera((0.6, -7.6, 2.5), (0.5, 0.2, 0.8), lens=30)
    render('props')


PREVIEWS = dict(hero=preview_hero, fpv=preview_fpv, car=preview_car, washer=preview_washer,
                props=preview_props)

if __name__ == '__main__':
    args = sys.argv[1:] or ['export'] + list(PREVIEWS)
    if 'export' in args:
        M = fresh()
        export(build_all(M))
    for a in args:
        if a in PREVIEWS:
            PREVIEWS[a]()
