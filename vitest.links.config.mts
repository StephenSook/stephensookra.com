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
    testTimeout: 200_000,
    maxConcurrency: 4,
  },
});
