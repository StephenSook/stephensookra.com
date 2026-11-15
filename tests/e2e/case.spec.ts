import { expect, test, type Page } from "@playwright/test";
import * as THREE from "three";
import spec from "../../src/scene/case-spec.json";
import { buildLayout } from "../../src/scene/layout";
import { fitCamera, projectToNdc } from "../../src/scene/pick";
import { NO_WEBGL_SCRIPT, PHONE } from "./helpers";

// Tall enough that the stage and the grid are both on screen, so nothing scrolls under the pointer.
const DESKTOP = { viewport: { width: 1280, height: 1800 } };
const layout = buildLayout(spec);

async function threeLoaded(page: Page) {
  return page.evaluate(() => (window as unknown as { __THREE__?: string }).__THREE__ ?? null);
}

/** Where only the poster shows, the stage is the poster's 16:9 box, not a tall letterbox. */
async function expectPosterShape(page: Page) {
  const box = (await page.locator(".case-stage").boundingBox())!;
  expect(Math.abs(box.height - (box.width * 9) / 16)).toBeLessThanOrEqual(2);
}

/** Page pixel position of a slot's centre on the stage canvas. */
async function slotPoint(page: Page, slug: string) {
  const box = (await page.locator(".case-stage canvas").boundingBox())!;
  const slot = layout.projectSlots.find((s) => s.slug === slug)!;
  const camera = fitCamera(layout, box.width / box.height);
  const ndc = projectToNdc(new THREE.Vector3(slot.opening.x, slot.opening.y, layout.depth / 2), camera);
  return { x: box.x + ((ndc.x + 1) / 2) * box.width, y: box.y + ((1 - ndc.y) / 2) * box.height };
}

test.describe("desktop", () => {
  test.use(DESKTOP);

  test("the poster is in the first HTML and three.js arrives only after the load event", async ({ page }) => {
    let loadedAt = Number.POSITIVE_INFINITY;
    const threeScripts: number[] = [];
    page.on("load", () => (loadedAt = Date.now()));
    page.on("response", async (res) => {
      if (res.request().resourceType() !== "script") return;
      const at = Date.now();
      if ((await res.text().catch(() => "")).includes("WebGLRenderer")) threeScripts.push(at);
    });
    const response = await page.goto("/");
    expect(await response!.text()).toContain("poster-light.webp");
    await page.waitForSelector(".case-stage[data-scene=ready]", { timeout: 30_000 });
    expect(threeScripts.length).toBeGreaterThan(0);
    for (const at of threeScripts) expect(at).toBeGreaterThanOrEqual(loadedAt);
    expect(await threeLoaded(page)).not.toBeNull();
  });

  test("the canvas is hidden from assistive tech and adds no tab stops", async ({ page }) => {
    await page.goto("/");
    await page.waitForSelector(".case-stage[data-scene=ready]", { timeout: 30_000 });
    const stage = page.locator(".case-stage");
    await expect(stage).toHaveAttribute("aria-hidden", "true");
    expect(await stage.locator("a, button, input, [tabindex]:not([tabindex='-1'])").count()).toBe(0);
    expect(await stage.locator("canvas").getAttribute("tabindex")).toBeNull();
  });

  test("a grid card lights its slot, and a row link lights its row", async ({ page }) => {
    await page.goto("/");
    await page.waitForSelector(".case-stage[data-scene=ready]", { timeout: 30_000 });
    await page.locator('[data-slug="glare-zone"] .slot__link').hover();
    await expect(page.locator(".case-stage")).toHaveAttribute("data-lit", "glare-zone");
    await page.getByRole("link", { name: "XR work" }).hover();
    await expect(page.locator(".case-stage")).toHaveAttribute("data-lit", "row:xr");
  });

  test("pointing at a 3D slot lights its card, and clicking opens the project", async ({ page }) => {
    await page.goto("/");
    await page.waitForSelector(".case-stage[data-scene=ready]", { timeout: 30_000 });
    const b2 = await slotPoint(page, "instanter");
    await page.mouse.move(b2.x, b2.y);
    await expect(page.locator('[data-slug="instanter"]')).toHaveAttribute("data-lit", "");
    await page.mouse.click(b2.x, b2.y);
    await expect(page).toHaveURL(/\/work\/instanter$/);
  });

  test("clicking a divider or the frame goes nowhere", async ({ page }) => {
    await page.goto("/");
    await page.waitForSelector(".case-stage[data-scene=ready]", { timeout: 30_000 });
    const box = (await page.locator(".case-stage canvas").boundingBox())!;
    await page.mouse.click(box.x + 4, box.y + 4);
    await page.waitForTimeout(300);
    await expect(page).toHaveURL(/\/$/);
  });

  test("the full-screen case page loads the scene", async ({ page }) => {
    await page.goto("/case");
    await page.waitForSelector(".case-stage[data-scene=ready]", { timeout: 30_000 });
    await expect(page.locator(".case-stage canvas")).toHaveCount(1);
  });

  test("with reduced motion the poster stays and three.js never loads", async ({ browser }) => {
    const context = await browser.newContext({ ...DESKTOP, reducedMotion: "reduce" });
    const page = await context.newPage();
    await page.goto("/");
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(2500);
    await expect(page.locator(".case-stage canvas")).toHaveCount(0);
    await expect(page.locator(".case-poster img")).toBeVisible();
    expect(await threeLoaded(page)).toBeNull();
    await context.close();
  });

  test("with reduced motion the case page's stage keeps the poster's shape", async ({ browser }) => {
    const context = await browser.newContext({ ...DESKTOP, reducedMotion: "reduce" });
    const page = await context.newPage();
    await page.goto("/case");
    await expectPosterShape(page);
    await context.close();
  });

  test("with WebGL off the poster stays, three.js never loads, and nothing errors", async ({ browser }) => {
    const context = await browser.newContext(DESKTOP);
    await context.addInitScript(NO_WEBGL_SCRIPT);
    const page = await context.newPage();
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
    await page.goto("/");
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(2500);
    await expect(page.locator(".case-stage canvas")).toHaveCount(0);
    await expect(page.locator(".case-poster img")).toBeVisible();
    expect(await threeLoaded(page)).toBeNull();
    expect(errors).toEqual([]);
    await context.close();
  });
});

test("on a phone the poster shows and three.js never loads", async ({ browser }) => {
  const context = await browser.newContext(PHONE);
  const page = await context.newPage();
  await page.goto("/");
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(2500);
  await expect(page.locator(".case-stage canvas")).toHaveCount(0);
  await expect(page.locator(".case-poster img")).toBeVisible();
  expect(await threeLoaded(page)).toBeNull();
  await context.close();
});

test("on a phone the case page's stage is the poster's shape, with no empty bands", async ({ browser }) => {
  const context = await browser.newContext(PHONE);
  const page = await context.newPage();
  await page.goto("/case");
  await expectPosterShape(page);
  await context.close();
});

test("with JavaScript off the poster is there", async ({ browser }) => {
  const context = await browser.newContext({ ...DESKTOP, javaScriptEnabled: false });
  const page = await context.newPage();
  await page.goto("/");
  await expect(page.locator(".case-poster img")).toBeVisible();
  await context.close();
});
