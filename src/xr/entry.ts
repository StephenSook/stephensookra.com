import type { XrEndReason } from "./types";

type Session = { end(): Promise<void> | void };
type Store = { enterVR(): Promise<Session | undefined | unknown> };
type Callbacks = { onStarted: () => void; onEnded: (reason: XrEndReason) => void };

export function reasonOf(error: unknown): XrEndReason {
  const name = error instanceof Error || error instanceof DOMException ? error.name : "";
  return name === "SecurityError" || name === "NotAllowedError" ? "blocked" : "failed";
}

/**
 * Owns the request for an immersive session.
 * - enter() calls the store synchronously, so a press handler that calls it keeps the
 *   request inside the user's gesture (WebKit requires that; Chromium allows a short delay).
 * - One request at a time.
 * - release() is for unmount: a session the browser grants afterwards is ended at once,
 *   and late answers report nothing, so no headset session outlives its page.
 */
export function createEntry(store: Store, callbacks: Callbacks) {
  let pending = false;
  let released = false;
  return {
    enter() {
      if (pending || released) return;
      pending = true;
      store.enterVR().then(
        (session) => {
          pending = false;
          if (released) {
            void (session as Session | undefined)?.end();
            return;
          }
          if (session) callbacks.onStarted();
          else callbacks.onEnded("failed");
        },
        (error) => {
          pending = false;
          if (!released) callbacks.onEnded(reasonOf(error));
        },
      );
    },
    release() {
      released = true;
    },
  };
}
