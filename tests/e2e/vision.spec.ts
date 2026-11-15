import { expect, test } from "@playwright/test";
import vision from "../../public/vision/manifest.json";

// /vision: Apple Vision Pro's immersive website environment. Chromium has no <model>
// element and no immersive API, so the first test is what every other browser sees. The
// second stands in for visionOS 27 Safari with the API's contract from WWDC26 session 320
// (document.immersiveEnabled, model.requestImmersive, immersivechange, exitImmersive); it
// checks this page's wiring, not Safari.

const EMULATE_VISIONOS = `(() => {
  Object.defineProperty(document, "immersiveEnabled", { configurable: true, value: true });
  document.immersiveElement = null;
  const change = (el) => {
    document.immersiveElement = el;
    (el || document).dispatchEvent(new Event("immersivechange", { bubbles: true }));
  };
  HTMLElement.prototype.requestImmersive = function () {
    window.__requested = (window.__requested || 0) + 1;
    setTimeout(() => change(this), 50);
    return Promise.resolve();
  };
  document.exitImmersive = () => {
    const el = document.immersiveElement;
    document.immersiveElement = null;
    if (el) el.dispatchEvent(new Event("immersivechange", { bubbles: true }));
    return Promise.resolve();
  };
})();`;

test("elsewhere, the page says where the room opens, offers the case in VR, and loads no room", async ({ page }) => {
  const requests: string[] = [];
  page.on("request", (r) => requests.push(new URL(r.url()).pathname));
  await page.goto("/vision");
  await page.waitForLoadState("networkidle");
  await expect(page.getByText(/opens in Safari on Apple Vision Pro, from visionOS 27/)).toBeVisible();
  await expect(page.getByText("Built for Apple Vision Pro, not yet tested in a headset.")).toBeVisible();
  await expect(page.locator("model")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Step into the room" })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Open on Meta Quest" })).toBeVisible(); // the laptop door
  expect(requests.filter((p) => p.startsWith("/vision/"))).toEqual([]);
});

test("with visionOS's immersive API, a press opens the room and Leave brings the reader back", async ({ page }) => {
  await page.addInitScript({ content: EMULATE_VISIONOS });
  await page.goto("/vision");
  const enter = page.getByRole("button", { name: "Step into the room" });
  await expect(enter).toBeVisible();
  const model = page.locator("model");
  await expect(model).toHaveAttribute("src", vision.room);
  await expect(model).toHaveAttribute("environmentmap", vision.environment);
  await expect(model).toBeHidden(); // display: none, no inline preview

  await enter.click();
  const status = page.locator(".vision-room__status");
  await expect(status).toHaveText("In the room");
  expect(await page.evaluate(() => (window as unknown as { __requested: number }).__requested)).toBe(1);
  await page.getByRole("button", { name: "Leave the room" }).click();
  await expect(status).toHaveText("Left the room");
  await expect(enter).toBeFocused();
});

test("the room and its light are served with the types Safari needs, and cached for good", async ({ request }) => {
  for (const [url, type] of [
    [vision.room, "model/vnd.usdz+zip"],
    [vision.environment, "image/vnd.radiance"],
  ]) {
    const res = await request.get(url);
    expect(res.status(), url).toBe(200);
    expect(res.headers()["content-type"], url).toBe(type);
    expect(res.headers()["cache-control"], url).toContain("immutable");
  }
  const manifest = await request.get("/vision/manifest.json");
  expect(manifest.headers()["cache-control"] ?? "").not.toContain("immutable");
});
