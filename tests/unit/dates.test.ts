import { describe, expect, it } from "vitest";
import { formatDate, formatMonth, formatShortDate, isPast } from "@/lib/dates";

describe("formatShortDate", () => {
  it("writes month and day only", () => {
    expect(formatShortDate("2026-11-19")).toBe("Nov 19");
  });
});

describe("formatDate", () => {
  it("formats an ISO timestamp as a short US date in UTC", () => {
    expect(formatDate("2026-11-04T08:22:08Z")).toBe("Nov 4, 2026");
  });

  it("formats a plain yyyy-mm-dd date without shifting the day", () => {
    expect(formatDate("2026-11-19")).toBe("Nov 19, 2026");
  });
});

describe("formatMonth", () => {
  it("writes a yyyy-mm month in full", () => {
    expect(formatMonth("2026-03")).toBe("March 2026");
  });
});

describe("isPast", () => {
  it("is true the day after the date", () => {
    expect(isPast("2026-11-19", new Date("2026-11-20T00:00:00Z"))).toBe(true);
  });

  it("is false on the date itself", () => {
    expect(isPast("2026-11-19", new Date("2026-11-19T23:59:00Z"))).toBe(false);
  });
});
