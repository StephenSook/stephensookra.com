// Network checks for every outside link on the site. Run with `npm run links`.
// Try links must pass their core-path check; repos must be public; films must be public.
import { describe, expect, it } from "vitest";
import { projects } from "@/content";
import { evaluateFilm, evaluateRepo, evaluateTry, fetchWaking, type Verdict } from "@/lib/linkcheck";

const TIMEOUT_MS = 90_000; // a booting Render service can hold a request for most of a minute
const NETWORK_TRIES = 3;
const NETWORK_WAIT_MS = 10_000;
const UA = "stephensookra.com link check (+https://github.com/StephenSook/stephensookra.com)";

const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/** One request, retried only when the network itself fails. */
async function fetchOnce(url: string, headers: Record<string, string> = {}) {
  let lastError: unknown;
  for (let attempt = 1; attempt <= NETWORK_TRIES; attempt++) {
    if (attempt > 1) await wait(NETWORK_WAIT_MS);
    try {
      const res = await fetch(url, { headers: { "user-agent": UA, ...headers }, signal: AbortSignal.timeout(TIMEOUT_MS) });
      return { status: res.status, body: await res.text() };
    } catch (error) {
      lastError = error;
    }
  }
  throw new Error(`${url}: ${(lastError as Error).message}`);
}

/** Wake, then check: a sleeping Render host gets about 90 s to boot (src/lib/linkcheck.ts). */
const get = (url: string, headers: Record<string, string> = {}) => fetchWaking(url, (u) => fetchOnce(u, headers), wait);

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
