import * as THREE from "three";
import { describe, expect, it } from "vitest";
import { caseOnCard, CASE_SIZE, type TargetPose } from "@/ar/marker/placement";

// The landscape card as the engine reports it: 1 wide, 0.75 high in its own frame, x right,
// y up, z out of the card towards the viewer.
const pose: TargetPose = {
  position: { x: 0.1, y: 1.9, z: -0.8 },
  rotation: { x: 0, y: 0, z: 0, w: 1 },
  scale: 0.5,
  scaledWidth: 1,
  scaledHeight: 0.75,
};
const box = { x: 0.0914, y: 0.1773, width: 0.8172, height: 0.6818 };

/** World-space corners of the case's front face, from a case transform. */
function frontCorners(t: ReturnType<typeof caseOnCard>) {
  const m = new THREE.Matrix4().compose(
    new THREE.Vector3(...t.position),
    new THREE.Quaternion(...t.quaternion),
    new THREE.Vector3(t.scale, t.scale, t.scale),
  );
  const { width, height, depth } = CASE_SIZE;
  return {
    bottomLeft: new THREE.Vector3(-width / 2, 0, depth / 2).applyMatrix4(m),
    topRight: new THREE.Vector3(width / 2, height, depth / 2).applyMatrix4(m),
    back: new THREE.Vector3(0, 0, -depth / 2).applyMatrix4(m),
  };
}

describe("caseOnCard", () => {
  it("lays the case over its picture: same width, same place, back face on the card", () => {
    const t = caseOnCard(pose, box);
    const c = frontCorners(t);
    // Card frame in world units: scale 0.5, so the card is 0.5 x 0.375, centred on position.
    const left = 0.1 - 0.25 + box.x * 0.5;
    const right = left + box.width * 0.5;
    const top = 1.9 + 0.1875 - box.y * 0.375;
    expect(c.bottomLeft.x).toBeCloseTo(left, 4);
    expect(c.topRight.x).toBeCloseTo(right, 4);
    expect(c.topRight.y).toBeCloseTo(top, 3);
    expect(c.back.z).toBeCloseTo(-0.8, 6); // the back face touches the card
    expect(c.topRight.z).toBeGreaterThan(-0.8); // the front comes out towards the viewer
  });

  it("keeps the case's own proportions (it is drawn at 1.6 by 1.0)", () => {
    const t = caseOnCard(pose, box);
    const c = frontCorners(t);
    const w = c.topRight.x - c.bottomLeft.x;
    const h = c.topRight.y - c.bottomLeft.y;
    expect(w / h).toBeCloseTo(CASE_SIZE.width / CASE_SIZE.height, 6);
    // The drawn picture has the same aspect within 1 percent, so the model covers it.
    expect((box.width * 1) / (box.height * 0.75) / (w / h)).toBeCloseTo(1, 2);
  });

  it("follows the card when it turns: the case turns with it", () => {
    const turned = { ...pose, rotation: { x: 0, y: Math.sin(Math.PI / 4), z: 0, w: Math.cos(Math.PI / 4) } }; // 90 degrees about y
    const t = caseOnCard(turned, box);
    const c = frontCorners(t);
    // Facing +x now: the back face sits on the card plane, which now runs through x = 0.1.
    expect(c.back.x).toBeCloseTo(0.1, 6);
    expect(c.topRight.x).toBeGreaterThan(0.1);
  });
});
