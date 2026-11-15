# Marker AR uses the open-source 8th Wall engine

Date: 2026-11-15. Status: accepted.

## Decision

/ar/marker finds the printed card with the image targets in `@8thwall/engine` 0.1.0 (MIT), self-hosted under
`public/vendor/8thwall/0.1.0/` by `npm run vendor:8thwall`. three.js draws the case model on top.

## Why

- The licence is MIT, and the image-target code is in the open-source part. World tracking (SLAM) is not, and this
  page does not need it, so the page turns it off.
- The repository (github.com/8thwall/8thwall) is maintained.
- Before building the page, a test page checked the engine in headless Chromium, with the fake camera playing a
  video of the card:
  - it found the card in about one second;
  - a video with no card in it was never matched;
  - it loaded only `xr.js` and `xr-tracking.js` and asked no other site for anything;
  - `XR8.stop()` ended the camera track.
  Each of these is now an e2e test (`tests/e2e/marker-ar.spec.ts`), so CI runs real tracking on every change.

## Not used

- `@8thwall/engine-binary`: a separate build under a limited licence.
- The engine's face files and media worker: image targets do not load them.
- The fallback in the plan (MindAR, MIT, or a small tracker of our own): not needed, because the MIT engine tracks
  without the binary.

## How it fits together

- The card (`npm run marker:card`) is one HTML template rendered twice: a PNG, which
  `@8thwall/image-target-cli` turns into the grayscale target, and a vector PDF for printing. A landscape card is
  stored as a rotated target; the engine still reports it 1 wide by 0.75 high, x right, y up, z towards the viewer.
- three.js renders in the engine's WebGL2 context, after the camera picture. The engine needs
  `XrController.updateCameraProjectionMatrix` with near and far planes, or its projection matrix is NaN.
- The case sits over its own picture on the card, at the picture's size, using the picture's box measured when the
  card is rendered (`caseBox` in `public/marker/manifest.json`).

## Limits

Tracking on printed paper, in real light, through a phone camera, has not been tested yet. The page says
"not yet tested on a phone" until a run is recorded in `src/content/measurements/xr-tests.json`.
