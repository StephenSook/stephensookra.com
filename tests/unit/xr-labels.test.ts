import { describe, expect, it } from "vitest";
import { featured } from "@/content";
import spec from "@/scene/case-spec.json";
import { buildLayout } from "@/scene/layout";
import { LABEL_SIZE, slotLabels } from "@/xr/labels";

const layout = buildLayout(spec);

describe("slotLabels", () => {
  const labels = slotLabels(layout, featured);

  it("names every project slot with its code and title", () => {
    expect(labels.map((l) => l.text)).toEqual([
      "A1 Case Light",
      "A2 Glare Zone",
      "A3 XR Dojo",
      "B1 VARSITY",
      "B2 Instanter",
      "B3 Aloud",
    ]);
  });

  it("sits inside its slot's lower-left corner, in front of the poster and behind the case face", () => {
    labels.forEach((label, i) => {
      const o = layout.projectSlots[i].opening;
      expect(label.x).toBeGreaterThan(o.x - o.w / 2);
      expect(label.y).toBeGreaterThan(o.y - o.h / 2);
      expect(label.y + LABEL_SIZE).toBeLessThan(o.y);
      expect(label.z).toBeLessThan(layout.depth / 2);
      expect(label.z).toBeGreaterThan(layout.projectSlots[i].back.z);
    });
  });

  it("is large enough to read at the case's 1 m distance (about 1 degree of view or more)", () => {
    expect(LABEL_SIZE).toBeGreaterThanOrEqual(0.017);
  });
});
