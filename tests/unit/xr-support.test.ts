import { describe, expect, it, vi } from "vitest";
import { doorNote, passthroughNote, testedNote, xrTests, xrTestsSchema, type XrTests } from "@/content/measurements/xr";
import { headsetPageUrl, webLaunchUrl, xrSupported } from "@/xr/support";

const system = (isSessionSupported: XRSystem["isSessionSupported"]) => ({ isSessionSupported }) as XRSystem;

describe("xrSupported", () => {
  it("is false when the browser has no WebXR", async () => {
    expect(await xrSupported(undefined)).toBe(false);
  });

  it("is true only when immersive-vr is reported as supported", async () => {
    const ask = vi.fn(async () => true);
    expect(await xrSupported(system(ask))).toBe(true);
    expect(ask).toHaveBeenCalledWith("immersive-vr");
    expect(await xrSupported(system(async () => false))).toBe(false);
  });

  it("asks for the mode it is given (immersive-ar for passthrough)", async () => {
    const ask = vi.fn(async (mode: XRSessionMode) => mode === "immersive-ar");
    expect(await xrSupported(system(ask), 1500, "immersive-ar")).toBe(true);
    expect(ask).toHaveBeenCalledWith("immersive-ar");
    expect(await xrSupported(system(ask))).toBe(false);
  });

  it("is false when the check throws or rejects", async () => {
    expect(await xrSupported(system(() => Promise.reject(new Error("SecurityError"))))).toBe(false);
    expect(
      await xrSupported(
        system(() => {
          throw new Error("not allowed");
        }),
      ),
    ).toBe(false);
  });

  it("is false when the check never answers", async () => {
    vi.useFakeTimers();
    const pending = xrSupported(system(() => new Promise<boolean>(() => {})), 1500);
    await vi.advanceTimersByTimeAsync(1500);
    expect(await pending).toBe(false);
    vi.useRealTimers();
  });
});

describe("webLaunchUrl", () => {
  it("wraps the page in Meta's Web Launch link, encoded", () => {
    expect(webLaunchUrl("https://stephensookra.com/case")).toBe(
      "https://www.oculus.com/open_url/?url=https%3A%2F%2Fstephensookra.com%2Fcase",
    );
  });

  it("refuses anything that is not https", () => {
    expect(() => webLaunchUrl("http://stephensookra.com/case")).toThrow();
  });
});

describe("headsetPageUrl", () => {
  it("sends this deployment's case page when it is served over https", () => {
    expect(headsetPageUrl("https://preview.example.com")).toBe("https://preview.example.com/case");
  });

  it("falls back to the public site when served over plain http (a local build)", () => {
    expect(headsetPageUrl("http://127.0.0.1:3100")).toBe("https://stephensookra.com/case");
  });
});

describe("headset test record", () => {
  const notRun: XrTests = {
    quest3s: { name: "Meta Quest 3S", status: "not run" },
    androidXrEmulator: { name: "Android XR Emulator", status: "not run" },
    visionPro: { name: "Apple Vision Pro", status: "not run" },
    iphoneQuickLook: { name: "iPhone with AR Quick Look", status: "not run" },
    androidSceneViewer: { name: "Android with Scene Viewer", status: "not run" },
    markerIphone: { name: "iPhone Safari", status: "not run" },
    markerAndroid: { name: "Android Chrome", status: "not run" },
    questPassthrough: { name: "Meta Quest 3S", status: "not run" },
    visionImmersive: { name: "Apple Vision Pro", status: "not run" },
  };

  it("parses the committed record", () => {
    expect(() => xrTestsSchema.parse(xrTests)).not.toThrow();
  });

  it("needs a date and evidence for every passed or failed run", () => {
    expect(() =>
      xrTestsSchema.parse({ ...notRun, quest3s: { name: "Meta Quest 3S", status: "passed" } }),
    ).toThrow();
    expect(() =>
      xrTestsSchema.parse({
        ...notRun,
        quest3s: { name: "Meta Quest 3S", status: "passed", date: "2026-11-20", evidence: "Stephen's recording" },
      }),
    ).not.toThrow();
  });

  it("says built for, not tested, until a run passes, and never names Android XR before it passes", () => {
    const note = doorNote(notRun);
    expect(note).toBe("Built for Meta Quest 3S and Apple Vision Pro, not yet tested in a headset.");
    expect(note).not.toMatch(/Android/);
  });

  it("names a platform as tested only after it passes", () => {
    const passed: XrTests = {
      ...notRun,
      quest3s: { name: "Meta Quest 3S", status: "passed", date: "2026-11-20", evidence: "Stephen's recording" },
      androidXrEmulator: {
        name: "Android XR Emulator",
        status: "passed",
        date: "2026-11-16",
        evidence: "emulator screenshots",
      },
    };
    expect(doorNote(passed)).toBe(
      "Tested on Meta Quest 3S and the Android XR Emulator. Built for Apple Vision Pro, not yet tested.",
    );
  });

  it("never calls a failed run tested", () => {
    const failed: XrTests = {
      ...notRun,
      quest3s: { name: "Meta Quest 3S", status: "failed", date: "2026-11-20", evidence: "exit did not work" },
    };
    expect(doorNote(failed)).not.toMatch(/Tested on Meta/);
  });

  const partial = {
    status: "partial" as const,
    date: "2026-11-15",
    evidence: "emulator screenshots and a screen recording",
    ran: "Enters VR and renders the case",
    notRun: "card pull not run",
  };

  it("needs a date, evidence, what ran and what did not for a partial run", () => {
    const { ran: _ran, ...noRan } = partial;
    expect(() => xrTestsSchema.parse({ ...notRun, androidXrEmulator: { name: "Android XR Emulator", ...noRan } })).toThrow();
    const { date: _date, ...noDate } = partial;
    expect(() => xrTestsSchema.parse({ ...notRun, androidXrEmulator: { name: "Android XR Emulator", ...noDate } })).toThrow();
    expect(() => xrTestsSchema.parse({ ...notRun, androidXrEmulator: { name: "Android XR Emulator", ...partial } })).not.toThrow();
  });

  it("treats a partial Android XR run as not passed: the door line does not change and never names it", () => {
    const tests: XrTests = { ...notRun, androidXrEmulator: { name: "Android XR Emulator", ...partial } };
    expect(doorNote(tests)).toBe(doorNote(notRun));
    expect(doorNote(tests)).not.toMatch(/Android/);
  });

  it("records the Android XR emulator run as partial, never as passed", () => {
    const run = xrTests.androidXrEmulator;
    expect(run.status).toBe("partial");
    if (run.status !== "partial") return;
    expect(run.date).toBe("2026-11-15");
    expect(run.ran).toMatch(/^Enters VR in Chrome 138 on the Android XR emulator and renders the case/);
    expect(run.notRun).toMatch(/card pull not run/i);
  });
});

describe("testedNote (every other mode's line)", () => {
  const base = xrTestsSchema.parse(xrTests);
  const notRun: XrTests = Object.fromEntries(
    Object.entries(base).map(([k, v]) => [k, { name: v.name, status: "not run" }]),
  ) as XrTests;

  it("says built for, not yet tested, for phone AR until a phone run passes", () => {
    expect(testedNote(notRun, ["iphoneQuickLook", "androidSceneViewer"], "on a phone")).toBe(
      "Built for iPhone with AR Quick Look and Android with Scene Viewer, not yet tested on a phone.",
    );
  });

  it("names a passed run as tested and keeps the rest as built for", () => {
    const tests: XrTests = {
      ...notRun,
      iphoneQuickLook: { name: "iPhone with AR Quick Look", status: "passed", date: "2026-11-20", evidence: "Stephen, iPhone 17 Pro" },
    };
    expect(testedNote(tests, ["iphoneQuickLook", "androidSceneViewer"], "on a phone")).toBe(
      "Tested on iPhone with AR Quick Look. Built for Android with Scene Viewer, not yet tested.",
    );
  });

  it("says partly tested for a shown platform with a partial run, never tested", () => {
    const tests: XrTests = {
      ...notRun,
      iphoneQuickLook: {
        name: "iPhone with AR Quick Look",
        status: "partial",
        date: "2026-11-20",
        evidence: "Stephen, iPhone 17 Pro",
        ran: "opens the viewer",
        notRun: "placing in the room not run",
      },
    };
    const note = testedNote(tests, ["iphoneQuickLook", "androidSceneViewer"], "on a phone");
    expect(note).toBe("Partly tested on iPhone with AR Quick Look. Built for Android with Scene Viewer, not yet tested.");
    expect(note).not.toMatch(/^Tested/);
  });

  it("adds a passthrough line only when its record differs from the headset's", () => {
    const run = { date: "2026-11-20", evidence: "Stephen, Quest 3S" };
    expect(passthroughNote(notRun)).toBe(""); // the headset line already says not yet tested
    const vrPassed: XrTests = { ...notRun, quest3s: { name: "Meta Quest 3S", status: "passed", ...run } };
    expect(passthroughNote(vrPassed)).toBe("Place on your wall is not yet tested.");
    const bothPassed: XrTests = { ...vrPassed, questPassthrough: { name: "Meta Quest 3S", status: "passed", ...run } };
    expect(passthroughNote(bothPassed)).toBe("");
    const wallFailed: XrTests = { ...vrPassed, questPassthrough: { name: "Meta Quest 3S", status: "failed", ...run } };
    expect(passthroughNote(wallFailed)).toBe("The last test of Place on your wall on Meta Quest 3S did not pass.");
    const onlyWall: XrTests = { ...notRun, questPassthrough: { name: "Meta Quest 3S", status: "passed", ...run } };
    expect(passthroughNote(onlyWall)).toBe("Place on your wall was tested on Meta Quest 3S.");
    const wallPartial: XrTests = {
      ...vrPassed,
      questPassthrough: { name: "Meta Quest 3S", status: "partial", ...run, ran: "finds a wall", notRun: "hanging the case not run" },
    };
    expect(passthroughNote(wallPartial)).toBe("Place on your wall was partly tested on Meta Quest 3S.");
  });

  it("covers every key in the committed record (no mode without a line)", () => {
    for (const key of Object.keys(base)) expect(base[key as keyof XrTests].status).toMatch(/not run|passed|failed|partial/);
    expect(Object.keys(base).sort()).toEqual(Object.keys(notRun).sort());
  });
});
