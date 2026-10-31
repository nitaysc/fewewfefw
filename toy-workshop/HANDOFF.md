# Tiny Toyworks: handoff (read this first)

Owner: wants a **real Android game** (native, not a web page), **realistic** look, smooth
animation, things that feel physical. They rejected the older web games in this repo
(`whiskers-coffee/`, `putt-party/`) as "browser games". Work on branch
`claude/coffee-game-continue-i9dl5k`. Don't open PRs unless asked. Commit messages end with the
Co-Authored-By / Claude-Session lines the session gives you; no model names in commits.

## What the game is now (version 2, hands-on)
A cozy **toymaker** game in **Godot 4.6.2** (GL Compatibility renderer, runs on any phone).
- You walk a realistic character with a **floating joystick** (left half of the screen) and use
  **one big action button** (bottom right). Tap: take/put. Hold: work (saw, drill, paint, assemble).
- Stations: lumber crate → **saw bench** (lumber → 2 blocks) → **drill press** (lumber → 2 wheels or
  2 pegs; mode chips appear when you stand there) → **paint table** (colour chips appear) →
  **assembly workbench** (car = block+2 wheels, top = wheel+peg, plane = block+2 pegs,
  train = 2 blocks+2 wheels; colour comes from the body part) → **shipping box**. Scrap basket bins anything.
- **Days** of 3 minutes. Orders arrive with a **patience bar**; faster = bigger tip; missed orders count
  against the day's stars. End of day → summary → **shop** (apprentice sawyer/turner/painter = the
  automation; sharper tools; comfy shoes; cozy waiting corner). Level-ups unlock toys and paints.
- A golden arrow (days 1–3) points to the next station for the most urgent order.

## Files (`toy-workshop/`)
| File | What |
| --- | --- |
| `src/data.gd` | Parts, toys/recipes, colours, work times, day length, upgrades, `recipe_for`. |
| `src/game.gd` | Autoload `Game`: coins, xp/level, day timer, orders + patience, shipping/pay, upgrades, save (`user://toyworks2.json`). |
| `src/station.gd` | `Station`: items lying on it, take/put rules, `job()`, `do_work()`, shows items in `slots`, animates its `tool`. |
| `src/worker.gd` | `Worker` (CharacterBody3D): you and apprentices. Walk/carry/work animations, carried item, blob shadow. |
| `src/toymaker.gd` | Builds a person: Quaternius base body + peasant outfit + hair/beard on one skeleton; trims the body under the clothes; animation library (Godot drops the `_Loop` suffix: use `Idle`, `Walk`, `Walk_Carry`, `Jog_Fwd`, `TreeChopping`, `Push`, `Farm_Watering`, `Interact`, `Yes`, `Dance`...). |
| `src/workshop.gd` | The room (PBR floor/walls, windows, HDRI sky light, lamps), station layout, decor, follow camera, action logic (`press/release/action_label`), guide arrow (`suggestion`), apprentice AI (`_feeder`, `_painter`). |
| `src/props.gd` | Loads Poly Haven models (`Props.place(parent, id, pos, yaw, width)` stands it on the floor, metas `height`/`size`), textured PBR materials (`Props.textured`), realistic wooden parts/toys (`Props.item`). |
| `src/hud.gd` | Joystick, action button + context chips, coins/level/day clock, order cards, hints, intro/day/summary/shop pop-ups, confetti. |
| `src/icons.gd` | Renders 3D models into UI icons. `src/meshes.gd`: rounded-box mesh helpers (old v1 models inside are unused). |
| `src/sfx.gd` + `tools/make_sounds.py` | Sounds/music (generated WAVs) and vibration. |
| `src/main.gd` | Starts everything; screenshot hooks (`-- shot=out.png wait=3 act=start,demo,near,work,zoom,dayover,shop`). |
| `tests/run_tests.gd` | 16 headless checks of stations/recipes/pay (CI runs them). `tests/char_test.tscn`: character preview. |

## Assets (all CC0)
- `assets/models/<id>/` + `assets/textures/<id>/` + `assets/hdris/`: **Poly Haven**, fetched by the
  GitHub workflow `.github/workflows/fetch-toyworks-assets.yml` (`tools/fetch_assets.py`). To add
  more: put ids in `assets/wanted.json` and push; the workflow downloads and commits them (pull
  afterwards). Catalogs of everything available: `assets/catalog_{models,textures,hdris}.json`.
  The dev sandbox can't reach polyhaven.com, GitHub Actions can.
- `assets/people/`: Quaternius Universal Base Characters + Modular Outfits (peasant) + Universal
  Animation Library 1+2, taken from the GitHub mirror `Dallolz/moorfall-assets` (glb) and hair
  textures from `NafisRayan/Animate-Rigged-Humanoid-No-Blender`.

## Build, test, release
- Local: Godot 4.6.2 Linux binary (download from godotengine GitHub releases). `godot --headless --path toy-workshop --import`,
  then `godot --headless --path toy-workshop --script res://tests/run_tests.gd`.
  Screenshots: `xvfb-run godot --path toy-workshop --audio-driver Dummy --resolution 1280x720 -- shot=/tmp/a.png wait=3 act=start,demo`.
  `--check-only` reports "Game not found" for scripts using autoloads; that's expected.
  A GDScript parse error makes headless runs **hang silently**; use `--check-only --script res://file.gd` to find it.
- CI: `.github/workflows/build-toyworks.yml` (container `barichello/godot-ci:4.6.2`, HOME=/root,
  writes editor settings, ETC2/ASTC must stay enabled in project.godot) exports a debug APK and
  publishes release `tiny-toyworks-v0.1.<run>` → https://github.com/nitaysc/fewewfefw/releases

## State when this was written / next steps
Version 2 runs (screenshot looked good: realistic room, characters, joystick, orders). To do next:
1. Floor looks too orange/bright: lower `wood_floor_worn` tint and the sun energy; check exposure.
2. Camera is a bit high/top-down: try offset (0, 5.2, 5.6), fov 45, and let pinch zoom set `zoom`.
3. Hanging lamps hang low and block the view of the back stations; raise to y≈2.6 or remove.
4. Carried items may be hidden inside the body; move `carry_node` forward (z≈0.42) or attach to hand bones.
5. Items on stations are small at this zoom; scale `Props.item` ×1.3.
6. Run a full play-through in the screenshot harness (walk, take, saw, assemble, ship) and check the
   apprentices' paths around the bench (they slide along collisions; no navmesh yet).
7. Push → check the APK build, then share the release link with the owner.
Old v1 (conveyor-belt factory) code was replaced; its art helpers live on in `meshes.gd`.
