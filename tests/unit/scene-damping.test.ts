import * as THREE from "three";
import { describe, expect, it } from "vitest";
import { damp } from "@/scene/damping";
import { createSlotMaterial, SLOT_ATTRIBUTES } from "@/scene/slotMaterial";

describe("damp", () => {
  it("moves towards the target without overshooting", () => {
    let v = 0;
    for (let i = 0; i < 100; i++) {
      v = damp(v, 1, 20, 1 / 60);
      expect(v).toBeLessThanOrEqual(1);
    }
    expect(v).toBeGreaterThan(0.999);
  });

  it("is frame-rate independent: two half steps equal one full step", () => {
    const full = damp(0.2, 0.9, 20, 1 / 30);
    const halves = damp(damp(0.2, 0.9, 20, 1 / 60), 0.9, 20, 1 / 60);
    expect(Math.abs(full - halves)).toBeLessThan(1e-9);
  });

  it("does not move when no time passes, and lands on the target after a long pause", () => {
    expect(damp(0.3, 1, 20, 0)).toBe(0.3);
    expect(damp(0.3, 1, 20, 10)).toBeCloseTo(1, 9);
  });

  it("reaches about 95% of the way in 150 ms at k = 20", () => {
    expect(damp(0, 1, 20, 0.15)).toBeGreaterThan(0.95);
  });
});

describe("createSlotMaterial", () => {
  const material = createSlotMaterial();

  it("declares the uniforms the scene sets", () => {
    for (const name of ["uBack", "uLight", "uAtlas", "uHasAtlas"])
      expect(material.uniforms, name).toHaveProperty(name);
  });

  it("reads the per-instance light and poster attributes", () => {
    expect(SLOT_ATTRIBUTES).toEqual({ lit: "aLit", poster: "aPoster" });
    expect(material.vertexShader).toContain("attribute float aLit;");
    expect(material.vertexShader).toContain("attribute vec4 aPoster;");
  });

  it("uses no shader chunks that three does not ship", () => {
    const includes = [...`${material.vertexShader}\n${material.fragmentShader}`.matchAll(/#include <(\w+)>/g)].map(
      (m) => m[1],
    );
    expect(includes.length).toBeGreaterThan(0);
    for (const name of includes) expect(THREE.ShaderChunk, name).toHaveProperty(name);
  });
});
