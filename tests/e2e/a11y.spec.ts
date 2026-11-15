import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { sitemapPaths } from "./helpers";

for (const colorScheme of ["light", "dark"] as const) {
  test(`axe finds no serious or critical issues in ${colorScheme} mode`, async ({ browser, request }) => {
    const context = await browser.newContext({ colorScheme });
    const page = await context.newPage();
    const failures: string[] = [];
    for (const path of [...(await sitemapPaths(request)), "/case"]) {
      await page.goto(path);
      const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"]).analyze();
      for (const v of results.violations)
        if (v.impact === "serious" || v.impact === "critical")
          failures.push(`${path}: ${v.id} (${v.impact}) on ${v.nodes.map((n) => n.target.join(" ")).join(", ")}`);
    }
    await context.close();
    expect(failures).toEqual([]);
  });
}
