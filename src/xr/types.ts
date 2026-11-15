/** The two headset modes: VR (a dark space) and passthrough AR (the reader's own room). */
export type XrMode = "vr" | "ar";

/** Why a headset session closed: the reader left, the browser refused the request (the
 * press's user activation ran out while the chunk loaded), or it could not start at all. */
export type XrEndReason = "ended" | "blocked" | "failed";

/**
 * The contract between the page's door and the lazily loaded session. Kept free of
 * three.js imports so the door can type it without pulling the XR chunk into the page.
 */
export type XrSessionProps = {
  /** The case is in place: in front of the viewer (VR) or on a wall (passthrough). */
  onStarted: () => void;
  onEnded: (reason: XrEndReason) => void;
  /** The project whose card is open in the headset, or null when none is. The title comes
   * from the session (which has the content), so the page's door never imports it. */
  onCard: (card: { slug: string; title: string } | null) => void;
  /** Once mounted, the session hands the door a function that asks for a mode at once. The
   * door calls it as soon as it arrives (the first press) and from later presses, inside
   * those presses (WebKit requires the user's gesture). */
  onReady: (enter: (mode: XrMode) => void) => void;
};
