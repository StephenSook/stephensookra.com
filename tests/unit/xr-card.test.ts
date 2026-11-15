import { describe, expect, it, vi } from "vitest";
import { featured } from "@/content";
import { resultText } from "@/components/ResultLine";
import spec from "@/scene/case-spec.json";
import { buildLayout } from "@/scene/layout";
import { cardText, fitBox } from "@/xr/card";
import { slotLabels } from "@/xr/labels";
import { createVideoController, type VideoLike } from "@/xr/video";

const NOW = new Date("2026-11-15T12:00:00Z");
const bySlug = (slug: string) => featured.find((p) => p.slug === slug)!;

describe("cardText", () => {
  it("gives the title, line, platform and the same result wording as the grid card", () => {
    for (const slug of ["case-light", "varsity", "xr-dojo"]) {
      const p = bySlug(slug);
      const card = cardText(p, NOW);
      const { lead, detail } = resultText(p.result, NOW);
      expect(card.title).toBe(p.title);
      expect(card.line).toBe(p.line);
      expect(card.platform).toBe(p.platform);
      expect(card.result).toBe(detail ? `${lead}. ${detail}` : lead);
    }
  });

  it("covers all three result states", () => {
    expect(bySlug("case-light").result.state).toBe("waiting");
    expect(bySlug("varsity").result.state).toBe("placed");
    expect(bySlug("xr-dojo").result.state).toBe("role");
    expect(cardText(bySlug("case-light"), NOW).result).toMatch(/^Entered: /);
    expect(cardText(bySlug("xr-dojo"), NOW).result).toMatch(/to now$/);
  });

  it("states the reader's part: the case study's line, else Solo build, else nothing", () => {
    for (const p of featured) {
      const expected = p.caseStudy?.myPart ?? (p.solo ? "Solo build" : undefined);
      expect(cardText(p, NOW).part, p.slug).toBe(expected);
    }
  });

  it("uses only characters the self-hosted Latin font has, so no fallback font is fetched", () => {
    const LATIN = /^[\x20-\x7E -ÿ]*$/;
    const strings = [
      ...featured.flatMap((p) => Object.values(cardText(p, NOW)).filter((v): v is string => typeof v === "string")),
      ...slotLabels(buildLayout(spec), featured).map((l) => l.text),
      "Exit VR",
      "Close",
    ];
    for (const s of strings) expect(s, s).toMatch(LATIN);
  });
});

function fakeVideo() {
  const calls: string[] = [];
  const video: VideoLike = {
    src: "",
    muted: false,
    loop: false,
    playsInline: false,
    crossOrigin: null,
    preload: "auto",
    play: vi.fn(() => {
      calls.push(`play ${video.src}`);
      return Promise.resolve();
    }),
    pause: vi.fn(() => calls.push("pause")),
    load: vi.fn(() => calls.push("load")),
    removeAttribute: vi.fn((name: string) => {
      calls.push(`remove ${name}`);
      video.src = "";
    }),
  };
  return { video, calls };
}

describe("the one video", () => {
  it("makes a single muted, looping, inline element, however many cards are pulled", async () => {
    const { video } = fakeVideo();
    const make = vi.fn(() => video);
    const v = createVideoController(make);
    await v.play("/loops/instanter.mp4");
    await v.play("/loops/aloud.mp4");
    await v.play("/loops/case-light.mp4");
    expect(make).toHaveBeenCalledTimes(1);
    expect(video).toMatchObject({ muted: true, loop: true, playsInline: true });
  });

  it("stops the playing loop before the next one starts", async () => {
    const { video, calls } = fakeVideo();
    const v = createVideoController(() => video);
    await v.play("/loops/instanter.mp4");
    await v.play("/loops/aloud.mp4");
    expect(calls).toEqual(["play /loops/instanter.mp4", "pause", "play /loops/aloud.mp4"]);
    expect(v.current).toBe("/loops/aloud.mp4");
  });

  it("clears the source on stop, so nothing keeps playing or downloading", async () => {
    const { video, calls } = fakeVideo();
    const v = createVideoController(() => video);
    await v.play("/loops/aloud.mp4");
    v.stop();
    expect(calls.slice(-3)).toEqual(["pause", "remove src", "load"]);
    expect(v.current).toBeNull();
  });

  it("does not throw when the browser blocks playback", async () => {
    const { video } = fakeVideo();
    video.play = vi.fn(() => Promise.reject(new DOMException("blocked", "NotAllowedError")));
    const v = createVideoController(() => video);
    await expect(v.play("/loops/aloud.mp4")).resolves.toBe(false);
  });
});

describe("fitBox", () => {
  it("fits a video inside its box without cropping or stretching", () => {
    const close = (got: { w: number; h: number }, w: number, h: number) => {
      expect(got.w).toBeCloseTo(w, 9);
      expect(got.h).toBeCloseTo(h, 9);
    };
    close(fitBox(720, 406, 0.26, 0.26), 0.26, (0.26 * 406) / 720);
    close(fitBox(290, 620, 0.26, 0.26), (0.26 * 290) / 620, 0.26);
    close(fitBox(500, 500, 0.26, 0.2), 0.2, 0.2);
  });
});
