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

/** Client boundary for the headset door: Enter VR where supported, else the Quest link on laptops. */
export function XrDoor() {
  return <XrDoorView checkSupport={checkSupport} isLaptop={isLaptop} pageUrl={pageUrl} />;
}
