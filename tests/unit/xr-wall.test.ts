import * as THREE from "three";
import { describe, expect, it } from "vitest";
import { MIN_BOTTOM, normalOf, wallPlacement } from "@/xr/wall";

const SIZE = { height: 1.0, depth: 0.14 };
const viewer = new THREE.Vector3(0, 1.6, 0);
const v = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);

/** Where the case's front, up and back-centre end up for a placement. */
function axes(p: NonNullable<ReturnType<typeof wallPlacement>>) {
  return {
    front: v(0, 0, 1).applyQuaternion(p.quaternion),
    up: v(0, 1, 0).applyQuaternion(p.quaternion),
    back: v(0, 0, -SIZE.depth / 2).applyQuaternion(p.quaternion).add(p.position),
  };
}

describe("wallPlacement", () => {
  it("hangs the case flush on a wall in front of the viewer: centred on the hit, upright, facing out", () => {
    const hit = { position: v(0, 1.6, 1.39), normal: v(0, 0, -1) };
    const p = wallPlacement(hit, viewer, SIZE)!;
    const a = axes(p);
    expect(p.position.x).toBeCloseTo(0, 6);
    expect(p.position.y).toBeCloseTo(1.6, 6);
    expect(a.back.z).toBeCloseTo(1.39, 6); // the back face touches the wall
    expect(a.front.dot(v(0, 0, -1))).toBeCloseTo(1, 6); // facing the viewer
    expect(a.up.y).toBeCloseTo(1, 6); // upright
  });

  it("faces the viewer even when the surface normal points into the wall", () => {
    const p = wallPlacement({ position: v(0, 1.6, 1.39), normal: v(0, 0, 1) }, viewer, SIZE)!;
    expect(axes(p).front.z).toBeCloseTo(-1, 6);
    expect(axes(p).back.z).toBeCloseTo(1.39, 6);
  });

  it("stays upright on a wall that leans a little, sitting on the wall's own plane", () => {
    const normal = v(-0.98, 0.2, 0).normalize(); // a wall to the right, leaning back
    const p = wallPlacement({ position: v(1.2, 1.4, 0), normal }, viewer, SIZE)!;
    const a = axes(p);
    expect(a.up.y).toBeCloseTo(1, 6);
    expect(a.front.y).toBeCloseTo(0, 6);
    expect(a.front.x).toBeCloseTo(-1, 6);
    expect(a.back.x).toBeCloseTo(1.2, 6);
  });

  it("refuses floors, tables, ceilings and steep slopes: nothing is placed at a wrong spot", () => {
    for (const normal of [v(0, 1, 0), v(0, -1, 0), v(0, 0.5, -0.87).normalize()]) {
      expect(wallPlacement({ position: v(0, 0.7, -1), normal }, viewer, SIZE)).toBeNull();
    }
  });

  it("keeps the case off the floor when the hit is low on the wall", () => {
    const p = wallPlacement({ position: v(0, 0.2, 1.39), normal: v(0, 0, -1) }, viewer, SIZE)!;
    expect(p.position.y - SIZE.height / 2).toBeCloseTo(MIN_BOTTOM, 6);
  });
});

describe("normalOf", () => {
  it("reads a hit pose's surface normal from its y axis (the WebXR hit-test convention)", () => {
    const m = new THREE.Matrix4().compose(
      v(0, 1.6, 1.39),
      new THREE.Quaternion().setFromAxisAngle(v(1, 0, 0), -Math.PI / 2), // y turned to point along -z
      v(1, 1, 1),
    );
    const n = normalOf(m);
    expect(n.z).toBeCloseTo(-1, 6);
    expect(n.length()).toBeCloseTo(1, 6);
  });
});
