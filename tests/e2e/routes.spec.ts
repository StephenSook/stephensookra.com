import { expect, test } from "@playwright/test";
import { sitemapPaths } from "./helpers";

test("every sitemap page answers 200 with a visible h1", async ({ page, request }) => {
  for (const path of await sitemapPaths(request)) {
    const response = await page.goto(path);
    expect(response?.status(), path).toBe(200);
    await expect(page.locator("h1"), path).toBeVisible();
  }
});

test("every internal link on every page resolves", async ({ page, request }) => {
  const targets = new Set<string>();
  for (const path of await sitemapPaths(request)) {
    await page.goto(path);
    const hrefs = await page.locator("a[href^='/']").evaluateAll((as) => as.map((a) => a.getAttribute("href")!));
    for (const href of hrefs) targets.add(href.split("#")[0] || "/");
  }
  expect(targets.size).toBeGreaterThan(10);
  for (const target of targets) {
    const res = await request.get(target);
    expect(res.status(), target).toBe(200);
  }
});

test("old URLs answer 301 to their new homes", async ({ request }) => {
  for (const [from, to] of [
    ["/lab", "/case"],
    ["/work/saber", "/work"],
    ["/work/nest", "/work"],
  ]) {
    const res = await request.get(from, { maxRedirects: 0 });
    expect(res.status(), from).toBe(301);
    expect(new URL(res.headers().location, "http://x").pathname, from).toBe(to);
  }
});

test("archive pages keep answering", async ({ request }) => {
  for (const slug of ["trace", "stepsafe", "pyrolens"]) expect((await request.get(`/work/${slug}`)).status()).toBe(200);
});

test("unknown work pages are real 404s", async ({ request }) => {
  expect((await request.get("/work/anything")).status()).toBe(404);
  expect((await request.get("/no-such-page")).status()).toBe(404);
});

test("the resume PDF is served at its old URL", async ({ request }) => {
  const res = await request.get("/resume/Stephen_Sookra_Resume.pdf");
  expect(res.status()).toBe(200);
  expect(res.headers()["content-type"]).toBe("application/pdf");
});

test("security headers are set", async ({ request }) => {
  const headers = (await request.get("/")).headers();
  expect(headers["x-content-type-options"]).toBe("nosniff");
  expect(headers["referrer-policy"]).toBe("strict-origin-when-cross-origin");
  expect(headers["x-powered-by"]).toBeUndefined();
});
