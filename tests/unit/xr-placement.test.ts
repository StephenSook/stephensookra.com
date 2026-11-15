import * as THREE from "three";
import { describe, expect, it } from "vitest";
import spec from "@/scene/case-spec.json";
import { buildLayout } from "@/scene/layout";
import { BELOW_EYE, CASE_DISTANCE, pickPlanes, placeCase } from "@/xr/placement";

const head = (y: number, yawDeg = 0, pitchDeg = 0) => ({
  position: new THREE.Vector3(0, y, 0),
  quaternion: new THREE.Quaternion().setFromEuler(
    new THREE.Euler(THREE.MathUtils.degToRad(pitchDeg), THREE.MathUtils.degToRad(yawDeg), 0, "YXZ"),
  ),
});

/** The case's front (+z in its own space) as a world direction. */
const facing = (rotationY: number) => new THREE.Vector3(0, 0, 1).applyAxisAngle(new THREE.Vector3(0, 1, 0), rotationY);

describe("placeCase", () => {
  it("puts the case 1 m ahead and 10 cm below the eyes, facing the viewer", () => {
    expect(CASE_DISTANCE).toBe(1);
    expect(BELOW_EYE).toBeCloseTo(0.1, 9);
    const p = placeCase(head(1.6));
    expect(p.position.x).toBeCloseTo(0, 9);
    expect(p.position.y).toBeCloseTo(1.5, 9);
    expect(p.position.z).toBeCloseTo(-1, 9);
    expect(facing(p.rotationY).z).toBeCloseTo(1, 9);
  });

  it("follows the head's yaw and keeps facing the viewer", () => {
    const p = placeCase(head(1.6, 90)); // turned left: looking down -x
    expect(p.position.x).toBeCloseTo(-1, 9);
    expect(p.position.z).toBeCloseTo(0, 9);
    const toViewer = new THREE.Vector3(0, 1.6, 0).sub(p.position).setY(0).normalize();
    expect(facing(p.rotationY).dot(toViewer)).toBeCloseTo(1, 9);
  });

  it("ignores pitch, so looking down does not pull the case closer or lower", () => {
    const p = placeCase(head(1.6, 0, -30));
    expect(p.position.z).toBeCloseTo(-1, 9);
    expect(p.position.y).toBeCloseTo(1.5, 9);
  });

  it("uses the measured head height, so a seated viewer gets a lower case", () => {
    expect(placeCase(head(1.15)).position.y).toBeCloseTo(1.05, 9);
  });

  it("falls back to straight ahead when the head looks straight down", () => {
    const p = placeCase(head(1.6, 0, -90));
    expect(p.position.z).toBeCloseTo(-1, 6);
    expect(Number.isFinite(p.rotationY)).toBe(true);
  });
});

describe("pickPlanes", () => {
  const layout = buildLayout(spec);

  it("puts one target over each project slot opening, in slot order", () => {
    const planes = pickPlanes(layout);
    expect(planes.map((p) => p.slug)).toEqual(layout.projectSlots.map((s) => s.slug));
    planes.forEach((plane, i) => {
      const opening = layout.projectSlots[i].opening;
      expect([plane.x, plane.y, plane.w, plane.h]).toEqual([opening.x, opening.y, opening.w, opening.h]);
      expect(plane.z).toBeGreaterThan(layout.depth / 2);
      expect(plane.z).toBeLessThan(layout.depth / 2 + 0.005);
    });
  });
});
