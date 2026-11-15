import { describe, expect, it } from "vitest";
import { featured } from "@/content";
import spec from "@/scene/case-spec.json";
import { buildLayout, slotIndex, type Box } from "@/scene/layout";

const layout = buildLayout(spec);
const EPS = 1e-9;

const left = (b: Box) => b.x - b.w / 2;
const right = (b: Box) => b.x + b.w / 2;
const bottom = (b: Box) => b.y - b.h / 2;
const top = (b: Box) => b.y + b.h / 2;
const overlaps = (a: Box, b: Box) =>
  left(a) < right(b) - EPS && left(b) < right(a) - EPS && bottom(a) < top(b) - EPS && bottom(b) < top(a) - EPS;
const inside = (inner: Box, outer: { width: number; height: number }) =>
  left(inner) >= -outer.width / 2 - EPS &&
  right(inner) <= outer.width / 2 + EPS &&
  bottom(inner) >= -outer.height / 2 - EPS &&
  top(inner) <= outer.height / 2 + EPS;

describe("case model", () => {
  it("is 1.6 m wide and 1.0 m tall (design brief section 9)", () => {
    expect(layout.width).toBe(1.6);
    expect(layout.height).toBe(1.0);
  });

  it("holds the six featured projects in grid order, row A then row B", () => {
    expect(layout.projectSlots.map((s) => s.slug)).toEqual(featured.map((p) => p.slug));
    expect(layout.projectSlots.map((s) => `${s.row}${s.col}`)).toEqual(["A1", "A2", "A3", "B1", "B2", "B3"]);
  });

  it("lays row A above row B and orders columns left to right", () => {
    const [a1, a2, a3, b1] = layout.projectSlots;
    expect(a1.opening.y).toBeGreaterThan(b1.opening.y);
    expect(a1.opening.x).toBeLessThan(a2.opening.x);
    expect(a2.opening.x).toBeLessThan(a3.opening.x);
  });

  it("keeps every cell inside the frame and no two cells overlapping", () => {
    const cells = [...layout.projectSlots.map((s) => s.opening), ...layout.smallCells];
    for (const c of cells) expect(inside(c, layout)).toBe(true);
    for (let i = 0; i < cells.length; i++)
      for (let j = i + 1; j < cells.length; j++) expect(overlaps(cells[i], cells[j]), `${i} vs ${j}`).toBe(false);
  });

  it("fills the shelves above and below the project rows with small cells at least one inch wide", () => {
    const projectTop = Math.max(...layout.projectSlots.map((s) => top(s.opening)));
    const projectBottom = Math.min(...layout.projectSlots.map((s) => bottom(s.opening)));
    expect(layout.smallCells.some((c) => bottom(c) >= projectTop - EPS)).toBe(true);
    expect(layout.smallCells.some((c) => top(c) <= projectBottom + EPS)).toBe(true);
    for (const c of layout.smallCells) expect(c.w).toBeGreaterThanOrEqual(0.0254);
  });

  it("puts each slot back behind its opening, at the back of the case", () => {
    for (const s of layout.projectSlots) {
      expect(s.back.x).toBeCloseTo(s.opening.x, 9);
      expect(s.back.y).toBeCloseTo(s.opening.y, 9);
      expect(s.back.z).toBeLessThan(s.opening.z);
    }
  });
});

describe("slotIndex", () => {
  it("finds every project and returns -1 for anything else", () => {
    featured.forEach((p, i) => expect(slotIndex(layout, p.slug)).toBe(i));
    expect(slotIndex(layout, "saber")).toBe(-1);
  });
});
