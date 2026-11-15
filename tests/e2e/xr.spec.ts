import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test, type Browser, type Page } from "@playwright/test";
import * as THREE from "three";
import spec from "../../src/scene/case-spec.json";
import { buildLayout } from "../../src/scene/layout";
import { CARD_IN_FRONT, CLOSE } from "../../src/xr/cardLayout";
import { BELOW_EYE, CASE_DISTANCE, pickPlanes } from "../../src/xr/placement";
import { headsetPageUrl, webLaunchUrl } from "../../src/xr/support";
import { HINT_AHEAD, HINT_BELOW, HINT_EXIT } from "../../src/xr/wall";
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

test("a phone gets no headset door, only a link to see the case in its room", async ({ browser }) => {
  const context = await browser.newContext(PHONE);
  const page = await context.newPage();
  await page.goto("/case");
  await page.waitForLoadState("networkidle");
  await expect(page.locator(".xr-door").getByRole("link", { name: "See it in your room" })).toHaveAttribute(
    "href",
    "/case/ar",
  );
  await expect(page.getByRole("link", { name: "Open on Meta Quest" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Enter VR" })).toHaveCount(0);
  await expect(page.locator(".xr-door__note")).toHaveCount(0);
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
/** A place to point at, and the name the session gives it in data-pointing. */
type Target = { at: THREE.Vector3; name: string };
const slot = (slug: string): Target => ({ at: slotCentre(slug), name: slug });
const CLOSE_BUTTON: Target = { at: inCase(CLOSE.x, CLOSE.y, layout.depth / 2 + CARD_IN_FRONT), name: "close" };
const CARD: Target = { at: inCase(0, 0, layout.depth / 2 + CARD_IN_FRONT), name: "card" };
const EXIT: Target = { at: onCase(0, EXIT_Y), name: "exit" };

type Input = "controller" | "hand";
/** Where the right hand points from: a little right of and below the eyes. */
const RIGHT = new THREE.Vector3(0.15, 1.35, -0.25);
/** Reaching across to the left, past an open card. */
const LEFT = new THREE.Vector3(-0.45, 1.45, -0.3);

/**
 * Waits for n animation frames. The emulated headset moves inputs and fires select events
 * on its own frames, so tests wait for frames, not milliseconds (a busy CI machine draws
 * fewer frames per second).
 */
const frames = (page: Page, n: number) =>
  page.evaluate(
    (n) =>
      new Promise<void>((resolve) => {
        let k = 0;
        const tick = () => (++k >= n ? resolve() : requestAnimationFrame(tick));
        requestAnimationFrame(tick);
      }),
    n,
  );

/** Points the right controller or hand from `from` at a target, and waits until the session
 * reports the pointer is on it (data-pointing), however slowly the headset draws frames. */
async function aim(page: Page, input: Input, target: Target, from = RIGHT) {
  const dir = target.at.clone().sub(from).normalize();
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
  await expect(page.locator(".xr-session")).toHaveAttribute("data-pointing", target.name, { timeout: 10_000 });
}

/**
 * A full select (a trigger pull or a pinch), paced by the headset's own events: press and
 * wait for its selectstart, release and wait for its selectend. A click needs press and
 * release within 300 ms, and the emulated headset samples inputs only on its own frames, so
 * waiting on its events works at any frame rate where waiting on a clock does not.
 */
async function select(page: Page, input: Input, holdMs = 0) {
  for (const [value, event] of [
    [1, "selectstart"],
    [0, "selectend"],
  ] as const) {
    if (value === 0 && holdMs) await page.waitForTimeout(holdMs);
    await page.evaluate(
      ({ input, value, event }) =>
        new Promise<void>((resolve, reject) => {
          const device = (window as unknown as { __xrDevice: any }).__xrDevice; // eslint-disable-line @typescript-eslint/no-explicit-any
          const session: XRSession = device.activeSession;
          const timer = setTimeout(() => reject(new Error(`no ${event} within 5 s`)), 5000);
          session.addEventListener(event, () => (clearTimeout(timer), resolve()), { once: true });
          if (input === "hand") device.hands.right.updatePinchValue(value);
          else device.controllers.right.updateButtonValue("trigger", value);
        }),
      { input, value, event },
    );
  }
  await frames(page, 2); // the pointer library dispatches the click
}

/**
 * Aims and selects until the status says `expected`. The emulated headset's ray settles over
 * a few frames (a hand's ray also moves as it pinches), and a click needs the press and the
 * release on the same object, so one attempt can miss. The status is checked before every
 * retry, so a click that lands late is never undone by a second select.
 */
async function selectUntil(page: Page, input: Input, target: Target, expected: string, from = RIGHT) {
  const status = page.getByRole("status");
  await expect(async () => {
    if ((await status.textContent()) === expected) return;
    await aim(page, input, target, from);
    await select(page, input);
    await expect(status).toHaveText(expected, { timeout: 1500 });
  }).toPass({ timeout: 20_000 });
}

/** Records every data-pointing value from now on (the headset pointer's path). */
const startPointingLog = (page: Page) =>
  page.evaluate(() => {
    const el = document.querySelector(".xr-session")!;
    const log: string[] = [];
    (window as unknown as { __pointingLog: string[] }).__pointingLog = log;
    new MutationObserver(() => log.push(el.getAttribute("data-pointing") ?? "")).observe(el, {
      attributes: true,
      attributeFilter: ["data-pointing"],
    });
  });
const pointingLog = (page: Page) =>
  page.evaluate(() => (window as unknown as { __pointingLog: string[] }).__pointingLog);

/** Every video the page has made: its source path and whether it is playing. */
const videos = (page: Page) =>
  page.evaluate(() =>
    (window as unknown as { __videos: HTMLVideoElement[] }).__videos.map((v) => ({
      src: v.getAttribute("src") ? new URL(v.src).pathname : null,
      playing: !v.paused,
    })),
  );

/** Waits for the pulled card to finish sliding out (data-card, from the session), not a clock. */
const cardOut = (page: Page) => expect(page.locator(".xr-session")).toHaveAttribute("data-card", "out");

/**
 * The emulated headset draws into the page's own canvas at the window's size, and a CI runner
 * has no GPU, so every frame is drawn in software. 1024 by 576 is the smallest window that
 * still loads the page's 3D case (1024 px wide) and costs half the pixels of 1280 by 900. The
 * tests aim by 3D rays, so the window size changes no result.
 */
const HEADSET_WINDOW = { width: 1024, height: 576 };

async function questPage(browser: Browser, input: Input, install = INSTALL) {
  const context = await browser.newContext({ viewport: HEADSET_WINDOW });
  await context.addInitScript({ content: COUNT_VIDEOS });
  await context.addInitScript({ content: install });
  if (input === "hand")
    await context.addInitScript({ content: "window.__xrDevice && (window.__xrDevice.primaryInputMode = 'hand');" });
  const page = await context.newPage();
  const xrChunks: string[] = [];
  const profiles: string[] = [];
  page.on("response", async (res) => {
    if (/\/xr\/profiles\/[^/]+\/profile\.json$/.test(res.url())) profiles.push(res.url());
    if (res.request().resourceType() !== "script") return;
    if ((await res.text().catch(() => "")).includes("offerSession")) xrChunks.push(res.url());
  });
  /**
   * Inputs can select once they exist. A controller joins the session only after its layout
   * (profile.json, served from this site) has loaded; hands join at once.
   */
  const inputsReady = async () => {
    if (input === "controller") await expect.poll(() => profiles.length).toBeGreaterThan(0);
    await frames(page, 5);
  };
  return { context, page, xrChunks, inputsReady };
}

for (const input of ["controller", "hand"] as const) {
  test(`in an emulated Quest 3 (${input}): enter, pull cards, one video at a time, exit`, async ({ browser }) => {
    const { context, page, xrChunks, inputsReady } = await questPage(browser, input);
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
    await inputsReady();

    // Pull the Instanter card: its loop plays.
    await selectUntil(page, input, slot("instanter"), "Instanter card open");
    await expect.poll(() => videos(page)).toEqual([{ src: "/loops/instanter.mp4", playing: true }]);

    // The open card blocks the slots behind it: this ray, through the card's centre, lands on
    // the card (it would otherwise go on into A2), and selecting there changes nothing.
    await cardOut(page);
    await aim(page, input, CARD);
    await select(page, input);
    await expect(status).toHaveText("Instanter card open");

    // Close puts it back and stops the loop.
    await selectUntil(page, input, CLOSE_BUTTON, "In VR");
    await expect.poll(() => videos(page)).toEqual([{ src: null, playing: false }]);

    // The put-away card takes no pointers, even while it is still sliding back in front of
    // its slot: aimed at the slot straight after Close, the ray reaches the slot without ever
    // landing on "card". (Read before the select: the card that select opens may then pass
    // under the ray, which is right for an open card.)
    await startPointingLog(page);
    await aim(page, input, slot("instanter"));
    const path = await pointingLog(page);
    expect(path, `the closed card caught the pointer: ${path.join(" > ")}`).not.toContain("card");
    await select(page, input);
    await expect(status).toHaveText("Instanter card open");
    await cardOut(page);
    await selectUntil(page, input, CLOSE_BUTTON, "In VR");

    // Pull Aloud, then Case Light (reaching past the open card): one video, switched.
    await selectUntil(page, input, slot("aloud"), "Aloud card open");
    await expect.poll(() => videos(page)).toEqual([{ src: "/loops/aloud.mp4", playing: true }]);
    await cardOut(page);
    await selectUntil(page, input, slot("case-light"), "Case Light card open", LEFT);
    await expect.poll(() => videos(page)).toEqual([{ src: "/loops/case-light.mp4", playing: true }]);

    // Exit: back on the page, focus on Enter VR, nothing left playing.
    await selectUntil(page, input, EXIT, "Left VR");
    await expect(enter).toBeFocused();
    await expect.poll(() => videos(page)).toEqual([{ src: null, playing: false }]);
    await context.close();
  });
}

test("with ?xrstats=1 (the frame-rate readout) the headset session runs and closes without errors", async ({ browser }) => {
  const { context, page, inputsReady } = await questPage(browser, "controller");
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/case?xrstats=1");
  await page.getByRole("button", { name: "Enter VR" }).click();
  const status = page.getByRole("status");
  await expect(status).toHaveText("In VR", { timeout: 15_000 });
  await inputsReady();
  await page.waitForTimeout(1200); // the readout updates every half second
  await selectUntil(page, "controller", EXIT, "Left VR");
  expect(errors).toEqual([]);
  await context.close();
});

test("in an emulated Quest 3: leave and enter again from the same page, then pull a card", async ({ browser }) => {
  const { context, page, xrChunks, inputsReady } = await questPage(browser, "controller");
  await page.goto("/case");
  const enter = page.getByRole("button", { name: "Enter VR" });
  const status = page.getByRole("status");
  await enter.click();
  await expect(status).toHaveText("In VR", { timeout: 15_000 });
  await inputsReady();
  await selectUntil(page, "controller", EXIT, "Left VR");
  const chunksAfterFirst = xrChunks.length;

  // The second press asks at once (the session stayed loaded), and loads nothing more.
  await enter.click();
  await expect(status).toHaveText("In VR", { timeout: 15_000 });
  expect(xrChunks.length).toBe(chunksAfterFirst);
  await inputsReady();
  // XR Dojo's loop is the recorded browser-port capture (it has no public film).
  await selectUntil(page, "controller", slot("xr-dojo"), "XR Dojo card open");
  await expect.poll(() => videos(page)).toEqual([{ src: "/loops/xr-dojo.mp4", playing: true }]);
  await selectUntil(page, "controller", EXIT, "Left VR");
  await expect.poll(() => videos(page)).toEqual([{ src: null, playing: false }]);
  await context.close();
});

test("in an emulated Quest 3: a slow pinch (held 600 ms) still opens a card", async ({ browser }) => {
  // The pointer library's own click drops presses held over 300 ms; a relaxed pinch is often
  // longer, so the site counts press and release on the same target, however long.
  const { context, page, inputsReady } = await questPage(browser, "hand");
  await page.goto("/case");
  await page.getByRole("button", { name: "Enter VR" }).click();
  const status = page.getByRole("status");
  await expect(status).toHaveText("In VR", { timeout: 15_000 });
  await inputsReady();
  await aim(page, "hand", slot("aloud"));
  await select(page, "hand", 600);
  await expect(status).toHaveText("Aloud card open");
  await context.close();
});


// ------------------------------------------------- passthrough: the case on a real wall

/*
 * IWER's Synthetic Environment Module (MIT, the office room it ships) gives the emulated
 * Quest 3 a room with walls, so hit tests, plane detection and anchors run as on a headset.
 * The room loads from the local package file, never its CDN. The headset stands in the
 * middle, 1.6 m up, turned to face the wall at z = +1.39.
 */
const SEM = readFileSync(join(process.cwd(), "node_modules/@iwer/sem/build/iwer-sem.min.js"), "utf8");
const ROOM = readFileSync(join(process.cwd(), "node_modules/@iwer/sem/captures/office_small.json"), "utf8");
const WALL_Z = 1.387;
const TURNED = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI);
const installRoom = (head: THREE.Quaternion) => `${IWER}
;${SEM}
;(() => {
  const device = new IWER.XRDevice(IWER.metaQuest3);
  device.installRuntime({ forceInstall: true });
  device.installSEM(IWER_SEM.SyntheticEnvironmentModule);
  device.sem.loadEnvironment(${ROOM});
  device.position.set(0, ${EYE}, 0);
  device.quaternion.set(${head.x}, ${head.y}, ${head.z}, ${head.w});
  window.__xrDevice = device;
  window.__anchors = [];
  const create = IWER.XRFrame.prototype.createAnchor;
  IWER.XRFrame.prototype.createAnchor = function (...args) {
    const made = create.apply(this, args);
    made.then((a) => window.__anchors.push(a), () => {});
    return made;
  };
})();`;

/** The hung case's centre: at eye height where the gaze meets the wall, its back on the wall. */
const wallCentre = new THREE.Vector3(0, EYE, WALL_Z - layout.depth / 2);
/** A point in the hung case's own space, in the world (it faces -z, so x and z turn round). */
const onWall = (x: number, y: number, z = layout.depth / 2) => wallCentre.clone().add(new THREE.Vector3(-x, y, -z));
const wallSlot = (slug: string): Target => {
  const plane = pickPlanes(layout).find((p) => p.slug === slug)!;
  return { at: onWall(plane.x, plane.y), name: slug };
};
const WALL_CLOSE: Target = { at: onWall(CLOSE.x, CLOSE.y, layout.depth / 2 + CARD_IN_FRONT), name: "close" };
const WALL_EXIT: Target = { at: onWall(0, EXIT_Y), name: "exit" };
/** The right hand of a reader turned to face +z. */
const RIGHT_TURNED = new THREE.Vector3(-0.15, 1.35, 0.25);
/** Up and behind the reader: on nothing the session draws. */
const AWAY = new THREE.Vector3(0, 1, -0.3).normalize();

/** Points the right controller along `dir` from `from`, without waiting for it to land anywhere. */
async function point(page: Page, from: THREE.Vector3, dir: THREE.Vector3) {
  const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, -1), dir.clone().normalize());
  await page.evaluate(
    ({ p, q }) => {
      const device = (window as unknown as { __xrDevice: any }).__xrDevice; // eslint-disable-line @typescript-eslint/no-explicit-any
      device.controllers.right.position.set(p[0], p[1], p[2]);
      device.controllers.right.quaternion.set(q[0], q[1], q[2], q[3]);
    },
    { p: from.toArray(), q: q.toArray() },
  );
  await frames(page, 3);
}
const anchors = (page: Page) => page.evaluate(() => (window as unknown as { __anchors: unknown[] }).__anchors.length);

test("in an emulated Quest 3 in an office: look at a wall, hang the case there, pull a card, exit", async ({ browser }) => {
  const { context, page, inputsReady } = await questPage(browser, "controller", installRoom(TURNED));
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/case");
  const place = page.getByRole("button", { name: "Place on your wall" });
  await expect(place).toBeVisible();
  await expect(page.getByRole("button", { name: "Enter VR" })).toBeVisible();
  await place.click();
  const status = page.getByRole("status");
  await expect(status).toHaveText("Entering passthrough");
  await inputsReady();

  // A select with the controller pointing away from the hint hangs the case where the reader
  // looks. Until the first hit test lands, a select does nothing, so try a few times.
  await point(page, RIGHT_TURNED, AWAY);
  await expect(async () => {
    if ((await status.textContent()) === "On your wall") return;
    await select(page, "controller");
    await expect(status).toHaveText("On your wall", { timeout: 1500 });
  }).toPass({ timeout: 20_000 });
  await expect.poll(() => anchors(page), { message: "the case is held by an anchor" }).toBe(1);

  // The slots are where the maths puts them: on the wall the headset faces, facing back.
  await selectUntil(page, "controller", wallSlot("instanter"), "Instanter card open", RIGHT_TURNED);
  await cardOut(page);
  await selectUntil(page, "controller", WALL_CLOSE, "On your wall", RIGHT_TURNED);

  // The reader walks half a meter to the side and closer: the case stays on the wall.
  const step = new THREE.Vector3(0.5, 0, 0.4);
  await page.evaluate(([x, z]) => {
    const device = (window as unknown as { __xrDevice: { position: { set(x: number, y: number, z: number): void } } })
      .__xrDevice;
    device.position.set(x, 1.6, z);
  }, [step.x, step.z]);
  const moved = RIGHT_TURNED.clone().add(step);
  await selectUntil(page, "controller", wallSlot("aloud"), "Aloud card open", moved);
  await cardOut(page);
  await selectUntil(page, "controller", WALL_CLOSE, "On your wall", moved);
  await selectUntil(page, "controller", WALL_EXIT, "Left passthrough", moved);
  await expect(place).toBeFocused();
  expect(errors).toEqual([]);
  await context.close();
});

test("in an emulated Quest 3 looking at the floor: no wall, so nothing is placed, and the hint's Exit works", async ({
  browser,
}) => {
  const down = TURNED.clone().multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), -1.3));
  const { context, page, inputsReady } = await questPage(browser, "controller", installRoom(down));
  await page.goto("/case");
  await page.getByRole("button", { name: "Place on your wall" }).click();
  const status = page.getByRole("status");
  await inputsReady();

  await point(page, RIGHT_TURNED, AWAY);
  for (let i = 0; i < 3; i++) await select(page, "controller");
  await expect(status).toHaveText("Entering passthrough");
  expect(await anchors(page)).toBe(0);

  // The hint (and its Exit) stay in front of the eyes, wherever the reader looks.
  const eye = new THREE.Vector3(0, EYE, 0);
  const hint = new THREE.Vector3(0, -HINT_BELOW, -HINT_AHEAD).applyQuaternion(down).add(eye);
  const exit = new THREE.Vector3(0, HINT_EXIT.y, 0).applyQuaternion(down).add(hint);
  await selectUntil(page, "controller", { at: exit, name: "exit" }, "Left passthrough", RIGHT_TURNED);
  await context.close();
});


test("in an emulated Quest 3: after VR, the unplaced case in passthrough takes no selects", async ({ browser }) => {
  // Looking at the floor: no wall, so the case stays unplaced, still where VR left it.
  const down = TURNED.clone().multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), -1.3));
  const { context, page, inputsReady } = await questPage(browser, "controller", installRoom(down));
  await page.goto("/case");
  await page.getByRole("button", { name: "Enter VR" }).click();
  const status = page.getByRole("status");
  await expect(status).toHaveText("In VR", { timeout: 15_000 });
  await inputsReady();
  // In VR the case stood 1 m ahead (along the head's yaw, +z here), facing back.
  const vrCentre = new THREE.Vector3(0, EYE - BELOW_EYE, CASE_DISTANCE);
  const inVr = (x: number, y: number) => vrCentre.clone().add(new THREE.Vector3(-x, y, -layout.depth / 2));
  await selectUntil(page, "controller", { at: inVr(0, EXIT_Y), name: "exit" }, "Left VR", RIGHT_TURNED);

  await page.getByRole("button", { name: "Place on your wall" }).click();
  await expect(status).toHaveText("Entering passthrough");
  await frames(page, 10);
  const plane = pickPlanes(layout).find((p) => p.slug === "instanter")!;
  await point(page, RIGHT_TURNED, inVr(plane.x, plane.y).sub(RIGHT_TURNED));
  await frames(page, 5);
  await expect(page.locator(".xr-session")).not.toHaveAttribute("data-pointing", "instanter");
  await select(page, "controller");
  await expect(status).toHaveText("Entering passthrough");
  expect((await videos(page)).filter((v) => v.playing)).toEqual([]);
  await context.close();
});
