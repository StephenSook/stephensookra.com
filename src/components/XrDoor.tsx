"use client";

import { FINE_POINTER_QUERY, WIDE_QUERY } from "@/scene/gate";
import { headsetPageUrl, xrSupported } from "@/xr/support";
import { XrDoorView } from "./XrDoorView";

const checkSupport = () => xrSupported(typeof navigator === "undefined" ? undefined : navigator.xr);
const isLaptop = () =>
  typeof window.matchMedia === "function" &&
  window.matchMedia(WIDE_QUERY).matches &&
  window.matchMedia(FINE_POINTER_QUERY).matches;
const pageUrl = () => headsetPageUrl(window.location.origin);
// The XR chunk: requested only when a reader presses Enter VR.
const loadSession = () => import("@/xr/XrSession").then((m) => m.default);

/**
 * Client boundary for the headset door: Enter VR where supported, else the Quest link on
 * laptops. Server pages pass the tested/untested note as text, so no schema code ships.
 */
export function XrDoor({ note }: { note: string }) {
  return (
    <XrDoorView checkSupport={checkSupport} isLaptop={isLaptop} pageUrl={pageUrl} note={note} loadSession={loadSession} />
  );
}
