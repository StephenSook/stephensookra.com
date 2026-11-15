import { z } from "zod";
import fcpJson from "./fcp.json";

/**
 * The one number on /proof: First Contentful Paint on a throttled phone, five
 * cold runs per site. Written by scripts/measure-fcp.mjs, never by hand.
 */
export const fcpSchema = z.object({
  metric: z.literal("first-contentful-paint"),
  tool: z.string().min(3),
  browser: z.string().min(3),
  profile: z.object({
    viewport: z.object({ width: z.number(), height: z.number() }),
    deviceScaleFactor: z.number(),
    network: z.object({
      name: z.string(),
      latencyMs: z.number(),
      downloadBytesPerSecond: z.number(),
      uploadBytesPerSecond: z.number(),
      source: z.url(),
    }),
    cpuSlowdown: z.number(),
    cache: z.literal("cold, new browser per run"),
  }),
  sites: z.array(
    z.object({
      label: z.string(),
      url: z.url(),
      measuredAt: z.iso.datetime(),
      runsMs: z.array(z.number().positive()),
      medianMs: z.number().positive(),
    }),
  ),
});

export type FcpMeasurement = z.infer<typeof fcpSchema>;

export const fcpMeasurement: FcpMeasurement = fcpSchema.parse(fcpJson);

export function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}
