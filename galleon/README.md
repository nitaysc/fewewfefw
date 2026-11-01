# Galleon ⛵

An open-sea galleon sailing simulator for Android, built with **Godot 4.3** (Forward+ renderer: TAA, SSAO, volumetric haze, compute-shader FFT ocean).
Prototype / first slice: one ship, open ocean, real wave and buoyancy physics.

## Download

Every push that touches `galleon/` builds an APK and publishes it as a
`galleon-v0.1.N` release (see the repo's Releases page, file `galleon.apk`).

## Controls

- **Helm** (bottom left): drag the wheel round to steer; it stays put. Double-tap to centre.
- **Sails** (bottom right): ▲ / ▼ — furled, half sail, full sail.
- **Camera**: drag anywhere to orbit, pinch to zoom. **CAM** cycles Chase / Orbit / Cinematic / Quarterdeck.
- Graphics always start at full quality; if the phone can't hold ~30 fps the game lowers the render
  scale (with FSR upscaling) and then the most expensive effects by itself.
- Desktop: A/D steer, W/S sails, C camera, mouse wheel zoom.

## How it works

| Part | File |
|---|---|
| Waves: 8 Gerstner waves, shared by physics and shader | `scripts/waves.gd` → `shaders/waves.gdshaderinc` |
| Ship physics: 22 buoyancy columns on the real wave surface, hull drag, keel, rudder, sail polar (can't sail closer than ~55° to the wind), heel | `scripts/ship.gd` |
| Ocean: camera-following grid; Gerstner swell + 3 GPU FFT cascades (JONSWAP), foam that builds where crests break and fades, spray off the crests, refraction, hull contact foam, wake | `shaders/ocean.gdshader`, `scripts/ocean.gd`, `scripts/fft_ocean.gd`, `ocean_fft/` |
| Wake: foam/turbulence blobs (stern trail, Kelvin bow arms, hull wash) rendered top-down into a texture | `scripts/wake.gd` |
| Sails: shape computed on the GPU (billow, furl, luffing), yards brace to the wind | `shaders/sail.gdshader` |
| Sky: volumetric cumulus raymarched once at start-up into an HDR panorama (in strips, behind the title screen); the sky then costs one texture read per pixel | `shaders/cloud_bake.gdshader`, `shaders/sky.gdshader`, `main.gd → _bake_sky` |
| Bow wave: a translucent sheet of water riding the live sea surface, foam on its breaking crest; droplet streaks and sunlit mist | `scripts/bow_wave.gd`, `shaders/bow_wave.gdshader`, `shaders/spray_droplet.gdshader`, `shaders/bow_spray.gdshader` |
| Ambience: synthesised surf and wind loops | `tools/make_audio.py` |
| HUD, camera, title screen | `scripts/main.gd`, `scripts/helm.gd`, `scripts/rose.gd` |

### The ship model

`assets/ship/galleon.glb` is modelled **in Blender by script** — no downloaded assets:

```sh
pip install bpy pillow numpy
python3 tools/textures.py      # paints hull/deck/sail/stern/flag textures + normal maps
python3 tools/ocean_maps.py    # FFT ocean detail normals and foam noise
python3 tools/build_galleon.py # builds the galleon in Blender, bakes ambient occlusion, exports the .glb
python3 tools/make_audio.py    # surf and wind loops
```

Node names Godot relies on: `Hull`, `Rigging`, `Yard_*` (pivot on the mast, with a `Sail_*` child),
`Lateen`, `Rudder`, `Flag_*`. To swap in a different ship model later, keep those names
(or adapt `ship.gd → attach_model`).

## Tests

```sh
godot --headless res://test/sea_trials.tscn     # floats, sails, can't point into the wind, answers the helm
godot --headless --script res://test/gen_waves_inc.gd   # after changing the wave table
```

## FFT ocean credit

`ocean_fft/` is adapted from [GodotOceanWaves](https://github.com/2Retr0/GodotOceanWaves) by
Ethan Truong (MIT). Changes: compute shaders are compiled at runtime (so CI can import headless),
workgroups shrunk to sizes phone GPUs support (the original used 1024 threads per group, which
many mobile GPUs can't run), the spectrum image format matches its texture, and spray rides the swell.

## Screenshots without a GPU

The build container has no GPU: Godot runs on Mesa's lavapipe (software Vulkan) under `xvfb-run`.

```sh
xvfb-run -a godot --resolution 1600x740 -- --play --warm=30 --shot=/tmp/s.png --wait=5 --notaa
```
(`--notaa`: at ~2 fps TAA would smear the image; `--skyres=1024` bakes a smaller sky (the CPU renderer is slow);
`--focus=x,y,z` aims the camera at a point on the ship; `--debug=1|2|3` shows FFT foam / slopes / uniforms.)

## The purchased ship (Ocean Brig)

The game uses the "Ocean Brig" from CGTrader (royalty-free licence) when its converted files are in
`assets/brig/` (`brig.glb` + `sails/*.jpg`); otherwise it falls back to the built-in galleon.
**These files are licensed and must not be published**, so `assets/brig/` is git-ignored while this
repository is public. Convert the original download with:

```sh
python3 tools/import_brig.py <Ship_Blender.blend> <folder with the unpacked Sails_Mat_1/2 archives>
```

It scales/seats the ship on the physics hull, tags every sail vertex for the wind shader
(`shaders/brig_sail.gdshader`: square sails belly forward, staysails to the side, pennants stream),
shrinks the 4K textures to 2K, and exports 8 sail designs (white, dirty white, pirate, black,
British, Spanish, Templar, Dutch) that the **SAILS** button cycles through.
