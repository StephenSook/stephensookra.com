import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// Network link checks, kept apart from the unit suite so `npm test` stays offline.
export default defineConfig({
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  test: {
    environment: "node",
    include: ["tests/links/**/*.test.ts"],
    // A sleeping host: up to 7 tries of 90 s with 90 s of waits between, for the core route
    // and the home page.
    testTimeout: 1_500_000,
    maxConcurrency: 4,
  },
});
