#!/bin/sh
# Cuts the short, silent loops the headset cards play, from Stephen's own public films on
# YouTube (each film is linked from its project page). Run: npm run loops
#
# Each row: slug, YouTube id, start second, length in seconds, crop (w:h:x:y of the
# 1280x720 film, or "full"). Crops keep the film's own honesty caption in frame (for
# example "Lens Studio preview, simulated hand input").
#
# Needs yt-dlp and ffmpeg. Films download to a temporary folder that is removed after.
# Fail-closed: any failed download or encode stops the script before public/loops changes.
set -eu

DEST=public/loops
MAX_BYTES=1572864 # 1.5 MB per loop
WORK=$(mktemp -d "${TMPDIR:-/tmp}/loops.XXXXXX")
trap 'python3 -c "import shutil,sys; shutil.rmtree(sys.argv[1], ignore_errors=True)" "$WORK"' EXIT

LOOPS="case-light lymPgfFXAZ4 24 8 520:610:692:40
glare-zone TMuU6nUypQo 36 9 492:620:718:40
varsity 7e88hmX8Puw 45 8 full
instanter AyvxUeE9sCs 95 8 full
aloud 2rPntXmDqHQ 42 8 290:620:884:52"

echo "$LOOPS" | while read -r slug id start length crop; do
  film="$WORK/$slug.mp4"
  yt-dlp -q --no-warnings --no-playlist -f "bv*[height<=720][ext=mp4]/bv*[height<=720]" -o "$film" \
    "https://www.youtube.com/watch?v=$id"
  if [ "$crop" = "full" ]; then
    vf="scale=720:-2,setsar=1,fps=30"
  else
    vf="crop=$crop,scale='min(iw,720)':-2,setsar=1,fps=30"
  fi
  ffmpeg -v error -y -ss "$start" -i "$film" -t "$length" -an -vf "$vf" \
    -c:v libx264 -profile:v main -pix_fmt yuv420p -crf 28 -preset slow -movflags +faststart \
    "$WORK/$slug-loop.mp4"
  bytes=$(wc -c < "$WORK/$slug-loop.mp4" | tr -d ' ')
  if [ "$bytes" -gt "$MAX_BYTES" ]; then
    echo "$slug loop is $bytes bytes, over $MAX_BYTES" >&2
    exit 1
  fi
  echo "$slug: $id from ${start}s for ${length}s, crop $crop, $bytes bytes"
done

mkdir -p "$DEST"
for f in "$WORK"/*-loop.mp4; do
  slug=$(basename "$f" -loop.mp4)
  mv "$f" "$DEST/$slug.mp4"
done
echo "wrote loops to $DEST"
