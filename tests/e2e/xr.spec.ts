import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test, type Browser, type Page } from "@playwright/test";
import * as THREE from "three";
import spec from "../../src/scene/case-spec.json";
import { buildLayout } from "../../src/scene/layout";
import { CARD_IN_FRONT, CLOSE } from "../../src/xr/cardLayout";
import { BELOW_EYE, CASE_DISTANCE, pickPlanes } from "../../src/xr/placement";
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

// ------------------------------------------------------------- an emulated Meta Quest 3

/*
 * IWER (Meta's Immersive Web Emulation Runtime) replaces navigator.xr with an emulated
 * Quest 3 before any page script runs. The test then drives its head, controllers and
 * hands. The headset stands at the origin, 1.6 m up, looking down -z, so the case is
 * placed 1 m ahead (z = -1) and 10 cm below the eyes.
 */
const IWER = readFileSync(join(process.cwd(), "node_modules/iwer/build/iwer.min.js"), "utf8");
const INSTALL = `${IWER}
;(() => {
  const device = new IWER.XRDevice(IWER.metaQuest3);
  device.installRuntime({ forceInstall: true });
  device.position.set(0, 1.6, 0);
  window.__xrDevice = device;
})();`;
// Records every <video> the page creates, to check the one-video rule.
const COUNT_VIDEOS = `(() => {
  const make = Document.prototype.createElement;
  window.__videos = [];
  Document.prototype.createElement = function (tag, ...rest) {
    const el = make.call(this, tag, ...rest);
    if (String(tag).toLowerCase() === "video") window.__videos.push(el);
    return el;
  };
})();`;

const layout = buildLayout(spec);
const EYE = 1.6;
const caseCentre = new THREE.Vector3(0, EYE - BELOW_EYE, -CASE_DISTANCE);
const EXIT_Y = -layout.height / 2 - 0.1;

/** World point for a point in the case's own space (z measured from the case centre). */
const inCase = (x: number, y: number, z: number) => caseCentre.clone().add(new THREE.Vector3(x, y, z));
const onCase = (x: number, y: number) => inCase(x, y, layout.depth / 2);
const slotCentre = (slug: string) => {
  const plane = pickPlanes(layout).find((p) => p.slug === slug)!;
  return onCase(plane.x, plane.y);
};
const closeButton = inCase(CLOSE.x, CLOSE.y, layout.depth / 2 + CARD_IN_FRONT);
const cardCentre = inCase(0, 0, layout.depth / 2 + CARD_IN_FRONT);

type Input = "controller" | "hand";
/** Where the right hand points from: a little right of and below the eyes. */
const RIGHT = new THREE.Vector3(0.15, 1.35, -0.25);
/** Reaching across to the left, past an open card. */
const LEFT = new THREE.Vector3(-0.45, 1.45, -0.3);

/** Points the right controller or hand from `from` at a world point. */
async function aim(page: Page, input: Input, target: THREE.Vector3, from = RIGHT) {
  const dir = target.clone().sub(from).normalize();
  const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, -1), dir);
  await page.evaluate(
    ({ input, p, q }) => {
      const device = (window as unknown as { __xrDevice: any }).__xrDevice; // eslint-disable-line @typescript-eslint/no-explicit-any
      const source = input === "hand" ? device.hands.right : device.controllers.right;
      source.position.set(p[0], p[1], p[2]);
      source.quaternion.set(q[0], q[1], q[2], q[3]);
    },
    { input, p: from.toArray(), q: q.toArray() },
  );
  await page.waitForTimeout(150); // a few frames, so the pointer moves onto the target
}

/** A full select: press, hold briefly, release (a trigger pull or a pinch). */
async function select(page: Page, input: Input) {
  const set = (value: number) =>
    page.evaluate(
      ({ input, value }) => {
        const device = (window as unknown as { __xrDevice: any }).__xrDevice; // eslint-disable-line @typescript-eslint/no-explicit-any
        if (input === "hand") device.hands.right.updatePinchValue(value);
        else device.controllers.right.updateButtonValue("trigger", value);
      },
      { input, value },
    );
  await set(1);
  await page.waitForTimeout(120);
  await set(0);
  await page.waitForTimeout(150);
}

/** Every video the page has made: its source path and whether it is playing. */
const videos = (page: Page) =>
  page.evaluate(() =>
    (window as unknown as { __videos: HTMLVideoElement[] }).__videos.map((v) => ({
      src: v.getAttribute("src") ? new URL(v.src).pathname : null,
      playing: !v.paused,
    })),
  );

async function questPage(browser: Browser, input: Input) {
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  await context.addInitScript({ content: COUNT_VIDEOS });
  await context.addInitScript({ content: INSTALL });
  if (input === "hand")
    await context.addInitScript({ content: "window.__xrDevice && (window.__xrDevice.primaryInputMode = 'hand');" });
  const page = await context.newPage();
  const xrChunks: string[] = [];
  page.on("response", async (res) => {
    if (res.request().resourceType() !== "script") return;
    if ((await res.text().catch(() => "")).includes("offerSession")) xrChunks.push(res.url());
  });
  return { context, page, xrChunks };
}

for (const input of ["controller", "hand"] as const) {
  test(`in an emulated Quest 3 (${input}): enter, pull cards, one video at a time, exit`, async ({ browser }) => {
    const { context, page, xrChunks } = await questPage(browser, input);
    await page.goto("/case");
    const enter = page.getByRole("button", { name: "Enter VR" });
    await expect(enter).toBeVisible();
    await expect(page.getByRole("link", { name: "Open on Meta Quest" })).toHaveCount(0);
    // Let everything the page loads on its own arrive first (the 3D case loads when idle).
    await page.waitForSelector(".case-stage[data-scene=ready]", { timeout: 30_000 });
    await page.waitForLoadState("networkidle");
    expect(xrChunks, "no XR code before the press").toEqual([]);

    await enter.click();
    const status = page.getByRole("status");
    await expect(status).toHaveText("In VR", { timeout: 15_000 });
    expect(xrChunks.length, "the XR chunk loads on the press").toBeGreaterThan(0);
    await page.waitForTimeout(500); // the case is placed on the first tracked frame

    // Pull the Instanter card: its loop plays.
    await aim(page, input, slotCentre("instanter"));
    await select(page, input);
    await expect(status).toHaveText("Instanter card open");
    await expect.poll(() => videos(page)).toEqual([{ src: "/loops/instanter.mp4", playing: true }]);

    // The open card blocks the slots behind it: this ray, through the card's centre, would
    // otherwise go on into A2 and open Glare Zone.
    await page.waitForTimeout(600); // the card finishes sliding out
    await aim(page, input, cardCentre);
    await select(page, input);
    await expect(status).toHaveText("Instanter card open");

    // Close puts it back and stops the loop.
    await aim(page, input, closeButton);
    await select(page, input);
    await expect(status).toHaveText("In VR");
    await expect.poll(() => videos(page)).toEqual([{ src: null, playing: false }]);

    // The put-away card takes no selects, even while it is still sliding back in front of
    // its slot: the slot opens again at once.
    await aim(page, input, slotCentre("instanter"));
    await select(page, input);
    await expect(status).toHaveText("Instanter card open");
    await page.waitForTimeout(600);
    await aim(page, input, closeButton);
    await select(page, input);
    await expect(status).toHaveText("In VR");

    // Pull Aloud, then Case Light (reaching past the open card): one video, switched.
    await aim(page, input, slotCentre("aloud"));
    await select(page, input);
    await expect(status).toHaveText("Aloud card open");
    await expect.poll(() => videos(page)).toEqual([{ src: "/loops/aloud.mp4", playing: true }]);
    await page.waitForTimeout(600);
    await aim(page, input, slotCentre("case-light"), LEFT);
    await select(page, input);
    await expect(status).toHaveText("Case Light card open");
    await expect.poll(() => videos(page)).toEqual([{ src: "/loops/case-light.mp4", playing: true }]);

    // Exit: back on the page, focus on Enter VR, nothing left playing.
    await aim(page, input, onCase(0, EXIT_Y));
    await select(page, input);
    await expect(status).toHaveText("Left VR");
    await expect(enter).toBeFocused();
    await expect.poll(() => videos(page)).toEqual([{ src: null, playing: false }]);
    await context.close();
  });
}

test("with ?xrstats=1 (the frame-rate readout) the headset session runs and closes without errors", async ({ browser }) => {
  const { context, page } = await questPage(browser, "controller");
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/case?xrstats=1");
  await page.getByRole("button", { name: "Enter VR" }).click();
  const status = page.getByRole("status");
  await expect(status).toHaveText("In VR", { timeout: 15_000 });
  await page.waitForTimeout(1200); // the readout updates every half second
  await aim(page, "controller", onCase(0, EXIT_Y));
  await select(page, "controller");
  await expect(status).toHaveText("Left VR");
  expect(errors).toEqual([]);
  await context.close();
});
