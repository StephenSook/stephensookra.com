// Full-page stills of routes at phone and desktop widths, light and dark.
// Usage: node scripts/stills.mjs <baseUrl> <outDir> [route ...]
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { chromium } from "@playwright/test";

const [baseUrl, outDir, ...routeArgs] = process.argv.slice(2);
if (!baseUrl || !outDir) {
  console.error("usage: node scripts/stills.mjs <baseUrl> <outDir> [route ...]");
  process.exit(2);
}
const routes = routeArgs.length ? routeArgs : ["/"];
const widths = [
  { name: "390", viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true },
  { name: "1280", viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 },
];
const schemes = ["light", "dark"];

mkdirSync(outDir, { recursive: true });
const browser = await chromium.launch();
let failures = 0;
for (const route of routes) {
  for (const width of widths) {
    for (const colorScheme of schemes) {
      const context = await browser.newContext({ ...width, colorScheme });
      const page = await context.newPage();
      const response = await page.goto(new URL(route, baseUrl).toString(), { waitUntil: "load" });
      // Stills need settled pixels, not a quiet network: background prefetches may still run.
      await page.waitForLoadState("networkidle", { timeout: 5000 }).catch(() => {});
      // Where the 3D case can load (wide screens), wait for its first frame; elsewhere the poster stays.
      // Then wait for the crossfade to settle (poster gone, scene opaque): a fixed delay once
      // caught the stage mid-fade, so the whole case read as 70% transparent.
      if (width.name === "1280" && (await page.locator(".case-stage").count()) > 0) {
        await page.waitForSelector(".case-stage[data-scene=ready]", { timeout: 20000 });
        await page.waitForFunction(
          () => {
            const op = (sel) => Number(getComputedStyle(document.querySelector(sel)).opacity);
            return op(".case-stage__poster") === 0 && op(".case-stage__scene") === 1;
          },
          null,
          { timeout: 10000 },
        );
      }
      const slug = route === "/" ? "home" : route.replace(/^\//, "").replace(/\//g, "_");
      const file = join(outDir, `${slug}-${width.name}-${colorScheme}.png`);
      await page.screenshot({ path: file, fullPage: true });
      const status = response?.status() ?? 0;
      if (status >= 400) failures++;
      console.log(`${status} ${file}`);
      await context.close();
    }
  }
}
await browser.close();
process.exit(failures ? 1 : 0);
