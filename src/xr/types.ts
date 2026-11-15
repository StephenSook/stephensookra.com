/** Why a headset session closed: the reader left, the browser refused the request (the
 * press's user activation ran out while the chunk loaded), or it could not start at all. */
export type XrEndReason = "ended" | "blocked" | "failed";

/**
 * The contract between the page's door and the lazily loaded session. Kept free of
 * three.js imports so the door can type it without pulling the XR chunk into the page.
 */
export type XrSessionProps = {
  onStarted: () => void;
  onEnded: (reason: XrEndReason) => void;
  /** The project whose card is open in the headset, or null when none is. The title comes
   * from the session (which has the content), so the page's door never imports it. */
  onCard: (card: { slug: string; title: string } | null) => void;
  /** Once mounted, the session hands the door a function that asks for VR at once. The door
   * calls it from a later press, inside that press (WebKit requires the user's gesture). */
  onReady: (enter: () => void) => void;
};
