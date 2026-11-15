import { join } from "node:path";
import { chromium, expect, test, type Browser, type Page } from "@playwright/test";
import arManifest from "../../public/ar/manifest.json";
import marker from "../../public/marker/manifest.json";
import { PHONE } from "./helpers";

// Marker AR on /ar/marker. Chromium's fake camera plays a recorded video (made by
// `npm run marker:card` from the card itself), so the real engine finds the real card here.

const ENGINE = /\/vendor\/8thwall\/[^/]+\/xr(-tracking)?\.js$/;
const FIXTURES = join(process.cwd(), "tests/fixtures/marker");
/** Records every camera track the page opens, to check the camera really turns off. */
const RECORD_TRACKS = `(() => {
  window.__tracks = [];
  const md = navigator.mediaDevices;
  if (!md) return;
  const gum = md.getUserMedia.bind(md);
  md.getUserMedia = async (c) => { const s = await gum(c); window.__tracks.push(...s.getTracks()); return s; };
})();`;

/** A phone whose camera is Chromium's fake camera playing one of the fixture videos. */
async function cameraPhone(baseURL: string | undefined, video: "card" | "none") {
  const browser = await chromium.launch({
    args: [
      "--use-fake-device-for-media-stream",
      "--use-fake-ui-for-media-stream",
      `--use-file-for-fake-video-capture=${join(FIXTURES, `${video}.mjpeg`)}`,
    ],
  });
  const context = await browser.newContext({
    ...PHONE,
    baseURL,
    permissions: ["camera"],
  });
  await context.addInitScript(RECORD_TRACKS);
  return { browser, page: await context.newPage() };
}

async function withCamera(baseURL: string | undefined, video: "card" | "none", body: (page: Page) => Promise<void>) {
  let browser: Browser | undefined;
  try {
    const phone = await cameraPhone(baseURL, video);
    browser = phone.browser;
    await body(phone.page);
  } finally {
    await browser?.close();
  }
}

const state = (page: Page) => page.locator(".marker-ar");
const trackStates = (page: Page) =>
  page.evaluate(() => (window as unknown as { __tracks: MediaStreamTrack[] }).__tracks.map((t) => t.readyState));

async function open(page: Page) {
  const requests: string[] = [];
  const errors: string[] = [];
  page.on("request", (r) => requests.push(r.url()));
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/ar/marker");
  await page.waitForLoadState("networkidle");
  return { requests, errors };
}

const offSite = (page: Page, urls: string[]) => {
  const origin = new URL(page.url()).origin;
  return urls.filter((u) => !u.startsWith("data:") && !u.startsWith("blob:") && new URL(u).origin !== origin);
};

test("before the press: no engine, no three.js and no model, and the card is one tap away", async ({ browser }) => {
  const context = await browser.newContext(PHONE);
  const page = await context.newPage();
  const { requests } = await open(page);
  await expect(state(page)).toHaveAttribute("data-state", "idle");
  expect(requests.filter((u) => ENGINE.test(u) || u.endsWith(".glb"))).toEqual([]);
  expect(await page.evaluate(() => (window as unknown as { __THREE__?: string }).__THREE__ ?? null)).toBeNull();
  await expect(page.getByRole("link", { name: "Print the card" })).toHaveAttribute("href", "/ar/marker/card");
  await expect(page.getByText(/not yet tested on a phone/)).toBeVisible();
  await context.close();
});

test("a camera the browser blocks: says so, and how to allow it, without loading the engine", async ({ browser }) => {
  const context = await browser.newContext(PHONE);
  // What Chromium and Safari answer once a person has said no for this site.
  await context.addInitScript(() => {
    const query = navigator.permissions.query.bind(navigator.permissions);
    navigator.permissions.query = (d: PermissionDescriptor) =>
      d.name === ("camera" as PermissionName) ? Promise.resolve({ state: "denied" } as PermissionStatus) : query(d);
  });
  const page = await context.newPage();
  const { requests } = await open(page);
  await page.getByRole("button", { name: "Start the camera" }).click();
  await expect(state(page)).toHaveAttribute("data-state", "denied");
  await expect(page.locator(".marker-ar__status")).toHaveText(/Allow it in your browser's site settings/);
  await expect(page.locator("dialog.marker-ar__stage")).not.toHaveAttribute("open");
  expect(requests.filter((u) => ENGINE.test(u))).toEqual([]);
  await context.close();
});

test.describe("with a camera that sees the printed card", () => {
  test("finds the card, puts the case on it, and Stop turns the camera off", async ({ baseURL }) => {
    await withCamera(baseURL, "card", async (page) => {
      const { requests, errors } = await open(page);
      await page.getByRole("button", { name: "Start the camera" }).click();
      await expect(page.locator("dialog.marker-ar__stage")).toHaveAttribute("open");
      await expect(page.getByRole("button", { name: "Stop the camera" })).toBeFocused();
      await expect(state(page)).toHaveAttribute("data-state", "tracking", {
        timeout: 30_000,
      });
      await expect(page.locator(".marker-ar__live")).toHaveText("Found the card");

      expect(requests.filter((u) => ENGINE.test(u)).length).toBe(2); // xr.js and its image-target chunk
      expect(requests.some((u) => new URL(u).pathname === marker.target.imagePath)).toBe(true);
      expect(requests.some((u) => new URL(u).pathname === arManifest.glb)).toBe(true);
      expect(offSite(page, requests), "every request stays on this site").toEqual([]);
      expect(await trackStates(page)).toEqual(["live"]);

      await page.getByRole("button", { name: "Stop the camera" }).click();
      await expect(state(page)).toHaveAttribute("data-state", "idle");
      await expect(page.locator("dialog.marker-ar__stage")).not.toHaveAttribute("open");
      await expect.poll(() => trackStates(page)).toEqual(["ended"]);
      await expect(page.getByRole("button", { name: "Start the camera" })).toBeFocused();
      expect(errors).toEqual([]);
    });
  });

  test("turns the camera off when the page is hidden", async ({ baseURL }) => {
    await withCamera(baseURL, "card", async (page) => {
      await open(page);
      await page.getByRole("button", { name: "Start the camera" }).click();
      await expect(state(page)).toHaveAttribute("data-state", "tracking", {
        timeout: 30_000,
      });
      await page.evaluate(() => {
        Object.defineProperty(document, "visibilityState", {
          configurable: true,
          get: () => "hidden",
        });
        document.dispatchEvent(new Event("visibilitychange"));
      });
      await expect(state(page)).toHaveAttribute("data-state", "stopped");
      await expect.poll(() => trackStates(page)).toEqual(["ended"]);
      await expect(page.locator(".marker-ar__status")).toHaveText("The camera stopped when you left the page.");
    });
  });
});

test.describe("with a camera that sees no card", () => {
  test("keeps looking and never claims to have found it", async ({ baseURL }) => {
    await withCamera(baseURL, "none", async (page) => {
      await open(page);
      await page.getByRole("button", { name: "Start the camera" }).click();
      await expect(state(page)).toHaveAttribute("data-state", "scanning", {
        timeout: 30_000,
      });
      await expect(page.locator(".marker-ar__live")).toHaveText("Point the camera at the card");
      // Ten seconds of a moving test pattern: the tracker must not find a card in it.
      await page.waitForTimeout(10_000);
      await expect(state(page)).toHaveAttribute("data-state", "scanning");
    });
  });
});

test("when the tracker cannot load, the page says so and the camera never opens", async ({ baseURL }) => {
  await withCamera(baseURL, "card", async (page) => {
    await page.route(ENGINE, (route) => route.fulfill({ status: 404, body: "" }));
    await open(page);
    await page.getByRole("button", { name: "Start the camera" }).click();
    await expect(state(page)).toHaveAttribute("data-state", "failed");
    await expect(page.locator(".marker-ar__status")).toHaveText("The camera or the card tracker could not start here.");
    await expect(page.locator("dialog.marker-ar__stage")).not.toHaveAttribute("open");
    expect(await trackStates(page)).toEqual([]);
    await expect(page.getByRole("button", { name: "Start the camera" })).toBeEnabled();
  });
});

test("when only the tracking chunk fails, the page says so, and a later press still starts", async ({ baseURL }) => {
  await withCamera(baseURL, "card", async (page) => {
    const chunk = /\/vendor\/8thwall\/[^/]+\/xr-tracking\.js$/;
    await page.route(chunk, (route) => route.fulfill({ status: 404, body: "" }));
    await open(page);
    await page.getByRole("button", { name: "Start the camera" }).click();
    await expect(state(page)).toHaveAttribute("data-state", "failed", { timeout: 40_000 });
    expect(await trackStates(page)).toEqual([]);
    await page.unroute(chunk);
    await page.getByRole("button", { name: "Start the camera" }).click();
    await expect(state(page)).toHaveAttribute("data-state", "tracking", { timeout: 30_000 });
  });
});

test("the card page offers the card as a PDF and a PNG that both download", async ({ page, request }) => {
  await page.goto("/ar/marker/card");
  await expect(page.getByRole("img", { name: /stephensookra\.com\/ar\/marker/ })).toBeVisible();
  const pdfLink = page.getByRole("link", { name: "Download the card (PDF)" });
  const pngLink = page.getByRole("link", {
    name: "Download the picture (PNG)",
  });
  await expect(pdfLink).toHaveAttribute("href", marker.pdf);
  await expect(pngLink).toHaveAttribute("href", marker.card);

  const pdf = await request.get(marker.pdf);
  expect(pdf.status()).toBe(200);
  expect(pdf.headers()["content-type"]).toBe("application/pdf");
  expect((await pdf.body()).subarray(0, 5).toString()).toBe("%PDF-");
  const png = await request.get(marker.card);
  expect(png.status()).toBe(200);
  expect(png.headers()["content-type"]).toBe("image/png");
  const target = await request.get(marker.target.imagePath);
  expect(target.status()).toBe(200);
  for (const res of [pdf, png, target]) expect(res.headers()["cache-control"]).toContain("immutable");
});
