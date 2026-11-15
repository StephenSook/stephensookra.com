import { describe, expect, it, vi } from "vitest";
import { evaluateFilm, evaluateRepo, evaluateTry, fetchWaking, WAKE_BACKOFF_MS } from "@/lib/linkcheck";

describe("evaluateTry", () => {
  it("passes when the core route answers 200 with the expected text", () => {
    expect(evaluateTry({ status: 200, body: '{"status":"found","read":{}}' }, '"status":"found"')).toEqual({
      ok: true,
      reason: "core route answered with the expected text",
    });
  });

  it("fails a page that loads but whose core does not work", () => {
    expect(evaluateTry({ status: 200, body: "<html>Welcome</html>" }, '"status":"found"')).toEqual({
      ok: false,
      reason: "expected text missing",
    });
  });

  it.each([404, 500, 503])("fails on HTTP %i", (status) => {
    expect(evaluateTry({ status, body: '"status":"found"' }, '"status":"found"')).toEqual({
      ok: false,
      reason: `HTTP ${status}`,
    });
  });
});

describe("evaluateRepo", () => {
  it("passes a public repo", () => {
    expect(evaluateRepo(200, { private: false }).ok).toBe(true);
  });

  it("fails a private repo, a missing repo and an unexpected body", () => {
    expect(evaluateRepo(200, { private: true })).toEqual({ ok: false, reason: "repo is private" });
    expect(evaluateRepo(404, { message: "Not Found" })).toEqual({ ok: false, reason: "HTTP 404" });
    expect(evaluateRepo(200, "nope")).toEqual({ ok: false, reason: "unexpected response" });
  });
});

describe("evaluateFilm", () => {
  it("passes a public video that oEmbed describes", () => {
    expect(evaluateFilm(200, { title: "Case Light", type: "video" }).ok).toBe(true);
  });

  it("fails a private or removed video", () => {
    expect(evaluateFilm(401, {})).toEqual({ ok: false, reason: "HTTP 401" });
    expect(evaluateFilm(404, {})).toEqual({ ok: false, reason: "HTTP 404" });
    expect(evaluateFilm(200, {})).toEqual({ ok: false, reason: "no title in oEmbed" });
  });
});

describe("fetchWaking (wake, then check)", () => {
  const API = "https://throughline-api-yo1p.onrender.com/api/summary";
  /** Answers each call with the next status in the list (the last one repeats). */
  const answers = (...statuses: number[]) => {
    let i = 0;
    return vi.fn(async () => ({ status: statuses[Math.min(i++, statuses.length - 1)], body: "{}" }));
  };
  const waits: number[] = [];
  const wait = async (ms: number) => void waits.push(ms);

  it("keeps asking a sleeping Render host that answers 503 while it boots, with growing waits", async () => {
    waits.length = 0;
    const fetcher = answers(503, 503, 200);
    const res = await fetchWaking(API, fetcher, wait);
    expect(res.status).toBe(200);
    expect(fetcher).toHaveBeenCalledTimes(3);
    expect(waits).toEqual(WAKE_BACKOFF_MS.slice(0, 2));
  });

  it("gives up after about 90 s of waking, and the verdict names the host and the wait", async () => {
    waits.length = 0;
    const res = await fetchWaking(API, answers(503), wait);
    const waited = waits.reduce((a, b) => a + b, 0);
    expect(waited).toBeGreaterThanOrEqual(85_000);
    expect(waited).toBeLessThanOrEqual(95_000);
    expect(res.tries).toBe(WAKE_BACKOFF_MS.length + 1);
    expect(evaluateTry(res, "x").reason).toBe(
      `HTTP 503 from throughline-api-yo1p.onrender.com, still not awake after ${Math.round(waited / 1000)} s`,
    );
  });

  it("does not retry hosts that do not sleep, or answers that are not about waking", async () => {
    waits.length = 0;
    const other = answers(503, 200);
    expect((await fetchWaking("https://example.org/api", other, wait)).status).toBe(503);
    expect(other).toHaveBeenCalledTimes(1);
    const missing = answers(404, 200);
    expect((await fetchWaking(API, missing, wait)).status).toBe(404);
    expect(missing).toHaveBeenCalledTimes(1);
    expect(waits).toEqual([]);
  });
});

