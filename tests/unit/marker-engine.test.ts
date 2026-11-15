import { afterEach, describe, expect, it, vi } from "vitest";

afterEach(() => {
  delete (window as unknown as { XR8?: unknown }).XR8;
  vi.resetModules();
});

describe("loadEngine", () => {
  it("retries a failed tracking chunk at a fresh address (Safari keeps failed module imports)", async () => {
    const xr8: Record<string, unknown> = {};
    const loadChunk = vi.fn(async (chunk: string | { name: string; url: string }) => {
      if (loadChunk.mock.calls.length === 1) throw new TypeError("Importing a module script failed.");
      expect(chunk).toEqual({ name: "slam", url: expect.stringMatching(/\/vendor\/8thwall\/0\.1\.0\/xr-tracking\.js\?retry=1$/) });
      xr8.XrController = {};
    });
    xr8.loadChunk = loadChunk;
    (window as unknown as { XR8: unknown }).XR8 = xr8;
    const { loadEngine } = await import("@/ar/marker/engine");
    await expect(loadEngine()).rejects.toThrow();
    expect(loadChunk).toHaveBeenLastCalledWith("slam"); // the first try uses the engine's own address
    await expect(loadEngine()).resolves.toBe(xr8);
    expect(loadChunk).toHaveBeenCalledTimes(2);
  });
});
