/**
 * Pure verdicts for the link checker (tests/links). A Try link passes only when a
 * route past the home page answers 200 with text that appears when the core works;
 * a page that loads over a dead backend fails.
 */
export type Verdict = { ok: boolean; reason: string };

export function evaluateTry(res: { status: number; body: string }, expectText: string): Verdict {
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
