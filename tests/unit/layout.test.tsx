import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { buildPersonJsonLd } from "@/content/jsonld";

describe("SiteHeader", () => {
  it("puts the skip link first, pointing at #main", () => {
    const { container } = render(<SiteHeader />);
    const first = container.querySelector("a");
    expect(first).toHaveAttribute("href", "#main");
    expect(first).toHaveTextContent("Skip to content");
  });

  it("names the site and links the main sections", () => {
    render(<SiteHeader />);
    expect(screen.getByRole("link", { name: "Stephen Sookra" })).toHaveAttribute("href", "/");
    const nav = within(screen.getByRole("navigation", { name: "Main" }));
    expect(nav.getAllByRole("link").map((a) => [a.textContent, a.getAttribute("href")])).toEqual([
      ["Work", "/work"],
      ["Resume", "/resume"],
      ["About", "/about"],
      ["Proof", "/proof"],
    ]);
  });
});

describe("SiteFooter", () => {
  it("links email, GitHub and LinkedIn", () => {
    render(<SiteFooter />);
    expect(screen.getByRole("link", { name: "Email" })).toHaveAttribute("href", "mailto:stephensookra@gmail.com");
    expect(screen.getByRole("link", { name: "GitHub" })).toHaveAttribute("href", "https://github.com/StephenSook");
    expect(screen.getByRole("link", { name: "LinkedIn" })).toHaveAttribute(
      "href",
      "https://www.linkedin.com/in/stephen-sookra-633682339/",
    );
  });
});

describe("buildPersonJsonLd", () => {
  const ld = buildPersonJsonLd() as unknown as Record<string, unknown>;

  it("describes Stephen as a software engineer", () => {
    expect(ld["@context"]).toBe("https://schema.org");
    expect(ld["@type"]).toBe("Person");
    expect(ld.name).toBe("Stephen Sookra");
    expect(ld.jobTitle).toBe("Software Engineer");
    expect(ld.url).toBe("https://stephensookra.com");
  });

  it("lists exactly the skills the brief names, without WebXR until tier 3", () => {
    expect(ld.knowsAbout).toEqual(["XR", "Lens Studio", "Unity", "React Three Fiber", "Next.js", "TypeScript", "Python"]);
  });

  it("links his public profiles", () => {
    expect(ld.sameAs).toEqual([
      "https://github.com/StephenSook",
      "https://www.linkedin.com/in/stephen-sookra-633682339/",
      "https://x.com/StephenSookra",
      "https://devpost.com/stephensookra",
    ]);
  });

  it("carries no private personal data", () => {
    const json = JSON.stringify(ld).toLowerCase();
    for (const key of ["telephone", "phone", "birthdate", "streetaddress", "postalcode"])
      expect(json).not.toContain(key);
  });
});
