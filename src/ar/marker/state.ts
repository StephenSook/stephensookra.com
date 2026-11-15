// Marker AR on /ar/marker, as a small state machine the page and its tests share.

export type MarkerState =
  | "idle" // nothing started
  | "loading" // the press happened: engine loading, camera starting
  | "scanning" // the camera runs; no card in view yet
  | "tracking" // the card is in view and the case sits on it
  | "lost" // the card was in view and went out of it
  | "stopped" // the page was hidden, so the camera was turned off
  | "denied" // the browser blocks the camera for this site
  | "nocamera" // this device or page has no camera to use
  | "failed"; // the camera or the tracker did not start, for a reason we cannot tell

export type MarkerEvent = "start" | "camera" | "found" | "lost" | "hidden" | "stop" | "denied" | "nocamera" | "failed";

const RUNNING = new Set<MarkerState>(["loading", "scanning", "tracking", "lost"]);

/** The states that hold the camera (or are about to). */
export const running = (state: MarkerState) => RUNNING.has(state);

export function next(state: MarkerState, event: MarkerEvent): MarkerState {
  switch (event) {
    case "start":
      return running(state) ? state : "loading";
    case "camera":
      return state === "loading" ? "scanning" : state;
    case "found":
      return state === "scanning" || state === "lost" ? "tracking" : state;
    case "lost":
      return state === "tracking" ? "lost" : state;
    case "hidden":
      return running(state) ? "stopped" : state;
    case "stop":
      return running(state) ? "idle" : state;
    case "denied":
    case "nocamera":
    case "failed":
      return running(state) ? event : state;
  }
}

/** The status line for each state (read out by screen readers through role="status"). */
export const STATUS: Record<MarkerState, string> = {
  idle: "",
  loading: "Starting the camera",
  scanning: "Point the camera at the card",
  tracking: "Found the card",
  lost: "Lost the card. Point the camera at it again.",
  stopped: "The camera stopped when you left the page.",
  denied: "Camera access is blocked for this site. Allow it in your browser's site settings, then start again.",
  nocamera: "No camera was found on this device.",
  failed: "The camera or the card tracker could not start here.",
};
