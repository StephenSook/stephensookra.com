import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, expect, it } from "vitest";
import { xrAssetBase } from "@/xr/assets";

const dir = join(process.cwd(), "public/xr/profiles");
const json = (path: string) => JSON.parse(readFileSync(path, "utf8"));

describe("self-hosted controller and hand models", () => {
  it("lists only the profiles this site ships, and each one exists", () => {
    const list = json(join(dir, "profilesList.json"));
    expect(Object.keys(list).sort()).toEqual(["generic-hand", "generic-trigger", "meta-quest-touch-plus"]);
    for (const { path } of Object.values(list) as { path: string }[]) expect(existsSync(join(dir, path)), path).toBe(true);
  });

  it("has every model a listed profile points at, so a headset never hits a missing file", () => {
    const list = json(join(dir, "profilesList.json")) as Record<string, { path: string }>;
    for (const { path } of Object.values(list)) {
      const profile = json(join(dir, path));
      for (const layout of Object.values(profile.layouts) as { assetPath?: string }[]) {
        if (!layout.assetPath) continue;
        const glb = join(dirname(join(dir, path)), layout.assetPath);
        expect(existsSync(glb), glb).toBe(true);
        expect(readFileSync(glb).toString("ascii", 0, 4), glb).toBe("glTF");
      }
    }
  });

  it("has both hand models (the hand loader asks for them by name)", () => {
    for (const side of ["left", "right"]) expect(existsSync(join(dir, `generic-hand/${side}.glb`))).toBe(true);
  });

  it("credits the models in the third-party notices", () => {
    const notices = readFileSync(join(process.cwd(), "THIRD_PARTY_NOTICES.md"), "utf8");
    expect(notices).toContain("@webxr-input-profiles/assets 1.0.20");
    expect(notices).toContain("Copyright (c) 2019 Amazon");
  });
});

describe("xrAssetBase", () => {
  it("is an absolute folder URL on this site, never a CDN", () => {
    expect(xrAssetBase("https://stephensookra.com")).toBe("https://stephensookra.com/xr/profiles/");
    expect(xrAssetBase("http://127.0.0.1:3100")).toBe("http://127.0.0.1:3100/xr/profiles/");
  });
});
