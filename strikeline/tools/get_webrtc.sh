#!/usr/bin/env bash
# Fetches the official Godot WebRTC GDExtension (webrtc-native) libraries used for online play.
# Only the Android arm64 and Linux x86_64 builds are kept (phones + headless tests).
set -euo pipefail
VER="${WEBRTC_VERSION:-1.1.1-stable}"
cd "$(dirname "$0")/.."
DEST=addons/webrtc/lib
if [ -f "$DEST/libwebrtc_native.android.template_release.arm64.so" ]; then
  echo "webrtc-native already present"; exit 0
fi
TMP=$(mktemp -d)
curl -sSL -o "$TMP/w.zip" "https://github.com/godotengine/webrtc-native/releases/download/$VER/godot-extension-webrtc.zip"
mkdir -p "$DEST"
unzip -q -j "$TMP/w.zip" \
  'webrtc/lib/libwebrtc_native.android.template_release.arm64.so' \
  'webrtc/lib/libwebrtc_native.android.template_debug.arm64.so' \
  'webrtc/lib/libwebrtc_native.linux.template_debug.x86_64.so' \
  'webrtc/lib/libwebrtc_native.linux.template_release.x86_64.so' -d "$DEST"
unzip -q -j -o "$TMP/w.zip" 'webrtc/LICENSE*' -d addons/webrtc
rm -rf "$TMP"
echo "webrtc-native $VER installed"
