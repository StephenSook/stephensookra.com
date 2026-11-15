#!/bin/sh
# Renders the light and dark case posters in Blender (headless), flattens each onto its
# page background token, encodes WebP, and writes public/case/manifest.json with the
# SHA-256 of the case model they were rendered from. Run: npm run case:posters
set -eu

BLENDER=${BLENDER:-/Applications/Blender.app/Contents/MacOS/Blender}
OUT=scripts/blender/out
DEST=public/case
WIDTH=1600
HEIGHT=900
mkdir -p "$OUT" "$DEST"

render() {
  scheme=$1
  bg=$2
  "$BLENDER" -b --factory-startup -P scripts/blender/render_case.py -- \
    --scheme "$scheme" --out "$OUT/poster-$scheme.png" --width $WIDTH --height $HEIGHT --samples 64 \
    > "$OUT/blender-$scheme.log" 2>&1
  magick "$OUT/poster-$scheme.png" -background "$bg" -alpha remove -alpha off "$OUT/poster-$scheme-flat.png"
  cwebp -quiet -q 80 -m 6 -metadata none "$OUT/poster-$scheme-flat.png" -o "$DEST/poster-$scheme.webp"
}

render light "#F1F2F4"
render dark "#0F1115"

SPEC_SHA=$(shasum -a 256 src/scene/case-spec.json | cut -d' ' -f1)
RENDERER=$("$BLENDER" --version 2>/dev/null | head -1)
cat > "$DEST/manifest.json" <<JSON
{
  "specSha256": "$SPEC_SHA",
  "renderer": "$RENDERER",
  "files": ["poster-light.webp", "poster-dark.webp"],
  "width": $WIDTH,
  "height": $HEIGHT
}
JSON
echo "wrote $DEST/poster-light.webp, $DEST/poster-dark.webp and $DEST/manifest.json"
