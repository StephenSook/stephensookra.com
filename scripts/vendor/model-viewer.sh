#!/bin/sh
# Copies model-viewer's default bundled build (three.js inside) from the published npm tarball
# into public/vendor/model-viewer/<version>/, with its licence and a SHA-256 record.
# It is self-hosted (no CDN) and loaded only when a reader taps "See it in 3D" on /case/ar.
# Not an npm dependency: 4.4.0 declares a peer of three ^0.183, and the site uses 0.187;
# the bundled build carries its own three.js, so nothing here depends on the site's copy.
# Run: npm run vendor:model-viewer
set -eu

VERSION=4.4.0
DEST="public/vendor/model-viewer/$VERSION"
WORK=$(mktemp -d "${TMPDIR:-/tmp}/model-viewer.XXXXXX")
trap 'python3 -c "import shutil,sys; shutil.rmtree(sys.argv[1], ignore_errors=True)" "$WORK"' EXIT

(cd "$WORK" && npm pack "@google/model-viewer@$VERSION" > pack.log 2>&1)
tar -xzf "$WORK/google-model-viewer-$VERSION.tgz" -C "$WORK"
mkdir -p "$DEST"
cp "$WORK/package/dist/model-viewer.min.js" "$DEST/model-viewer.min.js"
cp "$WORK/package/LICENSE" "$DEST/LICENSE"
INTEGRITY=$(npm view "@google/model-viewer@$VERSION" dist.integrity)
SHA=$(shasum -a 256 "$DEST/model-viewer.min.js" | cut -d' ' -f1)
cat > "$DEST/source.json" <<JSON
{
  "package": "@google/model-viewer",
  "version": "$VERSION",
  "tarballIntegrity": "$INTEGRITY",
  "file": "dist/model-viewer.min.js",
  "sha256": "$SHA",
  "license": "Apache-2.0"
}
JSON
echo "vendored model-viewer $VERSION ($SHA)"
