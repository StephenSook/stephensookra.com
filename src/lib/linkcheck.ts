/**
 * Pure verdicts for the link checker (tests/links). A Try link passes only when a
 * route past the home page answers 200 with text that appears when the core works;
 * a page that loads over a dead backend fails.
 */
export type Verdict = { ok: boolean; reason: string };

export type CheckResponse = { status: number; body: string };
/** A response, and how it was got: from which host, after how many tries and how long waiting. */
export type WokenResponse = CheckResponse & { host: string; tries: number; waitedMs: number };

/** Hosts that sleep when idle (free tiers) and answer 502, 503 or 504 while they boot. */
export const SLEEPING_HOSTS = [/\.onrender\.com$/];
export const WAKING_STATUS = new Set([502, 503, 504]);
/** Waits between tries while a sleeping host boots: 90 s in all. No keepalive pings. */
export const WAKE_BACKOFF_MS = [5_000, 10_000, 15_000, 20_000, 20_000, 20_000];

/**
 * Wake, then check. A known sleeping host that answers 502, 503 or 504 is asked again with
 * growing waits until it answers anything else or about 90 s of waiting have passed. Any
 * other host, or any other answer, is returned from the first try.
 */
export async function fetchWaking(
  url: string,
  fetcher: (url: string) => Promise<CheckResponse>,
  wait: (ms: number) => Promise<void>,
): Promise<WokenResponse> {
  const host = new URL(url).hostname;
  const sleeps = SLEEPING_HOSTS.some((pattern) => pattern.test(host));
  let res = await fetcher(url);
  let tries = 1;
  let waitedMs = 0;
  while (sleeps && WAKING_STATUS.has(res.status) && tries <= WAKE_BACKOFF_MS.length) {
    const ms = WAKE_BACKOFF_MS[tries - 1];
    await wait(ms);
    waitedMs += ms;
    res = await fetcher(url);
    tries += 1;
  }
  return { ...res, host, tries, waitedMs };
}

export function evaluateTry(res: CheckResponse & Partial<WokenResponse>, expectText: string): Verdict {
  if (res.status !== 200 && res.host && res.waitedMs && WAKING_STATUS.has(res.status))
    return {
      ok: false,
      reason: `HTTP ${res.status} from ${res.host}, still not awake after ${Math.round(res.waitedMs / 1000)} s`,
    };
  if (res.status !== 200) return { ok: false, reason: `HTTP ${res.status}` };
  if (!res.body.includes(expectText)) return { ok: false, reason: "expected text missing" };
  return { ok: true, reason: "core route answered with the expected text" };
}

/** GitHub REST /repos/{owner}/{name}: the repo must exist and be public. */
export function evaluateRepo(status: number, json: unknown): Verdict {
  if (status !== 200) return { ok: false, reason: `HTTP ${status}` };
  if (!json || typeof json !== "object" || !("private" in json)) return { ok: false, reason: "unexpected response" };
  if ((json as { private: unknown }).private !== false) return { ok: false, reason: "repo is private" };
  return { ok: true, reason: "public repo" };
}

/** YouTube oEmbed answers 200 with a title only for public or unlisted videos. */
export function evaluateFilm(status: number, json: unknown): Verdict {
  if (status !== 200) return { ok: false, reason: `HTTP ${status}` };
  const title = json && typeof json === "object" && "title" in json ? (json as { title: unknown }).title : undefined;
  if (typeof title !== "string" || title.length === 0) return { ok: false, reason: "no title in oEmbed" };
  return { ok: true, reason: `public video: ${title}` };
}
