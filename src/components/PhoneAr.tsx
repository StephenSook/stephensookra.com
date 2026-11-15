"use client";

import { PhoneArView, type PhoneArViewProps } from "./PhoneArView";

const MODEL_VIEWER = "/vendor/model-viewer/4.4.0/model-viewer.min.js";

const supportsQuickLook = () => {
  const relList = document.createElement("a").relList;
  return typeof relList?.supports === "function" && relList.supports("ar");
};
const hasModelElement = () => "HTMLModelElement" in window;

let loading: Promise<void> | null = null;
/** Adds the self-hosted model-viewer build once, and resolves when the element is defined. */
function loadViewer(): Promise<void> {
  if (customElements.get("model-viewer")) return Promise.resolve();
  loading ??= new Promise<void>((resolve, reject) => {
    const script = document.createElement("script");
    script.type = "module";
    script.src = MODEL_VIEWER;
    script.onerror = () => {
      loading = null;
      script.remove();
      reject(new Error("model-viewer did not load"));
    };
    document.head.append(script);
    customElements.whenDefined("model-viewer").then(() => resolve());
  });
  return loading;
}

/** Client boundary for phone AR: server pages pass the file paths, the poster and the note. */
export function PhoneAr(props: Pick<PhoneArViewProps, "glb" | "usdz" | "poster" | "note">) {
  return (
    <PhoneArView {...props} supportsQuickLook={supportsQuickLook} hasModelElement={hasModelElement} loadViewer={loadViewer} />
  );
}
