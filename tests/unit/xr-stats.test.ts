import { describe, expect, it } from "vitest";
import { createFrameStats, statsText, wantsStats } from "@/xr/frameStats";

describe("frame stats", () => {
  it("averages the last frames only", () => {
    const stats = createFrameStats(4);
    for (const dt of [0.1, 0.1, 1 / 90, 1 / 90, 1 / 90, 1 / 90]) stats.push(dt);
    const s = stats.summary();
    expect(s.avgMs).toBeCloseTo(1000 / 90, 6);
    expect(s.fps).toBeCloseTo(90, 6);
    expect(s.frames).toBe(4);
  });

  it("reports nothing before the first frame", () => {
    expect(createFrameStats().summary()).toEqual({ avgMs: 0, fps: 0, frames: 0 });
  });

  it("says the session's target rate when the browser reports one, and the measured rate", () => {
    expect(statsText(90, { avgMs: 11.11, fps: 90.01, frames: 120 })).toBe("Target 90 Hz. Measured 90.0 fps (11.1 ms a frame).");
    expect(statsText(undefined, { avgMs: 13.9, fps: 71.9, frames: 120 })).toBe(
      "Target not reported. Measured 71.9 fps (13.9 ms a frame).",
    );
    expect(statsText(72, { avgMs: 0, fps: 0, frames: 0 })).toBe("Target 72 Hz. Measuring.");
  });

  it("is off unless the page address asks for it", () => {
    expect(wantsStats("")).toBe(false);
    expect(wantsStats("?xrstats=0")).toBe(false);
    expect(wantsStats("?xrstats=1")).toBe(true);
    expect(wantsStats("?a=b&xrstats=1")).toBe(true);
  });
});
