<!-- DRAFT: wording awaits Stephen's sign-off. -->

# stephensookra.com

Source for [stephensookra.com](https://stephensookra.com), the portfolio of Stephen Sookra, a software engineer in Atlanta focused on XR.

The site is plain, fast HTML first. Every page reads with JavaScript off. Project facts come from one typed content source, and live repository details (last commit, CI status, stars) are read from the public GitHub API at build time and refreshed daily. The 3D case, VR, passthrough and AR modes load only when a reader asks for them.

## What runs where

Device status comes from `src/content/measurements/xr-tests.json`, and the pages show the same line. A mode is called tested only after a run on that device is recorded there with a date and evidence.

- **Laptop:** the lit letter case in 3D on `/` and `/case`; "Open on Meta Quest" sends the page to a headset. Tested in CI (Chromium).
- **Phone:** the case in your room at real size on `/case/ar` (AR Quick Look on iPhone, Scene Viewer on Android), and the case on the printed card on `/ar/marker`. Built for, not yet tested on a phone.
- **Meta Quest:** Enter VR, and Place on your wall in passthrough. Built for, not yet tested in a headset. CI runs both in an emulated Quest 3.
- **Apple Vision Pro:** Enter VR, and a room with the case on its wall on `/vision`. Built for, not yet tested.

## Run it

Requires Node 22.19 or newer.

```sh
npm ci
sh scripts/install-hooks.sh   # pre-commit secret scan (needs gitleaks)
npm run dev
```

## Check it

```sh
npm run lint
npm run typecheck
npm test                 # unit tests, offline
npm run build
npm run e2e              # Playwright on the build: routes, keyboard, no-JS, no-WebGL, axe, budgets, XR and AR
npx lhci autorun         # Lighthouse budgets on the build
npm run links            # every outside link: Try links past their home page, repos, films
```

CI runs all of these on every pull request and push to `main`, plus a full-history secret scan. The link check also runs daily.

## Build the 3D and AR files

Generated files are committed, so a normal build needs none of this. Each command checks its output and changes nothing if a check fails.

```sh
npm run case:posters          # Blender renders of the case (light and dark)
npm run case:models           # case.glb and case.usdz (glTF validator, usdchecker --arkit)
npm run vision:room           # the Vision Pro room USDZ and its HDR light (usdchecker --arkit)
npm run marker:card           # the printable card, its image target and the CI camera videos
npm run vendor:model-viewer   # self-hosted third-party builds, with SHA-256 records
npm run vendor:8thwall
```

## The measured number

`/proof` shows First Contentful Paint on a throttled phone (390 by 844 at DPR 3, Chrome DevTools "Slow 4G", 4x CPU slowdown, five cold runs). Re-measure with:

```sh
npm run measure:fcp -- "new preview=https://<deployment>/" "old site=https://stephensookra.com/"
```

The script writes `src/content/measurements/fcp.json`; nothing in that file is typed by hand.

## Stack

**Site:** Next.js 16 (App Router), React 19, TypeScript (strict), Tailwind CSS 4, Zod, Vitest, Playwright, Lighthouse CI, GitHub Actions, Vercel.

**XR and AR:**

- three.js and React Three Fiber for the 3D case; troika-three-text for headset labels.
- WebXR through @react-three/xr: VR, and Quest passthrough with hit testing (a wall where the reader looks) and anchors.
- The open-source 8th Wall engine (MIT, image targets only), self-hosted, for marker AR.
- model-viewer, self-hosted, for 3D and Scene Viewer on phones; AR Quick Look on iPhone.
- The HTML `<model>` element for the Vision Pro room (`requestImmersive`).
- Blender, run headless, for the case renders and the GLB and USDZ models, checked by the Khronos glTF validator and Apple's `usdchecker --arkit`.
- IWER (with its synthetic room) for the emulated-headset tests in CI.

Third-party files and their licenses are listed in `THIRD_PARTY_NOTICES.md`.

## License

The source code is MIT licensed (see `LICENSE`). The written copy, images, videos, resume and other personal content are not licensed for reuse.
