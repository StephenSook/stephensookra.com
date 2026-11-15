import type { APIRequestContext } from "@playwright/test";

/** Paths from the built sitemap, so the e2e suite walks exactly what search engines are told about. */
export async function sitemapPaths(request: APIRequestContext): Promise<string[]> {
  const xml = await (await request.get("/sitemap.xml")).text();
  const paths = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => new URL(m[1]).pathname);
  if (paths.length < 10) throw new Error(`sitemap lists only ${paths.length} paths; expected the full site`);
  return paths;
}

export const PHONE = {
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 3,
  isMobile: true,
  hasTouch: true,
};

/** Blocks WebGL and WebGPU before any page script runs. */
export const NO_WEBGL_SCRIPT = `
(() => {
  try { Object.defineProperty(Navigator.prototype, "gpu", { get: () => undefined, configurable: true }); } catch {}
  const orig = HTMLCanvasElement.prototype.getContext;
  HTMLCanvasElement.prototype.getContext = function (type, ...rest) {
    if (/^(webgl|webgl2|experimental-webgl|webgpu)$/.test(String(type))) return null;
    return orig.call(this, type, ...rest);
  };
})();
`;
