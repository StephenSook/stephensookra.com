const msFormat = new Intl.NumberFormat("en-US", { maximumFractionDigits: 1 });

/** "2.33 s" from 2328 ms. */
export function formatSeconds(ms: number): string {
  return `${(ms / 1000).toFixed(2)} s`;
}

/** "2,328 ms". */
export function formatMs(ms: number): string {
  return `${msFormat.format(ms)} ms`;
}
