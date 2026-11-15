import * as THREE from "three";
import { describe, expect, it } from "vitest";
import spec from "@/scene/case-spec.json";
import { buildLayout } from "@/scene/layout";
import { fitCamera, pickSlot, projectToNdc } from "@/scene/pick";

const layout = buildLayout(spec);
const front = layout.depth / 2;

for (const aspect of [16 / 9, 4 / 3, 2.4]) {
  describe(`at aspect ${aspect.toFixed(2)}`, () => {
    const camera = fitCamera(layout, aspect);

    it("keeps all four corners of the case inside the view", () => {
      for (const [x, y] of [
        [-layout.width / 2, -layout.height / 2],
        [layout.width / 2, -layout.height / 2],
        [-layout.width / 2, layout.height / 2],
        [layout.width / 2, layout.height / 2],
      ]) {
        const p = projectToNdc(new THREE.Vector3(x, y, front), camera);
        expect(Math.abs(p.x)).toBeLessThan(1);
        expect(Math.abs(p.y)).toBeLessThan(1);
      }
    });

    it("picks each project slot at the centre of its opening", () => {
      for (const slot of layout.projectSlots) {
        const ndc = projectToNdc(new THREE.Vector3(slot.opening.x, slot.opening.y, front), camera);
        expect(pickSlot(ndc, camera, layout)).toBe(slot.slug);
      }
    });

    it("picks nothing on a divider, the frame, a small cell or the margin", () => {
      const a1 = layout.projectSlots[0];
      const between = new THREE.Vector3(a1.opening.x + a1.opening.w / 2 + spec.divider / 2, a1.opening.y, front);
      const frameTop = new THREE.Vector3(0, layout.height / 2 - spec.frame / 2, front);
      const small = layout.smallCells[5];
      const smallCentre = new THREE.Vector3(small.x, small.y, front);
      for (const p of [between, frameTop, smallCentre])
        expect(pickSlot(projectToNdc(p, camera), camera, layout)).toBeNull();
      expect(pickSlot({ x: 0.999, y: 0.999 }, camera, layout)).toBeNull();
    });
  });
}
