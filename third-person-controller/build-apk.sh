#!/usr/bin/env bash
# Exports the Godot project to third-person-controller.apk.
# Needs: GODOT (path to the Godot 4.3 editor binary, export templates installed),
#        ANDROID_HOME (Android SDK with build-tools), Java 17+.
set -euo pipefail
cd "$(dirname "$0")"
GODOT="${GODOT:-godot}"
VERSION_CODE="${VERSION_CODE:-1}"
JAVA_HOME="${JAVA_HOME:-$(dirname "$(dirname "$(readlink -f "$(which java)")")")}"

# Point the editor at the Android SDK and Java
for d in "$HOME/.config/godot"; do
  mkdir -p "$d"
  cat > "$d/editor_settings-4.3.tres" <<TRES
[gd_resource type="EditorSettings" format=3]

[resource]
export/android/android_sdk_path = "$ANDROID_HOME"
export/android/java_sdk_path = "$JAVA_HOME"
export/android/debug_keystore = "$PWD/debug.keystore"
export/android/debug_keystore_user = "androiddebugkey"
export/android/debug_keystore_pass = "android"
TRES
done

export GODOT_ANDROID_KEYSTORE_DEBUG_PATH="$PWD/debug.keystore"
export GODOT_ANDROID_KEYSTORE_DEBUG_USER=androiddebugkey
export GODOT_ANDROID_KEYSTORE_DEBUG_PASSWORD=android

sed -i "s/^version\/code=.*/version\/code=$VERSION_CODE/" game/export_presets.cfg
"$GODOT" --headless --path game --import
"$GODOT" --headless --path game --export-debug "Android" "$PWD/third-person-controller.apk"
ls -la third-person-controller.apk
