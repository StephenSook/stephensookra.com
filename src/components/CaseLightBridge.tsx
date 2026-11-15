"use client";

import { useEffect, useRef } from "react";
import { caseLight } from "@/scene/caseLight";

/** The slug of the card under a target, or "row:<name>" for a row link (data-light). */
const slugOf = (target: EventTarget | null): string | null => {
  if (!(target instanceof Element)) return null;
  const el = target.closest("[data-slug], [data-light]");
  if (!el) return null;
  const slug = el.getAttribute("data-slug");
  if (slug) return slug;
  return `row:${el.getAttribute("data-light")}`;
};

/**
 * Links the HTML grid to the lit case. Hovering or focusing a card lights its slot in the
 * 3D scene; a slot the scene lights gets data-lit on its card. Event delegation on one
 * wrapper keeps the cards themselves server-rendered and link-only.
 */
export function CaseLightBridge({ children }: { children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const root = ref.current;
    if (!root) return;
    let pointerSlug: string | null = null;
    let focusSlug: string | null = null;
    const publish = () => caseLight.set("grid", pointerSlug ?? focusSlug);

    const onPointerOver = (e: PointerEvent) => {
      pointerSlug = slugOf(e.target);
      publish();
    };
    const onPointerOut = (e: PointerEvent) => {
      if (slugOf(e.relatedTarget) === slugOf(e.target)) return;
      pointerSlug = slugOf(e.relatedTarget);
      publish();
    };
    const onFocusIn = (e: FocusEvent) => {
      focusSlug = slugOf(e.target);
      publish();
    };
    const onFocusOut = (e: FocusEvent) => {
      focusSlug = slugOf(e.relatedTarget);
      publish();
    };

    const paint = () => {
      const { slug } = caseLight.get();
      for (const el of root.querySelectorAll("[data-slug]")) {
        if (el.getAttribute("data-slug") === slug) el.setAttribute("data-lit", "");
        else el.removeAttribute("data-lit");
      }
    };

    root.addEventListener("pointerover", onPointerOver);
    root.addEventListener("pointerout", onPointerOut);
    root.addEventListener("focusin", onFocusIn);
    root.addEventListener("focusout", onFocusOut);
    const unsubscribe = caseLight.subscribe(paint);
    paint();
    return () => {
      root.removeEventListener("pointerover", onPointerOver);
      root.removeEventListener("pointerout", onPointerOut);
      root.removeEventListener("focusin", onFocusIn);
      root.removeEventListener("focusout", onFocusOut);
      unsubscribe();
      caseLight.set("grid", null);
    };
  }, []);

  return (
    <div ref={ref} className="case-light-bridge">
      {children}
    </div>
  );
}
