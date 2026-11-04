#!/usr/bin/env bash
# Fetches the TPS demo at the pinned commit into game/ and adds the mobile changes:
# the files in overlay/ are copied in, then patches/*.patch are applied.
set -euo pipefail
cd "$(dirname "$0")"
read -r URL COMMIT < UPSTREAM
if [ ! -d game/.git ]; then
  rm -rf game
  git init -q game
  git -C game remote add origin "$URL"
fi
git -C game fetch -q --depth 1 origin "$COMMIT"
git -C game checkout -q -f "$COMMIT"
git -C game clean -qfd -e .import/
cp -r overlay/. game/
for p in patches/*.patch; do git -C game apply "$PWD/$p"; done
# Phones: cap texture sizes (the demo ships 4096x4096 textures, which make a ~520 MB
# APK and don't fit in a phone GPU). Colour maps max 2048, normal/ORM maps max 1024.
find game -name '*.import' -print0 | while IFS= read -r -d '' f; do
  grep -q '^compress/mode=2' "$f" || continue
  case "$f" in
    *normal*|*orm*|*_nm*|*rough*|*metal*) limit=1024 ;;
    *) limit=2048 ;;
  esac
  sed -i "s/^size_limit=.*/size_limit=$limit/" "$f"
done
echo "game/ is ready (upstream $COMMIT + mobile changes)"
