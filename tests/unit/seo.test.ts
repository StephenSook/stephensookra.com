import { describe, expect, it } from "vitest";
import { GET as llms } from "@/app/llms.txt/route";
import robots from "@/app/robots";
import sitemap from "@/app/sitemap";
import { featured, profile } from "@/content";

const BASE = "https://stephensookra.com";

describe("sitemap", () => {
  it("lists every public page and leaves out the /case placeholder", () => {
    const urls = sitemap().map((e) => e.url);
    expect(urls).toEqual([
      `${BASE}/`,
      `${BASE}/work`,
      ...["case-light", "glare-zone", "xr-dojo", "varsity", "instanter", "aloud", "trace", "stepsafe", "pyrolens"].map(
        (s) => `${BASE}/work/${s}`,
      ),
      `${BASE}/resume`,
      `${BASE}/about`,
      `${BASE}/proof`,
    ]);
  });
});

describe("robots", () => {
  it("allows everything and points at the sitemap", () => {
    const r = robots();
    expect(r.rules).toEqual({ userAgent: "*", allow: "/" });
    expect(r.sitemap).toBe(`${BASE}/sitemap.xml`);
  });
});

describe("llms.txt", () => {
  it("is plain text that names Stephen, his role and every featured project with its URL", async () => {
    const res = await llms();
    expect(res.headers.get("content-type")).toMatch(/^text\/plain/);
    const body = await res.text();
    expect(body.startsWith("# Stephen Sookra\n")).toBe(true);
    expect(body).toContain(profile.roleLine);
    for (const p of featured) expect(body).toContain(`${BASE}/work/${p.slug}`);
    expect(body).toContain(`${BASE}/resume`);
    expect(body).not.toMatch(/[—–“”‘’]/);
  });
});
