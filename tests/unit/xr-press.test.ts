import { describe, expect, it } from "vitest";
import { createPresses } from "@/xr/press";

describe("presses", () => {
  it("counts a press that starts and ends on the same target, however long it is held", () => {
    const p = createPresses();
    p.down("instanter", 1);
    // A slow pinch: the pointer library's own click drops anything over 300 ms.
    expect(p.up("instanter", 1)).toBe(true);
  });

  it("does not count a press that ends on another target", () => {
    const p = createPresses();
    p.down("instanter", 1);
    expect(p.up("aloud", 1)).toBe(false);
  });

  it("does not count a press whose pointer left the target before the release", () => {
    const p = createPresses();
    p.down("close", 1);
    p.leave("close", 1);
    expect(p.up("close", 1)).toBe(false);
  });

  it("keeps two pointers apart (two hands)", () => {
    const p = createPresses();
    p.down("instanter", 1);
    p.down("aloud", 2);
    expect(p.up("aloud", 2)).toBe(true);
    expect(p.up("instanter", 1)).toBe(true);
  });

  it("counts each press once", () => {
    const p = createPresses();
    p.down("exit", 1);
    expect(p.up("exit", 1)).toBe(true);
    expect(p.up("exit", 1)).toBe(false);
  });
});
