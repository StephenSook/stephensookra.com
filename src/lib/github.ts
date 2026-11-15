import { z } from "zod";

export type RepoStatus =
  | {
      state: "ok";
      repo: string;
      url: string;
      /** ISO timestamp of the newest commit on the default branch. */
      lastCommit: string;
      stars: number;
      /**
       * Push-triggered workflow runs on the default branch's head commit: failing if any
       * failed, running if any has not finished, passing only when all that gave a verdict passed.
       */
      ci: CiState;
      license: string | null;
    }
  | { state: "unavailable"; repo: string; url: string };

const API = "https://api.github.com";
/** Repo facts refresh once a day. */
export const REVALIDATE_SECONDS = 86_400;
const TIMEOUT_MS = 8_000;

const repoSchema = z.object({
  private: z.boolean(),
  stargazers_count: z.number().int().nonnegative(),
  default_branch: z.string().min(1),
  license: z.object({ spdx_id: z.string().nullable() }).nullable(),
});

export type CiState = "passing" | "failing" | "running" | "none";

const branchSchema = z.object({
  commit: z.object({
    sha: z.string().min(7),
    // A date that cannot be formatted would pass as "ok" and then throw while rendering.
    commit: z.object({ committer: z.object({ date: z.iso.datetime({ offset: true }) }) }),
  }),
});

/** Conclusions that say whether CI passed. Cancelled, skipped and neutral runs say nothing. */
const VERDICTS = new Set(["success", "failure", "timed_out", "startup_failure", "action_required"]);

type Run = { status: string; conclusion: string | null };

/**
 * CI for one commit. A finished failure decides it; otherwise any unfinished run means
 * "running" (a sibling may still fail); otherwise passing if every verdict passed.
 */
function ciVerdict(runs: Run[]): CiState {
  const verdicts = runs.flatMap((r) =>
    r.status === "completed" && r.conclusion !== null && VERDICTS.has(r.conclusion) ? [r.conclusion] : [],
  );
  if (verdicts.some((c) => c !== "success")) return "failing";
  if (runs.some((r) => r.status !== "completed")) return "running";
  return verdicts.length > 0 ? "passing" : "none";
}

const runsSchema = z.object({
  total_count: z.number().int().nonnegative(),
  workflow_runs: z.array(z.object({ status: z.string(), conclusion: z.string().nullable() })),
});

class ReadFailed extends Error {}

async function readJson<T>(fetcher: typeof fetch, path: string, schema: z.ZodType<T>): Promise<T> {
  const headers: Record<string, string> = {
    accept: "application/vnd.github+json",
    "x-github-api-version": "2022-11-28",
  };
  const token = process.env.GITHUB_TOKEN;
  if (token) headers.authorization = `Bearer ${token}`;

  const res = await fetcher(`${API}${path}`, {
    headers,
    signal: AbortSignal.timeout(TIMEOUT_MS),
    next: { revalidate: REVALIDATE_SECONDS },
  });
  if (!res.ok) throw new ReadFailed(`${path}: HTTP ${res.status}`);
  const parsed = schema.safeParse(await res.json());
  if (!parsed.success) throw new ReadFailed(`${path}: unexpected shape`);
  return parsed.data;
}

const RUNS_PER_PAGE = 100;
const MAX_RUN_PAGES = 5;

/**
 * Every push run on one commit, across pages. If the runs cannot all be read (a page
 * fails, or there are more than MAX_RUN_PAGES pages), it throws, and the repo reads
 * "not available" rather than a verdict built on part of the runs.
 */
async function readAllRuns(fetcher: typeof fetch, repo: string, sha: string): Promise<Run[]> {
  const runs: Run[] = [];
  for (let page = 1; page <= MAX_RUN_PAGES; page++) {
    const batch = await readJson(
      fetcher,
      `/repos/${repo}/actions/runs?head_sha=${sha}&event=push&per_page=${RUNS_PER_PAGE}&page=${page}`,
      runsSchema,
    );
    runs.push(...batch.workflow_runs);
    if (runs.length >= batch.total_count || batch.workflow_runs.length === 0) return runs;
  }
  throw new ReadFailed(`/repos/${repo}/actions/runs: more than ${MAX_RUN_PAGES * RUNS_PER_PAGE} runs`);
}

/** Statuses for several repos, each read once, keyed by "owner/name". */
export async function getRepoStatuses(
  repos: string[],
  fetcher: typeof fetch = fetch,
): Promise<Record<string, RepoStatus>> {
  const unique = [...new Set(repos)];
  const results = await Promise.all(unique.map((repo) => getRepoStatus(repo, fetcher)));
  return Object.fromEntries(results.map((status) => [status.repo, status]));
}

/**
 * Live facts about one public repo. Any failed read (rate limit, network,
 * timeout, unexpected JSON, or a private repo) yields `unavailable`, which the
 * site renders as "not available". It never throws, so a GitHub outage cannot
 * break a build.
 */
export async function getRepoStatus(repo: string, fetcher: typeof fetch = fetch): Promise<RepoStatus> {
  const url = `https://github.com/${repo}`;
  try {
    const meta = await readJson(fetcher, `/repos/${repo}`, repoSchema);
    if (meta.private) return { state: "unavailable", repo, url };

    const branch = encodeURIComponent(meta.default_branch);
    const head = await readJson(fetcher, `/repos/${repo}/branches/${branch}`, branchSchema);
    // Every push run on the head commit, finished or not, so one passing workflow cannot
    // hide a failing or unfinished sibling. Push runs only: scheduled uptime probes are not CI.
    const ci = ciVerdict(await readAllRuns(fetcher, repo, head.commit.sha));

    return {
      state: "ok",
      repo,
      url,
      lastCommit: head.commit.commit.committer.date,
      stars: meta.stargazers_count,
      ci,
      license: meta.license?.spdx_id ?? null,
    };
  } catch (error) {
    if (process.env.NODE_ENV !== "test") console.warn(`[github] ${repo} not available: ${(error as Error).message}`);
    return { state: "unavailable", repo, url };
  }
}
