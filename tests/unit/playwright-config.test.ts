import { afterEach, describe, expect, it, vi } from "vitest";

async function loadConfig() {
  vi.resetModules();
  return (await import("../../playwright.config")).default;
}

afterEach(() => vi.unstubAllEnvs());

describe("playwright config", () => {
  it("runs against the local build when E2E_BASE_URL is unset or blank", async () => {
    for (const value of [undefined, "", "   "]) {
      if (value === undefined) vi.stubEnv("E2E_BASE_URL", undefined as unknown as string);
      else vi.stubEnv("E2E_BASE_URL", value);
      const config = await loadConfig();
      expect(config.use?.baseURL, JSON.stringify(value)).toBe("http://localhost:3100");
      expect(config.webServer, JSON.stringify(value)).toBeDefined();
    }
  });

  it("targets a deployment and starts no server when E2E_BASE_URL is set", async () => {
    vi.stubEnv("E2E_BASE_URL", " https://example.vercel.app ");
    const config = await loadConfig();
    expect(config.use?.baseURL).toBe("https://example.vercel.app");
    expect(config.webServer).toBeUndefined();
  });
});
