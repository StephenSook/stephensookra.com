import { createHash } from "node:crypto";
import { existsSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/*
 * The case as files for phone AR (Scene Viewer on Android, AR Quick Look on iPhone).
 * Our budget sits well inside Scene Viewer's published limits (100k triangles, 10 materials,
 * 2048 px textures, 10 MB): https://developers.google.com/ar/develop/scene-viewer
 */
const root = process.cwd();
const MAX_TRIANGLES = 20_000;
const MAX_MATERIALS = 10;
const MAX_TEXTURE_PX = 1024;
const MAX_BYTES = 2 * 1024 * 1024;

const manifestPath = join(root, "public/ar/manifest.json");
const manifest = () => JSON.parse(readFileSync(manifestPath, "utf8"));
const file = (p: string) => join(root, "public", p);

type Gltf = {
  asset: { version: string };
  extensionsUsed?: string[];
  materials: { name: string; extensions?: Record<string, unknown> }[];
  meshes: { name?: string; primitives: { attributes: Record<string, number>; indices?: number; material?: number }[] }[];
  accessors: { bufferView?: number; byteOffset?: number; componentType: number; count: number; type: string; min?: number[]; max?: number[] }[];
  bufferViews: { byteOffset?: number; byteLength: number }[];
  images?: { bufferView?: number; mimeType?: string }[];
  nodes?: { name?: string; translation?: number[]; rotation?: number[]; scale?: number[] }[];
};

/** Splits a GLB into its JSON and binary chunks. */
function readGlb(path: string): { json: Gltf; bin: Buffer } {
  const b = readFileSync(path);
  expect(b.toString("ascii", 0, 4)).toBe("glTF");
  const jsonLength = b.readUInt32LE(12);
  const json = JSON.parse(b.toString("utf8", 20, 20 + jsonLength)) as Gltf;
  const binStart = 20 + jsonLength;
  const binLength = b.readUInt32LE(binStart);
  return { json, bin: b.subarray(binStart + 8, binStart + 8 + binLength) };
}

/** Width and height from a JPEG's SOF marker, or a PNG's IHDR. */
function imageSize(bytes: Buffer): { width: number; height: number } {
  if (bytes[0] === 0x89 && bytes.toString("ascii", 1, 4) === "PNG") return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) };
  for (let i = 2; i < bytes.length; ) {
    const marker = bytes[i + 1];
    const length = bytes.readUInt16BE(i + 2);
    if (marker >= 0xc0 && marker <= 0xc3) return { height: bytes.readUInt16BE(i + 5), width: bytes.readUInt16BE(i + 7) };
    i += 2 + length;
  }
  throw new Error("no image size found");
}

/** The local file entries of a zip, in order, with where each one's data starts. */
function zipEntries(path: string): { name: string; dataOffset: number; size: number }[] {
  const b = readFileSync(path);
  const entries: { name: string; dataOffset: number; size: number }[] = [];
  for (let at = 0; b.readUInt32LE(at) === 0x04034b50; ) {
    const size = b.readUInt32LE(at + 18);
    const nameLength = b.readUInt16LE(at + 26);
    const extraLength = b.readUInt16LE(at + 28);
    const name = b.toString("utf8", at + 30, at + 30 + nameLength);
    const dataOffset = at + 30 + nameLength + extraLength;
    entries.push({ name, dataOffset, size });
    at = dataOffset + size;
  }
  return entries;
}

describe("phone AR models", () => {
  it("were exported from the current case model", () => {
    expect(existsSync(manifestPath)).toBe(true);
    const sha = createHash("sha256").update(readFileSync(join(root, "src/scene/case-spec.json"))).digest("hex");
    expect(manifest().specSha256).toBe(sha);
    expect(manifest().renderer).toMatch(/^Blender 5\.3/);
  });

  it("the GLB passes the Khronos glTF validator with no errors", async () => {
    const { default: validator } = (await import("gltf-validator")) as { default: { validateBytes(b: Uint8Array): Promise<{ issues: { numErrors: number; messages: unknown[] } }> } };
    const report = await validator.validateBytes(new Uint8Array(readFileSync(file(manifest().glb))));
    expect(report.issues.numErrors, JSON.stringify(report.issues.messages.slice(0, 5))).toBe(0);
  });

  it("the GLB stays inside our budget", () => {
    const path = file(manifest().glb);
    expect(statSync(path).size).toBeLessThanOrEqual(MAX_BYTES);
    const { json, bin } = readGlb(path);
    expect(json.materials.length).toBeLessThanOrEqual(MAX_MATERIALS);
    let triangles = 0;
    for (const mesh of json.meshes)
      for (const p of mesh.primitives)
        triangles += (p.indices !== undefined ? json.accessors[p.indices].count : json.accessors[p.attributes.POSITION].count) / 3;
    expect(triangles).toBeLessThanOrEqual(MAX_TRIANGLES);
    for (const image of json.images ?? []) {
      const view = json.bufferViews[image.bufferView!];
      const size = imageSize(bin.subarray(view.byteOffset ?? 0, (view.byteOffset ?? 0) + view.byteLength));
      expect(Math.max(size.width, size.height)).toBeLessThanOrEqual(MAX_TEXTURE_PX);
    }
  });

  it("the GLB is the real size, standing on its base, with unlit posters facing the viewer (+Z)", () => {
    const { json, bin } = readGlb(file(manifest().glb));
    // Every node is an identity transform, so the accessors' bounds are the world bounds.
    for (const node of json.nodes ?? []) {
      expect(node.translation ?? [0, 0, 0], node.name).toEqual([0, 0, 0]);
      expect(node.scale ?? [1, 1, 1], node.name).toEqual([1, 1, 1]);
      expect(node.rotation ?? [0, 0, 0, 1], node.name).toEqual([0, 0, 0, 1]);
    }
    const min = [Infinity, Infinity, Infinity];
    const max = [-Infinity, -Infinity, -Infinity];
    for (const mesh of json.meshes)
      for (const p of mesh.primitives) {
        const a = json.accessors[p.attributes.POSITION];
        a.min!.forEach((v, i) => (min[i] = Math.min(min[i], v)));
        a.max!.forEach((v, i) => (max[i] = Math.max(max[i], v)));
      }
    expect(max[0] - min[0]).toBeCloseTo(1.6, 3);
    expect(max[1] - min[1]).toBeCloseTo(1.0, 3);
    expect(max[2] - min[2]).toBeCloseTo(0.14, 3);
    expect(min[1]).toBeCloseTo(0, 3); // origin at the bottom centre
    expect((max[0] + min[0]) / 2).toBeCloseTo(0, 3);

    expect(json.extensionsUsed).toContain("KHR_materials_unlit");
    const posters = json.materials.map((m, i) => ({ m, i })).filter(({ m }) => m.name.startsWith("poster"));
    expect(posters.length).toBe(5); // XR Dojo has no poster
    for (const { m, i } of posters) {
      expect(m.extensions?.KHR_materials_unlit, m.name).toBeDefined();
      const prim = json.meshes.flatMap((x) => x.primitives).find((p) => p.material === i)!;
      const normals = json.accessors[prim.attributes.NORMAL];
      const view = json.bufferViews[normals.bufferView!];
      const at = (view.byteOffset ?? 0) + (normals.byteOffset ?? 0);
      expect([bin.readFloatLE(at), bin.readFloatLE(at + 4), bin.readFloatLE(at + 8)].map((v) => Math.round(v))).toEqual([0, 0, 1]);
    }
  });

  it("the USDZ is a valid package: a .usdc first, every file 64-byte aligned, within budget", () => {
    const path = file(manifest().usdz);
    expect(statSync(path).size).toBeLessThanOrEqual(MAX_BYTES);
    const entries = zipEntries(path);
    expect(entries.length).toBeGreaterThan(1);
    expect(entries[0].name).toMatch(/\.usdc$/);
    for (const e of entries) expect(e.dataOffset % 64, e.name).toBe(0);
  });
});
