import { readFileSync, statSync } from "node:fs";
import { createHash } from "node:crypto";
import { join } from "node:path";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { PhoneArView, type PhoneArViewProps } from "@/components/PhoneArView";

const flush = () => act(async () => new Promise((r) => setTimeout(r, 0)));
const base: Omit<PhoneArViewProps, "supportsQuickLook" | "hasModelElement" | "loadViewer"> = {
  glb: "/ar/gen/case.glb",
  usdz: "/ar/gen/case.usdz",
  poster: { src: "/case/gen/poster-light.webp", dark: "/case/gen/poster-dark.webp", width: 1600, height: 900 },
  note: "Built for iPhone with AR Quick Look and Android with Scene Viewer, not yet tested on a phone.",
};

describe("PhoneArView", () => {
  it("on an iPhone, links the poster to AR Quick Look, with no script to load", async () => {
    const loadViewer = vi.fn();
    const { container } = render(
      <PhoneArView {...base} supportsQuickLook={() => true} hasModelElement={() => false} loadViewer={loadViewer} />,
    );
    await flush();
    const link = container.querySelector('a[rel="ar"]')!;
    expect(link).toHaveAttribute("href", "/ar/gen/case.usdz");
    // AR Quick Look needs one <img> or <picture> as the link's only child (WebKit blog 8421).
    expect(link.children).toHaveLength(1);
    expect(link.firstElementChild?.tagName).toBe("PICTURE");
    expect(link.querySelector('picture > source[media="(prefers-color-scheme: dark)"]')).toHaveAttribute(
      "srcset",
      "/case/gen/poster-dark.webp",
    );
    expect(link.querySelector("picture > img")).toHaveAttribute("src", "/case/gen/poster-light.webp");
    expect(loadViewer).not.toHaveBeenCalled();
  });

  it("on Safari with the <model> element, shows the case in 3D inside the same AR link", async () => {
    const { container } = render(
      <PhoneArView {...base} supportsQuickLook={() => true} hasModelElement={() => true} loadViewer={vi.fn()} />,
    );
    await flush();
    const model = container.querySelector('a[rel="ar"] > model');
    expect(model).not.toBeNull();
    expect(model).toHaveAttribute("src", "/ar/gen/case.usdz");
  });

  it("elsewhere, loads the 3D viewer only on the tap, then shows the case with AR at real size", async () => {
    const loadViewer = vi.fn(async () => {});
    const { container } = render(
      <PhoneArView {...base} supportsQuickLook={() => false} hasModelElement={() => false} loadViewer={loadViewer} />,
    );
    await flush();
    expect(loadViewer).not.toHaveBeenCalled();
    expect(container.querySelector("model-viewer")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "See it in 3D and in your room" }));
    await flush();
    expect(loadViewer).toHaveBeenCalledTimes(1);
    const viewer = container.querySelector("model-viewer")!;
    expect(viewer).toHaveAttribute("src", "/ar/gen/case.glb");
    expect(viewer).toHaveAttribute("ios-src", "/ar/gen/case.usdz");
    expect(viewer).toHaveAttribute("ar-scale", "fixed");
  });

  it("says plainly when the 3D viewer cannot load", async () => {
    render(
      <PhoneArView
        {...base}
        supportsQuickLook={() => false}
        hasModelElement={() => false}
        loadViewer={async () => Promise.reject(new Error("offline"))}
      />,
    );
    await flush();
    fireEvent.click(screen.getByRole("button", { name: "See it in 3D and in your room" }));
    await flush();
    expect(screen.getByRole("status")).toHaveTextContent("The 3D viewer is not available here.");
  });

  it("says plainly when the model itself fails to load", async () => {
    const { container } = render(
      <PhoneArView {...base} supportsQuickLook={() => false} hasModelElement={() => false} loadViewer={async () => {}} />,
    );
    await flush();
    fireEvent.click(screen.getByRole("button", { name: "See it in 3D and in your room" }));
    await flush();
    act(() => {
      container.querySelector("model-viewer")!.dispatchEvent(new Event("error"));
    });
    expect(screen.getByRole("status")).toHaveTextContent("The 3D viewer is not available here.");
  });

  it("states what has and has not been tested", async () => {
    render(<PhoneArView {...base} supportsQuickLook={() => false} hasModelElement={() => false} loadViewer={vi.fn()} />);
    await flush();
    expect(screen.getByText(/not yet tested on a phone/)).toBeInTheDocument();
  });
});

describe("the vendored model-viewer", () => {
  it("is the published 4.4.0 build, unchanged, and within its budget", () => {
    const dir = join(process.cwd(), "public/vendor/model-viewer/4.4.0");
    const source = JSON.parse(readFileSync(join(dir, "source.json"), "utf8"));
    const bytes = readFileSync(join(dir, "model-viewer.min.js"));
    expect(source).toMatchObject({ package: "@google/model-viewer", version: "4.4.0", license: "Apache-2.0" });
    expect(createHash("sha256").update(bytes).digest("hex")).toBe(source.sha256);
    expect(statSync(join(dir, "model-viewer.min.js")).size).toBeLessThan(1.2 * 1024 * 1024);
    expect(readFileSync(join(dir, "LICENSE"), "utf8")).toMatch(/Apache License/);
  });
});
