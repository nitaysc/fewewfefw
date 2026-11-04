# Advanced Third Person Controller (Android build)

NeonfireStudio's [Godot Advanced Third Person Controller](https://github.com/NeonfireStudio/godot-advanced-third-person-controller)
(MIT, see `LICENSE`), packaged as an Android APK with on-screen touch controls.

## Download

Every push to `third-person-controller/` builds a new APK. Get it from the repo's
Releases page: the newest `third-person-v1.0.<n>` release, file `third-person-controller.apk`.

## Touch controls

| Where | What |
| --- | --- |
| Left half of the screen | Floating joystick: put your thumb down anywhere and drag to walk |
| Right half (not on a button) | Drag to turn the camera |
| JUMP | Jump (big button, bottom right) |
| PUNCH | Melee attack combo |
| ROLL / SLIDE | Roll or slide in the direction you're moving |
| CROUCH | Toggle crouch |
| GRAB | Pick up the Godot plush when you're next to it |
| AIM | Hold to strafe and zoom the view |
| RUN | Toggle sprinting on and off (it turns blue while on) |
| EMOTE | Opens four emote buttons (Yes, No, Wave, Wave 2) |
| + / − | Camera zoom |
| MENU or the Android back button | Back to the main menu (back on the menu quits) |

Keyboard and mouse still work as in the original. To try the touch layout on a PC,
run the project with `-- --touch`.

## What was changed from upstream

- `game/Mobile/touch_controls.gd` (new): multi-touch joystick, look area and buttons, drawn
  in code. It presses the same input actions the keyboard uses.
- `game/Player/player.gd`: adds the touch controls on phones, doesn't capture the mouse there,
  ignores Android's fake mouse motion, and has `touch_look()` for the camera.
- `game/Global.gd`: `touch_mode()`, `back_to_menu()` and the Android back button.
- `game/World/world.gd`: hides the keyboard help text on phones.
- `game/project.godot`: lower stick deadzone on the four move actions, landscape orientation,
  ETC2/ASTC textures for Android, back button doesn't quit straight away.
- The 57 MB `Godette_Model.fbx` (Git LFS, not used by any scene) is left out.

## Build locally

Needs Godot 4.3 with export templates, an Android SDK with build-tools, and Java 17+:

```sh
GODOT=/path/to/Godot_v4.3-stable_linux.x86_64 ANDROID_HOME=/path/to/sdk ./build-apk.sh
```

The committed `debug.keystore` keeps the signature stable so new builds install over old ones.
