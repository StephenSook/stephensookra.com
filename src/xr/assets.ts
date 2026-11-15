/**
 * Controller and hand models are served from this site (public/xr/profiles, copied from
 * @webxr-input-profiles/assets, MIT), so the headset makes no third-party requests. The
 * loaders resolve files with new URL(file, base), so the base must be absolute.
 */
export function xrAssetBase(origin: string): string {
  return new URL("/xr/profiles/", origin).href;
}
