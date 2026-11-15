import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { BenchList } from "@/components/BenchList";
import { CaseStudyView } from "@/components/CaseStudyView";
import { ProjectLinks } from "@/components/ProjectLinks";
import { bench, projectBySlug } from "@/content";

describe("ProjectLinks", () => {
  it("lists each link with its label and URL", () => {
    render(<ProjectLinks links={projectBySlug("case-light")!.links} />);
    expect(screen.getByRole("link", { name: "Source on GitHub" })).toHaveAttribute(
      "href",
      "https://github.com/StephenSook/case-light",
    );
    expect(screen.getByRole("link", { name: "Watch the film" })).toHaveAttribute(
      "href",
      "https://www.youtube.com/watch?v=lymPgfFXAZ4",
    );
  });

  it("renders nothing when there are no links", () => {
    const { container } = render(<ProjectLinks links={[]} />);
    expect(container).toBeEmptyDOMElement();
  });
});

describe("CaseStudyView", () => {
  it("shows the brief's sections in order", () => {
    render(<CaseStudyView caseStudy={projectBySlug("instanter")!.caseStudy!} />);
    expect(screen.getAllByRole("heading", { level: 2 }).map((h) => h.textContent)).toEqual([
      "Evidence",
      "My part",
      "How it works",
      "Engineering",
      "Measured",
      "What broke",
      "Sources",
    ]);
    expect(screen.getByText("4 of 46")).toBeInTheDocument();
  });

  it("leaves out sections the sources do not support", () => {
    render(<CaseStudyView caseStudy={projectBySlug("xr-dojo")!.caseStudy!} />);
    const headings = screen.getAllByRole("heading", { level: 2 }).map((h) => h.textContent);
    expect(headings).not.toContain("Measured");
    expect(headings).not.toContain("What broke");
  });

  it("links sources that have a URL", () => {
    render(<CaseStudyView caseStudy={projectBySlug("case-light")!.caseStudy!} />);
    const list = screen.getByRole("list", { name: "Sources" });
    expect(within(list).getByRole("link", { name: "Case Light README" })).toHaveAttribute(
      "href",
      "https://github.com/StephenSook/case-light#readme",
    );
  });
});

describe("BenchList", () => {
  it("lists every bench project with its result and links, but no case-study link", () => {
    render(<BenchList projects={bench} />);
    const items = screen.getAllByRole("listitem", { name: /.+/ });
    expect(items.map((li) => li.getAttribute("aria-label"))).toEqual(bench.map((p) => p.title));
    const loka = items.find((li) => li.getAttribute("aria-label") === "LOKA Pay")!;
    expect(within(loka).queryByRole("link", { name: "Source on GitHub" })).toBeNull();
    for (const a of screen.getAllByRole("link")) expect(a.getAttribute("href")).not.toMatch(/^\/work\//);
  });
});
