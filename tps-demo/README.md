# Godot TPS Demo (Android build)

The [Godot third-person shooter demo](https://github.com/study-game-engines/godot-tps-demo)
(a mirror of godotengine/tps-demo; code MIT, art and music CC-BY 3.0 by Juan Linietsky,
Fernando Miguel Calabró and Christian Fernando Perucchi), packaged as an Android APK
with on-screen touch controls.

The demo is about 400 MB, so it is not copied into this repo. `prepare.sh` fetches it at
the commit in `UPSTREAM` into `game/` (ignored by git), copies in `overlay/` and applies
`patches/mobile.patch`.

## Download

Every push to `tps-demo/` builds a new APK: Releases page, newest `tps-demo-v1.0.<n>`,
file `tps-demo.apk`.

## Touch controls

| Where | What |
| --- | --- |
| Left part of the screen | Floating joystick: put your thumb down anywhere and drag to walk/run |
| Anywhere else (not a button) | Drag to turn the camera |
| SHOOT | Starts aiming and fires while held; you can also drag on it to steer while shooting |
| AIM | Tap to toggle aiming, or hold to aim and let go to stop (same as the original) |
| JUMP | Jump |
| MENU or Android back | Back to the main menu (back on the menu quits) |

On phones the game starts with lighter graphics (no GI probe, no MSAA/FXAA/SSAO, low
bloom, 720p). The Settings menu can turn them back up.

## Changes from upstream

- `overlay/mobile/touch_controls.gd`: multi-touch joystick, look area and buttons.
- `overlay/export_presets.cfg`: Android export (arm64, debug-signed).
- `patches/mobile.patch`: the player adds the touch controls on phones and ignores
  Android's fake mouse motion; phone graphics defaults and back button in `settings.gd`;
  ETC2 textures and landscape orientation in `project.godot`.

To change the patch: run `./prepare.sh`, edit files in `game/`, then
`git -C game diff -- . ':!mobile' ':!export_presets.cfg' > patches/mobile.patch`.

## Build locally

```sh
GODOT=/path/to/Godot_v3.5.3-stable_linux_headless.64 ANDROID_HOME=/path/to/sdk ./build-apk.sh
```

The first import takes a while. To try the touch layout on a PC: `godot --path game -- --touch`.
