# Tiny Toyworks: handoff notes

A cozy toy-factory game made in **Godot 4.6** (GL Compatibility renderer, so it runs on any
Android phone). Lay conveyor belts between machines that saw, turn, paint and assemble wooden
toys; the shipping box sends them to fill orders; coins and levels unlock new toys and machines.

## Layout
| File | What |
| --- | --- |
| `src/data.gd` | All content: parts, toys (recipes, value, unlock level), machines (cost, timing, modes), colours. |
| `src/sim.gd` | The factory as pure logic (belts, machine buffers, jobs, shipping). No graphics; tested headless. |
| `src/game.gd` | Autoload `Game`: coins, xp/level, orders, buying, saving (`user://toyworks.json`). Steps the sim at 60 Hz. |
| `src/meshes.gd` | Every 3D model, built from soft rounded shapes (`rbox` = rounded box). Machines face +x. |
| `src/world.gd` | The room, lights, camera, drawing the sim, touch input (pan, pinch, tap, build, remove), effects. Shaders at the bottom. |
| `src/hud.gd` | All interface: coins, level, orders, build drawer, machine settings, level-up, intro. |
| `src/icons.gd` | Renders 3D models into UI icons in a hidden viewport. |
| `src/sfx.gd` | Autoload `Sfx`: sounds, music, vibration. Sounds are made by `tools/make_sounds.py`. |
| `tests/run_tests.gd` | Headless checks of the factory logic (run in CI before every build). |

## Running and testing
- Godot 4.6.2. `godot --headless --path toy-workshop --import`, then
  `godot --headless --path toy-workshop --script res://tests/run_tests.gd`.
- Screenshots without a phone: `xvfb-run godot --path toy-workshop --audio-driver Dummy -- shot=out.png wait=4 skip act=select`
  (`act`: select, drawer, build, level, rich; see `src/main.gd`).
- `godot --check-only --script` reports "Game not found" for scripts that use autoloads; that's expected.
- The APK builds on every push touching `toy-workshop/` (`.github/workflows/build-toyworks.yml`) and is published as
  release `tiny-toyworks-v0.1.<run>`.

## Adding content
- New toy: add to `Data.TOYS` (+ `TOY_ORDER`) and a model branch in `Meshes.item()`.
- New machine: `Data.MACHINES` (+ `SHOP_ORDER`), a branch in `Meshes.machine()`, animation in `world._animate_machine()`,
  and settings in `hud._fill_sel()` if it has options.

## Owner preferences
- Wants a real game feel (not a web page), premium "studio" look, smooth animation, things that react (squash, bounce,
  particles, sounds, vibration). Keep the art 3D-modelled and consistent; no flat code-drawn sprites.
