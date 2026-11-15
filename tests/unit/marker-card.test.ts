import { createHash } from "node:crypto";
import { readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { validateCrop } from "@8thwall/image-target-cli/src/crop.js";
import sharp from "sharp";
import { describe, expect, it } from "vitest";
import marker from "../../public/marker/manifest.json";

const PUBLIC = join(process.cwd(), "public");
const file = (url: string) => join(PUBLIC, url);

/** Width, height and colour type from a PNG's IHDR chunk (colour type 0 is grayscale). */
function png(path: string) {
  const b = readFileSync(path);
  expect(b.subarray(1, 4).toString()).toBe("PNG");
  return { width: b.readUInt32BE(16), height: b.readUInt32BE(20), colourType: b[25] };
}

describe("the marker card (npm run marker:card)", () => {
  it("is one generation: every file in the manifest sits in the folder named after the card's hash", () => {
    const sha = createHash("sha256").update(readFileSync(file(marker.card))).digest("hex");
    expect(sha).toBe(marker.cardSha256);
    for (const url of [marker.card, marker.pdf, marker.target.imagePath]) {
      expect(url).toMatch(new RegExp(`^/marker/\\d{14}-${sha.slice(0, 12)}/`));
      expect(statSync(file(url)).size).toBeGreaterThan(0);
    }
    expect(readFileSync(file(marker.pdf)).subarray(0, 5).toString()).toBe("%PDF-");
  });

  it("is a landscape 4:3 picture, stored as a rotated target that passes the CLI's own crop check", () => {
    expect(png(file(marker.card))).toMatchObject({ width: marker.width, height: marker.height });
    expect(marker.width / marker.height).toBeCloseTo(4 / 3, 6);
    const p = marker.target.properties;
    expect(marker.target.type).toBe("PLANAR");
    expect(p.isRotated).toBe(true);
    expect({ width: p.originalWidth, height: p.originalHeight }).toEqual({ width: marker.height, height: marker.width });
    expect(validateCrop(p, { width: p.originalWidth, height: p.originalHeight })).toEqual([]);
  });

  it("gives the engine the grayscale 480 by 640 image the 8th Wall docs ask for", async () => {
    expect(png(file(marker.target.imagePath))).toMatchObject({ width: 480, height: 640 });
    // The CLI writes grey pixels into an RGB file: every pixel has R = G = B.
    const { data, info } = await sharp(file(marker.target.imagePath)).raw().toBuffer({ resolveWithObject: true });
    let coloured = 0;
    for (let i = 0; i < data.length; i += info.channels) if (data[i] !== data[i + 1] || data[i] !== data[i + 2]) coloured++;
    expect(coloured).toBe(0);
  });

  it("knows where the case picture sits on the card, at the case's own 1.6 to 1 shape", () => {
    const b = marker.caseBox;
    expect(b.x).toBeGreaterThan(0);
    expect(b.y).toBeGreaterThan(0);
    expect(b.x + b.width).toBeLessThan(1);
    expect(b.y + b.height).toBeLessThan(1);
    expect((b.width * marker.width) / (b.height * marker.height)).toBeCloseTo(1.6, 1);
  });
});

describe("the vendored 8th Wall engine", () => {
  it("is the MIT build, byte for byte what source.json records, and only the two files tracking loads", () => {
    const dir = join(PUBLIC, "vendor/8thwall/0.1.0");
    const source = JSON.parse(readFileSync(join(dir, "source.json"), "utf8"));
    expect(source.license).toBe("MIT");
    expect(readFileSync(join(dir, "LICENSE"), "utf8")).toMatch(/^Copyright 2026 Niantic Spatial, Inc\.\s+Permission is hereby granted, free of charge/);
    expect(Object.keys(source.files).sort()).toEqual(["xr-tracking.js", "xr.js"]);
    for (const [name, { sha256 }] of Object.entries(source.files as Record<string, { sha256: string }>)) {
      const bytes = readFileSync(join(dir, name));
      expect(createHash("sha256").update(bytes).digest("hex"), name).toBe(sha256);
      expect(bytes.length, name).toBeLessThan(10 * 1024 * 1024); // the brief's per-file cap
    }
  });
});
