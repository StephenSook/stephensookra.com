import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { extractText, getDocumentProxy } from "unpdf";
import { beforeAll, describe, expect, it } from "vitest";
import { resume } from "@/content/resume";

const pdfPath = join(process.cwd(), "public", resume.pdf.path);

/** Joins hyphenated line breaks, ligatures and dash variants so PDF text compares to plain strings. */
function normalize(text: string): string {
  return text
    .replace(/ﬁ/g, "fi")
    .replace(/ﬂ/g, "fl")
    .replace(/ﬀ/g, "ff")
    .replace(/[‐‑‒–—−]/g, "-")
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/\s+/g, " ")
    .trim();
}

let pdfText = "";

beforeAll(async () => {
  const pdf = await getDocumentProxy(new Uint8Array(readFileSync(pdfPath)));
  const { text } = await extractText(pdf, { mergePages: true });
  pdfText = normalize(text);
});

describe("resume PDF", () => {
  it("is the exact file recorded in the content source", () => {
    const hash = createHash("sha256").update(readFileSync(pdfPath)).digest("hex");
    expect(hash).toBe(resume.pdf.sha256);
  });

  it("carries the corrected GPA and the award count", () => {
    expect(pdfText).toContain("GPA: 3.51/4.0");
    expect(pdfText).toContain("22 awards across 20 events");
  });
});

describe("HTML resume matches the PDF", () => {
  it("every experience bullet appears in the PDF", () => {
    for (const job of resume.experience)
      for (const bullet of job.bullets) expect(pdfText, `${job.org}: ${bullet}`).toContain(normalize(bullet));
  });

  it("every project bullet appears in the PDF", () => {
    for (const project of resume.projects)
      for (const bullet of project.bullets) expect(pdfText, `${project.name}: ${bullet}`).toContain(normalize(bullet));
  });

  it("every skills line appears in the PDF", () => {
    for (const line of resume.skills) expect(pdfText, line.label).toContain(normalize(line.items.join(", ")));
  });
});
