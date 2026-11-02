# Strikeline: stick brawl

A native Android platform fighter built with **Godot 4.4** (not a web wrapper). Four
stickman fighters, three stages, CPU opponents and touch controls. Knock rivals off the
stage: the more damage they've taken, the further they fly.

## Download

Every push that touches `strikeline/` builds a signed APK. Grab `strikeline.apk` from the
newest `strikeline-v1.2.N` release on the repo's Releases page.

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
- **Smash systems**: grabs (shield + attack), pummels and four throws with mash-out,
  the **Strike Core** (break it to unlock a cinematic **Final Smash** per fighter), items
  (throwable bombs, healing food), parry, ledge and get-up attacks, star KOs, timed matches
  with scoring and sudden death, entrance animations, a training combo counter, and a
  moving platform on Sunset Shrine.
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

## Online play (`scripts/net.gd`, `scripts/netsync.gd`, `scripts/online.gd`)

- **Online rooms**: peer-to-peer WebRTC through the official Godot `webrtc-native`
  GDExtension (`addons/webrtc`, fetched by `tools/get_webrtc.sh`; Android arm64 only, so
  online rooms need a 64-bit phone). The free public PeerJS server (`0.peerjs.com`) does the
  signalling, as in the café game. Room codes are 4 characters. Google/Twilio STUN, no TURN:
  some strict mobile networks may not connect; Wi-Fi rooms are the fallback.
- **Wi-Fi rooms**: ENet on port 47821. The 8-character code (`W` + 7) encodes the host's LAN
  address, and hosts broadcast on UDP 47822 so nearby rooms appear on the join keypad.
- Up to 4 players; the host can fill empty slots with CPUs and picks stage, rules and items.
- **Netcode**: host-authoritative. Guests send their stick and button state every frame
  (button presses as counters, so a dropped packet never loses a press). The host sends a
  full snapshot every frame (unreliable-ordered) and a reliable stream of effect and sound
  events. Guests play snapshots through a small jitter buffer and rebuild trails, scarves and
  afterimages locally. Guest input lag is the round trip to the host.
- Leaving: a guest who leaves becomes a CPU; if the host leaves, guests are told and return
  to the online menu. Online matches don't pause.
- Tests: `test/net_test.tscn` runs a host and a guest as two processes (`lan`, or `online`
  with `--peer=127.0.0.1:9000` against a local `peer` server from npm).

## Controls

Left half: floating stick. Right: ATTACK, SPECIAL, JUMP, SHIELD. Flick the stick + ATTACK
for a smash attack (hold to charge). Keyboard for desktop testing: WASD/arrows, J attack,
K special, Space jump, L shield, Shift = smash.

## Develop

```sh
godot --headless --import
godot --headless --fixed-fps 60 res://test/touch_test.tscn   # touch controls
godot --headless --fixed-fps 60 res://test/sim.tscn          # CPU matches on every stage
godot --headless --fixed-fps 60 res://test/time_test.tscn    # timed match -> sudden death
# screenshots (needs xvfb): res://test/shots.tscn, fx_shots.tscn, fx2.tscn, sheet.tscn, closeup.tscn
```

Export: `export_presets.cfg` (preset "Android"), signed with the committed
`android/strikeline.keystore` (password `strikeline`) so updates install over each other.
The workflow is `.github/workflows/build-strikeline.yml`.
