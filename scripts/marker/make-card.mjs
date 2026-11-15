// Makes the printable marker card and its image target, and publishes them as one generation:
// public/marker/<UTC time>-<card hash>/{card.png, card.pdf, card-luminance.png} plus
// public/marker/manifest.json, swapped in only after every file was written.
//
// 1. Trims the current light case poster to the case, then renders scripts/marker/card.html to
//    a landscape 1600 x 1200 PNG and to a Letter PDF with the same card at 20 x 15 cm, in
//    Playwright's Chromium.
// 2. Runs the PNG through 8th Wall's image-target-cli (flat, default crop) for the grayscale
//    luminance image and the target's crop data, which the engine needs. A landscape card is
//    stored rotated (isRotated), so its crop reads 1200 x 1600.
// 3. Writes two short camera videos for the e2e tracking test: the card, and no card.
//
// Run: npm run marker:card   (needs ffmpeg for step 3)
import { execFileSync, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdirSync, mkdtempSync, readFileSync, readdirSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { chromium } from "@playwright/test";
import sharp from "sharp";

const ROOT = process.cwd();
const DEST = join(ROOT, "public/marker");
const FIXTURES = join(ROOT, "tests/fixtures/marker");
const CLI = join(ROOT, "node_modules/@8thwall/image-target-cli/src/index.js");
const CLI_VERSION = JSON.parse(readFileSync(join(ROOT, "node_modules/@8thwall/image-target-cli/package.json"), "utf8")).version;
const WIDTH = 1600;
const HEIGHT = 1200;

const caseManifest = JSON.parse(readFileSync(join(ROOT, "public/case/manifest.json"), "utf8"));
const template = pathToFileURL(join(ROOT, "scripts/marker/card.html")).href;
const work = mkdtempSync(join(tmpdir(), "marker-card-"));
// The poster has the page colour around the case; the card wants the case alone.
await sharp(join(ROOT, "public", caseManifest.light)).trim({ threshold: 12 }).png().toFile(join(work, "case.png"));
const poster = pathToFileURL(join(work, "case.png")).href;

/** Where the case picture sits on the card, as fractions of the card (top-left origin). */
let caseBox;

async function render() {
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({ viewport: { width: WIDTH / 2, height: HEIGHT / 2 }, deviceScaleFactor: 2 });
    const failed = [];
    page.on("requestfailed", (r) => failed.push(r.url()));
    for (const mode of ["png", "pdf"]) {
      await page.goto(`${template}?mode=${mode}&poster=${encodeURIComponent(poster)}`);
      await page.evaluate(async () => {
        await document.fonts.ready;
        await document.querySelector(".case").decode();
      });
      const fonts = await page.evaluate(() => [...document.fonts].filter((f) => f.status === "loaded").length);
      if (fonts < 2 || failed.length) throw new Error(`card template did not load (fonts ${fonts}, failed ${failed.join(", ")})`);
      if (mode === "png") {
        await page.locator(".card").screenshot({ path: join(work, "card.png") });
        caseBox = await page.evaluate(() => {
          const card = document.querySelector(".card").getBoundingClientRect();
          const img = document.querySelector(".case");
          const r = img.getBoundingClientRect();
          // object-fit: contain, so the picture is the largest box of its own aspect that fits.
          const aspect = img.naturalWidth / img.naturalHeight;
          const w = Math.min(r.width, r.height * aspect);
          const h = w / aspect;
          const round = (v) => Math.round(v * 1e4) / 1e4;
          return {
            x: round((r.left + (r.width - w) / 2 - card.left) / card.width),
            y: round((r.top + (r.height - h) / 2 - card.top) / card.height),
            width: round(w / card.width),
            height: round(h / card.height),
          };
        });
      }
      else await page.pdf({ path: join(work, "card.pdf"), format: "Letter", printBackground: true, preferCSSPageSize: true });
    }
  } finally {
    await browser.close();
  }
}

/** Answers the CLI's prompts: image path, image type (flat), default crop (yes), folder, name. */
function makeTarget() {
  const answers = [join(work, "card.png"), "", "", join(work, "target"), "card", ""].join("\n");
  const run = spawnSync(process.execPath, [CLI], { input: answers, encoding: "utf8" });
  if (run.status !== 0) throw new Error(`image-target-cli failed:\n${run.stdout}\n${run.stderr}`);
  const data = JSON.parse(readFileSync(join(work, "target/card.json"), "utf8"));
  const p = data.properties;
  const whole = p.left === 0 && p.top === 0 && p.width === HEIGHT && p.height === WIDTH;
  if (data.type !== "PLANAR" || !p.isRotated || !whole) {
    throw new Error(`unexpected target crop: ${JSON.stringify(data)}`);
  }
  return data;
}

function fixtures(cardPng) {
  mkdirSync(FIXTURES, { recursive: true });
  const ffmpeg = (args) => execFileSync("ffmpeg", ["-v", "error", "-y", ...args]);
  // The card held in front of a grey wall, drifting a little, as a 2 s loop.
  ffmpeg([
    "-f", "lavfi", "-i", "color=c=0x6b6b6b:s=640x480:d=2:r=30",
    "-loop", "1", "-i", cardPng,
    "-filter_complex",
    "[1:v]scale=-1:380,format=rgba[card];[0:v][card]overlay=x='(W-w)/2+20*sin(2*PI*t/2)':y='(H-h)/2+8*cos(2*PI*t/2)':shortest=1,format=yuvj420p",
    "-t", "2", "-q:v", "6", "-f", "mjpeg", join(FIXTURES, "card.mjpeg"),
  ]);
  // A moving test pattern with no card in it.
  ffmpeg(["-f", "lavfi", "-i", "testsrc2=s=640x480:d=2:r=30", "-q:v", "6", "-pix_fmt", "yuvj420p", "-f", "mjpeg", join(FIXTURES, "none.mjpeg")]);
}

await render();
const target = makeTarget();
const png = readFileSync(join(work, "card.png"));
const sha = createHash("sha256").update(png).digest("hex");
const gen = `${new Date().toISOString().replace(/[-:T]/g, "").slice(0, 14)}-${sha.slice(0, 12)}`;

mkdirSync(join(DEST, gen), { recursive: true });
renameSync(join(work, "card.png"), join(DEST, gen, "card.png"));
renameSync(join(work, "card.pdf"), join(DEST, gen, "card.pdf"));
renameSync(join(work, "target", target.resources.luminanceImage), join(DEST, gen, "card-luminance.png"));
const manifest = {
  cardSha256: sha,
  tool: `@8thwall/image-target-cli ${CLI_VERSION}`,
  card: `/marker/${gen}/card.png`,
  pdf: `/marker/${gen}/card.pdf`,
  width: WIDTH,
  height: HEIGHT,
  caseBox,
  target: { name: "card", type: target.type, imagePath: `/marker/${gen}/card-luminance.png`, properties: target.properties },
};
writeFileSync(join(DEST, ".manifest.json.tmp"), `${JSON.stringify(manifest, null, 2)}\n`);
renameSync(join(DEST, ".manifest.json.tmp"), join(DEST, "manifest.json"));
for (const old of readdirSync(DEST)) {
  if (old !== gen && old !== "manifest.json") rmSync(join(DEST, old), { recursive: true, force: true });
}
fixtures(resolve(DEST, gen, "card.png"));
rmSync(work, { recursive: true, force: true });
console.log(`published marker card generation ${gen}`);
