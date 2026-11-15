import type { XrEndReason } from "./types";

type Session = { end(): Promise<void> | void };
type Store = { enterVR(): Promise<Session | undefined | unknown> };
type Callbacks = { onStarted: () => void; onEnded: (reason: XrEndReason) => void };
type Xr = { requestSession: (...args: never[]) => Promise<unknown> };

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
 * - The store returns the session only after its renderer setup succeeds. If setup fails
 *   after the browser has granted a session, the store never hands it over, so enter()
 *   keeps the browser's own answer (by wrapping requestSession for the length of the
 *   synchronous store call, nothing else ever sees the wrapper) and ends that session.
 */
export function createEntry(
  store: Store,
  callbacks: Callbacks,
  xr: Xr | undefined = typeof navigator === "undefined" ? undefined : (navigator.xr as unknown as Xr | undefined),
) {
  let pending = false;
  let released = false;

  /** Calls store.enterVR(), keeping the browser's own session promise from inside it. */
  function ask(): { result: Promise<unknown>; granted: Promise<unknown> | undefined } {
    let granted: Promise<unknown> | undefined;
    const own = xr && Object.prototype.hasOwnProperty.call(xr, "requestSession");
    const original = xr?.requestSession;
    if (xr && original) {
      xr.requestSession = ((...args: never[]) => (granted = original.apply(xr, args))) as Xr["requestSession"];
    }
    try {
      return { result: store.enterVR(), granted };
    } finally {
      if (xr && original) {
        if (own) xr.requestSession = original;
        else delete (xr as Partial<Xr>).requestSession;
      }
    }
  }

  return {
    enter() {
      if (pending || released) return;
      pending = true;
      let granted: Promise<unknown> | undefined;
      let result: Promise<unknown>;
      try {
        ({ result, granted } = ask());
      } catch (error) {
        pending = false;
        if (!released) callbacks.onEnded(reasonOf(error));
        return;
      }
      result.then(
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
          // The browser may have granted a session the store then failed to set up.
          granted?.then((s) => (s as Session | undefined)?.end()).catch(() => {});
          if (!released) callbacks.onEnded(reasonOf(error));
        },
      );
    },
    release() {
      released = true;
    },
  };
}
