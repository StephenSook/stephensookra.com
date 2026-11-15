import { z } from "zod";
import xrTestsJson from "./xr-tests.json";

/**
 * Which headsets the Enter VR mode has actually been run on. Edited only when a run
 * happens, with its date and evidence; the site's wording comes from this file, so it
 * can never claim a test that did not happen.
 */
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "expected yyyy-mm-dd");

const platformSchema = z.discriminatedUnion("status", [
  z.object({ name: z.string().min(3), status: z.literal("not run") }).strict(),
  z
    .object({
      name: z.string().min(3),
      status: z.enum(["passed", "failed"]),
      date: isoDate,
      evidence: z.string().min(10),
    })
    .strict(),
]);

export const xrTestsSchema = z
  .object({ quest3s: platformSchema, androidXrEmulator: platformSchema, visionPro: platformSchema })
  .strict();

export type XrTests = z.infer<typeof xrTestsSchema>;
type Platform = keyof XrTests;

export const xrTests: XrTests = xrTestsSchema.parse(xrTestsJson);

function list(names: string[]): string {
  return names.length < 2 ? names.join("") : `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
}

/**
 * The one line next to the Enter VR door. Android XR is named only once its emulator run
 * passes; Meta Quest is "tested" only after a real headset run passes; Vision Pro stays
 * "built for" until someone runs it.
 */
export function doorNote(tests: XrTests): string {
  const phrase = (key: Platform) => (key === "androidXrEmulator" ? `the ${tests[key].name}` : tests[key].name);
  const order: Platform[] = ["quest3s", "androidXrEmulator", "visionPro"];
  const tested = order.filter((k) => tests[k].status === "passed").map(phrase);
  const builtFor = (["quest3s", "visionPro"] as Platform[]).filter((k) => tests[k].status === "not run").map(phrase);
  const failed = order.filter((k) => tests[k].status === "failed").map(phrase);

  const parts: string[] = [];
  if (tested.length) parts.push(`Tested on ${list(tested)}.`);
  if (builtFor.length)
    parts.push(`Built for ${list(builtFor)}, not yet tested${tested.length || failed.length ? "" : " in a headset"}.`);
  if (failed.length) parts.push(`The last test on ${list(failed)} did not pass.`);
  return parts.join(" ");
}
