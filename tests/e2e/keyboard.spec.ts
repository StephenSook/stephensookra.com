import { expect, test } from "@playwright/test";

test("the first Tab reaches the skip link, and it moves focus into main", async ({ page }) => {
  await page.goto("/");
  await page.keyboard.press("Tab");
  await expect(page.locator(":focus")).toHaveText("Skip to content");
  await page.keyboard.press("Enter");
  await expect.poll(() => page.evaluate(() => document.activeElement?.id)).toBe("main");
});

test("Resume is reached within 8 Tabs", async ({ page }) => {
  await page.goto("/");
  for (let i = 1; i <= 8; i++) {
    await page.keyboard.press("Tab");
    const href = await page.evaluate(() => document.activeElement?.getAttribute("href"));
    if (href === "/resume") return;
  }
  throw new Error("Resume link not reached in 8 Tabs");
});

test("every project slot is a single tab stop with a visible focus ring", async ({ page }) => {
  await page.goto("/");
  const total = await page.locator(".slot__link").count();
  expect(total).toBe(6);
  const seen = new Set<string>();
  for (let i = 0; i < 60 && seen.size < total; i++) {
    await page.keyboard.press("Tab");
    const info = await page.evaluate(() => {
      const el = document.activeElement as HTMLElement | null;
      if (!el?.classList.contains("slot__link")) return null;
      const slot = el.closest(".slot")!;
      const style = getComputedStyle(slot);
      return { href: el.getAttribute("href")!, outline: parseFloat(style.outlineWidth), outlineStyle: style.outlineStyle };
    });
    if (!info) continue;
    expect(info.outlineStyle, info.href).not.toBe("none");
    expect(info.outline, info.href).toBeGreaterThanOrEqual(2);
    seen.add(info.href);
  }
  expect(seen.size).toBe(total);
});
