import { z } from "zod";
import xrTestsJson from "./xr-tests.json";

/**
 * Where each mode (Enter VR, phone AR, the marker, passthrough, the Vision Pro environment)
 * has actually been run. Edited only when a run happens, with its date and evidence; the
 * site's wording comes from this file, so it can never claim a test that did not happen.
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
  // Part of the mode ran and part did not. Never a pass: the site words it as "partly tested",
  // or says nothing for a platform that is named only once it passes.
  z
    .object({
      name: z.string().min(3),
      status: z.literal("partial"),
      date: isoDate,
      evidence: z.string().min(10),
      ran: z.string().min(10),
      notRun: z.string().min(10),
    })
    .strict(),
]);

export const xrTestsSchema = z
  .object({
    // Enter VR (tier 3)
    quest3s: platformSchema,
    androidXrEmulator: platformSchema,
    visionPro: platformSchema,
    // Phone AR, the printed-card marker, Quest passthrough and the Vision Pro environment (tier 4)
    iphoneQuickLook: platformSchema,
    androidSceneViewer: platformSchema,
    markerIphone: platformSchema,
    markerAndroid: platformSchema,
    questPassthrough: platformSchema,
    visionImmersive: platformSchema,
  })
  .strict();

export type XrTests = z.infer<typeof xrTestsSchema>;
type Platform = keyof XrTests;

export const xrTests: XrTests = xrTestsSchema.parse(xrTestsJson);

function list(names: string[]): string {
  return names.length < 2 ? names.join("") : `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
}

type NoteOptions = {
  /** Named only once a run passes (never as "built for"). */
  hideUntilPassed?: Platform[];
  /** Named with "the" in a sentence ("the Android XR Emulator"). */
  withArticle?: Platform[];
};

/**
 * One line saying what has been tested, from the record: "Tested on A." for passed runs,
 * "Partly tested on B." for partial ones, "Built for C, not yet tested <where>." for runs not
 * made, and "The last test on D did not pass." for failed ones. <where> is said only while
 * nothing shown has been run at all. A platform in hideUntilPassed is left out until it passes.
 */
export function testedNote(tests: XrTests, keys: Platform[], where: string, options: NoteOptions = {}): string {
  const phrase = (key: Platform) => (options.withArticle?.includes(key) ? `the ${tests[key].name}` : tests[key].name);
  const shown = (key: Platform) => tests[key].status === "passed" || !options.hideUntilPassed?.includes(key);
  const named = (status: XrTests[Platform]["status"]) =>
    keys.filter((k) => tests[k].status === status && shown(k)).map(phrase);
  const tested = named("passed");
  const partly = named("partial");
  const builtFor = named("not run");
  const failed = named("failed");

  const parts: string[] = [];
  if (tested.length) parts.push(`Tested on ${list(tested)}.`);
  if (partly.length) parts.push(`Partly tested on ${list(partly)}.`);
  const anyRun = tested.length || partly.length || failed.length;
  if (builtFor.length) parts.push(`Built for ${list(builtFor)}, not yet tested${anyRun ? "" : ` ${where}`}.`);
  if (failed.length) parts.push(`The last test on ${list(failed)} did not pass.`);
  return parts.join(" ");
}

/**
 * The one line next to the Enter VR door. Android XR is named only once its emulator run
 * passes; Meta Quest is "tested" only after a real headset run passes; Vision Pro stays
 * "built for" until someone runs it.
 */
export function doorNote(tests: XrTests): string {
  return testedNote(tests, ["quest3s", "androidXrEmulator", "visionPro"], "in a headset", {
    hideUntilPassed: ["androidXrEmulator"],
    withArticle: ["androidXrEmulator"],
  });
}

/**
 * The line beside Place on your wall (passthrough on Meta Quest). Empty while its record
 * matches the headset's, since the door's own line then says the same; otherwise it says
 * where passthrough stands on its own.
 */
export function passthroughNote(tests: XrTests): string {
  const wall = tests.questPassthrough;
  if (wall.status === tests.quest3s.status) return "";
  if (wall.status === "passed") return `Place on your wall was tested on ${wall.name}.`;
  if (wall.status === "partial") return `Place on your wall was partly tested on ${wall.name}.`;
  if (wall.status === "failed") return `The last test of Place on your wall on ${wall.name} did not pass.`;
  return "Place on your wall is not yet tested.";
}
