<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Build and test

Node 22.19 or newer (`.nvmrc`). Install with `npm ci`.

| Task | Command |
|---|---|
| Dev server | `npm run dev` |
| Lint | `npm run lint` |
| Type check | `npm run typecheck` |
| Unit tests (Vitest) | `npm test` |
| Production build | `npm run build` |
| Serve the build | `npm run start` |

Run `sh scripts/install-hooks.sh` once after cloning. It adds a pre-commit hook that scans staged changes with gitleaks.

## Conventions

- Every fact on the site lives in `src/content/`. Pages and components read from there; they never hard-code a number, a prize or a link.
- A number on the site comes from `src/content/`, a committed measurement file, or a build-time read of the public GitHub API. When a live read fails, the page says "not available".
- Site copy uses plain words and straight quotes, with no em dashes or en dashes.
