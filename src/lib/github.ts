import { z } from "zod";

export type RepoStatus =
  | {
      state: "ok";
      repo: string;
      url: string;
      /** ISO timestamp of the newest commit on the default branch. */
      lastCommit: string;
      stars: number;
      /** Conclusion of the newest completed push-triggered workflow run on the default branch. */
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
  commit: z.object({ commit: z.object({ committer: z.object({ date: z.string() }) }) }),
});

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
    const [head, runs] = await Promise.all([
      readJson(fetcher, `/repos/${repo}/branches/${branch}`, branchSchema),
      readJson(
        fetcher,
        // Push runs only: scheduled uptime probes on the same branch are not CI.
        `/repos/${repo}/actions/runs?branch=${branch}&event=push&status=completed&per_page=1`,
        runsSchema,
      ),
    ]);

    const latest = runs.workflow_runs[0];
    const ci = runs.total_count === 0 || !latest ? "none" : latest.conclusion === "success" ? "passing" : "failing";

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
