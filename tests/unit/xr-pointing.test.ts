import { describe, expect, it } from "vitest";
import { createPointing } from "@/xr/pointing";

describe("pointing", () => {
  it("names what the headset pointer is on, on the session element", () => {
    const el = document.createElement("div");
    const p = createPointing(el);
    p.over("instanter");
    expect(el.dataset.pointing).toBe("instanter");
  });

  it("clears only when leaving the thing it names, whatever order over and out arrive in", () => {
    const el = document.createElement("div");
    const p = createPointing(el);
    p.over("instanter");
    p.over("aloud"); // entered the next target before leaving the last
    p.out("instanter");
    expect(el.dataset.pointing).toBe("aloud");
    p.out("aloud");
    expect(el.dataset.pointing).toBe("");
  });

  it("says where the pulled card is: out, moving or in, so a test can wait for the card, not a clock", () => {
    const el = document.createElement("div");
    const p = createPointing(el);
    p.card("moving");
    expect(el.dataset.card).toBe("moving");
    p.card("out");
    expect(el.dataset.card).toBe("out");
    p.card("in");
    expect(el.dataset.card).toBe("in");
  });

  it("does nothing without an element", () => {
    const p = createPointing(null);
    expect(() => (p.over("card"), p.out("card"), p.card("out"))).not.toThrow();
  });
});
