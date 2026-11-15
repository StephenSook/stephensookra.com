import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { AwardsList } from "@/components/AwardsList";
import { ProjectCard } from "@/components/ProjectCard";
import { ProjectRow } from "@/components/ProjectRow";
import { RepoStatusView } from "@/components/RepoStatus";
import { ResultLine } from "@/components/ResultLine";
import { awards, projectBySlug } from "@/content";
import type { Result } from "@/content";

const specs: Result = {
  state: "waiting",
  event: "Learn AR with SPECS (Devpost x Snap)",
  resultsDate: "2026-11-19",
  source: { label: "Devpost event page" },
};

describe("ResultLine", () => {
  it("shows a placed result as the prize and the event", () => {
    const { container } = render(<ResultLine result={projectBySlug("aloud")!.result} />);
    expect(container).toHaveTextContent("1st of 238, $5,000");
    expect(container).toHaveTextContent("YouCam API Hackathon");
  });

  it("shows a pending result with its date in the brief's wording", () => {
    const { container } = render(<ResultLine result={specs} now={new Date("2026-11-15T12:00:00Z")} />);
    expect(container).toHaveTextContent("Entered: Learn AR with SPECS (Devpost x Snap). Results Nov 19.");
  });

  it("admits a stale pending result instead of implying it is still pending", () => {
    const { container } = render(<ResultLine result={specs} now={new Date("2026-11-21T12:00:00Z")} />);
    expect(container).toHaveTextContent(
      "Entered: Learn AR with SPECS (Devpost x Snap). Results were due Nov 19; this page has not been updated yet.",
    );
  });

  it("shows a pending result with no date as not announced", () => {
    const { container } = render(
      <ResultLine result={{ state: "waiting", event: "Codex x TwitchCon", source: { label: "Event page" } }} />,
    );
    expect(container).toHaveTextContent("Entered: Codex x TwitchCon. Results not announced yet.");
  });

  it("shows a role as title and dates", () => {
    const { container } = render(<ResultLine result={projectBySlug("xr-dojo")!.result} />);
    expect(container).toHaveTextContent("Software Engineer Intern, March 2026 to now");
  });
});

describe("RepoStatusView", () => {
  it("says not available, with no numbers, when the read failed", () => {
    const { container } = render(
      <RepoStatusView
        status={{ state: "unavailable", repo: "StephenSook/case-light", url: "https://github.com/StephenSook/case-light" }}
      />,
    );
    expect(container).toHaveTextContent("Repo details not available");
    expect(container.textContent).not.toMatch(/\d/);
  });

  it("shows last commit, CI and licence when the read worked, and leaves out a small star count", () => {
    const { container } = render(
      <RepoStatusView
        status={{
          state: "ok",
          repo: "StephenSook/case-light",
          url: "https://github.com/StephenSook/case-light",
          lastCommit: "2026-11-04T08:22:08Z",
          stars: 9,
          ci: "passing",
          license: "MIT",
        }}
      />,
    );
    expect(container).toHaveTextContent("Last commit Nov 4, 2026");
    expect(container).toHaveTextContent("CI passing");
    expect(container).toHaveTextContent("MIT licence");
    expect(container.textContent).not.toMatch(/star/i);
  });

  it("shows stars once a repo has 10 or more", () => {
    const { container } = render(
      <RepoStatusView
        status={{
          state: "ok",
          repo: "StephenSook/x",
          url: "https://github.com/StephenSook/x",
          lastCommit: "2026-01-02T00:00:00Z",
          stars: 10,
          ci: "passing",
          license: "Apache-2.0",
        }}
      />,
    );
    expect(container).toHaveTextContent("10 stars");
    expect(container).toHaveTextContent("Apache-2.0 licence");
  });

  it("leaves out the licence line when GitHub reports none or NOASSERTION", () => {
    for (const license of [null, "NOASSERTION"]) {
      const { container, unmount } = render(
        <RepoStatusView
          status={{
            state: "ok",
            repo: "StephenSook/x",
            url: "https://github.com/StephenSook/x",
            lastCommit: "2026-01-02T00:00:00Z",
            stars: 0,
            ci: "passing",
            license,
          }}
        />,
      );
      expect(container.textContent, String(license)).not.toMatch(/licen/i);
      unmount();
    }
  });

  it("says when CI has not finished", () => {
    const { container } = render(
      <RepoStatusView
        status={{
          state: "ok",
          repo: "StephenSook/x",
          url: "https://github.com/StephenSook/x",
          lastCommit: "2026-01-02T00:00:00Z",
          stars: 2,
          ci: "running",
          license: null,
        }}
      />,
    );
    expect(container).toHaveTextContent("CI running");
  });

  it("says when a repo has no CI runs", () => {
    const { container } = render(
      <RepoStatusView
        status={{
          state: "ok",
          repo: "StephenSook/x",
          url: "https://github.com/StephenSook/x",
          lastCommit: "2026-01-02T00:00:00Z",
          stars: 0,
          ci: "none",
          license: null,
        }}
      />,
    );
    expect(container).toHaveTextContent("No CI runs");
  });
});

describe("ProjectCard", () => {
  it("is one link to the project's page, with its poster", () => {
    render(<ProjectCard project={projectBySlug("case-light")!} slotLabel="A1" />);
    const links = screen.getAllByRole("link");
    expect(links).toHaveLength(1);
    expect(links[0]).toHaveAttribute("href", "/work/case-light");
    expect(links[0]).toHaveAccessibleName("Case Light");
    expect(screen.getByRole("img")).toHaveAttribute("alt", projectBySlug("case-light")!.poster!.alt);
    expect(screen.getByText("Solo build")).toBeInTheDocument();
    expect(screen.getByText("Snap Specs Lens, Lens Studio preview")).toBeInTheDocument();
  });

  it("lazy-loads its poster by default and loads it early when it may be the largest paint", () => {
    const { unmount } = render(<ProjectCard project={projectBySlug("varsity")!} slotLabel="B1" />);
    expect(screen.getByRole("img")).toHaveAttribute("loading", "lazy");
    unmount();
    render(<ProjectCard project={projectBySlug("varsity")!} slotLabel="B1" posterLoad="eager" />);
    const img = screen.getByRole("img");
    expect(img).toHaveAttribute("loading", "eager");
    expect(img).toHaveAttribute("fetchpriority", "high");
  });
});

describe("ProjectRow poster loading", () => {
  it("preloads only the first poster of an early row and loads the rest eagerly", () => {
    const projects = ["case-light", "glare-zone", "xr-dojo"].map((s) => projectBySlug(s)!);
    render(<ProjectRow id="xr" letter="A" heading="XR work" projects={projects} eagerPosters />);
    const imgs = screen.getAllByRole("img");
    expect(imgs).toHaveLength(2);
    expect(imgs[0]).not.toHaveAttribute("loading", "lazy");
    expect(imgs[1]).toHaveAttribute("loading", "eager");
    expect(imgs[1]).toHaveAttribute("fetchpriority", "high");
  });

  it("carries its slug so the case can light it", () => {
    const { container } = render(<ProjectCard project={projectBySlug("instanter")!} slotLabel="B2" />);
    expect(container.querySelector("article")).toHaveAttribute("data-slug", "instanter");
  });

  it("renders XR Dojo without an image or an outside link", () => {
    render(<ProjectCard project={projectBySlug("xr-dojo")!} slotLabel="A3" />);
    expect(screen.queryByRole("img")).toBeNull();
    const links = screen.getAllByRole("link");
    expect(links).toHaveLength(1);
    expect(links[0]).toHaveAttribute("href", "/work/xr-dojo");
  });
});

describe("ProjectRow", () => {
  it("labels slots by row letter and position", () => {
    const projects = ["case-light", "glare-zone", "xr-dojo"].map((s) => projectBySlug(s)!);
    const { container } = render(<ProjectRow id="xr" letter="A" heading="XR work" projects={projects} />);
    const section = container.querySelector("section#xr");
    expect(section).toHaveAttribute("data-row", "xr");
    expect(screen.getByRole("heading", { level: 2, name: "XR work" })).toBeInTheDocument();
    expect([...container.querySelectorAll("[data-slot]")].map((n) => n.getAttribute("data-slot"))).toEqual([
      "A1",
      "A2",
      "A3",
    ]);
  });
});

describe("AwardsList", () => {
  it("lists every award with its event and project when named", () => {
    render(<AwardsList awards={awards} />);
    const items = screen.getAllByRole("listitem");
    expect(items).toHaveLength(22);
    expect(items[0]).toHaveTextContent("2nd of 148, $1,000, Apify track");
    expect(items[0]).toHaveTextContent("Cal Hacks 13.0, Eleven");
    const rote = items.find((li) => li.textContent?.includes("Rote Playoffs"))!;
    expect(rote).toHaveTextContent(/^2ndRote Playoffs$/);
  });
});
