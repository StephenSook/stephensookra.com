#!/bin/sh
# Exports the immersive room for Apple Vision Pro (/vision): room.usdz (the case on a wall of
# a plain, warm room) and room.hdr (its environment map), published as one generation:
# public/vision/<UTC time>-<layout hash>/room.{usdz,hdr} plus public/vision/manifest.json.
# Run: npm run vision:room
#
# Fail-closed: Blender exits non-zero on a Python error, everything is built in a temporary
# folder, and nothing in public/vision changes unless both files pass their checks.
set -eu

BLENDER=${BLENDER:-/Applications/Blender.app/Contents/MacOS/Blender}
LAYOUT=scripts/blender/out/case-layout.json
DEST=public/vision

mkdir -p scripts/blender/out "$DEST"
WORK=$(mktemp -d scripts/blender/out/room.XXXXXX)

LAYOUT_SHA=$(python3 -c "import json,sys; print(json.load(open(sys.argv[1]))['specSha256'])" "$LAYOUT")
SPEC_SHA=$(shasum -a 256 src/scene/case-spec.json | cut -d' ' -f1)
if [ "$LAYOUT_SHA" != "$SPEC_SHA" ]; then
  echo "case-layout.json is stale (run npm run case:layout)" >&2
  exit 1
fi

sh scripts/blender/crop-posters.sh "$LAYOUT" "$WORK/posters"

"$BLENDER" -b --factory-startup --python-exit-code 1 -P scripts/blender/export_room.py -- \
  --layout "$LAYOUT" --posters "$WORK/posters" --usdz "$WORK/room.usdz" --hdr "$WORK/room.hdr" \
  > "$WORK/blender.log" 2>&1
for f in room.usdz room.hdr; do
  if [ ! -s "$WORK/$f" ]; then
    echo "Blender wrote no $f; see $WORK/blender.log" >&2
    exit 1
  fi
done
if [ "$(head -c 10 "$WORK/room.hdr")" != "#?RADIANCE" ]; then
  echo "room.hdr is not a Radiance HDR" >&2
  exit 1
fi
# Apple's own ARKit check, and the stage must be y-up and in metres (Blender is z-up).
usdchecker --arkit "$WORK/room.usdz" > "$WORK/usdchecker.log" 2>&1 || {
  echo "room.usdz fails usdchecker --arkit; see $WORK/usdchecker.log" >&2
  exit 1
}
usdcat "$WORK/room.usdz" > "$WORK/room.usda"
for want in 'upAxis = "Y"' 'metersPerUnit = 1' 'xformOp:rotateXYZ = (-90, 0, 0)'; do
  if ! grep -qF "$want" "$WORK/room.usda"; then
    echo "room.usdz is missing: $want" >&2
    exit 1
  fi
done
RENDERER=$("$BLENDER" --version 2>/dev/null | head -1)

GEN="$(date -u +%Y%m%d%H%M%S)-$(echo "$LAYOUT_SHA" | cut -c1-12)"
mkdir "$DEST/$GEN"
mv "$WORK/room.usdz" "$DEST/$GEN/room.usdz"
mv "$WORK/room.hdr" "$DEST/$GEN/room.hdr"
cat > "$DEST/.manifest.json.tmp" <<JSON
{
  "specSha256": "$LAYOUT_SHA",
  "renderer": "$RENDERER",
  "room": "/vision/$GEN/room.usdz",
  "environment": "/vision/$GEN/room.hdr"
}
JSON
mv "$DEST/.manifest.json.tmp" "$DEST/manifest.json"

for old in "$DEST"/*; do
  case "$old" in
    "$DEST/$GEN" | "$DEST/manifest.json") ;;
    *) python3 -c "import shutil,sys,os; p=sys.argv[1]; shutil.rmtree(p) if os.path.isdir(p) else os.remove(p)" "$old" ;;
  esac
done
echo "published generation $GEN to $DEST (work in $WORK)"
