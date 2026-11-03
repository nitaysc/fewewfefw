#!/usr/bin/env bash
# Builds build/fps-arms.apk with Godot 4.3 (headless).
# Needs: GODOT (path to the Godot 4.3 binary, default "godot"), the 4.3 export templates
# installed, and ANDROID_HOME pointing at an Android SDK with build-tools.
# Optional: VERSION_CODE (default 1).
set -euo pipefail
cd "$(dirname "$0")"

GODOT="${GODOT:-godot}"
SDK="${ANDROID_HOME:-${ANDROID_SDK_ROOT:-}}"
[ -n "$SDK" ] || { echo "Set ANDROID_HOME to your Android SDK"; exit 1; }
KEYSTORE="$PWD/keys/fps-arms.keystore"

# Point the editor at the SDK and the committed debug keystore.
CONF="${XDG_CONFIG_HOME:-$HOME/.config}/godot"
mkdir -p "$CONF"
cat > "$CONF/editor_settings-4.3.tres" <<TRES
[gd_resource type="EditorSettings" format=3]

[resource]
export/android/android_sdk_path = "$SDK"
export/android/debug_keystore = "$KEYSTORE"
export/android/debug_keystore_user = "fpsarms"
export/android/debug_keystore_pass = "android"
TRES

# Same key for release builds so every version installs over the last one.
export GODOT_ANDROID_KEYSTORE_RELEASE_PATH="$KEYSTORE"
export GODOT_ANDROID_KEYSTORE_RELEASE_USER="fpsarms"
export GODOT_ANDROID_KEYSTORE_RELEASE_PASSWORD="android"

sed -i "s/^version\/code=.*/version\/code=${VERSION_CODE:-1}/" export_presets.cfg

# Import assets first (a fresh checkout has no .godot/ cache).
"$GODOT" --headless --import . || true
mkdir -p build
"$GODOT" --headless --export-release "Android" build/fps-arms.apk
ls -la build/fps-arms.apk
