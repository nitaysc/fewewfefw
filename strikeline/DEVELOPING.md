# Developing Strikeline: handoff guide

This file is for whoever picks the project up next: you, a friend, or another AI coding
assistant (Claude Code, Cursor, Copilot, ChatGPT, ...). Point the assistant at this file
first: *"Read strikeline/DEVELOPING.md and README.md, then ..."*.

## Where everything is

- Code: GitHub repo `nitaysc/fewewfefw`, folder `strikeline/`. Latest work is on branch
  `ccr-c22930ba-461lr1` (merge it into `main` if you want one main line).
- Engine: **Godot 4.4.1** (standard build, GDScript), renderer **GL Compatibility**.
- Builds: every push touching `strikeline/` runs `.github/workflows/build-strikeline.yml`,
  which runs the tests, exports a signed APK and publishes it as a GitHub Release named
  `strikeline-vX.Y.N`. You never need to build on your own machine to get an APK.

## Getting started on a computer

1. Install Godot 4.4.1 and its export templates (Editor > Manage Export Templates).
2. Clone the repo and open `strikeline/project.godot` in Godot.
3. Online play needs the WebRTC addon: run `./tools/get_webrtc.sh` once (Linux/macOS/WSL).
4. Press Play (F5). Keyboard: arrows/WASD move, J attack, K special, Space jump, L shield.
5. Android APK locally: install the Android SDK + JDK 17/21, set their paths in
   Editor Settings > Export > Android, then
   `GODOT_ANDROID_KEYSTORE_RELEASE_PATH=$PWD/android/strikeline.keystore GODOT_ANDROID_KEYSTORE_RELEASE_USER=strikeline GODOT_ANDROID_KEYSTORE_RELEASE_PASSWORD=strikeline godot --headless --export-release "Android" build/strikeline.apk`.
   Keep using the committed keystore so new APKs install over old ones.

## Rules that keep the game working

- **Run the tests before pushing** (they're what CI runs):
  ```
  godot --headless --import
  godot --headless --fixed-fps 60 res://test/touch_test.tscn   # expects "RESULT OK"
  godot --headless --fixed-fps 60 res://test/sim.tscn          # expects "ALL DONE"
  godot --headless --fixed-fps 60 res://test/time_test.tscn    # expects "RESULT winner"
  ```
  plus the two-process Wi-Fi test in the workflow file.
- **Look at your change.** Many `test/*_shots.tscn` scenes save screenshots; run them with
  a real renderer, e.g. on Linux `xvfb-run godot --rendering-driver opengl3 --resolution 1280x720 res://test/stage_shots.tscn -- /tmp/out`.
  Useful ones: `shots` (all screens), `stage_shots` (stages; `thumbs` arg rewrites the
  select-screen stage pictures), `szoom_test` (KO zoom + bubbles), `cine_test` (Final Smash
  cutscene, arg = fighter index), `loco_shots` (run/fall), `ui_anim` (wipe, button press).
- **Version bump** (when shipping): `export_presets.cfg` `version/name`, the version text in
  `scripts/title.gd`, the release names in `.github/workflows/build-strikeline.yml`, README.
- **Never commit API keys.** Meshy reads `MESHY_API_KEY` or `MESHY_API_KEY_FILE`.
- Only use art/sound you're allowed to: everything in here is generated (Meshy, procedural)
  or CC0 (see `sfx/CREDITS.txt`).

## How the game is built (map for the code)

| Area | Files |
|---|---|
| Screen flow, menus, transitions | `scripts/main.gd`, `ui.gd` (buttons), `title.gd`, `select.gd`, `results.gd`, `online.gd`, `pause_menu.gd`, `wipe.gd` |
| A fight (camera, hits, KOs, KO zoom, Final Smash flow) | `scripts/match.gd` |
| Fighter physics/states/moves | `scripts/fighter.gd`, move data in `scripts/roster.gd` |
| CPU | `scripts/ai.gd` |
| 3D fighter models + clip choice | `scripts/fighter_view3d.gd`, `weapon_skin.gd`, `portrait3d.gd` |
| 3D stages and items | `scripts/stage3d.gd` (geometry rects live in `stage.gd`) |
| Backdrops | `scripts/stage_bg.gd` |
| Effects | `scripts/fx.gd`, `projectiles.gd`, `items.gd` |
| Final Smash cutscene | `scripts/cinematic.gd` |
| HUD (damage, bubbles, banners) | `scripts/hud.gd` |
| Touch controls | `scripts/touch.gd` |
| Sounds | `scripts/sfx.gd`; files in `sfx/` built by `tools/build_sfx.py` |
| Online | `scripts/net.gd`, `netsync.gd` |

Key idea: **gameplay is a 2D simulation** (positions in pixels, 48 px = 1 m). The 3D models,
stage and camera follow it. Effects/HUD are 2D on top. Online is host-authoritative; any
new visual "event" must also be sent with `net_rec([...])` and handled in `Match._replay`
so guests see it.

## Adding things

- **A new move**: add its data in `roster.gd` (keyframes, hitboxes, `len`), map it to a clip in
  `FighterView3D.CLIPS`.
- **A new fighter**: generate with `tools/meshy.py` (add a prompt to `FIGHTERS`, then
  `preview`, `refine`, `rig`, `animate`), run `tools/extract_anims.gd` and
  `tools/analyze_clips.gd`, add the entry to `MODEL_DIRS`, `roster.gd` (stats, moves) and
  the Final Smash name in `hud.gd`. Costs roughly 100 Meshy credits.
  **Cheap way (~20 credits, how Bolt was made):** all Meshy rigs share one 24-bone skeleton,
  so a new fighter can borrow clips. Add the prompt to `FIGHTERS` (and to `LITE` for the
  5-credit preview model), run `preview`, `refine`, `rig` only, then list the fighters to
  borrow from in `BORROW` in `tools/extract_anims.gd`. Moves can reuse existing logic by
  duplicating another fighter's special (see the BOLT block in `roster.gd`).
  For very different body shapes add the fighter to `RETARGET` too (Pip, a chibi, uses it:
  rotations become rest-relative and hip height is scaled). Best value: also buy the
  fighter's own `common`, `move` and `move2` animation groups (~57 credits, see how Pip was
  made); its own clips win over borrowed ones.
- **Special cooldowns**: a move can have `"cd": frames` and `"limit": [projectile kind, max]`
  (Sol's orb: one on screen, short cooldown). The SPECIAL touch button shows the cooldown.
- **Costumes**: `scripts/costume.gd` (8 colour sets, a shader that recolours the outfit and
  keeps skin). Picked on the select screen; duplicate fighters get different colours.
- **A new stage**: add rects/spawns in `stage.gd` `setup()`, a builder in `stage3d.gd`,
  a backdrop in `stage_bg.gd`, then regenerate thumbnails with `stage_shots -- x thumbs`.
- **Props/items models**: `python3 tools/meshy.py props <name>` (prompts in `PROPS`).
- **Sounds**: edit the table in `tools/build_sfx.py` and re-run it on the extracted packs.

## Gotchas learned the hard way

- Load textures in `_ready`, not inside `_draw` (the first draw shows them blank/white).
- Imported Meshy props often include stray bits (stands, rocks); `Stage3D.CROP` trims them.
- Prop textures are capped in each `.jpg.import` (`process/size_limit`) to keep the APK small.
- Depth fog tints anything unless the material sets `disable_fog`.
- The raw Meshy animation downloads (`assets/meshy/*/anim_*.glb`) are not in git (too big);
  the game only needs the committed `anims.res`. Re-running `extract_anims.gd` needs them, so
  re-download with `tools/meshy.py animate` first (task ids are in `tools/meshy_tasks.json`).
- Headless tool runs print "Identifier not found: Sfx"; it's harmless.

## Ideas not done yet

Original new fighters, a fourth stage, team battles, stamina mode, taunts, Classic mode,
more items, rebindable controls, controller support.
