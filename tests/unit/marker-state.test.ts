import { describe, expect, it } from "vitest";
import { next, running, STATUS, type MarkerState } from "@/ar/marker/state";

const ALL: MarkerState[] = ["idle", "loading", "scanning", "tracking", "lost", "stopped", "denied", "nocamera", "failed"];

describe("marker AR state", () => {
  it("runs the happy path: press, camera, card found, card lost, found again, stop", () => {
    let s: MarkerState = "idle";
    s = next(s, "start");
    expect(s).toBe("loading");
    s = next(s, "camera");
    expect(s).toBe("scanning");
    s = next(s, "found");
    expect(s).toBe("tracking");
    s = next(s, "lost");
    expect(s).toBe("lost");
    s = next(s, "found");
    expect(s).toBe("tracking");
    s = next(s, "stop");
    expect(s).toBe("idle");
  });

  it("stops the camera when the page is hidden, and only while it runs", () => {
    for (const s of ["loading", "scanning", "tracking", "lost"] as const) expect(next(s, "hidden")).toBe("stopped");
    for (const s of ["idle", "stopped", "denied", "nocamera", "failed"] as const) expect(next(s, "hidden")).toBe(s);
  });

  it("reports why the camera did not start, from any running state", () => {
    for (const s of ["loading", "scanning", "tracking", "lost"] as const) {
      expect(next(s, "denied")).toBe("denied");
      expect(next(s, "nocamera")).toBe("nocamera");
      expect(next(s, "failed")).toBe("failed");
    }
  });

  it("starts again from every resting state, and ignores a second press while running", () => {
    for (const s of ["idle", "stopped", "denied", "nocamera", "failed"] as const) expect(next(s, "start")).toBe("loading");
    for (const s of ["loading", "scanning", "tracking", "lost"] as const) expect(next(s, "start")).toBe(s);
  });

  it("ignores tracking events that arrive outside a run (a late event after Stop)", () => {
    for (const e of ["camera", "found", "lost"] as const) {
      for (const s of ["idle", "stopped", "denied", "nocamera", "failed"] as const) expect(next(s, e)).toBe(s);
    }
    expect(next("loading", "found")).toBe("loading"); // the card cannot be found before the camera runs
    expect(next("scanning", "lost")).toBe("scanning");
  });

  it("says something plain for every state but idle, with no dashes or curly quotes", () => {
    for (const s of ALL) {
      if (s === "idle") expect(STATUS[s]).toBe("");
      else expect(STATUS[s]).toMatch(/^[A-Z][^–—‘’“”]+\.?$/);
    }
    expect(STATUS.denied).toMatch(/allow/i); // says how to fix it
  });

  it("knows which states hold the camera", () => {
    expect(ALL.filter(running)).toEqual(["loading", "scanning", "tracking", "lost"]);
  });
});
