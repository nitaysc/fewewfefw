#!/usr/bin/env bash
# Builds tps-demo.apk. Needs: GODOT (Godot 3.5.3 binary with the Android export
# template installed), ANDROID_HOME (Android SDK with build-tools), Java 11+.
set -euo pipefail
cd "$(dirname "$0")"
GODOT="${GODOT:-godot}"
VERSION_CODE="${VERSION_CODE:-1}"
JAVA_BIN="$(readlink -f "$(which java)")"
JAVA_HOME="${JAVA_HOME:-$(dirname "$(dirname "$JAVA_BIN")")}"

./prepare.sh

mkdir -p "$HOME/.config/godot"
cat > "$HOME/.config/godot/editor_settings-3.tres" <<TRES
[gd_resource type="EditorSettings" format=2]

[resource]
export/android/android_sdk_path = "$ANDROID_HOME"
export/android/debug_keystore = "$PWD/debug.keystore"
export/android/debug_keystore_user = "androiddebugkey"
export/android/debug_keystore_pass = "android"
TRES

sed -i "s|^version/code=.*|version/code=$VERSION_CODE|; s|^keystore/debug=.*|keystore/debug=\"$PWD/debug.keystore\"|" game/export_presets.cfg

# Exporting imports all assets first (slow the first time: ~400 MB of textures/models).
"$GODOT" --path game --export-debug "Android" "$PWD/tps-demo.apk"
ls -la tps-demo.apk
