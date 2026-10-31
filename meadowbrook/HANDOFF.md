# Meadowbrook: handoff (read this first)

Owner: wants a **real Android game** (native Godot, not a web page), **realistic** look, smooth
animation, things that feel physical, and a **fun** game. History: whiskers-coffee (web, rejected),
Tiny Toyworks (toy factory, then a hands-on toymaker; owner asked for something more fun) →
now **Meadowbrook, a realistic farm & village life game**, keeping the characters and animations.
Branch `claude/coffee-game-continue-i9dl5k`. No PRs unless asked. Commits end with the
Co-Authored-By / Claude-Session lines the session gives; no model names in commits.

## The game
You're a farmer (realistic Quaternius character) on a farm with a farmhouse sky (HDRI).
Floating joystick (left half of the screen) + one big action button (bottom right; tap or hold).
- Soil plots in fields of 3×3: **Hold: Dig** (grass → soil) → **Plant** (uses the chosen seed) →
  **Hold: Water** (needs water in the can) → grows (only when watered) → **Hold: Harvest** → you carry
  a basket (up to 9 pieces) → **Sell** at the shipping crate.
- Water barrel: fill the can. Seed stand: buy 3 seeds (seed chips appear at the stand and next to
  empty soil). Apple/pear trees: pick fruit (regrows). Trees: chop for wood (stump regrows).
- "For sale" sign: open the next field (coins + wood). Day/night cycle (4 min day), lamps at night.
- Shop (top right): bigger can, boots, sharp axe, Farmhand Rosa (waters + harvests + sells on her
  own = the automation), compost (faster growth), sprinklers (no watering). Levels unlock crops.
- Crops: onions, sweet potatoes, gazanias, ursinias (flowers sell for more).

## Files (`meadowbrook/`)
| File | What |
| --- | --- |
| `src/data.gd` | Crops, fruit, work times, fields, upgrades, xp curve. |
| `src/game.gd` | Autoload `Game`: coins, xp/level, day + clock, seeds, water, wood, fields, upgrades, plot states, save (`user://meadowbrook.json`). |
| `src/spot.gd` | `Spot`: a usable thing (plot, well, crate, stand, tree, fruit, sign). `action()` says what the button does, `finish()` applies it, `tick()` grows crops / regrows trees. Pure logic, tested. |
| `src/farm.gd` | The world (ground, paths, sky, sun/day-night, props, nature scatter, fields, plot visuals), camera, input (`press/release/action_info/work_progress`), effects, the farmhand AI. |
| `src/worker.gd` | You and helpers: walking/carrying/working animations (`WORK_ANIM`), basket held between the **hand bones** (`_hold_in_hands`). |
| `src/toymaker.gd` | Builds a person (base body + peasant outfit + hair/beard, body trimmed under clothes) and the animation library. Godot drops `_Loop` from names: `Idle`, `Walk`, `Jog_Fwd`, `Walk_Carry`, `Farm_PlantSeed`, `Farm_Watering`, `Farm_Harvest`, `TreeChopping`, `Interact`, `Dance`, `Yes`... |
| `src/props.gd` | Poly Haven models (`Props.place(parent, id, pos, yaw, width)`; many models are **sets/rows**, check sizes), PBR materials (`Props.textured`), `produce()`, `basket()`. |
| `src/hud.gd` | Joystick, action button + seed chips, coins/level/clock/inventory, hints, floating texts, intro, level-up, shop. |
| `src/icons.gd`, `src/meshes.gd`, `src/sfx.gd` | UI icons from 3D models, rounded-box helpers, sounds (made by `tools/make_sounds.py`). |
| `src/main.gd` | Startup + screenshot hooks (`-- shot=out.png wait=4 act=start,demo,dig,night,shop`). |
| `tests/run_tests.gd` | 12 headless checks of farming logic (CI runs them). |

## Assets (all CC0)
- Poly Haven models/textures/HDRI in `assets/`, fetched by `.github/workflows/fetch-meadowbrook-assets.yml`
  (`tools/fetch_assets.py`): list ids in `assets/wanted.json` and push; the workflow downloads them and
  commits; then pull. The sandbox can't reach polyhaven.com; GitHub Actions can. **Heavy scans (trees are
  60–95 MB) are simplified in that workflow with gltfpack** via the `simplify` map in wanted.json
  (running downloaded binaries locally is blocked, so it's done in CI). Catalogs: `assets/catalog_*.json`.
- People: Quaternius Universal Base Characters + Modular Outfits + Universal Animation Library
  (from GitHub mirror `Dallolz/moorfall-assets`), hair textures from `NafisRayan/Animate-Rigged-Humanoid-No-Blender`.

## Build, test, release
- Godot 4.6.2 Linux binary. `godot --headless --path meadowbrook --import`, then
  `godot --headless --path meadowbrook --script res://tests/run_tests.gd`.
  Screenshots: `xvfb-run godot --path meadowbrook --audio-driver Dummy --resolution 1280x720 -- shot=/tmp/a.png wait=4 act=start,demo`.
  A GDScript parse error makes headless runs hang silently: `--check-only --script res://file.gd` finds it
  ("Game not found" in check-only is normal for autoload users).
- CI `.github/workflows/build-meadowbrook.yml` (container `barichello/godot-ci:4.6.2`, HOME=/root,
  ETC2/ASTC enabled) exports a debug APK as release `meadowbrook-v0.1.<run>`.

## Next steps
1. Confirm the simplify workflow replaced the big tree files (check `assets/models/*/.simplified`) and
   that the APK size is reasonable (<150 MB); drop more unused models if not.
2. Play-test the full loop in the screenshot harness (dig → plant → fill can → water → wait → harvest → sell).
3. Ideas the owner may like: animals (chickens/eggs), villagers with requests, a market day, house
   decoration, seasons, fishing. Keep everything realistic and animated; avoid code-drawn art.
