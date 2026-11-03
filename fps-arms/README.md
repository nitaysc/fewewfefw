# FPS Arms (mobile test build)

A first-person shooting range, based on GDQuest's
[godot-4-FPS-arms](https://github.com/gdquest-demos/godot-4-FPS-arms) demo (Godot 4.3),
with on-screen touch controls added so it can be played on an Android phone.
This is the starting point for a multiplayer shooter.

## Download

Every push to `fps-arms/` builds a new APK (`.github/workflows/build-fps-arms.yml`).
Get it from the repo's Releases page: the `fps-arms-v0.1.<run number>` release, file `fps-arms.apk`.

## Touch controls (`ui/touch_controls/touch_controls.gd`)

Loaded as the `TouchControls` autoload; only turns on for touchscreens
(or on desktop with `-- --touch` on the command line).

- **Left side**: move stick. It appears wherever your thumb lands.
- **Right side**: drag to look around.
- **FIRE**: hold to shoot. You can drag on it to aim while shooting.
- **JUMP** and **CROUCH** (crouch toggles).

Keyboard, mouse and gamepad still work as in the original demo.

## Changes from the original demo

- `ui/touch_controls/` added and registered as an autoload.
- `fps_arms/fps_controller.gd`: no mouse capture on touch devices; reads touch look input.
- `project.godot`: landscape orientation, UI scales with screen size (`canvas_items` stretch),
  mouse emulation from touch turned off, ETC2/ASTC texture compression for Android.
- `export_presets.cfg` (Android, arm64), `build_apk.sh`, and a committed test keystore in
  `keys/` so each new build installs over the last one.

## Build locally

```sh
GODOT=/path/to/Godot_v4.3-stable_linux.x86_64 ANDROID_HOME=/path/to/android-sdk ./build_apk.sh
```
Needs the Godot 4.3 export templates installed. The output is `build/fps-arms.apk`.

## License

Code: MIT. Art: CC-BY-NC-SA 4.0 (GDQuest). See `LICENSE`. The art is non-commercial only.
