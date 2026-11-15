import { act, fireEvent, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CaseLightBridge } from "@/components/CaseLightBridge";
import { caseLight } from "@/scene/caseLight";

afterEach(() => caseLight.reset());

describe("caseLight store", () => {
  it("lights the scene's slug over the grid's, and falls back to the grid when the scene clears", () => {
    caseLight.set("grid", "glare-zone");
    expect(caseLight.get()).toEqual({ slug: "glare-zone", source: "grid" });
    caseLight.set("scene", "aloud");
    expect(caseLight.get()).toEqual({ slug: "aloud", source: "scene" });
    caseLight.set("scene", null);
    expect(caseLight.get()).toEqual({ slug: "glare-zone", source: "grid" });
    caseLight.set("grid", null);
    expect(caseLight.get()).toEqual({ slug: null, source: null });
  });

  it("notifies once per change and not for a no-op set", () => {
    const fn = vi.fn();
    const off = caseLight.subscribe(fn);
    caseLight.set("grid", "varsity");
    caseLight.set("grid", "varsity");
    caseLight.set("grid", null);
    off();
    caseLight.set("grid", "aloud");
    expect(fn).toHaveBeenCalledTimes(2);
  });
});

function Grid() {
  return (
    <CaseLightBridge>
      <article className="slot" data-slug="case-light">
        <a href="#case-light">Case Light</a>
      </article>
      <article className="slot" data-slug="glare-zone">
        <a href="#glare-zone">Glare Zone</a>
      </article>
    </CaseLightBridge>
  );
}

describe("CaseLightBridge", () => {
  it("lights the slot a pointer is over and clears it when the pointer leaves", () => {
    const { getByText, container } = render(<Grid />);
    fireEvent.pointerOver(getByText("Glare Zone"));
    expect(caseLight.get()).toEqual({ slug: "glare-zone", source: "grid" });
    fireEvent.pointerOut(getByText("Glare Zone"), { relatedTarget: container });
    expect(caseLight.get().slug).toBeNull();
  });

  it("keeps a focused card lit after a pointer passes over another card and leaves", () => {
    const { getByText, container } = render(<Grid />);
    fireEvent.focusIn(getByText("Case Light"));
    fireEvent.pointerOver(getByText("Glare Zone"));
    expect(caseLight.get().slug).toBe("glare-zone");
    fireEvent.pointerOut(getByText("Glare Zone"), { relatedTarget: container });
    expect(caseLight.get().slug).toBe("case-light");
    fireEvent.focusOut(getByText("Case Light"), { relatedTarget: null });
    expect(caseLight.get().slug).toBeNull();
  });

  it("lights a whole row from the XR work and Software work links", () => {
    const { getByText } = render(
      <CaseLightBridge>
        <a href="#xr" data-light="xr">
          XR work
        </a>
      </CaseLightBridge>,
    );
    fireEvent.pointerOver(getByText("XR work"));
    expect(caseLight.get().slug).toBe("row:xr");
  });

  it("marks the card the scene lights, and only that card", () => {
    const { container } = render(<Grid />);
    act(() => caseLight.set("scene", "glare-zone"));
    const lit = [...container.querySelectorAll("[data-lit]")].map((n) => n.getAttribute("data-slug"));
    expect(lit).toEqual(["glare-zone"]);
    act(() => caseLight.set("scene", null));
    expect(container.querySelectorAll("[data-lit]")).toHaveLength(0);
  });
});
