#!/bin/sh
# Copies the open-source 8th Wall engine (MIT) from the published npm tarball into
# public/vendor/8thwall/<version>/, with its licence and a SHA-256 record per file.
# Only the two files image targets load: xr.js and the "slam" chunk xr-tracking.js, which in
# this package holds image targets and no world tracking. Not the face files, and never
# @8thwall/engine-binary (a separately licensed build). Self-hosted, no CDN; loaded only after
# a reader presses "Start the camera" on /ar/marker.
# Run: npm run vendor:8thwall
set -eu

VERSION=0.1.0
DEST="public/vendor/8thwall/$VERSION"
WORK=$(mktemp -d "${TMPDIR:-/tmp}/8thwall.XXXXXX")
trap 'python3 -c "import shutil,sys; shutil.rmtree(sys.argv[1], ignore_errors=True)" "$WORK"' EXIT

(cd "$WORK" && npm pack "@8thwall/engine@$VERSION" > pack.log 2>&1)
tar -xzf "$WORK/8thwall-engine-$VERSION.tgz" -C "$WORK"
LICENSE_NAME=$(node -e 'console.log(require(process.argv[1]).license)' "$WORK/package/package.json")
if [ "$LICENSE_NAME" != "MIT" ]; then
  echo "expected the MIT engine, found licence $LICENSE_NAME" >&2
  exit 1
fi
mkdir -p "$DEST"
cp "$WORK/package/dist/xr.js" "$DEST/xr.js"
cp "$WORK/package/dist/xr-tracking.js" "$DEST/xr-tracking.js"
cp "$WORK/package/LICENSE" "$DEST/LICENSE"
INTEGRITY=$(npm view "@8thwall/engine@$VERSION" dist.integrity)
XR=$(shasum -a 256 "$DEST/xr.js" | cut -d' ' -f1)
TRACKING=$(shasum -a 256 "$DEST/xr-tracking.js" | cut -d' ' -f1)
cat > "$DEST/source.json" <<JSON
{
  "package": "@8thwall/engine",
  "version": "$VERSION",
  "tarballIntegrity": "$INTEGRITY",
  "license": "MIT",
  "files": {
    "xr.js": { "from": "dist/xr.js", "sha256": "$XR" },
    "xr-tracking.js": { "from": "dist/xr-tracking.js", "sha256": "$TRACKING" }
  }
}
JSON
echo "vendored @8thwall/engine $VERSION"
