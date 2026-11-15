// Makes a project's poster and headset loop from a recorded capture, a screen recording kept
// outside this repo: npm run media:capture -- <slug> <capture.mp4>
//
// Reads scripts/media/<slug>.json and checks the file's SHA-256 against it, then:
// 1. takes the frame at capture.still.at, cropped to capture.still.crop, and renders
//    house-poster.html (title, line, role, the still inset with the caption) at 2x in
//    Playwright's Chromium, scaled to public/posters/<slug>.webp at 720 by 405;
// 2. cuts capture.loop (start, length) from the full frame to a silent 720 px H.264 loop with
//    the same caption burned in, public/loops/<slug>.mp4 (1.5 MB at most).
// Fail-closed: files are written to a temporary folder and moved into public/ only after
// every step succeeded. Needs ffmpeg.
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdtempSync, readFileSync, renameSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { chromium } from "@playwright/test";
import sharp from "sharp";

const [slug, source] = process.argv.slice(2);
if (!slug || !source) {
  console.error("usage: npm run media:capture -- <slug> <capture.mp4>");
  process.exit(2);
}
const ROOT = process.cwd();
const MAX_LOOP_BYTES = 1572864; // 1.5 MB, the same cap as the film loops
const record = JSON.parse(readFileSync(join(ROOT, "scripts/media", `${slug}.json`), "utf8"));
const { capture } = record;
if (!capture) throw new Error(`scripts/media/${slug}.json has no capture`);

const sha = createHash("sha256").update(readFileSync(source)).digest("hex");
if (sha !== capture.sha256) throw new Error(`${source} is not the recorded capture (sha256 ${sha})`);

const work = mkdtempSync(join(tmpdir(), `capture-${slug}-`));
const ffmpeg = (args) => execFileSync("ffmpeg", ["-v", "error", "-y", ...args]);
const template = pathToFileURL(join(ROOT, "scripts/media/house-poster.html")).href;
const url = (params) => {
  const u = new URL(template);
  for (const [k, v] of Object.entries(params)) u.searchParams.set(k, v);
  return u.href;
};

async function load(page, href) {
  const failed = [];
  page.on("requestfailed", (r) => failed.push(r.url()));
  await page.goto(href);
  await page.evaluate(async () => {
    await document.fonts.ready;
    const img = document.querySelector(".shot:not([hidden]) img");
    if (img) await img.decode();
  });
  const fonts = await page.evaluate(() => [...document.fonts].filter((f) => f.status === "loaded").length);
  if (fonts < 1 || failed.length) throw new Error(`poster template did not load (fonts ${fonts}, failed ${failed.join(", ")})`);
}

try {
  // 1. The still, cropped, inset in the house frame.
  const { at, crop } = capture.still;
  const stillPng = join(work, "still.png");
  ffmpeg(["-i", resolve(source), "-ss", String(at), "-frames:v", "1", "-vf", `crop=${crop.width}:${crop.height}:${crop.x}:${crop.y}`, stillPng]);

  const browser = await chromium.launch();
  try {
    const poster = await browser.newPage({ viewport: { width: 720, height: 405 }, deviceScaleFactor: 2 });
    const { title, line, role, caption } = record;
    await load(poster, url({ title, line, role, caption, still: pathToFileURL(stillPng).href }));
    await sharp(await poster.screenshot({ type: "png" }))
      .resize(720, 405)
      .webp({ quality: 88 })
      .toFile(join(work, "poster.webp"));

    // 2. The caption alone, at the loop's own scale, for the overlay.
    const label = await browser.newPage({ viewport: { width: 720, height: 405 }, deviceScaleFactor: 1 });
    await load(label, url({ caption, mode: "caption" }));
    await label.locator(".caption").screenshot({ path: join(work, "caption.png"), omitBackground: true });
  } finally {
    await browser.close();
  }

  // 3. The loop: the full frame, so the score and level show, with the caption bottom right.
  const { start, length } = capture.loop;
  ffmpeg([
    "-ss", String(start), "-i", resolve(source), "-i", join(work, "caption.png"),
    "-t", String(length), "-an",
    "-filter_complex", "[0:v]scale=720:-2,setsar=1,fps=30[v];[v][1:v]overlay=W-w-14:H-h-14",
    "-c:v", "libx264", "-profile:v", "main", "-pix_fmt", "yuv420p", "-crf", "28", "-preset", "slow", "-movflags", "+faststart",
    join(work, "loop.mp4"),
  ]);
  const bytes = statSync(join(work, "loop.mp4")).size;
  if (bytes > MAX_LOOP_BYTES) throw new Error(`${slug} loop is ${bytes} bytes, over ${MAX_LOOP_BYTES}`);

  renameSync(join(work, "poster.webp"), join(ROOT, "public/posters", `${slug}.webp`));
  renameSync(join(work, "loop.mp4"), join(ROOT, "public/loops", `${slug}.mp4`));
  console.log(`${slug}: poster from ${at} s, loop from ${start} s for ${length} s (${bytes} bytes)`);
} finally {
  rmSync(work, { recursive: true, force: true });
}
