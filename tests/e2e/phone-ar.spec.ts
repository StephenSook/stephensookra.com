import { expect, test, type BrowserContext, type Page } from "@playwright/test";
import manifest from "../../public/ar/manifest.json";
import { PHONE } from "./helpers";

// Phone AR on /case/ar. Chromium here stands in for an Android phone (no AR runtime, so the
// viewer shows the case in 3D only); an init script stands in for iPhone Safari's AR Quick Look.

const VIEWER_SCRIPT = /\/vendor\/model-viewer\/[^/]+\/model-viewer\.min\.js$/;
/** iPhone Safari reports rel="ar" as supported on links; Chromium does not. */
const QUICK_LOOK = `(() => {
  const supports = DOMTokenList.prototype.supports;
  DOMTokenList.prototype.supports = function (token) {
    return token === "ar" ? true : supports.call(this, token);
  };
})();`;

async function openPhone(context: BrowserContext) {
  const page = await context.newPage();
  const requests: string[] = [];
  const errors: string[] = [];
  page.on("request", (r) => requests.push(r.url()));
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });
  await page.goto("/case/ar");
  await page.waitForLoadState("networkidle");
  return { page, requests, errors };
}

const sameOrigin = (page: Page, urls: string[]) => {
  const origin = new URL(page.url()).origin;
  return urls.filter((u) => !u.startsWith("data:") && !u.startsWith("blob:") && new URL(u).origin !== origin);
};

test("a phone loads the 3D viewer only on the tap, then shows the case at real size with AR offered", async ({
  browser,
}) => {
  const context = await browser.newContext(PHONE);
  const { page, requests, errors } = await openPhone(context);

  expect(requests.filter((u) => VIEWER_SCRIPT.test(u))).toEqual([]);
  expect(requests.filter((u) => u.endsWith(".glb") || u.endsWith(".usdz"))).toEqual([]);
  await expect(page.locator("model-viewer")).toHaveCount(0);

  await page.getByRole("button", { name: "See it in 3D and in your room" }).click();
  // React sets a defined custom element's known props as properties, so read the element's own state.
  await page.waitForFunction(() => (document.querySelector("model-viewer") as { loaded?: boolean } | null)?.loaded === true, null, {
    timeout: 30_000,
  });
  const state = await page.locator("model-viewer").evaluate((el) => {
    const v = el as HTMLElement & { src: string; iosSrc: string; ar: boolean; arScale: string; arModes: string };
    return { src: v.src, iosSrc: v.iosSrc, ar: v.ar, arScale: v.arScale, arModes: v.arModes };
  });
  expect(state).toEqual({
    src: manifest.glb,
    iosSrc: manifest.usdz,
    ar: true,
    arScale: "fixed",
    arModes: "webxr scene-viewer quick-look",
  });

  expect(requests.filter((u) => VIEWER_SCRIPT.test(u))).toHaveLength(1);
  expect(requests.some((u) => new URL(u).pathname === manifest.glb)).toBe(true);
  expect(sameOrigin(page, requests), "every request stays on this site").toEqual([]);
  await expect(page.getByRole("status")).toHaveText("");
  expect(errors).toEqual([]);
  await context.close();
});

test("on an iPhone, the poster is a plain AR Quick Look link to the USDZ, with no viewer script", async ({
  browser,
}) => {
  const context = await browser.newContext(PHONE);
  await context.addInitScript(QUICK_LOOK);
  const { page, requests, errors } = await openPhone(context);

  const link = page.locator('a[rel="ar"]');
  await expect(link).toHaveAttribute("href", manifest.usdz);
  // AR Quick Look opens only when the link's one child is an <img> or <picture> (or <model> on Safari 27).
  expect(await link.evaluate((a) => [a.children.length, a.firstElementChild?.tagName])).toEqual([1, "PICTURE"]);
  await expect(page.getByText("Tap the case to place it in your room.")).toBeVisible();
  await expect(page.getByRole("button", { name: "See it in 3D and in your room" })).toHaveCount(0);
  expect(requests.filter((u) => VIEWER_SCRIPT.test(u))).toEqual([]);
  expect(sameOrigin(page, requests)).toEqual([]);
  expect(errors).toEqual([]);
  await context.close();
});

test("when the 3D viewer cannot load, the page says so and keeps the picture", async ({ browser }) => {
  const context = await browser.newContext(PHONE);
  await context.route(VIEWER_SCRIPT, (route) => route.fulfill({ status: 404, body: "" }));
  const page = await context.newPage();
  await page.goto("/case/ar");
  await page.waitForLoadState("networkidle");

  await page.getByRole("button", { name: "See it in 3D and in your room" }).click();
  await expect(page.getByRole("status")).toHaveText("The 3D viewer is not available here.");
  await expect(page.locator("img.phone-ar__poster")).toBeVisible();
  await expect(page.locator("model-viewer")).toHaveCount(0);
  await context.close();
});

test("the AR files are served with the types phones need and cached for good", async ({ request }) => {
  const files = [
    { path: manifest.usdz, type: "model/vnd.usdz+zip", magic: "504b0304" }, // a zip
    { path: manifest.glb, type: "model/gltf-binary", magic: "676c5446" }, // "glTF"
  ];
  for (const f of files) {
    const res = await request.get(f.path);
    expect(res.status(), f.path).toBe(200);
    expect(res.headers()["content-type"], f.path).toBe(f.type);
    expect(res.headers()["cache-control"], f.path).toContain("immutable");
    expect((await res.body()).subarray(0, 4).toString("hex"), f.path).toBe(f.magic);
  }

  const script = await request.get("/vendor/model-viewer/4.4.0/model-viewer.min.js");
  expect(script.status()).toBe(200);
  expect(script.headers()["content-type"]).toMatch(/javascript/);
  expect(script.headers()["cache-control"]).toContain("immutable");

  // The manifest names the current generation, so it must never be cached for good.
  const list = await request.get("/ar/manifest.json");
  expect(list.status()).toBe(200);
  expect(list.headers()["cache-control"] ?? "").not.toContain("immutable");
});
