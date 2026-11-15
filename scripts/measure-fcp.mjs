// Measures First Contentful Paint on a throttled phone profile, five cold runs per URL,
// and writes src/content/measurements/fcp.json (merging by site label).
//
// Usage: node scripts/measure-fcp.mjs "old site=https://stephensookra.com/" "new preview=https://..."
//
// Profile: 390x844 at DPR 3, Chrome DevTools "Slow 4G" network preset, 4x CPU slowdown,
// a new browser per run so nothing is cached. Anyone can recheck the number in Chrome
// DevTools with the same settings.
import { readFileSync, renameSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { chromium } from "@playwright/test";

const RUNS = 5;
const OUT = join(process.cwd(), "src/content/measurements/fcp.json");

// Chrome DevTools "Slow 4G" preset (front_end/core/sdk/NetworkManager.ts, Slow4GConditions):
// download 1.6 Mbps * 0.9, upload 750 kbps * 0.9, latency 150 ms * 3.75.
const NETWORK = {
  name: "Slow 4G",
  latencyMs: 150 * 3.75,
  downloadBytesPerSecond: (1.6 * 1000 * 1000) / 8 * 0.9,
  uploadBytesPerSecond: (750 * 1000) / 8 * 0.9,
  source: "https://github.com/ChromeDevTools/devtools-frontend/blob/main/front_end/core/sdk/NetworkManager.ts",
};
const CPU_SLOWDOWN = 4;
const VIEWPORT = { width: 390, height: 844 };
const DPR = 3;

const pairs = process.argv.slice(2).map((arg) => {
  const eq = arg.indexOf("=");
  if (eq < 1) throw new Error(`expected label=url, got ${arg}`);
  return { label: arg.slice(0, eq), url: new URL(arg.slice(eq + 1)).toString() };
});
if (pairs.length === 0) {
  console.error('usage: node scripts/measure-fcp.mjs "label=https://..." [...]');
  process.exit(2);
}

function median(values) {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

async function measureOnce(url) {
  const browser = await chromium.launch();
  try {
    const context = await browser.newContext({
      viewport: VIEWPORT,
      deviceScaleFactor: DPR,
      isMobile: true,
      hasTouch: true,
    });
    const page = await context.newPage();
    const cdp = await context.newCDPSession(page);
    await cdp.send("Network.enable");
    await cdp.send("Network.setCacheDisabled", { cacheDisabled: true });
    await cdp.send("Network.emulateNetworkConditions", {
      offline: false,
      latency: NETWORK.latencyMs,
      downloadThroughput: NETWORK.downloadBytesPerSecond,
      uploadThroughput: NETWORK.uploadBytesPerSecond,
    });
    await cdp.send("Emulation.setCPUThrottlingRate", { rate: CPU_SLOWDOWN });
    const response = await page.goto(url, { waitUntil: "load", timeout: 120_000 });
    if (!response || response.status() >= 400) throw new Error(`${url} answered ${response?.status()}`);
    const fcp = await page.evaluate(
      () =>
        new Promise((resolve) => {
          const done = (entries) => {
            const hit = entries.find((e) => e.name === "first-contentful-paint");
            if (hit) resolve(hit.startTime);
          };
          done(performance.getEntriesByType("paint"));
          new PerformanceObserver((list) => done(list.getEntries())).observe({ type: "paint", buffered: true });
          setTimeout(() => resolve(null), 30_000);
        }),
    );
    if (typeof fcp !== "number") throw new Error(`${url}: no first-contentful-paint entry`);
    return { fcp: Math.round(fcp), browser: `Chromium ${browser.version()}` };
  } finally {
    await browser.close();
  }
}

let existing = { sites: [] };
try {
  existing = JSON.parse(readFileSync(OUT, "utf8"));
} catch {
  // first run: no file yet
}

let browserVersion = existing.browser;
const sites = [...existing.sites];
for (const { label, url } of pairs) {
  const runsMs = [];
  for (let i = 0; i < RUNS; i++) {
    const { fcp, browser } = await measureOnce(url);
    browserVersion = browser;
    runsMs.push(fcp);
    console.log(`${label} run ${i + 1}: ${fcp} ms`);
  }
  const entry = { label, url, measuredAt: new Date().toISOString(), runsMs, medianMs: median(runsMs) };
  console.log(`${label} median ${entry.medianMs} ms`);
  const at = sites.findIndex((s) => s.label === label);
  if (at >= 0) sites[at] = entry;
  else sites.push(entry);
}

const pkg = JSON.parse(readFileSync(join(process.cwd(), "node_modules/@playwright/test/package.json"), "utf8"));
const result = {
  metric: "first-contentful-paint",
  tool: `Playwright ${pkg.version}, CDP throttling`,
  browser: browserVersion,
  profile: {
    viewport: VIEWPORT,
    deviceScaleFactor: DPR,
    network: NETWORK,
    cpuSlowdown: CPU_SLOWDOWN,
    cache: "cold, new browser per run",
  },
  sites,
};
writeFileSync(`${OUT}.tmp`, `${JSON.stringify(result, null, 2)}\n`);
renameSync(`${OUT}.tmp`, OUT);
console.log(`wrote ${OUT}`);
