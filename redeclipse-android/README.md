# Red Eclipse 2 for Android (unofficial port)

An unofficial Android port of [Red Eclipse 2](https://redeclipse.net), the free
arena shooter, built from the official 2.0.0 source and game data. It is not
affiliated with or endorsed by the Red Eclipse project.

## What the port changes

`patches/redeclipse-android.patch` is applied to Red Eclipse 2.0.0:

- **OpenGL ES 3** — the renderer targets desktop OpenGL. On ES the engine keeps its
  desktop logic and translates at the GL boundary (`src/shared/glescompat.*`):
  rectangle textures become 2D textures whose pixel coordinates the shader header
  rescales, desktop-only calls get small shims, and texture formats are mapped to
  the exact format/type pairs ES requires.
- **Shaders** — a `#version 3x0 es` header with precision qualifiers, dual-source
  blending through `GL_EXT_blend_func_extended` when present, and a few literals
  fixed for GLSL ES's stricter typing.
- **Touch controls** (`src/engine/touch.cpp`) — in menus a finger is the mouse;
  in play the left side is a floating movement stick, the rest of the screen turns
  the view, and on-screen buttons press the same keys a keyboard would (fire, alt
  fire, jump, crouch, melee, reload, weapon switch, use, scores, menu). The Android
  back button acts as Escape.
- **Android** — the engine starts in the unpacked game folder; caps/num lock come
  from SDL instead of X11; a zero refresh rate no longer divides by zero.

The Android app (`android/`) unpacks the game data on first launch and runs the
engine through SDL2.

## Building

`scripts/prepare.sh` fetches Red Eclipse 2.0.0 (with its data), SDL2, SDL2_image
and SDL2_mixer, applies the patch and packs the data; then build with
`cd android && ./gradlew assembleDebug`. The GitHub workflow does both and
publishes `redeclipse-android-vN` releases.

## Licenses

The engine is under the zlib license, game content under Creative Commons
licenses (mostly CC-BY-SA) — see `doc/license.txt` and `doc/all-licenses.txt`,
which ship inside the APK. "Red Eclipse" is used under the project's mark
policy to refer to the game in substantially unmodified form.
