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

  const withRuns = (conclusions: (string | null)[]) =>
    fakeFetch({
      ...okRoutes,
      "/repos/StephenSook/case-light/actions/runs": {
        body: { total_count: conclusions.length, workflow_runs: conclusions.map((conclusion) => ({ conclusion })) },
      },
    }).fetcher;
  const ciOf = async (conclusions: (string | null)[]) => {
    const status = await getRepoStatus("StephenSook/case-light", withRuns(conclusions));
    return status.state === "ok" ? status.ci : status.state;
  };

  it("reports ci failing when any workflow on the head commit failed, even if another passed", async () => {
    expect(await ciOf(["success", "failure"])).toBe("failing");
    expect(await ciOf(["timed_out", "success"])).toBe("failing");
  });

  it("reports ci passing when every workflow that finished on the head commit succeeded", async () => {
    expect(await ciOf(["success", "success", "skipped"])).toBe("passing");
  });

  it("gives no verdict from cancelled or skipped runs alone", async () => {
    expect(await ciOf(["cancelled", "skipped"])).toBe("none");
  });

  it("asks for every completed push run on the default branch's head commit, so scheduled probes do not count as CI", async () => {
    const { fetcher, calls } = fakeFetch(okRoutes);
    await getRepoStatus("StephenSook/case-light", fetcher);
    const runs = calls.find((c) => c.url.includes("/actions/runs"))!;
    const params = new URL(runs.url).searchParams;
    expect(params.get("head_sha")).toBe("79a8d54");
    expect(params.get("event")).toBe("push");
    expect(params.get("status")).toBe("completed");
    expect(params.get("per_page")).toBe("100");
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
