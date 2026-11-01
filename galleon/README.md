# Galleon ⛵

An open-sea galleon sailing simulator for Android, built with **Godot 4.3** (Mobile renderer).
Prototype / first slice: one ship, open ocean, real wave and buoyancy physics.

## Download

Every push that touches `galleon/` builds an APK and publishes it as a
`galleon-v0.1.N` release (see the repo's Releases page, file `galleon.apk`).

## Controls

- **Helm** (bottom left): drag the wheel round to steer; it stays put. Double-tap to centre.
- **Sails** (bottom right): ▲ / ▼ — furled, half sail, full sail.
- **Camera**: drag anywhere to orbit, pinch to zoom. **CAM** cycles Chase / Orbit / Cinematic / Quarterdeck.
- **HD / SD** toggles render quality (also drops resolution automatically if the phone struggles).
- Desktop: A/D steer, W/S sails, C camera, mouse wheel zoom.

## How it works

| Part | File |
|---|---|
| Waves: 8 Gerstner waves, shared by physics and shader | `scripts/waves.gd` → `shaders/waves.gdshaderinc` |
| Ship physics: 22 buoyancy columns on the real wave surface, hull drag, keel, rudder, sail polar (can't sail closer than ~55° to the wind), heel | `scripts/ship.gd` |
| Ocean: camera-following radial grid, FFT detail normals, refraction and absorption, whitecaps from wave folding, hull contact foam, wake | `shaders/ocean.gdshader`, `scripts/ocean.gd` |
| Wake: foam/turbulence blobs (stern trail, Kelvin bow arms, hull wash) rendered top-down into a texture | `scripts/wake.gd` |
| Sails: shape computed on the GPU (billow, furl, luffing), yards brace to the wind | `shaders/sail.gdshader` |
| Sky with cumulus clouds, lights and reflects the scene | `shaders/sky.gdshader` |
| HUD, camera, title screen | `scripts/main.gd`, `scripts/helm.gd`, `scripts/rose.gd` |

### The ship model

`assets/ship/galleon.glb` is modelled **in Blender by script** — no downloaded assets:

```sh
pip install bpy pillow numpy
python3 tools/textures.py      # paints hull/deck/sail/stern/flag textures + normal maps
python3 tools/ocean_maps.py    # FFT ocean detail normals and foam noise
python3 tools/build_galleon.py # builds the galleon in Blender and exports the .glb
```

Node names Godot relies on: `Hull`, `Rigging`, `Yard_*` (pivot on the mast, with a `Sail_*` child),
`Lateen`, `Rudder`, `Flag_*`. To swap in a different ship model later, keep those names
(or adapt `ship.gd → attach_model`).

## Tests

```sh
godot --headless res://test/sea_trials.tscn     # floats, sails, can't point into the wind, answers the helm
godot --headless --script res://test/gen_waves_inc.gd   # after changing the wave table
```

## Screenshots without a GPU

The container used to build this has no GPU: Godot runs on Mesa's lavapipe (software Vulkan)
under `xvfb-run`. lavapipe crashes in the Mobile renderer, so screenshots use Forward+:

```sh
xvfb-run -a godot --rendering-method forward_plus --resolution 1600x740 -- --play --warm=30 --shot=/tmp/s.png --wait=3
```
