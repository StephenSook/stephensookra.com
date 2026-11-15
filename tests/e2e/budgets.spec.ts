import { expect, test, type Browser, type BrowserContextOptions } from "@playwright/test";
import { PHONE, sitemapPaths } from "./helpers";

// Brief section 11. "First view" is everything transferred until the page is idle on first
// load, with no clicks or scrolling. On desktop, / and /case also load the 3D chunk after the
// load event; it has its own budget and does not count towards the first view.
const KB = 1024;
const BUDGETS = [
  { name: "phone", options: PHONE as BrowserContextOptions, firstView: 800 * KB },
  { name: "desktop", options: { viewport: { width: 1280, height: 800 } }, firstView: 1024 * KB },
];
const LAZY_3D_JS = 350 * KB;
const MAX_FILE = 10 * 1024 * KB;
const THREE_ROUTES = new Set(["/", "/case"]);
/** In the XR chunk only (the XR store's options); no page may load it before Enter VR. */
const XR_MARKER = "offerSession";

type Entry = { name: string; start: number; bytes: number; type: string };

async function measure(browser: Browser, options: BrowserContextOptions, path: string) {
  const context = await browser.newContext(options);
  const page = await context.newPage();
  const xrScripts: string[] = [];
  page.on("response", async (res) => {
    if (res.request().resourceType() !== "script") return;
    if ((await res.text().catch(() => "")).includes(XR_MARKER)) xrScripts.push(res.url());
  });
  await page.goto(path);
  await page.waitForLoadState("networkidle");
  // Give the gated scene its idle window, then let the network settle again.
  await page.waitForTimeout(2500);
  await page.waitForLoadState("networkidle");
  const result = await page.evaluate(() => {
    const nav = performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming;
    const entries = (performance.getEntriesByType("resource") as PerformanceResourceTiming[]).map((e) => ({
      name: e.name,
      start: e.startTime,
      bytes: e.transferSize,
      type: e.initiatorType,
    }));
    return {
      loadEnd: nav.loadEventEnd,
      docBytes: nav.transferSize,
      entries,
      three: (window as unknown as { __THREE__?: string }).__THREE__ ?? null,
    };
  });
  await context.close();
  return { ...(result as { loadEnd: number; docBytes: number; entries: Entry[]; three: string | null }), xrScripts };
}

for (const budget of BUDGETS) {
  test(`budgets on ${budget.name}: first view, lazy 3D chunk, three.js only where it belongs, no XR code`, async ({
    browser,
    request,
  }) => {
    // Every sitemap page, each with a fresh context and an idle window for the gated scene.
    test.setTimeout(300_000);
    const report: string[] = [];
    for (const path of [...(await sitemapPaths(request))]) {
      const r = await measure(browser, budget.options, path);
      const before = r.entries.filter((e) => e.start <= r.loadEnd);
      const after = r.entries.filter((e) => e.start > r.loadEnd);
      const firstView = r.docBytes + before.reduce((s, e) => s + e.bytes, 0);
      const lazyJs = after.filter((e) => e.type === "script" || e.name.endsWith(".js")).reduce((s, e) => s + e.bytes, 0);
      report.push(`${path}: first view ${Math.round(firstView / KB)} KB, lazy JS ${Math.round(lazyJs / KB)} KB`);

      expect(firstView, `${path} first view on ${budget.name}`).toBeLessThanOrEqual(budget.firstView);
      expect(lazyJs, `${path} lazy JS on ${budget.name}`).toBeLessThanOrEqual(LAZY_3D_JS);
      for (const e of r.entries) expect(e.bytes, e.name).toBeLessThan(MAX_FILE);

      const allowed = budget.name === "desktop" && THREE_ROUTES.has(path);
      if (allowed) expect(r.three, `${path} should load three.js on desktop`).not.toBeNull();
      else expect(r.three, `${path} must not load three.js on ${budget.name}`).toBeNull();
      // The XR chunk loads only after an Enter VR press (brief section 11).
      expect(r.xrScripts, `${path} must not load XR code on ${budget.name}`).toEqual([]);
    }
    console.log(`[budget ${budget.name}] ${report.join(" | ")}`);
  });
}
