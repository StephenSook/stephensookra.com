import { expect, test, type Browser, type BrowserContextOptions } from "@playwright/test";
import { PHONE, sitemapPaths } from "./helpers";

// Brief section 11: everything transferred until idle on first load, no clicks, no scrolling.
const BUDGETS = [
  { name: "phone", options: PHONE as BrowserContextOptions, maxBytes: 800 * 1024 },
  { name: "desktop", options: { viewport: { width: 1280, height: 800 } }, maxBytes: 1024 * 1024 },
];
const MAX_FILE_BYTES = 10 * 1024 * 1024;

async function firstView(browser: Browser, options: BrowserContextOptions, path: string) {
  const context = await browser.newContext(options);
  const page = await context.newPage();
  const sizes: Promise<{ url: string; bytes: number }>[] = [];
  page.on("requestfinished", (req) => {
    sizes.push(req.sizes().then((s) => ({ url: req.url(), bytes: s.responseBodySize + s.responseHeadersSize })));
  });
  await page.goto(path);
  await page.waitForLoadState("networkidle");
  const all = await Promise.all(sizes);
  await context.close();
  return all;
}

for (const budget of BUDGETS) {
  test(`first view stays under ${budget.maxBytes / 1024} KB on ${budget.name}`, async ({ browser, request }) => {
    const report: string[] = [];
    for (const path of await sitemapPaths(request)) {
      const responses = await firstView(browser, budget.options, path);
      const total = responses.reduce((sum, r) => sum + r.bytes, 0);
      report.push(`${path}: ${Math.round(total / 1024)} KB over ${responses.length} requests`);
      expect(total, `${path} on ${budget.name}`).toBeLessThanOrEqual(budget.maxBytes);
      for (const r of responses) {
        expect(r.bytes, r.url).toBeLessThan(MAX_FILE_BYTES);
        expect(r.url, "tier 1 ships no three.js").not.toMatch(/three(\.module)?(\.min)?\.js/);
      }
    }
    test.info().annotations.push({ type: "first view", description: report.join("; ") });
    console.log(`[budget ${budget.name}] ${report.join(" | ")}`);
  });
}
