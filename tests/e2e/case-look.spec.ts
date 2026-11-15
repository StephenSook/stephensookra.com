import { expect, test, type Browser, type Page } from "@playwright/test";
import * as THREE from "three";
import spec from "../../src/scene/case-spec.json";
import { buildLayout, type Box } from "../../src/scene/layout";
import { fitCamera, projectToNdc } from "../../src/scene/pick";
import { PHONE } from "./helpers";

/*
 * The case is one dark piece of furniture on whatever page it sits on. These tests read
 * real pixels from the stage (the live 3D scene on a laptop, the Blender poster on a phone)
 * in both colour schemes:
 *   - unlit slot interiors are near black and darker than the wood,
 *   - the wood is dark and warm, and the same in both schemes,
 *   - a project poster keeps its own darks (it is not washed toward the page).
 */

type RGB = [number, number, number];
type Point = { fx: number; fy: number };

const layout = buildLayout(spec);
const camera = fitCamera(layout, 16 / 9);

const linear = (c: number) => {
  const s = c / 255;
  return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
};
const luminance = ([r, g, b]: RGB) => 0.2126 * linear(r) + 0.7152 * linear(g) + 0.0722 * linear(b);

/** Where a point on a box's front face lands on the 16:9 stage, as fractions of the stage. */
function front(box: Box, u = 0.5, v = 0.5): Point {
  const p = new THREE.Vector3(box.x + (u - 0.5) * box.w, box.y + (v - 0.5) * box.h, box.z + box.d / 2);
  const ndc = projectToNdc(p, camera);
  return { fx: (ndc.x + 1) / 2, fy: (1 - ndc.y) / 2 };
}

// The left side of the frame, halfway up.
const FRAME = front(layout.frame[2]);
// The small cell nearest the centre of the top row.
const topY = Math.max(...layout.smallBacks.map((b) => b.y));
const SMALL = front(
  layout.smallBacks.filter((b) => b.y === topY).sort((a, b) => Math.abs(a.x) - Math.abs(b.x))[0],
);
// A 5 x 5 grid over the Instanter poster, whose background is black.
const b2 = layout.projectSlots.find((s) => s.slug === "instanter")!.back;
const POSTER: Point[] = [];
for (let i = 1; i <= 5; i++) for (let j = 1; j <= 5; j++) POSTER.push(front(b2, i / 6, j / 6));

/** Reads pixels from a screenshot of the stage (decoded in the page, so no image library). */
async function sample(page: Page, points: Point[]): Promise<RGB[]> {
  const box = (await page.locator(".case-stage").boundingBox())!;
  const png = (await page.screenshot({ clip: box })).toString("base64");
  return page.evaluate(
    async ({ png, points }) => {
      const bytes = Uint8Array.from(atob(png), (c) => c.charCodeAt(0));
      const bitmap = await createImageBitmap(new Blob([bytes], { type: "image/png" }));
      const canvas = document.createElement("canvas");
      canvas.width = bitmap.width;
      canvas.height = bitmap.height;
      const ctx = canvas.getContext("2d")!;
      ctx.drawImage(bitmap, 0, 0);
      return points.map((p) => {
        const x = Math.min(bitmap.width - 1, Math.round(p.fx * bitmap.width));
        const y = Math.min(bitmap.height - 1, Math.round(p.fy * bitmap.height));
        return Array.from(ctx.getImageData(x, y, 1, 1).data.slice(0, 3)) as [number, number, number];
      });
    },
    { png, points },
  );
}

type Reading = { frame: RGB; small: RGB; posterDarkest: number };

async function read(page: Page): Promise<Reading> {
  const [frame, small, ...poster] = await sample(page, [FRAME, SMALL, ...POSTER]);
  return { frame, small, posterDarkest: Math.min(...poster.map(luminance)) };
}

function expectDarkCase(r: Reading, label: string) {
  const [red, green, blue] = r.frame;
  expect(luminance(r.small), `${label}: unlit interior is near black`).toBeLessThan(0.03);
  expect(luminance(r.small), `${label}: interior is darker than the wood`).toBeLessThan(luminance(r.frame));
  expect(luminance(r.frame), `${label}: the wood is dark`).toBeLessThan(0.1);
  expect(red > green && green > blue, `${label}: the wood is warm (r > g > b), got ${r.frame}`).toBe(true);
  expect(r.posterDarkest, `${label}: the poster keeps its own darks`).toBeLessThan(0.05);
}

/** Frame colours agree within `tolerance` per 8-bit channel. */
function expectSameWood(a: Reading, b: Reading, label: string, tolerance = 10) {
  for (let i = 0; i < 3; i++)
    expect(Math.abs(a.frame[i] - b.frame[i]), `${label}: ${a.frame} vs ${b.frame}`).toBeLessThanOrEqual(tolerance);
}

async function scene(browser: Browser, colorScheme: "light" | "dark") {
  const context = await browser.newContext({ viewport: { width: 1280, height: 1800 }, colorScheme });
  const page = await context.newPage();
  await page.goto("/");
  await page.waitForSelector(".case-stage[data-scene=ready]", { timeout: 30_000 });
  await page.waitForTimeout(1200); // the poster's fade-out ends 600 ms after ready
  const reading = await read(page);
  await context.close();
  return reading;
}

async function poster(browser: Browser, colorScheme: "light" | "dark") {
  const context = await browser.newContext({ ...PHONE, colorScheme });
  const page = await context.newPage();
  await page.goto("/");
  await page.locator(".case-poster img").evaluate((img: HTMLImageElement) => img.decode());
  const reading = await read(page);
  await context.close();
  return reading;
}

test("the live case is dark furniture in both schemes, with posters at full strength", async ({ browser }) => {
  const light = await scene(browser, "light");
  const dark = await scene(browser, "dark");
  expectDarkCase(light, "scene, light");
  expectDarkCase(dark, "scene, dark");
  expectSameWood(light, dark, "scene, light vs dark");
});

test("the poster case is dark furniture in both schemes, with posters at full strength", async ({ browser }) => {
  const light = await poster(browser, "light");
  const dark = await poster(browser, "dark");
  expectDarkCase(light, "poster, light");
  expectDarkCase(dark, "poster, dark");
  expectSameWood(light, dark, "poster, light vs dark");
});

test("the live case shows the same wood as its poster, so the crossfade has no step", async ({ browser }) => {
  expectSameWood(await scene(browser, "light"), await poster(browser, "light"), "scene vs poster", 5);
});
