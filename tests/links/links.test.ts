// Network checks for every outside link on the site. Run with `npm run links`.
// Try links must pass their core-path check; repos must be public; films must be public.
import { describe, expect, it } from "vitest";
import { projects } from "@/content";
import { evaluateFilm, evaluateRepo, evaluateTry, type Verdict } from "@/lib/linkcheck";

const TIMEOUT_MS = 90_000; // Render free services can take over a minute to wake up.
const ATTEMPTS = 3;
const RETRY_WAIT_MS = 30_000;
// A sleeping Render service can answer 502, 503 or 504 while it boots (Throughline's
// API returns 503 until its startup reconciliation finishes). Retry those; a service
// that is still down after three tries fails the check.
const WAKING = new Set([502, 503, 504]);
const UA = "stephensookra.com link check (+https://github.com/StephenSook/stephensookra.com)";

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function get(url: string, headers: Record<string, string> = {}) {
  let last: { status: number; body: string } | undefined;
  let lastError: unknown;
  for (let attempt = 1; attempt <= ATTEMPTS; attempt++) {
    if (attempt > 1) await wait(RETRY_WAIT_MS);
    try {
      const res = await fetch(url, { headers: { "user-agent": UA, ...headers }, signal: AbortSignal.timeout(TIMEOUT_MS) });
      last = { status: res.status, body: await res.text() };
      if (!WAKING.has(res.status)) return last;
    } catch (error) {
      lastError = error;
    }
  }
  if (last) return last;
  throw new Error(`${url}: ${(lastError as Error).message}`);
}

function expectOk(verdict: Verdict, what: string) {
  expect(verdict.ok, `${what}: ${verdict.reason}`).toBe(true);
}

const links = projects.flatMap((p) => p.links.map((link) => ({ project: p.title, link })));

describe("Try links pass their core-path check", () => {
  const tries = links.filter((l) => l.link.kind === "try");
  it("there are Try links to check", () => expect(tries.length).toBeGreaterThan(0));
  it.each(tries)("$project", async ({ project, link }) => {
    const res = await get(link.check!.url);
    expectOk(evaluateTry(res, link.check!.expectText), `${project} ${link.check!.url}`);
    const home = await get(link.url);
    expect(home.status, `${project} home ${link.url}`).toBe(200);
  });
});

describe("repos are public", () => {
  const token = process.env.GITHUB_TOKEN;
  const repos = links.filter((l) => l.link.kind === "repo");
  it.each(repos)("$project", async ({ project, link }) => {
    const name = new URL(link.url).pathname.slice(1);
    const res = await get(`https://api.github.com/repos/${name}`, token ? { authorization: `Bearer ${token}` } : {});
    expectOk(evaluateRepo(res.status, JSON.parse(res.body)), `${project} ${name}`);
  });
});

describe("films are public", () => {
  const films = links.filter((l) => l.link.kind === "film");
  it.each(films)("$project", async ({ project, link }) => {
    const res = await get(`https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(link.url)}`);
    expectOk(evaluateFilm(res.status, res.status === 200 ? JSON.parse(res.body) : {}), `${project} ${link.url}`);
  });
});
