import { describe, expect, it } from "vitest";
import { fcpMeasurement, fcpSchema, median } from "@/content/measurements";

describe("median", () => {
  it("takes the middle of an odd list and the mean of the middle two of an even list", () => {
    expect(median([5, 1, 3])).toBe(3);
    expect(median([4, 1, 3, 2])).toBe(2.5);
  });
});

describe("committed FCP measurement", () => {
  it("parses against its schema", () => {
    expect(() => fcpSchema.parse(fcpMeasurement)).not.toThrow();
  });

  it("uses the DevTools Slow 4G preset, 4x CPU slowdown and a 390x844 DPR 3 phone", () => {
    expect(fcpMeasurement.profile.network).toMatchObject({
      name: "Slow 4G",
      latencyMs: 562.5,
      downloadBytesPerSecond: 180000,
      uploadBytesPerSecond: 84375,
    });
    expect(fcpMeasurement.profile.cpuSlowdown).toBe(4);
    expect(fcpMeasurement.profile.viewport).toEqual({ width: 390, height: 844 });
    expect(fcpMeasurement.profile.deviceScaleFactor).toBe(3);
  });

  it("measures the old site and the new preview, five cold runs each, with honest medians", () => {
    expect(fcpMeasurement.sites.map((s) => s.label).sort()).toEqual(["new preview", "old site"]);
    for (const site of fcpMeasurement.sites) {
      expect(site.runsMs, site.label).toHaveLength(5);
      for (const run of site.runsMs) expect(run, site.label).toBeGreaterThan(0);
      expect(site.medianMs, site.label).toBe(median(site.runsMs));
    }
  });
});
