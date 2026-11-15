import { existsSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  archive,
  awards,
  awardStats,
  bench,
  featured,
  profile,
  projectBySlug,
  projects,
  proofLine,
} from "@/content";
import { projectSchema, awardSchema } from "@/content/schema";

const PRIVATE_REPOS = [
  "hey-sync",
  "loka-pay",
  "nest",
  "recall-radar",
  "flashback",
  "pricequorum-private-archive",
  "pricequorum-strategy",
  "field-grading-kit",
  "claude-home",
  "loka-reference",
  "NVIDIA-x-Dell",
];

const BANNED_CHARS = /[—–“”‘’]/;

function collectStrings(value: unknown, path: string, out: { path: string; text: string }[]) {
  if (typeof value === "string") out.push({ path, text: value });
  else if (Array.isArray(value)) value.forEach((v, i) => collectStrings(v, `${path}[${i}]`, out));
  else if (value && typeof value === "object")
    for (const [k, v] of Object.entries(value)) collectStrings(v, `${path}.${k}`, out);
  return out;
}

const wordCount = (s: string) => s.trim().split(/\s+/).length;

describe("award stats", () => {
  it("derives 22 awards across 20 events, matching resume commit 4ac027c", () => {
    expect(awardStats).toEqual({ awards: 22, events: 20 });
    expect(awards).toHaveLength(22);
  });

  it("builds the proof line from the derived counts", () => {
    expect(proofLine()).toBe(
      "22 hackathon awards across 20 events. Software Engineer Intern at XR Dojo. CS at Kennesaw State.",
    );
  });

  it("every award parses against the schema", () => {
    for (const award of awards) expect(() => awardSchema.parse(award)).not.toThrow();
  });
});

describe("project groups", () => {
  it("features the six projects in brief order", () => {
    expect(featured.map((p) => p.slug)).toEqual([
      "case-light",
      "glare-zone",
      "xr-dojo",
      "varsity",
      "instanter",
      "aloud",
    ]);
    expect(featured.filter((p) => p.group === "xr").map((p) => p.slug)).toEqual([
      "case-light",
      "glare-zone",
      "xr-dojo",
    ]);
  });

  it("keeps Trace, StepSafe and PyroLens as archive pages", () => {
    expect(archive.map((p) => p.slug)).toEqual(["trace", "stepsafe", "pyrolens"]);
  });

  it("lists the bench in brief order", () => {
    expect(bench.map((p) => p.title)).toEqual([
      "Lullabuy",
      "HOLD",
      "Throughline",
      "LOKA Pay",
      "AccessGate",
      "Eleven",
      "Recall Reach",
      "Chat vs Codex",
      "Cast Forecast",
    ]);
  });

  it("finds a project by slug and returns undefined for unknown slugs", () => {
    expect(projectBySlug("varsity")?.title).toBe("VARSITY");
    expect(projectBySlug("saber")).toBeUndefined();
  });

  it("gives every featured project a case study", () => {
    for (const p of featured) expect(p.caseStudy, p.slug).toBeDefined();
  });
});

describe("project schema and card rules", () => {
  it("every project parses against the schema", () => {
    for (const p of projects) expect(() => projectSchema.parse(p), p.slug).not.toThrow();
  });

  it("titles are 1 to 3 words and lines are 15 words or fewer", () => {
    for (const p of projects) {
      expect(wordCount(p.title), p.slug).toBeLessThanOrEqual(3);
      expect(wordCount(p.line), p.slug).toBeLessThanOrEqual(15);
    }
  });

  it("every Try link carries a core-path check past the home page", () => {
    for (const p of projects)
      for (const link of p.links.filter((l) => l.kind === "try")) {
        expect(link.check, `${p.slug} ${link.url}`).toBeDefined();
        const origin = new URL(link.url).origin;
        expect(link.check!.url.replace(/\/$/, ""), p.slug).not.toBe(origin);
      }
  });

  it("every poster file exists in public and has alt text", () => {
    for (const p of projects)
      if (p.poster) {
        expect(existsSync(join(process.cwd(), "public", p.poster.src)), p.slug).toBe(true);
        expect(p.poster.alt.length, p.slug).toBeGreaterThan(10);
      }
  });
});

describe("honesty rules", () => {
  const urls = projects.flatMap((p) => [
    ...p.links.map((l) => l.url),
    ...p.links.flatMap((l) => (l.check ? [l.check.url] : [])),
  ]);

  it("never links spectacles.com/lens, 8th Wall hosted pages or private repos", () => {
    for (const url of urls) {
      expect(url).not.toMatch(/spectacles\.com\/lens/i);
      expect(url).not.toMatch(/8thwall/i);
      for (const repo of PRIVATE_REPOS)
        expect(url.toLowerCase()).not.toContain(`github.com/stephensook/${repo.toLowerCase()}`);
    }
    for (const p of projects)
      if (p.repo)
        expect(PRIVATE_REPOS.map((r) => r.toLowerCase())).not.toContain(
          p.repo.split("/")[1].toLowerCase(),
        );
  });

  it("labels the Snap Lenses as Lens Studio preview", () => {
    for (const slug of ["case-light", "glare-zone"])
      expect(projectBySlug(slug)!.platform).toContain("Lens Studio preview");
  });

  it("marks the solo builds", () => {
    // Aloud confirmed solo by Stephen on 2026-11-15.
    for (const slug of ["case-light", "glare-zone", "varsity", "instanter", "aloud"])
      expect(projectBySlug(slug)!.solo, slug).toBe(true);
  });

  it("uses VARSITY's official event name (its README) on the card and in both awards", () => {
    // "IBM SkillsBuild Sports Challenges" is only the organizer's grand-prize branding.
    const event = "IBM SkillsBuild AI Builders Challenge (June)";
    const varsity = projectBySlug("varsity")!;
    expect(varsity.result.state === "placed" && varsity.result.event).toBe(event);
    const varsityAwards = awards.filter((a) => a.project === "VARSITY");
    expect(varsityAwards).toHaveLength(2);
    for (const a of varsityAwards) expect(a.event).toBe(event);
  });

  it("carries the synthetic-records disclosure for Instanter and Trace", () => {
    for (const slug of ["instanter", "trace"])
      expect(projectBySlug(slug)!.disclosure, slug).toMatch(/synthetic/i);
  });

  it("shows XR Dojo as a role with no repo and no Try link", () => {
    const dojo = projectBySlug("xr-dojo")!;
    expect(dojo.result.state).toBe("role");
    expect(dojo.repo).toBeUndefined();
    expect(dojo.links.some((l) => l.kind === "try" || l.kind === "repo")).toBe(false);
  });

  it("makes no WebXR claim in tier 1", () => {
    for (const { path, text } of collectStrings({ projects, profile }, "content", []))
      expect(text, path).not.toMatch(/webxr/i);
  });
});

describe("copy rules", () => {
  it("uses no em dashes, en dashes or curly quotes anywhere in the content", () => {
    for (const { path, text } of collectStrings({ projects, awards, profile }, "content", []))
      expect(BANNED_CHARS.test(text), `${path}: ${text}`).toBe(false);
  });
});

describe("staleness guard", () => {
  it("no waiting result is past its results date (update the card the day results post)", () => {
    const today = new Date().toISOString().slice(0, 10);
    for (const p of projects)
      if (p.result.state === "waiting" && p.result.resultsDate)
        expect(p.result.resultsDate >= today, `${p.slug} results were due ${p.result.resultsDate}`).toBe(
          true,
        );
  });
});
