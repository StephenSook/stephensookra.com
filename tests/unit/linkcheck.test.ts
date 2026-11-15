import { describe, expect, it } from "vitest";
import { evaluateFilm, evaluateRepo, evaluateTry } from "@/lib/linkcheck";

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
