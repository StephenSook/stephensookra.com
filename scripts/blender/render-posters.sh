#!/bin/sh
# Renders the light and dark case posters in Blender (headless), flattens each onto its
# page background token, encodes WebP, and writes public/case/manifest.json with the
# SHA-256 of the case model they were rendered from. Run: npm run case:posters
#
# Fail-closed: Blender exits non-zero on a Python error (--python-exit-code), every render
# goes to a fresh temporary folder, and nothing in public/case changes unless both
# posters rendered and encoded.
set -eu

BLENDER=${BLENDER:-/Applications/Blender.app/Contents/MacOS/Blender}
LAYOUT=scripts/blender/out/case-layout.json
DEST=public/case
WIDTH=1600
HEIGHT=900

mkdir -p scripts/blender/out "$DEST"
WORK=$(mktemp -d scripts/blender/out/run.XXXXXX)

# The manifest records the model the layout was exported from, and it must be the current one.
LAYOUT_SHA=$(python3 -c "import json,sys; print(json.load(open(sys.argv[1]))['specSha256'])" "$LAYOUT")
SPEC_SHA=$(shasum -a 256 src/scene/case-spec.json | cut -d' ' -f1)
if [ "$LAYOUT_SHA" != "$SPEC_SHA" ]; then
  echo "case-layout.json is stale (run npm run case:layout)" >&2
  exit 1
fi

render() {
  scheme=$1
  bg=$2
  "$BLENDER" -b --factory-startup --python-exit-code 1 -P scripts/blender/render_case.py -- \
    --scheme "$scheme" --layout "$LAYOUT" --out "$WORK/poster-$scheme.png" \
    --width $WIDTH --height $HEIGHT --samples 64 > "$WORK/blender-$scheme.log" 2>&1
  if [ ! -s "$WORK/poster-$scheme.png" ]; then
    echo "Blender produced no $scheme render; see $WORK/blender-$scheme.log" >&2
    exit 1
  fi
  magick "$WORK/poster-$scheme.png" -background "$bg" -alpha remove -alpha off "$WORK/poster-$scheme-flat.png"
  cwebp -quiet -q 80 -m 6 -metadata none "$WORK/poster-$scheme-flat.png" -o "$WORK/poster-$scheme.webp"
}

render light "#F1F2F4"
render dark "#0F1115"

RENDERER=$("$BLENDER" --version 2>/dev/null | head -1)

# Publish as one generation: a new folder that nothing points at yet, then the manifest
# (the only pointer the site reads) swapped in with a single atomic rename. If anything
# fails before the rename, the old manifest still names a complete old generation.
GEN="$(date -u +%Y%m%d%H%M%S)-$(echo "$LAYOUT_SHA" | cut -c1-12)"
mkdir "$DEST/$GEN"
mv "$WORK/poster-light.webp" "$DEST/$GEN/poster-light.webp"
mv "$WORK/poster-dark.webp" "$DEST/$GEN/poster-dark.webp"
cat > "$DEST/.manifest.json.tmp" <<JSON
{
  "specSha256": "$LAYOUT_SHA",
  "renderer": "$RENDERER",
  "light": "/case/$GEN/poster-light.webp",
  "dark": "/case/$GEN/poster-dark.webp",
  "width": $WIDTH,
  "height": $HEIGHT
}
JSON
mv "$DEST/.manifest.json.tmp" "$DEST/manifest.json"

# Older generations are now unreferenced; remove them (and any loose files from before).
for old in "$DEST"/*; do
  case "$old" in
    "$DEST/$GEN" | "$DEST/manifest.json") ;;
    *) python3 -c "import shutil,sys,os; p=sys.argv[1]; shutil.rmtree(p) if os.path.isdir(p) else os.remove(p)" "$old" ;;
  esac
done
echo "published generation $GEN to $DEST (renders in $WORK)"
