#!/bin/sh
# Exports the case for phone AR (GLB for Scene Viewer and model-viewer, USDZ for AR Quick
# Look and Safari's <model>) and publishes both as one generation:
# public/ar/<UTC time>-<model hash>/case.{glb,usdz} plus public/ar/manifest.json, swapped in
# with one rename. Run: npm run case:models
#
# Fail-closed: Blender exits non-zero on a Python error, everything is built in a temporary
# folder, and nothing in public/ar changes unless both files were written.
set -eu

BLENDER=${BLENDER:-/Applications/Blender.app/Contents/MacOS/Blender}
LAYOUT=scripts/blender/out/case-layout.json
DEST=public/ar

mkdir -p scripts/blender/out "$DEST"
WORK=$(mktemp -d scripts/blender/out/models.XXXXXX)

LAYOUT_SHA=$(python3 -c "import json,sys; print(json.load(open(sys.argv[1]))['specSha256'])" "$LAYOUT")
SPEC_SHA=$(shasum -a 256 src/scene/case-spec.json | cut -d' ' -f1)
if [ "$LAYOUT_SHA" != "$SPEC_SHA" ]; then
  echo "case-layout.json is stale (run npm run case:layout)" >&2
  exit 1
fi

sh scripts/blender/crop-posters.sh "$LAYOUT" "$WORK/posters"

"$BLENDER" -b --factory-startup --python-exit-code 1 -P scripts/blender/export_case.py -- \
  --layout "$LAYOUT" --posters "$WORK/posters" --glb "$WORK/case.glb" --usdz "$WORK/case.usdz" \
  > "$WORK/blender.log" 2>&1
for f in case.glb case.usdz; do
  if [ ! -s "$WORK/$f" ]; then
    echo "Blender wrote no $f; see $WORK/blender.log" >&2
    exit 1
  fi
done
# AR Quick Look: Apple's own ARKit check, and the stage must be y-up, metres, with the case
# turned upright (Blender is z-up). These tools ship with macOS, where this script runs.
usdchecker --arkit "$WORK/case.usdz" > "$WORK/usdchecker.log" 2>&1 || {
  echo "case.usdz fails usdchecker --arkit; see $WORK/usdchecker.log" >&2
  exit 1
}
usdcat "$WORK/case.usdz" > "$WORK/case.usda"
for want in 'upAxis = "Y"' 'metersPerUnit = 1' 'xformOp:rotateXYZ = (-90, 0, 0)'; do
  if ! grep -qF "$want" "$WORK/case.usda"; then
    echo "case.usdz is missing: $want" >&2
    exit 1
  fi
done
RENDERER=$("$BLENDER" --version 2>/dev/null | head -1)

GEN="$(date -u +%Y%m%d%H%M%S)-$(echo "$LAYOUT_SHA" | cut -c1-12)"
mkdir "$DEST/$GEN"
mv "$WORK/case.glb" "$DEST/$GEN/case.glb"
mv "$WORK/case.usdz" "$DEST/$GEN/case.usdz"
cat > "$DEST/.manifest.json.tmp" <<JSON
{
  "specSha256": "$LAYOUT_SHA",
  "renderer": "$RENDERER",
  "glb": "/ar/$GEN/case.glb",
  "usdz": "/ar/$GEN/case.usdz"
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
