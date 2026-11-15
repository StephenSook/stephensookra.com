import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { POSTER } from "@/components/CasePoster";

const root = process.cwd();
const sha256 = (path: string) => createHash("sha256").update(readFileSync(path)).digest("hex");

/** Width and height from a WebP file's header (VP8, VP8L or VP8X). */
function webpSize(path: string): { width: number; height: number } {
  const b = readFileSync(path);
  if (b.toString("ascii", 0, 4) !== "RIFF" || b.toString("ascii", 8, 12) !== "WEBP") throw new Error(`${path}: not WebP`);
  const chunk = b.toString("ascii", 12, 16);
  if (chunk === "VP8 ") return { width: b.readUInt16LE(26) & 0x3fff, height: b.readUInt16LE(28) & 0x3fff };
  if (chunk === "VP8L") {
    const bits = b.readUInt32LE(21);
    return { width: (bits & 0x3fff) + 1, height: ((bits >> 14) & 0x3fff) + 1 };
  }
  if (chunk === "VP8X") return { width: b.readUIntLE(24, 3) + 1, height: b.readUIntLE(27, 3) + 1 };
  throw new Error(`${path}: unknown WebP chunk ${chunk}`);
}

describe("case posters", () => {
  const manifestPath = join(root, "public/case/manifest.json");

  it("were rendered from the current case model", () => {
    expect(existsSync(manifestPath)).toBe(true);
    const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
    expect(manifest.specSha256).toBe(sha256(join(root, "src/scene/case-spec.json")));
    expect(manifest.renderer).toMatch(/^Blender 5\.3/);
  });

  for (const scheme of ["light", "dark"] as const) {
    it(`has a ${scheme} poster at the stage's size`, () => {
      const file = join(root, "public", POSTER[scheme]);
      expect(existsSync(file), file).toBe(true);
      expect(webpSize(file)).toEqual({ width: POSTER.width, height: POSTER.height });
      expect(POSTER.width / POSTER.height).toBeCloseTo(16 / 9, 6);
    });
  }

  it("serves the posters of one generation, named by the manifest", () => {
    // Each render run publishes a new folder; the manifest is the single pointer to it,
    // so a half-finished run can never pair a new poster with an old one.
    const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
    expect(POSTER.light).toBe(manifest.light);
    expect(POSTER.dark).toBe(manifest.dark);
    const folder = (p: string) => p.split("/").slice(0, -1).join("/");
    expect(folder(manifest.light)).toBe(folder(manifest.dark));
    expect(folder(manifest.light)).toMatch(/^\/case\/[0-9]{14}-[0-9a-f]{12}$/);
  });
});
