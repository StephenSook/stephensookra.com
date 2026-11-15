import { createHash } from "node:crypto";
import { readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import vision from "../../public/vision/manifest.json";
import { zipEntries } from "./usdz";

// The Vision Pro room (npm run vision:room): the case on a wall of a plain room, as a USDZ
// for Safari's <model>, and a warm HDR for its environmentmap.
const root = process.cwd();
const file = (url: string) => join(root, "public", url);

describe("the Vision Pro room", () => {
  it("was exported from the current case model", () => {
    const sha = createHash("sha256").update(readFileSync(join(root, "src/scene/case-spec.json"))).digest("hex");
    expect(vision.specSha256).toBe(sha);
    expect(vision.renderer).toMatch(/^Blender 5\.3/);
    const gen = vision.room.split("/")[2];
    expect(vision.environment.split("/")[2]).toBe(gen); // one generation
  });

  it("is a valid USDZ package: a .usdc first, every file 64-byte aligned, 2 MB or less", () => {
    const path = file(vision.room);
    expect(statSync(path).size).toBeLessThanOrEqual(2 * 1024 * 1024);
    const entries = zipEntries(path);
    expect(entries.length).toBeGreaterThan(1);
    expect(entries[0].name).toMatch(/\.usdc$/);
    for (const e of entries) expect(e.dataOffset % 64, e.name).toBe(0);
  });

  it("lights the room with a 2:1 Radiance HDR (an equirectangular environment map)", () => {
    const head = readFileSync(file(vision.environment)).subarray(0, 200).toString("latin1");
    expect(head.startsWith("#?RADIANCE")).toBe(true);
    expect(head).toContain("FORMAT=32-bit_rle_rgbe");
    const [, h, w] = head.match(/-Y (\d+) \+X (\d+)/)!;
    expect(Number(w)).toBe(2 * Number(h));
  });
});
