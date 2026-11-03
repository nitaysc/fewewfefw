# Godot 4.x Mobile Touch Controls for FPS + Fully Cloud (GitHub Actions) Android Build Pipeline

Research date: 2026-11-03. Note: GitHub API access was blocked in this session, so star counts and dates come from rendered GitHub pages / Asset Library / Docker Hub fetched via WebFetch. Exact last-commit dates for most GitHub repos were NOT visible and are marked as gaps.

Context on current versions: the Godot "stable" docs now show **Godot 4.7** ([Exporting for Android docs](https://docs.godotengine.org/en/stable/tutorials/export/exporting_for_android.html)). The barichello/godot-ci Docker Hub image has tags up to **4.7.2** (pushed 2026-08-18), plus 4.7.1, 4.7, 4.6.3, 4.6.2, 4.6.1 and 4.5.2, and `latest`/`mono-latest` ([Docker Hub tag API](https://hub.docker.com/v2/repositories/barichello/godot-ci/tags?page_size=15&ordering=last_updated)). So 4.7.2 is the latest stable patch found.

## Q1: Touch-control addons for Godot 4 suitable for a mobile FPS

### Takeaway
The standard choice is **MarcoFazioRandom/Virtual-Joystick-Godot**: MIT, about 990 stars, Godot 4.2+, with fixed, dynamic and following modes. It covers the move stick. Pair it with your own right-half-screen `InputEventScreenDrag` look area (or Godot Touch Input Manager for gestures) and the built-in `TouchScreenButton` for fire, jump and reload. No widely used, maintained "mobile FPS controller kit" for Godot 4 was found.

### Cited Findings
**Virtual Joystick (MarcoFazioRandom)**: https://github.com/MarcoFazioRandom/Virtual-Joystick-Godot
- Stats: about 990 stars, MIT license, 122 commits. The badge says Godot 4.2+. An `Input.get_vector()` bug was fixed in Godot 4.2.1, and older versions need a workaround. — [GitHub repo](https://github.com/MarcoFazioRandom/Virtual-Joystick-Godot)
- Features — [GitHub repo](https://github.com/MarcoFazioRandom/Virtual-Joystick-Godot):
  - Joystick modes: Fixed, Dynamic (floating; appears where you touch), and Following.
  - Visibility modes: Always, Touchscreen Only, and When Touched.
  - Can fire the input actions defined in Project Settings (for example, map to move_left/right/forward/back).
  - Configurable dead zone and clamp zone.
- Multitouch setup from the FAQ: set "Emulate Touch from Mouse" to ON and "Emulate Mouse from Touch" to OFF. If other buttons stop working, use `TouchScreenButton` instead of `TextureButton`. The FAQ also warns that the Godot Android editor is unstable. — [GitHub repo](https://github.com/MarcoFazioRandom/Virtual-Joystick-Godot)
- The README does not mention FPS or first-person use. A look area is not included. — [GitHub repo](https://github.com/MarcoFazioRandom/Virtual-Joystick-Godot)

**Godot Touch Input Manager (GDTIM, Federico-Ciuffardi)**: https://github.com/Federico-Ciuffardi/GodotTouchInputManager
- Stats: MIT license, about 596 stars, 98 commits. Tagged `godot3` and `godot4`, but only a `master` branch is visible. — [GitHub repo](https://github.com/Federico-Ciuffardi/GodotTouchInputManager)
- Gestures — [GitHub repo](https://github.com/Federico-Ciuffardi/GodotTouchInputManager):
  - Single finger: touch, tap, long press, drag, swipe.
  - Multi-finger: tap, long press, drag, swipe.
  - Pinch, twist, and a raw gesture state.
- Each gesture is emitted as a custom InputEvent that arrives in `_input()`, and also as a per-gesture signal. — [GitHub repo](https://github.com/Federico-Ciuffardi/GodotTouchInputManager)
- It also translates mouse input to touch input. — [search summary of asset listing](https://godotengine.org/asset-library/asset/edit/3370) (uncertain: this is a search-snippet attribution)

**Godot Asset Library results for "joystick" (Godot 4.0 filter)**: https://godotengine.org/asset-library/asset?filter=joystick&godot_version=4.0

All four results are MIT licensed ([Asset Library search](https://godotengine.org/asset-library/asset?filter=joystick&godot_version=4.0)):

| Asset | Author | Version | Last updated | URL |
|---|---|---|---|---|
| Basic Joystick Plugin | bald55 | 1.0 | 2025-10-07 | https://godotengine.org/asset-library/asset/4389 |
| Virtual Joystick | "Marcial Lincoln" | 3.0.1 | 2025-03-01 | https://godotengine.org/asset-library/asset/1718 |
| Godot_multidirectional_joystick for Godot 4 | jstnjrg | 1.0 | 2024-05-20 | https://godotengine.org/asset-library/asset/2996 |
| godot-joystick | apock | 0.2 | 2023-03-15 | https://godotengine.org/asset-library/asset/1716 |

Asset 1718 is likely the Asset Library listing of the MarcoFazioRandom joystick, but this is unverified.

**Look-drag implementation pattern (no dedicated addon found)**
- Recommended pattern ([community skill page](https://claudeskills.info/skills/thedivergentai/gd-agentic-skills/godot-adapt-desktop-to-mobile/), low-authority source):
  - Replace mouse-motion look with `InputEventScreenDrag`.
  - Check `InputEventScreenTouch.pressed`.
  - Track `event.index` per finger so the move stick and look area don't conflict.
  - Size touch targets for fingers, and keep critical HUD info above the controls.
- A dynamic left-half joystick pattern records the `touch_id` and clamps the knob radius. — [Codepal](https://codepal.ai/chat/query/evNZz1Ry/unknown) (appears AI-generated; low reliability)

**Built-in TouchScreenButton**
- Recommended by the Virtual Joystick FAQ for multitouch-safe buttons. — [GitHub repo](https://github.com/MarcoFazioRandom/Virtual-Joystick-Godot)

### Inferences
- A practical FPS control layout:
  - Left side: MarcoFazioRandom joystick in Dynamic mode, mapped to move actions.
  - Right side: a full-height `Control` or a custom `_input` handler that turns `InputEventScreenDrag.relative` into camera yaw/pitch, filtered by finger index.
  - Buttons: `TouchScreenButton` nodes for fire, aim, jump, reload and crouch.
  - Settings: keep "Emulate Mouse from Touch" OFF so drag deltas aren't duplicated as mouse motion.
- All the candidate addons are MIT, so there are no licensing constraints for commercial use.

### Gaps
- I could not find a "Mobile FPS controls" addon or a maintained Godot 4 mobile FPS controller kit with both joystick and look built in. Searches surfaced only desktop FPS templates.
- Last-commit dates for the MarcoFazioRandom and GDTIM repos were not visible, because the GitHub API was blocked.
- I could not verify whether Godot 4.x has added a built-in virtual joystick node. A low-authority page hinted at one, but it is unconfirmed. Treat it as not existing.

## Q2: Examples of Godot mobile FPS games/templates with touch look + joystick

### Takeaway
I found no prominent open-source Godot 4 mobile FPS template with touch look plus joystick. The nearest options are a third-person touch controller and desktop FPS starters that would need touch input added.

### Cited Findings
- **emagood/third-person-godot-4**: a third-person controller with touchscreen support for Godot 4, MIT. — [ecosyste.ms](https://awesome.ecosyste.ms/projects/github.com%2Femagood%2Fthird-person-godot-4)
- **Whimfoome/godot-FirstPersonStarter**: a Godot 4 first-person controller template, desktop only with no touch support. — [ecosyste.ms](https://awesome.ecosyste.ms/projects/github.com%2FWhimfoome%2Fgodot-FirstPersonStarter)
- **Horror FPS Controller Template (Godot 4)**: WASD movement and mouse look, no touch input. — [itch.io](https://famoustache.itch.io/horror-fps-controller-template-godot-4)
- **BeanFPS**: a simple FPS made with the Godot 4 Android editor, still in development. I could not confirm that its source is public. — [itch.io](https://shahriarlabib000.itch.io/beanfps)

### Inferences
- Expect to combine a desktop FPS controller with the Virtual Joystick addon and a custom look-drag handler. This is roughly 50–150 lines of GDScript (an estimate, not sourced).

### Gaps
- No verified, popular, open-source Godot 4 mobile FPS with touch controls was found. Reddit and forum threads were not reached in this session.

## Q3: Building Android APKs entirely in GitHub Actions

### Takeaway
This is fully feasible with no PC. Two main routes:
- Run the `barichello/godot-ci:<version>` Docker image as the job container. It ships JDK 17, the Android SDK, a debug keystore, and editor settings that point at the SDK.
- Download Godot and export templates yourself, or use `firebelley/godot-export` or `chickensoft-games/setup-godot` together with `android-actions/setup-android`.

Either way, run `godot --headless --export-debug "Android" build/game.apk`. A debug APK needs only a debug keystore, which can be generated in CI. Godot is MIT, with no license activation needed (unlike Unity).

### Cited Findings
**Official command line** — [Godot command line docs](https://docs.godotengine.org/en/stable/tutorials/editor/command_line_tutorial.html)
- `--headless` equals `--display-driver headless --audio-driver Dummy`. It is required on machines without a GPU, such as CI runners.
- `--export-release <preset> <path>` and `--export-debug <preset> <path>`:
  - The preset name must match `export_presets.cfg`.
  - The path must include the filename, and the target directory must already exist.
  - Relative paths resolve from the folder that contains `project.godot`.
  - Only editor builds can export.
- `--export-debug` implies `--import`. `--export-pack` exports a PCK or ZIP.
- `--install-android-build-template` installs the Gradle Android build template, for use together with an export flag.
- Export templates must be installed for the editor, or a custom template must be set in the preset.
- Unknown arguments are silently ignored, so typos fail silently.

**Official Android requirements (stable docs = 4.7)** — [Exporting for Android](https://docs.godotengine.org/en/stable/tutorials/export/exporting_for_android.html)
- JDK: OpenJDK 17 is recommended. Higher versions are supported.
- Android SDK:
  - Platform-Tools 35.0.0 or later
  - Build-Tools 35.0.1
  - Platform android-35
  - cmdline-tools latest
  - CMake 3.10.2.4988404
  - NDK r28b (28.1.13356709)
- Don't use a distro-packaged SDK.
- Release keystore command: `keytool -v -genkey -keystore mygame.keystore -alias mygame -keyalg RSA -validity 10000`
- Environment variables that override the preset at export time:
  - `GODOT_ANDROID_KEYSTORE_DEBUG_PATH`, `GODOT_ANDROID_KEYSTORE_DEBUG_USER`, `GODOT_ANDROID_KEYSTORE_DEBUG_PASSWORD`
  - `GODOT_ANDROID_KEYSTORE_RELEASE_PATH`, `GODOT_ANDROID_KEYSTORE_RELEASE_USER`, `GODOT_ANDROID_KEYSTORE_RELEASE_PASSWORD`
  - `GODOT_SCRIPT_ENCRYPTION_KEY`
- Google Play:
  - Requires AAB since August 2021, and AAB requires a Gradle build.
  - Uploads need a non-debug keystore, with "Export With Debug" unchecked.
  - The keystore password and key password must be the same.
  - Special characters in passwords can cause errors.
- C# on Android has been experimental since 4.2.

**Gradle build vs prebuilt template** — [Android Gradle build docs](https://docs.godotengine.org/en/stable/tutorials/export/android_gradle_build.html)
- Gradle is needed to export an AAB, to modify the Android project, or to add external SDKs.
- The project is created at `res://android/build`, and "Gradle Build" must be enabled in the export preset.
- With Gradle, folders starting with `_` are excluded from the APK.

**Gradle build vs prebuilt template** — [Exporting for Android](https://docs.godotengine.org/en/stable/tutorials/export/exporting_for_android.html)
- A plain APK can use the prebuilt template with no Gradle step.

**barichello/godot-ci Docker image**: https://github.com/abarichello/godot-ci, Docker Hub https://hub.docker.com/r/barichello/godot-ci
- About 1.2k stars, MIT. — [GitHub](https://github.com/abarichello/godot-ci)
- Tags track Godot releases through 4.7.2 (2026-08-18), including mono variants. — [Docker Hub API](https://hub.docker.com/v2/repositories/barichello/godot-ci/tags?page_size=15&ordering=last_updated)
- What the image contains, per the master Dockerfile ([Dockerfile](https://raw.githubusercontent.com/abarichello/godot-ci/master/Dockerfile)):
  - Base `ubuntu:noble`, default `GODOT_VERSION=4.5` (versions are build args), and `openjdk-17-jdk-headless`.
  - Android SDK in `/usr/lib/android-sdk`: build-tools 33.0.2, platform android-33, platform-tools, cmdline-tools, CMake 3.22.1, NDK 25.2.9519653.
  - A debug keystore at `/root/debug.keystore` with alias `androiddebugkey` and password `android`.
  - `editor_settings-4.x.tres` with `export/android/android_sdk_path` pre-set.
- **Caveat:** these SDK versions (33, NDK r25) are older than the official 4.7 doc list (35, NDK r28b). Non-Gradle APK export likely works, since it mainly needs build-tools for apksigner. Gradle/AAB builds may need extra `sdkmanager` installs (an inference; verify).
- The repo's example GitHub workflow (`.github/workflows/godot-ci.yml`) uses `barichello/godot-ci:4.3` and only has Windows, Linux, Web and Mac jobs, with no Android job. — [workflow file](https://raw.githubusercontent.com/abarichello/godot-ci/master/.github/workflows/godot-ci.yml)
- The Android examples are in `.gitlab-ci.yml` ([.gitlab-ci.yml](https://raw.githubusercontent.com/abarichello/godot-ci/master/.gitlab-ci.yml)):
  - `android_debug` runs a headless export of the "Android Debug" preset using the bundled debug keystore, with no secrets.
  - `android` (release) base64-decodes `SECRET_RELEASE_KEYSTORE_BASE64`, uses `sed` to write the path, alias and password into `export_presets.cfg`, then exports the "Android" preset.
  - These jobs port to GitHub Actions with `container: image: barichello/godot-ci:4.x`.
- Keystore secret creation: `base64 release.keystore -w 0`. — [GitHub README](https://github.com/abarichello/godot-ci)

**firebelley/godot-export**: https://github.com/firebelley/godot-export
- About 653 stars, MIT. The examples pin `@v8.0.0` with Godot 4.0 URLs, and Godot 3 is supported via `use_godot_3`. — [GitHub](https://github.com/firebelley/godot-export)
- Inputs: `godot_executable_download_url` (Linux headless editor), `godot_export_templates_download_url` (.tpz), `relative_project_path`, `archive_output`, `cache`, `use_preset_export_path`. — [GitHub](https://github.com/firebelley/godot-export)
- For Android, run `android-actions/setup-android` first. The bundled editor settings include a default SDK path. Keystore and JDK setup are not documented. — [GitHub](https://github.com/firebelley/godot-export)

**chickensoft-games/setup-godot**: https://github.com/chickensoft-games/setup-godot — [GitHub](https://github.com/chickensoft-games/setup-godot)
- About 189 stars, MIT, used as `@v2`.
- Inputs:
  - `version`: must be the full x.y.z and at least 4.0.0.
  - `use-dotnet`: defaults to **true**, so set it to false for GDScript projects.
  - `include-templates`: defaults to false.
- Caches installs. Runs on Linux, macOS and Windows runners. No Android notes.

**dulvui/godot-android-upload**: https://github.com/dulvui/godot-android-upload
- A GitHub Action that exports Godot 3/4 projects to APK or AAB. It needs an export preset with an Android config plus a credentials file. — [GitHub](https://github.com/dulvui/godot-android-upload) (details not deeply verified)

**Known pitfall:** if the debug keystore environment variables are set, a release export fails with "debug settings must be all configured or none". Don't leak partial debug variables into release jobs. — [godot issue #109551](https://github.com/godotengine/godot/issues/109551)

**Version alignment:** the editor, export templates and JDK must match. Mismatches give greyed-out export options, Gradle errors, or an APK that won't install. — [SummerEngine blog (2026)](https://www.summerengine.com/blog/export-game-android-godot.md) (secondary source)

**Current Google Play requirements**
- Apps targeting Android 15+ must support 16 KB memory pages. Updates were blocked after 2025-11-01 for apps that don't comply. — [Godot forum](https://forum.godotengine.org/t/godot-and-google-play-policy-warning-about-16-kb-memory-page-size/120934)
- Godot added 16 KB page support by updating to NDK r28b (PR #106358, merged May 2025). It also removed the option to compress native libraries, because they must be uncompressed for 16 KB support. — [commit log mirror](https://remotebranch.eu/Stowage/godot/commits/commit/cf7e88f6ac0b5ace42df81a93cce8b51c17df960/platform/android); [godot issue #106313](https://github.com/godotengine/godot/issues/106313)
- The NDK r28b listed in the 4.7 docs matches this change. — [Exporting for Android](https://docs.godotengine.org/en/stable/tutorials/export/exporting_for_android.html)

**License**
- Virtual-Joystick, GDTIM, godot-ci, godot-export and setup-godot are all MIT. — see repos above
- Godot itself is MIT-licensed, with no seat, activation or runtime fees. — [Godot license page](https://godotengine.org/license/) (well-known fact; that page was not re-fetched in this session)

### Inferences
- A minimal GitHub Actions debug-APK job (not tested; assembled from the sources above):
  ```yaml
  jobs:
    android:
      runs-on: ubuntu-latest
      container: { image: barichello/godot-ci:4.7.2 }
      steps:
        - uses: actions/checkout@v4
        - run: |
            mkdir -v -p ~/.local/share/godot/export_templates/
            mv /root/.local/share/godot/export_templates/${GODOT_VERSION}.stable ~/.local/share/godot/export_templates/${GODOT_VERSION}.stable || true
            mkdir -p build/android
            godot --headless --export-debug "Android" build/android/game.apk
        - uses: actions/upload-artifact@v4
          with: { name: apk, path: build/android }
  ```
  - `export_presets.cfg` must be committed with an "Android" preset.
  - The GitHub container `HOME` may differ from `/root`, which is why the godot-ci workflow moves the templates. Verify the paths.
  - The debug keystore can be set via `GODOT_ANDROID_KEYSTORE_DEBUG_*` env vars pointing to `/root/debug.keystore` (alias `androiddebugkey`, password `android`).
- Keystore needs:
  - A debug APK for sideloading can use an auto-generated debug keystore.
  - Any APK must be signed to install, and debug signing counts.
  - Distributing updates requires a stable keystore, so generate one once with `keytool` (also possible in a CI step), base64 it into a repo secret, and never lose it.
  - Google Play needs a release-signed AAB with a Gradle build.
- Typical build time: no source gives timings. Based on experience, a non-Gradle APK export of a small project usually takes a few minutes, mostly image pull or template download plus import. Gradle/AAB adds several minutes for the first Gradle dependency download. This is unverified.
- For Gradle/AAB on the godot-ci image, you would likely need to `sdkmanager "platforms;android-35" "build-tools;35.0.1" "ndk;28.1.13356709"`, or use `android-actions/setup-android` with a plain runner and setup-godot.

### Gaps
- No source gave measured CI build times.
- I did not confirm the latest firebelley/godot-export release (v8.0.0 is the latest referenced) or whether its example covers 4.5+. The version URLs are user-supplied, so it should work with any 4.x.
- The default min/target SDK values in the Godot 4.7 export preset were not stated in the docs fetched. Google Play's 2026 target-API requirement (likely API 35 or 36) was not verified.
- I did not verify whether the godot-ci 4.7.x tags bump the Android SDK beyond the master Dockerfile shown (33 / NDK r25).

## Q4: Headless CI testing and screenshots

### Takeaway
Unit and integration tests run fine headless in CI with GdUnit4 (`godot-gdunit-labs/gdUnit4-action`) or GUT. Headless mode renders nothing, so screenshot or visual tests need a separate job with a real display driver (for example Xvfb plus the OpenGL3/Compatibility renderer), or `--write-movie`.

### Cited Findings
- **gdUnit4-action** (https://github.com/godot-gdunit-labs/gdUnit4-action): MIT, about 62 stars, used as `@v1`. Supports Godot 4.0+ standard and .NET builds (stable, RC and dev). Inputs: `godot-version`, `paths`, and `headless` (default false; requires GdUnit4 v7+). Godot renders nothing in headless mode, so tests that need rendering belong in a separate job without it. GdUnit4 v6 refuses headless unless you pass `--ignoreHeadlessMode`. — [GitHub](https://github.com/godot-gdunit-labs/gdUnit4-action)
- `--headless` uses the headless display driver and a dummy audio driver. `--rendering-method` accepts `forward_plus`, `mobile` or `gl_compatibility`. `--rendering-driver` and `--display-driver` select backends. `--write-movie <file>` (`.avi` or `.png` sequence) with `--fixed-fps` and `--quit-after` can capture frames. `--script` runs a SceneTree or MainLoop script. — [Command line docs](https://docs.godotengine.org/en/stable/tutorials/editor/command_line_tutorial.html)

### Inferences
- For screenshots on GitHub runners (no GPU), run `xvfb-run -a godot --rendering-driver opengl3 --rendering-method gl_compatibility res://test_scene.tscn` with a script that calls `get_viewport().get_texture().get_image().save_png(...)`, or use `--write-movie out.png --quit-after N`. Mesa llvmpipe provides software OpenGL. Vulkan (Mobile renderer) would need lavapipe and is less reliable. These steps are not verified in this session.
- GUT (bitwes/Gut) can also run headless via `godot --headless -s addons/gut/gut_cmdln.gd`. The command comes from general knowledge and was not verified this session.

### Gaps
- I did not fetch the GUT repo or confirm its 4.x version compatibility, due to the GitHub API block.
- No source confirming Xvfb screenshot workflows was fetched.

## Q5: Mobile renderer guidance for a Godot 4 FPS on Android

### Takeaway
On Android, use **Compatibility** (OpenGL) for the widest reach and best performance on low and mid-range phones. Use **Mobile** (Vulkan) only if you need its extra features on modern devices. Since 4.4, Mobile automatically falls back to Compatibility when RenderingDevice is unavailable. For an FPS, bake lighting, use occluders, mesh LOD and visibility ranges, use MultiMesh, and minimise transparency and realtime shadows.

### Cited Findings
**Renderer choice** — [Renderers docs](https://docs.godotengine.org/en/stable/tutorials/rendering/renderers.html)
- Mobile is the default renderer on mobile platforms. Forward+ is for desktop only.
- Compatibility has a low base cost and gives "the best performance on all devices if you don't need advanced features". Mobile is slower than Compatibility on old or low-end hardware.
- Mobile-only features: decals, FXAA/SMAA, MSAA 2D, PCSS, 8 reflection probes per mesh (vs 2), particle trails, compute shaders and variable rate shading.
- Compatibility has SSAO, which Mobile lacks.
- Neither supports VoxelGI, SDFGI, SSIL, SSR, volumetric fog or SSS.
- Since 4.4, Mobile falls back between Vulkan and D3D12, and then to Compatibility if RenderingDevice is unsupported. Disable this with Rendering > Rendering Device > Fallback to OpenGL 3. The appearance may differ after a fallback.
- Switching between Mobile and Forward+ is easier than switching to or from Compatibility, so choose early.

**3D performance** — [Optimizing 3D performance docs](https://docs.godotengine.org/en/stable/tutorials/performance/optimizing_3d_performance.html)
- Use occluder nodes for occlusion culling.
- Use automatic mesh LOD on import, plus visibility ranges.
- Use MultiMesh, because automatic instancing works only in Forward+, not in Mobile or Compatibility.
- Prefer baked lightmaps, "especially for mobile". Set omni and spot lights to Static bake mode.
- Keep transparency minimal.
- Reduce animation rates for distant or occluded characters with VisibleOnScreenNotifier3D.

**Profiling**
- Arm Performance Studio is a listed GPU profiler. Test on multiple real devices. — [General optimization docs](https://docs.godotengine.org/en/stable/tutorials/performance/general_optimization.html)

**Known Android issues**
- The Godot Android editor can freeze or crash, so building in CI from a desktop-free workflow avoids it. — [Virtual Joystick FAQ](https://github.com/MarcoFazioRandom/Virtual-Joystick-Godot)
- 16 KB page-size compliance needs Godot 4.5+ (NDK r28b). A user reported that importing a 4.2.2 project into 4.4.1 or 4.5-rc did not resolve the Play warning. — [Godot forum](https://forum.godotengine.org/t/godot-and-google-play-policy-warning-about-16-kb-memory-page-size/120934)
- The release-export failure when debug keystore env vars are partially set. — [issue #109551](https://github.com/godotengine/godot/issues/109551)

### Inferences
- For a multiplayer mobile FPS aimed at broad Android reach, start with the Compatibility renderer:
  - Use baked lighting and lightmaps.
  - Keep a single dynamic directional light with modest shadow distance, or no realtime shadows.
  - Use a lower 3D resolution scale for thermals.
  - Switch to Mobile only if you need decals, FXAA or other Mobile-only effects.
- Use a recent stable release (4.6.x or 4.7.x) for current Android/Play compliance.

### Gaps
- I found no doc page that specifically covers resolution scaling, FSR, or thermal throttling on Android. Dedicated mobile pages were not found or fetched.
- I did not survey current Android-specific bugs in 4.6 or 4.7 (for example Vulkan driver issues on Adreno or Mali).
