import { z } from "zod";

export type RepoStatus =
  | {
      state: "ok";
      repo: string;
      url: string;
      /** ISO timestamp of the newest commit on the default branch. */
      lastCommit: string;
      stars: number;
      /** Push-triggered workflow runs on the default branch's head commit: failing if any failed. */
      ci: "passing" | "failing" | "none";
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

const branchSchema = z.object({
  commit: z.object({
    sha: z.string().min(7),
    commit: z.object({ committer: z.object({ date: z.string() }) }),
  }),
});

/** Conclusions that say whether CI passed. Cancelled, skipped and neutral runs say nothing. */
const VERDICTS = new Set(["success", "failure", "timed_out", "startup_failure", "action_required"]);

/** CI for one commit: failing if any workflow failed, passing if all that gave a verdict passed. */
function ciVerdict(conclusions: (string | null)[]): "passing" | "failing" | "none" {
  const verdicts = conclusions.filter((c): c is string => c !== null && VERDICTS.has(c));
  if (verdicts.length === 0) return "none";
  return verdicts.every((c) => c === "success") ? "passing" : "failing";
}

const runsSchema = z.object({
  total_count: z.number().int().nonnegative(),
  workflow_runs: z.array(z.object({ conclusion: z.string().nullable() })),
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
    // Every completed push run on the head commit, so one passing workflow cannot hide a
    // failing sibling. Push runs only: scheduled uptime probes are not CI.
    const runs = await readJson(
      fetcher,
      `/repos/${repo}/actions/runs?head_sha=${head.commit.sha}&event=push&status=completed&per_page=100`,
      runsSchema,
    );
    const ci = ciVerdict(runs.workflow_runs.map((r) => r.conclusion));

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
