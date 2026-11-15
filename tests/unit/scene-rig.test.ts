import * as THREE from "three";
import { describe, expect, it } from "vitest";
import spec from "@/scene/case-spec.json";
import { buildLayout } from "@/scene/layout";
import { createRig, MAX_TILT } from "@/scene/rig";

const layout = buildLayout(spec);

describe("case rig", () => {
  it("draws the whole case in two instanced meshes", () => {
    const rig = createRig(layout);
    const meshes = rig.group.children.filter((c): c is THREE.InstancedMesh => c instanceof THREE.InstancedMesh);
    expect(meshes).toHaveLength(2);
    expect(meshes[0].count).toBe(layout.frame.length + layout.dividers.length);
    expect(meshes[1].count).toBe(layout.projectSlots.length + layout.smallBacks.length);
    rig.dispose();
  });

  it("eases the lit slot up, keeps asking for frames until it settles, then stops", () => {
    const rig = createRig(layout);
    let frames = 0;
    while (rig.step("glare-zone", 1 / 60) && frames < 600) frames++;
    expect(frames).toBeGreaterThan(2);
    expect(frames).toBeLessThan(120);
    expect(rig.litValue("glare-zone")).toBe(1);
    expect(rig.litValue("case-light")).toBe(0);
    expect(rig.step("glare-zone", 1 / 60)).toBe(false);
    rig.dispose();
  });

  it("never lights a small cell", () => {
    const rig = createRig(layout);
    for (let i = 0; i < 120; i++) rig.step("aloud", 1 / 60);
    const lit = rig.litValues();
    expect(lit.slice(layout.projectSlots.length).every((v) => v === 0)).toBe(true);
    rig.dispose();
  });

  it("tilts towards the pointer by at most 2 degrees and back to rest when it leaves", () => {
    const rig = createRig(layout);
    rig.setPointer({ x: 1, y: 1 });
    for (let i = 0; i < 600; i++) rig.step(null, 1 / 60);
    expect(Math.abs(rig.group.rotation.x)).toBeLessThanOrEqual(MAX_TILT + 1e-9);
    expect(Math.abs(rig.group.rotation.y)).toBeLessThanOrEqual(MAX_TILT + 1e-9);
    expect(Math.abs(rig.group.rotation.y)).toBeGreaterThan(MAX_TILT * 0.9);
    rig.setPointer(null);
    for (let i = 0; i < 600; i++) rig.step(null, 1 / 60);
    expect(rig.group.rotation.x).toBe(0);
    expect(rig.group.rotation.y).toBe(0);
    rig.dispose();
  });

  it("takes its colours from the tokens", () => {
    const rig = createRig(layout);
    rig.applyTokens({ wood: "#6e5238", back: "#262a33", light: "#ffb547" });
    expect(rig.woodColor().getHexString()).toBe("6e5238");
    rig.dispose();
  });
});
