import { existsSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { featured } from "@/content";

const root = process.cwd();

/** Width and height from the first track header ('tkhd') of an MP4. */
function mp4Size(path: string): { width: number; height: number } {
  const b = readFileSync(path);
  const find = (type: string, start: number, end: number): [number, number] | null => {
    for (let at = start; at + 8 <= end; ) {
      const size = b.readUInt32BE(at);
      if (size < 8) return null;
      if (b.toString("ascii", at + 4, at + 8) === type) return [at + 8, at + size];
      at += size;
    }
    return null;
  };
  const moov = find("moov", 0, b.length);
  const trak = moov && find("trak", moov[0], moov[1]);
  const tkhd = trak && find("tkhd", trak[0], trak[1]);
  if (!tkhd) throw new Error(`${path}: no track header`);
  return { width: b.readUInt32BE(tkhd[1] - 8) >>> 16, height: b.readUInt32BE(tkhd[1] - 4) >>> 16 };
}

/** The rows of scripts/loops/cut-loops.sh: slug, film id, start, length, crop. */
function scriptRows() {
  const script = readFileSync(join(root, "scripts/loops/cut-loops.sh"), "utf8");
  const block = script.match(/LOOPS="([^"]+)"/)?.[1] ?? "";
  return block
    .trim()
    .split("\n")
    .map((line) => {
      const [slug, film, start, length] = line.trim().split(/\s+/);
      return { slug, film, start: Number(start), length: Number(length) };
    });
}

describe("headset card loops", () => {
  it("every featured project with a film has a loop; XR Dojo, with no film, has none", () => {
    for (const p of featured) {
      const hasFilm = p.links.some((l) => l.kind === "film");
      expect(Boolean(p.loop), p.slug).toBe(hasFilm);
    }
    expect(featured.find((p) => p.slug === "xr-dojo")?.loop).toBeUndefined();
  });

  for (const p of featured.filter((x) => x.loop)) {
    it(`${p.slug}: the loop is a small MP4 of the stated size, cut from its own film`, () => {
      const loop = p.loop!;
      const file = join(root, "public", loop.src);
      expect(existsSync(file), file).toBe(true);
      expect(readFileSync(file).toString("ascii", 4, 8)).toBe("ftyp");
      expect(statSync(file).size).toBeLessThanOrEqual(1.5 * 1024 * 1024);
      expect(mp4Size(file)).toEqual({ width: loop.width, height: loop.height });
      const film = p.links.find((l) => l.kind === "film");
      expect(film?.url).toBe(`https://www.youtube.com/watch?v=${loop.film}`);
    });
  }

  it("matches the cut script row for row, so the source of each loop is on record", () => {
    const rows = scriptRows();
    const loops = featured.filter((p) => p.loop).map((p) => ({ slug: p.slug, film: p.loop!.film, start: p.loop!.start, length: p.loop!.length }));
    expect(rows).toEqual(loops);
  });
});
