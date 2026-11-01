# Strikeline: stick brawl

A native Android platform fighter built with **Godot 4.4** (not a web wrapper). Four
stickman fighters, three stages, CPU opponents and touch controls. Knock rivals off the
stage: the more damage they've taken, the further they fly.

## Download

Every push that touches `strikeline/` builds a signed APK. Grab `strikeline.apk` from the
newest `strikeline-v1.0.N` release on the repo's Releases page.

## The game

- **Fighters** (`scripts/roster.gd`): Kai (sword, counter), Bruno (heavy fists, armor
  rush, ground pound), Nyx (fast, triple jump, kunai, teleport), Sol (staff, charged
  orbs, jet recovery). Each has jab combo, tilts, a dash attack, chargeable smash
  attacks, five aerials and four specials.
- **Mechanics** (`scripts/fighter.gd`, `scripts/match.gd`): damage %, knockback that
  scales with damage and weight, hitlag, hitstun and tumble, DI-lite drift, shields
  (shield break → dizzy), rolls, spot and air dodges, ledge grabs with intangibility,
  techs, fast fall, drop-through platforms, helpless state after recoveries, blast-zone
  KOs, stocks, respawn platform.
- **Animation**: every fighter is a procedural skeleton (`scripts/rig.gd`). Attacks are
  keyframed poses with easing; running, idling, jumping, flips, tumbling and ledge hangs
  are procedural. Weapon smears, verlet scarves, afterimages and hit-flash on top.
- **Feel**: per-hit hitlag and victim shake, camera shake and zoom punch, impact stars,
  sparks, shockwave rings, launch smoke trails, KO light beams, slow-mo on the last KO,
  haptics on hits.
- **CPU** (`scripts/ai.gd`): easy/normal/hard; spacing, shielding, smash at kill %,
  aerials by position, edge-guarding, ledge options and recovery with each special.
- **Audio** (`tools/make_audio.py`): every sound effect and both music loops are
  synthesized with numpy (`python3 tools/make_audio.py` regenerates `sfx/`).

## Controls

Left half: floating stick. Right: ATTACK, SPECIAL, JUMP, SHIELD. Flick the stick + ATTACK
for a smash attack (hold to charge). Keyboard for desktop testing: WASD/arrows, J attack,
K special, Space jump, L shield, Shift = smash.

## Develop

```sh
godot --headless --import
godot --headless --fixed-fps 60 res://test/touch_test.tscn   # touch controls
godot --headless --fixed-fps 60 res://test/sim.tscn          # CPU matches on every stage
# screenshots (needs xvfb): res://test/shots.tscn, res://test/fx_shots.tscn, res://test/sheet.tscn
```

Export: `export_presets.cfg` (preset "Android"), signed with the committed
`android/strikeline.keystore` (password `strikeline`) so updates install over each other.
The workflow is `.github/workflows/build-strikeline.yml`.
