// Renders a text-only project poster: node scripts/posters/make-text-poster.mjs <slug>
// Reads scripts/posters/<slug>.json (title, line, role; a unit test keeps them in step with
// src/content/projects.ts), renders scripts/posters/text-poster.html at 2x in Playwright's
// Chromium, and writes public/posters/<slug>.webp at 720 by 405 like the film posters.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { chromium } from "@playwright/test";
import sharp from "sharp";

const slug = process.argv[2];
if (!slug) {
  console.error("usage: node scripts/posters/make-text-poster.mjs <slug>");
  process.exit(2);
}
const ROOT = process.cwd();
const text = JSON.parse(readFileSync(join(ROOT, "scripts/posters", `${slug}.json`), "utf8"));
const url = new URL(pathToFileURL(join(ROOT, "scripts/posters/text-poster.html")).href);
for (const key of ["title", "line", "role"]) url.searchParams.set(key, text[key]);

const browser = await chromium.launch();
try {
  const page = await browser.newPage({ viewport: { width: 720, height: 405 }, deviceScaleFactor: 2 });
  const failed = [];
  page.on("requestfailed", (r) => failed.push(r.url()));
  await page.goto(url.href);
  await page.evaluate(() => document.fonts.ready);
  const fonts = await page.evaluate(() => [...document.fonts].filter((f) => f.status === "loaded").length);
  if (fonts < 2 || failed.length) throw new Error(`poster template did not load (fonts ${fonts}, failed ${failed.join(", ")})`);
  const png = await page.screenshot({ type: "png" });
  const out = join(ROOT, "public/posters", `${slug}.webp`);
  await sharp(png).resize(720, 405).webp({ quality: 88 }).toFile(out);
  console.log(`wrote ${out}`);
} finally {
  await browser.close();
}
