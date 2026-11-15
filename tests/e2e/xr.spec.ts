import { expect, test } from "@playwright/test";
import { headsetPageUrl, webLaunchUrl } from "../../src/xr/support";
import { PHONE } from "./helpers";

// Plain Chromium has no XR runtime, so these runs see the laptop and phone doors.

test.describe("the headset door without a headset", () => {
  test.use({ viewport: { width: 1280, height: 900 } });

  for (const path of ["/case", "/"]) {
    test(`a laptop on ${path} gets the Meta Web Launch link and no Enter VR`, async ({ page }) => {
      await page.goto(path);
      const link = page.getByRole("link", { name: "Open on Meta Quest" });
      await expect(link).toBeVisible();
      const origin = new URL(page.url()).origin;
      await expect(link).toHaveAttribute("href", webLaunchUrl(headsetPageUrl(origin)));
      await expect(page.getByText(/not yet tested/)).toBeVisible();
      await expect(page.getByRole("button", { name: "Enter VR" })).toHaveCount(0);
    });
  }
});

test("a phone gets no headset door", async ({ browser }) => {
  const context = await browser.newContext(PHONE);
  const page = await context.newPage();
  await page.goto("/case");
  await page.waitForLoadState("networkidle");
  await expect(page.locator(".xr-door")).toHaveText("");
  await expect(page.getByRole("link", { name: "Open on Meta Quest" })).toHaveCount(0);
  await context.close();
});
