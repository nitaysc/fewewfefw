# Junkyard Revival: Quick Wash

A first-person car restoration game for phones. The first playable is "The Fast, Satisfying
Clean": one rusty muscle car, one garage, one pressure washer.

**Status:** the models are done and waiting for the owner's OK. The game itself is next.

## Models (`tools/blender/`)

Every model is built from code with Blender's Python module, so no Blender install or window
is needed:

```
python3 -m venv /opt/blendenv && /opt/blendenv/bin/pip install bpy==5.2.3
cd junkyard-revival/tools/blender
/opt/blendenv/bin/python build.py            # export www/models/*.glb + render previews
/opt/blendenv/bin/python build.py export     # only the .glb files (a few seconds)
SAMPLES=16 /opt/blendenv/bin/python build.py car fpv   # quick preview renders
```

| File | What it is |
| --- | --- |
| `kit.py` | Helpers: rounded boxes, cylinders, tori, lofted shells, tubes, booleans, materials. |
| `models.py` | The car, the washer, and the props (workbench, toolbox, tires, drums, shelves, bucket, garage room). |
| `build.py` | Exports each model to `www/models/<name>.glb` and renders `previews/*.png` with Cycles. |

Conventions: 1 unit = 1 m, Z up in Blender. The car's front points to +X, and the washer's
lance points to +Y, which becomes -Z (forward) in glTF/three.js. The racing stripes, the rust
and the mud are **shaders**, not baked into the models: the clean car is plain blue paint in
the .glb. The game reveals the paint wherever the water hits. `build.py` has the Blender
version of the look (`mud_shader`, `stripes`), used only for previews.

`previews/*.jpg` are the renders shown to the owner: before/after car, the washer, the props,
the garage and a first-person game-view mockup.
