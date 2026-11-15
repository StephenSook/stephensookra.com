import { readFileSync } from "node:fs";

/** The entries of a USDZ (an uncompressed zip): name, where its data starts, and its size. */
export function zipEntries(path: string): { name: string; dataOffset: number; size: number }[] {
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
