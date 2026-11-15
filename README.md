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
npm test
npm run build
```

CI runs the same checks on every push and pull request.

## Stack

Next.js 16 (App Router), React 19, TypeScript (strict), Tailwind CSS 4, Vitest, GitHub Actions, Vercel.

## License

The source code is MIT licensed (see `LICENSE`). The written copy, images, videos, resume and other personal content are not licensed for reuse.
