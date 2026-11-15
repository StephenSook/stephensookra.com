import { describe, expect, it } from "vitest";
import { formatMs, formatNumber, formatSeconds } from "@/lib/format";

describe("formatNumber", () => {
  it("groups thousands without a unit", () => {
    expect(formatNumber(2392)).toBe("2,392");
  });
});

describe("formatSeconds", () => {
  it("writes milliseconds as seconds with two decimals", () => {
    expect(formatSeconds(2328)).toBe("2.33 s");
    expect(formatSeconds(905)).toBe("0.91 s");
  });
});

describe("formatMs", () => {
  it("groups thousands", () => {
    expect(formatMs(2328)).toBe("2,328 ms");
    expect(formatMs(905.5)).toBe("905.5 ms");
  });
});
