import { afterEach, describe, expect, it, vi } from "vitest";
import { getRepoStatus, getRepoStatuses } from "@/lib/github";

type Route = { status?: number; body?: unknown; raw?: string; throws?: Error };

/** A fake fetch that answers GitHub REST paths (exact pathname, query ignored) from a route table. */
function fakeFetch(routes: Record<string, Route>) {
  const calls: { url: string; init?: RequestInit }[] = [];
  const fetcher = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    calls.push({ url, init });
    const route = routes[new URL(url).pathname];
    if (!route) return new Response("not found", { status: 404 });
    if (route.throws) throw route.throws;
    const text = route.raw ?? JSON.stringify(route.body);
    return new Response(text, { status: route.status ?? 200, headers: { "content-type": "application/json" } });
  }) as typeof fetch;
  return { fetcher, calls };
}

const okRoutes: Record<string, Route> = {
  "/repos/StephenSook/case-light/branches/main": {
    body: { commit: { sha: "79a8d54", commit: { committer: { date: "2026-11-04T08:22:08Z" } } } },
  },
  "/repos/StephenSook/case-light/actions/runs": {
    body: { total_count: 12, workflow_runs: [{ conclusion: "success" }] },
  },
  "/repos/StephenSook/case-light": {
    body: { private: false, stargazers_count: 3, default_branch: "main", license: { spdx_id: "MIT" } },
  },
};

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("getRepoStatus", () => {
  it("maps the three GitHub reads into one status", async () => {
    const { fetcher } = fakeFetch(okRoutes);
    expect(await getRepoStatus("StephenSook/case-light", fetcher)).toEqual({
      state: "ok",
      repo: "StephenSook/case-light",
      url: "https://github.com/StephenSook/case-light",
      lastCommit: "2026-11-04T08:22:08Z",
      stars: 3,
      ci: "passing",
      license: "MIT",
    });
  });

  it("reports ci none when the repo has never completed a workflow run", async () => {
    const { fetcher } = fakeFetch({
      ...okRoutes,
      "/repos/StephenSook/case-light/actions/runs": { body: { total_count: 0, workflow_runs: [] } },
    });
    const status = await getRepoStatus("StephenSook/case-light", fetcher);
    expect(status.state === "ok" && status.ci).toBe("none");
  });

  it("reports ci failing when the latest completed run did not succeed", async () => {
    const { fetcher } = fakeFetch({
      ...okRoutes,
      "/repos/StephenSook/case-light/actions/runs": {
        body: { total_count: 4, workflow_runs: [{ conclusion: "failure" }] },
      },
    });
    const status = await getRepoStatus("StephenSook/case-light", fetcher);
    expect(status.state === "ok" && status.ci).toBe("failing");
  });

  it("asks for the latest completed push run on the default branch, so scheduled probes do not count as CI", async () => {
    const { fetcher, calls } = fakeFetch(okRoutes);
    await getRepoStatus("StephenSook/case-light", fetcher);
    const runs = calls.find((c) => c.url.includes("/actions/runs"))!;
    const params = new URL(runs.url).searchParams;
    expect(params.get("branch")).toBe("main");
    expect(params.get("event")).toBe("push");
    expect(params.get("status")).toBe("completed");
    expect(params.get("per_page")).toBe("1");
  });

  it.each([
    ["rate limited", { status: 403, body: { message: "API rate limit exceeded" } }],
    ["missing", { status: 404, body: { message: "Not Found" } }],
    ["server error", { status: 500, body: {} }],
    ["not JSON", { raw: "<html>oops</html>" }],
    ["network error", { throws: new TypeError("fetch failed") }],
    ["timeout", { throws: new DOMException("The operation timed out.", "TimeoutError") }],
  ] as const)("returns unavailable and does not throw when the repo read is %s", async (_label, route) => {
    const { fetcher } = fakeFetch({ ...okRoutes, "/repos/StephenSook/case-light": route as Route });
    const status = await getRepoStatus("StephenSook/case-light", fetcher);
    expect(status).toEqual({
      state: "unavailable",
      repo: "StephenSook/case-light",
      url: "https://github.com/StephenSook/case-light",
    });
  });

  it("returns unavailable when a later read fails", async () => {
    const { fetcher } = fakeFetch({
      ...okRoutes,
      "/repos/StephenSook/case-light/actions/runs": { status: 502, body: {} },
    });
    expect((await getRepoStatus("StephenSook/case-light", fetcher)).state).toBe("unavailable");
  });

  it("treats a private repo as unavailable", async () => {
    const { fetcher } = fakeFetch({
      ...okRoutes,
      "/repos/StephenSook/case-light": { body: { ...okRoutes["/repos/StephenSook/case-light"].body as object, private: true } },
    });
    expect((await getRepoStatus("StephenSook/case-light", fetcher)).state).toBe("unavailable");
  });

  it("reads each repo once and keys the results by repo", async () => {
    const { fetcher, calls } = fakeFetch(okRoutes);
    const statuses = await getRepoStatuses(["StephenSook/case-light", "StephenSook/case-light"], fetcher);
    expect(Object.keys(statuses)).toEqual(["StephenSook/case-light"]);
    expect(statuses["StephenSook/case-light"].state).toBe("ok");
    expect(calls.filter((c) => new URL(c.url).pathname === "/repos/StephenSook/case-light")).toHaveLength(1);
  });

  it("sends a token only when GITHUB_TOKEN is set", async () => {
    vi.stubEnv("GITHUB_TOKEN", "");
    const anon = fakeFetch(okRoutes);
    await getRepoStatus("StephenSook/case-light", anon.fetcher);
    const anonHeaders = new Headers(anon.calls[0].init?.headers);
    expect(anonHeaders.has("authorization")).toBe(false);

    vi.stubEnv("GITHUB_TOKEN", "test-token");
    const authed = fakeFetch(okRoutes);
    await getRepoStatus("StephenSook/case-light", authed.fetcher);
    expect(new Headers(authed.calls[0].init?.headers).get("authorization")).toBe("Bearer test-token");
  });
});
