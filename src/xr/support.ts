import { SITE_URL } from "@/lib/site";

/** How long to wait for the browser's answer before treating VR as unsupported. */
export const SUPPORT_TIMEOUT_MS = 1500;

/**
 * Whether this browser can start an immersive session of `mode` (VR, or passthrough AR).
 * Any failure (no WebXR, a thrown or rejected check, or no answer in time) counts as no,
 * so the door never offers a mode the device cannot enter. This loads nothing: it only
 * asks the browser.
 */
export async function xrSupported(
  xr: XRSystem | undefined,
  timeoutMs = SUPPORT_TIMEOUT_MS,
  mode: XRSessionMode = "immersive-vr",
): Promise<boolean> {
  if (!xr || typeof xr.isSessionSupported !== "function") return false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const answer = xr.isSessionSupported(mode);
    const timeout = new Promise<boolean>((resolve) => {
      timer = setTimeout(() => resolve(false), timeoutMs);
    });
    return (await Promise.race([answer, timeout])) === true;
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * The case page to send to a headset: this deployment's own page when it is served over
 * https (so a preview sends the preview), else the public site (a local http build).
 */
export function headsetPageUrl(origin: string): string {
  const base = origin.startsWith("https://") ? origin : SITE_URL;
  return new URL("/case", base).href;
}

/** Meta's Web Launch link: opens the page in the reader's Meta Quest browser. */
export function webLaunchUrl(pageUrl: string): string {
  const url = new URL(pageUrl);
  if (url.protocol !== "https:") throw new Error(`Web Launch needs an https page, got ${url.protocol}`);
  return `https://www.oculus.com/open_url/?url=${encodeURIComponent(url.href)}`;
}
