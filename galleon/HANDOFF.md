# Galleon: handoff for the next AI or developer

A realistic open-sea sailing simulator for Android, made in **Godot 4.3**. The owner wants it to look
like a viral "AAA" pirate-ship clip: a big wooden sailing ship, deep-blue choppy ocean, white foam,
turquoise churned water at the bow, and puffy cumulus clouds. They play on an Android phone and
talk in short messages. They care about **realism first**, then **performance on the phone**.

Read this file first, then `README.md` (controls, file map, tools).

---

## 1. Where things are

| What | Where |
|---|---|
| Game project (Godot 4.3) | `galleon/` (run `godot` with `--path galleon`) |
| APK build in CI | `.github/workflows/build-galleon.yml` → release `galleon-v0.1.<run>` |
| Root workflow (other game) | `.github/workflows/build-apk.yml` ignores `galleon/**` |
| Repo-wide AI notes | `AI_HANDOFF.md` (root) lists all of the owner's projects |
| Branches used so far | `ccr-525d57c7-i1qm1u` (v0.1.1–0.1.5), `claude/galleon-game-improvements-ramjl0` (combat, island) |

Other folders in the repo (`putt-party/`, `whiskers-coffee/`, `redeclipse-android/`, `www/`) are
the owner's **other** games. Don't touch them for galleon work.

## 2. History (what was tried and why)

1. **three.js + Capacitor web app**: rejected by the owner ("doesn't look realistic AT ALL"). Removed.
2. **Godot 4.3 Mobile renderer** with a procedural galleon modelled by script in Blender
   (`tools/build_galleon.py`), Gerstner ocean, buoyancy physics: v0.1.1.
3. **Realism pass**: switched to **Forward+**. FFT ocean from GodotOceanWaves (MIT), whitecap
   foam that builds up and fades, crest spray, TAA, SSAO, baked AO on the ship, synthesised audio.
   Removed the HD/SD button (the owner said it caused "white particles"). v0.1.2.
4. **Performance + looks**: clouds baked once (volumetric raymarch → HDR panorama), wake uploaded
   as one buffer at 30 Hz, single shadow cascade, no volumetric fog, auto quality governor
   (target 40 fps, lowers FSR render scale first). New bow wave mesh, droplet streaks, sunlit mist.
   v0.1.3 / v0.1.4.
5. **Purchased ship model "Ocean Brig"** (CGTrader, royalty-free, about $10, 3 masts, 73k tris, 4K PBR,
   10+ sail designs). Converted with `tools/import_brig.py`; wind-animated sails; SAILS button.
   Fixed a bug where furled sails shot about 50 m into the sky (see §6). v0.1.5-brig was built
   **locally** and sent to the owner directly as a file, not via Releases (see §4).
6. **Toward a pirate game** (owner: "make it more realistic… I want to make a pirate game later,
   like Assassin's Creed"). Added real gunnery (ripple broadsides, drag ballistics, skipping shot,
   splashes, splinters, shot holes, drifting powder smoke, sound delayed at 343 m/s), hull damage,
   leaks, pumps, flooding and sinking, an AI man-of-war on the same physics, and a procedural
   tropical island (reef shelf you can run aground on, jungle, palms, surf, turquoise shallows).
   The same session tried to fetch the brig (§4) but couldn't: the repo was still **public** and
   the cloud container's network blocked cgtrader.com (proxy 403). Also the download needs the
   owner's CGTrader login, which an AI session doesn't have.

## 3. Architecture

```
scripts/main.gd       world, sky bake, environment, camera, HUD, input, auto quality, screenshot mode
scripts/ship.gd       rigid-body buoyancy physics + model attach + sail/flag/rudder animation
scripts/waves.gd      autoload "Waves": the 8 Gerstner swell waves (shared by physics and shaders)
scripts/fft_ocean.gd  drives ocean_fft/ (3 GPU FFT cascades, foam, crest spray)
scripts/ocean.gd      camera-following radial ocean grid
scripts/wake.gd       top-down foam map (SubViewport) the ocean shader reads
scripts/bow_wave.gd   bow wave sheet mesh
scripts/helm.gd, rose.gd   ship's wheel and wind indicator controls
scripts/gunnery.gd    cannons: broadsides, shot flight, hits, splashes, smoke/flash/splinter pools, gun sounds
scripts/captain.gd    enemy AI (steer to put the target on the beam, respect the no-go zone, fire on the roll)
scripts/island.gd     procedural island: heightmap, mesh, palms, jungle canopy, height(x, z) lookup
shaders/smoke.gdshader, muzzle_flash.gdshader, terrain.gdshader, canopy.gdshader
shaders/ocean.gdshader       swell + FFT chop + foam + wake + refraction + spec AA
shaders/waves.gdshaderinc    GENERATED from waves.gd (test/gen_waves_inc.gd), never edit by hand
shaders/cloud_bake.gdshader  volumetric cumulus raymarch (runs once at start, in 16 strips)
shaders/sky.gdshader         reads the baked panorama + sun disc
shaders/brig_sail.gdshader   wind on the purchased brig's sails/pennants (vertex-tag driven)
shaders/sail.gdshader, flag.gdshader   the built-in galleon's sails/flags
shaders/bow_wave/bow_spray/spray_droplet.gdshader   bow effects
ocean_fft/            adapted GodotOceanWaves (MIT, see ocean_fft/README.md for changes)
tools/                Python/Blender asset pipeline (see README.md)
test/sea_trials.*     physics tests run in CI (float, speed, no-go zone, helm, shader/physics sync)
```

Key ideas:
- **Physics never reads the GPU.** The ship floats on the analytic Gerstner swell (`Waves`). The
  FFT cascades add visual chop only. Keep `waves.gdshaderinc` in sync (a CI test checks it).
- Ship space is **+Z = bow, +Y = up**. Rudder positive = turn to starboard (clockwise from above).
- The built-in hull shape lives in `ship.gd` (half_width/keel...) and `tools/build_constants.py`.
  The physics (22 buoyancy columns), wake and bow wave use it. The brig is **scaled 1.6x** so its
  hull matches it (`bow_scale = 0.8` because the brig's waterline is shorter).
- **Combat:** guns fire from `Ship.muzzles(side)` (the 6 lower-deck ports; side +1 = port = +X).
  `gunnery.lay()` gives elevation + train (±12°) for a target; `Ship.inside_hull()` is the hit test
  (uses the same parametric hull). `take_hit()` lowers `hull`, adds `leak` below y 0.9 m; at hull 0
  the ship is `sinking` (leak 38 t/s). `flood` (tonnes) is dead weight low on the listing side; pumps
  clear 0.9 t/s. Reserve buoyancy ≈ 1300 t, so a wrecked ship goes under in ~25 s.
- **Enemies** are ordinary `ship.gd` instances with the galleon model recoloured (`set_colours`) and a
  `captain.gd`; main respawns a new one 30 s after each sinking (a bit more skilled each time).
  The wake map (`wake.gd`) draws every ship's wake inside its 300 m window plus shot-splash foam.
- **Island:** `ship.terrain` / `gunnery.terrain` call `island.height(x, z)`; the ocean shader gets
  the same heightmap (`island_tex`, `island_rect`) for surf and shallows. Ocean is on render layer 2
  so the shot-hole decals (layer 1) don't print on the water.
- **Model choice:** `main.gd` loads `assets/brig/brig.glb` if present, else `assets/ship/galleon.glb`.

## 4. The purchased brig: LICENSING (important)

- The brig's files are **licensed** (royalty-free: OK inside the game, NOT OK to publish the raw files).
- The GitHub repo **nitaysc/fewewfefw is PUBLIC**, so `galleon/assets/brig/` is **git-ignored**.
  CI builds therefore ship the **built-in galleon**, not the brig.
- The owner said they would make the repo private "later". When it is **private**:
  1. remove `assets/brig/` from `galleon/.gitignore`,
  2. regenerate the files (below) and commit `galleon/assets/brig/` (~18 MB),
  3. CI will then build the brig APK automatically.
- **Regenerating the brig files:** the owner has the order in their CGTrader account (order "Ocean
  Brig", item 3143947). Download `Ship_Blender.rar` (the .blend, about 330 MB) and `Sails_Mat_1.rar` +
  `Sails_Mat_2.rar` (sail designs), unpack, then:
  ```sh
  pip install bpy pillow numpy          # Blender as a Python module (5.x worked)
  python3 tools/import_brig.py -- Ship_Blender.blend <folder containing Sails_Common/, White_Sail/, ...>
  ```
  Downloading from CGTrader needs **network access set to Full** (or cgtrader.com and
  secure-files.cgtrader.com allowed) in the cloud environment. Never commit the order link.
- Other files in the order: `Body_Mat.rar`, `Parts_Mat.rar` (the hull textures, already packed
  inside the .blend), `ShipBrig_Mesh.rar` (FBX/OBJ), `ShipBrig_MayaScene.rar`. Not needed.
- Sail designs exported: white (default), dirty_white, pirate, black, british, spanish, templar,
  dutch. Also available but unused: BlueFlat, YellowFlat, Damaged (opacity mask).

### How the brig's sails are animated
`import_brig.py` splits the merged sail mesh into its loose pieces and tags every vertex:
- `COLOR.rgb` = direction the cloth bellies out (*0.5+0.5). `COLOR.a` = freedom (0 at the edges).
- `UV2.x` = kind: 0 square sail, 0.5 fore-and-aft sail, 1 pennant, 2 static cloth.
- `UV2.y` = **1 − (metres below the sail's head / 50)**. glTF export flips V, hence the 1 −.
`brig_sail.gdshader` bellies square sails forward by `fill`, fore-and-aft sails sideways by
`side_fill`, flutters them when the wind is weak, hauls them up by `furl`, and streams pennants.
Yards do **not** brace (rotate) on the brig: they are merged into one mesh.

## 5. Building, testing, screenshots

**CI (normal path):** push anything under `galleon/` and `build-galleon.yml` imports, runs the sea
trials, exports a signed debug APK (fixed key `galleon/keys/debug.keystore`, so updates install
over each other) and creates release `galleon-v0.1.<run number>`. Takes about 1 minute. Give the
owner the release link.

**Local build** (how v0.1.5-brig was made): the container had no GPU and no Android SDK.
- Godot: download `Godot_v4.3-stable_linux.x86_64.zip` from GitHub releases.
- Software Vulkan for rendering: `apt-get install mesa-vulkan-drivers` (lavapipe), run under `xvfb-run`.
- Android: commandlinetools from dl.google.com → `sdkmanager "platform-tools" "build-tools;34.0.0"
  "platforms;android-34"`, export templates `.tpz` → `~/.local/share/godot/export_templates/4.3.stable/`,
  editor settings with `export/android/android_sdk_path`, then
  `GODOT_ANDROID_KEYSTORE_DEBUG_PATH=keys/debug.keystore ..._USER=androiddebugkey ..._PASSWORD=android
  godot --headless --export-debug Android build/galleon.apk` (bump `version/code` in
  `export_presets.cfg` temporarily so it installs over the last release, then restore it).

**Tests:** `godot --headless --path galleon res://test/sea_trials.tscn` (exit code 1 on failure).
After changing the wave table: `godot --headless --path galleon --script res://test/gen_waves_inc.gd`.

**Screenshots** (user args after `--`):
```
xvfb-run -a godot --path galleon --rendering-method forward_plus --resolution 1600x740 -- \
  --play --warm=30 --wait=3 --shot=/tmp/s.png --notaa --skyres=1024 \
  [--yaw= --pitch= --dist= --focus=x,y,z --cam=chase|orbit|cinematic|deck --sails=pirate --sail=0|1|2 --galleon --debug=1|2|3]
```
`--notaa`: TAA smears at the ~2 fps of software rendering. `--skyres`: a smaller cloud bake.
`--galleon`: force the built-in ship. `--debug`: ocean FFT foam / slopes / uniforms views.

### Environment gotchas (all hit and solved)
- **lavapipe crashes in the Mobile renderer** (JIT segfault). Use `--rendering-method forward_plus` locally.
- **`.glsl` compute shaders can't be imported headless** (CI). So `ocean_fft/compute/*.comp` are plain
  text, compiled at runtime (`render_context.gd`) and packed via `include_filter` in `export_presets.cfg`.
- GodotOceanWaves bugs fixed for phones: 1024-thread workgroups (Mali allows 384/512) shrunk to 256;
  the spectrum image declared `rgba16f` while the texture was RGBA32F (zeros on some drivers).
- A Python script named `inspect.py` breaks `bpy` (shadows the stdlib module).
- `bmesh` can only be imported after `bpy`.
- The source model had 2 UV maps. Extra maps must be removed so the tag UV becomes Godot's `UV2`.

## 6. Open issues / ideas (ordered by what the owner asked for)

### Pirate-game roadmap (the owner's long-term goal)
Next steps that build on what is there, roughly in order:
- **Boarding**: grapple when alongside and slow, then a crew fight; needs a walkable deck and a
  third-person character (start with a capsule controller on the deck, moving with the ship).
- **Chain shot / grape**: chain shot tears sails (`sail.gdshader` would need holes: an alpha mask
  texture per sail), grape kills crew. Add a crew count to `ship.gd`; reload time grows as crew falls.
- **Masts falling**: split masts in `build_galleon.py` into separate nodes so they can topple.
- **Fire**: hits near the powder room start fires (smoke column, spreading).
- **Ports and towns** on islands, trading, loot from sunk ships (floating cargo to pick up).
- **Weather and time of day**: the sky is baked once; re-bake at a new sun angle when the hour
  changes, and add a storm preset (bigger swell in `waves.gd` → regenerate `waves.gdshaderinc`).
- **Swimming / going ashore**: a character that can leave the ship, walk the island (the island
  heightmap already exists; add collision from it).
- **More ship types**: sloop/brig/frigate sizes; the physics constants in `ship.gd` are per-class.

### Older open issues

1. **Repo privacy, then the brig in CI** (see §4). Until then, brig APKs must be built locally and sent as a file.
2. **Performance**: the owner said it was "a little too low" before the last optimisations; no new
   report yet. Ask for the phone model/fps. Levers: `perf_level` steps in `main.gd`, FFT map size 256→128,
   spray particle count, SSAO off, wake rate, shadow size. Don't drop visual quality without saying so.
3. **Real cloth physics** for sails and flags: the owner asked about it. Current sails/flags are
   shader animation. Plan: GPU verlet cloth in a compute shader (reuse `ocean_fft/render_context.gd`),
   pin the yard/stay vertices, wind force from the ship's apparent wind. Godot's SoftBody3D is too slow on phones.
4. **Yard bracing on the brig** (rotating yards to the wind): needs the yards split out of `BrigParts`
   in `import_brig.py` (by loose part near each square sail's head) plus pivots.
5. **Brig hull fit for physics**: currently the brig is scaled to the parametric hull. A cleaner path is
   to measure the brig hull and drive the buoyancy columns from it.
6. Fore-and-aft sails only furl part of the way (they shrink up their stay); acceptable for now.
7. "Interior" was mentioned once by the owner (wanted a model with an interior). The brig has none.

## 7. Working with the owner
- Phone only. They can't easily use GitHub settings or large uploads (the chat accepts at most 30 MB).
  Give step-by-step tap instructions for anything on their side.
- Always give the APK link (or the file) at the end. They test on the phone and report back with screenshots.
- They want realism and like seeing screenshots of progress.
