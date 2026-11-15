import { expect, test } from "@playwright/test";
import { NO_WEBGL_SCRIPT, PHONE, sitemapPaths } from "./helpers";

const FEATURED = ["Case Light", "Glare Zone", "XR Dojo", "VARSITY", "Instanter", "Aloud"];

test("with JavaScript off, every page keeps its name, navigation and content", async ({ browser, request }) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();
  for (const path of await sitemapPaths(request)) {
    await page.goto(path);
    await expect(page.locator("h1"), path).toBeVisible();
    await expect(page.getByRole("navigation", { name: "Main" }), path).toBeVisible();
  }
  await page.goto("/");
  for (const title of FEATURED) await expect(page.getByRole("link", { name: title, exact: true })).toBeVisible();
  await context.close();
});

test("with WebGL off, the home page is complete", async ({ browser }) => {
  const context = await browser.newContext();
  await context.addInitScript(NO_WEBGL_SCRIPT);
  const page = await context.newPage();
  await page.goto("/");
  expect(await page.evaluate(() => document.createElement("canvas").getContext("webgl"))).toBeNull();
  await expect(page.locator("h1")).toHaveText("Stephen Sookra");
  for (const title of FEATURED) await expect(page.getByRole("link", { name: title, exact: true })).toBeVisible();
  await context.close();
});

test("with reduced motion, the slot light does not animate", async ({ browser }) => {
  const context = await browser.newContext({ reducedMotion: "reduce" });
  const page = await context.newPage();
  await page.goto("/");
  const durations = await page.locator(".slot").first().evaluate((el) => getComputedStyle(el).transitionDuration);
  for (const d of durations.split(",")) expect(parseFloat(d)).toBe(0);
  await context.close();
});

for (const width of [320, 390]) {
  test(`no page scrolls sideways at ${width} px`, async ({ browser, request }) => {
    const context = await browser.newContext({ ...PHONE, viewport: { width, height: 800 } });
    const page = await context.newPage();
    for (const path of await sitemapPaths(request)) {
      await page.goto(path);
      const { scroll, inner } = await page.evaluate(() => ({
        scroll: document.documentElement.scrollWidth,
        inner: window.innerWidth,
      }));
      expect(scroll, `${path} at ${width}px`).toBeLessThanOrEqual(inner);
    }
    await context.close();
  });
}
