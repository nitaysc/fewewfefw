#!/bin/bash
# Fetches Red Eclipse 2.0.0 and SDL, applies the Android patch and lays everything
# out for the Gradle build in android/. Run from the redeclipse-android folder.
set -euo pipefail

RE_TAG=v2.0.0
SDL_TAG=release-2.30.9
SDL_IMAGE_TAG=release-2.8.2
SDL_MIXER_TAG=release-2.8.0

HERE=$(cd "$(dirname "$0")/.." && pwd)
JNI=$HERE/android/app/jni
APP=$HERE/android/app/src/main
WORK=${WORK:-$HERE/build}
mkdir -p "$WORK"

clone() { # url tag dir
    [ -d "$3" ] || git clone -q --depth 1 --branch "$2" "$1" "$3"
}

clone https://github.com/redeclipse/base "$RE_TAG" "$WORK/redeclipse"
git -C "$WORK/redeclipse" submodule update -q --init --depth 1 --jobs 8
if ! git -C "$WORK/redeclipse" diff --quiet; then
    echo "redeclipse already patched"
else
    git -C "$WORK/redeclipse" apply "$HERE/patches/redeclipse-android.patch"
fi

clone https://github.com/libsdl-org/SDL "$SDL_TAG" "$JNI/SDL"
clone https://github.com/libsdl-org/SDL_image "$SDL_IMAGE_TAG" "$JNI/SDL_image"
clone https://github.com/libsdl-org/SDL_mixer "$SDL_MIXER_TAG" "$JNI/SDL_mixer"
ln -sfn "$WORK/redeclipse" "$JNI/redeclipse"

# SDL's Java half, which GameActivity extends
mkdir -p "$APP/java/org/libsdl/app"
cp "$JNI"/SDL/android-project/app/src/main/java/org/libsdl/app/*.java "$APP/java/org/libsdl/app/"

# launcher icons from the Red Eclipse install files
for d in mdpi:48 hdpi:64 xhdpi:128 xxhdpi:128 xxxhdpi:128; do
    mkdir -p "$APP/res/mipmap-${d%%:*}"
    cp "$WORK/redeclipse/src/install/nix/redeclipse_x${d##*:}.png" "$APP/res/mipmap-${d%%:*}/ic_launcher.png"
done

# the game data as one zip; already-compressed files are stored as they are
mkdir -p "$APP/assets"
rm -f "$APP/assets/game.zip"
(cd "$WORK/redeclipse" && zip -q -r -n .ogg:.png:.jpg:.jpeg:.mpz:.dds:.webp:.iqm:.zip \
    "$APP/assets/game.zip" config data doc/license.txt doc/all-licenses.txt doc/cc-by-sa.txt doc/trademark.txt \
    -x '*/.git' '*/.git/*' '*.o' '*.gch')
ls -la "$APP/assets/game.zip"
