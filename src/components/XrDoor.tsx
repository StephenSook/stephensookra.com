"use client";

import { FINE_POINTER_QUERY, WIDE_QUERY } from "@/scene/gate";
import { headsetPageUrl, xrSupported } from "@/xr/support";
import { XrDoorView } from "./XrDoorView";

const checkSupport = async () => {
  const xr = typeof navigator === "undefined" ? undefined : navigator.xr;
  const [vr, ar] = await Promise.all([xrSupported(xr), xrSupported(xr, undefined, "immersive-ar")]);
  return { vr, ar };
};
const isLaptop = () =>
  typeof window.matchMedia === "function" &&
  window.matchMedia(WIDE_QUERY).matches &&
  window.matchMedia(FINE_POINTER_QUERY).matches;
const pageUrl = () => headsetPageUrl(window.location.origin);
// The XR chunk: requested only when a reader presses Enter VR or Place on your wall.
const loadSession = () => import("@/xr/XrSession").then((m) => m.default);

/**
 * Client boundary for the headset door: Enter VR (and Place on your wall) where supported,
 * else the Quest link on laptops. Server pages pass the tested/untested notes as text, so no
 * schema code ships.
 */
export function XrDoor({ note, arNote }: { note: string; arNote?: string }) {
  return (
    <XrDoorView
      checkSupport={checkSupport}
      isLaptop={isLaptop}
      pageUrl={pageUrl}
      note={note}
      arNote={arNote}
      loadSession={loadSession}
    />
  );
}
