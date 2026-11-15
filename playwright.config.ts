import { defineConfig, devices } from "@playwright/test";

const PORT = 3100;
// Set E2E_BASE_URL to run the same suite against a deployment (for example a preview);
// otherwise it runs against the local production build (`npm run build` first).
// Normalized once, so a blank value means "local" for both the base URL and the server.
const external = process.env.E2E_BASE_URL?.trim() || undefined;

export default defineConfig({
  testDir: "tests/e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: external ?? `http://localhost:${PORT}`,
    trace: "retain-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"], viewport: { width: 1280, height: 800 } } }],
  webServer: external
    ? undefined
    : {
        command: `npm run start -- -p ${PORT}`,
        url: `http://localhost:${PORT}`,
        reuseExistingServer: !process.env.CI,
        timeout: 60_000,
      },
});
