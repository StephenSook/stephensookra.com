# stephensookra.com

Source for [stephensookra.com](https://stephensookra.com), the portfolio of Stephen Sookra, a software engineer in Atlanta focused on XR.

The site is plain, fast HTML first. Every page reads with JavaScript off. Project facts come from one typed content source, and live repository details (last commit, CI status, stars) are read from the public GitHub API at build time and refreshed daily.

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
npm run e2e              # Playwright on the build: routes, keyboard, no-JS, no-WebGL, axe, budgets
npx lhci autorun         # Lighthouse budgets on the build
npm run links            # every outside link: Try links past their home page, repos, films
```

CI runs all of these on every pull request and push to `main`, plus a full-history secret scan. The link check also runs daily.

## The measured number

`/proof` shows First Contentful Paint on a throttled phone (390 by 844 at DPR 3, Chrome DevTools "Slow 4G", 4x CPU slowdown, five cold runs). Re-measure with:

```sh
npm run measure:fcp -- "new preview=https://<deployment>/" "old site=https://stephensookra.com/"
```

The script writes `src/content/measurements/fcp.json`; nothing in that file is typed by hand.

## Stack

Next.js 16 (App Router), React 19, TypeScript (strict), Tailwind CSS 4, Vitest, GitHub Actions, Vercel.

## License

The source code is MIT licensed (see `LICENSE`). The written copy, images, videos, resume and other personal content are not licensed for reuse.
