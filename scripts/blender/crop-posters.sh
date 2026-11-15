#!/bin/sh
# Crops each project poster to its slot's shape (cover), as a JPEG of 720 px wide, for the
# Blender exporters. Usage: sh scripts/blender/crop-posters.sh LAYOUT.json OUT_DIR
set -eu
LAYOUT=$1
OUT=$2
mkdir -p "$OUT"
python3 - "$LAYOUT" <<'PY' > "$OUT/crops.txt"
import json, sys
data = json.load(open(sys.argv[1]))
for slot in data["layout"]["projectSlots"]:
    b = slot["back"]
    print(slot["slug"], round(720 * b["h"] / b["w"]))
PY
while read -r slug height; do
  src="public/posters/$slug.webp"
  [ -f "$src" ] || continue
  magick "$src" -resize "720x${height}^" -gravity center -extent "720x${height}" -quality 85 "$OUT/$slug.jpg"
done < "$OUT/crops.txt"
